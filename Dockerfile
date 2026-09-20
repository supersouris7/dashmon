FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js config.json ./
COPY public ./public
RUN mkdir -p /app/data/icons /app/data/themes

ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/app/data
ENV CONFIG_FILE=/app/data/config.json
ENV ICONS_DIR=/app/data/icons

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm","start"]
