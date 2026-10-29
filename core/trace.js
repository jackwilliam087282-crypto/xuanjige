/**
 * core/trace.js —— 四层架构的规则轨迹层
 *
 * 设计原则（对应审计要求「二、重构数据流，禁止界面直接拼占断」）：
 *   Layer 1  InputRecord        输入存档：算法版本、时区、问题结构、原始随机值
 *   Layer 2  CalculationResult  确定性盘面事实与中间值，不含吉凶文案
 *   Layer 3  RuleTrace[]        规则轨迹：每条可溯源、可审计、可导出
 *   Layer 4  Interpretation     解释层：只依据 RuleTrace 组织文字
 *
 * 硬约束：
 *   - 解释层不得绕过 RuleTrace 直接按档位输出整段模板；
 *   - 相同 InputRecord 必须得到完全相同结果（禁止在计算层使用随机源）；
 *   - 每条 trace 必须能指向来源（SOURCE）或明确标记为软件约定（CONVENTION）。
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RuleTrace = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  /** 算法版本 —— 旧存档保留原版本，不静默用新算法改写历史结果 */
  var ALGO_VERSION = '1.6.0';

  /** 来源分类 */
  var SOURCE = {
    CLASSIC: 'classic',       // 有典籍依据
    CONVENTION: 'convention', // 本软件约定
    DERIVED: 'derived'        // 由其他规则推导
  };

  var SOURCE_LABEL = {
    classic: '原典依据',
    convention: '软件约定',
    derived: '推导所得'
  };

  /** 体系分类 */
  var SYSTEM = {
    BAZI: 'bazi',
    LIUYAO: 'liuyao',
    JIUGONG: 'jiugong',
    DAILY: 'daily',
    DREAM: 'dream',
    HEPAN: 'hepan'
  };

  /**
   * 创建一条规则轨迹
   * @param {object} o
   *   ruleId    规则唯一标识（解释层引用 AI 输出时必须回指此 id）
   *   system    所属体系
   *   premise    前提（成立条件）
   *   facts     命中事实（数组，元素为可验证的确定性值）
   *   target    作用对象
   *   direction 方向：+1 顺 / -1 逆 / 0 中性
   *   strength  强度 0~1
   *   conflicts 冲突规则（ruleId 数组或 null）
   *   limits    结论边界（数组）
   *   source    SOURCE.*
   *   citation  具体出处（可为空字符串，但 convention 必须写明约定内容）
   */
  function trace(o) {
    o = o || {};
    /* 【1.6.0 修正】ruleId 是 RuleTrace 的唯一溯源键。
     * 原实现直接透传，缺失/空串时会静默产出一条「无规则编号」的轨迹，
     * 使 Explanation 层可引用到无法回溯的规则，破坏审计要求
     * （第三章：每条规则可溯源、可审计、可导出）。
     * 此处改为强校验 —— 宁可抛错，也不产出不可溯源的轨迹。 */
    if (!o.ruleId || typeof o.ruleId !== 'string') {
      throw new Error('RuleTrace 缺少 ruleId，规则轨迹必须可溯源');
    }
    return {
      ruleId: o.ruleId,
      system: o.system,
      premise: o.premise || '',
      facts: o.facts || [],
      target: o.target || '',
      direction: typeof o.direction === 'number' ? o.direction : 0,
      strength: typeof o.strength === 'number' ? o.strength : 0,
      conflicts: o.conflicts || [],
      limits: o.limits || [],
      source: o.source || SOURCE.CONVENTION,
      sourceLabel: SOURCE_LABEL[o.source || SOURCE.CONVENTION] || '',
      citation: o.citation || ''
    };
  }

  /**
   * 轨迹集合：负责收集、查询、去重与一致性校验
   */
  function TraceSet(system) {
    this.system = system || SYSTEM.BAZI;
    this.items = [];
    this._seen = Object.create(null);
  }

  TraceSet.prototype.add = function (o) {
    var t = trace(o);
    if (!t.ruleId) throw new Error('RuleTrace 缺少 ruleId');
    // 语义结构去重：比较 ruleId + facts + conclusion，而非整句标点文本
    var key = t.ruleId + '|' + JSON.stringify(t.facts) + '|' + t.direction + '|' + t.strength;
    if (this._seen[key]) return this._seen[key];
    this.items.push(t);
    this._seen[key] = t;
    return t;
  };

  TraceSet.prototype.byId = function (ruleId) {
    return this.items.filter(function (t) { return t.ruleId === ruleId; });
  };

  TraceSet.prototype.has = function (ruleId) {
    return this.items.some(function (t) { return t.ruleId === ruleId; });
  };

  /** 取出作用于某对象的所有轨迹 */
  TraceSet.prototype.forTarget = function (target) {
    return this.items.filter(function (t) { return t.target === target; });
  };

  /** 取出所有顺向 / 逆向轨迹 */
  TraceSet.prototype.byDirection = function (dir) {
    return this.items.filter(function (t) { return t.direction === dir; });
  };

  /** 汇总净方向与强度（用于排序与展示，非神秘总分） */
  TraceSet.prototype.summary = function () {
    var pos = 0, neg = 0;
    this.items.forEach(function (t) {
      if (t.direction > 0) pos += t.strength;
      else if (t.direction < 0) neg += t.strength;
    });
    return { positive: round2(pos), negative: round2(neg), net: round2(pos - neg) };
  };

  /**
   * 一致性校验：任何引用了不存在的 ruleId 的解释都必须被拒绝
   * @returns {{ok:boolean, missing:string[]}}
   */
  TraceSet.prototype.validateRefs = function (refs) {
    var missing = (refs || []).filter(function (r) { return !this.has(r); }, this);
    return { ok: missing.length === 0, missing: missing };
  };

  function round2(n) { return Math.round(n * 100) / 100; }

  /* ============================================================
   * InputRecord —— 第一层：输入存档
   * ============================================================ */

  /**
   * @param {object} o
   *   castId      本次起卦唯一编号（用于隔离与复盘）
   *   system      体系
   *   questionRaw 问题原文
   *   question    用户确认后的问题结构（事项大类/主体/对象/目标/期限/状态/第三方）
   *   querent     求测人称呼（与问题正文分离）
   *   category    问事类别
   *   timeRange   询问覆盖的时间范围
   *   method      起卦方式
   *   birth       出生信息
   *   cast        原始钱面或数字（随机起卦后必须保存，复盘不得再随机）
   *   tz / timezone  时区
   *   castTime    起卦本地时刻
   *   calendar    历法设置（节气换月、23点换日、真太阳时、起运）
   */
  function InputRecord(o) {
    o = o || {};
    this.algoVersion = ALGO_VERSION;
    this.algorithmVersion = ALGO_VERSION;   // 审计要求字段别名
    this.castId = o.castId || genCastId();
    this.system = o.system || '';
    this.tz = o.tz || 'Asia/Shanghai';
    this.timezone = o.timezone || this.tz;  // 审计要求字段名
    this.calendar = Object.assign({
      useJieQi: true,        // 节气换月
      late23: true,          // 23:00 换日
      trueSolar: false,      // 真太阳时
      trueSolarLng: null,
      luckDirection: null,   // 起运方向
      luckStartAge: null,    // 起运时间
      unknownHour: false
    }, o.calendar || {});
    this.questionRaw = o.questionRaw || '';
    this.querent = o.querent || '';          // 求测人称呼
    this.question = o.question || null;      // 用户确认后的问题结构
    this.questionConfirmed = !!o.questionConfirmed;
    this.confirmedQuestionStructure = o.confirmedQuestionStructure || null;
    this.category = o.category || '';
    this.timeRange = o.timeRange || '';
    this.method = o.method || '';
    this.birth = o.birth || null;
    this.cast = o.cast || null;              // 原始钱面/数字，随机结果必须落盘
    this.castTime = o.castTime || null;
    this.establishedAt = o.establishedAt || null;
  }

  /**
   * 生成 castId —— 时间戳 + 加密随机，保证同一毫秒内也不会碰撞。
   */
  function genCastId() {
    var rand = '';
    var c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (c && typeof c.getRandomValues === 'function') {
      var a = new Uint32Array(2);
      c.getRandomValues(a);
      rand = a[0].toString(36) + a[1].toString(36);
    } else {
      rand = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
    }
    return 'cast-' + Date.now().toString(36) + '-' + rand;
  }

  /** 稳定序列化，用于可复现性比对与存档 */
  InputRecord.prototype.fingerprint = function () {
    var stable = {
      algoVersion: this.algoVersion,
      castId: this.castId,
      system: this.system,
      tz: this.tz,
      calendar: this.calendar,
      querent: this.querent,
      question: this.question,
      questionConfirmed: this.questionConfirmed,
      category: this.category,
      timeRange: this.timeRange,
      method: this.method,
      birth: this.birth,
      cast: this.cast,
      castTime: this.castTime,
    };
    return stableStringify(stable);
  };

  InputRecord.prototype.toJSON = function () {
    return {
      castId: this.castId,
      algoVersion: this.algoVersion, algorithmVersion: this.algorithmVersion,
      system: this.system, tz: this.tz, timezone: this.timezone,
      calendar: this.calendar, questionRaw: this.questionRaw,
      querent: this.querent,
      question: this.question, questionConfirmed: this.questionConfirmed,
      confirmedQuestionStructure: this.confirmedQuestionStructure,
      category: this.category, timeRange: this.timeRange,
      method: this.method, birth: this.birth, cast: this.cast,
      castTime: this.castTime, establishedAt: this.establishedAt,
    };
  };

  /** 稳定 JSON（键排序），保证指纹与哈希不受属性顺序影响 */
  function stableStringify(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    var keys = Object.keys(v).sort();
    return '{' + keys.map(function (k) {
      return JSON.stringify(k) + ':' + stableStringify(v[k]);
    }).join(',') + '}';
  }

  /* ============================================================
   * CalculationResult —— 第二层：只含确定性事实，不含吉凶文案
   * ============================================================ */

  function CalculationResult(system) {
    this.system = system || '';
    this.algoVersion = ALGO_VERSION;
    this.facts = {};       // 结构化事实
    this.traces = [];      // RuleTrace[]
  }

  CalculationResult.prototype.setFact = function (k, v) {
    this.facts[k] = v;
    return this;
  };

  CalculationResult.prototype.getFact = function (k) {
    return this.facts[k];
  };

  CalculationResult.prototype.addTrace = function (o) {
    this.traces.push(trace(o));
    return this;
  };

  CalculationResult.prototype.traceIds = function () {
    return this.traces.map(function (t) { return t.ruleId; });
  };

  CalculationResult.prototype.toJSON = function () {
    return {
      system: this.system,
      algoVersion: this.algoVersion,
      facts: this.facts,
      traces: this.traces,
    };
  };

  /**
   * 导出完整推导依据（InputRecord + CalculationResult）
   * 界面「查看推导依据」与 JSON 导出均使用此结构
   */
  function exportDerivation(inputRecord, calcResult, interpretation) {
    return {
      input: inputRecord ? inputRecord.toJSON() : null,
      calculation: calcResult ? calcResult.toJSON() : null,
      interpretation: interpretation || null,
      algoVersion: ALGO_VERSION,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * 解释层守卫：给定一段 Interpretation，检查它是否只依据已有 trace 组织。
   * 识别两种引用形态：{ ruleId } 与 { ruleIds: [...] }。
   * 若 Interpretation 声明了 ruleIds 但引用了不存在的规则，视为非法。
   */
  function validateInterpretation(interp, calcResult) {
    if (!interp) return { ok: false, reason: '解释为空' };
    var refs = [];
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (typeof o.ruleId === 'string') refs.push(o.ruleId);
      if (Array.isArray(o.ruleIds)) {
        o.ruleIds.forEach(function (r) { if (typeof r === 'string') refs.push(r); });
      }
      Object.keys(o).forEach(function (k) { walk(o[k]); });
    })(interp);
    if (!refs.length) {
      return { ok: false, reason: '解释未引用任何 ruleId，疑似绕过规则轨迹直接输出模板' };
    }
    var known = {};
    (calcResult ? calcResult.traces : []).forEach(function (t) { known[t.ruleId] = true; });
    var missing = refs.filter(function (r) { return !known[r]; });
    return missing.length
      ? { ok: false, missing: missing, reason: '引用了不存在的规则：' + missing.join(', ') }
      : { ok: true };
  }

  return {
    ALGO_VERSION: ALGO_VERSION,
    SOURCE: SOURCE,
    SOURCE_LABEL: SOURCE_LABEL,
    SYSTEM: SYSTEM,
    trace: trace,
    TraceSet: TraceSet,
    InputRecord: InputRecord,
    genCastId: genCastId,
    CalculationResult: CalculationResult,
    exportDerivation: exportDerivation,
    validateInterpretation: validateInterpretation,
    stableStringify: stableStringify
  };
});
