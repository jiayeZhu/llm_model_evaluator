from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
import time
from . import models, schemas, database
import httpx
from openai import AsyncOpenAI
import asyncio

router = APIRouter()
get_db = database.get_db

class ChatRequest(schemas.BaseModel):
    conversation_id: int
    models_to_use: List[int] # List of model IDs
    system_prompt: str
    message: str # User message content

async def fetch_llm_response(model_id: int, sys_prompt: str, history: List[dict], user_msg: str, provider_info: dict, model_name: str):
    messages = [{"role": "system", "content": sys_prompt}] + history + [{"role": "user", "content": user_msg}]
    
    client = AsyncOpenAI(
        api_key=provider_info['api_key'] or "EMPTY",
        base_url=provider_info['base_url']
    )
    
    start_time = time.time()
    ttft = None
    
    try:
        response = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            stream=True,
            extra_body={"stream_options": {"include_usage": True}}
        )
        
        full_content = ""
        input_tokens = None
        output_tokens = None
        cached_input_tokens = None
        
        async for chunk in response:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta.content or ""
                if ttft is None and delta:
                    ttft = time.time() - start_time
                full_content += delta
                
            chunk_dict = chunk.model_dump() if hasattr(chunk, 'model_dump') else chunk.dict() if hasattr(chunk, 'dict') else getattr(chunk, '__dict__', {})
            # Also check model_extra in case it's in extra fields
            if hasattr(chunk, 'model_extra') and chunk.model_extra:
                chunk_dict.update(chunk.model_extra)
                
            if 'usage' in chunk_dict and chunk_dict['usage']:
                usage = chunk_dict['usage']
                if isinstance(usage, dict):
                    input_tokens = usage.get('prompt_tokens')
                    output_tokens = usage.get('completion_tokens')
                    details = usage.get('prompt_tokens_details', {})
                    if details:
                        cached_input_tokens = details.get('cached_tokens')
                else:
                    input_tokens = getattr(usage, 'prompt_tokens', None)
                    output_tokens = getattr(usage, 'completion_tokens', None)
                    details = getattr(usage, 'prompt_tokens_details', None)
                    if details:
                        cached_input_tokens = getattr(details, 'cached_tokens', None)
        
        end_time = time.time()
        
        total_time = end_time - start_time
        # Fallback to rough token approximation if not provided by stream
        estimated_output_tokens = output_tokens if output_tokens is not None else (len(full_content) / 4)
        tps = estimated_output_tokens / (total_time - (ttft or 0)) if total_time > (ttft or 0) else 0
        
        return {
            "model_id": model_id,
            "success": True,
            "content": full_content,
            "ttft": ttft,
            "tps": tps,
            "output_tokens": int(estimated_output_tokens),
            "input_tokens": input_tokens,
            "cached_input_tokens": cached_input_tokens
        }
    except Exception as e:
        print(f"Error fetching from model {model_name}: {e}")
        return {
            "model_id": model_id,
            "success": False,
            "content": f"Error: {str(e)}",
            "ttft": None,
            "tps": None,
            "output_tokens": 0,
            "input_tokens": None,
            "cached_input_tokens": None
        }


