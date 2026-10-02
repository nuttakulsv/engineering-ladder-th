// node scripts/build.mjs          validate data, regenerate ladder/*.md, build the site into _site/
// node scripts/build.mjs --check  validate data, fail if ladder/*.md is stale or a relative link is broken
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = createRequire(import.meta.url)('../site/core.js')
const data = JSON.parse(readFileSync(join(root, 'data/ladder.json'), 'utf8'))
const check = process.argv.includes('--check')

const errors = core.validate(data)
if (errors.length) {
  console.error(`data/ladder.json has ${errors.length} problem(s):\n  ${errors.join('\n  ')}`)
  process.exit(1)
}

function ladderMarkdown(data, track) {
  const other = data.tracks.find((t) => t.id !== track.id)
  const lines = [
    `# ${track.name}`,
    '',
    `<!-- ไฟล์นี้สร้างจาก data/ladder.json ด้วย npm run build อย่าแก้ตรงนี้ ให้แก้ที่ไฟล์ข้อมูล -->`,
    '',
    'อ่าน [วิธีใช้ ladder](../guides/using-the-ladder.md) ก่อนเริ่ม ระดับวัดจากสิ่งที่ทำได้สม่ำเสมอ ไม่ใช่สิ่งที่เคยทำครั้งเดียว',
  ]
  if (other) lines.push('', `ดู[${other.name}](${other.id}.md) และ[ความต่างของระดับกับชื่อตำแหน่ง](../guides/levels-and-titles.md)`)
  lines.push('', '| ระดับ | ชื่อ | ขอบเขต | สรุป |', '|---|---|---|---|')
  for (const l of track.levels) lines.push(`| ${l.id} | ${l.title} | ${l.scope} | ${l.summary} |`)
  for (const l of track.levels) {
    lines.push('', `## ${l.id} ${l.title}`, '', l.summary, '', `ขอบเขต: ${l.scope}`)
    if (l.comparable) lines.push('', `ขอบเขตงานเทียบได้กับ: ${l.comparable}`)
    for (const dim of data.dimensions) {
      const cell = l.cells[dim.id]
      lines.push('', `### ${l.id} · ${dim.name}`, '', '**สิ่งที่เห็นได้ในงานจริง**', '')
      for (const b of cell.behaviors) lines.push(`- ${b}`)
      lines.push('', '**ยังไม่ถึงระดับนี้ ถ้า**', '')
      for (const b of cell.notYet) lines.push(`- ${b}`)
      lines.push('', '**หลักฐานที่ใช้ตอนประเมิน**', '')
      for (const b of cell.evidence) lines.push(`- ${b}`)
      lines.push('', '**ถ้าอยากไปถึง**', '')
      for (const b of cell.growth) lines.push(`- ${b}`)
    }
  }
  return lines.join('\n') + '\n'
}

const outputs = Object.fromEntries(
  data.tracks.map((t) => [join(root, 'ladder', `${t.id}.md`), ladderMarkdown(data, t)]),
)

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.') || name === 'node_modules' || name === '_site') return []
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return markdownFiles(path)
    return name.endsWith('.md') ? [path] : []
  })
}

function brokenLinks() {
  const broken = []
  for (const file of markdownFiles(root)) {
    const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue
      const path = decodeURI(target.split('#')[0])
      if (!existsSync(resolve(dirname(file), path))) broken.push(`${relative(root, file)} -> ${target}`)
    }
  }
  return broken
}

if (check) {
  const stale = Object.entries(outputs).filter(([path, text]) => !existsSync(path) || readFileSync(path, 'utf8') !== text)
  const broken = brokenLinks()
  for (const [path] of stale) console.error(`${relative(root, path)} is out of date, run npm run build`)
  for (const link of broken) console.error(`broken link: ${link}`)
  if (stale.length || broken.length) process.exit(1)
  const counts = data.tracks.map((t) => `${t.id}: ${t.levels.length} levels, ${core.behaviors(data, t.id).length} behaviors`)
  console.log(`ok (${counts.join('; ')})`)
} else {
  mkdirSync(join(root, 'ladder'), { recursive: true })
  for (const [path, text] of Object.entries(outputs)) writeFileSync(path, text)
  const out = join(root, '_site')
  rmSync(out, { recursive: true, force: true })
  cpSync(join(root, 'site'), out, { recursive: true })
  writeFileSync(join(out, 'data.js'), `window.LADDER = ${JSON.stringify(data)}\n`)
  console.log(`built ${Object.keys(outputs).map((p) => relative(root, p)).join(', ')} and _site/`)
}
