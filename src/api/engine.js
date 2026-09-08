// 浏览器端圆桌引擎 + 私谈引擎（静态部署用，逻辑与 server/engine 同步）
import { getPersonaFull } from './personas.js'
import { llmStreamRetry } from './client.js'

// ---------- 圆桌 Prompt（与后端保持一致） ----------
function hostSystemPrompt(personas) {
  const roster = personas.map(p => `- ${p.name}（${p.title}）`).join('\n')
  return `你是「思想实验剧场」的圆桌主持人。你不是任何一位思想家的弟子，你是一位犀利、克制、公正的主持者。

本场圆桌嘉宾：
${roster}

你的职责：
1. 开场：用两三句点出今日之问的分量与张力，逐一请嘉宾立论。不渲染、不抢戏。
2. 观察与推进：每一轮互质结束后，你可以用一两句话点出交锋的焦点或未决的裂缝，引导下一轮走向更深处理解层（动机、恐惧、前提假设），而非停留在表面立场重复。
3. 收束：最后请每位嘉宾作终陈，然后你自己综合全场。

你的语言：现代书面白话，简洁、有分寸。称呼嘉宾用其姓名或字号。你不发表自己的哲学观点，你的观点只关于"讨论本身"。

输出要求：每次发言控制在 120 字以内。直接输出内容，不要任何前缀标签。`
}

function guestTurnPrompt(persona, topic, transcriptText, instruction) {
  return `${persona.systemPrompt}

---

# 圆桌任务（当前对话规则）

本场是「思想实验剧场」圆桌讨论，主题：
「${topic}」

## 发言纪律
- 每次发言 250–400 字，**开头必须一句话亮出你本轮的核心主张**（加「一句话：」前缀），然后再展开。结构清晰比文采重要。
- 这是质证现场，不是各自演讲：必须回应之前发言者向你袭来的质疑或与你相左的论点，指名道姓地回应（如"阳明方才说……我不敢苟同"）。
- **引用多样化（严格执行）**：每轮引用你著作中的语句必须与之前轮次不同——本场圆桌是多次发言，绝不在两轮里引用同一句话。若你已引用过某句，本轮必须换用你其他著作/篇章中的语句。每条重要观点配一次有阐释的引用，绝不堆砌。
- 允许被说服、允许修正自己的立场，但修正必须说明是被哪一点说服的。绝不无原则附和。
- 你不知道其他嘉宾在历史中的身后名，只知道他们当场所言。

## 本轮指令
${instruction}

---

# 圆桌记录（截至你发言之前）
${transcriptText || '（讨论尚未开始）'}

---

现在，请以 ${persona.name} 的身份，按本轮指令发言。直接输出内容，不要输出你的名字前缀、不要任何解释。`
}

function summaryPrompt(personas, topic, transcriptText) {
  const roster = personas.map(p => `- ${p.name}（${p.title}）`).join('\n')
  return `你是「思想实验剧场」的纪要官。以下是一场圆桌讨论的完整记录，请产出结构化「思想纪要」。

主题：「${topic}」
嘉宾：
${roster}

## 讨论记录
${transcriptText}

## 输出要求
严格按以下 JSON 结构输出（不要输出 JSON 以外的任何文字、不要用 markdown 代码块包裹）：
{
  "positions": [
    { "name": "嘉宾名", "thesis": "一句话立场（30字内）", "coreArguments": ["核心论点1（每条50字内）", "核心论点2"], "keyQuote": "讨论中最能代表其立场的一句原话（来自记录）" }
  ],
  "consensus": ["双方/多方真正达成一致的点（每条60字内，注明是哪几位）"],
  "fundamentalDivides": ["根本分歧点（每条60字内，说明是谁与谁、分歧在哪个前提上）"],
  "actionAdvice": ["给提问者的可落地行动建议（每条80字内，注明出自谁的思想）"],
  "closing": "主持人式的收束语，100字内，点出这场讨论最值得带走的洞察"
}`
}

