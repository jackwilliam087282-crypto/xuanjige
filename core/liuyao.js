/**
 * core/liuyao.js —— 六爻统一入口（四层流水线）
 *
 * InputRecord → CalculationResult → RuleTrace[] → Interpretation
 *
 * 所有起卦方式（铜钱/时间/数字）统一走此入口，
 * 保证：相同 InputRecord ⇒ 完全相同结果。
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./trace.js'), require('./coin.js'),
      require('./liuyao-chart.js'), require('./liuyao-interpret.js'),
      require('./question.js'),
      root                                  // 传入宿主对象，供自我注册使用
    );
  } else {
    root.LiuYao = factory(root.RuleTrace, root.CoinCast, root.LiuYaoChart, root.LiuYaoInterpret, root.QuestionStruct, root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this,
function (RT, Coin, Chart, Interp, Q, root) {
  'use strict';

  /**
   * 铜钱起卦
   * @param {object} o { date, question, gender, rng }
   *   若已保存 cast（原始 18 钱面），复盘时直接复用，不得再次随机。
   */
  function byCoin(o) {
    o = o || {};
    var cast;
    if (o.cast) {
      /* 复盘路径：使用已保存的原始随机值，绝不重新随机。
       * 兼容两种存档形态：
       *   { lines:[6,7,8,9,7,8], coins:[{label,isYang,value}×18] }
       *   [6,7,8,9,7,8]
       */
      if (Array.isArray(o.cast)) {
        cast = { lines: Coin.buildFromMoving ? null : null, coins: [] };
        cast.lines = o.cast.map(function (v) { return Coin.buildFromValue(v); });
        cast.coins = cast.lines.reduce(function (a, l) { return a.concat(l.coins); }, []);
      } else if (Array.isArray(o.cast.lines)) {
        var ls = o.cast.lines.map(function (l) {
          return (l && typeof l === 'object') ? l.value : l;
        });
        Coin.assertValidLines(ls);
        cast = { lines: ls.map(function (v) { return Coin.buildFromValue(v); }), coins: [] };
        // 若存档中保存了 18 枚原始钱面，一并还原（用于界面展示与核验）
        if (Array.isArray(o.cast.coins) && o.cast.coins.length === 18) {
          cast.coins = o.cast.coins;
        } else {
          cast.coins = cast.lines.reduce(function (a, l) { return a.concat(l.coins); }, []);
        }
      } else {
        throw new Error('cast 存档格式不正确：需包含 lines 数组');
      }
    } else {
      cast = Coin.cast({ rng: o.rng, crypto: o.crypto });
    }

    var input = new RT.InputRecord({
      system: RT.SYSTEM.LIUYAO,
      method: '铜钱起卦（三钱六爻）',
      questionRaw: o.question || '',
      birth: null,
      // 原始随机值落盘：18 枚钱面 + 6 个爻值
      cast: {
        coins: cast.coins.map(function (c) {
          return (c && typeof c === 'object') ? { label: c.label, isYang: c.isYang, value: c.value } : c;
        }),
        lines: cast.lines.map(function (l) {
          return (l && typeof l === 'object') ? l.value : l;
        })
      }
    });
    return pipeline(input, {
      lines: cast.lines.map(function (l) { return l.value; }),
      coins: cast.coins,
      date: o.date || new Date()
    });
  }

  /**
   * 时间起卦（《梅花易数》年月日时法）
   * 修复要点：动爻取 6/9，不再传 0/5。
   */
  function byTime(o) {
    o = o || {};
    var d = o.date || new Date();
    var f = timeFormula(d);
    var lines = Coin.buildFromMoving(f.yangFlags, f.movingPos);
    var input = new RT.InputRecord({
      system: RT.SYSTEM.LIUYAO,
      method: '时间起卦（梅花易数年月日时法）',
      questionRaw: o.question || '',
      cast: { lines: lines, timeGua: f }
    });
    return pipeline(input, { lines: lines, date: d, methodDetail: f });
  }

  /**
   * 时间起卦的公式计算（公开以便界面展示与测试）
   * @param {Date} d
   */
  function timeFormula(d) {
    var LunarLib = Chart.LunarRef;
    var L = require_lunar();
    var lunar = L.Solar.fromYmdHms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), 0).getLunar();
    var ZHI_SEQ = { 子: 1, 丑: 2, 寅: 3, 卯: 4, 辰: 5, 巳: 6, 午: 7, 未: 8, 申: 9, 酉: 10, 戌: 11, 亥: 12 };
    var yearZhi = lunar.getYearZhi();
    var ySeq = ZHI_SEQ[yearZhi] || 1;
    var lMonth = Math.abs(lunar.getMonth());
    var lDay = lunar.getDay();
    // 23:00 起为子时
    var hourZhiIdx = Math.floor(((d.getHours() + 1) % 24) / 2);
    var hSeq = hourZhiIdx + 1;

    var XIAN_TIAN = ['', '乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
    var sumUp = ySeq + lMonth + lDay;
    var sumLow = sumUp + hSeq;
    var upNum = sumUp % 8 || 8;
    var lowNum = sumLow % 8 || 8;
    var movingPos = sumLow % 6 || 6;

    var up = XIAN_TIAN[upNum];
    var low = XIAN_TIAN[lowNum];

    // 由上下卦求六爻阴阳（索引 0 = 初爻）
    var BITS = { 乾: 7, 兑: 6, 离: 5, 震: 4, 巽: 3, 坎: 2, 艮: 1, 坤: 0 };
    var upBits = BITS[up], lowBits = BITS[low];
    var yangFlags = [];
    for (var i = 0; i < 3; i++) yangFlags.push(!!(lowBits & (4 >> i)));
    for (var j = 0; j < 3; j++) yangFlags.push(!!(upBits & (4 >> j)));

    return {
      up: up, low: low, upNum: upNum, lowNum: lowNum,
      movingPos: movingPos,
      ySeq: ySeq, lMonth: lMonth, lDay: lDay, hSeq: hSeq,
      yearZhi: yearZhi, hourZhi: hourZhiIdx,
      yangFlags: yangFlags,
      lines: Coin.buildFromMoving(yangFlags, movingPos),
      formula: '农历' + lMonth + '月' + lDay + '日·' + hourZhiIdx + '时辰，年支' + yearZhi + '（' + ySeq + '）' +
        '　上卦＝(' + ySeq + '+' + lMonth + '+' + lDay + ')÷8余' + upNum + '＝' + up +
        '　下卦＝上式+' + hSeq + '÷8余' + lowNum + '＝' + low +
        '　动爻＝(' + ySeq + '+' + lMonth + '+' + lDay + '+' + hSeq + ')÷6余' + movingPos +
        '　动爻取' + (yangFlags[movingPos - 1] ? '老阳9' : '老阴6')
    };
  }

  /**
   * 数字起卦（本软件约定，界面须明示公式）
   * @param {number|string} n
   */
  function byNumber(o) {
    o = o || {};
    var n = Number(o.number);
    var f = numberFormula(n);
    var input = new RT.InputRecord({
      system: RT.SYSTEM.LIUYAO,
      method: '数字起卦（本软件约定）',
      questionRaw: o.question || '',
      cast: { lines: f.lines, number: n, formula: Q.NUMBER_FORMULA }
    });
    return pipeline(input, { lines: f.lines, date: o.date || new Date(), methodDetail: f });
  }

  function numberFormula(n) {
    var XIAN_TIAN = ['', '乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
    var up, low, movingPos, desc;
    var s = String(Math.abs(Math.floor(n)));
    if (s.length === 1) {
      up = XIAN_TIAN[n % 8 || 8];
      low = XIAN_TIAN[Math.floor(n / 8) || (n % 8 || 8)];
      movingPos = n % 6 || 6;
      desc = '单一数字 ' + n;
    } else {
      var a = Number(s[0]), b = Number(s[1]);
      up = XIAN_TIAN[(a + b) % 8 || 8];
      low = XIAN_TIAN[(a + b + a) % 8 || 8];
      movingPos = (a + b) % 6 || 6;
      desc = '两位数 ' + s + '（' + a + '+' + b + '）';
    }
    var BITS = { 乾: 7, 兑: 6, 离: 5, 震: 4, 巽: 3, 坎: 2, 艮: 1, 坤: 0 };
    var upBits = BITS[up], lowBits = BITS[low];
    var yangFlags = [];
    for (var i = 0; i < 3; i++) yangFlags.push(!!(lowBits & (4 >> i)));
    for (var j = 0; j < 3; j++) yangFlags.push(!!(upBits & (4 >> j)));
    return {
      up: up, low: low, movingPos: movingPos, yangFlags: yangFlags,
      lines: Coin.buildFromMoving(yangFlags, movingPos),
      desc: desc, n: n,
      convention: Q.NUMBER_FORMULA
    };
  }

  /* 历法引用（Node 下 require，浏览器下用全局） */
  var _lunar = null;
  function require_lunar() {
    if (_lunar) return _lunar;
    if (typeof require === 'function') { _lunar = require('../vendor/lunar.js'); return _lunar; }
    _lunar = { Solar: root_Solar() };
    return _lunar;
  }
  function root_Solar() {
    return (typeof globalThis !== 'undefined' && globalThis.Solar) ? globalThis.Solar : null;
  }

  /**
   * 统一流水线
   */
  function pipeline(input, o) {
    // 问题结构化
    var qs = Q.analyze(input.questionRaw);
    if (o.questionConfirmed) { qs.confirmed = true; }
    var pick = Q.pickYong(qs);

    // 第二层：确定性盘面
    var calc = new RT.CalculationResult(RT.SYSTEM.LIUYAO);
    var chart = Chart.build({
      lines: o.lines,
      date: o.date,
      yong: pick.yong || '木'
    });
    calc.setFact('gua', {
      pure: chart.pureName, changed: chart.changedName, hu: chart.huName,
      cuo: chart.cuoName, zong: chart.zongName,
      up: chart.upTrigram, low: chart.lowTrigram
    });
    calc.setFact('palace', chart.palace);
    calc.setFact('lines', chart.lines);
    calc.setFact('yaos', chart.yaos.map(function (y) {
      return {
        pos: y.pos, gz: y.ganZhi, liuqin: y.liuqin, liushen: y.liushen,
        moving: y.moving, bian: y.bianGanZhi || null, shi: y.isShi, you: y.isYou
      };
    }));
    calc.setFact('calendar', {
      day: chart.dayGZ, month: chart.monthGZ, year: chart.yearGZ,
      xunKong: chart.xunKong, yuePo: chart.yuePo
    });
    calc.setFact('yongPick', pick);
    calc.setFact('questionStruct', qs);
    if (o.coins) {
      calc.setFact('coins18', o.coins.map(function (c) { return c.label + c.value; }));
    }
    if (o.methodDetail) calc.setFact('methodDetail', o.methodDetail);

    // 第三层 + 第四层
    var interp = Interp.interpret(chart, { yongPick: pick });
    calc.traces = interp.traces;

    return {
      input: input,
      calculation: calc,
      chart: chart,
      interpretation: interp,
      yongPick: pick,
      questionStruct: qs,
      // 便捷导出
      export: function () { return RT.exportDerivation(input, calc, interp); }
    };
  }

  var api = {
    byCoin: byCoin,
    byTime: byTime,
    byNumber: byNumber,
    timeFormula: timeFormula,
    numberFormula: numberFormula,
    pipeline: pipeline,
  };

  /* 自我注册：把本模块注入 core/casting.js，避免循环 require。
   *
   * 【1.6.0 修正】原实现直接引用自由变量 `CastingState`，在 Node 分支下
   * 该标识符不存在，`typeof` 虽不抛错但恒为 undefined，导致 setLiuYao
   * 永远不会被调用 —— casting.js 的 buildNumbers/buildTime 会一直报
   * 「核心层未加载，无法按公式起卦」。这里改为显式从 root 上取，
   * 两种环境都能正确注入。
   */
  try {
    var _cs = (root && root.CastingState) ? root.CastingState : null;
    if (_cs && typeof _cs.setLiuYao === 'function') {
      _cs.setLiuYao(api);
    }
  } catch (e) { /* 核心层缺失时静默降级 */ }

  return api;
});
