const sleep = ms => new Promise(r => setTimeout(r, ms))

export async function ingestChunk(text, backendUrl) {
  const url = `${backendUrl}/math-ingest`
  let delay = 1000
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (res.ok) {
      const body = await res.json()
      console.log(`  → ${text.length} chars → ${body.problems} problems, ${body.wiki_units} wiki_units`)
      return body
    }
    if (res.status >= 400 && res.status < 500) {
      throw new Error(`4xx ${res.status}: ${await res.text()}`)
    }
    console.warn(`  [attempt ${attempt}/3] ${res.status} — retrying in ${delay}ms`)
    await sleep(delay)
    delay *= 2
  }
  throw new Error(`Failed after 3 retries (${text.length} chars)`)
}
