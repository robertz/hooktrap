const known = JSON.parse(localStorage.getItem('hooktrap.bins') || '[]')
const section = document.getElementById('recent')
const list = document.getElementById('recent-list')

async function show() {
  const alive = []
  for (const id of known) {
    const res = await fetch(`/api/bins/${id}`)
    if (!res.ok) continue
    alive.push(id)
    const item = document.createElement('li')
    const link = document.createElement('a')
    link.href = `/b/${id}`
    link.textContent = id
    const created = document.createElement('span')
    created.textContent = ` created ${new Date((await res.json()).createdAt).toLocaleString()}`
    item.append(link, created)
    list.append(item)
  }
  localStorage.setItem('hooktrap.bins', JSON.stringify(alive))
  section.hidden = alive.length === 0
}

show()
