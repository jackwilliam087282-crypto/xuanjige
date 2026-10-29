/* 玄机阁 · 面相示意图与掌纹图渲染
 *
 * 纯函数：face(zones, opts) / palm(desc, opts) → SVG 字符串。
 * 不碰 DOM、不读时间，同参数两次渲染必须逐字符相同。
 *
 * 两张图用同一套归一坐标（左上原点、y 向下），并共用一个基线绘制函数，
 * 这样「面部图」与「掌纹图」的缩放、留白、夹取规则完全一致，
 * 不会出现同一份代码在两处算出不同位置的事。
 */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function n(v) { return Number(v).toFixed(2); }

  /* 归一矩形 → 像素矩形。pad 同时作为缩放留白与标签留白。 */
  function toPx(box, W, H, pad) {
    var iw = W - pad * 2, ih = H - pad * 2;
    return {
      x: pad + box.x * iw,
      y: pad + box.y * ih,
      w: box.w * iw,
      h: box.h * ih
    };
  }

  /* 文字包围盒夹取：给定锚点把整段文字拉回画布内。
     估算字宽按中文全角 0.9em，英文数字 0.55em——混排时按类别累加。 */
  function estWidth(text, fontSize) {
    var w = 0;
    for (var i = 0; i < text.length; i += 1) {
      var code = text.charCodeAt(i);
      /* ASCII 与常见符号按半角计，其余按全角计 */
      w += (code < 0x2e80 ? 0.56 : 1.0) * fontSize;
    }
    return w;
  }

  function clampText(x, y, text, fontSize, anchor, W, H) {
    var tw = estWidth(text, fontSize);
    var x0 = anchor === 'middle' ? x - tw / 2 : (anchor === 'end' ? x - tw : x);
    var shift = 0;
    if (x0 < 3) shift = 3 - x0;
    else if (x0 + tw > W - 3) shift = (W - 3) - (x0 + tw);
    var ty = y;
    if (ty < fontSize + 2) ty = fontSize + 2;
    else if (ty > H - 3) ty = H - 3;
    return { x: x + shift, y: ty };
  }

  /* ---------- 面部示意图 ---------- */

  /* 标签防重叠：把某一列的标签按锚点 y 排序，逐个从上往下放，
     与上一个标签距离不足行高就下移，最后统一回夹到画布内。
     早先的做法是「框宽够就放框内、否则引到框的正上/正下方」——
     13 个部位里过半框宽小于标签宽，于是引线标签全挤在框上方十几像素处，
     实机上直接叠成一片（额 / 两耳之间 / 眉 / 眼 四个标签互相压住）。 */
  function layoutLabels(items, fs, lineH, top, bottom) {
    items.sort(function (a, b) { return a.anchorY - b.anchorY; });
    var last = -Infinity;
    items.forEach(function (it) {
      var y = it.anchorY;
      if (y - last < lineH) y = last + lineH;
      it.y = y;
      last = y;
    });
    /* 底部溢出时整体上移，而不是把每个标签逐个夹回——
       逐个夹回会让末尾几个全落到同一条线上。 */
    var over = items.length ? items[items.length - 1].y - bottom : 0;
    if (over > 0) items.forEach(function (it) { it.y -= over; });
    items.forEach(function (it) { if (it.y < top) it.y = top; });
    return items;
  }

  function face(zones, opts) {
    if (!Array.isArray(zones) || !zones.length) {
      throw new Error('face 需要一份部位列表。');
    }
    var o = opts || {};
    var W = Number(o.width) > 0 ? Number(o.width) : 460;
    var H = Number(o.height) > 0 ? Number(o.height) : 560;
    var pad = Number(o.pad) > 0 ? Number(o.pad) : 74;

    var body = '';
    var iw = W - pad * 2, ih = H - pad * 2;
    var cx = W / 2, cy = pad + ih * 0.45;
    /* 头部只占中间偏上，两侧留出标签列。
       部位坐标是按整个绘图区归一的，所以 rx/ry 必须按绘图区算，
       不能按「头部想占多大」算，否则部位框会整体溢出轮廓。 */
    var rx = iw * 0.34, ry = ih * 0.40;

    body += '<g class="xext-f-head" aria-hidden="true">'
      + '<ellipse cx="' + n(cx) + '" cy="' + n(cy) + '" rx="' + n(rx) + '" ry="' + n(ry) + '" '
      + 'fill="rgba(26,30,44,0.62)" stroke="rgba(212,175,55,0.42)" stroke-width="1.2"/>'
      /* 发际线 */
      + '<path d="M' + n(cx - rx * 0.9) + ' ' + n(cy - ry * 0.5)
      + ' Q' + n(cx) + ' ' + n(cy - ry * 0.84) + ' ' + n(cx + rx * 0.9) + ' ' + n(cy - ry * 0.5) + '" '
      + 'fill="none" stroke="rgba(212,175,55,0.2)" stroke-width="1"/>'
      /* 双眼线 */
      + '<path d="M' + n(cx - rx * 0.56) + ' ' + n(cy - ry * 0.04)
      + ' Q' + n(cx - rx * 0.28) + ' ' + n(cy - ry * 0.18) + ' ' + n(cx - rx * 0.06) + ' ' + n(cy - ry * 0.04) + '" '
      + 'fill="none" stroke="rgba(212,175,55,0.2)" stroke-width="1"/>'
      + '<path d="M' + n(cx + rx * 0.06) + ' ' + n(cy - ry * 0.04)
      + ' Q' + n(cx + rx * 0.28) + ' ' + n(cy - ry * 0.18) + ' ' + n(cx + rx * 0.56) + ' ' + n(cy - ry * 0.04) + '" '
      + 'fill="none" stroke="rgba(212,175,55,0.2)" stroke-width="1"/>'
      /* 唇线 */
      + '<path d="M' + n(cx - rx * 0.3) + ' ' + n(cy + ry * 0.4)
      + ' Q' + n(cx) + ' ' + n(cy + ry * 0.5) + ' ' + n(cx + rx * 0.3) + ' ' + n(cy + ry * 0.4) + '" '
      + 'fill="none" stroke="rgba(212,175,55,0.2)" stroke-width="1"/>'
      /* 下颌线：与椭圆下缘合成脸型 */
      + '<path d="M' + n(cx - rx * 0.82) + ' ' + n(cy + ry * 0.6)
      + ' Q' + n(cx) + ' ' + n(cy + ry * 1.16) + ' ' + n(cx + rx * 0.82) + ' ' + n(cy + ry * 0.6) + '" '
      + 'fill="none" stroke="rgba(212,175,55,0.42)" stroke-width="1.2"/>'
      + '</g>';

    /* 部位框画在头部之上。标签走图外左右两列。
       分列**不能**按「框中心是否在中轴左侧」判：多数部位的 x+w/2 恰好等于
       0.5（例如额 0.30+0.40/2、眉 0.24+0.52/2），全都判成左列，
       右列整列空着、画布右半张全是留白。
       改为按锚点 y 排序后左右交替分配：两列各约一半，
       纵向间距自动宽松，且引线不会横跨整张脸。 */
    var order = zones.map(function (z, i) {
      var p = toPx(z, W, H, pad);
      return { z: z, i: i, p: p, anchorY: p.y + p.h / 2, x: 0, y: 0, anchor: 'start' };
    }).sort(function (a, b) { return a.anchorY - b.anchorY; });
    order.forEach(function (it, k) { it.side = k % 2 === 0 ? 'l' : 'r'; });
    var items = order;
    var fs = 11;
    /* 标签列的 x 必须由**该侧最长标签的字宽**反推，不能拍一个 pad*0.3。
       部位名最长 8 个全角字（「两耳之间（天仓）」），11px 字号下约 88px 宽。
       左列用 end 锚点，文字从 x 往**左**延伸，所以列的 x 必须 ≥ 整段字宽；
       早先取「字宽的一半」实测 x0 = −32.8，标签整段溢出画布左缘。
       列宽占到 W 的 45% 就停下——再宽脸就没地方画了。 */
    function widestOf(side) {
      return items.reduce(function (m, it) {
        return it.side === side ? Math.max(m, estWidth(it.z.name, fs)) : m;
      }, 0);
    }
    var lim = W * 0.45;
    var colL = Math.min(lim, Math.max(4, widestOf('l') + 4));
    var colR = W - Math.min(lim, Math.max(4, widestOf('r') + 4));
    items.forEach(function (it) {
      it.anchor = it.side === 'l' ? 'end' : 'start';
      it.x = it.side === 'l' ? colL : colR;
      /* 引线：标签侧边缘 → 框靠近本列的那条边。
         交替分配后框不一定在本列这半边，所以取「离列更近的那条竖边」，
         否则引线要横穿整张脸去接远端的框。 */
      var w = estWidth(it.z.name, fs);
      it.lineX1 = it.side === 'l' ? colL + w + 3 : colR - w - 3;
      it.lineX2 = it.side === 'l'
        ? (it.p.x + it.p.w / 2 <= cx ? it.p.x : it.p.x + it.p.w)
        : (it.p.x + it.p.w / 2 <= cx ? it.p.x + it.p.w : it.p.x);
    });
    layoutLabels(items.filter(function (it) { return it.side === 'l'; }), fs, 15, 12, H - 24);
    layoutLabels(items.filter(function (it) { return it.side === 'r'; }), fs, 15, 12, H - 24);

    var picked = o.picked || null;

    items.forEach(function (it) {
      var z = it.z, p = it.p;
      var on = picked === z.key;
      body += '<g class="xext-f-zone">'
        /* data-zone 挂在 rect 上而不是外层 g 上：
           测试与外部脚本要按 data-zone 直接取 x/y 拿框坐标，
           属性分在两个元素上就得跨标签拼接，取不到。 */
        + '<rect data-zone="' + esc(z.key) + '" '
        + 'data-zone-label="' + esc(z.name) + '" '
        + 'x="' + n(p.x) + '" y="' + n(p.y) + '" width="' + n(p.w) + '" height="' + n(p.h) + '" '
        + 'fill="rgba(240,193,75,' + (on ? 0.15 : 0.04 + (it.i % 3) * 0.015) + ')" '
        + 'stroke="rgba(240,193,75,' + (on ? 0.95 : 0.38) + ')" '
        + 'stroke-width="' + (on ? 2.2 : 1) + '" rx="2" '
        + 'tabindex="0" role="button" '
        + 'aria-label="' + esc(z.name + '，' + z.terms.length + ' 条术语，出处：' + z.origin) + '"/>'
        + '<line x1="' + n(it.lineX1) + '" y1="' + n(it.y) + '" '
        + 'x2="' + n(it.lineX2) + '" y2="' + n(it.anchorY) + '" '
        + 'stroke="rgba(240,193,75,' + (on ? 0.7 : 0.3) + ')" stroke-width="0.8" stroke-dasharray="2 2"/>'
        + '<text x="' + n(it.x) + '" y="' + n(it.y + 3.5) + '" text-anchor="' + it.anchor + '" '
        + 'font-size="' + fs + '" fill="' + (on ? '#f5d98a' : '#cdbe94') + '" '
        + 'paint-order="stroke" stroke="rgba(8,11,20,0.92)" stroke-width="2.6" '
        + 'pointer-events="none">' + esc(z.name) + '</text>'
        + '</g>';
    });

    /* 边界声明必须**画在图上**，不能只写在页面别处：
       这张图可能被单独截图分享，脱离页面后仍要能被看出它的边界。 */
    var notice = '面部图仅为传统相术术语的位置示意，不据形貌推断性格、命运或吉凶，'
      + '不做照片识别或自动命相鉴定。';
    var np = clampText(W / 2, H - 6, notice, 10.5, 'middle', W, H);
    body += '<text class="xext-f-notice" x="' + n(np.x) + '" y="' + n(np.y) + '" '
      + 'text-anchor="middle" font-size="10.5" fill="#8d8672">' + esc(notice) + '</text>';

    var title = '面部术语位置示意图，共 ' + zones.length + ' 个部位。' + notice;
    return wrap(W, H, title, 'xext-face', body);
  }

  /* ---------- 掌纹图 ---------- */

  function palm(desc, opts) {
    if (!desc || !Array.isArray(desc.lines) || !desc.lines.length) {
      throw new Error('palm 需要一份 Palm.describe() 的结果。');
    }
    var o = opts || {};
    var W = Number(o.width) > 0 ? Number(o.width) : 460;
    var H = Number(o.height) > 0 ? Number(o.height) : 560;
    var pad = Number(o.pad) > 0 ? Number(o.pad) : 56;
    /* 底部度量区与手形绘图区必须**分开**。
       早先把 8 条度量压在 H−pad 往上的三行里，手形又画到 H−pad，
       两片内容在同一块 y 上，实机上度量文字和掌纹、走向角标全部糊在一起。 */
    var footH = 74;            /* 底部度量区高度 */
    var noticeH = 16;          /* 边界声明一行 */
    var drawH = H - footH - noticeH;
    var iw = W - pad * 2, ih = drawH - pad * 2;
    var cx = W / 2, cy = pad + ih * 0.5;

    /* 手形：掌根宽圆 + 四指凸起 + 拇指侧凸角。
       原来是一只圆角矩形，看着像平板而不是手。 */
    var hw = iw * 0.56, hh = ih * 0.80;
    var hx = cx - hw / 2, hy = cy - hh / 2;
    var fing = hh * 0.30;
    var body = '<g class="xext-p-hand" aria-hidden="true">'
      + '<path d="M' + n(hx) + ' ' + n(hy + hh)
      + ' L' + n(hx) + ' ' + n(hy + fing * 1.5)
      + ' Q' + n(hx + hw * 0.06) + ' ' + n(hy + fing * 0.1) + ' ' + n(hx + hw * 0.16) + ' ' + n(hy + fing * 0.15)
      + ' Q' + n(hx + hw * 0.24) + ' ' + n(hy + fing * 0.2) + ' ' + n(hx + hw * 0.28) + ' ' + n(hy + fing * 0.9)
      + ' Q' + n(hx + hw * 0.34) + ' ' + n(hy + fing * 0.05) + ' ' + n(hx + hw * 0.44) + ' ' + n(hy + fing * 0.02)
      + ' Q' + n(hx + hw * 0.56) + ' ' + n(hy - fing * 0.02) + ' ' + n(hx + hw * 0.64) + ' ' + n(hy + fing * 0.05)
      + ' Q' + n(hx + hw * 0.76) + ' ' + n(hy + fing * 0.12) + ' ' + n(hx + hw * 0.82) + ' ' + n(hy + fing * 0.5)
      + ' Q' + n(hx + hw * 0.9) + ' ' + n(hy + fing * 0.3) + ' ' + n(hx + hw) + ' ' + n(hy + fing * 1.4)
      + ' L' + n(hx + hw) + ' ' + n(hy + hh)
      + ' Q' + n(cx) + ' ' + n(hy + hh * 1.06) + ' ' + n(hx) + ' ' + n(hy + hh) + ' Z" '
      + 'fill="rgba(30,26,20,0.55)" stroke="rgba(212,175,55,0.38)" stroke-width="1.2"/>'
      /* 掌纹与手掌的常见分界：腕横纹 */
      + '<path d="M' + n(hx + hw * 0.08) + ' ' + n(hy + hh * 0.86)
      + ' Q' + n(cx) + ' ' + n(hy + hh * 0.94) + ' ' + n(hx + hw * 0.92) + ' ' + n(hy + hh * 0.86) + '" '
      + 'fill="none" stroke="rgba(212,175,55,0.16)" stroke-width="1"/>'
      + '</g>';

    /* 主线先画、辅线后画，辅线压在上层与视觉一致 */
    var ordered = desc.lines.slice().sort(function (a, b) {
      return (a.minor ? 1 : 0) - (b.minor ? 1 : 0);
    });

    ordered.forEach(function (L) {
      var pts = L.points.map(function (pt) {
        return { x: pad + pt[0] * iw, y: pad + pt[1] * ih };
      });
      var d = 'M' + n(pts[0].x) + ' ' + n(pts[0].y)
        + pts.slice(1).map(function (p) { return 'L' + n(p.x) + ' ' + n(p.y); }).join('');
      /* 深度映射为线宽与透明度：这是「看得见的深浅」，不是吉凶分级 */
      var wpx = 1.2 + Math.min(2.2, (L.depth - 1) * 1.1 + 0.8);
      var op = Math.min(1, 0.55 + L.depth * 0.25);
      body += '<g class="xext-p-line" data-palm-line="' + esc(L.key) + '" '
        + 'data-palm-name="' + esc(L.name) + '" '
        + 'tabindex="0" role="button" '
        + 'aria-label="' + esc(L.name + '：走向 ' + L.heading.toFixed(1)
          + ' 度，长度为掌长基准的 ' + (L.length / (desc.handLength || 1)).toFixed(2)
          + ' 倍，折角 ' + L.turn.toFixed(0) + ' 度。' + L.note) + '">'
        /* 路径点与 data-palm-path 放同一个元素上，外部可直接取出坐标序列 */
        + '<path data-palm-path="' + esc(L.key) + '" data-palm-name="' + esc(L.name) + '" '
        + 'd="' + d + '" fill="none" stroke="rgba(240,193,75,' + n(op) + ')" '
        + 'stroke-width="' + n(wpx) + '" stroke-linecap="round" stroke-linejoin="round"/>'
        /* 端点标记便于核对坐标来源，也是拖拽手柄 */
        + '<circle cx="' + n(pts[0].x) + '" cy="' + n(pts[0].y) + '" r="3.4" '
        + 'fill="#f0c14b" fill-opacity="0.9"/>'
        + '<circle cx="' + n(pts[pts.length - 1].x) + '" cy="' + n(pts[pts.length - 1].y) + '" r="3.4" '
        + 'fill="#f0c14b" fill-opacity="0.9"/>'
        + '</g>';
    });

    /* 走向角标注：贴到**各自纹路的起点外侧**。
       早先一律放在路径中点 +12/−8，而四条线的中点恰好都落在掌心中央
       附近（61°、−87°、26°、32° 四个标注重叠成一团）。
       改用起点，并按起点位置向掌外方向取一个 14px 的偏移，
       这样标注天然分散在各条线自己的根部。 */
    var annos = desc.lines.map(function (L) {
      var s = L.points[0];
      var sx = pad + s[0] * iw, sy = pad + s[1] * ih;
      /* 方向取「远离掌心」：起点在掌心哪一侧，就朝那一侧排 */
      var ox = sx < cx ? -16 : 16;
      var oy = sy < cy ? -8 : 12;
      return {
        key: L.key,
        text: L.heading.toFixed(0) + '°',
        anchor: ox < 0 ? 'end' : 'start',
        x: Math.max(4, Math.min(W - 4, sx + ox)),
        y: Math.max(10, Math.min(drawH - 4, sy + oy))
      };
    });
    /* 同侧标注仍可能撞在一起（两条线起点很近），按 x 再各自上下错开一行 */
    annos.sort(function (a, b) { return a.y - b.y; });
    annos.forEach(function (a, i) {
      if (i > 0 && a.y - annos[i - 1].y < 13) a.y = annos[i - 1].y + 13;
    });
    annos.forEach(function (a) {
      var y = Math.min(a.y, drawH - 4);
      body += '<text class="xext-p-metric" data-palm-metric="' + esc(a.key + 'Heading') + '" '
        + 'x="' + n(a.x) + '" y="' + n(y) + '" text-anchor="' + a.anchor + '" '
        + 'font-size="10.5" fill="#c9b987" '
        + 'paint-order="stroke" stroke="rgba(10,13,22,0.9)" stroke-width="2.5" '
        + 'pointer-events="none">' + esc(a.text) + '</text>';
    });

    /* 底部度量：两列网格，每列都按实际字宽定列距，
       行高固定 15，全部落在 footH 这条独立带内。 */
    var cols = 2;
    var colW = W / cols;
    var rowH = 15;
    var rows = Math.ceil(desc.metrics.length / cols);
    var needH = rows * rowH + 6;
    /* 度量条数变多时把 footH 撑高，而不是把行距压到重叠 */
    if (needH > footH) {
      footH = needH;
      drawH = H - footH - noticeH;
      ih = drawH - pad * 2;
      cy = pad + ih * 0.5;
    }
    desc.metrics.forEach(function (m, i) {
      var c = i % cols, r = Math.floor(i / cols);
      var txt = m.label + ' ' + m.value.toFixed(2) + ' ' + m.unit;
      var x = c * colW + 6;
      var y = drawH + 14 + r * rowH;
      body += '<text x="' + n(x) + '" y="' + n(y) + '" font-size="10.5" fill="#9fb0c2" '
        + 'pointer-events="none">' + esc(txt) + '</text>';
    });

    var notice = '掌纹图只记录走向、长度与折角的形态，不解释纹路含义；'
      + '不做照片识别或自动命相鉴定。';
    body += '<text class="xext-p-notice" x="' + n(W / 2) + '" y="' + n(H - 5) + '" '
      + 'text-anchor="middle" font-size="10.5" fill="#8d8672">' + esc(notice) + '</text>';

    var title = '掌纹形态记录图，共 ' + desc.lines.length + ' 条纹路，'
      + desc.metrics.length + ' 项量化度量。' + notice;
    return wrap(W, H, title, 'xext-palm', body);
  }

  function wrap(W, H, title, cls, body) {
    return '<svg class="' + cls + '" xmlns="http://www.w3.org/2000/svg" '
      + 'viewBox="0 0 ' + n(W) + ' ' + n(H) + '" width="' + n(W) + '" height="' + n(H) + '" '
      + 'role="img" aria-label="' + esc(title) + '">'
      + '<title>' + esc(title) + '</title>' + body + '</svg>';
  }

  root.MorphemeUI = {
    version: 'morpheme-ui-1.0.0',
    face: face,
    palm: palm,
    toPx: toPx,
    estWidth: estWidth,
    clampText: clampText
  };
})(typeof window !== 'undefined' ? window : globalThis);