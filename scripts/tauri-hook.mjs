// Tauri 的 beforeDevCommand / beforeBuildCommand 钩子。
// 用脚本转发而不是直接写 npm 命令，是为了不依赖 Tauri 调用钩子时的工作目录。
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ensureWebReady } from './apply-patch.mjs'
import { NPM, WEB_DIR } from './env.mjs'

const IS_WINDOWS = process.platform === 'win32'

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

// 全新克隆后直接跑 npm run dev / build 时，上游依赖可能还没装
if (action !== 'install' && !existsSync(join(WEB_DIR, 'node_modules'))) {
  console.log('上游前端依赖未安装，正在自动执行 npm install …')
  const install = spawnSync(NPM, ['install'], { cwd: WEB_DIR, stdio: 'inherit', shell: IS_WINDOWS })
  if (install.status !== 0) {
    console.error('上游依赖安装失败，可手动执行：npm run web:install')
    process.exit(install.status ?? 1)
  }
}

// stdio 继承：既能实时看到构建输出，也避免在受限沙箱里因管道而失败
const child = spawn(NPM, args, { cwd: WEB_DIR, stdio: 'inherit', shell: IS_WINDOWS })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
