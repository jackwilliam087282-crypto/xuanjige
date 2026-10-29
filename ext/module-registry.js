/* 玄机阁 · 互动扩展 模块注册表
 * 目标：在不改动既有框架的前提下，为新功能提供统一的注册、计算、渲染与释放接口。
 *
 * 约定：
 *  - 本文件不修改 index.html 的路由与 PAGES，只向 window 暴露注册表。
 *  - 所有模块必须实现 dispose()，切换页面时释放事件、计时器、音频与 GPU 资源。
 *  - 未实现的模块只登记 status:'planned'，capabilities 为空，不提供假界面。
 */
(function (global) {
  'use strict';

  var MODULES = Object.create(null);
  var ALGORITHM_VERSION = {
    registry: '1.0.0',
    tarot: 'tarot-1.0.0',
    naming: 'naming-1.0.0',
    playbook: 'playbook-1.0.0'
  };

  /* ---------------------------------------------------------------- 存储 */

  var STORE_PREFIX = 'xjg_ext_';

  function readStore(key, fallback) {
    try {
      var raw = global.localStorage.getItem(STORE_PREFIX + key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      global.localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function removeStore(key) {
    try { global.localStorage.removeItem(STORE_PREFIX + key); } catch (e) { /* 忽略 */ }
  }

  /* 只清除本扩展自己的键，不触碰任何既有数据。 */
  function clearAll() {
    var removed = [];
    try {
      var doomed = [];
      for (var i = 0; i < global.localStorage.length; i += 1) {
        var k = global.localStorage.key(i);
        if (k && k.indexOf(STORE_PREFIX) === 0) doomed.push(k);
      }
      doomed.forEach(function (k) {
        removed.push(k);
        global.localStorage.removeItem(k);
      });
    } catch (e) { /* 忽略 */ }
    return removed;
  }

  function listStoreKeys() {
    var keys = [];
    try {
      for (var i = 0; i < global.localStorage.length; i += 1) {
        var k = global.localStorage.key(i);
        if (k && k.indexOf(STORE_PREFIX) === 0) keys.push(k);
      }
    } catch (e) { /* 忽略 */ }
    return keys;
  }

  /* ---------------------------------------------------------------- 校验 */

  var RESULT_TYPES = {
    resultId: 'string',
    moduleId: 'string',
    createdAt: 'string',
    inputSnapshot: 'object',
    normalizedInputs: 'object',
    method: 'string',
    algorithmVersion: 'string',
    evidence: 'array',
    interpretations: 'array',
    actions: 'array',
    limitations: 'array',
    assets: 'array'
  };

  /* 结果结构验证：先验证再渲染。
   * 任何必填字段缺失或类型不符都会抛出，阻止渲染层拿到不完整数据。 */
  function validateResult(result, moduleId) {
    if (!result || typeof result !== 'object') {
      throw new Error('结果结构无效：不是对象');
    }
    Object.keys(RESULT_TYPES).forEach(function (field) {
      var expect = RESULT_TYPES[field];
      var actual = result[field];
      if (actual === undefined || actual === null) {
        throw new Error('结果结构缺字段：' + field);
      }
      if (expect === 'array' && !Array.isArray(actual)) {
        throw new Error('结果字段 ' + field + ' 应为数组');
      }
      if (expect === 'object' && (typeof actual !== 'object' || Array.isArray(actual))) {
        throw new Error('结果字段 ' + field + ' 应为对象');
      }
      if ((expect === 'string' || expect === 'number') && typeof actual !== expect) {
        throw new Error('结果字段 ' + field + ' 类型应为 ' + expect);
      }
    });
    if (moduleId && result.moduleId !== moduleId) {
      throw new Error('结果 moduleId 与调用模块不一致');
    }
    if (result.randomRecord !== null && result.randomRecord !== undefined) {
      if (typeof result.randomRecord !== 'object') {
        throw new Error('randomRecord 应为对象或 null');
      }
      if (!Array.isArray(result.randomRecord.draws)) {
        throw new Error('randomRecord 缺少 draws 数组');
      }
    }
    return true;
  }

  /* inputsSchema 校验：按声明的字段类型与必填项检查输入。 */
  function validateInputs(schema, inputs) {
    if (!schema || !Array.isArray(schema.fields)) return true;
    var values = inputs || {};
    schema.fields.forEach(function (field) {
      var v = values[field.name];
      var missing = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
      if (field.required && missing) {
        throw new Error('缺少必填项：' + field.label);
      }
      if (missing) return;
      if (field.type === 'number') {
        if (typeof v !== 'number' || !isFinite(v)) {
          throw new Error(field.label + ' 需要是有效数字');
        }
        if (typeof field.min === 'number' && v < field.min) {
          throw new Error(field.label + ' 不能小于 ' + field.min);
        }
        if (typeof field.max === 'number' && v > field.max) {
          throw new Error(field.label + ' 不能大于 ' + field.max);
        }
      }
      if (field.type === 'array' && !Array.isArray(v)) {
        throw new Error(field.label + ' 需要是数组');
      }
    });
    return true;
  }

  /* 缓存键必须包含所有影响计算的输入，不能只用姓名或类别。 */
  function cacheKey(moduleId, normalizedInputs) {
    var parts = [moduleId, ALGORITHM_VERSION[moduleId] || ALGORITHM_VERSION.registry];
    function walk(v) {
      if (v === null || v === undefined) { parts.push('~'); return; }
      if (Array.isArray(v)) { parts.push('['); v.forEach(walk); parts.push(']'); return; }
      if (typeof v === 'object') {
        parts.push('{');
        Object.keys(v).sort().forEach(function (k) { parts.push(k + ':'); walk(v[k]); });
        parts.push('}');
        return;
      }
      parts.push(String(v));
    }
    walk(normalizedInputs);
    return parts.join('|');
  }

  /* 输入快照：保留时间范围、时区、历法、地点、精确时间与未知项。 */
  function buildSnapshot(inputs, unknowns) {
    var snap = {
      capturedAt: new Date().toISOString(),
      timezone: (function () {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '未知'; }
        catch (e) { return '未知'; }
      })(),
      calendar: '公历（格里高利历）',
      fields: {},
      unknowns: Array.isArray(unknowns) ? unknowns.slice() : []
    };
    Object.keys(inputs || {}).forEach(function (k) {
      var v = inputs[k];
      snap.fields[k] = (v !== null && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
    });
    return snap;
  }

  function newResultId(moduleId) {
    var rand = Math.random().toString(36).slice(2, 10);
    return moduleId + '-' + Date.now().toString(36) + '-' + rand;
  }

  /* 统一解释模板：五段，每段必须绑定实际规则或用户信息。 */
  function buildInterpretations(parts) {
    var order = [
      ['focus', '本次关注什么'],
      ['basis', '判断来自哪里'],
      ['blocker', '哪个环节受阻'],
      ['first', '建议先做什么'],
      ['confirm', '什么仍需确认']
    ];
    return order.map(function (pair) {
      var text = parts[pair[0]];
      return {
        key: pair[0],
        title: pair[1],
        text: (typeof text === 'string' && text.trim()) ? text.trim() : '未判断：本模块没有足够数据支持这一段。'
      };
    });
  }

  /* ---------------------------------------------------------------- 注册 */

  function register(module) {
    if (!module || typeof module.id !== 'string' || !module.id) {
      throw new Error('模块必须有 id');
    }
    if (typeof module.title !== 'string' || !module.title) {
      throw new Error('模块必须有 title');
    }
    if (typeof module.version !== 'string' || !module.version) {
      throw new Error('模块必须有 version');
    }
    if (module.status !== 'planned' && typeof module.calculate !== 'function') {
      throw new Error('已实现模块必须有 calculate()：' + module.id);
    }
    MODULES[module.id] = Object.assign({
      status: 'planned',
      inputsSchema: { fields: [] },
      capabilities: [],
      mount: function () {},
      render: function () {},
      dispose: function () {}
    }, module);
    return MODULES[module.id];
  }

  function get(id) { return MODULES[id] || null; }
  function all() { return Object.keys(MODULES).map(function (k) { return MODULES[k]; }); }

  /* 卸载单个模块：先调用模块自己的 dispose() 释放资源，再从注册表移除。
     未实现的 planned 模块没有需要释放的资源，直接移除。 */
  function dispose(id) {
    var m = MODULES[id];
    if (!m) throw new Error('未找到该模块：' + id);
    try {
      if (typeof m.dispose === 'function') m.dispose();
    } catch (e) {
      /* dispose 失败不影响卸载本身，但要如实抛出，不静默吞掉 */
      delete MODULES[id];
      throw new Error('模块 dispose 失败：' + id + ' :: ' + e.message);
    }
    delete MODULES[id];
    return true;
  }
  function implemented() { return all().filter(function (m) { return m.status === 'implemented'; }); }
  function planned() { return all().filter(function (m) { return m.status === 'planned'; }); }

  /* 执行模块计算：校验输入 → 归一化 → 计算 → 校验结果。 */
  function run(moduleId, rawInputs, options) {
    var m = get(moduleId);
    if (!m) throw new Error('未注册的模块：' + moduleId);
    if (m.status !== 'implemented') throw new Error('模块尚未实现：' + m.title);
    var opts = options || {};
    validateInputs(m.inputsSchema, rawInputs);
    var normalized = typeof m.normalize === 'function' ? m.normalize(rawInputs) : Object.assign({}, rawInputs);
    var key = cacheKey(moduleId, normalized);
    if (!opts.force && m.cache !== false) {
      var cached = readStore('cache_' + moduleId, null);
      if (cached && cached.key === key) return cached.value;
    }
    var snapshot = typeof m.snapshot === 'function'
      ? m.snapshot(rawInputs, normalized)
      : buildSnapshot(normalized, m.unknowns || []);
    var result = m.calculate(normalized, { snapshot: snapshot, key: key, module: m });
    if (!result) throw new Error('模块未返回结果：' + moduleId);
    result.moduleId = result.moduleId || moduleId;
    result.algorithmVersion = result.algorithmVersion || m.version;
    result.inputSnapshot = result.inputSnapshot || snapshot;
    result.assets = result.assets || [];
    result.limitations = result.limitations || [];
    result.resultId = result.resultId || newResultId(moduleId);
    result.createdAt = result.createdAt || new Date().toISOString();
    validateResult(result, moduleId);
    if (m.cache !== false && !opts.noCache) {
      writeStore('cache_' + moduleId, { key: key, value: result });
    }
    return result;
  }

  global.ExtModuleRegistry = {
    version: ALGORITHM_VERSION.registry,
    algorithmVersion: ALGORITHM_VERSION,
    register: register,
    get: get,
    all: all,
    implemented: implemented,
    planned: planned,
    run: run,
    dispose: dispose,
    validateResult: validateResult,
    validateInputs: validateInputs,
    cacheKey: cacheKey,
    buildSnapshot: buildSnapshot,
    buildInterpretations: buildInterpretations,
    newResultId: newResultId,
    store: {
      prefix: STORE_PREFIX,
      read: readStore,
      write: writeStore,
      remove: removeStore,
      clearAll: clearAll,
      listKeys: listStoreKeys
    }
  };
})(window);