from jaceagent import JaceAgent


def main():
    agent = JaceAgent()
    response = agent.chat("Suggest some 1-mana red creatures for an aggressive Commander deck.")
    print(response.choices[0].message)


if __name__ == "__main__":
    main()
