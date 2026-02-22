from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import httpx

from . import models, schemas, database

router = APIRouter()
get_db = database.get_db

# --- Providers ---
@router.post("/providers/", response_model=schemas.Provider)
def create_provider(provider: schemas.ProviderCreate, db: Session = Depends(get_db)):
    db_provider = models.Provider(**provider.model_dump())
    db.add(db_provider)
    db.commit()
    db.refresh(db_provider)
    return db_provider

@router.get("/providers/", response_model=List[schemas.Provider])
def read_providers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    providers = db.query(models.Provider).offset(skip).limit(limit).all()
    return providers

@router.delete("/providers/{provider_id}", response_model=schemas.Provider)
def delete_provider(provider_id: int, db: Session = Depends(get_db)):
    provider = db.query(models.Provider).filter(models.Provider.id == provider_id).first()
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    db.delete(provider)
    db.commit()
    return provider

# --- Models ---
@router.post("/models/", response_model=schemas.Model)
def create_model(model: schemas.ModelCreate, db: Session = Depends(get_db)):
    db_model = models.Model(**model.model_dump())
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model

@router.get("/models/", response_model=List[schemas.Model])
def read_models(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    models_ = db.query(models.Model).offset(skip).limit(limit).all()
    return models_

@router.delete("/models/{model_id}", response_model=schemas.Model)
def delete_model(model_id: int, db: Session = Depends(get_db)):
    model = db.query(models.Model).filter(models.Model.id == model_id).first()
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")
    db.delete(model)
    db.commit()
    return model

@router.put("/models/{model_id}/toggle", response_model=schemas.Model)
def toggle_model(model_id: int, db: Session = Depends(get_db)):
    model = db.query(models.Model).filter(models.Model.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    model.enabled = not model.enabled
    db.commit()
    db.refresh(model)
    return model

@router.post("/providers/{provider_id}/sync_models")
async def sync_models(provider_id: int, db: Session = Depends(get_db)):
    provider = db.query(models.Provider).filter(models.Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    headers = {}
    if provider.api_key:
        headers["Authorization"] = f"Bearer {provider.api_key}"
    
    url = f"{provider.base_url.rstrip('/')}/models"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            api_models = data.get("data", [])
            
            # Simple sync: add models that don't exist yet
            added = 0
            for am in api_models:
                m_id = am.get("id")
                if m_id:
                    existing = db.query(models.Model).filter(
                        models.Model.provider_id == provider_id,
                        models.Model.model_id == m_id
                    ).first()
                    if not existing:
                        new_model = models.Model(
                            provider_id=provider_id,
                            model_id=m_id,
                            name=m_id, # Default to ID, user can edit later
                            is_reasoning=False,
                            enabled=True
                        )
                        db.add(new_model)
                        added += 1
            db.commit()
            return {"status": "success", "added": added}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch models: {str(e)}")

# --- Conversations & Messages ---
@router.post("/conversations/", response_model=schemas.Conversation)
def create_conversation(conv: schemas.ConversationCreate, db: Session = Depends(get_db)):
    db_conv = models.Conversation(**conv.model_dump())
    db.add(db_conv)
    db.commit()
    db.refresh(db_conv)
    return db_conv

@router.get("/conversations/", response_model=List[schemas.Conversation])
def read_conversations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Conversation).order_by(models.Conversation.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/conversations/{conversation_id}", response_model=schemas.Conversation)
def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    # Cascade delete is configured on the models, so this will delete messages too
    db.delete(conv)
    db.commit()
    return {"status": "success"}

@router.post("/messages/", response_model=schemas.Message)
def create_message(msg: schemas.MessageCreate, db: Session = Depends(get_db)):
    db_msg = models.Message(**msg.model_dump())
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    return db_msg
