/* 玄机阁 · 算法工作台图形化渲染
 *
 * 职责：把「已经算完的结构化结果」画成盘面，而不是倒回key/value 表格。
 * 奇门的九宫、六壬的天地盘、紫微的十二宫本来就是有空间结构的东西，
 * 拆成表格等于把盘面重新拼一遍—— 读者还得自己在脑子里重建一次。
 *
 * 硬约束（与 tests/ext-p3-workbench-viz.js 一一对应）：
 *  1) 纯函数。不读 DOM、不读时间、不随机。同参数两次渲染逐字符相同。
 *  2) 只呈现，不推断。渲染层不补算、不改数、不给断语；
 *     输入缺字段就留空，绝不自己造一个看起来合理的值。
 *  3) 空输入也必须出合法 SVG —— 引擎失败时页面会拿到空 result，
 *     那时不该白屏，更不该抛错把整页带崩。
 *  4) 坐标不得为负：所有元素落在画布内，避免出现画不出来的半个元素。
 *  5) 一切外部文本先转义再做属性或文本，不做字符串拼接反射。
 */
(function (root) {
  'use strict';

  /* ---------- 基础工具 ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 只接受有限数字，其余一律回落到 0。
     Number('') === 0、Number(undefined) === NaN，直接用会画出 NaN 坐标。 */
  function num(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  /* 坐标一律保留两位，且夹到非负。 */
  function px(v) {
    return Math.max(0, num(v)).toFixed(2);
  }

  function txt(x, y, s, o) {
    var op = o || {};
    return '<text x="' + px(x) + '" y="' + px(y) + '" font-size="' + num(op.size, 11) +
      '" fill="' + esc(op.fill || '#c8b083') + '"' +
      (op.anchor ? ' text-anchor="' + esc(op.anchor) + '"' : '') +
      (op.weight ? ' font-weight="' + esc(op.weight) + '"' : '') +
      (op.opacity ? ' opacity="' + num(op.opacity, 1) + '"' : '') +
      '>' + esc(s) + '</text>';
  }

  /* 极坐标 → 直角坐标。
     约定：正北（方位角 0°）朝上，方位角顺时针增大 —— 与罗盘一致。 */
  function polar(cx, cy, r, deg) {
    var a = (num(deg) - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function svg(w, h, body, title) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h +
      '" role="img" aria-label="' + esc(title) + '">' +
      '<title>' + esc(title) + '</title>' +
      '<rect class="xext-wv-bg" x="0" y="0" width="' + w + '" height="' + h + '" rx="12"/>' +
      body + '</svg>';
  }

  /* 洛书九宫固定布局：巽离坤 / 震中兑 / 艮坎乾。
     两个渲染器共用，保证奇门盘与太乙盘的宫位语义完全一致。 */
  /* [宫名, 列, 行] —— 列行从 0 起。
     注意这里存的是网格坐标而不是遍历序号：
     早先误存了 1..9 的序号，x 越算越靠右，九宫全挤到画布右侧还溢出。 */
  var NINE = [
    ['巽', 0, 0], ['离', 1, 0], ['坤', 2, 0],
    ['震', 0, 1], ['中', 1, 1], ['兑', 2, 1],
    ['艮', 0, 2], ['坎', 1, 2], ['乾', 2, 2]
  ];

  /* 对象字段取「第一个字符串值」作摘要。
     引擎给的局式是一整个 dict（文／數／年／積時數），
     整包JSON 化会变成一长串塞进标题栏，读不出「十一局」这三个字。
     摘要取不到就退回 full 文本 —— 不能因为取不到就画成空。 */
  function brief(v) {
    if (v == null) return '';
    if (typeof v === 'object') {
      for (var k in v) {
        if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
        var x = v[k];
        if (typeof x === 'string' && x) return x;
        if (typeof x === 'number') return String(x);
      }
      return one(v);
    }
    return String(v);
  }

  /* 单值转文本：对象一律走 JSON 而不是 String()。
   String({}) 给的是 '[object Object]' —— 一旦上层漏了类型判断，
   盘面上就会赫然写着这五个字，而它显然是错的。 */
  function one(v) {
    if (v == null) return '';
    if (typeof v === 'object') {
      try { return JSON.stringify(v); } catch (e) { return ''; }
    }
    return String(v);
  }

  /* 把数字键的字典摊平成按宫名索引的表，顺手挡掉非对象输入。 */
  function byPalace(src) {
    var out = {};
    if (src && typeof src === 'object') {
      Object.keys(src).forEach(function (k) {
        var v = src[k];
        out[k] = v == null ? '' : (typeof v === 'object' ? '' : String(v));
      });
    }
    return out;
  }

  /* ---------- 奇门九宫 ---------- */

  function qimenPan(result) {
    var r = (result && typeof result === 'object') ? result : {};
    var sky = byPalace(r['天盤']), earth = byPalace(r['地盤']);
    var door = byPalace(r['門']), star = byPalace(r['星']), god = byPalace(r['神']);
    var focus = (''  || one(r['太乙落宫']));

    var W = 520, H = 470, pad = 16, gridTop = 54, gap = 8;
    var cw = (W - pad * 2 - gap * 2) / 3, ch = (H - gridTop - pad - gap * 2) / 3;

    var head = txt(W / 2, 22, (one(r['排局']) || '—') + '　' + (one(r['干支']) || ''),
      { size: 13, fill: '#e8cf96', anchor: 'middle' }) +
      txt(W / 2, 40, '旬首 ' + (one(r['旬首']) || '—') + '　旬空 ' + (brief(r['旬空']) || '—') +
        '　节气 ' + (one(r['節氣']) || '—'), { size: 11, fill: '#9fb0c8', anchor: 'middle' });

    var cells = NINE.map(function (p) {
      var name = p[0], col = p[1], row = p[2];
      var x = pad + col * (cw + gap), y = gridTop + row * (ch + gap);
      var cx = x + cw / 2, cy = y + ch / 2;

      var inner = '';
      inner += txt(cx, y + 15, god[name] || '', { size: 10, fill: '#8fa8c8', anchor: 'middle' });
      inner += txt(cx, y + ch / 2 + 5, door[name] || '', { size: 16, fill: '#f0dcb0', anchor: 'middle' });
      inner += txt(cx, y + ch - 26, star[name] || '', { size: 10, fill: '#c6b083', anchor: 'middle' });
      /* 天盘在上、地盘在下，中间一条淡线分干两层 */
      inner += '<line x1="' + px(x + 10) + '" y1="' + px(y + ch - 18) + '" x2="' + px(x + cw - 10) +
        '" y2="' + px(y + ch - 18) + '" stroke="#3a4a63" stroke-width="1"/>';
      inner += txt(x + cw - 8, y + ch - 6, sky[name] || '', { size: 13, fill: '#e8cf96', anchor: 'end' });
      inner += txt(x + 8, y + ch - 6, earth[name] || '', { size: 13, fill: '#9ec8b0', anchor: 'start' });
      inner += txt(x + 6, y + 13, name, { size: 11, fill: '#7d8ba1', anchor: 'start' });

      return '<g data-palace="' + esc(name) + '" data-cx="' + px(cx) + '" data-cy="' + px(cy) +
        '" data-sky="' + esc(sky[name]) + '" data-earth="' + esc(earth[name]) + '">' +
        '<rect class="xext-wv-cell" x="' + px(x) + '" y="' + px(y) +
        '" width="' + px(cw) + '" height="' + px(ch) + '" rx="8"/>' + inner + '</g>';
    }).join('');

    var foot = txt(pad, H - 5, '门 / 星 / 神 依盘面呈现，仅记录本次所选定局法的排布。', { size: 10, fill: '#7d8ba1' });
    return svg(W, H, head + cells + foot, '奇门九宫盘');
  }

  /* ---------- 大六壬天地盘 ---------- */

  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  function liurenPlate(result) {
    var r = (result && typeof result === 'object') ? result : {};
    var plate = (r['天地盤'] && typeof r['天地盤'] === 'object') ? r['天地盤'] : {};
    var skyList = Array.isArray(plate['天盤']) ? plate['天盤'] : [];
    var earthList = Array.isArray(plate['地盤']) ? plate['地盤'] : [];
    var general = Array.isArray(plate['天將']) ? plate['天將'] : [];

    /* 地盘环按其自身顺序铺开；天盘干与天将按「落在哪一宫」对齐过去。
       这里不做任何推算 —— 只按引擎给的三个数组各自的位置摆。 */
    var earthRing = ZHI.map(function (z) { return z; });
    var W = 580, H = 424;
    /* 外圈半径要给最长的天将名（两三个字）留出半字宽。
       早先 cx=168 / rOut=158，左缘实算到10，天将两字就顶出画布。 */
    var cx = 176, cy = 202, rOut = 138, rMid = 106, rIn = 78;

    var cells = '';
    for (var i = 0; i < 12; i += 1) {
      var z = earthRing[i];
      var pOut = polar(cx, cy, rOut, i * 30);
      var pMid = polar(cx, cy, rMid, i * 30);
      var pIn = polar(cx, cy, rIn, i * 30);

      /* 天地盘标记挂在本宫 group 的属性上。
         三环各用一个内层 g 承载（便于 CSS 与调试按环取），
         但data-sky / data-earth 必须同时挂在外层 ——
         否则「某宫的天地盘分别是哪两个字」这一层关系就丢了，
         读者只能自己拿三圈去对。 */
      cells += '<g data-palace="' + esc(z) + '" data-branch="' + esc(z) +
        '" data-sky="' + esc(skyList[i] == null ? '' : skyList[i]) +
        '" data-earth="' + esc(earthList[i] == null ? '' : earthList[i]) + '">' +
        '<g data-ring="earth">' + txt(pOut.x, pOut.y, z, { size: 12, fill: '#e8cf96', anchor: 'middle' }) + '</g>' +
        '<g data-ring="general">' + txt(pMid.x, pMid.y, general[i] == null ? '' : general[i],
          { size: 10, fill: '#9fb0c8', anchor: 'middle' }) + '</g>' +
        '<g data-ring="sky">' +
        txt(pIn.x, pIn.y, skyList[i] == null ? '' : skyList[i], { size: 14, fill: '#f0dcb0', anchor: 'middle' }) +
        '</g>' +
        '</g>';
    }

    var rings = '<circle cx="' + px(cx) + '" cy="' + px(cy) + '" r="' + px(rOut) +
      '" fill="none" stroke="#3a4a63"/>' +
      '<circle cx="' + px(cx) + '" cy="' + px(cy) + '" r="' + px(rMid) +
      '" fill="none" stroke="#3a4a63"/>' +
      '<circle cx="' + px(cx) + '" cy="' + px(cy) + '" r="' + px(rIn) +
      '" fill="none" stroke="#3a4a63"/>' +
      '<circle cx="' + px(cx) + '" cy="' + px(cy) + '" r="' + px(rIn - 22) +
      '" fill="none" stroke="#2a3446" stroke-dasharray="3 4"/>';

    /* 三传：初→中→末自左向右一条链，四课另起一行 */
    var chain = '', chuanKeys = [['初傳', '初传'], ['中傳', '中传'], ['末傳', '末传']];
    var chuan = (r['三傳'] && typeof r['三傳'] === 'object') ? r['三傳'] : {};
    chuanKeys.forEach(function (pair, idx) {
      var item = chuan[pair[0]];
      item = Array.isArray(item) ? item : [];
      var bx = 366 + idx * 58;
      chain += '<g data-chuan="' + esc(pair[1]) + '">' +
        '<rect class="xext-wv-cell" x="' + px(bx) + '" y="80" width="54" height="66" rx="8"/>' +
        txt(bx + 27, 100, item[0] == null ? '' : String(item[0]), { size: 15, fill: '#f0dcb0', anchor: 'middle' }) +
        txt(bx + 27, 118, item[1] == null ? '' : String(item[1]), { size: 9, fill: '#9fb0c8', anchor: 'middle' }) +
        txt(bx + 27, 136, item[3] == null ? '' : String(item[3]), { size: 9, fill: '#c98f6a', anchor: 'middle' }) +
        '</g>';
      if (idx < 2) {
        chain += '<line x1="' + px(bx + 54) + '" y1="113" x2="' + px(bx + 62) +
          '" y2="113" stroke="#c8a457" stroke-width="1.5"/>';
      }
    });

    var ke = '', sike = (r['四課'] && typeof r['四課'] === 'object') ? r['四課'] : {};
    [['一課', '1'], ['二課', '2'], ['三課', '3'], ['四課', '4']].forEach(function (pair, idx) {
      var item = sike[pair[0]];
      item = Array.isArray(item) ? item : [];
      var bx = 366 + idx * 58;
      ke += '<g data-ke="' + pair[1] + '">' +
        txt(bx, 178, pair[0], { size: 10, fill: '#7d8ba1', anchor: 'middle' }) +
        txt(bx, 196, item[0] == null ? '' : String(item[0]), { size: 14, fill: '#e8cf96', anchor: 'middle' }) +
        txt(bx, 212, item[1] == null ? '' : String(item[1]), { size: 9, fill: '#9fb0c8', anchor: 'middle' }) +
        '</g>';
    });

    var head = txt(28, 24, (one(r['日期']) || '') + '　' + (one(r['節氣']) || ''),
      { size: 12, fill: '#e8cf96' }) +
      txt(cx, 20, '地盘 · 天将 · 天盘', { size: 10, fill: '#7d8ba1', anchor: 'middle' }) +
      txt(366, 40, '三传（初 → 中 → 末）', { size: 11, fill: '#c6b083' }) +
      txt(366, 66, '格局 ' + (Array.isArray(r['格局']) ? r['格局'].map(function (x) { return String(x); }).join(' · ') : '—'),
        { size: 10, fill: '#9fb0c8' }) +
      txt(366, 156, '四课', { size: 11, fill: '#c6b083' });

    var foot = txt(28, H - 14, '旬空以「空」标出；天地盘按引擎所给三环并列，不作吉凶断语。',
      { size: 10, fill: '#7d8ba1' });

    return svg(W, H, head + rings + cells + chain + ke + foot, '大六壬天地盘');
  }

  /* ---------- 太乙格局 ---------- */

  var TAIYI_ROLES = ['太乙', '文昌', '始击', '太岁', '合神', '计神'];

  function taiyiPan(result) {
    var r = (result && typeof result === 'object') ? result : {};
    var focus = num(r['太乙落宫'], 0);
    var num2palace = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中', 6: '乾', 7: '兑', 8: '艮', 9: '离' };
    /* 反向表也要有：图上按宫名高亮太乙落宫，不能只有宫号一条路 */
    var palace2num = {};
    Object.keys(num2palace).forEach(function (k) { palace2num[num2palace[k]] = Number(k); });

    var W = 520, H = 380, pad = 14, gap = 6;
    var headH = 46, sideW = 216;
    var gridTop = headH + 8;
    var cw = (sideW - gap * 2) / 3, ch = (H - gridTop - pad - gap * 2) / 3;

    var head = txt(W / 2, 20, (one(r['体系']) || '太乙神数') + '　' + (one(r['计式']) || '') +
      '　' + (one(r['积年法']) || ''), { size: 13, fill: '#e8cf96', anchor: 'middle' }) +
      txt(W / 2, 38, '积数 ' + (one(r['积数']) || '—') +
        '　局式 ' + (brief(r['局式']) || '—') +
        '　主算 ' + (one(r['主算']) || '—') +
        '　客算 ' + (one(r['客算']) || '—'), { size: 11, fill: '#9fb0c8', anchor: 'middle' });

    /* 左：洛书九宫，与奇门盘同一套坐标 —— 两个盘并排时宫位必须对得上 */
    var grid = NINE.map(function (p) {
      var name = p[0], col = p[1], row = p[2];
      var x = pad + col * (cw + gap), y = gridTop + row * (ch + gap);
      var isFocus = palace2num[name] === focus;
      return '<g data-palace="' + esc(name) + '"' + (isFocus ? ' data-focus="' + focus + '"' : '') + '>' +
        '<rect class="xext-wv-cell' + (isFocus ? ' is-focus' : '') + '" x="' + px(x) + '" y="' + px(y) +
        '" width="' + px(cw) + '" height="' + px(ch) + '" rx="8"' +
        (isFocus ? ' stroke="#c8a457" stroke-width="1.5"' : '') + '/>' +
        txt(x + cw / 2, y + ch / 2 + 4, name, { size: 13, fill: isFocus ? '#e8cf96' : '#8fa8c8', anchor: 'middle' }) +
        txt(x + 4, y + 11, String(palace2num[name]), { size: 8, fill: '#5d6b80', anchor: 'start' }) +
        '</g>';
    }).join('');

    /* 右：六治神各自一格。落宫不从名称反推—— 引擎给了什么就画什么，
       查不到就留空。渲染层一旦开始推宫，等于把第二个引擎藏进了图里。 */
    var rx = pad + sideW + 14;
    var rw = (W - pad - rx - gap * 2) / 3;
    var roleCells = TAIYI_ROLES.map(function (role, i) {
      var col = i % 3, row = Math.floor(i / 3);
      var x = rx + col * (rw + gap), y = gridTop + row * (ch + gap);
      return '<g data-role="' + esc(role) + '">' +
        '<rect class="xext-wv-cell" x="' + px(x) + '" y="' + px(y) + '" width="' + px(rw) +
        '" height="' + px(ch) + '" rx="8"/>' +
        txt(x + 5, y + 13, role, { size: 10, fill: '#7d8ba1', anchor: 'start' }) +
        txt(x + 5, y + ch / 2 + 4, one(r[role]), { size: 13, fill: '#f0dcb0', anchor: 'start' }) +
        '</g>';
    }).join('');

    /* 右下：主客双方。主客是传统局式角色，不是胜负，不写任何断语。 */
    var sideTop = gridTop + 2 * (ch + gap);
    var sides = [['home', '主'], ['away', '客']].map(function (s, i) {
      var x = rx + i * (rw * 1.5 + gap);
      var w = rw * 1.5;
      return '<g data-side="' + s[0] + '">' +
        '<rect class="xext-wv-cell" x="' + px(x) + '" y="' + px(sideTop) + '" width="' + px(w) +
        '" height="' + px(ch) + '" rx="8"/>' +
        txt(x + 6, sideTop + 13, s[1] + '方', { size: 10, fill: '#7d8ba1', anchor: 'start' }) +
        txt(x + 6, sideTop + 30, '将 ' + one(r[s[1] + '将']),
          { size: 12, fill: '#e8cf96', anchor: 'start' }) +
        txt(x + 6, sideTop + 46, '参 ' + (one(r[s[1] + '参']) || '—'),
          { size: 10, fill: '#9fb0c8', anchor: 'start' }) +
        '</g>';
    }).join('');

    return svg(W, H, head + grid + roleCells + sides,
      '太乙格局盘');
  }

  /* ---------- 星象天空图 ---------- */

  function astroChart(result) {
    var r = (result && typeof result === 'object') ? result : {};
    var W = 460, H = 460;
    var cx = W / 2, cy = H / 2 + 10, R = 190;
    /* 地平圈：把 -90°..90° 的高度角线性映射到 rIn..R。
       地平以下的天体落在内圈，一样画得出来、认得出来，
       不做「丢弃不可见天体」这种会让人以为算漏了的处理。 */
    var rIn = 62;
    function rOf(alt) {
      var a = Math.max(-90, Math.min(90, num(alt)));
      return rIn + (R - rIn) * (1 - (a + 90) / 180);
    }

    var frame = '<circle data-horizon="1" cx="' + px(cx) + '" cy="' + px(cy) + '" r="' + px(rIn) +
      '" fill="none" stroke="#c8a457" stroke-dasharray="4 4"/>' +
      '<circle cx="' + px(cx) + '" cy="' + px(cy) + '" r="' + px(R) + '" fill="none" stroke="#3a4a63"/>' +
      '<circle data-ecliptic="1" cx="' + px(cx) + '" cy="' + px(cy) + '" r="' + px((rIn + R) / 2) +
      '" fill="none" stroke="#4a6a8a" stroke-dasharray="2 5"/>' +
      txt(cx, cy + 4, '天顶', { size: 10, fill: '#7d8ba1', anchor: 'middle' }) +
      txt(cx, cy + rIn - 6, '地平', { size: 9, fill: '#9a8658', anchor: 'middle' });

    var marks = ['北', '东', '南', '西'].map(function (d, i) {
      var p = polar(cx, cy, R + 14, i * 90);
      return txt(p.x, p.y, d, { size: 12, fill: '#c6b083', anchor: 'middle' });
    }).join('');

    var LEGEND = { '太阳': '#e8b45c', '月亮': '#d8dce4', '水星': '#9ec8b0', '金星': '#e0c078',
      '火星': '#d97a52', '木星': '#c9a0d8', '土星': '#c0b090', '天王星': '#8ad0d8', '海王星': '#7f9ad8' };

    var bodies = Object.keys(r).filter(function (k) {
      var v = r[k];
      return v && typeof v === 'object' && !Array.isArray(v);
    }).map(function (name) {
      var v = r[name];
      var az = num(v['方位度'], 0), alt = num(v['高度度'], 0);
      var rad = rOf(alt);
      var p = polar(cx, cy, rad, az);
      var below = alt < 0;
      var color = LEGEND[name] || '#c8b083';
      return '<g data-body="' + esc(name) + '" data-az="' + esc(one(v['方位度'])) +
        '" data-alt="' + esc(one(v['高度度'])) + '">' +
        '<circle cx="' + px(p.x) + '" cy="' + px(p.y) + '" r="5" fill="' + esc(color) + '"' +
        (below ? ' opacity="0.55"' : '') + '/>' +
        '<circle cx="' + px(p.x) + '" cy="' + px(p.y) + '" r="9" fill="none" stroke="' + esc(color) +
        '" opacity="0.35"' + (below ? ' stroke-dasharray="2 3"' : '') + '/>' +
        txt(p.x + 12, p.y + 4, name, { size: 10, fill: color, anchor: 'start' }) +
        txt(p.x + 12, p.y + 15, (below ? '地平下 ' : '') + String(alt.toFixed(1)) + '°',
          { size: 8, fill: '#7d8ba1', anchor: 'start' }) +
        '</g>';
    }).join('');

    return svg(W, H, frame + marks + bodies, '天体方位与高度图');
  }

  /* ---------- 风水二十四山与九星 ---------- */

  var MOUNTAINS = ['子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙',
    '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬'];
  var STAR_COLOR = { 1: '#8ad0d8', 2: '#9ec8b0', 3: '#c0b090', 4: '#c9a0d8', 5: '#e8cf96',
    6: '#e0c078', 7: '#d97a52', 8: '#9fb0c8', 9: '#d8dce4' };

  function fengshuiRose(result) {
    var r = (result && typeof result === 'object') ? result : {};
    var degree = num(r['向度'], NaN);
    var facing = r['朝向'] == null ? '' : one(r['朝向']).slice(-1);
    var W = 560, H = 420;
    /* 罗盘外圈半径必须留出「字宽的一半 + 方位刻度」，
       否则正北（画布正上方）的山名会顶出画布左缘。
       早先 cx=132 / rOut=160，左缘实算到 −36，六座山名被切掉。 */
    var cx = 178, cy = 208, rOut = 148, rIn = 92;
    var star = (r['年度九宫'] && typeof r['年度九宫'] === 'object') ? r['年度九宫'] : {};

    /* 二十四山：每山 15°，子山居正北（0°）正中，顺时针排 */
    var ring = MOUNTAINS.map(function (m, i) {
      var p = polar(cx, cy, rOut, i * 15);
      var isFacing = m === facing;
      return '<g data-mount="' + esc(m) + '">' +
        txt(p.x, p.y, m, { size: isFacing ? 14 : 10, fill: isFacing ? '#e8cf96' : '#9fb0c8', anchor: 'middle' }) +
        '</g>';
    }).join('');

    var frame = '<circle cx="' + px(cx) + '" cy="' + px(cy) + '" r="' + px(rOut) +
      '" fill="none" stroke="#3a4a63"/>' +
      '<circle cx="' + px(cx) + '" cy="' + px(cy) + '" r="' + px(rIn) +
      '" fill="none" stroke="#3a4a63"/>';

    /* 向度指针：0° 为正北顺时针，长度按向度推进。
       向度缺失（NaN）时不画指针，也不画 0° 的假指向。 */
    var pointer = '';
    if (Number.isFinite(degree)) {
      var p = polar(cx, cy, rOut - 6, degree);
      pointer = '<g data-facing="' + esc(facing) + '" data-sitting="' + esc(one(r['坐山'])) +
        '" data-facing-angle="' + num(degree).toFixed(1) + '">' +
        '<line x1="' + px(cx) + '" y1="' + px(cy) + '" x2="' + px(p.x) + '" y2="' + px(p.y) +
        '" stroke="#d97a52" stroke-width="2"/>' +
        '<circle cx="' + px(p.x) + '" cy="' + px(p.y) + '" r="4" fill="#d97a52"/>' +
        '</g>';
    }

    /* 年度九星按洛书九宫落格：[九宫序号, 列, 行]。
       序号 1..9 的排布是 4 9 2 / 3 5 7 / 8 1 6，
       列行必须显式写出来 —— 早先把序号当列用，九格挤成一条还多出一个 0 格。 */
    var FLIGHT = [
      [4, 0, 0], [9, 1, 0], [2, 2, 0],
      [3, 0, 1], [5, 1, 1], [7, 2, 1],
      [8, 0, 2], [1, 1, 2], [6, 2, 2]
    ];
    var gx = 366, gy = 58, cell = 40;
    var grid = FLIGHT.map(function (f) {
      var n = f[0], col = f[1], row = f[2];
      var val = star[n + '宫'];
      var color = STAR_COLOR[n] || '#c8b083';
      var bx = gx + col * cell, by = gy + row * cell;
      return '<g data-flying-star="' + n + '">' +
        '<rect class="xext-wv-cell" x="' + px(bx) + '" y="' + px(by) + '" width="' + (cell - 4) +
        '" height="' + (cell - 4) + '" rx="6"/>' +
        txt(bx + (cell - 4) / 2, by + 15, n + '宫', { size: 8, fill: '#7d8ba1', anchor: 'middle' }) +
        txt(bx + (cell - 4) / 2, by + 32, val == null ? '—' : String(val),
          { size: 14, fill: color, anchor: 'middle' }) +
        '</g>';
    }).join('');

    var head = txt(28, 26, (one(r['八卦方位']) || '—') + '　坐 ' + (one(r['坐山']) || '—') +
      '　向 ' + (one(r['朝向']) || '—'), { size: 12, fill: '#e8cf96' }) +
      txt(gx + 44, 28, '年度九星（顺飞）', { size: 11, fill: '#c6b083' }) +
      txt(gx + 44, 42, '中心星 ' + (one(r['年度中心星']) || '—'),
        { size: 10, fill: '#9fb0c8' });

    var foot = txt(28, H - 14, one(r['年度口径']) || one(r['口径']) ||
      '按所选角度分区呈现；临界角需复测，不据此断住宅吉凶。', { size: 10, fill: '#7d8ba1' });

    return svg(W, H, head + frame + ring + pointer + grid + foot, '二十四山与年度九星');
  }

  /* ---------- 六爻卦象 ---------- */

  function liuyaoHexagram(result) {
    var r = (result && typeof result === 'object') ? result : {};
    var yaos = Array.isArray(r['yaos']) ? r['yaos'].slice() : [];
    yaos.sort(function (a, b) { return num(a && a.pos, 0) - num(b && b.pos, 0); });

    var W = 520, H = 320, left = 20, barW = 200, gapX = 8;
    var baseY = H - 44, stepY = 34;

    var lines = yaos.map(function (y, i) {
      var yy = baseY - i * stepY;
      var moving = !!y['moving'];
      var shen = y['isShi'] ? '世' : (y['isYou'] ? '应' : '');
      var color = moving ? '#d97a52' : '#e8cf96';
      var segs = '';
      if (moving) {
        /* 老阴／老阳：画成断开的两段 */
        var half = (barW - gapX) / 2;
        segs = '<rect x="' + px(left) + '" y="' + px(yy - 9) + '" width="' + px(half) + '" height="12" rx="3" fill="' + color + '"/>' +
          '<rect x="' + px(left + half + gapX) + '" y="' + px(yy - 9) + '" width="' + px(half) + '" height="12" rx="3" fill="' + color + '"/>';
      } else {
        segs = '<rect x="' + px(left) + '" y="' + px(yy - 9) + '" width="' + px(barW) + '" height="12" rx="3" fill="' + color + '"/>';
      }
      var attrs = ' data-yao="' + num(y['pos'], i + 1) + '"' +
        (y['isShi'] ? ' data-shi="' + num(y['pos'], i + 1) + '"' : '') +
        (y['isYou'] ? ' data-you="' + num(y['pos'], i + 1) + '"' : '') +
        (moving ? ' data-moving="' + num(y['pos'], i + 1) + '"' : '') +
        (y['fushen'] ? ' data-fushen="' + esc(y['fushen']['ganZhi'] == null ? '' : String(y['fushen']['ganZhi'])) + '"' : '');
      var info = txt(left + barW + 14, yy + 1, String(y['posName'] || ('第' + (i + 1) + '爻')) +
        '　' + one(y['ganZhi']) + '　' + one(y['liuqin']) +
        (shen ? '　' + shen : ''), { size: 11, fill: '#c8b083', anchor: 'start' });
      var chan = '';
      if (moving) {
        chan = txt(left + barW + 14, yy + 15, '→ ' + one(y['bianGanZhi']) +
          ' ' + one(y['bianLiuqin']) +
          (Array.isArray(y['motionRelations']) && y['motionRelations'].length
            ? '　' + y['motionRelations'].map(function (s) { return String(s); }).join('、') : ''),
          { size: 9, fill: '#d9a06a', anchor: 'start' });
      }
      /* 伏神排在爻题之后，不占卦体左侧 —— end 锚点配 x=14 会把文字顶出画布左缘。 */
      var fu = '';
      if (y['fushen']) {
        fu = txt(left + barW + 14, yy + 28, '伏 ' + one(y['fushen']['ganZhi']) +
          '　' + one(y['fushen']['liuqin']),
          { size: 9, fill: '#7f9ad8', anchor: 'start' });
      }
      return '<g' + attrs + '>' + segs + fu + info + chan + '</g>';
    }).join('');

    var head = txt(W / 2, 24, (one(r['gua']) || '—') +
      (r['changedName'] ? ' → ' + one(r['changedName']) : ''),
      { size: 14, fill: '#e8cf96', anchor: 'middle' });

    return svg(W, H, head + lines, '六爻卦象');
  }

  /* ---------- 紫微十二宫 ---------- */

  function ziweiGrid(result) {
    var r = (result && typeof result === 'object') ? result : {};
    var palaces = Array.isArray(r['palaces']) ? r['palaces'] : [];
    var byName = {};
    palaces.forEach(function (p) {
      if (p && p['name']) byName[String(p['name'])] = p;
    });

    var W = 520, H = 500, pad = 14, mid = 168;
    var cw = (W - pad * 2) / 4, ch = (H - pad * 2) / 4;

    /* 标准紫微盘式：地支顺时针排成一圈，寅起子顺，
       这里按 4×4 格摆放，中央留空给命身与局数。 */
    var LAYOUT = [
      ['巳', 0, 0], ['午', 1, 0], ['未', 2, 0], ['申', 3, 0],
      ['辰', 0, 1], [null, 1, 1], [null, 2, 1], ['酉', 3, 1],
      ['卯', 0, 2], [null, 1, 2], [null, 2, 2], ['戌', 3, 2],
      ['寅', 0, 3], ['丑', 1, 3], ['子', 2, 3], ['亥', 3, 3]
    ];

    var cells = LAYOUT.map(function (L) {
      var branch = L[0];
      if (!branch) return '';
      var p = null;
      Object.keys(byName).forEach(function (n) {
        if (String(byName[n]['branch']) === branch) p = byName[n];
      });
      var x = pad + L[1] * cw, y = pad + L[2] * ch;
      var name = p ? String(p['name']) : '';
      var stars = p && Array.isArray(p['stars']) ? p['stars'] : [];
      var minor = p && Array.isArray(p['minor']) ? p['minor'] : [];
      var range = p && Array.isArray(p['range']) && p['range'].length === 2
        ? num(p['range'][0], 0) + '-' + num(p['range'][1], 0) : '';
      var soul = p && String(p['branch']) === one(r['ming']);
      var body = p && String(p['branch']) === one(r['shen']);

      var attrs = ' data-palace="' + esc(name) + '" data-branch="' + esc(branch) + '"' +
        (range ? ' data-range="' + esc(range) + '"' : '') +
        (soul ? ' data-soul="' + esc(one(r['ming'])) + '"' : '') +
        (body ? ' data-body="' + esc(one(r['shen'])) + '"' : '');

      var inner = txt(x + 6, y + 13, branch + '　' + name, { size: 11, fill: '#c6b083', anchor: 'start' });
      inner += txt(x + cw - 6, y + 13, (soul ? '命 ' : '') + (body ? '身 ' : '') + (range || ''),
        { size: 8, fill: '#7d8ba1', anchor: 'end' });
      stars.forEach(function (s, i) {
        var mu = s && s['mutagen'] ? String(s['mutagen']) : '';
        var bright = s && s['brightness'] ? String(s['brightness']) : '';
        var tx = x + 6 + i * 54;
        /* 四化挂data-mutagen 而不是只画一个字：
           四化是要被单独核对的信息，不能只靠肉眼从星名旁边认出来。 */
        inner += '<g' + (mu ? ' data-mutagen="' + esc(mu) + '"' : '') + '>' +
          txt(tx, y + ch / 2, String(s && s['name'] ? s['name'] : ''),
            { size: 12, fill: mu ? '#e0c078' : '#f0dcb0', anchor: 'start' });
        /* 庙旺与四化是两回事。早先只在有四化时才画亮度，
           结果无四化的主星只剩一个光秃秃的名字 —— 亮度是独立信息。 */
        inner += txt(tx, y + ch / 2 + 13, bright,
          { size: 8, fill: '#9fb0c8', anchor: 'start' });
        if (mu) {
          inner += txt(tx, y + ch / 2 + 24, mu,
            { size: 9, fill: '#e0c078', anchor: 'start' });
        }
        inner += '</g>';
      });
      if (minor.length) {
        inner += txt(x + 6, y + ch - 16, minor.map(function (s) { return String(s); }).join(' '),
          { size: 8, fill: '#9fb0c8', anchor: 'start' });
      }

      return '<g' + attrs + '>' +
        '<rect class="xext-wv-cell" x="' + px(x) + '" y="' + px(y) + '" width="' + px(cw - 4) +
        '" height="' + px(ch - 4) + '" rx="8"/>' + inner + '</g>';
    }).join('');

    var center = txt(W / 2, H / 2 - 26, one(r['fiveElementsClass']),
      { size: 16, fill: '#e8cf96', anchor: 'middle' }) +
      txt(W / 2, H / 2, '命 ' + (one(r['ming']) || '—') +
        '　身 ' + (one(r['shen']) || '—'),
        { size: 12, fill: '#c6b083', anchor: 'middle' });

    return svg(W, H, cells + center, '紫微斗数十二宫');
  }

  /* ---------- 真太阳时四项分解 ---------- */

  function solarBars(result) {
    var r = (result && typeof result === 'object') ? result : {};
    var terms = [
      { key: 'civil', label: '民用时基准', value: 0 },
      { key: 'equationMinutes', label: '均时差', value: num(r['equationMinutes'], 0) },
      { key: 'longitudeMinutes', label: '经度时差', value: num(r['longitudeMinutes'], 0) },
      { key: 'offsetMinutes', label: '合计偏移', value: num(r['offsetMinutes'], 0) }
    ];
    var maxAbs = 0;
    terms.forEach(function (t) { maxAbs = Math.max(maxAbs, Math.abs(t.value)); });
    if (maxAbs <= 0) maxAbs = 1;

    var W = 520, H = 300, left = 108, cx = W - 160, half = 90, rowH = 42, top = 52;
    var bars = terms.map(function (t, i) {
      var y = top + i * rowH;
      var w = Math.abs(t.value) / maxAbs * half;
      var sign = t.value < 0 ? -1 : (t.value > 0 ? 1 : 0);
      var bx = sign < 0 ? cx - w : cx;
      var color = sign < 0 ? '#8ad0d8' : (sign > 0 ? '#e0c078' : '#7d8ba1');
      return '<g data-term="' + esc(t.key) + '" data-sign="' + sign + '"' +
        ' data-w="' + px(w) + '">' +
        txt(left - 8, y + 4, t.label, { size: 11, fill: '#c6b083', anchor: 'end' }) +
        (w > 0.5
          ? '<rect x="' + px(bx) + '" y="' + px(y - 9) + '" width="' + px(w) + '" height="16" rx="3" fill="' + color + '"/>'
          : '') +
        txt(W - 16, y + 4, (sign > 0 ? '+' : '') + t.value.toFixed(2) + ' 分', { size: 10, fill: color, anchor: 'end' }) +
        '</g>';
    }).join('');

    var axis = '<line x1="' + px(cx) + '" y1="' + px(top - 16) + '" x2="' + px(cx) +
      '" y2="' + px(top + terms.length * rowH - 12) + '" stroke="#4a5a70"/>' +
      txt(cx, top - 20, '0', { size: 9, fill: '#7d8ba1', anchor: 'middle' });

    var head = txt(W / 2, 22, '真太阳时校正分解', { size: 13, fill: '#e8cf96', anchor: 'middle' }) +
      txt(W / 2, 40, '民用时 ' + [r['hour'], r['minute']].map(function (x) {
        return x == null ? '--' : String(x).padStart(2, '0');
      }).join(':') + '　经度 ' + (one(r['longitude']) || '—') +
      '　时区 ' + (one(r['zone']) || '—'),
        { size: 10, fill: '#9fb0c8', anchor: 'middle' });

    var foot = txt(16, H - 28, one(r['formula']) || '真太阳时≈民用时+4×经度−60×时区+均时差',
      { size: 9, fill: '#7d8ba1' }) +
      txt(16, H - 12, one(r['accuracy']) || '均时差为近似值，精度不应被夸大',
        { size: 9, fill: '#7d8ba1' });

    return svg(W, H, head + axis + bars + foot, '真太阳时校正分解');
  }

  /* ---------- 统一入口 ---------- */

  var KINDS = {
    qimen: qimenPan,
    liuren: liurenPlate,
    taiyi: taiyiPan,
    astronomy: astroChart,
    fengshui: fengshuiRose,
    liuyao: liuyaoHexagram,
    ziwei: ziweiGrid,
    solar: solarBars
  };

  function render(kind, data) {
    if (!kind) return null;
    var fn = KINDS[String(kind)];
    if (!fn) return null;
    return fn(data);
  }

  root.WorkbenchViz = {
    qimenPan: qimenPan,
    liurenPlate: liurenPlate,
    taiyiPan: taiyiPan,
    astroChart: astroChart,
    fengshuiRose: fengshuiRose,
    liuyaoHexagram: liuyaoHexagram,
    ziweiGrid: ziweiGrid,
    solarBars: solarBars,
    render: render,
    KINDS: KINDS
  };
})(typeof window !== 'undefined' ? window : globalThis);