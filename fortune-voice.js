/* ============================================================
 * fortune-voice.js —— 运势文案表达层（1.8.2 新增）
 *
 * 【要解决的问题】
 * 用户实测反馈：「运势功能中如何此时都是这种雷同甚至一模一样的测算结果」。
 * 截图实证：同一四维（财运 31/63/45/50、事业 48/70/42、健康 56/60/55/67）
 * 四张卡片分数各异，但正文骨架高度雷同，健康运三张几乎逐句相同。
 *
 * 【根因分析】
 * 原实现把「事实 → 文本」直接硬编码在 if 分支里，例如：
 *     healthText = `今日${dayGanWx}气${level}，${desc}。`;
 *     healthText += `留意${todayOrgan}之所属脏腑。`;
 * 句式是**固定模板**，变量只替换数字。
 * 于是无论当天推演如何变化，读起来永远是同样的 4 句话。
 *
 * 【1.8.2 的解法】
 * 借鉴 1.4.0 已验证成功的「要素矩阵 + 候选池 + 加权抽取」思路：
 *   1. 上层（bazi-core）只负责算出**事实**，不再拼接句子；
 *   2. 本模块把事实映射到「表达意图」，每个意图备有多套措辞；
 *   3. 由「日期 + 生辰」派生的确定性种子做加权抽取，同输入同输出、
 *      不同日期必换措辞（与 1.4.0 的 mulberry32 方案一致）。
 *
 * 这样「分数变了」之外，**措辞骨架也会变**，
 * 从根本上消除「只换数字不换说法」的雷同感。
 * ============================================================ */
