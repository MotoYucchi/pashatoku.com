# --- Build Stage ---
FROM golang:1.26.0-alpine AS builder
WORKDIR /app
# 依存関係を先にキャッシュ
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# バイナリを静的リンクでビルド
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# --- Production Stage ---
FROM gcr.io/distroless/static-debian12
WORKDIR /
COPY --from=builder /app/main /main
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/main"]