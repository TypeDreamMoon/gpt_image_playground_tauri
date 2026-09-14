// 用 Node 的 OpenSSL 下载文件（本机 schannel 不可用，PowerShell/git 默认走 schannel 会失败）
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import https from 'node:https'

const [url, out] = process.argv.slice(2)
if (!url || !out) {
  console.error('用法: node download.mjs <url> <输出路径>')
  process.exit(1)
}

function get(target, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error('重定向次数过多'))
    https
      .get(target, { headers: { 'user-agent': 'node-fetch-script' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          resolve(get(new URL(res.headers.location, target).href, redirects + 1))
          return
        }
        if (res.statusCode !== 200) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode} ${target}`))
          return
        }
        resolve(res)
      })
      .on('error', reject)
  })
}

await mkdir(dirname(out), { recursive: true })
const tmp = `${out}.part`
const res = await get(url)
await new Promise((resolve, reject) => {
  const ws = createWriteStream(tmp)
  res.pipe(ws)
  ws.on('finish', resolve)
  ws.on('error', reject)
  res.on('error', reject)
})
await rm(out, { force: true })
await rename(tmp, out)
const info = await stat(out)
console.log(`OK ${out} ${info.size} bytes`)
