<script setup>
import { ref, computed, onMounted } from 'vue'
import RoundtableView from './views/RoundtableView.vue'
import PrivateTalkView from './views/PrivateTalkView.vue'
import ArchiveView from './views/ArchiveView.vue'
import SettingsView from './views/SettingsView.vue'

const view = ref('roundtable')
const navItems = [
  { key: 'roundtable', label: '圆桌讨论', icon: '🎭' },
  { key: 'talk', label: '私人谈话', icon: '🕯️' },
  { key: 'archive', label: '档案库', icon: '📚' },
  { key: 'settings', label: '设置', icon: '⚙️' },
]
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand" @click="view = 'roundtable'">
        <span class="brand-icon">🎭</span>
        <div>
          <h1>思想实验剧场</h1>
          <p class="tagline">让伟大的头脑，就你的问题交锋</p>
        </div>
      </div>
      <nav>
        <button v-for="n in navItems" :key="n.key" :class="{ active: view === n.key }" @click="view = n.key">
          {{ n.icon }} {{ n.label }}
        </button>
      </nav>
    </header>

    <main>
      <RoundtableView v-if="view === 'roundtable'" @go-settings="view = 'settings'" />
      <PrivateTalkView v-else-if="view === 'talk'" @go-settings="view = 'settings'" />
      <ArchiveView v-else-if="view === 'archive'" @open-roundtable="view = 'roundtable'" @open-talk="view = 'talk'" />
      <SettingsView v-else-if="view === 'settings'" @saved="view === 'settings'" />
    </main>

    <footer class="footer">
      思想实验剧场 · 人物为思想演绎 · 引文出自其真实著作
    </footer>
  </div>
</template>

<style scoped>
.app-shell { max-width: 1200px; margin: 0 auto; padding: 0 20px 40px; }
.topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 0; border-bottom: 1px solid var(--line); margin-bottom: 24px;
  flex-wrap: wrap; gap: 12px;
}
.brand { display: flex; align-items: center; gap: 12px; cursor: pointer; }
.brand-icon { font-size: 32px; }
.brand h1 { font-size: 22px; color: var(--accent); letter-spacing: 2px; }
.tagline { font-size: 12px; color: var(--text-dim); letter-spacing: 1px; }
nav { display: flex; gap: 8px; flex-wrap: wrap; }
nav .active { border-color: var(--accent); color: var(--accent); background: var(--bg-card); }
.footer {
  margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line);
  text-align: center; font-size: 12px; color: var(--text-dim); letter-spacing: 1px;
}
</style>
