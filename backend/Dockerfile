FROM oven/bun:1.3.9

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile --production

COPY src ./src

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

USER bun

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
