/**
 * 符箓矢量图形引擎（1.8.4 全面重绘）
 *
 * ============================================================
 * 一、形制依据
 * ============================================================
 * 传统道门符箓（符式）有固定的三段结构，称「符头、符胆、符脚」：
 *
 *   符头：符首的敕令或神名，标明此符奉何神所令。
 *   符胆：符的主体神名或咒字，如「镇宅」「雷霆都司」，
 *         是符力的核心，取该符所司之神名或功效本字。
 *   符脚：符末的纹样与印信（八卦、太极、龙凤、莲座、金钱…）。
 *
 * 另有「符诀」，即符旁的竖排小字，为役使万神的口令；
 * 符的左右常缀「符枝」，即卷曲的云篆线条，作引摄分流之用。
 *
 * ============================================================
 * 二、1.8.4 重绘要点（对照用户提供的参考图）
 * ============================================================
 * 【真实缺陷 · 1.8.3 已暴露】初版线条粗、字小、构图平淡，
 * 视觉上「像流程图而不像符」。参考图的高阶特征为：
 *
 *  1. **线条极细**：全为朱砂细线（约 w 的0.3%~0.4%），无粗笔无填块。
 *  2. **符胆在上**：顶部一枚大字（如「镇」「穩」），下接中轴符文串。
 *  3. **四角竖框**：左右细长方框内置竖排款识（如「玄门正法」「鎮護萬物」）。
 *  4. **符枝左右**：两条对称卷曲云篆线，自上而下引出，末端收为卷云。
 *  5. **底部龙凤与卦盘**：龙凤云气围绕中轴八卦盘。
 *  6. **火焰纹**：符胆下缘与符脚周围的升腾火气。
 *  7. **印章**：朱红方印，仿旧有破口。
 *  8. **大量留白**：不填色不铺满 —— 高级感正来自留白。
 *
 * ============================================================
 * 三、分类与所奉之神（有典可查的对应）
 * ============================================================
 *   护身 → 太上老君          镇宅 → 宅神土地正神
 *   化煞 → 斗姥元君          消灾 → 太乙救苦天尊
 *   调身 → 五方五帝（按五行细分）  婚姻 → 和合二仙、月老
 *   官禄 → 文昌帝君          学业 → 文昌帝君、魁星
 *   祈财 → 玄坛赵公明        和解 → 北斗七星
 *
 * ============================================================
 * 四、本模块只负责「画」，不做任何功效判断
 * ============================================================
 * 符箓为道教符文化与民间傩文化的历史遗存，此处作传统文化研究性展示。
 * 「生成什么符」由 fulu-library.js 依据命盘不利项匹配决定，
 * 本文件只把既定的符名与分类绘成图形，不含任何吉凶判断。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const api = factory();
    if (typeof globalThis !== 'undefined') globalThis.FuluArt = api;
    module.exports = api;
  } else root.FuluArt = factory();
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /* ============================================================
   * 一、色与线：符的全部质感都藏在这里
   * ============================================================ */

  const INK = {
    zhu: '#9e2318',       /* 朱砂：符之正色 */
    zhuHi: '#c8402a',     /* 朱砂亮部（火焰内芯） */
    zhuLo: '#7d1a12',     /* 朱砂暗部 */
    mo: '#2a1a10',       /* 墨：款识与印章文字 */
    jin: '#a8862f',       /* 泥金：符胆的淡金晕 */
    paper: '#e9d49a',
    paperHi: '#f6e7b8',
    paperLo: '#c9a55f'
  };

  /* 参考图的线宽区间：极细。0.2%~0.4% 相对画布宽 w。 */
  function LW(w, k) { return Math.max(0.45, w * (k || 0.0032)); }

  /* ============================================================
   * 二、符式定义表
   * ============================================================ */

  const FORM = {
    护身: {
      head: '敕令', deity: '太上老君', tone: 'guardian',
      foot: 'bagua', frame: '正一', wriggle: 'thunder',
      left: ['玄门正法', '萬障皆除'], right: ['鎮護萬物', '邪祟莫侵'],
      spells: ['雷霆震慑', '远邪避秽', '四时无邪', '百煞退散', '身光常明', '鬼魅莫侵']
    },
    镇宅: {
      head: '敕令', deity: '宅神土地', tone: 'settle',
      foot: 'dragon', frame: '宅', wriggle: 'cloud',
      left: ['安宅正法', '百福駢臻'], right: ['家宅安寧', '六畜平安'],
      spells: ['宅气安宁', '门户纳吉', '人丁兴旺', '六畜平安', '财入库宅', '邪气不入']
    },
    化煞: {
      head: '雷令', deity: '斗姥元君', tone: 'break',
      foot: 'flame', frame: '煞', wriggle: 'lightning',
      left: ['雷霆正法', '煞曜退散'], right: ['刑沖為吉', '三災化吉'],
      spells: ['刑冲已解', '煞曜退散', '三刑化为吉', '六害化为恩', '太岁之厄解', '血光之灾消']
    },
    消灾: {
      head: '敕令', deity: '太乙救苦天尊', tone: 'relief',
      foot: 'lotus', frame: '厄', wriggle: 'cloud',
      left: ['消災正法', '罪愆消散'], right: ['厄難消除', '天譴不臨'],
      spells: ['厄难消除', '罪愆消散', '病苦得解', '水火相避', '天谴不临', '岁煞消弥']
    },
    调身: {
      head: '敕令', deity: '东方青帝', tone: 'harmonize',
      foot: 'lotus', frame: '养', wriggle: 'cloud',
      left: ['調身正法', '五臟調和'], right: ['氣血和平', '百體安和'],
      spells: ['肝气条达', '心脉常和', '脾土安厚', '肺金清肃', '肾水充盈', '五脏调和']
    },
    婚姻: {
      head: '月老敕', deity: '和合二仙', tone: 'unite',
      foot: 'knot', frame: '缘', wriggle: 'cloud',
      left: ['和合正法', '鸞鳳和鳴'], right: ['琴瑟相和', '夫妻同心'],
      spells: ['鸾凤和鸣', '琴瑟相和', '夫妻同心', '缘分早定', '冰释前嫌', '白首同归']
    },
    官禄: {
      head: '敕令', deity: '文昌帝君', tone: 'promote',
      foot: 'scroll', frame: '仕', wriggle: 'cloud',
      left: ['功名正法', '文運昌盛'], right: ['祿位高升', '貴人提攜'],
      spells: ['功名早遂', '职位升迁', '贵人提携', '文书如意', '秩满加恩', '政绩彰显']
    },
    学业: {
      head: '魁星敕', deity: '文昌帝君', tone: 'study',
      foot: 'bagua', frame: '文', wriggle: 'cloud',
      left: ['文昌正法', '筆下有神'], right: ['金榜題名', '過目成誦'],
      spells: ['文运昌盛', '考名得利', '过目成诵', '笔下有神', '金榜题名', '学业精进']
    },
    祈财: {
      head: '玄壇敕', deity: '玄壇趙公明', tone: 'wealth',
      foot: 'coin', frame: '財', wriggle: 'cloud',
      left: ['玄壇正法', '財源廣進'], right: ['金玉滿堂', '生意興隆'],
      spells: ['财源通达', '生意兴隆', '金玉满堂', '广进财帛', '债清业消', '禄位高升']
    },
    和解: {
      head: '和合敕', deity: '北斗七星', tone: 'reconcile',
      foot: 'knot', frame: '和', wriggle: 'cloud',
      left: ['和合正法', '冤仇冰釋'], right: ['兩家和順', '重歸於好'],
      spells: ['两家和顺', '冤仇冰释', '重归于好', '争执平息', '旧好重修', '彼此释怀']
    }
  };
  FORM.调身.wuxingForms = {
    木: { deity: '东方青帝', spells: ['肝气条达', '筋骨舒展', '目明神清', '疏泄有常', '木气条荣', '筋脉和柔'], left: ['青木正法', '肝氣條達'], right: ['筋脈和柔', '目明神清'] },
    火: { deity: '南方赤帝', spells: ['心气和平', '血脉常润', '神不守舍者安', '君火不炎', '心神宁定', '舌本无苦'], left: ['赤火正法', '心神寧定'], right: ['君火不炎', '血脈常潤'] },
    土: { deity: '中央黄帝', spells: ['脾胃健运', '中气充足', '肌肉得养', '饮食有节', '土德敦厚', '中州安和'], left: ['黄土正法', '脾胃健運'], right: ['中氣充足', '土德敦厚'] },
    金: { deity: '西方白帝', spells: ['肺气清肃', '皮毛得润', '呼吸调匀', '大肠传导', '金气相和', '气道清宁'], left: ['白金正法', '肺氣清肅'], right: ['呼吸調勻', '氣道清寧'] },
    水: { deity: '北方黑帝', spells: ['肾气充盈', '骨髓得养', '耳窍通明', '水液代谢', '精气内守', '下元充足'], left: ['黑水正法', '腎氣充盈'], right: ['耳竅通明', '精氣內守'] }
  };

  /* ============================================================
   * 三、符胆推导（沿用 1.8.3 规则）
   * ============================================================ */

  const KEY_WORDS = [
    '镇宅', '镇邪', '镇煞', '镇', '解厄', '解', '化煞', '化', '消灾', '消',
    '安宅', '安', '和合', '和解', '和', '调五脏', '调身', '调', '护身', '护',
    '治', '补', '祈', '役', '延寿', '延', '培元', '培'
  ];
  const TAIL = /[符咒箓敕令]$/;

  function deriveDan(name) {
    const s = String(name || '').replace(/[·・][^·・]*$/, '');
    if (!s) return '敕';
    let best = -1, bestK = '';
    for (const k of KEY_WORDS) {
      const i = s.indexOf(k);
      if (i >= 0 && (best < 0 || i < best)) { best = i; bestK = k; }
    }
    if (best >= 0) {
      const atEnd = best + bestK.length === s.length;
      let seg = atEnd ? s.slice(Math.max(0, s.length - 3), s.length) : s.slice(best, best + bestK.length);
      seg = seg.replace(TAIL, '');
      if (seg.length < 2) seg = s.slice(0, Math.min(3, s.length)).replace(TAIL, '');
      return seg || bestK;
    }
    const t = s.replace(/符$/, '');
    if (t.length <= 2) return t || s;
    return t.slice(-3).replace(TAIL, '');
  }

  /* 中轴符文串（咒身）：符胆之下的一列小字。
   * 传统符的咒身多为役使语，形如「奉（胆）……令，急急如律令」。
   * 【1.8.4】咒身不只用符胆末字，还取符胆**首字**与分类咒合成，
   * 使不同符的咒身差异更大。 */
  const GRAIL_CORE = {
    护身: ['身光常明', '百邪不侵', '四時無邪', '魂魄安定'],
    镇宅: ['宅气安宁', '門戶納吉', '六畜安寧', '財入庫宅'],
    化煞: ['刑冲已解', '煞曜退散', '三災化吉', '血光消解'],
    消灾: ['厄难消除', '罪愆消散', '天譴不臨', '病苦得解'],
    调身: ['五脏调和', '氣血和平', '百體安和', '寒暑不侵'],
    婚姻: ['和合相正', '鸞鳳和鳴', '琴瑟相和', '白首同歸'],
    官禄: ['功名早遂', '職位升遷', '貴人提攜', '祿位高升'],
    学业: ['文运昌盛', '金榜題名', '過目成誦', '筆下有神'],
    祈财: ['财源通达', '金玉滿堂', '生意興隆', '廣進財帛'],
    和解: ['两家和顺', '冤仇冰釋', '重歸於好', '彼此釋懷']
  };
  function deriveGrail(dan, cat, id) {
    const chars = Array.from(String(dan));
    const first = chars.length ? chars[0] : '敕';
    const last = chars.length ? chars[chars.length - 1] : '敕';
    const pool = GRAIL_CORE[cat] || ['万事咸宜', '百事亨通', '合家安康', '诸事顺遂'];
    /* 由符 id 确定性择一：同符稳定、异符有别 */
    const k = hashStr(String(id || '') + '|' + cat) % pool.length;
    return ['奉' + last, '敕' + first, pool[k], '令', '急急如律令'];
  }

  const NAME_WX = [
    { wx: '水', keys: ['水', '肾', '水气', '黑', '北'] },
    { wx: '火', keys: ['火', '心', '血', '赤', '南', '神'] },
    { wx: '木', keys: ['木', '肝', '筋', '青', '东', '文', '学', '科'] },
    { wx: '金', keys: ['金', '肺', '皮', '白', '西', '武', '官', '爵', '兵'] },
    { wx: '土', keys: ['土', '脾', '胃', '黄', '中', '宅', '田', '墓', '安'] }
  ];
  function deriveWx(name, desc) {
    const s = String(name || '') + String(desc || '');
    for (const g of NAME_WX) for (const k of g.keys) if (s.indexOf(k) >= 0) return g.wx;
    return null;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ============================================================
   * 四、符纸
   * ============================================================ */

  function drawPaper(c, w, h, rnd) {
    const g = c.createLinearGradient(0, 0, w * 0.35, h);
    g.addColorStop(0, INK.paperHi);
    g.addColorStop(0.42, INK.paper);
    g.addColorStop(1, INK.paperLo);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

    c.save();
    c.globalAlpha = 0.04;
    c.strokeStyle = '#8a6a2a';
    c.lineWidth = 0.5;
    const n = Math.floor((w * h) / 1100);
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * h, len = 5 + rnd() * 18;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y + (rnd() - 0.5) * 1.4); c.stroke();
    }
    c.globalAlpha = 0.045;
    for (let i = 0; i < 6; i++) {
      const x = rnd() * w, y = rnd() * h, r = 10 + rnd() * 40;
      const rg = c.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(150,110,50,.5)');
      rg.addColorStop(1, 'rgba(150,110,50,0)');
      c.fillStyle = rg;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    /* 双层细框（参考图最外一圈） */
    c.save();
    c.globalAlpha = 0.42;
    c.strokeStyle = INK.zhu;
    c.lineWidth = LW(w, 0.0028);
    c.strokeRect(w * 0.026, h * 0.028, w * 0.948, h * 0.944);
    c.globalAlpha = 0.24;
    c.lineWidth = LW(w, 0.0018);
    c.strokeRect(w * 0.038, h * 0.040, w * 0.924, h * 0.920);
    c.restore();
  }

  function vText(c, x, y, text, size, color, opts) {
    opts = opts || {};
    if (typeof text !== 'string' || !text) return 0;
    c.save();
    c.font = '500 ' + size + 'px "STKaiti","KaiTi","SimSun",serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = color;
    let yy = y;
    const step = size * 1.05;
    const chars = Array.from(text);
    for (let i = 0; i < chars.length; i++) {
      if (opts.grow != null && i / Math.max(1, chars.length) > opts.grow) { yy += step; continue; }
      c.fillText(chars[i], x, yy);
      yy += step;
    }
    c.restore();
    return yy - y;
  }

  /* ============================================================
   * 五、符枝：左右卷曲云篆线（参考图最显著的装饰语汇）
   * ============================================================ */

  function scrollCloud(c, cx, cy, r, color, alpha, dir) {
    c.save();
    c.globalAlpha = alpha == null ? 0.7 : alpha;
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.6, r * 0.18);
    c.lineCap = 'round';
    for (const k of [1, 0.62]) {
      const R = r * k;
      c.beginPath();
      c.arc(cx, cy, R, dir > 0 ? -0.9 : Math.PI - 0.9, dir > 0 ? 1.5 : Math.PI + 1.5, dir < 0);
      c.stroke();
    }
    c.restore();
  }

  function branchCurve(c, w, h, side, seed, color, alpha, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    const rnd = mulberry32(seed ^ (side > 0 ? 0x11 : 0x22));
    c.save();
    c.globalAlpha = alpha * g;
    c.strokeStyle = color;
    c.lineWidth = LW(w, 0.0022);
    c.lineCap = 'round'; c.lineJoin = 'round';

    const xTop = w * (side > 0 ? 0.585 : 0.415);
    const xBot = w * (side > 0 ? 0.635 : 0.365);
    const yTop = h * 0.215;
    const yBot = h * 0.800;

    c.beginPath();
    c.moveTo(xTop, yTop);
    const segs = 4;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const y = yTop + (yBot - yTop) * t;
      const bulge = Math.sin(t * Math.PI * 1.5) * w * 0.042 * side;
      const wob = (rnd() - 0.5) * w * 0.010 * side;
      c.bezierCurveTo(
        xTop + bulge + wob, y - (yBot - yTop) / segs * 0.66,
        xBot + bulge * 0.55 - wob, y - (yBot - yTop) / segs * 0.34,
        xBot + (xBot - xTop) * Math.sin(t * Math.PI) * 0.5, y
      );
    }
    c.stroke();

    c.globalAlpha = alpha * g * 0.78;
    c.lineWidth = LW(w, 0.0022);
    for (let i = 0; i < 3; i++) {
      const t = 0.24 + i * 0.26;
      const y = yTop + (yBot - yTop) * t;
      const bulge = Math.sin(t * Math.PI * 1.5) * w * 0.042 * side;
      const bx = xTop + (xBot - xTop) * t + bulge;
      scrollCloud(c, bx + side * w * 0.026, y, w * 0.020, color, alpha * g * 0.66, side);
    }
    scrollCloud(c, xBot + side * w * 0.012, yBot + h * 0.018, w * 0.038, color, alpha * g, side);
    c.restore();
  }

  function thinLightning(c, w, h, side, color, alpha, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    c.save();
    c.globalAlpha = alpha * g;
    c.strokeStyle = color;
    c.lineWidth = LW(w, 0.0022);
    c.lineJoin = 'miter';
    const x = w * (side > 0 ? 0.755 : 0.245);
    const y0 = h * 0.245, y1 = h * 0.760;
    c.beginPath();
    c.moveTo(x, y0);
    const n = 8;
    for (let i = 1; i <= n; i++) c.lineTo(x + (i % 2 ? -1 : 1) * w * 0.022, y0 + (y1 - y0) * i / n);
    c.stroke();
    c.restore();
  }

  /* ============================================================
   * 六、火焰纹
   * ============================================================ */

  function flame(c, cx, cy, r, color, alpha, seed) {
    c.save();
    c.globalAlpha = alpha == null ? 0.6 : alpha;
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.55, r * 0.14);
    c.lineCap = 'round';
    const rnd = mulberry32(seed);
    for (let k = 0; k < 3; k++) {
      const ox = (k - 1) * r * 0.74;
      const hgt = r * (1.6 + rnd() * 0.8);
      c.beginPath();
      c.moveTo(cx + ox - r * 0.30, cy);
      c.bezierCurveTo(
        cx + ox - r * 0.44, cy - hgt * 0.42,
        cx + ox + r * 0.10, cy - hgt * 0.62,
        cx + ox + (rnd() - 0.5) * r * 0.2, cy - hgt
      );
      c.stroke();
      c.beginPath();
      c.moveTo(cx + ox + r * 0.28, cy);
      c.bezierCurveTo(
        cx + ox + r * 0.42, cy - hgt * 0.34,
        cx + ox + r * 0.34, cy - hgt * 0.48,
        cx + ox + r * 0.48, cy - hgt * 0.62
      );
      c.stroke();
    }
    c.restore();
  }

  /* ============================================================
   * 七、符脚纹样
   * ============================================================ */

  function baguaRing(c, cx, cy, r, color, alpha, grow) {
    c.save();
    c.globalAlpha = alpha == null ? 0.85 : alpha;
    const rr = r * (grow == null ? 1 : grow);
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.55, r * 0.055);
    c.beginPath(); c.arc(cx, cy, rr, 0, Math.PI * 2); c.stroke();
    c.lineWidth = Math.max(0.42, r * 0.032);
    c.beginPath(); c.arc(cx, cy, rr * 0.90, 0, Math.PI * 2); c.stroke();

    const yao = [[1, 1, 1], [0, 0, 0], [1, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 0], [0, 0, 1], [1, 1, 1]];
    const unit = Math.PI / 4;
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + unit * i + unit / 2;
      const lines = yao[i];
      for (let j = 0; j < 3; j++) {
        const rad = rr * (0.90 - 0.13 * j);
        c.save();
        c.translate(cx, cy); c.rotate(a);
        c.lineWidth = Math.max(0.5, r * 0.048);
        c.beginPath();
        if (lines[j]) {
          c.arc(0, 0, rad, -0.26, 0.26);
        } else {
          c.arc(0, 0, rad, -0.26, -0.09);
          c.moveTo(0, 0);
          c.arc(0, 0, rad, 0.09, 0.26);
        }
        c.stroke();
        c.restore();
      }
    }
    c.lineWidth = Math.max(0.42, r * 0.030);
    c.beginPath(); c.arc(cx, cy, rr * 0.42, 0, Math.PI * 2); c.stroke();
    c.restore();
  }

  function taijiLine(c, cx, cy, r, color, alpha, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    const rr = r * g;
    c.save();
    c.globalAlpha = alpha == null ? 0.9 : alpha;
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.5, r * 0.080);
    c.beginPath(); c.arc(cx, cy, rr, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.arc(cx, cy - rr / 2, rr / 2, Math.PI, 0);
    c.arc(cx, cy + rr / 2, rr / 2, 0, Math.PI, true);
    c.stroke();
    c.beginPath(); c.arc(cx, cy - rr / 2, rr * 0.14, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(cx, cy + rr / 2, rr * 0.14, 0, Math.PI * 2); c.stroke();
    c.restore();
  }

  function dragonLine(c, w, h, side, color, alpha, seed, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    const rnd = mulberry32(seed ^ (side > 0 ? 0x77 : 0x99));
    c.save();
    c.globalAlpha = alpha * g;
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.5, w * 0.0026);
    c.lineCap = 'round'; c.lineJoin = 'round';

    const x0 = w * 0.5 + side * w * 0.300;
    const yBot = h * 0.930, yTop = h * 0.570;
    c.beginPath();
    c.moveTo(x0 - side * w * 0.028, yBot);
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const y = yBot + (yTop - yBot) * t;
      const bx = x0 - side * w * 0.028 + Math.sin(t * Math.PI * 1.7) * side * w * 0.052;
      c.quadraticCurveTo(bx + side * w * 0.040, y - (yBot - yTop) / n * 0.6, bx, y);
    }
    c.stroke();

    const hx = x0 + Math.sin(Math.PI * 1.7) * side * w * 0.052;
    const hy = yTop;
    c.beginPath(); c.arc(hx, hy, w * 0.024, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.moveTo(hx - w * 0.013, hy - w * 0.018);
    c.quadraticCurveTo(hx - w * 0.038, hy - w * 0.044, hx - w * 0.019, hy - w * 0.050);
    c.stroke();
    c.beginPath();
    c.moveTo(hx + w * 0.015, hy + w * 0.013);
    c.quadraticCurveTo(hx + w * 0.046, hy + w * 0.034, hx + w * 0.029, hy + w * 0.055);
    c.stroke();
    for (let i = 0; i < 2; i++) {
      const px = x0 - side * w * 0.028 + (rnd() - 0.5) * w * 0.018;
      const py = h * (0.70 + i * 0.13);
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px + side * w * 0.028, py - w * 0.010);
      c.lineTo(px + side * w * 0.024, py + w * 0.010);
      c.stroke();
    }
    c.restore();
  }

  function cloudBank(c, w, y, color, alpha, seed, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    const rnd = mulberry32(seed);
    c.save();
    c.globalAlpha = alpha * g;
    c.strokeStyle = color;
    c.lineWidth = LW(w, 0.0022);
    c.lineCap = 'round';
    for (const ox of [-0.27, 0, 0.27]) {
      const cx = w * (0.5 + ox), r = w * (0.036 + rnd() * 0.014);
      c.beginPath(); c.arc(cx, y, r, Math.PI * 0.88, Math.PI * 1.78); c.stroke();
      c.beginPath(); c.arc(cx + r * 0.80, y - r * 0.44, r * 0.58, Math.PI * 0.84, Math.PI * 1.88); c.stroke();
      c.beginPath(); c.arc(cx - r * 0.80, y - r * 0.34, r * 0.48, Math.PI * 1.10, Math.PI * 2.14); c.stroke();
    }
    c.restore();
  }

  function lotusBase(c, cx, y, r, color, alpha, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    c.save();
    c.globalAlpha = alpha * g;
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.55, r * 0.09);
    c.lineCap = 'round';
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(cx + s * r * 0.72, y);
      c.quadraticCurveTo(cx + s * r * 0.32, y - r * 0.95, cx, y - r * 0.60);
      c.quadraticCurveTo(cx - s * r * 0.16, y - r * 0.22, cx + s * r * 0.72, y);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(cx - r * 0.72, y);
    c.quadraticCurveTo(cx, y + r * 0.34, cx + r * 0.72, y);
    c.stroke();
    c.restore();
  }

  function knotBase(c, cx, y, r, color, alpha, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    c.save();
    c.globalAlpha = alpha * g;
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.55, r * 0.10);
    c.lineJoin = 'miter';
    c.strokeRect(cx - r, y - r * 0.70, r * 2, r * 1.40);
    c.strokeRect(cx - r * 0.60, y - r * 1.02, r * 1.20, r * 2.04);
    c.beginPath();
    c.moveTo(cx - r * 0.60, y - r * 0.28); c.lineTo(cx + r * 0.60, y - r * 0.28);
    c.moveTo(cx - r * 0.60, y + r * 0.28); c.lineTo(cx + r * 0.60, y + r * 0.28);
    c.stroke();
    c.restore();
  }

  function scrollBase(c, cx, y, r, color, alpha, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    c.save();
    c.globalAlpha = alpha * g;
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.55, r * 0.09);
    c.strokeRect(cx - r * 1.08, y - r * 0.50, r * 2.16, r * 1.00);
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(cx + s * r * 1.08, y, r * 0.50, -Math.PI / 2, Math.PI / 2, s < 0);
      c.stroke();
    }
    for (const s of [-0.5, 0, 0.5]) {
      c.beginPath();
      c.moveTo(cx + s * r * 0.88, y - r * 0.32);
      c.lineTo(cx + s * r * 0.88, y + r * 0.32);
      c.stroke();
    }
    c.restore();
  }

  function coinBase(c, cx, y, r, color, alpha, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    c.save();
    c.globalAlpha = alpha * g;
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.55, r * 0.09);
    c.beginPath(); c.arc(cx, y, r * 0.78, 0, Math.PI * 2); c.stroke();
    c.strokeRect(cx - r * 0.32, y - r * 0.32, r * 0.64, r * 0.64);
    c.restore();
  }

  function mountainBase(c, cx, y, r, color, alpha, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    c.save();
    c.globalAlpha = alpha * g;
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.55, r * 0.085);
    c.lineJoin = 'round'; c.lineCap = 'round';
    /* 【1.9.0 修复】原用 moveTo/lineTo 直线折峰，画出来是三个尖角「∧」，
     * 视觉上像折线而不像山（放大审阅实证）。现改用二次贝塞尔：
     * 每峰两侧带弧度收笔，峰顶尖锐、坡脚圆转，才具备山形。*/
    for (let i = 0; i < 3; i++) {
      const rr = r * (1.30 - i * 0.34);
      const off = (i - 1) * r * 0.56;
      const peakX = cx + off;
      const peakY = y - r * (0.76 - i * 0.13);
      const leftX = peakX - rr, rightX = peakX + rr;
      c.beginPath();
      /* 左坡：自坡脚以水平切线起步，中途收成弧，再急转为峰尖 */
      c.moveTo(leftX, y);
      c.quadraticCurveTo(leftX + rr * 0.42, y - r * 0.06, peakX - rr * 0.22, peakY + r * 0.10);
      c.quadraticCurveTo(peakX - rr * 0.10, peakY, peakX, peakY);
      /* 右坡：镜像 */
      c.quadraticCurveTo(peakX + rr * 0.10, peakY, peakX + rr * 0.22, peakY + r * 0.10);
      c.quadraticCurveTo(rightX - rr * 0.42, y - r * 0.06, rightX, y);
      c.stroke();
    }
    c.restore();
  }

  function drawFoot(c, w, h, kind, seed, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    const cx = w * 0.5;
    const y = h * 0.865;
    const r = h * 0.070;
    const col = INK.zhu;

    cloudBank(c, w, h * 0.945, col, 0.42 * g, seed ^ 0x33, g);

    switch (kind) {
      case 'bagua':
        baguaRing(c, cx, y, r * 1.10, col, 0.80 * g, Math.min(1, g));
        taijiLine(c, cx, y, r * 0.33, col, 0.72 * g, Math.min(1, g));
        break;
      case 'dragon':
        mountainBase(c, cx, y + h * 0.030, r * 1.05, col, 0.70 * g, g);
        dragonLine(c, w, h, -1, col, 0.60 * g, seed, g);
        dragonLine(c, w, h, 1, col, 0.60 * g, seed, g);
        break;
      case 'flame':
        flame(c, cx, y + h * 0.022, r * 0.40, INK.zhuHi, 0.52 * g, seed);
        baguaRing(c, cx, y, r * 0.78, col, 0.52 * g, Math.min(1, g));
        break;
      case 'lotus':
        taijiLine(c, cx, y - r * 0.12, r * 0.44, col, 0.68 * g, Math.min(1, g));
        lotusBase(c, cx, y + h * 0.026, r * 0.60, col, 0.70 * g, g);
        break;
      case 'knot':
        knotBase(c, cx, y, r * 0.90, col, 0.76 * g, g);
        break;
      case 'scroll':
        scrollBase(c, cx, y, r * 0.84, col, 0.73 * g, g);
        break;
      case 'coin':
        coinBase(c, cx, y, r * 0.84, col, 0.76 * g, g);
        for (const s of [-1, 1]) coinBase(c, cx + s * w * 0.160, y + h * 0.008, r * 0.40, col, 0.42 * g, g);
        break;
      /* 【1.9.0 修复 · 真实缺陷】原先 'mountain' 与 'wave' 没有 case，
       * 全部落进default 变成同一个八卦环 —— 14 + 13 = 27 条符箓
       * 的符脚被抹平成同一种。已补两个独立分支。*/
      case 'mountain':
        /* 【1.9.0】山体宽 2.6*0.80 = 2.08r，两侧山影外推到 2.3r 之外，
         * 恰好与山脚相接；若山体改用更小半径时，山影须同步收拢，
         * 否则会出现「山与影各躺一处」的断裂感。*/
        mountainBase(c, cx, y + h * 0.014, r * 0.80, col, 0.74 * g, g);
        c.save();
        c.globalAlpha = 0.40 * g;
        c.strokeStyle = col;
        c.lineWidth = Math.max(0.5, r * 0.06);
        c.lineCap = 'round';
        for (const s of [-1, 1]) {
          c.beginPath();
          c.moveTo(cx + s * r * 2.10, y + h * 0.026);
          c.quadraticCurveTo(cx + s * r * 2.50, y + h * 0.006, cx + s * r * 2.86, y + h * 0.022);
          c.stroke();
        }
        c.restore();
        break;
      case 'wave':
        /* 水波：三重错位波峰 + 中央升腾水气，与 mountain 的尖峰成对比 */
        c.save();
        c.globalAlpha = 0.72 * g;
        c.strokeStyle = col;
        c.lineWidth = Math.max(0.55, r * 0.085);
        c.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const yy = y + h * (0.012 + i * 0.030);
          const amp = r * (0.34 - i * 0.07);
          const half = r * (1.55 - i * 0.36);
          c.beginPath();
          for (let s = -1; s <= 1; s += 2) {
            c.moveTo(cx + s * half, yy);
            c.bezierCurveTo(
              cx + s * half * 0.55, yy - amp,
              cx + s * half * 0.18, yy + amp,
              cx, yy
            );
          }
          c.stroke();
        }
        /* 中央水气：一道上行弧 */
        c.globalAlpha = 0.50 * g;
        c.beginPath();
        c.moveTo(cx - r * 0.30, y - r * 0.10);
        c.quadraticCurveTo(cx, y - r * 0.92, cx + r * 0.30, y - r * 0.10);
        c.stroke();
        c.restore();
        break;
      default:
        baguaRing(c, cx, y, r * 0.88, col, 0.68 * g, Math.min(1, g));
    }
  }

  /* ============================================================
   * 七之二、【1.9.0】逐项结构绘制件
   *
   * 1.8.4 的边框/符枝/顶部器物/盘心是**写死**的单一形态，
   * 10 个类别共用一套骨架 —— 故同类符看起来一样。
   * 现按 fulu-design 的 art 字段分派出 8 种边框、6 种符枝、
   * 6 种顶部器物、7 种盘心、6 种内部纹样，构成 100 条的形制差异。
   * ============================================================ */

  /* ---------- 8 种边框 ---------- */
  function drawFrameKind(c, w, h, kind, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return null;
    /* 【1.9.0】返回款识栏中心 x 坐标，供调用方对齐文字 ——
     * 不同 frame 的竖栏位置不同（rail 在双线之间、bracket 只有角标），
     * 若文字仍按固定 x 画，就会出现「框与字错位」。*/
    const slot = { left: w * 0.042 + w * 0.128 / 2, right: w - w * 0.042 - w * 0.128 / 2 };
    const bw = Math.max(16, w * 0.128);
    const bx = w * 0.042;
    const by = h * 0.150;
    const bh = h * 0.650;
    const L = LW(w, 0.0026);
    c.save();
    c.globalAlpha = 0.74 * g;
    c.strokeStyle = INK.zhu;
    c.lineWidth = L;
    const rect = (x, y, ww, hh) => c.strokeRect(x, y, ww, hh);
    switch (kind) {
      case 'double':   /* 左右双框 + 内侧细线 */
        rect(bx, by, bw, bh); rect(w - bx - bw, by, bw, bh);
        c.globalAlpha = 0.40 * g; c.lineWidth = LW(w, 0.0016);
        rect(bx + 3, by + 3, bw - 6, bh - 6);
        rect(w - bx - bw + 3, by + 3, bw - 6, bh - 6);
        break;
      case 'triple':   /* 左右三线 */
        for (let i = 0; i < 3; i++) {
          c.globalAlpha = (0.74 - i * 0.18) * g;
          c.lineWidth = L;
          rect(bx + i * 3.2, by - i * 2, bw, bh + i * 4);
          rect(w - bx - bw - i * 3.2, by - i * 2, bw, bh + i * 4);
        }
        break;
      case 'rail':     /* 竖栏分隔线（无框，靠双竖线成栏） */
      slot.left = bx + bw / 2; slot.right = w - bx - bw / 2;
        for (const sx of [bx + bw / 2, w - bx - bw / 2]) {
          c.beginPath();
          c.moveTo(sx, by); c.lineTo(sx, by + bh);
          c.stroke();
        }
        c.globalAlpha = 0.40 * g; c.lineWidth = LW(w, 0.0016);
        for (const sx of [bx + bw / 2 + 4, w - bx - bw / 2 - 4]) {
          c.beginPath(); c.moveTo(sx, by + 6); c.lineTo(sx, by + bh - 6); c.stroke();
        }
        break;
      case 'bracket':  /* 角括号式（只画四角，款识内缩以避让横臂） */
        slot.left = bx + 10; slot.right = w - bx - bw - 10;
        c.lineWidth = L * 1.3;
        for (const sx of [bx, w - bx - bw]) {
          for (const sy of [by, by + bh]) {
            c.beginPath();
            c.moveTo(sx, sy + (sy === by ? 14 : -14));
            c.lineTo(sx, sy);
            c.lineTo(sx + bw, sy);
            c.stroke();
          }
        }
        break;
      case 'seal':     /* 印框（粗线方框 + 内折角） */
        c.lineWidth = L * 1.8;
        rect(bx, by, bw, bh); rect(w - bx - bw, by, bw, bh);
        c.lineWidth = LW(w, 0.0018); c.globalAlpha = 0.50 * g;
        for (const sx of [bx, w - bx - bw]) {
          c.beginPath();
          c.moveTo(sx, by + bh * 0.5); c.lineTo(sx + bw, by + bh * 0.5);
          c.stroke();
        }
        break;
      case 'ribbon':   /* 缎带式（框带端头燕尾） */
        c.lineWidth = L;
        rect(bx, by, bw, bh); rect(w - bx - bw, by, bw, bh);
        c.lineWidth = LW(w, 0.0018);
        for (const sx of [bx, w - bx - bw]) {
          c.beginPath();
          c.moveTo(sx, by); c.lineTo(sx - 5, by - 5);
          c.lineTo(sx + 5, by - 5); c.closePath(); c.stroke();
          c.beginPath();
          c.moveTo(sx, by + bh); c.lineTo(sx - 5, by + bh + 5);
          c.lineTo(sx + 5, by + bh + 5); c.closePath(); c.stroke();
        }
        break;
      /* ========== 【1.9.0 新增】3 种边框 ==========
       * 起因：1.9.0 要 100 条可明显区分，而原有 6 种边框的取值空间
       * 已被100 条用尽，导致 25 对符箓有 6/8 字段相同（仅差边框一项
       * 与另一项）。新增以下 3 种，把边框空间从 6 扩到 9。*/
      case 'cloud':    /* 云头框：竖边中段鼓出云朵，左右对称 */
        slot.left = bx + bw / 2; slot.right = w - bx - bw / 2;
        c.lineWidth = L;
        for (const sx of [bx + bw / 2, w - bx - bw / 2]) {
          c.beginPath();
          c.moveTo(sx, by);
          c.lineTo(sx, by + bh * 0.30);
          /* 三段云鼓 */
          const cy0 = by + bh * 0.42, amp = bw * 0.30;
          c.bezierCurveTo(sx + amp, cy0 - bh * 0.06, sx + amp, cy0 + bh * 0.06, sx, cy0 + bh * 0.10);
          c.lineTo(sx, by + bh * 0.70);
          const cy1 = by + bh * 0.80;
          c.bezierCurveTo(sx + amp, cy1 - bh * 0.05, sx + amp, cy1 + bh * 0.05, sx, cy1 + bh * 0.08);
          c.lineTo(sx, by + bh);
          c.stroke();
        }
        c.globalAlpha = 0.40 * g; c.lineWidth = LW(w, 0.0016);
        for (const sx of [bx + bw / 2, w - bx - bw / 2]) {
          c.beginPath();
          c.moveTo(sx + 6, by + bh * 0.05); c.lineTo(sx + 6, by + bh * 0.95);
          c.stroke();
        }
        break;
      case 'pillar':   /* 柱式：上下带柱头柱础的长方栏 */
        c.lineWidth = L;
        rect(bx, by, bw, bh); rect(w - bx - bw, by, bw, bh);
        c.lineWidth = LW(w, 0.0016);
        for (const sx of [bx, w - bx - bw]) {
          /* 柱础 */
          c.beginPath();
          c.moveTo(sx - 3, by + bh); c.lineTo(sx + bw + 3, by + bh);
          c.moveTo(sx - 2, by + bh - 4); c.lineTo(sx + bw + 2, by + bh - 4);
          c.stroke();
          /* 柱头 */
          c.beginPath();
          c.moveTo(sx - 3, by); c.lineTo(sx + bw + 3, by);
          c.moveTo(sx - 2, by + 4); c.lineTo(sx + bw + 2, by + 4);
          c.stroke();
          /* 柱身中段两道束线 */
          c.globalAlpha = 0.46 * g;
          for (const f of [0.34, 0.66]) {
            c.beginPath();
            c.moveTo(sx, by + bh * f); c.lineTo(sx + bw, by + bh * f);
            c.stroke();
          }
          c.globalAlpha = 0.74 * g;
        }
        break;
      case 'notch':    /* 缺口式：竖边内凹三段，类「日」字窗棂 */
        slot.left = bx + 4; slot.right = w - bx - bw - 4;
        c.lineWidth = L;
        for (const sx of [bx, w - bx - bw]) {
          c.beginPath();
          c.moveTo(sx, by); c.lineTo(sx + bw, by); c.lineTo(sx + bw, by + bh);
          c.lineTo(sx, by + bh);
          c.stroke();
          /* 内凹两段（垂直方向的缺口），与 'triple' 的平行多线明显不同 */
          c.globalAlpha = 0.56 * g; c.lineWidth = LW(w, 0.0016);
          for (const f of [0.26, 0.52, 0.78]) {
            const yy = by + bh * f;
            c.beginPath();
            c.moveTo(sx, yy - 5); c.lineTo(sx + bw * 0.30, yy);
            c.lineTo(sx, yy + 5);
            c.stroke();
            c.beginPath();
            c.moveTo(sx + bw, yy - 5); c.lineTo(sx + bw * 0.70, yy);
            c.lineTo(sx + bw, yy + 5);
            c.stroke();
          }
          c.globalAlpha = 0.74 * g; c.lineWidth = L;
        }
        break;
      default:          /* none：只留极淡的角标 */
        c.globalAlpha = 0.28 * g; c.lineWidth = LW(w, 0.0014);
        for (const sx of [bx, w - bx - bw]) {
          c.beginPath();
          c.moveTo(sx, by + bh); c.lineTo(sx, by + bh - 12);
          c.moveTo(sx, by + bh); c.lineTo(sx + 10, by + bh);
          c.stroke();
        }
    }
    c.restore();
    return slot;
  }

  /* ---------- 6 种符枝 ---------- */
  function drawBranchKind(c, w, h, kind, side, seed, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    const xTop = w * (side > 0 ? 0.585 : 0.415);
    const xBot = w * (side > 0 ? 0.635 : 0.365);
    const yTop = h * 0.215, yBot = h * 0.800;
    const col = INK.zhu;
    c.save();
    /* 【1.9.0】符枝可见度提高：1.8.4 的 0.50/0.0022 实测过淡，
     * 六种符枝在缩略图上看不出差别，等于白做。*/
    c.globalAlpha = 0.72 * g;
    c.strokeStyle = col;
    c.lineWidth = LW(w, 0.0032);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const rnd = mulberry32(seed ^ (side > 0 ? 0x11 : 0x22));
    const segs = 4;

    if (kind === 'r') {          /* 直龙：近竖直，带龙鳞短横 */
      c.beginPath();
      c.moveTo(xTop, yTop);
      c.quadraticCurveTo(xTop + side * w * 0.030, (yTop + yBot) / 2, xBot, yBot);
      c.stroke();
      c.globalAlpha = 0.52 * g; c.lineWidth = LW(w, 0.0018);
      for (let i = 1; i < 7; i++) {
        const t = i / 7, y = yTop + (yBot - yTop) * t;
        const x = xTop + (xBot - xTop) * t + side * w * 0.014;
        c.beginPath(); c.moveTo(x - side * w * 0.012, y); c.lineTo(x + side * w * 0.012, y); c.stroke();
      }
    } else if (kind === 'v') {/* 垂帘：竖直密帘 */
      c.beginPath(); c.moveTo(xTop, yTop); c.lineTo(xTop, yBot); c.stroke();
      c.globalAlpha = 0.46 * g; c.lineWidth = LW(w, 0.0016);
      for (let i = 1; i < 12; i++) {
        const y = yTop + (yBot - yTop) * i / 12;
        c.beginPath();
        c.moveTo(xTop - side * w * 0.014, y);
        c.lineTo(xTop + side * w * 0.014 * (i % 2 ? 1 : 0.6), y + 3);
        c.stroke();
      }
    } else if (kind === 'y') { /* 云丫：分叉为两股 */
      c.beginPath();
      c.moveTo(xTop, yTop);
      c.quadraticCurveTo(xTop + side * w * 0.05, yTop + h * 0.14, xBot, yBot);
      c.stroke();
      c.beginPath();
      c.moveTo(xTop, yTop + h * 0.10);
      c.quadraticCurveTo(xTop + side * w * 0.085, yTop + h * 0.22, xTop + side * w * 0.045, yTop + h * 0.34);
      c.stroke();
    } else if (kind === 'o') { /* 环抱：向外鼓出再收回 */
      c.beginPath();
      c.moveTo(xTop, yTop);
      c.bezierCurveTo(
        xTop + side * w * 0.12, yTop + h * 0.12,
        xTop + side * w * 0.12, yBot - h * 0.12,
        xBot, yBot
      );
      c.stroke();
    } else if (kind === 'w') { /* 双波：两段反向波 */
      c.beginPath();
      c.moveTo(xTop, yTop);
      for (let i = 1; i <= segs; i++) {
        const t = i / segs, y = yTop + (yBot - yTop) * t;
        const x = xTop + Math.sin(t * Math.PI * 2) * w * 0.035 * side;
        c.lineTo(x, y);
      }
      c.stroke();
    /* ========== 【1.9.0 新增】3 种符枝 ==========
     * 与上面 6 种的形态刻意拉开：'spiral' 是旋绕（唯一带内卷的）、
     * 'ladder' 是横档（唯一以横线为主的）、'tuft' 是分三股（唯一末段发散的）。
     * 符枝空间由 6 扩到 9。*/
    } else if (kind === 'spiral') { /* 旋绕：沿边螺旋下行 */
      const turns = 2.25;
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const y = yTop + (yBot - yTop) * t;
        const a = t * Math.PI * 2 * turns;
        const amp = w * 0.040 * (1 - t * 0.55);
        const x = xTop + Math.sin(a) * amp * side;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      /* 每四分之一圈留一个短横档，暗示旋转的节拍 */
      c.globalAlpha = 0.50 * g; c.lineWidth = LW(w, 0.0018);
      for (let k = 0; k < 4; k++) {
        const t = (k + 0.5) / 4;
        const y = yTop + (yBot - yTop) * t;
        const a = t * Math.PI * 2 * turns;
        const x = xTop + Math.sin(a) * w * 0.040 * (1 - t * 0.55) * side;
        c.beginPath();
        c.moveTo(x - side * w * 0.013, y); c.lineTo(x + side * w * 0.013, y);
        c.stroke();
      }
      c.globalAlpha = 0.72 * g; c.lineWidth = LW(w, 0.0032);
    } else if (kind === 'ladder') { /* 横档：一根主脊 + 六道横档 */
      c.beginPath();
      c.moveTo(xTop, yTop); c.lineTo(xBot, yBot);
      c.stroke();
      c.globalAlpha = 0.56 * g; c.lineWidth = LW(w, 0.0020);
      for (let i = 0; i < 6; i++) {
        const t = (i + 1) / 7;
        const y = yTop + (yBot - yTop) * t;
        const x = xTop + (xBot - xTop) * t;
        const hw = w * (0.030 - i * 0.0022);
        c.beginPath();
        c.moveTo(x - hw * side, y); c.lineTo(x + hw * side, y);
        c.stroke();
      }
      c.globalAlpha = 0.72 * g; c.lineWidth = LW(w, 0.0032);
    } else if (kind === 'tuft') { /* 散锋：主枝外加两股分张 */
      c.beginPath();
      c.moveTo(xTop, yTop);
      c.quadraticCurveTo(xTop + side * w * 0.030, (yTop + yBot) / 2, xBot, yBot);
      c.stroke();
      /* 两股自中段分出，末端发散 */
      for (const [tt, spread] of [[0.36, 0.075], [0.66, 0.055]]) {
        const y = yTop + (yBot - yTop) * tt;
        const x = xTop + (xBot - xTop) * tt;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(
          x + side * w * spread * 1.2, y + h * 0.06,
          x + side * w * spread * 1.9, y + h * 0.115
        );
        c.stroke();
      }
      /* 锋尖短刺 */
      c.globalAlpha = 0.56 * g; c.lineWidth = LW(w, 0.0018);
      for (let i = 0; i < 5; i++) {
        const t = 0.14 + i * 0.17;
        const y = yTop + (yBot - yTop) * t;
        const x = xTop + (xBot - xTop) * t;
        c.beginPath();
        c.moveTo(x, y); c.lineTo(x + side * w * 0.018, y - h * 0.012);
        c.stroke();
      }
      c.globalAlpha = 0.72 * g; c.lineWidth = LW(w, 0.0032);
    } else if (kind === 's') {  /* S 形：原实现
     * 【1.9.0 改为显式分支】原先 s 是 if/else 链的最后一档else，
     * 只能靠注释辨认它是什么 —— 审阅与自动化校验都无从下手。
     * 现改为显式条件，未知 kind 才会真正落到无分支的空路径。*/
      c.beginPath();
      c.moveTo(xTop, yTop);
      for (let i = 1; i <= segs; i++) {
        const t = i / segs, y = yTop + (yBot - yTop) * t;
        const bulge = Math.sin(t * Math.PI * 1.5) * w * 0.042 * side;
        const wob = (rnd() - 0.5) * w * 0.010 * side;
        c.bezierCurveTo(
          xTop + bulge + wob, y - (yBot - yTop) / segs * 0.66,
          xBot + bulge * 0.55 - wob, y - (yBot - yTop) / segs * 0.34,
          xBot + (xBot - xTop) * Math.sin(t * Math.PI) * 0.5, y);
      }
      c.stroke();
    }
    /* 各式统一在末端收卷云
     * 【1.9.0 修复 · 真实缺陷】原云卷半径 w*0.042、圆心落在 yBot+0.018h，
     * 而符脚（drawFoot）中心在 0.865h、半径 0.070h，
     * 两者在**符脚较大的类型（八卦/龙）下直接压在一起**（放大审阅实证：
     * F002 符枝末端的大云卷被底部八卦盘盖住一半）。
     * 现把云卷上移到符枝末段内侧并缩小半径，让它成为符枝的收尾
     * 而不是与符脚抢位置。*/
    c.globalAlpha = 0.66 * g; c.lineWidth = LW(w, 0.0024);
    scrollCloud(c, xBot + side * w * 0.010, yBot - h * 0.030, w * 0.030, col, 0.66 * g, side);
    c.restore();
  }

  /* ---------- 6 种顶部器物 ---------- */
  function drawTopKind(c, w, h, kind, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02 || kind === 'none') return;
    const cx = w * 0.5, cy = h * 0.052, r = h * 0.026;
    c.save();
    c.globalAlpha = 0.80 * g;
    c.strokeStyle = INK.zhu;
    c.lineWidth = LW(w, 0.0022);
    c.lineCap = 'round';
    switch (kind) {
      case 'taiji':
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
        c.beginPath();
        c.arc(cx, cy - r / 2, r / 2, Math.PI, 0);
        c.arc(cx, cy + r / 2, r / 2, 0, Math.PI, true);
        c.stroke();
        break;
      case 'bagua':
        baguaRing(c, cx, cy, r * 1.15, INK.zhu, 0.72 * g, 1);
        break;
      case 'sun':       /* 日轮：圆 + 放射短芒 */
        c.beginPath(); c.arc(cx, cy, r * 0.7, 0, Math.PI * 2); c.stroke();
        c.lineWidth = LW(w, 0.0016);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          c.beginPath();
          c.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
          c.lineTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25);
          c.stroke();
        }
        break;
      case 'moon':      /* 月轮：弧 + 弦 */
        c.beginPath(); c.arc(cx, cy, r, Math.PI * 0.35, Math.PI * 1.65); c.stroke();
        c.beginPath();
        c.moveTo(cx - r * 0.5, cy - r * 0.85);
        c.lineTo(cx - r * 0.5, cy + r * 0.85);
        c.stroke();
        break;
      case 'flame':     /* 火焰：三舌 */
        c.lineWidth = LW(w, 0.0020);
        for (let i = -1; i <= 1; i++) {
          c.beginPath();
          c.moveTo(cx + i * r * 0.7, cy + r * 0.8);
          c.quadraticCurveTo(cx + i * r * 0.7 + r * 0.3, cy, cx + i * r * 0.5, cy - r);
          c.stroke();
        }
        break;
      /* ========== 【1.9.0 新增】3 种顶部器物 ==========
       * 与原6 种刻意区分：'pagoda' 是塔形层叠（唯一竖向）、
       * 'pearl' 是宝珠（唯一带火焰托座）、'gate' 是双阙（唯一左右对称门形）。*/
      case 'pagoda':    /* 塔：三层收分 + 塔刹 */
        c.lineWidth = LW(w, 0.0018);
        for (let i = 0; i < 3; i++) {
          const t = i / 3;
          const hw = r * (1.30 - t * 0.62);
          const yy = cy + r * (0.70 - i * 0.62);
          c.beginPath();
          c.moveTo(cx - hw, yy); c.lineTo(cx + hw, yy);
          c.moveTo(cx - hw * 0.72, yy - r * 0.46);
          c.lineTo(cx + hw * 0.72, yy - r * 0.46);
          c.stroke();
        }
        c.beginPath();
        c.moveTo(cx, cy - r * 0.78); c.lineTo(cx, cy - r * 1.24);
        c.stroke();
        c.beginPath(); c.arc(cx, cy - r * 1.32, r * 0.16, 0, Math.PI * 2); c.stroke();
        break;
      case 'pearl':     /* 宝珠：内圆 + 火焰托座 + 三缕上升气 */
        c.beginPath(); c.arc(cx, cy - r * 0.18, r * 0.56, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 0.56 * g; c.lineWidth = LW(w, 0.0016);
        /* 托座：左右对称内卷 */
        c.beginPath();
        c.moveTo(cx - r * 1.10, cy + r * 0.72);
        c.quadraticCurveTo(cx, cy + r * 0.30, cx + r * 1.10, cy + r * 0.72);
        c.stroke();
        c.beginPath();
        c.moveTo(cx - r * 0.66, cy + r * 0.86);
        c.quadraticCurveTo(cx, cy + r * 0.58, cx + r * 0.66, cy + r * 0.86);
        c.stroke();
        /* 三缕上升气 */
        c.globalAlpha = 0.44 * g;
        for (const s of [-1, 0, 1]) {
          c.beginPath();
          c.moveTo(cx + s * r * 0.34, cy - r * 0.80);
          c.quadraticCurveTo(cx + s * r * 0.56, cy - r * 1.10, cx + s * r * 0.30, cy - r * 1.38);
          c.stroke();
        }
        break;
      case 'gate':      /* 双阙：左右门柱 + 额枋 */
        c.lineWidth = LW(w, 0.0020);
        for (const s of [-1, 1]) {
          const gx = cx + s * r * 1.18;
          c.beginPath();
          c.moveTo(gx, cy + r * 0.86); c.lineTo(gx, cy - r * 0.62);
          c.stroke();
          /* 柱头 */
          c.beginPath(); c.arc(gx, cy - r * 0.76, r * 0.20, 0, Math.PI * 2); c.stroke();
        }
        c.beginPath();
        c.moveTo(cx - r * 1.46, cy - r * 0.62); c.lineTo(cx + r * 1.46, cy - r * 0.62);
        c.stroke();
        c.globalAlpha = 0.50 * g; c.lineWidth = LW(w, 0.0016);
        /* 门内二竖，示双扇 */
        c.beginPath();
        c.moveTo(cx - r * 0.26, cy - r * 0.44); c.lineTo(cx - r * 0.26, cy + r * 0.80);
        c.moveTo(cx + r * 0.26, cy - r * 0.44); c.lineTo(cx + r * 0.26, cy + r * 0.80);
        c.stroke();
        break;
    }
    c.restore();
  }

  /* ---------- 6 种内部纹样 ---------- */
  function drawInnerKind(c, w, h, kind, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    const cx = w * 0.5, cy = h * 0.50, R = h * 0.150;
    c.save();
    c.globalAlpha = 0.44 * g;
    c.strokeStyle = INK.zhu;
    c.lineWidth = LW(w, 0.0018);
    switch (kind) {
      case 'yao':   /* 爻线：四条横线 */
        for (let i = 0; i < 4; i++) {
          const y = cy - R * 0.6 + i * R * 0.42;
          c.beginPath(); c.moveTo(cx - R * 0.8, y); c.lineTo(cx + R * 0.8, y); c.stroke();
        }
        break;
      case 'dots':  /* 星点：散布小点 */
        const rnd = mulberry32(0x7a3d);
        for (let i = 0; i < 14; i++) {
          const a = rnd() * Math.PI * 2, rr = R * (0.3 + rnd() * 0.8);
          c.beginPath();
          c.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, LW(w, 0.0012), 0, Math.PI * 2);
          c.stroke();
        }
        break;
      case 'ring':  /* 环带：双同心弧 */
        c.beginPath(); c.arc(cx, cy, R * 0.9, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(cx, cy, R * 0.62, 0, Math.PI * 2); c.stroke();
        break;
      case 'grid':  /* 网格：井字 */
        for (let i = -1; i <= 1; i++) {
          c.beginPath(); c.moveTo(cx + i * R * 0.55, cy - R * 0.8); c.lineTo(cx + i * R * 0.55, cy + R * 0.8); c.stroke();
          c.beginPath(); c.moveTo(cx - R * 0.8, cy + i * R * 0.55); c.lineTo(cx + R * 0.8, cy + i * R * 0.55); c.stroke();
        }
        break;
      case 'vine':  /* 藤蔓：波曲线 */
        for (let k = -1; k <= 1; k += 2) {
          c.beginPath();
          c.moveTo(cx + k * R * 0.9, cy - R * 0.8);
          c.bezierCurveTo(cx + k * R * 0.2, cy - R * 0.2, cx + k * R * 1.0, cy + R * 0.2, cx + k * R * 0.4, cy + R * 0.8);
          c.stroke();
        }
        break;
      case 'bar':   /* 横栏：三横 */
        for (let i = 0; i < 3; i++) {
          const y = cy - R * 0.4 + i * R * 0.4;
          c.beginPath(); c.moveTo(cx - R * 0.9, y); c.lineTo(cx + R * 0.9, y); c.stroke();
        }
        break;
      /* ========== 【1.9.0 新增】3 种内部纹样 ==========
       * 与原 6 种区分：'rune' 是折角篆纹（唯一全直线）、
       * 'spiral' 是旋涡（唯一曲线内卷）、'lotus' 是莲瓣（唯一放射对称）。*/
      case 'rune':  /* 折角篆纹：全直线折角，形如古篆笔画 */
        c.lineWidth = LW(w, 0.0016);
        c.lineCap = 'square'; c.lineJoin = 'miter';
        for (const s of [-1, 1]) {
          const x0 = cx + s * R * 0.34;
          c.beginPath();
          c.moveTo(x0, cy - R * 0.86);
          c.lineTo(x0, cy - R * 0.20);
          c.lineTo(x0 - s * R * 0.40, cy - R * 0.20);
          c.lineTo(x0 - s * R * 0.40, cy + R * 0.34);
          c.lineTo(x0, cy + R * 0.34);
          c.stroke();
          c.beginPath();
          c.moveTo(x0, cy + R * 0.56);
          c.lineTo(x0 + s * R * 0.30, cy + R * 0.78);
          c.lineTo(x0, cy + R * 0.94);
          c.stroke();
        }
        c.beginPath();
        c.moveTo(cx, cy - R * 0.52); c.lineTo(cx, cy + R * 0.14);
        c.stroke();
        c.lineCap = 'round'; c.lineJoin = 'round';
        break;
      case 'spiral': /* 旋涡：两道反向内卷 */
        c.lineWidth = LW(w, 0.0016);
        for (const s of [-1, 1]) {
          c.beginPath();
          for (let i = 0; i <= 26; i++) {
            const t = i / 26;
            const a = t * Math.PI * 1.7;
            const rr = R * (0.88 - t * 0.62);
            const px = cx + s * (R * 0.36) + Math.cos(a) * rr * s;
            const py = cy + Math.sin(a) * rr;
            if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
          }
          c.stroke();
        }
        /* 中央双点 */
        c.globalAlpha = 0.36 * g;
        c.beginPath();
        c.arc(cx - R * 0.16, cy, LW(w, 0.0013), 0, Math.PI * 2); c.stroke();
        c.beginPath();
        c.arc(cx + R * 0.16, cy, LW(w, 0.0013), 0, Math.PI * 2); c.stroke();
        break;
      case 'lotus':  /* 莲瓣：五瓣放射 + 莲心 */
        c.lineWidth = LW(w, 0.0017);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.56;
          c.beginPath();
          c.moveTo(cx, cy + R * 0.30);
          c.quadraticCurveTo(
            cx + Math.cos(a) * R * 0.58, cy + R * 0.30 + Math.sin(a) * R * 0.44,
            cx + Math.cos(a) * R * 0.34, cy + R * 0.30 + Math.sin(a) * R * 0.98
          );
          c.stroke();
        }
        c.globalAlpha = 0.52 * g;
        c.beginPath(); c.arc(cx, cy + R * 0.30, R * 0.16, 0, Math.PI * 2); c.stroke();
        break;
    }
    c.restore();
  }

  /* ---------- 7 种盘心 ---------- */
  function drawCoreKind(c, w, h, kind, dan, color, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.02) return;
    const cx = w * 0.5, cy = h * 0.205, R = h * 0.046;
    c.save();
    c.globalAlpha = g;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.strokeStyle = INK.zhu;
    c.fillStyle = color || INK.zhu;
    c.lineWidth = LW(w, 0.0022);
    const ch = Array.from(String(dan || '敕'));
    switch (kind) {
      case 'dot':    /* 一点：只画符胆首字为小点 + 外圈 */
        c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
        c.font = '700 ' + (R * 0.9) + 'px "STKaiti",serif';
        c.fillText(ch[0] || '敕', cx, cy);
        break;
      case 'eye':    /* 慧目：横椭圆 + 一点 */
        c.beginPath(); c.ellipse(cx, cy, R * 1.25, R * 0.62, 0, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(cx, cy, R * 0.22, 0, Math.PI * 2); c.fill();
        c.font = '700 ' + (R * 0.7) + 'px "STKaiti",serif';
        c.fillText(ch[0] || '敕', cx, cy - R * 1.0);
        break;
      case 'dou':    /* 豆灯：火焰形框 */
        c.beginPath();
        c.moveTo(cx - R * 0.7, cy + R * 0.6);
        c.quadraticCurveTo(cx - R * 0.9, cy - R * 0.3, cx, cy - R * 0.8);
        c.quadraticCurveTo(cx + R * 0.9, cy - R * 0.3, cx + R * 0.7, cy + R * 0.6);
        c.closePath(); c.stroke();
        c.font = '700 ' + (R * 0.72) + 'px "STKaiti",serif';
        c.fillText(ch[0] || '敕', cx, cy + R * 0.05);
        break;
      case 'knot':   /* 盘长：方扣 */
        c.strokeRect(cx - R * 0.8, cy - R * 0.6, R * 1.6, R * 1.2);
        c.strokeRect(cx - R * 0.5, cy - R * 0.9, R * 1.0, R * 1.8);
        c.font = '700 ' + (R * 0.68) + 'px "STKaiti",serif';
        c.fillText(ch[0] || '敕', cx, cy);
        break;
      case 'coin':   /* 金钱：外圆内方 */
        c.beginPath(); c.arc(cx, cy, R * 0.95, 0, Math.PI * 2); c.stroke();
        c.strokeRect(cx - R * 0.38, cy - R * 0.38, R * 0.76, R * 0.76);
        c.font = '700 ' + (R * 0.5) + 'px "STKaiti",serif';
        c.fillText(ch[0] || '敕', cx, cy);
        break;
      case 'seal':   /* 印：方框 */
        c.strokeRect(cx - R * 0.8, cy - R * 0.8, R * 1.6, R * 1.6);
        c.font = '700 ' + (R * 0.95) + 'px "STKaiti",serif';
        c.fillText(ch[0] || '敕', cx, cy);
        break;
      /* ========== 【1.9.0 新增】3 种盘心 ==========
       * 与原 7 种区分：'lotus' 是莲座托字（字在上）、
       * 'gourd' 是葫芦形（唯一上下两圆）、'sword' 是剑形（唯一纵向尖锋）。*/
      case 'lotus':  /* 莲座托字：字落莲上 */
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.52;
          c.beginPath();
          c.moveTo(cx, cy + R * 0.20);
          c.quadraticCurveTo(
            cx + Math.cos(a) * R * 0.62, cy + R * 0.20 + Math.sin(a) * R * 0.40,
            cx + Math.cos(a) * R * 0.40, cy + R * 0.20 + Math.sin(a) * R * 1.00
          );
          c.stroke();
        }
        c.beginPath();
        c.moveTo(cx - R * 0.95, cy + R * 0.24); c.lineTo(cx + R * 0.95, cy + R * 0.24);
        c.stroke();
        c.font = '700 ' + (R * 0.62) + 'px "STKaiti",serif';
        c.fillText(ch[0] || '敕', cx, cy - R * 0.52);
        break;
      case 'gourd':  /* 葫芦：上下两圆 + 束腰 */
        c.beginPath(); c.arc(cx, cy - R * 0.52, R * 0.46, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(cx, cy + R * 0.58, R * 0.62, 0, Math.PI * 2); c.stroke();
        c.beginPath();
        c.moveTo(cx - R * 0.26, cy - R * 0.14);
        c.quadraticCurveTo(cx - R * 0.44, cy + R * 0.16, cx - R * 0.52, cy + R * 0.30);
        c.moveTo(cx + R * 0.26, cy - R * 0.14);
        c.quadraticCurveTo(cx + R * 0.44, cy + R * 0.16, cx + R * 0.52, cy + R * 0.30);
        c.stroke();
        /* 葫芦藤 */
        c.globalAlpha = 0.50 * g; c.lineWidth = LW(w, 0.0016);
        c.beginPath();
        c.moveTo(cx + R * 0.16, cy - R * 0.94);
        c.quadraticCurveTo(cx + R * 0.52, cy - R * 1.20, cx + R * 0.30, cy - R * 1.42);
        c.stroke();
        break;
      case 'sword':  /* 剑形：纵向双锋 + 护手 + 剑柄 */
        c.beginPath();
        c.moveTo(cx, cy - R * 1.10);
        c.lineTo(cx + R * 0.26, cy - R * 0.62);
        c.lineTo(cx + R * 0.26, cy + R * 0.34);
        c.lineTo(cx, cy + R * 0.52);
        c.lineTo(cx - R * 0.26, cy + R * 0.34);
        c.lineTo(cx - R * 0.26, cy - R * 0.62);
        c.closePath(); c.stroke();
        c.globalAlpha = 0.60 * g; c.lineWidth = LW(w, 0.0016);
        c.beginPath();
        c.moveTo(cx - R * 0.62, cy + R * 0.44); c.lineTo(cx + R * 0.62, cy + R * 0.44);
        c.stroke();
        c.beginPath();
        c.moveTo(cx, cy + R * 0.52); c.lineTo(cx, cy + R * 0.94);
        c.moveTo(cx - R * 0.20, cy + R * 0.94); c.lineTo(cx + R * 0.20, cy + R * 0.94);
        c.stroke();
        break;
      case 'dan':     /* 大字符胆（原 default）
       * 【1.9.0 改为显式分支】原先 dan 挂在 switch 的 default 上：
       * 好处是漏传 core 时不会画空，坏处是「dan」在代码里根本不存在，
       * 审阅与自动化校验都无从判断它是否真被实现。
       * 现改为显式 case，未知值才落到 default（见下）。*/
        if (ch.length <= 1) {
          c.save();
          c.shadowColor = 'rgba(212,168,83,.55)';
          c.shadowBlur = R * 0.9;
          c.font = '700 ' + (R * 1.5) + 'px "STKaiti",serif';
          c.fillText(ch[0] || '敕', cx, cy);
          c.restore();
        } else {
          /* 【1.9.0 修复 · 真实缺陷】原off = R*1.0 而字font 为 R*0.9，
           * 一个汉字的实际宽度约等于字号，即字的半宽已达 R*0.45，
           * 与圆心距 R*1.0 叠加后**字被压在圆圈边缘上**（放大审阅实证：
           * F001「如」「律」二字左半被圆弧切断）。
           * 现把圆心距放大到字宽之外：off = 1.55R，
           * 圆半径同步放大到 0.78R，使字完整落在圈内。*/
          const off = R * 1.55;
          c.globalAlpha = g * 0.55; c.lineWidth = LW(w, 0.0020);
          c.beginPath(); c.arc(cx - off, cy, R * 0.78, 0, Math.PI * 2); c.stroke();
          c.beginPath(); c.arc(cx + off, cy, R * 0.78, 0, Math.PI * 2); c.stroke();
          c.globalAlpha = g;
          c.save();
          c.shadowColor = 'rgba(212,168,83,.45)'; c.shadowBlur = R * 0.6;
          /* 字号同步下调，确保单字完整落在半径 0.78R 的圈内 */
          c.font = '700 ' + (R * 0.86) + 'px "STKaiti",serif';
          c.fillText(ch[0], cx - off, cy);
          c.fillText(ch[1], cx + off, cy);
          c.restore();
        }
        break;
      default:
        /* 未知 core：退回大字符胆，保证不画空 —— 属兜底，不参与结构区分 */
        if (ch.length <= 1) {
          c.font = '700 ' + (R * 1.5) + 'px "STKaiti",serif';
          c.fillText(ch[0] || '敕', cx, cy);
        } else {
          c.font = '700 ' + (R * 0.9) + 'px "STKaiti",serif';
          c.fillText(ch[0], cx - R, cy);
          c.fillText(ch[1], cx + R, cy);
        }
    }
    c.restore();
  }

  /* ============================================================
   * 八、印章
   * ============================================================ */
  function drawSeal(c, w, h, dan, seed, grow) {
    const g = grow == null ? 1 : grow;
    if (g <= 0.82) return;
    const gg = Math.min(1, (g - 0.82) / 0.18);
    const s = Math.max(11, Math.min(w, h) * 0.082);
    const x = w - s * 1.70, y = h - s * 2.05;
    c.save();
    c.globalAlpha = 0.86 * gg;
    c.fillStyle = INK.zhu;
    c.fillRect(x, y, s, s);
    c.globalCompositeOperation = 'destination-out';
    const rnd = mulberry32(seed ^ 0x2b7d);
    for (let i = 0; i < 8; i++) {
      const px = x + rnd() * s, py = y + rnd() * s, r = s * (0.03 + rnd() * 0.08);
      c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = INK.paperHi;
    c.font = '600 ' + (s * 0.58) + 'px "STKaiti","KaiTi","SimSun",serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const chs = Array.from(String(dan));
    c.fillText(chs[chs.length - 1] || '符', x + s / 2, y + s / 2);
    c.restore();
  }

  /* ============================================================
   * 九、主入口
   * ============================================================ */

  function resolve(f) {
    const cat = (f && f.cat) || '护身';
    const base = FORM[cat] || FORM['护身'];

    /* ============================================================
     * 【1.9.0】逐项设计优先：100 条各有独立图形结构
     *
     * 1.8.4 只按 10 个类别的通用版式绘制，套上文字即成，
     * 导致多数成品「只换字不换形」。
     * 现改为：先读 fulu-design.js 的逐项设计（art 字段），
     * 缺项才回退到类别默认 —— 故同类的符也有不同形制。
     *
     * art 各字段的**结构**含义见 fulu-design.js 头注。
     * ============================================================ */
    const FD = (typeof globalThis !== 'undefined' && globalThis.FuluDesign) ? globalThis.FuluDesign : null;
    const D = (FD && typeof FD.designOf === 'function') ? FD.designOf((f && f.id) || '') : null;

    const form = {
      head: base.head, deity: base.deity, tone: base.tone,
      /* 符脚与符枝改由逐项设计决定 */
      foot: (D && D.foot) || base.foot,
      frame: (D && D.frame) || base.frame,
      wriggle: (D && D.branch) || base.wriggle,
      left: base.left, right: base.right, spells: base.spells,
      /* 逐项设计的其余字段 */
      art: D
    };
    const wx = deriveWx(f && f.name, f && f.desc);
    if (cat === '调身' && base.wuxingForms) {
      const wf = base.wuxingForms[wx || '土'] || base.wuxingForms['土'];
      form.deity = wf.deity; form.spells = wf.spells;
      form.left = wf.left; form.right = wf.right;
    }
    const dan = deriveDan(f && f.name);
    return {
      form: form, dan: dan, grail: deriveGrail(dan, cat, f && f.id), wx: wx,
      deity: form.deity, foot: form.foot, tone: form.tone
    };
  }

  const referenceThumbs=new Map(),referenceInk=new Map();let referenceFull=null,referenceFullPath='';
  function referenceImage(path,full){
    if(full&&referenceFullPath===path)return referenceFull;
    if(!full&&referenceThumbs.has(path))return referenceThumbs.get(path);
    const im=new Image();im.src=path;
    if(full){referenceFull=im;referenceFullPath=path;}else referenceThumbs.set(path,im);
    return im;
  }
  function drawReference(cv,f,opt){
    const full=cv.classList.contains('fz-canvas')||!!opt.pixelWidth;
    const im=referenceImage(full?f.image:(f.thumb||f.image),full),w=full?600:(cv.clientWidth||132),h=full?600:(cv.clientHeight||176),dpr=full?1:Math.min(window.devicePixelRatio||1,2);
    if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
    const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    c.fillStyle='#e8cc87';c.fillRect(0,0,w,h);
    if(!im.complete||!im.naturalWidth){im.onload=()=>drawReference(cv,f,opt);return true;}
    const size=Math.min(w,h),x=(w-size)/2,y=(h-size)/2,grow=Math.max(0,Math.min(1,opt.grow??1));
    if(grow>=.995){c.drawImage(im,x,y,size,size);}else{
      const key=(full?f.image:f.thumb)+'|'+Math.round(size);
      let ink=referenceInk.get(key);
      if(!ink){
        ink=document.createElement('canvas');ink.width=ink.height=Math.max(1,Math.round(size));
        const ic=ink.getContext('2d',{willReadFrequently:true});ic.drawImage(im,0,0,ink.width,ink.height);
        try{
          const pixels=ic.getImageData(0,0,ink.width,ink.height),d=pixels.data;
          for(let i=0;i<d.length;i+=4){const red=d[i],green=d[i+1],blue=d[i+2];
            d[i+3]=Math.max(0,Math.min(255,((red-green)-38)*5.5+(165-green)*1.2));}
          ic.putImageData(pixels,0,0);
        }catch(_e){/* 图片像素读取不可用时仍用原图的非线性显现。 */}
        referenceInk.set(key,ink);
        if(referenceInk.size>12)referenceInk.delete(referenceInk.keys().next().value);
      }
      const reveal=document.createElement('canvas');reveal.width=ink.width;reveal.height=ink.height;
      const rc=reveal.getContext('2d');rc.drawImage(ink,0,0);rc.globalCompositeOperation='destination-in';
      const mask=document.createElement('canvas');mask.width=ink.width;mask.height=ink.height;
      const mc=mask.getContext('2d');
      // 中轴、两侧与四角分别长出墨迹，不使用整幅图的纵向裁切。
      [[.50,.27,0,.43],[.50,.69,.12,.47],[.22,.45,.23,.38],[.78,.45,.31,.38],
        [.22,.83,.45,.29],[.78,.83,.48,.29],[.18,.16,.55,.27],[.82,.16,.60,.27]].forEach(([sx,sy,delay,reach])=>{
        const local=Math.max(0,Math.min(1,(grow-delay)/(1-delay)));if(local<=0)return;
        const radius=ink.width*reach*local,g=mc.createRadialGradient(sx*ink.width,sy*ink.height,0,sx*ink.width,sy*ink.height,radius);
        g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.77,'rgba(255,255,255,.96)');g.addColorStop(1,'rgba(255,255,255,0)');
        mc.fillStyle=g;mc.beginPath();mc.arc(sx*ink.width,sy*ink.height,radius,0,Math.PI*2);mc.fill();
      });
      rc.drawImage(mask,0,0);rc.globalCompositeOperation='source-over';
      c.drawImage(reveal,x,y,size,size);
      c.save();c.globalAlpha=.22+grow*.20;c.strokeStyle='#b84220';c.shadowColor='#ee8e3c';c.shadowBlur=13;
      c.beginPath();c.moveTo(x+size*.47,y+size*.18);c.bezierCurveTo(x+size*.60,y+size*.33,x+size*.38,y+size*.50,x+size*.51,y+size*.70*grow+.18*size);c.stroke();c.restore();
    }
    cv.setAttribute('data-fulu-id',f.id);return true;
  }
  function draw(cv, f, opt) {
    opt = opt || {};
    if(f&&f.image)return drawReference(cv,f,opt);
    const c = cv.getContext('2d');
    if (!c) return false;
    const baseDpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
    const w = cv.clientWidth || cv.width || 120;
    const h = cv.clientHeight || cv.height || 170;
    const dpr = opt.pixelWidth ? Math.max(1, Number(opt.pixelWidth) / w) : baseDpr;
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(h * dpr));
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    const grow = opt.grow == null ? 1 : Math.max(0, Math.min(1, opt.grow));
    const seed = hashStr((f && f.id) || '') ^ hashStr((f && f.name) || '');
    const R = resolve(f);
    const rnd = mulberry32(seed);

    /* 1. 符纸 + 双框 */
    drawPaper(c, w, h, rnd);

    /* 2. 边框与款识
     * 【1.9.0】边框改由逐项设计的 frame 字段分派（8 种：double/triple/
     * rail/bracket/seal/ribbon/none），不再全用同一个 strokeRect。*/
    const ART = R.form.art || {};
    const bw = Math.max(16, w * 0.128);
    const bx = w * 0.042;
    const by = h * 0.150;
    const bh = h * 0.650;
    const SLOT = drawFrameKind(c, w, h, ART.frame || 'double', 1)
      || { left: bx + bw / 2, right: w - bx - bw / 2 };
    const fs = Math.max(6.5, Math.min(bw * 0.56, h * 0.029));
    const gf1 = Math.max(0, Math.min(1, (grow - 0.10) / 0.30));
    /* 【1.9.0】款识按 frame 实际栏位对齐（rail/bracket 下须内移） */
    vText(c, SLOT.left, by + bh * 0.10, (R.form.left || [])[0] || '', fs, INK.zhu, { grow: gf1 });
    vText(c, SLOT.left, by + bh * 0.58, (R.form.left || [])[1] || '', fs, INK.zhu, { grow: gf1 });
    vText(c, SLOT.right, by + bh * 0.10, (R.form.right || [])[0] || '', fs, INK.zhu, { grow: gf1 });
    vText(c, SLOT.right, by + bh * 0.58, (R.form.right || [])[1] || '', fs, INK.zhu, { grow: gf1 });

    /* 3. 符枝（卷曲云篆）*/
    const grb = Math.max(0, Math.min(1, (grow - 0.14) / 0.34));
    drawBranchKind(c, w, h, ART.branch || 's', -1, seed, grb);
    drawBranchKind(c, w, h, ART.branch || 's', 1, seed, grb);
    if (R.form.wriggle === 'thunder' || R.form.wriggle === 'lightning') {
      thinLightning(c, w, h, -1, INK.zhu, 0.42, grb);
      thinLightning(c, w, h, 1, INK.zhu, 0.42, grb);
    }
    /* 内部辅助纹样【1.9.0】按 inner 字段分派（6 种） */
    drawInnerKind(c, w, h, ART.inner || 'ring', grb);

    /* 4a. 顶部器物【1.9.0】按 top 字段分派（6 种） */
    drawTopKind(c, w, h, ART.top || 'none', Math.max(0, Math.min(1, grow / 0.14)));

    /* 4b. 符头：敕令 + 神名 */
    const gh = Math.max(0, Math.min(1, grow / 0.18));
    if (gh > 0.02) {
      c.save();
      c.globalAlpha = gh;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const hs = Math.max(8, Math.min(w * 0.108, h * 0.058));
      c.font = '700 ' + hs + 'px "STKaiti","KaiTi","SimSun",serif';
      c.fillStyle = INK.zhu;
      c.fillText(R.form.head, w * 0.5, h * 0.108);
      c.font = '500 ' + (hs * 0.42) + 'px "STKaiti","KaiTi","SimSun",serif';
      c.fillStyle = INK.mo;
      c.fillText(R.deity, w * 0.5, h * 0.108 + hs * 0.80);
      c.restore();
    }

    /* 5. 盘心【1.9.0】改由逐项设计的 core 字段分派（7 种：
     * dan 大字符胆 / dot 一点 / eye 慧目 / dou 豆灯 / knot 盘长 /
     * coin 金钱 / seal 印），不再全用同一种大字排布。 */
    const gd = Math.max(0, Math.min(1, (grow - 0.20) / 0.34));
    if (gd > 0.02) {
      drawCoreKind(c, w, h, (R.form.art && R.form.art.core) || 'dan',
        R.dan, INK.zhu, gd);
      /* 双字符胆且盘心为「dan」时，下方补一行小字（1.8.4 行为） */
      const chs = Array.from(R.dan);
      if (chs.length > 1 && (R.form.art && R.form.art.core) === 'dan') {
        c.save();
        c.globalAlpha = gd * 0.8;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = '700 ' + (h * 0.030) + 'px "STKaiti","KaiTi","SimSun",serif';
        c.fillStyle = INK.zhuLo;
        c.fillText(chs.slice(1).join(''), w * 0.5, h * 0.205 + h * 0.068);
        c.restore();
      }
    }

    /* 6. 中轴符文串（咒身）+ 两侧引栏 */
    const gg2 = Math.max(0, Math.min(1, (grow - 0.30) / 0.45));
    if (gg2 > 0.02) {
      const gs = Math.max(6.5, Math.min(w * 0.072, h * 0.034));
      const gy = h * 0.300;
      const total = R.grail.length;
      c.save();
      c.globalAlpha = gg2;
      c.font = '500 ' + gs + 'px "STKaiti","KaiTi","SimSun",serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = INK.zhuLo;
      let y = gy;
      for (let i = 0; i < total; i++) {
        if (i / total <= gg2) c.fillText(R.grail[i], w * 0.5, y);
        y += gs * 1.10;
      }
      c.restore();
      c.save();
      c.globalAlpha = gg2 * 0.48;
      c.strokeStyle = INK.zhu;
      c.lineWidth = LW(w, 0.0018);
      const rx = w * 0.5;
      c.beginPath();
      c.moveTo(rx - w * 0.048, gy - gs * 0.6);
      c.lineTo(rx - w * 0.048, y - gs * 0.7);
      c.moveTo(rx + w * 0.048, gy - gs * 0.6);
      c.lineTo(rx + w * 0.048, y - gs * 0.7);
      c.stroke();
      c.restore();
    }

    /* 7. 符脚 */
    drawFoot(c, w, h, R.foot, seed, Math.max(0, Math.min(1, (grow - 0.60) / 0.32)));

    /* 8. 印章 */
    drawSeal(c, w, h, R.dan, seed, grow);

    cv.setAttribute('data-fulu-id', (f && f.id) || '');
    cv.setAttribute('data-fulu-dan', R.dan);
    cv.setAttribute('data-fulu-deity', R.deity);
    return true;
  }

  function animate(cv, f, opt) {
    opt = opt || {};
    const dur = opt.dur || 1500;
    let raf = 0, t0 = 0;
    const step = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min(1, (ts - t0) / dur);
      draw(cv, f, { grow: 1 - Math.pow(1 - p, 2.4) });
      if (p < 1) raf = requestAnimationFrame(step);
      else if (opt.onDone) opt.onDone();
    };
    raf = requestAnimationFrame(step);
    return { stop() { if (raf) cancelAnimationFrame(raf); raf = 0; } };
  }

  function describe(f) {
    const R = resolve(f);
    return {
      dan: R.dan, deity: R.deity, foot: R.foot, tone: R.tone,
      head: R.form.head, spells: R.form.spells, wx: R.wx,
      left: R.form.left, right: R.form.right, grail: R.grail
    };
  }

  return {
    draw: draw,
    animate: animate,
    resolve: resolve,
    describe: describe,
    _internals: {
      FORM: FORM, deriveDan: deriveDan, deriveWx: deriveWx,
      deriveGrail: deriveGrail, INK: INK, LW: LW
    }
  };
});
