/**
 * core/ai-interpret.js —— 可选 AI 解读层（默认关闭）
 *
 * 审计要求（七、联网 AI 的正确接法）：
 *   1. 本地引擎是唯一计算来源；AI 不得起卦、改盘、改分数、造应期。
 *   2. AI 输入只允许：匿名化的问题结构、CalculationResult 和 RuleTrace[]。
 *   3. AI 输出固定 JSON Schema，每个判断必须引用一个或多个 ruleId；
 *      引用不存在的规则时拒绝显示并回退本地解释。
 *   4. Electron 客户端不得写死 API Key。通过自有 HTTPS 后端代理，
 *      加入鉴权、限流、日志脱敏、超时、重试和缓存。
 *   5. 姓名、生日、原始问题默认不上传；上传前明确提示，支持匿名化和完全离线模式。
 *   6. AI 只是白话解释层。断网、超时或解析失败时，本地全部功能必须照常工作。
 *
 * 本模块只实现客户端侧约束；真正的代理服务在服务端（不在本仓库内）。
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./trace.js'));
  } else {
    root.AIInterpret = factory(root.RuleTrace);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (RT) {
  'use strict';

  /** 默认关闭 */
  var DEFAULTS = {
    enabled: false,          // 默认关闭，须用户显式开启
    endpoint: '',            // 自有 HTTPS 后端代理地址；客户端不得写死 API Key
    timeoutMs: 15000,
    retries: 1,
    cacheTTLms: 10 * 60 * 1000,
    anonymize: true,         // 匿名化：剥离姓名、生日、原始问题
    allowQuestionText: false // 原始问题默认不上传
  };

  /** 固定输出 JSON Schema —— AI 必须严格遵守 */
  var RESPONSE_SCHEMA = {
    type: 'object',
    required: ['plainReading', 'citedRules'],
    properties: {
      plainReading: {
        type: 'string',
        description: '白话解读，200~400 字。不得包含原文未给出的结论。'
      },
      citedRules: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: '解读中每一处判断所依据的 ruleId 列表，必须全部来自本地 RuleTrace'
      },
      boundary: {
        type: 'string',
        description: '结论边界说明：本解读不能确定什么'
      }
    },
    additionalProperties: false
  };

  /**
   * 构造发送给后端的匿名化载荷。
   * 严格剔除：姓名、生日、原始问题原文。
   * @param {object} o { questionStruct, calculation, traces }
   */
  function buildPayload(o) {
    o = o || {};
    var cfg = Object.assign({}, DEFAULTS, o.config || {});
    var qs = o.questionStruct || {};

    // 匿名化：只传结构化分类，不传原文
    // 注意：显式逐字段构造，绝不 spread 整个 questionStruct（其中含 raw 原文）
    var anonQuestion = {
      category: qs.category || null,
      categoryLabel: qs.categoryLabel || null,
      hasThirdParty: qs.hasThirdParty,
      subject: qs.subject || null,
      // 目标与期限做长度限制，避免夹带可识别信息
      goal: cfg.anonymize ? truncate(String(qs.goal || ''), 20) : (qs.goal || null),
      deadline: cfg.deadline || null
    };

    var traces = (o.traces || []).map(function (t) {
      return {
        ruleId: t.ruleId,
        system: t.system,
        premise: t.premise,
        facts: t.facts,
        target: t.target,
        direction: t.direction,
        strength: t.strength,
        source: t.source,
        citation: t.citation,
        limits: t.limits
      };
    });

    return {
      algoVersion: RT.ALGO_VERSION,
      question: anonQuestion,
      calculation: o.calculation ? {
        system: o.calculation.system,
        facts: sanitizeFacts(o.calculation.facts)
      } : null,
      traces: traces,
      responseSchema: RESPONSE_SCHEMA,
      // 明确告知后端：不得要求重算
      constraints: [
        '不得起卦、不得改盘、不得改分数、不得生成应期日期',
        '每一处判断必须引用给定 traces 中的 ruleId',
        '引用不存在的 ruleId 将被客户端拒绝',
        '不得输出医学诊断、投资建议或确定灾祸'
      ]
    };
  }

  /**
   * 剥离 CalculationResult.facts 中的可识别信息。
   * 逐字段白名单构造，不整体透传。
   */
  function sanitizeFacts(facts) {
    if (!facts || typeof facts !== 'object') return {};
    var out = {};
    if (facts.gua) out.gua = facts.gua;
    if (facts.palace) out.palace = facts.palace;
    if (Array.isArray(facts.lines)) out.lines = facts.lines;
    if (Array.isArray(facts.yaos)) {
      out.yaos = facts.yaos.map(function (y) {
        return {
          pos: y.pos, gz: y.gz, liuqin: y.liuqin, liushen: y.liushen,
          moving: y.moving, bian: y.bian, shi: y.shi, you: y.you,
          xianKong: y.xianKong, yuePo: y.yuePo
        };
      });
    }
    if (facts.calendar) out.calendar = facts.calendar;
    if (facts.yongPick) {
      out.yongPick = {
        ambiguous: facts.yongPick.ambiguous,
        yong: facts.yongPick.yong,
        liuqin: facts.yongPick.liuqin
        // 不传 reason 之外的自由文本；此处 reason 为固定文案，可传
      };
    }
    if (facts.coins18) out.coins18 = facts.coins18;
    // 注意：questionStruct（含 raw 原文）与 methodDetail 一律不传
    return out;
  }

  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n) : s;
  }

  /**
   * 校验 AI 输出。
   * 任一项不通过即拒绝显示，回退本地解释。
   * @returns {{ok:boolean, reason?:string, missing?:string[]}}
   */
  function validateAiResponse(resp, traces) {
    if (!resp || typeof resp !== 'object') {
      return { ok: false, reason: 'AI 未返回可解析的对象' };
    }
    if (typeof resp.plainReading !== 'string' || !resp.plainReading.trim()) {
      return { ok: false, reason: '缺少 plainReading' };
    }
    if (!Array.isArray(resp.citedRules) || !resp.citedRules.length) {
      return { ok: false, reason: '缺少 citedRules：AI 未引用任何规则，按要求拒绝显示' };
    }
    // 审计硬要求：引用不存在的 ruleId 一律拒绝
    var known = {};
    (traces || []).forEach(function (t) { known[t.ruleId] = true; });
    var missing = resp.citedRules.filter(function (r) { return !known[r]; });
    if (missing.length) {
      return { ok: false, reason: 'AI 引用了不存在的规则：' + missing.join(', '), missing: missing };
    }
    // 禁止应期日期与医疗/投资断言
    var banned = [
      { re: /\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/, why: '疑似生成具体应期日期' },
      { re: /一定会|必定会|保证(?!每日)/, why: '绝对化断言' },
      { re: /诊断|确诊|病历|处方/, why: '医学诊断' },
      { re: /稳赚|必赚|收益保证|无风险/, why: '收益保证' }
    ];
    var text = resp.plainReading;
    for (var i = 0; i < banned.length; i++) {
      if (banned[i].re.test(text)) {
        return { ok: false, reason: 'AI 输出含禁止内容：' + banned[i].why };
      }
    }
    return { ok: true };
  }

  /**
   * 调用后端代理。任何失败都必须静默回退本地解释。
   * @param {object} o { config, payload, traces, fetchImpl }
   * @returns {Promise<{source:'ai'|'local', text?:string, fallbackReason?:string}>}
   */
  function request(o) {
    o = o || {};
    var cfg = Object.assign({}, DEFAULTS, o.config || {});
    // 默认关闭 / 未配置端点 → 直接回退本地
    if (!cfg.enabled) {
      return Promise.resolve({ source: 'local', fallbackReason: 'AI 解读未开启（默认关闭）' });
    }
    if (!cfg.endpoint) {
      return Promise.resolve({ source: 'local', fallbackReason: '未配置后端代理地址，AI 不可用' });
    }
    if (!/^https:\/\//i.test(cfg.endpoint)) {
      // 硬约束：只允许 HTTPS，禁止明文传输
      return Promise.resolve({ source: 'local', fallbackReason: '端点必须为 HTTPS，已拒绝' });
    }

    var fetchImpl = o.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetchImpl) {
      return Promise.resolve({ source: 'local', fallbackReason: '运行环境无网络能力' });
    }

    var payload = buildPayload({ questionStruct: o.questionStruct, calculation: o.calculation, traces: o.traces, config: cfg });
    var cacheKey = RT.stableStringify(payload);
    var cache = o.cache || {};
    if (cfg.cacheTTLms > 0 && cache[cacheKey] && Date.now() - cache[cacheKey].t < cfg.cacheTTLms) {
      return Promise.resolve(cache[cacheKey].v);
    }

    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, cfg.timeoutMs) : null;

    var attempt = 0;
    function once() {
      return fetchImpl(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (data) {
        var v = validateAiResponse(data, o.traces);
        if (!v.ok) {
          // 校验失败 → 回退本地
          return { source: 'local', fallbackReason: 'AI 输出未通过校验：' + v.reason };
        }
        return {
          source: 'ai',
          text: data.plainReading,
          citedRules: data.citedRules,
          boundary: data.boundary || ''
        };
      });
    }

    function run() {
      return once().catch(function (e) {
        if (attempt < cfg.retries) {
          attempt++;
          return run();
        }
        // 断网/超时/解析失败 → 本地功能照常
        return { source: 'local', fallbackReason: 'AI 请求失败：' + (e && e.message || e) };
      });
    }

    var p = run();
    if (timer) {
      p = p.then(function (v) { clearTimeout(timer); return v; },
        function (e) { clearTimeout(timer); throw e; });
    }
    return p.then(function (v) {
      if (cfg.cacheTTLms > 0 && v.source === 'ai') {
        cache[cacheKey] = { t: Date.now(), v: v };
      }
      return v;
    });
  }

  /**
   * 隐私确认：上传前必须让用户明确知道「上传什么、不上传什么」。
   * @returns {{text:string, uploads:string[], notUploads:string[]}}
   */
  function privacyNotice() {
    return {
      text: 'AI 解读为可选功能，默认关闭。开启后仅上传下列结构化数据；' +
        '关闭或断网时全部本地功能照常可用。',
      uploads: [
        '问题结构化分类（如「事业工作」「财运求财」），不含问题原文',
        '本地计算出的盘面事实（如卦名、六亲、用神、旬空月破）',
        '本地规则轨迹（含 ruleId、依据事实、出处）'
      ],
      notUploads: [
        '姓名',
        '出生日期与时辰',
        '问题原文',
        '本机文件、剪贴板与历史记录'
      ]
    };
  }

  return {
    DEFAULTS: DEFAULTS,
    RESPONSE_SCHEMA: RESPONSE_SCHEMA,
    buildPayload: buildPayload,
    validateAiResponse: validateAiResponse,
    request: request,
    privacyNotice: privacyNotice
  };
});
