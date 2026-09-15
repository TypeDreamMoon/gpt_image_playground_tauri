# GPT Image Playground Desktop

[![CI](https://github.com/TypeDreamMoon/gpt_image_playground_tauri/actions/workflows/ci.yml/badge.svg)](https://github.com/TypeDreamMoon/gpt_image_playground_tauri/actions/workflows/ci.yml)
[![Release](https://github.com/TypeDreamMoon/gpt_image_playground_tauri/actions/workflows/release.yml/badge.svg)](https://github.com/TypeDreamMoon/gpt_image_playground_tauri/actions/workflows/release.yml)

用 [Tauri v2](https://github.com/tauri-apps/tauri) 给 [CookSleep/gpt_image_playground](https://github.com/CookSleep/gpt_image_playground) 套一层桌面外壳。

业务代码完全沿用上游的纯前端实现（`_source/`），本仓库只负责提供桌面运行时，并补齐 WebView 相比浏览器缺失的几项能力。因此上游的所有功能——多供应商 API 配置、图库、Agent 工作区、蒙版编辑、数据导入导出——都原样保留。

## 目录结构

```
.
├── src-tauri/              Tauri 壳：Rust 入口、窗口配置、权限、图标
│   ├── src/lib.rs          注册插件（http / dialog / fs / opener / window-state）
│   ├── tauri.conf.json     窗口、打包、构建钩子
│   ├── capabilities/       前端可调用的命令权限
│   └── icons/              由 icons/source.svg 生成
├── _source/                上游前端（git submodule，指向 CookSleep/gpt_image_playground）
├── patches/
│   └── desktop.patch       本仓库对上游的全部改动
├── scripts/                构建、补丁与工具链脚本
└── package.json            桌面端依赖与命令入口
```

## 环境要求

| 依赖 | 说明 |
| --- | --- |
| Node.js ≥ 18 | 构建前端与调用 Tauri CLI |
| Rust（MSVC 工具链） | 编译外壳；可用 `node scripts/setup-rust.mjs` 装到工作区 |
| Visual Studio Build Tools | 需包含「使用 C++ 的桌面开发」与 Windows SDK |
| WebView2 Runtime | Windows 10/11 通常已预装 |

国内网络环境下，`npm install`、`cargo build`、`rustup` 都需要能访问外网。可先设置代理：

```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
$env:HTTP_PROXY  = "http://127.0.0.1:7890"
```

## 快速开始

```powershell
# 1. 克隆（含上游子模块）
git clone --recursive https://github.com/TypeDreamMoon/gpt_image_playground_tauri.git
cd gpt_image_playground_tauri

# 2. 安装桌面端依赖（Tauri CLI 与插件）
npm install

# 3. 应用桌面端补丁并安装上游前端依赖
npm run setup
npm run web:install

# 4. 开发模式：启动 Vite 开发服务器并打开桌面窗口
npm run dev

# 5. 生产构建（同时生成 NSIS 安装包）
npm run build

# 只编译出可执行文件、不生成安装包（更快）
npm run tauri -- build --no-bundle
```

构建产物：

- 可执行文件：`src-tauri/target/release/gpt-image-playground.exe`
- 安装包（NSIS）：`src-tauri/target/release/bundle/nsis/`

## 桌面端做了哪些适配

全部改动集中在 4 个文件，且都以 `isDesktopApp()` 判断为前提，非 Tauri 环境（上游的网页部署）行为完全不变。

| 文件 | 改动 |
| --- | --- |
| `_source/src/lib/desktop.ts` | **新增**。适配层：请求桥接、原生保存、外链跳转 |
| `_source/src/main.tsx` | 安装适配层；桌面端跳过 Service Worker 注册 |
| `_source/src/lib/downloadImages.ts` | 下载图片/压缩包改走原生保存 |
| `_source/src/store.ts` | 导出备份改走原生保存 |

具体解决了四个问题：

1. **跨域限制** — 上游作为纯前端直接请求各家 API，服务商不返回 CORS 头时浏览器会拦截。桌面端把 `window.fetch` 换成 `tauri-plugin-http`，请求由 Rust 侧发出，不再受同源策略约束。图片链接下载、SSE 流式响应同样走这条通道。只接管指向外部服务商的绝对 `http(s)` 请求，`data:`、`blob:`、相对路径仍交给 WebView。
2. **文件保存** — WebView 里 `<a download>` 行为不可靠。桌面端改为原生对话框：单文件「另存为」，多文件只弹一次目录选择并在重名时自动追加 `-2`、`-3`，避免覆盖已有文件。
3. **外部链接** — 直接点击会把整个应用导航走且无法返回。桌面端拦截外链改用系统默认浏览器打开。
4. **Service Worker** — 桌面端资源随应用打包，SW 只会在升级后继续返回旧缓存，因此桌面端不注册 SW。

Tauri 侧的配置要点（这几处都踩过坑，改动前请先读）：

- **`dragDropEnabled: false`** —— 上游依赖 HTML5 拖拽上传图片，开启 Tauri 的文件拖放会屏蔽 WebView 自身的 `dataTransfer.files`，必须关闭。
- **`http` 的 URL 范围必须写成 `http://*:*`** —— Tauri 的 scope 用的是 URLPattern 语义而非通配符：`http://*` 只匹配**默认端口**的地址，任何显式带端口的地址（自建中转、`http://localhost:11434` 等）都会被静默拒绝。已通过 `urlpattern` crate 实测确认：
  | 模式 | `http://127.0.0.1:8799/x` | `https://api.openai.com/v1/...` |
  | --- | --- | --- |
  | `http://*` | ✗ | — |
  | `http://*:*` | ✓ | — |
  | `https://*` | — | ✓（默认端口） |
  | `*://*:*` | ✓ | ✓ |
- **请求桥接必须放行 Tauri 自身的内网地址** —— Tauri v2 的 IPC 内部就是用 `fetch` 发请求的，Windows 下地址形如 `http://ipc.localhost/<command>`。若把 `ipc.localhost` / `asset.localhost` / `tauri.localhost` 也桥接到 http 插件，插件自身的 `invoke` 会再次触发 IPC fetch，形成递归并让整个 IPC 失效（控制台报 `IPC custom protocol failed, Tauri will now use the postMessage interface instead`），表现为所有原生能力静默失灵。见 `desktop.ts` 的 `TAURI_INTERNAL_HOSTS`。
- `fs` 只授予写文件/判存在命令，实际可写范围由原生对话框动态授权，不额外开放目录。

## 与上游同步

`_source/` 是上游仓库的 **git submodule**，固定在某一个 commit 上。本仓库对上游的全部改动收敛为一个补丁 `patches/desktop.patch`（新增 `desktop.ts`，并修改 `main.tsx`、`downloadImages.ts`、`store.ts`）。

当前基于上游 commit：`da4fda85b59ecacc51d6a1e2ef680e3abb9e29b8`（2026-09-09）。

**首次克隆后**（`npm run build` / `npm run dev` 也会自动完成这两步）：

```powershell
git submodule update --init --recursive   # 拉取上游代码
npm run setup                             # 应用桌面端补丁（幂等）
```

补丁应用后，`_source` 会一直处于「有未提交改动」状态，这是预期现象，根仓库 `git status` 中显示为 `modified: _source (modified content)`。

**升级上游：**

```powershell
git -C _source fetch origin
git -C _source checkout <新的 commit>
git add _source && git commit -m "chore: bump upstream"
npm run setup        # 补丁冲突时会明确报错，按提示手工合并
```

**修改了 `_source` 里的桌面端适配代码后**，需要把改动重新收敛回补丁：

```powershell
npm run patch:update
```

> 不要用 `git -C _source diff > patches/desktop.patch`：PowerShell 的重定向会写成 UTF-16，补丁会失效。`patch:update` 已处理这一点。

## 环境说明

本仓库可以在不改动全局环境的前提下构建：

- **Rust 工具链**：若系统已安装 Rust 则直接使用；否则回退到 `.toolchain/` 下的工作区私有工具链。执行 `node scripts/setup-rust.mjs` 可安装/修复，`npm run build`、`npm run dev` 会自动识别。
- `.toolchain/`、`.npm-cache/`、`.tmp/` 均为本地缓存目录，已加入 `.gitignore`。

## 发布新版本

打 tag 即自动构建并发布 Release：

```powershell
git tag v0.7.12
git push origin v0.7.12
```

`.github/workflows/release.yml` 会依次完成：

1. 从 tag 解析版本号，写入 `package.json`、`package-lock.json`、`tauri.conf.json`、`Cargo.toml`、`Cargo.lock`，确保 tag 与安装包版本不会各说各话；
2. 拉取子模块、应用桌面端补丁、安装依赖；
3. 用 `tauri-action` 构建并创建 Release；
4. 额外附上免安装版 `*_portable.exe`。

产物有两份：`*_x64-setup.exe`（安装版）与 `*_x64_portable.exe`（免安装）。

版本号建议跟随上游（上游 `0.7.12` 就发 `v0.7.12`），这样应用内显示的版本、安装包版本、tag 三者一致。需要在不更新上游的情况下单独发包装层修复时，可用 `v0.7.12-1` 这类 tag。

`main` 上的提交与 PR 会触发 `.github/workflows/ci.yml`：应用补丁 → 跑上游单元测试 → 构建前端 → `cargo check`。上游子模块更新导致补丁失效时，这一步会直接失败。

> 目前只构建 Windows x64。要扩展到 macOS / Linux，在 `release.yml` 的 `release` 任务上加 `strategy.matrix` 即可；Linux 需额外安装 `libwebkit2gtk-4.1-dev` 等系统依赖。

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run setup` | 初始化子模块并应用桌面端补丁（幂等） |
| `npm run patch:update` | 把 `_source` 里的改动重新生成为补丁 |
| `npm run dev` | 开发模式（Vite + 桌面窗口） |
| `npm run build` | 生产构建并打包 NSIS 安装程序 |
| `npm run build:debug` | 调试构建，保留 devtools |
| `npm run web:build` | 只构建前端（输出到 `_source/dist`） |
| `npm run web:test` | 运行上游单元测试 |
| `npm run version:sync -- v0.7.12` | 手动同步版本号到各版本字段 |
| `npm run tauri -- <args>` | 透传任意 Tauri CLI 参数 |
| `npm run icon` | 由 `src-tauri/icons/source.svg` 重新生成全套图标 |
| `npm run web:install` | 安装上游前端依赖 |

## 许可

上游项目为 MIT 许可，详见 `_source/LICENSE`。
