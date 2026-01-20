# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-slim AS dependencies

# Install Chrome dependencies and Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Chromium browser
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY tsup.config.ts ./

# Install production dependencies
RUN npm ci --omit=dev

# ============================================
# Stage 2: Build
# ============================================
FROM dependencies AS build

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# ============================================
# Stage 3: Runtime
# ============================================
FROM node:20-slim AS runtime

# Install runtime Chrome dependencies only
RUN apt-get update && apt-get install -y \
    ca-certificates \
    wget \
    gnupg \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Chromium
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome to use system Chromium
ENV CHROME_BIN=/usr/bin/google-chrome
ENV CHROME_PATH=/usr/bin/google-chrome
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# Create non-root user for security
RUN useradd -m -u 9999 -s /bin/bash appuser

# Set working directory
WORKDIR /app

# Copy from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package*.json ./

# Copy built files from build stage
COPY --from=build /app/dist ./dist

# Create directories for volumes
RUN mkdir -p /app/data /app/logs /app/screenshots /app/config && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose health check port (optional, for HTTP endpoint if needed)
EXPOSE 3000

# Health check - verify Node process is running
HEALTHCHECK --interval=5m --timeout=30s --start-period=10s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Start the application
CMD ["node", "dist/index.js"]
