# Context Graph 前端 (Next.js) - 多阶段构建
FROM node:20-alpine AS builder

WORKDIR /app

# 构建时传入的 API 地址（浏览器访问后端用的 URL，部署时按需覆盖）
ARG NEXT_PUBLIC_API_URL=http://localhost:7000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# 运行阶段
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
