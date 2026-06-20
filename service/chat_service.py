from service.jaceagent import JaceAgent
from service.models import ChatRequest, ChatResponse
class ChatService:
    def __init__(self) -> None:
        pass

    def handle_chat(self, request: ChatRequest):
        agent = JaceAgent(history=request.history)
        try: 
            (reply, tool_calls) = agent.chat(request.message)
            return ChatResponse(reply=reply, tool_calls=tool_calls)
        except Exception as e:
            return ChatResponse(reply=str(e))