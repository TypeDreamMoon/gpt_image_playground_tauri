// Tauri CLI 包装器：先补齐 Rust 工具链环境，再转发给 @tauri-apps/cli。
// 用法：node scripts/tauri.mjs dev | build | icon ...（参数原样透传）
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { ROOT, withRustEnv } from './env.mjs'

const cli = join(ROOT, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
const args = process.argv.slice(2)

const child = spawn(process.execPath, [cli, ...args], {
  cwd: ROOT,
  env: withRustEnv(),
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
