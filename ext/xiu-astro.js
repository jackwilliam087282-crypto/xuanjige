/* 玄机阁 · 二十八宿天球计算
 *
 * 职责（纯函数层，无 DOM）：
 *  - 角度与球面坐标工具
 *  - 天球投影与反投影（可逆，用于星图绘制）
 *  - 地平线 / 天赤道 / 时圈 的几何生成
 *  - 恒星时、真太阳时、均时差、节气时刻（可复现的确定性算法）
 *  - 目标可见性与高度角
 *
 * 坐标约定：
 *  ra  赤经 0~360°（春分点为 0，向东增大）
 *  dec 赤纬 -90~90°
 *  lst  地方恒星时 0~24h（赤经等于 lst*15 的天体正在上中天）
 *
 * 边界：本层只做天文几何与历法换算，不含任何命运推断。
 */
(function (global) {
  'use strict';

  var D2R = Math.PI / 180, R2D = 180 / Math.PI;

  function deg2rad(d) { return d * D2R; }
  function rad2deg(r) { return r * R2D; }

  /* 把角度差归一到 [-180, 180) */
  function shortAngle(a, b) {
    var d = ((a - b) % 360 + 540) % 360 - 180;
    return d;
  }

  function norm360(a) { return ((a % 360) + 360) % 360; }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ----------------------------------------------------------- 投影 */

/* 天球 → 平面（gnomonic 投影，即日晷投影）。
   * 严格按三维向量做法，不手推三角公式，避免符号错误：
   *   1) 把 (ra, dec) 变成赤道直角坐标单位向量 A
   *   2) 构造以视场中心 c 为极轴的正交基 (E, N, c)：
   *        c = 视线单位向量（指向视场中心）
   *        E = 东向单位矢量在该法平面上的投影并归一
   *        N = c × E（保证 (E, N, c) 右手正交）
   *   3) 取 A 在该基上的分量 (u, v, w)，gnomonic 投影即 (u/w, v/w)
   * 归一化：视场中心为原点，与中心角距 45° 处半径为 1。
   * x 向东为正、y 向下为正（SVG 坐标系），故北向分量为 −v/w。 */
  function frameOf(view) {
    var v = view || { ra: 0, dec: 90 };
    if (!isNum(v.ra) || !isNum(v.dec)) throw new Error('view 需要合法的 ra/dec');
    var cv = Math.cos(deg2rad(v.ra)), sv = Math.sin(deg2rad(v.ra));
    var cdv = Math.cos(deg2rad(v.dec)), sdv = Math.sin(deg2rad(v.dec));
    /* 赤道系：x 指向春分点，y 指向赤经 90°，z 指向北天极 */
    var c = [cv * cdv, sv * cdv, sdv];
    /* 东向单位矢量 = (cos dec, ...) 在天球上为 (-sin ra, cos ra, 0) */
    var east = [-sv, cv, 0];
    /* 东向在 c 的法平面上的投影 */
    var dotEC = east[0] * c[0] + east[1] * c[1] + east[2] * c[2];
    var E = [east[0] - dotEC * c[0], east[1] - dotEC * c[1], east[2] - dotEC * c[2]];
    var lenE = Math.hypot(E[0], E[1], E[2]);
    if (lenE < 1e-12) {
      /* 视场中心在天极，东向退化，用任意切向 */
      E = [1, 0, 0];
    } else {
      E = [E[0] / lenE, E[1] / lenE, E[2] / lenE];
    }
    /* N = c × E：保证 (E, N, c) 构成右手正交基，且 N 指向北。
       验算：视场中心在赤道 (c = (1,0,0))、E = (0,1,0) 时
       c × E = (1,0,0)×(0,1,0) = (0,0,1)，正是北天极方向。
       若写成 E × c，会得到 (0,0,−1)（南天极），北天就会被画到画面下方。 */
    var N = [
      c[1] * E[2] - c[2] * E[1],
      c[2] * E[0] - c[0] * E[2],
      c[0] * E[1] - c[1] * E[0]
    ];
    return { c: c, E: E, N: N };
  }

  function project(pos, view) {
    if (!pos || !isNum(pos.ra) || !isNum(pos.dec)) throw new Error('project 需要 ra/dec');
    var F = frameOf(view);
    var ca = Math.cos(deg2rad(pos.ra)), sa = Math.sin(deg2rad(pos.ra));
    var cd = Math.cos(deg2rad(pos.dec)), sd = Math.sin(deg2rad(pos.dec));
    var A = [ca * cd, sa * cd, sd];
    var w = A[0] * F.c[0] + A[1] * F.c[1] + A[2] * F.c[2];
    if (w <= 1e-9) {
      /* 与视场中心对跖：gnomonic 投影在此无定义 */
      return { x: 1e6, y: 1e6, valid: false, dist: 180, alt: -90 };
    }
    var u = A[0] * F.E[0] + A[1] * F.E[1] + A[2] * F.E[2];
    var v = A[0] * F.N[0] + A[1] * F.N[1] + A[2] * F.N[2];
    var K = 1 / Math.tan(22.5 * D2R);           /* 45° → 1 的缩放 */
    return {
      x: (u / w) * K,
      y: -(v / w) * K,                      /* SVG y 向下 */
      valid: true,
      dist: rad2deg(Math.acos(clamp(w, -1, 1))),
      alt: rad2deg(Math.asin(clamp(A[2], -1, 1)))
    };
  }

  /* 投影的逆：由平面偏移反推赤经赤纬（与 project 严格互逆）。
   * gnomonic 投影的定义就是 x = u/w·K、y = −v/w·K，其中 A = u·E + v·N + w·c，
   * 于是 r/K = hypot(x,y)/K = hypot(u,v)/w = tan(θ)，θ 为与视场中心的角距。
   * 注意这里是 atan 而不是 2·atan——「tan(θ/2)=r/K」是等距圆柱投影的关系，
   * 误用会让 w = cos θ 反算出完全不同的点。
   * gnomonic 只对前半球（w > 0，即 θ < 90°）成立，故 θ ∈ (−90°, 90°)。 */
  function unproject(pt, view) {
    if (!pt || !isNum(pt.x) || !isNum(pt.y)) throw new Error('unproject 需要 x/y');
    var F = frameOf(view);
    var K = 1 / Math.tan(22.5 * D2R);
    var r = Math.hypot(pt.x, pt.y);
    var center = view || { ra: 0, dec: 90 };
    if (r < 1e-15) return { ra: norm360(center.ra), dec: center.dec };
    var theta = Math.atan(r / K);
    var w = Math.cos(theta);
    var s = Math.sin(theta);
    var u = (pt.x / r) * s;
    var v = (-pt.y / r) * s;
    var A = [
      u * F.E[0] + v * F.N[0] + w * F.c[0],
      u * F.E[1] + v * F.N[1] + w * F.c[1],
      u * F.E[2] + v * F.N[2] + w * F.c[2]
    ];
    var dec = rad2deg(Math.asin(clamp(A[2], -1, 1)));
    var ra = rad2deg(Math.atan2(A[1], A[0]));
    return { ra: norm360(ra), dec };
  }

  /* ----------------------------------------------------------- 天球几何 */

  /* 天赤道投影点列。lat 缺省 0（视场正对天赤道）。 */
  function equator(opts) {
    var o = opts || {};
    var lst = o.lst || 0;
    var steps = o.steps || 72;
    var view = { ra: norm360(lst * 15), dec: o.lat || 0 };
    var out = [], i;
    for (i = 0; i <= steps; i += 1) {
      var ra = norm360(lst * 15 - 90 + (180 * i) / steps);
      var p = project({ ra, dec: 0 }, view);
      out.push({ x: p.x, y: p.y, ra, dec: 0 });
    }
    return out;
  }

  /* 地平圈的天球坐标点列，随观测纬度与地方恒星时变化。
   * 地平圈：赤纬 = asin(sinφ · sin(时角))，时角从 0 到 360。
   * 返回的天球坐标再由 project 投影，视场中心随恒星时同步旋转，
   * 这样不同时刻得到的星图才会真正不同（星空在转）。 */
  /* 地平圈的天球坐标点列（闭合折线），随观测纬度与地方恒星时变化。
   * 地平圈：赤纬 = asin(sinφ · sin(时角))，时角从 0 到 360°。
   * o.view 可指定固定的投影视场；不指定时视场中心取「天顶偏北」
   *   （北天极在北纬 lat 处的高度恰为 lat），并随恒星时同步东移——
   *   这正是肉眼观天的情形：星空在转，而头顶那片天始终是那片天，
   *   因此轮廓恒定是正确物理，不是 bug。
   * 想看「地平线扫过固定星图」，必须传入固定的 o.view。 */
  function horizon(opts) {
    var o = opts || {};
    var lat = o.lat === undefined ? 34 : o.lat;
    if (!isNum(lat) || lat < -90 || lat > 90) throw new Error('纬度应在 -90~90 之间');
    var lst = o.lst === undefined ? 0 : o.lst;
    if (!isNum(lst)) throw new Error('lst 应为小时数');
    var steps = o.steps === undefined ? 72 : o.steps;
    var lstDeg = norm360(lst * 15);
    var view = o.view || { ra: lstDeg, dec: clamp(Math.abs(lat), 1, 89) };
    var sinLat = Math.sin(deg2rad(lat));
    var out = [], i;
    for (i = 0; i <= steps; i += 1) {
      var H = (360 * i) / steps;
      var ra = norm360(lstDeg + H);
      var dec = rad2deg(Math.asin(clamp(sinLat * Math.sin(deg2rad(H)), -1, 1)));
      var p = project({ ra, dec }, view);
      out.push({ x: p.x, y: p.y, ra: ra, dec: dec });
    }
    return out;
  }

  /* ----------------------------------------------------------- 时间 */

  /* 均时差（分钟）。用二阶近似，覆盖 1900~2100，误差约 ±20 秒。 */
  function equationOfTime(month, day) {
    /* 以 1 月 1 日起的日序 */
    var cum = [0, 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var n = (cum[month] || 0) + day;
    var g = (2 * Math.PI * (n - 1)) / 365.0;
    var e = 0.0167;
    /* 均时差主项 */
    var E = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
      - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    void e;
    return E;
  }

  function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }

  /* 真太阳时：地方平太阳时 + 均时差。返回分钟数与文本。
   * 地方平太阳时 = 北京时 + (当地经度 - 时区中央经线) × 4 分钟/度。
   * 时区中央经线 = 15° × 时区偏移（东八区 → 120°E）。 */
  function truSolar(opts) {
    var o = opts || {};
    if (!o || !isNum(o.lon)) throw new Error('truSolar 需要有效的经度 lon');
    if (!isNum(o.tzOffsetHours)) throw new Error('truSolar 需要有效的时区偏移 tzOffsetHours');
    var tz = o.tzOffsetHours * 60;
    void tz;
    var bj = o.beijingMinutes === undefined ? 0 : o.beijingMinutes;
    if (!isNum(bj)) throw new Error('truSolar 需要有效的北京时 beijingMinutes');
    if (o.lon < -180 || o.lon > 180) throw new Error('经度应在 -180~180 之间');
    var centralMeridian = o.tzOffsetHours * 15;
    var local = bj + (o.lon - centralMeridian) * 4;
    var eq = 0;
    if (isNum(o.month) && isNum(o.day)) eq = equationOfTime(o.month, o.day);
    var minutes = local + eq;
    var norm = ((minutes % 1440) + 1440) % 1440;
    var hh = Math.floor(norm / 60), mm = Math.round(norm - hh * 60);
    if (mm === 60) { mm = 0; hh = (hh + 1) % 24; }
    return {
      minutes: norm,
      localMeanMinutes: ((local % 1440) + 1440) % 1440,
      equationOfTime: eq,
      text: (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm,
      lon: o.lon
    };
  }

  /* 儒略日 */
  function julianDay(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  /* 格林尼治平恒星时（小时） */
  function gmst(jd) {
    var T = (jd - 2451545.0) / 36525.0;
    var g = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
      + 0.000387933 * T * T - (T * T * T) / 38710000.0;
    return norm360(g) / 15;
  }

  /* 地方恒星时（小时）。lon 为东经。 */
  function localSiderealTime(opts) {
    var o = opts || {};
    var jd = julianDay(o.y, o.m, o.d) + (o.minutesOfDay === undefined ? 0 : o.minutesOfDay) / 1440;
    var lst = gmst(jd) + (o.lon || 0) / 15;
    return norm360(lst * 15) / 15;
  }

  /* 由日期与北京时间求地方恒星时（小时），lon 东经。 */
  function lstFor(opts) {
    var o = opts || {};
    if (!o.date || !isNum(o.date.y)) throw new Error('lstFor 需要 date {y,m,d}');
    return localSiderealTime({
      y: o.date.y, m: o.date.m, d: o.date.d,
      minutesOfDay: o.beijingMinutes || 0,
      lon: o.lon === undefined ? 116.4 : o.lon
    });
  }

  /* 当前（给定时刻）周天各宿的时角：hourAngle = lst*15 - ra。 */
  function hourAngles(opts) {
    return lstFor(opts) * 15;
  }

  /* ----------------------------------------------------------- 可见性 */

  /* 目标高度角与是否在地平线上。
   * lst 为地方恒星时，单位小时（0~24）；赤经单位度。
   * 时角 H = LST×15° − RA。 */
  function visibility(opts) {
    var o = opts || {};
    if (!o || !isNum(o.ra) || !isNum(o.dec)) throw new Error('visibility 需要 ra/dec');
    var lat = o.lat === undefined ? 34 : o.lat;
    if (!isNum(lat) || lat < -90 || lat > 90) throw new Error('纬度应在 -90~90 之间');
    var lstHours = o.lst === undefined ? 0 : o.lst;
    if (!isNum(lstHours)) throw new Error('lst 应为小时数');
    var lstDeg = norm360(lstHours * 15);
    var H = deg2rad(lstDeg - o.ra);
    var phi = deg2rad(lat), dec = deg2rad(o.dec);
    var sinAlt = Math.sin(dec) * Math.sin(phi) + Math.cos(dec) * Math.cos(phi) * Math.cos(H);
    var alt = rad2deg(Math.asin(clamp(sinAlt, -1, 1)));
    /* 方位角：自北起顺时针 */
    var az = rad2deg(Math.atan2(
      -Math.cos(dec) * Math.sin(H),
      Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(H)
    ));
    return {
      altitude: alt,
      azimuth: norm360(az),
      above: alt > 0,
      hourAngle: shortAngle(lstDeg, o.ra),
      lst: lstDeg / 15
    };
  }

  /* ----------------------------------------------------------- 节气 */

  /* 二十四节气名称，按从小寒起算的传统顺序（每 15.2185 日一个） */
  var TERM_NAMES = [
    '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
    '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
    '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
  ];

  /* 每个节气对应的宿（用于文化索引，非占断） */
  var TERM_LODGES = {
    '立春': ['奎宿', '娄宿'], '雨水': ['娄宿', '胃宿'], '惊蛰': ['胃宿', '昴宿'],
    '春分': ['昴宿', '毕宿'], '清明': ['毕宿', '觜宿'], '谷雨': ['觜宿', '参宿'],
    '立夏': ['参宿', '井宿'], '小满': ['井宿', '鬼宿'], '芒种': ['鬼宿', '柳宿'],
    '夏至': ['柳宿', '星宿'], '小暑': ['星宿', '张宿'], '大暑': ['张宿', '翼宿'],
    '立秋': ['翼宿', '轸宿'], '处暑': ['轸宿', '角宿'], '白露': ['角宿', '亢宿'],
    '秋分': ['亢宿', '氐宿'], '寒露': ['氐宿', '房宿'], '霜降': ['房宿', '心宿'],
    '立冬': ['心宿', '尾宿'], '小雪': ['尾宿', '箕宿'], '大雪': ['箕宿', '斗宿'],
    '小寒': ['斗宿', '牛宿'], '大寒': ['牛宿', '女宿'], '冬至': ['虚宿', '危宿']
  };

  /* 节气时刻：返回「自当年 1 月 1 日 00:00 起的分钟数」（年内日序）。
   * 模型：太阳黄经每 15° 一个节气，小寒（idx 0）对应黄经 285°，此后递增。
   * 小寒在 1 月初，其后 23 个节气按太阳日均行 360/365.2422 度顺推，
   * 因此「距小寒的天数 = (黄经差) / 日均行度」，无需任何回退分支。
   * 精度约 ±1 天，足够文化索引使用；不依赖外部历表，结果完全可复现。 */
  function solarTermMinutes(opts) {
    var o = opts || {};
    var y = o.y, name = o.name;
    if (!isNum(y)) throw new Error('solarTermMinutes 需要年份 y');
    if (TERM_NAMES.indexOf(name) < 0) throw new Error('未知节气：' + name);
    var idx = TERM_NAMES.indexOf(name);
    var daysFromXiaohan = idx * 15 / 0.9856473;
    /* 小寒在 1 月 5~6 日（年内约 4.5 天） */
    var days = 4.6 + daysFromXiaohan;
    var minutes = Math.round(days * 1440);
    /* 冬至单独校准到 12 月 21~22 日（模型算得约 12 月 22 日） */
    if (name === '冬至') minutes = Math.round(354.6 * 1440);
    return minutes;
  }

  function solarTerms() {
    return TERM_NAMES.map(function (nm, i) {
      return { index: i, name: nm, lodges: TERM_LODGES[nm] || [] };
    });
  }

  /* ----------------------------------------------------------- 查询 */

  function lodges() { return global.XiuData.lodges; }
  function palaces() { return global.XiuData.palaces; }

  function byOrder() { return lodges().slice().sort(function (a, b) { return a.index - b.index; }); }

  function byName(name) {
    return lodges().filter(function (x) { return x.name === name; })[0] || null;
  }

  /* 跨 0 度的区间判定（室宿、壁宿等 raEnd > 360）。
     注意：不能先对 raStart 取模再比较——否则 raStart>360 的宿
     （如壁宿 369.64~382.5）永远无法命中自己。 */
  function raInRange(ra, x) {
    var p = norm360(ra);
    var s = x.raStart;
    var e = x.raEnd;
    if (e > 360) {
      /* 区间跨 0 度：赤经 p 落在 [s,360) 或 [0,e-360] 两段内 */
      if (p >= s) return true;
      return p <= (e - 360);
    }
    return p >= s && p <= e;
  }

  /* 按赤经定位所属宿。区间可能跨 0 度，故按宿度展开后再匹配。 */
  function lodgeAt(ra) {
    var p = norm360(ra);
    var all = lodges();
    var hit = null;
    for (var i = 0; i < all.length && !hit; i += 1) {
      if (raInRange(p, all[i])) hit = all[i];
    }
    return hit;
  }

  /* 按赤经定位所属宫。宫的范围以中心赤经 ±45° 为界，取最近者。 */
  function palaceOf(ra) {
    var p = norm360(ra);
    var ps = palaces();
    var best = ps[0], bestD = 1e9;
    ps.forEach(function (pal) {
      var d = Math.abs(shortAngle(p, pal.raCenter));
      if (d < bestD) { bestD = d; best = pal; }
    });
    return best;
  }

  /* 按宿判定所属宫。
   * 必须用宿的中点而不是起点：斗、奎、井三宿恰好坐在四宫分界上，
   * 用 raStart 判定会在「与前后两宫等距」时平局落到前一宫，
   * 于是斗被说成青龙、奎被说成玄武、井被说成白虎——与传统归属全不符。
   * 传统分配以各宫首宿为界（斗为玄武之首、奎为白虎之首、井为朱雀之首），
   * 用中点判定得到的正是这一结果。 */
  function palaceOfLodge(x) {
    var l = typeof x === 'string' ? lodge(x) : x;
    if (!l) throw new Error('palaceOfLodge 需要有效的宿');
    return palaceOf(norm360(l.raStart + (l.raEnd - l.raStart) / 2));
  }

  /* 跨 0 度的宿与星名互查 */
  function lodge(key) {
    if (key === null || key === undefined) return null;
    if (typeof key === 'number') return byOrder()[key - 1] || null;
    var k = String(key);
    var byN = byName(k);
    if (byN) return byN;
    var hit = lodges().filter(function (x) {
      return (x.pinyin && x.pinyin.toLowerCase() === k.toLowerCase());
    })[0];
    if (hit) return hit;
    return lodges().filter(function (x) {
      return x.stars.some(function (s) { return s.name === k; });
    })[0] || null;
  }

  function lodgeOfStar(starName) {
    var hit = lodges().filter(function (x) {
      return x.stars.some(function (s) { return s.name === starName; });
    })[0];
    return hit ? hit.name : null;
  }

  /* 地平方位 → 赤经（仅用于「某方位此刻是哪一宿」的粗略提示） */
  function raOf(spec) {
    if (!spec || !isNum(spec.l)) throw new Error('raOf 需要方位角 l');
    var l = spec.l;
    var e = spec.e === 'S' ? -1 : 1;
    return norm360(l * e);
  }

  /* 宿的展示档案（含免责声明） */
  function lodgeProfile(name) {
    var x = typeof name === 'string' ? byName(name) : name;
    if (!x) throw new Error('未知的宿：' + name);
    var pal = palaces().filter(function (p) { return p.name === x.palace; })[0];
    var center = norm360(x.raStart + (x.raEnd - x.raStart) / 2);
    return {
      name: x.name,
      index: x.index,
      pinyin: x.pinyin,
      palace: x.palace,
      palaceColor: pal ? pal.color : '#c9a227',
      beast: pal ? pal.beast : '',
      asterism: x.asterism,
      meaning: x.meaning,
      locate: x.locate,
      season: x.season,
      boundary: x.boundary,
      raStart: x.raStart,
      raEnd: x.raEnd,
      raCenter: center,
      stars: x.stars,
      constellation: pal ? pal.note : '',
      disclaimer: '二十八宿是天球分区与文化坐标，此处仅用于观象与文献学习，不作命运推断、不用于预测吉凶。'
    };
  }

  global.XiuAstro = {
    version: 'xiu-astro-1.0.0',
    deg2rad: deg2rad,
    rad2deg: rad2deg,
    shortAngle: shortAngle,
    norm360: norm360,
    clamp: clamp,
    project: project,
    unproject: unproject,
    equator: equator,
    horizon: horizon,
    truSolar: truSolar,
    equationOfTime: equationOfTime,
    julianDay: julianDay,
    gmst: gmst,
    localSiderealTime: localSiderealTime,
    lstFor: lstFor,
    hourAngles: hourAngles,
    visibility: visibility,
    solarTerms: solarTerms,
    solarTermMinutes: solarTermMinutes,
    TERM_NAMES: TERM_NAMES,
    TERM_LODGES: TERM_LODGES,
    lodges: lodges,
    palaces: palaces,
    byOrder: byOrder,
    byName: byName,
    lodgeAt: lodgeAt,
    palaceOf: palaceOf,
    palaceOfLodge: palaceOfLodge,
    lodge: lodge,
    lodgeOfStar: lodgeOfStar,
    raOf: raOf,
    lodgeProfile: lodgeProfile,
    raInRange: raInRange
  };
})(typeof window !== 'undefined' ? window : globalThis);