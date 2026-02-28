# syntax=docker/dockerfile:1

########## 1) Build stage ##########
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (better caching)
COPY package.json ./
# If you have a lockfile, copy it too (recommended)
COPY package-lock.json* ./
COPY npm-shrinkwrap.json* ./

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source and build
COPY . .
RUN npm run build


########## 2) Runtime stage ##########
FROM caddy:2-alpine

# Caddy config (SPA-friendly)
COPY Caddyfile /etc/caddy/Caddyfile

# Static build output
COPY --from=builder /app/dist /usr/share/caddy

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]