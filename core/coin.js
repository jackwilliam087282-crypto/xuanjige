/**
 * core/coin.js —— 三钱六爻：18 枚铜钱的真实生成与校验
 *
 * 审计要求（三、1/2/3）：
 *   1. 每一爻真实生成三枚独立铜钱，共 18 个面；每枚钱明确字/背与数值，
 *      再求和得到 6/7/8/9。不得先抽爻值再反推钱面。
 *   2. 概率必须为 1:3:3:1。
 *   3. 时间起卦：阳爻动用 9，阴爻动用 6；统一合法性验证，拒绝 0/5。
 *
 * 三钱法（standard three-coin method）：
 *   每枚铜钱正面=阳(3)，反面=阴(2)，共 2^3=8 种等可能组合。
 *   三背   = 9 老阳（阳动）  概率 1/8 = 12.5%
 *   两背一反 = 7 少阳        概率 3/8 = 37.5%
 *   一背两反 = 8 少阴        概率 3/8 = 37.5%
 *   三反   = 6 老阴（阴动）  概率 1/8 = 12.5%
 * 来源：《周易·系辞》「一阴一阳之谓道」；三钱六爻通行法。
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CoinCast = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  /** 合法爻值：仅 6/7/8/9 */
  var VALID_YAO = [6, 7, 8, 9];
  var YAO_INFO = {
    6: { name: '老阴', yang: false, changing: true, symbol: '⚋ ✕', mark: '○', desc: '阴极而动，阴变阳' },
    7: { name: '少阳', yang: true, changing: false, symbol: '⚊', mark: '', desc: '阳而不动' },
    8: { name: '少阴', yang: false, changing: false, symbol: '⚋', mark: '', desc: '阴而不动' },
    9: { name: '老阳', yang: true, changing: true, symbol: '⚊ ○', mark: '○', desc: '阳极而动，阳变阴' },
  };

  /**
   * 取得 0~1 之间的均匀随机源。
   * 优先使用 crypto.getRandomValues（可注入，便于测试与复盘）；
   * 若不可用则退化为 Math.random。
   */
  function makeRng(cryptoObj) {
    var c = cryptoObj || (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
    if (c && typeof c.getRandomValues === 'function') {
      return function () {
        var u32 = new Uint32Array(1);
        c.getRandomValues(u32);
        return u32[0] / 4294967296;
      };
    }
    return function () { return Math.random(); };
  }

  /**
   * 掷一枚铜钱
   * @returns {{side:number, isYang:boolean, label:string, value:number}}
   *   isYang=true  → 背面（阳面），计 3
   *   isYang=false → 字面（阴面），计 2
   */
  function tossOne(rng) {
    var isYang = rng() < 0.5;             // 每枚独立等概率
    return {
      isYang: isYang,
      label: isYang ? '背' : '字',          // 背为阳面 3，字为阴面 2
      value: isYang ? 3 : 2,
      glyph: isYang ? '●' : '○'
    };
  }

  /**
   * 掷一爻（三枚独立铜钱）
   * @returns {{value:number, coins:Array, yang:boolean, changing:boolean, count:number}}
   */
  function tossOneLine(rng) {
    var coins = [tossOne(rng), tossOne(rng), tossOne(rng)];
    var sum = coins.reduce(function (a, c) { return a + c.value; }, 0); // 6/7/8/9
    var count = coins.filter(function (c) { return c.isYang; }).length;   // 背的个数 0~3
    return {
      value: sum,
      coins: coins,
      count: count,
      yang: sum === 7 || sum === 9,      // 少阳/老阳为阳
      changing: sum === 6 || sum === 9,  // 老阴/老阳为动
      name: YAO_INFO[sum].name
    };
  }

  /**
   * 完整起卦：六爻 × 三钱 = 18 枚铜钱
   * @param {object} opt
   *   rng      随机源（不传则用 crypto）
   *   fromTop  是否自上而下（默认 true，六爻由上至下）
   *   fixed    预置爻值数组（时间/数字起卦时使用；值域 6/7/8/9）
   */
  function cast(opt) {
    opt = opt || {};
    var rng = opt.rng || makeRng(opt.crypto);
    var lines = [];
    var i;

    if (opt.fixed && opt.fixed.length) {
      // 确定性起卦：外部给定 6/7/8/9，但必须为每爻构造合法的三钱面
      for (i = 0; i < 6; i++) {
        var v = Number(opt.fixed[i]);
        if (YAO_INFO[v] === undefined) {
          throw new Error('非法爻值 ' + v + '，只允许 6/7/8/9');
        }
        lines.push(buildFromValue(v));
      }
    } else {
      for (i = 0; i < 6; i++) lines.push(tossOneLine(rng));
    }

    // 六爻数组以「初爻在下」为索引 0；显示时自上而下
    if (opt.fromTop === false) { /* 保持索引 0=初爻 */ }

    return {
      lines: lines,
      changingCount: lines.filter(function (l) { return l.changing; }).length,
      coins: lines.reduce(function (a, l) { return a.concat(l.coins); }, []) // 18 枚
    };
  }

  /**
   * 由确定爻值构造合法的三钱面。
   *
   * 计值约定（审计第五、六章）：背为阳计 3，字为阴计 2；
   * 三枚钱面之和 = 6 + 背数。因此：
   *   6 = 三字（0 背）  7 = 一背两字（1 背）
   *   8 = 两背一字（2 背） 9 = 三背（3 背）
   * 用固定顺序保证同一爻值永远得到同一钱面，可复现。
   */
  function buildFromValue(v) {
    var yangs = { 6: 0, 7: 1, 8: 2, 9: 3 }[v];
    if (yangs === undefined) {
      throw new Error('非法爻值 ' + v + '，只允许 6/7/8/9');
    }
    var coins = [];
    for (var i = 0; i < 3; i++) {
      var isYang = i < yangs;
      coins.push({
        isYang: isYang,
        label: isYang ? '背' : '字',
        value: isYang ? 3 : 2,
        glyph: isYang ? '●' : '○'
      });
    }
    return {
      value: v, coins: coins, count: yangs,
      yang: v === 7 || v === 9,
      changing: v === 6 || v === 9,
      name: YAO_INFO[v].name
    };
  }

  /* ============================================================
   * 合法性验证 —— 统一 lineYang / lineChanging，拒绝 0/5 等非法值
   * ============================================================ */

  function isValidYao(v) { return YAO_INFO[v] !== undefined; }
  function lineYang(v) { return v === 7 || v === 9; }
  function lineChanging(v) { return v === 6 || v === 9; }

  /** 批量验证，非法即抛错 */
  function assertValidLines(lines) {
    if (!Array.isArray(lines) || lines.length !== 6) {
      throw new Error('爻数组长度必须为 6，实际 ' + (lines ? lines.length : 'null'));
    }
    lines.forEach(function (v, i) {
      if (!isValidYao(v)) {
        throw new Error('第' + (i + 1) + '爻值 ' + v + ' 非法，只允许 6/7/8/9');
      }
    });
    return true;
  }

  /**
   * 时间/数字起卦的动爻取值规则：
   *   阳爻（阳）动用 → 老阳 9
   *   阴爻（阴）动用 → 老阴 6
   * 审计要求三、3 明确规定此约定。
   */
  function movingValue(isYang) { return isYang ? 9 : 6; }

  /**
   * 由「本卦爻位 + 动爻序号」构造合法六爻数组。
   * @param {Array<boolean>} yangFlags 长度 6，true=阳爻（索引 0 为初爻）
   * @param {number} movingPos 1~6，1 为初爻
   */
  function buildFromMoving(yangFlags, movingPos) {
    var lines = [];
    for (var i = 0; i < 6; i++) {
      if (i === movingPos - 1) lines.push(movingValue(yangFlags[i]));
      else lines.push(yangFlags[i] ? 7 : 8);
    }
    return lines;
  }

  /**
   * 概率自检：蒙特卡洛验证 1:3:3:1（供测试与界面「算法说明」引用）
   * @param {number} n 采样数
   */
  function monteCarlo(n, rng) {
    n = n || 1000000;
    var r = rng || makeRng();
    var cnt = { 6: 0, 7: 0, 8: 0, 9: 0 };
    for (var i = 0; i < n; i++) cnt[tossOneLine(r).value]++;
    var p = {};
    ['6', '7', '8', '9'].forEach(function (k) { p[k] = cnt[k] / n; });
    // 卡方检验，df=3，显著性 0.01 的临界值 11.345
    var exp = { 6: 0.125, 7: 0.375, 8: 0.375, 9: 0.125 };
    var chi = 0;
    ['6', '7', '8', '9'].forEach(function (k) {
      var e = exp[k] * n;
      chi += Math.pow(cnt[k] - e, 2) / e;
    });
    return {
      n: n, count: cnt, p: p, expected: exp,
      chiSquare: Math.round(chi * 1000) / 1000,
      chiSquareDf: 3,
      chiSquareCritical001: 11.345,
      pass: chi < 11.345
    };
  }

  return {
    VALID_YAO: VALID_YAO,
    YAO_INFO: YAO_INFO,
    makeRng: makeRng,
    tossOne: tossOne,
    tossOneLine: tossOneLine,
    buildFromValue: buildFromValue,
    buildFromMoving: buildFromMoving,
    cast: cast,
    isValidYao: isValidYao,
    lineYang: lineYang,
    lineChanging: lineChanging,
    assertValidLines: assertValidLines,
    movingValue: movingValue,
    monteCarlo: monteCarlo,
    PROBABILITY: '1:3:3:1'
  };
});
