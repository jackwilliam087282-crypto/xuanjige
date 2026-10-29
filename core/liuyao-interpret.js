/**
 * core/liuyao-interpret.js —— 六爻解释层（第四层）
 *
 * 硬约束（审计要求二、3）：
 *   Interpretation 只根据 RuleTrace 组织文字，
 *   不得绕过规则轨迹直接按档位输出整段模板。
 *
 * 硬约束（审计要求三、6）：
 *   动爻解释必须使用「该卦该爻」的实际原文，
 *   不得用「初爻代表开始」等位置通用句替代。
 *
 * 硬约束（审计要求五、6）：
 *   不得仅凭自定义分数生成确定成败、灾祸或固定日期应期。
 *   应期只给「待合参」提示，不给具体日期。
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./trace.js'), require('./gua-text.js'));
  } else {
    root.LiuYaoInterpret = factory(root.RuleTrace, root.GuaText);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (RT, GuaText) {
  'use strict';

  var S = RT.SOURCE;

  /** 六亲的一般含义（作为术语，不作为个人结论） */
  var LIUQIN_MEAN = {
    父母: '父母为文书、契据、庇护、长辈',
    兄弟: '兄弟为同辈、同行、竞争者',
    子孙: '子孙为解神、医药、晚辈',
    妻财: '妻财为钱财、货物、现实利益',
    官鬼: '官鬼为职位、官方、压力与拘束'
  };

  var WX_TRAIT = {
    木: '木主生长、条达，宜循序渐进',
    火: '火主光明、急速，宜速决',
    土: '土主厚重、承载，宜稳守',
    金: '金主肃杀、决断，宜果断',
    水: '水主流动、隐蔽，宜灵活'
  };

  /**
   * 由排盘结果生成 RuleTrace 列表
   * @param {object} chart liuyao-chart.build() 的输出
   * @param {object} opt   { yongPick: pickYong 结果 }
   */
  function buildTraces(chart, opt) {
    opt = opt || {};
    var ts = new RT.TraceSet(RT.SYSTEM.LIUYAO);
    var yongWx = chart.yong;
    var yongLq = opt.yongPick && opt.yongPick.liuqin;
    var yongYao = null;
    chart.yaos.forEach(function (y) { if (y.liuqin === yongLq) yongYao = y; });

    /* 规则 1：取用是否唯一 */
    if (opt.yongPick && opt.yongPick.ambiguous) {
      ts.add({
        ruleId: 'LY-YONG-AMBIGUOUS', system: RT.SYSTEM.LIUYAO,
        premise: '问题未结构化确认，或事项无法唯一取用',
        facts: [opt.yongPick.reason],
        target: '用神', direction: 0, strength: 0,
        conflicts: [], source: S.CONVENTION,
        limits: ['在取用唯一之前，不得给出确定成败与应期'],
        citation: '本软件约定：取用不唯一时拒绝输出确定结论'
      });
    } else {
      ts.add({
        ruleId: 'LY-YONG-PICK', system: RT.SYSTEM.LIUYAO,
        premise: '问题已确认，事项大类可映射取用',
        facts: [chart.yong + '（用神五行）', yongLq + '（对应六亲）'],
        target: '用神', direction: 0, strength: 0,
        source: S.CONVENTION,
        limits: ['取用对照表为本软件约定，不同流派取法可能不同'],
        citation: opt.yongPick && opt.yongPick.reason
      });
    }

    /* 规则 2：卦名 + 卦辞原文 */
    ts.add({
      ruleId: 'LY-GUA-CI', system: RT.SYSTEM.LIUYAO,
      premise: '本卦已定',
      facts: [chart.pureName, chart.palaceLabel],
      target: '卦象', direction: 0, strength: 0.3,
      source: S.CLASSIC, citation: '《周易》卦辞（文王）',
      limits: ['卦辞为经文断语，需参合动爻与用神']
    });

    /* 规则 3：用神旺衰（月建、日辰、旬空、月破） */
    if (yongYao) {
      var facts = [
        yongYao.posName + '爻 ' + yongYao.ganZhi + '（' + yongYao.liuqin + '）',
        '月建 ' + chart.monthGZ + '（' + yongYao.yueJian + '）',
        '日辰 ' + chart.dayGZ
      ];
      if (yongYao.riChen) { facts.push('临日辰'); ts.add({
        ruleId: 'LY-YONG-RICHEN', system: RT.SYSTEM.LIUYAO,
        premise: '用神爻支与日辰相同', facts: facts, target: '用神',
        direction: 1, strength: 0.4, source: S.CLASSIC,
        citation: '《增删卜易》日辰生扶：临日辰者事有助力',
        limits: ['临日辰不等于事必成，仍须看动爻与冲散']
      }); }
      if (yongYao.yuePo) { ts.add({
        ruleId: 'LY-YONG-PO', system: RT.SYSTEM.LIUYAO,
        premise: '用神爻支与月支相冲（逢月破）', facts: facts, target: '用神',
        direction: -1, strength: 0.4, source: S.CLASSIC,
        citation: '《增删卜易》月破：月破之爻其力最弱',
        limits: ['月破须待出月或填实方能论强弱']
      }); }
      if (yongYao.xianKong) { ts.add({
        ruleId: 'LY-YONG-KONG', system: RT.SYSTEM.LIUYAO,
        premise: '用神爻支落本旬空亡', facts: facts, target: '用神',
        direction: -1, strength: 0.3, source: S.CLASSIC,
        citation: '《增删卜易》旬空：空亡之爻须待出旬或冲空方能起作用',
        limits: ['旬空不等于事不成，只表示此时力量不显']
      }); }
      var wxRel = relWx(yongYao.zhiWx, wxOfZhiSafe(chart.monthGZ.charAt(1)));
      if (wxRel) {
        ts.add({
          ruleId: 'LY-YONG-MONTH-' + wxRel.to.toUpperCase(), system: RT.SYSTEM.LIUYAO,
          premise: '用神爻支与月建的五行生克关系', facts: facts.concat([wxRel.label]),
          target: '用神', direction: wxRel.dir, strength: 0.3,
          source: S.CLASSIC, citation: '月建为提纲，主一令之休旺',
          limits: ['单看月建不足，须合日辰、动爻、变爻并参']
        });
      }
    } else if (!opt.yongPick || !opt.yongPick.ambiguous) {
      ts.add({
        ruleId: 'LY-YONG-ABSENT', system: RT.SYSTEM.LIUYAO,
        premise: '本卦六爻中无用神六亲',
        facts: [chart.yaos.map(function (y) { return y.liuqin; }).join('、'), '用神：' + yongWx],
        target: '用神', direction: 0, strength: 0,
        source: S.CLASSIC, citation: '《增删卜易》用神不上卦：须看伏神或待冲起',
        limits: ['用神不上卦时不能直接断吉凶，须参伏神与日月']
      });
    }

    /* 规则 4：动爻——必须用该卦该爻原文 */
    var moving = chart.yaos.filter(function (y) { return y.moving; });
    moving.forEach(function (y) {
      var yc = GuaText.yaoCi(chart.pureName, y.pos, y.yang);
      ts.add({
        ruleId: 'LY-YAO-' + chart.pureName + '-' + y.pos, system: RT.SYSTEM.LIUYAO,
        premise: y.posName + '爻' + y.name + '动' + (y.value === 9 ? '（阳变阴）' : '（阴变阳）'),
        facts: [
          yc.fullTitle + '：' + yc.text,
          y.ganZhi + ' → ' + y.bianGanZhi + '（' + y.bianLiuqin + '）',
          y.bianLiuqin + '：' + LIUQIN_MEAN[y.bianLiuqin] || ''
        ],
        target: '动爻', direction: 0, strength: 0.5,
        source: S.CLASSIC,
        citation: '《周易》' + chart.pureName + '·' + yc.fullTitle,
        limits: ['爻辞须结合用神旺衰与所问事项理解，不可单凭爻辞定吉凶']
      });
    });

    /* 规则 5：世应关系 */
    if (chart.shiPos) {
      var shiYao = chart.yaos[chart.shiPos - 1];
      var youYao = chart.yaos[chart.youPos - 1];
      ts.add({
        ruleId: 'LY-SHI-YOU', system: RT.SYSTEM.LIUYAO,
        premise: chart.palaceLabel,
        facts: [
          '世爻：' + (shiYao ? shiYao.posName + '爻 ' + shiYao.ganZhi + '（' + shiYao.liuqin + '）' : '—'),
          '应爻：' + (youYao ? youYao.posName + '爻 ' + youYao.ganZhi + '（' + youYao.liuqin + '）' : '—')
        ],
        target: '世应', direction: 0, strength: 0.2,
        source: S.CLASSIC, citation: '《京氏易传》世应：世为己、应为彼或环境',
        limits: ['世应只标示立场归属，本身不直接定吉凶']
      });
      if (shiYao && youYao && chart.yaos.some(function (y) { return y.liuqin === (opt.yongPick && opt.yongPick.liuqin) && y.moving; })) {
        ts.add({
          ruleId: 'LY-SHI-YOU-MOVE', system: RT.SYSTEM.LIUYAO,
          premise: '用神发动',
          facts: ['用神所属六亲动于' + chart.yaos.filter(function (y) { return y.liuqin === (opt.yongPick && opt.yongPick.liuqin) && y.moving; })[0].posName + '爻'],
          target: '世应', direction: 0, strength: 0.3,
          source: S.CLASSIC, citation: '用神发动：事在自身一侧主动',
          limits: ['须再参世爻自身旺衰']
        });
      }
    }

    /* 规则 6：卦变关系 */
    if (chart.changedName) {
      ts.add({
        ruleId: 'LY-CHANGE', system: RT.SYSTEM.LIUYAO,
        premise: '本卦有动爻',
        facts: [chart.pureName + ' → ' + chart.changedName, '动爻 ' + chart.movingCount + ' 个'],
        target: '卦变', direction: 0, strength: 0.3,
        source: S.CLASSIC, citation: '《周易本义》变卦：动则变，变则事有转移',
        limits: ['变卦所示为趋势方向，非确定结局']
      });
    } else {
      ts.add({
        ruleId: 'LY-NO-CHANGE', system: RT.SYSTEM.LIUYAO,
        premise: '六爻皆静',
        facts: ['本卦 ' + chart.pureName + ' 无动爻'],
        target: '卦变', direction: 0, strength: 0.1,
        source: S.CLASSIC, citation: '六爻不变，事态多守常',
        limits: ['静卦不等于事一定不变，仍须看日月旺衰与冲合']
      });
    }

    /* 规则 7：空破冲合汇总 */
    var kongList = chart.yaos.filter(function (y) { return y.xianKong; }).map(function (y) { return y.posName + y.ganZhi; });
    var poList = chart.yaos.filter(function (y) { return y.yuePo; }).map(function (y) { return y.posName + y.ganZhi; });
    if (kongList.length) ts.add({
      ruleId: 'LY-XUNKONG', system: RT.SYSTEM.LIUYAO,
      premise: '本旬旬空', facts: ['旬空：' + chart.xunKong.join('、'), '落空之爻：' + kongList.join('、')],
      target: '旬空', direction: 0, strength: 0.2, source: S.CLASSIC,
      citation: '旬空：六十甲子中空亡之两位', limits: ['落空者力量暂不显，非必败']
    });
    if (poList.length) ts.add({
      ruleId: 'LY-YUEPO', system: RT.SYSTEM.LIUYAO,
      premise: '月破之爻', facts: ['月破支：' + chart.yuePo, '月破之爻：' + poList.join('、')],
      target: '月破', direction: -1, strength: 0.2, source: S.CLASSIC,
      citation: '《增删卜易》月破：与月支相冲之爻', limits: ['月破待填实可复-strength']
    });

    return ts;
  }

  function relWx(yaoWx, monthWx) {
    if (!yaoWx || !monthWx) return null;
    var SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
    var KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
    if (monthWx === yaoWx) return { dir: 1, to: monthWx, label: '月建与用神同五行（旺）' };
    if (SHENG[monthWx] === yaoWx) return { dir: 1, to: monthWx, label: '月建生用神（相生扶助）' };
    if (KE[monthWx] === yaoWx) return { dir: -1, to: monthWx, label: '月建克用神（受制）' };
    if (KE[yaoWx] === monthWx) return { dir: -1, to: monthWx, label: '用神克月建（泄月建之气）' };
    if (SHENG[yaoWx] === monthWx) return { dir: 0, to: monthWx, label: '用神生月建（泄气）' };
    return null;
  }
  function wxOfZhiSafe(z) {
    var m = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
    return m[z];
  }

  /**
   * 生成 Interpretation：只依据 RuleTrace 组织文字
   * 每一条结论都带 ruleId，可被 validateInterpretation 校验。
   */
  function interpret(chart, opt) {
    opt = opt || {};
    var ts = buildTraces(chart, opt);
    var items = ts.items;
    var paras = [];

    /* 1. 卦象与卦辞（原文） */
    var ciTrace = find(items, 'LY-GUA-CI');
    if (ciTrace) {
      paras.push({
        kind: 'gua',
        ruleIds: [ciTrace.ruleId],
        title: '本卦：' + chart.pureName + '（' + chart.palaceLabel + '）',
        /* 1.5.0：guaCi 现返回 { gua, text, has }，取 .text */
        body: '卦辞原文：' + (GuaText.guaCi(chart.pureName).text || '（本卦卦辞缺失）')
      });
    }

    /* 2. 用神取用情况 */
    if (opt.yongPick && opt.yongPick.ambiguous) {
      paras.push({
        kind: 'warning',
        ruleIds: ['LY-YONG-AMBIGUOUS'],
        title: '无法唯一取用',
        body: opt.yongPick.reason + '。因此本卦不输出确定成败与固定应期。' +
          '请先在「问题结构」中明确事项大类、对象与目标，确认后再行取用。'
      });
    } else {
      var yp = find(items, 'LY-YONG-PICK');
      paras.push({
        kind: 'yong',
        ruleIds: [yp ? yp.ruleId : 'LY-YONG-PICK'],
        title: '用神：' + chart.yong + '（' + (opt.yongPick && opt.yongPick.liuqin) + '）',
        body: (opt.yongPick && opt.yongPick.reason || '') +
          '　本软件约定：取用对照表非唯一古法，不同流派取法可能不同。'
      });
    }

    /* 3. 用神旺衰（逐条列证据，不给不透明总分） */
    var yongRules = items.filter(function (t) {
      return t.target === '用神' && t.ruleId !== 'LY-YONG-PICK' && t.ruleId !== 'LY-YONG-AMBIGUOUS';
    });
    if (yongRules.length) {
      paras.push({
        kind: 'evidence',
        ruleIds: yongRules.map(function (t) { return t.ruleId; }),
        title: '用神旺衰证据',
        lines: yongRules.map(function (t) {
          return '· ' + t.premise + '（' + t.facts.slice(0, 2).join('；') + '）' +
            (t.citation ? '　依据：' + t.citation : '');
        }),
        boundary: '以上为逐项证据，不合成为单一分数；结论随所问事项与格局而异。'
      });
    }

    /* 4. 动爻（必须原文） */
    var moving = chart.yaos.filter(function (y) { return y.moving; });
    if (moving.length) {
      var lines = [];
      var rids = [];
      moving.forEach(function (y) {
        var yc = GuaText.yaoCi(chart.pureName, y.pos, y.yang);
        var rid = 'LY-YAO-' + chart.pureName + '-' + y.pos;
        rids.push(rid);
        lines.push(yc.fullTitle + '：' + yc.text +
          '　（' + y.ganZhi + ' → ' + y.bianGanZhi + '，化' + y.bianLiuqin + '）');
      });
      var extra = [];
      if (chart.pureName.indexOf('乾') === 0 && moving.length === 6) {
        extra.push('用九：' + GuaText.YONG_JIU);
      }
      if (chart.pureName.indexOf('坤') === 0 && moving.length === 6) {
        extra.push('用六：' + GuaText.YONG_LIU);
      }
      paras.push({
        kind: 'moving',
        ruleIds: rids,
        title: '动爻爻辞（原文）',
        lines: lines.concat(extra),
        boundary: '爻辞为《周易》经文，须结合用神旺衰与所问事项理解，不可单凭爻辞断吉凶。'
      });
    }

    /* 5. 世应 */
    var sy = find(items, 'LY-SHI-YOU');
    if (sy) {
      paras.push({
        kind: 'shiyou',
        ruleIds: [sy.ruleId],
        title: '世应',
        body: sy.facts.join('　') + '　世为己、应为彼或环境，本身不直接定吉凶。'
      });
    }

    /* 6. 卦变 */
    var chg = find(items, 'LY-CHANGE');
    var nochg = find(items, 'LY-NO-CHANGE');
    if (chg) {
      paras.push({
        kind: 'change',
        ruleIds: [chg.ruleId],
        title: '卦变：' + chart.pureName + ' → ' + chart.changedName,
        body: '动爻 ' + chart.movingCount + ' 个。' +
          '互卦 ' + chart.huName + '，错卦 ' + chart.cuoName + '，综卦 ' + chart.zongName + '。' +
          '变卦所示为趋势方向，非确定结局。'
      });
    } else if (nochg) {
      paras.push({
        kind: 'change',
        ruleIds: [nochg.ruleId],
        title: '六爻皆静',
        body: '本卦 ' + chart.pureName + ' 无动爻。互卦 ' + chart.huName +
          '，错卦 ' + chart.cuoName + '，综卦 ' + chart.zongName + '。静卦不等于事一定不变。'
      });
    }

    /* 7. 旬空月破 */
    var kk = find(items, 'LY-XUNKONG');
    var yp2 = find(items, 'LY-YUEPO');
    if (kk || yp2) {
      var rids2 = [];
      var l2 = [];
      if (kk) { rids2.push(kk.ruleId); l2.push('旬空 ' + chart.xunKong.join('、') + '：' + kk.facts[1]); }
      if (yp2) { rids2.push(yp2.ruleId); l2.push('月破 ' + chart.yuePo + '：' + yp2.facts[1]); }
      paras.push({
        kind: 'kongpo',
        ruleIds: rids2,
        title: '旬空与月破',
        lines: l2,
        boundary: '落空者力量暂不显，月破者待填实可复，均不等于事必败。'
      });
    }

    /* 8. 应期说明：只给待合参提示，不给固定日期 */
    paras.push({
      kind: 'timing',
      ruleIds: [],
      title: '应期',
      body: '应期需以用神爻支的合、冲、值、填实四类条件合参流月流日方能定，' +
        '本软件当前未实现完整的应期推算，故不输出具体日期。' +
        '如需应期，须先补齐流月流日与旬空月破的合参规则。',
      boundary: '不依据自定义分数生成固定日期应期。'
    });

    return {
      algoVersion: RT.ALGO_VERSION,
      traces: items,
      paragraphs: paras,
      deterministic: true
    };
  }

  function find(arr, id) { return arr.filter(function (t) { return t.ruleId === id; })[0] || null; }

  return { interpret: interpret, buildTraces: buildTraces, LIUQIN_MEAN: LIUQIN_MEAN, WX_TRAIT: WX_TRAIT };
});
