<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { PERSONAS, getPersonaFull } from '../api/personas.js'
import { getSettings, llmStreamRetry, putTalk } from '../api/client.js'
import { buildPrivateMessages } from '../api/engine.js'

const personas = ref(PERSONAS)
const selectedId = ref('')
const topic = ref('')
const userMessage = ref('')
const messages = ref([])
const running = ref(false)
const streamingText = ref('')
const errorMsg = ref('')
const talkId = ref('')
const chatBox = ref(null)
const started = ref(false)
const keyMissing = ref(false)

onMounted(async () => {
  try {
    const resp = await fetch('/api/personas')
    if (resp.ok) personas.value = await resp.json()
  } catch (e) { /* 静态部署：用内置人设 */ }
  keyMissing.value = !getSettings().apiKey
})

const selected = computed(() => personas.value.find(p => p.id === selectedId.value))

async function scrollToBottom() {
  await nextTick()
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight
}

async function begin() {
  if (!selectedId.value || !topic.value.trim()) return
  keyMissing.value = !getSettings().apiKey
  if (keyMissing.value) return
  started.value = true
  messages.value.push({ role: 'assistant', text: getPersonaFull(selectedId.value).greeting, ts: Date.now() })
  await scrollToBottom()
}

async function send() {
  const text = userMessage.value.trim()
  if (!text || running.value) return
  userMessage.value = ''
  running.value = true
  errorMsg.value = ''
  messages.value.push({ role: 'user', text, ts: Date.now() })
  await scrollToBottom()

  const persona = getPersonaFull(selectedId.value)
  if (!talkId.value) talkId.value = `talk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  try {
    const full = await llmStreamRetry({
      messages: buildPrivateMessages(persona, topic.value.trim(), messages.value.slice(0, -1), text),
      temperature: 0.85,
      maxTokens: 1500,
    }, (d) => { streamingText.value += d; scrollToBottom() })

    messages.value.push({ role: 'assistant', text: full.trim(), ts: Date.now() })
    streamingText.value = ''
    putTalk({
      id: talkId.value,
      personaId: selectedId.value,
      personaName: persona.name,
      topic: topic.value.trim().slice(0, 80),
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: messages.value.slice(),
    })
  } catch (e) {
    errorMsg.value = e.message
  }
  running.value = false
  scrollToBottom()
}

function reset() {
  started.value = false
  messages.value = []
  topic.value = ''
  talkId.value = ''
  streamingText.value = ''
}

const QUICK_TOPICS = [
  '我在一份稳定但无热情的工作里，要不要离开？',
  '我总是很容易和别人比较，怎么办？',
  '我很努力却迟迟看不到结果，如何自处？',
]
</script>

<template>
  <div class="talk">
    <!-- 选择思想家 -->
    <section v-if="!started" class="setup card">
      <h2>🕯️ 走进私人谈话室</h2>
      <p class="lead">选择一位思想家，带上你真实的困境。他会像面对一个深夜来访的朋友那样和你谈——追问、沉默、给你的建议出自他一生的学问。</p>

      <!-- 未配置 Key 前置提醒 -->
      <div v-if="keyMissing" class="key-banner">
        <span>🔑 还未配置 API Key——没有钥匙，谈话室的门推不开。请先到「⚙️ 设置」填入智谱 API Key。</span>
        <button class="primary" @click="$emit('go-settings')">前往设置</button>
      </div>

      <div class="persona-grid">
        <div v-for="p in personas" :key="p.id" class="persona-chip" :class="{ picked: selectedId === p.id }"
          :style="selectedId === p.id ? { borderColor: p.color, background: p.color + '18' } : {}"
          @click="selectedId = p.id">
          <div class="chip-head">
            <span class="chip-emoji">{{ p.emoji }}</span>
            <span class="chip-name" :style="{ color: selectedId === p.id ? p.color : 'var(--text)' }">{{ p.name }}</span>
          </div>
          <p class="chip-title">{{ p.dynasty }} · {{ p.title }}</p>
          <p class="chip-intro">{{ p.intro }}</p>
          <div class="quotes">
            <p v-for="q in p.quoteBank.slice(0, 2)" :key="q.text" class="mini-quote">
              “{{ q.text }}” <span>{{ q.source }}</span>
            </p>
          </div>
        </div>
      </div>

      <label class="field" v-if="selectedId">
        <span class="field-label">你的困境（一句话即可，谈开之后可以慢慢说）</span>
        <textarea v-model="topic" rows="2" placeholder="例如：35岁了，工作稳定但心里空落落的，不知道真正想要什么"></textarea>
      </label>
      <div class="quick" v-if="selectedId">
        <span class="quick-label">或者从这些开始：</span>
        <button v-for="t in QUICK_TOPICS" :key="t" class="quick-btn" @click="topic = t">{{ t }}</button>
      </div>

      <button class="primary big" :disabled="!selectedId || !topic.trim()" @click="begin">🚪 推门而入</button>
    </section>

    <!-- 谈话室 -->
    <div v-else class="room">
      <div class="room-head card">
        <span class="who">{{ selected.emoji }} {{ selected.name }}</span>
        <span class="topic">主题：{{ topic }}</span>
        <button class="leave" @click="reset">← 离开谈话室</button>
      </div>

      <div class="chat" ref="chatBox">
        <div v-for="(m, i) in messages" :key="i" class="bubble-row" :class="m.role">
          <div class="bubble">
            <div class="bubble-text">{{ m.text }}</div>
          </div>
        </div>
        <div v-if="streamingText" class="bubble-row assistant">
          <div class="bubble streaming">
            <div class="bubble-text">{{ streamingText }}<span class="cursor">▌</span></div>
          </div>
        </div>
        <div v-if="running && !streamingText" class="typing">{{ selected.name }}正在沉吟…</div>
      </div>

      <p v-if="errorMsg" class="error">⚠ {{ errorMsg }}</p>

      <div class="input-bar">
        <textarea v-model="userMessage" rows="2" placeholder="继续说…（Enter 发送，Shift+Enter 换行）"
          :disabled="running" @keydown.enter.exact.prevent="send"></textarea>
        <button class="primary send" :disabled="!userMessage.trim() || running" @click="send">说</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card { background: var(--bg-card); border: 1px solid var(--line); border-radius: 10px; padding: 20px; box-shadow: 0 1px 3px rgba(120, 100, 60, .06); }
.setup h2 { color: var(--accent); margin-bottom: 8px; }
.lead { font-size: 14px; color: var(--text-dim); margin-bottom: 20px; }

.key-banner {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  background: #fdf3e4; border: 1px solid var(--accent-soft); border-radius: 8px;
  padding: 12px 16px; margin-bottom: 16px; font-size: 14px; color: var(--text);
}
.key-banner span { flex: 1; min-width: 200px; }
.key-banner .primary { padding: 6px 14px; }

.persona-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin-bottom: 20px; }
.persona-chip { border: 1.5px solid var(--line); border-radius: 8px; padding: 14px; cursor: pointer; transition: all .15s; background: var(--bg-card); }
.persona-chip:hover { background: var(--bg-hover); }
.chip-head { display: flex; align-items: center; gap: 8px; }
.chip-emoji { font-size: 24px; }
.chip-name { font-size: 17px; font-weight: 600; }
.chip-title { font-size: 12px; color: var(--text-dim); margin: 4px 0 8px; }
.chip-intro { font-size: 13px; color: var(--text-dim); line-height: 1.6; }
.quotes { margin-top: 10px; border-top: 1px dashed var(--line); padding-top: 8px; }
.mini-quote { font-size: 12px; color: var(--text); font-style: italic; margin-bottom: 4px; }
.mini-quote span { color: var(--text-dim); font-size: 11px; margin-left: 4px; }

.field { display: block; margin-bottom: 12px; }
.field-label { display: block; font-size: 13px; color: var(--text-dim); margin-bottom: 6px; }
textarea { width: 100%; }

.quick { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
.quick-label { font-size: 12px; color: var(--text-dim); }
.quick-btn { font-size: 12px; padding: 4px 10px; border-radius: 16px; color: var(--text-dim); }

.big { width: 100%; padding: 12px; font-size: 16px; }

.room-head { display: flex; align-items: center; gap: 16px; padding: 12px 16px; margin-bottom: 12px; flex-wrap: wrap; }
.room-head .who { font-weight: 600; color: var(--accent); font-size: 16px; }
.room-head .topic { font-size: 13px; color: var(--text-dim); flex: 1; }
.leave { font-size: 12px; padding: 4px 12px; }

.chat {
  max-height: 58vh; min-height: 300px; overflow-y: auto; padding: 16px;
  display: flex; flex-direction: column; gap: 14px;
  background: var(--bg-soft); border: 1px solid var(--line); border-radius: 10px;
}
.bubble-row { display: flex; }
.bubble-row.user { justify-content: flex-end; }
.bubble-row.assistant .bubble { border-color: var(--accent-soft); }
.bubble { max-width: 80%; border: 1.5px solid var(--line); border-radius: 12px; padding: 12px 16px; background: var(--bg-card); }
.bubble-row.user .bubble { background: var(--accent); color: #fffcf5; border-color: var(--accent); }
.bubble-text { font-size: 15px; white-space: pre-wrap; }
.bubble.streaming { border-style: dashed; }
.cursor { animation: blink 1s infinite; color: var(--accent); }
@keyframes blink { 0%,100% { opacity: .2; } 50% { opacity: 1; } }
.typing { font-size: 12px; color: var(--text-dim); font-style: italic; padding: 4px 8px; }

.error { color: var(--red); padding: 8px 0; }

.input-bar { display: flex; gap: 10px; margin-top: 12px; align-items: flex-end; }
.input-bar textarea { flex: 1; }
.send { padding: 12px 20px; }
</style>
