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

    def supporting_views_for_reply(self, reply: str) -> list[CardView]:
        """Build the supporting gallery for a finished reply.

        Commanders are surfaced separately (see ``commander_views``) and excluded
        here. The result is the non-commander cards whose name appears in
        ``reply``, in order of first mention. Names are matched longest-first with
        word boundaries so "Swords to Plowshares" wins before a shorter substring
        and "Island" won't match inside "Islandwalk".
        """
        # Cards cited in the reply text, ordered by first mention; skip commanders.
        cited: list[tuple[int, str]] = []
        for name in sorted(self._seen, key=len, reverse=True):
            if name in self._commanders:
                continue
            match = re.search(rf"\b{re.escape(name)}\b", reply)
            if match:
                cited.append((match.start(), name))
        cited.sort(key=lambda pair: pair[0])
        return [self._to_view(self._seen[name]) for _, name in cited]

    def view_for(self, name: str) -> CardView:
        """Resolve a card name to its display view, for a structured
        recommendation. Tries an exact hit, then a case-insensitive match, and
        finally falls back to a name-only view so a card the model named but we
        never saw still renders (just without art)."""
        card = self._seen.get(name)
        if card is None:
            lowered = name.lower()
            card = next(
                (c for n, c in self._seen.items() if n.lower() == lowered), None
            )
        if card is None:
            return CardView(name=name)
        return self._to_view(card)

    def commander_views(self) -> list[CardView]:
        """Display views for any commander looked up this turn."""
        return [self._to_view(self._seen[n]) for n in self._commanders if n in self._seen]

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
