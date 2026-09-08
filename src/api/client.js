// 纯前端运行时配置 + 存储层
// 部署到 GitHub Pages 时无后端：API Key 与档案存在浏览器 localStorage
import { postSSE } from './sse.js'

const LS_KEY = 'thought-theater-settings'
const LS_DATA = 'thought-theater-data'

// ---------- 设置 ----------
export function getSettings() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} } catch (e) { return {} }
}
export function saveSettings(patch) {
  const s = { ...getSettings(), ...patch }
  // 允许显式传空串清除 apiKey
  localStorage.setItem(LS_KEY, JSON.stringify(s))
  return s
}

// ---------- 档案 ----------
function loadData() {
  try { return JSON.parse(localStorage.getItem(LS_DATA)) || { roundtables: [], talks: [] } } catch (e) { return { roundtables: [], talks: [] } }
}
export function saveData(d) { localStorage.setItem(LS_DATA, JSON.stringify(d)) }
export function listRoundtables() { return loadData().roundtables.sort((a, b) => b.createdAt - a.createdAt) }
export function listTalks() { return loadData().talks.sort((a, b) => b.updatedAt - a.updatedAt) }
export function putRoundtable(rec) {
  const d = loadData()
  const i = d.roundtables.findIndex(r => r.id === rec.id)
  if (i >= 0) d.roundtables[i] = rec; else d.roundtables.push(rec)
  saveData(d)
}
export function putTalk(t) {
  const d = loadData()
  const i = d.talks.findIndex(t2 => t2.id === t.id)
  if (i >= 0) d.talks[i] = t; else d.talks.push(t)
  saveData(d)
}
export function delRoundtable(id) { const d = loadData(); d.roundtables = d.roundtables.filter(r => r.id !== id); saveData(d) }
export function delTalk(id) { const d = loadData(); d.talks = d.talks.filter(t => t.id !== id); saveData(d) }
export function toggleFavRT(id) {
  const d = loadData()
  const r = d.roundtables.find(x => x.id === id)
  if (r) { r.favorite = !r.favorite; saveData(d); return r }
  return null
}
export function toggleFavTalk(id) {
  const d = loadData()
  const t = d.talks.find(x => x.id === id)
  if (t) { t.favorite = !t.favorite; saveData(d); return t }
  return null
}

// ---------- 模式探测 ----------
// 有后端（本地开发 5173 代理 / 同源 Express）走 /api；纯静态部署直接调智谱
export const hasBackend = typeof window !== 'undefined'
  && (window.__HAS_BACKEND__ !== undefined ? window.__HAS_BACKEND__ : true)

// ---------- LLM 直连（纯前端模式） ----------
export async function llmStream({ messages, temperature, maxTokens, onDelta }) {
  const s = getSettings()
  if (!s.apiKey) throw new Error('未配置 API Key：请先在「设置」中填写智谱 API Key')
  const base = (s.baseUrl || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/+$/, '')
  const resp = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.apiKey },
    body: JSON.stringify({
      model: s.model || 'glm-4.7',
      messages,
      temperature: temperature ?? 0.85,
      max_tokens: maxTokens ?? 1500,
      stream: true,
      thinking: { type: 'disabled' },
    }),
  })
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`
    try { const j = await resp.json(); if (j.error && j.error.message) msg += ': ' + j.error.message } catch (e) {}
    throw new Error(msg)
  }
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '', full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const j = JSON.parse(payload)
          const delta = j.choices && j.choices[0] && j.choices[0].delta ? j.choices[0].delta.content : null
          if (delta) { full += delta; if (onDelta) onDelta(delta) }
        } catch (e) { /* 跳过不完整片段 */ }
      }
    }
  }
  if (!full) throw new Error('GLM 返回了空内容')
  return full
}

// 带重试的流式（空内容自动重试一次，未推送过增量时）
export async function llmStreamRetry(opts, onDelta) {
  let lastErr = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    let pushed = false
    try {
      return await llmStream({ ...opts, onDelta: (d) => { pushed = true; onDelta && onDelta(d) } })
    } catch (e) {
      lastErr = e
      if (pushed) throw e
      if (attempt === 1) await new Promise(r => setTimeout(r, 1200))
    }
  }
  throw lastErr
}
