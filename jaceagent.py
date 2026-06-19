import os
from pathlib import Path

import yaml
from openai import OpenAI
from tools import Tools
PROMPT_PATH = Path(__file__).parent / "prompts" / "jace-agent.yaml"


def load_system_prompt(path: Path = PROMPT_PATH) -> str:
    """Load the structured prompt YAML and render the whole document to text."""
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True).strip()


SYSTEM_PROMPT = load_system_prompt()

TOOL_SET = [
{
  "type": "function",
  "function": {
    "name": "search_scryfall",
    "description": (
      "Search for real Magic: The Gathering cards via Scryfall. Call this "
      "whenever you need to find cards matching criteria like color, type, "
      "mana value, or function (removal, ramp, card draw). Always call it "
      "before recommending specific cards, so suggestions are real and legal "
      "rather than guessed. Returns a list of cards, each with: name, "
      "mana_cost, oracle_text, and legal_formats. Does NOT return price or set data."
    ),
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": (
            "A Scryfall search query. Combine filters with spaces (implicit AND). "
            "Common filters: t: type (t:creature), c: color (c:r), id: color "
            "identity (id:rw), mv: mana value (mv=1, mv<=3), o: oracle text "
            "(o:\"draw a card\"), otag: function tag (otag:removal), f: format "
            "(f:commander). Example: 't:creature c:r mv=1 f:commander'."
          )
        }
      },
      "required": ["query"]
    }
  }
}
,
  {
    "type": "function",
    "function": {
      "name": "check_legality",
      "description": "Verify whether a specific card is currently legal in Commander format. Use this to validate suggestions before recommending them, especially for cards that may have been recently banned.",
      "parameters": {
        "type": "object",
        "properties": {
          "card_name": {
            "type": "string",
            "description": "Exact card name to check"
          }
        },
        "required": ["card_name"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "analyse_curve",
      "description": "Analyze the mana curve and card type distribution of a deck list. Returns mana cost distribution, card type breakdown, and average mana value. Use this when a user shares their deck list and wants to understand gaps or imbalances.",
      "parameters": {
        "type": "object",
        "properties": {
          "card_list": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Array of card names in the deck"
          }
        },
        "required": ["card_list"]
      }
    }
  }
]


class JaceAgent:
    def __init__(self, model: str = "anthropic/claude-haiku-4-5") -> None:
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not set in the environment")

        self.model = model
        self.llm = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )
        self.toolset = TOOL_SET
        self.tools = Tools()
        self.system_prompt = SYSTEM_PROMPT
        self.message_history = []

    def chat(self, user_message: str):
        self.message_history = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_message},
        ]
        while len(self.message_history) < 12:
            conversation = self.llm.chat.completions.create(
                model=self.model,
                messages=self.message_history,
                tools=self.toolset,
            )
            if not conversation.choices or len(conversation.choices) == 0:
                raise RuntimeError("no choices in response")
            message = conversation.choices[0].message
            if not message:
                raise RuntimeError("no message in response")
            self.message_history.append(message)
            if message.tool_calls and len(message.tool_calls) > 0:
                tool_call = message.tool_calls[0]
                self.message_history.append(self.tools.handle_tool_call(tool_call))
            elif message.content:
                return message.content
        return ""