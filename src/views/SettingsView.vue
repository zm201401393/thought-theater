<script setup>
import { ref, onMounted } from 'vue'
import { getSettings, saveSettings, llmStreamRetry } from '../api/client.js'

const model = ref('')
const apiKey = ref('')
const baseUrl = ref('')
const keyMask = ref('')      // 已保存 key 的掩码，如 3096****YGLE
const saved = ref(false)
const testing = ref(false)
const testResult = ref('')

function mask(key) {
  if (!key) return ''
  if (key.length <= 10) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

onMounted(() => {
  const s = getSettings()
  model.value = s.model || 'glm-4.7'
  baseUrl.value = s.baseUrl || ''
  keyMask.value = mask(s.apiKey)
})

async function save() {
  const patch = { model: model.value }
  if (apiKey.value.trim()) patch.apiKey = apiKey.value.trim()
  if (baseUrl.value.trim()) patch.baseUrl = baseUrl.value.trim()
  const s = saveSettings(patch)
  model.value = s.model || 'glm-4.7'
  baseUrl.value = s.baseUrl || ''
  keyMask.value = mask(s.apiKey)
  apiKey.value = ''
  testResult.value = ''
  saved.value = true
  setTimeout(() => (saved.value = false), 2500)
}

async function test() {
  testing.value = true
  testResult.value = ''
  try {
    const t0 = Date.now()
    const text = await llmStreamRetry({
      messages: [{ role: 'user', content: '只回复一个字：安' }],
      maxTokens: 200, temperature: 0.1,
    }, () => {})
    testResult.value = `✅ 连接成功（${getSettings().model || 'glm-4.7'}，${Date.now() - t0}ms）`
  } catch (e) {
    testResult.value = `❌ ${e.message}`
  }
  testing.value = false
}
</script>

<template>
  <div class="settings card">
    <h2>⚙️ 设置</h2>

    <label class="field">
      <span class="field-label">模型（智谱 GLM）</span>
      <select v-model="model">
        <option value="glm-4.7">glm-4.7（推荐 · 最新旗舰）</option>
        <option value="glm-4.6">glm-4.6</option>
        <option value="glm-4-air">glm-4-air（便宜快速）</option>
        <option value="glm-4-flash">glm-4-flash（免费）</option>
      </select>
    </label>

    <label class="field">
      <span class="field-label">API Key</span>
      <div v-if="keyMask" class="key-status">
        <span class="key-mask">已保存：{{ keyMask }}</span>
        <button class="clear" @click="saveSettings({ apiKey: '' }); keyMask = ''">清除</button>
      </div>
      <input type="password" v-model="apiKey" :placeholder="keyMask ? '输入新 Key 可覆盖保存' : '智谱开放平台 API Key'" />
      <p class="hint">获取：open.bigmodel.cn → 右上角「API Keys」。Key 仅保存在你的浏览器本地（localStorage），不经过任何第三方服务器。{{ keyMask ? '留空保存则保留现有 Key。' : '' }}</p>
    </label>

    <label class="field">
      <span class="field-label">API 地址（可选，兼容其他 OpenAI 协议服务）</span>
      <input v-model="baseUrl" placeholder="默认 https://open.bigmodel.cn/api/paas/v4" />
    </label>

    <div class="ops">
      <button class="primary" @click="save">{{ saved ? '✓ 已保存' : '保存' }}</button>
      <button @click="test" :disabled="testing">{{ testing ? '测试中…' : '测试连接' }}</button>
      <span v-if="testResult" class="test-result">{{ testResult }}</span>
    </div>

    <div class="about">
      <h3>关于</h3>
      <p>思想实验剧场 · 圆桌讨论 + 私人谈话</p>
      <p>人物为思想演绎：人设基于苏轼《东坡集》诸篇、王阳明《传习录》、曾国藩《家书》《日记》、毛泽东《实践论》《矛盾论》等真实著作构建，引文皆有出处。</p>
      <p>纯前端应用：所有数据（API Key、圆桌与私谈档案）保存在浏览器本地，刷新不丢，换浏览器/清缓存则重置。</p>
    </div>
  </div>
</template>

<style scoped>
.settings { max-width: 560px; }
h2 { color: var(--accent); margin-bottom: 16px; }
.field { display: block; margin-bottom: 16px; }
.field-label { display: block; font-size: 13px; color: var(--text-dim); margin-bottom: 6px; }
input, select { width: 100%; }
.hint { font-size: 12px; color: var(--text-dim); margin-top: 4px; }
.key-status { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.key-mask { font-size: 13px; color: var(--green); font-family: Consolas, monospace; }
.clear { font-size: 12px; padding: 2px 10px; color: var(--red); }
.ops { display: flex; gap: 10px; align-items: center; margin-top: 20px; flex-wrap: wrap; }
.test-result { font-size: 13px; }
.about { margin-top: 28px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 13px; color: var(--text-dim); }
.about h3 { font-size: 14px; color: var(--text); margin-bottom: 6px; }
.about p { margin-bottom: 4px; }
</style>
