/* 玄机阁 · 二十八宿数据
 *
 * 数据说明（重要，勿当作占星结论）：
 *  - 二十八宿是中国古代的天区划分，本质是「沿天赤道把周天等分 28 段」。
 *    每宿约占 12.857°，起于冬至所在的角宿。
 *  - 二十八宿是中国古代的天区划分：沿天赤道把周天等分为 28 段，每段约 12.857°，
 *    起于角宿（交于春分点稍东）。本文件即采用这一「等分」近似值，
 *    目的是让宿度连续、无空隙、无重叠、可被程序严格校验；
 *    史籍所载各宿实测度数略有出入，此处如实说明为等分近似，不伪称精确实测值。
 *  - 每宿的赤经区间与宿内代表星的现代赤经坐标是两套不同源的数据：
 *    宿度是沿天赤道的等分，代表星是真实 J2000 恒星坐标，二者并不重合
 *    （例如心宿的代表星是天蝎座大火 α，赤经 247.4°，而心宿度区间为 253.9°~266.8°）。
 *    界面必须把两者分开呈现，不得暗示「宿度范围内就只有这几颗星」。
 *  - 这里只做「观象坐标与文化出处」，不做命运推断、不排吉凶。
 */
(function (global) {
  'use strict';

  /* 四宫（天之四象）。raCenter 为该宫在赤经上的中心。 */
  var palaces = [
    {
      id: 'azure', name: '东方苍龙', beast: '青龙', direction: '东',
      color: '#5fd0c8', raCenter: 247.5, season: '春',
      note: '苍龙七宿见于苍龙七宿图象，是东方的星宿群，主体在室女座与天秤座一带。'
    },
    {
      id: 'dark', name: '北方玄武', beast: '玄武', direction: '北',
      color: '#6f9fe0', raCenter: 337.5, season: '冬',
      note: '玄武为龟蛇之象，主体在天蝎座与摩羯座一带，含南斗六星。'
    },
    {
      id: 'white', name: '西方白虎', beast: '白虎', direction: '西',
      color: '#e6d2a0', raCenter: 67.5, season: '秋',
      note: '白虎七宿主体在室女至双鱼一带，含毕宿五星（大陵五一带）著名星团。'
    },
    {
      id: 'vermilion', name: '南方朱雀', beast: '朱雀', direction: '南',
      color: '#e88b6a', raCenter: 157.5, season: '夏',
      note: '朱雀七宿主体在巨蟹座至长蛇座一带，含张宿、翼宿等沿银河分布的星官。'
    }
  ];

  /* 二十八宿。
   * raStart/raEnd：宿的赤经区间（度，J2000，含端点）。
   * stars[]：宿内最亮的主星，ra/dec 为 J2000 赤道坐标，mag 为视星等，con 为所属星座。
   * season：宿对应的节气（用于与二十八宿分野配套的时间感）。
   */
  var lodges = [
    /* ---------------- 东方苍龙七宿（角至箕） */
    {
      index: 1, name: '角宿', pinyin: 'Jiao', palace: '东方苍龙',
      asterism: '角宿二（亢宿增补）', raStart: 202.5, raEnd: 215.36,
      meaning: '二十八宿之首，以东官苍龙之角而名，是周天分野的起点。',
      locate: '主星为室女座 α（角宿一）与 β（角宿二）这一对紧邻的亮星，望之如一段短角。',
      season: '春分前后',
      boundary: '星宿为观象坐标与文化分区，用于定位与叙事，不作命运推断。',
      stars: [
        { name: '角宿一', con: '室女座', ra: 204.97, dec: -0.70, mag: 0.98 },
        { name: '角宿二', con: '室女座', ra: 206.17, dec: 0.82, mag: 2.62 }
      ]
    },
    {
      index: 2, name: '亢宿', pinyin: 'Kang', palace: '东方苍龙',
      asterism: '亢宿一至四', raStart: 215.36, raEnd: 228.21,
      meaning: '苍龙之颈，亢者昂也，取其高耸之意。',
      locate: '主星为室女座 γ（亢宿一）与 ι，均在角宿东侧紧邻排列。',
      season: '谷雨前后',
      boundary: '仅作天区识别，不用于择日或人事判断。',
      stars: [
        { name: '亢宿一', con: '室女座', ra: 216.04, dec: -3.70, mag: 2.74 },
        { name: '亢宿四', con: '室女座', ra: 219.90, dec: -2.44, mag: 3.38 }
      ]
    },
    {
      index: 3, name: '氐宿', pinyin: 'Di', palace: '东方苍龙',
      asterism: '氐宿一至四', raStart: 228.21, raEnd: 241.07,
      meaning: '苍龙之足，氐为根柢之根，草木着地之处。',
      locate: '主星为天秤座 β（氐宿一），是西侧天区最先被点亮的一颗亮星。',
      season: '立夏前后',
      boundary: '宿名可作文学取象，不据此断人吉凶。',
      stars: [{ name: '氐宿一', con: '天秤座', ra: 229.25, dec: 9.28, mag: 2.61 }]
    },
    {
      index: 4, name: '房宿', pinyin: 'Fang', palace: '东方苍龙',
      asterism: '房宿一至四', raStart: 241.07, raEnd: 253.93,
      meaning: '苍龙之腹，房为室、为一宿之内膛，是龙身的中心段。',
      locate: '主星为天蝎座 π、ρ、δ 三星连线，呈近直线的一列。',
      season: '小满前后',
      boundary: '可作星象叙事素材，不替代天文观测。',
      stars: [
        { name: '房宿三', con: '天蝎座', ra: 244.57, dec: -16.20, mag: 2.89 },
        { name: '房宿一', con: '天蝎座', ra: 245.30, dec: -17.99, mag: 3.03 }
      ]
    },
    {
      index: 5, name: '心宿', pinyin: 'Xin', palace: '东方苍龙',
      asterism: '心宿一至三（大火）', raStart: 253.93, raEnd: 266.79,
      meaning: '苍龙之心，古称「大火」，心宿二是东方七宿的标志星。',
      locate: '主星天蝎座 α（心宿二，大火）是全天最亮的恒星之一，橙红色，行伍之象。',
      season: '芒种前后',
      boundary: '「大火」为农事物候标志，属天文历法内容，不作命理断语。',
      stars: [{ name: '心宿二', con: '天蝎座', ra: 247.35, dec: -26.43, mag: 1.06 }]
    },
    {
      index: 6, name: '尾宿', pinyin: 'Wei', palace: '东方苍龙',
      asterism: '尾宿一至九', raStart: 266.79, raEnd: 279.64,
      meaning: '苍龙之尾，尾为末宿，故尾宿之后即转入北方玄武的斗宿。',
      locate: '主体在人马座，包含箕宿三（gamma Sagittarii）一带密集暗星。',
      season: '夏至前后',
      boundary: '宿次沿天赤道排列，非天球上的紧密星团。',
      stars: [
        { name: '尾宿一', con: '人马座', ra: 283.82, dec: -26.99, mag: 2.81 },
        { name: '尾宿二', con: '人马座', ra: 287.44, dec: -29.83, mag: 3.17 }
      ]
    },
    {
      index: 7, name: '箕宿', pinyin: 'Ji', palace: '东方苍龙',
      asterism: '箕宿一至四', raStart: 279.64, raEnd: 292.5,
      meaning: '苍龙之尾末，箕者簸扬之具，东方七宿以此为终点。',
      locate: '主体在人马座尾部与盾牌座，是东方苍龙与北方玄武的交界宿。',
      season: '小暑前后',
      boundary: '宿度为传统划分，与现代星座边界并非一一对应。',
      stars: [
        { name: '箕宿一', con: '人马座', ra: 276.99, dec: -25.42, mag: 2.06 },
        { name: '箕宿三', con: '人马座', ra: 271.45, dec: -29.88, mag: 2.59 }
      ]
    },

    /* ---------------- 北方玄武七宿（斗至壁） */
    {
      index: 8, name: '斗宿', pinyin: 'Dou', palace: '北方玄武',
      asterism: '斗宿一至四（南斗）', raStart: 292.5, raEnd: 305.36,
      meaning: '玄武之首，南斗六星之柄，与北斗七星相对成柄。',
      locate: '主体在人马座与蛇夫座一带，四星组成菱形，是南斗的标志。',
      season: '大暑前后',
      boundary: '南斗六星为星名，不引申为吉凶之占。',
      stars: [
        { name: '斗宿一', con: '蛇夫座', ra: 300.41, dec: -1.44, mag: 3.76 },
        { name: '斗宿二', con: '蛇夫座', ra: 301.86, dec: 0.13, mag: 3.85 }
      ]
    },
    {
      index: 9, name: '牛宿', pinyin: 'Niu', palace: '北方玄武',
      asterism: '牛宿一至四（牛郎星）', raStart: 305.36, raEnd: 318.21,
      meaning: '玄武之牛，牛郎织女隔天河相望，牵牛即此宿。',
      locate: '主星为天鹰座 β，即民间所称牛郎星，与织女星隔银河相望。',
      season: '立秋前后',
      boundary: '牛郎织女的传说属文学叙事，不作配偶运势判断。',
      stars: [{ name: '牛宿一', con: '天鹰座', ra: 298.83, dec: 8.87, mag: 0.76 }]
    },
    {
      index: 10, name: '女宿', pinyin: 'Nv', palace: '北方玄武',
      asterism: '女宿一至四（织女）', raStart: 318.21, raEnd: 331.07,
      meaning: '玄武之女，织女星所在，主布帛与纺织之象。',
      locate: '主星为天琴座 α，即织女星，是北半球夏季大三角的东端顶点。',
      season: '处暑前后',
      boundary: '民俗七夕诸说为文化传说，不作婚期择日依据。',
      stars: [{ name: '女宿一', con: '天琴座', ra: 279.16, dec: 38.78, mag: 0.03 }]
    },
    {
      index: 11, name: '虚宿', pinyin: 'Xu', palace: '北方玄武',
      asterism: '虚宿一至二', raStart: 331.07, raEnd: 343.93,
      meaning: '玄武之虚，意为虚空处，宿度较大而星数较少。',
      locate: '主体在宝瓶座，星数稀少，古人以此为「天田」与虚位。',
      season: '白露前后',
      boundary: '宿虚之名不引申为任何人事结论。',
      stars: [{ name: '虚宿一', con: '宝瓶座', ra: 338.19, dec: -9.10, mag: 2.87 }]
    },
    {
      index: 12, name: '危宿', pinyin: 'Wei', palace: '北方玄武',
      asterism: '危宿一至三', raStart: 343.93, raEnd: 356.79,
      meaning: '玄武之危，危者高峻而欲倾，宿位居北天极之侧。',
      locate: '主体在宝瓶座与南鱼座之间，含北落师门所在的水瓶座一带。',
      season: '秋分前后',
      boundary: '「危」仅为宿名与图形描述，不作吉凶断语。',
      stars: [
        { name: '危宿一', con: '宝瓶座', ra: 343.66, dec: 1.39, mag: 2.96 },
        { name: '危宿三', con: '宝瓶座', ra: 351.85, dec: -11.32, mag: 4.11 }
      ]
    },
    {
      index: 13, name: '室宿', pinyin: 'Shi', palace: '北方玄武',
      asterism: '室宿一至二（北落师门）', raStart: 356.79, raEnd: 369.64,
      meaning: '玄武之室，室者营室与营帐，为北天之中枢。',
      locate: '主星为宝瓶座 β，即北落师门，是秋季南天最易辨识的亮星之一。',
      season: '霜降前后',
      boundary: '北落师门为恒星名，古称「王良」，不作占断。',
      stars: [{ name: '室宿一', con: '宝瓶座', ra: 322.89, dec: -5.57, mag: 2.90 }]
    },
    {
      index: 14, name: '壁宿', pinyin: 'Bi', palace: '北方玄武',
      asterism: '壁宿一至五（飞廉）', raStart: 369.64, raEnd: 382.5,
      meaning: '玄武之壁，壁者垣墙，与室宿同为北宫垣壁之象。',
      locate: '主体在飞马座与仙女座，含北天极附近的亮星，故此宿拱卫北极。',
      season: '立冬前后',
      boundary: '宿次沿赤道等分，不等于现代星座的边界。',
      stars: [
        { name: '壁宿一', con: '飞马座', ra: 346.19, dec: 15.18, mag: 2.49 },
        { name: '壁宿二', con: '仙女座', ra: 2.10, dec: 29.09, mag: 2.07 }
      ]
    },

    /* ---------------- 西方白虎七宿（奎至参） */
    {
      index: 15, name: '奎宿', pinyin: 'Kui', palace: '西方白虎',
      asterism: '奎宿一至十六', raStart: 382.5, raEnd: 395.36,
      meaning: '白虎之足，奎为天驷之骨，星数众多，主体在仙女座。',
      locate: '主体在仙女座与仙女座大星云方向，是西方白虎诸宿中星数最多者。',
      season: '小雪前后',
      boundary: '奎宿跨越多个现代星座，不作个人星命依据。',
      stars: [
        { name: '奎宿一', con: '仙女座', ra: 2.02, dec: 29.09, mag: 2.07 },
        { name: '奎宿五', con: '仙女座', ra: 1.16, dec: 30.86, mag: 3.87 }
      ]
    },
    {
      index: 16, name: '娄宿', pinyin: 'Lou', palace: '西方白虎',
      asterism: '娄宿一至三', raStart: 395.36, raEnd: 408.21,
      meaning: '白虎之首，娄与「留」通，宿星三颗紧密相连。',
      locate: '主星为白羊座 β、γ、δ 三星连线，是白虎七宿的起点星官。',
      season: '大雪前后',
      boundary: '宿名取象于兽体结构，不作方位吉凶判断。',
      stars: [
        { name: '娄宿一', con: '白羊座', ra: 28.66, dec: 19.29, mag: 2.64 },
        { name: '娄宿二', con: '白羊座', ra: 28.38, dec: 21.16, mag: 3.93 }
      ]
    },
    {
      index: 17, name: '胃宿', pinyin: 'Wei', palace: '西方白虎',
      asterism: '胃宿一至三（天厕）', raStart: 408.21, raEnd: 421.07,
      meaning: '白虎之腹，胃为仓廪，宿星在白羊与鲸鱼之间。',
      locate: '主体在白羊座西侧，与昴宿紧邻，是白虎七宿中位置最西的一宿。',
      season: '冬至前后',
      boundary: '宿度沿天赤道划分，不据以推断个人方位。',
      stars: [{ name: '胃宿一', con: '白羊座', ra: 45.57, dec: 9.88, mag: 3.86 }]
    },
    {
      index: 18, name: '昴宿', pinyin: 'Mao', palace: '西方白虎',
      asterism: '昴宿一至七（畢月）', raStart: 421.07, raEnd: 433.93,
      meaning: '白虎之肩，昴为一团紧密星团，古称「月」，是西方宿的标志。',
      locate: '主星为金牛座 Pleiades 星团，是全天最著名的疏散星团，约 100 颗。',
      season: '小寒前后',
      boundary: '昴宿为星团名，不作命理论断。',
      stars: [
        { name: '昴宿一', con: '金牛座', ra: 56.22, dec: 24.11, mag: 2.86 },
        { name: '昴宿六', con: '金牛座', ra: 57.29, dec: 24.05, mag: 3.00 }
      ]
    },
    {
      index: 19, name: '毕宿', pinyin: 'Bi', palace: '西方白虎',
      asterism: '毕宿一至九（天阴）', raStart: 433.93, raEnd: 446.79,
      meaning: '白虎之体，毕为网罟之象，宿星跨金牛与猎户两座。',
      locate: '主体在金牛座与猎户座，含大陵五这一著名变星所在的毕宿五星团。',
      season: '立春前后',
      boundary: '毕宿主星虽属猎户，但按宿度仍归白虎之体；此为天区归属说明，不据以断人事吉凶。',
      stars: [
        { name: '毕宿一', con: '猎户座', ra: 83.00, dec: -9.67, mag: 2.77 },
        { name: '毕宿五', con: '猎户座', ra: 83.18, dec: -8.20, mag: 3.12 }
      ]
    },
    {
      index: 20, name: '觜宿', pinyin: 'Zi', palace: '西方白虎',
      asterism: '觜宿一至三', raStart: 446.79, raEnd: 459.64,
      meaning: '白虎之吻，觜者鸟喙，星数少而位置关键。',
      locate: '主体在猎户座肩部，紧接毕宿，是西方白虎的倒数第二宿。',
      season: '雨水前后',
      boundary: '宿名取自鸟兽形象，不作人事判断。',
      stars: [{ name: '觜宿一', con: '猎户座', ra: 86.94, dec: -2.40, mag: 3.86 }]
    },
    {
      index: 21, name: '参宿', pinyin: 'Shen', palace: '西方白虎',
      asterism: '参宿一至七（伐）', raStart: 459.64, raEnd: 472.5,
      meaning: '白虎之首末，参为二十八宿之名，主体即猎户座三星。',
      locate: '即猎户座腰带三星（参宿一、二、三），是西方宿的标志星组。',
      season: '惊蛰前后',
      boundary: '参宿三星为实际恒星，非命名星，不作命定之基。',
      stars: [
        { name: '参宿一', con: '猎户座', ra: 84.05, dec: -8.20, mag: 2.23 },
        { name: '参宿二', con: '猎户座', ra: 84.65, dec: -1.94, mag: 1.64 },
        { name: '参宿三', con: '猎户座', ra: 85.19, dec: -1.94, mag: 1.88 }
      ]
    },

    /* ---------------- 南方朱雀七宿（井至轸） */
    {
      index: 22, name: '井宿', pinyin: 'Jing', palace: '南方朱雀',
      asterism: '井宿一至八（南斗）', raStart: 472.5, raEnd: 485.36,
      meaning: '朱雀之目，井为水泉之象，宿星成井字形排列。',
      locate: '主体在双子座与巨蟹座之间，含南河三等亮星。',
      season: '春分前后',
      boundary: '南斗诸星为星官名，不作星命判断。',
      stars: [
        { name: '井宿一', con: '双子座', ra: 113.65, dec: -23.83, mag: 3.53 },
        { name: '井宿三', con: '巨蟹座', ra: 124.13, dec: -18.15, mag: 3.94 }
      ]
    },
    {
      index: 23, name: '鬼宿', pinyin: 'Gui', palace: '南方朱雀',
      asterism: '鬼宿一至四（舆尸）', raStart: 485.36, raEnd: 498.21,
      meaning: '朱雀之颈，鬼者幽暗，宿星含著名的鬼星团。',
      locate: '主体在巨蟹座与长蛇座，含 M44 鬼星团，俗称「蜂巢星云」。',
      season: '谷雨前后',
      boundary: '鬼宿名称不引申为吉凶之占。',
      stars: [{ name: '鬼宿一', con: '巨蟹座', ra: 130.15, dec: -18.10, mag: 4.25 }]
    },
    {
      index: 24, name: '柳宿', pinyin: 'Liu', palace: '南方朱雀',
      asterism: '柳宿一至四（酒旗）', raStart: 498.21, raEnd: 511.07,
      meaning: '朱雀之翼，柳为柔枝，宿星在长蛇座一带。',
      locate: '主体在长蛇座尾部，与星宿、张宿相接，是朱雀七宿中最靠西的一宿。',
      season: '立夏前后',
      boundary: '宿度划分沿天赤道，不据以断方位吉凶。',
      stars: [
        { name: '柳宿一', con: '长蛇座', ra: 141.90, dec: -24.72, mag: 3.11 },
        { name: '柳宿三', con: '长蛇座', ra: 147.44, dec: -23.87, mag: 3.49 }
      ]
    },
    {
      index: 25, name: '星宿', pinyin: 'Xing', palace: '南方朱雀',
      asterism: '星宿一至七（天关）', raStart: 511.07, raEnd: 523.93,
      meaning: '朱雀之目星，星者七政之一，宿星密集于长蛇与巨爵之间。',
      locate: '主体在长蛇座与鲸鱼座，是朱雀七宿中最靠西的一宿。',
      season: '小满前后',
      boundary: '「星宿」为天区名，不作现代星座命盘使用。',
      stars: [
        { name: '星宿一', con: '长蛇座', ra: 141.90, dec: -24.72, mag: 3.11 },
        { name: '星宿二', con: '长蛇座', ra: 152.09, dec: -23.89, mag: 3.76 }
      ]
    },
    {
      index: 26, name: '张宿', pinyin: 'Zhang', palace: '南方朱雀',
      asterism: '张宿一至六（天庙）', raStart: 523.93, raEnd: 536.79,
      meaning: '朱雀之翼，张者张弓，宿星沿长蛇与室女之间分布。',
      locate: '主体在长蛇座与室女座，含巴纳德星一带，是六等以下的暗星集中区。',
      season: '芒种前后',
      boundary: '宿名取象于鸟体，不作占断。',
      stars: [{ name: '张宿一', con: '长蛇座', ra: 163.07, dec: -24.62, mag: 4.43 }]
    },
    {
      index: 27, name: '翼宿', pinyin: 'Yi', palace: '南方朱雀',
      asterism: '翼宿一至六（东瓯）', raStart: 536.79, raEnd: 549.64,
      meaning: '朱雀之翼，翼者张翼而行，宿星在巨爵与长蛇一带。',
      locate: '主体在巨爵座与长蛇座一带，星数不多，位置靠近南天低空。',
      season: '夏至前后',
      boundary: '宿度沿赤道排列，与现代星座边界不同，不据以断方位吉凶。',
      stars: [{ name: '翼宿一', con: '长蛇座', ra: 186.65, dec: -17.95, mag: 4.30 }]
    },
    {
      index: 28, name: '轸宿', pinyin: 'Zhen', palace: '南方朱雀',
      asterism: '轸宿一至四（天社）', raStart: 549.64, raEnd: 562.5,
      meaning: '朱雀之尾，轸者车之后望，二十八宿至此而周天复始。',
      locate: '主体在长蛇座与乌鸦座一带，轸宿四即著名的角宿一所在方向。',
      season: '小暑前后',
      boundary: '轸宿为周天终点，衔接角宿，不作命运推断。',
      stars: [
        { name: '轸宿一', con: '长蛇座', ra: 195.54, dec: -19.81, mag: 4.11 },
        { name: '轸宿四', con: '乌鸦座', ra: 183.95, dec: -17.54, mag: 4.02 }
      ]
    }
  ];

  global.XiuData = {
    version: 'xiu-data-1.0.0',
    palaces: palaces,
    lodges: lodges
  };
})(typeof window !== 'undefined' ? window : globalThis);