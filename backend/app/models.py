from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Provider(Base):
    __tablename__ = "providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    base_url = Column(String)
    api_key = Column(String)
    
    models = relationship("Model", back_populates="provider", cascade="all, delete-orphan")

class Model(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id"))
    model_id = Column(String, index=True) # e.g., 'gpt-4-turbo'
    name = Column(String) # For display e.g., 'GPT-4 Turbo'
    is_reasoning = Column(Boolean, default=False)
    
    provider = relationship("Provider", back_populates="models")
    generation_metadata = relationship("GenerationMetadata", back_populates="model", cascade="all, delete-orphan")

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, default="New Conversation")
    system_prompt = Column(Text, default="You are a helpful assistant.")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    role = Column(String) # 'user' or 'assistant'
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    conversation = relationship("Conversation", back_populates="messages")
    generation_metadata = relationship("GenerationMetadata", back_populates="message", cascade="all, delete-orphan")

class GenerationMetadata(Base):
    __tablename__ = "generation_metadata"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"))
    model_id = Column(Integer, ForeignKey("models.id"))
    
    time_to_first_token = Column(Float, nullable=True) # in ms or s
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    tokens_per_second = Column(Float, nullable=True)
    cached_input_tokens = Column(Integer, nullable=True)
    
    message = relationship("Message", back_populates="generation_metadata")
    model = relationship("Model", back_populates="generation_metadata")
