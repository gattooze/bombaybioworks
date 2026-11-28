# Build from hivemind/:  docker build -f mcp/Dockerfile -t hivemind-mcp .
# The MCP server imports ../ontology, so both go into the image and share /app/node_modules.
FROM node:20-slim
WORKDIR /app
COPY mcp/package.json mcp/package-lock.json ./
RUN npm ci --omit=dev
COPY ontology ./ontology
COPY mcp/src ./mcp/src
ENV NODE_ENV=production
USER node
CMD ["node", "mcp/src/http.js"]
