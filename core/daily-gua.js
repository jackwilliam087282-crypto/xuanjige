/**
 * core/daily-gua.js —— 今日读卦（1.6.0 新增，替代旧「每日一卦」）
 *
 * 审计要求（一）：
 *   软件已有六爻问事与九宫八卦，不再新增重复的「个人每日问卦」。
 *   1. 首页与侧边栏的「每日一卦 / 今日一卦」统一改名为「今日读卦」。
 *   2. 卦名附近明确显示：
 *      「按公历日期轮读，当日所有用户相同，仅供《周易》学习，非个人测算。」
 *   3. 保留按日期循环六十四卦的功能，并增加卦序、上卦、下卦、卦辞、象辞、现代文化解释。
 *   4. 提供「有具体事情？前往六爻问事」的引导。
 *   5. 禁止出现「为你测得 / 你的今日卦 / 依据你的生辰」等个人化措辞。
 *   6. 「个人今日趋势」由八字流日 / 今日运势模块承担，不与今日读卦混用。
 *
 * 本模块为纯计算，且刻意不接受任何个人输入参数 —— 保证同日所有用户相同。
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./gua-text.js'));
  } else {
    root.DailyGua = factory(root.GuaText);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (GuaText) {
  'use strict';

  /** 固定声明文案 —— 审计要求逐字显示 */
  var DISCLAIMER = '按公历日期轮读，当日所有用户相同，仅供《周易》学习，非个人测算。';

  /** 模块定位说明（与个人运势分离） */
  var SCOPE_NOTE = '本模块按公历日期轮读六十四卦，不含任何个人输入；' +
    '个人今日趋势请见「运势」页（依八字流日推算）。';

  var TITLE = '今日读卦';

  /** 引导按钮文案 */
  var CTA = '有具体事情？前往六爻问事';
  var CTA_PAGE = 'gua';

  /**
   * 建库日 —— 用自己的历元保证「按规则循环」，而非依赖年份奇偶。
   * 1970-01-01 为甲子之外的任意锚点，仅用于取模，不涉及命理含义。
   */
  var EPOCH_UTC = Date.UTC(1970, 0, 1);

  /** 取某日 00:00 的本地日期序数（避免时区把跨日推错） */
  function dayIndex(date) {
    var d = date instanceof Date ? date : new Date(date);
    var local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((local - EPOCH_UTC) / 86400000);
  }

  /** 上卦 / 下卦 拆分 */
  var TRIGRAM_LABEL = {
    乾: '乾 ☰（天）', 兑: '兑 ☱（泽）', 离: '离 ☲（火）', 震: '震 ☳（雷）',
    巽: '巽 ☴（风）', 坎: '坎 ☵（水）', 艮: '艮 ☶（山）', 坤: '坤 ☷（地）'
  };

  /** 全名拆解上下卦（如「水雷屯」→ 上坎 下震） */
  var GUA_CHAR = { 天: '乾', 地: '坤', 雷: '震', 风: '巽', 水: '坎', 火: '离', 山: '艮', 泽: '兑' };

  /**
   * 由卦名解析出规范全名。
   *
   * 【1.6.0 修正】原实现只按传入字符串的字数分支：
   * 传入单字简称（如「蹇」「屯」「否」）时长度为 1，会直接落到
   * `return { up:'', low:'' }`，导致今日读卦页面上下卦标注为空。
   * 这里先经 shortName 归一，再从 FULL_TO_SHORT 反查全名。
   */
  function fullNameOf(name) {
    var short = GuaText.shortName(name);
    if (!short) return '';
    var map = GuaText.FULL_TO_SHORT || {};
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      if (map[keys[i]] === short) return keys[i];
    }
    return short;
  }

  function splitTrigrams(name) {
    var full = fullNameOf(name);
    if (!full) return { up: '', low: '' };
    // 八纯卦全名形如「乾为天」：去掉「为」连接字后即「乾天」，上下同名
    if (full.indexOf('为') >= 0) {
      var t = GUA_CHAR[full[0]] || full[0];
      return { up: t, low: t };
    }
    // 其余：上卦取第 1 字，下卦取第 2 字（如「水雷屯」→ 上坎 下震）
    if (full.length >= 2) {
      return { up: GUA_CHAR[full[0]] || full[0], low: GUA_CHAR[full[1]] || full[1] };
    }
    // 兜底：无法解析时按八纯卦处理
    var g = GUA_CHAR[full] || full;
    return { up: g, low: g };
  }

  /**
   * 计算某日的读卦。
   * 刻意不接收任何个人参数：同日所有用户结果必然相同。
   * @param {Date} date 公历日期（默认今天）
   * @returns {object}
   */
  function ofDate(date) {
    var d = date instanceof Date ? date : new Date(date || Date.now());
    var idx0 = dayIndex(d);
    // 保证非负取模
    var order = GuaText.KING_WEN_ORDER;
    var n = ((idx0 % order.length) + order.length) % order.length;
    var short = order[n];

    // 补齐全名
    var full = null;
    Object.keys(GuaText.FULL_TO_SHORT).forEach(function (f) {
      if (GuaText.FULL_TO_SHORT[f] === short && !full) full = f;
    });
    full = full || short;

    var tri = splitTrigrams(full);
    var gua = GuaText.guaCi(short);
    var xiang = GuaText.xiangCi(short);
    var culture = GuaText.cultureNote(short);

    return {
      date: fmtDate(d),
      // 卦序（通行本 1~64）
      index: GuaText.kingWenIndex(short),
      name: short,
      fullName: full,
      // 上卦 / 下卦
      up: tri.up,
      upLabel: TRIGRAM_LABEL[tri.up] || tri.up,
      low: tri.low,
      lowLabel: TRIGRAM_LABEL[tri.low] || tri.low,
      // 卦辞
      guaCi: gua.text,
      guaCiLabel: '卦辞',
      // 象辞（《象传》大象）
      xiangCi: xiang.text,
      xiangCiLabel: '象辞',
      // 现代文化解释
      culture: culture.text,
      cultureLabel: '现代文化解释',
      // 定位声明
      disclaimer: DISCLAIMER,
      scopeNote: SCOPE_NOTE,
      title: TITLE,
      cta: CTA,
      ctaPage: CTA_PAGE,
      // 明确标记：非个人测算
      personal: false
    };
  }

  function fmtDate(d) {
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  return {
    TITLE: TITLE,
    DISCLAIMER: DISCLAIMER,
    SCOPE_NOTE: SCOPE_NOTE,
    CTA: CTA,
    CTA_PAGE: CTA_PAGE,
    TRIGRAM_LABEL: TRIGRAM_LABEL,
    ofDate: ofDate,
    splitTrigrams: splitTrigrams,
    dayIndex: dayIndex
  };
});
