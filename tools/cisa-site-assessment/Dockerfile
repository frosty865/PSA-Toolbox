# Node + Python 3 — required for web-based PDF ingestion (corpus + module sources).
# The stock Vercel Node runtime does not include Python; use Docker on Vercel, or Fly/Railway/ECS,
# or run ingestion from a worker with Python. After build, set PROCESSOR_PYTHON=/usr/bin/python3 if needed.
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/local/bin/python

WORKDIR /app

COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt

COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
RUN pnpm run build:vercel

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["pnpm", "exec", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
