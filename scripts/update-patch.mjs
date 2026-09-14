// 重新生成 patches/desktop.patch。
//
// 在 _source 里调整桌面端适配代码后执行本脚本，把改动重新收敛回补丁。
// 注意不能直接用 `git diff > file`：PowerShell 的重定向会写成 UTF-16，导致补丁失效，
// 因此这里统一走 git 的 --output。
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { ROOT, WEB_DIR } from './env.mjs'

const PATCH = join(ROOT, 'patches', 'desktop.patch')

function git(args) {
  const result = spawnSync('git', args, { cwd: WEB_DIR, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} 执行失败`)
}

// desktop.ts 是新增文件，需要先标记为 intent-to-add 才会出现在 git diff 里
git(['add', '-N', 'src/lib/desktop.ts'])
git(['diff', '--no-color', `--output=${PATCH}`])
git(['reset', '--quiet'])

console.log(`已重新生成 ${PATCH}`)
