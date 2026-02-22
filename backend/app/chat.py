from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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
            stream=True
        )
        
        full_content = ""
        async for chunk in response:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta.content or ""
                if ttft is None and delta:
                    ttft = time.time() - start_time
                full_content += delta
        
        end_time = time.time()
        
        total_time = end_time - start_time
        # Rough token approximation if not provided by stream
        estimated_output_tokens = len(full_content) / 4 
        tps = estimated_output_tokens / (total_time - (ttft or 0)) if total_time > (ttft or 0) else 0
        
        return {
            "model_id": model_id,
            "success": True,
            "content": full_content,
            "ttft": ttft,
            "tps": tps,
            "output_tokens": int(estimated_output_tokens)
        }
    except Exception as e:
        print(f"Error fetching from model {model_name}: {e}")
        return {
            "model_id": model_id,
            "success": False,
            "content": f"Error: {str(e)}",
            "ttft": None,
            "tps": None,
            "output_tokens": 0
        }


@router.post("/chat/")
async def chat_with_models(req: ChatRequest, db: Session = Depends(get_db)):
    conv = db.query(models.Conversation).filter(models.Conversation.id == req.conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Update system prompt if changed
    if conv.system_prompt != req.system_prompt:
        conv.system_prompt = req.system_prompt
        db.commit()
        
    # Get history
    db_messages = db.query(models.Message).filter(models.Message.conversation_id == req.conversation_id).order_by(models.Message.created_at).all()
    history = [{"role": m.role, "content": m.content, "conversation_id": req.conversation_id} for m in db_messages if m.role in ["user", "assistant"]]
    
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
            tasks.append(fetch_llm_response(mid, req.system_prompt, history, req.message, p_info, db_model.model_id))
    
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
        )
        db.add(meta)
    
    db.commit()
    
    # Return updated conversation messages
    return db.query(models.Message).filter(models.Message.conversation_id == req.conversation_id).all()
