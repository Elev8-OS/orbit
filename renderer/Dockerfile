# Render-Dienst für Erklärvideos: Node 20 + ffmpeg
FROM node:20-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
COPY assets ./assets
ENV NODE_ENV=production
CMD ["node", "src/index.mjs"]
