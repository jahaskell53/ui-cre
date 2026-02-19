FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
COPY zillow_pipeline/ zillow_pipeline/

RUN pip install uv && uv pip install --system .
