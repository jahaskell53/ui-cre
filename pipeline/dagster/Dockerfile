FROM ghcr.io/jahaskell53/ui-cre-libpostal-base:latest

WORKDIR /app

COPY pyproject.toml .
COPY zillow_pipeline/ zillow_pipeline/

RUN pip install uv && uv pip install --system .
