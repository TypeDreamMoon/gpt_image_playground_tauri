// 把发布 tag 的版本号同步进各版本字段，避免出现「tag 是 v0.8.0、安装包却叫 0.7.12」。
//
// 用法：node scripts/sync-version.mjs v0.7.12
//
// 只改本仓库自己的版本字段；_source 是上游子模块，其版本号由上游维护，不要动。
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './env.mjs'

const CARGO_PACKAGE = 'gpt-image-playground'

const raw = process.argv[2]
if (!raw) {
  console.error('用法: node scripts/sync-version.mjs <tag，如 v0.7.12>')
  process.exit(1)
}

const version = raw.replace(/^v/, '')
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`无法从 "${raw}" 解析出版本号，期望形如 v0.7.12 或 v0.7.12-1。`)
  process.exit(1)
}

function read(file) {
  return readFileSync(join(ROOT, file), 'utf8')
}

function write(file, text) {
  writeFileSync(join(ROOT, file), text)
}

function report(file, before) {
  console.log(`${file}: ${before} -> ${version}`)
}

/** package.json 与 tauri.conf.json 都是纯 JSON，解析改写即可（保持 2 空格缩进） */
function syncJson(file, key) {
  const data = JSON.parse(read(file))
  const before = data[key]
  data[key] = version
  write(file, `${JSON.stringify(data, null, 2)}\n`)
  report(file, before)
}

/** package-lock.json 有两处版本，需与 package.json 保持一致，否则 npm ci 会报锁文件不同步 */
function syncPackageLock() {
  const file = 'package-lock.json'
  const data = JSON.parse(read(file))
  const before = data.version
  data.version = version
  if (data.packages?.['']) data.packages[''].version = version
  write(file, `${JSON.stringify(data, null, 2)}\n`)
  report(file, before)
}

/** Cargo.toml 只改 [package] 段顶格的 version，依赖的内联 version 不受影响 */
function syncCargoToml() {
  const file = 'src-tauri/Cargo.toml'
  const text = read(file)
  const match = text.match(/^version = "([^"]*)"/m)
  if (!match) throw new Error(`${file} 中未找到 [package] 的 version 字段`)
  write(file, text.replace(/^version = "[^"]*"/m, `version = "${version}"`))
  report(file, match[1])
}

/** Cargo.lock 里本包的版本，保持同步可避免构建时锁文件被动改写 */
function syncCargoLock() {
  const file = 'src-tauri/Cargo.lock'
  const text = read(file)
  // 逐行处理而不是用跨行正则：Windows 上 core.autocrlf 会把文件检出成 CRLF，
  // "name = ...\nversion = ..." 这种跨行匹配在 CRLF 下会失配。
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)

  const nameIndex = lines.findIndex((line) => line === `name = "${CARGO_PACKAGE}"`)
  const versionLine = nameIndex >= 0 ? lines[nameIndex + 1] : undefined
  const matched = versionLine?.match(/^version = "([^"]*)"$/)
  if (!matched) throw new Error(`${file} 中未找到 ${CARGO_PACKAGE} 的版本`)

  lines[nameIndex + 1] = `version = "${version}"`
  write(file, lines.join(eol))
  report(file, matched[1])
}

syncJson('package.json', 'version')
syncPackageLock()
syncJson('src-tauri/tauri.conf.json', 'version')
syncCargoToml()
syncCargoLock()

console.log(`版本号已同步为 ${version}`)