function transcriptToText(messages) {
  return messages
    .filter(m => m.speaker !== 'host' || m.text.trim())
    .map(m => `【${m.speakerName || m.speaker}】\n${m.text.trim()}`)
    .join('\n\n')
}

// ---------- 圆桌引擎 ----------
export async function runRoundtableBrowser({ topic, personaIds, rounds, emitMinutes }, cb) {
  const personas = personaIds.map(getPersonaFull)
  if (personas.length < 2) throw new Error('圆桌至少需要两位嘉宾')

  const messages = []
  let counter = 0

  const speak = async (opts, llmOpts) => {
    const id = 'm' + (++counter)
    const msg = { id, speaker: opts.speaker || 'host', speakerName: opts.speakerName || '主持人', phase: opts.phase, text: '', ts: Date.now() }
    cb.onMessageStart({ ...msg })
    try {
      const full = await llmStreamRetry(llmOpts, (d) => cb.onDelta(id, d))
      msg.text = full.trim()
      messages.push(msg)
      cb.onMessage({ ...msg })
      return msg
    } catch (e) {
      msg.text = `（${msg.speakerName}发言失败：${e.message}。跳过此段，讨论继续。）`
      messages.push(msg)
      cb.onMessage({ ...msg })
      return msg
    }
  }

  // ===== 开场 =====
  cb.onPhase('opening', { label: '主持人开场' })
  await speak({ phase: 'opening' }, {
    messages: [
      { role: 'system', content: hostSystemPrompt(personas) },
      { role: 'user', content: `今日圆桌主题：「${topic}」。流程为四幕：各自立论 → 交叉诘问 → 交锋 → 各自终陈。请简短开场（点出问题分量即可），宣布进入第一幕。` },
    ], maxTokens: 400, temperature: 0.85,
  })

  // ===== 第一幕：各自立论（只陈不辩） =====
  cb.onPhase('opening_statements', { label: '第一幕 · 各自立论' })
  for (const p of personas) {
    await speak({ speaker: p.id, speakerName: p.name, phase: 'opening_statements' }, {
      messages: [{ role: 'user', content: guestTurnPrompt(p, topic, transcriptToText(messages), '这是第一幕「各自立论」。规则：**只立论，不辩论**——不要回应其他嘉宾，只做三件事：(1) 一句话亮出你对本主题的根本立场；(2) 给出你最核心的一两条论据，引用你著作中的一句原话并阐释；(3) 预判与你立场相左的流派最可能从哪里反对你（不用点名反击）。') }],
    })
  }

  // ===== 第二幕：诘问（先问后答，不抢答） =====
  cb.onPhase('challenge', { label: '第二幕 · 交叉诘问' })
  for (const p of personas) {
    await speak({ speaker: p.id, speakerName: p.name, phase: 'challenge' }, {
      messages: [{ role: 'user', content: guestTurnPrompt(p, topic, transcriptToText(messages), '这是第二幕「交叉诘问」。规则：**只提问，不答辩**——向其他每一位（或至少两位分歧最大的）嘉宾各提出一个具体、锋利的问题，逼他们亮出隐藏前提或方法论漏洞。问题必须建立在他们第一幕立论的原话之上（引用对方的表述再发问）。你可以先简短说明你为什么问这个（一句话），然后把问题掷出去。') }],
    })
  }

  // ===== 第三幕：交锋（直接对质） =====
  for (let r = 1; r <= rounds; r++) {
    cb.onPhase('cross_examination', { label: `第三幕 · 交锋${rounds > 1 ? `（第 ${r} 轮）` : ''}`, round: r })
    if (r > 1) {
      await speak({ phase: 'cross_examination' }, {
        messages: [
          { role: 'system', content: hostSystemPrompt(personas) },
          { role: 'user', content: `以下是目前讨论记录：\n\n${transcriptToText(messages)}\n\n请用一两句点评上一轮交锋的核心裂缝，引导第 ${r} 轮走向更深处。` },
        ], maxTokens: 250, temperature: 0.85,
      })
    }
    for (const p of personas) {
      const instr = r === 1
        ? '这是第三幕「交锋」第一轮。第二幕各家向你掷来的问题现在必须正面回答：(1) 挑选向你发问中最锋利的一个，先复述它，然后正面作答——承认其成立之处，反击其不成立之处；(2) 顺手回应其他与你分歧最大的论点一轮。'
        : `这是第三幕「交锋」第 ${r} 轮。上一轮的交手继续深入：指名回应刚才向你袭来的最有力一击，同时向分歧最大者再递一问——这次要问得比第二幕更具体、更逼向前提。`
      await speak({ speaker: p.id, speakerName: p.name, phase: 'cross_examination' }, {
        messages: [{ role: 'user', content: guestTurnPrompt(p, topic, transcriptToText(messages), instr) }],
      })
    }
  }

  // ===== 第四幕：终陈 =====
  cb.onPhase('closing_statements', { label: '第四幕 · 各自终陈' })
  for (const p of personas) {
    await speak({ speaker: p.id, speakerName: p.name, phase: 'closing_statements' }, {
      messages: [{ role: 'user', content: guestTurnPrompt(p, topic, transcriptToText(messages), '这是第四幕「终陈」。收束你的立场：经过本场讨论，(1) 你坚持什么、修正什么、依然存疑什么——若其他嘉宾的某一点真正说服了你，明确说出来；(2) 给提问者一句你最想说的话。') }],
    })
  }

  // ===== 主持人综合 =====
  cb.onPhase('synthesis', { label: '终幕 · 主持人综合' })
  await speak({ phase: 'synthesis' }, {
    messages: [
      { role: 'system', content: hostSystemPrompt(personas) },
      { role: 'user', content: `圆桌已近尾声。以下是全部讨论记录：\n\n${transcriptToText(messages)}\n\n请做全场综合：交锋的脉络、各方立场的位移（若有）、这场讨论留下的最大张力。` },
    ], maxTokens: 600, temperature: 0.85,
  })

  // ===== 纪要 =====
  let minutes = null
  if (emitMinutes) {
    cb.onPhase('minutes', { label: '生成思想纪要' })
    const raw = await llmStreamRetry({
      messages: [{ role: 'user', content: summaryPrompt(personas, topic, transcriptToText(messages)) }],
      temperature: 0.3, maxTokens: 2500,
    }, () => {})
    let cleaned = raw.trim()
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fence) cleaned = fence[1].trim()
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
    if (s !== -1 && e !== -1) cleaned = cleaned.slice(s, e + 1)
    try { minutes = JSON.parse(cleaned) } catch (err) { minutes = { parseError: true, raw: cleaned } }
  }

  cb.onDone({ minutes, messages })
  return { minutes, messages }
}

