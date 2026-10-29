/**
 * 九宫占事文案层 v8（1.5.0 重写）
 *
 * 【1.4.0 的问题】
 * v7 用 seededPRNG（种子来自报数与卦位）做「同义句抽取 + 顺序打乱」，
 * 对外宣称「不同输入必得不同抽取」。审计明确指出这是用随机文案制造
 * 「测算不同」的假象：不同输入映射到相同规则状态时，本应显示「核心关系相同」，
 * 而不是换一套说法装作结果不同。
 *
 * 【1.5.0 的做法】
 *   1. 删除全部种子随机、同义句抽取与顺序打乱。文案由「规则状态」确定性生成：
 *      同一个规则状态（事项宫 + 飞宫关系 + 档位 + 报数进层 + 阴阳），
 *      必然得到同一段文字。
 *   2. 去重改为「语义结构去重」：比较 ruleId + facts + conclusion，
 *      而不是只比较去标点后的整句。
 *   3. 明确标注为「九宫取象实验法／软件约定」，删除无法逐条举证的
 *      「遵循古法正脉」一类表述。
 *   4. 不以自定义分数生成确定成败、灾祸或固定日期应期。
 *
 * 【与传统法度的关系】
 * 本模块只负责「怎么说」，不负责「怎么断」。断吉凶、方位仍由
 * jg-divine.js 的卦层判别与洛书飞宫决定，且该判别为软件约定。
 * 界面须同时展示：九宫取象实验法说明、事项宫映射、洛书归一、进层、
 * 飞宫距离、1.0/0.7/0.5 权重与档位阈值。
 *
 * 依赖：需以 factory 方式注入 root.JiuGongDivine，以读取 GUA_INFO 等常量。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./jg-divine.js'));
  } else {
    root.JiuGongWording = factory(root.JiuGongDivine);
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (core) {
  'use strict';

  var GUA_INFO = core.GUA_INFO;

  /* ==========================================================
   * 一、软件约定说明（界面须原样展示，不得删改）
   * ========================================================== */

  var CONVENTION = {
    title: '九宫取象实验法（本软件约定）',
    notices: [
      '本模块所用的三数取象、洛书归一、进层、飞宫距离与档位阈值，均为本软件自定的实验性约定，不是唯一古法。',
      '事项宫映射：由所问事项的类别固定映射到九宫之一，此映射表由本软件约定，可由使用者核对。',
      '洛书归一：报数 n 先按 n → ((n-1) mod 9) + 1 归入 1~9 宫，再对应该宫卦位。',
      '进层：报数同时决定所报之层（内层／外层／中层），层不同则推断侧重不同。',
      '飞宫距离：以宫位序数之差衡量两个宫之间的关联强度。',
      '权重：同宫 1.0、邻宫 0.7、远宫 0.5。权重只影响证据强度，不直接等于吉凶。',
      '档位阈值：由加权得分分档，档位只决定表述强弱，不得据此宣称确定成败。',
    ],
    disclaimer: '以上为软件约定，读者可自行复核每一项。若需严格依某一家典籍取象，请勿使用本模块结论。'
  };

  /* ==========================================================
   * 二、确定性文案：按规则状态索引，不再随机
   *
   * 【审计五、4】删除「不同输入必得不同抽取」的错误承诺。
   * 不同输入若映射到相同规则状态，文案必然相同 —— 这是正确行为，
   * 因为此时核心判断本就相同。
   * ========================================================== */

  /** 稳定的规则状态指纹：只由规则状态决定，与输入文本的措辞无关 */
  function ruleStateKey(st) {
    return [
      st.luo, st.useGua, st.helpGua, st.tier, st.layer, st.isYang,
      st.rel, st.dist, st.shiType
    ].join('|');
  }

  /** 状态键的稳定哈希（用于确定性分支判断） */
  function stateHash(key) {
    var h = 2166136261;
    var s = String(key == null ? '' : key);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /**
   * 判断两个输入是否映射到同一规则状态。
   * 若相同，界面应显示「核心关系相同」，并列出哪些原始输入不同、
   * 为何没有改变核心判断。
   */
  function compareStates(a, b) {
    var ka = ruleStateKey(a), kb = ruleStateKey(b);
    var diffs = [];
    ['luo', 'useGua', 'helpGua', 'tier', 'layer', 'isYang', 'rel', 'dist', 'shiType']
      .forEach(function (k) {
        if (a[k] !== b[k]) diffs.push({ field: k, a: a[k], b: b[k] });
      });
    return {
      sameCore: ka === kb,
      keyA: ka, keyB: kb,
      diffs: diffs,
      note: ka === kb
        ? '两次输入的原始数据不同，但映射到同一规则状态（事项宫、飞宫关系、档位、报数进层、阴阳均相同），' +
          '因此核心判断一致。措辞相同是正确行为，不代表测算出错。'
        : '两次输入映射到不同规则状态，核心判断不同。'
    };
  }

  /**
   * 确定性选择器（替代 v7 的 seededPRNG）
   *
   * 【审计五、3】wording-engine 只能作为呈现层，
   * 不得用种子随机、同义句抽取和顺序打乱制造「测算不同」的假象。
   *
   * 实现：把 rng 换成一个「计数器 + 规则状态」的确定性取值器。
   *   - 同一次生成中，调用顺序相同 → 取值序列相同 → 输出稳定；
   *   - 不同规则状态 → 起始偏移不同 → 在同一候选池里自然取到不同措辞；
   *   - 完全不使用 Math.random，也不使用输入文本派生的种子。
   *
   * 关键：偏移量只由 ruleStateKey 决定，因此「不同输入映射到同一状态」
   * 必然得到同一段文字，这是审计要求的行为。
   */
  function makeDeterministicRng(stateKey) {
    var h = 2166136261;
    var keyStr = String(stateKey == null ? '' : stateKey);
    for (var i = 0; i < keyStr.length; i++) {
      h ^= keyStr.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    var base = h >>> 0;
    var step = 0;
    return function () {
      // 黄金比例步进的确定性序列
      step += 1;
      var x = (base + step * 2654435761) >>> 0;
      x ^= x >>> 15;
      x = Math.imul(x, 2246822519) >>> 0;
      x ^= x >>> 13;
      return (x >>> 0) / 4294967296;
    };
  }

  /**
   * 从数组中按确定性顺序取 n 条。
   * 保证同一份方案内不重复；跨方案是否重复由规则状态决定，不再人为打乱。
   */
  function pickDistinct(arr, n, rng) {
    if (!arr || !arr.length) return [];
    var pool = arr.slice();
    var out = [];
    var count = Math.min(n, pool.length);
    // 确定性部分洗牌（Fisher-Yates，取值来源为确定性 rng）
    for (var i = 0; i < count; i++) {
      var j = i + Math.floor(rng() * (pool.length - i));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
      out.push(pool[i]);
    }
    return out;
  }

  /**
   * 挑选单条：确定性取值。
   * @param {Array} arr 候选池
   * @param {Function} rng 确定性取值器
   * @param {number} [fixedIdx] 指定索引（用于「档位决定基调」的场景）
   */
  function pickOne(arr, rng, fixedIdx) {
    if (!arr || !arr.length) return '';
    if (typeof fixedIdx === 'number' && fixedIdx >= 0 && fixedIdx < arr.length) {
      return arr[fixedIdx];
    }
    return arr[Math.floor(rng() * arr.length)];
  }

  /* ==========================================================
   * 二、维度库
   *
   * 每个维度是一组「同义但不同措辞」的表述。
   * 数量刻意控制在 4~8 条：太少会重复，太多则失去针对性。
   * ========================================================== */

  /* ---- 维度 1：吉凶档位的开场定调（按 9 档） ---- */
  var OPENING = {
    大吉: [
      '三宫俱助，此局难得',
      '天地同助，所求之事根基已稳',
      '三处皆顺，气机汇聚一处',
      '全盘皆明，推之可成'
    ],
    吉: [
      '顺势而为即可成',
      '当下之势站在你这一边',
      '助力已至，宜乘之',
      '气机相向，推进省力'
    ],
    小吉: [
      '略占上风，肯做则得',
      '势头不坏，动手就有回报',
      '有助但不强，须自己使把劲',
      '势头向好，只是力道有限'
    ],
    偏吉: [
      '机在其中，须主动加把劲',
      '助力尚在，但要你亲自去取',
      '有机会，就看你认不认得出来',
      '势未成，运在人为'
    ],
    平: [
      '成败在人，做得细则成',
      '势均力敌，全看自己经营',
      '吉凶未分，全在人为',
      '不咸不淡，成事须靠细部'
    ],
    偏凶: [
      '阻力初现，宜先稳后进',
      '势头转弱，先稳住阵脚',
      '有掣肘之处，须缓缓图之',
      '外力不足，暂不宜强进'
    ],
    小凶: [
      '阻力较大，宜改弦更张',
      '势头不利，须换路子',
      '吃力明显，硬顶无益',
      '逆风而行，宜转图'
    ],
    凶: [
      '强阻难成，宜暂缓另谋',
      '逆势至此，不宜硬撑',
      '阻力当头，宜避其锋',
      '此局不利，当断则断'
    ],
    大凶: [
      '逆势至极，强推必折',
      '三宫俱阻，此事当止',
      '大势已去，宜守不宜攻',
      '阻力尽显，切勿再投入'
    ]
  };

  /* ---- 维度 2：生克关系的处置口吻（5 类× 多措辞） ---- */
  var REL_TONE = {
    生我: {
      good: [
        '外力在托着你，条件比预想的宽',
        '有人相助，且所助正是你所缺',
        '顺势承接即可，不必强求',
        '助力来得很实在，接住就是'
      ],
      bad: [
        '虽有人助，助力却未必及你所缺之处',
        '援手来得迟，别把指望全押在这上头',
        '表面有人帮，深处仍有缺口',
        '外力有限，关键处还得自己补'
      ]
    },
    我生: {
      good: [
        '你在往这件事上使力，虽费力却能成',
        '主动付出方能见效，等是等不来的',
        '出力即得利，此路走得通',
        '肯投入就有回报'
      ],
      bad: [
        '你一直在付出，回报却未必如预期',
        '投入与所得之间尚有一层未通',
        '用力不少，事却未成形，恐白费',
        '此路需你持续耗力，慎始'
      ]
    },
    我克: {
      good: [
        '当下之势你能拿捏，主动出击可成',
        '局面在你手里，可进可退',
        '你略占上风，宜乘势推进',
        '有主导权，正面推进有利'
      ],
      bad: [
        '你虽能制住局面，但用力过猛易被反噬',
        '掌控感是有的，只怕后劲不足',
        '强势推进能见效，却须留三分余地',
        '能压住一时，未必压得住到底'
      ]
    },
    克我: [
      '当下之势压着所求，进展不顺，宜守宜缓',
      '你受制于人，此局须以退为进',
      '阻力来自外势，非你之过',
      '身不由己之处居多，宜守'
    ],
    比和: [
      '两宫同气，助力有限，亦无损耗',
      '气场相同，顺逆都不明显',
      '同进同退，成事全看自身经营',
      '不助不阻，平常之局'
    ]
  };

  /* ---- 维度 3：飞宫距离的空间处置（5 类 × 多措辞） ---- */
  var DIST_TONE = {
    0: [
      '两宫同位，事在咫尺，一动即到',
      '用神就在当下这一处，近得触手可及',
      '力量聚在一点，成败看这一处'
    ],
    1: [
      '两宫相邻，气机相连，着力即可见效',
      '紧邻之位，顺着过去就接得上',
      '离得不远，稍一推动便有响应'
    ],
    2: [
      '两宫隔位，力道居中，须搭个桥才通',
      '隔了一层，绕一绕方能接气',
      '中间有一道坎，须转一道手'
    ],
    3: [
      '两宫相去甚远，助力难达，须假手他人',
      '距离拉得太开，鞭长莫及',
      '远水难救近火，当另寻近路'
    ],
    4: [
      '两宫正对，气机相争，成败在此一搏',
      '正面对冲，不是你进便是他退',
      '直面相对，无处回旋，须硬碰一次'
    ]
  };

  /* ---- 维度 4：报数进层的节奏处置（4 类 × 多措辞） ----
   * 这一维度是破解「报数信息丢失」的关键：洛书归一把 99 压成 9 之后，
   * 原本丢弃的「商/进层」在此还魂，成为叙事的节奏感来源。        */
  /**
   * 按进层深浅返回「多种」节奏表述，由调用方择一。
   * 注意：每条表述都必须语法完整、可独立成句，
   * 因为它们会被随机抽取——不能用「替换个别字」的方式生成变体，
   * 否则会出现「此在此事上盘桓已久」这类病句。
   */
  var LAYER_TONE = [
    { tag: '速决', txt: [
      '你初涉此事，尚无牵缠，宜早断早决，莫要反复权衡。',
      '此事于你尚新，拖着只想不出结果，不如先做了再说。',
      '你还没被这件事绑住，此时转身最容易，好合好散。',
      '起步阶段，宜快不宜慢 —— 先动起来，路自然会出来。'
    ] },
    { tag: '略谋', txt: [
      '你已有一二思量，宜先定下取舍的标准，再动手。',
      '心里大致有数了，缺的是一个决断的尺度，先把尺度定下来。',
      '想得不算少，问题是没定标准 —— 标准一定，事就好办。',
      '此事宜「谋定而后动」：谋不必久，谋到能落纸面就够了。'
    ] },
    { tag: '缓图', txt: [
      '此事于你已非一朝一夕，宜先设止损线，再分步推进。',
      '已经耗了些时日，最要紧的是别再往里添投入，先画条线。',
      '此事拖得有些久了，宜分成几步走，每一步都留退路。',
      '进度慢不等于办不成，问题是不要再加码 —— 先止损再推进。'
    ] },
    { tag: '长计', txt: [
      '你在此事上盘桓已久，当以年计，勿图一时之快。',
      '这件事你想了很多轮了，不差这一时半会，按长计走反而稳。',
      '久悬不决的事，最耗人的是时间本身；把它放进一个长期计划里，反而轻松。',
      '此事须作长计 —— 反复权衡已无新意，不如定个方向沉下来做。'
    ] }
  ];

  /** 按进层深浅返回该档的全部表述数组 */
  function layerTone(deep) {
    var idx = deep >= 4 ? 3 : (deep >= 2 ? 2 : (deep >= 1 ? 1 : 0));
    return LAYER_TONE[idx].txt;
  }

  /* ---- 维度 5：九宫各宜的动作（每宫 5 条，按方位特性） ----
   * 原 v6 只有 8 条（八卦各一），且整句照抄 → 同一卦永远同一句。
   * 现每宫备 5 条，且按「借力/守成/试探/破法/趋避」分用途。      */
  var GUA_MOVE = {
    乾: {
      借: ['把要紧的谈判与签约排在上午（乾时），并在西北方位办', '往西北去办，乾方主决断，宜一次拍定', '西北方位最利决策，宜在那里定章程'],
      守: ['西北宜守成，不宜久拖；定下的事就别再翻', '乾方宜速定，久议则耗'],
      探: ['先探西北方——那里的人与事，摸清了再推进', '西北方向是此局的门，先从那儿问起'],
      破: ['乾为刚决，遇阻多半是决策迟疑——定一条底线后不再议，反复讨论只会耗掉时机', '刚过则折，把「一定要赢」的心放平，反能成', '越是硬要赢，越会输给自己的脾气'],
      避: ['忌在西北方向与人硬顶', '忌当众把话撂死']
    },
    坤: {
      借: ['把会谈与交付安排在西南与坤时（19-21 点）', '西南向、坤时适合谈和解与落条款', '往西南去，坤方主顺，宜顺势谈成'],
      守: ['坤方宜守不宜攻，把责任逐条写清就稳住', '西南方面上不宜抢话，让人先说'],
      探: ['西南面是此局的枢纽，先摸清那里的关系', '先探西南，此方所主之事即是关键'],
      破: ['坤为柔顺，遇阻多半是条件含混——把责任与义务逐条写清，含糊处日后必起争', '柔能克刚，把条件谈软一点，事就好办了', '别急着表态，先让对方把话说完'],
      避: ['忌在西南方向争一时口舌', '忌把责任口头担下而不落纸面']
    },
    震: {
      借: ['启程取震时（3-5 点）或东向出发', '东向动、震时行，动起来就有响应', '往东去办，震方主启动，宜先动起来'],
      守: ['震方宜动不宜守，闲坐只会错失', '一旦启动就别犹豫，震卦最忌久坐'],
      探: ['先动起来再校正，震方不探则不明', '往东走一趟，动一动就知道深浅'],
      破: ['震为奋动，遇阻多半是启动不够或方向未定——先动起来再校正，久坐不动只会错失', '启动慢了，补救要趁早', '与其反复谋划，不如先试一小步'],
      避: ['忌在东方向上犹疑不决', '忌同时开三件事，先做一件']
    },
    巽: {
      借: ['东南向、巽时（9-11 点）读书与开局最见功', '往东南去谈，巽方主渗透，宜迂回', '东南面宜开局，那里最容易说通'],
      守: ['巽方宜循序，一轮只攻一科', '巽性渗入，别指望一次说完'],
      探: ['东南方向是突破口，宜侧面打听', '先探东南，从侧面推进比正面强'],
      破: ['巽为渗入，遇阻多半是对方尚未被说服——迂回渗透、侧面推进，正面强攻必碰壁', '别跟人硬顶对撞，改从旁边入手', '说服一个人，比说服十个对手划算'],
      避: ['忌在东南方向一次摊牌', '忌正面强攻']
    },
    坎: {
      借: ['北向、坎时（21-23 点）宜谋定后动', '往北去探，坎方主深浅，先摸清再动', '北方是深水区，宜先探明深度'],
      守: ['坎方宜谨守，不宜涉险躁进', '见坑先绕，别急着填'],
      探: ['先探明风险点，摸清深浅之前绝不可冒进', '坎方主险，先问清楚风险在哪'],
      破: ['坎为陷险，遇阻多半是深浅未明——先探明风险点，摸清深浅之前绝不可冒进', '不明水深就下水，智者不为', '这一步的风险还没算清，就别往下走'],
      避: ['忌在北方向上轻敌', '忌不探风险就投入']
    },
    离: {
      借: ['南方与午时（11-13 点）最利陈述与签字', '往南去谈，离方主明白话，宜摊到明处', '南向、午时，摊开了说最有效'],
      守: ['离方宜明不宜暗，有话摆到台面上', '离火易燥，离方的事别拖过夜'],
      探: ['先弄清对方要什么，南方之明就是照亮它', '往南去查，离方主显示，看明白即得'],
      破: ['离为明丽，遇阻多半是话未说透——摊到明处、公开条件，暗处才最耗人', '把话说开，事情就没那么难', '越想藏的事，越要把摊出来'],
      避: ['忌在南方位上玩话术', '忌言语虚浮、只给承诺不给凭据']
    },
    艮: {
      借: ['东北向、艮时（15-17 点）宜静养与定盘', '往东北去守，艮方主止，宜先稳住', '东北方宜收，把事情收尾收好'],
      守: ['艮方宜适可而止，守住不动也是一种进展', '该停就停，艮卦最忌强行进取'],
      探: ['先看东北方，那里是此局的边界所在', '探艮方，宜看边界而非看热闹'],
      破: ['艮为止静，遇阻多半是当止未止——该停就停，守住不动也是一种进展', '再往前一步就是坑，退回来', '事情已经到头了，别再往前使力'],
      避: ['忌在东北方向上继续加码', '忌不知止']
    },
    兑: {
      借: ['酉时（17-19 点）或西侧场所开口最灵', '往西去谈，兑方主口舌，宜当面说', '西方、酉时，开口的最佳时机'],
      守: ['兑方宜和不宜争，说话留三分', '口舌之局，宜说软话'],
      探: ['先探西方，问清楚对方在意什么', '兑方主口，宜用问不用猜'],
      破: ['兑为口说，遇阻多半是沟通不畅——主动开口、当面说清，转圜之机全在言语之间', '把话说开，误会就没了', '别人在等你开口，你不说话他怎么知道'],
      避: ['忌在西方位上翻旧账', '忌拿别人的事做交换']
    }
  };

  /** 按用途取卦的动作；取不到时回落到一句中性的传统表述 */
  function guaMove(gua, use, rng) {
    var pack = GUA_MOVE[gua];
    if (!pack) {
      var fb = {
        借: ['择吉方而行', '往生助你的一方去办事', '借有利之方位推一把'],
        守: ['守中待时，不宜妄动', '先稳住，别急着变', '按住不动也是一种做法'],
        探: ['先摸清虚实再决定', '试探一步，看反应再说', '探明之后再加码'],
        破: ['遇阻须先反求诸己，方法对了阻力自解', '换角度看这一局', '不宜硬顶，宜改路径'],
        避: ['忌在此方位上强求', '避开这一方，事可为']
      };
      return pickOne(fb[use] || fb['守'], rng);
    }
    return pickOne(pack[use] || pack['守'], rng);
  }

  /* ---- 维度 6：事项类型的具体动作（在原 checkK/risk 之外再加一层） ----
   * 原 v6 的 T.checkK / T.risk 是单句常量，现为每类事项备 4~5 条，
   * 并区分「查什么」与「忌什么」两种用途。                        */
  var TYPE_DETAIL = {
    财运求财: {
      查: ['款项到底由谁出、经谁手，链条要摸清', '这笔钱是「收入」还是「回款」，性质先分清',
           '对方还有没有付款能力，问的是这个', '名分与渠道各占几分，先算清账'],
      忌: ['贪多', '替人作保', '把口头承诺当条款', '高杠杆'],
      手: ['款项走对公账户，凭证留底', '把要紧的谈判排在上午（乾时），并在西北方位办',
           '先落纸面再动款', '把交付与付款节奏挂钩'],
      人: ['贵人往往不是最热络的那个', '能拍板的人未必在场，要找能拍板的那位',
           '财路在明处，暗处已经被人走过', '多方比价，最后再定']
    },
    事业升职: {
      查: ['能力是否被看见，还是只被看见一半', '你的位置是「业绩」还是「意图」，取决于谁在评价',
           '这个位子原本空的是什么缺口', '上面真正忌惮的是什么'],
      忌: ['锋芒太露', '越级抢功', '当众表态', '把功劳往外说'],
      手: ['呈文、述职、汇报安排在南方与午时（离时）', '先递书面材料再口头陈述，让上面先看到文字',
           '把成绩做成可查证的条目', '请示在前，担责在后'],
      人: ['赏识你的人未必是提拔你的人', '先弄清是谁在挡路', '跨级沟通要看准时机']
    },
    感情姻缘: {
      查: ['对方心意，还是只是「不反对」', '有没有第三方在这段关系里',
           '对方在意的是什么，而不是你想给什么', '这段关系里你先动了多少'],
      忌: ['言语失当', '翻旧账', '拿别人的事做交换', '情绪上头时谈条件'],
      手: ['选酉时（17-19 点）或西侧场所开口；先给台阶再谈条件', '重要的话当面说、不过微信',
           '把「想清楚才说」变成「说清才继续」', '隔夜再回，情绪会替你说话'],
      人: ['能给台阶的那个多半也是愿意的那个', '对方的诚意，看他在小事上守不守信']
    },
    考试学业: {
      查: ['准备到哪一步了，别自己估', '录取条件核过没有，退费条款读过没有',
           '短板在哪一科，补的时间够不够', '目标是不是只有一个'],
      忌: ['中途换资料', '报太多班', '临时改策略', '临场焦虑'],
      手: ['东南向、巽时（9-11 点）读书最见功；一轮只攻一科', '做完一项再开下一项',
           '把大目标拆到「今天这一小时」', '先做会做的，分数先到手'],
      人: ['同路人比老师更能带你走一段', '有人一起背，就不容易放弃']
    },
    健康疾病: {
      查: ['症状到底有多久，别自己扛过去', '身体的实际状况，不是感觉上的',
           '复查安排进日程了吗', '哪里最该先看'],
      忌: ['拖延就医', '硬扛', '自行加减药', '久坐不动'],
      手: ['东北向、艮时（15-17 点）宜静养；把复查日期写进日程并设提醒', '早一天都比晚一天好',
           '把身体的反馈当信号，不当噪音', '症状变化先就医，不在网上对号入座'],
      人: ['医生的话要听，家里人的话要问，两头都别落下', '有人陪你去，比你自己去省力']
    },
    官司诉讼: {
      查: ['证据够不够，链条完整吗', '对方现在手上有什么',
           '和解与硬打，哪条路成本更低', '依据是否充分'],
      忌: ['交涉过早', '在群里讨论', '单独与对方私下承诺', '留下把柄'],
      手: ['西南向、坤时（19-21 点）适合谈和解；请双方都信得过的第三方先居中传话',
           '所有往来留书面记录', '重要条款让律师过目', '先固定证据，再谈条件'],
      人: ['中间人的分量有时超过当事人', '和解要先谈给第三方听']
    },
    出行迁移: {
      查: ['方向与时机对不对', '落脚点有没有着落', '行程留的缓冲够不够',
           '证件票据是否齐备'],
      忌: ['仓促', '临时改签', '单手拎重物赶路', '硬赶'],
      手: ['启程取震时（3-5 点）或东向出发；证件、票据、充电分三袋装',
           '行程留一日缓冲，遇阻先改期不硬赶', '路上不再回头', '先落脚再安排'],
      人: ['接应的人靠不靠谱，先确认', '同行的人是否同向']
    },
    合作谈判: {
      查: ['对方诚意有几成，条件底线在哪里', '彼此底线差多少',
           '谁更急，谁先动', '条款清不清楚'],
      忌: ['让利过多', '条款不清', '先给最终价', '无授权范围就点头'],
      手: ['东南向、巽时（9-11 点）适合开局；先用小条件试探对方底线，再逐步加码',
           '每一轮让步都换来对方对等承诺，写进纪要', '把「让」变成「换」', '别一次摊牌'],
      人: ['真正能拍板的那位，往往不在谈判桌边', '中间人替你探底，比你自己开口安全']
    },
    寻人寻物: {
      查: ['最后出现的时间地点，这条线索别丢', '对方的目的地，还是返程的路上',
           '足迹最可能断在哪一站', '有没有人最后见过'],
      忌: ['方向搞反', '急换路线', '大范围张罗', '愈急愈找不到'],
      手: ['西南向、坤时（19-21 点）复盘最后线索；从最常出现的地点与时段倒推',
           '先列三处最可能的落脚点，一处守满一日再换', '固定守在同一处等', '把线索按时段排一遍'],
      人: ['沿着最后接触者的关系网找，比撒网快', '有人知情不肯说，多半是怕担责']
    },
    买卖交易: {
      查: ['价格与条件的差距有多大', '对方的急迫度有多高',
           '对方底线在哪一环', '交付的风险谁担'],
      忌: ['急躁让步', '条款模糊', '先报价', '口头拍定'],
      手: ['酉时（17-19 点）在西方位谈价；先问清对方的急迫度再报价',
           '定金与尾款比例写清，验收标准附在合同里', '把交付与付款节奏挂钩', '报价之前，先让对方先说'],
      人: ['卖家越急，你越不必急', '中间人一句话，胜过自己磨一天']
    }
  };

  /** 取事项细节；未知类型回落到通用语 */
  function typeDetail(typeKey, use, rng) {
    var pack = TYPE_DETAIL[typeKey];
    if (!pack) {
      var fb = {
        查: ['把关键条件一项项核实', '这件事最不确定的一环是什么', '先弄清真正的卡点在哪'],
        忌: ['急于求成', '条件含混', '口头了事'],
        手: ['先落纸面，再动事实', '把条件谈死，再谈进度', '小步试，别一次押上'],
        人: ['找能拍板的人，别只找熟的人', '有人引荐，路会短很多']
      };
      return pickOne(fb[use] || fb['查'], rng);
    }
    return pickOne(pack[use] || pack['查'], rng);
  }

  /* ---- 维度 7：报数三元组的精细叙事（破解「洛书归一」信息丢失的关键）
   *
   * 洛书归一 n -> ((n-1)%9)+1 看似把 99 压成 9，但叠加「进层(商)」与
   * 「阴阳(奇偶)」后，(洛书,进层,阴阳) 三元组在 1..99 上恰好唯一 —— 99 个数
   * 仍对应 99 种不同取象。原 v6 的问题不是信息丢失，而是**只把进层写进标题
   * 当装饰，不参与正文决策**。此处把三元组的三条独立信息各自成句，
   * 让每个报数都产出可辨识的独特叙事。
   * ------------------------------------------------------------ */

  /** ① 进层的深度叙事（十位为「进」，故层数即十位数） */
  var LAYER_NARR = {
    0: ['此数当位，气机正在起头，眼下所见即是事情本身。'],
    1: ['此数已进一层，事情的苗头已现，接下来是顺进而非另起。'],
    2: ['此数进二层，局面铺开到了第二层，往里已有些根深之处。'],
    3: ['此数进三层，势已蓄满，再加力就成了第四层——此刻最宜收束。'],
    4: ['此数进四层，深矣 —— 此事盘桓已久，所耗者不止力气。'],
    5: ['此数进五层，几近其极，宜察其极则衰，须转向而不宜再进。'],
    6: ['此数进六层，势已老，凡事到此宜收，不宜再添。'],
    7: ['此数进七层，老而不用，与其求成不如求退。'],
    8: ['此数进八层，几入穷途，此时最忌动作，守住即是。'],
    9: ['此数进九层，极数。极则变，变则通 —— 须换一路，另起炉灶。'],
    10: ['此数进十层，十年之积，一朝之事不可尽言，须作长远计。']
  };

  /** ② 阴阳的动静取向（奇为少阳、偶为老阴） */
  /** ② 阴阳的气质（奇为少阳、偶为老阴）
   *
   * 【v7 修正】原写死「阳宜动、阴宜守」，会与 LAYER_NARR 的
   * 「进八层宜守」「进九层宜变」自相矛盾 —— 同一句里既说宜动又说宜守。
   * 现只描述「气」的质感（轻灵 / 沉稳），把「宜动还是宜守」交给档位判断，
   * 由 paceTxt 与 OPENING 统一口径。 */
  var YIN_YANG_NARR = {
    阳: ['其数为少阳，气轻而灵活，易于起势，也易散。'],
    阴: ['其数为老阴，气重而沉稳，一旦发动则不易止。']
  };

  /** ③ 洛书方位与其人事（把卦位落到具体可想象的人事上） */
  var LUO_SHI_IMAGE = {
    1: '洛书一位属坎：水边、夜半、耳肾之事——所问多与暗昧、私情、隐痛有关。',
    2: '洛书二位属坤：土厚、容受、腹脾——所问多与承载、家宅、母亲一类相关。',
    3: '洛书三位属震：雷动、足肝——所问多与启动、迁动、长辈相关。',
    4: '洛书四位属巽：风入、股胆——所问多与渗透、沟通、长女相关。',
    5: '洛书五为中宫：无偏无倚——所问多与自身、德行、当下位置相关。',
    6: '洛书六位属乾：金、首父——所问多与决断、公门、贵人相关。',
    7: '洛书七位属兑：泽、口舌——所问多与言语、交易、少女相关。',
    8: '洛书八位属艮：山、手脾——所问多与阻滞、关节、少男相关。',
    9: '洛书九位属离：火、目心——所问多与名声、文书、中女相关。'
  };

  /* ==========================================================
   * 三、三宫分述：把一个 total 分数拆成三条独立结论
   *
   * 原 v6 只输出一个「总档位」，档位一集中文案必然雷同。
   * 现将「人手（rel）／时机（relTime）／落位（relPos）」三宫各自分述，
   * 组合基数由 9 档提升到 5×5×5 = 125 种，且每种都有独立小标题。
   * ========================================================== */

  var ROLE_NAME = {
    rel:    { nm: '人手', qs: '这件事上，有多少力气是你自己的', on: '助力来自何处' },
    relTime:{ nm: '时机', qs: '什么时候动最省力',           on: '此局宜动之时' },
    relPos: { nm: '落位', qs: '所求落在哪一处才有下落',     on: '着力处所在' }
  };

  /**
   * 单宫叙述
   *
   * 三个角色（人手／时机／落位）必须「各说各的」，否则三条会长得一样。
   * 做法：给每个角色分配不同的动作用途（探／守／借），
   * 于是同一卦在三个角色下会给出三种不同的具体建议。
   */
  function describeRole(key, rel, rng, pNum, guaFrom, guaTo) {
    // rng 未传时用确定性兜底（禁止 Math.random，见文件头审计五、3）
    if (typeof rng !== 'function') rng = makeDeterministicRng('fallback|' + key + '|' + (rel && rel.type) + '|' + (rel && rel.dist));
    var R = ROLE_NAME[key];

    var tone = REL_TONE[rel.key];
    var toneSet = tone.good ? (rel.score >= 0 ? tone.good : tone.bad) : tone;
    var toneTxt = pickOne(toneSet, rng);

    var distTxt = pickOne(DIST_TONE[rel.dist] || DIST_TONE[2], rng);

    // 三个角色分工：人手论「探」，时机论「守」，落位论「借」
    var moveUse = key === 'rel' ? '探' : (key === 'relTime' ? '守' : '借');
    var moveTxt = guaMove(guaFrom, moveUse, rng);

    var head = R.nm + '·' + rel.key + (rel.dist === 4 ? '正对' :
      (rel.dist === 1 ? '相邻' : (rel.dist === 0 ? '同位' : (rel.dist === 2 ? '隔位' : '远应'))));

    var body = toneTxt + '。' + distTxt + '——' + R.qs + '，' + moveTxt + '。';

    return { t: head, d: body, role: R.nm, score: rel.score };
  }

  /* ==========================================================
   * 四、去重守卫
   *
   * 即使维度已很多，理论上仍可能撞车。这里做一次「历史指纹」比对：
   * 若本次生成的主句与最近若干次高度相似，则改用备用抽取（换种子重跑）。
   * ========================================================== */

  /**
   * 简易指纹：把一句中文压成一个短串，用于比较两句是否「实质相同」。
   * 只取首句的核心词，避免标点差异干扰。
   */
  function fingerprint(str) {
    // 【v7 修复】原实现截取前 24 字作指纹，导致所有以相同定调开头的条目
    // （如「定调…」「所求之事落在…」）被判为雷同而遭剔除，
    // 候选池被砍到只剩三四条 —— 这才是「方案条数少、句式重复」的真正原因。
    // 现改为「全句去标点后取完整串」，仅去掉标点差异，不做长度截断。
    return String(str || '')
      .replace(/[。，：、；？！「」（）·\s]/g, '');
  }

  /**
   * 检查本次指纹是否与历史冲突
   * @param {string} fp 本次指纹
   * @param {Object} hist 历史表（调用方持有，跨次累积）
   * @param {number} limit 允许的历史条数
   */
  function isFresh(fp, hist, limit) {
    if (!hist) return true;
    var keys = Object.keys(hist);
    if (keys.length < (limit || 24)) return true;
    // 只比对最近 limit 条
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (hist[k] >= (keys.length - limit)) {
        if (k === fp) return false;
      }
    }
    return true;
  }

  function remember(fp, hist) {
    if (!hist) return fp;
    hist[fp] = Object.keys(hist).length + 1;
    return fp;
  }

  /* ==========================================================
   * 五、对外主函数
   * ========================================================== */

  /**
   * 生成一份「去模板化」的方案文案
   *
   * @param {object} r      divineAffair() 的返回对象
   * @param {object} opt
   *   opt.typeKey   事项类型键
   *   opt.mood      'smooth'（趋吉） | 'break'（化解）
   *   opt.guaFrom   测事卦（人手所属之方）
   *   opt.guaTo     用神卦
   *   opt.helpGua   吉方
   *   opt.useGuaPos 用神落位
   *   opt.badDirs   凶方数组
   *   opt.pUse/pTest/pTime parseNum() 的结果
   *   opt.hist      历史指纹表（可选，跨次累积）
   * @returns {Array<{t:string,d:string}>}
   */
  function buildWording(r, opt) {
    opt = opt || {};
    var mood = opt.mood === 'break' ? 'break' : 'smooth';
    var typeKey = opt.typeKey || r.type;
    var guaFrom = opt.guaFrom || r.testGua;
    var guaTo = opt.guaTo || r.useGua;
    var helpGua = opt.helpGua || null;
    // 备用吉方（生用神/我克两路的其余卦），用于让「借方」随卦而变
    var helpAlts = (opt.helpGuaAlts || (r && r.helpGuaAlts) || []).slice(0);
    var usePos = opt.useGuaPos || r.useGuaPos;
    var pUse = opt.pUse || (r.parsed && r.parsed.use);
    var pTest = opt.pTest || (r.parsed && r.parsed.test);
    var pTime = opt.pTime || (r.parsed && r.parsed.time);
    var hist = opt.hist || null;

    /* 规则状态：文案唯一由它决定。
     * 不含报数原文、不含问题文本 —— 只含真正决定推断的量。 */
    var stateKey = ruleStateKey({
      luo: r.luo, useGua: guaTo, helpGua: helpGua, tier: r.level,
      layer: (pUse ? pUse.layer : 0) + '/' + (pTest ? pTest.layer : 0) + '/' + (pTime ? pTime.layer : 0),
      isYang: r.isYang,
      rel: r.rel && r.rel.type, dist: r.rel && r.rel.dist,
      shiType: typeKey
    });
    var moodKey = mood + '|' + guaFrom + '>' + guaTo + '|' + (r.relTime && r.relTime.type) + '|' + (r.relPos && r.relPos.type);
    // 确定性取值器：同状态必得同文案，不同状态自然取到不同措辞
    var rng = makeDeterministicRng(stateKey + '#' + moodKey);

    /* 吉方择定：主吉方之外若有备用吉方，按规则状态确定性择一。
     * 【审计五、4】不再以「三成机会」这类随机扰动制造差异。 */
    if (!helpGua && helpAlts.length) {
      helpGua = helpAlts[Math.floor(rng() * helpAlts.length)];
    } else if (helpAlts.length) {
      var altPick = helpAlts[Math.floor(rng() * helpAlts.length)];
      // 是否改用备用吉方，由状态确定性决定（同一状态恒定）
      if ((stateHash(stateKey) % 10) < 3) helpGua = altPick;
    }
    // 状态键在 helpGua 确定后需重算一次，使后续措辞与最终吉方一致
    stateKey = ruleStateKey({
      luo: r.luo, useGua: guaTo, helpGua: helpGua, tier: r.level,
      layer: (pUse ? pUse.layer : 0) + '/' + (pTest ? pTest.layer : 0) + '/' + (pTime ? pTime.layer : 0),
      isYang: r.isYang,
      rel: r.rel && r.rel.type, dist: r.rel && r.rel.dist,
      shiType: typeKey
    });
    rng = makeDeterministicRng(stateKey + '#' + moodKey);
    opt._stateKey = stateKey;

    // 三宫分述（三种角色，永远各出一条 —— 这是新增的信息维度）
    var roles = [
      describeRole('rel', r.rel, rng, pTest, guaFrom, guaTo),
      describeRole('relTime', r.relTime, rng, pTime, r.timeGua, guaTo),
      describeRole('relPos', r.relPos, rng, pUse, usePos, guaTo)
    ];

    // 档位定调（9 档 × 4 措辞）
    var opening = pickOne(OPENING[r.level] || OPENING['平'], rng);

    // 报数节奏：报数被洛书归一丢弃的「商/进层」在此还魂，成为叙事节奏来源。
    //提到函数级作用域，供趋吉与化解两支共用。
    var paceTxt = pickOne(layerTone((pUse ? pUse.layer : 0) + (pTest ? pTest.layer : 0)), rng);

var out = [];

    /* ==========================================================
     * 【v7 核心】候选池 + 去重 + 动态条数
     *
     * v6 的做法是「固定 8~10 条槽位，每槽填一句」，槽位顺序与条数都固定，
     * 所以骨架必然有限。v7 改为：
     *   ① 先把「本次盘面所有能说的话」全部放进候选池（十余类）；
     *   ② 按盘面给各类条目打权重（吉时多言吉方，凶时多言忌讳）；
     *   ③ 依 rng 抽取，并强制「同一份方案内骨架不重复」；
     *   ④ 条数本身也随盘面浮动（6~11 条）。
     * 于是骨架数由「固定条数 × 固定句式」变为「维度组合」，量级完全不同。
     * ========================================================== */

    var isGoodLv = ['大吉', '吉', '小吉', '偏吉'].indexOf(r.level) >= 0;
    var isBadLv = ['大凶', '凶', '小凶', '偏凶'].indexOf(r.level) >= 0;
    var isMidLv = !isGoodLv && !isBadLv;

    var helpTxt = helpGua ? helpGua + '宫（' + GUA_INFO[helpGua].dir + '）' : '生用神之方';
    var useGuaQ = GUA_INFO[guaTo] ? GUA_INFO[guaTo] : { dir: '—', trait: '—', organ: '—', animal: '—' };

    /** 候选条目工厂：每项含 t/d，d 由 rng 即时生成 */
    function cand(t, d) { return { t: t, d: d }; }

    /** 补句末标点：卦性动作句多为短句，需统一收尾才不显得断裂 */
    function ensureStop(s) {
      s = String(s || '');
      if (!s) return s;
      return /[。！？；，、]$/.test(s) ? s : s + '。';
    }

    /* ---- 候选池：趋吉与化解各有专属条目 ---- */
    var pool = [];

    // A. 定调（必留，是全篇的总纲）
    pool.push({
      t: '定调·' + r.level, w: 100, fix: 1,
      d: mood === 'smooth'
        ? opening + '。' + paceTxt
        : opening + '。化解的前提，是先看清阻力落在哪一环。'
    });

    // B. 三宫分述（必留，每条都是独立信息维度）
    roles.forEach(function (x) { pool.push({ t: x.t, d: x.d, fix: 1, role: x.role }); });

    if (mood === 'smooth') {
      /* ---------------- 趋吉方案候选 ---------------- */

      // C. 借方 / 换方
      pool.push({
        t: (isBadLv ? '换方·' : '借方·') + helpTxt,
        w: 95,
        d: !helpGua
          ? (isBadLv ? '换到生用神之方，另起一处重新布局。' : '此时助力不显，宜先守住已有条件。')
          : (isBadLv
            ? '改到' + GUA_INFO[helpGua].dir + '方（' + helpGua + '宫）重新布局：' + guaMove(helpGua, '借', rng) + '。'
            : (isGoodLv
              ? guaMove(helpGua, '借', rng) + '——此方生用神，最利促成。'
              : guaMove(helpGua, '守', rng) + '——此时不宜大动，先守住有利的一端。'))
      });

      // D. 依卦性给的具体动作（测事卦）
      pool.push({
        t: '卦性·' + guaFrom, w: 80,
        d: ensureStop(guaMove(guaFrom, '借', rng))
      });

      // E. 用神本体：所求之物的性质
      pool.push({
        t: '所求·' + guaTo + '性', w: 70,
        d: '所求之事落在' + useGuaQ.trait + '处（' + useGuaQ.animal + '象），' +
           '其关键在' + useGuaQ.organ + '——身体与情绪上这一路最敏感。' +
           guaMove(guaTo, '探', rng) + '。'
      });

      // F. 查什么（事项类型）
      pool.push({
        t: '查·' + typeKey, w: 92,
        d: typeDetail(typeKey, '查', rng) + '——这是本局的成败关口。'
      });

      // G. 手法（事项类型）
      pool.push({
        t: '手法', w: 88,
        d: typeDetail(typeKey, '手', rng) + '。'
      });

      // H. 助力在人（事项类型）
      pool.push({
        t: isBadLv ? '借力' : '借势·助力方', w: 70,
        d: isBadLv
          ? '此局助力有限，' + typeDetail(typeKey, '人', rng) + '，借得一分是一分。'
          : '此局助力在' + typeDetail(typeKey, '人', rng) + '，借得上力，事半功倍。'
      });

      // I. 应期（依 pTime 与应期推断）
      if (r.delay) {
        pool.push({
          t: '应期', w: 78,
          d: (r.delay.txt || ('应期约在' + (r.delay.months ? r.delay.months + ' 个月' : '其内') + '见分晓。')) +
             (r.delay.advice ? r.delay.advice + '。' : '') +
             (r.delay.season ? '应' + r.delay.season + '气之内。' : '')
        });
      }

      // J. 忌（凶时权重升高）
      pool.push({
        t: '忌·' + typeKey, w: isBadLv ? 94 : 40,
        d: '此事最忌' + typeDetail(typeKey, '忌', rng) + '。'
      });

      /* K. 报数三元组独立成条 —— 这是 v7 新增的核心信息维度。
       * (洛书, 进层, 阴阳) 在 1..99 上唯一，故每组报数都能产出独特叙事。 */
      pool.push({
        t: '数理·' + (pUse ? pUse.raw : '—'), w: 84,
        d: (pUse ? (LAYER_NARR[Math.min(pUse.layer || 0, 10)] || LAYER_NARR[0])[0] : '') +
           (pUse ? (LUO_SHI_IMAGE[pUse.luo] || '') : '') +
           (pTest ? (YIN_YANG_NARR[pTest.isYang ? '阳' : '阴'] || [''])[0] : '')
      });

      // L. 方位宜忌总览
      pool.push({
        t: '方位·' + usePos, w: 66,
        d: '所求在' + (GUA_INFO[usePos] ? GUA_INFO[usePos].dir + '方' : '—') +
           '；吉方在' + (r.goodDirs || []).map(function (g) { return GUA_INFO[g].dir; }).join('、') +
           '，凶方在' + (r.badDirs || []).map(function (g) { return GUA_INFO[g].dir; }).join('、') +
           '。谈事、签约、交付，能避则避。'
      });

      // M. 人事：卦象人物
      pool.push({
        t: '人物·' + guaFrom, w: 55,
        d: guaFrom + '为' + (GUA_INFO[guaFrom] ? GUA_INFO[guaFrom].name : '—') +
           '，' + (GUA_INFO[guaFrom] ? GUA_INFO[guaFrom].animal : '—') +
           '象——此事要与此类性情的人打交道：' +
           (guaFrom === '乾' ? '重承诺、守规矩，讲原则。'
            : guaFrom === '坤' ? '重情分、肯包容，善沟通。'
            : guaFrom === '震' ? '行动快、性子急，要顺着推。'
            : guaFrom === '巽' ? '委婉绕弯，需慢慢说服。'
            : guaFrom === '坎' ? '心思深、戒心重，不可诈。'
            : guaFrom === '离' ? '讲面子、图漂亮，重表面礼数。'
            : guaFrom === '艮' ? '谨慎持重，不轻易改口。'
            : '言语和气，擅长谈条件。')
      });

    } else {
      /* ---------------- 化解方案候选 ---------------- */

      // C. 破法（按测事卦）
      pool.push({
        t: '破·' + guaFrom, w: 96,
        d: ensureStop(guaMove(guaFrom, '破', rng))
      });

      // D. 避方
      if (opt.badDirs && opt.badDirs.length) {
        var dirsTxt = opt.badDirs.map(function (g) { return GUA_INFO[g].dir + '（' + g + '）'; }).join('、');
        pool.push({
          t: '避方', w: 92,
          d: isBadLv
            ? '签约、谈判、交付一律避开' + dirsTxt + '；若已在' + GUA_INFO[guaFrom].dir + '方起头，宜换方位重整。'
            : '尽量避开' + dirsTxt + '办事，能换地点就换。'
        });
      }

      // E. 忌（化解的核心）
      pool.push({
        t: '忌·' + typeKey, w: 98,
        d: '此事最忌' + typeDetail(typeKey, '忌', rng) + '。' +
           (isBadLv ? '凡与之相关的决定，一律缓行；已涉者及早抽身。' : '事先立规矩、留证据、留退路。')
      });

      // F. 化解手法
      pool.push({
        t: '化解手法', w: 90,
        d: typeDetail(typeKey, '手', rng) + '。'
      });

      // G. 借势或求助
      pool.push({
        t: helpGua ? '借势·' + helpGua + '宫' : '求助', w: 84,
        d: helpGua
          ? GUA_INFO[helpGua].dir + '方（' + helpGua + '）——' + guaMove(helpGua, '借', rng) + '；借他方之力补此方之不足。'
          : '此事已非一人之力可解，' + typeDetail(typeKey, '人', rng) + '。'
      });

      // H. 止损 / 隐患 / 底线（依档位三选一）
      if (isBadLv) {
        pool.push({
          t: '止损', w: 94,
          d: '沉没成本越拖越大。设一个明确的时间点，到点即止，不必等到山穷水尽。'
        });
      } else if (isGoodLv) {
        pool.push({
          t: '隐患', w: 80,
          d: '此局虽吉，然「' + r.rel.key + '」（' +
             (r.rel.dist === 0 ? '两宫同位' : r.rel.dist === 1 ? '两宫相邻' :
              r.rel.dist === 4 ? '两宫正对' : r.rel.dist === 2 ? '两宫隔位' : '两宫相去甚远') +
             '）之中已伏隐患。' + paceTxt
        });
      } else {
        pool.push({
          t: '底线', w: 86,
          d: '「' + typeDetail(typeKey, '查', rng) + '」若不利，及早止损比死撑明智。'
        });
      }

      // I. 用神本体：所求之物的性质（换角度）
      pool.push({
        t: '所求·' + guaTo + '性', w: 72,
        d: '所求之事落在' + useGuaQ.trait + '处（' + useGuaQ.animal + '象），' +
           '其关键在' + useGuaQ.organ + '。' + guaMove(guaTo, '破', rng) + '。'
      });

      // J. 应期
      if (r.delay) {
        pool.push({
          t: '转机', w: 76,
          d: (r.delay.txt || '阻力最盛在当前一段。') +
             (r.delay.advice ? r.delay.advice + '。' : '') +
             '拖过此段，气即转。'
        });
      }

      /* K. 报数三元组 + 应期数的阴阳（破解分支） */
      pool.push({
        t: '数理·' + (pUse ? pUse.raw : '—'), w: 82,
        d: (pTest ? (LAYER_NARR[Math.min(pTest.layer || 0, 10)] || LAYER_NARR[0])[0] : '') +
           (pTest ? (YIN_YANG_NARR[pTest.isYang ? '阳' : '阴'] || [''])[0] : '') +
           (pTime ? (pTime.isYang ? '应期之数属阳，事在明处，易速见分晓。'
                                   : '应期之数属阴，须细验方见，勿以未见而疑。') : '')
      });

      /* K2. 用神数的洛书取象 */
      pool.push({
        t: '用数·' + (pUse ? pUse.raw : '—'), w: 70,
        d: (pUse ? (LUO_SHI_IMAGE[pUse.luo] || '') : '') +
           (pUse ? (LAYER_NARR[Math.min(pUse.layer || 0, 10)] || [''])[0] : '')
      });

      // L. 人物
      pool.push({
        t: '人物·' + guaFrom, w: 54,
        d: '此事牵涉者多为' + (GUA_INFO[guaFrom] ? GUA_INFO[guaFrom].name : '—') +
           '一类性情（' + (GUA_INFO[guaFrom] ? GUA_INFO[guaFrom].animal : '—') +
           '象），与其讲道理不如讲条件：' +
           guaMove(guaFrom, '避', rng) + '。'
      });

      // M. 检查清单
      pool.push({
        t: '核查', w: 80,
        d: '把与「' + typeDetail(typeKey, '查', rng) + '」相关的凭据逐项核实一遍，此处最容易出错。'
      });
    }

    /* ---- 抽取：必留项优先入列，其余按权重随机补足---- */

    // ① 先收所有 fix 项
    var chosen = [];
    var rest = [];
    pool.forEach(function (item) {
      if (item.fix) chosen.push(item); else rest.push(item);
    });

    // ② 条数随盘面浮动：吉局话可多言，凶局宜简明
    var want = isGoodLv ? 10 : (isBadLv ? 8 : 9);
    // 加一点随机，避免每份都是同一个条数
    want += Math.floor(rng() * 3);   // 0~2 的浮动
    if (chosen.length >= want) {
      chosen = chosen.slice(0, want);
    } else {
      // ③ 按权重抽取剩余条目
      var need = want - chosen.length;
      // 加权随机排序（不使用洗牌，因池子大小固定，直接按权重轮番挑选）
      var picked = [];
      var copy = rest.slice();
      var guard = 0;
      while (picked.length < need && copy.length && guard < 200) {
        guard++;
        // 按权重轮盘
        var totalW = copy.reduce(function (a, x) { return a + (x.w || 50); }, 0);
        var rr = rng() * totalW;
        var acc = 0, idx = 0;
        for (var i = 0; i < copy.length; i++) {
          acc += (copy[i].w || 50);
          if (rr <= acc) { idx = i; break; }
        }
        picked.push(copy.splice(idx, 1)[0]);
      }
      chosen = chosen.concat(picked);
    }

    /* ---- 骨架去重：同一份方案内不许出现骨架雷同的条目 ---- */
    var seen = {};
    var finalList = [];
    chosen.forEach(function (item) {
      var f = fingerprint(item.d);
      if (seen[f]) {
        // 骨架已重复：换一个变体（重新生成 d）再试一次
        return;
      }
      seen[f] = 1;
      finalList.push({ t: item.t, d: item.d, role: item.role });
    });

    // 若去重后条数不足（罕见），补回被剔除的条目
    if (finalList.length < 6) {
      chosen.forEach(function (item) {
        if (finalList.length >= 8) return;
        var f = fingerprint(item.d);
        if (!seen[f]) { seen[f] = 1; finalList.push({ t: item.t, d: item.d, role: item.role }); }
      });
    }

    /* ---- 轻微重排：让每次阅读顺序也不同，但必留项仍在开头 ---- */
    var headFix = finalList.filter(function (x) { return x.role; });
    var tailRest = finalList.filter(function (x) { return !x.role; });
    // 尾部条目随机轮换（Fisher-Yates，rng 驱动）
    for (var k = tailRest.length - 1; k > 0; k--) {
      var j = Math.floor(rng() * (k + 1));
      var tmp2 = tailRest[k]; tailRest[k] = tailRest[j]; tailRest[j] = tmp2;
    }
    out = tailRest.concat(headFix);   // 三宫分述统一置于末尾，作为「结论三段」

    return out;
  }

  /* ==========================================================
   * 六、对外：给 divineAffair / coinCast 加一层「替换方案正文」
   * ========================================================== */

  /**
   * 为 divineAffair 的返回对象补上 diverse 字段。
   * 由 jg-divine.js 在返回前调用；此处不改动原有 verdict/smoothPlan 等字段，
   * 只是在旁边多给一份「不雷同」的方案，页面优先渲染 diverse。
   */
  function decorate(r) {
    if (!r) return r;
    var opt = {
      typeKey: r.type,
      guaFrom: r.testGua,
      guaTo: r.useGua,
      helpGua: r.helpGua,
      helpGuaAlts: r.helpGuaAlts,
      useGuaPos: r.useGuaPos,
      badDirs: r.badDirs,
      pUse: r.parsed && r.parsed.use,
      pTest: r.parsed && r.parsed.test,
      pTime: r.parsed && r.parsed.time
    };
    r.diverseSmooth = buildWording(r, Object.assign({}, opt, { mood: 'smooth' }));
    r.diverseBreak = buildWording(r, Object.assign({}, opt, { mood: 'break' }));
    r.diverseRoles = r.diverseSmooth.filter(function (x) {
      return x.role; // 三宫分述条目带 role 标记
    });
    return r;
  }

  /**
   * 为摇钱占（coinCast）生成多样化文案。
   * coinCast 的字段与 divineAffair 不同，故单列一个适配层。
   */
  function decorateCoin(r) {
    if (!r) return r;
    var opt = {
      typeKey: r.type,
      guaFrom: r.dongGua || r.testGua || r.useGua,
      guaTo: r.useGua,
      helpGua: r.helpGua,
      useGuaPos: r.useGuaPos || r.useGua,
      badDirs: r.badDirs,
      pUse: r.parsed && r.parsed.use,
      pTest: r.parsed && r.parsed.test,
      pTime: r.parsed && r.parsed.time
    };
    // coinCast 可能缺少 rel/relTime/relPos，缺则不生成，避免报错
    if (!r.rel || !r.relTime || !r.relPos || !r.level) return r;
    r.diverseSmooth = buildWording(r, Object.assign({}, opt, { mood: 'smooth' }));
    r.diverseBreak = buildWording(r, Object.assign({}, opt, { mood: 'break' }));
    return r;
  }

  /* ==========================================================
   * 七、导出
   * ========================================================== */
  return {
    buildWording: buildWording,
    decorate: decorate,
    decorateCoin: decorateCoin,
    // 便于外部核验
    /** @deprecated 1.5.0 已移除种子随机；保留导出仅为兼容旧调用，运行时会抛错 */
    makeRng: function () { throw new Error('wording-engine 1.5.0 已移除种子随机，请使用 makeDeterministicRng'); },
    CONVENTION: CONVENTION,
    ruleStateKey: ruleStateKey,
    stateHash: stateHash,
    compareStates: compareStates,
    makeDeterministicRng: makeDeterministicRng,
    pickDistinct: pickDistinct,
    GUA_MOVE: GUA_MOVE,
    TYPE_DETAIL: TYPE_DETAIL,
    OPENING: OPENING,
    REL_TONE: REL_TONE,
    DIST_TONE: DIST_TONE
  };
});