/**
 * 符箓逐项设计清单与来源分级（1.9.0 新增）
 *
 * ============================================================
 * 一、这个文件解决什么
 * ============================================================
 * 1.8.4 的 100 条符箓虽然各有名称，但 fulu-art.js 只按 **10 个类别的通用
 * 版式**绘制，套上文字即成 —— 实测多数成品「只换字不换形」。
 *
 * 1.9.0 要求：100 个图形**可明显区分**，靠**结构参数与矢量路径**区分，
 * **不得**靠换色、变线宽、加随机噪声充数。
 *
 * 本文件为 100 条各提供：
 *   art   —— 独立的图形结构参数（布局骨架、纹样组合、笔画走向）
 *   prov  —— 来源分级与说明（见 §二）
 *
 * 可复用的是**渲染器**（纸张、笔触、文字排版），
 * 不可复用**完整图形模板** —— 故art 各不相同。
 *
 * ============================================================
 * 二、来源分级（硬条件，见 docs/visual-spec-1.9.0.md §6.3）
 * ============================================================
 *   museum     有馆藏 / 图录对应的摹绘
 *   literature 有文献记载的形制
 *   original   基于传统符文化视觉语言的**原创装饰**
 *   unverified 来源未能核实
 *
 * 铁律：
 *   - 不得把原创图说成道教正统真符
 *   - 不得凭类别把某尊神、符式、仪轨或功效强行对应
 *   - 来源不足者诚实标注，必要时改写名称或说明
 *   - 不得编造出处以凑数
 *
 * 【1.9.0 现状说明】本次未能访问外部图录与影印本，
 * **无法逐条核实到馆藏编号或文献页码**。故：
 *   - 名称中含具体神祇/法派者（如「太上老君」「五雷号令」）
 *     —— 这些**名号本身**确有传统记载，标为 literature，
 *       但**图形**为原创绘制，来源字段会写明「名号有据，图形原创」；
 *   - 其余泛用名目者标为 original；
 *   - 凡本软件自行拟定的名称（如 F202 符水化煞法符、F410 火气安神符）
 *     一律标为 original 并在说明中注明「本软件拟名」。
 * 后续若取得可核验资料，只需更新 prov.level 与 prov.ref 即可，
 * 无需改动 art。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const api = factory();
    if (typeof globalThis !== 'undefined') globalThis.FuluDesign = api;
    module.exports = api;
  } else root.FuluDesign = factory();
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /* ============================================================
   * 三、图形结构参数（art）—— 100 条各不相同
   *
   * 字段说明：
   *   frame  边框样式：'double'双线 / 'bracket'角括 / 'rail'双栏 /
   *                  'seal'印框 / 'ribbon'缎带 / 'none'
   *   branch 符枝样式：'s' S形 / 'w' 双波 / 'r' 直龙 / 'v' 垂帘 /
   *                  'y' 云丫 / 'o' 环抱
   *   top    顶部器物：'taiji'太极 / 'bagua'八卦 / 'sun'日轮 /
   *                  'moon'月轮 / 'flame'火焰 / 'none'
   *   core   盘心主体：'dan'大字符胆 / 'dou'豆灯 / 'eye'慧目 /
   *                  'knot'盘长 / 'coin'金钱 / 'seal'印
   *   foot   符脚纹样：'bagua'八卦 / 'lotus'莲座 / 'knot'盘长 /
   *                  'coin'金钱 / 'scroll'卷轴 / 'mountain'山 /
   *                  'flame'火焰 / 'dragon'龙 / 'taiji'太极 / 'wave'水波
   *   inner  内部辅助纹样：'yao'爻线 / 'dots'星点 / 'ring'环带 /
   *                  'grid'网格 / 'vine'藤蔓 / 'bar'横栏
   *   grain  笔触性格：'fine'极细 / 'dry'飞白 / 'bold'稍重
   *   layout 构图布局：'center'中轴对称 / 'split'左右分栏 / 'stack'三层叠压
   */

  /* 逐项设计表：id → art + prov
   * art 的每个字段都是**结构**差异，不是颜色或粗细差异。*/
  const DESIGN = {
    /* ---------------- 护身 12 条 ---------------- */
    F001: { frame: 'triple', branch: 'y', top: 'flame', core: 'dan', foot: 'wave', inner: 'yao', grain: 'fine', layout: 'center',
      prov: { level: 'literature', note: '「太上老君」「急急如律令」为道教咒语与尊号，有传统记载；图形为原创绘制' } },
    F002: { frame: 'double', branch: 'tuft', top: 'none', core: 'coin', foot: 'flame', inner: 'vine', grain: 'fine', layout: 'center',
      prov: { level: 'literature', note: '「九天玄女」为道教尊神名号，有传统记载；图形为原创绘制' } },
    F003: { frame: 'rail', branch: 'spiral', top: 'gate', core: 'coin', foot: 'dragon', inner: 'grid', grain: 'fine', layout: 'stack',
      prov: { level: 'literature', note: '「北斗」信仰有传统记载；「延生」为传统祈愿语；图形为原创绘制' } },
    F004: { frame: 'double', branch: 's', top: 'moon', core: 'lotus', foot: 'coin', inner: 'grid', grain: 'bold', layout: 'stack',
      prov: { level: 'literature', note: '「三清」为道教最高尊神 trio，有传统记载；图形为原创绘制' } },
    F005: { frame: 'notch', branch: 'tuft', top: 'sun', core: 'dot', foot: 'dragon', inner: 'rune', grain: 'bold', layout: 'center',
      prov: { level: 'literature', note: '「五雷号令」为道教雷部法名，有传统记载；图形为原创绘制' } },
    F006: { frame: 'seal', branch: 'ladder', top: 'none', core: 'knot', foot: 'lotus', inner: 'yao', grain: 'fine', layout: 'split',
      prov: { level: 'literature', note: '「关圣帝君」为道教护法神名号，有传统记载；图形为原创绘制' } },
    F007: { frame: 'seal', branch: 'w', top: 'bagua', core: 'lotus', foot: 'coin', inner: 'ring', grain: 'bold', layout: 'center',
      prov: { level: 'literature', note: '「城隍」为传统守护神信仰，有记载；图形为原创绘制' } },
    F008: { frame: 'bracket', branch: 'w', top: 'gate', core: 'dou', foot: 'knot', inner: 'rune', grain: 'bold', layout: 'stack',
      prov: { level: 'original', note: '「金甲神」为护身类通用称谓，未见统一经典形制；本软件拟名与原创图形' } },
    F009: { frame: 'notch', branch: 'r', top: 'pearl', core: 'eye', foot: 'mountain', inner: 'rune', grain: 'bold', layout: 'split',
      prov: { level: 'literature', note: '「青龙白虎」为传统四象中的东方七宿与西方七宿，有记载；图形为原创绘制' } },
    F010: { frame: 'bracket', branch: 's', top: 'flame', core: 'lotus', foot: 'coin', inner: 'spiral', grain: 'dry', layout: 'center',
      prov: { level: 'original', note: '「赦罪解厄」为传统祈愿语，具体符式未见统一经典形制；本软件拟名与原创图形' } },
    F011: { frame: 'bracket', branch: 'r', top: 'gate', core: 'dot', foot: 'dragon', inner: 'ring', grain: 'bold', layout: 'stack',
      prov: { level: 'literature', note: '「六甲六丁」为道教神将体系，有传统记载；图形为原创绘制' } },
    F012: { frame: 'triple', branch: 'o', top: 'pearl', core: 'lotus', foot: 'coin', inner: 'vine', grain: 'dry', layout: 'split',
      prov: { level: 'literature', note: '「山岳」为传统山神信仰，有记载；图形为原创绘制' } },

    /* ---------------- 镇宅 11 条 ---------------- */
    F101: { frame: 'cloud', branch: 'o', top: 'pagoda', core: 'dot', foot: 'lotus', inner: 'ring', grain: 'fine', layout: 'center',
      prov: { level: 'literature', note: '麒麟为中国传统瑞兽，「麒麟镇宅」为民间吉祥语，有民俗记载；图形为原创绘制' } },
    F102: { frame: 'rail', branch: 's', top: 'pagoda', core: 'dan', foot: 'knot', inner: 'grid', grain: 'bold', layout: 'stack',
      prov: { level: 'literature', note: '「泰山石敢当」为确有传统的民俗实物（有建筑遗存与文献）；本软件的图形为原创示意，非实物摹绘' } },
    F103: { frame: 'double', branch: 'spiral', top: 'flame', core: 'dou', foot: 'flame', inner: 'yao', grain: 'fine', layout: 'stack',
      prov: { level: 'literature', note: '八卦为《周易》体系，有经典依据；图形为原创绘制' } },
    F104: { frame: 'ribbon', branch: 's', top: 'pearl', core: 'sword', foot: 'scroll', inner: 'ring', grain: 'bold', layout: 'split',
      prov: { level: 'literature', note: '「紫微」为传统星名，有记载；图形为原创绘制' } },
    F105: { frame: 'cloud', branch: 'ladder', top: 'moon', core: 'lotus', foot: 'lotus', inner: 'yao', grain: 'dry', layout: 'center',
      prov: { level: 'literature', note: '「姜太公在此」为确有传统的民俗门帖用语；图形为原创绘制' } },
    F106: { frame: 'notch', branch: 'y', top: 'moon', core: 'seal', foot: 'lotus', inner: 'vine', grain: 'fine', layout: 'center',
      prov: { level: 'literature', note: '「五福」为传统福文化概念（《尚书·洪范》有载）；图形为原创绘制' } },
    F107: { frame: 'cloud', branch: 'o', top: 'taiji', core: 'coin', foot: 'dragon', inner: 'grid', grain: 'bold', layout: 'stack',
      prov: { level: 'literature', note: '「龙神」为传统龙神信仰，有记载；图形为原创绘制' } },
    F108: { frame: 'ribbon', branch: 'spiral', top: 'bagua', core: 'dot', foot: 'scroll', inner: 'yao', grain: 'dry', layout: 'stack',
      prov: { level: 'original', note: '「旺宅」为风水类通用词，具体符式未见统一经典形制；本软件拟名与原创图形' } },
    F109: { frame: 'notch', branch: 'tuft', top: 'bagua', core: 'eye', foot: 'mountain', inner: 'spiral', grain: 'bold', layout: 'stack',
      prov: { level: 'original', note: '化煞类通用名目，具体符式未见统一经典形制；本软件拟名与原创图形' } },
    F110: { frame: 'pillar', branch: 'y', top: 'taiji', core: 'gourd', foot: 'scroll', inner: 'yao', grain: 'dry', layout: 'stack',
      prov: { level: 'original', note: '「阴阳交界」为传统堪舆用语，具体符式未见统一经典形制；本软件拟名与原创图形' } },
    F111: { frame: 'ribbon', branch: 's', top: 'moon', core: 'dou', foot: 'lotus', inner: 'lotus', grain: 'dry', layout: 'center',
      prov: { level: 'literature', note: '「宅神」为传统宅居守护神，有民俗记载；图形为原创绘制' } },

    /* ---------------- 化煞 12 条 ---------------- */
    F201: { frame: 'cloud', branch: 'w', top: 'gate', core: 'dan', foot: 'flame', inner: 'yao', grain: 'bold', layout: 'stack',
      prov: { level: 'original', note: '化煞类通用名目，具体符式未见统一经典形制；本软件拟名与原创图形' } },
    F202: { frame: 'ribbon', branch: 'y', top: 'flame', core: 'lotus', foot: 'dragon', inner: 'dots', grain: 'dry', layout: 'center',
      prov: { level: 'original', note: '「符水」相关做法在民俗中有零星记载，但无统一经典符式；本软件拟名与原创图形' } },
    F203: { frame: 'notch', branch: 'tuft', top: 'none', core: 'sword', foot: 'knot', inner: 'rune', grain: 'fine', layout: 'split',
      prov: { level: 'literature', note: '「北斗」信仰有传统记载；图形为原创绘制' } },
    F204: { frame: 'triple', branch: 'w', top: 'bagua', core: 'seal', foot: 'coin', inner: 'vine', grain: 'fine', layout: 'stack',
      prov: { level: 'literature', note: '「南斗」为传统星名，与北斗相对，有记载；图形为原创绘制' } },
    F205: { frame: 'seal', branch: 'o', top: 'pearl', core: 'sword', foot: 'dragon', inner: 'yao', grain: 'dry', layout: 'split',
      prov: { level: 'literature', note: '「禳星」为传统禳解法名，有民俗记载；图形为原创绘制' } },
    F206: { frame: 'double', branch: 'spiral', top: 'bagua', core: 'dot', foot: 'mountain', inner: 'grid', grain: 'bold', layout: 'stack',
      prov: { level: 'literature', note: '「天师」为道教张道陵称号，有传统记载；图形为原创绘制' } },
    F207: { frame: 'ribbon', branch: 'ladder', top: 'none', core: 'dot', foot: 'flame', inner: 'spiral', grain: 'fine', layout: 'split',
      prov: { level: 'original', note: '「斩妖除邪」为传统道教职能表述，具体符式未见统一经典形制；本软件拟名与原创图形' } },
    F208: { frame: 'cloud', branch: 'r', top: 'pagoda', core: 'dou', foot: 'lotus', inner: 'bar', grain: 'dry', layout: 'center',
      prov: { level: 'original', note: '化病类通用名目；本软件不作任何医学功效表述，图形为原创绘制' } },
    F209: { frame: 'rail', branch: 'w', top: 'pearl', core: 'coin', foot: 'scroll', inner: 'ring', grain: 'dry', layout: 'stack',
      prov: { level: 'literature', note: '「太岁」信仰为传统民俗，有丰富记载；图形为原创绘制' } },
    F210: { frame: 'triple', branch: 'tuft', top: 'none', core: 'gourd', foot: 'bagua', inner: 'lotus', grain: 'fine', layout: 'stack',
      prov: { level: 'literature', note: '「孤辰寡宿」为传统星命概念，有典籍记载；图形为原创绘制' } },
    F211: { frame: 'cloud', branch: 'tuft', top: 'bagua', core: 'dou', foot: 'bagua', inner: 'dots', grain: 'bold', layout: 'split',
      prov: { level: 'original', note: '「阴宅阳宅通用」为本软件设定的适用场景描述，非传统符式名；原创图形' } },
    F212: { frame: 'rail', branch: 'spiral', top: 'flame', core: 'gourd', foot: 'flame', inner: 'dots', grain: 'bold', layout: 'center',
      prov: { level: 'literature', note: '「五黄」为传统堪舆概念，有典籍记载；图形为原创绘制' } },

    /* ---------------- 消灾 10 条 ---------------- */
    F301: { frame: 'triple', branch: 'r', top: 'bagua', core: 'gourd', foot: 'mountain', inner: 'ring', grain: 'fine', layout: 'stack',
      prov: { level: 'original', note: '消灾延寿为传统祈愿语，具体符式未见统一经典形制；本软件拟名与原创图形' } },
    F302: { frame: 'seal', branch: 'tuft', top: 'pagoda', core: 'coin', foot: 'bagua', inner: 'spiral', grain: 'bold', layout: 'center',
      prov: { level: 'original', note: '祈福消灾为传统祈愿语；本软件拟名与原创图形' } },
    F303: { frame: 'cloud', branch: 's', top: 'gate', core: 'eye', foot: 'coin', inner: 'bar', grain: 'dry', layout: 'split',
      prov: { level: 'literature', note: '「太岁」信仰有传统记载；图形为原创绘制' } },
    F304: { frame: 'triple', branch: 'tuft', top: 'pearl', core: 'dot', foot: 'mountain', inner: 'lotus', grain: 'bold', layout: 'center',
      prov: { level: 'original', note: '「本命年」为传统民俗概念，有记载；具体符式为本软件原创' } },
    F305: { frame: 'seal', branch: 'tuft', top: 'taiji', core: 'eye', foot: 'lotus', inner: 'ring', grain: 'dry', layout: 'stack',
      prov: { level: 'literature', note: '「关圣帝君」为传统护法神名号；本软件不作驱邪功效承诺，图形为原创绘制' } },
    F306: { frame: 'ribbon', branch: 'o', top: 'moon', core: 'lotus', foot: 'mountain', inner: 'rune', grain: 'dry', layout: 'center',
      prov: { level: 'literature', note: '「灶君」为传统家宅神，有民俗记载；图形为原创绘制' } },
    F307: { frame: 'notch', branch: 'spiral', top: 'taiji', core: 'dot', foot: 'flame', inner: 'grid', grain: 'fine', layout: 'split',
      prov: { level: 'literature', note: '「土地」为传统地神信仰，有记载；图形为原创绘制' } },
    F308: { frame: 'cloud', branch: 'spiral', top: 'flame', core: 'dot', foot: 'dragon', inner: 'vine', grain: 'fine', layout: 'center',
      prov: { level: 'original', note: '本软件不作任何医学功效表述；图形为原创绘制' } },
    F309: { frame: 'ribbon', branch: 'r', top: 'sun', core: 'knot', foot: 'lotus', inner: 'grid', grain: 'bold', layout: 'stack',
      prov: { level: 'original', note: '祈雨为传统民间祈愿民俗；具体符式为本软件原创' } },
    F310: { frame: 'notch', branch: 'w', top: 'moon', core: 'lotus', foot: 'flame', inner: 'ring', grain: 'fine', layout: 'split',
      prov: { level: 'original', note: '「镇静安神」为传统养生语汇；本软件不作健康功效承诺，图形为原创绘制' } },

    /* ---------------- 调身 11 条（五脏按五行分族，各有独立图形） ---------------- */
    F401: { frame: 'double', branch: 'o', top: 'pearl', core: 'coin', foot: 'scroll', inner: 'grid', grain: 'dry', layout: 'center',
      prov: { level: 'literature', note: '「调五脏」对应传统脏腑学说（木属肝）；不作医学承诺，图形为原创绘制' } },
    F402: { frame: 'cloud', branch: 'v', top: 'gate', core: 'seal', foot: 'scroll', inner: 'ring', grain: 'bold', layout: 'split',
      prov: { level: 'literature', note: '「调五脏」对应传统脏腑学说（火属心）；不作医学承诺，图形为原创绘制' } },
    F403: { frame: 'pillar', branch: 'w', top: 'none', core: 'dou', foot: 'scroll', inner: 'dots', grain: 'dry', layout: 'center',
      prov: { level: 'literature', note: '「调五脏」对应传统脏腑学说（土属脾）；不作医学承诺，图形为原创绘制' } },
    F404: { frame: 'notch', branch: 'o', top: 'moon', core: 'dot', foot: 'dragon', inner: 'spiral', grain: 'fine', layout: 'stack',
      prov: { level: 'literature', note: '「调五脏」对应传统脏腑学说（金属肺）；不作医学承诺，图形为原创绘制' } },
    F405: { frame: 'notch', branch: 'spiral', top: 'bagua', core: 'sword', foot: 'coin', inner: 'grid', grain: 'bold', layout: 'center',
      prov: { level: 'literature', note: '「调五脏」对应传统脏腑学说（水属肾）；不作医学承诺，图形为原创绘制' } },
    F406: { frame: 'seal', branch: 'spiral', top: 'bagua', core: 'gourd', foot: 'bagua', inner: 'rune', grain: 'dry', layout: 'center',
      prov: { level: 'original', note: '「补气养元」为传统养生语汇；不作健康功效承诺，图形为原创绘制' } },
    F407: { frame: 'pillar', branch: 'r', top: 'moon', core: 'dou', foot: 'lotus', inner: 'dots', grain: 'fine', layout: 'center',
      prov: { level: 'original', note: '「延年益寿」为传统祈愿语；不作健康功效承诺，图形为原创绘制' } },
    F408: { frame: 'rail', branch: 'y', top: 'pearl', core: 'sword', foot: 'flame', inner: 'grid', grain: 'dry', layout: 'center',
      prov: { level: 'literature', note: '「调息」为传统养生法门，有记载；不作健康功效承诺，图形为原创绘制' } },
    F409: { frame: 'ribbon', branch: 'spiral', top: 'pearl', core: 'coin', foot: 'knot', inner: 'bar', grain: 'fine', layout: 'stack',
      prov: { level: 'original', note: '「养心」为传统养生语汇；不作健康功效承诺，图形为原创绘制' } },
    F410: { frame: 'ribbon', branch: 'y', top: 'bagua', core: 'dot', foot: 'dragon', inner: 'grid', grain: 'fine', layout: 'stack',
      prov: { level: 'original', note: '「火气」相关表述为传统养生语汇；本软件不作健康功效承诺，图形为原创绘制' } },
    F411: { frame: 'triple', branch: 'o', top: 'sun', core: 'dan', foot: 'coin', inner: 'vine', grain: 'bold', layout: 'stack',
      prov: { level: 'original', note: '「安神」为传统养生语汇；不作健康功效承诺，图形为原创绘制' } },

    /* ---------------- 婚姻 10 条 ---------------- */
    F501: { frame: 'pillar', branch: 'tuft', top: 'none', core: 'seal', foot: 'bagua', inner: 'ring', grain: 'bold', layout: 'stack',
      prov: { level: 'literature', note: '「月老」为传统婚姻神信仰，有丰富民俗记载；图形为原创绘制' } },
    F502: { frame: 'ribbon', branch: 'r', top: 'flame', core: 'lotus', foot: 'lotus', inner: 'bar', grain: 'dry', layout: 'split',
      prov: { level: 'literature', note: '「和合」为传统婚恋祈愿语，有记载；图形为原创绘制' } },
    F503: { frame: 'triple', branch: 'spiral', top: 'bagua', core: 'lotus', foot: 'knot', inner: 'vine', grain: 'dry', layout: 'center',
      prov: { level: 'original', note: '「良缘」为传统婚恋祈愿语；本软件拟名与原创图形' } },
    F504: { frame: 'rail', branch: 's', top: 'none', core: 'eye', foot: 'dragon', inner: 'vine', grain: 'dry', layout: 'split',
      prov: { level: 'original', note: '「同心」为传统婚恋祈愿语；本软件拟名与原创图形' } },
    F505: { frame: 'pillar', branch: 'o', top: 'pagoda', core: 'gourd', foot: 'mountain', inner: 'spiral', grain: 'bold', layout: 'center',
      prov: { level: 'literature', note: '「鸳鸯」为中国传统爱情意象，有文学与民俗记载；图形为原创绘制' } },
    F506: { frame: 'cloud', branch: 'o', top: 'pagoda', core: 'lotus', foot: 'scroll', inner: 'spiral', grain: 'dry', layout: 'stack',
      prov: { level: 'original', note: '「百年」为传统婚恋祝语；本软件拟名与原创图形' } },
    F507: { frame: 'triple', branch: 'spiral', top: 'moon', core: 'lotus', foot: 'mountain', inner: 'lotus', grain: 'dry', layout: 'stack',
      prov: { level: 'literature', note: '「三星」为传统星命意象（福禄寿），有记载；图形为原创绘制' } },
    F508: { frame: 'double', branch: 'ladder', top: 'pagoda', core: 'lotus', foot: 'coin', inner: 'vine', grain: 'dry', layout: 'stack',
      prov: { level: 'original', note: '「解怨」为传统祈愿语；本软件拟名与原创图形' } },
    F509: { frame: 'seal', branch: 'r', top: 'none', core: 'dot', foot: 'mountain', inner: 'grid', grain: 'bold', layout: 'split',
      prov: { level: 'original', note: '「财源」与婚姻的关联为民间俗语，非命理依据；本软件拟名与原创图形' } },
    F510: { frame: 'pillar', branch: 'ladder', top: 'sun', core: 'coin', foot: 'dragon', inner: 'spiral', grain: 'bold', layout: 'center',
      prov: { level: 'original', note: '「安家」为传统祈愿语；本软件拟名与原创图形' } },

    /* ---------------- 官禄 10 条 ---------------- */
    F601: { frame: 'triple', branch: 'v', top: 'pearl', core: 'dot', foot: 'mountain', inner: 'rune', grain: 'fine', layout: 'split',
      prov: { level: 'literature', note: '「文昌」为传统文运神信仰，有记载；图形为原创绘制' } },
    F602: { frame: 'notch', branch: 'tuft', top: 'sun', core: 'coin', foot: 'mountain', inner: 'dots', grain: 'fine', layout: 'split',
      prov: { level: 'literature', note: '「魁星」为传统文运神信仰，有记载；图形为原创绘制' } },
    F603: { frame: 'seal', branch: 's', top: 'pagoda', core: 'knot', foot: 'mountain', inner: 'bar', grain: 'fine', layout: 'split',
      prov: { level: 'original', note: '「禄」为传统官职概念（《周礼》有载），具体符式为本软件原创' } },
    F604: { frame: 'seal', branch: 'tuft', top: 'flame', core: 'sword', foot: 'flame', inner: 'rune', grain: 'bold', layout: 'split',
      prov: { level: 'original', note: '「加冠」为传统人生仪节语；本软件拟名与原创图形' } },
    F605: { frame: 'bracket', branch: 'v', top: 'flame', core: 'knot', foot: 'wave', inner: 'rune', grain: 'bold', layout: 'center',
      prov: { level: 'original', note: '「功名」为传统仕途概念；本软件拟名与原创图形' } },
    F606: { frame: 'bracket', branch: 'o', top: 'moon', core: 'dou', foot: 'bagua', inner: 'rune', grain: 'bold', layout: 'split',
      prov: { level: 'original', note: '「晋升」为现代职场语汇，非传统符式名；本软件拟名与原创图形' } },
    F607: { frame: 'double', branch: 'w', top: 'pearl', core: 'lotus', foot: 'scroll', inner: 'bar', grain: 'fine', layout: 'center',
      prov: { level: 'original', note: '「显达」为传统祝语；本软件拟名与原创图形' } },
    F608: { frame: 'cloud', branch: 'spiral', top: 'gate', core: 'lotus', foot: 'dragon', inner: 'yao', grain: 'fine', layout: 'split',
      prov: { level: 'literature', note: '「贵人」为传统命理概念，有典籍记载；图形为原创绘制' } },
    F609: { frame: 'pillar', branch: 'w', top: 'moon', core: 'knot', foot: 'coin', inner: 'dots', grain: 'fine', layout: 'split',
      prov: { level: 'original', note: '「俸禄」为传统官职待遇概念；本软件拟名与原创图形' } },
    F610: { frame: 'ribbon', branch: 'spiral', top: 'pagoda', core: 'coin', foot: 'dragon', inner: 'vine', grain: 'bold', layout: 'center',
      prov: { level: 'original', note: '「差遣」为传统公文语汇；本软件拟名与原创图形' } },

    /* ---------------- 学业 8 条 ---------------- */
    F701: { frame: 'notch', branch: 'w', top: 'sun', core: 'dan', foot: 'mountain', inner: 'lotus', grain: 'bold', layout: 'center',
      prov: { level: 'literature', note: '「文昌」信仰有传统记载；图形为原创绘制' } },
    F702: { frame: 'pillar', branch: 'tuft', top: 'sun', core: 'dot', foot: 'coin', inner: 'bar', grain: 'dry', layout: 'split',
      prov: { level: 'literature', note: '「魁星」信仰有传统记载；图形为原创绘制' } },
    F703: { frame: 'seal', branch: 'spiral', top: 'none', core: 'eye', foot: 'flame', inner: 'yao', grain: 'dry', layout: 'stack',
      prov: { level: 'original', note: '「开智」为传统教化语汇；本软件拟名与原创图形' } },
    F704: { frame: 'rail', branch: 's', top: 'gate', core: 'eye', foot: 'wave', inner: 'yao', grain: 'dry', layout: 'center',
      prov: { level: 'original', note: '「笔启」为传统文人祈愿语；本软件拟名与原创图形' } },
    F705: { frame: 'notch', branch: 'w', top: 'pagoda', core: 'dan', foot: 'lotus', inner: 'rune', grain: 'bold', layout: 'stack',
      prov: { level: 'original', note: '「金榜」源自传统科举，有史实记载；具体符式为本软件原创' } },
    F706: { frame: 'ribbon', branch: 'o', top: 'none', core: 'coin', foot: 'scroll', inner: 'spiral', grain: 'bold', layout: 'center',
      prov: { level: 'original', note: '「题名」源自传统科举，有史实记载；具体符式为本软件原创' } },
    F707: { frame: 'ribbon', branch: 'y', top: 'taiji', core: 'knot', foot: 'bagua', inner: 'bar', grain: 'fine', layout: 'center',
      prov: { level: 'original', note: '「灵感」为现代语汇，非传统符式名；本软件拟名与原创图形' } },
    F708: { frame: 'cloud', branch: 's', top: 'sun', core: 'seal', foot: 'coin', inner: 'yao', grain: 'bold', layout: 'center',
      prov: { level: 'literature', note: '「静心」为传统修身语汇，有记载；不作健康承诺，图形为原创绘制' } },

    /* ---------------- 祈财 9 条 ---------------- */
    F801: { frame: 'bracket', branch: 'spiral', top: 'moon', core: 'sword', foot: 'dragon', inner: 'bar', grain: 'dry', layout: 'stack',
      prov: { level: 'literature', note: '「玄坛」即玄坛赵公明，为传统财神信仰，有记载；图形为原创绘制' } },
    F802: { frame: 'rail', branch: 'spiral', top: 'pagoda', core: 'eye', foot: 'dragon', inner: 'grid', grain: 'dry', layout: 'center',
      prov: { level: 'original', note: '「招财」为传统民俗吉祥语；本软件拟名与原创图形' } },
    F803: { frame: 'bracket', branch: 'r', top: 'moon', core: 'gourd', foot: 'wave', inner: 'yao', grain: 'bold', layout: 'split',
      prov: { level: 'literature', note: '「财帛星君」为传统星名，有记载；图形为原创绘制' } },
    F804: { frame: 'double', branch: 'v', top: 'pagoda', core: 'lotus', foot: 'bagua', inner: 'lotus', grain: 'fine', layout: 'split',
      prov: { level: 'original', note: '「开市」为传统商业习俗用语（《史记》有载）；具体符式为本软件原创' } },
    F805: { frame: 'bracket', branch: 'y', top: 'sun', core: 'knot', foot: 'dragon', inner: 'vine', grain: 'dry', layout: 'center',
      prov: { level: 'original', note: '「利市」为传统商业习俗用语；本软件拟名与原创图形' } },
    F806: { frame: 'triple', branch: 'o', top: 'sun', core: 'eye', foot: 'flame', inner: 'spiral', grain: 'fine', layout: 'center',
      prov: { level: 'original', note: '「通商」为传统商业概念；本软件拟名与原创图形' } },
    F807: { frame: 'seal', branch: 'spiral', top: 'moon', core: 'knot', foot: 'flame', inner: 'bar', grain: 'bold', layout: 'center',
      prov: { level: 'original', note: '「聚宝」为传统吉祥语；本软件拟名与原创图形' } },
    F808: { frame: 'notch', branch: 'ladder', top: 'gate', core: 'dot', foot: 'wave', inner: 'yao', grain: 'bold', layout: 'center',
      prov: { level: 'original', note: '「禄位」为传统官俸概念；本软件拟名与原创图形' } },
    F809: { frame: 'double', branch: 'spiral', top: 'flame', core: 'lotus', foot: 'scroll', inner: 'bar', grain: 'bold', layout: 'split',
      prov: { level: 'original', note: '「纳福」为传统祈愿语；本软件拟名与原创图形' } },

    /* ---------------- 和解 7 条 ---------------- */
    F901: { frame: 'notch', branch: 'ladder', top: 'flame', core: 'sword', foot: 'wave', inner: 'bar', grain: 'bold', layout: 'stack',
      prov: { level: 'literature', note: '「和合」为传统调解祈愿语，有记载；图形为原创绘制' } },
    F902: { frame: 'ribbon', branch: 'spiral', top: 'taiji', core: 'dan', foot: 'mountain', inner: 'bar', grain: 'dry', layout: 'center',
      prov: { level: 'original', note: '「解怨」为传统祈愿语；本软件拟名与原创图形' } },
    F903: { frame: 'cloud', branch: 'tuft', top: 'taiji', core: 'sword', foot: 'mountain', inner: 'yao', grain: 'dry', layout: 'center',
      prov: { level: 'original', note: '「释嫌」为传统祈愿语；本软件拟名与原创图形' } },
    F904: { frame: 'notch', branch: 'r', top: 'taiji', core: 'eye', foot: 'coin', inner: 'grid', grain: 'dry', layout: 'split',
      prov: { level: 'literature', note: '「北斗」信仰有传统记载；图形为原创绘制' } },
    F905: { frame: 'triple', branch: 'v', top: 'gate', core: 'gourd', foot: 'wave', inner: 'rune', grain: 'fine', layout: 'stack',
      prov: { level: 'original', note: '「重归」为传统祈愿语；本软件拟名与原创图形' } },
    F906: { frame: 'pillar', branch: 'r', top: 'bagua', core: 'lotus', foot: 'lotus', inner: 'rune', grain: 'fine', layout: 'split',
      prov: { level: 'literature', note: '「乡邻」为传统社区概念；具体符式为本软件原创' } },
    F907: { frame: 'double', branch: 'r', top: 'gate', core: 'dot', foot: 'mountain', inner: 'vine', grain: 'dry', layout: 'center',
      prov: { level: 'original', note: '「息争」为传统祈愿语；本软件拟名与原创图形' } }
  };

  /* ============================================================
   * 四、对外接口
   * ============================================================ */

  /** 取某符的设计（无记录时返回一个确定性兜底，绝不返回 undefined） */
  function designOf(id, seed) {
    const d = DESIGN[id];
    if (d) return d;
    /* 兜底：按 id 派生稳定结构，保证不崩也不雷同 */
    const n = Math.abs(hash(id)) ;
    return {
      frame: ['double', 'rail', 'seal', 'bracket', 'triple', 'ribbon'][n % 6],
      branch: ['s', 'w', 'r', 'v', 'y', 'o'][(n >> 2) % 6],
      top: ['taiji', 'bagua', 'sun', 'moon', 'flame', 'none'][(n >> 4) % 6],
      core: ['dan', 'dou', 'eye', 'dot', 'knot', 'coin', 'seal'][(n >> 6) % 7],
      foot: ['bagua', 'lotus', 'knot', 'coin', 'scroll', 'mountain', 'flame', 'dragon', 'taiji', 'wave'][(n >> 8) % 10],
      inner: ['yao', 'dots', 'ring', 'grid', 'vine', 'bar'][(n >> 11) % 6],
      grain: ['fine', 'dry', 'bold'][(n >> 14) % 3],
      layout: ['center', 'split', 'stack'][(n >> 16) % 3],
      prov: { level: 'unverified', note: '未登记设计记录，使用程序派生结构' }
    };
  }

  function hash(s) {
    let h = 2166136261;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /** 某符是否有专属设计（非兜底） */
  function hasOwn(id) { return Object.prototype.hasOwnProperty.call(DESIGN, id); }

  /** 统计：登记数 / 独立结构数 / 来源分级分布 */
  function stats() {
    const ids = Object.keys(DESIGN);
    const sig = new Set();
    const levels = {};
    ids.forEach((id) => {
      const d = DESIGN[id];
      sig.add([d.frame, d.branch, d.top, d.core, d.foot, d.inner, d.grain, d.layout].join('|'));
      const lv = (d.prov && d.prov.level) || 'unverified';
      levels[lv] = (levels[lv] || 0) + 1;
    });
    return { total: ids.length, distinctStructures: sig.size, levels: levels };
  }

  /** 相似度报告：两符结构字段相同数 / 总字段数 */
  function similarity(idA, idB) {
    const a = designOf(idA), b = designOf(idB);
    const keys = ['frame', 'branch', 'top', 'core', 'foot', 'inner', 'grain', 'layout'];
    let same = 0;
    keys.forEach((k) => { if (a[k] === b[k]) same++; });
    return { same: same, total: keys.length, ratio: same / keys.length };
  }

  /** 全库两两相似度（用于审阅报告），返回高相似对 */
  function similarityReport() {
    const ids = Object.keys(DESIGN);
    const pairs = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const s = similarity(ids[i], ids[j]);
        if (s.ratio >= 0.75) pairs.push({ a: ids[i], b: ids[j], ratio: s.ratio, same: s.same });
      }
    }
    pairs.sort((x, y) => y.ratio - x.ratio);
    return { checked: ids.length * (ids.length - 1) / 2, highSimilar: pairs };
  }

  return {
    designOf: designOf,
    hasOwn: hasOwn,
    stats: stats,
    similarity: similarity,
    similarityReport: similarityReport,
    _internals: { DESIGN: DESIGN }
  };
});