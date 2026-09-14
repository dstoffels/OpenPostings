# syntax=docker/dockerfile:1

# Backend image shared by two services (docker-compose.yml picks the entry
# point via `command:`): the Express API (server/index.js, this image's
# default CMD) and the MCP apply-agent server (server/mcp-apply-server.js).
# This repo has a single root package.json shared with the Expo/React Native
# app, so `npm ci` here also pulls in those (unused-at-runtime) deps — that's
# a repo-structure tradeoff, not something worth working around in the image.

FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Toolchain to compile sqlite3's native binding from source. npm's prebuilt
# binaries for it are built against a newer glibc than Debian bookworm
# ships, causing a GLIBC_x.xx `dlopen` mismatch at runtime if used — so we
# force a from-source build here instead of trusting the prebuilt one.
RUN apt-get update && apt-get install -y --no-install-recommends \
		python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY patches ./patches
ENV npm_config_build_from_source=true
RUN npm ci

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server

EXPOSE 8787
CMD ["node", "server/index.js"]
