FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (layer-cached — only rebuilds when requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only source files (not the entire venv directory)
COPY venv/server.py .
COPY venv/graph.py .
COPY venv/database.py .

EXPOSE 8000

# 4 workers = handles ~200-400 concurrent requests on a standard VM
# Increase workers as you scale horizontally
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
