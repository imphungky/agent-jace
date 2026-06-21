FROM python:bookworm

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY README.md ./
COPY prompts ./prompts
COPY service ./service
COPY main.py ./
# Note: the React build is no longer copied here — Nginx serves it (topology B,
# see deploy/nginx.Dockerfile). This image is the API only.

RUN uv sync --frozen

CMD ["uv", "run", "fastapi", "run", "main.py"]