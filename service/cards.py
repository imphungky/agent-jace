"""Per-turn registry of cards the agent's tools have seen, plus the logic that
picks which of them the final reply actually cites.

Display data (image URLs, Scryfall links) is held here, *outside* the prompt,
so the model-facing tool payloads stay lean while the frontend still gets rich
cards. See ``CardGallery`` on the frontend for the consumer.
"""

import re

from service.models import CardView
from service.scryfall import Card


class CardRegistry:
    def __init__(self) -> None:
        self._seen: dict[str, Card] = {}
        self._commanders: set[str] = set()

    def add(self, card: Card, is_commander: bool = False) -> None:
        """Record a card seen during this turn. Last write wins; card names are
        unique enough for display purposes."""
        self._seen[card.name] = card
        if is_commander:
            self._commanders.add(card.name)

    def views_for_reply(self, reply: str) -> list[CardView]:
        """Build the gallery for a finished reply.

        Any commander looked up this turn always leads the gallery. The rest are
        the cards whose name appears in ``reply``, in order of first mention.
        Names are matched longest-first with word boundaries so
        "Swords to Plowshares" wins before a shorter substring and "Island"
        won't match inside "Islandwalk".
        """
        chosen: list[Card] = []
        used: set[str] = set()

        # Commanders first — they were explicitly looked up, so always shown.
        for name in self._commanders:
            card = self._seen.get(name)
            if card and name not in used:
                chosen.append(card)
                used.add(name)

        # Then cards cited in the reply text, ordered by first mention.
        cited: list[tuple[int, str]] = []
        for name in sorted(self._seen, key=len, reverse=True):
            if name in used:
                continue
            match = re.search(rf"\b{re.escape(name)}\b", reply)
            if match:
                cited.append((match.start(), name))
        cited.sort(key=lambda pair: pair[0])
        for _, name in cited:
            chosen.append(self._seen[name])
            used.add(name)

        return [self._to_view(card) for card in chosen]

    def _to_view(self, card: Card) -> CardView:
        return CardView(
            name=card.name,
            mana_cost=card.mana_cost,
            type_line=card.type_line,
            image_small=card.image_small,
            image_normal=card.image_normal,
            art_crop=card.art_crop,
            scryfall_uri=card.scryfall_uri,
            is_commander=card.name in self._commanders,
        )
