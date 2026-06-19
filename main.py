import argparse

from jaceagent import JaceAgent


def main():
    parser = argparse.ArgumentParser(
        description="Jace — a Magic: The Gathering Commander deckbuilding assistant.",
    )
    parser.add_argument(
        "prompt",
        nargs="?",
        help="Your question for Jace. If omitted, you'll be prompted to type one.",
    )
    parser.add_argument(
        "-m",
        "--model",
        default=None,
        help="Override the model slug (e.g. anthropic/claude-sonnet-4-6).",
    )
    args = parser.parse_args()

    agent = JaceAgent(model=args.model) if args.model else JaceAgent()

    print("Jace is ready. Type your question, or 'exit'/'quit' (Ctrl+C) to leave.")

    # If a prompt was passed on the command line, answer it as the first turn.
    pending = args.prompt
    while True:
        if pending is not None:
            user_message = pending
            pending = None
        else:
            try:
                user_message = input("\nYou: ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                break

        if not user_message:
            continue
        if user_message.lower() in {"exit", "quit"}:
            break

        response = agent.chat(user_message)
        print(f"\nJace: {response}")


if __name__ == "__main__":
    main()
