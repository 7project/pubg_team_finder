FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    redis \
    aiokafka \
    asyncio

COPY src/ /app/src/

CMD ["python", "-m", "src.main"]