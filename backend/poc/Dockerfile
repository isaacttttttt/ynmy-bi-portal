FROM node:24-bookworm-slim
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
WORKDIR /app
COPY backend/src ./backend/src
COPY backend/sql ./backend/sql
COPY backend/poc ./backend/poc
COPY src/lib/portal-model.ts src/lib/portal-fixtures.ts ./src/lib/
ENV NODE_ENV=production PORT=3002
USER node
EXPOSE 3002
CMD ["node", "backend/poc/platform.js"]
