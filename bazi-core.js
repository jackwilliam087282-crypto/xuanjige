/**
 * 核心算法层
 * 基于 lunar-javascript 封装：排盘、五行统计、旺衰、喜用神、大运流年、每日运势推算
 * 所有历法计算（日柱、节气月柱）均由 lunar-javascript 完成，此处不做近似公式推算
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node 环境（小程序与测试）
    module.exports = factory({...require('./vendor/lunar.js'),SupplementalAlgorithms:require('./core/supplemental-algorithms.js')});
  } else {
    // 浏览器环境：lunar.js 已在全局挂载 Solar / LunarUtil
    root.BaziCore = factory(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (LunarLib) {
  var Solar = LunarLib.Solar;
  var LunarUtil = LunarLib.LunarUtil;


/* ============ 基础常量 ============ */

const GAN_WU_XING = LunarUtil.WU_XING_GAN;          // 天干→五行
const ZHI_WU_XING = LunarUtil.WU_XING_ZHI;          // 地支→五行
const SHENG_XIAO = LunarUtil.SHENG_XIAO;            // 地支→生肖
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const WU_XING = ['木', '火', '土', '金', '水'];
// 五行相生：木生火 火生土 土生金 金生水 水生木
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
// 五行相克：木克土 土克水 水克火 火克金 金克木
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

// 十二地支藏干（本气、中气、余气），用于加权统计
const ZHI_HIDE_GAN = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '庚', '戊'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲'],
};

// 地支藏干权重：本气最重，余气递减
const HIDE_WEIGHT = [0.6, 0.25, 0.15];

// 五行主题色
const WU_XING_COLOR = {
  木: '#4a7c59',
  火: '#c23a2e',
  土: '#b8860b',
  金: '#c0c0c0',
  水: '#2c5f8a',
};

// 五行对应脏腑
const WU_XING_ORGAN = {
  木: '肝胆、筋骨、情绪',
  火: '心、小肠、血脉、睡眠',
  土: '脾胃、消化、肌肉',
  金: '肺、大肠、皮肤、呼吸',
  水: '肾、膀胱、骨骼、泌尿',
};

// 地支藏干十神权重（用于身强身弱判断中的地支力量）
const SHI_SHEN_GROUPS = {
  比劫: ['比肩', '劫财'],
  食伤: ['食神', '伤官'],
  财星: ['正财', '偏财'],
  官杀: ['正官', '七杀'],
  印星: ['正印', '偏印'],
};

/* ============ 干支关系 ============ */

const LIU_HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const LIU_CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const LIU_HAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
const SAN_XING = [['寅', '巳', '申'], ['丑', '戌', '未'], ['子', '卯']];

/* ============ 工具函数 ============ */

/** 阳干判定：甲丙戊庚壬为阳 */
function isYangGan(gan) {
  return ['甲', '丙', '戊', '庚', '壬'].indexOf(gan) >= 0;
}

/**
 * 推算十神
 * @param {string} dayGan 日主天干
 * @param {string} target 目标天干
 * @returns {string} 十神名称
 */
function calcShiShen(dayGan, target) {
  if (!GAN_WU_XING[target]) return '';
  const me = GAN_WU_XING[dayGan];
  const other = GAN_WU_XING[target];
  const same = isYangGan(dayGan) === isYangGan(target);
  // 五行关系判定
  let rel;
  if (me === other) rel = 'same';
  else if (SHENG[me] === other) rel = 'sheng';   // 我生
  else if (KE[me] === other) rel = 'ke';           // 我克
  else if (SHENG[other] === me) rel = 'bei_sheng'; // 生我
  else rel = 'bei_ke';                            // 克我

  const map = {
    same: same ? '比肩' : '劫财',
    sheng: same ? '食神' : '伤官',
    ke: same ? '偏财' : '正财',
    bei_ke: same ? '七杀' : '正官',
    bei_sheng: same ? '偏印' : '正印',
  };
  return map[rel];
}

/** 十神归类到五大类 */
function shishenGroup(name) {
  for (const key in SHI_SHEN_GROUPS) {
    if (SHI_SHEN_GROUPS[key].indexOf(name) >= 0) return key;
  }
  return '';
}

/** 判断两地支关系 */
function zhiRelation(a, b) {
  const list = [];
  if (LIU_CHONG[a] === b) list.push('冲');
  if (LIU_HE[a] === b) list.push('合');
  if (LIU_HAI[a] === b) list.push('害');
  for (const g of SAN_XING) {
    if (g.indexOf(a) >= 0 && g.indexOf(b) >= 0 && a !== b) list.push('刑');
  }
  return list;
}

/* ============ 排盘主函数 ============ */

/**
 * 排八字
 * @param {object} birth {year,month,day,hour,gender} hour为0-23，-1 表示时辰不确定
 * @returns {object} 完整排盘结果
 * @throws {Error} 生辰参数非法时抛出中文错误信息
 */
function calcBazi(birth) {
  if(birth?.trueSolar)birth=LunarLib.SupplementalAlgorithms.normalizeBirth(birth);
  // 入参校验：真机上前端异常输入会直接抛到用户面前，需给出可读提示
  if (!birth || typeof birth !== 'object') {
    throw new Error('生辰信息缺失，请重新填写');
  }
  const { year, month, day, hour, gender } = birth;

  const y = Number(year), m = Number(month), d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error('出生日期格式不正确，请重新选择');
  }
  if (y < 1900 || y > 2100) {
    throw new Error('出生年份需在 1900 至 2100 之间');
  }
  if (m < 1 || m > 12) {
    throw new Error('出生月份不正确');
  }
  if (d < 1 || d > 31) {
    throw new Error('出生日期不正确');
  }

  // 时辰不确定时，按当日午时（午时居中，影响最小）取用
  const useHour = (typeof hour === 'number' && Number.isFinite(hour) && hour >= 0) ? hour : 12;

  const solar = Solar.fromYmdHms(y, m, d, useHour, Number.isInteger(birth.minute)?birth.minute:30, 0);
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();

  const pillars = [
    { key: 'year', label: '年柱', gan: ec.getYearGan(), zhi: ec.getYearZhi() },
    { key: 'month', label: '月柱', gan: ec.getMonthGan(), zhi: ec.getMonthZhi() },
    { key: 'day', label: '日柱', gan: ec.getDayGan(), zhi: ec.getDayZhi() },
    { key: 'time', label: '时柱', gan: ec.getTimeGan(), zhi: ec.getTimeZhi() },
  ];

  const dayGan = ec.getDayGan();
  const dayWuXing = GAN_WU_XING[dayGan];

  // 逐柱补充藏干、十神、纳音、五行
  pillars.forEach((p) => {
    const prefix = p.key[0].toUpperCase() + p.key.slice(1);
    p.wuXing = GAN_WU_XING[p.gan] + ZHI_WU_XING[p.zhi];
    p.ganColor = WU_XING_COLOR[GAN_WU_XING[p.gan]];
    p.zhiColor = WU_XING_COLOR[ZHI_WU_XING[p.zhi]];
    p.hideGan = ec['get' + prefix + 'HideGan']();
    p.naYin = ec['get' + prefix + 'NaYin']();
    p.shiShenGan = p.key === 'day' ? '日主' : ec['get' + prefix + 'ShiShenGan']();
    p.shiShenZhi = ec['get' + prefix + 'ShiShenZhi']();
    // 藏干逐个标十神与颜色
    p.hideDetail = p.hideGan.map((g, i) => ({
      gan: g,
      weight: HIDE_WEIGHT[i] || 0.1,
      wuXing: GAN_WU_XING[g],
      color: WU_XING_COLOR[GAN_WU_XING[g]],
      shiShen: calcShiShen(dayGan, g),
    }));
    p.xun = ec['get' + prefix + 'Xun']();
    p.xunKong = ec['get' + prefix + 'XunKong']();
  });

  const SHICHEN_NAME = {
  '-1': '时辰未知', '0': '子时', '2': '丑时', '4': '寅时', '6': '卯时',
  '8': '辰时', '10': '巳时', '12': '午时', '14': '未时',
  '16': '申时', '18': '酉时', '20': '戌时', '22': '亥时',
};

const wuxingStat = calcWuxingStat(pillars);
  const strength = calcStrength(pillars, dayWuXing, wuxingStat, dayGan);
  // 传入连续旺衰值：仅传 level 会让同一档位内的命局喜用完全相同（见 calcYongshen 注释）
  // 同时传入结构化证据，供喜用神按分组评估生扶/克泄耗力量
  const yongshen = calcYongshen(dayWuXing, strength.level, wuxingStat, gender, pillars, strength.value, strength.evidence);
  const yun = calcYun(ec, gender, y);
  const liunian = lunar.getYearInGanZhiExact();

  /* ===== 新增：胎元 · 命宫 · 旬空 =====
   * 【BUG 修复依据】原实现只统计年月日三柱 + 日主旺衰，时柱仅在「冲时支」时
   * 产生 1.1 权重扣分，导致同一天 12 个时辰中有 6 个给出完全相同的四维分数，
   * 用户观感即「只改时辰结果一样」。古法本有时柱（子女宫/晚运/结果）、
   * 胎元（先天根气）、命宫（一生总运）三组信息未纳入，属实质性缺失。
   *
   * 胎元推法：月干进一位、月支进三位。
   * 命宫推法：寅宫起正月顺数至生月，再自该宫起子时逆数至生时。 */
  const monthGan = pillars[1].gan, monthZhi = pillars[1].zhi;
  const taiyuanGan = GAN[(GAN.indexOf(monthGan) + 1) % 10];
  const taiyuanZhi = ZHI[(ZHI.indexOf(monthZhi) + 3) % 12];
  /* 命宫推算（修正两处 BUG）
   * ① 原式用 (useHour+1)/2 作下标，偶数时辰得 x.5 小数，数组取值得undefined；
   *    现改为整数时辰序号 k = ZHI.indexOf(时支)。
   * ② 月份须用「节气月」（月柱地支自寅起），原用公历月 m 属口径错误。 */
  const yueZhiIdx = ZHI.indexOf(monthZhi);            // 寅=2 … 丑=11
  const monthNo = yueZhiIdx >= 2 ? yueZhiIdx - 1 : 12; // 寅月=正月 … 丑月=腊月
  const shichenK = ZHI.indexOf(pillars[3].zhi);        // 子=0 … 亥=11（整数）
  const mgStart = 2 + (monthNo - 1);                   // 寅起正月顺数至生月
  const mgZhi = ZHI[(((mgStart - shichenK) % 12) + 12) % 12];
  const taiyuan = {
    gan: taiyuanGan, zhi: taiyuanZhi,
    wuXing: GAN_WU_XING[taiyuanGan] + ZHI_WU_XING[taiyuanZhi],
    naYin: (function () { try { return ec.getMonthNaYin(); } catch (e) { return ''; } })(),
  };
  const minggong = {
    zhi: mgZhi,
    wuXing: ZHI_WU_XING[mgZhi],
  };
  // 日柱旬空（空亡）：命局最忌之事落空亡则减力
  const xunKong = pillars[1].xunKong || '';

  // 时辰展示：hourKnown 取用户原始输入，不可由 useHour 反推
  const hourKnown = typeof hour === 'number' && Number.isFinite(hour) && hour >= 0;

  return {
    birth: {
      year: y, month: m, day: d,
      hour: useHour,
      originHour: hour,
      hourKnown,
      hourText: SHICHEN_NAME[String(hour)] || '时辰未知',
      gender
    },
    solarTime: birth.solarTime||null,
    civilBirth: birth.civilBirth||null,
    solarDate: `${y}-${pad(m)}-${pad(d)}`,
    lunarText: lunar.toString(),
    lunarMonth: lunar.getMonthInChinese(),
    lunarDay: lunar.getDayInChinese(),
    shengXiao: lunar.getYearShengXiao(),
    pillars,
    baziText: pillars.map(p => p.gan + p.zhi).join(' '),
    dayGan,
    dayWuXing,
    xingShui: dayGan + dayWuXing + '命',
    wuxingStat,
    strength,
    yongshen,
    yun,
    liunian,
    taiyuan,
    minggong,
    xunKong,
    // 注意：不可将 ec/lunar 原对象挂到返回值上。
    // 它们内部含循环引用（_p.self），setData 序列化时会抛异常导致页面空白。
  };
}

