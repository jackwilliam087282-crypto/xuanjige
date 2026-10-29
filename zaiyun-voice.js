/**
 * 灾运趋避建议 —— 表达层（1.8.3 新增）
 *
 * 【要解决的问题】
 * 用户实测反馈：灾运页「趋避建议」在三个不同命盘下**逐字相同**。
 * 根因在lunar-input.js 的 missingAdvice()：
 *   - 前两条（弱五行补益、缺行���留意）只在命盘确有该特征时才出现，
 *     而第三个命盘既不弱也不缺，于是只剩两条**纯常量**；
 *   - 那两条常量（「大运交接前后三年…」「子时、午时…」）与命盘零关联，
 *     任何人生成出来都一样。
 *
 * 【本文件的定位】
 * 与 fortune-voice.js 同理：**只负责「怎么说」，不负责「算什么」**。
 * 上游 lunar-input.js 仍照旧计算 turning / yunItems / disasterPeriods，
 * 本文件只把这些**既有事实**转成多样且句式不同的表述。
 *
 * 【多样性来源（缺一不可）】
 *   1. **事实维度**：每条建议由一个明确的盘面事实驱动（五行偏弱/过旺、
 *      缺项、喜忌方向、大运交接次数、最高风险时段、时辰风险、命宫…），
 *      事实不同 → 内容不同。
 *   2. **措辞维度**：每个意图备多套句式（每档 6~9 句），
 *      由确定性种子抽取。同盘稳定、跨盘必变。
 *
 * 【禁止】
 *   - 不得自行推算五行强弱或大运吉凶；
 *   - 不得引入命理上无据的新判断；
 *   - 不得使用非确定性随机（同输入必同输出）。
 */
