import os

from openai import OpenAI

from scryfall import ScryfallClient

SYSTEM_PROMPT = (
    "You are Jace, an expert Magic: The Gathering deckbuilding assistant "
    "specializing in the Commander format. Use the provided tools to look up "
    "cards and verify legality before recommending them. Prefer concrete, "
    "rules-accurate suggestions over vague advice."
)

TOOLS = [
  {
    "type": "function",
    "function": {
      "name": "search_scryfall",
      "description": "Search for Magic: The Gathering cards using Scryfalls search API. Use this when you need to find cards matching specific criteria. Returns card names, oracle text, mana cost, type, prices, and legality. Query must be valid Scryfall syntax.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Scryfall search query string"
          }
        },
        "required": ["query"]
      }
    }
  },
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
    def __init__(self, model: str = "anthropic/claude-sonnet-4-6") -> None:
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not set in the environment")

        self.model = model
        self.llm = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )
        self.scryfall = ScryfallClient()
        self.tools = TOOLS
        self.system_prompt = SYSTEM_PROMPT

    def chat(self, user_message: str):
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_message},
        ]
        return self.llm.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=self.tools,
        )
