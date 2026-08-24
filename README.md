# Cinda Leave Ledger / 休假账本

面向香港员工的个人休假管理工具，同时提供 Docker 多用户版和 Tauri 单机便携版。前端使用 Vue 3、TypeScript、Vue Router 和 Vite，Docker 版使用 Express 和 SQLite，桌面版使用 Tauri 2。

## 两种运行模式

### Docker 多用户版

- 员工使用工号注册，工号必须是 `800` 开头的六位数字，例如 `800809`。
- 每个用户自定义密码，密码长度为 8 至 128 个字符。
- 每个用户的请假记录、额度、主题和颜色设置独立保存在服务器 SQLite 数据库中。
- 管理员可查看已注册工号，并将用户密码重置为 `Abcd1234!`。
- 用户可在设置选项卡修改自己的密码。

### Tauri 单机版

- 无需注册和登录，打开 EXE 后直接使用。
- 数据保存在 EXE 同目录的 `Cinda Leave Ledger Data` 文件夹。
- 首次打开时，可在同一个弹窗中设置年假额度、特别假额度并导入 OA CSV。

## 主要功能

- 首页按年度显示年假、特别假和生日假的额度、已用及余额。
- 年度日历以 3 × 4 布局显示全年休假和香港公众假期。
- 手动录入半天或全天记录。
- 增量导入 OA CSV，只接收流转结束且审批通过的记录。
- 按文号和日期时段查重，冲突时由用户逐条决定保留哪条记录。
- 明细表支持年度、类型和关键词筛选，并支持表头排序。
- 可调整当年年假、特别假额度、网站主题和各假期颜色。

## Docker Compose 安装

服务器只需安装 Docker 和 Docker Compose，无需下载项目源码。新建 `docker-compose.yml`，内容可直接使用仓库中的 [docker-compose.yml](docker-compose.yml)。然后在该文件所在目录执行：

```bash
docker compose pull
docker compose up -d
```

Compose 会从以下公开镜像拉取多架构版本，支持常见的 x86_64 和 ARM64 Linux 服务器：

```text
ghcr.io/zhangqihenry/cinda-leave-ledger:latest
```

然后打开：

```text
http://<服务器地址>:3000
```

默认管理员账号：

```text
用户名：admin
密码：Admin1234
```

管理员首次登录后会看到修改密码提示，该提示不强制中断使用。管理员可在后台修改自己的密码。

可以在启动前通过环境变量覆盖默认配置：

```bash
ADMIN_USERNAME=admin \
ADMIN_PASSWORD=Admin1234 \
RESET_PASSWORD='Abcd1234!' \
APP_PORT=3000 \
docker compose up -d
```

`ADMIN_PASSWORD` 只在数据库首次初始化管理员账号时使用。数据库已存在时，修改该环境变量不会覆盖已保存的管理员密码。

### 更新 Docker 版本

在 `docker-compose.yml` 所在目录执行：

```bash
docker compose pull
docker compose up -d
```

Compose 默认使用 `latest` 标签，也可以将镜像标签固定为具体版本，例如 `ghcr.io/zhangqihenry/cinda-leave-ledger:0.3.0`。

### 数据与备份

SQLite 数据库保存在容器内的：

```text
/data/leave-ledger.sqlite
```

Compose 使用 `leave-ledger-data` 命名卷持久化 `/data`。升级或重建容器时不要删除该卷。备份前建议先停止容器，然后备份整个命名卷。

### HTTPS

在公网或公司网络正式使用时，建议通过 Nginx、Caddy 或现有网关提供 HTTPS，并设置：

```text
COOKIE_SECURE=true
TRUST_PROXY=true
```

## 本地开发

同时启动 Vite 和 Express：

```bash
npm install
npm run dev
```

浏览器打开 Vite 输出的地址。开发数据库保存在项目的 `data/` 目录。

运行测试：

```bash
npm test
```

生产构建：

```bash
npm run build
```

## Tauri 单机版

安装 Rust 工具链后，启动桌面开发模式：

```bash
npm run desktop:dev
```

在 Windows 上生成单文件便携式 EXE：

```bash
npm ci
npm run desktop:build:windows
```

产物位于 `src-tauri/target/release/cinda-leave-ledger.exe`。桌面版不启动 Express，也不显示注册和登录页面。

## 自动发布

- 推送到 `main` 分支后，GitHub Actions 会生成 Windows x64 EXE，产物可在对应的 Actions 运行记录中下载。
- 推送 `v*` 标签后，Windows EXE 会自动添加到 GitHub Releases。
- 推送到 `main` 分支后，Docker 镜像会发布为 `ghcr.io/zhangqihenry/cinda-leave-ledger:latest`。
- 推送 `v*` 标签后，Docker 镜像会同时发布版本标签，例如 `0.3.0` 和 `0.3`。
