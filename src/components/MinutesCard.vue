<script setup>
defineProps({
  minutes: { type: Object, required: true },
  topic: { type: String, default: '' },
})
</script>

<template>
  <section class="minutes card">
    <div class="m-head">
      <h2>📜 思想纪要</h2>
      <p class="m-topic">「{{ topic }}」</p>
    </div>

    <template v-if="!minutes.parseError">
      <!-- 各方立场卡片 -->
      <h3 class="sec-title">各方立场</h3>
      <div class="pos-grid">
        <div v-for="p in minutes.positions" :key="p.name" class="pos-card">
          <h4>{{ p.name }}</h4>
          <p class="thesis">{{ p.thesis }}</p>
          <ul class="args">
            <li v-for="(a, i) in p.coreArguments" :key="i">{{ a }}</li>
          </ul>
          <blockquote v-if="p.keyQuote">{{ p.keyQuote }}</blockquote>
        </div>
      </div>

      <!-- 共识 -->
      <h3 class="sec-title">✅ 真正的共识</h3>
      <ul class="plain-list">
        <li v-for="(c, i) in minutes.consensus" :key="i">{{ c }}</li>
      </ul>

      <!-- 根本分歧 -->
      <h3 class="sec-title">⚡ 根本分歧</h3>
      <ul class="plain-list divide">
        <li v-for="(d, i) in minutes.fundamentalDivides" :key="i">{{ d }}</li>
      </ul>

      <!-- 行动建议 -->
      <h3 class="sec-title">🧭 行动建议</h3>
      <ul class="plain-list advice">
        <li v-for="(a, i) in minutes.actionAdvice" :key="i">{{ a }}</li>
      </ul>

      <!-- 收束 -->
      <div v-if="minutes.closing" class="closing">
        <p>“{{ minutes.closing }}”</p>
        <span>—— 主持人</span>
      </div>
    </template>

    <div v-else class="parse-warn">
      <p>纪要生成时格式异常，以下为原始输出：</p>
      <pre>{{ minutes.raw }}</pre>
    </div>
  </section>
</template>

<style scoped>
.card { background: var(--bg-card); border: 1px solid var(--line); border-radius: 10px; padding: 20px; box-shadow: 0 1px 3px rgba(120, 100, 60, .06); }
.minutes { margin-top: 20px; border-color: var(--accent-soft); }
.m-head { border-bottom: 1px solid var(--line); padding-bottom: 12px; margin-bottom: 16px; }
.m-head h2 { color: var(--accent); font-size: 18px; }
.m-topic { color: var(--text-dim); font-size: 13px; margin-top: 4px; }

.sec-title { font-size: 15px; color: var(--accent); margin: 20px 0 10px; }

.pos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.pos-card { background: var(--bg-soft); border: 1px solid var(--line); border-radius: 8px; padding: 14px; }
.pos-card h4 { color: var(--text); margin-bottom: 6px; }
.thesis { font-weight: 600; color: var(--accent); font-size: 14px; margin-bottom: 8px; }
.args { padding-left: 18px; font-size: 13px; color: var(--text-dim); }
.args li { margin-bottom: 4px; }
.pos-card blockquote {
  margin-top: 10px; padding: 8px 12px; border-left: 3px solid var(--accent-soft);
  background: var(--bg-card); font-size: 13px; color: var(--text); font-style: italic;
}

.plain-list { padding-left: 4px; list-style: none; }
.plain-list li {
  font-size: 14px; padding: 8px 12px; margin-bottom: 6px;
  background: var(--bg-soft); border-radius: 6px;
}
.plain-list.divide li { border-left: 3px solid var(--red); }
.plain-list.advice li { border-left: 3px solid var(--green); }

.closing { margin-top: 20px; text-align: center; color: var(--accent); font-size: 15px; }
.closing span { display: block; font-size: 12px; color: var(--text-dim); margin-top: 6px; }

.parse-warn pre { white-space: pre-wrap; font-size: 12px; color: var(--text-dim); }
</style>
