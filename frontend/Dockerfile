FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

RUN npm install --prefer-offline --no-audit --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]