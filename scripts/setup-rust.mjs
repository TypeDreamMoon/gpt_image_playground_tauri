// 把 Rust 工具链安装到工作区 .toolchain 目录。
//
// 适合两种场景：
// 1. 不想改动全局环境（不写 ~/.cargo、不修改 PATH）；
// 2. rustup 直连 static.rust-lang.org 失败，需要走代理。
//
// 用法：
//   node scripts/setup-rust.mjs
//   HTTPS_PROXY=http://127.0.0.1:7890 node scripts/setup-rust.mjs
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { LOCAL_CARGO_HOME, LOCAL_RUSTUP_HOME, ROOT } from './env.mjs'

const RUSTUP_URL = 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe'
const installer = join(ROOT, '.toolchain', 'rustup-init.exe')

mkdirSync(join(ROOT, '.toolchain', 'tmp'), { recursive: true })

console.log('正在下载 rustup-init…')
const download = spawnSync(process.execPath, [join(ROOT, 'scripts', 'download.mjs'), RUSTUP_URL, installer], {
  stdio: 'inherit',
})
if (download.status !== 0) process.exit(download.status ?? 1)

console.log('正在安装 Rust（工作区私有工具链）…')
const install = spawnSync(
  installer,
  ['-y', '--default-toolchain', 'stable-x86_64-pc-windows-msvc', '--profile', 'minimal', '--no-modify-path'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CARGO_HOME: LOCAL_CARGO_HOME,
      RUSTUP_HOME: LOCAL_RUSTUP_HOME,
      TEMP: join(ROOT, '.toolchain', 'tmp'),
      TMP: join(ROOT, '.toolchain', 'tmp'),
    },
  },
)
if (install.status !== 0) process.exit(install.status ?? 1)

const verify = spawnSync(join(LOCAL_CARGO_HOME, 'bin', 'cargo.exe'), ['--version'], { stdio: 'inherit' })
console.log(verify.status === 0 ? '\nRust 安装完成，现在可以运行 npm run build。' : '\nRust 安装后校验失败。')
process.exit(verify.status ?? 1)
