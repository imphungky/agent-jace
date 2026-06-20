import json
from typing import Any, Literal

from pydantic import BaseModel

Role = Literal["user", "assistant"]

class HistoryMessage(BaseModel):
    role: Role
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[HistoryMessage] = []

class ToolCall(BaseModel):
    name: str
    args: dict = {}
    status: Literal["running", "done", "error"] = "done"

    @classmethod
    def from_openai(cls, tool_call: Any) -> "ToolCall":
        """Translate an OpenAI/OpenRouter tool-call object into a ToolCall.

        Starts in "running"; the agent flips status to "done"/"error" once the
        tool has executed. Arguments arrive as a JSON string and are parsed
        into a dict; malformed JSON degrades to an empty dict rather than
        raising, so tracking never breaks the agent loop.
        """
        try:
            args = json.loads(tool_call.function.arguments or "{}")
        except (json.JSONDecodeError, TypeError):
            args = {}
        return cls(name=tool_call.function.name, args=args, status="running")

class ChatResponse(BaseModel):
    reply: str
    tool_calls: list[ToolCall] = []