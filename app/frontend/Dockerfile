# --- Build stage ---
FROM node:24-alpine AS builder
WORKDIR /app

# 依存関係を先にキャッシュ
COPY package*.json ./
RUN npm install

# ソースコードをコピーし、ビルド
COPY . .
RUN npm run build

# --- Production stage ---
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD [ "nginx", "-g", "daemon off;" ]