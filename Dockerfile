# syntax=docker/dockerfile:1

# Сборка фронтенда. Сгенерированный SDK лежит в репозитории, поэтому генерация здесь не нужна.
FROM node:26.13.1-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Образ приложения: сервер исполняет TypeScript напрямую и раздаёт собранный фронтенд.
FROM node:26.13.1-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY api/generated/openapi.yaml ./api/generated/openapi.yaml
COPY --from=build /app/dist/web ./dist/web

# Порт задаёт платформа через PORT, 3000 используется по умолчанию.
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "server/main.ts"]