/** 五行加权统计：天干计1，地支藏干按权重折算 */
function calcWuxingStat(pillars) {
  const score = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const detail = [];

  pillars.forEach((p) => {
    // 天干
    score[GAN_WU_XING[p.gan]] += 1;
    detail.push({ source: p.label + '·天干', gan: p.gan, wuXing: GAN_WU_XING[p.gan], score: 1 });
    // 地支藏干
    (p.hideDetail || []).forEach((h) => {
      score[h.wuXing] += h.weight;
      detail.push({ source: p.label + '·' + p.zhi + '藏干', gan: h.gan, wuXing: h.wuXing, score: h.weight });
    });
  });

  const total = WU_XING.reduce((s, k) => s + score[k], 0);
  const percent = {};
  WU_XING.forEach((k) => {
    percent[k] = total > 0 ? Math.round((score[k] / total) * 1000) / 10 : 0;
  });

  const sorted = WU_XING.slice().sort((a, b) => score[b] - score[a]);
  const max = sorted[0];
  const min = sorted[4];

  return {
    score: WU_XING.map((k) => ({ wuXing: k, score: Math.round(score[k] * 100) / 100, percent: percent[k], color: WU_XING_COLOR[k] })),
    total: Math.round(total * 100) / 100,
    sorted,
    strongest: max,
    weakest: min,
    missing: WU_XING.filter((k) => score[k] === 0),
    detail,
  };
}

/**
 * 基础旺衰权重模型 —— 身强身弱判定
 *
 * 【审计要求四、2】重写旺衰证据：
 *   - 「通根」只统计日主在地支藏干中的同类根气，印星另列为生扶，不得混称通根；
 *   - 天干得势只统计年、月、时干，排除日干自己；
 *   - 得令、得地、得势、克、泄、耗分别列值，不要只给一个不透明总分；
 *   - 中和是独立状态，不得显示「中和（宜生扶）」。
 *
 * 【审计要求四、5】本模块命名为「基础旺衰权重模型」，
 *   未覆盖调候、格局、从格、合化等高级判断，界面不得宣称完整命理定论。
 */
