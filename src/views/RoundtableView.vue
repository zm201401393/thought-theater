<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { runRoundtableBrowser } from '../api/engine.js'
import { PERSONAS, getPersonaFull } from '../api/personas.js'
import { getSettings, putRoundtable } from '../api/client.js'
import { TOPIC_LIBRARY } from '../api/topics.js'
import MinutesCard from '../components/MinutesCard.vue'

const topic = ref('')
const selected = ref([])
const rounds = ref(2)
const emitMinutes = ref(true)
const keyMissing = ref(false)

const running = ref(false)
const phase = ref('')
const phaseLabel = ref('')
const messages = ref([])
const streamingText = ref('')
const streamingId = ref('')
const minutes = ref(null)
const errorMsg = ref('')
const chatBox = ref(null)

const personas = ref(PERSONAS)
// 本地开发模式优先用后端人设（两端同源同步）
onMounted(async () => {
  try {
    const resp = await fetch('/api/personas')
    if (resp.ok) personas.value = await resp.json()
  } catch (e) { /* 静态部署：用内置人设 */ }
  keyMissing.value = !getSettings().apiKey
})

const canStart = computed(() => topic.value.trim() && selected.value.length >= 2 && !running.value)

function togglePersona(id) {
  if (running.value) return
  const i = selected.value.indexOf(id)
  if (i >= 0) selected.value.splice(i, 1)
  else if (selected.value.length < 4) selected.value.push(id)
}

const personaById = (id) => personas.value.find(p => p.id === id)

async function scrollToBottom() {
  await nextTick()
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight
}

async function start() {
  if (!getSettings().apiKey) { keyMissing.value = true; return }
  running.value = true
  messages.value = []
  minutes.value = null
  errorMsg.value = ''
  phase.value = 'connecting'
  phaseLabel.value = '连接剧场…'

  const record = {
    id: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    topic: topic.value.trim(),
    personaIds: [...selected.value],
    personaNames: selected.value.map(id => getPersonaFull(id)?.name || id),
    rounds: Number(rounds.value),
    createdAt: Date.now(),
    favorite: false,
    messages: [],
    minutes: null,
    status: 'running',
  }

  try {
    await runRoundtableBrowser({
      topic: topic.value.trim(),
      personaIds: selected.value,
      rounds: Number(rounds.value),
      emitMinutes: emitMinutes.value,
    }, {
      onPhase: (ph, d) => { phase.value = ph; phaseLabel.value = d.label; streamingText.value = '' },
      onMessageStart: (msg) => {
        messages.value = messages.value.filter(m => m.id !== msg.id)
        messages.value.push(msg)
        streamingId.value = msg.id
        streamingText.value = ''
        scrollToBottom()
      },
      onMessage: (msg) => {
        messages.value = messages.value.filter(m => m.id !== msg.id)
        messages.value.push(msg)
        streamingId.value = ''
        streamingText.value = ''
        scrollToBottom()
      },
      onDelta: (msgId, delta) => {
        if (msgId === streamingId.value) streamingText.value += delta
        scrollToBottom()
      },
      onDone: (d) => {
        minutes.value = d.minutes
        record.messages = d.messages
        record.minutes = d.minutes
        record.status = 'done'
        putRoundtable(record)
        phaseLabel.value = '本场圆桌结束'
        phase.value = 'done'
        running.value = false
      },
    })
  } catch (e) {
    errorMsg.value = e.message
    record.status = 'error'
    putRoundtable(record)
    running.value = false
  }
}

const PHASE_NAMES = {
  opening: '开场',
  opening_statements: '立论',
  challenge: '诘问',
  cross_examination: '交锋',
  closing_statements: '终陈',
  synthesis: '综合',
  minutes: '纪要',
}

function restart() {
  messages.value = []
  minutes.value = null
  phase.value = ''
  phaseLabel.value = ''
  streamingText.value = ''
}
</script>

