# Jace — MTG Commander Deckbuilding Assistant

Jace is a command-line AI assistant that helps you improve **Magic: The Gathering**
Commander decks. It suggests cards for specific needs (card draw, removal, ramp),
analyzes deck composition, and validates choices — grounding every recommendation
in **real, format-legal cards** by querying [Scryfall](https://scryfall.com)
rather than guessing.

## How it works

Jace is an agentic loop: an LLM (via [OpenRouter](https://openrouter.ai)) is given
a structured system prompt plus a set of tools, and it decides when to call them to
research cards before answering.

- **`main.py`** — CLI entry point and chat loop.
- **`jaceagent.py`** — the `JaceAgent` class: holds conversation state, calls the
  model, and runs the tool-call loop (capped at `MAX_TOOL_ROUNDS` per message).
- **`tools.py`** — dispatches tool calls to the Scryfall client.
- **`scryfall.py`** — a thin Scryfall API client (`search` and `named` endpoints).
- **`prompts/jace-agent.yaml`** — the system prompt as structured YAML, rendered to
  text at startup. This is where Jace's behavior lives: how it asks clarifying
  questions, how it reasons about a commander's strategy, and the Scryfall query
  guidelines it follows.

### Tools available to the model

| Tool | Purpose |
| --- | --- |
| `search_scryfall` | Search for real cards by color, type, mana value, or function (oracle tags). Returns name, mana cost, oracle text, keywords, and legal formats. |
| `get_commander_details` | Look up a single named card (the user's commander), including its **color identity** and keywords, so suggestions stay on-color and on-theme. |
| `check_legality` | Verify a specific card is currently legal in Commander. |
| `analyse_curve` | Analyze a deck list's mana curve and card-type distribution. *(not yet implemented)* |

## Setup

Requires **Python ≥ 3.14** and [uv](https://docs.astral.sh/uv/).

```bash
uv sync
```

Set your OpenRouter API key in the environment:

```bash
export OPENROUTER_API_KEY="sk-or-..."     # PowerShell: $env:OPENROUTER_API_KEY="sk-or-..."
```

## Usage

Start an interactive chat:

```bash
uv run jace
```

Or ask a single question directly:

```bash
uv run jace "I'm building Atraxa, Praetors' Voice. What card draw should I run?"
```

Override the model (defaults to `anthropic/claude-haiku-4-5`):

```bash
uv run jace -m anthropic/claude-sonnet-4-6 "Suggest budget ramp for a Golgari deck"
```

Type `exit` or `quit` (or Ctrl+C) to leave an interactive session.

### Example

```
You: What's the best removal?

Jace: Removal depends a lot on your colors and power level. To point you at
the right cards:
  1. Who's your commander (or what colors)?
  2. Is your playgroup casual, focused, or high-power/cEDH?
If you'd rather I just start: assuming a mid-power deck, staples like Swords
to Plowshares (W), Beast Within (G), and Cyclonic Rift (U) are great — but
tell me your colors and I'll tailor the list.
```

When ambiguity would change *which* cards Jace recommends (most importantly the
commander's color identity), it asks a focused clarifying question first. When only
softer details are missing (budget, power level), it states its assumptions, gives a
provisional answer, and offers to refine.

## Development

Run the tests:

```bash
uv run pytest
```

The test suite checks that the system prompt renders correctly and round-trips back
to its source YAML, so editing `prompts/jace-agent.yaml` is safe — broken structure
will fail a test.
