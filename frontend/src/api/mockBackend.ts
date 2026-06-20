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
      return {
        reply:
          "Here's a starting point. (This is mock data — wire up the Python " +
          'API to get real Scryfall-grounded answers.)\n\n' +
          '- **Sol Ring** — fast mana, an auto-include in almost every deck.\n' +
          '- **Swords to Plowshares** — premium single-target removal.\n' +
          '- **Cultivate** — ramp and fixing in green.',
        toolCalls: [
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