@router.post("/chat/", response_model=List[schemas.Message])
async def chat_with_models(req: ChatRequest, db: Session = Depends(get_db)):
    conv = db.query(models.Conversation).filter(models.Conversation.id == req.conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Update system prompt if changed
    if conv.system_prompt != req.system_prompt:
        conv.system_prompt = req.system_prompt
        db.commit()
        
    # Get history
    db_messages = db.query(models.Message).options(joinedload(models.Message.generation_metadata)).filter(
        models.Message.conversation_id == req.conversation_id
    ).order_by(models.Message.created_at).all()
    
    # Save user message
    user_msg = models.Message(
        conversation_id=req.conversation_id,
        role="user",
        content=req.message
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)
    
    # Gather provider info to avoid passing session into async routines
    tasks = []
    for mid in req.models_to_use:
        db_model = db.query(models.Model).filter(models.Model.id == mid).first()
        if db_model:
            provider = db_model.provider
            p_info = {
                "api_key": provider.api_key,
                "base_url": provider.base_url
            }
            model_history = []
            for m in db_messages:
                if m.role == "user":
                    model_history.append({"role": "user", "content": m.content})
                elif m.role == "assistant":
                    if any(meta.model_id == mid for meta in m.generation_metadata):
                        model_history.append({"role": "assistant", "content": m.content})
                        
            tasks.append(fetch_llm_response(mid, req.system_prompt, model_history, req.message, p_info, db_model.model_id))
    
    # Fire requests concurrently
    results = await asyncio.gather(*tasks)
    
    # Now write results sequentially to the DB using the synchronous session
    for res in results:
        ast_msg = models.Message(
            conversation_id=req.conversation_id,
            role="assistant",
            content=res["content"]
        )
        db.add(ast_msg)
        db.flush() # get ast_msg.id
        
        meta = models.GenerationMetadata(
            message_id=ast_msg.id,
            model_id=res["model_id"],
            time_to_first_token=res["ttft"],
            tokens_per_second=res["tps"],
            output_tokens=res["output_tokens"],
            input_tokens=res.get("input_tokens"),
            cached_input_tokens=res.get("cached_input_tokens")
        )
        db.add(meta)
    
    db.commit()
    
    # Return updated conversation messages
    return db.query(models.Message).filter(models.Message.conversation_id == req.conversation_id).all()


class EditRequest(schemas.BaseModel):
    conversation_id: int
    models_to_use: List[int]
    message_id: int
    new_content: str
    system_prompt: str

@router.put("/chat/edit/", response_model=List[schemas.Message])
async def edit_and_regenerate(req: EditRequest, db: Session = Depends(get_db)):
    conv = db.query(models.Conversation).filter(models.Conversation.id == req.conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    target_msg = db.query(models.Message).filter(models.Message.id == req.message_id, models.Message.conversation_id == req.conversation_id).first()
    if not target_msg or target_msg.role != "user":
        raise HTTPException(status_code=400, detail="Invalid user message to edit")
        
    # Delete all messages after this one
    messages_after = db.query(models.Message).filter(
        models.Message.conversation_id == req.conversation_id,
        models.Message.created_at > target_msg.created_at
    ).all()
    for m in messages_after:
        db.delete(m)
        
    # Update content
    target_msg.content = req.new_content
    
    if conv.system_prompt != req.system_prompt:
        conv.system_prompt = req.system_prompt
    db.commit()
    
    # Get history up to (and including) this edited message
    db_messages = db.query(models.Message).options(joinedload(models.Message.generation_metadata)).filter(
        models.Message.conversation_id == req.conversation_id,
        models.Message.created_at <= target_msg.created_at
    ).order_by(models.Message.created_at).all()
    
    tasks = []
    for mid in req.models_to_use:
        db_model = db.query(models.Model).filter(models.Model.id == mid).first()
        if db_model:
            provider = db_model.provider
            p_info = {"api_key": provider.api_key, "base_url": provider.base_url}
            model_history = []
            for m in db_messages[:-1]:
                if m.role == "user":
                    model_history.append({"role": "user", "content": m.content})
                elif m.role == "assistant":
                    if any(meta.model_id == mid for meta in m.generation_metadata):
                        model_history.append({"role": "assistant", "content": m.content})
                        
            tasks.append(fetch_llm_response(mid, req.system_prompt, model_history, req.new_content, p_info, db_model.model_id))
            
    results = await asyncio.gather(*tasks)
    
    for res in results:
        ast_msg = models.Message(
            conversation_id=req.conversation_id,
            role="assistant",
            content=res["content"]
        )
        db.add(ast_msg)
        db.flush()
        meta = models.GenerationMetadata(
            message_id=ast_msg.id,
            model_id=res["model_id"],
            time_to_first_token=res["ttft"],
            tokens_per_second=res["tps"],
            output_tokens=res["output_tokens"],
            input_tokens=res.get("input_tokens"),
            cached_input_tokens=res.get("cached_input_tokens")
        )
        db.add(meta)
    db.commit()
    return db.query(models.Message).filter(models.Message.conversation_id == req.conversation_id).order_by(models.Message.created_at).all()

class RegenerateRequest(schemas.BaseModel):
    message_id: int
    system_prompt: str

@router.post("/chat/regenerate/", response_model=List[schemas.Message])
async def regenerate_single_message(req: RegenerateRequest, db: Session = Depends(get_db)):
    target_msg = db.query(models.Message).filter(models.Message.id == req.message_id).first()
    if not target_msg or target_msg.role != "assistant":
        raise HTTPException(status_code=400, detail="Invalid assistant message to regenerate")
        
    meta = db.query(models.GenerationMetadata).filter(models.GenerationMetadata.message_id == target_msg.id).first()
    if not meta:
        raise HTTPException(status_code=400, detail="Missing metadata for regeneration")
        
    conv = target_msg.conversation
    model_id = meta.model_id
    
    if conv.system_prompt != req.system_prompt:
        conv.system_prompt = req.system_prompt
        db.commit()
        
    # Get history leading up to the closest user message before this assistant message
    all_msgs = db.query(models.Message).filter(
        models.Message.conversation_id == target_msg.conversation_id,
        models.Message.created_at < target_msg.created_at
    ).order_by(models.Message.created_at.desc()).all()
    
    last_user_msg = next((m for m in all_msgs if m.role == "user"), None)
    if not last_user_msg:
         raise HTTPException(status_code=400, detail="No preceding user message to regenerate from")
         
    db_messages = db.query(models.Message).options(joinedload(models.Message.generation_metadata)).filter(
        models.Message.conversation_id == target_msg.conversation_id,
        models.Message.created_at < last_user_msg.created_at
    ).order_by(models.Message.created_at).all()
    
    model_history = []
    for m in db_messages:
        if m.role == "user":
            model_history.append({"role": "user", "content": m.content})
        elif m.role == "assistant":
            if any(meta.model_id == model_id for meta in m.generation_metadata):
                 model_history.append({"role": "assistant", "content": m.content})
    
    # Re-fetch just for this model
    db_model = db.query(models.Model).filter(models.Model.id == model_id).first()
    provider = db_model.provider
    p_info = {"api_key": provider.api_key, "base_url": provider.base_url}
    
    # Do generation request
    res = await fetch_llm_response(model_id, req.system_prompt, model_history, last_user_msg.content, p_info, db_model.model_id)
    
    # Update in-place
    target_msg.content = res["content"]
    meta.time_to_first_token = res["ttft"]
    meta.tokens_per_second = res["tps"]
    meta.output_tokens = res["output_tokens"]
    meta.input_tokens = res.get("input_tokens")
    meta.cached_input_tokens = res.get("cached_input_tokens")
    db.commit()
    
    return db.query(models.Message).filter(models.Message.conversation_id == target_msg.conversation_id).order_by(models.Message.created_at).all()

