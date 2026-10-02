import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const core = require('../site/core.js')
const data = JSON.parse(readFileSync(new URL('../data/ladder.json', import.meta.url), 'utf8'))
const clone = () => structuredClone(data)
const ids = (track, level, dim, n) => Array.from({ length: n }, (_, i) => `${track}.${level}.${dim}.${i + 1}`)
const allOf = (track, level) =>
  data.dimensions.flatMap((d) => ids(track, level, d.id, data.tracks.find((t) => t.id === track).levels.find((l) => l.id === level).cells[d.id].behaviors.length))

test('repo data passes validation', () => {
  assert.deepEqual(core.validate(data), [])
})

test('validation reports missing cells, empty lists, duplicates and bad references', () => {
  const d = clone()
  const l1 = d.tracks[0].levels[0]
  delete l1.cells.tech
  l1.cells.delivery.growth = []
  l1.cells.impact.behaviors = ['only one']
  l1.cells.typo = l1.cells.collab
  d.tracks[0].levels[1].id = 'L1'
  d.tracks[1].defaultTarget = 'M9'
  const errors = core.validate(d)
  for (const expected of [
    'ic/L1/tech: missing',
    'ic/L1/delivery: growth is empty',
    'ic/L1/impact: needs at least 2 behaviors',
    'ic/L1: unknown dimension "typo"',
    'track ic level: duplicate id "L1"',
    'track em: defaultTarget "M9" is not a level',
  ]) {
    assert.ok(errors.includes(expected), `expected "${expected}" in:\n${errors.join('\n')}`)
  }
})

test('nothing checked means every dimension is at zero', () => {
  for (const a of core.assess(data, 'ic', new Set())) {
    assert.equal(a.value, 0)
    assert.equal(a.reached, null)
    assert.equal(a.next, 'L1')
  }
})

test('two of three behaviors reach a level, one of three is partial progress', () => {
  const checked = new Set([...allOf('ic', 'L1'), ...ids('ic', 'L2', 'tech', 2), ...ids('ic', 'L3', 'tech', 1)])
  const tech = core.assess(data, 'ic', checked).find((a) => a.dim === 'tech')
  assert.equal(tech.reached, 'L2')
  assert.equal(tech.next, 'L3')
  assert.equal(tech.value, 2.33)
  const delivery = core.assess(data, 'ic', checked).find((a) => a.dim === 'delivery')
  assert.equal(delivery.reached, 'L1')
  assert.equal(delivery.value, 1)
})

test('levels are cumulative: skipping L1 does not count L2', () => {
  const checked = new Set(allOf('ic', 'L2'))
  for (const a of core.assess(data, 'ic', checked)) assert.equal(a.value, 0)
})

test('gaps point at the first level not reached, up to the target', () => {
  const none = core.gaps(data, 'ic', 'L3', new Set())
  assert.equal(none.length, data.dimensions.length)
  assert.ok(none.every((g) => g.level === 'L1' && g.levelsLeft === 3))

  const checked = new Set([...allOf('ic', 'L1'), ...allOf('ic', 'L2'), ...allOf('ic', 'L3')])
  checked.delete('ic.L3.people.1')
  checked.delete('ic.L3.people.2')
  const gaps = core.gaps(data, 'ic', 'L3', checked)
  assert.equal(gaps.length, 1)
  assert.equal(gaps[0].dim, 'people')
  assert.equal(gaps[0].level, 'L3')
  assert.equal(gaps[0].missing.length, 2)
  assert.ok(gaps[0].growth.length > 0 && gaps[0].notYet.length > 0)

  assert.deepEqual(core.gaps(data, 'ic', 'L2', checked), [])
})

test('state survives a round trip through the URL hash', () => {
  const list = core.behaviors(data, 'ic')
  const checked = new Set(list.filter((_, i) => i % 3 === 0 || i === list.length - 1).map((b) => b.id))
  const hash = core.encodeState(data, { track: 'ic', target: 'L4', checked })
  const back = core.decodeState(data, '#' + hash)
  assert.equal(back.track, 'ic')
  assert.equal(back.target, 'L4')
  assert.equal(back.stale, false)
  assert.deepEqual([...back.checked].sort(), [...checked].sort())
  assert.ok(hash.length < 120, `hash is ${hash.length} characters`)
})

test('links made from a different ladder shape are flagged instead of misread', () => {
  const hash = core.encodeState(data, { track: 'ic', target: 'L3', checked: new Set(['ic.L1.tech.1']) })
  const changed = clone()
  changed.tracks[0].levels[0].cells.tech.behaviors.unshift('new behavior')
  const back = core.decodeState(changed, '#' + hash)
  assert.equal(back.stale, true)
  assert.equal(back.checked.size, 0)

  const typoFix = clone()
  typoFix.tracks[0].levels[0].cells.tech.behaviors[0] += ' (แก้คำผิด)'
  assert.equal(core.decodeState(typoFix, '#' + hash).checked.size, 1)
})

test('bad or empty hashes fall back to defaults', () => {
  assert.deepEqual(core.decodeState(data, ''), { track: 'ic', target: 'L3', checked: new Set(), stale: false })
  const em = core.decodeState(data, '#t=em')
  assert.equal(em.target, 'M1')
  const junk = core.decodeState(data, `#t=ic&l=L9&v=${core.fingerprint(data, 'ic')}&c=%%%`)
  assert.equal(junk.target, 'L3')
  assert.equal(junk.stale, true)
})

test('radar chart draws rings, axes, labels and escapes text', () => {
  const svg = core.radarSvg({
    labels: ['a<b', 'เทคนิค', 'c'],
    ringLabels: ['L1', 'L2'],
    max: 2,
    series: [{ values: [1, 2, 9], stroke: '#000' }],
  })
  assert.match(svg, /^<svg /)
  assert.ok(svg.includes('a&lt;b') && !svg.includes('a<b'))
  assert.equal((svg.match(/<polygon/g) || []).length, 3)
  assert.equal((svg.match(/<line/g) || []).length, 3)
  assert.equal((svg.match(/<circle/g) || []).length, 3)
})
