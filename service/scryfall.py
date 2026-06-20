from dataclasses import dataclass
from typing import Optional

import requests


@dataclass
class Card:
    name: str
    mana_cost: str | None
    oracle_text: str | None
    keywords: list[str]
    legal_formats: list[str]

    @classmethod
    def from_dict(cls, data: dict) -> "Card":
        legalities = data.get("legalities", {})
        legal_formats = [fmt for fmt, status in legalities.items() if status == "legal"]
        return cls(
            name=data["name"],
            mana_cost=data.get("mana_cost"),
            oracle_text=data.get("oracle_text"),
            keywords=data.get("keywords", []),
            legal_formats=legal_formats,
        )


class ScryfallClient:
    BASE_URL = "https://api.scryfall.com"

    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "mtg-agent/0.1"})

    def get_card_by_name(self, name: str, fuzzy: bool = True) -> dict:
        param = "fuzzy" if fuzzy else "exact"
        response = self.session.get(
            f"{self.BASE_URL}/cards/named", params={param: name}
        )
        response.raise_for_status()
        return response.json()
    
    def query_for_cards(self, query: str, sort: str | None = None, limit: int = 100) -> dict:
        params = {}
        params["q"] = query
        if sort:
            params["sort"] = sort
        response = self.session.get(
            f"{self.BASE_URL}/cards/search", params=params
        )
        response.raise_for_status()
        data = response.json()["data"][:limit]
        return [Card.from_dict(card) for card in data]
