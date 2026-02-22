from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Provider Schemas
class ProviderBase(BaseModel):
    name: str
    base_url: str
    api_key: str

class ProviderCreate(ProviderBase):
    pass

class Provider(ProviderBase):
    id: int

    class Config:
        from_attributes = True

# Model Schemas
class ModelBase(BaseModel):
    model_id: str
    name: str
    is_reasoning: bool = False
    enabled: bool = True

class ModelCreate(ModelBase):
    provider_id: int

class Model(ModelBase):
    id: int
    provider_id: int

    class Config:
        from_attributes = True

# GenerationMetadata Schemas
class GenerationMetadataBase(BaseModel):
    model_id: int
    time_to_first_token: Optional[float] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    tokens_per_second: Optional[float] = None
    cached_input_tokens: Optional[int] = None

class GenerationMetadataCreate(GenerationMetadataBase):
    message_id: int

class GenerationMetadata(GenerationMetadataBase):
    id: int
    message_id: int

    class Config:
        from_attributes = True

# Message Schemas
class MessageBase(BaseModel):
    role: str
    content: str

class MessageCreate(MessageBase):
    conversation_id: int

class Message(MessageBase):
    id: int
    conversation_id: int
    created_at: datetime
    generation_metadata: List[GenerationMetadata] = []

    class Config:
        from_attributes = True

# Conversation Schemas
class ConversationBase(BaseModel):
    title: str
    system_prompt: str

class ConversationCreate(ConversationBase):
    pass

class Conversation(ConversationBase):
    id: int
    created_at: datetime
    messages: List[Message] = []

    class Config:
        from_attributes = True
