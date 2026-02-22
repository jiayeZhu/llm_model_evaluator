from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .api import router as core_router
from .chat import router as chat_router

# In a real app we would use Alembic for migrations,
# but for simplicity we can trigger creation here as a fallback 
# (though Alembic is preferred and will be setup)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="LLM Evaluator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(core_router, prefix="/api")
app.include_router(chat_router, prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "ok"}
