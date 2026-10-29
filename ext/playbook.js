/* 六个记忆点玩法（第1阶段可用部分）
 *
 * 1. 一问一行：结果转成可编辑行动卡，3 天 / 7 天后复盘填写结果。
 * 2. 分岔剧场：方案一与方案二并排，列资源、约束、可逆性与自述偏好。
 * 3. 同题不同镜：同一问题分别查看六爻 / 塔罗 / 九宫的独立结果，只指异同。
 * 4. 命盘注释册：术语可"解释给我听 / 显示本盘依据 / 加我的理解"。
 * 5. 流光签卷：把核心结果、实际输入与感想排成可导出卷轴，默认脱敏。
 * 6. 节气庭院：随真实节气改变光色与物象；装饰不影响测算结果。
 *
 * 硬性原则：
 *  - 不把占卜象意包装成确定事实；依据不足时明确写"未判断"。
 *  - 导出内容默认不含完整生日、姓名与照片。
 *  - 不因未填写或失败而要求用户再次占卜。
 */
(function (global) {
  'use strict';

  var Reg = global.ExtModuleRegistry;

  /* =====================================================================
   * 1. 一问一行 · 行动卡与复盘
   * ===================================================================== */

  var CARD_KEY = 'action_cards';

  function loadCards() { return Reg.store.read(CARD_KEY, []) || []; }
  function saveCards(list) { Reg.store.write(CARD_KEY, list.slice(0, 200)); return list.slice(0, 200); }

  /* 从任意统一结果结构生成行动卡：取 actions 与 limitations，不重抽任何结果。 */
  function createCard(payload) {
    var question = String(payload.question || '').trim();
    var action = String(payload.action || '').trim();
    if (!question) throw new Error('请填写这次的问题');
    if (!action) throw new Error('请选择一件具体能做的事');
    var days = Number(payload.days) === 7 ? 7 : 3;
    var card = {
      id: 'ac' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      question: question,
      action: action,
      days: days,
      sourceModule: payload.sourceModule || '',
      sourceResultId: payload.sourceResultId || '',
      /* 脱敏：只保留模块名与结果号，不存完整输入 */
      sourceNote: payload.sourceNote || '',
      createdAt: new Date().toISOString(),
      dueAt: new Date(Date.now() + days * 86400000).toISOString(),
      outcome: '',
      outcomeDate: '',
      reflection: ''
    };
    var list = loadCards();
    list.unshift(card);
    return { card: card, list: saveCards(list) };
  }

  function updateOutcome(id, outcome, reflection) {
    var list = loadCards();
    var found = null;
    list.forEach(function (c) {
      if (c.id === id) {
        c.outcome = String(outcome || '').trim();
        c.reflection = String(reflection || '').trim();
        c.outcomeDate = new Date().toISOString();
        found = c;
      }
    });
    if (!found) throw new Error('未找到该行动卡');
    saveCards(list);
    return found;
  }

  function removeCard(id) {
    return saveCards(loadCards().filter(function (c) { return c.id !== id; }));
  }

  /* 复盘到期状态：只按日期判断，不做任何预测。 */
  function cardState(card) {
    var due = new Date(card.dueAt).getTime();
    var now = Date.now();
    if (card.outcomeDate) return 'done';
    if (now > due) return 'due';
    return 'waiting';
  }

  function dueCards() {
    return loadCards().filter(function (c) { return cardState(c) === 'due'; });
  }

  Reg.register({
    id: 'action-card',
    title: '一问一行 · 行动卡与复盘',
    version: 'playbook-1.0.0',
    status: 'implemented',
    cache: false,
    inputsSchema: {
      fields: [
        { name: 'question', label: '问题', type: 'string', required: true },
        { name: 'action', label: '一件能做的事', type: 'string', required: true }
      ]
    },
    capabilities: [
      '把任意模块结果转成可编辑行动卡',
      '3 天 / 7 天到期复盘，到期卡可填写结果',
      '不需要默认外部通知，不因失败要求再占',
      '行动卡只存问题与行动，不存完整生日与姓名'
    ],
    normalize: function (raw) {
      return {
        question: String(raw.question || '').trim(),
        action: String(raw.action || '').trim(),
        days: Number(raw.days) === 7 ? 7 : 3,
        sourceModule: String(raw.sourceModule || ''),
        sourceResultId: String(raw.sourceResultId || ''),
        sourceNote: String(raw.sourceNote || '').slice(0, 200)
      };
    },
    calculate: function (normalized, ctx) {
      var created = createCard(normalized);
      return {
        resultId: ctx.module ? created.card.id : created.card.id,
        moduleId: 'action-card',
        createdAt: created.card.createdAt,
        inputSnapshot: ctx.snapshot,
        normalizedInputs: normalized,
        method: '不重新测算。只把用户自己选定的"一件事"记录下来，按日期提醒复盘。',
        algorithmVersion: 'playbook-1.0.0',
        evidence: [{
          label: created.card.action,
          reasons: ['行动由你本人选定，软件不生成行动建议的替代品。']
        }],
        interpretations: Reg.buildInterpretations({
          focus: '你把「' + normalized.question + '」转成了一个可以在 ' + normalized.days + ' 天内检验的行动。',
          basis: '行动内容完全来自你的输入：' + normalized.action,
          blocker: '未判断：本卡不判断这件事会不会成功，只记录你做了什么、结果如何。',
          first: '到期后在下方填写实际结果，哪怕结果是"没做到"，如实记录比好看更重要。',
          confirm: '到期日按本机时间计算。若你换了时区或设备，请以实际经过的天数为准。'
        }),
        actions: [{ at: normalized.days + ' 天后', text: '回来填写实际结果与一句反思' }],
        limitations: [
          '本卡不做成败预测，也不评价你的行动好坏。',
          '未填写结果不会触发任何提醒，不要求你重新占卜。'
        ],
        assets: [],
        randomRecord: null,
        card: created.card
      };
    }
  });

  /* =====================================================================
   * 2. 分岔剧场 · 两个方案并排
   * ===================================================================== */

  var FORK_KEY = 'forks';

  function loadForks() { return Reg.store.read(FORK_KEY, []) || []; }

  /* 比较依据完全来自用户填写的信息，占卜象意只作为单列参考。
   * 若用户未提供某一项，明确写"未填写"，不用通用话术补齐。 */
  function buildSide(label, side) {
    var fields = [
      { key: 'summary', label: '这个方案是什么', value: side.summary },
      { key: 'resources', label: '需要的资源', value: side.resources },
      { key: 'constraints', label: '已知的约束', value: side.constraints },
      { key: 'reversibility', label: '可逆性', value: side.reversibility },
      { key: 'preference', label: '你自己的倾向', value: side.preference }
    ];
    return {
      label: label,
      items: fields.map(function (f) {
        var v = String(f.value || '').trim();
        return {
          label: f.label,
          value: v || '未填写：这一项没有输入，因此不参与比较。',
          filled: !!v
        };
      }),
      filledCount: fields.filter(function (f) { return !!String(f.value || '').trim(); }).length
    };
  }

  function createFork(payload) {
    var question = String(payload.question || '').trim();
    if (!question) throw new Error('请填写你要比较的问题');
    var a = buildSide('方案一', payload.a || {});
    var b = buildSide('方案二', payload.b || {});
    var bothFilled = a.filledCount + b.filledCount;
    if (bothFilled < 4) {
      throw new Error('两个方案合计填写不足 4 项，信息太少无法比较。请至少填写方案的资源、约束与自己的倾向。');
    }
    var record = {
      id: 'fk' + Date.now().toString(36),
      question: question,
      a: a, b: b,
      omens: String(payload.omens || '').trim(),
      createdAt: new Date().toISOString()
    };
    var list = loadForks();
    list.unshift(record);
    Reg.store.write(FORK_KEY, list.slice(0, 60));
    return record;
  }

  function removeFork(id) {
    Reg.store.write(FORK_KEY, loadForks().filter(function (f) { return f.id !== id; }));
    return loadForks();
  }

  /* 逐项对照：只比较两边都填了的项，一方未填就如实说明无法比较。 */
  function compareSides(a, b) {
    var out = [];
    a.items.forEach(function (ai, i) {
      var bi = b.items[i];
      if (!ai.filled || !bi.filled) {
        out.push({
          label: ai.label,
          kind: ai.filled && !bi.filled ? 'onlyA' : (!ai.filled && bi.filled ? 'onlyB' : 'neither'),
          text: ai.label + '：' + (ai.filled ? '方案一已填写' : '方案一未填写') + '，' +
            (bi.filled ? '方案二已填写' : '方案二未填写') + '。只有一方有信息，无法比较这一项。'
        });
        return;
      }
      out.push({
        label: ai.label,
        kind: 'both',
        text: ai.label + '：方案一「' + ai.value + '」；方案二「' + bi.value + '」。' +
          '这两项描述的是不同事实，不构成优劣判断，需要你自己权衡哪个更难做到。'
      });
    });
    return out;
  }

  Reg.register({
    id: 'fork-theater',
    title: '分岔剧场 · 两个方案对照',
    version: 'playbook-1.0.0',
    status: 'implemented',
    cache: false,
    inputsSchema: {
      fields: [{ name: 'question', label: '要比较的问题', type: 'string', required: true }]
    },
    capabilities: [
      '方案一与方案二并排对照五条固定维度',
      '只比较双方都填写的项，未填项如实标注无法比较',
      '占卜象意单列为参考，不混入事实比较',
      '信息不足时直接拒绝生成，不填套话'
    ],
    normalize: function (raw) {
      return {
        question: String(raw.question || '').trim(),
        a: raw.a || {}, b: raw.b || {},
        omens: String(raw.omens || '').trim()
      };
    },
    calculate: function (normalized, ctx) {
      var record = createFork(normalized);
      var rows = compareSides(record.a, record.b);
      return {
        resultId: record.id,
        moduleId: 'fork-theater',
        createdAt: record.createdAt,
        inputSnapshot: ctx.snapshot,
        normalizedInputs: normalized,
        method: '逐项并列两个方案由你本人填写的资源、约束、可逆性与倾向；不对缺失项做推断。',
        algorithmVersion: 'playbook-1.0.0',
        evidence: rows,
        interpretations: Reg.buildInterpretations({
          focus: '你在比较「' + normalized.question + '」的两个方案。',
          basis: '全部依据来自你填写的方案一与方案二内容，逐项列在下方。' +
            (normalized.omens ? ' 你另外填写的象意参考已单列，不参与事实比较。' : ' 你没有填写象意参考，本次不涉及占卜内容。'),
          blocker: rows.filter(function (r) { return r.kind === 'onlyA' || r.kind === 'onlyB' || r.kind === 'neither'; })
            .length
            ? '有 ' + rows.filter(function (r) { return r.kind !== 'both'; }).length +
              ' 项只有一方填写或双方都没填，这些项无法比较。补齐后才能看出差别。'
            : '两项方案在所有维度都有信息，可以逐项对照。',
          first: '先看"可逆性"这一项：不可逆的方案无论好处多少都要更谨慎。',
          confirm: '本模块不判断哪个方案更好，也不预测结果。真实条件（钱、时间、健康）请以你掌握的事实为准。'
        }),
        actions: [{ at: '下一步', text: '把只有一方填写的项补齐，再重新对照一次' }],
        limitations: [
          '比较依据完全来自你的输入，软件不补充任何你没写的事实。',
          '占卜象意只作单列参考，不作为决策依据。'
        ],
        assets: [],
        randomRecord: null,
        fork: record
      };
    }
  });

  /* =====================================================================
   * 3. 同题不同镜 · 三个体系的独立结果
   * ===================================================================== */

  var MIRROR_KEY = 'mirrors';

  function loadMirrors() { return Reg.store.read(MIRROR_KEY, []) || []; }

  /* 各体系说明独立写清，不合并成统一结论。 */
  var SYSTEMS = {
    liuyao: {
      key: 'liuyao', label: '六爻',
      basis: '以铜钱起卦，按《周易》卦爻辞与纳甲六亲推断。',
      note: '六爻强调"用神"与"应期"，需要先说明所问事项才能取用神。'
    },
    tarot: {
      key: 'tarot', label: '塔罗',
      basis: '洗牌抽牌，按牌面意象与牌阵位置做自我反思。',
      note: '塔罗不预测事件与时间，适合用于整理自己的考虑。'
    },
    jiugong: {
      key: 'jiugong', label: '九宫',
      basis: '按洛书九数与方位取象，结合五行生克。',
      note: '九宫取象偏重方位与数字对应，属传统象数一路。'
    }
  };

  /* 只并列展示三套体系各自的结论，并指出异同，不做整合。 */
  function buildMirror(record) {
    var entries = [];
    Object.keys(SYSTEMS).forEach(function (k) {
      var s = SYSTEMS[k];
      var res = record.results[k];
      entries.push({
        system: k,
        label: s.label,
        basis: s.basis,
        note: s.note,
        available: !!res,
        summary: res ? res : '本次没有运行' + s.label + '。未运行不等于没有结论，只表示这次没有这一路结果。'
      });
    });
    var ran = entries.filter(function (e) { return e.available; });
    var diffNote;
    if (ran.length < 2) {
      diffNote = '目前只有 ' + ran.length + ' 套体系有结果，' +
        '少于两套时无法比较异同。请至少运行另外一套后再看对照。';
    } else {
      diffNote = '这三套体系的依据完全不同：' +
        ran.map(function (e) { return e.label + '依据' + e.basis.replace(/。$/, ''); }).join('；') +
        '。它们不是同一套算法的不同参数，因此结论不一致是正常的，' +
        '也不存在把它们"合并成一个确定答案"的做法。本页只并列展示，不做整合。';
    }
    return { entries: entries, diffNote: diffNote };
  }

  function saveMirror(question, results) {
    var record = {
      id: 'mr' + Date.now().toString(36),
      question: question,
      results: results,
      createdAt: new Date().toISOString()
    };
    var list = loadMirrors();
    list.unshift(record);
    Reg.store.write(MIRROR_KEY, list.slice(0, 40));
    return record;
  }

  Reg.register({
    id: 'same-question-mirrors',
    title: '同题不同镜 · 三套体系并列',
    version: 'playbook-1.0.0',
    status: 'implemented',
    cache: false,
    inputsSchema: {
      fields: [{ name: 'question', label: '同一个问题', type: 'string', required: true }]
    },
    capabilities: [
      '同一问题分别展示六爻 / 塔罗 / 九宫的独立结果',
      '明确说明三套体系依据不同，不合并成确定答案',
      '只运行少于两套时如实提示无法比较'
    ],
    normalize: function (raw) {
      return {
        question: String(raw.question || '').trim(),
        results: raw.results || {}
      };
    },
    calculate: function (normalized, ctx) {
      var record = saveMirror(normalized.question, normalized.results);
      var mirror = buildMirror(record);
      return {
        resultId: record.id,
        moduleId: 'same-question-mirrors',
        createdAt: record.createdAt,
        inputSnapshot: ctx.snapshot,
        normalizedInputs: { question: normalized.question },
        method: '并列展示三套体系各自的结论与依据；只指出异同，不做跨体系整合。',
        algorithmVersion: 'playbook-1.0.0',
        evidence: mirror.entries.map(function (e) {
          return { label: e.label, reasons: [e.basis, e.note] };
        }),
        interpretations: Reg.buildInterpretations({
          focus: '你用同一个问题「' + normalized.question + '」分别看了 ' +
            mirror.entries.filter(function (e) { return e.available; }).map(function (e) { return e.label; }).join('、') + '。',
          basis: mirror.diffNote,
          blocker: mirror.entries.filter(function (e) { return !e.available; }).length
            ? '有 ' + mirror.entries.filter(function (e) { return !e.available; }).length + ' 套体系本次未运行，异同对照不完整。'
            : '三套体系都有结果，可以逐项对照。',
          first: '先看三套体系分别指向"行动"还是"等待"，这通常比细节差异更能说明问题。',
          confirm: '三套体系都不预测确定事实。任何一套都不能替代对现实信息的核对。'
        }),
        actions: [{ at: '对照时', text: '找出三套体系都提到的那一条，那通常是你已经知道但还没承认的事' }],
        limitations: [
          '本模块不把不同体系整合成一个"命运分数"或确定答案。',
          '不同体系结论不一致属正常，不是其中一套出错。'
        ],
        assets: [],
        randomRecord: null,
        mirror: mirror,
        record: record
      };
    }
  });

  /* =====================================================================
   * 4. 命盘注释册 · 术语注释
   * ===================================================================== */

  var NOTE_KEY = 'chart_notes';

  function loadNotes() { return Reg.store.read(NOTE_KEY, {}) || {}; }
  function saveNote(term, note) {
    var all = loadNotes();
    all[term] = { text: String(note || '').trim(), at: new Date().toISOString() };
    Reg.store.write(NOTE_KEY, all);
    return all;
  }
  function removeNote(term) {
    var all = loadNotes();
    delete all[term];
    Reg.store.write(NOTE_KEY, all);
    return all;
  }

  /* 术语解释只跟随当前盘的数据，不引用他人案例。
   * 若当前盘没有该项数据，如实写"本盘没有这项数据"。 */
  function explainTerm(term, chartData) {
    var t = String(term || '').trim();
    if (!t) throw new Error('请输入或点击一个术语');
    var has = chartData && Object.prototype.hasOwnProperty.call(chartData, t);
    return {
      term: t,
      fromChart: !!has,
      chartValue: has ? chartData[t] : null,
      note: loadNotes()[t] || null,
      text: has
        ? '在你当前这张盘里，' + t + '的取值是：' + chartData[t] + '。以下解释只针对这一张盘。'
        : '当前盘没有「' + t + '」这一项数据，因此无法给出本盘依据。' +
          '这不代表该术语不存在，只代表这次排盘没有产出它。'
    };
  }

  Reg.register({
    id: 'chart-notebook',
    title: '命盘注释册',
    version: 'playbook-1.0.0',
    status: 'implemented',
    cache: false,
    inputsSchema: {
      fields: [{ name: 'term', label: '术语', type: 'string', required: true }]
    },
    capabilities: [
      '术语解释跟随当前盘数据，不与他人案例串盘',
      '当前盘无该项数据时如实说明',
      '可添加与删除自己的理解，笔记本地保存'
    ],
    normalize: function (raw) {
      return {
        term: String(raw.term || '').trim(),
        chartData: raw.chartData || {}
      };
    },
    calculate: function (normalized, ctx) {
      var info = explainTerm(normalized.term, normalized.chartData);
      return {
        resultId: Reg.newResultId('chart-notebook'),
        moduleId: 'chart-notebook',
        createdAt: new Date().toISOString(),
        inputSnapshot: ctx.snapshot,
        normalizedInputs: { term: normalized.term },
        method: '术语解释只读取当前盘实际产出的字段，不引用其他盘或通用案例。',
        algorithmVersion: 'playbook-1.0.0',
        evidence: [{
          label: info.term,
          reasons: [info.text]
        }],
        interpretations: Reg.buildInterpretations({
          focus: '你在查看术语「' + info.term + '」在本盘中的情况。',
          basis: info.text,
          blocker: info.fromChart ? '无' : '当前盘缺少该项数据，需要先完成相应排盘或补齐输入。',
          first: info.fromChart ? '对照相邻字段看它与其他数据的关系，不要只看单个值。' : '先确认这项数据是否需要额外输入（如时辰、地区）。',
          confirm: '术语含义在不同流派中可能不同；此处只解释本盘实际使用的口径。'
        }),
        actions: [{ at: '笔记', text: '写下你自己的理解，笔记只保存在本机' }],
        limitations: ['不引用其他用户的盘或案例作为解释依据。'],
        assets: [],
        randomRecord: null,
        termInfo: info
      };
    }
  });

  /* =====================================================================
   * 5. 流光签卷 · 可导出卷轴（默认脱敏）
   * ===================================================================== */

  var SCROLL_KEY = 'scrolls';

  function loadScrolls() { return Reg.store.read(SCROLL_KEY, []) || []; }

  /* 脱敏：剥离生日、姓名、电话、身份证样式字符串。 */
  function redact(text) {
    var s = String(text || '');
    /* 先把"138 1234 5678""330106-19900307-4512"这类被空格或短横拆开的数字串接回连续数字，
     * 再交给下面的规则统一隐去。只有数字总数达到 11 位以上才接回，
     * 避免把"12 34""第 3 名"这类正常数字误改。 */
    var squeezed = s.replace(/\d(?:[\s\-]?\d){10,}/g, function (m) {
      return m.replace(/[\s\-]/g, '');
    });
    return squeezed
      .replace(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?/g, '〔日期已隐去〕')
      .replace(/\d{1,2}:\d{2}/g, '〔时间已隐去〕')
      .replace(/1[3-9]\d{9}/g, '〔号码已隐去〕')
      .replace(/\d{17}[\dXx]/g, '〔证件号已隐去〕')
      .slice(0, 600);
  }

  function createScroll(payload) {
    var title = String(payload.title || '流光签卷').trim();
    var body = String(payload.body || '').trim();
    if (!body) throw new Error('卷轴内容不能为空');
    var record = {
      id: 'sc' + Date.now().toString(36),
      title: redact(title),
      lines: (Array.isArray(payload.lines) ? payload.lines : []).map(function (l) {
        return { label: String(l.label || ''), value: redact(l.value) };
      }),
      body: redact(body),
      feeling: redact(payload.feeling),
      sourceModule: String(payload.sourceModule || '').slice(0, 40),
      createdAt: new Date().toISOString(),
      redacted: true
    };
    var list = loadScrolls();
    list.unshift(record);
    Reg.store.write(SCROLL_KEY, list.slice(0, 40));
    return record;
  }

  function removeScroll(id) {
    Reg.store.write(SCROLL_KEY, loadScrolls().filter(function (s) { return s.id !== id; }));
    return loadScrolls();
  }

  /* 导出为纯文本，便于粘贴到任何地方；不含图片与敏感字段。 */
  function scrollToText(scroll) {
    var out = [];
    out.push('《' + scroll.title + '》');
    out.push('');
    scroll.lines.forEach(function (l) {
      out.push('【' + l.label + '】' + l.value);
    });
    if (scroll.lines.length) out.push('');
    out.push(scroll.body);
    if (scroll.feeling) {
      out.push('');
      out.push('—— 我的感想：' + scroll.feeling);
    }
    out.push('');
    out.push('（本卷轴已隐去日期、时间与号码等敏感信息）');
    return out.join('\n');
  }

  Reg.register({
    id: 'light-scroll',
    title: '流光签卷 · 可导出卷轴',
    version: 'playbook-1.0.0',
    status: 'implemented',
    cache: false,
    inputsSchema: {
      fields: [{ name: 'body', label: '卷轴正文', type: 'string', required: true }]
    },
    capabilities: [
      '把核心结果、实际输入与感想排成卷轴',
      '导出时默认隐去日期、时间与号码',
      '不含照片与完整生日，纯文本导出'
    ],
    normalize: function (raw) {
      return {
        title: String(raw.title || '流光签卷'),
        body: String(raw.body || '').trim(),
        lines: Array.isArray(raw.lines) ? raw.lines : [],
        feeling: String(raw.feeling || ''),
        sourceModule: String(raw.sourceModule || '')
      };
    },
    calculate: function (normalized, ctx) {
      var record = createScroll(normalized);
      return {
        resultId: record.id,
        moduleId: 'light-scroll',
        createdAt: record.createdAt,
        inputSnapshot: ctx.snapshot,
        normalizedInputs: { title: record.title, lines: record.lines.length },
        method: '按行排版并做脱敏处理；不做任何排版美化以外的内容加工。',
        algorithmVersion: 'playbook-1.0.0',
        evidence: record.lines.map(function (l) { return { label: l.label, reasons: [l.value] }; }),
        interpretations: Reg.buildInterpretations({
          focus: '你把本次结果整理成了一份可分享的卷轴。',
          basis: '卷轴内容来自：' + (record.lines.length ? record.lines.map(function (l) { return l.label; }).join('、') : '正文'),
          blocker: '无',
          first: '分享前再读一遍：脱敏只处理了日期、时间与号码，你自己写的内容不会被自动过滤。',
          confirm: '本卷轴不含照片与完整生日，但仍由你决定是否分享。'
        }),
        actions: [{ at: '导出', text: '复制纯文本，或另存为 .txt' }],
        limitations: [
          '脱敏只覆盖日期、时间、电话与证件号样式字符串，不能保证识别所有敏感信息。',
          '不导出图片。'
        ],
        assets: [],
        randomRecord: null,
        scroll: record
      };
    }
  });

  /* =====================================================================
   * 6. 节气庭院 · 随真实节气变化
   * ===================================================================== */

  /* 24 节气：按公历节气近似日期区间划分。
   * 明确标注：节气时刻以真实天文节气为准，本模块按近似日期判断，
   * 交界当日可能与实际节气时刻差一天，不参与任何测算。 */
  var SOLAR_TERMS = [
    { name: '小寒', from: [1, 5], hue: 200, plants: ['梅'], note: '梅未开，芽在积蓄' },
    { name: '大寒', from: [1, 20], hue: 205, plants: ['梅', '腊梅'], note: '一年最冷，讲究藏' },
    { name: '立春', from: [2, 4], hue: 100, plants: ['柳芽'], note: '东风解冻' },
    { name: '雨水', from: [2, 19], hue: 110, plants: ['柳', '苔'], note: '雨生百草' },
    { name: '惊蛰', from: [3, 5], hue: 120, plants: ['桃芽'], note: '蛰虫始出' },
    { name: '春分', from: [3, 20], hue: 130, plants: ['桃', '梨'], note: '昼夜等长' },
    { name: '清明', from: [4, 5], hue: 140, plants: ['柳', '青草'], note: '气清景明' },
    { name: '谷雨', from: [4, 20], hue: 150, plants: ['牡丹', '茶'], note: '雨生谷' },
    { name: '立夏', from: [5, 5], hue: 95, plants: ['槐'], note: '万物并秀' },
    { name: '小满', from: [5, 21], hue: 90, plants: ['麦', '桑'], note: '麦粒渐满' },
    { name: '芒种', from: [6, 5], hue: 85, plants: ['麦', '稻'], note: '有芒可收' },
    { name: '夏至', from: [6, 21], hue: 80, plants: ['荷'], note: '日最长' },
    { name: '小暑', from: [7, 7], hue: 70, plants: ['荷', '竹'], note: '温风至' },
    { name: '大暑', from: [7, 23], hue: 60, plants: ['荷', '葵'], note: '一年最热' },
    { name: '立秋', from: [8, 7], hue: 45, plants: ['桂'], note: '凉风初起' },
    { name: '处暑', from: [8, 23], hue: 40, plants: ['桂', '芦'], note: '暑气止' },
    { name: '白露', from: [9, 7], hue: 35, plants: ['菊', '露草'], note: '露凝而白' },
    { name: '秋分', from: [9, 23], hue: 30, plants: ['菊', '稻'], note: '昼夜再次等长' },
    { name: '寒露', from: [10, 8], hue: 25, plants: ['菊', '枫'], note: '露气寒冷' },
    { name: '霜降', from: [10, 23], hue: 20, plants: ['枫', '芦'], note: '初霜至' },
    { name: '立冬', from: [11, 7], hue: 210, plants: ['松'], note: '万物收藏' },
    { name: '小雪', from: [11, 22], hue: 215, plants: ['松', '梅'], note: '虹藏不见' },
    { name: '大雪', from: [12, 7], hue: 220, plants: ['松'], note: '积雪成尺' },
    { name: '冬至', from: [12, 22], hue: 225, plants: ['松', '腊梅'], note: '一阳生' }
  ];

  var GARDEN_KEY = 'garden';

  function currentTerm(date) {
    var d = date || new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var chosen = SOLAR_TERMS[0];
    SOLAR_TERMS.forEach(function (t) {
      if (m === t.from[0] && day >= t.from[1]) chosen = t;
      else if (m === t.from[0] && day < t.from[1]) { /* 本月节气尚未到，保留上一个 */ }
    });
    /* 若月份在最后一个月且日期小于该节气起始，则沿用上一节气 */
    return chosen;
  }

  function loadGarden() { return Reg.store.read(GARDEN_KEY, { items: [], unlocked: [] }); }

  /* 布置庭院：只影响装饰，不改变任何测算结果。 */
  function placeGarden(item) {
    var g = loadGarden();
    if (g.items.indexOf(item) < 0) g.items.push(item);
    Reg.store.write(GARDEN_KEY, g);
    return g;
  }
  function clearGarden() {
    Reg.store.write(GARDEN_KEY, { items: [], unlocked: [] });
    return { items: [], unlocked: [] };
  }

  /* 探索解锁：只靠完成文化探索或实际行动解锁，不用充值、不重复占卜、不做恐惧引导。 */
  function unlockGarden(key, reason) {
    var g = loadGarden();
    if (g.unlocked.filter(function (u) { return u.key === key; }).length) return g;
    g.unlocked.push({ key: key, reason: String(reason || ''), at: new Date().toISOString() });
    Reg.store.write(GARDEN_KEY, g);
    return g;
  }

  Reg.register({
    id: 'solar-term-garden',
    title: '节气庭院',
    version: 'playbook-1.0.0',
    status: 'implemented',
    cache: false,
    inputsSchema: { fields: [] },
    capabilities: [
      '按当前真实节气显示光色、植物与物象说明',
      '节气采用近似日期区间，交界日可能与实际节气时刻相差一天（已标注）',
      '庭院装饰可关闭，关闭后全部功能仍完整可用',
      '探索解锁只用完成探索与实际行动，不含充值与恐惧引导',
      '主题变化不改变任何测算结果'
    ],
    normalize: function () { return {}; },
    calculate: function (normalized, ctx) {
      var now = new Date();
      var term = currentTerm(now);
      var garden = loadGarden();
      return {
        resultId: Reg.newResultId('solar-term-garden'),
        moduleId: 'solar-term-garden',
        createdAt: now.toISOString(),
        inputSnapshot: ctx.snapshot,
        normalizedInputs: { term: term.name },
        method: '按公历节气近似区间判定当前节气，仅用于视觉主题，不参与任何测算。',
        algorithmVersion: 'playbook-1.0.0',
        evidence: [{
          label: term.name,
          reasons: [
            '节气区间：' + term.from[0] + ' 月 ' + term.from[1] + ' 日起',
            '物象：' + term.note,
            '参考植物：' + term.plants.join('、')
          ]
        }],
        interpretations: Reg.buildInterpretations({
          focus: '当前节气主题为「' + term.name + '」，庭院光色与植物随之变化。',
          basis: '按公历节气近似区间判定：' + term.from[0] + ' 月 ' + term.from[1] + ' 日起为' + term.name + '。',
          blocker: '节气交界当日可能与真实天文节气时刻相差一天，本模块按日期而非精确时刻判断。',
          first: '这只是视觉与文化主题，不影响任何排盘、起名或抽牌结果。',
          confirm: '若需要精确节气时刻，请查阅天文历书；本模块不提供精确节气计算。'
        }),
        actions: [{ at: '庭院', text: '关闭装饰后所有功能仍可完整使用' }],
        limitations: [
          '节气按近似日期区间判定，交界日可能相差一天。',
          '庭院装饰纯属视觉，不改变任何测算结果。',
          '解锁只用完成探索与实际行动，不设充值与恐惧引导。'
        ],
        assets: [],
        randomRecord: null,
        term: term,
        garden: garden
      };
    }
  });

  /* ===================================================================== */

  global.PlaybookModule = {
    cards: {
      load: loadCards, create: createCard, updateOutcome: updateOutcome,
      remove: removeCard, state: cardState, due: dueCards
    },
    forks: { load: loadForks, create: createFork, remove: removeFork, compare: compareSides },
    mirrors: { load: loadMirrors, save: saveMirror, systems: SYSTEMS, build: buildMirror },
    notes: { load: loadNotes, save: saveNote, remove: removeNote, explain: explainTerm },
    scrolls: { load: loadScrolls, create: createScroll, remove: removeScroll, toText: scrollToText, redact: redact },
    garden: {
      terms: SOLAR_TERMS, current: currentTerm,
      load: loadGarden, place: placeGarden, clear: clearGarden, unlock: unlockGarden
    }
  };
})(window);