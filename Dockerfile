# Stage 1: Build the TypeScript code
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Create the production image
FROM node:20-slim
WORKDIR /app
COPY --from=builder --chown=node:node /app/package*.json ./
RUN npm install --omit=dev
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

CMD ["node", "dist/index.js"]
