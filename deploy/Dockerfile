FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
ARG SITE_URL=http://localhost:8080
ENV NEXT_PUBLIC_SITE_URL=$SITE_URL NEXT_PUBLIC_APP_ENABLED=true
RUN pnpm --filter @olaph/api build && pnpm --filter @olaph/worker build && pnpm --filter @olaph/web build

FROM node:22-alpine AS api
ENV NODE_ENV=production HOST=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node","dist/main.js"]

FROM caddy:2-alpine AS web
COPY --from=build /app/apps/web/out /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
