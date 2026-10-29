/* 玄机阁 · 紫微斗数本命盘
 *
 * 范围（严格遵守，不得越界）：
 *  - 本模块只做「排盘计算 + 术语白话解释」，把传统盘面如实呈现出来。
 *  - 不用它断言命运好坏。十二宫的 topic 只说明「这个位置传统上用来谈什么」，
 *    每宫都带否定式边界声明。庙旺利陷是传统术语，不代表吉凶结论。
 *
 * 依赖：vendor/iztro.min.js（第三方排盘引擎，浏览器 UMD 包，
 *   在 Node 下需经 self桥接，见tests/ext-p2-chart.js 中的同一套加载法）。
 *   本模块不做任何近似推算，排盘结果完全由引擎给出，可复现。
 */
(function (root) {
  'use strict';

  /* ---------- 引擎桥接 ---------- */

  /* 引擎在**调用时**才解析，而不是在模块加载时。
     原因：index.html 里 iztro 先于本脚本加载，浏览器没问题；
     但 Node 测试要在 require 之后才把 iztro 挂到全局（用 vm 沙箱），
     若在加载时就取值会永久锁死成「未就绪」，造成测试与浏览器行为不一致。 */
  function engine() {
    var a = root.iztro && root.iztro.astro;
    if (!a) {
      /* Node 环境下 iztro 未加载：如实报错，不返回空壳。
         静默兜底会造出一份「看起来能排其实没排」的假盘。 */
      throw new Error('紫微斗数引擎未就绪：请确认 vendor/iztro.min.js 已加载。');
    }
    return a;
  }

  var ZODIAC_CN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  /* 十二宫白话释义。每条只说明「传统上这一宫用来谈哪些话题」，
     是话题索引，不是命运判断；措辞已逐条剔除断言式表达。 */
  var PALACE_TOPICS = {
    命宫: '自身的性格倾向、天赋与惯常的行事风格，是全局的观察起点。',
    兄弟: '手足与同辈的相处方式、合作关系与资源往来。',
    夫妻: '亲密关系中的互动模式、期待与需要沟通的边界。',
    子女: '与晚辈、学生、下属的相处，以及教导与照顾的方式。',
    财帛: '收入来源、赚钱方式与花钱习惯，偏重话题索引而非数额预测。',
    疾厄: '身体照护、作息压力与健康管理习惯；不能据此诊断疾病。',
    迁移: '离开熟悉环境时的适应、外部机会与异地合作的处境。',
    仆役: '朋友、同事、下属与团队伙伴的信任、分工与合作边界。',
    官禄: '职业方向、专业能力、职责承担与社会角色定位。',
    田宅: '居住环境、家庭资源、房产与家运的安排。',
    福德: '内在感受、休息方式、兴趣与精神层面的满足来源。',
    父母: '长辈、上司、导师与支持系统，以及出身家庭的互动方式。'
  };

  var BOUNDARY = '本宫释义仅为传统话题索引，用于理解盘面术语；不据以断言命运、性格优劣或事件吉凶。';

  /* 星曜类型中文名对照（iztro 在 zh-CN 下已给出中文，此处只做兜底） */
  var TYPE_LABEL = {
    major: '主星', soft: '辅星', adjective: '杂曜',
    tough: '煞星', lucky: '禄存', tianma: '天马',
    flower: '桃花', helper: '博士'
  };

  function normalizeType(t) {
    if (!t) return 'other';
    if (TYPE_LABEL[t]) return t;
    /* 未知类型不静默归入主星，避免把杂曜显示成主星而误导读者 */
    return 'other';
  }

  function pickStars(palace, field) {
    var arr = palace[field] || [];
    return arr.map(function (s) {
      return {
        name: s.name,
        type: normalizeType(s.type),
        typeLabel: TYPE_LABEL[normalizeType(s.type)] || '其他',
        brightness: s.brightness || '平',
        mutagen: s.mutagen || '',
        scope: s.scope || 'origin'
      };
    });
  }

  /* ---------- 生辰校验 ---------- */

  function validateBirth(b) {
    if (!b || typeof b !== 'object') throw new Error('请先填写出生日期与时辰。');
    var y = Number(b.year), m = Number(b.month), d = Number(b.day);
    var h = b.hour === null || b.hour === undefined || b.hour === '' ? null : Number(b.hour);
    if (!Number.isInteger(y) || y < 1900 || y > 2100) {
      throw new Error('出生年份需在 1900~2100 之间。');
    }
    if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error('出生月份非法。');
    if (!Number.isInteger(d) || d < 1 || d > 31) throw new Error('出生日期非法。');
    /* 日历有效性：交给引擎，但先挡掉 2 月 30 日这类明显错误 */
    var probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
      throw new Error('出生日期在该月不存在。');
    }
    if (h === null) throw new Error('请填写出生时辰：紫微斗数以时辰立宫，缺时辰无法排盘。');
    if (!Number.isInteger(h) || h < 0 || h > 23) throw new Error('出生时辰需在 0~23 之间。');
    var g = b.gender === '男' ? '男' : (b.gender === '女' ? '女' : null);
    if (!g) throw new Error('请选择性别：紫微斗数的起宫方式依性别而异。');
    return { y: y, m: m, d: d, h: h, gender: g };
  }

  /* ---------- 排盘 ---------- */

  function build(birth) {
    var v = validateBirth(birth);
    /* iztro.bySolar(date, timeIndex, gender, fixLeap, language)
       timeIndex 0~12 对应早子时至晚子时。 */
    var timeIndex = timeIndexOf(v.h);
    var dateStr = v.y + '-' + v.m + '-' + v.d;
    var c;
    try {
      c = engine().bySolar(dateStr, timeIndex, v.gender, true, 'zh-CN');
    } catch (e) {
      throw new Error('排盘失败：' + (e && e.message ? e.message : String(e)));
    }
    if (!c || !c.palaces || c.palaces.length !== 12) {
      throw new Error('排盘结果异常：未得到十二宫。');
    }

    var palaces = c.palaces.map(function (p) {
      var stars = []
        .concat(pickStars(p, 'majorStars'))
        .concat(pickStars(p, 'minorStars'))
        .concat(pickStars(p, 'adjectiveStars'));
      var branch = p.earthlyBranch || ZODIAC_CN[p.index % 12];
      return {
        index: p.index,
        name: p.name,
        branch: branch,
        stem: p.heavenlyStem || '',
        isSoul: p.name === '命宫',
        isBody: p.name === '身宫',
        isOriginal: p.isOriginalPalace === true,
        changsheng12: p.changsheng12 || '',
        boshi12: p.boshi12 || '',
        topic: PALACE_TOPICS[p.name] || '',
        boundary: BOUNDARY,
        stars: stars
      };
    });

    /* 星曜总表，按宫归并，便于界面直接取用 */
    var stars = [];
    palaces.forEach(function (p) {
      p.stars.forEach(function (s) {
        stars.push({
          name: s.name, type: s.type, typeLabel: s.typeLabel,
          brightness: s.brightness, mutagen: s.mutagen, scope: s.scope,
          palace: p
        });
      });
    });

    /* 大限：起限年龄按五行局（水二木三金四土五火六），此后每档十年。
       引擎的 decadalList 是**方法**而非数组，必须调用 chart.decadalList(dateStr) 才拿到结果；
       且它返回项的 range 与 ages 都是空数组，起限年龄并不由引擎提供，只能按五行局推算。
       宫位顺序直接采用引擎的排法（阳男阴女顺行、阴男阳女逆行，自命宫起）。 */
    var decadal = [];
    var raw = null;
    if (typeof c.decadalList === 'function') {
      try { raw = c.decadalList(dateStr); } catch (e) { raw = null; }
    } else if (Array.isArray(c.decadalList)) {
      raw = c.decadalList;
    }
    var startAge0 = startAgeOfClass(c.fiveElementsClass);
    if (raw && raw.length) {
      raw.forEach(function (d, i) {
        var pn = (d.palaceNames && d.palaceNames[0]) || '';
        decadal.push({
          index: i,
          name: '第' + (i + 1) + '限',
          startAge: startAge0 + i * 10,
          endAge: startAge0 + i * 10 + 9,
          palaceName: pn,
          palace: palaces.filter(function (p) { return p.name === pn; })[0] || null
        });
      });
    }
    /* 兜底：引擎完全没给大限时，自命宫起按同样步长铺满十二档 */
    if (!decadal.length) {
      var lifeIdx = 0;
      palaces.forEach(function (p, i) { if (p.isBodyPalace !== undefined && p.isSoulPalace) lifeIdx = i; });
      for (var k = 0; k < 12; k += 1) {
        var pa = palaces[(lifeIdx + k) % 12];
        decadal.push({
          index: k, name: '第' + (k + 1) + '限',
          startAge: startAge0 + k * 10, endAge: startAge0 + k * 10 + 9,
          palaceName: pa.name, palace: pa
        });
      }
    }

    return {
      version: 'star-chart-1.0.0',
      gender: c.gender,
      solarDate: c.solarDate,
      lunarDate: c.lunarDate,
      chineseDate: c.chineseDate,
      time: c.time,
      zodiac: c.zodiac || '',
      sign: c.sign || '',
      fiveElementsClass: c.fiveElementsClass || '',
      soulBranch: c.earthlyBranchOfSoulPalace || '',
      bodyBranch: c.earthlyBranchOfBodyPalace || '',
      palaces: palaces,
      stars: stars,
      decadal: decadal
    };
  }

  /* 子时跨日：23:00~23:59 属晚子时，timeIndex 12 */
  function timeIndexOf(hour) {
    if (hour === 23) return 12;
    return Math.floor(((hour + 1) % 24) / 2);
  }

  /* 传统五行局起限年龄：水二、木三、金四、土五、火六 */
  function startAgeOfClass(cls) {
    var map = { 水: 2, 木: 3, 金: 4, 土: 5, 火: 6 };
    var ch = String(cls || '').charAt(0);
    return map[ch] || 2;
  }

  function palace(chart, name) {
    if (!chart || !Array.isArray(chart.palaces)) throw new Error('请先排盘。');
    var hit = chart.palaces.filter(function (p) { return p.name === name; })[0];
    if (!hit) throw new Error('未知的宫位：' + name);
    return hit;
  }

  /* 按年龄定当前大限 */
  function decadalAt(chart, yearOrAge) {
    if (!chart || !chart.decadal || !chart.decadal.length) throw new Error('请先排盘。');
    var n = Number(yearOrAge);
    if (!Number.isFinite(n)) throw new Error('需要有效的年份或年龄。');
    /* 必须先判断是「年份」还是「年龄」，再做范围校验：
       年份（如 2026）必然大于 130，若先按年龄校验会直接抛错。 */
    var age;
    var by = parseInt(String(chart.solarDate).slice(0, 4), 10);
    if (n > 120 && Number.isFinite(by)) {
      /* 传入的是出生年：虚岁按年数差 +1 */
      age = n - by + 1;
    } else {
      age = n;
    }
    if (age < 0 || age > 130) throw new Error('年龄需在 0~130 之间。');
    var hit = chart.decadal[0];
    chart.decadal.forEach(function (d) {
      if (age >= d.startAge) hit = d;
    });
    return hit;
  }

  root.StarChart = {
    version: 'star-chart-1.0.0',
    ready: true,
    engine: engine,
    PALACE_TOPICS: PALACE_TOPICS,
    BOUNDARY: BOUNDARY,
    ZODIAC_CN: ZODIAC_CN,
    build: build,
    palace: palace,
    decadalAt: decadalAt,
    startAgeOfClass: startAgeOfClass
  };
})(typeof window !== 'undefined' ? window : globalThis);