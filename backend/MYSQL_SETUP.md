# MySQL 存储配置说明

## 1. 安装依赖

Flow 数据现在使用 MySQL 存储，需要安装 `pymysql`：

```bash
cd backend
uv sync  # 如果使用 uv
# 或
pip install pymysql  # 如果使用 pip
```

## 2. 环境变量配置

在 `.env` 文件中添加以下 MySQL 配置（可选，已有默认值）：

```env
# MySQL 配置（Flow 数据存储）
MYSQL_HOST=10.156.196.228
MYSQL_PORT=3306
MYSQL_DATABASE=insight
MYSQL_USER=root
MYSQL_PASSWORD=root
```

## 3. 数据库表结构

应用启动时会自动创建 `flows` 表，包含以下字段：

- `id` (VARCHAR(36)): Flow ID（主键）
- `name` (VARCHAR(200)): 洞察名称
- `graph_source_id` (VARCHAR(100)): 图谱数据源 ID
- `system_prompt` (TEXT): 系统提示词
- `enabled_tools` (JSON): 启用的工具列表（JSON 格式）
- `model_id` (VARCHAR(100)): 模型 ID
- `published` (BOOLEAN): 是否已发布
- `slug` (VARCHAR(200)): URL 友好的 slug
- `created_at` (DATETIME): 创建时间
- `updated_at` (DATETIME): 更新时间

索引：
- `idx_published`: 用于快速查询已发布的 Flow
- `idx_slug`: 用于通过 slug 查询
- `idx_updated_at`: 用于排序

## 4. 数据迁移

如果之前有内存中的数据，需要手动迁移到 MySQL（当前版本会自动创建表，但不会迁移旧数据）。

## 5. 验证

启动应用后，检查日志中是否有表创建成功的消息。如果出现连接错误，请检查：
- MySQL 服务是否运行
- 网络连接是否正常（10.156.196.228:3306）
- 数据库 `insight` 是否存在
- 用户名密码是否正确
