# duewise-web: the React app, built with Node and served by nginx.
#
#   docker build -t duewise-web .
#
# Stage 1 builds the static files; stage 2 is a small nginx image that serves them and forwards
# /api to Duewise. Node and the source code are not in the final image.

FROM node:22-alpine AS build
WORKDIR /app
# Dependencies first: this layer is reused until package.json or the lock file changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# nginx running as a non-root user, listening on 8080.
FROM nginxinc/nginx-unprivileged:stable-alpine
LABEL org.opencontainers.image.title="duewise-web" \
      org.opencontainers.image.description="Web app for Duewise, the invoicing API" \
      org.opencontainers.image.source="https://github.com/developeras95/duewise-web" \
      org.opencontainers.image.licenses="LicenseRef-Proprietary"

ENV DUEWISE_API_URL=http://app:8080 \
    NGINX_RESOLVER=127.0.0.11
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
COPY LICENSE THIRD-PARTY.txt /usr/share/licenses/duewise-web/

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
