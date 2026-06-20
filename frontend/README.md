# Jace — Frontend

A single-page React app that provides a ChatGPT/Claude-style chat view for the
Jace MTG Commander agent ([`../jaceagent.py`](../jaceagent.py)).

Right now it ships a **mock backend** so the UI runs standalone. When the Python
API is ready, point the app at it (see _Connecting the backend_) and the same UI
works unchanged.

## Stack

- React 19 + TypeScript
- Vite 6 (pinned for Node 20.18 compatibility — see _Node version_)
- No UI/component libraries; plain CSS in [`src/App.css`](src/App.css)

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the built dist/
```

## Project layout

```
src/
  api/
    client.ts        # ChatBackend interface + backend selector (mock vs HTTP)
    mockBackend.ts   # fake responses so the UI runs without a server
  components/
    Composer.tsx     # auto-growing input, Enter-to-send
    Message.tsx      # one chat turn + tiny markdown renderer
    ToolCallBadge.tsx# chips showing tool calls (search_scryfall, etc.)
  types.ts           # ChatMessage / ChatRequest / ChatResponse
  useChat.ts         # conversation state + request lifecycle
  App.tsx            # layout, welcome screen, scroll handling
```

## Connecting the backend

The UI talks to whatever implements `ChatBackend` in
[`src/api/client.ts`](src/api/client.ts). To switch from mock to a real API:

1. Copy `.env.example` to `.env.local` and set `VITE_USE_MOCK=false`.
2. Expose `POST /api/chat` from the Python side accepting a `ChatRequest`
   (`{ message, history }`) and returning a `ChatResponse`
   (`{ reply, toolCalls? }`) — see [`src/types.ts`](src/types.ts).
3. In dev, requests to `/api` are proxied to `http://localhost:8000`
   (configurable in [`vite.config.ts`](vite.config.ts)). For a different host,
   set `VITE_API_URL`.

A thin FastAPI wrapper over `JaceAgent.chat()` is the natural fit. To surface
real tool calls in the UI, have the endpoint also return which tools ran during
the turn.

## Node version

Vite 8 (the create-vite default) requires Node 20.19+/22.12+ and a native
rolldown binding that won't install on older Node. This project is pinned to
Vite 6 to work on Node 20.18. After upgrading Node you can bump back to Vite 8.
