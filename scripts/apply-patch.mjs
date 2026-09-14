// 把桌面端适配补丁应用到上游前端目录（_source）。
//
// _source 是 git submodule，指向上游仓库的固定 commit。本仓库对上游的改动
// 全部收敛在 patches/desktop.patch 里，由本脚本幂等地打上去。
//
// 幂等：已应用则跳过；上游更新导致冲突时报错退出，不会留下半应用的中间状态。
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, WEB_DIR } from './env.mjs'

const PATCH = join(ROOT, 'patches', 'desktop.patch')

// 检查类命令用 ignore，既避免管道问题，也不会污染构建输出
function git(args, cwd, mode) {
  return spawnSync('git', args, { cwd, stdio: mode })
}

function isSubmoduleReady() {
  return existsSync(join(WEB_DIR, 'package.json'))
}

function isPatchApplied() {
  return git(['apply', '--reverse', '--check', PATCH], WEB_DIR, 'ignore').status === 0
}

export function ensureWebReady() {
  if (!isSubmoduleReady()) {
    console.log('正在初始化上游子模块 _source …')
    const init = git(['submodule', 'update', '--init', '--recursive'], ROOT, 'inherit')
    if (init.status !== 0) {
      throw new Error('子模块初始化失败。请确认已安装 git，且能访问 github.com。')
    }
  }

  if (isPatchApplied()) return

  const check = git(['apply', '--check', PATCH], WEB_DIR, 'ignore')
  if (check.status !== 0) {
    throw new Error(
      '桌面端补丁无法应用到 _source。通常是上游代码已变动，需要手工合并：\n' +
        `  1. git -C _source apply --reject "${PATCH}"\n` +
        '  2. 解决 .rej 冲突后，重新生成补丁：\n' +
        '     git -C _source diff > patches/desktop.patch',
    )
  }

  console.log('正在应用桌面端适配补丁 …')
  // --whitespace=nowarn：补丁正文是 LF，而 Windows 上 core.autocrlf 会把检出内容
  // 转成 CRLF，git 会把这种转换当成空白错误刷屏。已确认落盘结果与行尾约定一致。
  const apply = git(['apply', '--whitespace=nowarn', PATCH], WEB_DIR, 'inherit')
  if (apply.status !== 0) throw new Error('应用桌面端补丁失败。')
}

// 直接运行时只做准备工作
if (process.argv[1] && process.argv[1].endsWith('apply-patch.mjs')) {
  try {
    ensureWebReady()
    console.log('上游代码已就绪。')
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
