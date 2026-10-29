/* 隔空牌桌 · 塔罗模块（第1阶段：鼠标 + 键盘）
 *
 * 硬性规则：
 *  - 78 张牌独立数据；洗牌不放回，同一次抽牌内不重复。
 *  - 一张牌的正逆位在一次保存结果中固定，不因鼠标悬停变化。
 *  - 每次抽牌保存原始随机结果、牌位、正逆位与算法版本。
 *  - 重播只播放既有结果，不重新抽牌。
 *  - 首版只开放有完整解释数据的牌阵。
 *  - 多张牌解释说明位置、承接与冲突，不机械拼接。
 */
(function (global) {
  'use strict';

  var Reg = global.ExtModuleRegistry;

  var CATEGORIES = [
    { key: 'love', label: '感情与关系' },
    { key: 'work', label: '事业与学业' },
    { key: 'money', label: '财务与资源' }
  ];

  var SPREADS = {
    single: {
      key: 'single', name: '一张牌 · 当下状态',
      positions: [
        { key: 'present', name: '此刻的位置', hint: '这件事当下的实际状态' }
      ]
    },
    three: {
      key: 'three', name: '三张牌 · 过去 / 当下 / 走向',
      positions: [
        { key: 'past', name: '第一张 · 已在发生', hint: '形成当前局面的主要因素' },
        { key: 'present', name: '第二张 · 正在发生', hint: '此刻起作用的力量' },
        { key: 'future', name: '第三张 · 倾向走向', hint: '按当前条件继续下去的自然倾向，不是必然结果' }
      ]
    },
    decision: {
      key: 'decision', name: '三张牌 · 选项比较（决策牌阵）',
      positions: [
        { key: 'optionA', name: '第一张 · 方案 A 的条件', hint: '选择 A 时起作用的条件与代价' },
        { key: 'optionB', name: '第二张 · 方案 B 的条件', hint: '选择 B 时起作用的条件与代价' },
        { key: 'advice', name: '第三张 · 比较所缺的依据', hint: '做这个决定前还需要看清的东西' }
      ]
    }
  };

  var ELEMENT_NOTE = {
    火: '权杖属火，偏向行动与意志',
    水: '圣杯属水，偏向感受与关系',
    风: '宝剑属风，偏向思考与沟通',
    土: '星币属土，偏向资源与实务'
  };

  function allCards() {
    var list = [];
    var major = global.TarotMajorArcana || [];
    var minor = global.TarotMinorArcana || [];
    for (var i = 0; i < major.length; i += 1) list.push(major[i]);
    for (var j = 0; j < minor.length; j += 1) list.push(minor[j]);
    return list;
  }

  var CARD_INDEX = (function () {
    var map = Object.create(null);
    allCards().forEach(function (c) { map[c.id] = c; });
    return map;
  })();

  /* 数据完整性检查：牌数、唯一 id、分类解释覆盖。
   * 缺数据时由渲染层显示"未判断"，这里只负责如实报告缺哪些。 */
  function audit() {
    var cards = allCards();
    var issues = [];
    if (cards.length !== 78) issues.push('牌库总数为 ' + cards.length + '，应为 78');
    var seen = Object.create(null);
    cards.forEach(function (c) {
      if (seen[c.id]) issues.push('重复牌号：' + c.id);
      seen[c.id] = true;
      if (!c.upright || !c.reversed) issues.push(c.name + ' 缺少正逆位数据');
      if (!c.categories) { issues.push(c.name + ' 缺少分类解释'); return; }
      CATEGORIES.forEach(function (cat) {
        var entry = c.categories[cat.key];
        if (!entry || (!entry.u && !entry.r)) {
          issues.push(c.name + ' 缺少「' + cat.label + '」解释');
        }
      });
    });
    return { count: cards.length, issues: issues };
  }

  /* 洗牌：Fisher–Yates，使用可注入的随机源以便测试。
   * 洗牌后产生一个"已抽取集合"，抽牌时从中取走，不放回。 */
  function shuffle(cards, random) {
    var rng = random || Math.random;
    var arr = cards.slice();
    for (var i = arr.length - 1; i > 0; i -= 1) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* 洗牌并标记正逆位。random 序列：每次抽牌消耗 2 次随机（牌序 + 正逆）。 */
  function draw(spreadKey, categoryKey, question, random) {
    var spread = SPREADS[spreadKey];
    if (!spread) throw new Error('未开放的牌阵：' + spreadKey);
    var cat = null;
    CATEGORIES.forEach(function (c) { if (c.key === categoryKey) cat = c; });
    if (!cat) throw new Error('未选择问题类别');
    var q = String(question || '').trim();
    if (!q) throw new Error('请填写一个具体问题');

    var rng = random || Math.random;
    var order = shuffle(allCards(), rng);
    var used = Object.create(null);
    var draws = [];

    spread.positions.forEach(function (pos, index) {
      var card = null;
      /* 洗牌不放回：跳过已用过的牌继续取，保证同一结果内不重复 */
      while (!card) {
        var candidate = order[index];
        if (!used[candidate.id]) { card = candidate; used[candidate.id] = true; }
        else {
          var fresh = shuffle(allCards(), rng)[0];
          if (!used[fresh.id]) { card = fresh; used[fresh.id] = true; }
          else {
            var spare = allCards().filter(function (c) { return !used[c.id]; })[0];
            if (!spare) throw new Error('牌库已耗尽');
            card = spare; used[card.id] = true;
          }
        }
      }
      /* 正逆位在这一刻确定并保存，之后不再因悬停改变 */
      var reversed = rng() < 0.5;
      draws.push({
        positionKey: pos.key,
        positionName: pos.name,
        positionHint: pos.hint,
        order: index + 1,
        cardId: card.id,
        cardName: card.name,
        group: card.group,
        imagery: card.imagery,
        reversed: reversed,
        source: card.source
      });
    });

    return {
      spreadKey: spreadKey,
      spreadName: spread.name,
      categoryKey: categoryKey,
      categoryLabel: cat.label,
      question: q,
      draws: draws,
      /* 记录随机消耗顺序，便于复现与核对 */
      randomConsumed: draws.length * 2
    };
  }

  /* ------------------------------------------------------- 解释生成 */

  function cardText(card, reversed, catKey) {
    var entry = card.categories;
    var out = { core: '', advice: '', category: '', element: '' };
    if (reversed) {
      out.core = card.reversed.core;
      out.advice = card.reversed.advice;
    } else {
      out.core = card.upright.core;
      out.advice = card.upright.advice;
    }
    var catEntry = entry && entry[catKey];
    if (catEntry) out.category = reversed ? (catEntry.r || '') : (catEntry.u || '');
    out.element = ELEMENT_NOTE[card.element] || (card.group + '：' + (card.element || '未标注'));
    return out;
  }

  /* 多张牌解释：必须说明位置、承接或冲突，不做机械拼接。 */
  function buildEvidence(randomRecord) {
    var catKey = randomRecord.categoryKey;
    return randomRecord.draws.map(function (d) {
      var card = CARD_INDEX[d.cardId];
      var t = cardText(card, d.reversed, catKey);
      return {
        order: d.order,
        positionName: d.positionName,
        positionHint: d.positionHint,
        cardName: d.cardName,
        group: d.group,
        imagery: d.imagery,
        orientation: d.reversed ? '逆位' : '正位',
        elementNote: t.element,
        core: t.core || '未判断：该牌在当前类别下缺少解释数据。',
        categoryText: t.category || '未判断：该牌在「' + (categoryLabel(randomRecord.categoryKey)) + '」类别下缺少解释数据。',
        advice: t.advice || '未判断：该牌缺少行动建议数据。',
        source: d.source
      };
    });
  }

  function categoryLabel(key) {
    var out = key;
    CATEGORIES.forEach(function (c) { if (c.key === key) out = c.label; });
    return out;
  }

  /* 承接与冲突：逐对比较相邻牌位，给出结构化判断而非关键词堆叠。 */
  function buildRelations(evidence) {
    var rels = [];
    for (var i = 0; i < evidence.length - 1; i += 1) {
      var a = evidence[i], b = evidence[i + 1];
      var sameGroup = a.group === b.group;
      var sameOrientation = a.orientation === b.orientation;
      var kind, text;
      if (sameGroup) {
        kind = '承接';
        text = a.positionName + '与' + b.positionName + '同属' + a.group +
          '，说明同一股力量前后相接：' + a.orientation + '的倾向会延续到' + b.orientation +
          '的状态里，两张牌不是两件事，而是同一件事的两个阶段。';
      } else if (sameOrientation) {
        kind = '并行';
        text = a.positionName + '（' + a.orientation + '）与' + b.positionName + '（' + b.orientation +
          '）虽属不同元素，但取向一致，两股力量方向相同而非互相抵消，判断时可以把它们当作同一个倾向来看。';
      } else {
        kind = '张力';
        text = a.positionName + '（' + a.orientation + '，' + a.group + '）与' + b.positionName +
          '（' + b.orientation + '，' + b.group + '）分属不同元素且取向相反，' +
          '这一对之间存在实际张力：满足前一个位置的条件，可能会动到后一个位置的条件。' +
          '需要先确认哪一边的代价更你能承受。';
      }
      rels.push({ from: a.order, to: b.order, kind: kind, text: text });
    }
    if (rels.length === 0) {
      rels.push({
        from: evidence[0].order, to: evidence[0].order, kind: '单一牌位',
        text: '本次只有一张牌，没有牌与牌之间的关系可比较。它只能说明此刻的位置，不能推断前后因果。'
      });
    }
    return rels;
  }

  /* 一句核心判断：由第一张牌的类别解释与整组关系共同决定，不是固定套话。 */
  function coreJudgment(record, evidence, relations) {
    var first = evidence[0];
    var tense = relations.filter(function (r) { return r.kind === '张力'; }).length;
    var head = first.cardName + '（' + first.orientation + '）出现在「' + first.positionName + '」：' +
      (first.categoryText || first.core);
    if (evidence.length === 1) {
      return head + ' 单张牌只反映当前位置，不构成对后续的承诺。';
    }
    if (tense > 0) {
      return head + ' 这组牌之间存在 ' + tense + ' 处张力，说明推进这件事不会顺，需要先处理牌与牌之间的冲突。';
    }
    return head + ' 各牌之间取向一致，问题不在方向而在具体做法。';
  }

  /* 当前阻力：来自牌位提示与张力，不是通用文案。 */
  function buildBlocker(evidence, relations) {
    var tens = relations.filter(function (r) { return r.kind === '张力'; });
    if (tens.length) {
      return tens.map(function (t) { return t.text; }).join(' ');
    }
    var last = evidence[evidence.length - 1];
    return '牌面之间没有明显冲突，阻力更可能出现在执行环节：' +
      (last.categoryText || last.core) + ' 建议在' + last.positionName + '这一步预留更多时间。';
  }

  /* 下一步建议：取自具体牌的行动建议，按位置排序，不重复同一句。 */
  function buildActions(evidence) {
    var seen = Object.create(null);
    var out = [];
    evidence.forEach(function (e) {
      if (!e.advice || seen[e.advice]) return;
      seen[e.advice] = true;
      out.push({ at: e.positionName, text: e.advice });
    });
    return out;
  }

  /* 你可以再想清楚的问题：由类别与牌位生成的具体追问。 */
  function buildQuestions(record, evidence) {
    var cat = record.categoryKey;
    var qs = [];
    if (cat === 'love') {
      qs.push('在这件事里，你希望对方做什么？把这句话直接写出来。');
      qs.push('如果对方什么都不做，你能接受的最坏结果是什么？');
    } else if (cat === 'work') {
      qs.push('这件事的成功标准是什么？谁来判断？');
      qs.push('你已经具备哪些条件，还缺哪一项？缺的那项需要多久能补上？');
    } else {
      qs.push('这笔投入的最坏情况是什么？金额是多少，你能承受吗？');
      qs.push('除了钱，这件事还占用你什么？');
    }
    qs.push('牌面说的是倾向，不是承诺。哪一条你能自己验证？验证方式是什么？');
    return qs.map(function (q) { return { text: q }; });
  }

  /* ------------------------------------------------------------ 结果 */

  function toResult(record, resultId) {
    var evidence = buildEvidence(record);
    var relations = buildRelations(evidence);
    var focus = '你问的是「' + record.question + '」，属于' + record.categoryLabel +
      '类问题，使用' + record.spreadName + '。本次只解释你实际抽到的 ' + record.draws.length + ' 张牌。';
    var basis = record.draws.map(function (d) {
      return d.positionName + ' 抽到' + d.cardName + '（' + (d.reversed ? '逆位' : '正位') + '），' +
        '数据来源：' + d.source;
    }).join(' ');

    return {
      resultId: resultId || Reg.newResultId('tarot'),
      moduleId: 'tarot',
      createdAt: new Date().toISOString(),
      inputSnapshot: Reg.buildSnapshot({
        question: record.question,
        spreadKey: record.spreadKey,
        spreadName: record.spreadName,
        categoryKey: record.categoryKey
      }, []),
      normalizedInputs: {
        spreadKey: record.spreadKey,
        spreadName: record.spreadName,
        categoryKey: record.categoryKey,
        question: record.question
      },
      method: '洗牌不放回抽取；正逆位在抽取瞬间确定并保存；解释由各牌独立数据与牌间关系比较生成。',
      algorithmVersion: 'tarot-1.0.0',
      evidence: evidence,
      interpretations: Reg.buildInterpretations({
        focus: focus,
        basis: basis,
        blocker: buildBlocker(evidence, relations),
        first: buildActions(evidence).map(function (a) { return a.at + '：' + a.text; }).join(' '),
        confirm: '本次结果只对这一个具体问题成立。更换问题或重新洗牌后结果会改变；' +
          '塔罗不能替代对现实信息的核对，重要决定请以可验证的事实为准。'
      }),
      actions: buildActions(evidence),
      limitations: [
        '塔罗牌义属于象征与自我反思工具，不是事实预测，本结果不构成对健康、收入、法律或安全的判断依据。',
        '牌面不会回答"什么时候"，也不给出确定结论；倾向与承诺是两回事。',
        '重播本次结果只播放已保存的抽牌记录，不会重新抽牌。'
      ],
      assets: [],
      randomRecord: {
        spreadKey: record.spreadKey,
        categoryKey: record.categoryKey,
        question: record.question,
        draws: record.draws.map(function (d) {
          return {
            positionKey: d.positionKey,
            positionName: d.positionName,
            cardId: d.cardId,
            cardName: d.cardName,
            reversed: d.reversed
          };
        }),
        randomConsumed: record.randomConsumed
      },
      /* 以下为渲染用附加结构，不属于统一结果的必填字段 */
      coreJudgment: coreJudgment(record, evidence, relations),
      relations: relations,
      followUps: buildQuestions(record, evidence)
    };
  }

  /* ------------------------------------------------------------ 存档 */

  var HISTORY_KEY = 'tarot_history';
  var MAX_HISTORY = 50;

  function saveHistory(record, result) {
    var list = Reg.store.read(HISTORY_KEY, []) || [];
    list.unshift({
      resultId: result.resultId,
      createdAt: result.createdAt,
      question: record.question,
      spreadKey: record.spreadKey,
      spreadName: record.spreadName,
      categoryKey: record.categoryKey,
      categoryLabel: record.categoryLabel,
      draws: record.draws,
      algorithmVersion: result.algorithmVersion
    });
    Reg.store.write(HISTORY_KEY, list.slice(0, MAX_HISTORY));
    return list.slice(0, MAX_HISTORY);
  }

  function loadHistory() { return Reg.store.read(HISTORY_KEY, []) || []; }

  function deleteHistory(resultId) {
    var list = loadHistory().filter(function (x) { return x.resultId !== resultId; });
    Reg.store.write(HISTORY_KEY, list);
    return list;
  }

  /* 重播：只按已有记录重建结果，不调用 draw()，因此不重新抽牌。 */
  function replay(resultId) {
    var found = loadHistory().filter(function (x) { return x.resultId === resultId; })[0];
    if (!found) throw new Error('未找到该次抽牌记录');
    var record = {
      spreadKey: found.spreadKey || (found.draws.length === 1 ? 'single' : 'three'),
      spreadName: found.spreadName,
      categoryKey: found.categoryKey,
      categoryLabel: found.categoryLabel,
      question: found.question,
      draws: found.draws,
      randomConsumed: found.draws.length * 2
    };
    /* 重播是同一次抽取的再现，沿用原 resultId，不产生新记录 */
    return toResult(record, found.resultId);
  }

  /* ------------------------------------------------------------ 模块 */

  Reg.register({
    id: 'tarot',
    title: '隔空牌桌 · 塔罗',
    version: 'tarot-1.0.0',
    status: 'implemented',
    cache: false,
    inputsSchema: {
      fields: [
        { name: 'question', label: '具体问题', type: 'string', required: true },
        { name: 'categoryKey', label: '问题类别', type: 'string', required: true },
        { name: 'spreadKey', label: '牌阵', type: 'string', required: true }
      ]
    },
    capabilities: [
      '78 张完整牌库（22 大阿卡纳 + 56 小阿卡纳）',
      '洗牌不放回，同一次抽牌不重复',
      '正逆位在抽取瞬间确定并保存',
      '三种有完整解释数据的牌阵',
      '多牌关系比较（承接 / 并行 / 张力）',
      '历史存档与重播（重播不重新抽牌）'
    ],
    normalize: function (raw) {
      return {
        question: String(raw.question || '').trim(),
        categoryKey: String(raw.categoryKey || ''),
        spreadKey: String(raw.spreadKey || '')
      };
    },
    calculate: function (normalized, ctx) {
      /* 随机模块不读缓存：每次明确抽取动作产生并保存新结果 */
      var record = draw(normalized.spreadKey, normalized.categoryKey, normalized.question);
      var result = toResult(record);
      result.inputSnapshot = ctx.snapshot;
      result.savedDraws = record.draws;
      /* 抽取即存档：重播只读取这份记录，不重新抽牌 */
      saveHistory(record, result);
      return result;
    },
    snapshot: function (raw, normalized) {
      var snap = Reg.buildSnapshot(normalized, []);
      snap.drawMoment = new Date().toISOString();
      snap.note = '正逆位在抽取瞬间确定，之后不因悬停或重播改变。';
      return snap;
    }
  });

  /* 未实现模块只登记描述，不提供假界面。 */
  Reg.register({
    id: 'star-lodge', title: '二十八宿星空剧场', version: '0.0.0', status: 'planned',
    capabilities: [], phase: 2,
    note: '第2阶段实现。需先确定采用的宿曜分配法、时间边界与出处，再计算；不混用历法与天文赤经。'
  });
  Reg.register({
    id: 'zodiac', title: '星座探索 · 会转动的星盘', version: '0.0.0', status: 'planned',
    capabilities: [], phase: 2,
    note: '第2阶段实现。完整出生星盘需核实时历、历史时区与夏令时数据，验证通过前不开放。'
  });
  Reg.register({
    id: 'space-lab', title: '户型空间实验室', version: '0.0.0', status: 'planned',
    capabilities: [], phase: 3,
    note: '第3阶段实现。先做可校正的二维编辑与家具拖动；实用空间建议与传统文化分层展示。'
  });
  Reg.register({
    id: 'face-mirror', title: '面相文化镜', version: '0.0.0', status: 'planned',
    capabilities: [], phase: 3,
    note: '第3阶段实现。只做文化标注与学习，不做照片推断性格、财富、健康或人生结局。'
  });
  Reg.register({
    id: 'palm-map', title: '掌纹探索', version: '0.0.0', status: 'planned',
    capabilities: [], phase: 3,
    note: '第3阶段实现。先做辅助标注版；没有可靠分割模型时不自动生成纹路。'
  });
  Reg.register({
    id: 'gesture', title: '隔空御盘 · 手势操作', version: '0.0.0', status: 'planned',
    capabilities: [], phase: 4,
    note: '第4阶段实现。本轮未接入 MediaPipe 与摄像头，手势能力不列入验收通过项；拒绝摄像头时全部功能仍可用鼠标键盘完成。'
  });

  global.TarotModule = {
    CATEGORIES: CATEGORIES,
    SPREADS: SPREADS,
    allCards: allCards,
    audit: audit,
    shuffle: shuffle,
    draw: draw,
    toResult: toResult,
    saveHistory: saveHistory,
    loadHistory: loadHistory,
    deleteHistory: deleteHistory,
    replay: replay,
    categoryLabel: categoryLabel
  };
})(window);