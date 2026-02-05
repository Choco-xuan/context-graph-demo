# Context Graph 后端 API (FastAPI)
FROM python:3.11-slim

WORKDIR /app

# 复制依赖描述与应用代码后安装（hatch 需要 app 目录存在）
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir -e .

# 非 root 用户运行
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 7000

ENV HOST=0.0.0.0
ENV PORT=7000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7000"]
