# Cinda Leave Ledger / 休假账本

一个面向香港员工的本地优先个人休假管理工具。网页端采用 Vue 3、TypeScript、Vue Router 和 Vite，桌面端采用 Tauri 2。

## 主要功能

- 首页按年度显示年假、特别假和生日假的额度、已用及余额。
- 独立的年度日历选项卡以 3 × 4 布局按上午、下午显示休假，并叠加香港公众假期。
- 公众假期优先读取香港政府 1823 JSON 数据，离线时使用项目内置的 2024 至 2027 年备份。
- 手动录入半天或全天记录。
- 增量导入 OA CSV，仅接收“流转结束”且审批通过的记录。
- 按文号和日期时段查重，冲突时由用户逐条决定保留哪一条。
- 明细表支持年度、类型和关键词筛选，并支持表头排序。
- 可调整当年年假、特别假额度、网站主题和各假期颜色。
- 可连接浏览器授权的数据文件夹，维护 `leave-records.json` 与 `leave-config.json`。
- Windows 桌面版以单个便携式 EXE 运行，自动读写本地 JSON 数据文件，无需安装。

## 数据文件

开发版本会先检查 `public/leave-records.json`，再检查 `public/leave-records.csv`。构建后，`leave-records.json`、`leave-records.csv`、`leave-config.json` 与 `index.html` 位于 `dist/` 同一目录。

标准网页受浏览器安全策略限制，不能在没有用户授权的情况下任意写入网页所在目录。设置页的“连接数据文件夹”使用 File System Access API，可在 Chrome 或 Edge 中授权 `index.html` 所在文件夹。未授权时，记录保存在浏览器 IndexedDB，也可手动导出 JSON 备份。

Tauri 桌面版会在系统应用数据目录自动创建并维护 `leave-records.json` 与 `leave-config.json`。Windows 默认目录为 `%APPDATA%\com.cindainternational.hr.leaveledger`。真实请假记录已从 Git 版本控制中排除。

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

构建结果位于 `dist/`。

## Tauri 桌面版

安装 Rust 工具链后，可启动桌面开发模式：

```bash
npm run desktop:dev
```

在 Windows 上生成单文件便携式 EXE：

```bash
npm ci
npm run desktop:build:windows
```

产物位于 `src-tauri/target/release/cinda-leave-ledger.exe`，无需安装。仓库中的 `.github/workflows/build-windows.yml` 也可通过 GitHub Actions 手动生成同一文件。

把新的 OA CSV 转换为初始 JSON 数据：

```bash
npm run seed -- /path/to/oa-export.csv public/leave-records.json
```

## 模块说明

- `src/views/`：五个选项卡页面。
- `src/components/`：导航、年历、冲突处理和首次使用引导。
- `src/services/`：CSV 解析、工作日核算、公众假期和存储适配。
- `src/composables/useLeaveStore.ts`：应用状态和数据写入入口。
- `src/constants/`：假期分类、主题和离线公众假期数据。
- `src-tauri/`：Tauri 配置、Rust 本地文件读写命令和桌面图标。
