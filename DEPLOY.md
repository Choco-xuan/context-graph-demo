# Linux 服务器 Docker 部署说明

使用 Docker / Docker Compose 在 Linux 上部署前后端与 Neo4j。

## 前置要求

- Linux 服务器（已安装 Docker 与 Docker Compose v2）
- 本仓库代码（git clone 或上传到服务器）

## 1. 环境变量

在项目根目录创建 `.env`（可复制 `.env.example` 后修改）：

```bash
cp .env.example .env
# 编辑 .env，至少配置：
# - NEO4J_* 若用 compose 内的 Neo4j，可不改（compose 会覆盖为 bolt://neo4j:7687）
# - ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL（Claude 代理）
# - OPENAI_API_KEY / OPENAI_API_BASE（嵌入模型，如硅基流动）
# - MYSQL_*（若使用 Flow 存储）
```

**生产环境务必设置：**

- `NEXT_PUBLIC_API_URL`：浏览器访问后端用的完整 URL，例如 `http://你的服务器IP:7000` 或 `https://api.你的域名.com`
- `CORS_ORIGINS`：允许的前端来源，例如 `http://你的服务器IP:3001,https://你的域名.com`（与前端访问地址一致）

可在 `.env` 中写：

```env
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:7000
CORS_ORIGINS=http://YOUR_SERVER_IP:3001,http://localhost:3001
```

或在启动前导出后再 up：

```bash
export NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:7000
export CORS_ORIGINS=http://YOUR_SERVER_IP:3001
docker compose up -d
```

## 2. 构建并启动

在项目根目录执行：

```bash
docker compose up -d --build
```

首次会构建 backend、frontend 镜像并启动三个服务：neo4j、backend、frontend。

## 3. 端口与访问

| 服务   | 容器端口 | 主机端口 | 说明           |
|--------|----------|----------|----------------|
| 前端   | 3000     | 3001     | 浏览器访问     |
| 后端   | 7000     | 7000     | REST API       |
| Neo4j  | 7474/7687| 7474/7687| 控制台 / Bolt  |

- 前端: `http://<服务器IP>:3001`
- 后端 API: `http://<服务器IP>:7000`
- Neo4j 浏览器: `http://<服务器IP>:7474`（用户名 neo4j，密码与 `.env` / compose 中一致）

## 4. 常用命令

```bash
# 查看状态与日志
docker compose ps
docker compose logs -f

# 仅查看后端/前端日志
docker compose logs -f backend
docker compose logs -f frontend

# 停止
docker compose down

# 重新构建并启动（代码或 Dockerfile 变更后）
docker compose up -d --build
```

## 5. 仅启动 Neo4j（本地开发）

若只在服务器跑 Neo4j，本机跑前后端：

```bash
docker compose up -d neo4j
```

本机 `.env` 中 `NEO4J_URI` 改为服务器 IP，例如 `bolt://YOUR_SERVER_IP:7687`。

## 6. 生产注意

- 将 `.env` 中的密钥、密码改为强密码，不要提交到仓库。
- Neo4j 生产建议单独部署并配置认证与备份。
- 若用 Nginx 做反向代理，在 Nginx 中配置 `CORS_ORIGINS` 与 `NEXT_PUBLIC_API_URL` 对应的域名。
- 需要 HTTPS 时，在 Nginx 或前置负载均衡上配置 SSL，并相应修改上述 URL 与 CORS。
