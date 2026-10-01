FROM node:22-alpine AS runtime

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV POLL_INTERVAL_MS=3000

CMD ["node", "src/index.js"]
