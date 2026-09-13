FROM node:20-alpine

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy server source code
COPY . .

# Ensure data and uploads directories exist
RUN mkdir -p /app/data /app/uploads

# Environment settings
ENV PORT=3001 \
    HOST=0.0.0.0 \
    NODE_ENV=production

EXPOSE 3001

# Health check using the backend health endpoint
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "server.js"]
