(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vendor/lunar.js'), require('./bazi-core.js'));
  else {
    // lunar.js 浏览器下把 Solar / Lunar / LunarUtil 直接挂在全局
    root.LunarInput = factory({ Solar: root.Solar, Lunar: root.Lunar, LunarUtil: root.LunarUtil }, root.BaziCore);
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (LunarLib, core) {
  var Solar = LunarLib.Solar, Lunar = LunarLib.Lunar, LunarUtil = LunarLib.LunarUtil;

/**
 * 扩展功能层
 *  1. 农历日期输入与转换
 *  2. 灾运推算（大运吉凶、转折点、灾厄时段）
 *
 * 说明：历法换算全部委托 lunar-javascript 库，不做近似推算。
 * 本模块为纯计算，无 UI 依赖，小程序与浏览器均可运行。
 */

const GAN = core.GAN;
const ZHI = core.ZHI;
const SHENG = core.SHENG_XING_TABLES.SHENG;
const KE = core.SHENG_XING_TABLES.KE;
const WU_XING = core.WU_XING;

/* ============================================================
 * 一、农历日期转换
 * ========================================================== */

/** 某农历年可选的月份（含闰月标记） */
function lunarMonthsOfYear(lunarYear) {
  const months = [];
  const leap = leapMonthOf(lunarYear);
  for (let m = 1; m <= 12; m++) {
    months.push({ month: m, isLeap: false, label: m + '月' });
    if (leap === m) {
      months.push({ month: m, isLeap: true, label: '闰' + m + '月' });
    }
  }
  return months;
}

/**
 * 某农历年闰月月份号，无闰月返回 0
 * lunar.js 未提供 getLeapMonth，用「两朔间隔≥58天」判定：
 * 若某月朔到次月朔相隔 58 天以上，说明中间插入了一个闰月。
 */
function leapMonthOf(lunarYear) {
  for (let m = 1; m <= 12; m++) {
    try {
      const a = Lunar.fromYmd(lunarYear, m, 1).getSolar();
      let nm = m + 1, ny = lunarYear;
      if (nm > 12) { nm = 1; ny++; }
      const b = Lunar.fromYmd(ny, nm, 1).getSolar();
      const span = Math.round(
        (new Date(b.getYear(), b.getMonth() - 1, b.getDay()) -
          new Date(a.getYear(), a.getMonth() - 1, a.getDay())) / 86400000
      );
      if (span >= 58) return m;
    } catch (e) { /* 该年无此月，忽略 */ }
  }
  return 0;
}

/**
 * 某农历年某月的天数（自动处理闰月、大小月）
 * @param {number} lunarYear
 * @param {number} lunarMonth
 * @param {boolean} isLeap 是否闰月
 */
function lunarMonthDays(lunarYear, lunarMonth, isLeap) {
  const leapM = leapMonthOf(lunarYear);
  if (isLeap && leapM !== lunarMonth) return 0;   // 该年无此闰月

  // 边界规则（依库的实际公历排布）：
  //   平月 m  → 结束于「m+1 月朔」；若 m 之后紧跟闰 m 月，则结束于「闰 m 月朔」
  //   闰月 m  → 结束于「m+1 月朔」
  let endYear = lunarYear, endMonth;
  if (isLeap) {
    endMonth = lunarMonth + 1;
    if (endMonth > 12) { endMonth = 1; endYear++; }
  } else {
    const hasLeapAfter = (leapM === lunarMonth);
    endMonth = hasLeapAfter ? -lunarMonth : lunarMonth + 1;
    if (lunarMonth + 1 > 12) { endMonth = 1; endYear++; }
  }

  try {
    const a = Lunar.fromYmd(lunarYear, isLeap ? -lunarMonth : lunarMonth, 1).getSolar();
    const b = Lunar.fromYmd(endYear, endMonth, 1).getSolar();
    return Math.round(
      (new Date(b.getYear(), b.getMonth() - 1, b.getDay()) -
        new Date(a.getYear(), a.getMonth() - 1, a.getDay())) / 86400000
    );
  } catch (e) { return 30; }
}

/**
 * 农历转公历
 * @returns {{year,month,day,hour,lunarText}} 公历日期 + 农历文本
 */
function lunarToSolar(lunarYear, lunarMonth, lunarDay, isLeap) {
  // 基础校验
  if (!lunarYear || !lunarMonth || !lunarDay) {
    throw new Error('请完整填写出生日期');
  }
  const y = parseInt(lunarYear, 10);
  const m = parseInt(lunarMonth, 10);
  const d = parseInt(lunarDay, 10);
  if (!isFinite(y) || !isFinite(m) || !isFinite(d)) {
    throw new Error('出生日期格式不正确');
  }
  if (y < 1900 || y > 2100) {
    throw new Error('出生年份需在 1900 至 2100 之间');
  }
  if (m < 1 || m > 12) {
    throw new Error('农历月份需在 1 至 12 之间');
  }
  const maxDay = lunarMonthDays(y, m, !!isLeap);
  if (d < 1 || d > Math.max(maxDay, 1)) {
    throw new Error('农历' + m + '月没有' + d + '日，请检查日期');
  }

  let lunar;
  try {
    // 库约定：闰月用负数月份表示（如 -2 = 闰二月）
    const useMonth = isLeap ? -m : m;
    lunar = Lunar.fromYmdHms(y, useMonth, d, 0, 0, 0);
  } catch (e) {
    throw new Error('该农历日期不存在，请检查');
  }

  const solar = lunar.getSolar();
  return {
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
    lunarText: lunar.toString(),
    isLeap: !!isLeap
  };
}

/** 公历转农历（用于回显） */
function solarToLunar(year, month, day) {
  try {
    const solar = Solar.fromYmd(year, month, day);
    const lunar = solar.getLunar();
    return {
      year: lunar.getYear(),
      month: lunar.getMonth(),
      day: lunar.getDay(),
      isLeap: lunar.getMonth() < 0,   // 负数表示闰月
      text: lunar.toString()
    };
  } catch (e) {
    return null;
  }
}

/* ============================================================
 * 二、灾运推算
 * ========================================================== */

/** 十神对应的灾厄倾向权重（传统命理经验值，仅作参考） */
const SHAI_SHISHEN = {
  '正官': { risk: 0.55, type: '事业压力/官非', detail: '正官旺而无制，易有职务变动、口舌是非；宜守规矩、避争锋。' },
  '七杀': { risk: 0.85, type: '意外刑伤/突发', detail: '七杀当令，气势刚烈。易见外伤、手术、突发的竞争冲突；忌冲动、忌高风险操作。' },
  '正印': { risk: 0.25, type: '文书/健康', detail: '正印过旺则依赖心重，进取不足；易与文书、证件、母亲方面有牵绊。' },
  '偏印': { risk: 0.6, type: '异动/孤独', detail: '偏印主变动，易突然转向、搬离旧环境；防与同辈的疏离。' },
  '比肩': { risk: 0.45, type: '破财/争执', detail: '比肩争夺，合伙易分利；防朋友借贷、合伙纠纷。' },
  '劫财': { risk: 0.8, type: '破财/官非', detail: '劫财为祸，财物易损。忌担保、忌大额投资、忌借名借贷。' },
  '食神': { risk: 0.2, type: '口舌/散漫', detail: '食神泄秀而无忧，然过则耽于安逸，须防志气消磨。' },
  '伤官': { risk: 0.7, type: '是非/官司', detail: '伤官见官，为祸百端。易顶撞上级、招致非议；谨言慎行、少与人争。' },
  '正财': { risk: 0.3, type: '破财/失落', detail: '正财为辛劳之得，耗力换取；防因财失义、因义损财。' },
  '偏财': { risk: 0.65, type: '倾财/投机', detail: '偏财机会与风险并存。忌投机、忌高杠杆、忌轻信理财。' }
};

/** 地支与灾厄的传统对应 */
const ZHAI_ZHI = {
  子: '水泛、肾与泌尿', 丑: '土寒、脾胃', 寅: '木旺、筋骨肝胆', 卯: '木衰、四肢关节',
  辰: '湿土、皮肤', 巳: '火炎、心血管', 午: '火炎、心神与血压', 未: '土燥、肠胃',
  申: '金锐、呼吸道', 酉: '金盛、肺与呼吸', 戌: '燥土、脾胃', 亥: '水旺、肾与神经'
};

/** 大运/流年的干支互动关系 */
function analyseGanzhi(dg, dz, dayGan, dayZhi, dayWx) {
  const signs = [];
  let risk = 0;

  // 十神
  const ss = core.calcShiShen(dayGan, dg);
  const ssInfo = SHAI_SHISHEN[ss] || { risk: 0.4, type: '起伏', detail: '运势平稳起伏，按部就班则无虞。' };
  risk += ssInfo.risk;
  signs.push({ label: '天干' + ss, level: ssInfo.risk >= 0.7 ? 'high' : (ssInfo.risk >= 0.5 ? 'mid' : 'low'), text: ssInfo.detail });

  // 地支与日支关系
  const rel = core.zhiRelation(dz, dayZhi);
  if (rel) {
    if (rel.name === '冲') { risk += 0.35; signs.push({ label: '地支相冲', level: 'high', text: '大运' + dz + '冲日支' + dayZhi + '，主变动、搬迁、离合，宜主动化解。' }); }
    else if (rel.name === '刑') { risk += 0.3; signs.push({ label: '地支相刑', level: 'high', text: '大运' + dz + '刑日支' + dayZhi + '，主是非、健康隐患与人事摩擦。' }); }
    else if (rel.name === '害') { risk += 0.2; signs.push({ label: '地支相害', level: 'mid', text: '大运' + dz + '害日支' + dayZhi + '，易受暗损、被人拖累。' }); }
    else if (rel.name === '破') { risk += 0.15; signs.push({ label: '地支相破', level: 'mid', text: '大运' + dz + '破日支' + dayZhi + '，主小的破损与反复。' }); }
    else if (rel.name === '合') { signs.push({ label: '地支相合', level: 'low', text: '大运' + dz + '合日支' + dayZhi + '，主和顺、结缘、合作有成。' }); }
  }

  // 五行生克：运克日主为压力
  const dzWx = LunarUtil.WU_XING_ZHI[dz];
  if (dzWx && KE[dayWx] === dzWx) {
    risk += 0.25;
    signs.push({ label: '运克日主', level: 'mid', text: '大运地支' + dzWx + '克日主' + dayWx + '，主外部压力、事多耗神。' });
  } else if (dzWx && SHENG[dzWx] === dayWx) {
    signs.push({ label: '运生日主', level: 'low', text: '大运地支' + dzWx + '生日主' + dayWx + '，得力助力，事事顺遂。' });
  }

  // 地支本气对应的身体部位
  if (ZHAI_ZHI[dz]) {
    signs.push({ label: '留意部位', level: 'low', text: '大运' + dz + '主' + ZHAI_ZHI[dz] + '，宜定期检查。' });
  }

  return { risk: Math.min(1, risk), signs, shishen: ss, zhiWx: dzWx };
}

/**
 * 灾运总测算
 * @param {object} birth {year,month,day,hour,gender} 公历
 * @param {number} nowYear 当前年份
 */
function calcZaiyun(birth, nowYear) {
  const bazi = core.calcBazi(birth);
  const dayGan = bazi.dayGan;
  const dayZhi = bazi.dayZhi;
  const dayWx = bazi.dayWuXing;
  const Y = nowYear || new Date().getFullYear();

  /* ---- 逐步大运，逐年推算灾福 ---- */
  const yunItems = bazi.yun.items.map((d) => {
    const gan = d.ganzhi.charAt(0);
    const zhi = d.ganzhi.charAt(1);
    const a = analyseGanzhi(gan, zhi, dayGan, dayZhi, dayWx);

    // 该步大运是否已过
    const startY = parseInt(String(d.startYear).replace(/[^0-9]/g, ''), 10) || 0;
    const passed = startY > 0 && Y >= startY;

    let level, levelText;
    if (a.risk >= 0.75) { level = 'high'; levelText = '灾运'; }
    else if (a.risk >= 0.5) { level = 'mid'; levelText = '波动'; }
    else { level = 'low'; levelText = '平顺'; }

    return {
      ganzhi: d.ganzhi,
      startAge: d.startAge,
      endAge: d.endAge,
      startYear: d.startYear,
      color: d.color,
      shishen: a.shishen,
      risk: Math.round(a.risk * 100),
      level,
      levelText,
      passed,
      current: d.current,
      signs: a.signs,
      summary: buildYunSummary(a, d, levelText)
    };
  });

  /* ---- 人生转折点（大运交接 + 特定干支） ---- */
  const turning = [];
  yunItems.forEach((d, i) => {
    const next = yunItems[i + 1];
    if (!next) return;
    const riskDiff = next.risk - d.risk;
    const endYear = parseInt(String(d.startYear).replace(/[^0-9]/g, ''), 10) || 0;
    let reason = '', level = 'low';
    if (riskDiff >= 25) {
      level = 'high';
      reason = '交运后灾厄指数上升 ' + riskDiff + ' 点，由「' + d.levelText + '」转入「' + next.levelText + '」，为关键转折。';
    } else if (riskDiff <= -25) {
      reason = '交运后灾厄指数下降 ' + Math.abs(riskDiff) + ' 点，由「' + d.levelText + '」转入「' + next.levelText + '」，为转运之机。';
    } else {
      return;   // 变化平缓不列为转折点
    }
    turning.push({
      age: d.endAge,
      year: endYear ? endYear + 1 : '',
      fromGz: d.ganzhi,
      toGz: next.ganzhi,
      fromLevel: d.levelText,
      toLevel: next.levelText,
      level,
      reason
    });
  });

  /* ---- 具体灾厄时段（在灾运大运内，找风险最高的流年） ---- */
  const disasterPeriods = [];
  // 合理观察窗口：出生年至 100 岁
  const MAX_AGE = 100;
  yunItems.filter(d => d.level !== 'low').forEach((d) => {
    // 以「虚岁」区间取样：大运覆盖 [startAge, endAge+10)
    const fromAge = d.startAge;
    const toAge = d.endAge + 9;
    const marks = [];
    for (let k = 1; k <= 3; k++) {
      const age = fromAge + Math.round((toAge - fromAge) * k / 4);
      if (age < 1 || age > MAX_AGE) continue;
      const ly = bazi.birth.year + age;
      if (ly < Y) continue;   // 只看将来的
      // 流年干支一律由库计算，不自行推算（历法以库为准）
      const lz = Lunar.fromYmd(ly, 6, 1).getYearInGanZhiExact();
      const a = analyseGanzhi(lz.charAt(0), lz.charAt(1), dayGan, dayZhi, dayWx);
      marks.push({ year: ly, age, ganzhi: lz, risk: Math.round(a.risk * 100), shishen: a.shishen });
    }
    // 仅保留风险确实偏高的年份
    marks.filter(m => m.risk >= 60)
      .sort((x, y) => y.risk - x.risk)
      .slice(0, 2)
      .forEach((m) => {
        disasterPeriods.push({
          year: m.year,
          age: m.age,
          ganzhi: m.ganzhi,
          shishen: m.shishen,
          risk: m.risk,
          level: m.risk >= 70 ? 'high' : 'mid',
          yunGz: d.ganzhi,
          advice: adviceFor(m, d)
        });
      });
  });
  disasterPeriods.sort((a, b) => a.year - b.year);
  disasterPeriods.length = Math.min(disasterPeriods.length, 8);

  /* ---- 前半生 / 后半生 汇总（以起运年龄对半划分） ---- */
  const firstAge = bazi.yun.items.length ? bazi.yun.items[0].startAge : 7;
  const lastAge = bazi.yun.items.length ? bazi.yun.items[bazi.yun.items.length - 1].endAge : 80;
  const lifeSpan = lastAge;
  // 以大运中点划分，前后两半不重叠
  const midAge = Math.round((firstAge + lastAge) / 2);
  const firstHalf = summarizeByAge(firstAge, midAge, '前半生');
  const secondHalf = summarizeByAge(midAge + 1, lastAge, '后半生');

  /** 按年龄区间汇总；跨界的运势按其中心年龄归属，避免重复计入 */
  function summarizeByAge(fromAge, toAge, label) {
    const inRange = yunItems.filter(d => {
      const center = (d.startAge + d.endAge) / 2;
      return center >= fromAge && center <= toAge;
    });
    if (!inRange.length) {
      return { label, count: 0, maxRisk: 0, avgRisk: 0, badRatio: 0, level: 'low', levelText: '平顺', years: '', items: [] };
    }
    const maxRisk = Math.max.apply(null, inRange.map(x => x.risk));

    /* ============================================================
     *【1.8.4 修复 · 真实缺陷· 用户实测反馈「前后半生永远都是多灾」】
     *
     * 原判定只看 **maxRisk**（该区间内最高的那一步大运）：
     *   if (maxRisk >= 70) → 多灾
     * 于是只要 5 步里有任何一步冲到 70以上，**整段 40~50 年都被判「多灾」**，
     * 与同段内 20~30 分的「平顺」步并存 —— 自相矛盾。
     * 实测三个命盘的前后半生**全部**判「多灾」，而其各步风险为
     * [90,30,85,80,60]、[25,70,80,20] 等，明��有大量平顺运。
     *
     * 改为**三指标综合判定**，避免单步极值主导：
     *   avgRisk —— 区间内平均风险（代表整体基调，最不易被极值带偏）
     *   badRatio —— 高风险步（risk≥65）占比（代表「多灾」的普遍程度）
     *   maxRisk —— 峰值（保留展示，但不再单独决定等级）
     *
     * 规则（任一条件满足即升高等级）：
     *   当前修订 high：avg ≥ 65 且 badRatio ≥ 0.6，显示“起伏较多”
     *   当前修订 mid ：avg ≥ 50 或 badRatio ≥ 0.25
     *   low ：其余
     */
    /* 【量纲提示】大运风险的**存储量纲**：
     *   yunItems[].risk为 0~100 的整数（页面直接显示「风险 85」）
     *   analyseGanzhi() 的返回值 risk 为 0~1 的小数（内部累加用）
     * 故此处一律按 **0~100** 比较，勿混用。
     * （1.8.4 初版误按 0~1 设阈值，导致 badRatio 恒为 100%、
     *   avgRisk 显示 6900 等，已修正。）*/
    const risks = inRange.map(x => x.risk);
    const avgRisk = risks.reduce((a, b) => a + b, 0) / risks.length;
    /* 高风险步阈值 = **75**，与单步大运 level==='high' 的判定口径严格一致
     * （单步用的是 a.risk >= 0.75，即 0~100 量纲下的 75）。
     * 【1.8.4 初版误设为 70，与单步口径不一致，会把「波动」步算成高危步】*/
    const HIGH_STEP = 75;
    const badCount = risks.filter(r => r >= HIGH_STEP).length;
    const badRatio = badCount / risks.length;

    let level, levelText;
    // 半生只有约四至五步大运，旧规则两步偏高就把整段称为“多灾”，过于武断。
    // 只有平均分与高分占比同时持续偏高才给最高提醒；数值是模型内相对分。
    if (avgRisk >= 65 && badRatio >= 0.60) { level = 'high'; levelText = '起伏较多'; }
    else if (avgRisk >= 50 || badRatio >= 0.25) { level = 'mid'; levelText = '有波折'; }
    else { level = 'low'; levelText = '平顺'; }

    return {
      label,
      fromAge, toAge,
      count: badCount,
      /* 新增字段：供页面显示「为何如此判定」，也让调用方可自行核对 */
      avgRisk: Math.round(avgRisk),
      badRatio: Math.round(badRatio * 100),
      maxRisk,
      level,
      levelText,
      years: inRange[0].startAge + '-' + inRange[inRange.length - 1].endAge + '岁',
      items: inRange.map(x => ({
        ganzhi: x.ganzhi, age: x.startAge + '-' + x.endAge + '岁',
        level: x.level, levelText: x.levelText, risk: x.risk, summary: x.summary
      }))
    };
  }

  /* ---- 趋避建议 ----
   * 注意：此时 return 对象还没组装好，故先把事实打包传入，
   * 避免表达层反过来依赖尚未生成的生命周期字段。*/
  const _self = {
    dayZhi: dayZhi, dayWuXing: dayWx,
    turning: turning, yunItems: yunItems, disasterPeriods: disasterPeriods
  };
  const adviceList = missingAdvice(bazi, _self);

  return {
    birth: bazi.birth,
    dayGan,
    dayZhi,
    dayWuXing: dayWx,
    xingShui: bazi.xingShui,
    yunItems,
    turning,
    disasterPeriods,
    firstHalf,
    secondHalf,
    lifeSpan,
    advice: adviceList,
    summary: buildOverall(firstHalf, secondHalf, turning.length, disasterPeriods.length)
  };
}

function buildYunSummary(a, d, levelText) {
  const key = a.signs.find(s => s.level === 'high') || a.signs[0];
  return d.startAge + '-' + d.endAge + '岁（' + d.ganzhi + '）' + levelText + '，' +
    (key ? key.text : '运势平稳。');
}

function adviceFor(m, d) {
  const map = {
    high: '岁运并临，' + m.ganzhi + '引动原局。宜静不宜动，避免重大决策、避免高处作业，体检留意相关部位。',
    mid: '运势有起伏，' + m.shishen + '主事。宜守成、宜循序，勿求侥幸，稳中求进为上。'
  };
  return map[m.level] || '运势平稳，按既定节奏行事即可。';
}

/**
 * 养护/趋避建议
 *
 * 【1.8.3 修复 · 用户实测反馈「三个命盘的趋避建议逐字相同」】
 * 根因：本函数原先无条件 push 两条**纯常量**——
 *   「大运交接前后三年为调整期…」「子时、午时等交接时辰出生者…」，
 *   与命盘零关联；同时只有「弱五行」「缺五行」两条依赖命盘，
 *   而不少命盘既不弱也不缺，于是四人拿到完全一样的两句话。
 *
 * 现改为：把已算好的事实（弱五行/偏旺五行/喜忌/大运交接/风险峰值/
 * 时辰/命宫）交给 zaiyun-voice.js 组织成句。
 *
 * **这里只改「怎么说」，不改「算什么」**：
 *   turning / yunItems / disasterPeriods / firstHalf / secondHalf
 *   的计算逻辑一行未动，建议内容全部由上述既有字段派生。
 */
function missingAdvice(bazi, z) {
  /* 表达层不可用时退回最小可用输出，不返回空数组 */
  const V = (typeof globalThis !== 'undefined' && globalThis.ZaiyunVoice)
    ? globalThis.ZaiyunVoice : null;
  if (V && typeof V.composeAdvice === 'function') {
    try {
      const salt = [bazi.birth.year, bazi.birth.month, bazi.birth.day,
        bazi.birth.hour, bazi.birth.gender].join('-');
      const out = V.composeAdvice(z, bazi, salt);
      if (out && out.length) return out;
    } catch (e) { /* 落到下面的兜底 */ }
  }
  const miss = bazi.wuxingStat.missing || [];
  const weak = bazi.strength.weak || [];
  const list = [];
  if (weak.length) list.push('日主' + bazi.dayWuXing + '偏弱，宜补' + weak.join('、') + '：颜色用黑蓝绿、方位取北方东方。');
  if (miss.length) list.push('命局缺' + miss.join('、') + '，相关体质需留意，可在生活中主动补益。');
  list.push('大运交接前后三年为调整期，宜预留余地，不宜孤注一掷。');
  return list;
}

function buildOverall(first, second, turnCount, disCount) {
  const parts = [];
  parts.push(first.levelText + '—' + second.levelText);
  if (turnCount) parts.push('关键转折 ' + turnCount + ' 处');
  if (disCount) parts.push('需留意时段 ' + disCount + ' 个');
  return parts.join(' · ');
}

return {
  lunarToSolar,
  solarToLunar,
  lunarMonthsOfYear,
  lunarMonthDays,
  leapMonthOf,
  calcZaiyun,
  SHAI_SHISHEN,
  ZHAI_ZHI
};
});
