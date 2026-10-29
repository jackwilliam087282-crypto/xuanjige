/**
 * core/bridge.js —— 旧模块与新核心层的桥接
 *
 * 作用：让 deep-yi.js / jg-divine.js 等既有模块在不重写的前提下，
 * 接入 1.5.0 的四层架构（InputRecord / CalculationResult / RuleTrace / Interpretation）。
 *
 * 硬约束：
 *   - 本地引擎是唯一计算来源，AI 不得起卦、改盘、改分数、造应期；
 *   - 若核心层不可用，降级为仅返回原有结果，不得抛错阻断界面。
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./trace.js'), require('./liuyao.js'),
      require('./liuyao-chart.js'), require('./question.js'),
      require('./gua-text.js')
    );
  } else {
    root.LiuYaoCore = factory(root.RuleTrace, root.LiuYao, root.LiuYaoChart, root.QuestionStruct, root.GuaText);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this,
function (RT, LY, Chart, Q, GuaText) {
  'use strict';

  /**
   * 把 divination() 的结果接入四层架构
   * @param {object} result divination() 返回对象（会被就地增强）
   * @param {object} o { lines, guaName, changedName, question, date, coins }
   */
  function attach(result, o) {
    o = o || {};
    var lines = (o.lines || result.lines || []).map(function (v) {
      return typeof v === 'number' ? v : v.value;
    });
    if (lines.length !== 6) return result;

    var input = new RT.InputRecord({
      system: RT.SYSTEM.LIUYAO,
      method: result.method || '铜钱起卦（三钱六爻）',
      questionRaw: o.question || result.question || '',
      cast: {
        lines: lines,
        coins: o.coins ? o.coins.map(function (c) { return c.label + c.value; }) : null
      }
    });

    // 问题结构化（未确认状态）
    var qs = Q.analyze(input.questionRaw);
    var pick = Q.pickYong(qs);

    // 第二层：确定性盘面
    var calc = new RT.CalculationResult(RT.SYSTEM.LIUYAO);
    var chart = Chart.build({
      lines: lines,
      date: o.date || new Date(),
      yong: pick.yong || '木'
    });
    calc.setFact('gua', {
      pure: chart.pureName, changed: chart.changedName, hu: chart.huName,
      cuo: chart.cuoName, zong: chart.zongName
    });
    calc.setFact('palace', chart.palace);
    calc.setFact('lines', lines);
    calc.setFact('yaos', chart.yaos.map(function (y) {
      return {
        pos: y.pos, gz: y.ganZhi, liuqin: y.liuqin, liushen: y.liushen,
        moving: y.moving, bian: y.bianGanZhi || null,
        shi: y.isShi, you: y.isYou, xianKong: y.xianKong, yuePo: y.yuePo
      };
    }));
    calc.setFact('calendar', {
      day: chart.dayGZ, month: chart.monthGZ, year: chart.yearGZ,
      xunKong: chart.xunKong, yuePo: chart.yuePo
    });
    calc.setFact('yongPick', pick);
    calc.setFact('questionStruct', qs);

    // 第三层 + 第四层
    var Interp = typeof LiuYaoInterpretRef !== 'undefined' ? LiuYaoInterpretRef : null;
    var interp = null;
    if (Interp) {
      interp = Interp.interpret(chart, { yongPick: pick });
      calc.traces = interp.traces;
    }

    // 增强原结果对象（不破坏既有字段）
    result.input = input;
    result.calculation = calc;
    result.chart = chart;
    result.yongPick = pick;
    result.questionStruct = qs;
    if (interp) result.interpretation = interp;
    result.algorithmVersion = RT.ALGO_VERSION;
    result.exportDerivation = function () {
      return RT.exportDerivation(input, calc, interp);
    };
    return result;
  }

  // 解释层引用（由外部注入，避免循环依赖）
  var LiuYaoInterpretRef = null;
  function setInterpret(mod) { LiuYaoInterpretRef = mod; }

  return { attach: attach, setInterpret: setInterpret, ALGO_VERSION: RT.ALGO_VERSION };
});
