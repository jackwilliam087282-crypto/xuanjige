/* 塔罗牌 · SVG 牌面图案生成器（第2阶段新增）
 *
 * 设计约束：
 *  - 纯代码生成，不引入任何外部图片资源，不引用未核实授权的牌面图。
 *  - 每张牌都必须有「对应得上」的图案：大阿卡纳 22 张各自独立构图；
 *    小阿卡纳按花色符号 × 点数排布，点数与画面里的符号数量严格一致。
 *  - 图案使用几何/符号化风格，不模仿任何具体出版物的画风。
 *  - 逆位不做第二套图案，只在渲染层整体旋转 180°，保持「同一张牌」的连续性。
 *
 * 卡片坐标系：viewBox 0 0 300 540。
 *   y= 40 罗马数字   y= 62 牌名
 *   y= 84..404 图案窗（280 x 320）
 *   y=428 分组/元素   y=452 花色点阵或分隔纹
 */
(function (global) {
  'use strict';

  /* ============================================================ 配色 */

  var THEME = {
    major: { line: '#d9b26a', line2: '#8a6a32', deep: '#141d33', glow: '#f5dba3', accent: '#c9a227' },
    wands: { line: '#e8a04a', line2: '#8a4f1c', deep: '#1d1620', glow: '#ffd9a0', accent: '#ff8c42' },
    cups: { line: '#6fc0dc', line2: '#2b5f7d', deep: '#101d2c', glow: '#d6f2ff', accent: '#48b8dd' },
    swords: { line: '#9fb4d8', line2: '#3f5273', deep: '#111726', glow: '#e2ecff', accent: '#7f9dd0' },
    pentacles: { line: '#d9c46a', line2: '#6f5c26', deep: '#1a1810', glow: '#f6ecc4', accent: '#c9a227' }
  };

  function themeOf(card) {
    if (!card) return THEME.major;
    if (card.type === 'major') return THEME.major;
    return THEME[card.suit] || THEME.major;
  }

  var ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
    'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];

  var SUIT_LABEL = {
    wands: '权杖 · 火', cups: '圣杯 · 水', swords: '宝剑 · 风', pentacles: '星币 · 土'
  };

  /* ============================================================ 基础工具 */

  function seeded(seed) {
    var s = (seed | 0) || 1;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }
  function rnd(seed) { return seeded(seed); }
  function n(v) { return Math.round(v * 100) / 100; }

  /* 花纹边框：外金线 + 内细线 + 四角回纹 */
  function frame(t, uid) {
    return [
      '<rect x="3" y="3" width="294" height="534" rx="14" fill="' + t.deep + '" stroke="' + t.line + '" stroke-width="2"/>',
      '<rect x="11" y="11" width="278" height="518" rx="10" fill="none" stroke="' + t.line2 + '" stroke-width="1"/>',
      '<rect x="19" y="76" width="262" height="336" rx="8" fill="none" stroke="' + t.line + '" stroke-width="1" stroke-opacity=".55"/>',
      corner(24, 24, uid), corner(276, 24, uid + 1), corner(24, 516, uid + 2), corner(276, 516, uid + 3)
    ].join('');
  }
  function corner(x, y, k) {
    var d = 'M' + x + ' ' + (y + 18) + ' L' + x + ' ' + y + ' L' + (x + 18) + ' ' + y;
    return '<path d="' + d + '" fill="none" stroke="#d9b26a" stroke-width="1.6" stroke-opacity=".8"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="2.4" fill="#d9b26a" fill-opacity=".85"/>' +
      '<path d="M' + (x + 6) + ' ' + (y + 6) + ' l' + (k % 2 ? 4 : -4) + ' ' + (k % 2 ? 4 : -4) +
      ' l4 0 l0 4" fill="none" stroke="#d9b26a" stroke-width="1" stroke-opacity=".5"/>';
  }

  /* 星野：确定性随机，保证同一张牌每次渲染一致 */
  function starField(cx, cy, w, h, count, seed, color) {
    var r = rnd(seed), out = ['<g>'], i, x, y, rad;
    for (i = 0; i < count; i += 1) {
      x = cx - w / 2 + r() * w; y = cy - h / 2 + r() * h;
      rad = 0.5 + r() * 1.5;
      out.push('<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(rad) + '" fill="' + color +
        '" fill-opacity="' + n(0.25 + r() * 0.55) + '"/>');
    }
    out.push('</g>');
    return out.join('');
  }

  /* 地平线。pts存的是「起伏后的 y」，围绕传入的 y 上下浮动若干像素；
     不能拿 x 坐标当 y 用，否则多边形会从画面中部斜穿到角上，
     在牌面上形成一道突兀的亮带。 */
  function ground(y, t, seed) {
    var r = rnd(seed || 7), pts = [], i;
    for (i = 0; i <= 8; i += 1) pts.push(n(y - 5 + r() * 10));
    var d = 'M26 ' + pts[0];
    for (i = 1; i < pts.length; i += 1) d += ' L' + (26 + i * 30) + ' ' + pts[i];
    return '<path d="' + d + ' L266 ' + n(y + 7) + ' L26 ' + n(y + 7) + ' Z" fill="' + t.line2 + '" fill-opacity=".28"/>' +
      '<path d="' + d + '" fill="none" stroke="' + t.line + '" stroke-width="1.2" stroke-opacity=".5"/>';
  }

  /* ============================================================ 图案基元 */

  function sun(cx, cy, r, t, rays) {
    var out = ['<g>'], i, a, x1, y1, x2, y2;
    for (i = 0; i < (rays || 12); i += 1) {
      a = (Math.PI * 2 * i) / (rays || 12);
      x1 = cx + Math.cos(a) * (r + 4); y1 = cy + Math.sin(a) * (r + 4);
      x2 = cx + Math.cos(a) * (r + 16); y2 = cy + Math.sin(a) * (r + 16);
      out.push('<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) +
        '" stroke="' + t.accent + '" stroke-width="2" stroke-linecap="round"/>');
    }
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + t.accent + '" fill-opacity=".9"/>');
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + n(r * 1.5) + '" fill="none" stroke="' + t.accent +
      '" stroke-opacity=".35" stroke-width="1"/>');
    out.push('</g>');
    return out.join('');
  }

  function moon(cx, cy, r, t, full) {
    if (full) {
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + t.glow + '" fill-opacity=".92"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + n(r * 1.45) + '" fill="none" stroke="' + t.glow +
        '" stroke-opacity=".28" stroke-width="1"/>';
    }
    return '<path d="M' + cx + ' ' + n(cy - r) + ' A' + r + ' ' + r + ' 0 1 0 ' + cx + ' ' + n(cy + r) +
      ' A' + n(r * 0.72) + ' ' + r + ' 0 1 1 ' + cx + ' ' + n(cy - r) + ' Z" fill="' + t.glow + '" fill-opacity=".9"/>';
  }

  /* 山峰。雪顶与山脊的偏移量必须随 w/h 等比缩放——
     固定偏移遇到高而大的山峰（隐者的雪峰 h=150）时会变成占满画面的实心亮块。 */
  function mountain(cx, baseY, w, h, t) {
    var x1 = cx - w / 2, x2 = cx + w / 2, peak = baseY - h;
    var k = Math.min(w / 90, h / 45);
    return '<path d="M' + n(x1) + ' ' + baseY + ' L' + cx + ' ' + peak + ' L' + n(x2) + ' ' + baseY +
      ' Z" fill="' + t.line2 + '" fill-opacity=".5" stroke="' + t.line + '" stroke-width="1.3"/>' +
      '<path d="M' + cx + ' ' + peak + ' L' + n(cx + w * 0.22) + ' ' + n(peak + h * 0.45) + ' L' +
      n(cx - w * 0.12) + ' ' + n(peak + h * 0.3) + ' Z" fill="' + t.glow + '" fill-opacity="' + n(0.2 + 0.25 * k) + '"/>' +
      /* 山脊高光：随规模缩放，避免细山也拖出一条长亮线 */
      '<path d="M' + n(cx - w * 0.02) + ' ' + peak + ' L' + n(x1 + w * 0.16) + ' ' + baseY +
      '" fill="none" stroke="' + t.glow + '" stroke-width="' + n(0.8 + k) + '" stroke-opacity=".35"/>';
  }

  function water(y, t, seed) {
    var r = rnd(seed || 3), out = ['<g>'], i;
    for (i = 0; i < 3; i += 1) {
      var yy = y + i * 12, d = 'M28 ' + yy;
      var k;
      for (k = 1; k <= 8; k += 1) {
        d += ' Q' + n(28 + k * 30 - 15) + ' ' + n(yy + (r() > 0.5 ? -4 : 4)) + ' ' + n(28 + k * 30) + ' ' + yy;
      }
      out.push('<path d="' + d + '" fill="none" stroke="' + t.line + '" stroke-width="1.2" stroke-opacity=".45"/>');
    }
    out.push('</g>');
    return out.join('');
  }

  function cloud(cx, cy, w, t) {
    var r = 11;
    return '<g fill="' + t.glow + '" fill-opacity=".22" stroke="' + t.line + '" stroke-opacity=".4" stroke-width="1">' +
      '<circle cx="' + n(cx - w * 0.28) + '" cy="' + cy + '" r="' + r + '"/>' +
      '<circle cx="' + cx + '" cy="' + n(cy - 5) + '" r="' + n(r * 1.25) + '"/>' +
      '<circle cx="' + n(cx + w * 0.28) + '" cy="' + cy + '" r="' + r + '"/>' +
      '<rect x="' + n(cx - w * 0.36) + '" y="' + cy + '" width="' + n(w * 0.72) + '" height="' + r + '" rx="' + n(r / 2) + '"/>' +
      '</g>';
  }

  /* 人物剪影：pose 决定姿态，flip 镜像 */
  function figure(cx, baseY, h, t, pose, flip) {
    var u = h / 8, s = flip ? -1 : 1;
    var head = '<circle cx="' + n(cx + s * 0.3 * u) + '" cy="' + n(baseY - 7.4 * u) + '" r="' + n(0.85 * u) + '" fill="' + t.glow + '" fill-opacity=".9"/>';
    var body = '<path d="M' + n(cx) + ' ' + n(baseY - 6.5 * u) + ' Q' + n(cx + s * 0.9 * u) + ' ' + n(baseY - 4 * u) +
      ' ' + n(cx + s * 0.7 * u) + ' ' + n(baseY - 1 * u) + ' L' + n(cx - s * 0.7 * u) + ' ' + n(baseY - 1 * u) +
      ' Q' + n(cx - s * 1.2 * u) + ' ' + n(baseY - 4 * u) + ' ' + n(cx) + ' ' + n(baseY - 6.5 * u) +
      ' Z" fill="' + t.glow + '" fill-opacity=".82"/>';
    var legs = '<path d="M' + n(cx - s * 0.5 * u) + ' ' + n(baseY - 1.2 * u) + ' L' + n(cx - s * 0.9 * u) + ' ' + baseY +
      ' M' + n(cx + s * 0.5 * u) + ' ' + n(baseY - 1.2 * u) + ' L' + n(cx + s * 0.9 * u) + ' ' + baseY +
      '" stroke="' + t.glow + '" stroke-opacity=".82" stroke-width="' + n(0.42 * u) + '" stroke-linecap="round" fill="none"/>';
    var arm;
    if (pose === 'raise') {
      arm = '<path d="M' + n(cx + s * 0.7 * u) + ' ' + n(baseY - 5.6 * u) + ' L' + n(cx + s * 1.9 * u) + ' ' + n(baseY - 8.4 * u) +
        '" stroke="' + t.glow + '" stroke-opacity=".85" stroke-width="' + n(0.36 * u) + '" stroke-linecap="round"/>';
    } else if (pose === 'both') {
      arm = '<path d="M' + n(cx + s * 0.7 * u) + ' ' + n(baseY - 5.6 * u) + ' L' + n(cx + s * 1.7 * u) + ' ' + n(baseY - 8.2 * u) +
        ' M' + n(cx - s * 0.7 * u) + ' ' + n(baseY - 5.6 * u) + ' L' + n(cx - s * 1.7 * u) + ' ' + n(baseY - 8.2 * u) +
        '" stroke="' + t.glow + '" stroke-opacity=".85" stroke-width="' + n(0.36 * u) + '" stroke-linecap="round" fill="none"/>';
    } else if (pose === 'kneel') {
      arm = '<path d="M' + n(cx + s * 0.7 * u) + ' ' + n(baseY - 5.4 * u) + ' L' + n(cx + s * 1.5 * u) + ' ' + n(baseY - 4.2 * u) +
        '" stroke="' + t.glow + '" stroke-opacity=".85" stroke-width="' + n(0.36 * u) + '" stroke-linecap="round"/>';
    } else {
      arm = '<path d="M' + n(cx + s * 0.7 * u) + ' ' + n(baseY - 5.6 * u) + ' L' + n(cx + s * 1.5 * u) + ' ' + n(baseY - 3.6 * u) +
        ' M' + n(cx - s * 0.7 * u) + ' ' + n(baseY - 5.6 * u) + ' L' + n(cx - s * 1.3 * u) + ' ' + n(baseY - 3.8 * u) +
        '" stroke="' + t.glow + '" stroke-opacity=".85" stroke-width="' + n(0.36 * u) + '" stroke-linecap="round" fill="none"/>';
    }
    return '<g>' + legs + body + head + arm + '</g>';
  }

  function pillar(x, baseY, h, t, dark) {
    var w = 11;
    return '<g>' +
      '<rect x="' + n(x - w / 2) + '" y="' + n(baseY - h) + '" width="' + w + '" height="' + h + '" fill="' +
      (dark ? '#0a1020' : t.glow) + '" fill-opacity="' + (dark ? '.9' : '.22') + '" stroke="' + t.line + '" stroke-width="1.2"/>' +
      '<rect x="' + n(x - w / 2 - 3) + '" y="' + n(baseY - h - 6) + '" width="' + (w + 6) + '" height="6" fill="' + t.line2 + '" fill-opacity=".7" stroke="' + t.line + '" stroke-width="1"/>' +
      '<rect x="' + n(x - w / 2 - 3) + '" y="' + n(baseY - 4) + '" width="' + (w + 6) + '" height="6" fill="' + t.line2 + '" fill-opacity=".7" stroke="' + t.line + '" stroke-width="1"/>' +
      '</g>';
  }

  function tree(cx, baseY, h, t) {
    return '<g>' +
      '<rect x="' + n(cx - 3) + '" y="' + n(baseY - h * 0.45) + '" width="6" height="' + n(h * 0.45) + '" fill="' + t.line2 + '"/>' +
      '<circle cx="' + cx + '" cy="' + n(baseY - h * 0.68) + '" r="' + n(h * 0.3) + '" fill="' + t.line + '" fill-opacity=".3" stroke="' + t.line + '" stroke-width="1.1"/>' +
      '<circle cx="' + n(cx - h * 0.2) + '" cy="' + n(baseY - h * 0.5) + '" r="' + n(h * 0.2) + '" fill="' + t.line + '" fill-opacity=".24" stroke="' + t.line + '" stroke-width="1"/>' +
      '<circle cx="' + n(cx + h * 0.2) + '" cy="' + n(baseY - h * 0.52) + '" r="' + n(h * 0.19) + '" fill="' + t.line + '" fill-opacity=".24" stroke="' + t.line + '" stroke-width="1"/>' +
      '</g>';
  }

  /* 花色符号 */
  function wand(cx, cy, len, angle, t, wgt) {
    var x1 = cx - Math.cos(angle) * len / 2, y1 = cy - Math.sin(angle) * len / 2;
    var x2 = cx + Math.cos(angle) * len / 2, y2 = cy + Math.sin(angle) * len / 2;
    var sw = wgt || 5;
    return '<g>' +
      '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '" stroke="' + t.line +
      '" stroke-width="' + sw + '" stroke-linecap="round"/>' +
      '<circle cx="' + n(x2) + '" cy="' + n(y2) + '" r="' + n(sw * 0.9) + '" fill="' + t.accent + '" fill-opacity=".85"/>' +
      '<circle cx="' + n(x2 - Math.cos(angle) * len * 0.28) + '" cy="' + n(y2 - Math.sin(angle) * len * 0.28) +
      '" r="' + n(sw * 0.42) + '" fill="' + t.glow + '" fill-opacity=".7"/>' +
      '</g>';
  }

  function cup(cx, cy, s, t) {
    return '<g stroke="' + t.line + '" stroke-width="1.6" fill="' + t.glow + '" fill-opacity=".2">' +
      '<path d="M' + n(cx - s * 0.5) + ' ' + n(cy - s * 0.4) + ' L' + n(cx + s * 0.5) + ' ' + n(cy - s * 0.4) +
      ' L' + n(cx + s * 0.32) + ' ' + n(cy + s * 0.3) + ' L' + n(cx - s * 0.32) + ' ' + n(cy + s * 0.3) + ' Z"/>' +
      '<line x1="' + cx + '" y1="' + n(cy + s * 0.3) + '" x2="' + cx + '" y2="' + n(cy + s * 0.75) + '"/>' +
      '<line x1="' + n(cx - s * 0.42) + '" y1="' + n(cy + s * 0.75) + '" x2="' + n(cx + s * 0.42) + '" y2="' + n(cy + s * 0.75) + '"/>' +
      '</g>';
  }

  function swordV(cx, cy, len, t, alpha) {
    return '<g transform="translate(' + cx + ' ' + cy + ') rotate(' + ((alpha || 0) * 12 - 36) + ')">' +
      '<line x1="0" y1="' + n(-len / 2) + '" x2="0" y2="' + n(len / 2 - 12) + '" stroke="' + t.line + '" stroke-width="3.4" stroke-linecap="round"/>' +
      '<line x1="-9" y1="' + n(len / 2 - 12) + '" x2="9" y2="' + n(len / 2 - 12) + '" stroke="' + t.line + '" stroke-width="3"/>' +
      '<line x1="0" y1="' + n(len / 2 - 12) + '" x2="0" y2="' + n(len / 2) + '" stroke="' + t.accent + '" stroke-width="3.6" stroke-linecap="round"/>' +
      '</g>';
  }

  function coin(cx, cy, r, t) {
    var i, out = ['<g><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + t.accent +
      '" fill-opacity=".28" stroke="' + t.line + '" stroke-width="1.6"/>'];
    /* 内接六芒：实线四角 + 细线三角 */
    var pts = [], k;
    for (k = 0; k < 6; k += 1) {
      var a = (Math.PI / 3) * k - Math.PI / 2;
      pts.push([n(cx + Math.cos(a) * r * 0.78), n(cy + Math.sin(a) * r * 0.78)]);
    }
    var d1 = 'M' + pts[0][0] + ' ' + pts[0][1] + ' L' + pts[2][0] + ' ' + pts[2][1] +
      ' L' + pts[4][0] + ' ' + pts[4][1] + ' Z';
    var d2 = 'M' + pts[1][0] + ' ' + pts[1][1] + ' L' + pts[3][0] + ' ' + pts[3][1] +
      ' L' + pts[5][0] + ' ' + pts[5][1] + ' Z';
    out.push('<path d="' + d1 + '" fill="' + t.line + '" fill-opacity=".3" stroke="' + t.line + '" stroke-width="1"/>');
    out.push('<path d="' + d2 + '" fill="none" stroke="' + t.line + '" stroke-width="1"/>');
    out.push('</g>');
    return out.join('');
  }

  function crown(cx, cy, s, t, tiers) {
    var w = s * 1.6, out = ['<g stroke="' + t.line + '" stroke-width="1.6" fill="' + t.accent + '" fill-opacity=".3">'];
    var i;
    for (i = 0; i < (tiers || 1); i += 1) {
      var y = cy - i * s * 0.55, ww = w * (1 - i * 0.22);
      out.push('<path d="M' + n(cx - ww / 2) + ' ' + n(y) + ' L' + n(cx - ww / 4) + ' ' + n(y - s * 0.4) +
        ' L' + cx + ' ' + n(y) + ' L' + n(cx + ww / 4) + ' ' + n(y - s * 0.4) + ' L' + n(cx + ww / 2) + ' ' + n(y) + ' Z"/>');
    }
    out.push('</g>');
    return out.join('');
  }

  function wheel(cx, cy, r, t, spokes) {
    var out = ['<g><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + t.line + '" stroke-width="2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + n(r * 0.66) + '" fill="none" stroke="' + t.line + '" stroke-width="1.2" stroke-opacity=".7"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + n(r * 0.22) + '" fill="' + t.accent + '" fill-opacity=".5" stroke="' + t.line + '" stroke-width="1.2"/>'];
    var i, a;
    for (i = 0; i < (spokes || 8); i += 1) {
      a = (Math.PI * 2 * i) / (spokes || 8);
      out.push('<line x1="' + n(cx + Math.cos(a) * r * 0.22) + '" y1="' + n(cy + Math.sin(a) * r * 0.22) +
        '" x2="' + n(cx + Math.cos(a) * r) + '" y2="' + n(cy + Math.sin(a) * r) +
        '" stroke="' + t.line + '" stroke-width="1.6" stroke-opacity=".85"/>');
    }
    out.push('</g>');
    return out.join('');
  }

  function scales(cx, cy, s, t) {
    return '<g stroke="' + t.line + '" stroke-width="1.8" fill="none">' +
      '<line x1="' + cx + '" y1="' + n(cy - s) + '" x2="' + cx + '" y2="' + n(cy + s * 0.9) + '"/>' +
      '<line x1="' + n(cx - s * 0.8) + '" y1="' + n(cy - s * 0.7) + '" x2="' + n(cx + s * 0.8) + '" y2="' + n(cy - s * 0.7) + '"/>' +
      '<path d="M' + n(cx - s * 0.8) + ' ' + n(cy - s * 0.7) + ' L' + n(cx - s * 0.55) + ' ' + n(cy - s * 0.05) + ' L' +
      n(cx - s * 1.05) + ' ' + n(cy - s * 0.05) + ' Z" fill="' + t.glow + '" fill-opacity=".18"/>' +
      '<path d="M' + n(cx + s * 0.8) + ' ' + n(cy - s * 0.7) + ' L' + n(cx + s * 0.55) + ' ' + n(cy - s * 0.05) + ' L' +
      n(cx + s * 1.05) + ' ' + n(cy - s * 0.05) + ' Z" fill="' + t.glow + '" fill-opacity=".18"/>' +
      '<line x1="' + n(cx - s * 0.5) + '" y1="' + n(cy + s * 0.9) + '" x2="' + n(cx + s * 0.5) + '" y2="' + n(cy + s * 0.9) + '"/>' +
      '</g>';
  }

  function lantern(cx, cy, s, t) {
    return '<g stroke="' + t.line + '" stroke-width="1.5">' +
      '<circle cx="' + cx + '" cy="' + n(cy - s * 1.1) + '" r="' + n(s * 0.28) + '" fill="' + t.glow + '" fill-opacity=".8"/>' +
      '<path d="M' + n(cx - s * 0.5) + ' ' + n(cy - s * 0.8) + ' L' + n(cx + s * 0.5) + ' ' + n(cy - s * 0.8) +
      ' L' + n(cx + s * 0.36) + ' ' + n(cy + s * 0.5) + ' L' + n(cx - s * 0.36) + ' ' + n(cy + s * 0.5) + ' Z" fill="' + t.glow + '" fill-opacity=".35"/>' +
      '<line x1="' + cx + '" y1="' + n(cy + s * 0.5) + '" x2="' + cx + '" y2="' + n(cy + s * 0.95) + '"/>' +
      '</g>';
  }

  function tower(cx, baseY, h, w, t, struck) {
    var top = baseY - h;
    return '<g>' +
      '<rect x="' + n(cx - w / 2) + '" y="' + n(top) + '" width="' + w + '" height="' + h + '" fill="' + t.line2 + '" fill-opacity=".42" stroke="' + t.line + '" stroke-width="1.4"/>' +
      '<rect x="' + n(cx - w / 2 - 4) + '" y="' + n(baseY - 8) + '" width="' + (w + 8) + '" height="8" fill="' + t.line2 + '" fill-opacity=".6" stroke="' + t.line + '" stroke-width="1"/>' +
      '<rect x="' + n(cx - w / 2 - 3) + '" y="' + n(top - 6) + '" width="' + (w + 6) + '" height="7" fill="' + t.line2 + '" fill-opacity=".55" stroke="' + t.line + '" stroke-width="1"/>' +
      (struck
        ? '<path d="M' + n(cx - w) + ' ' + n(top - 34) + ' L' + n(cx - w * 0.2) + ' ' + n(top - 6) +
        ' L' + n(cx + w * 0.1) + ' ' + n(top - 22) + ' L' + n(cx + w * 0.9) + ' ' + n(top + 4) + '" fill="none" stroke="#f5dba3" stroke-width="2.4" stroke-linejoin="round"/>' +
        '<circle cx="' + n(cx + w * 0.55) + '" cy="' + n(top - 12) + '" r="5" fill="#f5dba3" fill-opacity=".8"/>'
        : '') +
      '<rect x="' + n(cx - 5) + '" y="' + n(baseY - h * 0.42) + '" width="10" height="' + n(h * 0.42) + '" rx="5" fill="#0a1020" fill-opacity=".8" stroke="' + t.line + '" stroke-width="1"/>' +
      '</g>';
  }

  function wing(cx, cy, s, t, flip) {
    var d = flip
      ? 'M' + cx + ' ' + cy + ' q-' + n(s) + ' ' + n(-s * 0.7) + ' -' + n(s * 1.7) + ' ' + n(-s * 0.2) +
      ' q' + n(s * 0.9) + ' ' + n(s * 0.5) + ' ' + n(s * 1.7) + ' ' + n(s * 0.2) + ' Z'
      : 'M' + cx + ' ' + cy + ' q' + n(s) + ' ' + n(-s * 0.7) + ' ' + n(s * 1.7) + ' ' + n(-s * 0.2) +
      ' q-' + n(s * 0.9) + ' ' + n(s * 0.5) + ' -' + n(s * 1.7) + ' ' + n(s * 0.2) + ' Z';
    return '<path d="' + d + '" fill="' + t.glow + '" fill-opacity=".3" stroke="' + t.line + '" stroke-width="1.3"/>';
  }

  function serpent(cx, cy, s, t) {
    return '<path d="M' + n(cx - s) + ' ' + n(cy + s * 0.4) + ' q' + n(s * 0.6) + ' ' + n(-s * 0.9) + ' ' + n(s * 1.2) + ' 0' +
      ' t' + n(s * 1.2) + ' 0" fill="none" stroke="' + t.line + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<circle cx="' + n(cx - s) + '" cy="' + n(cy + s * 0.4) + '" r="2.6" fill="' + t.accent + '"/>';
  }

  function lotus(cx, cy, s, t) {
    var out = ['<g stroke="' + t.line + '" stroke-width="1.3" fill="' + t.glow + '" fill-opacity=".25">'], i;
    for (i = -2; i <= 2; i += 1) {
      var a = i * 0.42, px = cx + Math.sin(a) * s, hgt = Math.cos(a) * s * 0.95;
      out.push('<path d="M' + n(px) + ' ' + n(cy) + ' Q' + n(px - Math.cos(a) * 8) + ' ' + n(cy - hgt * 0.7) + ' ' + n(px) + ' ' + n(cy - hgt) +
        ' Q' + n(px + Math.cos(a) * 8) + ' ' + n(cy - hgt * 0.7) + ' ' + n(px) + ' ' + n(cy) + ' Z"/>');
    }
    out.push('</g>');
    return out.join('');
  }

  function chain(x, y, len, t) {
    var i, out = ['<g stroke="' + t.line + '" stroke-width="1.2" fill="none" stroke-opacity=".85">'];
    for (i = 0; i < len; i += 1) {
      out.push('<ellipse cx="' + n(x + i * 7) + '" cy="' + n(y + i * 5) + '" rx="4" ry="2.6" transform="rotate(35 ' + n(x + i * 7) + ' ' + n(y + i * 5) + ')"/>');
    }
    out.push('</g>');
    return out.join('');
  }

  /* 四角活物（大牌 10 / 21 的固定构图） */
  function cornerBeasts(t) {
    function beast(x, y, kind) {
      if (kind === 0) return figure(x, y, 44, t, 'stand', false);
      if (kind === 1) return '<path d="M' + n(x - 9) + ' ' + y + ' q' + n(9) + ' ' + n(-20) + ' ' + n(18) + ' 0 Z" fill="' + t.glow + '" fill-opacity=".7" stroke="' + t.line + '" stroke-width="1.2"/>' +
        '<circle cx="' + n(x - 7) + '" cy="' + n(y - 11) + '" r="2" fill="' + t.deep + '"/>';
      if (kind === 2) return '<path d="M' + n(x - 10) + ' ' + y + ' q4 ' + n(-14) + ' 10 ' + n(-16) + ' q6 2 10 ' + n(16) + ' Z" fill="' + t.glow + '" fill-opacity=".7" stroke="' + t.line + '" stroke-width="1.2"/>';
      return '<ellipse cx="' + x + '" cy="' + n(y - 9) + '" rx="11" ry="8" fill="' + t.glow + '" fill-opacity=".7" stroke="' + t.line + '" stroke-width="1.2"/>' +
        '<path d="M' + n(x - 8) + ' ' + n(y - 14) + ' l-3 -5 M' + n(x + 8) + ' ' + n(y - 14) + ' l3 -5" stroke="' + t.line + '" stroke-width="1.2"/>';
    }
    return '<g opacity=".9">' + beast(64, 140, 0) + beast(236, 140, 1) +
      beast(64, 372, 2) + beast(236, 372, 3) + '</g>';
  }

  /* ============================================================ 小阿卡纳符号 */

  function pip(suit, cx, cy, size, t, index) {
    if (suit === 'wands') return wand(cx, cy, size * 1.6, (index % 3 - 1) * 0.26, t, Math.max(4, size * 0.22));
    if (suit === 'cups') return cup(cx, cy, size * 1.15, t);
    if (suit === 'swords') return swordV(cx, cy, size * 1.9, t, index);
    return coin(cx, cy, size * 0.72, t);
  }

  /* 点数 → 坐标布局（0..1 归一化，套进图案窗） */
  var PIP_LAYOUT = {
    '一': [[0.5, 0.5]],
    '二': [[0.5, 0.28], [0.5, 0.72]],
    '三': [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]],
    '四': [[0.32, 0.28], [0.68, 0.28], [0.32, 0.72], [0.68, 0.72]],
    '五': [[0.3, 0.22], [0.7, 0.22], [0.5, 0.5], [0.3, 0.78], [0.7, 0.78]],
    '六': [[0.3, 0.2], [0.7, 0.2], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
    '七': [[0.5, 0.12], [0.3, 0.36], [0.7, 0.36], [0.3, 0.64], [0.7, 0.64], [0.3, 0.88], [0.7, 0.88]],
    '八': [[0.3, 0.18], [0.7, 0.18], [0.3, 0.42], [0.7, 0.42], [0.3, 0.66], [0.7, 0.66], [0.3, 0.9], [0.7, 0.9]],
    '九': [[0.3, 0.16], [0.7, 0.16], [0.3, 0.36], [0.7, 0.36], [0.5, 0.5], [0.3, 0.66], [0.7, 0.66], [0.3, 0.86], [0.7, 0.86]],
    '十': [[0.5, 0.1], [0.28, 0.28], [0.72, 0.28], [0.28, 0.45], [0.72, 0.45], [0.28, 0.62], [0.72, 0.62], [0.28, 0.79], [0.72, 0.79], [0.5, 0.93]]
  };

  /* rank 用牌库里的实际写法：侍从 / 骑士 / 王后 / 王 */
  var COURT = { '侍从': 0, '骑士': 1, '王后': 2, '王': 3 };

  function courtScene(suit, rank, cx, baseY, t) {
    var h = 148;
    /* 宫廷牌的头饰是身份标识，必须一眼能认出王/王后/骑士/侍从的不同，故画大一些 */
    var crownArt = rank === '王' ? crown(cx, baseY - h - 14, 18, t, 3)
      : rank === '王后' ? crown(cx, baseY - h - 14, 16, t, 1) +
        '<circle cx="' + n(cx - 20) + '" cy="' + n(baseY - h - 26) + '" r="3.4" fill="' + t.accent + '"/>' +
        '<circle cx="' + n(cx + 20) + '" cy="' + n(baseY - h - 26) + '" r="3.4" fill="' + t.accent + '"/>'
        : rank === '骑士' ? '<path d="M' + n(cx - 14) + ' ' + n(baseY - h - 6) + ' l6 -20 l8 12 l8 -12 l6 20 Z" fill="' + t.accent + '" fill-opacity=".45" stroke="' + t.line + '" stroke-width="1.3"/>' +
          '<path d="M' + n(cx - 20) + ' ' + n(baseY - h - 22) + ' q20 -12 40 0" fill="none" stroke="' + t.line + '" stroke-width="1.4" stroke-opacity=".8"/>'
          : '<path d="M' + n(cx - 12) + ' ' + n(baseY - h - 4) + ' q12 -19 24 0 Z" fill="' + t.accent + '" fill-opacity=".35" stroke="' + t.line + '" stroke-width="1.2"/>' +
            '<circle cx="' + cx + '" cy="' + n(baseY - h - 12) + '" r="3" fill="' + t.accent + '"/>';
    var body = rank === '骑士'
      ? '<g>' + figure(cx, baseY, h, t, 'raise', false) + '</g>'
      : figure(cx, baseY, h, t, rank === '侍从' ? 'stand' : 'kneel', false);
    var hold = pip(suit, cx + 30, baseY - 62, 24, t, 1);
    /* 身份徽记：侍从侍立、骑士踏石、王后有星、王后有王冠，王持杖 —— 用不同姿态区分 */
    var seat = rank === '骑士'
      ? '<ellipse cx="' + cx + '" cy="' + n(baseY - 2) + '" rx="42" ry="10" fill="' + t.line2 + '" fill-opacity=".55" stroke="' + t.line + '" stroke-width="1.1"/>'
      : '<rect x="' + n(cx - 30) + '" y="' + n(baseY - 8) + '" width="60" height="8" rx="4" fill="' + t.line2 + '" fill-opacity=".6" stroke="' + t.line + '" stroke-width="1"/>' +
        '<rect x="' + n(cx - 24) + '" y="' + n(baseY) + '" width="7" height="14" fill="' + t.line2 + '" fill-opacity=".5" stroke="' + t.line + '" stroke-width=".9"/>' +
        '<rect x="' + n(cx + 17) + '" y="' + n(baseY) + '" width="7" height="14" fill="' + t.line2 + '" fill-opacity=".5" stroke="' + t.line + '" stroke-width=".9"/>';
    return '<g>' + seat + body + crownArt + hold + '</g>';
  }

  /* 小阿卡纳场景分两层返回：背景层（远山、水面、云、地平线）与主体层（花色符号）。
     逆位只倒转主体层——背景跟着倒会在画面角落留下突兀的倒置色块。 */
  function minorSceneParts(card, t) {
    var suit = card.suit, rank = card.rank;
    var win = { x: 24, y: 82, w: 252, h: 324 };
    var cx = 150, baseY = 372;
    if (COURT[rank] !== undefined) {
      return {
        bg: starField(cx, 240, 200, 220, 22, card.id + 5, t.glow),
        fg: courtScene(suit, rank, cx, baseY, t)
      };
    }
    var layout = PIP_LAYOUT[rank] || PIP_LAYOUT['一'];
    var bg = [], fg = [];

    /* 底景刻意压到画面下缘并降低存在感：它的作用是让画面不空，
       不能盖住花色符号本身——符号才是这张牌的主体。 */
    if (suit === 'wands') {
      bg.push('<g opacity=".5">', mountain(58, baseY + 14, 84, 40, t),
        mountain(244, baseY + 14, 92, 32, t), ground(baseY + 12, t, card.id), '</g>');
    } else if (suit === 'cups') {
      bg.push('<g opacity=".45">', water(336, t, card.id), cloud(76, 372, 76, t), '</g>');
    } else if (suit === 'swords') {
      bg.push('<g opacity=".45">', cloud(226, 106, 78, t), cloud(72, 122, 66, t), '</g>');
    } else {
      bg.push('<g opacity=".5">', tree(52, baseY + 12, 66, t),
        mountain(248, baseY + 14, 84, 34, t), ground(baseY + 12, t, card.id), '</g>');
    }
    bg.push(starField(cx, 220, 210, 200, 18, card.id + 11, t.glow));

    /* Ace 额外加「云中之手」，与其它点数区分 */
    if (rank === '一') {
      bg.push(cloud(cx, 108, 104, t));
      fg.push('<path d="M' + n(cx - 22) + ' 122 q22 -16 44 0 q-4 12 -22 12 q-18 0 -22 -12 Z" fill="' + t.glow + '" fill-opacity=".6" stroke="' + t.line + '" stroke-width="1.3"/>');
    }

    var size = rank === '一' ? 34 : 25;
    layout.forEach(function (p, i) {
      fg.push(pip(suit, win.x + p[0] * win.w, win.y + 30 + p[1] * (win.h - 62), size, t, i));
    });
    return { bg: bg.join(''), fg: fg.join('') };
  }

  function minorScene(card, t) {
    var p = minorSceneParts(card, t);
    return p.bg + p.fg;
  }

  /* ============================================================ 大阿卡纳 22 张独立构图 */

  /* 大阿卡纳 22 张独立构图。分两层：bg 是星野/远山/水面等背景元素，
     fg 是主体。逆位只倒转 fg，背景保持正向。 */
  function majorSceneParts(card, t) {
    var id = card.id, cx = 150;
    var s = [];
    var bg = [];
    switch (id) {
      case 0: /* 愚人：崖边 + 行囊 + 白花 + 阳光 */
        bg.push(starField(cx, 180, 220, 220, 26, 101, t.glow), sun(228, 122, 20, t, 10));
        s.push('<path d="M40 372 L150 300 L262 372 Z" fill="' + t.line2 + '" fill-opacity=".45" stroke="' + t.line + '" stroke-width="1.4"/>');
        s.push(figure(150, 372, 128, t, 'raise', false));
        s.push('<rect x="168" y="252" width="26" height="34" rx="5" fill="' + t.line2 + '" fill-opacity=".6" stroke="' + t.line + '" stroke-width="1.1"/>');
        s.push('<line x1="126" y1="258" x2="126" y2="240" stroke="' + t.glow + '" stroke-width="1.6"/><circle cx="126" cy="234" r="5" fill="' + t.glow + '" fill-opacity=".8"/>');
        break;
      case 1: /* 魔术师：∞ + 四工具 + 举姿势 */
        bg.push(starField(cx, 200, 200, 200, 14, 102, t.glow));
        s.push(figure(150, 372, 140, t, 'both', false));
        s.push('<text x="150" y="176" text-anchor="middle" font-size="40" fill="' + t.accent + '" font-family="Georgia,serif">∞</text>');
        s.push(wand(74, 340, 46, -0.5, THEME.wands), cup(226, 336, 17, THEME.cups),
          swordV(96, 330, 52, THEME.swords, 0.4), coin(206, 344, 17, THEME.pentacles));
        break;
      case 2: /* 女祭司：黑白双柱 + 幕布 + 经卷 */
        s.push(pillar(72, 380, 210, t, true), pillar(228, 380, 210, t, false));
        s.push('<rect x="86" y="140" width="128" height="140" fill="#5a2f4a" fill-opacity=".45" stroke="' + t.line + '" stroke-width="1"/>');
        for (var i2 = 0; i2 < 5; i2 += 1) s.push('<circle cx="' + (104 + i2 * 24) + '" cy="' + (162 + (i2 % 2) * 12) + '" r="5" fill="' + t.accent + '" fill-opacity=".6"/>');
        s.push(figure(150, 382, 130, t, 'stand', false));
        s.push('<rect x="128" y="322" width="46" height="14" rx="3" fill="' + t.glow + '" fill-opacity=".5" stroke="' + t.line + '" stroke-width="1.1"/>');
        break;
      case 3: /* 皇后：麦田 + 麦穗 + 束缚之鞋 */
        bg.push(starField(cx, 160, 200, 140, 14, 103, t.glow));
        for (var i3 = 0; i3 < 9; i3 += 1) s.push('<line x1="' + (36 + i3 * 28) + '" y1="392" x2="' + (40 + i3 * 28) + '" y2="' + (356 + (i3 % 3) * 10) + '" stroke="' + t.accent + '" stroke-width="1.6" stroke-opacity=".7"/>');
        s.push(figure(150, 372, 136, t, 'stand', false), crown(150, 216, 13, t, 1));
        s.push('<path d="M196 348 q10 -12 20 0 q-2 12 -10 12 q-8 0 -10 -12 Z" fill="' + THEME.cups.line + '" fill-opacity=".5" stroke="' + t.line + '" stroke-width="1.1"/>');
        break;
      case 4: /* 皇帝：石座 + 公羊首 + 山阶 */
        bg.push(starField(cx, 150, 180, 130, 12, 104, t.glow));
        bg.push(mountain(150, 400, 240, 60, t));
        s.push('<rect x="92" y="286" width="116" height="96" rx="4" fill="' + t.line2 + '" fill-opacity=".5" stroke="' + t.line + '" stroke-width="1.5"/>');
        s.push('<circle cx="92" cy="316" r="11" fill="none" stroke="' + t.line + '" stroke-width="2"/><circle cx="92" cy="316" r="5" fill="' + t.line + '" fill-opacity=".5"/>');
        s.push('<circle cx="208" cy="316" r="11" fill="none" stroke="' + t.line + '" stroke-width="2"/><circle cx="208" cy="316" r="5" fill="' + t.line + '" fill-opacity=".5"/>');
        s.push(crown(150, 268, 13, t, 2));
        s.push(figure(150, 344, 116, t, 'raise', false));
        s.push(wand(226, 300, 54, -1.45, THEME.wands));
        break;
      case 5: /* 教皇：三重冠 + 祝福手 + 交叉钥匙 + 二侍僧 */
        s.push('<rect x="96" y="196" width="108" height="130" rx="4" fill="#6a2030" fill-opacity=".4" stroke="' + t.line + '" stroke-width="1.3"/>');
        s.push(crown(150, 188, 15, t, 3));
        s.push(figure(150, 382, 140, t, 'raise', false));
        s.push('<g stroke="' + t.accent + '" stroke-width="2" fill="none">' +
          '<circle cx="128" cy="352" r="6"/><line x1="128" y1="358" x2="128" y2="380"/>' +
          '<circle cx="172" cy="352" r="6"/><line x1="172" y1="358" x2="172" y2="380"/></g>');
        s.push(figure(66, 392, 88, t, 'stand', false), figure(234, 392, 88, t, 'stand', true));
        break;
      case 6: /* 恋人：日月 + 双人 + 四冠冕 */
        s.push(sun(70, 132, 18, t, 12), moon(230, 132, 18, t, true));
        s.push('<path d="M40 300 q40 -60 110 -20 q70 40 110 -10" fill="none" stroke="' + t.line + '" stroke-opacity=".4" stroke-width="1.4"/>');
        s.push(figure(112, 372, 138, t, 'stand', false), figure(188, 372, 138, t, 'stand', true));
        for (var i6 = 0; i6 < 4; i6 += 1) s.push(crown(56 + i6 * 63, 396, 8, t, 1));
        break;
      case 7: /* 战车：星形篷 + 黑白双兽 + 月牙盾 */
        bg.push(starField(cx, 170, 220, 180, 20, 107, t.glow));
        s.push('<circle cx="150" cy="176" r="46" fill="none" stroke="' + t.line + '" stroke-width="1.8"/>' +
          '<path d="M150 130 L150 222 M104 176 L196 176 M118 144 L182 208 M182 144 L118 208" stroke="' + t.line + '" stroke-width="1.2" stroke-opacity=".7"/>');
        s.push(figure(150, 300, 118, t, 'both', false));
        s.push('<rect x="86" y="316" width="128" height="20" rx="6" fill="' + t.line2 + '" fill-opacity=".5" stroke="' + t.line + '" stroke-width="1.2"/>');
        s.push('<path d="M108 336 q-14 26 0 46 q-12 -20 0 -46 Z" fill="#e6e9f0" fill-opacity=".8"/>' +
          '<path d="M192 336 q14 26 0 46 q12 -20 0 -46 Z" fill="#2a2f3d" fill-opacity=".9" stroke="' + t.line + '" stroke-width="1"/>');
        s.push('<path d="M150 268 a16 16 0 1 0 0.1 0 Z" fill="none" stroke="' + t.accent + '" stroke-width="2"/>');
        break;
      case 8: /* 力量：抚狮 */
        bg.push(starField(cx, 170, 190, 150, 12, 108, t.glow));
        s.push('<ellipse cx="182" cy="342" rx="66" ry="46" fill="' + t.accent + '" fill-opacity=".22" stroke="' + t.line + '" stroke-width="1.5"/>');
        s.push('<circle cx="234" cy="316" r="26" fill="' + t.accent + '" fill-opacity=".3" stroke="' + t.line + '" stroke-width="1.4"/>');
        s.push('<path d="M120 348 q22 -34 62 -30" fill="none" stroke="' + t.line + '" stroke-width="1.6"/>');
        s.push(figure(112, 372, 142, t, 'both', false));
        s.push(lotus(112, 214, 22, t));
        break;
      case 9: /* 隐者：雪峰 + 提灯 + 杖 */
        bg.push(starField(cx, 160, 180, 160, 20, 109, t.glow));
        /* 雪峰退到人物之后的背景层，且不能盖住提灯与身体 */
        s.push('<g opacity=".7">', mountain(210, 404, 128, 82, t), '</g>');
        s.push(figure(104, 388, 150, t, 'stand', false));
        s.push(lantern(154, 288, 18, t));
        s.push('<line x1="78" y1="250" x2="92" y2="392" stroke="' + t.line + '" stroke-width="3" stroke-linecap="round"/>');
        break;
      case 10: /* 命运之轮：三层轮 + 四活物读书 */
        bg.push(starField(cx, 200, 230, 220, 20, 110, t.glow));
        s.push(wheel(150, 236, 86, t, 8));
        s.push(cornerBeasts(t));
        break;
      case 11: /* 正义：剑 + 天秤 + 紫幕 */
        s.push('<rect x="72" y="108" width="156" height="180" fill="#4a2a6a" fill-opacity=".38" stroke="' + t.line + '" stroke-width="1.1"/>');
        s.push(crown(150, 176, 13, t, 1));
        s.push(figure(150, 384, 138, t, 'stand', false));
        s.push(swordV(150, 262, 92, t, 0));
        s.push(scales(150, 356, 44, t));
        break;
      case 12: /* 倒吊人：T 架 + 倒悬 + 金光 */
        s.push('<rect x="72" y="126" width="156" height="12" rx="4" fill="' + t.line2 + '" fill-opacity=".65" stroke="' + t.line + '" stroke-width="1.2"/>');
        s.push('<rect x="146" y="138" width="8" height="52" fill="' + t.line2 + '" fill-opacity=".5" stroke="' + t.line + '" stroke-width="1"/>');
        s.push('<g transform="rotate(180 150 320)">' + figure(150, 320, 130, t, 'kneel', false) + '</g>');
        s.push('<circle cx="150" cy="222" r="18" fill="' + t.accent + '" fill-opacity=".3" stroke="' + t.accent + '" stroke-width="1.4"/>');
        s.push('<line x1="150" y1="190" x2="150" y2="300" stroke="' + t.accent + '" stroke-width="1.6" stroke-opacity=".7"/>');
        break;
      case 13: /* 死神：白马 + 黑甲 + 白玫瑰白旗 + 双塔 */
        s.push(tower(72, 396, 120, 34, t), tower(228, 396, 120, 34, t));
        s.push('<ellipse cx="150" cy="360" rx="66" ry="34" fill="#e8ecf4" fill-opacity=".72" stroke="' + t.line + '" stroke-width="1.3"/>');
        s.push('<path d="M198 344 q18 -18 8 -34" fill="none" stroke="' + t.line + '" stroke-width="2"/>');
        s.push(figure(142, 344, 118, t, 'stand', true));
        s.push('<line x1="118" y1="150" x2="118" y2="256" stroke="' + t.line + '" stroke-width="2"/>');
        s.push('<path d="M118 152 l30 8 l-30 10 Z" fill="#eef1f7" fill-opacity=".85" stroke="' + t.line + '" stroke-width="1"/>');
        s.push('<circle cx="134" cy="160" r="4" fill="#f6f7fb"/>');
        break;
      case 14: /* 节制：天使 + 两杯倒水 */
        bg.push(starField(cx, 170, 200, 180, 16, 114, t.glow));
        s.push(wing(112, 200, 46, t, true), wing(188, 200, 46, t, false));
        s.push(figure(150, 384, 140, t, 'both', false));
        s.push(cup(120, 300, 19, THEME.cups), cup(180, 336, 19, THEME.cups));
        s.push('<path d="M132 292 q16 12 24 22" fill="none" stroke="' + THEME.cups.line + '" stroke-width="2" stroke-opacity=".8"/>');
        s.push('<path d="M132 330 q16 -12 24 -20" fill="none" stroke="' + THEME.cups.line + '" stroke-width="2" stroke-opacity=".8"/>');
        s.push('<path d="M96 396 h108" stroke="' + t.line + '" stroke-width="2" stroke-opacity=".6"/>');
        break;
      case 15: /* 恶魔：方块 + 双锁链 + 倒置五角星 */
        s.push('<rect x="86" y="200" width="128" height="16" rx="4" fill="' + t.line2 + '" fill-opacity=".7" stroke="' + t.line + '" stroke-width="1.2"/>');
        s.push(figure(126, 392, 132, t, 'kneel', false), figure(176, 392, 132, t, 'kneel', true));
        s.push(chain(96, 250, 5, t), chain(186, 250, 5, t));
        s.push('<g transform="translate(150 176)"><path d="M0 -30 L26 22 L-26 22 Z" fill="none" stroke="' + t.accent + '" stroke-width="2.4"/>' +
          '<path d="M0 22 L-14 -12 L14 -12 Z" fill="' + t.accent + '" fill-opacity=".28" stroke="' + t.accent + '" stroke-width="1.6"/></g>');
        break;
      case 16: /* 塔：闪电 + 坠落王冠 + 双人下坠 */
        bg.push(starField(cx, 150, 220, 160, 14, 116, t.glow));
        s.push(tower(150, 384, 168, 62, t, true));
        s.push(crown(112, 250, 11, t, 1));
        s.push(figure(96, 322, 84, t, 'both', true), figure(204, 322, 84, t, 'both', false));
        break;
      case 17: /* 星星：跪姿 + 双壶 + 河池 + 衔枝鸟 */
        bg.push(starField(cx, 176, 230, 190, 34, 117, t.glow));
        s.push('<g>' + [[112, 128], [188, 128], [150, 100], [76, 168], [224, 168]].map(function (p) {
          return star8(p[0], p[1], 11, t);
        }).join('') + star8(150, 168, 22, t) + '</g>');
        bg.push(water(316, t, 117));
        s.push(figure(150, 386, 132, t, 'kneel', false));
        s.push('<path d="M126 288 q-12 -14 -2 -22 q12 2 14 14 Z" fill="' + THEME.cups.line + '" fill-opacity=".45" stroke="' + t.line + '" stroke-width="1"/>');
        s.push('<path d="M176 300 q12 -14 2 -22 q-12 2 -14 14 Z" fill="' + THEME.cups.line + '" fill-opacity=".45" stroke="' + t.line + '" stroke-width="1"/>');
        s.push(tree(226, 372, 74, t));
        s.push('<path d="M212 306 q10 -6 18 0" fill="none" stroke="' + t.accent + '" stroke-width="2.4" stroke-linecap="round"/>');
        break;
      case 18: /* 月亮：双塔 + 犬狼 + 水与泥路 */
        bg.push(starField(cx, 160, 230, 190, 24, 118, t.glow));
        s.push(moon(150, 140, 26, t, false));
        s.push(tower(72, 300, 96, 30, t), tower(228, 300, 96, 30, t));
        bg.push(water(326, t, 118));
        s.push('<path d="M150 262 q-14 30 0 62 q-12 -30 0 -62 Z" fill="' + t.line2 + '" fill-opacity=".5" stroke="' + t.line + '" stroke-width="1"/>');
        s.push('<ellipse cx="112" cy="336" rx="18" ry="11" fill="' + t.line + '" fill-opacity=".35" stroke="' + t.line + '" stroke-width="1"/>' +
          '<ellipse cx="190" cy="342" rx="20" ry="12" fill="' + t.line + '" fill-opacity=".3" stroke="' + t.line + '" stroke-width="1"/>');
        s.push(figure(150, 352, 96, t, 'stand', false));
        break;
      case 19: /* 太阳：孩童 + 白马 + 向日葵旗 + 巨日 + 围墙 */
        s.push(sun(150, 178, 52, t, 16));
        s.push('<rect x="46" y="286" width="208" height="12" fill="' + t.line2 + '" fill-opacity=".6" stroke="' + t.line + '" stroke-width="1.1"/>');
        for (var i19 = 0; i19 < 9; i19 += 1) s.push('<rect x="' + (50 + i19 * 24) + '" y="298" width="14" height="40" fill="' + t.line2 + '" fill-opacity=".4" stroke="' + t.line + '" stroke-width=".8"/>');
        s.push('<ellipse cx="150" cy="376" rx="70" ry="26" fill="#f2ead6" fill-opacity=".8" stroke="' + t.line + '" stroke-width="1.3"/>');
        s.push(figure(150, 366, 96, t, 'raise', false));
        s.push('<line x1="216" y1="150" x2="216" y2="330" stroke="' + t.line + '" stroke-width="2"/>');
        for (var j19 = 0; j19 < 8; j19 += 1) {
          var a19 = (Math.PI * 2 * j19) / 8;
          s.push('<ellipse cx="' + n(216 + Math.cos(a19) * 15) + '" cy="' + n(196 + Math.sin(a19) * 15) + '" rx="7" ry="4" fill="' + t.accent + '" fill-opacity=".7" transform="rotate(' + n(a19 * 57.3) + ' ' + n(216 + Math.cos(a19) * 15) + ' ' + n(196 + Math.sin(a19) * 15) + ')"/>');
        }
        s.push('<circle cx="216" cy="196" r="7" fill="' + t.accent + '"/>');
        break;
      case 20: /* 审判：天使号角 + 石棺 + 亡者起身 + 回望 */
        bg.push(starField(cx, 150, 220, 150, 16, 120, t.glow));
        s.push('<rect x="72" y="352" width="156" height="40" rx="4" fill="#5a5f6b" fill-opacity=".55" stroke="' + t.line + '" stroke-width="1.2"/>');
        s.push(figure(112, 350, 96, t, 'raise', true), figure(188, 350, 96, t, 'raise', false));
        s.push(wing(122, 148, 42, t, true), wing(178, 148, 42, t, false));
        s.push('<path d="M150 128 l34 10 l-34 12 Z" fill="' + t.accent + '" fill-opacity=".55" stroke="' + t.line + '" stroke-width="1.2"/>');
        s.push('<circle cx="112" cy="176" r="5" fill="' + t.glow + '" fill-opacity=".8"/>');
        s.push(figure(150, 210, 96, t, 'both', false));
        break;
      case 21: /* 世界：舞者 + 紫带 + 桂冠月桂花环 + 四活物 */
        bg.push(starField(cx, 210, 230, 230, 26, 121, t.glow));
        s.push(cornerBeasts(t));
        /* 椭圆花环在舞者之后画，舞者居中、双臂张开，正好被花环环抱 */
        s.push(figure(150, 320, 116, t, 'both', false));
        s.push('<ellipse cx="150" cy="248" rx="70" ry="70" fill="none" stroke="' + t.line + '" stroke-width="2"/>');
        s.push('<ellipse cx="150" cy="248" rx="60" ry="60" fill="none" stroke="' + t.line + '" stroke-width="1" stroke-opacity=".6"/>');
        /* 月桂花环上的花饰，四向对称，压在环线上而不是环心 */
        s.push(lotus(150, 178, 15, t));
        s.push(lotus(220, 248, 15, t));
        s.push(lotus(80, 248, 15, t));
        s.push(lotus(150, 318, 15, t));
        /* 紫绶带横跨舞者腰部，是「世界」牌的标志物 */
        s.push('<path d="M108 286 q42 -20 84 10 q-42 22 -84 -10 Z" fill="#8a5fb0" fill-opacity=".5" stroke="' + t.line + '" stroke-width="1.1"/>');
        break;
      default:
        bg.push(starField(cx, 240, 200, 200, 20, 100 + id, t.glow));
    }
    return { bg: bg.join(''), fg: s.join('') };
  }

  function star8(cx, cy, r, t) {
    var pts = [], i;
    for (i = 0; i < 8; i += 1) {
      var a = (Math.PI / 2) * i - Math.PI / 2;
      var rr = i % 2 === 0 ? r : r * 0.42;
      pts.push([n(cx + Math.cos(a) * rr), n(cy + Math.sin(a) * rr)]);
    }
    /* polygon 的 points 只接「坐标对，坐标对…」，不接 path 的 L 命令。
       之前用 join(' L') 会生成 `112 117 L116.62 128 …`，
       浏览器直接丢弃整个多边形并报 Expected number——
       星形其实一次都没画出来，只是错误信息被淹没在别处。 */
    var d = pts.map(function (p) { return p[0] + ' ' + p[1]; }).join(' ');
    return '<polygon points="' + d + '" fill="' + t.glow + '" fill-opacity=".8" stroke="' + t.line + '" stroke-width="1"/>';
  }

  /* ============================================================ 对外接口 */

  /* 同一张牌每次渲染必须得到完全相同的 SVG：重播一致性依赖这一点。
     因此所有变化量都只由牌本身决定，不使用自增计数或 Math.random。 */
  function uidOf(card) {
    return (card.id || 0) * 7 + 1;
  }

  /* 逆位（reversed）只倒转画面本身，牌名、罗马数字、副标题与牌框始终正立——
     整张旋转会把中文变成倒字，既难读也不像一张真实的牌。
     旋转中心取画面窗（y 76~412）的中心 y=244。
     牌面分背景层与主体层：逆位只倒转主体，背景保持正向，
     否则远山、水面等会在画面角落留下突兀的倒置色块。 */
  function face(card, opts) {
    if (!card) return '';
    var o = opts || {}, t = themeOf(card);
    var uid = uidOf(card);
    var roman = card.type === 'major' ? (ROMAN[card.id] || String(card.id))
      : (CARD_RANK_ROMAN[card.rank] || '');
    var sub = card.type === 'major' ? '大阿卡纳 · ' + (card.element || '')
      : (SUIT_LABEL[card.suit] || '');
    var rot = card.__rev ? ' transform="rotate(180 150 244)"' : '';
    var scene = card.type === 'major' ? majorSceneParts(card, t) : minorSceneParts(card, t);
    return '<svg class="xtr-card-svg" viewBox="0 0 300 540" xmlns="http://www.w3.org/2000/svg" ' +
      'role="img" aria-label="' + esc(card.name) + '">' +
      frame(t, uid) +
      '<text x="150" y="46" text-anchor="middle" font-size="17" letter-spacing="3" fill="' + t.accent + '" font-family="Georgia,serif">' + esc(roman) + '</text>' +
      '<text x="150" y="68" text-anchor="middle" font-size="19" letter-spacing="2" fill="' + t.line + '" font-family="PingFang SC,Microsoft YaHei,sans-serif">' + esc(card.name) + '</text>' +
      '<g class="xtr-art-bg">' + scene.bg + '</g>' +
      '<g class="xtr-art-fg"' + rot + '>' + scene.fg + '</g>' +
      '<text x="150" y="432" text-anchor="middle" font-size="12" letter-spacing="1.5" fill="' + t.line + '" fill-opacity=".8" font-family="PingFang SC,Microsoft YaHei,sans-serif">' + esc(sub) + '</text>' +
      divider(t) +
      '</svg>';
  }

  var CARD_RANK_ROMAN = {
    '一': 'A', '二': 'II', '三': 'III', '四': 'IV', '五': 'V', '六': 'VI', '七': 'VII',
    '八': 'VIII', '九': 'IX', '十': 'X',
    '侍从': '侍从', '骑士': '骑士', '王后': '王后', '王': '王'
  };

  function divider(t) {
    var out = ['<g stroke="' + t.line + '" stroke-opacity=".5" fill="none">'];
    var i;
    for (i = 0; i < 7; i += 1) {
      out.push('<circle cx="' + (108 + i * 14) + '" cy="470" r="2.6" fill="' + t.line + '" fill-opacity=".55" stroke="none"/>');
    }
    out.push('<line x1="96" y1="470" x2="104" y2="470"/><line x1="196" y1="470" x2="204" y2="470"/>');
    out.push('</g>');
    out.push('<text x="150" y="502" text-anchor="middle" font-size="11" letter-spacing="4" fill="' + t.line +
      '" fill-opacity=".6" font-family="PingFang SC,Microsoft YaHei,sans-serif">玄机阁 · 隔空牌桌</text>');
    return out.join('');
  }

  /* 牌背：几何回纹 + 中心星盘 */
  function back() {
    var t = { line: '#d9b26a', line2: '#8a6a32', deep: '#0d1526', glow: '#f5dba3', accent: '#c9a227' };
    var out = ['<svg class="xtr-card-svg" viewBox="0 0 300 540" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="牌背">',
      '<rect x="3" y="3" width="294" height="534" rx="14" fill="' + t.deep + '" stroke="' + t.line + '" stroke-width="2"/>',
      '<rect x="11" y="11" width="278" height="518" rx="10" fill="none" stroke="' + t.line2 + '" stroke-width="1"/>'];
    /* 斜向网格 */
    var i;
    for (i = -6; i <= 12; i += 1) {
      out.push('<line x1="' + (20 + i * 24) + '" y1="20" x2="' + (20 + i * 24 - 200) + '" y2="520" stroke="' + t.line + '" stroke-opacity=".12" stroke-width="1"/>');
    }
    out.push('<circle cx="150" cy="270" r="96" fill="none" stroke="' + t.line + '" stroke-opacity=".5" stroke-width="1.6"/>');
    out.push('<circle cx="150" cy="270" r="78" fill="none" stroke="' + t.line + '" stroke-opacity=".35" stroke-width="1"/>');
    for (i = 0; i < 16; i += 1) {
      var a = (Math.PI * 2 * i) / 16;
      out.push('<line x1="' + n(150 + Math.cos(a) * 78) + '" y1="' + n(270 + Math.sin(a) * 78) +
        '" x2="' + n(150 + Math.cos(a) * 96) + '" y2="' + n(270 + Math.sin(a) * 96) +
        '" stroke="' + t.line + '" stroke-opacity=".45" stroke-width="1"/>');
    }
    out.push(wheel(150, 270, 74, t, 8));
    out.push('<text x="150" y="284" text-anchor="middle" font-size="40" fill="' + t.accent + '" font-family="Georgia,serif">☯</text>');
    out.push('</svg>');
    return out.join('');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  global.TarotArt = {
    face: face,
    back: back,
    themeOf: themeOf,
    version: 'tarot-art-1.0.0'
  };
})(typeof window !== 'undefined' ? window : globalThis);
