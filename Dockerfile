FROM python:3.11-slim

WORKDIR /app

# Install agents package first — available as a relative path in this context
COPY agents/ ./agents/
RUN pip install ./agents

# Install backend dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
