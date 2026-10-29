/**
 * core/casting.js —— 六爻起卦状态机（1.6.0 新增）
 *
 * 审计要求（四、五、七、八、十一）：
 *   四. 铜钱起卦改为可见、可确认的逐轮起卦：
 *       每点一次只投一轮三枚独立铜钱；第 1 轮 → 初爻 …… 第 6 轮 → 上爻；
 *       每轮保存三枚钱的原始正反面、各自数值、和值、6/7/8/9、阴阳与动静；
 *       使用 crypto.getRandomValues 生成每枚独立钱面，禁止先随机爻值再伪造钱面；
 *       界面上从下向上绘制初爻至上爻，内部数据同样统一「初爻→上爻」。
 *   五. 六轮完成后才启用「生成本卦」；按钮只读六轮共同结果；
 *       不得把六轮和值再次相加形成吉凶总分。
 *   七. 「同一人另问一事」「为另一人重新起卦」生成新 castId 并清空对应内容；
 *       新卦禁止复用上一卦的随机数、铜钱面、卦象或解读；
 *       历史复盘必须使用已保存的 18 枚钱面重算，禁止重新随机；
 *       未完成六轮就离开时提供「保存草稿 / 放弃本次」。
 *   八. 三种方法不得互相读取残留状态；切换时各自保留未完成草稿。
 *
 * 本模块为纯计算，无 UI 依赖，Node 与浏览器均可运行。
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./trace.js'), require('./coin.js'), require('./question.js'));
  } else {
    root.CastingState = factory(root.RuleTrace, root.CoinCast, root.QuestionStruct);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (RT, Coin, Q) {
  'use strict';

  /**
   * core/liuyao.js 的引用（由外部注入，避免循环依赖）。
   * Node 环境下由 testing 入口或 liuyao.js 自身注入。
   */
  var LiuYaoRef = null;
  function setLiuYao(mod) { LiuYaoRef = mod; return LiuYaoRef; }

  /** 六爻位名（索引 0 = 初爻） */
  var POS = ['初', '二', '三', '四', '五', '上'];

  /** 三种起卦方式 —— 顺序即界面标签顺序 */
  var METHODS = [
    {
      key: 'coin',
      label: '铜钱起卦',
      summary: '每一轮同时投三枚铜钱，共投六轮。第1轮为初爻，第6轮为上爻，六轮共同组成本卦。' +
        '6、9为动爻，全部动爻同时翻转形成变卦。',
      note: '不是看第6轮单独结果，也不是把六轮数字简单相加定吉凶。'
    },
    {
      key: 'numbers',
      label: '三星连珠',
      summary: '输入三个心念数字，系统按当前软件采用的三数公式计算上卦、下卦和动爻。同一组三数可以复算。' +
        '此法属于明确约定的数字起卦法，结果页会展示完整公式。',
      note: '公式为本软件约定（非唯一古法），展开可见先天八卦数映射与余数为 0 的处理。'
    },
    {
      key: 'time',
      label: '此刻起卦',
      summary: '以点击时的年月日时起卦，系统记录北京时间、农历年月日、年支数和时支数，' +
        '计算上卦、下卦与动爻。适合临时针对一件明确事情起卦。',
      note: '动爻一律取合法爻值 6 或 9，不使用 0 或 5。'
    }
  ];

  /* ============================================================
   * 会话（session）
   * ============================================================ */

  /** 生成一轮的空槽位 */
  function blankRound(i) {
    return {
      index: i + 1,          // 第几轮（1~6）
      pos: i + 1,            // 爻位 1~6（1=初爻）
      posName: POS[i],
      rolled: false,
      coins: null,           // [{isYang,label,value,glyph} × 3]
      value: null,           // 6/7/8/9
      count: null,           // 背（阳面）个数 0~3
      yang: null,
      changing: null,
      name: ''               // 老阴/少阳/少阴/老阳
    };
  }

  /**
   * 新建起卦会话。
   * 三种方法各自持有独立草稿，互不读取。
   */
  function newSession(opt) {
    opt = opt || {};
    return {
      castId: opt.castId || RT.genCastId(),
      method: opt.method || 'coin',
      // 输入区（求测人称呼与问题正文严格分离）
      querent: opt.querent || '',
      question: opt.question || '',
      category: opt.category || '',
      timeRange: opt.timeRange || '',
      timezone: opt.timezone || 'Asia/Shanghai',
      castTime: opt.castTime || null,
      // 铜钱：固定六轮槽位
      rounds: [0, 1, 2, 3, 4, 5].map(blankRound),
      // 三星连珠草稿
      numbers: ['', '', ''],
      // 此刻起卦草稿（保存点击瞬间的时间，避免刷新后漂移）
      timeInput: null,
      // 结果缓存（每种方法独立）
      results: { coin: null, numbers: null, time: null },
      saved: false
    };
  }

  function setMethod(s, m) {
    if (['coin', 'numbers', 'time'].indexOf(m) < 0) throw new Error('未知起卦方式 ' + m);
    s.method = m;
    return s;
  }

  function setQuerent(s, v) { s.querent = String(v || '').trim(); return s; }
  function setQuestion(s, v) { s.question = String(v || '').trim(); return s; }
  function setCategory(s, v) { s.category = String(v || '').trim(); return s; }
  function setTimeRange(s, v) { s.timeRange = String(v || '').trim(); return s; }
  function setNumber(s, i, v) { s.numbers[i] = v; return s; }

  /* ============================================================
   * 铜钱：逐轮掷钱
   * ============================================================ */

  /**
   * 只投一轮三枚独立铜钱。
   * 每枚钱独立等概率（背=阳计3，字=阴计2），和值即 6/7/8/9。
   * 严禁先随机爻值再伪造三枚钱面。
   * @param {object} s 会话
   * @param {function} rng 0~1 均匀随机源（测试可注入；生产使用 crypto）
   */
  function rollOnce(s, rng) {
    var idx = s.rounds.findIndex(function (r) { return !r.rolled; });
    if (idx < 0) throw new Error('六轮已完成，如需重掷请先「全部重来」');

    var useRng = rng || Coin.makeRng();
    var coins = [Coin.tossOne(useRng), Coin.tossOne(useRng), Coin.tossOne(useRng)];
    var sum = coins.reduce(function (a, c) { return a + c.value; }, 0);
    var count = coins.filter(function (c) { return c.isYang; }).length;

    var r = s.rounds[idx];
    r.rolled = true;
    r.coins = coins;
    r.value = sum;
    r.count = count;
    r.yang = sum === 7 || sum === 9;
    r.changing = sum === 6 || sum === 9;
    r.name = Coin.YAO_INFO[sum].name;
    // 任何一次新掷钱都使旧结果失效，防止展示陈旧解卦
    s.results.coin = null;
    return r;
  }

  /** 已掷轮次（保持初爻→上爻顺序） */
  function rolledRounds(s) {
    return s.rounds.filter(function (r) { return r.rolled; });
  }

  /** 已掷出的爻值，顺序恒为初爻→上爻 */
  function roundValues(s) {
    return rolledRounds(s).map(function (r) { return r.value; });
  }

  /** 已完成轮数 */
  function coinCompleted(s) { return rolledRounds(s).length; }

  /**
   * 撤销上一轮。
   * 只清除最后一轮，不重掷任何一轮（禁止暗中重掷）。
   */
  function undoRound(s) {
    for (var i = s.rounds.length - 1; i >= 0; i--) {
      if (s.rounds[i].rolled) {
        s.rounds[i] = blankRound(i);
        s.results.coin = null;
        return true;
      }
    }
    return false;
  }

  /** 全部重来：清空六轮与结果 */
  function resetRounds(s) {
    s.rounds = [0, 1, 2, 3, 4, 5].map(blankRound);
    s.results.coin = null;
    return s;
  }

  /** 按钮文案随进度变化 */
  function buttonLabel(s) {
    var n = coinCompleted(s);
    if (n >= 6) return '生成本卦';
    return '掷第' + (n + 1) + '轮 · ' + POS[n] + '爻';
  }

  /** 进度文案 */
  function progressLabel(s) {
    var n = coinCompleted(s);
    return '已完成 ' + n + '/6，还差 ' + (6 - n) + ' 轮';
  }

  /** 生成本卦前的可用性（供界面禁用按钮） */
  function canBuildCoin(s) {
    return coinCompleted(s) === 6;
  }

  /* ============================================================
   * 生成本卦
   * ============================================================ */

  /**
   * 由六轮共同结果生成本卦。
   * 只读六轮，不读第 6 轮单独结果，也不把和值相加成总分。
   */
  function buildCoin(s) {
    if (!canBuildCoin(s)) {
      return {
        error: '完成六轮后生成本卦（当前 ' + coinCompleted(s) + '/6）',
        completed: coinCompleted(s)
      };
    }
    var lines = roundValues(s);      // 恒为初爻→上爻
    Coin.assertValidLines(lines);
    var coins = [];
    s.rounds.forEach(function (r) { coins = coins.concat(r.coins); });   // 18 枚
    var res = {
      method: 'coin',
      lines: lines,
      // 明确声明：内部数据顺序为初爻→上爻；显示时自上而下
      displayOrder: 'initial-to-top',
      displayHint: '数据按「初爻→上爻」记录；界面自上而下绘制时须倒序显示',
      coins: coins.map(function (c) {
        return { isYang: c.isYang, label: c.label, value: c.value, glyph: c.glyph };
      }),
      rounds: s.rounds.map(function (r) {
        return {
          index: r.index, pos: r.pos, posName: r.posName,
          value: r.value, count: r.count, yang: r.yang, changing: r.changing,
          name: r.name,
          coins: r.coins.map(function (c) {
            return { isYang: c.isYang, label: c.label, value: c.value };
          })
        };
      }),
      changingPos: lines.map(function (v, i) { return Coin.lineChanging(v) ? i + 1 : 0; })
        .filter(function (x) { return x > 0; }),
      movingCount: lines.filter(Coin.lineChanging).length
      // 注意：此处刻意不提供任何「总分 / 吉凶分」字段
    };
    s.results.coin = res;
    return res;
  }

  /* ============================================================
   * 三星连珠 / 此刻起卦
   * ============================================================ */

  /**
   * 三星连珠：三个数字起卦。
   * 公式完全复用核心层，界面须展示每一步取余。
   */
  function buildNumbers(s, opt) {
    opt = opt || {};
    var ns = s.numbers.map(function (v) { return parseInt(v, 10); });
    if (ns.some(function (v) { return !isFinite(v) || v < 1; })) {
      return { error: '请填写三个正整数（1~99）' };
    }
    if (typeof LiuYaoRef === 'undefined' || !LiuYaoRef) {
      return { error: '核心层未加载，无法按公式起卦' };
    }
    try {
      var f = LiuYaoRef.numberFormula(ns[0] * 100 + ns[1] * 10 + ns[2]);
      // 逐数取余：三个数分别参与，公式与说明全部落盘
      var steps = [
        '第一数 ' + ns[0] + '、第二数 ' + ns[1] + '、第三数 ' + ns[2],
        '上卦 = (' + ns[0] + '+' + ns[1] + '+' + ns[2] + ') 取 8 余 → ' + f.upNum,
        '下卦 = (上式 + 第一数) 取 8 余 → ' + f.lowNum,
        '动爻 = (' + ns[0] + '+' + ns[1] + '+' + ns[2] + ') 取 6 余 → ' + f.movingPos,
        '先天八卦数：乾1 兑2 离3 震4 巽5 坎6 艮7 坤8；余数为 0 时作 8（动爻作 6）'
      ];
      var res = {
        method: 'numbers',
        numbers: ns,
        lines: f.lines,
        displayOrder: 'initial-to-top',
        up: f.up, low: f.low,
        upNum: f.upNum, lowNum: f.lowNum,
        movingPos: f.movingPos,
        steps: steps,
        formula: f.convention || Q.NUMBER_FORMULA,
        convention: true
      };
      s.results.numbers = res;
      return res;
    } catch (e) {
      return { error: '数字起卦失败：' + (e && e.message || e) };
    }
  }

  /* ============================================================
   * 历法引用（Node 下 require，浏览器下用全局）
   * ============================================================ */

  var _lunar = null;
  function requireLunar() {
    if (_lunar) return _lunar;
    if (typeof Lunar !== 'undefined' && Lunar) { _lunar = { Lunar: Lunar, Solar: Solar }; return _lunar; }
    try {
      if (typeof require === 'function') {
        var m = require('../vendor/lunar.js');
        _lunar = { Lunar: m.Lunar, Solar: m.Solar };
        return _lunar;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /**
   * 取某时刻的农历文本。
   *
   * 【1.6.0 修正】原实现直接引用裸全局 `Lunar`，该标识符在 Node 分支下
   * 不存在，`typeof` 不抛错但恒为 undefined —— 于是「此刻起卦」的结果里
   * 农历字段永远是空串（浏览器下若 lunar.js 尚未执行完毕同样会空）。
   * 这里统一走 requireLunar()，两种环境都能取到历法库。
   */
  function lunarTextOf(d) {
    try {
      var L = requireLunar();
      if (!L || !L.Solar) return '';
      var lunar = L.Solar.fromYmdHms(
        d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), 0
      ).getLunar();
      return lunar ? lunar.toString() : '';
    } catch (e) {
      return '';
    }
  }

  /**
   * 此刻起卦：以点击瞬间的本地时间起卦。
   * 记录北京时间、农历日期、年支序、时支序与完整公式。
   */
  function buildTime(s, date) {
    if (typeof LiuYaoRef === 'undefined' || !LiuYaoRef) {
      return { error: '核心层未加载，无法按公式起卦' };
    }
    var d = date || s.timeInput || new Date();
    try {
      var f = LiuYaoRef.timeFormula(d);
      var lunarText = lunarTextOf(d);
      var res = {
        method: 'time',
        date: d,
        solarText: d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
          String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
        timezone: s.timezone,
        lunarText: lunarText,
        yearZhi: f.yearZhi, yearSeq: f.ySeq,
        hourZhi: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][f.hourZhi] || '',
        hourSeq: f.hSeq,
        lunarMonth: f.lMonth, lunarDay: f.lDay,
        up: f.up, low: f.low, upNum: f.upNum, lowNum: f.lowNum,
        movingPos: f.movingPos,
        lines: f.lines,
        displayOrder: 'initial-to-top',
        formula: f.formula,
        steps: [
          '年支序：子1 … 亥12，本年支「' + f.yearZhi + '」为 ' + f.ySeq,
          '时支序：「' + (['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][f.hourZhi] || '') + '」为 ' + f.hSeq,
          '上卦 = (年支' + f.ySeq + ' + 农历' + f.lMonth + '月 + 农历' + f.lDay + '日) ÷ 8 余 ' + f.upNum,
          '下卦 = (上式 + 时支' + f.hSeq + ') ÷ 8 余 ' + f.lowNum,
          '动爻 = (年支 + 月 + 日 + 时支) ÷ 6 余 ' + f.movingPos,
          '动爻取值：阳爻动取老阳 9，阴爻动取老阴 6（合法爻值，不使用 0/5）'
        ],
        source: '《梅花易数》年月日时法；动爻阴阳取 9/6 为对应约定'
      };
      s.results.time = res;
      s.timeInput = d;
      return res;
    } catch (e) {
      return { error: '此刻起卦失败：' + (e && e.message || e) };
    }
  }

  /* ============================================================
   * 重置语义（审计七）
   * ============================================================ */

  /**
   * 同一人另问一事：保留称呼，清空问题/类别/时间范围/六轮/结果，生成新 castId。
   */
  function resetForNewQuestion(s) {
    var keep = s.querent;
    var keepTz = s.timezone;
    var fresh = newSession({ querent: keep, timezone: keepTz, method: s.method });
    Object.keys(fresh).forEach(function (k) { s[k] = fresh[k]; });
    return s;
  }

  /**
   * 为另一人重新起卦：清空称呼与全部内容，生成新 castId，从第 1 轮初爻开始。
   */
  function resetForAnotherPerson(s) {
    var keepTz = s.timezone;
    var fresh = newSession({ timezone: keepTz, method: s.method });
    Object.keys(fresh).forEach(function (k) { s[k] = fresh[k]; });
    return s;
  }

  /**
   * 未完成六轮就离开时的处理选项。
   * @returns {{needPrompt:boolean, options:string[], completed:number}}
   */
  function leaveOptions(s) {
    var n = coinCompleted(s);
    return {
      needPrompt: n > 0 && n < 6,
      options: ['saveDraft', 'discard'],
      completed: n,
      message: n > 0 && n < 6
        ? '本次已掷 ' + n + '/6 轮，尚未生成本卦。是否保存草稿以便下次继续？'
        : ''
    };
  }

  /** 保存草稿（含 castId，恢复后沿用同一编号） */
  function saveDraft(s) {
    return {
      castId: s.castId,
      method: s.method,
      querent: s.querent,
      question: s.question,
      category: s.category,
      timeRange: s.timeRange,
      timezone: s.timezone,
      rounds: s.rounds.map(function (r) { return r.rolled ? deepCopy(r) : null; }),
      numbers: s.numbers.slice(),
      savedAt: new Date().toISOString()
    };
  }

  /** 恢复草稿 */
  function loadDraft(s, draft) {
    if (!draft) return s;
    s.castId = draft.castId || s.castId;
    s.method = draft.method || s.method;
    s.querent = draft.querent || '';
    s.question = draft.question || '';
    s.category = draft.category || '';
    s.timeRange = draft.timeRange || '';
    s.timezone = draft.timezone || s.timezone;
    s.numbers = (draft.numbers || ['', '', '']).slice();
    s.rounds = restoreRounds(draft);
    s.results = { coin: null, numbers: null, time: null };
    return s;
  }

  /**
   * 由存档还原六轮槽位。
   * 优先读 draft.rounds；旧版存档无此字段时，退化为由 rawCoins + lines 重建，
   * 保证「历史存档」与「新存档」都能 100% 复原，绝不在恢复时重新随机。
   */
  function restoreRounds(draft) {
    if (draft && Array.isArray(draft.rounds) && draft.rounds.length) {
      return [0, 1, 2, 3, 4, 5].map(function (i) {
        var r = draft.rounds[i];
        return r ? deepCopy(r) : blankRound(i);
      });
    }
    // 旧版存档回退路径：rawCoins[6][3] + lines[6]
    var rawCoins = draft && draft.rawCoins;
    var lines = (draft && draft.lines) || [];
    if (Array.isArray(rawCoins) && rawCoins.length === 6 && lines.length === 6) {
      return recordRounds({}, { lines: lines }, rawCoins);
    }
    return [0, 1, 2, 3, 4, 5].map(blankRound);
  }

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  /* ============================================================
   * 存档与复盘（审计七、十一）
   * ============================================================ */

  /**
   * 把一次完整起卦序列化为不可变记录。
   * 原始 18 枚钱面必须落盘，复盘不得再随机。
   */
  function serializeRecord(s, built) {
    if (!built || !Array.isArray(built.lines)) {
      throw new Error('无法存档：尚未生成本卦（缺少 lines）');
    }
    // 逐轮还原，统一走 rawCoins（唯一可信来源），不以界面缓存为准
    var rawCoins = recordRawCoins(s, built);
    var rounds = recordRounds(s, built, rawCoins);
    return {
      castId: s.castId,
      algorithmVersion: RT.ALGO_VERSION,
      method: built.method,
      querent: s.querent,
      question: s.question,
      category: s.category,
      timeRange: s.timeRange,
      timezone: s.timezone,
      castTime: s.castTime || new Date().toISOString(),
      lines: built.lines.slice(),
      // 六轮 × 3 枚 的原始钱面（初爻→上爻）
      rawCoins: rawCoins,
      coins18: (built.coins || []).map(function (c) { return c.label + c.value; }),
      // 与 loadDraft / buildCoin 完全同形的六轮槽位，确保「存档 → 恢复」无形状损耗
      rounds: rounds,
      // 三数 / 时间 的原始输入
      rawNumbers: built.method === 'numbers' ? (built.numbers || []).slice() : null,
      rawTimeInput: built.method === 'time' ? (built.date instanceof Date ? built.date.toISOString() : null) : null,
      formula: built.formula || null,
      steps: built.steps || null,
      displayOrder: 'initial-to-top'
    };
  }

  /** 从会话或生成结果取出 6×3 原始钱面（初爻→上爻） */
  function recordRawCoins(s, built) {
    var src = (built && built.rounds) || null;
    if (!src || src.length !== 6) {
      src = (s && s.rounds) || [];
    }
    var out = [];
    for (var i = 0; i < 6; i++) {
      var r = src[i] || {};
      var coins = r.coins || [];
      if (coins.length !== 3) {
        throw new Error('无法存档：第 ' + (i + 1) + ' 轮缺少 3 枚钱面');
      }
      out.push(coins.map(function (c) {
        return { isYang: c.isYang, label: c.label, value: c.value };
      }));
    }
    return out;
  }

  /** 由原始钱面重建六轮槽位（与 blankRound / buildCoin.rounds 同形） */
  function recordRounds(s, built, rawCoins) {
    var lines = built.lines || [];
    var src = (built && built.rounds) || (s && s.rounds) || [];
    return [0, 1, 2, 3, 4, 5].map(function (i) {
      var v = lines[i];
      var coins = rawCoins[i].map(function (c) {
        return { isYang: c.isYang, label: c.label, value: c.value };
      });
      var old = src[i] || {};
      return {
        index: i + 1,
        pos: i + 1,
        posName: POS[i],
        rolled: true,
        coins: coins,
        value: v,
        count: coins.filter(function (c) { return c.isYang; }).length,
        yang: Coin.lineYang(v),
        changing: Coin.lineChanging(v),
        name: Coin.YAO_INFO[v].name
      };
    });
  }

  /**
   * 复盘：使用已保存的原始记录重算。
   * 严禁重新随机 —— 完全由存档中的 rawCoins / lines 还原。
   */
  function replayRecord(record) {
    if (!record) throw new Error('复盘记录为空');
    var lines = (record.lines || []).slice();
    Coin.assertValidLines(lines);
    // 若存档带原始钱面，逐枚以「存档中的钱面」重建，绝不调用随机源
    var coins = [];
    if (Array.isArray(record.rawCoins) && record.rawCoins.length === 6) {
      record.rawCoins.forEach(function (three, i) {
        var sum = three.reduce(function (a, c) { return a + c.value; }, 0);
        if (sum !== lines[i]) {
          throw new Error('存档损坏：第 ' + (i + 1) + ' 轮钱面之和 ' + sum + ' 与爻值 ' + lines[i] + ' 不一致');
        }
        three.forEach(function (c) { coins.push({ isYang: c.isYang, label: c.label, value: c.value }); });
      });
    } else {
      lines.forEach(function (v) {
        var l = Coin.buildFromValue(v);
        coins = coins.concat(l.coins);
      });
    }
    return {
      castId: record.castId,
      algorithmVersion: record.algorithmVersion,
      lines: lines,
      coins: coins,
      rounds: lines.map(function (v, i) {
        var three = coins.slice(i * 3, i * 3 + 3);
        return {
          index: i + 1, pos: i + 1, posName: POS[i],
          value: v, count: three.filter(function (c) { return c.isYang; }).length,
          yang: Coin.lineYang(v), changing: Coin.lineChanging(v),
          name: Coin.YAO_INFO[v].name, coins: three
        };
      }),
      changingPos: lines.map(function (v, i) { return Coin.lineChanging(v) ? i + 1 : 0; })
        .filter(function (x) { return x > 0; }),
      deterministic: true
    };
  }

  /* ============================================================
   * InputRecord 转换（审计十一）
   * ============================================================ */

  /**
   * 由会话与生成结果构造不可变 InputRecord。
   * 同时携带 rawCoins[6][3] 与 confirmedQuestionStructure。
   */
  function toInputRecord(s, built) {
    var qs = Q.analyze(s.question);
    qs.confirmed = true;
    qs.goal = s.question;
    qs.timeRange = s.timeRange || null;
    qs.subject = s.querent || null;

    return new RT.InputRecord({
      castId: s.castId,
      system: RT.SYSTEM.LIUYAO,
      method: methodLabel(built.method),
      questionRaw: s.question,
      querent: s.querent,
      category: s.category,
      timeRange: s.timeRange,
      timezone: s.timezone,
      castTime: s.castTime || new Date().toISOString(),
      question: qs,
      questionConfirmed: true,
      confirmedQuestionStructure: qs,
      cast: {
        lines: built.lines.slice(),
        // 审计要求：rawCoins[6][3]
        rawCoins: (built.rounds || []).map(function (r) {
          return r.coins.map(function (c) {
            return { isYang: c.isYang, label: c.label, value: c.value };
          });
        }),
        coins18: (built.coins || []).map(function (c) { return c.label + c.value; }),
        numbers: built.method === 'numbers' ? (built.numbers || []).slice() : null,
        timeInput: built.method === 'time' ? built : null,
        formula: built.formula || null
      },
      establishedAt: new Date().toISOString()
    });
  }

  function methodLabel(m) {
    var hit = METHODS.filter(function (x) { return x.key === m; })[0];
    return hit ? hit.label : m;
  }

  /* ============================================================
   * 问题质量提示（审计二）
   * ============================================================ */

  /**
   * 问题过于宽泛时提示用户补充主体、对象、目标和时间范围。
   * 同时确保「求测人称呼」不被误当作问题正文。
   */
  function questionAdvice(raw, querent) {
    var text = String(raw || '').trim();
    var q = String(querent || '').trim();
    var hints = [];
    var needMore = false;

    if (!text) {
      return {
        needMore: true,
        hints: ['请填写所问事项本身（称呼请填在「求测人称呼」栏，不要写进问题）'],
        reason: '问题为空'
      };
    }
    // 称呼被误当作问题正文
    if (q && text === q) {
      return {
        needMore: true,
        hints: ['「' + q + '」是求测人称呼，不是所问事项',
                '请补充主体、对象、目标和时间范围，例如「未来三个月这个项目能否签约」'],
        reason: '把称呼当成了问题正文'
      };
    }
    // 过于宽泛
    var vague = [
      /^能否/, /^可以吗/, /^行不行/, /^成功吗/, /^顺不顺利/, /^会怎样/, /^怎么样$/,
      /^好不好$/, /^如何$/, /^测一下$/, /^看看$/
    ];
    if (text.length <= 6 || vague.some(function (r) { return r.test(text); })) {
      needMore = true;
    }
    // 缺少时间范围
    var hasRange = /(个月|月|天|周|星期|年|季度|内|前|底|初|之前|多久|什么时候)/.test(text)
      || !!q && false;
    if (needMore || !hasRange) {
      hints = [
        '主体：谁在问（本人 / 对方 / 双方）',
        '对象：所问的具体人或事，例如「这个项目」「与某人的合作」',
        '目标：想得到什么结果，例如「能否签约」「能否回款」',
        '时间范围：例如「未来三个月」'
      ];
      if (!needMore && !hasRange) {
        needMore = true;
        hints.unshift('问题缺少明确的时间范围，建议补充');
      }
      return { needMore: needMore, hints: hints, reason: needMore ? '问题信息不足' : '' };
    }
    return { needMore: false, hints: [], reason: '' };
  }

  return {
    POS: POS,
    METHODS: METHODS,
    methodLabel: methodLabel,

    newSession: newSession,
    setMethod: setMethod,
    setQuerent: setQuerent,
    setQuestion: setQuestion,
    setCategory: setCategory,
    setTimeRange: setTimeRange,
    setNumber: setNumber,

    rollOnce: rollOnce,
    rolledRounds: rolledRounds,
    roundValues: roundValues,
    coinCompleted: coinCompleted,
    undoRound: undoRound,
    resetRounds: resetRounds,
    buttonLabel: buttonLabel,
    progressLabel: progressLabel,
    canBuildCoin: canBuildCoin,

    buildCoin: buildCoin,
    buildNumbers: buildNumbers,
    buildTime: buildTime,

    resetForNewQuestion: resetForNewQuestion,
    resetForAnotherPerson: resetForAnotherPerson,
    leaveOptions: leaveOptions,
    saveDraft: saveDraft,
    loadDraft: loadDraft,

    serializeRecord: serializeRecord,
    replayRecord: replayRecord,
    toInputRecord: toInputRecord,

    questionAdvice: questionAdvice,

    setLiuYao: setLiuYao,
    ALGO_VERSION: RT.ALGO_VERSION
  };
});
