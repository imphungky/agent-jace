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

    user_message = args.prompt or input("Ask Jace: ").strip()
    if not user_message:
        parser.error("no prompt provided")

    agent = JaceAgent(model=args.model) if args.model else JaceAgent()
    response = agent.chat(user_message)
    print(response)


if __name__ == "__main__":
    main()