<template>
  <div class="roundtable">
    <!-- 配置面板 -->
    <section v-if="messages.length === 0 && !running" class="setup card">
      <h2>🪑 组织一场圆桌</h2>

      <!-- 未配置 Key 前置提醒 -->
      <div v-if="keyMissing" class="key-banner">
        <span>🔑 还未配置 API Key——现在开演所有人都会哑场。请先到「⚙️ 设置」填入智谱 API Key（一分钟搞定）。</span>
        <button class="primary" @click="$emit('go-settings')">前往设置</button>
      </div>

      <label class="field">
        <span class="field-label">今日之问（可从下方话题库一键选择，也可自己输入）</span>
        <textarea v-model="topic" rows="2" placeholder="例如：35岁转行做我真正热爱的事，来得及吗？ / 如何面对「努力也未必有结果」的人生？"
          :disabled="running"></textarea>
      </label>

      <!-- 主题话题库 -->
      <div class="topic-library">
        <div v-for="g in TOPIC_LIBRARY" :key="g.theme" class="topic-group">
          <span class="topic-theme">{{ g.theme }}</span>
          <div class="topic-chips">
            <button v-for="t in g.topics" :key="t" class="topic-chip" :class="{ active: topic === t }"
              @click="topic = t">{{ t }}</button>
          </div>
        </div>
      </div>

      <label class="field">
        <span class="field-label">嘉宾（选 2–4 位）</span>
        <div class="persona-grid">
          <div v-for="p in personas" :key="p.id" class="persona-chip" :class="{ picked: selected.includes(p.id) }"
            :style="selected.includes(p.id) ? { borderColor: p.color, background: p.color + '18' } : {}"
            @click="togglePersona(p.id)">
            <div class="chip-head">
              <span class="chip-emoji">{{ p.emoji }}</span>
              <span class="chip-name" :style="{ color: selected.includes(p.id) ? p.color : 'var(--text)' }">{{ p.name }}</span>
              <span class="chip-check" v-if="selected.includes(p.id)">✓</span>
            </div>
            <p class="chip-title">{{ p.title }}</p>
            <p class="chip-intro">{{ p.intro.slice(0, 60) }}…</p>
          </div>
        </div>
      </label>

      <div class="row">
        <label class="field small">
          <span class="field-label">交锋轮次</span>
          <select v-model="rounds" :disabled="running">
            <option :value="1">1 轮（快）</option>
            <option :value="2">2 轮（标准）</option>
            <option :value="3">3 轮（深谈）</option>
          </select>
        </label>
        <label class="field small check">
          <input type="checkbox" v-model="emitMinutes" :disabled="running" />
          <span>结束后生成思想纪要</span>
        </label>
      </div>

      <button class="primary big" :disabled="!canStart" @click="start">🔔 开幕 · 点燃讨论</button>
      <p class="hint">流程：主持人开场 → 第一幕各自立论 → 第二幕交叉诘问 → 第三幕交锋（{{ rounds }}轮）→ 第四幕各自终陈 → 主持人综合 → 思想纪要</p>
    </section>

    <!-- 圆桌现场 -->
    <div v-else class="stage">
      <!-- 阶段指示条 -->
      <div class="phase-bar card">
        <template v-if="running || messages.length">
          <span v-for="(label, key) in PHASE_NAMES" :key="key" class="phase-chip"
            :class="{ current: phase === key }">
            {{ label }}
          </span>
          <span class="phase-live">{{ phaseLabel }}<span class="dots" v-if="running"><i></i><i></i><i></i></span></span>
        </template>
      </div>

      <p v-if="errorMsg" class="error">⚠ {{ errorMsg }}</p>

      <!-- 消息流 -->
      <div class="chat" ref="chatBox">
        <div v-for="m in messages" :key="m.id" class="bubble-row" :class="{ host: m.speaker === 'host' }">
          <div class="bubble" :class="{ live: m.id === streamingId }" :style="m.speaker === 'host' ? {} : { borderColor: (personaById(m.speaker)?.color || 'var(--line)') }">
            <div class="bubble-head">
              <span class="who" :style="{ color: m.speaker === 'host' ? 'var(--accent)' : (personaById(m.speaker)?.color || 'var(--text)') }">
                {{ m.speaker === 'host' ? '▣ 主持人' : (personaById(m.speaker)?.emoji + ' ' + m.speakerName) }}
              </span>
              <span class="phase-tag">{{ m.id === streamingId ? '发言中…' : (PHASE_NAMES[m.phase] || '') }}</span>
            </div>
            <div class="bubble-text">{{ m.id === streamingId ? streamingText : m.text }}<span v-if="m.id === streamingId" class="cursor">▌</span></div>
          </div>
        </div>
      </div>

      <!-- 思想纪要 -->
      <MinutesCard v-if="minutes" :minutes="minutes" :topic="topic" />

      <div v-if="!running" class="after">
        <button class="primary" @click="restart">🎭 再开一场</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: var(--bg-card); border: 1px solid var(--line);
  border-radius: 10px; padding: 20px;
  box-shadow: 0 1px 3px rgba(120, 100, 60, .06);
}
.setup h2 { color: var(--accent); margin-bottom: 16px; font-size: 18px; }
.field { display: block; margin-bottom: 16px; }
.field-label { display: block; font-size: 13px; color: var(--text-dim); margin-bottom: 6px; }
textarea { width: 100%; }
.row { display: flex; gap: 24px; align-items: end; flex-wrap: wrap; }
.check { display: flex; align-items: center; gap: 8px; color: var(--text-dim); font-size: 14px; }
.check input { width: auto; }

