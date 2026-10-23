FROM node:24-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY next.config.js tsconfig.json tailwind.config.ts postcss.config.mjs ./
COPY src ./src
COPY public ./public
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_PORTAL_MODE=api
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
WORKDIR /app
COPY backend/src ./backend/src
COPY src/lib/portal-model.ts ./src/lib/portal-model.ts
COPY --from=frontend /app/out ./out
ENV NODE_ENV=production PORT=3001 HOST=::
USER node
EXPOSE 3001
CMD ["node", "backend/src/server.js"]
