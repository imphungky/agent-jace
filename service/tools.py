"""
This module contains the tools used by the agent.
"""

import json

from service.cards import CardRegistry
from service.scryfall import Card, ScryfallClient


class Tools:
    def __init__(self) -> None:
        self.scryfall = ScryfallClient()
        # Per-turn record of cards seen, so the agent can attach a gallery to
        # the response without leaking image URLs into the model's prompt.
        self.registry = CardRegistry()

    def handle_tool_call(self, tool_call) -> dict:
        """Run a single tool call and return a message ready to append to
        the chat's messages array."""
        name = tool_call.function.name
        try:
            arguments = json.loads(tool_call.function.arguments)
            result = self._dispatch(name, arguments)
            content = json.dumps(result)
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
                cards = self.scryfall.query_for_cards(arguments["query"])
                for card in cards:
                    self.registry.add(card)
                # Hand the model the lean view; image URLs stay in the registry.
                return [card.to_model_dict() for card in cards]
            case "get_commander_details":
                data = self.scryfall.get_card_by_name(arguments["card_name"])
                self.registry.add(Card.from_dict(data), is_commander=True)
                return {
                    "name": data["name"],
                    "mana_cost": data.get("mana_cost"),
                    "type_line": data.get("type_line"),
                    "oracle_text": data.get("oracle_text"),
                    "keywords": data.get("keywords", []),
                    "color_identity": data.get("color_identity", []),
                    "commander_legal": data.get("legalities", {}).get("commander") == "legal",
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
