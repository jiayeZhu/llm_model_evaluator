import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# The DATABASE_URL is provided by the environment, or default for local testing
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://evaluator:password@localhost:5432/llm_evaluator")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
