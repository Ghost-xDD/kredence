# ── Stage 1: build ────────────────────────────────────────────────────────
# Uses the official Playwright image so Chromium is available for Scout +
# Evidence agents that need headless browser scraping.
FROM mcr.microsoft.com/playwright/node:22-jammy AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy workspace config + all package manifests (for pnpm install)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json    ./packages/types/
COPY packages/storage/package.json  ./packages/storage/
COPY packages/agents/package.json   ./packages/agents/
COPY packages/server/package.json   ./packages/server/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/types    ./packages/types
COPY packages/storage  ./packages/storage
COPY packages/agents   ./packages/agents
COPY packages/server   ./packages/server

# Build all packages in dependency order
RUN pnpm --filter @credence/types    build
RUN pnpm --filter @credence/storage  build
RUN pnpm --filter @credence/agents   build
RUN pnpm --filter @credence/server   build

# Install Playwright browser binaries (Chromium only)
RUN npx playwright install chromium --with-deps


# ── Stage 2: runtime ──────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright/node:22-jammy AS runtime

WORKDIR /app

RUN npm install -g pnpm@9

# Copy the full built workspace from builder
COPY --from=builder /app .

# Playwright needs the browser binaries in the same location
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "packages/server/dist/index.js"]
