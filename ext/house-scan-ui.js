/* 玄机阁 · 勘宅神器 · 渲染与报告层（任务 #19）
 *
 * 纯函数：compass(analysis) / overlay(analysis) / report(analysis) → 字符串。
 * 不碰 DOM、不读时间、不用随机数。同一输入两次渲染必须逐字符相同 ——
 * 这条约束不是洁癖：报告要能被截图留档、能被复算，两次结果不同就没法核对。
 *
 * 设计取向：
 *  - 罗盘（二十四山）与户型图分层。罗盘单独出图，户型图上的方位环只在
 *    需要对照时叠加，避免图形叠图形导致文字互相压。
 *  - 每个可交互元素都挂 data-* 属性，交互由界面层挂载（与 workbench-viz 一致）。
 *  - 报告是纯文本，因为它的读者是要拿去跟装修师傅/设计师对账的人，
 *    不是要在浏览器里浏览的人。分节 + 编号 + 依据，才好逐条划掉。
 */
(function (root) {
  'use strict';

  var DEG = Math.PI / 180;

  var PALETTE = {
    ink: '#0b0f1c',
    gold: '#d4af37',
    goldSoft: '#e8dcc0',
    dim: '#9a8f74',
    high: '#e2705a',
    mid: '#e0b357',
    low: '#8fa8c8',
    good: '#6fbf8f',
    line: 'rgba(212,175,55,0.42)'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function n(v) { return Number(v).toFixed(2); }
  function num(v) { var x = Number(v); return Number.isFinite(x) ? x : 0; }
  /* 自己带 clamp：渲染层不依赖识别层的内部工具，
     免得那边改实现时这边跟着坏。 */
  function clamp(v, lo, hi) {
    if (!Number.isFinite(v)) return lo;
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /* ==================== 罗盘的底层数据（自足，不依赖识别层） ====================
   *
   * 这一段刻意与 house-scan.js 各存一份：
   * 渲染层若伸手去拿识别层的内部常量，两边就绑死了 ——
   * 识别层改一次表，罗盘静默画错，而测试还是绿的。
   * 这里独立写死，并在下面用断言式的自查兜住。
   */

  /* 二十四山：自壬起，每山 15°。壬山中心 345°，子山中心 0°。 */
  var MOUNTAIN_NAMES = [
    '壬', '子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳',
    '丙', '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥'
  ];
  var MOUNTAINS = (function () {
    var out = [];
    for (var i = 0; i < 24; i += 1) {
      var c = (345 + i * 15) % 360;
      out.push({
        index: i, name: MOUNTAIN_NAMES[i], center: c, deg: c,
        start: (c - 7.5 + 360) % 360, end: (c + 7.5) % 360
      });
    }
    return out;
  })();

  /* 洛书九宫：戴九履一，左三右七，二四为肩，六八为足，五居中。
     南上北下，故离在南九、坎在北一。 */
  var LUO_SHU = {
    N: 1, NE: 8, E: 3, SE: 4,
    S: 9, SW: 2, W: 7, NW: 6, center: 5
  };
  var PALACE_CN = {
    N: '坎（北）', NE: '艮（东北）', E: '震（东）', SE: '巽（东南）',
    S: '离（南）', SW: '坤（西南）', W: '兑（西）', NW: '乾（西北）', center: '中宫'
  };
  var PALACE_DEG = {
    N: 0, NE: 45, E: 90, SE: 135,
    S: 180, SW: 225, W: 270, NW: 315, center: null
  };
  /* 八门按后天八卦固定方位，不随流年转动 */
  var BA_MEN = {
    N: '休门', NE: '伤门', E: '生门', SE: '天门',
    S: '景门', SW: '死门', W: '开门', NW: '杜门'
  };
  var STAR_CN = ['一白', '二黑', '三碧', '四绿', '五黄', '六白', '七赤', '八白', '九紫'];
  var PALACE_KEYS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'center'];
  var XUAN_GUA = {
    N: '坎', NE: '艮', E: '震', SE: '巽',
    S: '离', SW: '坤', W: '兑', NW: '乾'
  };
  var GUA_NUM = { 乾: 1, 兑: 2, 离: 3, 震: 4, 巽: 5, 坎: 6, 艮: 7, 坤: 8 };
  /* 洛书顺飞序：坎→坤→震→巽→中→乾→兑→艮→离 */
  var LUO_CYCLE = ['N', 'SW', 'E', 'SE', 'center', 'NW', 'W', 'NE', 'S'];

  var DIR_DEG = {
    N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315
  };

  /** 按宅向起宅星：中宫取生气数，按洛书顺飞铺九宫。 */
  function palacesOf(facing) {
    var f = String(facing || 'S').toUpperCase();
    if (!DIR_DEG[f]) f = 'S';
    var gua = XUAN_GUA[f];
    var fuNum = GUA_NUM[gua];
    var fuKey = null;
    PALACE_KEYS.forEach(function (k) { if (LUO_SHU[k] === fuNum) fuKey = k; });
    var fuIdx = Math.max(0, LUO_CYCLE.indexOf(fuKey || 'center'));
    var palaces = LUO_CYCLE.map(function (k, i) {
      return {
        key: k, palace: PALACE_CN[k], deg: PALACE_DEG[k], luoshu: LUO_SHU[k],
        star: STAR_CN[(LUO_SHU[LUO_CYCLE[(fuIdx + i) % 9]] - 1) % 9],
        men: BA_MEN[k] || ''
      };
    });
    var shengIdx = (fuIdx - 1 + 9) % 9;
    return {
      facing: f, gua: gua, guaName: gua + '宅',
      fuPalace: PALACE_CN[LUO_CYCLE[fuIdx]],
      shengPalace: PALACE_CN[LUO_CYCLE[shengIdx]],
      palaces: palaces
    };
  }

  function mountainAt(deg) {
    var d = ((num(deg) % 360) + 360) % 360;
    for (var i = 0; i < 24; i += 1) {
      if (Math.abs(MOUNTAINS[i].center - d) < 0.001) return MOUNTAINS[i].name;
    }
    return MOUNTAINS[0].name;
  }

  /* ==================== 二十四山罗盘 ==================== */

  /**
   * compass —— 画专业风水罗盘：外圈二十四山、八门圈、洛书九宫与宅星飞星。
   * 入参既可传 analyze() 的结果，也可只传 { facing }（此时自算宅星）。
   * opts: { size, showGua(八门圈), showNine(九宫飞星), showYearly }
   */
  function compass(analysis, opts) {
    var o = opts || {};
    /* 只传 { facing:'S', size:520 } 时，第一个参数被当成 opts 用 ——
       调用方不该为了画个罗盘先跑一遍完整勘宅。 */
    if (analysis && !Array.isArray(analysis.rooms)
      && (analysis.facing || analysis.size || analysis.showGua || analysis.showNine)) {
      o = analysis;
      analysis = null;
    }
    var size = num(o.size) > 100 ? num(o.size) : 260;
    var cx = size / 2, cy = size / 2;
    var rOut = size * 0.46, rMid = size * 0.375, rIn = size * 0.27;

    /* 宅向：优先取分析结果，否则取入参 facing，都没有就默认坐南朝北 */
    var facing = (analysis && analysis.compass && analysis.compass.dir)
      || o.facing
      || (analysis && analysis.facing)
      || 'S';
    facing = String(facing).toUpperCase();
    /* 正北的角度就是 0，用真值判断会把 N 误当成「没设」而落回默认 S。 */
    if (!Object.prototype.hasOwnProperty.call(DIR_DEG, facing)) facing = 'S';
    var gz = palacesOf(facing);

    var out = '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(rOut)
      + '" fill="none" stroke="' + PALETTE.line + '" stroke-width="1"/>'
      + '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(rMid)
      + '" fill="none" stroke="' + PALETTE.line + '" stroke-width="0.6"/>'
      + '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(rIn)
      + '" fill="rgba(212,175,55,0.04)" stroke="' + PALETTE.line + '" stroke-width="0.6"/>';

    var ms = MOUNTAINS;
    ms.forEach(function (m) {
      var a = m.center * DEG;
      var a0 = (m.start) * DEG, a1 = (m.start + 15) * DEG;
      /* 极坐标：正北在上、顺时针。屏幕角 = 方位角 - 90 */
      function pt(r, deg) {
        var r0 = (deg - 90) * DEG;
        return { x: cx + r * Math.cos(r0), y: cy + r * Math.sin(r0) };
      }
      var p1 = pt(rIn, m.start), p2 = pt(rOut, m.start);
      var p3 = pt(rOut, m.start + 15), p4 = pt(rIn, m.start + 15);
      /* 四正（子午卯酉，即癸午丁酉四山）加重 */
      var cardinal = ['癸', '午', '丁', '酉'].indexOf(m.name) >= 0;
      out += '<path d="M' + n(p1.x) + ' ' + n(p1.y)
        + 'L' + n(p2.x) + ' ' + n(p2.y)
        + 'A' + n(rOut) + ' ' + n(rOut) + ' 0 0 1 ' + n(p3.x) + ' ' + n(p3.y)
        + 'L' + n(p4.x) + ' ' + n(p4.y)
        + 'A' + n(rIn) + ' ' + n(rIn) + ' 0 0 0 ' + n(p1.x) + ' ' + n(p1.y)
        + 'Z" fill="' + (cardinal ? 'rgba(212,175,55,0.16)' : 'rgba(212,175,55,0.05)')
        + '" stroke="' + PALETTE.line + '" stroke-width="0.5" '
        + 'data-mount="' + esc(m.name) + '" data-deg="' + n(m.center) + '" '
        + 'data-range="' + n(m.start) + '-' + n(m.end) + '" '
        + 'aria-label="' + esc(m.name + '山，' + n(m.start) + '度至' + n(m.end) + '度') + '"/>';

      /* 山名排在中环与外环之间 */
      var mid = pt((rIn + rOut) / 2, m.center);
      /* 按象限定 anchor，否则左右两侧的文字会朝内挤成一团 */
      var anchor = 'middle';
      var tx = mid.x;
      if (Math.abs(Math.cos(a - Math.PI / 2)) > 0.72) anchor = 'middle';
      out += '<text x="' + n(tx) + '" y="' + n(mid.y + 3.5) + '" text-anchor="' + anchor
        + '" font-size="' + n(Math.max(8, size * 0.036)) + '" fill="' + PALETTE.goldSoft
        + '" pointer-events="none" paint-order="stroke" stroke="' + PALETTE.ink
        + '" stroke-width="2">' + esc(m.name) + '</text>';
    });

    /* 八正方位（每 45° 一个大字）画在内圈 */
    var DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    DIRS.forEach(function (d, i) {
      var deg = i * 45;
      var a = (deg - 90) * DEG;
      var rr = rIn * 0.62;
      out += '<text x="' + n(cx + rr * Math.cos(a)) + '" y="' + n(cy + rr * Math.sin(a) + 4)
        + '" text-anchor="middle" font-size="' + n(Math.max(9, size * 0.04))
        + '" fill="' + PALETTE.dim + '" pointer-events="none" '
        + 'aria-label="' + esc(d + '方') + '">' + esc(d) + '</text>';
      /* 刻度线 */
      var t1 = { x: cx + rMid * Math.cos(a), y: cy + rMid * Math.sin(a) };
      var t2 = { x: cx + (rMid - size * 0.022) * Math.cos(a), y: cy + (rMid - size * 0.022) * Math.sin(a) };
      out += '<line x1="' + n(t1.x) + '" y1="' + n(t1.y) + '" x2="' + n(t2.x) + '" y2="' + n(t2.y)
        + '" stroke="' + PALETTE.line + '" stroke-width="0.8"/>';
    });

    /* 八门圈：八门按后天八卦固定方位落位（休门坎北、生门震东……），
       这是传统罗盘的内盘，与二十四山外盘分层，不互相压字。 */
    var showGua = o.showGua !== false;
    if (showGua) {
      var rMenOut = rIn * 0.99, rMenIn = rIn * 0.70;
      out += '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(rMenOut)
        + '" fill="none" stroke="' + PALETTE.line + '" stroke-width="0.5" data-ring="bamen"/>';
      PALACE_KEYS.forEach(function (k) {
        if (!BA_MEN[k]) return;
        var a = (PALACE_DEG[k] - 90) * DEG;
        var rMidM = (rMenOut + rMenIn) / 2;
        out += '<text x="' + n(cx + rMidM * Math.cos(a)) + '" y="'
          + n(cy + rMidM * Math.sin(a) + 3.5)
          + '" text-anchor="middle" font-size="' + n(Math.max(8, size * 0.030))
          + '" fill="' + PALETTE.goldSoft + '" pointer-events="none"'
          + ' data-men="' + esc(BA_MEN[k]) + '" data-palace="' + esc(k) + '"'
          + ' aria-label="' + esc(PALACE_CN[k] + BA_MEN[k]) + '">'
          + esc(BA_MEN[k]) + '</text>';
      });
    }

    /* 洛书九宫：中宫五在正中心，外八宫按各自度数排布。
       showNine 为真时把洛书数与宅星名一起标出 —— 数是固定的，星随宅向变。 */
    var showNine = o.showNine !== false;
    if (showNine) {
      var starOf = {};
      gz.palaces.forEach(function (p) { starOf[p.key] = p.star; });
      PALACE_KEYS.forEach(function (k) {
        var a = (PALACE_DEG[k] === null ? null : (PALACE_DEG[k] - 90) * DEG);
        var rr = PALACE_DEG[k] === null ? 0 : rIn * 0.42;
        var tx = cx + (a === null ? 0 : rr * Math.cos(a));
        var ty = cy + (a === null ? 0 : rr * Math.sin(a));
        var fs = k === 'center' ? size * 0.040 : size * 0.034;
        out += '<text x="' + n(tx) + '" y="' + n(ty - (k === 'center' ? 2 : 1))
          + '" text-anchor="middle" font-size="' + n(Math.max(8, fs))
          + '" fill="' + PALETTE.gold + '" font-weight="600" pointer-events="none"'
          + ' data-luoshu="' + LUO_SHU[k] + '" data-palace="' + esc(k) + '"'
          + ' aria-label="' + esc(PALACE_CN[k] + '洛书数' + LUO_SHU[k]) + '">'
          + LUO_SHU[k] + '</text>';
        if (starOf[k]) {
          out += '<text x="' + n(tx) + '" y="' + n(ty + Math.max(9, fs * 0.85))
            + '" text-anchor="middle" font-size="' + n(Math.max(6, fs * 0.6))
            + '" fill="' + PALETTE.dim + '" pointer-events="none"'
            + ' data-star="' + esc(starOf[k]) + '">' + esc(starOf[k]) + '</text>';
        }
      });
    }

    /* 中心：宅向、坐向、总分 */
    var comp = (analysis && analysis.compass) || null;
    var total = analysis && typeof analysis.total === 'number' ? analysis.total : null;
    out += '<g data-compass>';
    if (comp) {
      /* 宅向指针 */
      var fa = (num(comp.deg) - 90) * DEG;
      out += '<line x1="' + n(cx - rIn * 0.8 * Math.cos(fa)) + '" y1="' + n(cy - rIn * 0.8 * Math.sin(fa))
        + '" x2="' + n(cx + rIn * 0.95 * Math.cos(fa)) + '" y2="' + n(cy + rIn * 0.95 * Math.sin(fa))
        + '" stroke="' + PALETTE.high + '" stroke-width="1.8"/>'
        + '<circle cx="' + n(cx + rIn * 0.95 * Math.cos(fa)) + '" cy="' + n(cy + rIn * 0.95 * Math.sin(fa))
        + '" r="3.5" fill="' + PALETTE.high + '"/>';
    } else {
      /* 没跑勘宅也照样画出朝向指针：罗盘该有的功能不该被前置条件卡住 */
      var fd = DIR_DEG[facing];
      out += '<line x1="' + n(cx - rIn * 0.2) + '" y1="' + n(cy - rIn * 0.2)
        + '" x2="' + n(cx + (rIn * 0.22 * Math.cos((fd - 90) * DEG)))
        + '" y2="' + n(cy + (rIn * 0.22 * Math.sin((fd - 90) * DEG)))
        + '" stroke="' + PALETTE.high + '" stroke-width="1.4" data-facing="' + esc(facing) + '"/>';
    }
    out += '<text x="' + n(cx) + '" y="' + n(cy - 4) + '" text-anchor="middle" font-size="10" '
      + 'fill="' + PALETTE.dim + '">'
      + esc(comp ? ('宅向' + comp.mountain) : (gz.guaName + ' 坐' + facing + '向'))
      + '</text>';
    if (comp) {
      out += '<text x="' + n(cx) + '" y="' + n(cy + 8) + '" text-anchor="middle" font-size="10" '
        + 'fill="' + PALETTE.dim + '">坐' + esc(analysis.seat ? analysis.seat.dir : '—')
        + ' · ' + num(comp.deg) + '°</text>';
    }
    if (total !== null) {
      out += '<text x="' + n(cx) + '" y="' + n(cy + 23) + '" text-anchor="middle" '
        + 'font-size="13" font-weight="600" fill="' + PALETTE.gold + '">'
        + total + '<tspan font-size="8" fill="' + PALETTE.dim + '"> 分</tspan></text>';
    }
    out += '</g>';

    var title = analysis
      ? ('二十四山罗盘：宅向 ' + (comp ? comp.mountain + '山' : '未设')
        + '，坐' + (analysis.seat ? analysis.seat.dir : '—') + '向，勘宅总分 '
        + (total === null ? '—' : total) + ' 分。')
      : ('二十四山罗盘：' + gz.guaName + '，坐' + facing + '向，'
        + mountainAt(DIR_DEG[facing]) + '山；生气在' + gz.shengPalace + '。'
        + '八门与洛书九宫为传统堪舆通行排布，仅作方位文化参考。');
    var aria = title + '九宫洛书数：'
      + PALACE_KEYS.filter(function (k) { return k !== 'center'; })
        .map(function (k) { return PALACE_CN[k] + LUO_SHU[k]; }).join('、')
      + '，中宫五。';
    return '<svg class="xext-hs-compass" xmlns="http://www.w3.org/2000/svg" '
      + 'viewBox="0 0 ' + n(size) + ' ' + n(size) + '" width="' + n(size) + '" height="' + n(size)
      + '" role="img" aria-label="' + esc(aria) + '">'
      + '<title>' + esc(title) + '</title>'
      + '<rect width="' + n(size) + '" height="' + n(size) + '" fill="none"/>'
      + out + '</svg>';
  }

  /* ==================== 户型标注层 ==================== */

  var KIND_FILL = {
    living: 'rgba(94,140,190,0.20)',
    dining: 'rgba(110,160,200,0.18)',
    kitchen: 'rgba(196,132,72,0.20)',
    bedroom: 'rgba(126,110,186,0.20)',
    kids: 'rgba(146,124,200,0.20)',
    study: 'rgba(120,130,190,0.18)',
    guest: 'rgba(120,120,180,0.16)',
    bath: 'rgba(88,164,152,0.20)',
    toilet: 'rgba(88,164,152,0.18)',
    storage: 'rgba(130,130,130,0.18)',
    utility: 'rgba(150,140,110,0.16)',
    balcony: 'rgba(100,180,180,0.16)',
    corridor: 'rgba(140,140,140,0.12)',
    other: 'rgba(150,150,150,0.14)'
  };
  var LEVEL_COLOR = { high: PALETTE.high, mid: PALETTE.mid, low: PALETTE.low };

  /**
   * overlay —— 在户型轮廓上叠加勘宅标注。
   * opts: { width, height, showCompass, showMountains, showScores, pad }
   */
  function overlay(analysis, opts) {
    var o = opts || {};
    var W = num(o.width) > 200 ? num(o.width) : 640;
    var H = num(o.height) > 200 ? num(o.height) : 480;
    var pad = num(o.pad) > 10 ? num(o.pad) : 64;

    var a = analysis;
    if (!a || !Array.isArray(a.rooms)) {
      var e = '尚未分析：需要一份 analyze() 的结果或一份确认后的户型数据。';
      return '<svg class="xext-hs-overlay" xmlns="http://www.w3.org/2000/svg" '
        + 'viewBox="0 0 ' + n(W) + ' ' + n(H) + '" width="' + n(W) + '" height="' + n(H)
        + '" role="img" aria-label="' + esc(e) + '"><title>' + esc(e) + '</title>'
        + '<text x="' + n(W / 2) + '" y="' + n(H / 2) + '" text-anchor="middle" font-size="12" '
        + 'fill="' + PALETTE.dim + '">' + esc(e) + '</text></svg>';
    }

    /* 等比缩放：横向纵向必须同一系数，否则房间长宽比会被拉歪，
       量房结论就不可信了。 */
    var scale = Math.min((W - pad * 2) / a.width, (H - pad * 2) / a.depth);
    function P(x, y) { return { x: pad + x * scale, y: H - pad - y * scale }; }

    var ox = P(0, a.depth);
    var ow = a.width * scale, oh = a.depth * scale;

    /* 房间等级：high 覆盖 mid / low */
    var bad = {};
    (a.issues || []).forEach(function (i) {
      if (!i.room) return;
      if (i.level === 'high' || !bad[i.room]) bad[i.room] = i.level;
    });

    var body = '';

    /* ---- 图层 0：原图底图 ----
       用户传进来的是一张户型图，不是抽象的矩形集合。
       把原图铺在下面、识别框叠在上面，标的位置才能直接对着图纸核 ——
       只画简化的矩形，用户无从判断这套框到底套对了没有。 */
    if (o.baseImage) {
      body += '<image class="xext-hs-base" x="' + n(ox.x) + '" y="' + n(ox.y)
        + '" width="' + n(ow) + '" height="' + n(oh)
        + '" preserveAspectRatio="none" opacity="0.92" data-base="1" '
        + 'href="' + esc(o.baseImage) + '" xlink:href="' + esc(o.baseImage) + '"/>';
    }

    body += '<rect x="' + n(ox.x) + '" y="' + n(ox.y) + '" width="' + n(ow) + '" height="' + n(oh)
      + '" fill="rgba(255,255,255,0.02)" stroke="' + PALETTE.line + '" stroke-width="2" '
      + 'data-outline="' + n(a.width) + 'x' + n(a.depth) + '"/>';

    /* 缺角：先画，在房间之下 */
    (a.corners || []).forEach(function (c) {
      if (!(c.missing > 0.05)) return;
      var cx = W / 2, cy = H / 2;
      var a2 = (c.deg - 90) * DEG;
      var ux = Math.cos(a2), uy = Math.sin(a2);
      var R = Math.max(ow, oh) * 0.52;
      var tipX = cx + ux * R, tipY = cy + uy * R;
      var lx = cx + ux * R * 0.34, ly = cy + uy * R * 0.34;
      var px1 = cx - uy * R * 0.3, py1 = cy + ux * R * 0.3;
      var px2 = cx + uy * R * 0.3, py2 = cy - ux * R * 0.3;
      var col = c.missing > 0.35 ? PALETTE.high : PALETTE.mid;
      body += '<path data-notch="' + esc(c.dir) + '" data-missing="' + n(c.missing) + '" '
        + 'd="M' + n(tipX) + ' ' + n(tipY) + 'L' + n(lx) + ' ' + n(ly)
        + 'L' + n(px1) + ' ' + n(py1) + 'L' + n(px2) + ' ' + n(py2) + 'Z" '
        + 'fill="' + col + '" fill-opacity="0.20" stroke="' + col
        + '" stroke-width="1" stroke-dasharray="4 3" '
        + 'aria-label="' + esc('缺' + c.dir + '角，缺口约 ' + (c.missing * 100).toFixed(0) + '%') + '"/>'
        + '<text x="' + n(lx + ux * 18) + '" y="' + n(ly + uy * 18 + 4)
        + '" text-anchor="middle" font-size="10" fill="' + col + '" pointer-events="none">缺'
        + esc(c.dir) + '</text>';
    });

    a.rooms.forEach(function (r) {
      var p0 = P(r.x, r.y + r.h);
      var rx = n(p0.x), ry = n(p0.y), rw = n(r.w * scale), rh = n(r.h * scale);
      var lv = bad[r.id] || '';
      var fill = KIND_FILL[r.kind] || KIND_FILL.other;
      var stroke = lv ? LEVEL_COLOR[lv] : PALETTE.line;
      var aria = r.name + '，' + r.area.toFixed(1) + ' 平方米，外窗 ' + r.windows.length
        + ' 处，采光 ' + r.daylight.toFixed(2) + '，通风 ' + r.ventilation.toFixed(2)
        + '，距门 ' + r.path.toFixed(1) + ' 米，' + r.direction + '方' + r.mountain + '山'
        + (lv ? '，存在' + lv + '级问题' : '');
      body += '<g class="xext-hs-room">'
        + '<rect data-room="' + esc(r.id) + '" data-level="' + esc(lv) + '" '
        + 'data-area="' + n(r.area) + '" data-light="' + n(r.daylight) + '" '
        + 'data-air="' + n(r.ventilation) + '" data-path="' + n(r.path) + '" '
        + 'x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" '
        + 'fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (lv ? 1.8 : 1) + '" '
        + 'rx="2" tabindex="0" role="button" aria-label="' + esc(aria) + '"/>';

      /* 只有够大才写字：太小的房间里文字会挤成一团，比不写更糟 */
      if (r.w * scale > 46 && r.h * scale > 30) {
        var c = { x: p0.x + r.w * scale / 2, y: p0.y + r.h * scale / 2 };
        body += '<text x="' + n(c.x) + '" y="' + n(c.y - 7) + '" text-anchor="middle" '
          + 'font-size="12" fill="' + PALETTE.goldSoft + '" pointer-events="none">'
          + esc(r.name) + '</text>'
          + '<text x="' + n(c.x) + '" y="' + n(c.y + 6) + '" text-anchor="middle" '
          + 'font-size="10" fill="' + PALETTE.dim + '" pointer-events="none">'
          + n(r.area) + ' m² · 采' + r.daylight.toFixed(2) + '</text>'
          + '<text x="' + n(c.x) + '" y="' + n(c.y + 19) + '" text-anchor="middle" '
          + 'font-size="9" fill="' + PALETTE.dim + '" pointer-events="none">'
          + esc(r.direction) + esc(r.mountain) + '</text>';
      }

      /* 外窗画成外墙上的粗线，一眼看出哪里能开窗 */
      r.windows.forEach(function (w) {
        var seg = windowSeg(w, r, P, scale);
        body += '<line data-window="' + esc(w.dir) + '" x1="' + n(seg.x1) + '" y1="' + n(seg.y1)
          + '" x2="' + n(seg.x2) + '" y2="' + n(seg.y2) + '" stroke="#7fc7d8" '
          + 'stroke-width="3" stroke-linecap="round" pointer-events="none"/>';
      });
      body += '</g>';
    });

    /* ---- 门窗开口（自动识别）----
       门与窗画成墙上的一段缺口：门是双线（可通行的洞），窗是三线（透光的缝）。
       只按开口宽度区分，不看图里的画法 —— 画法千差万别，看画法就是猜。 */
    if (Array.isArray(o.openings)) {
      o.openings.forEach(function (op, oi) {
        var isDoor = op.kind === 'door';
        var col = isDoor ? PALETTE.high : '#7fc7d8';
        var pt0, pt1;
        if (op.side === 'N' || op.side === 'S') {
          var yy = op.side === 'N' ? a.depth : 0;
          pt0 = P(op.along - op.width / 2, yy);
          pt1 = P(op.along + op.width / 2, yy);
        } else {
          var xx = op.side === 'W' ? 0 : a.width;
          pt0 = P(xx, op.along - op.width / 2);
          pt1 = P(xx, op.along + op.width / 2);
        }
        var mx = (pt0.x + pt1.x) / 2, my = (pt0.y + pt1.y) / 2;
        var vx = pt1.x - pt0.x, vy = pt1.y - pt0.y;
        var vlen = Math.max(1e-6, Math.sqrt(vx * vx + vy * vy));
        /* 垂直于墙的方向，用于画窗的第二道线 */
        var nx = -vy / vlen, ny = vx / vlen;
        var off = isDoor ? 0 : Math.max(3, ow * 0.008);
        body += '<g class="xext-hs-opening" data-opening="' + oi + '" data-kind="' + esc(op.kind)
          + '" data-side="' + esc(op.side) + '" data-width="' + n(op.width) + '">'
          + '<line x1="' + n(pt0.x) + '" y1="' + n(pt0.y) + '" x2="' + n(pt1.x) + '" y2="' + n(pt1.y)
          + '" stroke="' + col + '" stroke-width="' + (isDoor ? 4 : 2.4) + '" stroke-linecap="butt"'
          + ' pointer-events="none"/>';
        if (!isDoor) {
          body += '<line x1="' + n(pt0.x + nx * off) + '" y1="' + n(pt0.y + ny * off)
            + '" x2="' + n(pt1.x + nx * off) + '" y2="' + n(pt1.y + ny * off)
            + '" stroke="' + col + '" stroke-width="1.4" pointer-events="none"/>';
          body += '<line x1="' + n(pt0.x - nx * off) + '" y1="' + n(pt0.y - ny * off)
            + '" x2="' + n(pt1.x - nx * off) + '" y2="' + n(pt1.y - ny * off)
            + '" stroke="' + col + '" stroke-width="1.4" pointer-events="none"/>';
        }
        body += '<text x="' + n(mx + nx * (off + 11) + 9) + '" y="' + n(my + ny * (off + 11) + 3)
          + '" font-size="10" fill="' + col + '" paint-order="stroke" stroke="' + PALETTE.ink
          + '" stroke-width="2.5" pointer-events="none">' + esc(isDoor ? '门' : '窗')
          + n(op.width) + 'm</text></g>';
      });
    }

    /* ---- 家具布局建议 ----
       每条建议都带 x/y，直接落在图上；点不动的条目不给坐标，
       只在下方清单里以文字呈现，不在图上乱画。 */
    if (Array.isArray(o.furniture) && o.furniture.length) {
      body += '<g class="xext-hs-furniture" data-layer="furniture">';
      o.furniture.forEach(function (f, fi) {
        if (typeof f.x !== 'number' || typeof f.y !== 'number') return;
        var p = P(f.x, f.y);
        var col = f.color || PALETTE.goldSoft;
        body += '<g data-furniture="' + fi + '" data-where="' + esc(String(f.where || '')) + '">'
          + '<circle cx="' + n(p.x) + '" cy="' + n(p.y) + '" r="7" fill="' + col
          + '" fill-opacity="0.16" stroke="' + col + '" stroke-width="1.4" tabindex="0" role="button"'
          + ' aria-label="' + esc((f.item || '') + '：' + (f.where || '') + '。' + (f.plain || '')) + '"/>'
          + '<text x="' + n(p.x) + '" y="' + n(p.y - 11) + '" text-anchor="middle" font-size="9"'
          + ' fill="' + col + '" paint-order="stroke" stroke="' + PALETTE.ink
          + '" stroke-width="2.5" pointer-events="none">' + esc(String(f.item || '').slice(0, 6))
          + '</text></g>';
      });
      body += '</g>';
    }

    /* ---- 挂画摆件 ---- */
    if (Array.isArray(o.decor) && o.decor.length) {
      body += '<g class="xext-hs-decor" data-layer="decor">';
      o.decor.forEach(function (d, di) {
        if (typeof d.x !== 'number' || typeof d.y !== 'number') return;
        var p = P(d.x, d.y);
        body += '<g data-decor="' + di + '" data-what="' + esc(String(d.what || '')) + '">'
          + '<rect x="' + n(p.x - 5) + '" y="' + n(p.y - 5) + '" width="10" height="10" rx="2"'
          + ' transform="rotate(45 ' + n(p.x) + ' ' + n(p.y) + ')" fill="none" stroke="'
          + PALETTE.gold + '" stroke-width="1.4" tabindex="0" role="button"'
          + ' aria-label="' + esc((d.what || '') + '放在' + (d.where || '') + '。' + (d.plain || ''))
          + '"/>'
          + '<text x="' + n(p.x) + '" y="' + n(p.y + 18) + '" text-anchor="middle" font-size="9"'
          + ' fill="' + PALETTE.gold + '" paint-order="stroke" stroke="' + PALETTE.ink
          + '" stroke-width="2.5" pointer-events="none">'
          + esc(String(d.what || '').slice(0, 7)) + '</text></g>';
      });
      body += '</g>';
    }

    /* ---- 整改标记 ----
       每条问题在图上落一个可点的编号牌；点击清单里的问题也能定位到它。
       坐标来自 analyze() 的 mark 字段，图与清单用的是同一份数据，
       不会出现「清单说有、图上没有」这种对不上的情况。 */
    if (o.showMarks !== false && Array.isArray(a.issues)) {
      body += '<g class="xext-hs-marks" data-layer="marks">';
      a.issues.forEach(function (it, ii) {
        if (!it.mark) return;
        var p = P(it.mark.x, it.mark.y);
        var col = LEVEL_COLOR[it.level] || PALETTE.low;
        body += '<g data-issue="' + esc(it.id || String(ii)) + '" data-tag="' + esc(it.tag || '') + '">'
          + '<circle cx="' + n(p.x) + '" cy="' + n(p.y) + '" r="' + n(it.mark.r || 0.35 * scale)
          + '" fill="' + col + '" fill-opacity="0.13" stroke="' + col
          + '" stroke-width="1" stroke-dasharray="3 2" pointer-events="none"/>'
          + '<circle cx="' + n(p.x) + '" cy="' + n(p.y) + '" r="8" fill="' + col
          + '" stroke="' + PALETTE.ink + '" stroke-width="1" tabindex="0" role="button"'
          + ' aria-label="' + esc('整改标记 ' + (ii + 1) + '：' + (it.tag || '')
            + '。' + (it.text || '') + '。' + (it.plain || '')) + '">'
          + String(ii + 1) + '</circle>'
          + '<text x="' + n(p.x) + '" y="' + n(p.y + 3) + '" text-anchor="middle" font-size="9"'
          + ' font-weight="700" fill="' + PALETTE.ink + '" pointer-events="none">'
          + (ii + 1) + '</text></g>';
      });
      body += '</g>';
    }

    /* 入户门 */
    var ep = P(a.entry.x, a.entry.y);
    body += '<g data-entry="' + (a.entry.assumed ? 'assumed' : 'given') + '">'
      + '<circle cx="' + n(ep.x) + '" cy="' + n(ep.y) + '" r="5" fill="' + PALETTE.high + '"/>'
      + '<text x="' + n(ep.x + 9) + '" y="' + n(ep.y - 7) + '" font-size="10" fill="'
      + PALETTE.high + '" paint-order="stroke" stroke="' + PALETTE.ink + '" stroke-width="2.5">'
      + '入户门' + (a.entry.assumed ? '（推算）' : '') + '</text></g>';

    /* 方位环：二十四山标在轮廓外围，正北固定朝上 */
    if (o.showCompass !== false) {
      var ringR = Math.sqrt(ow * ow + oh * oh) / 2 + 30;
      var ccx = W / 2, ccy = H / 2;
      var ms = a.mountains || [];
      ms.forEach(function (m) {
        var ang = (m.center - 90) * DEG;
        var x = ccx + ringR * Math.cos(ang), y = ccy + ringR * Math.sin(ang);
        var house = a.compass && a.compass.mountain === m.name;
        body += '<text data-mark="' + esc(m.name) + '" x="' + n(x) + '" y="' + n(y + 3)
          + '" text-anchor="middle" font-size="' + (house ? '11' : '9') + '" '
          + 'fill="' + (house ? PALETTE.high : PALETTE.dim) + '" '
          + 'pointer-events="none" paint-order="stroke" stroke="' + PALETTE.ink
          + '" stroke-width="2.5">' + esc(m.name) + '</text>';
      });
      /* 正北标记 */
      var northY = ccy - ringR - 2;
      body += '<text x="' + n(ccx) + '" y="' + n(Math.max(12, northY)) + '" text-anchor="middle" '
        + 'font-size="11" fill="' + PALETTE.gold + '">正北</text>';
    }

    /* 总分角标 */
    if (o.showScores !== false && typeof a.total === 'number') {
      body += '<g data-score="' + a.total + '" data-verdict="' + esc(a.verdict || '') + '">'
        + '<rect x="' + n(ox.x + ow - 86) + '" y="' + n(ox.y - 44) + '" width="82" height="38" rx="4" '
        + 'fill="rgba(11,15,28,0.86)" stroke="' + PALETTE.line + '"/>'
        + '<text x="' + n(ox.x + ow - 45) + '" y="' + n(ox.y - 20) + '" text-anchor="middle" '
        + 'font-size="19" font-weight="600" fill="' + PALETTE.gold + '">' + a.total + '</text>'
        + '<text x="' + n(ox.x + ow - 45) + '" y="' + n(ox.y - 9) + '" text-anchor="middle" '
        + 'font-size="9" fill="' + PALETTE.dim + '">勘宅总分</text></g>';
    }

    /* 六项评分条：放在轮廓下方空白，不与房间重叠 */
    if (o.showScores !== false && a.scores) {
      var LABELS = { flow: '动线', layout: '格局', palace: '落位', shape: '形状', function: '功能', light: '采光通风' };
      var bx = ox.x, by = ox.y + oh + 18;
      var keys = Object.keys(LABELS);
      keys.forEach(function (k, i) {
        var v = num(a.scores[k]);
        var x = bx + i * (ow / keys.length);
        var w = ow / keys.length - 6;
        var bar = w * clamp(v / 100, 0, 1);
        var col = v >= 80 ? PALETTE.good : (v >= 60 ? PALETTE.mid : PALETTE.high);
        body += '<g data-metric="' + esc(k) + '" data-value="' + n(v) + '">'
          + '<rect x="' + n(x) + '" y="' + n(by) + '" width="' + n(w) + '" height="5" rx="2" '
          + 'fill="rgba(255,255,255,0.10)"/>'
          + '<rect x="' + n(x) + '" y="' + n(by) + '" width="' + n(bar) + '" height="5" rx="2" '
          + 'fill="' + col + '"/>'
          + '<text x="' + n(x) + '" y="' + n(by + 17) + '" font-size="9" fill="' + PALETTE.dim
          + '">' + esc(LABELS[k]) + ' ' + Math.round(v) + '</text></g>';
      });
    }

    /* 比例尺：给一个可量测的参照 */
    var barM = niceLength(a.width);
    body += '<g data-scale="' + n(barM) + '">'
      + '<line x1="' + n(ox.x) + '" y1="' + n(ox.y + oh + 44) + '" x2="' + n(ox.x + barM * scale)
      + '" y2="' + n(ox.y + oh + 44) + '" stroke="' + PALETTE.dim + '" stroke-width="2"/>'
      + '<line x1="' + n(ox.x) + '" y1="' + n(ox.y + oh + 40) + '" x2="' + n(ox.x)
      + '" y2="' + n(ox.y + oh + 48) + '" stroke="' + PALETTE.dim + '" stroke-width="2"/>'
      + '<text x="' + n(ox.x + barM * scale / 2) + '" y="' + n(ox.y + oh + 38)
      + '" text-anchor="middle" font-size="10" fill="' + PALETTE.dim + '">' + n(barM) + ' m</text></g>';

    var title = '勘宅标注图：' + a.width + '×' + a.depth + ' 米，' + a.rooms.length
      + ' 个空间，总分 ' + (a.total === undefined ? '—' : a.total) + ' 分。' + (a.boundary || '');
    return '<svg class="xext-hs-overlay" xmlns="http://www.w3.org/2000/svg" '
      + 'viewBox="0 0 ' + n(W) + ' ' + n(H) + '" width="' + n(W) + '" height="' + n(H)
      + '" role="img" aria-label="' + esc(title) + '">'
      + '<title>' + esc(title) + '</title><rect width="' + n(W) + '" height="' + n(H)
      + '" fill="none"/>' + body + '</svg>';
  }

  /* 外窗线段：两端内缩按**该边自身长度**算，
     统一用 min(w,h) 内缩会让短边房间的线段两端翻到房间外面去。 */
  function windowSeg(w, room, P, scale) {
    var pad = 0.18;
    if (w.edge === 'W') {
      var oy = Math.min(room.h * pad, Math.max(0, (room.h * scale - 8) / scale / 2));
      var a1 = P(room.x, room.y + oy), a2 = P(room.x, room.y + room.h - oy);
      return { x1: a1.x, y1: a1.y, x2: a2.x, y2: a2.y };
    }
    if (w.edge === 'E') {
      var oy2 = Math.min(room.h * pad, Math.max(0, (room.h * scale - 8) / scale / 2));
      var b1 = P(room.x + room.w, room.y + oy2), b2 = P(room.x + room.w, room.y + room.h - oy2);
      return { x1: b1.x, y1: b1.y, x2: b2.x, y2: b2.y };
    }
    var ox = Math.min(room.w * pad, Math.max(0, (room.w * scale - 8) / scale / 2));
    if (w.edge === 'S') {
      var c1 = P(room.x + ox, room.y), c2 = P(room.x + room.w - ox, room.y);
      return { x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y };
    }
    var d1 = P(room.x + ox, room.y + room.h), d2 = P(room.x + room.w - ox, room.y + room.h);
    return { x1: d1.x, y1: d1.y, x2: d2.x, y2: d2.y };
  }

  function niceLength(maxM) {
    var cands = [1, 2, 3, 5, 10, 15, 20];
    for (var i = 0; i < cands.length; i += 1) if (cands[i] <= maxM * 0.85) return cands[i];
    return Math.round(maxM);
  }

  /* ==================== 文本报告 ==================== */

  /**
   * report —— 生成可打印、可逐条划掉的勘宅报告。
   * 读者是要拿着它跟装修方对账的人，所以每条结论后面必须跟「依据」。
   */
  function report(a) {
    if (!a || !Array.isArray(a.rooms)) {
      return '勘宅报告\n\n尚无可用结果。请先上传户型图或手动添加房间，再运行勘宅分析。'
        + '\n报告的每一条结论都会写明它的计算依据，可逐条核对。';
    }
    var L = [];
    var SCORE_CN = {
      flow: '动线通畅度', layout: '格局完整度', palace: '主要空间落位',
      shape: '户型形状利用', function: '功能面积配比', light: '采光与通风'
    };

    L.push('勘宅报告　·　' + a.width.toFixed(1) + ' × ' + a.depth.toFixed(1) + ' 米'
      + '　共 ' + a.rooms.length + ' 个空间');
    L.push('');

    /* 一、总体结论 */
    L.push('一、总体结论');
    L.push('');
    L.push('综合得分：' + a.total + ' / 100　—　' + (a.verdict || ''));
    L.push('');
    L.push('分项得分：');
    Object.keys(SCORE_CN).forEach(function (k) {
      var v = num(a.scores[k]);
      var bar = '█'.repeat(Math.round(v / 5)) + '·'.repeat(20 - Math.round(v / 5));
      L.push('　' + SCORE_CN[k] + '　' + Math.round(v) + '　' + bar);
    });
    L.push('');
    L.push('依据：六项按动线 16%、格局 20%、落位 16%、形状 14%、功能 18%、采光通风 16% 加权求和，'
      + '各分项的算式见下文对应条目。');
    L.push('');

    /* 二、户型概况 */
    L.push('二、户型概况');
    L.push('');
    L.push('　轮廓面积　' + (a.width * a.depth).toFixed(1) + ' m²');
    L.push('　房间合计　' + a.totalArea.toFixed(1) + ' m²（占轮廓 ' + (a.usage * 100).toFixed(0) + '%）');
    L.push('　面积加权采光指数　' + num(a.avgLight).toFixed(2));
    L.push('　面积加权通风指数　' + num(a.avgAir).toFixed(2));
    L.push('　功能配比　起居 ' + (a.mix.living * 100).toFixed(0) + '%　餐厨 '
      + (a.mix.cooking * 100).toFixed(0) + '%　卧寝 ' + (a.mix.sleep * 100).toFixed(0)
      + '%　辅助 ' + (a.mix.service * 100).toFixed(0) + '%');
    L.push('　入户门　' + (a.entry.assumed ? '按最短边推算' : '图纸标注') + '（'
      + a.entry.x.toFixed(1) + ', ' + a.entry.y.toFixed(1) + '）');
    if (a.farthest) {
      L.push('　离门最远　' + a.farthest.name + '，' + a.farthest.path.toFixed(1) + ' m');
    }
    L.push('');

    /* 三、逐间明细 */
    L.push('三、逐间明细');
    L.push('');
    L.push('　空间　　　　　面积　　外窗　　　窗地比　采光　通风　距门　方位');
    a.rooms.forEach(function (r) {
      L.push('　' + padEnd(r.name, 8) + '　' + padLeft(r.area.toFixed(1), 5) + '　'
        + padEnd(r.windows.length ? r.windows.map(function (w) { return w.dir; }).join('') : '无', 6) + '　'
        + padLeft((r.windowRatio * 100).toFixed(0) + '%', 5) + '　'
        + padLeft(r.daylight.toFixed(2), 5) + '　'
        + padLeft(r.ventilation.toFixed(2), 5) + '　'
        + padLeft(r.path.toFixed(1), 5) + '　'
        + r.direction + r.mountain + '山');
    });
    L.push('');
    L.push('　依据：面积 = 宽 × 高；窗地比 = 外窗宽度 × 窗高 1.5 m ÷ 地面面积；'
      + '采光指数 = 开口周长比 × 朝向系数（北 0.28 至南 1.00，朝向侧开口加倍计入）；'
      + '通风指数取南北、东西两组对侧开口较小者换算；距门为入户门到房间中心的直线距离。');
    L.push('');

    /* 四、缺角 */
    var notches = (a.corners || []).filter(function (c) { return c.missing > 0.05; });
    L.push('四、轮廓缺角');
    L.push('');
    if (!notches.length) {
      L.push('　八个方向的外轮廓均完整，未检出缺角。');
      L.push('　依据：以户型中心为原点，向八个方向各作一个与整户等大的角落方块，'
        + '统计房间实际覆盖面积，归一后缺口均小于 5%。');
    } else {
      notches.forEach(function (c) {
        L.push('　缺' + c.dir + '角　缺口约 ' + (c.missing * 100).toFixed(0) + '%　'
          + (c.missing > 0.35 ? '（显著）' : '（轻微）'));
        L.push('　　依据：' + c.dir + '向角落方块被房间覆盖 ' + c.covered.toFixed(1)
          + ' m²，归一后缺口 ' + (c.missing * 100).toFixed(0) + '%。');
      });
    }
    L.push('');

    /* 五、厨卫 */
    L.push('五、厨房与卫生间');
    L.push('');
    L.push('　位置：' + (a.wet.kitchens.length ? a.wet.kitchens.join('、') : '未指定')
      + '；' + (a.wet.baths.length ? a.wet.baths.join('、') : '未指定'));
    L.push('　' + a.wet.notes);
    if (a.wet.tags.length) {
      L.push('　关注点：' + a.wet.tags.join('、'));
    }
    L.push('');

    /* 六、检出问题 */
    L.push('六、检出的问题（按等级排列）');
    L.push('');
    if (!a.issues.length) {
      L.push('　未检出达到提示阈值的问题。');
    } else {
      var order = { high: 0, mid: 1, low: 2 };
      a.issues.slice().sort(function (x, y) { return order[x.level] - order[y.level]; })
        .forEach(function (i, k) {
          var lv = i.level === 'high' ? '【高】' : (i.level === 'mid' ? '【中】' : '【低】');
          L.push((k + 1) + '. ' + lv + (i.tag ? i.tag + '：' : '') + i.text);
          L.push('　　依据：' + i.basis);
        });
    }
    L.push('');

    /* 七、改进计划 */
    L.push('七、改进计划（按「先做哪一件」排序）');
    L.push('');
    a.plan.forEach(function (p) {
      L.push(p.rank + '. ' + p.title + '　（工作量：' + p.effort + '　预期提升：约 ' + p.gain + ' 分）');
      L.push('　做法：' + p.action);
      L.push('　理由：' + p.why);
    });
    L.push('');
    L.push('　说明：预期提升为按「补一处开口能把该空间采光指数从 0 提到朝向权重上限」'
      + '所做的量级估算，用于排序先后，不代表改造后的实测得分。');
    L.push('');

    /* 八、方位文化标注 */
    L.push('八、方位文化标注（可单独关闭）');
    L.push('');
    var comp = a.compass || {};
    L.push('　宅向　' + (comp.mountain || '—') + '山（' + num(comp.deg) + '°）　坐'
      + (a.seat ? a.seat.dir : '—') + '向');
    L.push('');
    L.push('　各空间落位：');
    a.rooms.forEach(function (r) {
      L.push('　　' + padEnd(r.name, 8) + '　' + r.direction + '方 ' + r.mountain + '山　'
        + r.center.x.toFixed(1) + ', ' + r.center.y.toFixed(1) + ' m');
    });
    L.push('');
    if (a.yearly) {
      L.push('　流年紫白（' + a.yearly.year + ' 年，九运序第 ' + a.yearly.yuan + ' 元）：');
      a.yearly.palaces.forEach(function (p) {
        L.push('　　' + padEnd(p.palace, 10) + '　' + p.star);
      });
      L.push('　　' + a.yearly.note);
    }
    L.push('');
    L.push('九、边界与免责');
    L.push('');
    L.push('　' + (a.boundary || ''));
    L.push('');
    L.push('—— 报告结束 ——');
    return L.join('\n');
  }

  /* 中文按 2 个字符宽排版，供等宽终端阅读 */
  function charWidth(s) {
    var w = 0;
    String(s).split('').forEach(function (ch) {
      w += /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/
        .test(ch) ? 2 : 1;
    });
    return w;
  }
  function padEnd(s, n2) {
    s = String(s == null ? '' : s);
    return s + ' '.repeat(Math.max(0, n2 - charWidth(s)));
  }
  function padLeft(s, n2) {
    s = String(s == null ? '' : s);
    return ' '.repeat(Math.max(0, n2 - charWidth(s))) + s;
  }

  root.HouseScanUI = {
    version: 'house-scan-ui-1.1.0',
    PALETTE: PALETTE,
    KIND_FILL: KIND_FILL,
    LEVEL_COLOR: LEVEL_COLOR,
    MOUNTAINS: MOUNTAINS,
    LUO_SHU: LUO_SHU,
    PALACE_KEYS: PALACE_KEYS,
    PALACE_CN: PALACE_CN,
    PALACE_DEG: PALACE_DEG,
    BA_MEN: BA_MEN,
    STAR_CN: STAR_CN,
    DIR_DEG: DIR_DEG,
    palacesOf: palacesOf,
    mountainAt: mountainAt,
    compass: compass,
    overlay: overlay,
    report: report,
    windowSeg: windowSeg,
    niceLength: niceLength,
    esc: esc
  };
})(typeof window !== 'undefined' ? window : globalThis);
