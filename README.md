# Jace — MTG Commander Deckbuilding Assistant

Jace is an AI assistant that helps you improve **Magic: The Gathering** Commander
decks. It suggests cards for specific needs (card draw, removal, ramp), analyzes
deck composition, and validates choices — grounding every recommendation in
**real, format-legal cards** by querying [Scryfall](https://scryfall.com) rather
than guessing.

It runs as a **web app**: a FastAPI backend wrapping an agentic LLM loop, with a
React single-page frontend that provides a ChatGPT/Claude-style chat view.

## How it works

Jace is an agentic loop: an LLM (via [OpenRouter](https://openrouter.ai)) is given
a structured system prompt plus a set of tools, and it decides when to call them to
research cards before answering. The API is **stateless** — the browser owns the
conversation and replays it with each request.

```
frontend/ (React SPA)  ──POST /api/chat──▶  main.py (FastAPI)
                                              └─▶ service/chat_service.py
                                                   └─▶ service/jaceagent.py  (LLM ↔ tool loop)
                                                        └─▶ service/tools.py ─▶ service/scryfall.py
```

### Backend (`main.py` + `service/`)

- **`main.py`** — FastAPI app. Exposes `POST /api/chat`.
- **`service/chat_service.py`** — orchestration: builds a `JaceAgent` seeded from
  the request's history, runs one turn, maps the result to a `ChatResponse`.
- **`service/jaceagent.py`** — the `JaceAgent` class: builds `message_history`,
  calls the model, and runs the tool-call loop (capped at `MAX_TOOL_ROUNDS` per
  message). Returns the final text plus the tool calls it made.
- **`service/tools.py`** — dispatches tool calls to the Scryfall client.
- **`service/scryfall.py`** — a thin Scryfall API client (`search` and `named`).
- **`service/models.py`** — Pydantic request/response schemas (`ChatRequest`,
  `ChatResponse`, `ToolCall`, `HistoryMessage`).
- **`prompts/jace-agent.yaml`** — the system prompt as structured YAML, rendered to
  text at startup. This is where Jace's behavior lives: how it asks clarifying
  questions, how it reasons about a commander's strategy, and the Scryfall query
  guidelines it follows.

### Frontend (`frontend/`)

A React + TypeScript SPA (Vite). It owns the conversation state and renders the
chat, including chips showing which tools the agent used. It ships with a mock
backend so it runs standalone, and switches to the real API via an env flag. See
[`frontend/README.md`](frontend/README.md) for details.

### Tools available to the model

| Tool | Purpose |
| --- | --- |
| `search_scryfall` | Search for real cards by color, type, mana value, or function (oracle tags). Returns name, mana cost, oracle text, keywords, and legal formats. |
| `get_commander_details` | Look up a single named card (the user's commander), including its **color identity** and keywords, so suggestions stay on-color and on-theme. |
| `check_legality` | Verify a specific card is currently legal in Commander. |
| `analyse_curve` | Analyze a deck list's mana curve and card-type distribution. *(not yet implemented)* |

## API

### `POST /api/chat`

Request:

```jsonc
{
  "message": "Help me build Krenko",
  "history": [                                   // prior turns, oldest first
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Response:

```jsonc
{
  "reply": "Krenko, Mob Boss is a mono-red goblin payoff...",
  "tool_calls": [                                // display-only metadata
    { "name": "search_scryfall", "args": { "query": "id:r t:goblin" }, "status": "done" }
  ]
}
```

## Setup

Requires **Python ≥ 3.14** ([uv](https://docs.astral.sh/uv/)) and **Node ≥ 20**
for the frontend.

```bash
uv sync
```

Set your OpenRouter API key in the environment:

```bash
export OPENROUTER_API_KEY="sk-or-..."     # PowerShell: $env:OPENROUTER_API_KEY="sk-or-..."
```

## Running

### Backend (API)

```bash
uv run fastapi dev main.py
```

Serves the API on http://127.0.0.1:8000 with auto-reload.

### Frontend (UI)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

## Development

Run the backend tests:

```bash
uv run pytest
```

The test suite checks that the system prompt renders correctly and round-trips back
to its source YAML, so editing `prompts/jace-agent.yaml` is safe — broken structure
will fail a test.
