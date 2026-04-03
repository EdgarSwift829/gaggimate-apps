FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8765

CMD ["python", "gaggimate_sim.py", "--host", "0.0.0.0", "--ws-port", "8765", "--webhook-url", "http://backend:8000/webhook"]
