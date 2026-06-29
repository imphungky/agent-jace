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

class CardView(BaseModel):
    """Display-only card data for the frontend gallery. Never sent to the LLM."""
    name: str
    mana_cost: str | None = None
    type_line: str | None = None
    image_small: str | None = None
    image_normal: str | None = None  # full card, used for hover-to-enlarge
    art_crop: str | None = None
    scryfall_uri: str | None = None
    is_commander: bool = False  # looked up via get_commander_details

class Recommendation(BaseModel):
    """One card suggestion: the display card plus Jace's reason for it.

    The model supplies a card *name* and a free-text reason; the backend
    resolves the name to a full ``CardView`` (image, mana cost, Scryfall link)
    so the frontend can draw the card beside its explanation. ``reason`` is
    Markdown and rendered as such.
    """
    card: CardView
    reason: str = ""

class ChatResponse(BaseModel):
    reply: str                                   # markdown framing / message text
    followup: str = ""                           # optional markdown closing line / question
    recommendations: list[Recommendation] = []   # structured card picks, drawn as rows
    tool_calls: list[ToolCall] = []
    commanders: list[CardView] = []               # the deck's commander(s), rendered at the top
    cards: list[CardView] = []                    # other supporting/cited cards (no commanders)