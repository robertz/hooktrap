const root = document.getElementById('bin')
const binId = root.dataset.bin
const endpoint = `${root.dataset.publicUrl || location.origin}/in/${binId}`
const api = `/api/bins/${binId}`

const listEl = document.getElementById('list')
const detailEl = document.getElementById('detail')
const statusEl = document.getElementById('status')

let requests = []
let selectedId = null

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') el.className = value
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value)
    else if (value !== false && value != null) el.setAttribute(key, value)
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue
    el.append(child instanceof Node ? child : document.createTextNode(String(child)))
  }
  return el
}

function bytes(size) {
  if (size < 1024) return `${size} B`
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1048576).toFixed(1)} MB`
}

function time(iso) {
  return new Date(iso).toLocaleTimeString()
}

function remember() {
  const known = JSON.parse(localStorage.getItem('hooktrap.bins') || '[]')
  if (!known.includes(binId)) {
    known.unshift(binId)
    localStorage.setItem('hooktrap.bins', JSON.stringify(known.slice(0, 20)))
  }
}

function renderList() {
  listEl.replaceChildren()
  if (!requests.length) {
    listEl.append(
      h('div', { class: 'empty' },
        h('p', {}, 'Waiting for the first request.'),
        h('p', {}, 'Try it from a terminal:'),
        h('pre', {}, `curl -X POST ${endpoint}/hello \\\n  -H 'Content-Type: application/json' \\\n  -d '{"event":"ping"}'`)
      )
    )
    return
  }
  for (const item of requests) {
    listEl.append(
      h('button', {
        class: `row${item.id === selectedId ? ' selected' : ''}`,
        type: 'button',
        onclick: () => select(item.id)
      },
        h('span', { class: `method m-${item.method.toLowerCase()}` }, item.method),
        h('span', { class: 'path' }, item.path || '/'),
        h('span', { class: 'meta' }, `${time(item.receivedAt)} · ${bytes(item.size)}${item.replayCount ? ` · replayed ${item.replayCount}×` : ''}`)
      )
    )
  }
}

function table(pairs) {
  return h('table', { class: 'kv' },
    h('tbody', {}, pairs.map(([name, value]) => h('tr', {}, h('th', {}, name), h('td', {}, value))))
  )
}

function bodyBlock(body, contentType) {
  if (!body.size) return h('p', { class: 'muted' }, 'No body.')
  const notes = []
  if (body.truncated) notes.push(`showing the first part of ${bytes(body.size)}`)
  if (body.encoding === 'base64') notes.push('not text, shown as base64')
  let text = body.text
  if (body.encoding === 'utf8' && !body.truncated) {
    try {
      text = JSON.stringify(JSON.parse(body.text), null, 2)
      if (!/json/i.test(contentType || '')) notes.push('formatted as JSON')
    } catch {}
  }
  return h('div', {},
    notes.length ? h('p', { class: 'muted' }, notes.join(' · ')) : null,
    h('pre', { class: 'body' }, text)
  )
}

function replayBlock(replay) {
  const ok = !replay.error && replay.status < 400
  return h('details', { class: 'replay' },
    h('summary', {},
      h('span', { class: `badge ${ok ? 'good' : 'bad'}` }, replay.error ? 'failed' : replay.status),
      h('span', { class: 'path' }, replay.destination),
      h('span', { class: 'meta' }, `${time(replay.at)} · ${replay.durationMs} ms`)
    ),
    replay.error
      ? h('p', { class: 'error' }, replay.error)
      : [
          h('h4', {}, 'Response headers'),
          table(replay.headers.map((header) => [header.name, header.value])),
          h('h4', {}, 'Response body'),
          bodyBlock(replay.body, (replay.headers.find((header) => header.name.toLowerCase() === 'content-type') || {}).value)
        ]
  )
}

function renderDetail(item) {
  const query = [...new URLSearchParams(item.query)]
  const target = h('input', {
    type: 'text',
    name: 'target',
    placeholder: 'http://localhost:8080',
    value: localStorage.getItem('hooktrap.target') || '',
    'aria-label': 'Replay target'
  })
  const message = h('p', { class: 'error', hidden: '' })
  const submit = h('button', { class: 'primary', type: 'submit' }, 'Replay')
  const form = h('form', {
    class: 'replay-form',
    onsubmit: async (event) => {
      event.preventDefault()
      message.hidden = true
      submit.disabled = true
      localStorage.setItem('hooktrap.target', target.value)
      const res = await fetch(`${api}/requests/${item.id}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.value })
      })
      submit.disabled = false
      if (!res.ok) {
        message.textContent = (await res.json()).message
        message.hidden = false
        return
      }
      select(item.id, true)
    }
  }, target, submit)

  detailEl.replaceChildren(...[
    h('header', { class: 'detail-head' },
      h('span', { class: `method m-${item.method.toLowerCase()}` }, item.method),
      h('code', {}, (item.path || '/') + (item.query ? `?${item.query}` : '')),
    ),
    h('p', { class: 'muted' }, `${new Date(item.receivedAt).toLocaleString()} · from ${item.ip} · ${bytes(item.size)}`),
    h('h3', {}, 'Replay'),
    h('p', { class: 'muted' }, 'Sends the same method, path, query, headers and body to another server.'),
    form,
    message,
    item.replays.map(replayBlock),
    query.length ? [h('h3', {}, 'Query'), table(query)] : null,
    h('h3', {}, 'Headers'),
    table(item.headers.map((header) => [header.name, header.value])),
    h('h3', {}, 'Body'),
    bodyBlock(item.body, item.contentType)
  ].flat().filter(Boolean))
  if (item.replays.length) detailEl.querySelector('details.replay').open = true
}

