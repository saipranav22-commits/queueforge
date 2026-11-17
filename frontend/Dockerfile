# Stage 1: Build production React bundle
FROM node:22-alpine AS builder

WORKDIR /app

# Cache package manifests
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and config files
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src

# Type check and build static production bundle
RUN npm run build

# Stage 2: Serve static bundle via Nginx
FROM nginx:1.27-alpine

# Remove default nginx configurations and static files
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy custom reverse-proxy and SPA fallback configuration
COPY nginx.conf /etc/nginx/conf.d/queueforge.conf

# Copy production static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 --start-period=5s \
    CMD wget -qO- http://127.0.0.1:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
