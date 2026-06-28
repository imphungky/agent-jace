from dataclasses import dataclass
from typing import Optional

import requests


def _front_face_images(data: dict) -> dict:
    """Single-faced cards carry top-level ``image_uris``; double-faced cards
    nest them under ``card_faces[0]``. Fall back to the front face so both
    render."""
    if data.get("image_uris"):
        return data["image_uris"]
    faces = data.get("card_faces") or []
    if faces and faces[0].get("image_uris"):
        return faces[0]["image_uris"]
    return {}


@dataclass
class Card:
    name: str
    mana_cost: str | None
    oracle_text: str | None
    keywords: list[str]
    legal_formats: list[str]
    # Display-only fields, surfaced to the frontend gallery (not the model).
    type_line: str | None = None
    image_small: str | None = None
    image_normal: str | None = None
    art_crop: str | None = None
    scryfall_uri: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "Card":
        legalities = data.get("legalities", {})
        legal_formats = [fmt for fmt, status in legalities.items() if status == "legal"]
        images = _front_face_images(data)
        return cls(
            name=data["name"],
            mana_cost=data.get("mana_cost"),
            oracle_text=data.get("oracle_text"),
            keywords=data.get("keywords", []),
            legal_formats=legal_formats,
            type_line=data.get("type_line"),
            image_small=images.get("small"),
            image_normal=images.get("normal"),
            art_crop=images.get("art_crop"),
            scryfall_uri=data.get("scryfall_uri"),
        )

    def to_model_dict(self) -> dict:
        """Lean view handed to the LLM: card text and legality only, no image
        URLs. Keeps tool results compact and avoids spending tokens on data the
        model never needs."""
        return {
            "name": self.name,
            "mana_cost": self.mana_cost,
            "oracle_text": self.oracle_text,
            "keywords": self.keywords,
            "legal_formats": self.legal_formats,
        }


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
