FROM node:18-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY index.html ./
COPY install ./
EXPOSE 3000
CMD ["node", "server.js"]
