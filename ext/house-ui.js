/* 玄机阁 · 户型平面图渲染
 *
 * 纯函数：plan(analysis, opts) → SVG 字符串。不碰 DOM、不读时间，
 * 同一参数两次渲染必须逐字符相同。拖拽事件由界面层负责挂载。
 *
 * 坐标：分析结果用数学坐标（左下原点，y 向上），这里翻转成屏幕坐标。
 * 缩放**等比**——横向纵向同一 scale，图上宽高比与实际尺寸比一致，
 * 否则房间会被拉成不同的长宽，量房结论就不可信了。
 */
(function (root) {
  'use strict';

  var DEG = Math.PI / 180;

  var KIND_FILL = {
    living: 'rgba(94,140,190,0.20)',
    kitchen: 'rgba(196,132,72,0.20)',
    bedroom: 'rgba(126,110,186,0.20)',
    bath: 'rgba(88,164,152,0.20)',
    storage: 'rgba(130,130,130,0.18)',
    other: 'rgba(150,150,150,0.15)'
  };

  var LEVEL_COLOR = { high: '#e2705a', mid: '#e0b357', low: '#8fa8c8' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function n(v) { return Number(v).toFixed(2); }

  function facingCn(f) {
    var map = { N: '北', NE: '东北', E: '东', SE: '东南', S: '南', SW: '西南', W: '西', NW: '西北' };
    return map[f] || f;
  }

  /* 把数学坐标 (x, y) 映到屏幕：左下原点 → 左上原点 */
  function mkMapper(W, H, pad, scale) {
    return function (x, y) {
      return { x: pad + x * scale, y: H - pad - y * scale };
    };
  }

  function roomRect(room, P, scale) {
    var p0 = P(room.x, room.y + room.h);
    return {
      x: p0.x, y: p0.y,
      w: room.w * scale, h: room.h * scale
    };
  }

  function roomSvg(room, P, scale, badRooms) {
    var r = roomRect(room, P, scale);
    var bad = badRooms[room.id];
    var fill = KIND_FILL[room.kind] || KIND_FILL.other;
    var stroke = bad ? LEVEL_COLOR[bad] : 'rgba(212,175,55,0.55)';
    var aria = room.name + '，' + room.kind + '，面积约 ' + room.area.toFixed(1)
      + ' 平方米，外窗 ' + room.windows.length + ' 处，采光指数 '
      + room.daylight.toFixed(2) + '，通风指数 ' + room.ventilation.toFixed(2)
      + '，距入户门约 ' + room.path.toFixed(1) + ' 米'
      + (room.outOfBounds ? '，已超出户型边界' : '');
    var out = '<g class="xext-h-room' + (room.outOfBounds ? ' xext-h-room--oob' : '')
      + (bad ? ' xext-h-room--' + bad : '') + '">'
      + '<rect data-room="' + esc(room.id) + '" data-out-of-bounds="' + (room.outOfBounds ? '1' : '0') + '" '
      + 'x="' + n(r.x) + '" y="' + n(r.y) + '" width="' + n(r.w) + '" height="' + n(r.h) + '" '
      + 'fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (bad ? 2 : 1.2) + '" rx="2" '
      + 'tabindex="0" role="button" aria-label="' + esc(aria) + '"/>';
    /* 房名与面积：只在房间够大时才画，避免小房间里字挤成团 */
    if (r.w > 42 && r.h > 26) {
      var c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      out += '<text x="' + n(c.x) + '" y="' + n(c.y - 6) + '" text-anchor="middle" '
        + 'font-size="12" fill="#e8dcc0" pointer-events="none">' + esc(room.name) + '</text>'
        + '<text x="' + n(c.x) + '" y="' + n(c.y + 8) + '" text-anchor="middle" '
        + 'font-size="10" fill="#a89b7a" pointer-events="none">' + n(room.area) + ' m²</text>';
    }
    /* 外墙段画粗线，一眼看出哪里能开窗 */
    room.windows.forEach(function (w) {
      var seg = windowSeg(w, room, P);
      out += '<line x1="' + n(seg.x1) + '" y1="' + n(seg.y1) + '" x2="' + n(seg.x2) + '" y2="' + n(seg.y2) + '" '
        + 'stroke="#7fc7d8" stroke-width="3" stroke-linecap="round" pointer-events="none"/>';
    });
    return out + '</g>';
  }

  /* 外窗在其外墙上的实际线段（用于画「这里能开窗」）。
     两端内缩量必须按**该边自身长度**算，且不超过边长的 40%——
     之前用 min(w,h) 统一内缩，短边房间的内缩量会超过短边一半，
     线段两端翻转画到房间外，看起来像窗跑到隔壁去了。 */
  function windowSeg(w, room, P) {
    function inset(len) { return Math.min(len * 0.18, Math.max(0, (len - 6) / 2)); }
    if (w.edge === 'W') {
      var oy = inset(room.h);
      var a = P(room.x, room.y + oy), b = P(room.x, room.y + room.h - oy);
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }
    if (w.edge === 'E') {
      var oy2 = inset(room.h);
      var c = P(room.x + room.w, room.y + oy2), d = P(room.x + room.w, room.y + room.h - oy2);
      return { x1: c.x, y1: c.y, x2: d.x, y2: d.y };
    }
    var ox = inset(room.w);
    if (w.edge === 'S') {
      var e = P(room.x + ox, room.y), f = P(room.x + room.w - ox, room.y);
      return { x1: e.x, y1: e.y, x2: f.x, y2: f.y };
    }
    var g = P(room.x + ox, room.y + room.h), h = P(room.x + room.w - ox, room.y + room.h);
    return { x1: g.x, y1: g.y, x2: h.x, y2: h.y };
  }

  /* 八方标注：文化层。可整体关闭，关闭后几何图层完全不受影响。
     rOut 由调用方保证「大于轮廓半宽 + 间隙」，否则方位文字会压在房间上。 */
  function cultureSvg(culture, cx, cy, rOut, show, owHalf, ohHalf, W_CUR) {
    if (!show || !culture) return '';
    var out = '<g class="xext-h-culture">';
    culture.eight.forEach(function (e) {
      var a = e.angle * DEG;
      var x = cx + rOut * Math.sin(a);
      var y = cy - rOut * Math.cos(a);
      /* 文字摆放按象限分四种，避免一律「正下方」造成左右两侧互相压：
         上半（北/东北/西北）排在点上方，下半排在下方；
         左右两侧改用 start/end 锚点向背离中心的方向排。 */
      var label = e.label;
      var estW = label.length * 6.4 + 6;
      var tx = x, ty = y, anchor = 'middle';
      if (e.angle === 0) { ty = y - 12; }
      else if (e.angle === 180) { ty = y + 16; }
      else if (e.angle > 0 && e.angle < 180) { tx = x + 8; ty = y + 4; anchor = 'start'; }
      else { tx = x - 8; ty = y + 4; anchor = 'end'; }
      /* 夹在画布内 */
      if (anchor === 'start' && tx + estW > W_CUR - 4) { tx = x - 8; anchor = 'end'; }
      if (anchor === 'end' && tx - estW < 4) { tx = x + 8; anchor = 'start'; }
      out += '<g data-direction="' + esc(e.dir) + '" data-dir-text="' + esc(e.label) + '" '
        + 'aria-label="' + esc(e.label + '，' + e.note) + '">'
        + '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="4" fill="'
        + (e.usable ? '#f0c14b' : '#6c6a63') + '" stroke="none"/>'
        + '<text x="' + n(tx) + '" y="' + n(ty) + '" text-anchor="' + anchor + '" '
        + 'font-size="10" fill="' + (e.usable ? '#e8d9a0' : '#8b877c') + '" '
        + 'paint-order="stroke" stroke="rgba(8,11,20,0.9)" stroke-width="2.5">' + esc(label) + '</text>'
        + '</g>';
    });
    /* 指向圆心的虚线，让读者知道这是方位而不是房间 */
    culture.eight.forEach(function (e) {
      var a = e.angle * DEG;
      var x = cx + rOut * Math.sin(a), y = cy - rOut * Math.cos(a);
      var ix = cx + (rOut - 14) * Math.sin(a), iy = cy - (rOut - 14) * Math.cos(a);
      out += '<line x1="' + n(ix) + '" y1="' + n(iy) + '" x2="' + n(x) + '" y2="' + n(y) + '" '
        + 'stroke="rgba(240,193,75,0.28)" stroke-width="1" stroke-dasharray="3 3"/>';
    });
    /* 中心文字移到轮廓下方空白处，不压在房间里 */
    var ty = cy + Math.max(owHalf, ohHalf) + 62;
    out += '<text x="' + n(cx) + '" y="' + n(ty) + '" text-anchor="middle" font-size="11" '
      + 'fill="#9a8f74">' + esc(culture.group) + ' · 坐' + esc(culture.seat)
      + '向' + esc(facingCn(culture.facing)) + '</text>';
    return out + '</g>';
  }

  function plan(analysis, opts) {
    if (!analysis || !Array.isArray(analysis.rooms)) {
      throw new Error('plan 需要一份 analyze() 的结果。');
    }
    var o = opts || {};
    var W = Number(o.width) > 0 ? Number(o.width) : 720;
    var H = Number(o.height) > 0 ? Number(o.height) : 560;
    var pad = Number(o.pad) > 0 ? Number(o.pad) : 108;
    var showCulture = o.showCulture !== false;

    /* 等比缩放：取宽高两个方向的较小值，保证图形不被拉伸。
       pad 必须留够——方位环在轮廓之外还要写「东四命·坐北向南」一行字，
       若边距不够，这行字会被画布裁掉。 */
    var scale = Math.min((W - pad * 2) / analysis.width, (H - pad * 2) / analysis.depth);
    var P = mkMapper(W, H, pad, scale);
    var ox = P(0, analysis.depth);
    var ow = analysis.width * scale, oh = analysis.depth * scale;
    var cx = W / 2, cy = H / 2;

    /* 房间级问题等级：high 优先覆盖 mid / low */
    var bad = {};
    (analysis.issues || []).forEach(function (i) {
      if (!i.room) return;
      if (i.level === 'high' || !bad[i.room]) bad[i.room] = i.level;
    });

    /* 方位环半径：取轮廓外接圆的半径 + 间隙，保证环上文字一定在轮廓之外 */
    var ringR = Math.sqrt(ow * ow + oh * oh) / 2 + 34;
    var body = '<rect x="0" y="0" width="' + n(W) + '" height="' + n(H) + '" fill="none" stroke="none"/>'
      + cultureSvg(analysis.culture, cx, cy, ringR, showCulture, ow / 2, oh / 2, W)
      + '<g class="xext-h-outline" data-outline="' + n(analysis.width) + 'x' + n(analysis.depth) + '" '
      + 'x="' + n(ox.x) + '" y="' + n(ox.y) + '" width="' + n(ow) + '" height="' + n(oh) + '" '
      + 'fill="rgba(255,255,255,0.02)" stroke="rgba(212,175,55,0.75)" stroke-width="2"/>';

    analysis.rooms.forEach(function (r) { body += roomSvg(r, P, scale, bad); });
    body += '</g>';

    /* 入户门标记 */
    var e = P(analysis.entry.x, analysis.entry.y);
    /* 文字沿「由中心指向门点」的方向向外排，保证落在轮廓之外，
       否则默认门在左下时文字会横穿到房间里面去。 */
    var ex = e.x - cx, ey = e.y - cy;
    var elen = Math.hypot(ex, ey) || 1;
    var lx = e.x + (ex / elen) * 12, ly = e.y + (ey / elen) * 12;
    /* 文字必须**整体**落在画布内。默认入户门在左下，整句有9~10 字宽约 66px；
       若按 text-anchor='end' 画，文字从门点一路向左铺到画布外会被裁掉。
       这里先按估算宽度算出文字包围盒，再选锚点、必要时平移起点。 */
    /* 标签分两行：一行「入户门」，一行「按最短边推算」。
       单行会长约 105px，在左下角必然撞到 45° 位置的方位标注（如「西·绝命」）。 */
    var line1 = '入户门';
    var line2 = analysis.entry.assumed ? '按最短边推算' : '';
    var estW = Math.max(line1.length, line2.length) * 10.5;
    /* 门标签排在门点与中心之间的**对角内角**，而不是与方位环同侧的左侧带。
       左侧环带固定住着「西·绝命」「西南·天医」，门标签若也走那一侧必然重叠。
       内角方向 = -径向，且向上偏一点，正好落在轮廓外的空白。 */
    var inX = e.x - (ex / elen) * 6;
    var inY = e.y - (ey / elen) * 6;
    var textX = inX - estW / 2;
    var textY = inY - (ey < 0 ? -14 : 16);
    if (textX < 6) textX = 6;
    if (textX + estW > W - 6) textX = W - 6 - estW;
    if (textY < 14) textY = 14;
    if (textY + (line2 ? 13 : 0) > H - 6) textY = H - 6 - (line2 ? 13 : 0);
body += '<g class="xext-h-entry">'
      + '<line x1="' + n(e.x) + '" y1="' + n(e.y) + '" x2="' + n(lx) + '" y2="' + n(ly) + '" '
      + 'stroke="#e2705a" stroke-width="1"/>'
      + '<circle cx="' + n(e.x) + '" cy="' + n(e.y) + '" r="5" fill="#e2705a" stroke="none"/>'
      + '<text x="' + n(textX) + '" y="' + n(textY) + '" text-anchor="start" '
      + 'font-size="10" fill="#e2705a">' + esc(line1)
      + (line2 ? '<tspan x="' + n(textX) + '" dy="12" font-size="9" fill="#b0766a">'
        + esc(line2) + '</tspan>' : '')
      + '</text>'
      + '</g>';

    /* 朝向标：画在轮廓外，标明正面朝向 */
    var fa = (analysis.facingLight != null ? facingAngle(analysis.facing) : 180) * DEG;
    var fx = cx + (ow / 2 + 62) * Math.sin(fa);
    var fy = cy - (oh / 2 + 34) * Math.cos(fa);
    var bx = cx - (ow / 2 + 62) * Math.sin(fa);
    var by = cy + (oh / 2 + 34) * Math.cos(fa);
    body += '<g class="xext-h-facing">'
      + '<line x1="' + n(bx) + '" y1="' + n(by) + '" x2="' + n(fx) + '" y2="' + n(fy) + '" '
      + 'stroke="#f0c14b" stroke-width="1.6"/>'
      + '<path d="M' + n(fx) + ' ' + n(fy) + 'l-7-3l1.5 3l-1.5 3z" fill="#f0c14b"/>'
      + '<text x="' + n(fx + 10) + '" y="' + n(fy) + '" font-size="11" fill="#f0c14b">朝向'
      + esc(facingCn(analysis.facing)) + '</text>'
      + '</g>';

    /* 比例尺：按真实米数画，给出可量测的参照 */
    var barM = niceLength(analysis.width);
    var barPx = barM * scale;
    /* 比例尺放在轮廓左下角内侧（贴着轮廓外沿），避免与方位环上的
       「西南·天医」这类文字同处一条水平线。 */
    var bxx = ox.x + 2, byy = ox.y + oh + 16;
    body += '<g class="xext-h-scale">'
      + '<line x1="' + n(bxx) + '" y1="' + n(byy) + '" x2="' + n(bxx + barPx) + '" y2="' + n(byy) + '" '
      + 'stroke="#9a8f74" stroke-width="2"/>'
      + '<line x1="' + n(bxx) + '" y1="' + n(byy - 4) + '" x2="' + n(bxx) + '" y2="' + n(byy + 4) + '" stroke="#9a8f74" stroke-width="2"/>'
      + '<line x1="' + n(bxx + barPx) + '" y1="' + n(byy - 4) + '" x2="' + n(bxx + barPx) + '" y2="' + n(byy + 4) + '" stroke="#9a8f74" stroke-width="2"/>'
      + '<text x="' + n(bxx + barPx / 2) + '" y="' + n(byy - 8) + '" text-anchor="middle" font-size="10" '
      + 'fill="#9a8f74">' + n(barM) + ' m</text></g>';

    /* 边界声明：文化层只作方位索引 */
    var notice = analysis.culture && analysis.culture.boundary
      ? analysis.culture.boundary : '';
    body += '<text class="xext-h-notice" x="' + n(cx) + '" y="' + n(H - 8) + '" text-anchor="middle" '
      + 'font-size="10.5" fill="#8d8672">' + esc(notice) + '</text>';

    var title = '户型平面图 · ' + analysis.width + '×' + analysis.depth + ' 米，'
      + analysis.rooms.length + ' 个空间，正面朝' + facingCn(analysis.facing) + '。'
      + (analysis.boundary || '');

    return '<svg class="xext-house" xmlns="http://www.w3.org/2000/svg" '
      + 'viewBox="0 0 ' + n(W) + ' ' + n(H) + '" width="' + n(W) + '" height="' + n(H) + '" '
      + 'role="img" aria-label="' + esc(title) + '">'
      + '<title>' + esc(title) + '</title>' + body + '</svg>';
  }

  function facingAngle(f) {
    var map = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
    return map[f] == null ? 180 : map[f];
  }

  function niceLength(maxM) {
    var cands = [1, 2, 3, 5, 10, 15, 20];
    for (var i = 0; i < cands.length; i += 1) {
      if (cands[i] <= maxM * 0.9) return cands[i];
    }
    return Math.round(maxM);
  }

  root.HouseUI = {
    version: 'house-ui-1.0.0',
    KIND_FILL: KIND_FILL,
    LEVEL_COLOR: LEVEL_COLOR,
    plan: plan,
    windowSeg: windowSeg,
    niceLength: niceLength
  };
})(typeof window !== 'undefined' ? window : globalThis);