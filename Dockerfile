FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js docker.js config.json ./
COPY public ./public
RUN mkdir -p /app/data/icons /app/data/themes

FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/app/data
ENV CONFIG_FILE=/app/data/config.json
ENV ICONS_DIR=/app/data/icons

COPY --from=build --chown=node:node /app/ ./
RUN mkdir -p /app/data/icons /app/data/themes && chown -R node:node /app/data

# Supprime le npm global embarqué : il contient des dépendances vulnérables
# non utilisées au runtime en production.
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

EXPOSE 8080
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node","server.js"]