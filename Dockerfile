# Build stage for frontend
FROM node:21-alpine AS frontend-build
WORKDIR /app

# Set npm config for better network resilience
RUN npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-retries 4 \
    && npm config set registry https://registry.npmjs.org/

COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Add network retry options and use ci instead of install
RUN npm ci --workspace=frontend --prefer-offline --no-audit || \
    npm ci --workspace=frontend --prefer-offline --no-audit || \
    npm install -w frontend --no-audit

COPY frontend ./frontend
RUN npm run build -w frontend

# Build stage for backend
FROM node:21-alpine AS backend-build
WORKDIR /app

# Set npm config for better network resilience
RUN npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-retries 4 \
    && npm config set registry https://registry.npmjs.org/

COPY package*.json ./
COPY backend/package*.json ./backend/

# Add network retry options and use ci instead of install
RUN npm ci --workspace=backend --prefer-offline --no-audit || \
    npm ci --workspace=backend --prefer-offline --no-audit || \
    npm install -w backend --no-audit

COPY backend ./backend

# Production stage
FROM node:21-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy built backend
COPY --from=backend-build /app/package*.json ./
COPY --from=backend-build /app/backend ./backend

# Copy built frontend assets to backend's public directory
COPY --from=frontend-build /app/frontend/dist ./backend/public

# Install only production dependencies with retry strategy
RUN npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-retries 4 \
    && npm ci --omit=dev --ignore-scripts || \
    npm ci --omit=dev --ignore-scripts || \
    npm install --omit=dev --ignore-scripts

EXPOSE 5000
CMD ["node", "backend/src/index.js"]
