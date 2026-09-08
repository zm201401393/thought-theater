<script setup>
import { ref, onMounted } from 'vue'
import MinutesCard from '../components/MinutesCard.vue'
import {
  listRoundtables, listTalks, delRoundtable, delTalk, toggleFavRT, toggleFavTalk,
} from '../api/client.js'

const tab = ref('roundtables')
const roundtables = ref([])
const talks = ref([])
const openedRoundtable = ref(null)
const openedTalk = ref(null)
const onlyFav = ref(false)

onMounted(() => {
  roundtables.value = listRoundtables()
  talks.value = listTalks()
})

function filteredRTs() {
  return onlyFav.value ? roundtables.value.filter(r => r.favorite) : roundtables.value
}
function filteredTalks() {
  return onlyFav.value ? talks.value.filter(t => t.favorite) : talks.value
}

function fmtTime(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function openRT(r) { openedTalk.value = null; openedRoundtable.value = r }
function openTalk(t) { openedRoundtable.value = null; openedTalk.value = t }
function close() { openedRoundtable.value = null; openedTalk.value = null }

function favRT(id) {
  const r = toggleFavRT(id)
  const i = roundtables.value.findIndex(x => x.id === id)
  if (i >= 0) roundtables.value[i] = r
  if (openedRoundtable.value && openedRoundtable.value.id === id) openedRoundtable.value = r
}
function favTalk(id) {
  const t = toggleFavTalk(id)
  const i = talks.value.findIndex(x => x.id === id)
  if (i >= 0) talks.value[i] = t
  if (openedTalk.value && openedTalk.value.id === id) openedTalk.value = t
}

function delRT(id) {
  if (!confirm('确定删除这场圆桌记录？')) return
  delRoundtable(id)
  roundtables.value = roundtables.value.filter(r => r.id !== id)
  if (openedRoundtable.value && openedRoundtable.value.id === id) close()
}
function removeTalk(id) {
  if (!confirm('确定删除这场私谈记录？')) return
  delTalk(id)
  talks.value = talks.value.filter(t => t.id !== id)
  if (openedTalk.value && openedTalk.value.id === id) close()
}
</script>

<template>
  <div class="archive">
    <!-- 圆桌详情 -->
    <template v-if="openedRoundtable">
      <div class="detail-head card">
        <button class="back" @click="close">← 返回档案库</button>
        <h2>🎭 {{ openedRoundtable.topic }}</h2>
        <p class="meta">{{ openedRoundtable.personaNames.join(' · ') }} · {{ openedRoundtable.rounds }} 轮互质 · {{ fmtTime(openedRoundtable.createdAt) }}</p>
      </div>
      <div class="detail-chat">
        <div v-for="m in openedRoundtable.messages" :key="m.id" class="bubble-row" :class="{ host: m.speaker === 'host' }">
          <div class="bubble">
            <div class="bubble-head"><span class="who">{{ m.speakerName }}</span></div>
            <div class="bubble-text">{{ m.text }}</div>
          </div>
        </div>
      </div>
      <MinutesCard v-if="openedRoundtable.minutes" :minutes="openedRoundtable.minutes" :topic="openedRoundtable.topic" />
    </template>

    <!-- 私谈详情 -->
    <template v-else-if="openedTalk">
      <div class="detail-head card">
        <button class="back" @click="close">← 返回档案库</button>
        <h2>🕯️ {{ openedTalk.topic }}</h2>
        <p class="meta">与 {{ openedTalk.personaName }} 的谈话 · {{ fmtTime(openedTalk.createdAt) }}</p>
      </div>
      <div class="detail-chat">
        <div v-for="(m, i) in openedTalk.messages" :key="i" class="bubble-row" :class="m.role">
          <div class="bubble">
            <div class="bubble-head">
              <span class="who">{{ m.role === 'user' ? '我' : openedTalk.personaName }}</span>
            </div>
            <div class="bubble-text">{{ m.text }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- 列表 -->
    <template v-else>
      <div class="tabs">
        <button :class="{ active: tab === 'roundtables' }" @click="tab = 'roundtables'">🎭 圆桌档案（{{ roundtables.length }}）</button>
        <button :class="{ active: tab === 'talks' }" @click="tab = 'talks'">🕯️ 私谈档案（{{ talks.length }}）</button>
        <label class="fav-toggle">
          <input type="checkbox" v-model="onlyFav" /> 只看收藏
        </label>
      </div>

      <div v-if="tab === 'roundtables'" class="list">
        <p v-if="filteredRTs().length === 0" class="empty">还没有圆桌记录。去「圆桌讨论」开第一场。</p>
        <div v-for="r in filteredRTs()" :key="r.id" class="item card">
          <div class="item-main" @click="openRT(r)">
            <h3>{{ r.topic }}</h3>
            <p class="meta">{{ r.personaNames.join(' · ') }} · {{ r.status === 'done' ? '已完结' : (r.status === 'error' ? '中断' : '进行中') }}</p>
            <p class="meta time">{{ fmtTime(r.createdAt) }}</p>
          </div>
          <div class="item-ops">
            <button :class="{ starred: r.favorite }" @click.stop="favRT(r.id)">{{ r.favorite ? '★' : '☆' }}</button>
            <button class="del" @click.stop="delRT(r.id)">删除</button>
          </div>
        </div>
      </div>

      <div v-else class="list">
        <p v-if="filteredTalks().length === 0" class="empty">还没有私谈记录。去「私人谈话」开启第一次深谈。</p>
        <div v-for="t in filteredTalks()" :key="t.id" class="item card">
          <div class="item-main" @click="openTalk(t)">
            <h3>{{ t.topic }}</h3>
            <p class="meta">与 {{ t.personaName }} · {{ t.messages.length }} 条对话</p>
            <p class="meta time">{{ fmtTime(t.updatedAt) }}</p>
          </div>
          <div class="item-ops">
            <button :class="{ starred: t.favorite }" @click.stop="favTalk(t.id)">{{ t.favorite ? '★' : '☆' }}</button>
            <button class="del" @click.stop="removeTalk(t.id)">删除</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.archive { max-width: 900px; margin: 0 auto; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
.tabs .active { border-color: var(--accent); color: var(--accent); }
.fav-toggle { margin-left: auto; font-size: 13px; color: var(--text-dim); display: flex; gap: 6px; align-items: center; }
.fav-toggle input { width: auto; }

.card { background: var(--bg-card); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 1px 3px rgba(120, 100, 60, .06); }
.list { display: flex; flex-direction: column; gap: 10px; }
.item { display: flex; align-items: stretch; overflow: hidden; }
.item-main { flex: 1; padding: 14px 16px; cursor: pointer; }
.item-main:hover { background: var(--bg-hover); }
.item-main h3 { font-size: 15px; margin-bottom: 4px; }
.meta { font-size: 12px; color: var(--text-dim); }
.time { margin-top: 2px; }
.item-ops { display: flex; flex-direction: column; border-left: 1px solid var(--line); }
.item-ops button { border: none; border-radius: 0; flex: 1; background: transparent; }
.item-ops .starred { color: var(--accent); }
.item-ops .del { color: var(--text-dim); font-size: 12px; }
.empty { color: var(--text-dim); text-align: center; padding: 40px 0; }

.detail-head { padding: 16px 20px; margin-bottom: 14px; position: relative; }
.detail-head h2 { font-size: 17px; color: var(--accent); margin: 8px 0 4px; }
.back { font-size: 12px; padding: 4px 12px; }
.detail-chat {
  max-height: 60vh; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
  background: var(--bg-soft); border: 1px solid var(--line); border-radius: 10px; margin-bottom: 16px;
}
.bubble-row { display: flex; }
.bubble-row.host, .bubble-row.user { justify-content: center; }
.bubble-row.user .bubble { background: var(--accent); color: #fffcf5; border-color: var(--accent); }
.bubble { max-width: 85%; border: 1.5px solid var(--line); border-radius: 10px; padding: 10px 14px; background: var(--bg-card); }
.bubble-row.host .bubble { border-style: dashed; background: transparent; max-width: 92%; }
.who { font-size: 12px; color: var(--text-dim); display: block; margin-bottom: 4px; }
.bubble-text { font-size: 14px; white-space: pre-wrap; }
</style>
