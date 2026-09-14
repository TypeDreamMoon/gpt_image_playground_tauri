// 共享路径与工具链环境：所有脚本都用它定位工作区、前端目录和 Rust 工具链
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
/** 上游纯前端项目（git clone 的原始仓库，保持可同步） */
export const WEB_DIR = join(ROOT, '_source')
export const TAURI_DIR = join(ROOT, 'src-tauri')
/** 本工作区自带的 Rust 工具链（未安装系统 Rust 时使用） */
export const LOCAL_CARGO_HOME = join(ROOT, '.toolchain', 'cargo')
export const LOCAL_RUSTUP_HOME = join(ROOT, '.toolchain', 'rustup')

function hasLocalToolchain() {
  return existsSync(join(LOCAL_CARGO_HOME, 'bin', process.platform === 'win32' ? 'cargo.exe' : 'cargo'))
}

function hasSystemToolchain() {
  const exe = process.platform === 'win32' ? 'cargo.exe' : 'cargo'
  const candidates = [
    ...(process.env.PATH ?? '').split(delimiter).filter(Boolean).map((dir) => join(dir, exe)),
    join(homedir(), '.cargo', 'bin', exe),
  ]
  return candidates.some((path) => existsSync(path))
}

/**
 * 返回注入了 Rust 工具链的环境变量。
 * 优先使用系统已安装的 Rust；否则回退到 .toolchain 里的工作区私有工具链，
 * 这样无需改动用户全局环境也能构建。
 */
export function withRustEnv(env = { ...process.env }) {
  if (hasSystemToolchain()) return env

  if (!hasLocalToolchain()) {
    throw new Error(
      '未找到 Rust 工具链。请安装 Rust（https://rustup.rs），或运行 node scripts/setup-rust.mjs 安装到工作区 .toolchain 目录。',
    )
  }

  const binDir = join(LOCAL_CARGO_HOME, 'bin')
  env.CARGO_HOME = env.CARGO_HOME || LOCAL_CARGO_HOME
  env.RUSTUP_HOME = env.RUSTUP_HOME || LOCAL_RUSTUP_HOME
  // Windows 上环境变量名可能是 Path 而不是 PATH，必须按大小写不敏感查找，
  // 否则会把真正的 PATH 覆盖掉，导致子进程找不到 node。
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH'
  env[pathKey] = `${binDir}${delimiter}${env[pathKey] ?? ''}`
  return env
}

/** npm 在 Windows 上是 npm.cmd，用 shell 调用最省事 */
export const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'
export { hasSystemToolchain, hasLocalToolchain }
