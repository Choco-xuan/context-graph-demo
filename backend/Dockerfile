# Context Graph 后端 API (FastAPI)
FROM python:3.11-slim

WORKDIR /app

# 复制依赖描述与应用代码后安装（hatch 需要 app 目录存在）
COPY pyproject.toml ./
COPY app ./app
# 使用清华 PyPI 镜像并增加超时
RUN pip install --no-cache-dir --timeout 300 -e . \
    --index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    --trusted-host pypi.tuna.tsinghua.edu.cn

EXPOSE 7000

ENV HOST=0.0.0.0
ENV PORT=7000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7000"]
