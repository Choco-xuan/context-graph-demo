# Linux 服务器 Docker 部署说明

使用 Docker Compose 在 Linux 上部署前后端。**Neo4j 使用已有实例**，在 `.env` 中配置连接信息即可。

## 前置要求

- Linux 服务器（已安装 Docker 与 Docker Compose v2）
- 本仓库代码（git clone 或上传到服务器）
- **已有可用的 Neo4j**（在 `.env` 中配置 `NEO4J_URI`、`NEO4J_USERNAME`、`NEO4J_PASSWORD`）

## 1. 环境变量

在项目根目录创建 `.env`（可复制 `.env.example` 后修改）：

```bash
cp .env.example .env
# 编辑 .env，必须配置：
# - NEO4J_URI、NEO4J_USERNAME、NEO4J_PASSWORD（连接已有 Neo4j，如 bolt://你的Neo4j地址:7687）
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

会构建并启动两个服务：**backend**、**frontend**。（后端构建默认使用清华 PyPI 镜像，超时 300 秒。）

## 3. 端口与访问

| 服务   | 容器端口 | 主机端口 | 说明       |
|--------|----------|----------|------------|
| 前端   | 3000     | 3001     | 浏览器访问 |
| 后端   | 7000     | 7000     | REST API   |

- 前端: `http://<服务器IP>:3001`
- 后端 API: `http://<服务器IP>:7000`

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

## 5. 已有 Neo4j 的配置说明

Compose 不再包含 Neo4j 服务。请确保 `.env` 中的 Neo4j 地址**从后端容器内可访问**：

- Neo4j 在同一台机：可用 `bolt://host.docker.internal:7687`（Linux 需 Docker 20.10+）或宿主机实际 IP（如 `bolt://172.17.0.1:7687`）
- Neo4j 在其他机器：直接写该机器 IP 或域名，如 `bolt://neo4j-server:7687`

## 6. 生产注意

- 将 `.env` 中的密钥、密码改为强密码，不要提交到仓库。
- 若用 Nginx 做反向代理，在 Nginx 中配置 `CORS_ORIGINS` 与 `NEXT_PUBLIC_API_URL` 对应的域名。
- 需要 HTTPS 时，在 Nginx 或前置负载均衡上配置 SSL，并相应修改上述 URL 与 CORS。
