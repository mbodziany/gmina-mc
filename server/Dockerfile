FROM node:22-slim AS build
WORKDIR /app
# Build tools for better-sqlite3's native module
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Persistent SQLite lives here; mount a volume at /app/data in production.
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/gmina.db
EXPOSE 8080
CMD ["node", "dist/index.js"]
