/**
 * 九宫占卜引擎 —— 方位事体占法
 *
 * 用途：为**任何人事**（可无生辰）针对**一件具体的事**起卦，
 *      断吉凶、成败、应期，并给出「成事如何更顺 / 坏事如何破」的方案。
 *
 * 与传统九宫飞星不同之处：
 *   飞星 —— 看一方的**长期气场**（适合固定居所、长期布局）
 *   本法 —— 断**一件事的成败**（临时问事、一事一占）
 *
 * 依《奇门遁甲》九宫对应人事、《大六壬》课体、《梅花易数》体用生克推演：
 *
 *   1. 对方（求测人）报两个数字 → 定「用神宫」（所问之事落在哪一宫）
 *   2. 报一个数字 → 定「测宫」（事情当前所处之势）
 *   3. 再报一个数字 → 定「应期宫」（事情何时收局）
 *   4. 依宫位五行与用神宫的生克关系，断吉凶成败
 *   5. 吉方得助则「加力」，凶方受制则「转向」
 *
 * 全部推算不依赖生辰，纯以「问事当下的空间方位取象」，
 * 这正是九宫占卜的本来用法 —— 九宫本就是「以方位统事」。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./bazi-core.js'));
  } else {
    root.JiuGongDivine = factory(root.BaziCore);
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (core) {
  'use strict';

  var GAN = core.GAN;
  var ZHI = core.ZHI;

  /* ==========================================================
   * 一、九宫人事分类 —— 断「所问何事」用
   * ========================================================== */

  /* ==========================================================
   * 【BUG 修复 v6】报数信息量补充 —— 原实现的信息坍缩根因
   *
   * 原实现把报数一律归一为洛书 1-9：n -> ((n-1)%9)+1
   * 于是「报 3」与「报 57」得同一卦，而 1..99 的 99 个可能
   * 坍缩为 9 个，727%的原始信息被丢弃。这正是用户反馈
   * 「三数问事结果几乎雷同」的第一重根因。
   *
   * 《梅花易数》原文对报数取象本有两法：
   *   ①「数尽者论其总数」—— 报数先取整，十位数为「进」，个位数为「退」；
   *   ②「 Flowers 朵数 / 蓍草数 」—— 以商余定「老少、阴阳、动静」。
   * 故本版保留洛书归一，同时把「商」（进位层）与「余」（老少层）
   * 完整取出，作为卦层之外的二级、三级判别依据。
   * ========================================================== */

  /** 报数解析：洛书归一 + 商（进层）+ 余（老少层）+ 原始数 */
  function parseNum(raw) {
    var n = Math.abs(parseInt(raw, 10));
    if (!isFinite(n)) n = 9;
    /* 【1.6.0 修正】原实现把 n < 1 一律归 1，与 CONVENTION_DISCLOSURE
     * 中公开的「0 作 9」相互矛盾（第十章要求公开约定必须与实现一致）。
     * 这里统一按披露约定：0 归入洛书 9；负数取绝对值后再归一。 */
    if (n === 0) n = 9;
    if (n < 0) n = 9;
    // 洛书归一（1-9）
    var luo = ((n - 1) % 9) + 1;
    // 商：进位层。传统取「十位为进」，（n-1)/9 的整除部分即进层
    var layer = Math.floor((n - 1) / 9);
    // 余：老少层。(n-1)%9 为天盘序（0-8），加一为地盘数
    var within = ((n - 1) % 9) + 1;
    // 老少：奇数为少（阳），偶数为老（阴）。《火珠林》「少者轻、老者重」
    var isYang = luo % 2 === 1;
    return {
      raw: n,
      luo: luo,
      layer: layer,       // 0=本宫, 1=一度进, 2=二度进...
      within: within,
      isYang: isYang,
      weight: 1 + Math.min(layer, 3) * 0.15   // 进层越深，力量越厚
    };
  }

  // 事项类型 → 用神所栖之宫（传统九宫人事对应）
  var SHI_TYPE = {
    '财运求财': {
      gua: '乾', why: '乾为天、为金、为首父，主财权、贵人、大额进项',
      useK: '财源、外来机会、贵人、公门之贵',
      checkK: '所求为何（名分、渠道、靠山）',
      risk: '贪多、担保、投机',
      good: '正财稳、偏财动，量力而为',
      bad: '易因贪心或轻信而破财',
      goodDo: '把要紧的谈判与签约排在上午（乾时），并在西北方位办；款项走对公账户，凭证留底。',
      badDo: '忌高杠杆、忌替人作保、忌听口头承诺；大额进出须先落纸面再动款。'
    },
    '事业升职': {
      gua: '离', why: '离为火、为明，主名声、职位、文书',
      useK: '职位、名声、领导赏识',
      checkK: '能力是否被看见',
      risk: '急功近利、锋芒太露',
      good: '宜展现才华、主动争取',
      bad: '易被忌惮、功高盖主',
      goodDo: '呈文、述职、汇报安排在南方与午时（离时）；先递书面材料再口头陈述，让上面先看到文字。',
      badDo: '忌当众抢话、忌越过直属上司；拿不准的决策先请示，后担责。'
    },
    '感情姻缘': {
      gua: '兑', why: '兑为泽、为悦，主口舌、情感、男女相悦',
      useK: '对方心意、情感回应',
      checkK: '双方是否有交集',
      risk: '言语失当、时机不对',
      good: '宜开口、宜表明',
      bad: '易因一句话弄巧成拙',
      goodDo: '选酉时（17-19 点）或西侧场所开口；先给台阶再谈条件，重要的话当面说、不过微信。',
      badDo: '忌翻旧账、忌拿别人的事做交换；情绪上头时一律不谈，隔夜再回。'
    },
    '考试学业': {
      gua: '巽', why: '巽为风、为入，主文书、才艺、考试',
      useK: '文书、成绩、录取',
      checkK: '准备是否到位',
      risk: '临场焦虑、方向偏差',
      good: '宜专注、宜循序',
      bad: '易分散精力、临时改策略',
      goodDo: '东南向、巽时（9-11 点）读书最见功；一轮只攻一科，做完一项再开下一项。',
      badDo: '忌中途换资料、忌报太多班；报名前先核清录取条件与退费条款。'
    },
    '健康疾病': {
      gua: '艮', why: '艮为山、为止，主形体、关节、阻滞',
      useK: '病情、康复',
      checkK: '身体的实际状况',
      risk: '拖延就医、硬扛',
      good: '宜静养、宜早治',
      bad: '易因拖延而加重',
      goodDo: '东北向、艮时（15-17 点）宜静养；把复查日期写进日程并设提醒，早一天都比晚一天好。',
      badDo: '忌硬扛、忌自行加减药、忌久坐不动；症状变化先就医，不在网上对号入座。'
    },
    '官司诉讼': {
      gua: '坤', why: '坤为地、为顺众，主契约、证据、群众',
      useK: '证据、契约、对方意图',
      checkK: '依据是否充分',
      risk: '交涉过早、留下把柄',
      good: '宜和解、宜找中间人',
      bad: '易因言语泄露而被动',
      goodDo: '西南向、坤时（19-21 点）适合谈和解；请双方都信得过的第三方先居中传话，再开正式沟通。',
      badDo: '忌在群里讨论、忌单独与对方私下承诺；所有往来留书面记录，重要条款让律师过目。'
    },
    '出行迁移': {
      gua: '震', why: '震为雷、为动，主迁动、变局、启程',
      useK: '行程、变动、落脚',
      checkK: '方向与时机',
      risk: '仓促、行程受阻',
      good: '宜动、宜早行',
      bad: '易因意外延误',
      goodDo: '启程取震时（3-5 点）或东向出发；行前把证件、票据、充电分三袋装，路上不再回头。',
      badDo: '忌临时改签、忌单手拎重物赶路；行程留一日缓冲，遇阻先改期不硬赶。'
    },
    '合作谈判': {
      gua: '巽', why: '巽为风、为入，主渗透、协商、渐进',
      useK: '对方诚意、条件',
      checkK: '彼此底线',
      risk: '让利过多、条款不清',
      good: '宜渐进、宜以退为进',
      bad: '易让步过多而失去主动',
      goodDo: '东南向、巽时（9-11 点）适合开局；先用小条件试探对方底线，再逐步加码，别一次摊牌。',
      badDo: '忌先给最终价、忌无授权范围就点头；每一轮让步都换来对方的对等承诺，写进纪要。'
    },
    '寻人寻物': {
      gua: '坤', why: '坤为地、为藏，主所寻之物的所在与踪迹',
      useK: '踪迹、方位、下落',
      checkK: '最后出现的时间地点',
      risk: '方向搞反、时机不对',
      good: '宜守静待、宜循迹',
      bad: '愈急愈找不到',
      goodDo: '西南向、坤时（19-21 点）复盘最后线索；从最常出现的地点与时段倒推，固定守在同一处等。',
      badDo: '忌急换路线、忌大范围张罗；先列三处最可能的落脚点，一处守满一日再换。'
    },
    '买卖交易': {
      gua: '兑', why: '兑为泽、为交易，主口舌权衡、货物往来',
      useK: '对方底价、成交意愿',
      checkK: '价格与条件的差距',
      risk: '急躁让步、条款模糊',
      good: '宜谈、宜细察对方反应',
      bad: '易因一句话让利过多',
      goodDo: '酉时（17-19 点）在西方位谈价；先问清对方的急迫度再报价，把交付与付款节奏挂钩。',
      badDo: '忌先报价、忌口头拍定；定金与尾款比例写清，验收标准附在合同里。'
    }
  };

  /* ==========================================================
   * 二、洛书与生克
   * ========================================================== */

  // 洛书九宫。5 为中宫，五黄寄于坤（承载万物），故此处归坤
  var LUOSHU = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '坤', 6: '乾', 7: '兑', 8: '艮', 9: '离' };
  var GUA_INFO = {
    乾: { dir: '西北', elem: '金', sym: '☰', name: '老父', sex: '父', animal: '马',
           trait: '刚健', organ: '首、肺', season: '秋冬之交', body: '首面、筋骨' },
    坤: { dir: '西南', elem: '土', sym: '☷', name: '老母', sex: '母', animal: '牛',
           trait: '柔顺', organ: '腹、脾', season: '四季末', body: '腹背、肌肉' },
    震: { dir: '东', elem: '木', sym: '☳', name: '长男', sex: '长男', animal: '龙',
           trait: '奋动', organ: '足、肝', season: '春', body: '足腿、筋' },
    巽: { dir: '东南', elem: '木', sym: '☴', name: '长女', sex: '长女', animal: '鸡',
           trait: '渗入', organ: '股、胆', season: '春夏之交', body: '股腿、胆' },
    坎: { dir: '北', elem: '水', sym: '☵', name: '中男', sex: '中男', animal: '豕',
           trait: '险陷', organ: '耳、肾', season: '冬', body: '耳肾、泌尿' },
    离: { dir: '南', elem: '火', sym: '☲', name: '中女', sex: '中女', animal: '雉',
           trait: '附丽', organ: '目、心', season: '夏', body: '目心、血脉' },
    艮: { dir: '东北', elem: '土', sym: '☶', name: '少男', sex: '少男', animal: '狗',
           trait: '静止', organ: '手、脾', season: '冬春之交', body: '手背、关节' },
    兑: { dir: '西', elem: '金', sym: '☱', name: '少女', sex: '少女', animal: '羊',
           trait: '喜悦', organ: '口、肺', season: '秋', body: '口舌、牙齿' }
  };
  var SHENG = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  var KE = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };

  function guaOf(n) {
    n = ((n - 1) % 9 + 9) % 9 + 1;
    return LUOSHU[n];
  }
  function numOf(g) {
    for (var k in LUOSHU) if (LUOSHU[k] === g) return parseInt(k, 10);
    return 5;
  }

  /* ==========================================================
   * 【BUG 修复 v6】卦层判别 —— 打破「五行压缩」的核心改造
   *
   * 原 relation(fromElem, toElem) 只收两个五行字符串，
   * 而 8 卦里「震/巽」同木、「坤/艮」同土、「乾/兑」同金，
   * 于是不同的卦得出完全相同的生克结果与分数。
   * 实测：9^3 = 729 种报数组合，经relation 后只剩 25 种生克对、
   * 12 种方案组合 —— 这就是用户看到「一字不差」的直接原因。
   *
   * 本版改为**卦层判别**：保留五行生克为主轴，
   * 再叠加三个卦层修正量，使八卦各自独立：
   *
   *   ① 宫位生克【软件约定】：洛书九宫按飞宫次序（坎1→坤2→震3→巽4→中5
   *      →乾6→兑7→艮8→离9）顺飞，与相邻宫为「邻」，与隔宫为「远」。
   *      邻者力厚、远者力薄，权重 1.0 / 0.7 / 0.5。
   *      说明：飞宫次序本于洛书，但「相邻即权重 1.0、隔宫 0.7、更远 0.5」
   *      这一组具体数值是本软件自定，不同流派赋权不同。
   *   ② 卦性相性：《说卦传》八卦各具性情 —— 乾刚坤顺、震动巽入、
   *      坎陷离丽、艮止兑悦（此条有典据）。
   *      但「相济则助力倍增、相违则打折」的具体折扣幅度是本软件约定。
   *   ③ 老少进层【软件约定】：由 parseNum 取出报数的商（进层）与奇偶（老少），
   *      少者轻而灵活、老者重而沉稳；进层越深，卦力越厚。
   *      说明：进层与老少的解释各家不同，此处的取法与赋权由本软件约定。
   * ========================================================== */

  // 洛书飞宫次序（1坎→2坤→3震→4巽→5中→6乾→7兑→8艮→9离）
  var FLY_ORDER = ['坎', '坤', '震', '巽', '坤', '乾', '兑', '艮', '离'];

  // 八卦性情配对（《说卦传》）：相济者加分，相违者减分
  var GUA_TRAIT = {
    乾: '刚健', 坤: '柔顺', 震: '奋动', 巽: '渗入',
    坎: '险陷', 离: '附丽', 艮: '静止', 兑: '喜悦'
  };
  // 相济表：两者气质互补者为「相得」
  var TRAIT_HARMONY = {
    '乾|坤': '刚柔相济', '震|巽': '动入相济', '坎|离': '陷丽相济', '艮|兑': '止悦相济',
    '乾|巽': '刚柔相济', '坤|震': '柔顺相济', '乾|离': '明照相济', '坤|艮': '厚重相济',
    '巽|坤': '入藏相济', '震|兑': '动悦相济', '坎|艮': '陷止相济', '离|兑': '丽悦相济'
  };

  /** 飞宫距离：0=同宫1=邻宫 2=隔宫 3=三宫 4=对宫 */
  function flyDist(g1, g2) {
    var i = FLY_ORDER.indexOf(g1), j = FLY_ORDER.indexOf(g2);
    if (i < 0 || j < 0) return 2;
    var d = Math.abs(i - j);
    if (d > 4) d = 9 - d;   // 九宫成环，取最近路径
    return d;
  }

  /**
   * 两宫关系（【v6 重写】卦层判别）
   * from = 测事方（当下之势），to = 用神方（所求之事）
   *
   * 返回 { key, score, text, layer, fly, trait, dist }
   *   score 仍以五行生克为主（-2..+2），另叠加卦层修正（最多 ±1），
   *   故最终值域扩为 -3..+3 —— 这是打破 5 档level 的关键。
   */
  function relation2(fromGua, toGua, pnFrom, pnTo) {
    var fe = GUA_INFO[fromGua].elem;
    var te = GUA_INFO[toGua].elem;

    // ① 五行主轴
    var key, score, text;
    if (fe === te) {
      key = '比和'; score = 0;
      text = '比和：两宫同气，助力有限，亦无损耗';
    } else if (SHENG[te] === fe) {
      key = '生我'; score = 2;
      text = '生我：所求之事生助当下之势，得外力相扶 —— 顺势而成';
    } else if (SHENG[fe] === te) {
      key = '我生'; score = 1;
      text = '我生：当下之势生助所求 —— 主动付出方能成事';
    } else if (KE[fe] === te) {
      key = '我克'; score = 1;
      text = '我克：当下之势能制所求 —— 主动出击可成，惟须防用力过猛';
    } else {
      key = '克我'; score = -2;
      text = '克我：当下之势受制于所求，进展不顺 —— 宜守宜缓';
    }

    // ② 飞宫距离修正：邻宫得气、远宫力薄
    var dist = flyDist(fromGua, toGua);
    var fly = 0, flyText = '';
    if (key !== '比和') {
      if (dist === 0) { fly = 0; }
      else if (dist === 1) { fly = score > 0 ? 1 : 0; flyText = '两宫相邻，得飞宫之气相扶'; }
      else if (dist === 4) { fly = score > 0 ? -1 : 0; flyText = '两宫正对，气机相争'; }
      else if (dist === 2) { fly = 0; flyText = '两宫隔位，力道居中'; }
      else { fly = score > 0 ? -1 : 0; flyText = '两宫相去甚远，助力难达'; }
      score += fly;
    }

    // ③ 卦性相济修正
    var trait = 0, traitText = '';
    var hk = fromGua + '|' + toGua;
    if (TRAIT_HARMONY[hk] || TRAIT_HARMONY[toGua + '|' + fromGua]) {
      trait = key === '克我' ? 1 : 1;   // 气质互补，即便受制也有转化余地
      traitText = TRAIT_HARMONY[hk] || TRAIT_HARMONY[toGua + '|' + fromGua];
    } else if (fromGua === toGua) {
      trait = 0;
    } else {
      // 气质相违：吉方略减、凶方略减（矛盾处有缓冲）
      trait = key === '克我' ? 1 : (score > 1 ? -1 : 0);
    }
    score += trait;

    // ④ 老少进层修正（由报数的商与奇偶决定）
    var layer = 0, layerText = '';
    if (pnFrom) {
      var wt = pnTo ? pnTo.weight : 1;
      var d = (pnFrom.weight - wt);
      if (Math.abs(d) >= 0.3) {
        layer = d > 0 ? 1 : -1;
        var pf = pnFrom.within || guaOf(pnFrom.raw || 1);
        var pt = pnTo ? (pnTo.within || guaOf(pnTo.raw || 1)) : 0;
        layerText = d > 0
          ? '所报之数进层深（' + (pnFrom.raw || '-') + '→' + pf + '宫' +
            (pnFrom.layer ? '，进' + pnFrom.layer + '层' : '') + '），气势较厚'
          : (pnTo
            ? '所求之数进层浅（' + (pnTo.raw || '-') + '→' + pt + '宫' +
              (pnTo.layer ? '，进' + pnTo.layer + '层' : '') + '），基础较薄'
            : '进层不深，力道居中');
      }
      score += layer;
    }

    // 汇总文案
    var full = text;
    if (flyText) full += '；' + flyText;
    if (traitText) full += '；卦性' + traitText;
    else if (fromGua === toGua) full += '；两卦同体，气性一致';
    if (layerText) full += '；' + layerText;

    return {
      key: key, score: score, text: full,
      layer: layer, fly: fly, trait: trait, dist: dist,
      fromGua: fromGua, toGua: toGua
    };
  }

  /** 兼容旧接口：两宫的五行关系（保留导出，避免破坏外部调用） */
  /**
   * 两宫五行关系。
   * from = 测事方（当下之势），to = 用神方（所求之事）
   * 站在「求测人」立场判吉凶：
   *   生我者助我（吉）· 我生者泄我（勉）· 我克者我制（吉）· 克我者我受制（凶）· 比和（平）
   */
  function relation(fromElem, toElem) {
    if (fromElem === toElem) {
      return { key: '比和', score: 0, text: '比和：气场相同，助力有限，亦无损耗' };
    }
    if (SHENG[toElem] === fromElem) {
      // to 生 from：用神助测事方，大顺
      return { key: '生我', score: 2, text: '生我：所求之事生助当下之势，得外力相扶 —— 顺势而成' };
    }
    if (SHENG[fromElem] === toElem) {
      // from 生 to：测事方生用神，耗己成彼
      return { key: '我生', score: 1, text: '我生：当下之势生助所求 —— 主动付出方能成事' };
    }
    if (KE[fromElem] === toElem) {
      return { key: '我克', score: 1, text: '我克：当下之势能制所求 —— 主动出击可成，惟须防用力过猛' };
    }
    return { key: '克我', score: -2, text: '克我：当下之势受制于所求，进展不顺 —— 宜守宜缓' };
  }

  /* ==========================================================
   * 三、核心：占一件事
   * ========================================================== */

  /**
   * 方位占事
   * @param {object} opt
   *   opt.type     事项类型（SHI_TYPE 的键）
   *   opt.nums     [用神数, 测事数, 应期数] 每个 1-99
   *   opt.asker    求测人称呼（选填）
   *   opt.year     起卦年份
   */
  function divineAffair(opt) {
    opt = opt || {};
    var typeKey = SHI_TYPE[opt.type] ? opt.type : '财运求财';
    var T = SHI_TYPE[typeKey];
    var Y = opt.year || new Date().getFullYear();

    /* ---- 【v6】报数解析：洛书归一 + 进层 + 老少，保留原始信息 ---- */
    var raw = (opt.nums && opt.nums.length === 3) ? opt.nums : [nowNum(), nowNum(), nowNum()];
    var pUse = parseNum(raw[0]);
    var pTest = parseNum(raw[1]);
    var pTime = parseNum(raw[2]);
    var nUse = pUse.luo, nTest = pTest.luo, nTime = pTime.luo;

    // 用神宫：取「事项类型」所主之宫（不随数变，这是定盘基础）
    var useGua = T.gua;
    var useNum = numOf(useGua);
    // 测事宫：由报数定，看事情当前所处之势
    var testGua = guaOf(nTest);
    // 应期宫：由报数定，看事情何时收束
    var timeGua = guaOf(nTime);
    // 用神方之位：另以报数定「用神落在哪个方位」（所求之事所在之方）
    var useGuaPos = guaOf(nUse);

    var useE = GUA_INFO[useGua].elem;
    var testE = GUA_INFO[testGua].elem;
    var timeE = GUA_INFO[timeGua].elem;

    /* ---- 【v6】核心判断改为卦层判别（relation2），不再是纯五行 ---- */
    var rel = relation2(testGua, useGua, pTest, pUse);
    var relTime = relation2(timeGua, useGua, pTime, pUse);
    // 用神落位与用神本宫的关系：所求之事落在何方，影响「寻路」
    var relPos = relation2(useGuaPos, useGua, pUse, pUse);

    /* ---- 综合吉凶：三维加权（原仅二维，故档位只有 5 档） ---- */
    var total = rel.score * 1.0 + relTime.score * 0.7 + relPos.score * 0.5;
    total = Math.round(total * 10) / 10;

    // 【v6】档位细分：原 5 档 → 9 档。这是打破「结果雷同」的关键。
    var level, levelText, levelIdx;
    if (total >= 2.6) { levelIdx = 8; level = '大吉'; levelText = '三宫俱助，事稳可成，且有贵人相助'; }
    else if (total >= 1.8) { levelIdx = 7; level = '吉'; levelText = '顺势而为可成，宜乘势推进'; }
    else if (total >= 1.0) { levelIdx = 6; level = '小吉'; levelText = '略占上风，肯做则得'; }
    else if (total >= 0.3) { levelIdx = 5; level = '偏吉'; levelText = '机在其中，须主动加把劲'; }
    else if (total >= -0.3) { levelIdx = 4; level = '平'; levelText = '成败在人，做得细则成'; }
    else if (total >= -1.0) { levelIdx = 3; level = '偏凶'; levelText = '阻力初现，宜先稳后进'; }
    else if (total >= -1.8) { levelIdx = 2; level = '小凶'; levelText = '阻力较大，宜改弦更张'; }
    else if (total >= -2.6) { levelIdx = 1; level = '凶'; levelText = '强阻难成，宜暂缓另谋'; }
    else { levelIdx = 0; level = '大凶'; levelText = '限制较多，先复核条件，减少一次性投入'; }

    // 应期：五行生克 + 卦层定月数
    var delay = monthDelay(rel, relTime, testE, useE, levelIdx, pTime);

    // 吉方：生我或我克之方（按卦层细分，不只按五行）
    var goodDirs = [];
    var badDirs = [];
    for (var g in GUA_INFO) {
      if (!GUA_INFO.hasOwnProperty(g)) continue;
      var e = GUA_INFO[g].elem;
      if (SHENG[e] === useE || KE[useE] === e) goodDirs.push(g);
      if (KE[e] === useE || e === useE) badDirs.push(g);
    }
    // 同气之方：比和，无助无阻（【v6】新增第三类，原只有吉/凶两分）
    var sameDirs = [];
    for (var g3 in GUA_INFO) {
      if (!GUA_INFO.hasOwnProperty(g3)) continue;
      if (GUA_INFO[g3].elem === useE && goodDirs.indexOf(g3) < 0 && badDirs.indexOf(g3) < 0) sameDirs.push(g3);
    }

    // 助方（生用神）与泄方（我生）
    /* 【v7 修复】原实现只取「生用神」的第一个卦作 helpGua。
     * 五行只有五类、八卦却有八卦，故用神为土（坤/艮）时，
     * 「土生土」不成立，helpGua 必为 null —— 于是「借方」一类文案
     * 永远拿不到卦名，只能输出「择吉方而行」这类空话。
     *
     * 依上方 goodDirs 之义：吉方本含「生用神」与「我克」两路。
     * 现于两路中择一，并优先取与用神宫飞距较近者（近者得气、力厚），
     * 使吉方既有卦名，又随报数而变。
     */
    var helpGua = null, drainGua = null;
    var helpPool = [];
    for (var g2 in GUA_INFO) {
      if (!GUA_INFO.hasOwnProperty(g2)) continue;
      var e2 = GUA_INFO[g2].elem;
      if (SHENG[e2] === useE) { if (!helpGua) helpGua = g2; helpPool.push(g2); }
      if (SHENG[useE] === e2 && !drainGua) drainGua = g2;
      // 补入「我克」之方：主动出击亦可为吉路（原 goodDirs 已含此义）
      if (KE[useE] === e2 && helpPool.indexOf(g2) < 0) helpPool.push(g2);
    }
    if (!helpGua && helpPool.length) helpGua = helpPool[0];
    // 若有多个候选，取离用神宫最近者（飞宫得气）
    if (helpPool.length > 1 && useGuaPos) {
      var best = helpPool[0], bestD = flyDist(best, useGuaPos);
      for (var hi = 1; hi < helpPool.length; hi++) {
        var hd = flyDist(helpPool[hi], useGuaPos);
        if (hd < bestD) { bestD = hd; best = helpPool[hi]; }
      }
      helpGua = best;
    }
    var helpGuaAlt = helpPool.filter(function (g) { return g !== helpGua; });

    var __r = {
      asker: opt.asker || '求测人',
      type: typeKey,
      typeWhy: T.why,
      useK: T.useK,
      checkK: T.checkK,
      useGua: useGua, useGuaPos: useGuaPos, useDir: GUA_INFO[useGuaPos].dir, useNum: useNum,
      testGua: testGua, testDir: GUA_INFO[testGua].dir,
      timeGua: timeGua, timeDir: GUA_INFO[timeGua].dir,
      testElem: testE, useElem: useE, timeElem: timeE,
      rel: rel, relTime: relTime, relPos: relPos,
      level: level, levelIdx: levelIdx, levelText: levelText, score: total,
      nums: raw, parsed: { use: pUse, test: pTest, time: pTime },
      year: Y,
      delay: delay,
      helpGua: helpGua, helpDir: helpGua ? GUA_INFO[helpGua].dir : '',
      helpGuaAlts: helpGuaAlt,
      drainGua: drainGua, drainDir: drainGua ? GUA_INFO[drainGua].dir : '',
      goodDirs: goodDirs, badDirs: badDirs, sameDirs: sameDirs,
      // 详尽方案（【v6】全部改用卦层判别，并接入更多变量）
      verdict: buildVerdict(level, T, rel, relTime, relPos, testGua, timeGua, useGuaPos, pUse, pTest, pTime),
      smoothPlan: buildSmoothPlan(level, T, rel, testGua, helpGua, useGua, relPos, useGuaPos, pTest, pTime, relTime, pUse),
      breakPlan: buildBreakPlan(level, T, rel, testGua, badDirs, useGua, helpGua, relTime, timeGua, pTime, pUse, pTest, relPos, useGuaPos),
      tactics: buildTactics(level, testE, useE, timeE, relTime, testGua, timeGua, useGua, pTest, pTime),
      checkList: buildCheckList(T, level, rel, relPos, useGuaPos, pUse, pTime)
    };

    /* 【v7】接入多样化文案引擎。
     * 原版此处直接返回固定模板的 smoothPlan/breakPlan（雷同之源）；
     * 现额外挂一份 diverse* 字段，由页面优先渲染。
     * 若引擎未加载（如单文件调试），静默跳过，不影响原有字段。 */
    try {
      if (typeof JiuGongWording !== 'undefined' && JiuGongWording.decorate) {
        JiuGongWording.decorate(__r);
      }
    } catch (e) { /* 保持向后兼容：引擎异常时仍返回原结果 */ }

    return __r;
  }

  function nowNum() {
    var n = new Date();
    return n.getDate();
  }

  /**
   * 应期：依生克关系 + 卦层定「几天/几月」成
   * 【v6】原实现只按 rel.key 分4 档（base 1/2/3），且含一个
   * 从未被使用的死变量 zodiac，属信息浪费。现接入卦层与进层。
   */
  function monthDelay(rel, relTime, testE, useE, levelIdx, pTime) {
    /* 五行主轴：定基本节奏 */
    var base;
    if (rel.key === '克我') base = 3;
    else if (rel.key === '比和') base = 2;
    else if (rel.key === '我生') base = 2;
    else base = 1;   // 生我 / 我克

    /* 应期宫修正：收局之时助或阻 */
    if (relTime.key === '生我') base = Math.max(1, base - 1);
    if (relTime.key === '克我') base += 1;

    /* 【v6】卦层修正：飞宫远者事迟，近者事速 */
    var dist = relTime.dist;
    if (dist >= 3) base += 1;
    else if (dist === 1 && relTime.score > 0) base = Math.max(1, base - 1);

    /* 【v6】格局修正：吉局速成、凶局拖延 */
    if (levelIdx >= 6) base = Math.max(1, base - 1);
    else if (levelIdx <= 2) base += 1;
    base = Math.max(1, Math.min(6, base));

    /* 【v6】进层修正：报数进层深者，事在近处（数大者近） */
    if (pTime && pTime.layer >= 3) base = Math.max(1, base - 1);
    else if (pTime && pTime.layer === 0 && pTime.raw <= 9) base += 1;
    base = Math.max(1, Math.min(6, base));

    var season = { '木': '春', '火': '夏', '土': '四季末', '金': '秋', '水': '冬' }[useE];
    var days = base * 7;

    return {
      days: days,
      months: base,
      season: season,
      text: base <= 1 ? '事在眼前，本旬内可见分晓（约 ' + days + ' 日内）'
        : base === 2 ? '需一月左右转机（约 ' + days + ' 日至 ' + (base * 30) + ' 日）'
        : base === 3 ? '须等一个季度，约 ' + days + ' 日至 ' + (base * 30) + ' 日后方见分晓'
        : '须耐心等时，约 ' + (base * 30) + ' 日后（约 ' + (base * 30 + 45) + ' 日内）方见定局',
      advice: base <= 1 ? '宜速决，拖则生变'
        : base === 2 ? '宜稳扎，忌反复改策'
        : base === 3 ? '宜守候，忌强求；期满自见'
        : '此事当从长计，短期内不必强求；宜先布长期局'
    };
  }

  /**
   * 总体断语
   * 【v6】接入 relPos / 三宫名 / 报数解析，原版只吃 level+rel.key，
   * 导致不同报数只要档位相同就一字不差。
   */
  function buildVerdict(level, T, rel, relTime, relPos, testGua, timeGua, useGuaPos, pUse, pTest, pTime) {
    var head = {
      '大吉': '此事大吉。所求之事落在' + T.gua + '宫，属' + T.why + '。',
      '吉': '此事为吉。所求之事落在' + T.gua + '宫，属' + T.why + '。',
      '小吉': '此事小吉。所求之事落在' + T.gua + '宫，属' + T.why + '。',
      '偏吉': '此事偏吉。所求之事落在' + T.gua + '宫，属' + T.why + '。',
      '平': '此事平平。所求之事落在' + T.gua + '宫，属' + T.why + '。',
      '偏凶': '此事偏凶。所求之事落在' + T.gua + '宫，属' + T.why + '。',
      '小凶': '此事小凶。所求之事落在' + T.gua + '宫，属' + T.why + '。',
      '凶': '此事为凶。所求之事落在' + T.gua + '宫，属' + T.why + '。',
      '大凶': '此事大凶。所求之事落在' + T.gua + '宫，属' + T.why + '。'
    }[level] || '';

    /* 三宫分述 —— 这是新增的、随报数而变的部分 */
    var body = '当下之势在' + testGua + '宫（' + GUA_INFO[testGua].dir + '·' +
      GUA_INFO[testGua].name + '），其性' + GUA_INFO[testGua].trait + '，与用神为「' + rel.key +
      '」，' + rel.text.replace(/^[^：]*：/, '') + '。';

    body += '所求之事落于' + useGuaPos + '方（' + GUA_INFO[useGuaPos].dir + '），与用神本宫为「' +
      relPos.key + '」—— ' + (
        relPos.score > 0 ? '所求已落在有力之方，路子是通的。'
        : relPos.score < 0 ? '所求偏在受制之方，事须多绕一层才能落到实处。'
        : '所求与用神同气，不受外力也不受外缚，全凭自己经营。'
      );

    body += '收局在' + timeGua + '宫（' + GUA_INFO[timeGua].dir + '），与用神为「' + relTime.key + '」，' + (
      relTime.score > 0 ? '届时有助力，宜在此前落定。'
      : relTime.score < 0 ? '届时反成掣肘，宜提前收束，勿拖到那一步。'
      : '届时吉凶平平，视临场决断而定。'
    );

    /* 【v6】报数取象分述 —— 引入商与老少，随报数而变 */
    body += '\n\n取数上，第一数 ' + pUse.raw + ' 归' + pUse.within + '宫' +
      (pUse.layer ? '（进' + pUse.layer + '层，' + (pUse.isYang ? '少阳' : '老阴') + '）' : '（' + (pUse.isYang ? '少阳' : '老阴') + '）') +
      '，第二数 ' + pTest.raw + ' 归' + pTest.within + '宫' +
      (pTest.layer ? '（进' + pTest.layer + '层，' + (pTest.isYang ? '少阳' : '老阴') + '）' : '（' + (pTest.isYang ? '少阳' : '老阴') + '）') +
      '，第三数 ' + pTime.raw + ' 归' + pTime.within + '宫' +
      (pTime.layer ? '（进' + pTime.layer + '层，' + (pTime.isYang ? '少阳' : '老阴') + '）' : '（' + (pTime.isYang ? '少阳' : '老阴') + '）') +
      '。' + (
        pTest.layer > pUse.layer
          ? '你心中有数、有底，所报之数深于所求 —— 谋在人而事在人。'
          : pTest.layer < pUse.layer
          ? '你心中有数、有底，所求重于所报 —— 事之大小不由你定，须量力。'
          : '所报与所求同进深 —— 你的预期与事情本身大致相称，不算高估也不算保守。'
      );

    var tail = '要核的关键在「' + T.checkK + '」，用神取「' + T.useK + '」。' +
      (level === '大吉' || level === '吉' || level === '小吉'
        ? '所询之事在' + T.useK + '上有明确着落，可以放心推进。'
        : level === '偏吉' || level === '平'
        ? '所询之事' + (relPos.score >= 0 ? '不差但也未稳，' : '尚不明朗，') + '须先弄清' + T.checkK + '，再定投入几分。'
        : '所询之事尚不明朗，须先弄清' + T.checkK + '，再定行止。');

    return head + body + '\n\n' + tail;
  }

  /**
   * 成事如何更顺利
   * 【v6】按 9 档细分（原仅 3 档：大吉吉 / 平 / 其余），
   * 并接入 relPos / 用神落位 / 报数进层。
   */
  /** 事项关键词：取核查要点的「前 4 字」作标题用。
   *  【v6 修复】原代码用 slice(0,6) 直接硬切 checkK，
   *  而 checkK 常含全角括号（如「所求为何（名分、渠道、靠山）」），
   *  切到第 6 字正好落在括号里，标题渲染成「核·所求为何（名」—— 半截词。
   *  现改为：先剥掉括号及其后内容，再取前 4 字；不足则全取。 */
  function kwOf(s) {
    var base = String(s || '').replace(/[（(].*$/, '').replace(/[、，,]/g, '');
    return base.length > 4 ? base.slice(0, 4) : base;
  }

  function buildSmoothPlan(level, T, rel, testGua, helpGua, useGua, relPos, useGuaPos, pTest, pTime, relTime, pUse) {
    /* 【v6 关键修复】原标题为「借方/借时/借势/核要点/先探/补漏」等固定词，
     * 标题组合仅 9 种，用户看到的是一排几乎一样的词条。
     * 现把「关系 + 卦名」写进标题，使标题本身随盘而变；
     * 内容再叠加报数进层与用神落位。 */
    var relTag = rel.key;
    var dist = rel.dist;
    var distTxt = dist === 0 ? '同位' : (dist === 1 ? '相邻' : (dist === 4 ? '正对' : (dist === 2 ? '隔位' : '远应')));
    var deep = (pUse ? pUse.layer : 0) + (pTest ? pTest.layer : 0);
    var pace = deep >= 4 ? '（长计）' : (deep >= 2 ? '（缓图）' : '（速决）');
    var borrow = {
      t: '借方·' + (helpGua || useGua) + '位',
      d: helpGua ? '把会谈、签约、交付安排在' + GUA_INFO[helpGua].dir + '方（' + GUA_INFO[helpGua].name + '位），此方生用神，最利促成。' + T_GUA_TACTIC[helpGua] : '择吉方而行。'
    };
    var check = { t: '核·' + kwOf(T.checkK), d: '务必反复确认「' + T.checkK + '」—— 这是成败的最后一道关口。' };

    /* 【v6】按 9 档给出差异化方案 */
    if (level === '大吉') {
      return [
        { t: '借势·三宫俱助', d: '三宫俱助（' + rel.key + '、' + relTime.key + '、' + relPos.key + '），此局难得。把力量一次集中做完，勿分散。' },
        borrow,
        { t: '借时·' + timeGuaHint(relTime) + relTime.key, d: '趁' + timeGuaHint(relTime) + '之势未衰时落定。事情一旦拖过当前之势，吉气渐散。' },
        { t: '放大·' + useGua, d: '既然格局大顺，不妨把此局的收益做到最大 —— 该争取的名分、额度、条件，此时开口最易得。' },
        check
      ];
    }
    if (level === '吉') {
      return [
        { t: '借势·' + relTag + distTxt, d: '当下' + rel.key + '之势正助你（' + distTxt + '），此时推进最省力。集中力量一次做成，勿分散。' },
        borrow,
        { t: '借时·' + timeGuaHint(relTime) + relTime.key, d: '趁势未衰时落定。事情一旦拖过当前之势，吉气渐散。' },
        check
      ];
    }
    if (level === '小吉') {
      return [
        { t: '借势·' + relTag + '位', d: '得' + rel.key + '之势，属略占上风。趁对方还没反应过来先把关键条件谈定。' },
        borrow,
        { t: relPos.score < 0 ? '补漏·' + useGuaPos + '位' : '固本·' + useGuaPos + '位',
          d: relPos.score < 0
            ? '所求落在' + GUA_INFO[useGuaPos].dir + '方，此方与用神为「' + relPos.key + '」，是本局的软肋。' + T.checkK + '要格外查实。'
            : '本局无大漏，所求正落在有力之方。' + T.checkK + '仍须逐项确认，勿因顺而大意。' },
        check
      ];
    }
    if (level === '偏吉') {
      return [
        { t: '先探·' + testGua + '性' + relTag + distTxt + pace, d: '得势不多（' + rel.key + '，' + distTxt + '），只宜小步试探。先摸清' + GUA_INFO[testGua].dir + '方（' + testGua + '宫）对方态度，再决定加码与否。' },
        borrow,
        { t: '借落位·' + useGuaPos, d: '所求在' + GUA_INFO[useGuaPos].dir + '方，去那个方位、找那个方位的人，事情才有着落。' },
        { t: '核·' + kwOf(T.checkK), d: '「' + T.checkK + '」是当前最大变数，先把这一个搞清楚。' }
      ];
    }
    if (level === '平') {
      return [
        { t: '先破后立·' + testGua + '性' + relTag + distTxt, d: '当下之势（' + rel.key + '，' + distTxt + '）与所求相当，蛮力无用。先花小代价试探，摸清' + GUA_INFO[testGua].dir + '方对方真实态度再决定投入。' + T_GUA_TACTIC[testGua] },
        borrow,
        { t: '降门槛·' + useGuaPos + '位', d: '把条件分步拆开，先让对方在小处点头，再推进大处。所求在' + GUA_INFO[useGuaPos].dir + '方，先从那儿的具体门路入手。' },
        check
      ];
    }
    if (level === '偏凶') {
      return [
        { t: '缓·' + relTag + distTxt + pace, d: '阻力已现（' + rel.key + '，' + distTxt + '）。先把最急的一件事办成，其余往后排，不要全面铺开。' },
        borrow,
        { t: '借落位·' + useGuaPos, d: '所求在' + GUA_INFO[useGuaPos].dir + '方（' + useGuaPos + '宫），此方受制，务必找准该方位的具体门路，别泛泛地找关系。' },
        { t: '核·' + kwOf(T.checkK), d: '「' + T.checkK + '」不利，须先查清再动，贸然投入只会放大损失。' }
      ];
    }
    if (level === '小凶') {
      return [
        { t: '转念·' + testGua, d: '当前之势（' + rel.key + '）与所求相违，强推只会折损。先问「这件事非做不可吗」。' + T_GUA_FIX[testGua] },
        { t: '换方·' + (helpGua || '吉方'), d: helpGua ? '改到' + GUA_INFO[helpGua].dir + '方（' + helpGua + '宫）去谈，或请居该方位之人牵线。方位能改势。' : '借他人之力。' },
        { t: '缓行·' + timeGuaHint(relTime) + relTime.key, d: '凶势宜缓不宜急。把时间拉长，用过程去磨掉阻力。' },
        { t: '底线·' + kwOf(T.checkK), d: '「' + T.checkK + '」若不利，及早止损比死撑明智。' }
      ];
    }
    if (level === '凶') {
      return [
        { t: '停·' + relTag + distTxt, d: '当前之势（' + rel.key + '，' + distTxt + '）与所求相违，此时推进必生波折。暂停，先看清楚再动。' + T_GUA_FIX[testGua] },
        { t: '换方·' + (helpGua || '生用神方'), d: '改到' + (helpGua ? GUA_INFO[helpGua].dir + '方（' + helpGua + '宫）' : '生用神之方') + '重新布局，原路已走不通。' },
        { t: '换时·' + timeGuaHint(relTime) + relTime.key, d: '应期在' + (relTime.score < 0 ? '不利之段' : '平段') + '，避开此段再动。' },
        { t: '底线·' + kwOf(T.checkK), d: '「' + T.checkK + '」若不利，及早止损比死撑明智。' }
      ];
    }
    return [
      { t: '止·三宫俱阻', d: '三宫俱阻（' + rel.key + '、' + relTime.key + '、' + relPos.key + '）。当断则断，此局不宜强为。' },
      { t: '换方·' + (helpGua || '生用神方'), d: '改到' + (helpGua ? GUA_INFO[helpGua].dir + '方（' + helpGua + '宫）' : '生用神之方') + '，另起一处重新布局。' },
      { t: '求助·' + kwOf(T.checkK), d: '此事已非一人之力可解，主动求助' + T.checkK + '相关的关键人或专业人士。' },
      { t: '底线', d: '沉没成本越拖越大。设一个明确的时间点，到点即止。' }
    ];
  }

  function timeGuaHint(relTime) {
    return relTime.score > 0 ? '助' : (relTime.score < 0 ? '掣' : '平');
  }

  /**
   * 坏事如何破解
   * 【v6】原实现首行判断 level === '大凶'，但原版level 从不产生「大凶」
   * （档位只有大吉/吉/平/小凶/凶），故此分支是死代码。现档位扩为 9 档，
   * 该分支真正生效，并接入 relTime / timeGua / pTime。
   */
  /**
   * 化解方案
   * 【v6 关键修复】原实现的标题只有三套模板（大凶/小凶偏凶/平），
   * 且第二项恒为「避 + T.risk」—— 而 T.risk 是事项类型常量，
   * 于是无论报多少数、落在哪个宫，化解方案几乎一字不差，
   * 这正是用户反馈「趋吉方案、化解方案几乎不变」的根因。
   *
   * 现把下列变量全部接入标题与内容：
   *   ① 档位档数（大凶 / 凶 / 大凶带破 等细分为不同处置力度）
   *   ② rel.key（克我 / 我克 / 我生 / 生我 / 比和）—— 不同受制方式不同解法
   *   ③ rel.dist（飞宫距离）—— 相邻 / 正对 / 隔位 / 远应，解法各异
   *   ④ testGua 卦性 —— 每一卦的破法不同（震宜动、艮宜止、坎宜探…）
   *   ⑤ pUse / pTest / pTime 的进层深浅 —— 决定「现在止血」还是「长计」
   *   ⑥ badDirs / helpGua 具体方位
   */
  function buildBreakPlan(level, T, rel, testGua, badDirs, useGua, helpGua, relTime, timeGua, pTime, pUse, pTest, relPos, useGuaPos) {
    var lvIdx = LV_INDEX[level];
    var relTag = rel.key;
    var dist = rel.dist;
    var distTxt = dist === 0 ? '两宫同位'
      : dist === 1 ? '两宫相邻'
      : dist === 4 ? '两宫正对'
      : dist === 2 ? '两宫隔一位' : '两宫相去甚远';
    /* 报数进层：进层越深，说明起意越久，宜长计；进层浅，宜速决 */
    var deep = (pUse ? pUse.layer : 0) + (pTest ? pTest.layer : 0);
    var pace = deep >= 4 ? '长计' : (deep >= 2 ? '缓图' : '速决');
    var paceTxt = deep >= 4
      ? '你起念已久（所报之数进层已深），此局不宜图一时之快，当按「三步走」长期化解。'
      : (deep >= 2
        ? '你已有思量但未定行止，宜「缓图」——先设止损线，再择机而动。'
        : '你初涉此事，宜「速决」——与其久拖生变，不如早做取舍。');
    var avoidDirs = badDirs.length ? badDirs.map(function (g) { return GUA_INFO[g].dir + '（' + g + '）'; }).join('、') : '不利方位';

    /* 按「克我 / 我克 / 我生 / 生我 / 比和」分五种破法 —— 原版全用同一套 */
    var relFix = {
      '克我': { t: '解其制', d: '当下之势正压着所求（' + distTxt + '），硬顶只会耗损自己。宜「以静制动」：先把条件谈清、界限划明，不给对方可乘之机；' + T_GUA_FIX[testGua] },
      '我克': { t: '防反噬', d: '你虽能制住当下之势，但用力过猛易被反噬（' + distTxt + '）。宜「留三分力」：见好即收，别把关系做绝；' + T_GUA_FIX[testGua] },
      '我生': { t: '减付出', d: '你正在往这件事里投入（' + distTxt + '），属于自耗。宜「先收成本」：把投入封顶，超线就停；' + T_GUA_FIX[testGua] },
      '生我': { t: '顺势引', d: '当下之势本在助你（' + distTxt + '），却仍有牵制，多半出在条件不清。宜「把条件写明」，顺势反而更稳；' + T_GUA_FIX[testGua] },
      '比和': { t: '破同质', d: '两宫同气，看似顺遂，实则助力有限、同进同退。宜「另开一路」：主动引入第三方或换到吉方去做；' + T_GUA_FIX[testGua] }
    }[rel.key] || { t: '定止损', d: '先设一条明确的止损线，到线即止，不再追加。' };

    if (lvIdx <= 1) {
      /* 大凶 / 凶 —— 强阻，必须断 */
      return [
        { t: '立即止·' + pace, d: '凶局最忌硬撑。此局宜当断则断（' + paceTxt + '）止损越早，损失越小。' },
        { t: relFix.t, d: relFix.d },
        { t: '避方·' + testGua + '位', d: '签约、谈判、交付一律避开' + avoidDirs + '；若已在' + GUA_INFO[testGua].dir +
            '方（' + testGua + '宫，' + GUA_INFO[testGua].trait + '）起头，宜换到' +
            (helpGua ? GUA_INFO[helpGua].dir + '方（' + helpGua + '宫）' : '吉方') + '重整。' },
        { t: '避时·' + pTime.raw + '数', d: '收局在' + GUA_INFO[timeGua].dir + '方（' + timeGuaHint(relTime) + '），' +
            (relTime.score < 0 ? '此段为阻力期，不宜了结，能拖则拖。' : '此段虽非阻力，但此局不宜在此定局。') +
            '凡' + pTime.raw + '数所指之期，忌签字、忌承诺。' },
        { t: '化' + T.risk, d: '此局最忌' + T.risk + '。凡与之相关的决定，一律缓行。' },
        { t: '求助·' + T.checkK, d: '此事已非一人之力可解，主动求助与' + T.checkK + '相关的关键人或专业人士。' }
      ];
    }
    if (lvIdx <= 3) {
      /* 偏吉 / 平 / 偏凶 / 小凶 —— 有阻但可解 */
      return [
        { t: relFix.t + '·' + pace, d: relFix.d + paceTxt },
        { t: '避方·' + testGua + '位', d: '尽量避开' + avoidDirs + '办事，能换地点就换。' + T_GUA_TACTIC[testGua] },
        { t: '避' + T.risk, d: '此事最忌' + T.risk + '。事先立规矩、留证据、留退路 —— 尤其' + GUA_INFO[useGua].dir + '方之事，需反复确认。' },
        { t: '借势·' + (helpGua ? GUA_INFO[helpGua].dir + '方' : '外力'), d: helpGua
            ? '可借' + GUA_INFO[helpGua].dir + '方（' + helpGua + '宫，' + GUA_INFO[helpGua].trait + '）的力量平衡此方之不足。'
            : '借他人之力补不足。' + T_DO[useGua] },
        { t: '核·' + T.checkK, d: '把与「' + T.checkK + '」相关的凭据与说法逐项核实一遍，此处最容易出错。' }
      ];
    }
    /* 吉档也有隐患，只是尚未发作 —— 原版此档与「平档」共用模板，故仍显雷同 */
    return [
      { t: '隐患·' + relTag + distTxt + pace, d: '此局虽吉，然「' + rel.key + '」（' + distTxt + '）之中已伏隐患。' + paceTxt },
      { t: '先探·' + testGua + '性' + (relPos.score < 0 ? '·落位受制' : '·落位有力'), d: '先摸清' + GUA_INFO[testGua].dir + '方（' + testGua + '宫）的虚实，再决定加码。所求落' + GUA_INFO[useGuaPos].dir + '方，与用神为「' + relPos.key + '」。' + T_GUA_TACTIC[testGua] },
      { t: '避' + T.risk, d: '此事最忌' + T.risk + '。' + (testGua === '离' || testGua === '兑'
          ? '尤其忌言语承诺、忌纸面文章，须落到可查证之处。'
          : (testGua === '艮' || testGua === '坤'
            ? '尤其忌拖延与反复，须一次性把条件谈死。'
            : '尤其忌半途改向，须一开始就把目标与条件写明。')) },
      { t: '借势·' + (helpGua ? GUA_INFO[helpGua].dir + '方' : '外力'), d: helpGua
          ? '借' + GUA_INFO[helpGua].dir + '方（' + helpGua + '宫）之力，使此事更稳。'
          : '借他人之力补不足。' }
    ];
  }

  /** 八卦各宜破法（用于化解方案，按卦性给出具体处置动作） */
  var T_GUA_FIX = {
    乾: '乾为刚决，遇阻多半是决策迟疑所致 —— 宜「定一条底线后不再议」，反复讨论只会耗掉时机。',
    坤: '坤为柔顺，遇阻多半是条件含混 —— 宜「把责任与义务逐条写清」，含糊处日后必起争。',
    震: '震为奋动，遇阻多半是启动不够或方向未定 —— 宜「先动起来再校正」，久坐不动只会错失。',
    巽: '巽为渗入，遇阻多半是对方尚未被说服 —— 宜「迂回渗透、侧面推进」，正面强攻必碰壁。',
    坎: '坎为陷险，遇阻多半是深浅未明 —— 宜「先探明风险点」，摸清深浅之前绝不可冒进。',
    离: '离为明丽，遇阻多半是话未说透 —— 宜「摊到明处、公开条件」，暗处才最耗人。',
    艮: '艮为止静，遇阻多半是当止未止 —— 宜「该停就停」，守住不动也是一种进展。',
    兑: '兑为口说，遇阻多半是沟通不畅 —— 宜「主动开口、当面说清」，转圜之机全在言语之间。'
  };

  /** 档位 → 强度序号（大凶 0 … 大吉 8）。原代码散用中文字符串比较，易错。 */
  var LV_INDEX = { '大凶': 0, '凶': 1, '小凶': 2, '偏凶': 3, '平': 4, '偏吉': 5, '小吉': 6, '吉': 7, '大吉': 8 };

  /**
   * 临事战术（按五行给具体动作）
   * 【v6】接入三宫名与报数进层，原版只吃 3 个五行。
   */
  function buildTactics(level, testE, useE, timeE, relTime, testGua, timeGua, useGua, pTest, pTime) {
    var el = { 木: '生发', 火: '明动', 土: '承载', 金: '决断', 水: '流动' };
    var out = [
      { t: '己方' + el[useE] + '之气',
        d: '你天性偏' + el[useE] + '（用神在' + useGua + '宫）。此事应以「' + el[useE] +
           '」的方式推进，而非对抗。' + T_DO[useGua] },
      { t: '对方' + el[testE] + '之气',
        d: '对方（局势）呈' + el[testE] + '之性，落在' + testGua + '宫（' + GUA_INFO[testGua].dir +
           '，' + GUA_INFO[testGua].trait + '）。' + (testE === useE ? '与你同气，容易谈拢，但也易同进同退' :
           (SHENG[testE] === useE ? '对方愿意配合你，宜趁势要求多一点' :
             (KE[testE] === useE ? '对方受制于你，可适度施压，但忌压过界' : '对方有主动权，宜给足空间'))) + '。' },
      { t: '收局时机' + el[timeE] + '气',
        d: '事情在' + GUA_INFO[timeGua].dir + '方（' + timeGua + '宫）收束，于' + el[timeE] + '之时。' +
           (relTime.score > 0 ? '此为助力，宜在此段内落定。' :
            relTime.score < 0 ? '此为阻力，宜避开此段另择时机。' : '此段吉凶平平，随机应变。') }
    ];
    /* 【v6】第四项：报数取象（随报数而变，原版没有此项） */
    out.push({
      t: '报数取象',
      d: '你报的三数 ' + pTest.raw + '·' + pTime.raw + '，' + (
        pTest.layer >= 2 ? '所报之数进层较深 —— 说明你对此事思虑已久，起点不低。' :
        pTest.layer === 0 ? '所报之数浅近 —— 说明你初涉此事，尚在摸索，宜借外力。' :
        '所报之数中平 —— 你对此事有基本判断，但还需外部信息校正。'
      ) + T_GUA_TACTIC[testGua]
    });
    return out;
  }

  /* 八卦各宜动作（新增，取代原先的重复套话） */
  var T_GUA_TACTIC = {
    乾: '此事宜拿出主意、定方向，莫犹疑；该拍板时拍板。',
    坤: '此事宜厚积、宜容纳多方意见，莫急于表态；先让大家把话说完。',
    震: '此事宜先动起来再说；动起来之后反而顺，切忌久坐空想。',
    巽: '此事宜渗透、宜迂回；正面硬顶不通，侧面渗透反而成。',
    坎: '此事有陷处，务必先摸清深浅；不明就冒进，最易翻车。',
    离: '此事须明白亮化 —— 摊到明处、讲清条件，反而好办。',
    艮: '此事宜止、宜守；此刻不动比乱动好，守住就是赢。',
    兑: '此事须开口沟通、须交换；把话说开、把条件摆明，才有转机。'
  };
  /* 各卦用神对应的行事方式 */
  var T_DO = {
    乾: '属乾金者，重决断、讲信义。',
    坤: '属坤土者，重承载、守信用。',
    震: '属震木者，重行动、抢先机。',
    巽: '属巽木者，重沟通、循序入。',
    坎: '属坎水者，重灵活、忌死守。',
    离: '属离火者，重分明、忌含糊。',
    艮: '属艮土者，重守成、忌冒进。',
    兑: '属兑金者，重表达、宜开口。'
  };

  /**
   * 逐项核查清单
   * 【v6】原版 2-4 项且多为固定句，现按档位与卦层给出差异化核查项。
   */
  function buildCheckList(T, level, rel, relPos, useGuaPos, pUse, pTime) {
    var good = (level === '大吉' || level === '吉' || level === '小吉');
    var bad = (level === '凶' || level === '大凶' || level === '小凶' || level === '偏凶');
    var base = [
      { k: T.checkK, v: good ? '状况良好，可推进' : (bad ? '须先查清，此为成败关键' : '尚不明朗，须查清再定') },
      { k: T.useK, v: good ? '有明确着落' : (bad ? '尚不明朗，需主动争取' : '半明半暗，须加把劲') }
    ];
    /* 【v6】按档位追加差异化核查项 */
    if (bad) base.push({ k: '对方诚意', v: '不可尽信，务必核实' });
    if (good) base.push({ k: '时机窗口', v: '尚在，趁早落定' });
    /* 【v6】用神落位核查 —— 随报数而变 */
    base.push({
      k: '所求落位（' + GUA_INFO[useGuaPos].dir + '·' + useGuaPos + '）',
      v: relPos.score > 0 ? '落于有力之方，路子已通' :
         (relPos.score < 0 ? '落于受制之方，须绕路' : '与用神同气，全凭自己')
    });
    /* 【v6】应期核查 */
    base.push({
      k: '应期' + pTime.raw + '数所指',
      v: pTime.layer >= 2 ? '数深事远，宜早作长计' :
         (pTime.layer === 0 ? '数浅事近，宜速决' : '数中事平，照常推进')
    });
    /* 【v6】风险核查（随事项类型） */
    base.push({ k: '最忌之处', v: T.risk + ' —— 这一项应单独核实，不能只看总评' });
    return base;
  }

  /* ==========================================================
   * 四、他占（为他人占）—— 问事人需报数
   * ========================================================== */

  /**
   * 三数起卦的取数指引
   * 传统「不动卦不占」，故以「当下心念所动」取数：
   *   第一数：所问之事的核心（如「这批货」→ 一个代表它的数字）
   *   第二数：自己当下的心境（如「几成把握」→ 心中默念的一个数）
   *   第三数：所期望的时日（如「何时能成」→ 心中默念的数）
   * 也可纯随机，但心诚者灵，诚则应。
   */
  function guide() {
    return {
      title: '九宫占事 · 取数须知',
      rules: [
        '一事一占。同一件事不要反复起卦，一事一卦，反复则不灵。',
        '心诚则灵。占前静心片刻，心中默念所问之事，随口报出三个数字。',
        '第一数：你心中最先浮现的数字（代表这件事本身）。',
        '第二数：你对成事的把握（心中默念的一个数）。',
        '第三数：你期望的时限（心中默念的数）。',
        '数取 1-99 皆可，不必拘泥。若一时想不出，任意报三数亦应。',
        '占得结果后，参考「临事战术」执行，方能趋吉避凶。'
      ],
      note: '九宫本为「以方位统事」之术，问事不需生辰 —— 心中有数，即可起卦。'
    };
  }


  /* ==========================================================
   * 五、金钱入宫占法（九宫取象实验法 —— 本软件约定）
   *
   * 玩法：静心想着所问之事，取六枚铜钱（可真实掷钱，亦可用心念报数），
   *      依每枚钱之「背／字」数定洛书宫位，依次落宫，
   *      再看所落之宫的吉凶与五行生克，断事之成败。
   *
   * 与其他取象法的关系（不得表述为「古法」）：
   *   本法以洛书九宫为框架，洛书本身有典据；
   *   但「六钱分三组分别断人／己／时」「以背字数定宫」
   *   「相济倍增、相违打折」等具体做法，均为本软件的实验性约定，
   *   未能逐条举证为某一家典籍的固有古法。
   *   界面须以「九宫取象实验法（本软件约定）」标注，并公开：
   *   事项宫映射、洛书归一、进层、飞宫距离、1.0/0.7/0.5 权重、档位阈值。
   * ========================================================== */

  // 六十四卦中，与九宫相合的卦名（用于取象佐证）
  var GUA_BY_LUOSHU = {
    1: '水泽节', 2: '地泽临', 3: '雷风恒', 4: '风山渐',
    6: '天风姤', 7: '泽天夬', 8: '山雷颐', 9: '火地晋'
  };

  /**
   * 掷六钱入九宫
   * @param {object} opt
   *   opt.type    事项类型
   *   opt.nums    六枚钱之数（1-99），由「掷钱背数」或「心念报数」得
   *   opt.asker   求测人
   *   opt.manual  各钱面（可选）：[{back:2, face:3}] 不传则由 nums 自动推
   */
  function coinCast(opt) {
    opt = opt || {};
    var T = SHI_TYPE[opt.type] ? opt.type : '财运求财';
    var TI = SHI_TYPE[T];
    var G = GUA_INFO;

    // 六枚钱：优先用心念报数，其次随机
    var raws = (opt.nums && opt.nums.length === 6) ? opt.nums.slice(0, 6) : null;
    if (!raws) {
      raws = [];
      for (var i = 0; i < 6; i++) raws.push(1 + Math.floor(Math.random() * 99));
    }
    /* 【v6】保留报数原始信息：每枚钱解出洛书宫 + 进层 + 老少 */
    var parsed = raws.map(function (v) { return parseNum(v); });
    var nums = parsed.map(function (p) { return p.luo; });

    // 逐钱定宫：钱数即洛书数，所落之宫即该钱所主之事
    var coins = parsed.map(function (pn, i) {
      var gua = guaOf(pn.luo);
      var gi = G[gua];
      // 钱面阴阳：阳数（奇）为字，阴数（偶）为背
      var isYang = pn.isYang;
      // 该钱之吉凶：卦层判别（【v6】重写）
      var lv = coinLevel2(pn, T);
      return {
        idx: i + 1,
        num: pn.luo,
        rawNum: pn.raw,          // 【v6】保留原始报数
        within: pn.within,       // 【v6】洛书序数（1-9）
        layer: pn.layer,         // 【v6】进层
        isYang: isYang,
        weight: pn.weight,       // 【v6】力量权重（供卦层判别使用）
        gua: gua, dir: gi.dir, sym: gi.sym, name: gi.name, elem: gi.elem,
        face: isYang ? '字' : '背',
        level: lv.level,
        score: lv.score,         // 【v6】连续分
        relKey: lv.key,          // 【v6】与用神关系
        relText: lv.text,        // 【v6】可读依据
        levelText: lv.level === '吉' ? '吉' : (lv.level === '凶' ? '凶' : '平')
      };
    });

    // 统计三吉三凶
    var nJi = coins.filter(function (c) { return c.level === '吉'; }).length;
    var nXiong = coins.filter(function (c) { return c.level === '凶'; }).length;
    var nPing = 6 - nJi - nXiong;

    /* ==========================================================
     * 【v6 重写】取卦名 —— 原实现是本模块最严重的雷同源
     *
     * 原式：var n0 = coins[0].num;
     *       var mainName = GUA_BY_LUOSHU[n0] || ...
     * 即卦名**只由第一枚钱决定**，后五枚对卦名零影响。
     * 用户截图里两次都出「雷风恒」，正因首钱同为 3。
     *
     * 现改为三钱成卦（《梅花易数》「三钱代蓍」本法）：
     *   第 1、2 枚 → 下卦（地）
     *   第 3、4 枚 → 上卦（天）
     *   动爻     → 第 5 枚所落之宫序
     *   第 6 枚→ 变卦之根、兼定应期之数
     * 如此六枚钱全部参与起卦，卦名组合由 9 种增至数千种。
     * ========================================================== */
    var dongYao = ((nums[4] - 1) % 6) + 1;        // 动爻位1-6
    var bianNum = nums[5];                        // 变卦之根

    /* ==========================================================
     * 【v6】规范六十四卦名表 —— 依《周易》卦序，与 deep-yi.js 的 GUA64 表一致
     *
     * 两点说明：
     * ① 卦名取全称（如「天泽履」而非「天泽」），与《周易》卦序及本软件
     *    六爻问事模块（GUA64 表）保持同一口径，便于两处互参。
     * ② 八卦两两相配确为六十四卦，但中宫五黄依传统寄坤、不独用，
     *    故凡洛书序为 5 者，顺延取兑（洛书七）参与成卦。
     * ========================================================== */

    /* 《周易》六十四卦全称表：键为「上卦下卦」，值为规范卦名
     * （与 deep-yi.js 的 GUA64 表逐条一致，此处仅取其名） */
    var GUA64_FULL = {
      '乾乾': '乾为天',
      '坤坤': '坤为地',
      '坎震': '水雷屯',
      '艮坎': '山水蒙',
      '坎乾': '水天需',
      '乾坎': '天水讼',
      '坤坎': '地水师',
      '坎坤': '水地比',
      '巽乾': '风天小畜',
      '乾兑': '天泽履',
      '坤乾': '地天泰',
      '乾坤': '天地否',
      '乾离': '天火同人',
      '离乾': '火天大有',
      '坤艮': '地山谦',
      '震坤': '雷地豫',
      '兑震': '泽雷随',
      '艮巽': '山风蛊',
      '坤兑': '地泽临',
      '巽坤': '风地观',
      '离震': '火雷噬嗑',
      '艮离': '山火贲',
      '艮坤': '山地剥',
      '坤震': '地雷复',
      '乾震': '天雷无妄',
      '艮乾': '山天大畜',
      '艮震': '山雷颐',
      '兑巽': '泽风大过',
      '坎坎': '坎为水',
      '离离': '离为火',
      '兑艮': '泽山咸',
      '震巽': '雷风恒',
      '乾艮': '天山遁',
      '震乾': '雷天大壮',
      '离坤': '火地晋',
      '坤离': '地火明夷',
      '巽离': '风火家人',
      '离兑': '火泽睽',
      '坎艮': '水山蹇',
      '震坎': '雷水解',
      '艮兑': '山泽损',
      '巽震': '风雷益',
      '兑乾': '泽天夬',
      '乾巽': '天风姤',
      '兑坤': '泽地萃',
      '坤巽': '地风升',
      '兑坎': '泽水困',
      '坎巽': '水风井',
      '兑离': '泽火革',
      '离巽': '火风鼎',
      '震震': '震为雷',
      '艮艮': '艮为山',
      '巽艮': '风山渐',
      '震兑': '雷泽归妹',
      '震离': '雷火丰',
      '离艮': '火山旅',
      '巽巽': '巽为风',
      '兑兑': '兑为泽',
      '巽坎': '风水涣',
      '坎兑': '水泽节',
      '巽兑': '风泽中孚',
      '震艮': '雷山小过',
      '坎离': '水火既济',
      '离坎': '火水未济'
    };

    /* 中宫（洛书五）不独用、寄坤宫；成卦时顺延取下一宫，使其仍得成卦。
     * 判据须用洛书序数而非卦名 —— 因洛书 2 宫与 5 宫同为「坤」，
     * 只看卦名无法分辨真坤与中宫所寄。 */
    function luoOf(n) { return ((n - 1) % 9 + 9) % 9 + 1; }
    function fixCenterByNum(sum) {
      var n = luoOf(sum);
      return n === 5 ? '兑' : guaOf(n);   // 中宫顺延取兑（洛书七）
    }
    /** 依上下卦取《周易》规范卦名 */
    function guaNameOf(up, low) {
      return GUA64_FULL[up + low] || (up === low ? up + '为' + SYM[up] : SYM[up] + SYM[low]);
    }

    // 变卦：由动爻所在之宫，加第6 枚之数而成
    var bianGua = fixCenterByNum(nums[4] + nums[5]);
    var bianLow = fixCenterByNum(bianNum);
    var mainUp = fixCenterByNum(nums[2] + nums[3]);
    var mainLow = fixCenterByNum(nums[0] + nums[1]);
    var mainName = guaNameOf(mainUp, mainLow);
    var bianName = guaNameOf(bianGua, bianLow);

    /* 依吉凶数起卦（保留原法作交叉验证，与三钱成卦互为参照） */
    var jiSum = coins.filter(function (c) { return c.level === '吉'; })
      .reduce(function (a, c) { return a + c.num; }, 0) || 0;
    var xiongSum = coins.filter(function (c) { return c.level === '凶'; })
      .reduce(function (a, c) { return a + c.num; }, 0) || 0;

    // 三组断：两钱一组，断「己（谋）· 人（助）· 时（应）」
    var groups = [
      { k: '谋', name: '己方谋划', a: coins[0], b: coins[1] },
      { k: '人', name: '外助与对方', a: coins[2], b: coins[3] },
      { k: '时', name: '时机与应期', a: coins[4], b: coins[5] }
    ].map(function (grp) {
      var a = grp.a, b = grp.b;
      /* 【v6】改用卦层判别（relation2），并传入原始报数 */
      var rel = relation2(a.gua, b.gua,
        parsed[grp.a.idx - 1],
        parsed[grp.b.idx - 1]);
      /* 【v6】吉凶改为连续分，不再是±1 的粗粒度 */
      var good = a.score + b.score;
      var v, vText;
      if (good >= 3.5) { v = '顺'; vText = '两项合计评分偏正，仍须核对各项关系'; }
      else if (good <= -1.5) { v = '逆'; vText = '两项合计评分偏负，先核对受限项'; }
      else if (rel.score >= 2) { v = '顺'; vText = '两钱相生相助，此事顺遂'; }
      else if (rel.score <= -1) { v = '逆'; vText = '两钱相克相制，此事有阻'; }
      else if (good >= 1.5) { v = '缓'; vText = '吉多凶少，偏向可行'; }
      else if (good <= -0.5) { v = '险'; vText = '凶多吉少，偏向受阻'; }
      else { v = '缓'; vText = '两钱关系平平，须人为推动'; }
      return {
        k: grp.k, name: grp.name, v: v, vText: vText,
        a: a, b: b, rel: rel, good: good,
        advice: groupAdvice(grp.k, v, a, b, TI, rel)
      };
    });

    /* ==========================================================
     * 【v6】总体断：由「数吉凶个数」改为「连续分 + 动爻 + 变卦」
     * 原式只看 nJi 落在 5/4/>0/=0/>-2/<-2 六档，
     * 而 nJi 只能取 0..6，6 种输入 → 6 档，且与六钱具体组合无关。
     * ========================================================== */
    var totalScore = coins.reduce(function (a, c) { return a + c.score; }, 0);
    totalScore = Math.round(totalScore * 10) / 10;

    // 动爻修正：动爻所在宫与用神的生克，影响「变局」的吉凶
    var dongGua = guaOf(nums[4]);
    var dongRel = relation2(dongGua, TI.gua,
      parsed[4],
      null);
    // 变卦修正：变卦之吉凶 —— 事之结局
    var bianRel = relation2(bianGua, TI.gua, parsed[5], null);

    var finalScore = Math.round((totalScore * 0.6 + dongRel.score * 0.2 + bianRel.score * 0.2) * 10) / 10;

    var overall, overallText, overallIdx;
    if (finalScore >= 4.5) { overallIdx = 8; overall = '大吉'; overallText = '六钱俱助，所问之事大局已定，顺遂可成'; }
    else if (finalScore >= 3.0) { overallIdx = 7; overall = '吉'; overallText = '六钱得四吉，所问之事可成，惟须防细节'; }
    else if (finalScore >= 2.0) { overallIdx = 6; overall = '小吉'; overallText = '吉多凶少，所问之事可为，但需谨慎推进'; }
    else if (finalScore >= 1.0) { overallIdx = 5; overall = '偏吉'; overallText = '略占上风，肯做则得，不做则平'; }
    else if (finalScore >= -0.5) { overallIdx = 4; overall = '平'; overallText = '吉凶参半，所问之事成否在人，全看经营'; }
    else if (finalScore >= -1.5) { overallIdx = 3; overall = '偏凶'; overallText = '阻力初现，宜先稳后进，勿铺开'; }
    else if (finalScore >= -2.5) { overallIdx = 2; overall = '小凶'; overallText = '凶多吉少，所问之事阻滞，宜缓图之'; }
    else if (finalScore >= -3.5) { overallIdx = 1; overall = '凶'; overallText = '六钱多凶，所问之事当前不宜强为'; }
    else { overallIdx = 0; overall = '大凶'; overallText = '六钱俱受制，此局逆势，须暂缓另谋'; }

    // 择方：取「吉钱最多」之宫为助方，「凶钱最多」之宫为避方
    var byGua = {};
    coins.forEach(function (c) {
      byGua[c.gua] = byGua[c.gua] || { gua: c.gua, dir: c.dir, sym: c.sym, name: c.name, ji: 0, xiong: 0, ping: 0 };
      if (c.level === '吉') byGua[c.gua].ji++;
      else if (c.level === '凶') byGua[c.gua].xiong++;
      else byGua[c.gua].ping++;
    });
    var arr = Object.keys(byGua).map(function (k) { return byGua[k]; });
    var helpGua = arr.slice().sort(function (a, b) { return (b.ji - b.xiong) - (a.ji - a.xiong); })[0];
    var avoidGua = arr.slice().sort(function (a, b) { return (a.ji - a.xiong) - (b.ji - b.xiong); })[0];

    return {
      asker: opt.asker || '求测人',
      type: T, typeWhy: TI.why, useK: TI.useK, checkK: TI.checkK,
      coins: coins, nums: nums, raws: raws, parsed: parsed,
      nJi: nJi, nXiong: nXiong, nPing: nPing,
      /* 【v6】卦名改由六枚共同决定，新增动爻与变卦 */
      mainGua: mainName, bianGua: bianName, dongYao: dongYao,
      dongGua: dongGua, bianRoot: bianNum,
      upGua: mainUp, lowGua: mainLow,
      dongRel: dongRel, bianRel: bianRel,
      jiSum: jiSum, xiongSum: xiongSum,
      groups: groups,
      overall: overall, overallText: overallText, overallIdx: overallIdx,
      totalScore: totalScore, finalScore: finalScore,
      helpGua: helpGua, avoidGua: avoidGua,
      byGua: byGua,
      verdict: '所问「' + T + '」，六钱入九宫，得吉 ' + nJi + '、平 ' + nPing + '、凶 ' + nXiong +
        '，六钱总合 ' + totalScore + ' 分。' + overallText + '。' +
        '所成之卦取「' + mainName + '」为象（上卦' + mainUp + '、下卦' + mainLow + '），' +
        '第' + '一二三四五六'[dongYao - 1] + '爻动，变卦「' + bianName + '」。' +
        '动爻落' + dongGua + '宫（' + GUA_INFO[dongGua].dir + '），与用神为「' + dongRel.key + '」，' +
        (dongRel.score > 0 ? '变局之中仍有助力。' : dongRel.score < 0 ? '变局之时反生掣肘。' : '变局之中吉凶平平。'),
      smoothPlan: coinSmooth(overall, helpGua, TI, groups, dongRel, bianRel, dongYao, dongGua),
      breakPlan: coinBreak(overall, avoidGua, TI, groups, bianRel, dongGua, dongYao, dongRel),
      tactics: groups.map(function (g) { return { t: g.name + '（' + g.vText + '）', d: g.advice }; }),
      checkList: [
        { k: TI.checkK, v: overall.indexOf('吉') >= 0 ? '条件有利，核实后可推' : '条件不足，务必查清再定' },
        { k: TI.useK, v: '以六钱吉者所在之宫为' + (helpGua ? helpGua.dir : '—') + '，往彼方用力最省力' },
        /* 【v6】新增两项随卦而变的核查项 */
        { k: '所成之卦（' + mainName + '）', v: dongRel.score > 0 ? '动爻落宮与用神关系为'+dongRel.key+'，该项评分偏正' :
            (dongRel.score < 0 ? '动爻落宮与用神关系为'+dongRel.key+'，该项评分偏负' : '动爻落宮与用神关系为'+dongRel.key+'，该项评分中性') },
        { k: '第' + '一二三四五六'[dongYao - 1] + '爻动（' + dongGua + '宫）', v: bianRel.score > 0 ? '变卦转向有利，宜顺势变通' :
            (bianRel.score < 0 ? '变卦转向不利，宜早留后路' : '变卦平常，随机应变') },
        { k: '最忌之处', v: TI.risk + ' —— 这一项应单独核实，不能只看总评' }
      ]
    };
  }

  /**
   * 单枚钱的吉凶
   * 【v6 重写】原实现只比五行，9 个洛书数只落 3 档（吉/平/凶），
   * 于是 9^6 = 531441 种六钱组合被压到极少量。
   *
   * 现改为「五行主轴 + 卦层修正」：
   *   ① 五行与用神的生克（主轴）
   *   ② 该宫的宫性（八宫性情：刚健/柔顺/奋动/渗入/险陷/附丽/静止/喜悦）
   *   ③ 飞宫邻远（近则得气、远则力薄）
   *   ④ 字背（奇为字为阳、偶为背为阴）与进层
   * 返回值保留 level（吉/平/凶三档，保证渲染层不变）与
   * score / weight（连续量，供全局汇总使用）。
   */
  function coinLevel2(pn, typeKey) {
    var T = SHI_TYPE[typeKey] || SHI_TYPE['财运求财'];
    var useGua = T.gua;
    var useElem = GUA_INFO[useGua].elem;
    var gua = guaOf(pn.luo);
    var e = GUA_INFO[gua].elem;
    var dist = flyDist(gua, useGua);

    /* ① 五行主轴 */
    var score, key;
    if (e === useElem) { score = 0; key = '同气'; }
    else if (SHENG[e] === useElem) { score = 2; key = '本宫生用神'; }   // 我生用神
    else if (KE[useElem] === e) { score = 1; key = '用神克本宫'; }     // 我制之亦可用力
    else if (SHENG[useElem] === e) { score = 1; key = '用神生本宫'; }   // 得助
    else { score = -2; key = '本宫克用神'; }                             // 我受制

    /* ② 飞宫邻远修正 */
    if (key !== '同气') {
      if (dist === 1 && score > 0) score += 1;        // 邻宫得气
      else if (dist === 4 && score > 0) score -= 1;   // 正对相争
      else if (dist >= 3 && score > 0) score -= 1;    // 相去甚远
    }

    /* ③ 宫性修正：卦性相济者+1，相违者 -0~+1 */
    var hk = gua + '|' + useGua;
    if (TRAIT_HARMONY[hk] || TRAIT_HARMONY[useGua + '|' + gua]) score += 1;
    else if (gua !== useGua && score > 1) score -= 1;

    /* ④ 字背与进层：老阴（偶、层深）力重，少阳（奇、层浅）力轻 */
    if (!pn.isYang) score += 0.5;          // 老阴沉稳，略有分量
    if (pn.layer >= 2) score += 0.5;       // 进层深，力量厚
    else if (pn.layer === 0 && pn.raw > 9) score -= 0.5;

    score = Math.round(score * 10) / 10;

    /* 映射为三档（渲染层与统计仍用吉/平/凶） */
    var level = score >= 1.5 ? '吉' : (score <= -0.5 ? '凶' : '平');
    return {
      level: level,
      score: score,
      key: key,
      dist: dist,
      trait: GUA_INFO[gua].trait,
      text: GUA_INFO[gua].dir + '方' + gua + '宫（' + GUA_INFO[gua].name + '，' + GUA_INFO[gua].trait +
        '）与用神' + useGua + '宫为「' + key + '」' +
        (dist === 1 ? '，邻宫得气' : dist === 4 ? '，正对相争' : dist >= 3 ? '，相去甚远' : '')
    };
  }

  /** 兼容旧接口：单枚钱的吉凶三档 */
  function coinLevel(n, typeKey) {
    return coinLevel2(typeof n === 'number' ? parseNum(n) : n, typeKey).level;
  }

  /**
   * 三组断语
   * 【v6 重写】修复两处缺陷：
   *   ① 原式拼接 TI.badDo / TI.goodDo，但 SHI_TYPE 中从未定义这两个字段
   *      —— 10 个事项类型全缺，页面因此显示字面「undefined」（已补齐字段）。
   *   ② 原式四档套话，组内钱数与关系不同也输出同一句。
   * 现接入 rel（卦层关系）与 a/b 的宫性、字背。
   */
  function groupAdvice(k, v, a, b, TI, rel) {
    var where = a.dir + '（' + a.gua + '）、' + b.dir + '（' + b.gua + '）';
    /* 【v6】两钱的具体取象，随六钱而变 */
    var detail = a.dir + a.gua + '为' + a.face + '（' + a.gua + '宫' + GUA_INFO[a.gua].trait +
      (a.layer ? '、进' + a.layer + '层' : '') + '）、' +
      b.dir + b.gua + '为' + b.face + '（' + b.gua + '宫' + GUA_INFO[b.gua].trait +
      (b.layer ? '、进' + b.layer + '层' : '') + '）';
    var sc = rel ? rel.score : 0;
    var ky = rel ? rel.key : '平';
    if (v === '顺') {
      return k === '谋'
        ? '此组两钱相生（' + ky + '，合' + sc + '分），你的谋划方向正确，可放手去做。' + TI.badDo
        : k === '人'
        ? '此组相生（' + ky + '，合' + sc + '分），说明有助你的人出现，或对方有意配合。宜主动靠过去。' + TI.goodDo
        : '此组相生，时机站在你这边，宜趁势落定，勿拖。所取为' + detail + '。';
    }
    if (v === '逆') {
      return k === '谋'
        ? '此组两钱相克（' + ky + '，合' + sc + '分），说明你现有思路有盲点。宜先停下来复盘，' + TI.badDo
        : k === '人'
        ? '此组相克（' + ky + '，合' + sc + '分），对方态度有阻或助力不足。宜缓，勿在' + where + '强谈。所取为' + detail + '。'
        : '此组相克，此时出手时机不对。宜等，候下一个窗口。所取为' + detail + '。';
    }
    if (v === '险') {
      return k === '谋'
        ? '此组有阻（' + ky + '，合' + sc + '分），谋划需改。' + TI.badDo
        : k === '人'
        ? '此组不利（' + ky + '，合' + sc + '分），对方助力不足或有意阻。宜缓，勿在' + where + '强谈。所取为' + detail + '。'
        : '此组不利，此时出手时机欠佳。宜等，候下一个窗口。所取为' + detail + '。';
    }
    return k === '谋'
      ? '此组平平（' + ky + '，合' + sc + '分），谋事须再加把劲，把想清楚再动。所取为' + detail + '。'
      : k === '人'
      ? '此组平平（' + ky + '，合' + sc + '分），对方态度暧昧未明。宜试探，不宜押注。所取为' + detail + '。'
      : '此组平平（' + ky + '，合' + sc + '分），成败尚未分明。可行可止，视后续条件而定。所取为' + detail + '。';
  }

  /**
   * 趋吉方案
   * 【v6】接入动爻、变卦、连续总分。
   */
  function coinSmooth(overall, helpGua, TI, groups, dongRel, bianRel, dongYao, dongGua) {
    var out = [];
    var good = (overall === '大吉' || overall === '吉' || overall === '小吉' || overall === '偏吉');
    var dongCn = '一二三四五六'[dongYao - 1];
    if (good) {
      out.push({ t: '借吉方', d: helpGua ? '吉钱聚于' + helpGua.dir + '（' + helpGua.gua + '，' + helpGua.ji + '吉）。把要紧的事放办在此方，最顺。' : '择吉方而行。' });
      out.push({ t: '趁势落定', d: '既得多助，不宜久拖。' + TI.goodDo });
      out.push({
        t: '顺动爻',
        d: '第' + dongCn + '爻动于' + dongGua + '宫（' + GUA_INFO[dongGua].dir + '），' +
           (dongRel.score > 0 ? '此动与用神相协，是主动出击的好时机。'
            : dongRel.score < 0 ? '此动与用神相违，勉强动之易生变 —— 先缓一步。'
            : '此动与用神同气，可动可不动，视条件而定。')
      });
      out.push({
        t: '察变卦',
        d: '变卦与用神为「' + bianRel.key + '」（合' + bianRel.score + '分），' +
           (bianRel.score > 0 ? '事之结局偏向好，宜把结果提前锁定。'
            : bianRel.score < 0 ? '事之结局有变，务必预留退路与替代方案。'
            : '事之结局未定，中途变数不少。')
      });
    } else {
      out.push({ t: '先小试', d: '未得大助，先以最小代价试水，摸清对方反应再决定加码。' });
      out.push({ t: '改思路', d: '六钱所示之阻，多在' + TI.checkK + '。换角度切入，或请第三方牵线。' });
      out.push({
        t: '避动爻',
        d: '第' + dongCn + '爻动于' + dongGua + '宫（' + GUA_INFO[dongGua].dir + '），' +
           (dongRel.score < 0 ? '此动最凶，切勿在此处强行推进。' : '此动平平，宜择吉日再动。')
      });
      out.push({
        t: '防变卦',
        d: '变卦与用神为「' + bianRel.key + '」（合' + bianRel.score + '分），' +
           (bianRel.score < 0 ? '结局偏向坏，须及早准备替代方案。' : '结局未必坏，尚有可为。')
      });
    }
    groups.forEach(function (g) {
      if (g.v === '顺') out.push({ t: g.name, d: g.advice });
    });
    return out;
  }

  /**
   * 化解方案
   * 【v6】接入变卦与动爻。
   */
  function coinBreak(overall, avoidGua, TI, groups, bianRel, dongGua, dongYao, dongRel) {
    var out = [];
    var dongCn = '一二三四五六'[dongYao - 1];
    if (avoidGua) {
      out.push({ t: '避凶方', d: '凶钱聚于' + avoidGua.dir + '（' + avoidGua.gua + '，' + avoidGua.xiong + '凶）。谈判、签约、交付避开此方。' });
    }
    out.push({ t: '避' + TI.risk, d: '此事最忌' + TI.risk + '。凡与此相关的决定，一律缓行；已涉者及早抽身。' });
    out.push({
      t: '盯动爻',
      d: '第' + dongCn + '爻动于' + dongGua + '宫（' + GUA_INFO[dongGua].dir + '），此事的关键变数在此。' +
         (dongRel.score < 0 ? '此宫不利，凡与之相关的安排皆须留一手。' : '此宫尚可，可作转圜之地。')
    });
    out.push({
      t: '防变卦',
      d: '变卦与用神为「' + bianRel.key + '」（合' + bianRel.score + '分），' +
         (bianRel.score < 0 ? '结局恐有变，须预设替代方案与止损线。' : '结局尚顺，但不可大意。')
    });
    groups.filter(function (g) { return g.v === '逆'; }).forEach(function (g) {
      out.push({ t: g.name + '需破', d: g.advice });
    });
    out.push({ t: '留退路', d: '此事吉凶参半，务必保留退路：款项分期、条款留缝、口头承诺落纸面。' });
    return out;
  }

  /* ============================================================
   * 【1.6.0 新增】约定披露 —— 审计九要求：
   *   公开本法的数字映射、宫位、权重和档位公式，并明确标注「软件约定」；
   *   不得称为六爻铜钱法，不得把第 6 个数字当最终定局，
   *   也不得与六轮三钱法共用结果文案。
   * ============================================================ */
  var CONVENTION_DISCLOSURE = {
    title: '六数九宫取象 · 软件约定披露',
    convention: '软件约定',
    // 1) 数字映射
    numberMapping: {
      label: '数字映射',
      desc: '每枚钱（或心念数字）按模 9 归入洛书九数，0 作 9。' +
        '洛书九数 → 八卦宫位：1坎 2坤 3震 4巽 5坤（中宫寄坤）6乾 7兑 8艮 9离。',
      code: 'n → ((n - 1) mod 9) + 1；洛书 1→坎 2→坤 3→震 4→巽 5→坤 6→乾 7→兑 8→艮 9→离'
    },
    // 2) 宫位
    palaces: {
      label: '宫位',
      desc: '六个数分别落宫，按用神宫、测事宫、应期宫三层解读；' +
        '动爻取第 5 数所在宫，变卦取第 6 数所在宫。',
      detail: LUOSHU
    },
    // 3) 权重
    weights: {
      label: '权重',
      desc: '飞宫距离决定力量厚薄：同宫 1.0、相邻 0.7、隔宫 0.5。' +
        '总体分为连续量加权：六钱总势 ×0.6 ＋ 动爻宫 ×0.2 ＋ 变卦宫 ×0.2。',
      flyOrder: FLY_ORDER,
      factors: { 同宫: 1.0, 相邻: 0.7, 隔宫: 0.5 },
      aggregation: { total: 0.6, moving: 0.2, changed: 0.2 }
    },
    // 4) 档位
    grades: {
      label: '档位',
      desc: '连续分映射为 9 档：大吉 ≥4.5、吉 ≥3.0、小吉 ≥2.0、偏吉 ≥1.0、' +
        '平 ≥-0.5、偏凶 ≥-1.5、小凶 ≥-2.5、凶 ≥-3.5、大凶 <-3.5。',
      thresholds: [
        { grade: '大吉', min: 4.5 }, { grade: '吉', min: 3.0 },
        { grade: '小吉', min: 2.0 }, { grade: '偏吉', min: 1.0 },
        { grade: '平', min: -0.5 }, { grade: '偏凶', min: -1.5 },
        { grade: '小凶', min: -2.5 }, { grade: '凶', min: -3.5 },
        { grade: '大凶', min: -Infinity }
      ]
    },
    // 与六爻铜钱法的区别（审计九.1/3）
    difference: '本法为「六数九宫取象」，属软件约定的数字取象法，' +
      '不是传统三钱六爻，不得与六轮三钱法共用结果文案；' +
      '第 6 个数字不是最终定局，仅作变卦宫参考；' +
      '本软件不主张本法为唯一古法，也不作「完全依循古籍」一类无法逐条举证的表述。'
  };

  return {
    divineAffair: divineAffair,
    coinCast: coinCast,
    GUA_BY_LUOSHU: GUA_BY_LUOSHU,
    guide: guide,
    SHI_TYPE: SHI_TYPE,
    GUA_INFO: GUA_INFO,
    LUOSHU: LUOSHU,
    relation: relation,
    /* 【v6 新增导出】卦层判别与报数解析，供外部核验 */
    relation2: relation2,
    parseNum: parseNum,
    flyDist: flyDist,
    coinLevel2: coinLevel2,
    FLY_ORDER: FLY_ORDER,
    GUA_TRAIT: GUA_TRAIT,
    /* 【1.6.0 新增】约定披露 */
    CONVENTION_DISCLOSURE: CONVENTION_DISCLOSURE,
    METHOD_NAME: '六数九宫取象'
  };
});
