import argparse

from pathlib import Path
from service.jaceagent import JaceAgent
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from service.models import ChatRequest
from service.chat_service import ChatService

app = FastAPI()

# @app.get("/")
# async def root():
#     return 

@app.post("/api/chat")
def chat(request: ChatRequest):
    return ChatService().handle_chat(request)


FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"
if FRONTEND_DIST.exists() and FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")