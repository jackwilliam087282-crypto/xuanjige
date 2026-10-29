/* 同一份四柱证据供演算终页和排盘页使用；只整理已计算字段，不另造结论。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ReadingEvidence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function summarize(b) {
    if (!b || !Array.isArray(b.pillars) || b.pillars.length < 4) throw new Error('四柱资料不完整');
    const pillars = b.pillars.slice(0, 4).map(p => ({
      label: p.label, key: p.key, gan: p.gan, zhi: p.zhi,
      text: String(p.gan || '') + String(p.zhi || ''), shishen: p.shiShenGan || ''
    }));
    const scores = ((b.wuxingStat && b.wuxingStat.score) || []).map(s => ({
      name: s.wuXing, percent: Number(s.percent) || 0
    })).sort((a, z) => z.percent - a.percent);
    const strength = b.strength || {};
    const ev = strength.evidence || {};
    const selected = Object.values((b.yongshen && b.yongshen.byGroup) || {})
      .filter(g => g && g.selected).map(g => ({ name: g.name, elements: (g.wuxing || []).slice() }));
    const signs = [];
    if (scores.length) signs.push('五行最高为' + scores[0].name + ' ' + scores[0].percent + '%');
    if (scores.length > 1) signs.push('最低为' + scores[scores.length - 1].name + ' ' + scores[scores.length - 1].percent + '%');
    if (ev.deling && ev.deling.label) signs.push('月令：' + ev.deling.label);
    if (ev.genRoot) signs.push('地支根气 ' + (Number(ev.genRoot.value) || 0));
    if (ev.ganSupport) signs.push('天干帮身 ' + (Number(ev.ganSupport.value) || 0));
    return {
      pillars, day: pillars.find(p => p.key === 'day') || pillars[2],
      month: pillars.find(p => p.key === 'month') || pillars[1],
      element: b.dayWuXing || '', strength: strength.label || strength.level || '',
      strengthScore: Number(strength.value) || 0, scores, selected, signs,
      rule: '出生公历时间 → 节气四柱 → 五行权重与月令/根气 → 旺衰及候选喜用',
      scope: '四柱解释模型；不含六爻起卦、紫微斗数或奇门遁甲排盘。'
    };
  }
  return { summarize };
});