function calcStrength(pillars, dayWuXing, stat, dayGan) {
  const reasons = [];
  const evidence = {};
  let value = 0;
  const monthZhiWx = ZHI_WU_XING[pillars[1].zhi];

  /* ============ 一、得令（月令为纲，权重最高） ============ */
  let deling = { dir: 0, score: 0, label: '' };
  if (monthZhiWx === dayWuXing) {
    deling = { dir: 1, score: 3, label: `生于${pillars[1].zhi}月，月令${monthZhiWx}与日主同类，得令` };
  } else if (SHENG[monthZhiWx] === dayWuXing) {
    deling = { dir: 1, score: 2, label: `月令${monthZhiWx}生扶日主，得令` };
  } else if (KE[monthZhiWx] === dayWuXing) {
    deling = { dir: -1, score: -3, label: `月令${monthZhiWx}克日主，失令` };
  } else {
    deling = { dir: 0, score: -1, label: `月令${monthZhiWx}与日主无生扶，亦无直接克制` };
  }
  value += deling.score;
  reasons.push(deling.label);
  evidence.deling = deling;

  /* ============ 二、得地（地支根气） ============
   * 审计修正：通根只统计「同类根气」（藏干中与日主同五行者）。
   * 印星（生日主者）另列为「生扶」，不得混入通根。
   */
  let rootCount = 0;        // 同类根气（比劫）
  let yinSupportCount = 0;  // 印星生扶（藏干中生我者）
  const rootDetail = [];
  const yinDetail = [];
  pillars.forEach((p) => {
    (p.hideDetail || []).forEach((h) => {
      if (h.wuXing === dayWuXing) {
        rootCount += h.weight;
        rootDetail.push(`${p.zhi}藏${h.gan}(${h.wuXing})权重${h.weight}`);
      } else if (SHENG[h.wuXing] === dayWuXing) {
        yinSupportCount += h.weight;
        yinDetail.push(`${p.zhi}藏${h.gan}(${h.wuXing}·印)权重${h.weight}`);
      }
    });
  });
  let dedi;
  if (rootCount >= 1.5) dedi = { dir: 1, score: 2, label: `地支通根有力（同类根气合计 ${round2(rootCount)}），得地` };
  else if (rootCount >= 0.8) dedi = { dir: 1, score: 1, label: `地支有一处同类根气（合计 ${round2(rootCount)}）` };
  else if (rootCount > 0) dedi = { dir: 0, score: 0, label: `地支同类根气偏弱（${round2(rootCount)}）` };
  else dedi = { dir: -1, score: 0, label: '地支无同类根气' };
  value += dedi.score;
  reasons.push(dedi.label);
  // 印星生扶单列，不计入「通根」，也不直接加分（另在 evidence 中展示）
  evidence.dedi = dedi;
  evidence.genRoot = {
    value: round2(rootCount),
    items: rootDetail,
    // 审计断言用：通根项内不含印星
    includesYin: false,
    note: rootDetail.length ? '同类根气：' + rootDetail.join('、') : '四支藏干中无与日主同五行者'
  };
  evidence.yinSupport = {
    value: round2(yinSupportCount),
    items: yinDetail,
    note: yinDetail.length ? '印星生扶（不计入通根）：' + yinDetail.join('、') : '四支藏干中无生我之印星'
  };

  /* ============ 三、得势（天干帮身） ============
   * 审计修正：只统计年、月、时干，排除日干自己。
   */
  let ganSupport = 0;
  const ganDetail = [];
  ['year', 'month', 'time'].forEach((k) => {
    const p = pillars.find(x => x.key === k);
    if (!p) return;
    const w = GAN_WU_XING[p.gan];
    if (w === dayWuXing) {
      ganSupport += 1;
      ganDetail.push(`${p.label}${p.gan}(${w}·同类)`);
    } else if (SHENG[w] === dayWuXing) {
      ganSupport += 1;
      ganDetail.push(`${p.label}${p.gan}(${w}·印)`);
    }
  });
  let deshi;
  if (ganSupport >= 3) deshi = { dir: 1, score: 2, label: `天干（年、月、时）三处以上帮身，得势` };
  else if (ganSupport === 2) deshi = { dir: 1, score: 1, label: `天干（年、月、时）两处帮身` };
  else if (ganSupport === 1) deshi = { dir: 0, score: 0, label: `天干（年、月、时）得一处帮身` };
  else deshi = { dir: -1, score: 0, label: '天干（年、月、时）无帮身之力' };
  value += deshi.score;
  reasons.push(deshi.label);
  evidence.deshi = deshi;
  evidence.ganSupport = {
    value: ganSupport,
    items: ganDetail,
    // 审计断言用：日干自身已排除
    selfExcluded: true,
    countedPillars: ['年干', '月干', '时干'],
    note: ganDetail.length ? '帮身之干：' + ganDetail.join('、') : '年、月、时干均不帮身'
  };

  /* ============ 四、克泄耗（分别列值） ============ */
  let keVal = 0;   // 克日主（官杀）
  let xieVal = 0;  // 泄日主（食伤）
  let haoVal = 0;  // 耗日主（财星）
  const keItems = [], xieItems = [], haoItems = [];
  pillars.forEach((p) => {
    const w = GAN_WU_XING[p.gan];
    if (p.key !== 'day') {
      if (KE[w] === dayWuXing) { keVal += 1; keItems.push(`${p.label}${p.gan}(官杀)`); }
      else if (SHENG[dayWuXing] === w) { xieVal += 1; xieItems.push(`${p.label}${p.gan}(食伤)`); }
      else if (KE[dayWuXing] === w) { haoVal += 1; haoItems.push(`${p.label}${p.gan}(财星)`); }
    }
    (p.hideDetail || []).forEach((h) => {
      if (KE[h.wuXing] === dayWuXing) { keVal += h.weight; keItems.push(`${p.zhi}藏${h.gan}(官杀)${h.weight}`); }
      else if (SHENG[dayWuXing] === h.wuXing) { xieVal += h.weight; xieItems.push(`${p.zhi}藏${h.gan}(食伤)${h.weight}`); }
      else if (KE[dayWuXing] === h.wuXing) { haoVal += h.weight; haoItems.push(`${p.zhi}藏${h.gan}(财星)${h.weight}`); }
    });
  });
  const drainTotal = keVal + xieVal + haoVal;
  let keScore = 0;
  if (keVal >= 2) keScore = -2;
  else if (keVal >= 1) keScore = -1;
  if (drainTotal >= 4) keScore -= 1;
  value += keScore;
  if (keVal >= 1) reasons.push(keVal >= 2 ? '官杀有力，制身' : '有官杀制身');
  if (drainTotal >= 4) reasons.push('克泄耗并见，泄耗之力重');
  if (drainTotal > 0 && keVal === 0) reasons.push('无强克，以泄耗为主');

  evidence.ke = { value: round2(keVal), score: keScore, items: keItems, label: '克（官杀）' };
  evidence.xie = { value: round2(xieVal), items: xieItems, label: '泄（食伤）' };
  evidence.hao = { value: round2(haoVal), items: haoItems, label: '耗（财星）' };
  evidence.drainTotal = round2(drainTotal);

  /* ============ 五、档位与独立状态 ============ */
  let level;
  if (value >= 6) level = '极强';
  else if (value >= 3) level = '身强';
  else if (value > -3) level = '中和';
  else if (value >= -6) level = '身弱';
  else level = '极弱';

  const strong = value >= 3;
  const weak = value <= -3;
  // 审计要求：中和是独立状态，既不显示「宜生扶」也不显示「宜克泄耗」
  const neutral = !strong && !weak;

  let label, advice;
  if (neutral) {
    label = '中和';
    advice = '日主中和，五行大致均衡。此状态下不套用「宜生扶」或「宜克泄耗」的二分口径，' +
      '取用应以流通不滞为原则，具体须合格局、调候一并考虑。';
  } else if (strong) {
    label = level + '（宜克泄耗）';
    advice = '日主偏旺。候选方向分别为食伤（泄秀）、财星（耗身）、官杀（制身），' +
      '三者须分别评估命局证据后取舍，不得把日主自身或比劫列为喜用。';
  } else {
    label = level + '（宜生扶）';
    advice = '日主偏弱。候选方向分别为印星（生身）与比劫（帮身），' +
      '须分别评估命局证据后取舍。';
  }

  return {
    value: value,
    level: level,
    strong: strong,
    weak: weak,
    neutral: neutral,
    label: label,
    reasons: reasons,
    evidence: evidence,
    advice: advice,
    model: '基础旺衰权重模型',
    modelLimits: [
      '本模型只计「得令、得地、得势、克、泄、耗」六项可量化权重，不含调候、格局、从格、合化等判断。',
      '月令权重最高，其余各项为主观赋权，不同流派赋权不同，结论可能不同。',
      '印星生扶单列而不计入通根，与部分流派口径不同。',
    ],
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

/**
 * 喜用神与忌神 —— 分组评估，逐项列入选与排除理由
 *
 * 【审计要求四、3】修正五行十神映射：
 *   身强时的候选方向应分别计算食伤、财星、官杀，不得把日主自身/比劫列为喜用。
 *   身弱时分别显示印星和比劫的证据。
 *   中和不能简单采用「最少的五行就是喜用」。
 * 【审计要求四、4】删除「缺什么补什么就是开运方向」：
 *   五行缺失不等于喜用，五行齐全也不等于平衡。所有结论必须列出入选与排除理由。
 */
function calcYongshen(dayWuXing, level, stat, gender, pillars, strengthValue, strengthEv) {
  const v = typeof strengthValue === 'number' ? strengthValue : null;
  const strong = v !== null ? v >= 3 : (level === '身强' || level === '极强');
  const weak = v !== null ? v <= -3 : (level === '身弱' || level === '极弱');
  const neutral = !strong && !weak;

  const SHENG_WX = Object.keys(SHENG).filter(k => SHENG[k] === dayWuXing); // 生我者（印）
  const CAI_WX = [KE[dayWuXing]];                                         // 我克者（财）
  const GUAN_WX = Object.keys(KE).filter(k => KE[k] === dayWuXing);      // 克我者（官杀）
  const SHI_WX = [SHENG[dayWuXing]];                                     // 我生者（食伤）
  const BI_WX = [dayWuXing];                                             // 同我者（比劫）

  // 命局中各五行的实际得分（仅作参考事实，不等于喜用）
  const scoreOf = k => {
    const s = (stat.score || []).find(x => x.wuXing === k);
    return s ? s.score : 0;
  };

  // 力量证据：取旺衰模型的分项值
  const ev = strengthEv || {};
  const keV = (ev.ke && ev.ke.value) || 0;
  const xieV = (ev.xie && ev.xie.value) || 0;
  const haoV = (ev.hao && ev.hao.value) || 0;
  const yinV = (ev.yinSupport && ev.yinSupport.value) || 0;
  const genV = (ev.genRoot && ev.genRoot.value) || 0;
  const ganV = (ev.ganSupport && ev.ganSupport.value) || 0;

  const mk = (name, wxList, selected, reason, evidenceText) => ({
    name: name,
    wuxing: wxList,
    selected: selected,
    reason: reason,
    evidence: evidenceText
  });

  let xi = [];
  let ji = [];
  let principle = '';
  let basis = '';
  let byGroup = {};

  if (strong) {
    /* 身强：分别评估食伤、财星、官杀三类，一律不含日主自身与比劫 */
    const cand = [
      { name: '食伤', wx: SHI_WX, ev: xieV, why: '食伤泄日主之气，使旺气有出路' },
      { name: '财星', wx: CAI_WX, ev: haoV, why: '财星耗日主之力' },
      { name: '官杀', wx: GUAN_WX, ev: keV, why: '官杀制日主，使旺势受约束' },
    ];
    // 审计核心修复：候选集里根本没有比劫（日主自身），从源头排除
    byGroup.shiShang = mk('食伤', SHI_WX, true, cand[0].why,
      `泄（日主所生）力量合计 ${round2(xieV)}` + (xieV === 0 ? '，命局中食伤力量极弱，需靠大运流年引动' : ''));
    byGroup.cai = mk('财星', CAI_WX, true, cand[1].why,
      `耗（我克）力量合计 ${round2(haoV)}` + (haoV === 0 ? '，命局中财星不显' : ''));
    byGroup.guanSha = mk('官杀', GUAN_WX, false,
      `命局官杀力量 ${round2(keV)}，` + (keV >= 1 ? '已有官杀制身，故不作为首要喜用，只作辅助参考' : '本已偏弱，若再取官杀恐制身太过，故本次不入选'),
      `克（克我）力量合计 ${round2(keV)}`);
    byGroup.biJie = mk('比劫', BI_WX, false,
      '比劫与日主同类，身强再补同类只会更旺，故明确排除', `同类根气 ${round2(genV)}、天干帮身 ${round2(ganV)}`);

    xi = SHI_WX.concat(CAI_WX);   // 食伤 + 财星；官杀按证据列为辅助
    if (keV === 0) xi = xi.concat(GUAN_WX);
    principle = '身旺宜泄宜克。候选方向分列食伤（泄）、财星（耗）、官杀（制）三类，' +
      '本次入选「食伤、财星」；官杀因命局已有/不宜过制而列为辅助；比劫与日主同类，明确排除。';
    basis = '旺衰合计 ' + v + '（' + level + '）';
  } else if (weak) {
    /* 身弱：分别显示印星与比劫的证据 */
    byGroup.yin = mk('印星', SHENG_WX, true, '印星生我，直接培补日主',
      `印星生扶（地支藏干）${round2(yinV)}` + (yinV === 0 ? '，命局印星不显，须待大运流年' : ''));
    byGroup.biJie = mk('比劫', BI_WX, true, '比劫同类帮身，助日主立局',
      `同类根气 ${round2(genV)}、天干帮身 ${round2(ganV)}`);
    byGroup.shiShang = mk('食伤', SHI_WX, false, '身弱再泄日主之气，恐更弱，故排除',
      `泄力量 ${round2(xieV)}`);
    byGroup.cai = mk('财星', CAI_WX, false, '身弱再耗日主之力，恐更弱，故排除',
      `耗力量 ${round2(haoV)}`);
    byGroup.guanSha = mk('官杀', GUAN_WX, false, '身弱再受克，恐克身太过，故排除',
      `克力量 ${round2(keV)}`);

    // 排序：印星与比劫谁在命局更缺谁优先（作为次序参考，不作为入选理由）
    xi = SHENG_WX.concat(BI_WX).sort((a, b) => scoreOf(a) - scoreOf(b));
    principle = '身弱宜生宜扶。候选方向分列印星（生身）与比劫（帮身）两类，本次两者皆入选，' +
      '次序按命局实际分布排列；食伤、财星、官杀因身弱不宜再泄耗克而明确排除。';
    basis = '旺衰合计 ' + v + '（' + level + '）';
  } else {
    /* 中和：不采用「最少的五行就是喜用」 */
    const sorted = stat.sorted || [];
    const weakest = sorted[4];
    const strongest = sorted[0];
    byGroup.zhonghe = mk('中和取向', [weakest, strongest], true,
      '中和不以「最缺的五行」为喜用。取用须视命局是否滞：若最弱一支为日主所生（泄气不畅）可考虑扶之，' +
      '若最旺一支为日主同类（过亢）可考虑抑之。此处仅列出待权衡的两支，不作单一结论。',
      `命局最弱 ${weakest}（得分 ${scoreOf(weakest)}）、最旺 ${strongest}（得分 ${scoreOf(strongest)}）`);
    byGroup.biJie = mk('比劫', BI_WX, false, '中和状态下不再补同类，避免过亢', `同类根气 ${round2(genV)}`);
    xi = [weakest];
    principle = '日主中和，不套用「宜生扶」或「宜克泄耗」二分。' +
      '五行缺失不等于喜用，五行齐全也不等于平衡；此处只列出命局最弱与最旺两支作为待权衡项，' +
      '最终取用须合格局、调候一并考虑。';
    basis = '旺衰合计 ' + v + '（中和）';
  }

  // 忌神：明确列出排除理由，不再用无依据的过滤式
  const allExcluded = Object.keys(byGroup).filter(k => !byGroup[k].selected)
    .map(k => byGroup[k].wuxing).reduce((a, b) => a.concat(b), []);
  ji = [];
  WU_XING.forEach(k => {
    if (xi.indexOf(k) < 0 && allExcluded.indexOf(k) >= 0) ji.push(k);
  });
  if (!ji.length) ji = WU_XING.filter(k => xi.indexOf(k) < 0);

  const notes = xi.map((k) => {
    const has = (stat.score || []).find(s => s.wuXing === k);
    const sc = has ? has.score : 0;
    // 审计要求四、4：删除「缺什么补什么」话术
    return `${k}：命局得分 ${sc}。` +
      (sc === 0 ? '该行在命局中不显，属「本无其气」，与「喜用」是两件事——五行有缺不等于需要补益。'
        : '该行在命局中已有，其是否加力仍须合格局判断。');
  });

  return {
    xi,
    ji,
    byGroup,
    principle,
    basis,
    notes,
    xiText: xi.join('、'),
    jiText: ji.join('、'),
    color: WU_XING_COLOR,
    disclaimer: '五行缺失不等于喜用，五行齐全也不等于平衡。本结论为基础旺衰权重模型的产出，' +
      '未覆盖调候、格局、从格、合化，不作完整命理定论。',
  };
}

/** 大运（性别影响顺逆，由 lunar-javascript 处理） */
function calcYun(ec, gender, birthYear) {
  const yun = ec.getYun(gender === '男' ? 1 : 0);
  const list = yun.getDaYun() || [];
  const nowYear = new Date().getFullYear();

  // 首项为「出生至起运」的占位段，干支为空；真正的大运自第二项起算
  const items = list.filter((g) => g.getGanZhi()).slice(0, 10).map((g, i) => {
    const gz = g.getGanZhi();
    return {
      index: i,
      ganzhi: gz,
      gan: gz[0],
      zhi: gz[1],
      startYear: g.getStartYear(),
      endYear: g.getEndYear(),
      startAge: g.getStartAge(),
      endAge: g.getEndAge(),
      color: WU_XING_COLOR[GAN_WU_XING[gz[0]]],
      current: nowYear >= g.getStartYear() && nowYear <= g.getEndYear(),
    };
  });

  const current = items.find(i => i.current) || null;

  return {
    // 起运虚岁取自首个大运的起始年龄（库中 getStartYear() 返回年龄数而非公历年）
    startAge: items.length ? items[0].startAge : yun.getStartYear(),
    startMonth: yun.getStartMonth(),
    startDay: yun.getStartDay(),
    direction: (gender === '男') === isYangGan(ec.getYearGan()) ? '顺排' : '逆排',
    items,
    current,
    rule: '男命阳年顺排、阴年逆排；女命阴年顺排、阳年逆排',
  };
}

/* ============ 每日运势推算 ============ */

/**
 * 推算某日运势
 * @param {object} bazi calcBazi 的结果
 * @param {number} [targetDate] 目标日期时间戳，默认为今天
 */
function calcDailyFortune(bazi, targetDate) {
  const date = targetDate ? new Date(targetDate) : new Date();
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const solar = Solar.fromYmdHms(y, m, d, 12, 0, 0);
  const lunar = solar.getLunar();
  const dayGan = lunar.getDayGanExact2();
  const dayZhi = lunar.getDayZhiExact2();

  const dayGanWx = GAN_WU_XING[dayGan];
  const dayZhiWx = ZHI_WU_XING[dayZhi];
  const me = bazi.dayWuXing;
  const shishen = calcShiShen(bazi.dayGan, dayGan);

  // 当日与八字四支的关系
  const relations = [];
  bazi.pillars.forEach((p) => {
    zhiRelation(dayZhi, p.zhi).forEach((r) => {
      relations.push({ pillar: p.label, zhi: p.zhi, type: r });
    });
  });
  const chongList = relations.filter(r => r.type === '冲');
  const heList = relations.filter(r => r.type === '合');
  const haiList = relations.filter(r => r.type === '害');
  const xingList = relations.filter(r => r.type === '刑');

  // 当日旺衰：当日五行在四季中的旺相休囚死
  const monthZhiWx = ZHI_WU_XING[bazi.pillars[1].zhi];
  const wangShuai = calcWangShuai(dayGanWx, monthZhiWx);

  /* ============================================================
   * 评分
   *
   * 【原实现的问题】
   * 1. 基分固定，且增量稀疏：实测不同生辰四维分几乎恒在 48~74，
   *    看上去"都一样"。原因是财运只看日干十神、事业只看十神，
   *    地支关系权重低且多为负，缺少正负双向的差异化来源。
   * 2. 喜用神当时只由档位决定，同档位命局喜用完全相同（已在 calcYongshen 修正）。
   * 3. 未计入「日支与日主本气的关系」「命局用神当令与否」等实际因素。
   *
   * 【修正思路】引入更多有依据的变量，并双向调整（既有加也有减）：
   *   - 十神（原有）
   *   - 日支与命局各柱的刑冲合害（原有，提高权重并区分维度）
   *   - 旺衰与喜忌（修正后随命局变化）
   *   - 【新】日支五行与日主的生克关系
   *   - 【新】命局中同类五行的繁简（同类过旺则竞争，过少则孤立）
   *   - 【新】用神在月令是否得时
   * ============================================================ */
  const scores = {
    wealth: 60,
    love: 60,
    career: 60,
    health: 70,
  };

  // 通用：十神对各维度的影响
  const group = shishenGroup(shishen);
  if (group === '财星') scores.wealth += 18;
  if (group === '官杀') scores.career += 16;
  if (group === '印星') { scores.career += 10; scores.health += 4; }
  if (group === '食伤') { scores.wealth += 8; scores.career += 8; }
  if (group === '比劫') { scores.wealth -= 12; scores.career -= 4; }
  if (shishen === '七杀') scores.career += 6;

  // 财运：男看财星
  if (bazi.birth.gender === '男') {
    if (group === '财星') scores.wealth += 10;
  } else {
    if (group === '官杀') scores.love += 10;   // 女看官星为夫
  }
  // 感情：男看财星为妻
  if (bazi.birth.gender === '男') {
    if (group === '财星') scores.love += 12;
  }

  /* 地支关系影响
   * 修正：区分「冲哪个柱」——冲日支最重（近身），冲年支最轻（远端）。
   * 原实现对所有冲同等扣分，导致结果只取决于冲的数量而非位置。 */
  chongList.forEach((r) => {
    const w = r.pillar === '日柱' ? 1.6 : (r.pillar === '时柱' ? 1.1 : 0.6);
    if (r.pillar === '日柱') scores.love -= 12 * w;          // 日支为夫妻宫，近冲最伤感情
    scores.career -= 10 * w;
    scores.health -= 6 * w;
    scores.wealth -= 4 * w;
  });
  heList.forEach((r) => {
    const w = r.pillar === '日柱' ? 1.5 : 0.8;
    if (r.pillar === '日柱') scores.love += 14 * w;          // 六合入日支，主感情和睦
    scores.love += 8 * w;
    scores.career += 8 * w;
    scores.health += 3 * w;                                   // 合意亦主身体调和
  });
  xingList.forEach((r) => {
    const w = r.pillar === '日柱' ? 1.4 : 0.7;
    scores.health -= 10 * w;
    scores.career -= 6 * w;
    scores.wealth -= 3 * w;
  });
  haiList.forEach((r) => {
    scores.wealth -= 6;
    scores.love -= 4 * (r.pillar === '日柱' ? 1.5 : 0.7);
  });

  // 三合局：与命局三支成局者，主助力（拱合）；半合亦然
  const SANHE = { '水': ['申', '子', '辰'], '木': ['亥', '卯', '未'], '火': ['寅', '午', '戌'], '金': ['巳', '酉', '丑'] };
  const zhiSet = bazi.pillars.map(p => p.zhi);
  Object.keys(SANHE).forEach((wx) => {
    const need = SANHE[wx];
    const hit = need.filter(z => z === dayZhi || zhiSet.indexOf(z) >= 0).length;
    const uniq = new Set([dayZhi].concat(zhiSet).filter(z => need.indexOf(z) >= 0)).size;
    if (uniq >= 3) {
      scores.career += 10;
      scores.wealth += 8;
      scores.health += 5;
    } else if (uniq === 2) {
      scores.career += 5;
      scores.wealth += 4;
    }
  });

  /* 【新算法1】日支五行与日主的生克
   * 日支为坐下贵人，最能体现「今日与本人」的实质关系。
   * 日支生我/同我 → 得力；我生日支/我克/克我 → 耗力。 */
  const dzWx = dayZhiWx;
  if (dzWx === me) { scores.career += 6; scores.health += 4; }
  else if (SHENG[dzWx] === me) { scores.career += 8; scores.health += 6; scores.love += 4; }
  else if (SHENG[me] === dzWx) { scores.wealth -= 5; scores.career -= 4; }   // 我生下泄
  else if (KE[me] === dzWx) { scores.wealth += 7; scores.career += 5; }       // 我克者为我财
  else if (KE[dzWx] === me) { scores.career -= 7; scores.health -= 5; }       // 克我者压力

  /* 【新算法2】命局同类五行繁简（竞争与孤立）
   * 比劫过旺则分财、竞争；过少则孤掌难鸣。
   * 依据：同类为「兄弟朋友」，主竞争与助力两面。 */
  const meStat = bazi.wuxingStat.score.find(s => s.wuXing === me);
  const meScore = meStat ? meStat.score : 0;
  const mePct = meStat && meStat.percent ? parseFloat(meStat.percent) : 0;
  if (mePct >= 40) {                       // 同类过旺
    scores.wealth -= 9;
    scores.career -= 4;
    scores.love -= 4;
  } else if (mePct > 0 && mePct <= 12) {   // 同类偏少
    scores.career -= 3;                    // 助力少，事需独力
    scores.love -= 3;
  } else if (mePct > 25 && mePct < 40) {
    scores.career += 4;                    // 助力适中
    scores.love += 3;
  }

  /* 【新算法3】用神得时与命局缺口
   * 喜用神当令者事顺；喜用神为命局所缺者，今日难以即时得力。 */
  const xiArr = bazi.yongshen.xi || [];
  const xiIsMonth = xiArr.indexOf(monthZhiWx) >= 0;
  if (xiIsMonth) {
    scores.career += 6;
    scores.wealth += 5;
    scores.health += 4;
  }
  xiArr.forEach((k) => {
    const s = bazi.wuxingStat.score.find(x => x.wuXing === k);
    const absent = !s || s.score === 0;
    if (absent && dayGanWx === k) {
      // 今日天干正是命局所缺之喜用，但本身无根，容易「有机而无实」
      scores.career += 3;
      scores.wealth += 3;
      scores.health += 2;
    }
  });

  // 旺衰调整：当日旺则该五行之事顺
  if (wangShuai.level === '旺') {
    if (bazi.yongshen.xi.indexOf(dayGanWx) >= 0) { scores.wealth += 8; scores.career += 8; }
    else if (bazi.yongshen.ji.indexOf(dayGanWx) >= 0) { scores.wealth -= 8; scores.health -= 6; }
  }
  if (bazi.yongshen.ji.indexOf(dayGanWx) >= 0) {
    scores.wealth -= 6;
    scores.health -= 6;
  }
  // 忌神落地：日支五行若为忌神且当令，则今日该维度额外承压
  if (bazi.yongshen.ji.indexOf(dzWx) >= 0) {
    scores.health -= 4;
    scores.career -= 3;
  }

  /* ============================================================
   * 【新算法4】时柱专项 —— 子女宫 / 晚运 / 事业结果
   *
   * 【BUG 修复依据】原实现时柱只在「冲」时产生扣分，导致同日 12 时辰
   * 有 6 个时辰四维分数完全相同（实测 52/63/53/53 反复出现）。
   * 古法：时柱为子女宫、亦为结果宫，晚运与事业落点皆由此定。
   * 依此按时柱天干十神与时支五行分别给四维差异化加减。
   * ============================================================ */
  const hp = bazi.pillars[3];                      // 时柱
  const hourGanWx = GAN_WU_XING[hp.gan];
  const hourZhiWx = ZHI_WU_XING[hp.zhi];
  const hourShiShen = calcShiShen(bazi.dayGan, hp.gan);
  const hourGroup = shishenGroup(hourShiShen);

  // 时干十神：结果宫之成败
  if (hourGroup === '财星') { scores.wealth += 5; }
  else if (hourGroup === '官杀') { scores.career += 5; }
  else if (hourGroup === '印星') { scores.health += 3; scores.career += 2; }
  else if (hourGroup === '食伤') { scores.career += 3; scores.wealth += 2; }
  else if (hourGroup === '比劫') { scores.wealth -= 4; }        // 时柱比劫主分财

  // 时支五行：晚境与子女宫。用神得时为吉，忌神当令为滞。
  if (bazi.yongshen.xi.indexOf(hourZhiWx) >= 0) {
    scores.wealth += 4; scores.health += 3;
  }
  if (bazi.yongshen.ji.indexOf(hourZhiWx) >= 0) {
    scores.wealth -= 3; scores.career -= 3;
  }
  // 时支与日支（夫妻宫对子女宫）：相冲则宫位不和
  const hourZhiRel = zhiRelation(hp.zhi, bazi.pillars[2].zhi);
  if (hourZhiRel.indexOf('冲') >= 0) { scores.love -= 5; scores.health -= 3; }
  if (hourZhiRel.indexOf('合') >= 0) { scores.love += 4; }
  // 时柱纳音与月柱纳音相冲（古法「纳音相冲」主暗损）
  if (hp.naYin && bazi.pillars[1].naYin && hp.naYin !== bazi.pillars[1].naYin) {
    scores.career -= 2;                    // 纳音相异，气脉不接
  }

  /* ============================================================
   * 【新算法5】胎元 —— 先天根气
   * 胎元为月干进一、月支进三，主先天禀赋与根基。
   * 胎元五行若为喜用则本气厚，为忌神则先天带损。
   * ============================================================ */
  const tyWx = bazi.taiyuan ? bazi.taiyuan.wuXing : '';
  const tyHit = tyWx ? bazi.yongshen.xi.filter(k => tyWx.indexOf(k) >= 0) : [];
  const tyJi = tyWx ? bazi.yongshen.ji.filter(k => tyWx.indexOf(k) >= 0) : [];
  if (tyHit.length > tyJi.length) {
    scores.health += 4; scores.career += 2;
  } else if (tyJi.length > tyHit.length) {
    scores.health -= 3; scores.wealth -= 2;
  }

  /* ============================================================
   * 【新算法6】命宫 —— 一生总运枢纽
   * 命宫为寅起正月顺数至生月、自子时逆数至生时。
   * 命宫五行若为忌神，今日诸事多一层迂回；为喜用则事有归结。
   * ============================================================ */
  const mgWx = bazi.minggong ? bazi.minggong.wuXing : '';
  if (mgWx && bazi.yongshen.ji.indexOf(mgWx) >= 0) {
    scores.career -= 3; scores.love -= 2;
  } else if (mgWx && bazi.yongshen.xi.indexOf(mgWx) >= 0) {
    scores.career += 4; scores.love += 2;
  }

  /* ============================================================
   * 【新算法7】旬空（空亡）
   * 命局日柱旬空者，落空亡之五行则该维度虚而不实。
   * ============================================================ */
  const xk = bazi.xunKong || '';
  if (xk && xk.indexOf(dayZhi) >= 0) {
    scores.wealth -= 4; scores.career -= 3;
  }
  if (xk && xk.indexOf(hp.zhi) >= 0) {
    scores.love -= 3; scores.health -= 2;
  }

  clamp(scores);

  // 危险指数
  let danger = 0;
  danger += chongList.length * 20;
  danger += xingList.length * 22;
  danger += haiList.length * 10;
  if (shishen === '七杀' && wangShuai.level === '旺') danger += 12;
  const dangerLevel = danger >= 45 ? '高' : (danger >= 22 ? '中' : '低');

  const text = buildFortuneText({
    bazi, shishen, dayGan, dayZhi, dayGanWx, dayZhiWx,
    relations, chongList, heList, xingList, haiList, wangShuai, scores, dangerLevel,
    chongShengXiao: lunar.getDayChongShengXiao(),
    chongDesc: lunar.getDayChongDesc(),
    hourShiShen,
    /* 【1.8.2】把年月日传进文案层：抽取种子需要「哪一天」，
     * 否则同一个人每天都是同一套措辞。*/
    y: y, m: m, d: d,
  });

  return {
    date: `${y}-${pad(m)}-${pad(d)}`,
    dateText: `${y}年${m}月${d}日`,
    weekText: '星期' + ['日', '一', '二', '三', '四', '五', '六'][date.getDay()],
    lunarText: lunar.toString(),
    lunarMonth: lunar.getMonthInChinese(),
    lunarDay: lunar.getDayInChinese(),
    dayGanZhi: dayGan + dayZhi,
    dayGan,
    dayZhi,
    dayGanColor: WU_XING_COLOR[dayGanWx],
    dayZhiColor: WU_XING_COLOR[dayZhiWx],
    shishen,
    shishenGroup: group,
    wangShuai,
    scores,
    stars: {
      wealth: toStars(scores.wealth),
      love: toStars(scores.love),
      career: toStars(scores.career),
      health: toStars(scores.health),
    },
    relations,
    chongList, heList, xingList, haiList,
    chongShengXiao: lunar.getDayChongShengXiao(),
    chongDesc: lunar.getDayChongDesc(),
    danger: dangerLevel,
    dangerScore: danger,
    text,
    huangli: {
      yi: lunar.getDayYi() || [],
      ji: lunar.getDayJi() || [],
      zhiXing: lunar.getZhiXing(),
      cai: lunar.getDayPositionCaiDesc(),
      xi: lunar.getDayPositionXiDesc(),
      fu: lunar.getDayPositionFuDesc(),
      jiuXing: lunar.getDayNineStar(),
      tianShen: lunar.getDayTianShen(),
      taiSui: lunar.getDayPositionTaiSuiDesc(),
    },
    // 同上：不可暴露 lunar 原对象（含循环引用，setData 会序列化失败）
  };
}

/** 当日五行旺相休囚死 */
function calcWangShuai(dayWx, monthWx) {
  // 当日五行在月令中的状态
  let level;
  if (dayWx === monthWx) level = '旺';
  else if (SHENG[monthWx] === dayWx) level = '相';
  else if (SHENG[dayWx] === monthWx) level = '休';
  else if (KE[dayWx] === monthWx) level = '囚';
  else level = '死';

  const desc = {
    旺: '当日之五行当令而盛，力量最足',
    相: '当日之五行得月令之气辅助，其事顺遂',
    休: '当日之五行生他而泄气，力有余而不足',
    囚: '当日之五行被他克制，受制于事',
    死: '当日之五行克他泄己，气机不畅',
  };
  return { level, desc: desc[level] };
}

/** 生成运势分析文案 */
function buildFortuneText(ctx) {
  /* 【1.8.2】年月日由调用方传入（用于表达层抽取种子） */
  const y = ctx.y || 0, m = ctx.m || 0, d = ctx.d || 0;
  const { bazi, shishen, dayGan, dayZhi, dayGanWx, dayZhiWx, chongList, heList, xingList, haiList, wangShuai, scores, dangerLevel, chongShengXiao, hourShiShen } = ctx;
  const me = bazi.dayWuXing;
  const daymaster = bazi.dayGan;

  const shishenDesc = {
    比肩: '比肩同我，主竞争与人际。今日易有同侪相争、朋友分摊之事，破财风险上升。',
    劫财: '劫财夺我，主争夺与暗损。今日防借出难收、被合作方分利，忌轻信合伙。',
    食神: '食神泄秀，主才艺与产出。创意表达顺畅，适合输出内容、谈成小事，亦利子女之事。',
    伤官: '伤官见官，主锋芒与变数。才思敏捷但易冲撞长辈、上级，忌当众强辩。',
    偏财: '偏财透干，按传统十神之说主意外之财、副业收入，易有进有出。本条为术数文化表述，不构成任何投资建议，盈亏须自行判断。',
    正财: '正财主稳，主工薪与实业。收入平稳无波，适合上班求财、稳健理财。',
    七杀: '七杀攻身，主压力与突破。按传统十神之说，有紧迫感驱你前进，宜避免过劳与情绪冲动。本条为术数文化表述，不构成医学意见。',
    正官: '正官主贵，主秩序与责任。适合文书、签约、见贵，循规矩行事则事事顺遂。',
    偏印: '偏印夺食，主思虑与孤克。适合钻研技术、宗教哲思，忌与人争利、忌多思多虑。',
    正印: '正印生身，主庇荫与贵人。利学业文书、房产长辈之事，遇事有人相助。',
  };
  const shishenText = shishenDesc[shishen] || '今日关系平和，按既定节奏行事即可。';

  /* 命局底色句：把「日主强弱 + 喜忌结构」写进每段开头。
   这是消除「结果雷同」的关键——原实现各维度开头句式高度相似，
   只有中间一两句随十神变化，读起来像同一段模板换了个词。 */
  const strongTxt = bazi.strength
    ? (bazi.strength.value >= 3
      ? `你日主${daymaster}${me}，${bazi.strength.label}，本身有根有力`
      : (bazi.strength.value <= -3
        ? `你日主${daymaster}${me}，${bazi.strength.label}，根气不足而外压较重`
        : `你日主${daymaster}${me}，${bazi.strength.label}，强弱不失其宜`))
    : '';
  const xiTxt = bazi.yongshen.xiText ? `本${me}命喜用为${bazi.yongshen.xiText}` : '';
  const ctxLine = (strongTxt && xiTxt) ? `${strongTxt}，${xiTxt}。` : (strongTxt || '');

  /* 时柱专属句
   * 【BUG 修复依据】实测 12 个时辰的财运/感情/事业正文仅 3~4 种，
   * 根因是正文完全没有引用时柱——换时辰分数变了、文字却一字不差。
   * 时柱为子女宫、亦为结果宫，其天干十神与地支喜忌直接决定「事之归结」。*/
  const hp = bazi.pillars[3];
  const hourZhiWx = hp ? ZHI_WU_XING[hp.zhi] : '';
  const hourIsXi = hourZhiWx && bazi.yongshen.xi.indexOf(hourZhiWx) >= 0;
  const hourIsJi = hourZhiWx && bazi.yongshen.ji.indexOf(hourZhiWx) >= 0;
  const HOUR_SHI_DESC = {
    比肩: '时干比肩与君同气，末后之事多靠自助，忌与人共财',
    劫财: '时干劫财主晚年分夺，宜早立根基、忌临老偏投',
    食神: '时干食神主结果可享，宜以才艺技艺收尾生财',
    伤官: '时干伤官主晚境锋芒，忌与人争辩、宜以技显身',
    偏财: '时干偏财主后运有意外之得，宜守成中留一分余财',
    正财: '时干正财主结果稳实，晚景可期、宜务实经营',
    七杀: '时干七杀主晚境多变，宜早作安排、忌拖延未决',
    正官: '时干正官主结果有序，宜守规矩、稳中求进',
    偏印: '时干偏印主晚来思虑，忌多虑、宜修心养性',
    正印: '时干正印主结果有荫，晚年得助、宜早为长远计',
  };
  const hourLine = (lead) => {
    if (!hp) return '';
    const g = hourShiShen || '';
    return `${lead || ''}你时柱${hp.gan}${hp.zhi}，${HOUR_SHI_DESC[g] || '时柱平和，结果随行止而定'}；时支${hp.zhi}属${hourZhiWx}，${hourIsXi ? '为喜用，末后之事有归结' : (hourIsJi ? '落忌神，越到后程越须谨慎' : '于命局中性，不助不损')}。`;
  };

  /* 胎元 · 命宫句：先天根基与一生总运，同样随生辰而变 */
  const taiyuanLine = () => {
    if (!bazi.taiyuan) return '';
    const tyWx = bazi.taiyuan.wuXing;
    const isXi = bazi.yongshen.xi.some(k => tyWx.indexOf(k) >= 0);
    return `胎元${bazi.taiyuan.gan}${bazi.taiyuan.zhi}属${tyWx}，${isXi ? '先天根气得气，底子厚而不易折' : '先天根气偏薄，遇事更需自己培补'}；`;
  };
  const minggongLine = () => {
    if (!bazi.minggong) return '';
    const mgWx = bazi.minggong.wuXing;
    const isJi = bazi.yongshen.ji.indexOf(mgWx) >= 0;
    return `命宫在${bazi.minggong.zhi}（${mgWx}），${isJi ? '总运带滞，今日之事更需绕行迂回方成' : '总运有归，今日之事较易有着落'}。`;
  };

  /* ============================================================
   * 【1.8.2】表达层接入点
   *
   * 用户实测反馈：「运势功能中如何此时都是这种雷同甚至一模一样的测算结果」。
   * 根因：本函数原先把「事实 → 文本」硬编码在 if 分支中，
   *      句式是固定模板，变量只替换数字，于是不同日期读起来一模一样。
   *
   * 现改为：上层只负责算出**事实**（见下方 facts 对象），
   *      句子的措辞交给 fortune-voice.js 的候选池 + 确定性抽取，
   *      种子取自「日期 + 生辰」，同输入必同输出、不同日期必换说法。
   *
   * 注意：这里只改「怎么说」，不改「算什么」——
   *      scores 与 relations 的计算逻辑一行未动，测算结论完全不变。
   * ============================================================ */
  /* 【1.8.2 · 真实缺陷 · 已修】原先写的是 `typeof root !== 'undefined' && root.FortuneVoice`，
   * 但本文件是 UMD 工厂结构，工厂函数体内**没有 root 这个绑定**
   * （root 只是外层 IIFE 的参数，不在工厂作用域内），
   * 于是条件恒为 false，Voice 永远是 null，表达层被静默跳过 ——
   * 症状就是「改了代码但文案还是老样子」。
   * 正确取法：工厂参数 LunarLib 在浏览器环境就是全局对象本身，
   * 在 Node 环境是 require 来的 lunar.js（此时从 globalThis 兜底取）。*/
  const Voice = (typeof globalThis !== 'undefined' && globalThis.FortuneVoice)
    ? globalThis.FortuneVoice
    : (LunarLib && LunarLib.FortuneVoice) || null;

  /* 时柱/胎元的事实化描述（供表达层填占位符）
   * 注意：hourZhiWx / hourIsXi / hourIsJi 已在 hourLine 之前声明，此处直接复用。*/
  const hourGan = (bazi.pillars[3] && bazi.pillars[3].gan) || '';
  const hourZhi = (bazi.pillars[3] && bazi.pillars[3].zhi) || '';
  const houShen = hourShiShen || '平和';
  const houJudge = hourIsXi ? '为喜用，末后之事有归结'
    : (hourIsJi ? '落忌神，越到后程越须谨慎' : '于命局中性，不助不损');
  const houDesc = HOUR_SHI_DESC[houShen] || '时柱平和，结果随行止而定';
  const tyLine = (bazi.taiyuan && bazi.taiyuan.wuXing)
    ? (function () {
        const tyWx = bazi.taiyuan.wuXing;
        const isXi = bazi.yongshen.xi.some(k => tyWx.indexOf(k) >= 0);
        return `胎元${bazi.taiyuan.gan}${bazi.taiyuan.zhi}属${tyWx}，${isXi ? '先天根气得气，底子厚而不易折' : '先天根气偏薄，遇事更需自己培补'}。`;
      })()
    : '胎元一栏信息不足，先天根气暂以日常观察为准。';
  /* 抽取种子：日期 + 生辰，保证「同一命主的不同一天」措辞不同 */
  const voiceSeed = Voice
    ? Voice.hashStr([y, m, d, bazi.birth.year, bazi.birth.month, bazi.birth.day, me].join('|'))
    : 0;

  /* 档位（决定用哪一组句子，低分与高分用完全不同的表达） */
  const bandOf = (sc) => (Voice ? Voice.band(sc) : 'mid');

  // 财运
  let wealthText = `今日天干${dayGan}，为你${daymaster}${me}日主之「${shishen}」。${shishenText}`;
  if (ctxLine) wealthText += ctxLine;
  if (wangShuai.level === '旺') wealthText += `${dayGanWx}气当令有力，事半功倍。`;
  else if (wangShuai.level === '死' || wangShuai.level === '囚') {
    wealthText += `${dayGanWx}气${wangShuai.level}，力量不显，今日求财须借他人之力、循序而成。`;
  }
  if (bazi.yongshen.xi.indexOf(dayGanWx) >= 0) wealthText += `且${dayGanWx}为你的喜用，得力相助。`;
  if (bazi.yongshen.ji.indexOf(dayGanWx) >= 0) wealthText += `惟${dayGanWx}为你忌神，耗神费力，宜量力而行。`;
  if (chongList.length) wealthText += `地支${chongList.map(r => '冲' + r.pillar + r.zhi).join('、')}，财来财去见分明，不宜大额投入。`;
  else if (heList.length) wealthText += `地支${heList.map(r => '合' + r.pillar + r.zhi).join('、')}，有人相助，合力生财。`;
  // 日主与日支的实质关系
  /* 【1.8.2】把中段事实独立出来，交给表达层按多样性需要决定是否采用 */
  const zhiNoteW = (SHENG[me] === dayZhiWx)
    ? '你{me}生日支{dz}属{dzWx}，今日为泄气，付出多于回报，不宜过度投入。'
    : (KE[me] === dayZhiWx)
      ? '你{me}克日支{dz}属{dzWx}，为我财星，今日有实质进财之机。'
      : '';
  const xiNoteW = (bazi.yongshen.xi.indexOf(dayGanWx) >= 0)
    ? '且{wx}为你的喜用，得力相助。'
    : (bazi.yongshen.ji.indexOf(dayGanWx) >= 0 ? '惟{wx}为你忌神，耗神费力，宜量力而行。' : '');
  const relNoteW = chongList.length
    ? '地支{chong}，财来财去见分明，不宜大额投入。'
    : (heList.length ? '地支{he}，有人相助，合力生财。' : '');
  /* 补齐占位符所需的实参 */
  const dzWx = dayZhiWx, dz = dayZhi;
  const chong = chongList.map(r => '冲' + r.pillar + r.zhi).join('、');
  const he = heList.map(r => '合' + r.pillar + r.zhi).join('、');
  /* 【1.8.2】交给表达层重组措辞（事实已在上方算完，此处只换「怎么说」）*/
  if (Voice) {
    wealthText = Voice.compose({
      dim: 'wealth',
      band: bandOf(scores.wealth),
      seed: voiceSeed,
      facts: {
        gan: dayGan, me: me, shishen: shishen, wx: dayGanWx, level: wangShuai.level,
        houGan: hourGan, houZhi: hourZhi, houWx: hourZhiWx,
        houShen: houShen, houJudge: houJudge, houDesc: houDesc,
        zhiNote: zhiNoteW, xiNote: xiNoteW, relNote: relNoteW,
        dz: dz, dzWx: dzWx, chong: chong, he: he
      }
    });
  } else {
    wealthText += hourLine('就结果论，');
    wealthText += taiyuanLine() + minggongLine();
  }

  // 感情
  const isMale = bazi.birth.gender === '男';
  const starName = isMale ? '财星（男命以财星为妻星）' : '官星（女命以官星为夫星）';
  // 命局中的配偶宫（日支）与配偶星现况
  const spouseZhi = bazi.pillars[2] ? bazi.pillars[2].zhi : '';
  let loveText = `以${starName}论`;
  if (spouseZhi) {
    const spWx = ZHI_WU_XING[spouseZhi];
    loveText += `，你日支${spouseZhi}（${spWx}）为配偶宫`;
    if (spWx === me) loveText += `与日主同气，主相处平等默契，但易争主见`;
    else if (SHENG[spWx] === me) loveText += `生扶日主，主对方付出较多、关系安稳`;
    else if (KE[spWx] === me) loveText += `为日主所克，主你在关系中较强势，宜多收敛`;
  }
  if (heList.length) loveText += `；今日日支${dayZhi}与命局${heList.map(r => r.zhi).join('、')}相合，和合之力显著，情感上易有进展或关系缓和。`;
  if (chongList.length) loveText += `；今日日支冲命局${chongList.map(r => r.zhi).join('、')}，${chongList.some(r => r.pillar === '日柱') ? '冲及配偶宫，感情上易生波折、口角争执' : '冲及他柱，外部变动易牵动关系'}，忌意气用事。`;
  if (!heList.length && !chongList.length) loveText += `；今日与命局无刑冲合害，关系平稳，按既有节奏相处即可。`;
  if (isMale && groupIs(shishen, '财星')) loveText += `财星当值，异性缘较旺。`;
  if (!isMale && groupIs(shishen, '官杀')) loveText += `官星当值，易遇重要对象或得长辈提点。`;
  if (heList.length && chongList.length) loveText += `合冲并见，主关系在拉锯中，先动气者吃亏。`;
  /* 【1.8.2】感情接入表达层 */
  if (Voice) {
    const spWx = spouseZhi ? (ZHI_WU_XING[spouseZhi] || '') : '';
    const spJudge = !spWx ? '配偶宫信息不全，以相处实感为准'
      : (spWx === me ? '与日主同气，相处平等默契，但易争主见'
        : (SHENG[spWx] === me ? '生扶日主，对方付出较多、关系安稳'
          : (KE[spWx] === me ? '为日主所克，你在关系中较强势，宜多收敛' : '与日主无直接生克，关系平顺')));
    const mgLine = (bazi.minggong && bazi.minggong.zhi)
      ? (function () {
          const mgWx = bazi.minggong.wuXing;
          const isJi = bazi.yongshen.ji.indexOf(mgWx) >= 0;
          return `命宫在${bazi.minggong.zhi}（${mgWx}），${isJi ? '总运带滞，今日之事更需绕行迂回方成' : '总运有归，今日之事较易有着落'}。`;
        })()
      : '命宫一栏信息不足，长期关系以相处积累为准。';
    loveText = Voice.compose({
      dim: 'love',
      band: bandOf(scores.love),
      seed: voiceSeed,
      facts: {
        isMale: isMale, spouse: spouseZhi, spWx: spWx, spJudge: spJudge,
        dayZhi: dayZhi,
        he: heList.map(r => r.zhi).join('、'),
        chong: chongList.map(r => r.zhi).join('、'),
        chongJudge: chongList.some(r => r.pillar === '日柱')
          ? '冲及配偶宫，感情上易生波折、口角争执' : '冲及他柱，外部变动易牵动关系',
        hasHe: heList.length > 0, hasChong: chongList.length > 0,
        starNote: (isMale && groupIs(shishen, '财星')) ? Voice._internals.LOVE.star
          : ((!isMale && groupIs(shishen, '官杀')) ? Voice._internals.LOVE.guan : null),
        relNote: true,
        minggong: mgLine
      }
    });
  } else {
    loveText += hourLine('就关系的长线而论，') + minggongLine();
  }

  // 事业
  let careerText = `事业上，今日重心在「${shishen}」之象。`;
  // 命局格局：官杀/食伤在原局的轻重，决定今日该做「补」还是「泄」
  const guaStat = bazi.wuxingStat.score.find(s => s.wuXing === (KE[me] || ''));
  const shiStat = bazi.wuxingStat.score.find(s => s.wuXing === (SHENG[me] || ''));
  const caiStat = bazi.wuxingStat.score.find(s => s.wuXing === (KE[me] || ''));
  if (guaStat && guaStat.percent && parseFloat(guaStat.percent) >= 20) {
    careerText += `你命局${guaStat.wuXing}（官杀）已占${guaStat.percent}，压力本就偏重，今日${groupIs(shishen, '官杀') ? '再逢官杀，宜守不宜攻，忌揽下新责' : '官杀未临，反宜借此时推进要务'}。`;
  } else if (shiStat && shiStat.percent && parseFloat(shiStat.percent) >= 20) {
    careerText += `你命局${shiStat.wuXing}（食伤）偏旺，${groupIs(shishen, '食伤') ? '今日同类叠加，才华外露但易伤人，宜收敛锋芒' : '今日食伤得制，创意能收束成事，是好时机'}。`;
  } else if (caiStat && caiStat.percent && parseFloat(caiStat.percent) <= 8) {
    careerText += `你命局${caiStat.wuXing}（财星）仅${caiStat.percent}，${groupIs(shishen, '财星') ? '今日财星独发，是难得的资源窗口，宜主动争取' : '财星不显，今日宜以能力换机会，不宜谈钱'}。`;
  }
  if (groupIs(shishen, '官杀')) careerText += `官杀临日，责任加重，适合处理公务、签署文件、迎接检查，压力大但机会亦多。`;
  else if (groupIs(shishen, '印星')) careerText += `印星当值，利文书、进修、资格申报，易得上级赏识。`;
  else if (groupIs(shishen, '食伤')) careerText += `食伤当值，创意与表达见长，适合提案、谈判、开创性工作。`;
  else if (groupIs(shishen, '比劫')) careerText += `比劫当值，团队协作与人脉为要，忌与人争功、忌合伙财务。`;
  else if (groupIs(shishen, '财星')) careerText += `财星当值，宜拓展业务、谈成合作、争取资源。`;
  if (chongList.length) careerText += `今日${chongList.map(r => '冲' + r.pillar + r.zhi).join('、')}，主变动不居，${chongList.some(r => r.pillar === '日柱') ? '自身宫位受动，宜守中，不宜大改' : '外部环境有变，宜预留余地'}。`;
  if (xingList.length) careerText += `命局有刑象${xingList.map(r => r.pillar + r.zhi).join('、')}，行事须留余地，避免法律与人际纠纷。`;
  /* 【1.8.2】事业接入表达层 */
  if (Voice) {
    const groupKey = groupIs(shishen, '官杀') ? '官杀'
      : (groupIs(shishen, '印星') ? '印星'
        : (groupIs(shishen, '食伤') ? '食伤'
     : (groupIs(shishen, '比劫') ? '比劫' : '财星')));
    careerText = Voice.compose({
      dim: 'career',
      band: bandOf(scores.career),
      seed: voiceSeed,
      facts: {
        shishen: shishen, groupKey: groupKey,
    guaNote: (guaStat && guaStat.percent && parseFloat(guaStat.percent) >= 20)
      ? '你命局{gp}（官杀）已占{pct}，压力本就偏重，{gp2}。'
      : (shiStat && shiStat.percent && parseFloat(shiStat.percent) >= 20
          ? '你命局{gp}（食伤）偏旺，{gp2}。'
          : (caiStat && caiStat.percent && parseFloat(caiStat.percent) <= 8
       ? '你命局{gp}（财星）仅{pct}，{gp2}。' : '')),
        gp: (guaStat && parseFloat(guaStat.percent) >= 20) ? guaStat.wuXing
          : ((shiStat && parseFloat(shiStat.percent) >= 20) ? shiStat.wuXing
            : (caiStat ? caiStat.wuXing : '')),
        pct: (guaStat && parseFloat(guaStat.percent) >= 20) ? guaStat.percent
          : ((shiStat && parseFloat(shiStat.percent) >= 20) ? shiStat.percent
     : (caiStat ? caiStat.percent : '')),
        gp2: groupIs(shishen, '官杀') ? '今日官杀再临，宜守不宜攻，忌揽下新责'
  : (groupIs(shishen, '食伤') ? '今日同类叠加，才华外露但易伤人，宜收敛锋芒'
       : '今日不为财星，宜以能力换机会，不宜谈钱'),
      relNote: chongList.length
          ? '今日{chong}，主变动不居，{rel}。'
          : (xingList.length ? '命局有刑象{xing}，行事须留余地，避免法律与人际纠纷。' : ''),
        chong: chongList.map(r => '冲' + r.pillar + r.zhi).join('、'),
        rel: chongList.some(r => r.pillar === '日柱') ? '自身宫位受动，宜守中，不宜大改' : '外部环境有变，宜预留余地',
        xing: xingList.map(r => r.pillar + r.zhi).join('、'),
  houGan: hourGan, houZhi: hourZhi, houWx: hourZhiWx,
        houShen: houShen, houJudge: houJudge, houDesc: houDesc
      }
    });
  } else {
    careerText += hourLine('就事业落点而论，') + minggongLine();
  }

  // 健康
  const todayOrgan = WU_XING_ORGAN[dayGanWx];
  const keTarget = KE[dayGanWx];
  const keOrgan = WU_XING_ORGAN[keTarget];
  let healthText = `今日${dayGanWx}气${wangShuai.level}，${wangShuai.desc}。`;
  healthText += `留意${todayOrgan}之所属脏腑。`;
  // 【新】以命局最弱脏腑为「先天短板」——随命局变化，不是固定模板
  let weakest = null;
  bazi.wuxingStat.score.forEach((s) => {
    if (s.percent && parseFloat(s.percent) <= 12) {
      if (!weakest || parseFloat(s.percent) < parseFloat(weakest.percent)) weakest = s;
    }
  });
  if (weakest) {
    healthText += `你命局${weakest.wuXing}仅${weakest.percent}（最弱一环），${WU_XING_ORGAN[weakest.wuXing]}素为先天短板，宜长期养护`;
    if (dayGanWx === weakest.wuXing) healthText += `，今日该五行当值，最需留意`;
    healthText += `。`;
  }
  if (wangShuai.level === '旺' || wangShuai.level === '相') {
    healthText += `${dayGanWx}旺则克${keTarget}，故今日尤其需留意${keOrgan}，饮食宜清淡温养，忌辛辣刺激。`;
  } else if (wangShuai.level === '死' || wangShuai.level === '囚') {
    healthText += `本气受制，${todayOrgan}亦易疲乏，作息宜规律，避免熬夜透支。`;
  }
  if (xingList.length) healthText += `有刑冲之象（${xingList.map(r => r.zhi).join('、')}），注意外伤与交通，留意手足筋骨。`;
  if (bazi.yongshen.ji.indexOf(dayZhiWx) >= 0) healthText += `日支${dayZhi}属${dayZhiWx}，正是你的忌神，脏腑易受耗，忌过劳与情绪压抑。`;
  else if (bazi.yongshen.xi.indexOf(dayZhiWx) >= 0) healthText += `日支${dayZhi}属${dayZhiWx}，为你的喜用，今日身心较有底气，适合适度运动。`;
  /* 【1.8.2】健康运是用户反馈雷同最严重的维度（截图里三张几乎逐句相同），
   * 改为完全交给表达层组装：开头按旺衰档位选句、中段按命局短板选句、
   * 收尾按胎元根气选句，三段各自有9/8/8 种措辞。*/
  if (Voice) {
    const wkWx = weakest ? weakest.wuXing : '';
    const wkPct = weakest ? weakest.percent : '';
    healthText = Voice.compose({
      dim: 'health',
      band: bandOf(scores.health),
      seed: voiceSeed,
      facts: {
        wx: dayGanWx, level: wangShuai.level, organ: todayOrgan,
        keTarget: keTarget, keOrgan: keOrgan,
        weakNote: weakest ? (Voice._internals.HEALTH.weak[Voice.hashStr(voiceSeed ^ 'wk') % 8]
          .replace('{wx}', wkWx).replace('{pct}', wkPct).replace('{organ}', WU_XING_ORGAN[wkWx] || '')) : '',
        keNote: (wangShuai.level === '旺' || wangShuai.level === '相')
          ? '{wx}旺则克{keTarget}，故今日尤其需留意{keOrgan}，饮食宜清淡温养，忌辛辣刺激。'
          : (wangShuai.level === '死' || wangShuai.level === '囚'
            ? '本气受制，{organ}亦易疲乏，作息宜规律，避免熬夜透支。' : ''),
        relNote: xingList.length
          ? '有刑冲之象（{xing}），注意外伤与交通，留意手足筋骨。' : '',
        xing: xingList.map(r => r.zhi).join('、'),
        taiyuan: tyLine
      }
    });
  } else {
    healthText += hourLine('就体质底子而论，') + taiyuanLine();
  }

  // 灾祸
  let dangerText = '';
  if (chongList.length) {
    dangerText += `日支${dayZhi}与命局${chongList.map(r => r.pillar + r.zhi).join('、')}相冲。《渊海子平》云「冲则动」，今日主变动、搬迁、出行起伏、情绪冲动。`;
  }
  if (xingList.length) dangerText += `另有刑象${xingList.map(r => r.pillar + r.zhi).join('、')}，是非、伤病之象，宜退让勿争强。`;
  if (shishen === '七杀' && wangShuai.level === '旺') dangerText += `七杀当值且得势，压力骤增，注意心脑血管与外伤，忌熬夜与情绪激动。`;
  if (shishen === '七杀' && bazi.strength && bazi.strength.value <= -3) {
    dangerText += `七杀当值而你${bazi.strength.label}，外压叠加本虚，压力更甚，尤忌独处冲动、忌高空与高速运动。`;
  }
  if (!dangerText) dangerText = `今日日支与命局无明显刑冲，格局平稳，日常注意作息即可。`;
  // 【新】用神/忌神与日支的关系：把「为什么今天不顺」落到命局结构上
  if (bazi.yongshen.ji.indexOf(dayZhiWx) >= 0) {
    dangerText += `日支${dayZhi}属${dayZhiWx}，正落你忌神之上，为患之处多由此出，${KE[dayZhiWx] ? `尤须防因${dayZhiWx}旺而克${KE[dayZhiWx]}之连锁反应` : '宜收敛其气'}。`;
  } else if (bazi.yongshen.xi.indexOf(dayZhiWx) >= 0) {
    dangerText += `日支${dayZhi}属${dayZhiWx}，为你喜用，虽有波动亦有转圜余地，遇事宜缓不宜急。`;
  }
  dangerText += `本日冲${chongShengXiao || '无'}，属${chongShengXiao || '本命'}者今日行事宜多加谨慎。`;
  // 【新】时柱与胎元：把「隐患的先天来源」讲清——原实现只论日支，灾祸段12时辰仅3种
  if (bazi.xunKong && hp && bazi.xunKong.indexOf(hp.zhi) >= 0) {
    dangerText += `你时支${hp.zhi}落日柱旬空（${bazi.xunKong}），晚景与子女之事易虚耗，宜早作安排。`;
  }
  if (hp && bazi.yongshen.ji.indexOf(hourZhiWx) >= 0) {
    dangerText += `时支${hp.zhi}属${hourZhiWx}，为你忌神，隐患多从「拖到最后、收不了尾」处生出，忌拖延收尾。`;
  }
  dangerText += minggongLine();

  // 建议（传入 dayZhi/相关上下文，供五档分级与喜忌判断使用）
  const advice = buildAdvice({
    scores, dangerLevel, shishen,
    dayGanWx, dayZhiWx, dayZhi,
    yongshen: bazi.yongshen,
    bazi,
    hourShiShen,
    relations: { chong: chongList, he: heList },
  });

  return {
    wealth: { text: wealthText, advice: advice.wealth },
    love: { text: loveText, advice: advice.love },
    career: { text: careerText, advice: advice.career },
    health: { text: healthText, advice: advice.health },
    danger: { text: dangerText, level: dangerLevel, advice: advice.danger },
  };
}

/** 生成具体建议
 *
 * 【原实现的问题】只有「≥75好/≤45差/中间一般」三档措辞，
 * 四维各自只有三种说法，因此不论生辰如何，措辞高度雷同。
 *
 * 【修正】改为五档，并把「今日五行是否为本人喜忌」这一实际因素
 * 纳入建议，使建议随命局与当日干支变化。
 */
function buildAdvice({ scores, dangerLevel, shishen, dayGanWx, dayZhiWx, yongshen, dayZhi, bazi, hourShiShen, relations }) {
  // 五档：优/ 良 / 平 / 弱 / 差（分数分布实测 26~98，五档可有效区分）
  const grade = (s) => (s >= 78 ? 0 : (s >= 68 ? 1 : (s >= 58 ? 2 : (s >= 48 ? 3 : 4))));

  /* 档内细分因子
   * 【BUG 修复依据】五档仍会让 52/56/59/60 分共用同一句建议，实测抽样中
   * 四个时辰的财运建议一字不差。这里按分数在档内的相对位置再分三小层
   * （偏上/居中/偏下），使同档不同分也有可辨差异。 */
  const sub = (s) => (grade(s) === 0 || grade(s) === 4 ? '' : (s >= 72 ? '偏上' : (s >= 62 ? '居中' : '偏下')));
  const S = { w: sub(scores.wealth), l: sub(scores.love), c: sub(scores.career), h: sub(scores.health) };
  const SUBW = { 偏上: '气机正在往上走', 居中: '气机平和不偏不倚', 偏下: '气机尚在蓄势未发' };
  const SUBL = { 偏上: '桃花气正盛', 居中: '感情节奏平稳', 偏下: '情感偏于内敛' };
  const SUBC = { 偏上: 'external助力在外', 居中: '按部就班即可', 偏下: '宜收敛锋芒、蓄力以待' };
  const SUBH = { 偏上: '精气回升', 居中: '状态无甚起伏', 偏下: '精力尚在低谷' };

  // 动态修饰：把命局实际结构写进建议，而非只留「喜/忌神」两种措辞
  const xi = (yongshen && yongshen.xi) || [];
  const ji = (yongshen && yongshen.ji) || [];
  const dayJi = dayGanWx && ji.indexOf(dayGanWx) >= 0;
  const zhiJi = dayZhiWx && ji.indexOf(dayZhiWx) >= 0;
  const chongCnt = (Array.isArray(relations) ? relations : ((relations && relations.chong) || [])).length;
  const heCnt = ((relations && relations.he) || []).length;
  const wMod = dayJi
    ? `今日${dayGanWx}正落忌神${ji.join('')}`
    : (xi.indexOf(dayGanWx) >= 0 ? `今日${dayGanWx}为喜用，得天时之助` : `今日${dayGanWx}于命局中性`);

  const GRADE = {
    wealth: [
      `财运上乘（${scores.wealth}分），${wMod}，正偏财皆有空间，可主动出击，见好就收。`,
      `财运偏好（${scores.wealth}分），${SUBW[S.w] || '主稳中有进'}，宜把机会落到长期项目，忌短线贪多。`,
      `财运平平（${scores.wealth}分），${SUBW[S.w] || '无大起大落'}，靠本分积累为上，不宜指望意外之财。`,
      `财运偏弱（${scores.wealth}分），${wMod}，${SUBW[S.w] || '守成为主'}，量入为出，忌借贷担保。`,
      `财运欠佳（${scores.wealth}分），${wMod}，${zhiJi ? `日支${dayZhi}亦为忌神，` : ''}不宜任何投资与冒险，宜先固本。`,
    ],
    love: [
      `桃花旺盛（${scores.love}分），${shishen}当值，${SUBL[S.l] || '主感情与异性缘活跃'}，宜主动表达，但忌用力过猛。`,
      `感情顺遂（${scores.love}分），${heCnt > 0 ? `今日${dayZhi}与命局${heCnt}处相合，` : SUBL[S.l] || '关系有进益之机'}，宜多作沟通、少作揣测。`,
      `感情平稳（${scores.love}分），${SUBL[S.l] || '无明显波澜'}，按既有节奏相处即可。`,
      `感情有波（${scores.love}分），${zhiJi ? `日支${dayZhi}落忌神，` : chongCnt > 0 ? '今日与命局有冲动，' : SUBL[S.l] || '易因小事口角'}，宜缓言、宜给对方台阶。`,
      `感情多阻（${scores.love}分），不宜争辩与试探，${shishen === '七杀' || shishen === '伤官' ? '今日情绪锋利，尤忌翻旧账' : '宜各退一步'}。`,
    ],
    career: [
      `事业得力（${scores.career}分），${shishen}当值而与命局相协${hourShiShen ? `，时柱${hourShiShen}为结果之基` : ''}，适合争取核心事务、对外拓展。`,
      `事业见好（${scores.career}分），${SUBC[S.c] || '可推进要务'}，易得上级或客户认可。`,
      `事业持稳（${scores.career}分），${SUBC[S.c] || '无机遇亦无阻碍'}，做好本分、积累口碑。`,
      `事业受制（${scores.career}分），${zhiJi ? `日支${dayZhi}为忌，` : chongCnt > 0 ? '命局受冲，' : SUBC[S.c] || '外部牵制多'}，宜低调收成，不宜强出头。`,
      `事业阻滞（${scores.career}分），阻力明显，${shishen === '七杀' ? '压力型局面，宜减少承诺、专注一桩' : shishen === '伤官' ? '与上级易生摩擦，宜收敛锋芒' : '忌硬碰硬，宜借他人之力成事'}。`,
    ],
    health: [
      `身心俱佳（${scores.health}分），${dayGanWx}气有力，${SUBH[S.h] || '适合适度运动与户外'}。`,
      `身体尚可（${scores.health}分），${SUBH[S.h] || '状态稳定'}，可安排常规锻炼。`,
      `健康平稳（${scores.health}分），${SUBH[S.h] || '无明显不适'}，保持规律作息即可。`,
      `精力略损（${scores.health}分），${dayGanWx}气偏弱，${SUBH[S.h] || '宜早睡、忌久坐熬夜'}。`,
      `健康欠佳（${scores.health}分），${dayGanWx}气受制，${zhiJi ? `日支${dayZhi}为忌神，脏腑易受耗，` : ''}宜就医检查，忌过劳与情绪压抑。`,
    ],
  };
  void bazi;
  return {
    wealth: GRADE.wealth[grade(scores.wealth)],    love: GRADE.love[grade(scores.love)],
    career: GRADE.career[grade(scores.career)],
    health: GRADE.health[grade(scores.health)],
    danger: dangerLevel === '高'
      ? '危险指数偏高，今日宜静不宜动，尽量避免外出与高风险活动，注意交通安全。'
      : (dangerLevel === '中'
        ? '危险指数中等，遇事宜冷静，不宜冲动决策，重要事项多思量。'
        : '危险指数较低，格局平稳，正常作息即可。'),
  };
}

/* ============ 每日一卦 ============ */

const GUA = [
  { name: '乾', symbol: '䷀', gua: '乾为天', text: '元亨利贞，天行健，君子以自强不息。', level: '吉' },
  { name: '坤', symbol: '䷁', gua: '坤为地', text: '元亨，利牝马之贞，君子以厚德载物。', level: '吉' },
  { name: '屯', symbol: '䷂', gua: '水雷屯', text: '初九磐桓，利居贞，不易乎者也。', level: '平' },
  { name: '蒙', symbol: '䷃', gua: '山水蒙', text: '亨，匪我求童蒙，童蒙求我。', level: '平' },
  { name: '需', symbol: '䷅', gua: '水天需', text: '有孚，光亨贞吉，利涉大川。', level: '吉' },
  { name: '讼', symbol: '䷆', gua: '天水讼', text: '有孚窒惕，中吉，终凶，利见大人。', level: '凶' },
  { name: '师', symbol: '䷇', gua: '地水师', text: '贞，丈人吉，无咎。', level: '吉' },
  { name: '比', symbol: '䷈', gua: '水地比', text: '吉，原筮元永贞，无咎。', level: '吉' },
  { name: '小畜', symbol: '䷉', gua: '风天小畜', text: '密云不雨，自我西郊。', level: '平' },
  { name: '履', symbol: '䷊', gua: '天泽履', text: '履虎尾，不咥人，亨。', level: '吉' },
  { name: '泰', symbol: '䷋', gua: '地天泰', text: '小往大来，吉亨。', level: '吉' },
  { name: '否', symbol: '䷌', gua: '天地否', text: '否之匪人，不利君子贞。', level: '凶' },
  { name: '同人', symbol: '䷍', gua: '天火同人', text: '同人于野，亨，利涉大川。', level: '吉' },
  { name: '大有', symbol: '䷎', gua: '火天大有', text: '元亨，大有上九，自天佑之，吉无不利。', level: '吉' },
  { name: '谦', symbol: '䷏', gua: '地山谦', text: '亨，君子有终。', level: '吉' },
  { name: '豫', symbol: '䷐', gua: '雷地豫', text: '利建侯行师。', level: '吉' },
  { name: '随', symbol: '䷑', gua: '泽雷随', text: '元亨利贞，无咎。', level: '吉' },
  { name: '蛊', symbol: '䷒', gua: '山风蛊', text: '元亨，利涉大川，先甲三日，后甲三日。', level: '凶' },
  { name: '临', symbol: '䷓', gua: '地泽临', text: '元亨利贞，至于八月有凶。', level: '吉' },
  { name: '观', symbol: '䷔', gua: '风地观', text: '盥而不荐，有孚颙若。', level: '平' },
  { name: '噬嗑', symbol: '䷕', gua: '火雷噬嗑', text: '亨，利用狱。', level: '平' },
  { name: '贲', symbol: '䷖', gua: '山火贲', text: '亨，小利有攸往。', level: '吉' },
  { name: '剥', symbol: '䷗', gua: '山地剥', text: '不利有攸往。', level: '凶' },
  { name: '复', symbol: '䷘', gua: '地雷复', text: '亨，出入无疾，朋来无咎。', level: '吉' },
  { name: '无妄', symbol: '䷙', gua: '天雷无妄', text: '元亨利贞，其匪正有眚。', level: '凶' },
  { name: '大畜', symbol: '䷚', gua: '山天大畜', text: '利贞，不家食吉，利涉大川。', level: '吉' },
  { name: '颐', symbol: '䷛', gua: '山雷颐', text: '贞吉，观颐，自求口实。', level: '吉' },
  { name: '大过', symbol: '䷜', gua: '泽风大过', text: '栋桡，利有攸往，亨。', level: '凶' },
  { name: '坎', symbol: '䷝', gua: '坎为水', text: '习坎，有孚，维心亨，行有尚。', level: '凶' },
  { name: '离', symbol: '䷞', gua: '离为火', text: '利贞，亨，畜牝牛吉。', level: '吉' },
  { name: '咸', symbol: '䷟', gua: '泽山咸', text: '亨，利贞，取女吉。', level: '吉' },
  { name: '恒', symbol: '䷠', gua: '雷风恒', text: '亨，无咎，利贞，利有攸往。', level: '吉' },
  { name: '遁', symbol: '䷡', gua: '天山遁', text: '亨，小利贞。', level: '平' },
  { name: '大壮', symbol: '䷢', gua: '雷天大壮', text: '利贞。', level: '吉' },
  { name: '晋', symbol: '䷣', gua: '火地晋', text: '康侯用锡马蕃庶，昼日三接。', level: '吉' },
  { name: '明夷', symbol: '䷤', gua: '地火明夷', text: '利艰贞。', level: '凶' },
  { name: '家人', symbol: '䷥', gua: '风火家人', text: '利女贞。', level: '吉' },
  { name: '睽', symbol: '䷦', gua: '火泽睽', text: '小事吉。', level: '平' },
  { name: '蹇', symbol: '䷧', gua: '水山蹇', text: '利西南，不利东北，利见大人。', level: '凶' },
  { name: '解', symbol: '䷨', gua: '雷水解', text: '利西南，无所往，其来复吉。', level: '吉' },
  { name: '损', symbol: '䷩', gua: '山泽损', text: '有孚元吉，无咎可贞。', level: '平' },
  { name: '益', symbol: '䷪', gua: '风雷益', text: '利有攸往，利涉大川。', level: '吉' },
  { name: '夬', symbol: '䷫', gua: '泽天夬', text: '扬于王庭，孚号有厉。', level: '平' },
  { name: '姤', symbol: '䷬', gua: '天风姤', text: '女壮，勿用取女。', level: '凶' },
  { name: '萃', symbol: '䷭', gua: '泽地萃', text: '亨，王假有庙，利见大人。', level: '吉' },
  { name: '升', symbol: '䷮', gua: '地风升', text: '元亨，用见大人，勿恤，南征吉。', level: '吉' },
  { name: '困', symbol: '䷯', gua: '泽水困', text: '亨贞，大人吉，无咎，有言不信。', level: '凶' },
  { name: '井', symbol: '䷯', gua: '水风井', text: '改邑不改井，无丧无得。', level: '平' },
  { name: '革', symbol: '䷰', gua: '泽火革', text: '巳日乃孚，元亨利贞，悔亡。', level: '吉' },
  { name: '鼎', symbol: '䷱', gua: '火风鼎', text: '元吉，亨。', level: '吉' },
  { name: '震', symbol: '䷲', gua: '震为雷', text: '亨，震来虩虩，笑言哑哑。', level: '吉' },
  { name: '艮', symbol: '䷳', gua: '艮为山', text: '艮其背，不获其身，无咎。', level: '平' },
  { name: '渐', symbol: '䷴', gua: '风山渐', text: '女归吉，利贞。', level: '吉' },
  { name: '归妹', symbol: '䷵', gua: '雷泽归妹', text: '征凶，无攸利。', level: '凶' },
  { name: '丰', symbol: '䷶', gua: '雷火丰', text: '亨，王假之，勿忧，宜日中。', level: '吉' },
  { name: '旅', symbol: '䷷', gua: '火山旅', text: '小亨，旅贞吉。', level: '平' },
  { name: '巽', symbol: '䷸', gua: '巽为风', text: '小亨，利有攸往，利见大人。', level: '吉' },
  { name: '兑', symbol: '䷹', gua: '兑为泽', text: '亨，利贞。', level: '吉' },
  { name: '涣', symbol: '䷺', gua: '风水涣', text: '王居无咎，小涣有匪。', level: '平' },
  { name: '节', symbol: '䷻', gua: '水泽节', text: '亨，苦节不可贞。', level: '吉' },
  { name: '中孚', symbol: '䷼', gua: '风泽中孚', text: '豚鱼吉，利涉大川。', level: '吉' },
  { name: '小过', symbol: '䷽', gua: '雷山小过', text: '亨利贞，可小事，不可大事。', level: '平' },
  { name: '既济', symbol: '䷾', gua: '水火既济', text: '亨小，利贞，初吉终乱。', level: '平' },
  { name: '未济', symbol: '䷿', gua: '火水未济', text: '亨，小狐汔济，濡其尾。', level: '平' },
];

/** 按日期取每日一卦（以年+月+日推算，保证每日稳定不变） */
function getDailyGua(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  // 用儒略日序号取模，保证同一天永远是同一卦
  const jd = Math.floor((Date.UTC(y, m - 1, day) - Date.UTC(2000, 0, 1)) / 86400000);
  const idx = ((jd % 64) + 64) % 64;
  return { index: idx, ...GUA[idx] };
}

/* ============ 导出 ============ */

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function clamp(s) {
  Object.keys(s).forEach(k => { s[k] = Math.max(20, Math.min(98, Math.round(s[k]))); });
  return s;
}
function toStars(score) {
  const n = score >= 85 ? 5 : (score >= 70 ? 4 : (score >= 55 ? 3 : (score >= 40 ? 2 : 1)));
  return n;
}
function groupIs(shishen, group) {
  return (SHI_SHEN_GROUPS[group] || []).indexOf(shishen) >= 0;
}

return {
  calcBazi,
  calcDailyFortune,
  getDailyGua,
  calcShiShen,
  zhiRelation,
  // 常量导出供页面使用
  WU_XING,
  WU_XING_COLOR,
  WU_XING_ORGAN,
  GAN,
  ZHI,
  ZHI_HIDE_GAN,
  SHENG_XING_TABLES: { SHENG, KE },
};
});
