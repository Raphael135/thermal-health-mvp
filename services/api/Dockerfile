FROM node:20-alpine

# Prisma precisa de OpenSSL para o schema engine funcionar corretamente no Alpine (musl).
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