// ---------- 私谈引擎 ----------
export function buildPrivateMessages(persona, topic, history, userMessage) {
  const sys = `${persona.systemPrompt}

---

# 私人谈话规则（当前对话模式）

这里是「思想实验剧场」的私人谈话室。来访者的处境是：
「${topic}」

## 谈话纪律
- 来访者带着真实的困境而来。你的首要之事是「听懂」：他的问题表面之下，真正的恐惧、欲望或执念是什么。必要时先追问一两句再给建议，不急于开方。
- 你的建议必须出自你的思想体系，并且落在具体可执行的事上（你一生都是把思想落成行动的人）。
- 引用必须遵守你的人物设定：自然引用你的著作/书信，引用后用一两句白话阐释要害，再连接到他的处境。**每次回应引用的语句要变换**——同一场谈话中绝不重复引用同一句，从你不同的篇章里取。绝不堆砌。
- 你不知道来访者是谁、他身后的事，只知道他在此处告诉你的。
- 每次回应 200–400 字，像一个真实的深谈：有停顿感、有目光、有分寸。不要每次结尾都「总结陈词」，交谈是往复的，不是讲座。`
  const msgs = [{ role: 'system', content: sys }]
  const recent = (history || []).slice(-12)
  for (const m of recent) msgs.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })
  if (userMessage) msgs.push({ role: 'user', content: userMessage })
  return msgs
}
