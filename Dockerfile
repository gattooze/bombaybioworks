FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Firestore auth state is used in production (no filesystem session needed)
ENV USE_FIRESTORE_AUTH=true
ENV NODE_ENV=production

CMD ["node", "src/index.js"]
