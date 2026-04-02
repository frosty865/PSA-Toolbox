# IT-hosted IDT: Next.js + Python reporter + DOCX template paths.
# Build (from this directory): docker build -t idt .
# Run: docker run -e PORT=3000 -p 3000:3000 -e IDT_APP_ROOT=/app idt
# Mount or bake ADA/report template.docx under /app/ADA/ for export.

FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV IDT_APP_ROOT=/app
ENV ADA_USE_PYTHON_REPORTER=1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
COPY tools ./tools
COPY assets ./assets
COPY ADA ./ADA

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --frozen-lockfile
RUN python3 -m venv /app/.venv \
  && /app/.venv/bin/pip install --no-cache-dir -r apps/reporter/requirements.txt
ENV PATH="/app/.venv/bin:$PATH"

RUN pnpm run build:web

WORKDIR /app/apps/web
EXPOSE 3000

CMD ["sh", "-c", "exec ./node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
