FROM node:22-alpine

WORKDIR /app

COPY . .

ENV HOST=0.0.0.0
ENV PORT=7000

EXPOSE 7000

CMD ["node", "stremio/server.js"]
