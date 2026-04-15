FROM node:24-alpine
WORKDIR /app

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --chown=node:node . .

EXPOSE 3000
USER node
ENTRYPOINT ["node", "app.js"]
