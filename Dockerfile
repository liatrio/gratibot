FROM node:15.12.0-alpine3.10
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
ENTRYPOINT ["npm", "start"]
