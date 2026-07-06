FROM node:18-alpine
WORKDIR /app

ENV DATABASE_URL=file:./dev.db
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY landvault.html ./

RUN npx prisma migrate deploy && node src/seed.js

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
