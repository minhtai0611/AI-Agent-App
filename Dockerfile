FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ backend/
COPY exam-app/src/data/ exam-app/src/data/

ENV PYTHONPATH=/app/backend

# HF Spaces requires a non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser /app
USER appuser

EXPOSE 7860

CMD uvicorn app.main:app --host 0.0.0.0 --port 7860
