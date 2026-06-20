import yaml

from service.jaceagent import PROMPT_PATH, load_system_prompt


def test_prompt_is_nonempty_string():
    prompt = load_system_prompt()
    assert isinstance(prompt, str)
    assert prompt.strip()


def test_prompt_contains_key_content():
    prompt = load_system_prompt()
    assert "You are Jace" in prompt
    assert "otag:card-draw" in prompt
    assert "format:commander" in prompt


def test_rendered_prompt_round_trips_to_original_data():
    """The rendered text must parse back into exactly the source YAML data,
    proving no sections are dropped or altered when porting to a string."""
    original = yaml.safe_load(PROMPT_PATH.read_text(encoding="utf-8"))
    rendered = load_system_prompt()
    assert yaml.safe_load(rendered) == original