async function select(id, keepScroll = false) {
  selectedId = id
  renderList()
  const res = await fetch(`${api}/requests/${id}`)
  if (selectedId !== id) return
  if (!res.ok) {
    detailEl.replaceChildren(h('p', { class: 'muted' }, 'That request is no longer in this bin.'))
    return
  }
  const top = detailEl.scrollTop
  renderDetail(await res.json())
  detailEl.scrollTop = keepScroll ? top : 0
}

function clearDetail() {
  selectedId = null
  detailEl.replaceChildren(h('p', { class: 'muted' }, 'Select a request to see what it carried.'))
}

async function load() {
  const res = await fetch(`${api}/requests`)
  requests = (await res.json()).requests
  renderList()
  if (requests.length && !selectedId) select(requests[0].id)
}

function listen() {
  const stream = new EventSource(`${api}/stream`)
  stream.addEventListener('ready', () => {
    statusEl.textContent = 'live'
    statusEl.className = 'status live'
    load()
  })
  stream.addEventListener('request', (event) => {
    const item = JSON.parse(event.data)
    if (requests.some((existing) => existing.id === item.id)) return
    requests.unshift(item)
    renderList()
    if (!selectedId) select(item.id)
  })
  stream.addEventListener('replay', (event) => {
    const { requestId, replayCount } = JSON.parse(event.data)
    const item = requests.find((existing) => existing.id === requestId)
    if (item) item.replayCount = replayCount
    renderList()
  })
  stream.addEventListener('cleared', () => {
    requests = []
    renderList()
    clearDetail()
  })
  stream.addEventListener('deleted', () => {
    stream.close()
    location.href = '/'
  })
  stream.onerror = () => {
    statusEl.textContent = 'reconnecting'
    statusEl.className = 'status'
  }
}

document.getElementById('endpoint').textContent = endpoint
document.getElementById('copy').addEventListener('click', async (event) => {
  await navigator.clipboard.writeText(endpoint)
  event.target.textContent = 'Copied'
  setTimeout(() => (event.target.textContent = 'Copy'), 1200)
})
document.getElementById('clear').addEventListener('click', () => fetch(`${api}/requests`, { method: 'DELETE' }))
document.getElementById('delete').addEventListener('click', async () => {
  if (!confirm('Delete this bin and everything it caught?')) return
  await fetch(api, { method: 'DELETE' })
  location.href = '/'
})

remember()
clearDetail()
renderList()
listen()
