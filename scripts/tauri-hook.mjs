// Tauri 的 beforeDevCommand / beforeBuildCommand 钩子。
// 用脚本转发而不是直接写 npm 命令，是为了不依赖 Tauri 调用钩子时的工作目录。
import { spawn } from 'node:child_process'
import { ensureWebReady } from './apply-patch.mjs'
import { NPM, WEB_DIR } from './env.mjs'

const action = process.argv[2]

const COMMANDS = {
  install: ['install'],
  dev: ['run', 'dev'],
  build: ['run', 'build'],
  test: ['test'],
}

const args = COMMANDS[action]
if (!args) {
  console.error(`用法: node scripts/tauri-hook.mjs <${Object.keys(COMMANDS).join('|')}>`)
  process.exit(1)
}

// 无论哪条路径，都先保证上游子模块已拉取、桌面端补丁已应用
try {
  ensureWebReady()
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

// stdio 继承：既能实时看到构建输出，也避免在受限沙箱里因管道而失败
const child = spawn(NPM, args, { cwd: WEB_DIR, stdio: 'inherit', shell: process.platform === 'win32' })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
