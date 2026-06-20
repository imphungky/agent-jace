"""
This module contains the tools used by the agent.
"""

import json
from dataclasses import asdict, is_dataclass

from service.scryfall import ScryfallClient


def _json_default(obj):
    """Let json.dumps serialize dataclasses (e.g. Card) into plain dicts."""
    if is_dataclass(obj):
        return asdict(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


class Tools:
    def __init__(self) -> None:
        self.scryfall = ScryfallClient()

    def handle_tool_call(self, tool_call) -> dict:
        """Run a single tool call and return a message ready to append to
        the chat's messages array."""
        name = tool_call.function.name
        try:
            arguments = json.loads(tool_call.function.arguments)
            result = self._dispatch(name, arguments)
            content = json.dumps(result, default=_json_default)
        except Exception as e:
            # Hand the error back to the model instead of crashing the loop;
            # it can read this and decide how to recover.
            content = json.dumps({"error": str(e)})

        return {
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": content,
        }

    def _dispatch(self, name: str, arguments: dict):
        """Map a tool name + parsed arguments to the actual work."""
        match name:
            case "search_scryfall":
                return self.scryfall.query_for_cards(arguments["query"])
            case "get_commander_details":
                card = self.scryfall.get_card_by_name(arguments["card_name"])
                return {
                    "name": card["name"],
                    "mana_cost": card.get("mana_cost"),
                    "type_line": card.get("type_line"),
                    "oracle_text": card.get("oracle_text"),
                    "keywords": card.get("keywords", []),
                    "color_identity": card.get("color_identity", []),
                    "commander_legal": card.get("legalities", {}).get("commander") == "legal",
                }
            case "check_legality":
                card = self.scryfall.get_card_by_name(arguments["card_name"])
                return {
                    "card_name": card["name"],
                    "commander_legal": card.get("legalities", {}).get("commander") == "legal",
                }
            case "analyse_curve":
                raise NotImplementedError("analyse_curve is not implemented yet")
            case _:
                raise ValueError(f"Unknown tool: {name}")
