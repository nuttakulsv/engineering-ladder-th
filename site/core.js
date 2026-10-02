;(function (root) {
  const MET_RATIO = 2 / 3
  const CELL_FIELDS = ['behaviors', 'notYet', 'evidence', 'growth']

  function validate(data) {
    const errors = []
    const dimIds = (data.dimensions || []).map((d) => d.id)
    const seen = new Set()
    const unique = (id, where) => {
      if (!id || typeof id !== 'string') errors.push(`${where}: missing id`)
      else if (seen.has(id)) errors.push(`${where}: duplicate id "${id}"`)
      else seen.add(id)
    }

    if (!dimIds.length) errors.push('dimensions: empty')
    for (const d of data.dimensions || []) {
      unique(d.id, 'dimension')
      for (const key of ['name', 'short', 'summary']) {
        if (!d[key]) errors.push(`dimension ${d.id}: missing ${key}`)
      }
    }
    if (!(data.tracks || []).length) errors.push('tracks: empty')
    for (const t of data.tracks || []) {
      unique(t.id, 'track')
      if (!t.name) errors.push(`track ${t.id}: missing name`)
      if (t.defaultTarget && !(t.levels || []).some((l) => l.id === t.defaultTarget)) {
        errors.push(`track ${t.id}: defaultTarget "${t.defaultTarget}" is not a level`)
      }
      if (!(t.levels || []).length) errors.push(`track ${t.id}: no levels`)
      for (const l of t.levels || []) {
        unique(l.id, `track ${t.id} level`)
        for (const key of ['title', 'scope', 'summary']) {
          if (!l[key]) errors.push(`${t.id}/${l.id}: missing ${key}`)
        }
        for (const extra of Object.keys(l.cells || {})) {
          if (!dimIds.includes(extra)) errors.push(`${t.id}/${l.id}: unknown dimension "${extra}"`)
        }
        for (const dim of dimIds) {
          const cell = l.cells && l.cells[dim]
          if (!cell) {
            errors.push(`${t.id}/${l.id}/${dim}: missing`)
            continue
          }
          for (const field of CELL_FIELDS) {
            const list = cell[field]
            if (!Array.isArray(list) || !list.length) {
              errors.push(`${t.id}/${l.id}/${dim}: ${field} is empty`)
            } else if (list.some((s) => typeof s !== 'string' || !s.trim())) {
              errors.push(`${t.id}/${l.id}/${dim}: ${field} has a blank entry`)
            }
          }
          if (cell.behaviors && cell.behaviors.length < 2) {
            errors.push(`${t.id}/${l.id}/${dim}: needs at least 2 behaviors`)
          }
        }
      }
    }
    return errors
  }

  function track(data, id) {
    const t = data.tracks.find((x) => x.id === id)
    if (!t) throw new Error(`Unknown track "${id}"`)
    return t
  }

  function behaviors(data, trackId) {
    const t = track(data, trackId)
    const list = []
    for (const level of t.levels) {
      for (const dim of data.dimensions) {
        level.cells[dim.id].behaviors.forEach((text, i) => {
          list.push({ id: `${t.id}.${level.id}.${dim.id}.${i + 1}`, level: level.id, dim: dim.id, text })
        })
      }
    }
    return list
  }

  // A level counts as reached when most of its behaviors are shown consistently,
  // and only if every level below it is reached too.
  function assess(data, trackId, checked) {
    const t = track(data, trackId)
    return data.dimensions.map((dim) => {
      let value = 0
      let reached = null
      let next = null
      for (const level of t.levels) {
        const items = level.cells[dim.id].behaviors
        const done = items.filter((_, i) => checked.has(`${t.id}.${level.id}.${dim.id}.${i + 1}`)).length
        const ratio = done / items.length
        if (ratio >= MET_RATIO) {
          value += 1
          reached = level.id
          continue
        }
        value += ratio
        next = level.id
        break
      }
      return { dim: dim.id, value: Math.round(value * 100) / 100, reached, next }
    })
  }

  function gaps(data, trackId, targetId, checked) {
    const t = track(data, trackId)
    const targetIndex = t.levels.findIndex((l) => l.id === targetId)
    if (targetIndex < 0) throw new Error(`Unknown level "${targetId}"`)
    const levelIndex = Object.fromEntries(t.levels.map((l, i) => [l.id, i]))
    const result = []
    for (const a of assess(data, trackId, checked)) {
      if (a.next === null || levelIndex[a.next] > targetIndex) continue
      const level = t.levels[levelIndex[a.next]]
      const cell = level.cells[a.dim]
      result.push({
        dim: a.dim,
        level: level.id,
        missing: cell.behaviors.filter((_, i) => !checked.has(`${t.id}.${level.id}.${a.dim}.${i + 1}`)),
        notYet: cell.notYet,
        growth: cell.growth,
        levelsLeft: targetIndex - levelIndex[a.next] + 1,
      })
    }
    return result
  }

  // Changes only when behaviors are added, removed or moved, so a typo fix keeps old links working.
  function fingerprint(data, trackId) {
    const shape = behaviors(data, trackId).map((b) => b.id).join('|')
    let h = 0x811c9dc5
    for (let i = 0; i < shape.length; i++) {
      h ^= shape.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(36)
  }

  function encodeState(data, state) {
    const list = behaviors(data, state.track)
    const bytes = new Uint8Array(Math.ceil(list.length / 8))
    list.forEach((b, i) => {
      if (state.checked.has(b.id)) bytes[i >> 3] |= 1 << (i & 7)
    })
    const bits = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const params = new URLSearchParams({ t: state.track, l: state.target, v: fingerprint(data, state.track), c: bits })
    return params.toString()
  }

  function decodeState(data, hash) {
    const params = new URLSearchParams(String(hash || '').replace(/^#/, ''))
    const t = data.tracks.find((x) => x.id === params.get('t')) || data.tracks[0]
    const target = t.levels.some((l) => l.id === params.get('l')) ? params.get('l') : t.defaultTarget || t.levels[0].id
    const checked = new Set()
    let stale = false
    const bits = params.get('c')
    if (bits) {
      if (params.get('v') !== fingerprint(data, t.id)) {
        stale = true
      } else {
        try {
          const raw = atob(bits.replace(/-/g, '+').replace(/_/g, '/'))
          behaviors(data, t.id).forEach((b, i) => {
            const byte = raw.charCodeAt(i >> 3) || 0
            if (byte & (1 << (i & 7))) checked.add(b.id)
          })
        } catch {
          stale = true
        }
      }
    }
    return { track: t.id, target, checked, stale }
  }

  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  }

  function radarSvg({ labels, series, max, ringLabels = [], size = 420, font = 'sans-serif', colors = {} }) {
    const ink = colors.ink || '#1f2328'
    const grid = colors.grid || '#d0d4d9'
    const muted = colors.muted || '#6b7280'
    const n = labels.length
    // Extra room left and right so long Thai labels on the side axes are not clipped.
    const pad = size * 0.16
    const cx = size / 2 + pad
    const cy = size / 2
    const r = size * 0.32
    const pt = (i, v) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
      return [cx + Math.cos(a) * r * (v / max), cy + Math.sin(a) * r * (v / max)]
    }
    const fmt = (p) => p.map((x) => x.toFixed(1)).join(',')
    const out = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size + pad * 2} ${size}" width="${size + pad * 2}" height="${size}" font-family="${escapeXml(font)}" role="img">`,
    ]
    for (let ring = 1; ring <= max; ring++) {
      const pts = labels.map((_, i) => fmt(pt(i, ring))).join(' ')
      out.push(`<polygon points="${pts}" fill="none" stroke="${grid}" stroke-width="1"/>`)
      if (ringLabels[ring - 1]) {
        const [x, y] = pt(0, ring)
        out.push(`<text x="${(x - 6).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="${(size * 0.026).toFixed(1)}" fill="${muted}">${escapeXml(ringLabels[ring - 1])}</text>`)
      }
    }
    labels.forEach((label, i) => {
      const [x, y] = pt(i, max)
      out.push(`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${grid}" stroke-width="1"/>`)
      const [lx, ly] = pt(i, max * 1.2)
      const anchor = Math.abs(lx - cx) < 1 ? 'middle' : lx > cx ? 'start' : 'end'
      out.push(`<text x="${lx.toFixed(1)}" y="${(ly + size * 0.012).toFixed(1)}" text-anchor="${anchor}" font-size="${(size * 0.036).toFixed(1)}" fill="${ink}">${escapeXml(label)}</text>`)
    })
    for (const s of series) {
      const pts = s.values.map((v, i) => fmt(pt(i, Math.max(0, Math.min(max, v))))).join(' ')
      const dash = s.dashed ? ' stroke-dasharray="6 5"' : ''
      out.push(`<polygon points="${pts}" fill="${s.fill || 'none'}" fill-opacity="${s.fillOpacity ?? 0.2}" stroke="${s.stroke}" stroke-width="2.5"${dash}/>`)
      if (!s.dashed) {
        s.values.forEach((v, i) => {
          const [x, y] = pt(i, Math.max(0, Math.min(max, v)))
          out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(size * 0.009).toFixed(1)}" fill="${s.stroke}"/>`)
        })
      }
    }
    out.push('</svg>')
    return out.join('')
  }

  const api = { MET_RATIO, validate, behaviors, assess, gaps, fingerprint, encodeState, decodeState, radarSvg, escapeXml }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.LadderCore = api
})(typeof globalThis !== 'undefined' ? globalThis : this)
