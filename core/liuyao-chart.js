/**
 * core/liuyao-chart.js —— 六爻完整排盘
 *
 * 审计要求（三、4/5/6）：重新核对三爻位序、上下卦映射、本卦、变卦、互卦、
 * 错卦、综卦；完整实现并结构化输出八宫归属、世应、纳甲、六亲、六神、月建、
 * 日辰、旬空、月破、日冲、六合六冲、动爻和变爻关系；接入 64 卦卦辞与 384 爻爻辞。
 *
 * 依据：
 *   - 纳甲与世应：《周易本义》（朱熹）、「京氏易传」纳甲体系
 *   - 卦位序：自下而上为初、二、三、四、五、上；下卦为初二三，上卦为四五上
 *   - 八宫归属：《京氏易传》八宫卦序（乾坎艮震巽离坤兑）
 *   - 旬空、月破、日冲：月建日辰旺衰体系（《增删卜易》）
 *   - 卦爻辞：《周易》经文（文王卦辞、周公爻辞），乾用九、坤用六
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../vendor/lunar.js'), require('./coin.js'), require('./gua-text.js'), require('./trace.js'));
  } else {
    root.LiuYaoChart = factory(
      { Lunar: root.Lunar, LunarUtil: root.LunarUtil, Solar: root.Solar },
      root.CoinCast, root.GuaText, root.RuleTrace
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this,
function (LunarLib, Coin, GuaText, RT) {
  'use strict';

  var Lunar = LunarLib.Lunar;
  var LunarUtil = LunarLib.LunarUtil;

  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

  /* ============================================================
   * 1. 卦位与上下卦映射
   * 三爻二进制：阳=1，阴=0。初爻为最低位。
   * 乾 111 兑 011 离 101 震 001 巽 011?  —— 按传统顺序：
   *   乾 ☰ 111  兑 ☱ 110(上缺)  离 ☲ 101  震 ☳ 100
   *   巽 ☴ 011  坎 ☵ 010  艮 ☶ 001  坤 ☷ 000
   * 采用「先天八卦数」序：乾1 兑2 离3 震4 巽5 坎6 艮7 坤8
   * ============================================================ */

  // 索引 = (初爻*4 + 二爻*2 + 三爻)
  var TRIGRAM_BY_BITS = {
    7: '乾', 6: '兑', 5: '离', 4: '震',
    3: '巽', 2: '坎', 1: '艮', 0: '坤'
  };
  var BITS_BY_TRIGRAM = {
    乾: 7, 兑: 6, 离: 5, 震: 4, 巽: 3, 坎: 2, 艮: 1, 坤: 0
  };
  /** 先天八卦数（用于梅花易数等时间/数字起卦） */
  var XIANTIAN_NUM = { 乾: 1, 兑: 2, 离: 3, 震: 4, 巽: 5, 坎: 6, 艮: 7, 坤: 8 };

  /** 由六爻的阴阳标志求本卦名（下卦=初二三，上卦=四五上） */
  function guaNameFromYang(yangFlags) {
    // yangFlags 长度 6，索引 0=初爻
    var lowerBits = (yangFlags[0] ? 4 : 0) + (yangFlags[1] ? 2 : 0) + (yangFlags[2] ? 1 : 0);
    var upperBits = (yangFlags[3] ? 4 : 0) + (yangFlags[4] ? 2 : 0) + (yangFlags[5] ? 1 : 0);
    var up = TRIGRAM_BY_BITS[upperBits];
    var low = TRIGRAM_BY_BITS[lowerBits];
    return { name: GuaText.nameOf(up, low), up: up, low: low, upperBits: upperBits, lowerBits: lowerBits };
  }

  /** 变卦：把所有动爻翻转 */
  function changedYang(yangFlags, lines) {
    var f = yangFlags.slice();
    for (var i = 0; i < 6; i++) if (Coin.lineChanging(lines[i])) f[i] = !f[i];
    return f;
  }

  /** 互卦：取 2·3·4 为下互，3·4·5 为上互 */
  function huYang(yangFlags) {
    var lower = [yangFlags[1], yangFlags[2], yangFlags[3]];
    var upper = [yangFlags[2], yangFlags[3], yangFlags[4]];
    var lBits = (lower[0] ? 4 : 0) + (lower[1] ? 2 : 0) + (lower[2] ? 1 : 0);
    var uBits = (upper[0] ? 4 : 0) + (upper[1] ? 2 : 0) + (upper[2] ? 1 : 0);
    return { name: GuaText.nameOf(TRIGRAM_BY_BITS[uBits], TRIGRAM_BY_BITS[lBits]), up: TRIGRAM_BY_BITS[uBits], low: TRIGRAM_BY_BITS[lBits] };
  }

  /** 错卦（阴阳全变） */
  function cuoYang(yangFlags) {
    return yangFlags.map(function (b) { return !b; });
  }

  /** 综卦（上下颠倒） */
  function zongYang(yangFlags) {
    return [yangFlags[5], yangFlags[4], yangFlags[3], yangFlags[2], yangFlags[1], yangFlags[0]];
  }

  /* ============================================================
   * 2. 八宫归属与纳甲
   * 《京氏易传》八宫：每宫八卦，本宫为纯卦（八纯卦），
   * 一世至五世依序递变，世爻随之而上，第六世为游魂，第七世为归魂。
   * ============================================================ */

  var EIGHT_PALACE = ['乾', '坎', '艮', '震', '巽', '离', '坤', '兑'];

  /**
   * 八宫卦序：以乾宫为例
   *   乾(八纯) 姤(一世) 同人(二世) 大有(三世) 大壮(四世) 夬(五世)
   *   姤的游魂=遁 归魂=大壮?  —— 严格按下表（京氏八宫卦序）
   */
  var PALACE_ORDER = {
    乾: ['乾为天', '天风姤', '天山遁', '天地否', '风地观', '山地剥', '火地晋', '火天大有'],
    坎: ['坎为水', '水泽节', '水雷屯', '水火既济', '泽火革', '雷火丰', '地火明夷', '地水师'],
    艮: ['艮为山', '山火贲', '山天大畜', '山泽损', '火泽睽', '天泽履', '风泽中孚', '风山渐'],
    震: ['震为雷', '雷地豫', '雷水解', '雷风恒', '地风升', '水风井', '泽风大过', '泽雷随'],
    巽: ['巽为风', '风天小畜', '风火家人', '风雷益', '天雷无妄', '火雷噬嗑', '山雷颐', '山风蛊'],
    离: ['离为火', '火山旅', '火风鼎', '火水未济', '山水蒙', '风水涣', '天水讼', '天火同人'],
    坤: ['坤为地', '地雷复', '地泽临', '地天泰', '雷天大壮', '泽天夬', '水天需', '水地比'],
    兑: ['兑为泽', '泽水困', '泽地萃', '泽山咸', '水山蹇', '地山谦', '雷山小过', '雷泽归妹'],
  };

  /**
   * 八宫卦序（京房《易传》八宫卦次）：
   *   0 八纯  1 一世  2 二世  3 三世  4 四世  5 五世  6 游魂  7 归魂
   *
   * 【1.6.0 修正】原 SHI_YIN / YOU_YIN 只到 6，且四世/五世的应位错位；
   * 导致——
   *   (a) 全部 8 个「归魂卦」（次序 7）的世应皆为 undefined，
   *       界面上世爻/应爻标记与「世应」栏整块缺失；
   *   (b) 序 4 被标为「五世」但取的是四世的世位，序 5 被标为「六世」，
   *       世应编号整体错位一格，且游魂卦的应位错标为 2（应为 1）。
   * 现按下表逐位校正（应位 = 世位隔两位，即 (shi + 3 - 1) % 6 + 1 的京房配对）。
   */
  var SHI_YIN = { 0: 6, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 4, 7: 3 };
  var YOU_YIN = { 0: 3, 1: 4, 2: 5, 3: 6, 4: 1, 5: 2, 6: 1, 7: 6 };

  /** 八宫次序名称（用于「X宫·N世卦」标签） */
  var YAO_ORDER_NAME = ['八纯', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂'];

  /** 反卦（综卦）时世爻的换位关系，用于「变卦世应」标注 */
  function palaceOf(fullName) {
    for (var i = 0; i < EIGHT_PALACE.length; i++) {
      var p = EIGHT_PALACE[i];
      var list = PALACE_ORDER[p];
      for (var j = 0; j < list.length; j++) {
        if (list[j] === fullName) {
          return {
            palace: p, order: j,
            shi: SHI_YIN[j], you: YOU_YIN[j],
            orderName: YAO_ORDER_NAME[j],
            label: p + '宫·' + YAO_ORDER_NAME[j] + '卦',
            isPure: j === 0
          };
        }
      }
    }
    return null;
  }

  /* ============================================================
   * 3. 纳甲（装卦）
   * 乾纳甲壬、坤纳乙癸、震纳庚、巽纳辛、坎纳戊、离纳己、艮纳丙、兑纳丁。
   * 内卦三爻纳内干（本宫天干），外卦三爻纳外干。
   * 地支按「子寅辰午申戌」顺行（阳卦）与「丑亥酉未巳卯」逆行（阴卦）分配。
   * 来源：《京氏易传》纳甲法、《增删卜易》装卦章。
   * ============================================================ */

  /**
   * 纳甲（装卦）—— 直接采用《京氏易传》纳甲表，不做顺逆推算。
   * 乾内子寅辰甲/外午申戌壬；坤内未巳卯乙/外丑亥酉癸；
   * 震内子寅辰庚/外午申戌庚；巽内丑亥酉辛/外未巳卯辛；
   * 坎内寅辰午戊/外申戌子戊；离内卯丑亥己/外酉未巳己；
   * 艮内辰午申丙/外戌子寅丙；兑内巳卯丑丁/外亥酉未丁。
   * 索引 0~2 = 初、二、三爻（内卦）；3~5 = 四、五、上爻（外卦）。
   */
  var NAJIA_TABLE = {
    乾: { gan: '甲', nei: ['子', '寅', '辰'], wai: ['午', '申', '戌'], waiGan: '壬' },
    坤: { gan: '乙', nei: ['未', '巳', '卯'], wai: ['丑', '亥', '酉'], waiGan: '癸' },
    震: { gan: '庚', nei: ['子', '寅', '辰'], wai: ['午', '申', '戌'], waiGan: '庚' },
    巽: { gan: '辛', nei: ['丑', '亥', '酉'], wai: ['未', '巳', '卯'], waiGan: '辛' },
    坎: { gan: '戊', nei: ['寅', '辰', '午'], wai: ['申', '戌', '子'], waiGan: '戊' },
    离: { gan: '己', nei: ['卯', '丑', '亥'], wai: ['酉', '未', '巳'], waiGan: '己' },
    艮: { gan: '丙', nei: ['辰', '午', '申'], wai: ['戌', '子', '寅'], waiGan: '丙' },
    兑: { gan: '丁', nei: ['巳', '卯', '丑'], wai: ['亥', '酉', '未'], waiGan: '丁' },
  };

  /**
   * 装一卦六爻的纳甲
   * @param {string} up 上卦
   * @param {string} low 下卦
   * @returns {Array<{gan:string,zhi:string}>} 长度 6，索引 0=初爻
   */
  function naJiaSix(up, low) {
    var lo = NAJIA_TABLE[low], up2 = NAJIA_TABLE[up];
    var res = [];
    var i;
    for (i = 0; i < 3; i++) res.push({ gan: lo.gan, zhi: lo.nei[i] });
    for (i = 0; i < 3; i++) res.push({ gan: up2.waiGan, zhi: up2.wai[i] });
    return res;
  }

  /* ============================================================
   * 4. 十神与六亲
   * 六亲以「用神（五行）」与「爻支五行」生克定：
   *   同我者兄弟、我生者子孙、我克者妻财、克我者官鬼、生我者父母
   * ============================================================ */

  var SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  var KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  var SHI_SHEN = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
  var LIUQIN = ['兄弟', '子孙', '妻财', '官鬼', '父母'];

  function sixRelative(yaoWx, yongWx) {
    if (yaoWx === yongWx) return '兄弟';
    if (SHENG[yongWx] === yaoWx) return '子孙';
    if (KE[yongWx] === yaoWx) return '妻财';
    if (KE[yaoWx] === yongWx) return '官鬼';
    return '父母';
  }

  /** 十神：以日干为我，算天干/地支藏干的十神 */
  function shishen(dayGan, targetGan) {
    var dw = LunarUtil.WU_XING_GAN[dayGan];
    var tw = LunarUtil.WU_XING_GAN[targetGan];
    var same = (dw === tw);
    if (same) return targetGan === dayGan ? '比肩' : '劫财';
    if (SHENG[dw] === tw) return (LunarUtil.YANG_GAN ? (isYangGan(targetGan) ? '食神' : '伤官') : '食神');
    if (KE[dw] === tw) return '财星';
    return '印星';
  }
  function isYangGan(g) { return GAN.indexOf(g) % 2 === 0; }

  /* ============================================================
   * 5. 六神（依日干起）
   * 甲乙起青龙，丙丁起朱雀，戊起勾陈，己起螣蛇，庚辛起白虎，壬癸起玄武。
   * 自初爻起，顺数六爻。
   * 来源：《卜筮正宗》六神章。
   * ============================================================ */

  var LIU_SHEN = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
  function liuShen(dayGan) {
    var order = dayGan.charCodeAt(0) % 10;  // 甲0 乙1 丙2 丁3 戊4 己5 庚6 辛7 壬8 癸9
    // 传统起法：甲乙青龙，丙丁朱雀，戊勾陈，己螣蛇，庚辛白虎，壬癸玄武
    var startMap = { 0: 0, 1: 0, 2: 1, 3: 1, 4: 2, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5 };
    var start = startMap[order] || 0;
    return LIU_SHEN.map(function (_, i) { return LIU_SHEN[(start + i) % 6]; });
  }

  /* ============================================================
   * 6. 月建、日辰、旬空、月破、日冲、六合六冲
   * ============================================================ */

  function xunKong(dayGZ) {
    var g = dayGZ.charAt(0), z = dayGZ.charAt(1);
    var start = (ZHI.indexOf(z) - GAN.indexOf(g) + 12) % 12;
    var kong = [ZHI[(start + 10) % 12], ZHI[(start + 11) % 12]];
    return kong;
  }

  function monthBreak(monthZhi) {
    // 月破：与月支相冲之支（子午、丑未、寅申、卯酉、辰戌、巳亥）
    var i = ZHI.indexOf(monthZhi);
    return ZHI[(i + 6) % 12];
  }

  function chong(z1, z2) { return (ZHI.indexOf(z1) + 6) % 12 === ZHI.indexOf(z2); }

  var LIU_HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  var LIU_CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };

  function wxOfGz(gz) { return LunarUtil.WU_XING_GAN[gz.charAt(0)] + '/' + LunarUtil.WU_XING_GAN[gz.charAt(1)]; }
  function wxOfZhi(z) { return LunarUtil.WU_XING_ZHI[z]; }
  function wxOfGan(g) { return LunarUtil.WU_XING_GAN[g]; }

  /* ============================================================
   * 7. 主排盘函数
   * ============================================================
   * @param {object} input
   *   lines    六爻爻值 6/7/8/9，索引 0=初爻（可传 18 枚钱面对象）
   *   date     公历 Date（用于月建日辰）
   *   yong     用神所属五行（缺省以妻财为默认参考）
   *   question 用户确认后的问题结构
   */
  function build(input) {
    input = input || {};
    var lines = normalizeLines(input.lines);
    Coin.assertValidLines(lines);

    // 注意：不能写 lines.map(Coin.lineYang) —— map 会把索引作为第二实参传入，
    // 而 lineYang(v, i) 的第二个参数会被误用，导致索引非 0 时阴阳判错。
    // 这里用显式包装函数逐爻求值。
    var yangFlags = lines.map(function (v) { return Coin.lineYang(v); });
    var gua = guaNameFromYang(yangFlags);
    var pureName = gua.name;

    var chgFlags = changedYang(yangFlags, lines);
    var chg = guaNameFromYang(chgFlags);
    var hu = huYang(yangFlags);
    var cuo = guaNameFromYang(cuoYang(yangFlags));
    var zong = guaNameFromYang(zongYang(yangFlags));

    // 日/月建
    var date = input.date || new Date();
    var solar = toSolar(date);
    var ec = solar.getLunar().getEightChar();
    var dayGZ = ec.getDay();
    var monthGZ = ec.getMonth();       // 已含节气换月（lunar-js 的 getMonth 为节气月）
    var yearGZ = ec.getYear();
    var dayGan = dayGZ.charAt(0);
    var dayZhi = dayGZ.charAt(1);
    var monthZhi = monthGZ.charAt(1);
    var kong = xunKong(dayGZ);
    var po = monthBreak(monthZhi);
    var shenArr = liuShen(dayGan);

    var palace = palaceOf(pureName);
    // 六亲以本卦所属八宫五行为“我”；未指定事项用神时不可默认以木为基准。
    var yongWx = ({乾:'金',兑:'金',坎:'水',艮:'土',坤:'土',震:'木',巽:'木',离:'火'})[palace && palace.palace] || input.yong || '木';

    // 装六爻：初爻在下
    var naJiaArr = naJiaSix(gua.up, gua.low); // 索引 0..5 = 初..上

    var yaos = [];
    for (var i = 0; i < 6; i++) {
      var v = lines[i];
      var gz = naJiaArr[i].gan + naJiaArr[i].zhi;
      var yz = naJiaArr[i].zhi;
      var yang = v === 7 || v === 9;
      var moving = v === 6 || v === 9;
      var wxY = wxOfZhi(yz);
      yaos.push({
        pos: i + 1,                              // 1=初爻
        posName: POS_NAME[i],
        value: v,
        name: Coin.YAO_INFO[v].name,
        yang: yang, moving: moving,
        mark: Coin.YAO_INFO[v].mark,
        gan: naJiaArr[i].gan, zhi: yz, ganZhi: gz,
        zhiWx: wxY,
        liuqin: sixRelative(wxY, yongWx),
        liushen: shenArr[i],
        isShi: palace && palace.shi === i + 1,
        isYou: palace && palace.you === i + 1,
        isShen: i === 5,                         // 世爻多在上爻/三位，随宫而定
        xianKong: kong.indexOf(yz) >= 0,
        yuePo: yz === po,
        yueJian: wxOfZhi(monthZhi),
        riChen: yz === dayZhi,
        riChong: LIU_CHONG[yz] === dayZhi,
        liuHe: LIU_HE[yz] === dayZhi,
        liuChong: !!LIU_CHONG[yz],
        gz,
      });
    }

    // 世爻/应爻标记修正（用八宫表）
    if (palace) {
      yaos.forEach(function (y) { y.isShi = (y.pos === palace.shi); y.isYou = (y.pos === palace.you); });
    }

    // 变爻纳甲（按变卦重新装）
    var chgNaJia = naJiaSix(chg.up, chg.low);
    var chgPalace = palaceOf(chg.name);
    yaos.forEach(function (y, i) {
      if (y.moving) {
        y.bianGan = chgNaJia[i].gan;
        y.bianZhi = chgNaJia[i].zhi;
        y.bianGanZhi = chgNaJia[i].gan + chgNaJia[i].zhi;
        y.bianWx = wxOfZhi(chgNaJia[i].zhi);
        y.bianLiuqin = sixRelative(y.bianWx, yongWx);
        y.chgPos = i + 1;
      }
    });

    // 动爻关系
    var movingList = yaos.filter(function (y) { return y.moving; });
    var movingDesc = movingList.map(function (y) {
      return POS_NAME[y.pos - 1] + '爻' + Coin.YAO_INFO[y.value].name + '，' +
        (y.value === 9 ? '阳变阴' : '阴变阳') + '为' + y.bianZhi + '，化' + y.bianLiuqin;
    });

    var result = {
      lines: lines,
      coins: null,
      pureName: pureName,
      gua: pureName,
      upTrigram: gua.up, lowTrigram: gua.low,
      changedName: movingList.length ? chg.name : null,
      changedGua: movingList.length ? chg.name : null,
      huName: hu.name, cuoName: cuo.name, zongName: zong.name,
      palace: palace,
      shiPos: palace ? palace.shi : null,
      youPos: palace ? palace.you : null,
      yong: yongWx,
      yaos: yaos,
      movingCount: movingList.length,
      movingDesc: movingDesc,
      dayGZ: dayGZ, monthGZ: monthGZ, yearGZ: yearGZ,
      dayGan: dayGan, dayZhi: dayZhi, monthZhi: monthZhi,
      xunKong: kong, yuePo: po,
      sixShen: shenArr,
      isPure: palace ? palace.isPure : false,
      palaceLabel: palace ? palace.label : '未归八宫',
    };
    // Missing relatives are hidden beneath the same position in the pure palace hexagram.
    const pureNa=naJiaSix(palace.palace,palace.palace),present=new Set(yaos.map(y=>y.liuqin));
    const forward={亥:"子",寅:"卯",巳:"午",申:"酉",丑:"辰",辰:"未",未:"戌",戌:"丑"};
    result.hidden=[];
    yaos.forEach((y,i)=>{
      const n=pureNa[i],wx=wxOfZhi(n.zhi),rel=sixRelative(wx,yongWx);
      if(!present.has(rel)){y.fushen={ganZhi:n.gan+n.zhi,zhiWx:wx,liuqin:rel};result.hidden.push({pos:y.pos,...y.fushen});}
      y.motionRelations=[];
      if(y.moving){
        if(SHENG[y.bianWx]===y.zhiWx)y.motionRelations.push("回头生");
        if(KE[y.bianWx]===y.zhiWx)y.motionRelations.push("回头克");
        if(forward[y.zhi]===y.bianZhi)y.motionRelations.push("化进神");
        if(forward[y.bianZhi]===y.zhi)y.motionRelations.push("化退神");
        if(y.zhi===y.bianZhi)y.motionRelations.push("动化同支");
        if(LIU_CHONG[y.zhi]===y.bianZhi)y.motionRelations.push("动化相冲");
        if(LIU_HE[y.zhi]===y.bianZhi)y.motionRelations.push("动化相合");
      }
    });
    result.yongCandidates=Object.fromEntries(["父母","兄弟","子孙","妻财","官鬼"].map(rel=>[rel,yaos.filter(y=>y.liuqin===rel).map(y=>y.pos)]));
    return result;
  }

  var POS_NAME = ['初', '二', '三', '四', '五', '上'];

  function normalizeLines(lines) {
    if (!Array.isArray(lines)) {
      // 兼容旧格式：可能是钱面对象数组
      return lines;
    }
    return lines.map(function (l) {
      if (typeof l === 'number') return l;
      if (l && typeof l.value === 'number') return l.value;
      return l;
    });
  }

  function toSolar(date) {
    var d = date instanceof Date ? date : new Date(date);
    var LunarLib2 = LunarLib;
    if (LunarLib2.Solar) return LunarLib2.Solar.fromYmdHms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), 0);
    return null;
  }

  /* 导出 */
  return {
    build: build,
    guaNameFromYang: guaNameFromYang,
    changedYang: changedYang,
    huYang: huYang,
    cuoYang: cuoYang,
    zongYang: zongYang,
    palaceOf: palaceOf,
    sixRelative: sixRelative,
    shishen: shishen,
    liuShen: liuShen,
    xunKong: xunKong,
    monthBreak: monthBreak,
    chong: chong,
    TRIGRAM_BY_BITS: TRIGRAM_BY_BITS,
    BITS_BY_TRIGRAM: BITS_BY_TRIGRAM,
    XIANTIAN_NUM: XIANTIAN_NUM,
    EIGHT_PALACE: EIGHT_PALACE,
    PALACE_ORDER: PALACE_ORDER,
    POS_NAME: POS_NAME,
    LIU_CHONG: LIU_CHONG,
    LIU_HE: LIU_HE,
    SHENG: SHENG, KE: KE,
  };
});
