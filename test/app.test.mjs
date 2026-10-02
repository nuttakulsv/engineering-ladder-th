// Runs the real site script against a tiny fake DOM, enough to catch wiring mistakes.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const data = JSON.parse(read('../data/ladder.json'))

function element() {
  return {
    innerHTML: '',
    textContent: '',
    value: '',
    hidden: true,
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn
    },
    querySelector() {
      return { textContent: '' }
    },
  }
}

function boot(hash = '') {
  const els = {}
  const location = { hash, href: '' }
  const window = {
    LADDER: data,
    location,
    history: { replaceState: (_, __, url) => (location.hash = url) },
    document: {
      documentElement: {},
      getElementById: (id) => (els[id] ??= element()),
    },
    getComputedStyle: () => ({ getPropertyValue: () => '#123456' }),
    navigator: {},
    setTimeout,
    URLSearchParams,
    btoa,
    atob,
  }
  window.window = window
  const ctx = vm.createContext(window)
  vm.runInContext(read('../site/core.js'), ctx)
  vm.runInContext(read('../site/app.js'), ctx)
  return { els, location }
}

test('first load renders every dimension and writes the state to the hash', () => {
  const { els, location } = boot()
  assert.match(location.hash, /^#t=ic&l=L3&v=/)
  assert.equal((els.dims.innerHTML.match(/<details/g) || []).length, data.dimensions.length)
  assert.equal((els.dims.innerHTML.match(/type="checkbox"/g) || []).length, 90)
  assert.match(els.radar.innerHTML, /^<svg/)
  assert.equal(els.overall.textContent, 'ถึงระดับ L3 แล้ว 0 จาก 6 มิติ')
  assert.match(els.gaps.innerHTML, /class="gap"/)
})

test('ticking behaviors updates the result and the shareable hash', () => {
  const { els, location } = boot('#t=ic&l=L1')
  const before = location.hash
  for (const n of [1, 2]) {
    els.dims.listeners.change({ target: { dataset: { id: `ic.L1.tech.${n}` }, checked: true } })
  }
  assert.notEqual(location.hash, before)
  assert.equal(els.overall.textContent, 'ถึงระดับ L1 แล้ว 1 จาก 6 มิติ')

  const reopened = boot(location.hash)
  assert.equal(reopened.els.overall.textContent, 'ถึงระดับ L1 แล้ว 1 จาก 6 มิติ')
})

test('switching track resets to that track and its default target', () => {
  const { els, location } = boot()
  els.track.value = 'em'
  els.track.listeners.change()
  assert.match(location.hash, /t=em&l=M1/)
  assert.equal((els.dims.innerHTML.match(/type="checkbox"/g) || []).length, 54)
})

test('an outdated link shows a notice instead of wrong answers', () => {
  const { els } = boot('#t=ic&l=L3&v=old&c=AQ')
  assert.equal(els.notice.hidden, false)
  assert.equal(els.overall.textContent, 'ถึงระดับ L3 แล้ว 0 จาก 6 มิติ')
})