(function (root) {
  'use strict';

  /* ---------- 确定性伪随机（同输入必得同输出） ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** FNV-1a：把任意字符串压成 32 位种子 */
  function hashStr(s) {
    let h = 2166136261;
    const str = String(s == null ? '' : s);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /**
   * 从候选池中抽取一条。
   * @param pool  候选字符串数组
   * @param seed  种子（同一 seed 必得同一条，保证可复现）
   * @param tag   用途标签（参与哈希，使不同维度的抽取互不相关）
   */
  function pick(pool, seed, tag) {
    if (!pool || !pool.length) return '';
    if (pool.length === 1) return pool[0];
    const rnd = mulberry32((hashStr(tag) ^ seed) >>> 0);
    return pool[Math.floor(rnd() * pool.length) % pool.length];
  }

  /* ============================================================
   * 表达意图库
   * 每个维度按「档位 × 事实类型」组织多套措辞。
   * 档位分四档（低/中/平/高），确保不同分数段用不同句式，
   * 而不只是同一句式里换个数字。
   * ============================================================ */

  /** 分数 → 档位名 */
  function band(score) {
    if (score >= 72) return 'high';
    if (score >= 58) return 'above';
    if (score >= 45) return 'mid';
    if (score >= 32) return 'below';
    return 'low';
  }

  /* ---------- 财运 ---------- */
  const WEALTH = {
    /* 开场：十神定调 */
    open: {
      '比劫': [
        '今日天干{gan}，为你{me}日主之「比肩」。同我者众，主竞争与分夺，财路上易被人分薄。',
        '天干{gan}临日，为{me}日主的比肩。同类相逢，财气因人分，今日得财须防同行相扰。',
        '{gan}当值于日柱天干，属比肩之象。财非独享之业，今日之利多在「合」而不在「独占」。'
      ],
      '劫财': [
        '今日天干{gan}，为你{me}日主之「劫财」。劫主耗散，财来易去，忌代人出头、忌为人作保。',
        '{gan}临日见劫财。劫财当值，最易破财于「代」与「借」，今日借贷、担保皆宜三思。',
        '日干见{gan}，为劫财之象。财有被夺之机，凡涉他人之财（借出、合股、代垫）皆慎。'
      ],
      '食神': [
        '今日天干{gan}，为你{me}日主之「食神」。食神生财，技能与表达可换钱，是出手之日。',
        '{gan}临日为食神。食神吐秀，靠本事吃饭的机会今日最开，适合把长处换成价钱。',
        '日干得{gan}食神。财从「生」而来而非「求」而来，今日宜以作品、技艺、口碑取财。'
      ],
      '伤官': [
        '今日天干{gan}，为你{me}日主之「伤官」。伤官生财，思路张扬见新机，但锋芒太露易生是非。',
        '{gan}临日见伤官。财气在「破旧立新」中，机会与争议同来，说话留三分可免祸端。',
        '日干见{gan}伤官。今日求财宜巧取不宜硬取，灵活变通则得，逞强争执则失。'
      ],
      '正财': [
        '今日天干{gan}，为你{me}日主之「正财」。财星当值，主正途之财，收入稳健可积。',
        '{gan}临日为正财。正财主稳定积累，今日之利不在暴，而在「可持续」，宜做长期账。',
        '日干得{gan}正财。踏实收入是今日主线，忌贪快涉险，稳中求增为上。'
      ],
      '偏财': [
        '今日天干{gan}，为你{me}日主之「偏财」。偏财主意外之利与人缘财，宜广结善缘。',
        '{gan}当值见偏财。财自「人」来而非自「业」来，今日贵人相助可成意外之获。',
        '日干见{gan}偏财。机会偏于场外、偏于临时，灵活者能取，迟钝者错过。'
      ],
      '正官': [
        '今日天干{gan}，为你{me}日主之「正官」。官星主俸禄与规矩，财在职位与本分之中。',
        '{gan}临日见正官。财由「名分」而生，守规矩者今日得利，逾矩者反受其害。',
        '日干得{gan}正官。今日求财宜循正途，稳职、增薪、正当交易为吉。'
      ],
      '七杀': [
        '今日天干{gan}，为你{me}日主之「七杀」。杀星主压力与竞争，财在险中求得。',
        '{gan}当值见七杀。压力即动力，今日宜在紧迫处出手，过于安逸反无功。',
        '日干见{gan}七杀。财与险同来，敢承担者得其利，畏缩者失其机。'
      ],
      '正印': [
        '今日天干{gan}，为你{me}日主之「正印」。印星主庇护与学习，财不急，先充份再谈利。',
        '{gan}临日见正印。印气生身而身不生财，今日宜invest 在知识与资历上，财自后至。',
        '日干得{gan}正印。财路偏「先难后易」，今日打底子，明日见效。'
      ],
      '偏印': [
        '今日天干{gan}，为你{me}日主之「偏印」。偏印主偏门thinking，今日宜冷门处求财。',
        '{gan}当值见偏印。财自非常规途径来，嗅觉灵敏者得，盲从者失。',
        '日干见{gan}偏印。机会偏门而隐蔽，今日宜独辟蹊径，随大流者无功。'
      ]
    },
    /* 中段：旺衰与喜忌 */
    tone: {
      high: [
        '{wx}气当令有力，得天时之助，今日谋事顺行。',
        '{wx}当值而气盛，形势站在你这一边，宜果断出手。',
        '天时于你有利（{wx}旺），今日所行阻力小。'
      ],
      above: [
        '{wx}气尚有力，虽非大顺，但推得动、做得成。',
        '{wx}偏旺，得力而不费力，今日可小步推进。',
        '天时小助（{wx}有力），成事不难，只在细节。'
      ],
      mid: [
        '{wx}气平平，既不助也不损，今日全看人为。',
        '{wx}不旺不衰，正是「事在人为」之日，布局胜过冲刺。',
        '天时中性（{wx}平常），今日的成果取决于你投入多少。'
      ],
      below: [
        '{wx}气偏弱，力量不显，今日求财须借他人之力、循序而成。',
        '{wx}失令而气弱，独力难支，宜合作、宜借势，不宜孤军。',
        '天时于你不利（{wx}弱），勉强推进则费力，先养后攻。'
      ],
      low: [
        '{wx}气衰败，今日诸事耗神，强求无益，宜守宜退。',
        '{wx}最弱（{level}），力有不逮，硬撑只会伤本，暂避锋芒为上。',
        '天时最不利于你（{wx}{level}），今日不宜大额投入与冒险。'
      ]
    },
    /* 收尾：时段与先天 */
    tail: [
      '时柱{houShen}，{houZhi}属{houWx}，{houJudge}；结果如何，看你如何收尾。',
      '再看时柱：{houGan}{houZhi}，{houDesc}，末后之事由此定调。',
      '时柱一关最见真章——{houShen}临时，{houJudge}。'
    ]
  };

  /* ---------- 事业 ---------- */
  const CAREER = {
    open: {
      '官杀': [
        '事业上，今日重心在「{shishen}」之象。责任压肩，也正是立功的机会。',
        '日干见{shishen}，今日事业的主线是「担责」。扛得住便是位置，扛不住便是负担。',
        '{shishen}当值，职场今日偏向「高压位」，宜主动领任务，勿等派工。'
      ],
      '印星': [
        '事业上，今日重心在「{shishen}」之象。文书、资格、学习是今日关键词。',
        '日干得{shishen}，今日事业之利在「积累」而非「冲刺」，进修与背书最划算。',
        '{shishen}临日，上级缘与靠山之力较显，今日宜请教、宜汇报、宜备资历。'
      ],
      '食伤': [
        '事业上，今日重心在「{shishen}」之象。才华与表达是今日最值钱的资产。',
        '日干见{shishen}，创意与输出今日见长，适合提案、谈判与开创性工作。',
        '{shishen}当值，今日宜「把想法变成东西」，空谈无益，落地为要。'
      ],
      '比劫': [
        '事业上，今日重心在「{shishen}」之象。人脉与协作是今日的胜负手。',
        '日干得{shishen}，职场今日易有竞争与分功，忌争一时之名。',
        '{shishen}临日，团队关系是今日主线，退一步反而站得稳。'
      ],
      '财星': [
        '事业上，今日重心在「{shishen}」之象。资源与业务是今日的焦点。',
        '日干见{shishen}，今日适合拓业务、谈合作、争取资源与预算。',
        '{shishen}当值，业绩与变现能力受检，今日宜主动出击。'
      ]
    },
    tail: [
      '事之落点在时柱：{houShen}，{houJudge}。',
      '再看时柱——{houGan}{houZhi}，{houDesc}。',
      '时柱定终局：{houShen}临时，{houJudge}。'
    ]
  };

  /* ---------- 健康 ---------- */
  const HEALTH = {
    open: {
      '旺': [
        '{wx}气当令而旺，{organ}之气偏亢，今日身体是「有余」而非「不足」。',
        '五行为{level}：{wx}盛而{keTarget}受制，{keOrgan}今日最需留意。',
        '当日{level}，{wx}气充足。精力有余但易过亢，{keOrgan}首当其冲。',
        '五行为{level}，{wx}当权。{organ}气满则易溢，今日宜疏不宜补。',
        '当日{level}：{wx}势头正盛，体力是今日的长处，别用在熬夜上。',
        '{wx}气极旺（{level}），{keOrgan}受挤，按摩与拉伸比进补更合适。',
        '五行为{level}，{wx}当令。精神饱满，但要防「太过」——今日最忌过度消耗。',
        '当日{level}，{wx}力足。{organ}虽旺，久用则伤，宜给身体留余裕。',
        '{wx}逢{level}，全身气机偏上行。{keOrgan}是最先喊累的地方，提前照顾它。'
      ],
      '相': [
        '{wx}气得令而相，{organ}之气尚可，状态稳中带旺。',
        '当日五行为{level}，{wx}有力，{organ}运转尚顺，宜适度而勿过劳。',
        '{level}之时，{wx}能生{keTarget}，身体尚可，{keOrgan}留意即可。',
        '五行为{level}，{wx}得位。状态平稳，是可以正常推进的一天。',
        '当日{level}，{wx}气顺。{organ}得其养，做事有底气，别浪费这份好状态。',
        '{wx}得{level}，身体回气较快。今日可以安排稍重的活动。',
        '五行为{level}：{wx}能任事，{organ}不拖后腿，适度进补是加分项。',
        '当日{level}，整体气血平和。{keOrgan}只需日常留意，不必特别紧张。',
        '{wx}气在{level}，属「能扛」的一天，累一点也恢复得快。'
      ],
      '休': [
        '{wx}气休而和，{organ}得养，身体处于「养而不振」的状态。',
        '当日五行为{level}，{wx}退居其次，{organ}安稳，勿指望今日有超常表现。',
        '{level}，{wx}不旺不克，{organ}平和，适合轻养而非强练。',
        '五行为{level}，{wx}休养。身体在「存电」模式，今日宜静养。',
        '当日{level}：{wx}力不显，{organ}平稳，做事不求快。',
        '{wx}处{level}，气血略缓。今日适合整理、规划，不适合硬拼。',
        '五行为{level}，{wx}与命局相安。{keOrgan}无大碍，按平常作息即可。',
        '当日{level}，身体处于「平轨」状态。维持现状就是今日最优。',
        '{wx}气{level}，身心都算平稳。若要做事，挑轻的做就顺。'
      ],
      '囚': [
        '{wx}气受囚而制，{organ}之气被困，疲乏感今日较明显。',
        '当日五行为{level}：{wx}被压，{organ}失养，倦怠是常态。',
        '{level}之时，身体如被围住，力气使不出，{keOrgan}最需温养。',
        '五行为{level}，{wx}受困。今日做什么都提不起劲，这不是懒，是气机被压。',
        '当日{level}，{organ}气机不畅，容易闷、容易堵，宜动宜通不宜静。',
        '{wx}遭{level}，体能偏低。{keOrgan}是薄弱环节，饮食宜温。',
        '五行为{level}：{wx}被束，{organ}缺养。今日最忌硬撑与熬夜。',
        '当日{level}，气力不济。把标准降一档，事半功倍。',
        '{wx}气{level}，身心俱沉。若必须做事，务必留足时间与余地。'
      ],
      '死': [
        '{wx}气死而最弱，{organ}之气将绝，今日宜静养，忌强撑。',
        '当日五行为{level}，{wx}最衰，{organ}告警，作息与饮食都要松一松。',
        '{level}，全身气机皆缓。今日最忌透支，{keOrgan}尤须留意。',
        '五行为{level}，{wx}力尽。今日做任何事都要减量，减量就是务实。',
        '当日{level}：{wx}衰微，{organ}最虚，宜卧宜静，不宜奔走。',
        '{wx}至{level}，身体在「告警」状态。今日的首要任务是休息。',
        '五行为{level}，{wx}已弱。{keOrgan}容易出问题，别硬扛。',
        '当日{level}，气机下陷。情绪与体力同低，少说话、少应酬为上。',
        '{wx}气{level}，{organ}失养。今日不求成事，只求不伤身。'
      ]
    },
    weak: [
      '你命局{wx}仅{pct}，{organ}素为先天短板，宜长期养护。',
      '命局{wx}偏薄（{pct}），{organ}这一环本就不强，今日更需温养。',
      '{wx}在命局只占{pct}，{organ}是你的薄弱处，宜早作调养。',
      '你命局{wx}{pct}，为五环中最薄一环，{organ}需长期照看。',
      '{wx}在原局只{pct}，先天禀赋偏薄，{organ}更需后天补养。',
      '命局中{wx}仅{pct}，{organ}这一处是弱项，宜早调不宜等。',
      '就五行分布看，{wx}占{pct}为最少，{organ}常是身体的短板。',
      '你的{wx}为{pct}，属先天不足项；{organ}调养宜早不宜迟。'
    ],
    tail: [
      '就体质底子而论，{taiyuan}',
      '先天根气方面，{taiyuan}',
      '{taiyuan}',
      '体质这一层，{taiyuan}',
      '往后看，{taiyuan}',
      '根气是本钱——{taiyuan}',
      '{taiyuan}这是先天给定的，改运先从这里下手。',
      '命理上讲「先天不足者，后天补之」：{taiyuan}'
    ]
  };

  /* ---------- 感情 ---------- */
  const LOVE = {
    open: {
      male: [
        '以财星（男命以财星为妻星）论，你日支{spouse}（{spWx}）为配偶宫：{spJudge}。',
        '男命看财星为妻。今日日支{spouse}属{spWx}，{spJudge}。',
        '从配偶宫看：日支{spouse}（{spWx}），{spJudge}。'
      ],
      female: [
        '以官星（女命以官星为夫星）论，你日支{spouse}（{spWx}）为配偶宫：{spJudge}。',
        '女命看官星为夫。今日日支{spouse}属{spWx}，{spJudge}。',
        '从配偶宫看：日支{spouse}（{spWx}），{spJudge}。'
      ]
    },
    star: [
      '财星当值，异性缘较旺。',
      '今日财星为用，人缘与机会俱佳。',
      '妻星（财星）临日，主动方在你。'
    ],
    guan: [
      '官星当值，易遇重要对象或得长辈提点。',
      '今日官星为用，易得贵人或长辈之助力。',
      '夫星（官星）临日，关系上有推进之机。'
    ],
    rel: {
      he: [
        '今日日支与命局{he}相合，和合之力显著，情感上易有进展或关系缓和。',
        '日支{dayZhi}合{he}，主关系向好，宜主动示好、修旧。',
        '六合入命局，{he}与今日相合，感情上宜进不宜退。'
      ],
      chong: [
        '今日日支冲命局{chong}，{chongJudge}，忌意气用事。',
        '日支{dayZhi}冲{chong}，{chongJudge}，今日宜让不宜争。',
        '{chong}被今日冲起，{chongJudge}，退一步反而保得住。'
      ],
      both: [
        '合冲并见，主关系在拉锯中，先动气者吃亏。',
        '今日既有合又有冲，关系在「拉」与「推」之间，先定心再定事。',
        '合与冲同现，主对方态度反复，宜后发制人。'
      ],
      none: [
        '今日与命局无刑冲合害，关系平稳，按既有节奏相处即可。',
        '日支与命局今日无涉，情感无大波，宜照常相处。',
        '无冲无害之日，关系最稳，适合把平常心用足。'
      ]
    },
    tail: [
      '就关系的长线而论，{minggong}',
      '再看命宫——{minggong}',
      '{minggong}这是长期关系的底色。',
      '命宫一关定长远：{minggong}'
    ]
  };

  /* ============================================================
   * 宜忌条目 → 与命主的关联解读（1.8.3 新增）
   *
   * 【为什么要做】
   * 用户反馈「今日宜忌完全一模一样」。核实后确认：
   *   宜忌本身由历法库按日柱推出，**随日期变化**（实测连续 8 天各不相同），
   *   并不是 bug；而用户三次测试都是同一天（2026-10-07 甲寅日），
   *   自然完全相同 —— 这属于**正确结果**。
   *
   * 但原页面只列了宜忌条目，**没有说明这些条目对本人意味着什么**，
   * 且未标出当前是「哪一天」，故看起来像雷同。
   *
   * 现补两件事（都不改宜忌本身，只加解读）：
   *   1. 显式标出所选日期与日柱，便于确认测的是哪天；
   *   2. 对每条宜忌给出与命主喜忌的关联说明（是否合喜用、是否碰忌神）。
   * ============================================================ */

  /* ============================================================
   * 宜忌条目 → 事项属性
   *
   * 【1.8.4 重写 · 用户实测反馈「解读还是完全一样」】
   * 旧版只有 7 组规则，且大量条目命中同一组
   * （实测 15 条宜忌只有 6 种解读，且清一色「属土事…/属人事之事…」）。
   * 两个问题：
   *   1. **颗粒太粗** —— 通书宜忌实有百余条，须按「事类」细分到14 类；
   *   2. **标签重复** —— 句式「属X事，…」在同一条目组内一字不差地重复。
   *
   * 现改为 14 个事类，每类给定：
   *   wx   —— 该类事在五行上的主属性（据传统择日以五行论生克）
   *   tag  —— 事类名（用于文案）
   *   hint —— 该类事对命主的作用方向提示（差异化文案的关键）
   * 顺序即优先级，先命中者为准。
   * ============================================================ */
  const YIJI_ATTR = [
    /* —— 土事：动土修造类，土之性重，最耗元气 —— */
    { wx: '土', tag: '动土', keys: ['动土', '破土', '开山', '掘地', '填穴', '平整', '筑堤', '塞穴', '安葬', '葬', '破屋', '拆', '除服', '启坟', '开生坟', '入殓', '移柩', '修造', '修坟', '造屋'] },
    /* —— 祭祀祈福：以心诚为要，火之礼 —— */
    { wx: '火', tag: '祭祀', keys: ['祭祀', '祈福', '斋醮', '祭神', '祭祖', '沐浴', '浴', '理发', '剃发', '整手足甲', '扫舍', '修坟'] },
    /* —— 婚姻嫁娶：关乎配偶宫与和合 —— */
    { wx: '木', tag: '嫁娶', keys: ['嫁娶', '订盟', '纳采', '问名', '纳吉', '纳征', '请期', '亲迎', '冠笄', '理发'] },
    /* —— 移徙入宅：关乎居所与安顿 —— */
    { wx: '土', tag: '移徙', keys: ['移徙', '入宅', '安床', '安床', '平治道涂', '修街', '修路', '铺路', '造桥', '开沟', '造池'] },
    /* —— 交易求财：关乎财帛与往来 —— */
    { wx: '金', tag: '交易', keys: ['开市', '交易', '立券', '开仓', '出货', '纳财', '进财', '捕捉', '畋猎', '伐木', '刈草', '取鱼', '渔猎', '置仓', '买田'] },
    /* —— 出行与行旅：关乎驿马与在外 —— */
    { wx: '木', tag: '出行', keys: ['出行', '旅', '行旅', '赴任', '上任', '赴任', '远行', '汗', '征'] },
    /* —— 入学与文书：关乎功名与思路 —— */
    { wx: '水', tag: '文书', keys: ['入学', '开蒙', '修文', '作榜', '置砚', '造笔', '书符', '受福', '赛赦', '拜师', '读经', '讲经'] },
    /* —— 治病调养：关乎疾厄与调摄 —— */
    { wx: '木', tag: '调养', keys: ['治病', '疗病', '针灸', '服药', '疗疾', '求医', '安针', '求嗣', '养胎', '备孕'] },
    /* —— 出行上任之外的「赴任/赴盟」等杂事 —— */
    { wx: '火', tag: '人事', keys: ['见贵', '会友', '拜见', '纳采', '订盟', '嫁娶', '竖柱', '上梁', '架马', '开光', '造畜', '掘井', '取水'] },
    /* —— 忌方与方位：关乎方向趋避 —— */
    { wx: '土', tag: '方隅', keys: ['赴任', '出行', '方位', '坎', '坤', '艮', '震', '巽', '离', '兑', '乾', '兑'] },
    /* —— 收割农事 —— */
    { wx: '木', tag: '农事', keys: ['耕耘', '割稻', '收苗', '造谷', '进食', '酒醴', '开仓', '出财'] },
    /* —— 诉讼词讼：关乎口舌与是非 —— */
    { wx: '金', tag: '词讼', keys: ['词讼', '诉讼', '捕捉', '收产', '纳畜', '造屋'] },
    /* —— 契约与债务 —— */
    { wx: '金', tag: '契约', keys: ['立券', '签押', '债', '贷', '收债'] },
    /* —— 营造修葺：匠作之事，与「动土」之重土不同，此主器成、工巧 —— */
    { wx: '木', tag: '营造', keys: ['修造', '修', '造', '竖柱', '上梁', '架马', '开光', '造畜', '掘井', '取水', '鞏', '壁', '柱', '梁'] }
  ];

  /** 取事项属性：按 YIJI_ATTR 顺序命中即返回（顺序即优先级） */
  function attrOf(item) {
    const t = String(item || '');
    for (const g of YIJI_ATTR) {
      for (const k of g.keys) if (t.indexOf(k) >= 0) return g;
    }
    /* 未命中：给中性归类，避免出现「属诸事之事」这种语病 */
    return { wx: null, tag: '此类', keys: [] };
  }

  /**
   * 生成宜忌的命主关联解读
   * @param {object} huangli { yi:[], ji:[] }
   * @param {object} bazi命盘（读 yongshen / dayWuXing）
   * @returns {{yi: string[], ji: string[], support: string}}
   */
  function explainYiJi(huangli, bazi) {
    const ys = (bazi && bazi.yongshen) || { xi: [], ji: [] };
    const xi = ys.xi || [], ji = ys.ji || [];
    const yi = (huangli && huangli.yi) || [];
    const jl = (huangli && huangli.ji) || [];

    /* ------------------------------------------------------------
     * 【1.8.4 二次改进】同一事项类别内，措辞不再一字不差地重复。
     * 做法：为每种「类别 + 吉凶 + 喜忌关系」组合备 3 套说法，
     * 由条目在该组内的出现次序确定性轮换 —— 同一天内两件同类事
     * 读起来也不同，且因取自条目次序，刷新不会跳变。
     * ------------------------------------------------------------ */
    const FORMS = {
      /* 无冲撞 */
      plain: [
        '此条未入五行类目，与你无冲撞，利于着手，可依常理推进',
        '{t}之事，于你无冲，可放手去做',
        '此条不属五行所主，与命局无涉，依通书所列施行即可'
      ],
      plainJi: [
        '此条不涉五行所忌，通书虽列于此，于你实不为忌',
        '{t}之事虽在忌列，对你无害，可因人而异',
        '此条与本命无碍，通书虽列，不必深忌'
      ],
      /* 合喜用 */
      xi: [
        '属{t}，五行合你的喜用，为全日最值得做的一件',
        '{t}之事正合喜用，趁此时推进最省力',
        '此类归入{t}，得喜用之助，宜在此刻下功夫'
      ],
      xiJi: [
        '属{t}，虽列于忌，本于你反无妨，可酌情',
        '{t}虽标为忌，然合你喜用，不必太拘',
        '通书以此为忌，但你以喜用论，此事反可有为'
      ],
      /* 碰忌神 */
      ji: [
        '属{t}，五行碰你的忌神，宜减力、宜择吉时',
        '{t}之事触你忌神，不宜尽其量，减半分即可',
        '此类归入{t}，与忌神相撞，宜暂缓或择时段'
      ],
      jiJi: [
        '属{t}，正撞你的忌神，忌上加忌，最宜回避',
        '{t}之事本已不宜，于你尤甚，能免则免',
        '此类归入{t}，正犯忌神，是今日最该避开一件'
      ]
    };
    /* 各类别已出现次数，用于轮换措辞 */
    const seenCount = {};
    function one(item, isYi) {
      const g = attrOf(item);
      const rel = !g.wx ? null
        : (xi.indexOf(g.wx) >= 0 ? 'xi'
          : (ji.indexOf(g.wx) >= 0 ? 'ji' : 'none'));
      const key = rel + '|' + g.tag + '|' + (isYi ? 'yi' : 'ji');
      const n = seenCount[key] || 0;
      seenCount[key] = n + 1;
      /* 未命中任何五行类目时，明确说明「不入五行类目」，
       * 不用「无冲撞」这类会被误读为吉利的说法。*/
      if (!g.wx) {
        return isYi
          ? '此条不涉五行主类，与你无冲，通书列为宜，可施行'
          : '此条不涉五行主类，与你无冲，通书列于忌亦无妨';
      }
      const pool = FORMS[rel + (isYi ? '' : 'Ji')] || FORMS.plain;
      let txt = pool[n % pool.length];
      /* {t} 统一替换为「XX类」；未命中归类时用「此类」，避免「属此类类」*/
      txt = txt.replace(/\{t\}/g, g.tag + '类');
      return txt;
    }

    /* 总述：今日日干五行与命主的合冲关系 */
    const dayWx = (bazi && bazi.dayWuXing) || '';
    const SHENG = { 金: '水', 水: '木', 木: '火', 火: '土', 土: '金' };
    const KE = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' };
    let support;
    if (!dayWx) support = '宜忌为历法通书所载，与个人喜忌的配合需以命局而论。';
    else if (xi.indexOf(dayWx) >= 0) support = '今日日行为' + dayWx + '，正是你的喜用，整体顺势，宜事多做。';
    else if (ji.indexOf(dayWx) >= 0) support = '今日日行为' + dayWx + '，属你的忌神，宜忌条目再吉也要打折扣。';
    else if (SHENG[dayWx] && xi.indexOf(SHENG[dayWx]) >= 0) support = '今日日行为' + dayWx + '，生你的喜用' + SHENG[dayWx] + '，得力。';
    else if (KE[dayWx] && xi.indexOf(KE[dayWx]) >= 0) support = '今日日行为' + dayWx + '，克你的喜用' + KE[dayWx] + '，效力打折。';
    else support = '今日日行为' + dayWx + '，与喜忌无直接关系，宜忌照常参考即可。';

    return {
      yi: yi.map((x) => one(x, true)),
      ji: jl.map((x) => one(x, false)),
      support: support
    };
  }

  /* ============================================================
   * 组装器：把「事实」拼成一段多样化的文本
   * ============================================================ */

  /**
   * @param opts.dim    维度 'wealth'|'career'|'health'
   * @param opts.band   档位 high/above/mid/below/low
   * @param opts.seed   抽取种子
   * @param opts.facts  事实对象（见 bazi-core 调用处）
   * @returns {string}
   */
  function compose(opts) {
    const o = opts || {};
    const bandName = o.band || 'mid';
    const seed = o.seed >>> 0;
    const f = o.facts || {};
    const dim = o.dim;

    /* 统一变量替换：所有候选文本都用同一套占位符 */
    const fill = (tpl) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => {
      const v = f[k];
      return (v == null ? '' : String(v));
    });

    if (dim === 'wealth') {
      const openPool = (WEALTH.open && WEALTH.open[f.shishen]) || WEALTH.open['比劫'];
      const tonePool = WEALTH.tone[bandName] || WEALTH.tone.mid;
      const p1 = fill(pick(openPool, seed, 'w-open'));
      const p2 = fill(pick(tonePool, seed, 'w-tone'));
      const p3 = fill(pick(WEALTH.tail, seed, 'w-tail'));
      /* 中段：只追加与本命局真正相关的事实（不适用则跳过） */
      const mid = [];
      if (f.zhiNote) mid.push(fill(f.zhiNote));
      if (f.xiNote) mid.push(fill(f.xiNote));
      if (f.relNote) mid.push(fill(f.relNote));
      return [p1, p2].concat(mid, [p3]).filter(Boolean).join('');
    }

    if (dim === 'career') {
      const openPool = (CAREER.open && CAREER.open[f.groupKey]) || CAREER.open['食伤'];
      const p1 = fill(pick(openPool, seed, 'c-open'))
        .replace('{shishen}', f.shishen || '食伤');
      const mid = [];
      if (f.guaNote) mid.push(fill(f.guaNote));
      if (f.relNote) mid.push(fill(f.relNote));
      const p2 = fill(pick(CAREER.tail, seed, 'c-tail'));
      return [p1].concat(mid, [p2]).filter(Boolean).join('');
    }

    if (dim === 'love') {
      const key = f.isMale ? 'male' : 'female';
      const p1 = fill(pick(LOVE.open[key], seed, 'l-open'));
      const mid = [];
      if (f.starNote) mid.push(fill(pick(f.starNote, seed, 'l-star')));
      if (f.relNote) {
        const kind = (f.hasHe && f.hasChong) ? 'both' : (f.hasHe ? 'he' : (f.hasChong ? 'chong' : 'none'));
        mid.push(fill(pick(LOVE.rel[kind], seed, 'l-rel')));
      }
      const p2 = fill(pick(LOVE.tail, seed, 'l-tail'));
      return [p1].concat(mid, [p2]).filter(Boolean).join('');
    }

    if (dim === 'health') {
      const openPool = (HEALTH.open && HEALTH.open[f.wangLevel]) || HEALTH.open['休'];
      const p1 = fill(pick(openPool, seed, 'h-open'));
      const mid = [];
      /* 【1.8.2 修复 · 真实缺陷】weakNote 由调用方传入时只含「短板」信息，
       * 不含{level} 等变量；此处若直接追加，其中的占位符不会被 fill 处理。
       * 现改为：所有 mid 段统一走 fill，确保占位符全部被替换。*/
      if (f.weakNote) mid.push(fill(f.weakNote));
      if (f.keNote) mid.push(fill(f.keNote));
      if (f.relNote) mid.push(fill(f.relNote));
      const p2 = fill(pick(HEALTH.tail, seed, 'h-tail'));
      return [p1].concat(mid, [p2]).filter(Boolean).join('');
    }

    return '';
  }

  root.FortuneVoice = {
    explainYiJi: explainYiJi,
    compose: compose,
    band: band,
    pick: pick,
    hashStr: hashStr,
    _internals: { WEALTH: WEALTH, CAREER: CAREER, HEALTH: HEALTH, LOVE: LOVE, YIJI_ATTR: YIJI_ATTR, attrOf: attrOf, mulberry32: mulberry32 }
  };
  if (typeof module === 'object' && module.exports) module.exports = root.FortuneVoice;
})(typeof globalThis !== 'undefined' ? globalThis : this);
