/* 玄机阁 · 二十八宿星空剧场（界面层）
 *
 * 职责边界（必须如实呈现，不得含糊）：
 *  - 二十八宿是中国古代的天区划分。这里做的是「观象坐标与文化出处」：
 *    按宿定位、看代表星在哪、查文化含义、对应节气与四宫。
 *  - 本模块不排吉凶、不断吉凶、不做命运推断。所有文案都不得出现断言式吉凶语。
 *  - 宿度与代表星是两套不同源的数据：宿度是沿天赤道的等分近似，
 *    代表星是真实 J2000 恒星坐标，二者并不重合。界面必须分开呈现，
 *    不得暗示「某宿度范围内就只有这几颗星」。
 *
 * 本模块只生成标记字符串，不做事件绑定；交互由 explore-entry.js 接管。
 */
(function (global) {
  'use strict';

  var Xiu = global.XiuAstro;
  var Data = global.XiuData;
  var Sky = global.SkyView;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function f2(n) { return (Math.round(n * 100) / 100).toFixed(2); }

  var PALACE_FILL = {
    azure: '#5fd0c8', dark: '#6f9fe0', white: '#e6d2a0', vermilion: '#e88b6a'
  };

  /* 宿度带的屏幕折线。宿度是沿天赤道的等分，投影后是一条大圆弧，
     gnomonic 会把它映成直线或双段折线——直接逐点连即可，无需求解析交点。 */
  function bandPaths(v) {
    return Sky.lodgeSegments({ each: 6 }).map(function (seg) {
      var pts = [];
      seg.points.forEach(function (p) {
        var s = v.screen({ ra: p.raw, dec: 0 });
        if (s.visible) pts.push(s);
      });
      if (pts.length < 2) return null;
      var d = 'M' + f2(pts[0].x) + ' ' + f2(pts[0].y);
      for (var i = 1; i < pts.length; i += 1) d += ' L' + f2(pts[i].x) + ' ' + f2(pts[i].y);
      var pal = Data.palaces.filter(function (p) { return p.name === seg.palace; })[0];
      var col = pal && PALACE_FILL[pal.id] ? PALACE_FILL[pal.id] : '#c8b98a';
      /* 段中点做隐形宽描边，作为可点选的热区 */
      var mx = (pts[0].x + pts[pts.length - 1].x) / 2;
      var my = (pts[0].y + pts[pts.length - 1].y) / 2;
      return '<path class="xext-x-band" d="' + d + '" fill="none" stroke="' + col +
        '" stroke-width="1" stroke-opacity=".45" stroke-dasharray="3 3" pointer-events="none"/>' +
        '<path class="xext-x-hit" data-lodge="' + esc(seg.lodge) + '" role="' + seg.role +
        '" tabindex="' + seg.tabIndex + '" aria-label="' + esc(seg.ariaLabel) +
        '" d="' + d + '" fill="none" stroke="' + col + '" stroke-width="16" stroke-opacity="0"/>';
    }).filter(Boolean).join('');
  }

  /* 坐标网格：赤经圈与赤纬圈的交点采样后投影。
     gnomonic 下大圆映成直线，所以这两组网格线是真正的「天球坐标尺」，
     学习者能直接读出视场覆盖的赤经赤纬范围，而不必猜。 */
  function gridPaths(v, W, H) {
    var out = [];
    /* 把一条球面大圆采样投影成折线。
     遇到落在视场背面的点必须收束当前这一段（M…Z）并另起新段；
     若只是把 d 置空再接着追加 L，会得到「M10 20L30 40」这种
     缺命令的非法路径，SVG 会整条丢弃——表现为「网格线莫名消失」。
     gnomonic 下大圆投影后本就是折线，转折点是真实的，不做平滑。 */
    function arc(pts) {
      var segs = [], cur = [];
      pts.forEach(function (p) {
        var s = v.screen(p);
        if (s.visible) {
          cur.push(s);
        } else if (cur.length > 1) {
          segs.push(cur); cur = [];
        } else {
          cur = [];
        }
      });
      if (cur.length > 1) segs.push(cur);
      return segs.map(function (seg) {
        var d = 'M' + f2(seg[0].x) + ' ' + f2(seg[0].y);
        for (var i = 1; i < seg.length; i += 1) d += ' L' + f2(seg[i].x) + ' ' + f2(seg[i].y);
        return d;
      }).join(' ');
    }
    /* 赤纬圈：dec 每 20° 一条 */
    for (var dec = -60; dec <= 60; dec += 20) {
      var pts = [];
      for (var ra = 0; ra <= 360; ra += 5) pts.push({ ra: ra, dec: dec });
      var d = arc(pts);
      if (d) out.push('<path class="xext-x-grid" data-grid="dec" d="' + d +
        '" fill="none" stroke="#7d8ba8" stroke-width=".7" stroke-opacity=".28"/>');
    }
    /* 赤经圈：ra 每 30° 一条（每条标一个度数，兼作刻度） */
    for (var r = 0; r < 360; r += 30) {
      var pp = [];
      for (var dd = -88; dd <= 88; dd += 4) pp.push({ ra: r, dec: dd });
      var d2 = arc(pp);
      if (!d2) continue;
      out.push('<path class="xext-x-grid" data-grid="ra" d="' + d2 +
        '" fill="none" stroke="#7d8ba8" stroke-width=".7" stroke-opacity=".22"/>');
      /* 轴标注取视场中心附近的那一点，避免标签散落画布边缘 */
      var lbl = v.screen({ ra: r, dec: v.state.dec });
      if (lbl.visible && lbl.x > 24 && lbl.x < W - 24 && lbl.y > 18 && lbl.y < H - 18) {
        out.push('<text x="' + f2(lbl.x) + '" y="' + f2(lbl.y - 4) +
          '" text-anchor="middle" font-size="9" fill="#7d8ba8" fill-opacity=".75"' +
          ' paint-order="stroke" stroke="#05080f" stroke-width="2.5">' +
          (r === 0 ? '赤经 0°' : '赤经 ' + r + '°') + '</text>');
      }
    }
    /* 赤纬刻度：标在天赤道附近 */
    for (var dv = -40; dv <= 40; dv += 20) {
      if (dv === 0) continue;
      var lp = v.screen({ ra: v.state.ra, dec: dv });
      if (lp.visible && lp.x > 30 && lp.x < W - 30 && lp.y > 20 && lp.y < H - 20) {
        out.push('<text x="' + f2(lp.x + 6) + '" y="' + f2(lp.y) +
          '" font-size="9" fill="#7d8ba8" fill-opacity=".75" paint-order="stroke"' +
          ' stroke="#05080f" stroke-width="2.5">赤纬 ' + dv + '°</text>');
      }
    }
    return out.join('');
  }

  /* 宿名直标。密集处交替上下错开，避免相邻宿名挤成一片；
     描边避让（paint-order + stroke）保证压在网格线上也读得清。 */
  function lodgeLabels(v, W, H) {
    var segs = Sky.lodgeSegments({ each: 1 });
    var out = [];
    segs.forEach(function (seg, i) {
      var ra = (seg.raStart + seg.raEnd) / 2;
      var p = v.screen({ ra: ra, dec: 0 });
      if (!p.visible) return;
      if (p.x < 22 || p.x > W - 22 || p.y < 14 || p.y > H - 14) return;
      /* 奇偶交错：相邻宿名一个在上一个在下 */
      var dy = (i % 2 === 0) ? -7 : 13;
      out.push('<text x="' + f2(p.x) + '" y="' + f2(p.y + dy) +
        '" text-anchor="middle" font-size="10" fill="#e6d2a0" fill-opacity=".9"' +
        ' paint-order="stroke" stroke="#05080f" stroke-width="2.6"' +
        ' class="xext-x-lodge-label" data-lodge="' + esc(seg.lodge) + '">' +
        esc(seg.lodge.replace('宿', '')) + '</text>');
    });
    return out.join('');
  }

  /* 二十八宿星图。本函数必须是纯函数：同参数两次调用逐字符相同。 */
  function starMap(opts) {
    var o = opts || {};
    var W = o.width || 600;
    var H = o.height || 420;
    var v = Sky.create({
      width: W, height: H,
      ra: o.ra, dec: o.dec, zoom: o.zoom,
      lat: o.lat, lst: o.lst
    });
    var pal = [];
    var stars = [];

    /* 四宫色环：每宿按所属宫着色，让「四象」在图上直接可读 */
    Sky.lodgeSegments({ each: 4 }).forEach(function (seg) {
      var p = Data.palaces.filter(function (x) { return x.name === seg.palace; })[0];
      var col = p && PALACE_FILL[p.id] ? PALACE_FILL[p.id] : '#c8b98a';
      var s = v.screen({ ra: (seg.raStart + seg.raEnd) / 2, dec: 0 });
      if (!s.visible) return;
      pal.push('<circle cx="' + f2(s.x) + '" cy="' + f2(s.y) +
        '" r="2.4" fill="' + col + '" fill-opacity=".8" data-lodge="' + esc(seg.lodge) +
        '" role="button" tabindex="0" aria-label="' + esc(seg.ariaLabel) + '"><title>' +
        esc(seg.lodge + ' · ' + seg.palace) + '</title></circle>');
    });

    /* 代表星：真实 J2000 坐标。半径按星等分级，亮度按星等给光晕。 */
    v.starAnnotations().forEach(function (a) {
      if (!a.visible) return;
      var r = v.starSize(a.mag);
      var bright = Math.max(0.16, Math.min(1, (4.6 - a.mag) / 3.4));
      stars.push('<g class="xext-x-star" data-star="' + esc(a.name) + '" data-lodge="' + esc(a.lodge) +
        '" tabindex="0" role="button" aria-label="' + esc(a.name + '，' + a.con + '，' + a.mag + ' 等星，属' + a.lodge) +
        '"><circle cx="' + f2(a.x) + '" cy="' + f2(a.y) + '" r="' + f2(r * 3.4) +
        '" fill="#fff6d8" fill-opacity="' + f2(bright * 0.14) + '"/>' +
        '<circle cx="' + f2(a.x) + '" cy="' + f2(a.y) + '" r="' + f2(r) +
        '" fill="#fffaf0" fill-opacity="' + f2(0.55 + 0.45 * bright) + '"/>' +
        '<title>' + esc(a.name + ' · ' + a.con + ' · ' + a.mag + ' 等星 · 宿度：' + a.lodge) + '</title></g>');
    });

    var note =
      '<g class="xext-x-note">' +
      '<text x="12" y="20" fill="#e6d2a0" font-size="12">点击宿或星查看详情 · 拖拽旋转天区 · 滚轮缩放</text>' +
      '<text x="12" y="' + (H - 10) + '" fill="#8a8064" font-size="10">宿度（沿天赤道等分近似）与代表星（真实 J2000 坐标）是两套不同源数据，彼此并不重合</text>' +
      '</g>';

    var bg = '';
    if (isFinite(v.state.lst)) {
      bg += '<text x="' + (W - 12) + '" y="20" text-anchor="end" fill="#8a8064" font-size="11">' +
        esc('视场中心 赤经 ' + v.state.ra.toFixed(1) + '° · 赤纬 ' + v.state.dec.toFixed(1) + '°') + '</text>';
    }

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W +
      'px;height:auto;display:block;touch-action:none;cursor:grab" role="application" ' +
      'aria-label="二十八宿交互星图" xmlns="http://www.w3.org/2000/svg" ' +
      'data-sky-ra="' + f2(v.state.ra) + '" data-sky-dec="' + f2(v.state.dec) + '">' +
      '<g class="xext-x-grid">' + gridPaths(v, W, H) + '</g>' +
      '<g class="xext-x-bands">' + bandPaths(v) + '</g>' +
      '<g class="xext-x-palaces">' + pal.join('') + '</g>' +
      '<g class="xext-x-labels">' + lodgeLabels(v, W, H) + '</g>' +
      '<g class="xext-x-stars">' + stars.join('') + '</g>' +
      note + bg +
      '</svg>';
  }

  /* 宿详情：必须把宿度与代表星分开列，不得合并成一句「宿度范围内有这些星」 */
  function lodgeDetail(name) {
    var l = Xiu.lodge(name);
    if (!l) throw new Error('找不到宿：' + name);
    var palace = Xiu.palaceOfLodge(l) || Data.palaces[0];
    var rows = l.stars.map(function (s) {
      return '<tr><td>' + esc(s.name) + '</td><td>' + esc(s.con) + '</td>' +
        '<td>' + s.ra.toFixed(2) + '°</td><td>' + s.dec.toFixed(2) + '°</td>' +
        '<td>' + s.mag.toFixed(2) + '</td></tr>';
    }).join('');

    return '<div class="xext-card xext-x-detail" data-lodge="' + esc(l.name) + '">' +
      '<h4 style="color:#e6d2a0;margin:0 0 4px">' + esc(l.index) + ' · ' + esc(l.name) +
      ' <span style="font-size:12px;color:#8a8064">' + esc(l.pinyin) + '</span></h4>' +
      '<p class="xext-sub" style="margin:0 0 10px">' + esc(l.palace + ' · ' + palace.beast + '位' + palace.direction) +
      ' · ' + esc(l.asterism) + '</p>' +

      '<p style="margin:0 0 10px">' + esc(l.meaning) + '</p>' +
      '<p style="margin:0 0 12px;color:#c8b98a">' + esc(l.locate) + '</p>' +

      '<h5 style="margin:14px 0 6px;color:#e6d2a0;font-size:13px">宿度（等分近似）</h5>' +
      '<p style="margin:0 0 10px;font-family:monospace;font-size:12px">' +
      esc('赤经 ' + l.raStart.toFixed(2) + '° ~ ' + (l.raEnd > 360 ? (l.raEnd - 360).toFixed(2) : l.raEnd.toFixed(2)) +
      '°（跨 0°）· 度宽 ' + (l.raEnd - l.raStart).toFixed(2) + '°') + '</p>' +

      '<h5 style="margin:14px 0 6px;color:#e6d2a0;font-size:13px">代表星（真实 J2000 坐标）</h5>' +
      '<p class="xext-note" style="margin:0 0 8px">宿度与代表星是两套不同源的数据：宿度是沿天赤道的等分，' +
      '代表星是现代测得的恒星坐标，二者并不重合，因此下面这几颗星并不位于上面的宿度区间内。</p>' +
      '<table class="xext-x-table"><thead><tr><th>星名</th><th>星座</th><th>赤经</th><th>赤纬</th><th>星等</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +

      '<p class="xext-lim" style="margin:12px 0 0">' + esc(l.boundary) + '</p>' +
      '</div>';
  }

  /* 四宫概览 */
  function palacePanel() {
    return Data.palaces.map(function (p) {
      const inPalace = Data.lodges.filter(function (l) { return l.palace === p.name; });
      return '<div class="xext-card" style="border-left:3px solid ' + PALACE_FILL[p.id] + '">' +
        '<h4 style="margin:0 0 4px;color:' + PALACE_FILL[p.id] + '">' + esc(p.name) +
        ' · ' + esc(p.beast) + '</h4>' +
        '<p class="xext-sub" style="margin:0 0 8px">' + esc(p.direction) + '方 · ' + esc(p.season) +
        ' · 中心赤经 ' + p.raCenter.toFixed(1) + '°</p>' +
        '<p style="margin:0 0 8px">' + esc(p.note) + '</p>' +
        '<p class="xext-note" style="margin:0">' + esc(inPalace.map(function (l) { return l.name; }).join(' · ')) + '</p>' +
        '</div>';
    }).join('');
  }

  /* 二十四节气 → 宿 的文化索引。
     solarTerms() 只给 {index, name, lodges}，不含日期；日期必须自己从
     solarTermMinutes 换算。早先误读一个不存在的 t.date 字段，
     结果界面上二十四节气全显示 "undefined"。 */
  function termPanel(opts) {
    var o = opts || {};
    var y = isFinite(o.y) ? o.y : 2026;
    var leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    var cum = [0, 31, leap ? 60 : 59, leap ? 91 : 90, leap ? 121 : 120,
      leap ? 152 : 151, leap ? 182 : 181, leap ? 213 : 212,
      leap ? 244 : 243, leap ? 274 : 273, leap ? 305 : 304, leap ? 335 : 334, 366];
    function toMd(days) {
      var m = 0;
      while (m < 12 && days >= cum[m + 1]) m += 1;
      var d = days - cum[m] + 1;
      return (m + 1 < 10 ? '0' : '') + (m + 1) + '-' + (d < 10 ? '0' : '') + d;
    }
    return '<div class="xext-card"><h4 style="margin:0 0 8px;color:#e6d2a0">节气与宿</h4>' +
      '<p class="xext-note" style="margin:0 0 10px">节气按太阳黄经每 15° 一个推算（' + y + ' 年），' +
      '精度约 ±1 天，用于文化索引与星区定位，不作历法精算。</p>' +
      '<div class="xext-grid">' + Xiu.solarTerms().map(function (t) {
        return '<div class="xext-x-term"><b style="color:#e6d2a0">' + esc(t.name) + '</b>' +
          '<span>' + esc(toMd(Math.round(Xiu.solarTermMinutes({ y: y, name: t.name }) / 1440))) + '</span>' +
          '<span>' + esc((t.lodges || []).join(' · ')) + '</span></div>';
      }).join('') + '</div></div>';
  }

  /* 二十八宿导航。
     gnomonic 投影单个视场只有约 45° 见方，一次看不全周天（实测默认视场
     只能看到 46 颗代表星中的 12 颗、7 个宿）。这不是可以靠调参掩盖的问题，
     而必须如实告知并提供跳转入口，否则用户会误以为数据只有这些。 */
  function lodgeNavigator() {
    var byPalace = {};
    Data.lodges.forEach(function (l) {
      (byPalace[l.palace] = byPalace[l.palace] || []).push(l);
    });
    var groups = Data.palaces.map(function (p) {
      var list = byPalace[p.name] || [];
      return '<div class="xext-x-navgroup">' +
        '<div class="xext-x-navhead" style="border-left:3px solid ' + PALACE_FILL[p.id] + '">' +
        esc(p.name) + ' · ' + esc(p.beast) + '位' + esc(p.direction) + '</div>' +
        '<div class="xext-x-navitems">' + list.map(function (l) {
          return '<button type="button" class="xext-x-navbtn" data-goto="' + esc(l.name) +
            '" data-lodge="' + esc(l.name) + '" title="' + esc(l.asterism) + '">' +
            '<b>' + l.index + '</b>' + esc(l.name.replace('宿', '')) + '</button>';
        }).join('') + '</div></div>';
    }).join('');
    return '<div class="xext-card xext-x-nav">' +
      '<h4 style="margin:0 0 4px;color:#eed5a0">二十八宿导航</h4>' +
      '<p class="xext-note" style="margin:0 0 10px">星图采用 gnomonic 投影，单个视场只有约 45° 见方，' +
      '一次只能看到其中一部分宿。这是投影本身的限制，不能靠调参消除，所以在此列出全部 28 宿，' +
      '点击即可把视场转到该宿。</p>' +
      '<div class="xext-x-navgrid">' + groups + '</div></div>';
  }

  global.XiuUI = {
    version: 'xiu-ui-1.0.0',
    starMap: starMap,
    lodgeDetail: lodgeDetail,
    lodgeNavigator: lodgeNavigator,
    palacePanel: palacePanel,
    termPanel: termPanel
  };
})(typeof window !== 'undefined' ? window : globalThis);