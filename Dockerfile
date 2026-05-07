FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Fix root→appuser cache path mismatch; must be set before bake AND kept for CMD
ENV HF_HOME=/app/.cache/huggingface

# Bake BGE-M3 into the image; avoids cold-start download (~570 MB)
RUN python -c "from FlagEmbedding import BGEM3FlagModel; BGEM3FlagModel('BAAI/bge-m3', use_fp16=False)"

COPY backend/ backend/

ENV PYTHONPATH=/app/backend

# HF Spaces requires a non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser /app
USER appuser

EXPOSE 7860

CMD uvicorn app.main:app --host 0.0.0.0 --port 7860
