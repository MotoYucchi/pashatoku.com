# --- Build stage ---
FROM node:24-alpine AS builder
WORKDIR /app

# 依存関係を先にキャッシュ
ARG VITE_ADMIN_PASSWORD
ENV VITE_ADMIN_PASSWORD=$VITE_ADMIN_PASSWORD
COPY package*.json ./
RUN npm install

# ソースコードをコピーし、ビルド
COPY . .
RUN npm run build

# --- Production stage ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD [ "nginx", "-g", "daemon off;" ]