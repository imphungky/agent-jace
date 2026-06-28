import type { ChatBackend } from './client';
import type { ChatRequest, ChatResponse } from '../types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A stand-in for the real Python API. It fakes the *shape* of a Jace turn —
// optionally "calling a tool", then returning prose — so the UI can be built
// and demoed before the backend exists. Delete this once the HTTP backend is
// wired up, or keep it behind VITE_USE_MOCK for offline development.
export const mockBackend: ChatBackend = {
  async sendMessage(req: ChatRequest): Promise<ChatResponse> {
    await delay(500);

    const text = req.message.toLowerCase();
    const mentionsCommander = /commander|deck|build|atraxa|edric|krenko/.test(text);

    if (mentionsCommander) {
      await delay(700);
      // Scryfall image redirects keep the mock self-contained (no card ids).
      const img = (name: string, version: 'art_crop' | 'normal') =>
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=${version}`;
      const link = (name: string) =>
        `https://scryfall.com/search?q=${encodeURIComponent('!"' + name + '"')}`;
      // Card builder so each pick carries its display data, mirroring the
      // backend's resolved CardView.
      const card = (name: string, mana_cost: string, type_line: string) => ({
        name,
        mana_cost,
        type_line,
        art_crop: img(name, 'art_crop'),
        image_normal: img(name, 'normal'),
        scryfall_uri: link(name),
      });
      return {
        reply:
          "Here's a starting point for your deck. _(Mock data — wire up the " +
          'Python API for real Scryfall-grounded answers.)_',
        recommendations: [
          {
            card: card('Sol Ring', '{1}', 'Artifact'),
            reason: 'Fast mana — an auto-include in nearly every Commander deck.',
          },
          {
            card: card('Swords to Plowshares', '{W}', 'Instant'),
            reason: 'Premium single-target removal for just one white mana.',
          },
          {
            card: card('Cultivate', '{2}{G}', 'Sorcery'),
            reason: 'Ramp **and** color fixing — smooths out a multicolor manabase.',
          },
        ],
        followup: 'Want me to lean toward budget picks, or push the power level higher?',
        tool_calls: [
          {
            name: 'get_commander_details',
            args: { card_name: req.message },
            status: 'done',
          },
          {
            name: 'search_scryfall',
            args: { query: 'f:commander otag:removal' },
            status: 'done',
          },
        ],
        cards: [
          {
            name: "Atraxa, Praetors' Voice",
            mana_cost: '{G}{W}{U}{B}',
            type_line: 'Legendary Creature — Phyrexian Angel Horror',
            art_crop: img("Atraxa, Praetors' Voice", 'art_crop'),
            image_normal: img("Atraxa, Praetors' Voice", 'normal'),
            scryfall_uri: link("Atraxa, Praetors' Voice"),
            is_commander: true,
          },
        ],
      };
    }

    return {
      reply:
        "I'm Jace, a Magic: The Gathering Commander assistant. Tell me your " +
        'commander and what your deck wants to do, and I can suggest real, ' +
        'legal cards.\n\n_(Mock response — connect the backend for live answers.)_',
    };
  },
};
