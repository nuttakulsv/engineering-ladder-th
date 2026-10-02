;(function () {
  const data = window.LADDER
  const core = window.LadderCore
  const $ = (id) => document.getElementById(id)
  const esc = core.escapeXml
  const els = {
    track: $('track'),
    target: $('target'),
    levelSummary: $('level-summary'),
    notice: $('notice'),
    dims: $('dims'),
    radar: $('radar'),
    overall: $('overall'),
    summary: $('summary'),
    gaps: $('gaps'),
    copy: $('copy'),
    png: $('png'),
    print: $('print'),
    reset: $('reset'),
  }

  let state = core.decodeState(data, location.hash)
  if (state.stale) {
    els.notice.hidden = false
    els.notice.textContent = 'ลิงก์นี้สร้างจาก ladder เวอร์ชันเก่า โครงสร้างเปลี่ยนไปแล้ว จึงเริ่มใหม่จากหน้าว่าง'
  }

  const currentTrack = () => data.tracks.find((t) => t.id === state.track)
  const dimName = (id) => data.dimensions.find((d) => d.id === id)
  const levelOf = (id) => currentTrack().levels.find((l) => l.id === id)

  function save() {
    history.replaceState(null, '', '#' + core.encodeState(data, state))
  }

  function colors() {
    const css = getComputedStyle(document.documentElement)
    const v = (name) => css.getPropertyValue(name).trim()
    return { ink: v('--ink'), grid: v('--grid'), muted: v('--muted'), accent: v('--accent'), target: v('--target'), card: v('--card') }
  }

  function renderControls() {
    els.track.innerHTML = data.tracks.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')
    els.track.value = state.track
    els.target.innerHTML = currentTrack()
      .levels.map((l) => `<option value="${l.id}">${l.id} ${esc(l.title)}</option>`)
      .join('')
    els.target.value = state.target
    const level = levelOf(state.target)
    els.levelSummary.textContent = `${level.id} ${level.title}: ${level.summary} (ขอบเขต: ${level.scope})`
  }

  function renderChecklist() {
    const t = currentTrack()
    const targetIndex = t.levels.findIndex((l) => l.id === state.target)
    els.dims.innerHTML = data.dimensions
      .map((dim) => {
        const levels = t.levels
          .map((level, li) => {
            const items = level.cells[dim.id].behaviors
              .map((text, i) => {
                const id = `${t.id}.${level.id}.${dim.id}.${i + 1}`
                const on = state.checked.has(id) ? ' checked' : ''
                return `<label class="item"><input type="checkbox" data-id="${id}"${on}><span>${esc(text)}</span></label>`
              })
              .join('')
            const above = li > targetIndex ? ' class="above"' : ''
            return `<fieldset${above}><legend>${level.id} ${esc(level.title)}${li > targetIndex ? ' <small>เกินเป้าหมาย</small>' : ''}</legend>${items}</fieldset>`
          })
          .join('')
        return `<details class="dim" open data-dim="${dim.id}"><summary><div class="dim-head"><h2>${esc(dim.name)}</h2><span class="dim-score"></span></div><p class="dim-desc">${esc(dim.summary)}</p></summary>${levels}</details>`
      })
      .join('')
  }

  function radar(c) {
    const t = currentTrack()
    const assessed = core.assess(data, t.id, state.checked)
    const targetValue = t.levels.findIndex((l) => l.id === state.target) + 1
    return core.radarSvg({
      labels: data.dimensions.map((d) => d.short),
      ringLabels: t.levels.map((l) => l.id),
      max: t.levels.length,
      font: '"IBM Plex Sans Thai", "Sarabun", sans-serif',
      colors: c,
      series: [
        { values: data.dimensions.map(() => targetValue), stroke: c.target, dashed: true, fillOpacity: 0 },
        { values: assessed.map((a) => a.value), stroke: c.accent, fill: c.accent, fillOpacity: 0.18 },
      ],
    })
  }

  function renderResults() {
    const t = currentTrack()
    const c = colors()
    const assessed = core.assess(data, t.id, state.checked)
    const targetIndex = t.levels.findIndex((l) => l.id === state.target)
    const max = t.levels.length
    els.radar.innerHTML = radar(c)

    const reachedTarget = assessed.filter((a) => a.value >= targetIndex + 1).length
    els.overall.textContent = `ถึงระดับ ${state.target} แล้ว ${reachedTarget} จาก ${assessed.length} มิติ`

    els.summary.innerHTML = assessed
      .map((a) => {
        const pct = (a.value / max) * 100
        const mark = ((targetIndex + 1) / max) * 100
        return `<li><span>${esc(dimName(a.dim).short)}</span><span class="bar"><span style="width:${pct}%"></span><i style="left:calc(${mark}% - 1px)"></i></span><span class="num">${a.reached || '-'}</span></li>`
      })
      .join('')

    for (const a of assessed) {
      const node = els.dims.querySelector(`[data-dim="${a.dim}"] .dim-score`)
      if (node) node.textContent = a.reached ? `ผ่าน ${a.reached}` : 'ยังไม่ผ่านระดับแรก'
    }

    const gaps = core.gaps(data, t.id, state.target, state.checked)
    els.gaps.innerHTML = gaps.length
      ? gaps
          .map((g) => {
            const level = levelOf(g.level)
            const more = g.levelsLeft > 1 ? ` <small>และอีก ${g.levelsLeft - 1} ระดับถึงเป้าหมาย</small>` : ''
            return `<div class="gap"><h3>${esc(dimName(g.dim).name)}: ${level.id}${more}</h3>
              <ul>${g.missing.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
              <p><span class="label">ยังไม่ถึงระดับนี้ถ้า:</span> ${esc(g.notYet.join(' / '))}</p>
              <p><span class="label">ลองทำ:</span> ${esc(g.growth.join(' / '))}</p></div>`
          })
          .join('')
      : `<p class="done">ครบตามเป้าหมาย ${state.target} ทุกมิติแล้ว ขั้นต่อไปคือรวบรวมหลักฐานจากงานจริงไปคุยกับหัวหน้า</p>`
  }

  function renderAll() {
    renderControls()
    renderChecklist()
    renderResults()
  }

  els.track.addEventListener('change', () => {
    const t = data.tracks.find((x) => x.id === els.track.value)
    state = { track: t.id, target: t.defaultTarget || t.levels[0].id, checked: new Set() }
    save()
    renderAll()
  })

  els.target.addEventListener('change', () => {
    state.target = els.target.value
    save()
    renderAll()
  })

  els.dims.addEventListener('change', (e) => {
    const id = e.target.dataset && e.target.dataset.id
    if (!id) return
    if (e.target.checked) state.checked.add(id)
    else state.checked.delete(id)
    save()
    renderResults()
  })

  els.copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      els.copy.textContent = 'คัดลอกแล้ว'
    } catch {
      els.copy.textContent = 'คัดลอกจากแถบที่อยู่ได้เลย'
    }
    setTimeout(() => (els.copy.textContent = 'คัดลอกลิงก์'), 2000)
  })

  els.print.addEventListener('click', () => window.print())

  let resetArmed = false
  els.reset.addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true
      els.reset.textContent = 'กดอีกครั้งเพื่อล้าง'
      setTimeout(() => {
        resetArmed = false
        els.reset.textContent = 'ล้างทั้งหมด'
      }, 3000)
      return
    }
    resetArmed = false
    els.reset.textContent = 'ล้างทั้งหมด'
    state.checked = new Set()
    save()
    renderAll()
  })

  els.png.addEventListener('click', () => {
    const c = colors()
    const level = levelOf(state.target)
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const w = 560
      const chartW = w - 40
      const chartH = Math.round((chartW * img.height) / img.width)
      const h = chartH + 170
      const canvas = document.createElement('canvas')
      canvas.width = w * scale
      canvas.height = h * scale
      const ctx = canvas.getContext('2d')
      ctx.scale(scale, scale)
      ctx.fillStyle = c.card
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 20, 30, chartW, chartH)
      ctx.fillStyle = c.ink
      ctx.font = '600 20px "IBM Plex Sans Thai", sans-serif'
      ctx.fillText(`เป้าหมาย ${level.id} ${level.title}`, 32, chartH + 70)
      ctx.fillStyle = c.muted
      ctx.font = '15px "IBM Plex Sans Thai", sans-serif'
      ctx.fillText(els.overall.textContent, 32, chartH + 100)
      ctx.fillText('github.com/nuttakulsv/engineering-ladder-th', 32, chartH + 138)
      canvas.toBlob((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `ladder-${state.target}.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      })
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(radar(c))
  })

  save()
  renderAll()
})()
