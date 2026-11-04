FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js agent-server.js config.json ./
COPY lib ./lib
COPY widgets ./widgets
COPY public ./public
RUN mkdir -p /app/data/icons /app/data/themes

FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/app/data
ENV CONFIG_FILE=/app/data/config.json

# SHA of the commit that produced the image, injected by the CI. The interface
# shows it next to the version number, so a glance tells which build really
# runs after a "docker pull". "unknown" for a local build: nothing is shown.
ARG DASHMON_COMMIT=unknown
ENV DASHMON_COMMIT=$DASHMON_COMMIT

# Release version, also injected by the CI from the v* tag. It feeds the footer
# of the interface, so it shows the published version rather than the package
# "version" field, frozen between two releases. Empty on a build from main.
ARG DASHMON_RELEASE=
ENV DASHMON_RELEASE=$DASHMON_RELEASE

ENV ICONS_DIR=/app/data/icons

COPY --from=build --chown=node:node /app/ ./
RUN mkdir -p /app/data/icons /app/data/themes && chown -R node:node /app/data

# Removes the bundled global npm: it carries vulnerable dependencies that the
# production runtime never uses.
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

EXPOSE 8080
USER node

# Asks the port the server really listens on (PORT), not a fixed 8080.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(Number(process.env.PORT)||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node","server.js"]