FROM node:18.12-alpine3.15
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
ENTRYPOINT ["npm", "start"]