.key-banner {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  background: #fdf3e4; border: 1px solid var(--accent-soft); border-radius: 8px;
  padding: 12px 16px; margin-bottom: 16px; font-size: 14px; color: var(--text);
}
.key-banner span { flex: 1; min-width: 200px; }
.key-banner .primary { padding: 6px 14px; }

.topic-library { margin-bottom: 18px; }
.topic-group { margin-bottom: 12px; }
.topic-theme { font-size: 13px; color: var(--accent); font-weight: 600; display: block; margin-bottom: 6px; }
.topic-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.topic-chip {
  font-size: 13px; padding: 5px 12px; border-radius: 16px;
  background: var(--bg-soft); color: var(--text-dim);
}
.topic-chip:hover { border-color: var(--accent); color: var(--accent); }
.topic-chip.active { background: var(--accent); color: #fffcf5; border-color: var(--accent); }

.persona-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.persona-chip {
  border: 1.5px solid var(--line); border-radius: 8px; padding: 12px;
  cursor: pointer; transition: all .15s; background: var(--bg-card);
}
.persona-chip:hover { background: var(--bg-hover); }
.chip-head { display: flex; align-items: center; gap: 8px; }
.chip-emoji { font-size: 22px; }
.chip-name { font-size: 16px; font-weight: 600; }
.chip-check { margin-left: auto; color: var(--accent); }
.chip-title { font-size: 12px; color: var(--text-dim); margin: 4px 0; }
.chip-intro { font-size: 12px; color: var(--text-dim); line-height: 1.5; }

.big { width: 100%; padding: 12px; font-size: 16px; }
.hint { font-size: 12px; color: var(--text-dim); margin-top: 10px; text-align: center; }

.phase-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; padding: 12px 16px; }
.phase-chip {
  font-size: 12px; padding: 3px 10px; border-radius: 20px;
  background: var(--bg-soft); color: var(--text-dim); border: 1px solid var(--line);
}
.phase-chip.current { border-color: var(--accent); color: var(--accent); }
.phase-live { margin-left: auto; font-size: 13px; color: var(--accent); }
.dots i { animation: blink 1.2s infinite; font-style: normal; margin-left: 2px; }
.dots i:nth-child(2) { animation-delay: .2s; }
.dots i:nth-child(3) { animation-delay: .4s; }
@keyframes blink { 0%,100% { opacity: .2; } 50% { opacity: 1; } }

.chat {
  max-height: 62vh; overflow-y: auto; padding: 16px;
  display: flex; flex-direction: column; gap: 14px;
  background: var(--bg-soft); border: 1px solid var(--line); border-radius: 10px;
}
.bubble-row { display: flex; }
.bubble-row.host { justify-content: center; }
.bubble {
  max-width: 82%; border: 1.5px solid var(--line); border-radius: 10px;
  padding: 12px 16px; background: var(--bg-card);
}
.bubble.live { border-color: var(--accent-soft); background: #fffdf8; }
.bubble-row.host .bubble { max-width: 92%; background: transparent; border-style: dashed; text-align: center; }
.bubble-head { display: flex; justify-content: space-between; margin-bottom: 6px; }
.who { font-weight: 600; font-size: 14px; }
.phase-tag { font-size: 11px; color: var(--text-dim); border: 1px solid var(--line); padding: 0 8px; border-radius: 10px; }
.bubble-text { font-size: 15px; white-space: pre-wrap; }
.cursor { animation: blink 1s infinite; color: var(--accent); }

.error { color: var(--red); padding: 10px 0; }
.after { margin-top: 16px; text-align: center; }
</style>
