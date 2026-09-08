// 人设卡（前端打包内置；静态部署时无后端可读文件）
// 与 server/personas/*.json 保持同步（去除 systemPrompt，保留元数据）
import sushiFull from '../../personas-public/sushi.json'
import wangFull from '../../personas-public/wangyangming.json'
import zengFull from '../../personas-public/zengguofan.json'
import maoFull from '../../personas-public/maozedong.json'

const FULL = { sushi: sushiFull, wangyangming: wangFull, zengguofan: zengFull, maozedong: maoFull }
export function getPersonaFull(id) { return FULL[id] }
export { sushiFull, wangFull, zengFull, maoFull }

export const PERSONAS = [
  {
    id: 'sushi', name: '苏轼', title: '北宋文宗 · 豁达旷达的乐天派', dynasty: '北宋（1037–1101）',
    color: '#B4762A', emoji: '🌊',
    intro: sushiFull.intro,
    greeting: sushiFull.greeting,
    quoteBank: sushiFull.quoteBank.slice(0, 4),
  },
  {
    id: 'wangyangming', name: '王阳明', title: '明代心学宗师 · 知行合一的践行者', dynasty: '明代（1472–1529）',
    color: '#3C6BB0', emoji: '⚡',
    intro: wangFull.intro,
    greeting: wangFull.greeting,
    quoteBank: wangFull.quoteBank.slice(0, 4),
  },
  {
    id: 'zengguofan', name: '曾国藩', title: '晚清中兴名臣 · 结硬寨打呆仗的尚拙者', dynasty: '清代（1811–1872）',
    color: '#4A6B4F', emoji: '🏔️',
    intro: zengFull.intro,
    greeting: zengFull.greeting,
    quoteBank: zengFull.quoteBank.slice(0, 4),
  },
  {
    id: 'maozedong', name: '毛泽东', title: '战略家 · 实践与矛盾的思想者', dynasty: '现代（1893–1976）',
    color: '#B03A3A', emoji: '🔥',
    intro: maoFull.intro,
    greeting: maoFull.greeting,
    quoteBank: maoFull.quoteBank.slice(0, 4),
  },
]
