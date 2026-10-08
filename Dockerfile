# Sayohatchi AI: FastAPI backend + web sayt bitta konteynerda
FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server/ server/
COPY web/ web/
ENV DB_PATH=/data/sayohatchi.db
VOLUME /data
EXPOSE 8000
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