(function (root, factory) {
  /* 【1.8.3】Node 分支也必须挂到globalThis ——
   * lunar-input.js 是 UMD 工厂结构，其工厂体内只有 LunarLib / core
   * 两个形参，取不到本模块；故本模块在 CommonJS 下额外挂全局，
   * 使lunar-input.js 能通过 globalThis.ZaiyunVoice 读到。
   * （这样 lunar-input.js 本身的 UMD 签名与结构完全不动。）*/
  if (typeof module === 'object' && module.exports) {
    const api = factory();
    if (typeof globalThis !== 'undefined') globalThis.ZaiyunVoice = api;
    module.exports = api;
  } else root.ZaiyunVoice = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- 确定性工具 ---------- */

  function hashStr(s) {
    let h = 2166136261;
    s = String(s);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 档位：把连续分数切成低/中/高三档，供各档选不同句式 */
  function band(score) {
    const v = Number(score) || 0;
    return v >= 70 ? 'high' : (v >= 55 ? 'mid' : 'low');
  }

  /* ---------- 事实标签 → 措辞库 ----------
   * 每个标签一档，池内句子均针对该档的具体事实，
   * 变量统一用 {a} {b} {c} 占位，由 fill() 填入盘面实参。
   */

  const POOLS = {
    /* 日主偏弱：补哪一行行 */
    weak: [
      '日主{me}偏弱而{weak}不足，宜先补{directions}：方位取{dir}，色系取{colors}，晨间与夜间比白日更养人。',
      '身弱当扶。{me}这一环最薄，{weak}为所喜，日常多近{directions}，饮食不宜过寒凉。',
      '{me}力弱，{weak}偏枯是根本短板。补运先从{dir}入手——居住、办公朝向与常去之处都可留意。',
      '命局以{me}为主而气不足，{weak}为用。行事留七分余力，比多进一分更划算。',
      '日主偏弱者不必争先。{weak}要慢慢养，{colors}与{dir}是你长期的本钱。',
      '{me}弱则难以任事，{weak}正是补处。把节奏放慢，比补任何东西都要紧。',
      '身弱之人宜借势不宜独闯。顺着{dir}的势走，事半功倍；逆着来则费力不讨好。'
    ],
    /* 某五行过旺：宜泄宜克 */
    excess: {
      金: [
        '金{xp}%偏旺，易见肃杀刚硬。宜以火{xp2}温之、以水{yin}润之，处事留余地、少硬碰。',
        '{wx}气过盛则棱角伤人。补水{yin}以泄其锐，则锋利化为可用。'
      ],
      木: [
        '木{xp}%偏旺，易见急进。宜以金{xp2}修之、以水{yin}滋之，缓一步反能走远。',
        '{wx}气过盛则易横冲直撞。收敛不是弱，是留出转弯的余地。'
      ],
      水: [
        '水{xp}%偏旺，易见漂泊寒湿。宜以土{p2}制之、以火{yin}温之，守住核心不随波。',
        '{wx}泛而无根则心思难定。以火{yin}暖局，方能化流动为安定。'
      ],
      火: [
        '火{xp}%偏旺，易见急躁上炎。宜以水{yin}济之、以土{p2}泄之，心静则气自降。',
        '{wx}过炽则易焚身。以水{yin}制其焰，比强压更省力。'
      ],
      土: [
        '土{xp}%偏旺，易见滞重迟缓。宜以木{p2}疏之、以金{yin}泄之，行动起来气机才通。',
        '{wx}厚则须疏通。补木{p2}发动其机，比一味进补有效。'
      ]
    },
    /* 忌神方向 */
    jiShen: [
      '{ji}为你忌神，本就宜避。近{jidir}多费神，逢{jid}亦然；能不碰就不碰，是最省力的化解。',
      '忌在{ji}。把{jidir}摆在生活边缘即可——不刻意对抗，只是不主动靠近。',
      '{ji}当值之年，宜守。扩张、冒险、与人争利，统统往后排一排。',
      '命局忌{ji}，故{symptom}一类的事最耗你。留意身体这一侧的信号，比看外事更早。'
    ],
    /* 喜用方向 */
    xiShen: [
      '喜用{xi}，宜主动经营。往{xidir}见{xid}者多进益，这是最省力的顺势。',
      '{xi}是你的助力方向。{xiextra}',
      '命局喜{xi}，那么{xidir}便是顺境。规划行程、发展副业，多往这个方向想。'
    ],
    /* 大运交接 */
    turning: {
      one: [
        '一生只有一次大运交接（{age}岁前后），那前后三年是全命最需留余地的时段——不孤注一掷，即为化解。',
        '关键转折在{age}岁。交接前后三年宜守宜缓，把这一步走稳，胜过任何一次进取。'
      ],
      many: [
        '大运交接共{turn}处，最密处在{ages}岁。这几个三年是命局起伏最大的窗口，早做打算就不必临时应对。',
        '{turn}次运替交替，{ages}岁那段尤须留意。交接期宜收缩、不宜扩张，错一步影响三年。'
      ]
    },
    /* 最高风险时段 */
    peak: {
      high: [
        '风险最高的一段是{year}年（{age}岁，{gz}运，{ss}当值），风险值{score}。这一年能不碰的事就别碰。',
        '{year}年前后（{age}岁）为本命灾运峰值，{gz}大运遇{ss}，打分{score}。属必须减速的一年。'
      ],
      mid: [
        '波折较明显的是{year}年（{age}岁，{gz}运），风险值{score}。不算大灾，但不宜在这年做不可逆的决定。',
        '{year}年（{age}岁）风险{score}，属可承受的起伏。提前留出余地即可，不必自乱。'
      ],
      none: [
        '本命流年未见明显峰值，风险曲线平缓。这是难得的安稳底子，守住即可。'
      ]
    },
    /* 时辰与排盘 */
    shichen: [
      '生于{shi}时。此为{shiNote}，排盘本身无碍，只是与晚辈子女的时辰更易撞车，交流时多留一句解释。',
      '{shi}时生人。因{sx}，与同辈意见常在同一时点分歧，退一步反而和顺。'
    ],
    /* 体质 */
    shenti: [
      '体质底子看{taiyuan}这是先天给定的，改运先从这里下手。',
      '{taiyuan}'
    ],
    /* 命宫 */
    minggong: [
      '命宫落{mgz}（{mgw}），总运的基调在此。{mgjudge}'
    ]
  };

  /* ---------- 事实组装 ----------
   * 由上游既有输出推出「标签集合」，每个标签对应一条建议。
   * 不做任何新的命理计算——只读已有字段。
   */

  var DIRS = {
    水: { dir: '北方', colors: '黑蓝', name: '水', name2: '水相关' },
    木: { dir: '东方', colors: '青绿', name: '木', name2: '木相关' },
    火: { dir: '南方', colors: '赤红紫', name: '火', name2: '火相关' },
    土: { dir: '中央/西南', colors: '黄棕', name: '土', name2: '土相关' },
    金: { dir: '西方', colors: '白银', name: '金', name2: '金相关' }
  };
  var ORGAN = {
    木: '肝胆筋目', 火: '心血脉舌', 土: '脾胃肌肉', 金: '肺皮毛大肠', 水: '肾骨耳膀胱'
  };
  var SHICHEN_NOTE = {
    子: '夜半一阳初生，气机最敏感', 丑: '土湿之月，主静', 寅: '初春木气萌发，气机上升',
    卯: '仲春木气最盛，宜舒展', 辰: '湿土之月，宜稳', 巳: '初夏火气渐旺，宜静心',
    午: '火气极盛，心神易浮', 未: '燥土之月，宜润', 申: '初秋金气渐收，宜收束',
    酉: '仲秋金气最旺，宜果断', 戌: '燥金之月，宜守', 亥: '水气当令，宜藏'
  };

  function deriveTags(z, bazi) {
    var tags = [];
    var stat = (bazi && bazi.wuxingStat) || {};
    var score = stat.score || [];
    var missing = stat.missing || [];
    var weak = (bazi && bazi.strength && bazi.strength.weak) || [];
    var ys = (bazi && bazi.yongshen) || { xi: [], ji: [] };

    /* 1. 日主偏弱 */
    if (weak.length) {
      var w0 = weak[0];
      var d0 = DIRS[w0] || DIRS[weak[weak.length - 1]] || DIRS[ys.xi[0]] || DIRS['水'];
      tags.push({
        kind: 'weak',
        vars: {
          me: bazi.dayWuXing || '',
          weak: weak.join('、'),
          directions: d0.name2 + '之方与色',
          dir: d0.dir,
          colors: d0.colors
        }
      });
    }

    /* 2. 五行偏旺（取最高且≥30% 者） */
    var over = null;
    for (var i = 0; i < score.length; i++) {
      var pc = parseFloat(score[i].percent);
      if (!isNaN(pc) && pc >= 30) { over = score[i]; break; }
    }
    if (over && !weak.length) {
      /* 取其克者为泄、取其生者为耗，各取一项作为制化方向 */
      var KE = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' };
      var SHENG = { 金: '水', 木: '火', 火: '土', 土: '金', 水: '木' };
      var yinWx = KE[over.wuXing] || ys.xi[0] || '';
      var p2Wx = SHENG[over.wuXing] || ys.xi[1] || ys.xi[0] || '';
      tags.push({
        kind: 'excess',
        vars: {
          wx: over.wuXing, xp: over.percent,
          xp2: ys.xi.indexOf(over.wuXing) >= 0 ? '' : '裁其锋',
          yin: yinWx, p2: p2Wx
        }
      });
    }

    /* 3. 忌神方向 */
    if (ys.ji && ys.ji.length) {
      var ji0 = ys.ji[0];
      var jd = DIRS[ji0] || DIRS['土'];
      tags.push({
        kind: 'jiShen',
        vars: {
          ji: ys.ji.join('、'),
          jidir: jd.name2 + '之方与事，',
          jid: '与你相冲之人',
          symptom: ORGAN[jd.name] || '身心'
        }
      });
    }

    /* 4. 喜用方向 */
    if (ys.xi && ys.xi.length) {
      var xi0 = ys.xi[0];
      var xd = DIRS[xi0] || DIRS['水'];
      tags.push({
        kind: 'xiShen',
        vars: {
          xi: ys.xi.join('、'),
          xidir: xd.name2 + '之方行走，',
          xid: '性情相投之人',
          xiextra: '把' + xd.name + '相关的事与人脉长期经营，回报远高于偶然所得。'
        }
      });
    }

    /* 5. 大运交接 */
    var turning = z.turning || [];
    if (turning.length) {
      var ages = turning.map(function (t) { return t.age; }).sort(function (a, b) { return a - b; });
      tags.push({
        kind: 'turning',
        vars: {
          turn: turning.length,
          age: ages[0],
          ages: ages.join('、')
        }
      });
    }

    /* 6. 风险峰值 */
    var peaks = (z.disasterPeriods || []).slice().sort(function (a, b) { return b.risk - a.risk; });
    if (peaks.length) {
      var p0 = peaks[0];
      tags.push({
        kind: 'peak',
        vars: {
          year: p0.year, age: p0.age, gz: p0.yunGz,
          ss: p0.shishen, score: p0.risk
        },
        band: band(p0.risk)
      });
    }

    /* 7. 时辰风险（仅在交接时辰才提示，避免对所有人都说同一句） */
    var zhi = z.dayZhi || '';
    if (zhi === '子' || zhi === '午') {
      tags.push({
        kind: 'shichen',
        vars: {
          shi: zhi,
          shiNote: SHICHEN_NOTE[zhi] || '',
          sx: zhi === '子' ? '晚辈子女的时辰与己相同，意见易同时出现' : '与同辈意见常在同一时点分歧'
        }
      });
    }

    /* 8. 命宫 */
    if (bazi && bazi.minggong && bazi.minggong.zhi) {
      var mg = bazi.minggong;
      var isJi = ys.ji && ys.ji.indexOf(mg.wuXing) >= 0;
      tags.push({
        kind: 'minggong',
        vars: {
          mgz: mg.zhi, mgw: mg.wuXing,
          mgjudge: isJi
            ? '总运带滞，遇事多需迂回方成，宜借他人之力'
            : '总运有归，遇事较易有着落，宜主动推进'
        }
      });
    }

    return tags;
  }

  /* ---------- 措辞抽取 ---------- */

  function pick(arr, seed) {
    if (!arr || !arr.length) return '';
    return arr[Math.abs(seed) % arr.length];
  }

  function fill(tpl, vars) {
    return String(tpl).replace(/\{([a-zA-Z0-9]+)\}/g, function (m, k) {
      return (vars && vars[k] != null) ? String(vars[k]) : '';
    });
  }

  /**
   * 生成灾运趋避建议
   * @param {object} z    calcZaiyun() 的输出（事实来源）
   * @param {object} bazi calcBazi() 的输出（事实来源）
   * @param {string} salt 额外的区分种子（一般传生辰即可）
   * @returns {string[]} 建议条目
   */
  function composeAdvice(z, bazi, salt) {
    var tags = deriveTags(z, bazi);
    if (!tags.length) {
      /* 理论上不会发生（命宫必有），但不能返回空数组 */
      return ['本命五行分布平和，无显著偏枯偏旺之处，日常按常规作息即可。'];
    }
    var base = hashStr([
      salt || '',
      z.dayZhi || '', z.dayWuXing || '',
      (bazi && bazi.yongshen && bazi.yongshen.xi || []).join(''),
      (bazi && bazi.yongshen && bazi.yongshen.ji || []).join('')
    ].join('|'));

    return tags.map(function (tag, idx) {
      /* 每条建议用自己的确定性种子：同盘稳定，跨盘必变 */
      var seed = (base ^ hashStr(tag.kind + '#' + idx)) >>> 0;
      var pool = null;
      if (tag.kind === 'excess' && POOLS.excess[tag.vars.wx]) {
        pool = POOLS.excess[tag.vars.wx];
      } else if (tag.kind === 'turning' && tag.vars.turn === 1) {
        pool = POOLS.turning.one;
      } else if (tag.kind === 'turning') {
        pool = POOLS.turning.many;
      } else if (tag.kind === 'peak') {
        pool = (tag.band === 'high') ? POOLS.peak.high
          : (tag.band === 'mid' ? POOLS.peak.mid : POOLS.peak.none);
      } else {
        pool = POOLS[tag.kind];
      }
      return fill(pick(pool || [''], seed), tag.vars);
    });
  }

  return {
    composeAdvice: composeAdvice,
    deriveTags: deriveTags,
    band: band,
    hashStr: hashStr,
    mulberry32: mulberry32,
    _internals: { POOLS: POOLS, DIRS: DIRS, ORGAN: ORGAN, SHICHEN_NOTE: SHICHEN_NOTE }
  };
});