FROM python:3.12-slim

# LibreOffice 설치 (HWP 파싱용)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    && rm -rf /var/lib/apt/lists/*

# Node.js 설치 (프론트 빌드용)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 백엔드 의존성
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 프론트엔드 빌드
COPY frontend/package*.json frontend/
RUN cd frontend && npm install
COPY frontend/ frontend/
RUN cd frontend && npm run build

# 백엔드 코드
COPY backend/ backend/
# 프론트 빌드 결과를 백엔드에서 서빙
RUN cp -r frontend/dist backend/static

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
