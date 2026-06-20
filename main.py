import argparse

from service.jaceagent import JaceAgent
from fastapi import FastAPI
from service.models import ChatRequest
from service.chat_service import ChatService

app = FastAPI()

@app.get("/")
async def root():
    return 



@app.post("/api/chat")
async def chat(request: ChatRequest):
    return ChatService().handle_chat(request)