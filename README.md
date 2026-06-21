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

## Production hardening — action items

The app runs, but `/api/chat` is currently **open and unauthenticated** — every
call spends our OpenRouter credits. Before exposing it publicly, work through the
items below.

> **Reality check on "only the frontend can use the API":** this is not fully
> achievable. A browser SPA holds no secret the user can't read — anyone can copy
> the `/api/chat` request from DevTools and replay it with `curl`. Embedded tokens
> are extractable. The realistic goal is to **raise the bar** and **control who and
> how much**, not to make direct calls impossible.

### Access control

- [ ] **Lock down CORS.** Add `CORSMiddleware` restricted to our own origin so other
      *websites'* browser JS can't call the API. Note: this is browser-enforced only
      — it does **not** stop `curl`/Postman.
- [ ] **Add real authentication** if access must be restricted to known users. Either
      a simple shared API key/token checked via a FastAPI dependency, or full user
      accounts with session/JWT. This is the only thing that actually controls *who*
      can call the API. (Cost: a login flow.)
- [ ] *(Optional, weak)* **Page-issued short-lived token.** Have the server sign a
      token when it serves `/`, and require it on `/api/chat`. Deters casual direct
      calls but is still extractable — defense-in-depth, not a real gate.

### Abuse / cost control (the real defense for a public API)

Rate limiting is the main lever, but it has one blind spot: **per-IP limits don't
stop *distributed* abuse** (a botnet/proxy pool gives many IPs, each staying under
the limit). So layer these, in priority order:

- [ ] **Set a hard spend cap on OpenRouter** (do this first — it's one setting).
      This is the only control that **bounds the worst case** regardless of bugs,
      botnets, or a misconfigured rate limit. Rate limiting lowers the *odds* of a
      big bill; the spend cap *caps* it. Always have both.
- [ ] **Server-side, IP-keyed rate limiting** (e.g. [`slowapi`](https://github.com/laurentS/slowapi)).
      The day-to-day defense against single-source abuse. Needs **no extra client
      metadata** — keys off the client IP (or auth identity) the server already
      sees. Add a per-IP cap on `/api/chat`. Keep limits generous: shared IPs
      (corporate NAT, mobile carriers) mean legit users can collide.
- [ ] **Cap cost *per allowed* request.** Rate limiting controls frequency, not
      size — one permitted call can still be huge. Add `max_length` / validators to
      `ChatRequest.message` and bound `history` length in `service/models.py`.
      (`MAX_TOOL_ROUNDS` in `service/jaceagent.py` already bounds the tool-loop cost.)
- [ ] *(If it actually gets abused)* **Add a bot check** like Cloudflare Turnstile
      — handles the distributed case without forcing logins.

> **Reverse-proxy gotcha:** behind a proxy/CDN, every request looks like it comes
> from the proxy's IP unless you read the real client from `X-Forwarded-For` (and
> only trust it from your proxy). Get this wrong and you either rate-limit *everyone
> as one*, or trust a spoofable header.

- [ ] *(UX only, not security)* **Client-side debounce/disable-on-send.** Prevents
      accidental double-submits. Provides **zero** protection — bypassed by calling
      the API directly — so never rely on it.

### Deployment

- [x] **Run the endpoint as `def` (threadpool), not `async def`** — avoids blocking
      the event loop on the synchronous agent loop.
- [ ] **Serve with `uv run fastapi run main.py`** (production), not `fastapi dev`.
      For real load, front with `gunicorn` + `uvicorn` workers behind a TLS reverse
      proxy (nginx/Caddy).
- [ ] **Build the frontend in the deploy pipeline.** `frontend/dist/` is gitignored;
      run `npm run build` on CI/host or the site silently 404s at `/`.
- [ ] **Set `OPENROUTER_API_KEY` as a host secret** (never committed).
- [ ] **Surface real errors.** Replace the catch-all in `service/chat_service.py`
      (which returns failures as a 200 reply) with proper 5xx responses + logging.
- [ ] **Confirm the host provides Python ≥ 3.14** (see `pyproject.toml`); many
      platform images don't yet.
