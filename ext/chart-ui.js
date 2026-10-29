/* 玄机阁 · 紫微斗数圆盘渲染
 *
 * 范围：
 *  - 只把已排好的盘面如实画出来：十二宫格、星曜落宫、庙旺、四化、大限。
 *  - 圆盘是**纯函数**（chart(chart, opts) → svg 字符串），不碰 DOM、不读全局时间，
 *    同一参数两次渲染必须逐字符相同，界面层再负责挂事件。
 *
 * 坐标约定（与 tests/ext-p2-chart.js 的断言一致）：
 *  - viewBox 为 0 0 W H，圆心 (W/2, H/2)。
 *  - 十二宫自西南方向的寅宫起，逆时针排列，即子丑寅卯…在盘上逆时针走。
 *    用 atan2(dx, -dy) 量角（北=0、东=90）时，寅落在 -165°，每宫 +30°，
 *    升序排列正好是 寅卯辰巳午未申酉戌亥子丑。
 */
(function (root) {
  'use strict';

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;

  /* 寅宫起始角（度）。改这一个数就会改变整盘朝向，故单独提出。 */
  var YIN_ANGLE = -165;

  var ZODIAC_CN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  /* 本模块的立场声明，务必出现在盘面可见处。
     措辞与 BOUNDARY 一致：只做术语解释，不下吉凶结论。 */
  var NOTICE = '紫微斗数是传统命理体系。本盘只做排盘呈现与传统术语解释，'
    + '不作命运推断、不作吉凶断语；庙旺利陷与四化均为传统术语，请勿据以决策。';

  /* 庙旺等级对应的笔画粗细与字号，让「庙」在盘上真的看得出来。 */
  var BRIGHTNESS_WEIGHT = {
    庙: 1.6, 旺: 1.4, 得: 1.15, 利: 1.05,
    平: 0.9, 不: 0.9, 失: 0.9
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function n(v, digits) {
    /* 统一保留固定位数：浮点尾数会让「纯函数逐字符相同」的断言变得脆弱，
       也会让 SVG 体积膨胀。这里四舍五入到 2 位。 */
    var s = Number(v).toFixed(digits == null ? 2 : digits);
    /* 去掉 "-0.00" 这种难看的输出 */
    return s === '-' + (0).toFixed(digits == null ? 2 : digits) ? (0).toFixed(digits == null ? 2 : digits) : s;
  }

  function branchAngle(branch) {
    var idx = ZODIAC_CN.indexOf(branch);
    if (idx < 0) idx = 0;
    /* 地支序：子0丑1寅2…亥11。寅=2 起始，故 k = idx - 2 */
    var k = ((idx - 2) % 12 + 12) % 12;
    return (YIN_ANGLE + k * 30) * DEG;
  }

  function polar(cx, cy, r, ang) {
    return { x: cx + r * Math.sin(ang), y: cy - r * Math.cos(ang) };
  }

  function weightOf(b) {
    var ch = String(b || '').charAt(0);
    return BRIGHTNESS_WEIGHT[ch] || 0.9;
  }

  /* ---------- 宫格 ---------- */

  function palaceCell(p, cx, cy, rInner, rOuter) {
    var ang = branchAngle(p.branch);
    var half = 15 * DEG;
    var a1 = polar(cx, cy, rInner, ang - half);
    var a2 = polar(cx, cy, rOuter, ang - half);
    var b2 = polar(cx, cy, rOuter, ang + half);
    var b1 = polar(cx, cy, rInner, ang + half);
    var mid = polar(cx, cy, (rInner + rOuter) / 2, ang);

    var d = 'M' + n(a1.x) + ' ' + n(a1.y)
      + 'L' + n(a2.x) + ' ' + n(a2.y)
      + 'A' + n(rOuter) + ' ' + n(rOuter) + ' 0 0 1 ' + n(b2.x) + ' ' + n(b2.y)
      + 'L' + n(b1.x) + ' ' + n(b1.y)
      + 'A' + n(rInner) + ' ' + n(rInner) + ' 0 0 0 ' + n(a1.x) + ' ' + n(a1.y) + 'Z';

    /* 地支 + 宫名标在扇形外缘 */
    var edge = polar(cx, cy, rOuter - 14, ang);
    var aria = p.branch + '宫，' + p.name + (p.stars.length ? '，' + p.stars.length + ' 星' : '');

    return '<g class="xext-c-palace" data-palace="' + esc(p.name) + '" '
      + 'data-branch="' + esc(p.branch) + '" '
      + 'cx="' + n(mid.x) + '" cy="' + n(mid.y) + '" '
      + 'role="button" tabindex="0" aria-label="' + esc(aria) + '">'
      + '<path d="' + d + '" fill="rgba(212,175,55,0.05)" stroke="rgba(212,175,55,0.45)" stroke-width="1"/>'
      + '<text x="' + n(edge.x) + '" y="' + n(edge.y) + '" text-anchor="middle" '
      + 'dominant-baseline="middle" font-size="13" fill="#e8d9a0">' + esc(p.branch) + '</text>'
      + '<text x="' + n(edge.x) + '" y="' + n(edge.y + 15) + '" text-anchor="middle" '
      + 'dominant-baseline="middle" font-size="11" fill="#a89b7a">' + esc(p.name) + '</text>'
      + '</g>';
  }

  /* ---------- 星曜 ---------- */

  /* 一宫的星曜排布。
     两个坑：
       1) 不能用屏幕 xy 排字——扇形是斜的，屏幕轴不是。
          必须用扇形局部基：径向 u=(sin,−cos)、切向 t=(cos,sin)。
       2) 不能用固定列距/固定列数。扇形在rMid 处的切向宽度随角度变化，
          固定 30px 列距会让星多宫窄的字叠在一起、还会溢到扇形外。
          正确做法：行内沿切向横排，按估算字宽累加，装不下就换行。 */
  function starWidth(s) {
    /* 12px 中文单字宽约 12px，两字24px；带「化X」小字后缀再加 22px。
       另留 10px 间隙——描边 stroke-width 2.5 会向外扩1.25px，
       估算若不计间隙，实机上就会看到两字压在一起。 */
    return (s.name.length <= 2 ? 24 : 36) + (s.mutagen ? 24 : 0) + 10;
  }

  function starTexts(p, cx, cy, rInner, rOuter) {
    var ang = branchAngle(p.branch);
    var ordered = p.stars.slice().sort(function (a, b) {
      var wa = weightOf(a.brightness), wb = weightOf(b.brightness);
      if (wa !== wb) return wb - wa;
      return 0;
    });
    if (!ordered.length) return '';

    var rMid = (rInner + rOuter) / 2;
    /* 30° 扇形在 rMid 处的切向弧宽 */
    var tMax = 2 * rMid * Math.sin(15 * DEG);
    var rowH = 23;

    /* 先按切向宽度分行 */
    var lines = [];
    var cur = [], curW = 0;
    ordered.forEach(function (s) {
      var w = starWidth(s);
      if (cur.length && curW + w > tMax) { lines.push({ items: cur, w: curW }); cur = []; curW = 0; }
      cur.push(s); curW += w;
    });
    if (cur.length) lines.push({ items: cur, w: curW });

    /* 径向可用高度：外缘留出地支+宫名标注的 38px，内侧留 8px */
    var rTop = rOuter - 36;
    var rBot = rInner + 10;
    /* 行数超量时压缩行距，而不是压到内圈上——压线比挤一点更难读 */
    var rGap = lines.length > 1
      ? Math.min(rowH, (rTop - rBot) / (lines.length - 1))
      : 0;
    /* 行距被压缩后仍要保证不小于字高 14px，宁可挤一点也不许叠字 */
    if (lines.length > 1 && rGap < 14) rGap = 14;

    var ux = Math.sin(ang), uy = -Math.cos(ang);
    var tx = Math.cos(ang), ty = Math.sin(ang);

    var out = '';
    lines.forEach(function (ln, li) {
      var r = rTop - li * rGap;
      /* 每行自身居中于扇形切向 */
      var start = -ln.w / 2;
      var cursor = start;
      ln.items.forEach(function (s) {
        var w = starWidth(s);
        var toff = cursor + w / 2;
        cursor += w;
        var x = cx + r * ux + toff * tx;
        var y = cy + r * uy + toff * ty;
        var cls = 'xext-c-star xext-c-star--' + s.type + (s.mutagen ? ' xext-c-star--mutagen' : '');
        var label = s.name + (s.mutagen ? '化' + s.mutagen : '') + '，' + s.brightness
          + '，' + s.typeLabel + '，在' + p.name;
        out += '<g class="' + cls + '" data-star="' + esc(s.name) + '"'
          + (s.mutagen ? ' data-mutagen="' + esc(s.mutagen) + '"' : '')
          + ' data-palace-name="' + esc(p.name) + '"'
          + ' role="button" tabindex="0" aria-label="' + esc(label) + '">'
          + '<text x="' + n(x) + '" y="' + n(y) + '" text-anchor="middle" '
          + 'dominant-baseline="middle" font-size="12" font-weight="' + n(weightOf(s.brightness), 2) + '" '
          + 'fill="' + (s.mutagen ? '#f0c14b' : (s.type === 'major' ? '#f5efdc' : '#9fb0c2')) + '" '
          + 'paint-order="stroke" stroke="rgba(8,11,20,0.9)" stroke-width="2.5">'
          + esc(s.name)
          + (s.mutagen ? '<tspan font-size="10" fill="#f0c14b">化' + esc(s.mutagen) + '</tspan>' : '')
          + '</text></g>';
      });
    });
    return out;
  }

  /* ---------- 中心区 ---------- */

  function hub(chart, cx, cy, r) {
    var out = '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(r) + '" '
      + 'fill="rgba(12,16,28,0.92)" stroke="rgba(212,175,55,0.5)" stroke-width="1"/>';
    var lines = [
      { t: chart.gender + ' · ' + chart.solarDate + ' ' + chart.time, size: 12 },
      { t: '五行局 ' + chart.fiveElementsClass, size: 12 },
      { t: '命宫在' + (chart.palaces.filter(function (p) { return p.isSoul; })[0] || {}).branch, size: 11 },
      { t: chart.chineseDate + ' ' + chart.zodiac, size: 11 }
    ];
    var y = cy - (lines.length - 1) * 9;
    lines.forEach(function (l) {
      out += '<text x="' + n(cx) + '" y="' + n(y) + '" text-anchor="middle" '
        + 'dominant-baseline="middle" font-size="' + l.size + '" fill="#d8c89a">' + esc(l.t) + '</text>';
      y += 18;
    });
    return out;
  }

  /* ---------- 外圈地支刻度 ---------- */

  function outerRing(chart, cx, cy, r) {
    var out = '';
    ZODIAC_CN.forEach(function (z) {
      var ang = branchAngle(z);
      var hit = chart.palaces.filter(function (p) { return p.branch === z; })[0];
      var p1 = polar(cx, cy, r, ang);
      var p2 = polar(cx, cy, r + 8, ang);
      out += '<line x1="' + n(p1.x) + '" y1="' + n(p1.y) + '" x2="' + n(p2.x) + '" y2="' + n(p2.y) + '" '
        + 'stroke="rgba(212,175,55,0.5)" stroke-width="1"/>';
    });
    out += '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(r) + '" fill="none" '
      + 'stroke="rgba(212,175,55,0.35)" stroke-width="1"/>';
    return out;
  }

  /* ---------- 对外 ---------- */

  function chart(data, opts) {
    if (!data || !Array.isArray(data.palaces) || data.palaces.length !== 12) {
      throw new Error('chart 需要一份含十二宫的排盘结果。');
    }
    var o = opts || {};
    var W = Number(o.width) > 0 ? Number(o.width) : 720;
    var H = Number(o.height) > 0 ? Number(o.height) : W;
    var cx = W / 2, cy = H / 2;
    var rOuter = Math.min(W, H) / 2 - 34;
    var rHub = Math.min(W, H) * 0.115;
    var rInner = rHub + 12;

    var body = '';
    body += '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(rOuter + 12) + '" '
      + 'fill="rgba(8,11,20,0.6)" stroke="none"/>';
    body += outerRing(data, cx, cy, rOuter);

    data.palaces.forEach(function (p) {
      body += palaceCell(p, cx, cy, rInner, rOuter);
    });
    data.palaces.forEach(function (p) {
      body += starTexts(p, cx, cy, rInner, rOuter);
    });
    body += hub(data, cx, cy, rHub);

    /* 立场声明：写在盘下方，宁可小一点也不省。 */
    var noticeY = H - 8;
    var notice = NOTICE.split('；').map(function (s) { return s; }).join('；');
    var body2 = '<text class="xext-c-notice" x="' + n(cx) + '" y="' + n(noticeY) + '" '
      + 'text-anchor="middle" font-size="11" fill="#8d8672">' + esc(notice) + '</text>';

    var title = '紫微斗数本命盘 · ' + data.gender + ' · ' + data.solarDate + ' ' + data.time;

    return '<svg class="xext-chart" xmlns="http://www.w3.org/2000/svg" '
      + 'viewBox="0 0 ' + n(W, 0) + ' ' + n(H, 0) + '" width="' + n(W, 0) + '" height="' + n(H, 0) + '" '
      + 'role="img" aria-label="' + esc(title + '。' + NOTICE) + '">'
      + '<title>' + esc(title) + '</title>'
      + body + body2
      + '</svg>';
  }

  /* 选中某宫时的描边叠加层（纯函数，供界面高亮用） */
  function highlight(size, palaceName) {
    var o = size || {};
    var W = Number(o.width) > 0 ? Number(o.width) : 720;
    var H = Number(o.height) > 0 ? Number(o.height) : W;
    var cx = W / 2, cy = H / 2;
    var rOuter = Math.min(W, H) / 2 - 34;
    var rInner = Math.min(W, H) * 0.115 + 12;
    var p = (o.palace || null);
    if (!p) return '';
    var ang = branchAngle(p.branch);
    var half = 15 * DEG;
    var a1 = polar(cx, cy, rInner, ang - half);
    var a2 = polar(cx, cy, rOuter, ang - half);
    var b2 = polar(cx, cy, rOuter, ang + half);
    var b1 = polar(cx, cy, rInner, ang + half);
    var d = 'M' + n(a1.x) + ' ' + n(a1.y) + 'L' + n(a2.x) + ' ' + n(a2.y)
      + 'A' + n(rOuter) + ' ' + n(rOuter) + ' 0 0 1 ' + n(b2.x) + ' ' + n(b2.y)
      + 'L' + n(b1.x) + ' ' + n(b1.y)
      + 'A' + n(rInner) + ' ' + n(rInner) + ' 0 0 0 ' + n(a1.x) + ' ' + n(a1.y) + 'Z';
    return '<path d="' + d + '" fill="rgba(212,175,55,0.14)" stroke="#f0c14b" stroke-width="2"/>';
  }

  void TAU;

  root.ChartUI = {
    version: 'chart-ui-1.0.0',
    NOTICE: NOTICE,
    ZODIAC_CN: ZODIAC_CN,
    chart: chart,
    highlight: highlight,
    branchAngle: branchAngle
  };
})(typeof window !== 'undefined' ? window : globalThis);