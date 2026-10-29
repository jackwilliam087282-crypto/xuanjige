/* 玄机阁 · 星空视图
 *
 * 职责边界（重要）：
 *  - 本模块只做「天球坐标 → 画面坐标」的投影与视图状态（视场中心、缩放、拖拽），
 *    不生成 SVG 字符串、不碰 DOM 事件绑定、不做任何命理判断。
 *    生成标记与文案在 xiu-ui.js，方便两者各自独立测试。
 *  - 投影采用 gnomonic（日晷投影）：大圆映成直线，是天文观测与星图的
 *    标准画法。全视场半角 45°，与视场中心角距 45° 处半径恰为 1（归一化基准）。
 *  - 本模块不引入随机数，同样的输入必得同样的输出，可复现、可截图比对。
 */
(function (global) {
  'use strict';

  var Xiu = global.XiuAstro;

  /* 归一化基准：与视场中心角距 22.5° 处，屏幕半径为短边的 1/2。
       这个基准来自 xiu-astro.js 的 K = 1/tan(22.5°)：
       gnomonic 投影下 r = K·tan(θ)，故 θ = 22.5° 时 r 恰为 1，
       对应 ±22.5° 的可视半视场（约 45° 视场直径），与肉眼广角观天的范围相当。
       注意基准是 22.5° 而不是 45°——早先按 45° 理解会让所有元素放大一倍。 */
  var HALF_FOV_DEG = 22.5;

  /* 缩放上下限。太小会把整周天压进视口而失去「观测」的真实感；
     太大则投影在边缘急剧发散，宿主判定失去意义。 */
  var ZOOM_MIN = 0.5;
  var ZOOM_MAX = 4;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }

  function clampZoom(z) {
    if (!isNum(z)) return 1;
    return clamp(z, ZOOM_MIN, ZOOM_MAX);
  }

  /* 把 (ra, dec) 投到屏幕坐标。返回 visible=false 表示落在视场背面
     （gnomonic 无定义）或被裁出画面，调用方应直接剔除，不能当作可见点绘制。
     view 必须由调用方每次传入（或传一个读取实时状态的函数）：
     若在这里把视场中心一次性固化，拖拽就不会让星图跟着动——
     这正是初版实现犯过的错，pan 改了 state 而画面纹丝不动。 */
  function makeScreen(opts) {
    var o = opts || {};
    var w = isNum(o.width) ? o.width : 600;
    var h = isNum(o.height) ? o.height : 600;
    var cx = w / 2;
    var cy = h / 2;
    /* 归一化半径取「短边的一半」，与常见的星图软件一致：
       视场在短边方向恰好铺满，长边方向则留出余量。
       若按短边/4，横向只用到画布的四分之一，画面会空旷得难以使用——
       实机截图曾出现「网格全挤在中下部、上半屏空一大片」的缺陷。
       宿名贴边裁切也源于此：内容铺得太开，边缘标注就压到了画布边界。 */
    var R = Math.min(w, h) / 2;

    function screen(pos, view) {
      if (!pos || !isNum(pos.ra) || !isNum(pos.dec)) {
        return { x: NaN, y: NaN, visible: false };
      }
      var v = typeof view === 'function' ? view() : (view || o);
      var p = Xiu.project(pos, v);
      if (!p.valid) return { x: NaN, y: NaN, visible: false };
      var x = cx + p.x * R;
      var y = cy + p.y * R;
      /* 剔除阈值取归一化半径的 3 倍（角距约 50°），
         略宽于半个视场，让边缘星在拖拽时不至于突然消失。 */
      var lim = R * 3;
      var ok = isFinite(x) && isFinite(y) &&
        x > cx - lim && x < cx + lim && y > cy - lim && y < cy + lim;
      return { x: x, y: y, visible: ok, dist: p.dist };
    }

    screen.scale = R;
    screen.centerX = cx;
    screen.centerY = cy;
    return screen;
  }

  /* 星点半径按星等分级。
     视宁度（seeing）有限，星等每差 1 等，亮度差约 2.512 倍，肉眼可辨的
     直径差并不线性——经验上用 r = r0 · 10^(-0.16·mag) 才符合「暗星看着更小」的实际观感。 */
  function starSize(mag, opts) {
    var o = opts || {};
    var base = isNum(o.base) ? o.base : 5.4;
    var m = isNum(mag) ? mag : 3;
    return base * Math.pow(10, -0.16 * (m - 1));
  }

  /* 二十八宿的闭合宿带：沿天赤道均匀采样，每点归属到具体宿与宫。
     等分宿度使这一步完全可解析，不需要任何历表。 */
  function lodgeBand(opts) {
    var o = opts || {};
    var steps = isNum(o.steps) ? o.steps : 360;
    var out = [];
    for (var i = 0; i < steps; i += 1) {
      var ra = (360 * i) / steps;
      var lodge = Xiu.lodgeAt(ra);
      /* palaceOf 收的是赤经，不是宿名。传错参数会全部落到同一个宫上，
         表现为「四宫只认出一个」。 */
      var palace = lodge ? Xiu.palaceOfLodge(lodge) : null;
      out.push({
        ra: ra, dec: 0,
        lodge: lodge ? lodge.name : '',
        palace: palace ? palace.name : ''
      });
    }
    return out;
  }

  /* 宿带切分为 28 段可点选分区。跨界 0° 的宿（室宿、壁宿等）在此处
     被正确合并为一段——它们在 mod 360 意义上是连续的。
     采样必须落在段内而不能落在端点上：宿度区间两端都是闭区间，
     端点会同时属于相邻两宿，直接取端点会让段首被判成上一宿。 */
  function lodgeSegments(opts) {
    var o = opts || {};
    var each = isNum(o.each) ? o.each : 4;      /* 每宿细分数 */
    var out = [];
    global.XiuData.lodges.forEach(function (l) {
      var palace = Xiu.palaceOfLodge(l);
      var w = l.raEnd - l.raStart;
      var pts = [];
      for (var k = 0; k <= each; k += 1) {
        /* 首尾各内缩 0.5% 段宽，避开与相邻宿共用的端点 */
        var inset = k === 0 || k === each ? w * 0.005 : 0;
        var ra = l.raStart + (k === 0 ? inset : (k === each ? w - inset : (w * k) / each));
        pts.push({ ra: Xiu.norm360(ra), dec: 0, raw: ra });
      }
      out.push({
        lodge: l.name,
        pinyin: l.pinyin,
        index: l.index,
        palace: palace ? palace.name : '',
        palaceId: palace ? palace.id : '',
        raStart: l.raStart,
        raEnd: l.raEnd,
        points: pts,
        clickable: true,
        role: 'button',
        tabIndex: 0,
        ariaLabel: l.name + '（' + (palace ? palace.name : '') + '，第 ' + l.index + ' 宿）'
      });
    });
    return out;
  }

  /* 视口对象：持有视场状态与投影闭包，支持缩放与拖拽。 */
  function create(opts) {
    var o = opts || {};
    var state = {
      ra: isNum(o.ra) ? Xiu.norm360(o.ra) : 90,
      dec: isNum(o.dec) ? clamp(o.dec, -89.9, 89.9) : 0,
      zoom: clampZoom(o.zoom),
      lat: isNum(o.lat) ? o.lat : 34,
      lst: isNum(o.lst) ? o.lst : 0,
      width: isNum(o.width) ? o.width : 600,
      height: isNum(o.height) ? o.height : 600
    };

    /* screen 每次都读实时 state，pan/zoom 后画面才会跟着动 */
    var screen = makeScreen({ width: state.width, height: state.height });
    function currentView() { return { ra: state.ra, dec: state.dec }; }

    /* 拖拽：让天区严格跟随指针移动。
       实现方式是拿「当前视场中心」与「指针位移后的位置」分别反算回天球坐标，
       再把差值加到视场中心上。这样拖拽与投影严格互逆——手指按住哪颗星，
       那颗星就始终贴在手指下，不会出现拖动一段距离后星点滑走的廉价感。
       不采用「像素 × 固定度数」的近似，因为 gnomonic 投影在边缘是非线性的。 */
    function pan(dxPx, dyPx) {
      if (!isNum(dxPx) || !isNum(dyPx)) throw new Error('pan 需要有效的像素位移');
      var R = screen.scale;
      var view = currentView();
      var from = Xiu.unproject({
        x: (screen.centerX - screen.centerX) / R,
        y: (screen.centerY - screen.centerY) / R
      }, view);
      var to = Xiu.unproject({ x: dxPx / R, y: dyPx / R }, view);
      if (!from || !to) return state;
      /* 要把视场中心搬到 to 上，增量是 to.ra − from.ra，
         而 shortAngle(a, b) 返回 a − b，故此处要取负号。 */
      state.ra = Xiu.norm360(state.ra - Xiu.shortAngle(from.ra, to.ra));
      /* 把视场中心搬到 to 上，增量就是 to.dec − from.dec。
         屏幕 y 向下为正，往下拖时 to 的赤纬高于 from（把北边天区拉下来），
         故此处直接相加，不取负号。 */
      state.dec = clamp(state.dec + (to.dec - from.dec), -89.9, 89.9);
      return state;
    }

    /* 屏幕点 → 天球坐标。视场中心之外的点无法反算（gnomonic 只覆盖前半球），
       此时返回 null，由调用方决定「不拖动」而不是拖到错的地方。 */
    function unprojectScreen(px, py, view) {
      var p = Xiu.unproject({
        x: (px - screen.centerX) / screen.scale,
        y: (py - screen.centerY) / screen.scale
      }, view);
      if (!p || !isNum(p.ra) || !isNum(p.dec)) return null;
      return p;
    }
    void unprojectScreen;

    /* 缩放时以画面中心为锚点保持视场中心不变 */
    function zoomTo(z) {
      state.zoom = clampZoom(z);
      return state.zoom;
    }

    /* 标注：真实代表星 + 可见性。可见性按当前纬度与地方恒星时计算，
       用于在星图上区分「此刻在天上」与「此刻在地平线下」，
       两者是不同性质的信息，界面必须分开表达。 */
    function starAnnotations(opts2) {
      var oo = opts2 || {};
      var lat = isNum(oo.lat) ? oo.lat : state.lat;
      var lst = isNum(oo.lst) ? oo.lst : state.lst;
      var out = [];
      global.XiuData.lodges.forEach(function (l) {
        l.stars.forEach(function (s) {
          var p = screen({ ra: s.ra, dec: s.dec }, currentView());
          var vis = Xiu.visibility({ ra: s.ra, dec: s.dec, lat: lat, lst: lst });
          out.push({
            name: s.name,
            lodge: l.name,
            con: s.con,
            mag: s.mag,
            ra: s.ra,
            dec: s.dec,
            x: p.x, y: p.y,
            visible: p.visible,
            altitude: vis.altitude,
            above: vis.above,
            label: s.name
          });
        });
      });
      return out;
    }

    return {
      state: state,
      screen: function (pos) { return screen(pos, currentView()); },
      starSize: function (mag) { return starSize(mag, { base: Math.min(state.width, state.height) / 100 }); },
      starAnnotations: starAnnotations,
      pan: pan,
      zoomTo: zoomTo,
      setTime: function (lst) {
        if (!isNum(lst)) throw new Error('setTime 需要有效的地方恒星时（小时）');
        state.lst = ((lst % 24) + 24) % 24;
        return state.lst;
      },
      focus: function (ra, dec) {
        if (!isNum(ra)) throw new Error('focus 需要赤经');
        state.ra = Xiu.norm360(ra);
        state.dec = isNum(dec) ? clamp(dec, -89.9, 89.9) : state.dec;
        return state;
      }
    };
  }

  global.SkyView = {
    version: 'sky-view-1.0.0',
    HALF_FOV_DEG: HALF_FOV_DEG,
    ZOOM_MIN: ZOOM_MIN,
    ZOOM_MAX: ZOOM_MAX,
    clampZoom: clampZoom,
    starSize: starSize,
    makeScreen: makeScreen,
    lodgeBand: lodgeBand,
    lodgeSegments: lodgeSegments,
    create: create
  };
})(typeof window !== 'undefined' ? window : globalThis);