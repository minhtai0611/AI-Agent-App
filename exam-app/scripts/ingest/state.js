import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const STATE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'state.json')

function _load() {
  if (!existsSync(STATE_PATH)) return {}
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')) } catch { return {} }
}

function _save(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

export function isIngested(sourceKey) {
  return Boolean(_load()[sourceKey])
}

export function markIngested(sourceKey) {
  const state = _load()
  state[sourceKey] = true
  _save(state)
}

export function listPending(allKeys) {
  const state = _load()
  return allKeys.filter(k => !state[k])
}
