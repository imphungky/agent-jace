import logging

from fastapi import HTTPException
from openai import APIError

from service.jaceagent import JaceAgent
from service.models import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(self) -> None:
        pass

    def handle_chat(self, request: ChatRequest) -> ChatResponse:
        try:
            agent = JaceAgent(history=request.history)
            turn = agent.chat(request.message)
        except APIError:
            # Failure talking to OpenRouter/the LLM. Log the real cause, but tell
            # the client only that the upstream service is unavailable.
            logger.exception("Upstream LLM error while handling chat")
            raise HTTPException(
                status_code=502,
                detail="The card assistant is temporarily unavailable. Please try again shortly.",
            )
        except Exception:
            # Any other failure (misconfiguration, bugs, Scryfall, etc.). Never
            # leak the exception text to the client; surface a generic message.
            logger.exception("Unexpected error while handling chat")
            raise HTTPException(
                status_code=500,
                detail="Something went wrong while answering. Please try again.",
            )

        return ChatResponse(
            reply=turn.reply,
            followup=turn.followup,
            recommendations=turn.recommendations,
            tool_calls=turn.tool_calls,
            commanders=turn.commanders,
            cards=turn.cards,
        )
