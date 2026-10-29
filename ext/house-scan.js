/* 玄机阁 · 勘宅神器 · 识别与勘算层（任务 #19）
 *
 * ============================ 这个文件解决什么问题 ============================
 * 旧版「户型空间实验室」要求用户手填每个房间的矩形坐标。量房师能填，
 * 普通业主填不了 —— 于是「几何全实算」这个优点，实际上没几个人用得上。
 * 这一版把入口换成**上传或拖入一张平面户型图**：
 *   1) inspect() 从图像像素里找出墙线、切出房间、量出尺寸（离线，不联网）；
 *   2) 用户在校正页微调（这是必须的，见下方「识别层的诚实边界」）；
 *   3) analyze() 在确认后的几何数据上出六项评分、缺角、动线、厨卫、
 *      改进计划，再叠一层二十四山与流年的方位文化标注。
 *
 * ============================ 识别层的诚实边界 ============================
 * 这一层**不做**「AI 看图断吉凶」，也**不假装**能读懂任何风格的图纸。
 * 它只认画得出来的东西：深色墙线围出的封闭区域。
 *   - 能做：轴对齐户型（绝大多数住宅施工图的画法）从位图里切出房间与外轮廓。
 *   - 不能做：斜墙、弧墙、非等比缩放、照片级透视照、低分辨率网图。
 * 所以每个识别结果都带 confidence，界面必须把它显示出来并提示人工校正 ——
 * 识别错了却假装对，比识别不了更危险。
 *
 * ============================ 坐标与朝向约定 ============================
 *  - 户型数据用数学坐标：原点左下，x 向右、y 向上，单位米。
 *  - 图像像素坐标：原点左上，x 向右、y 向下，单位像素，ppm = 像素/米。
 *  - 二十四山以正北为 0°、顺时针增大，与罗盘一致。
 *
 * ============================ 边界声明 ============================
 *  - 面积、采光、通风、动线、缺角、评分：几何实算，可追溯到坐标与阈值。
 *  - 二十四山、宅星、流年紫白：传统方位文化的索引与标注，**不据此断言
 *    宅居吉凶、人丁祸福、房价涨跌**。各家起例不同，本模块只呈现其中一种。
 */
(function (root) {
  'use strict';

  var EPS = 1e-9;

  /* ==================== 基础工具 ==================== */

  function num(v, dft) {
    var n = Number(v);
    return Number.isFinite(n) ? n : (dft === undefined ? 0 : dft);
  }

  function clamp(v, lo, hi) {
    if (!Number.isFinite(v)) return lo;
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function clamp01(v) { return clamp(v, 0, 1); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ==================== 二十四山 ====================
   * 每山 15°，自壬起（壬子癸丑艮寅甲卯乙辰巽巳丙午丁未坤申庚酉辛戌乾亥），
   * 这是三合罗盘的传统排法。以正北 0° 为基准：正北落在壬/子/癸三山中，
   * 故壬山中心 345°，癸山中心 0°，其余顺推。
   */
  var MOUNTAIN_NAMES = [
    '壬', '子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳',
    '丙', '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥'
  ];

  /* 每山 15°，以正北为 0° 顺时针。中心角 = 起始角 + 7.5。
     壬 337.5~352.5 → 中心 345；子 352.5~7.5 → 中心 0（跨 360）。
     【修正】早先这张表把「壬」写了两次、漏掉了「子」，
     于是 0° 被标成「壬山」——罗盘上正北的山名就错了。
     二十四山自壬起、壬子癸丑顺序不可错位。*/
  var MOUNTAINS = (function () {
    var out = [];
    for (var i = 0; i < 24; i += 1) {
      var center = (345 + i * 15) % 360;
      out.push({
        index: i,
        name: MOUNTAIN_NAMES[i],
        center: center,
        /* deg 与 center 同值：对外统一用 deg 表示「中心角」，
           免得调用方一会儿读 center 一会儿读 deg，混用时正北会差一山。 */
        deg: center,
        start: (center - 7.5 + 360) % 360,
        end: (center + 7.5) % 360,
        /* 三合：每四山为一组，乾坤艮巽为四生，坎离震兑为四正 */
        group: [0, 5, 10, 15, 20].indexOf(i) >= 0 ? '正' : '生'
      });
    }
    return out;
  })();

  function mountainAt(deg) {
    var d = ((num(deg) % 360) + 360) % 360;
    /* 中心角在 ±7.5 之内即属该山；0° 落在子（中心 0）*/
    var idx = Math.round(((d - 345) % 360 + 360) % 360 / 15) % 24;
    return MOUNTAINS[idx];
  }

  /* ==================== 洛书九宫 ====================
   * 戴九履一，左三右七，二四为肩，六八为足，五居中宫。
   * 方位按南上北下：离南九、坎北一、震东三、兑西七、
   * 巽东南四、坤西南二、艮东北八、乾西北六、中宫五。
   * 这九个数是九宫飞星的「地盘」，任何一张九宫图都得对上，
   * 对不上就不是洛书九宫，是随手画的格子。
   */
  var LUO_SHU = {
    N: 1, NE: 8, E: 3, SE: 4,
    S: 9, SW: 2, W: 7, NW: 6,
    center: 5
  };

  var PALACE_KEYS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'center'];

  var PALACE_CN = {
    N: '坎（北）', NE: '艮（东北）', E: '震（东）', SE: '巽（东南）',
    S: '离（南）', SW: '坤（西南）', W: '兑（西）', NW: '乾（西北）', center: '中宫'
  };

  var PALACE_DEG = {
    N: 0, NE: 45, E: 90, SE: 135,
    S: 180, SW: 225, W: 270, NW: 315, center: null
  };

  /* ==================== 八门 ====================
   * 传统洛书八门起例：休门坎北、景门离南、生门震东、开门兑西，
   * 巽东南天门、坤西南死门、艮东北伤门、乾西北杜门。
   * 八门按「后天八卦」的固定方位排布，不随流年转动 ——
   * 转动的是八宅的游年门，起例另有一套，这里不混用。
   */
  var BA_MEN = {
    N: '休门', NE: '伤门', E: '生门', SE: '天门',
    S: '景门', SW: '死门', W: '开门', NW: '杜门'
  };

  var DIRECTIONS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];

  function dirOf(deg) {
    var d = ((num(deg) % 360) + 360) % 360;
    return DIRECTIONS[Math.round(d / 45) % 8];
  }

  var FACING_CN = { N: '北', NE: '东北', E: '东', SE: '东南', S: '南', SW: '西南', W: '西', NW: '西北' };
  var FACING_ANGLE = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

  /* 朝向侧日照权重（北半球冬至日相对照度的近似）。
     这是经验系数，不是辐照计算，界面如实标注。 */
  var FACING_LIGHT = {
    N: 0.28, NE: 0.5, E: 0.82, SE: 0.9,
    S: 1.0, SW: 0.9, W: 0.82, NW: 0.5
  };
  var MAIN_WEIGHT = 2;   /* 主采光面（朝向侧）开口加倍计入 */

  /* ==================== 功能分类 ==================== */

  var KIND_GROUP = {
    living: 'living', balcony: 'living', dining: 'living', corridor: 'living',
    kitchen: 'cooking', utility: 'cooking',
    bedroom: 'sleep', kids: 'sleep', study: 'sleep', guest: 'sleep',
    bath: 'service', toilet: 'service', storage: 'service'
  };
  var GROUP_CN = { living: '起居', cooking: '餐厨', sleep: '卧寝', service: '辅助' };

  /* 各功能的面积参考区间（m²）。来源是住宅设计规范里常见的净面积下限与
     常见舒适值取中，用于「功能配比」评分。这些是**参考区间，不是标准条文**，
     结论里如实这样写。 */
  var KIND_TARGET = {
    living: [16, 30], dining: [8, 14], kitchen: [5, 10], bath: [3, 6],
    toilet: [1.6, 3], bedroom: [10, 18], kids: [8, 14], study: [6, 12],
    guest: [8, 14], storage: [3, 8], utility: [2, 5], balcony: [3, 8],
    corridor: [2, 8], other: [0, 999]
  };
  var KIND_CN = {
    living: '客厅', balcony: '阳台', dining: '餐厅', corridor: '走道',
    kitchen: '厨房', utility: '家政间', bedroom: '卧室', kids: '儿童房',
    study: '书房', guest: '客房', bath: '卫生间', toilet: '卫生间',
    storage: '储物', other: '其他'
  };

  /* ==================== 图像识别层 ==================== */

  /* 灰度：Rec.601 亮度。与 Otsu 阈值配合使用。 */
  function luma(data, i) {
    return 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2];
  }

  /* Otsu 全局阈值：把灰度直方图分成前景/背景两类，使类间方差最大。
     比固定阈值稳得多 —— 拍成灰底的图和纯白图纸的深浅完全不同。 */
  function otsu(gray) {
    var hist = new Array(256).fill(0);
    var i;
    for (i = 0; i < gray.length; i += 1) hist[Math.round(gray[i])] += 1;
    var total = gray.length;
    var sum = 0;
    for (i = 0; i < 256; i += 1) sum += i * hist[i];
    var sumB = 0, wB = 0, best = 0, thr = 128;
    for (i = 0; i < 256; i += 1) {
      wB += hist[i];
      if (wB === 0) continue;
      var wF = total - wB;
      if (wF === 0) break;
      sumB += i * hist[i];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = i; }
    }
    return thr;
  }

  /* 投影法找墙线：把「墙」像素按行/按列累加，超过阈值的行/列即为墙线位置。
     墙线比房间内部占比大得多，用「相对峰值比例」而非绝对值做阈值，
     这样整张图的墙画得很淡时也能找到。 */
  function projections(ink, W, H) {
    var rows = new Float64Array(H), cols = new Float64Array(W);
    var x, y;
    for (y = 0; y < H; y += 1) {
      var rs = 0;
      for (x = 0; x < W; x += 1) if (ink[y * W + x]) rs += 1;
      rows[y] = rs / W;
    }
    for (x = 0; x < W; x += 1) {
      var cs = 0;
      for (y = 0; y < H; y += 1) if (ink[y * W + x]) cs += 1;
      cols[x] = cs / H;
    }
    return { rows: rows, cols: cols };
  }

  /* 从投影里挑出墙线位置。返回像素坐标数组，已按相邻合并。
     合并的容差取墙厚的 2 倍：图纸上墙线常是 2~4 px 粗，
     逐个取会得到一串相邻像素当成多道墙。 */
  function pickLines(proj, size) {
    var vals = Array.prototype.slice.call(proj);
    var max = vals.reduce(function (a, b) { return Math.max(a, b); }, 0);
    /* 阈值取「峰值的 45%」：墙线那一行/列几乎贯穿整幅图，
       房间内部即使有家具线也不会这么长。 */
    var thr = max * 0.45;
    if (thr <= 0.02) return [];
    var hits = [];
    var i = 0;
    while (i < size) {
      if (vals[i] >= thr) {
        var j = i;
        while (j + 1 < size && vals[j + 1] >= thr) j += 1;
        hits.push({ from: i, to: j, mid: Math.round((i + j) / 2), v: vals[i] });
        i = j + 1;
      } else i += 1;
    }
    return hits;
  }

  /* 相邻墙线合并：两条线间距小于墙厚时视为同一道墙的厚度范围。 */
  function mergeLines(hits, minGap) {
    var out = [];
    hits.forEach(function (h) {
      var last = out[out.length - 1];
      if (last && h.mid - last.mid <= minGap) {
        last.to = h.to;
        last.mid = Math.round((last.mid + h.mid) / 2);
      } else out.push({ from: h.from, to: h.to, mid: h.mid, v: h.v });
    });
    return out;
  }

  /* 单元标记：把网格单元标成 0（无墙）或 1（有墙）。
     只取每道墙线中轴左右各 1 px 求和 —— 直接按整格判定会把
     贴着墙的房间整格都算成墙。 */
  function markWalls(ink, W, H, xL, yL) {
    var gw = xL.length, gh = yL.length;
    var wall = [];
    var gx, gy;
    for (gy = 0; gy < gh - 1; gy += 1) {
      var row = [];
      for (gx = 0; gx < gw - 1; gx += 1) row.push(0);
      wall.push(row);
    }
    /* 竖墙：占满 yL[gy]..yL[gy+1] */
    for (gx = 0; gx < gw - 1; gx += 1) {
      var xs = [xL[gx].mid - 1, xL[gx].mid, xL[gx].mid + 1].filter(function (v) { return v >= 0 && v < W; });
      for (gy = 0; gy < gh - 1; gy += 1) {
        var cnt = 0;
        for (var y = yL[gy].mid; y <= yL[gy + 1].mid; y += 1) {
          for (var k = 0; k < xs.length; k += 1) if (ink[y * W + xs[k]]) cnt += 1;
        }
        var ratio = cnt / Math.max(1, (yL[gy + 1].mid - yL[gy].mid + 1) * xs.length);
        if (ratio > 0.55) wall[gy][gx] = 1;
      }
    }
    /* 横墙 */
    for (gy = 0; gy < gh - 1; gy += 1) {
      var ys = [yL[gy].mid - 1, yL[gy].mid, yL[gy].mid + 1].filter(function (v) { return v >= 0 && v < H; });
      for (gx = 0; gx < gw - 1; gx += 1) {
        var c2 = 0;
        for (var x = xL[gx].mid; x <= xL[gx + 1].mid; x += 1) {
          for (var k2 = 0; k2 < ys.length; k2 += 1) if (ink[ys[k2] * W + x]) c2 += 1;
        }
        var r2 = c2 / Math.max(1, (xL[gx + 1].mid - xL[gx].mid + 1) * ys.length);
        if (r2 > 0.55) wall[gy][gx] = 1;
      }
    }
    return wall;
  }

  /* 去掉被墙线分隔出的「非房间」单元：连通面积过小的格通常是墙缝或
     门外过道。阈值取轮廓面积的 1.5%，且绝对下限 0.4 m² —— 卫生间
     再小也有 2 m² 以上。 */
  function flood(ink, W, H, seedX, seedY) {
    var seen = new Uint8Array(W * H);
    var stack = [seedY * W + seedX];
    var cells = [];
    seen[seedY * W + seedX] = 1;
    while (stack.length) {
      var p = stack.pop();
      cells.push(p);
      var x = p % W, y = (p - x) / W;
      var nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (var i = 0; i < 4; i += 1) {
        var nx = nb[i][0], ny = nb[i][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var q = ny * W + nx;
        if (seen[q] || ink[q]) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    return cells;
  }

  /**
   * inspect —— 从位图里量出外轮廓与房间。
   *
   * @param {object} img { width, height, data:Uint8Array(RGB), ppm, facing, gender }
   * @returns {object} 可直接喂给 analyze() 的户型草稿
   */
  function inspect(img) {
    if (!img || typeof img !== 'object') {
      throw new Error('缺少户型图像：请先上传或拖入一张平面户型图。');
    }
    var W = num(img.width), H = num(img.height);
    if (!(W > 0) || !(H > 0)) {
      throw new Error('图像尺寸无效（宽 ' + img.width + '、高 ' + img.height + '），无法量取尺寸。');
    }
    var data = img.data;
    if (!data || data.length < W * H * 3) {
      throw new Error('图像像素数据不完整，无法识别墙线。');
    }
    /* ppm：像素/米。缺省按「整图约 12 米宽」估一个，并标为估算值。 */
    var ppm = num(img.ppm, 0) > 0 ? num(img.ppm) : W / 12;

    /* 1) 灰度 + Otsu 阈值 → 墙线掩码 */
    var gray = new Float64Array(W * H);
    var i;
    for (i = 0; i < W * H; i += 1) gray[i] = luma(data, i);
    var thr = otsu(gray);
    /* 墨迹判据不能写成「灰度 < thr - 12」，也不能写成
       「灰度 < min(Otsu, 分位数) - 余量」—— 让出余量的方向是反的。
       Otsu 返回的是「前景侧最后一档灰度」，墙线像素正好等于它
       （墙 20、房间 235 时 thr = 20）。再往下减余量只会把阈值压到
       墙的灰度以下，于是 gray < thr' 永远不成立，整张清晰的施工图
       被判成空白，识别出 0 个房间 —— 实测就是这样。
       余量应该往上让，把抗锯齿的浅边并进前景；往下让只会漏墙。 */
    var sorted = Float64Array.from(gray).sort();
    var dyn = sorted[sorted.length - 1] - sorted[0];
    var inkThr = Math.min(254, thr + Math.max(2, dyn * 0.04));
    var ink = new Uint8Array(W * H);
    var inkCount = 0;
    for (i = 0; i < W * H; i += 1) {
      if (gray[i] <= inkThr) { ink[i] = 1; inkCount += 1; }
    }
    /* 墨迹像素的**绝对**占比不能用来判空图：
       墙线在整幅图里本来就很稀疏（一张 12×9 m 的六间户型，
       墙线面积占比只有百分之一二），早先按 2% 判定
       会把线条清晰的施工图判成「空白图纸」。
       判空改到下面用投影峰值，理由见那里。 */
    void inkCount;

    /* 2) 投影找墙线 */
    var proj = projections(ink, W, H);
    var minGap = 3;                        /* 合并容差 3 px */
    var yL = mergeLines(pickLines(proj.rows, H), minGap);
    var xL = mergeLines(pickLines(proj.cols, W), minGap);
    /* 「没有墙线」的判据用投影峰值：墙线那一行/列会贯穿整幅图，
       所以峰值至少要占图幅的 25%（外围墙体本来就接近 100%）。
       这个判据与墨迹总量无关，线条稀疏的图纸也能正常识别。 */
    var peak = 0;
    if (xL.length) peak = Math.max(peak, xL[0].v, xL[xL.length - 1].v);
    if (yL.length) peak = Math.max(peak, yL[0].v, yL[yL.length - 1].v);
    if (peak < 0.25) {
      return {
        width: +(W / ppm).toFixed(2), depth: +(H / ppm).toFixed(2),
        rooms: [], facing: img.facing || 'S', gender: img.gender || '男',
        confidence: 0.05,
        grid: { x: [], y: [], ppm: ppm },
        warning: '这张图里没有找到成形的墙线（可能是一张效果图、照片或空白图纸）。'
          + '自动识别只处理线条清晰的轴对齐平面图；'
          + '你可以先手动添加房间，或换一张施工图。'
      };
    }
    /* 少于 3 条（含两侧边界）时无法切分房间 */
    if (yL.length < 3 || xL.length < 3) {
      return {
        width: +(W / ppm).toFixed(2), depth: +(H / ppm).toFixed(2),
        rooms: [], facing: img.facing || 'S', gender: img.gender || '男',
        confidence: 0.12,
        grid: { x: xL.map(function (l) { return l.mid; }), y: yL.map(function (l) { return l.mid; }), ppm: ppm },
        warning: '墙线数量不足以切分房间（识别到竖向 ' + xL.length + ' 条、横向 ' + yL.length
          + ' 条）。斜墙或弧形户型不在自动识别的范围内，请手动划分房间。'
      };
    }

    /* 3) 外轮廓：取最外侧的墙线，忽略超出图纸边界的扫描线
       （扫描线可能来自页面边框或标题栏，不算墙）。 */
    var x0 = Math.max(0, xL[0].mid), x1 = Math.min(W - 1, xL[xL.length - 1].mid);
    var y0 = Math.max(0, yL[0].mid), y1 = Math.min(H - 1, yL[yL.length - 1].mid);
    if (x1 - x0 < 8 || y1 - y0 < 8) {
      throw new Error('外轮廓过小（' + (x1 - x0) + '×' + (y1 - y0)
        + ' 像素），这张图可能不是完整的户型图。');
    }

    /* 4) 房间 = 墙线网格里不含墙的连通块
       直接在像素上洪泛，比逐格填充实心矩形准：门洞会把两个矩形连成一块，
       这正是真实户型里最常见的形状，逐格填充会把它切成两间。 */
    var rooms = [];
    var visited = new Uint8Array(W * H);
    var minArea = 0.4 * ppm * ppm;              /* 绝对下限 0.4 m² */
    var outlineArea = (x1 - x0) * (y1 - y0);
    var minCells = Math.max(minArea, outlineArea * 0.015);
    var guard = 0;
    for (var yy = y0; yy <= y1 && guard < 4000; yy += 1) {
      for (var xx = x0; xx <= x1 && guard < 4000; xx += 1) {
        guard += 1;
        var idx = yy * W + xx;
        if (visited[idx] || ink[idx]) continue;
        var cells = flood(ink, W, H, xx, yy);
        cells.forEach(function (p) { visited[p] = 1; });
        if (cells.length < minCells) continue;
        /* 该连通块的包围盒 */
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        cells.forEach(function (p) {
          var cx = p % W, cy = (p - cx) / W;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
        });
        /* 填充率：连通块面积 / 包围盒面积。太低说明这是个 L 形或回字形，
           直接取包围盒会把它补成一个方块 —— 那就等于凭空多出一块面积。
           低于 55% 时仍输出包围盒，但要在 name 里标出「非矩形」，提示人工校正。 */
        var fill = cells.length / Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
        var mx0 = (minX - x0) / ppm, mx1 = (maxX - x0) / ppm;
        var my1 = (H - minY) / ppm, my0 = (H - maxY - 1) / ppm;
        /* 转成数学坐标：图像 y 向下，数学 y 向上，基准取图纸底边 */
        var mx = (minX - x0) / ppm;
        var mw = (maxX - minX + 1) / ppm;
        var myTop = (H - minY) / ppm;
        var mh = (maxY - minY + 1) / ppm;
        var depthM = (y1 - y0 + 1) / ppm;
        var my = depthM - (myTop - 0) - mh;
        void mx0; void mx1; void my0; void my1;
        rooms.push({
          id: 'r' + (rooms.length + 1),
          name: (rooms.length + 1) + '号房间' + (fill < 0.55 ? '（非矩形）' : ''),
          kind: 'other',
          x: +clamp(mx, 0, depthM).toFixed(2),
          y: +clamp(my, 0, depthM).toFixed(2),
          w: +mw.toFixed(2),
          h: +mh.toFixed(2),
          fill: +fill.toFixed(3),
          detected: true
        });
      }
    }

    /* 5) 置信度：房间数、尺寸合理性、填充率的加权。
       宁可报低也不要报高 —— 界面据此决定要不要提示用户逐间核对。 */
    var conf = 0;
    if (rooms.length) {
      conf += Math.min(0.4, rooms.length * 0.07);
      var badFill = rooms.filter(function (r) { return r.fill < 0.55; }).length;
      conf += 0.3 * (1 - badFill / rooms.length);
      var rectLike = rooms.filter(function (r) { return r.fill >= 0.75; }).length;
      conf += 0.3 * (rectLike / rooms.length);
    }
    conf = clamp01(conf * (rooms.length ? 1 : 0.4));

    return {
      width: +((x1 - x0 + 1) / ppm).toFixed(2),
      depth: +((y1 - y0 + 1) / ppm).toFixed(2),
      rooms: rooms,
      facing: img.facing || 'S',
      gender: img.gender || '男',
      confidence: +conf.toFixed(2),
      grid: { x: xL.map(function (l) { return l.mid; }), y: yL.map(function (l) { return l.mid; }), ppm: ppm },
      warning: rooms.length === 0
        ? '找到了墙线，但没有识别出封闭房间。请在下方手动添加房间。'
        : (conf < 0.6
          ? '识别完成，但有房间边界不完全规整。请对照图纸核对每个房间的边界与用途，'
            + '再调整房间类型 —— 分析结果全部基于你确认后的数据。'
          : '识别完成。请对照图纸核对每个房间的名称与类型，再看分析结果。'),
      /* 图像原点在左上，需告知界面层底图摆放方式 */
      image: { width: W, height: H, ppm: ppm, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } }
    };
  }

  /* ==================== 几何 ==================== */

  function onOuterWall(r, edge, W, D) {
    if (edge === 'W') return Math.abs(r.x) <= 0.01;
    if (edge === 'E') return Math.abs((r.x + r.w) - W) <= 0.01;
    if (edge === 'S') return Math.abs(r.y) <= 0.01;
    if (edge === 'N') return Math.abs((r.y + r.h) - D) <= 0.01;
    return false;
  }
  function outerDirOf(edge) {
    return edge === 'W' ? '西' : (edge === 'E' ? '东' : (edge === 'S' ? '南' : '北'));
  }
  function windowsOf(r, W, D) {
    var out = [];
    ['W', 'E', 'S', 'N'].forEach(function (e) {
      if (!onOuterWall(r, e, W, D)) return;
      var len = (e === 'W' || e === 'E') ? r.h : r.w;
      out.push({ edge: e, dir: outerDirOf(e), length: +len.toFixed(2) });
    });
    return out;
  }
  function overlapArea(a, b) {
    var x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    var x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    if (x2 - x1 <= EPS || y2 - y1 <= EPS) return 0;
    return (x2 - x1) * (y2 - y1);
  }
  /* 两房间是否相邻（共用一段墙）。用于厨卫串门、动静分区等判断。 */
  function adjacent(a, b, tol) {
    var t = tol === undefined ? 0.35 : tol;
    var xOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    var yOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (xOverlap > t && (Math.abs(a.y + a.h - b.y) < t || Math.abs(b.y + b.h - a.y) < t)) return true;
    if (yOverlap > t && (Math.abs(a.x + a.w - b.x) < t || Math.abs(b.x + b.w - a.x) < t)) return true;
    return false;
  }
  function centerOf(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }

  /* ==================== 缺角检测 ====================
   * 口径：量房时从房屋中心向四至量，哪一角短了一截就是缺哪一角。
   *
   * 关键：**参照系必须是声明的轮廓（W×D），不是房间自身的范围。**
   * 早先版本用房间的外接范围当基准，等于拿「实际有的」去比「实际有的」，
   * 永远归一为满 —— 挖掉一个角也测不出来（实测东北角缺口报 0）。
   *
   * 算法：对每个 45° 方向
   *   1) 沿该方向求轮廓边界，得到该方向的完整可达距离 R；
   *   2) 以中心为顶点的 45° 扇形（面积 θR²/2）为「该方向应有面积」；
   *   3) 统计房间实际覆盖了多少，缺口 = 1 - 覆盖/应有。
   * 扇形与矩形的相交用射线-矩形参数区间求积，不用 1° 采样 ——
   * 采样在半径大时会漏掉窄条，误差会落到「该不该报」的边界上。
   */
  function cornersOf(rooms, W, D) {
    var cx = W / 2, cy = D / 2;
    var OUTLINE = { x1: 0, y1: 0, x2: W, y2: D };

    /* 裁到轮廓内的房间矩形 */
    var cells = rooms.map(function (r) {
      var x1 = Math.max(r.x, 0), y1 = Math.max(r.y, 0);
      var x2 = Math.min(r.x + r.w, W), y2 = Math.min(r.y + r.h, D);
      return { x1: x1, y1: y1, x2: x2, y2: y2, area: Math.max(0, x2 - x1) * Math.max(0, y2 - y1) };
    }).filter(function (c) { return c.area > EPS; });

    if (!cells.length) {
      return DIRECTIONS.map(function (d, i) {
        return { dir: d, deg: i * 45, covered: 0, should: 0, missing: 1, level: 3 };
      });
    }

    function ray(c, px, py, ux, uy) {
      /* 返回沿 (ux,uy) 方向落在矩形 c 内的参数区间 [t0,t1]；出界返回 null */
      var t0 = 0, t1 = Infinity;
      var E = 1e-9;
      if (Math.abs(ux) > E) {
        var ta = (c.x1 - px) / ux, tb = (c.x2 - px) / ux;
        if (ta > tb) { var t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      } else if (px < c.x1 - E || px > c.x2 + E) return null;
      if (Math.abs(uy) > E) {
        var tc = (c.y1 - py) / uy, td = (c.y2 - py) / uy;
        if (tc > td) { var t2 = tc; tc = td; td = t2; }
        t0 = Math.max(t0, tc); t1 = Math.min(t1, td);
      } else if (py < c.y1 - E || py > c.y2 + E) return null;
      if (t1 <= t0 + EPS) return null;
      return [t0, t1];
    }

    /* 该角度方向上，轮廓允许的最大距离 */
    function reachAt(deg) {
      var a = (deg - 90) * Math.PI / 180;
      var r = ray(OUTLINE, cx, cy, Math.cos(a), Math.sin(a));
      return r ? r[1] : 0;
    }

    var HALF = 22.5;                       /* 扇形半张角 */
    var STEP = 0.5;                        /* 积分离散角步长（度） */
    var out = [];
    for (var i = 0; i < 8; i += 1) {
      var deg = i * 45;
      var should = 0, covered = 0;
      for (var ad = deg - HALF; ad < deg + HALF; ad += STEP) {
        var aa = (ad - 90) * Math.PI / 180;
        var ux = Math.cos(aa), uy = Math.sin(aa);
        /* 该角度射线的完整长度：出轮廓处截断 */
        var full = ray(OUTLINE, cx, cy, ux, uy);
        if (!full) continue;
        var L = full[1];
        /* 弧长元 → 该角度条的面积 = L × (张角弧长) ≈ L × 1 × rad(STEP) */
        should += L * STEP * Math.PI / 180;
        /* 房间覆盖：以中心点为原点逐个求区间并集。
           直接相加会重复计入重叠房间，所以按起点排序后做区间合并。 */
        cells.forEach(function (c) {
          var r = ray(c, cx, cy, ux, uy);
          if (!r) return;
          covered += (Math.min(r[1], L) - r[0]) * STEP * Math.PI / 180;
        });
      }
      /* 多个房间在同一角度上的重叠会重复计入 —— 用「覆盖不超过应有」夹一下，
         重叠造成的虚高会被 limits 挡住，而真实缺口仍如实反映。 */
      covered = Math.min(covered, should);
      var ratio = should > EPS ? clamp01(covered / should) : 1;
      out.push({
        dir: DIRECTIONS[i], deg: deg,
        covered: +covered.toFixed(2), should: +should.toFixed(2),
        missing: +(1 - ratio).toFixed(3),
        level: ratio >= 0.95 ? 0 : (ratio >= 0.75 ? 1 : (ratio >= 0.55 ? 2 : 3))
      });
    }
    void reachAt;
    return out;
  }

  /* ==================== 校验 ==================== */

  function validate(plan) {
    if (!plan || typeof plan !== 'object') throw new Error('缺少户型数据。');
    var w = num(plan.width), d = num(plan.depth);
    if (!(w > 0)) throw new Error('户型总宽必须为正数，收到「' + plan.width + '」。');
    if (!(d > 0)) throw new Error('户型总深必须为正数，收到「' + plan.depth + '」。');
    if (!Array.isArray(plan.rooms) || !plan.rooms.length) {
      throw new Error('还没有任何房间。已上传户型图却没有识别出可用空间，'
        + '或尚未手动添加 —— 请先确认图纸或手动加一间再分析。');
    }
    plan.rooms.forEach(function (r, i) {
      if (!r || typeof r !== 'object') throw new Error('第 ' + (i + 1) + ' 个房间数据无效。');
      ['x', 'y', 'w', 'h'].forEach(function (k) {
        if (!Number.isFinite(Number(r[k]))) {
          throw new Error('房间「' + (r.name || r.id || i + 1) + '」缺少 ' + k + ' 坐标。');
        }
      });
      if (num(r.w) <= 0 || num(r.h) <= 0) {
        throw new Error('房间「' + (r.name || r.id) + '」的宽高必须为正数。');
      }
    });
    return { width: w, depth: d };
  }

  /* ==================== 主分析 ==================== */

  function entryOf(plan, W, D) {
    if (plan.entry && Number.isFinite(Number(plan.entry.x))) {
      return { x: num(plan.entry.x), y: num(plan.entry.y, D / 2), assumed: false };
    }
    var minDim = Math.min(W, D);
    return {
      x: minDim === W ? W / 2 : 0,
      y: minDim === W ? 0 : D / 2,
      assumed: true
    };
  }

  function dirKeyOf(cn) { return ({ 北: 'N', 东: 'E', 南: 'S', 西: 'W' })[cn] || 'N'; }

  function analyze(plan, opts) {
    var size = validate(plan);
    var W = size.width, D = size.depth;
    var facing = String(plan.facing || 'S').toUpperCase();
    if (!FACING_ANGLE.hasOwnProperty(facing)) {
      throw new Error('正面朝向必须是 N/NE/E/SE/S/SW/W/NW 之一，收到了「'
        + (plan.facing || '空') + '」。');
    }
    var o = opts || {};
    /* 年份必须由调用方给。默认值定死在 2026 而不是 new Date().getFullYear()：
       取当前年份会让 analyze 不再是纯函数，同一份户型今天跑一次、
       明年再跑一次结果就不同，报告也就没法复核了。界面层负责传当年。 */
    var year = num(o.year, 2026);
    var entry = entryOf(plan, W, D);
    var facingLight = FACING_LIGHT[facing];

    /* ---- 逐间实算 ---- */
    var rooms = plan.rooms.map(function (src, i) {
      var r = {
        id: String(src.id || ('r' + (i + 1))),
        name: String(src.name || src.id || ('第' + (i + 1) + '间')),
        kind: String(src.kind || 'other'),
        x: num(src.x), y: num(src.y), w: num(src.w), h: num(src.h)
      };
      r.area = +(r.w * r.h).toFixed(2);
      r.group = KIND_GROUP[r.kind] || 'service';
      r.groupLabel = GROUP_CN[r.group];
      r.center = centerOf(r);
      r.windows = windowsOf(r, W, D);
      r.windowArea = +r.windows.reduce(function (n, w) { return n + w.length * 1.5; }, 0).toFixed(2);
      r.windowRatio = r.area > 0 ? r.windowArea / r.area : 0;

      /* 采光指数：窗地比归一 × 开口朝向系数的面积权。
         分母用房间周长而非面积 —— 窗地比是绝对量，大房间轻易超过 1，
         直接归一会全部截断到 1，朝向怎么改都不动（这是旧版实测出的坑）。 */
      var coeffSum = 0, lenSum = 0;
      r.windows.forEach(function (w) {
        var base = FACING_LIGHT[dirKeyOf(w.dir)] || 0.5;
        var wt = w.length * (dirKeyOf(w.dir) === facing ? MAIN_WEIGHT : 1);
        coeffSum += base * wt; lenSum += wt;
      });
      r.lightCoeff = r.windows.length ? coeffSum / (lenSum || 1) : 0;
      r.perimeter = 2 * (r.w + r.h);
      r.daylight = r.windows.length
        ? clamp01((lenSum / (r.perimeter * 0.75)) * r.lightCoeff) : 0;

      /* 通风：分「对穿」与「转角」两种。
         只认对侧开口（N+S 或 E+W）的话，转角房一间都拿不到分 ——
         可转角房两面外墙本来就进风，把它判成「完全不通风」是失真的。
         但转角通风毕竟不是穿堂风，按 0.6 折算。 */
      r.nsOpen = openLen(r, 'S', 'N', W, D);
      r.ewOpen = openLen(r, 'W', 'E', W, D);
      r.crossOpen = Math.max(r.nsOpen, r.ewOpen);
      /* 四组相邻边：西北、东北、东南、西南 */
      r.cornerOpen = Math.max(
        openLen(r, 'W', 'N', W, D), openLen(r, 'N', 'E', W, D),
        openLen(r, 'E', 'S', W, D), openLen(r, 'S', 'W', W, D)
      );
      r.airShaft = Math.max(r.crossOpen, r.cornerOpen * 0.6);
      r.ventType = r.crossOpen > 0 ? '对穿' : (r.cornerOpen > 0 ? '转角' : '单侧');
      var minSide = Math.min(r.w, r.h);
      r.ventilation = r.airShaft <= EPS ? 0 : clamp01(r.airShaft / (minSide * 0.8));

      r.path = +Math.hypot(r.center.x - entry.x, r.center.y - entry.y).toFixed(2);
      r.outOfBounds = !(r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= W + 0.01 && r.y + r.h <= D + 0.01);
      r.cornerDeg = dirAngleOf(r.center, W, D);
      r.mountain = mountainAt(r.cornerDeg).name;
      r.direction = dirOf(r.cornerDeg);
      return r;
    });

    /* ---- 重叠 / 越界 ---- */
    var overlaps = [];
    for (var i = 0; i < rooms.length; i += 1) {
      for (var j = i + 1; j < rooms.length; j += 1) {
        var ar = overlapArea(rooms[i], rooms[j]);
        if (ar > EPS) overlaps.push({ a: rooms[i].id, b: rooms[j].id, area: +ar.toFixed(2) });
      }
    }
    var outOfBounds = rooms.filter(function (r) { return r.outOfBounds; })
      .map(function (r) { return r.id; });

    /* ---- 汇总 ---- */
    var totalArea = rooms.reduce(function (n, r) { return n + r.area; }, 0);
    var usage = W * D > 0 ? totalArea / (W * D) : 0;
    var mix = {};
    Object.keys(GROUP_CN).forEach(function (k) { mix[k] = 0; });
    rooms.forEach(function (r) { mix[r.group] += r.area; });
    Object.keys(mix).forEach(function (k) { mix[k] = totalArea > 0 ? mix[k] / totalArea : 0; });

    /* 采光与通风用**加权几何平均**，不是算术平均。
       这是这次升级里最要紧的一处算法选择：
       算术平均会被面积稀释 —— 一间 31 m² 的客厅采光满分，
       就能把三间 12 m² 的暗间平均掉（实测两个户型的采光分
       分别是 33 与 38，「四个暗间」反而更高，纯属荒谬）。
       几何平均是短板主导的：任一间归零，整体就往下掉。
       住宅的实际体感也是这样：家里有一间终日不见光的卧室，
       住户不会因为客厅亮堂就认为「采光好」。
       权重按面积给（面积大的空间影响大），但不再有稀释效应。 */
    function geoMean(key) {
      var sum = 0, wsum = 0;
      rooms.forEach(function (r) {
        var v = Math.max(1e-4, clamp01(r[key]));
        var w = Math.max(0.2, r.area);   /* 极小空间也保留最低权重，不让它单独决定全局 */
        sum += Math.log(v) * w; wsum += w;
      });
      return wsum > 0 ? Math.exp(sum / wsum) : 0;
    }
    var avgLight = geoMean('daylight');
    var avgAir = geoMean('ventilation');

    /* ---- 动线 ---- */
    var flow = rooms.map(function (r) {
      return {
        id: r.id, name: r.name, dist: r.path,
        from: entry.assumed ? '推算的入户门' : '图纸标注的入户门',
        crosses: r.windows.length === 0 ? 1 : 0,
        note: r.windows.length === 0
          ? '中途要经过无采光的走道才能到'
          : (r.group === 'sleep' ? '日常低频，作为末端可接受' : '高频使用，值得靠前')
      };
    });
    var farthest = rooms.slice().sort(function (a, b) { return b.path - a.path; })[0] || null;

    /* ---- 缺角 ---- */
    var corners = cornersOf(rooms, W, D);

    /* ---- 厨卫 ---- */
    var wet = wetOf(rooms);

    /* ---- 六项评分 ---- */
    var scores = {
      flow: scoreFlow(rooms, flow, farthest, W, D),
      layout: scoreLayout(rooms, overlaps, outOfBounds),
      palace: scorePalace(rooms, corners),
      shape: scoreShape(rooms, W, D),
      function: scoreFunction(rooms, mix, totalArea),
      light: scoreLight(rooms, avgLight, avgAir)
    };
    var WEIGHT = { flow: 0.16, layout: 0.20, palace: 0.16, shape: 0.14, function: 0.18, light: 0.16 };
    var total = 0;
    Object.keys(WEIGHT).forEach(function (k) { total += scores[k] * WEIGHT[k]; });
    total = Math.round(clamp(total, 0, 100));

    var result = {
      version: 'house-scan-1.0.0',
      year: year,
      width: W, depth: D,
      rooms: rooms, overlaps: overlaps, outOfBounds: outOfBounds,
      totalArea: +totalArea.toFixed(2), usage: +usage.toFixed(3),
      mix: mix, avgLight: +avgLight.toFixed(3), avgAir: +avgAir.toFixed(3),
      entry: entry, farthest: farthest, flow: flow, corners: corners, wet: wet,
      facing: facing, facingLight: facingLight,
      facingAngle: FACING_ANGLE[facing],
      mountains: MOUNTAINS,
      seat: { angle: (FACING_ANGLE[facing] + 180) % 360, dir: dirOf((FACING_ANGLE[facing] + 180) % 360) },
      compass: { deg: FACING_ANGLE[facing], mountain: mountainAt(FACING_ANGLE[facing]).name },
      scores: scores, total: total,
      verdict: verdictOf(total, scores),
      yearly: yearlyOf(year, W, D),
      boundary: BOUNDARY
    };
    result.issues = issuesOf(result);
    /* plans 是 issueId 关联后的整改计划；plan 保留原名以兼容既有调用方。 */
    result.plan = planOf(result);
    result.plans = result.plan;
    return result;
  }

  function dirAngleOf(p, W, D) {
    /* 房间中心相对户型中心的方向角：正北 0°、顺时针。
       户型图的上下对应真实方位由 facing 决定 —— 图的上方是「坐」还是「向」，
       这里按「图上方 = 背面（坐向）」处理，与罗盘一致。 */
    var dx = p.x - W / 2, dy = p.y - D / 2;
    if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return 0;
    return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
  }

  function openLen(r, a, b) {
    var oa = r.windows.filter(function (w) { return w.edge === a; })[0];
    var ob = r.windows.filter(function (w) { return w.edge === b; })[0];
    if (!oa || !ob) return 0;
    return Math.min(oa.length, ob.length);
  }

  /* ==================== 评分明细 ====================
   * 每一项都写清算式，报告里要按「依据」原样引用，
   * 用户才可能自己复核，而不是只能选择相信。
   */
  function scoreFlow(rooms, flow, farthest, W, D) {
    if (!rooms.length) return 0;
    /* 动线：以「面积加权平均行程」和「无采光阻隔比例」两项打分 */
    var totalArea = rooms.reduce(function (n, r) { return n + r.area; }, 0) || 1;
    var avgDist = rooms.reduce(function (n, r) { return n + r.path * r.area; }, 0) / totalArea;
    /* 15 m 以内满分，每多 1 m 扣 3 分 */
    var s1 = clamp(100 - Math.max(0, avgDist - 15) * 3, 0, 100);
    var blocked = rooms.filter(function (r) { return r.windows.length === 0; }).length / rooms.length;
    var s2 = clamp(100 - blocked * 60, 0, 100);
    void flow; void farthest; void W; void D;
    return Math.round(s1 * 0.65 + s2 * 0.35);
  }

  function scoreLayout(rooms, overlaps, outOfBounds) {
    var s = 100;
    s -= overlaps.length * 18;
    s -= outOfBounds.length * 20;
    /* 狭长空间：长宽比 > 2.2 扣分 */
    rooms.forEach(function (r) {
      var ratio = Math.max(r.w, r.h) / Math.min(r.w, r.h);
      if (ratio > 2.2) s -= Math.min(10, (ratio - 2.2) * 4);
    });
    return Math.round(clamp(s, 0, 100));
  }

  function scorePalace(rooms, corners) {
    /* 宫位落位：把「主要使用空间的采光通风 + 缺角」合成。
       权重按面积而不是房间个数 —— 一间 25 m² 的客厅比三间 5 m² 的储物间重要。 */
    var mainArea = rooms.reduce(function (n, r) {
      var w = (r.group === 'sleep' || r.group === 'living') ? 1 : 0.4;
      return n + r.area * w;
    }, 0) || 1;
    var lit = rooms.reduce(function (n, r) {
      var w = (r.group === 'sleep' || r.group === 'living') ? 1 : 0.4;
      return n + r.daylight * r.area * w;
    }, 0) / mainArea;
    var air = rooms.reduce(function (n, r) {
      var w = (r.group === 'sleep' || r.group === 'living') ? 1 : 0.4;
      return n + r.ventilation * r.area * w;
    }, 0) / mainArea;
    var cornerPenalty = corners.filter(function (c) { return c.missing > 0.05; })
      .reduce(function (n, c) { return n + c.missing; }, 0);
    /* 三个分量都要落回 [0,1] 再加权，否则 lit/air 若因权重溢出 > 1
       会把总分顶出 100，报告里就会出现「101 分」这种自相矛盾的结果。 */
    return Math.round(clamp(
      (clamp01(lit) * 0.4 + clamp01(air) * 0.3
        + (1 - clamp01(cornerPenalty / 8)) * 0.3) * 100, 0, 100));
  }

  function scoreShape(rooms, W, D) {
    /* 户型形状：房间面积和 / 整户面积。越接近 1 说明轮廓被完整利用，
       剩得越多说明有越多面积是走道、墙体或没被识别到的空处。 */
    var cov = rooms.reduce(function (n, r) { return n + r.area; }, 0) / (W * D || 1);
    /* 0.78 以上视为方正完整 */
    return Math.round(clamp(cov / 0.78 * 100, 0, 100));
  }

  function scoreFunction(rooms, mix, totalArea) {
    /* 功能配比：逐间对照 KIND_TARGET 区间打分，按面积加权。
       面积落在区间内记 100，在区间外按偏离比例线性衰减。 */
    var s = 0, wsum = 0;
    rooms.forEach(function (r) {
      var t = KIND_TARGET[r.kind] || KIND_TARGET.other;
      var score;
      if (r.area >= t[0] && r.area <= t[1]) score = 100;
      else if (r.area < t[0]) score = clamp(t[0] > 0 ? r.area / t[0] * 100 : 100, 0, 100);
      else score = clamp(t[1] > 0 ? (1 - (r.area - t[1]) / t[1]) * 100 : 100, 0, 100);
      s += score * r.area; wsum += r.area;
    });
    var base = wsum > 0 ? s / wsum : 0;
    /* 卧寝占比超 45% 起居被挤压；起居不足 18% 同理 */
    var penalty = 0;
    if (mix.sleep > 0.45) penalty += (mix.sleep - 0.45) * 200;
    if (mix.living < 0.18) penalty += (0.18 - mix.living) * 200;
    void totalArea;
    return Math.round(clamp(base - penalty, 0, 100));
  }

  function scoreLight(rooms, avgLight, avgAir) {
    /* 采光与通风：面积加权各占一半。
       单独列出「无外窗房间数」作为硬扣分 —— 无窗是硬伤，不该被均值稀释。 */
    var dark = rooms.filter(function (r) { return r.windows.length === 0; }).length;
    var darkRate = dark / (rooms.length || 1);
    var s = (clamp01(avgLight) * 0.55 + clamp01(avgAir) * 0.45) * 100;
    s -= darkRate * 45;
    return Math.round(clamp(s, 0, 100));
  }

  function verdictOf(total, scores) {
    var weakest = Object.keys(scores).sort(function (a, b) { return scores[a] - scores[b]; })[0];
    var NAME = { flow: '动线', layout: '格局', palace: '宫位落位', shape: '户型形状', function: '功能配比', light: '采光通风' };
    if (total >= 85) return '整体条件较好，' + NAME[weakest] + '是相对最弱的一项，可作小幅优化。';
    if (total >= 70) return '整体可用，短板集中在' + NAME[weakest] + '，改这一项收益最大。';
    if (total >= 55) return '存在明显短板，' + NAME[weakest] + '与另外一两项需要优先处理。';
    return '多项指标低于常见参考区间，建议先处理报告中列为「高」的问题项。';
  }

  function wetOf(rooms) {
    /* 厨卫专项：位置、相邻关系、是否贴外墙。
       只讲「位置与相邻会带来什么使用影响」，不判吉凶。 */
    var kitchens = rooms.filter(function (r) { return r.kind === 'kitchen'; });
    var baths = rooms.filter(function (r) { return r.kind === 'bath' || r.kind === 'toilet'; });
    var tags = [];
    var notes = [];

    kitchens.forEach(function (k) {
      if (k.windows.length === 0) {
        tags.push('厨房无窗');
        notes.push('厨房没有外窗，油烟只能靠机械排风，且燃气与排风共处一室，'
          + '建议优先在此处补一处外排风口。');
      }
      baths.forEach(function (b) {
        if (adjacent(k, b)) {
          tags.push('厨卫紧邻');
          notes.push('厨房与' + b.name + '共用一面墙：串味、返味与管道噪音会互相传导，'
            + '若条件允许，在两者之间加一道有门斗或至少做严密封隔音处理。');
        }
      });
      /* 厨房在户型几何中心：排烟路径最长 */
      var c = k.center;
      var distToCenter = Math.hypot(c.x - (rooms.reduce(function (n, r) {
        return n + r.area * centerOf(r).x; }, 0) / (rooms.reduce(function (n, r) { return n + r.area; }, 0) || 1)),
        c.y - (rooms.reduce(function (n, r) {
          return n + r.area * centerOf(r).y; }, 0) / (rooms.reduce(function (n, r) { return n + r.area; }, 0) || 1)));
      if (distToCenter < Math.min(1.5, Math.max(rooms[0].w, 1) * 0.2)) {
        tags.push('厨房居中');
        notes.push('厨房位于户型几何中心，烟道需要穿过其他空间，排风效率与私密性都会受影响。');
      }
    });

    baths.forEach(function (b) {
      if (b.windows.length === 0) {
        tags.push('卫生间无窗');
        notes.push(b.name + '没有外窗，湿气只能靠排风扇排出；'
          + '如果不能开窗，建议配大风量排风并留出检修口。');
      }
    });

    if (!tags.length) {
      notes.push('厨卫位置与相邻关系未触发常见关注点：厨房有外窗或远离中心，卫生间未紧贴厨房。');
    }
    return {
      kitchens: kitchens.map(function (k) { return k.name; }),
      baths: baths.map(function (b) { return b.name; }),
      tags: tags,
      notes: notes.join(' ')
    };
  }

  function yearlyOf(year, W, D) {
    /* 流年紫白：九宫按年支轮转。这是传统「游年」的排法之一。
       这里只呈现「每年各宫对应的星名」，不写宜忌、不写吉凶。
       年份由调用方显式传入（analyze 会把 opts.year 透进来），
       **不接受隐式的当前年份** —— 一旦隐式取当前时间，
       同一天两次打开就会得到两份不同的报告，用户无法复核。 */
    var y = num(year, 2026);
    /* 年份 → 三元九运的年序（简化：以 1864 为七运甲子起点，
       每 180 年一元、每 3 年一运，此处只取年支序列做轮转索引）。 */
    var n = ((y - 1864) % 180 + 180) % 180;
    var yuan = Math.floor(n / 60) + 7;         /* 七~十三运 */
    var step = Math.floor((n % 60) / 3);       /* 每运 3 年 */
    var STAR_ORDER = ['一白', '二黑', '三碧', '四绿', '五黄', '六白', '七赤', '八白', '九紫'];
    /* 中宫星随运与年序轮转（传统「年紫白」按中宫星顺飞的排法之一） */
    var centerIdx = ((yuan - 7) * 3 + step) % 9;
    /* 中宫没有度数（它不是方位）。给 null 而不是 -1：
       -1 会被 dirOf/mountainAt 当成 359° 算出「壬山」，
       报告里就出现了「离（南）undefined」这种脏值。 */
    var PALACE_ORDER = [
      { name: '坎（北）', deg: 0 }, { name: '坤（西南）', deg: 225 },
      { name: '震（东）', deg: 90 }, { name: '巽（东南）', deg: 135 },
      { name: '中宫', deg: null }, { name: '乾（西北）', deg: 315 },
      { name: '兑（西）', deg: 270 }, { name: '艮（东北）', deg: 45 },
      { name: '离（南）', deg: 180 }
    ];
    /* 飞星顺序：从中宫起，按洛书顺飞。
       FLIGHT 里存的是**星名序号 1~9**，而 STAR_ORDER 是 0 基数组，
       必须减一才能索引；早先直接拿FLIGHT[k]当下标，
       序号 9 就越界读成undefined，报告里出现「离（南）undefined」。 */
    var FLIGHT = [4, 9, 2, 3, 5, 7, 8, 1, 6];
    var palaces = PALACE_ORDER.map(function (p, i) {
      var no = FLIGHT[(i + centerIdx) % 9];
      return { palace: p.name, deg: p.deg, star: STAR_ORDER[no - 1] || '' };
    });
    return {
      year: y, yuan: yuan,
      palaces: palaces,
      note: '流年紫白按年序轮转排布，是传统「游年」的一种起例。'
        + '各家起例与顺逆并不一致，此处仅作方位文化标注，不表示该方位吉或凶，'
        + '也不建议据此改动房屋结构。'
    };
  }

  /* ==================== 问题清单 ==================== */

  function issuesOf(r) {
    var out = [];
    var oneSided = [];

    r.rooms.forEach(function (x) {
      if (x.windows.length === 0) {
        out.push({
          level: 'high', room: x.id, tag: '无外窗',
          text: x.name + ' 没有外窗：既无自然采光，也无法形成对流通风。',
          basis: '几何判定：它的四条边都不与户型外轮廓重合，故外窗数为 0。'
        });
      } else if (x.daylight < 0.25) {
        out.push({
          level: 'mid', room: x.id, tag: '采光弱',
          text: x.name + ' 采光偏弱：只有 '
            + x.windows.map(function (w) { return w.dir + '向'; }).join('、')
            + '外窗，窗地比约 ' + (x.windowRatio * 100).toFixed(0) + '%。',
          basis: '窗地比 = 外窗宽度 × 窗高 1.5 m ÷ 地面面积 = '
            + x.windowArea.toFixed(1) + ' ÷ ' + x.area.toFixed(1)
            + ' ≈ ' + (x.windowRatio * 100).toFixed(0) + '%；朝向系数加权后得采光指数 '
            + x.daylight.toFixed(2) + '，低于 0.25。'
        });
      }
      if (x.ventilation < 0.2 && x.windows.length) {
      /* 单侧开口的房间逐个报，会在报告里刷出七八条一模一样的条目，
         既淹没真正的问题，也让用户以为工具在凑数。
         这里只对「单侧开口」的房间报一条汇总，
         「转角但仍偏弱」的按房间单列 —— 那是不同的户型问题，改法也不同。 */
        if (x.ventType === '单侧') {
          oneSided.push(x.name);
        } else {
          out.push({
            level: 'low', room: x.id, tag: '通风偏弱',
            text: x.name + ' 是' + x.ventType + '通风（转角两面外墙，未形成对穿），'
              + '闷热与异味不容易散掉。',
            basis: '相邻两面外墙开口较小者 ' + x.cornerOpen.toFixed(1)
              + ' m，无对穿开口；折算后通风指数 ' + x.ventilation.toFixed(2)
              + '，低于 0.2。'
          });
        }
      }
      var ratio = Math.max(x.w, x.h) / Math.min(x.w, x.h);
      if (ratio > 2.2 && x.kind !== 'corridor') {
        out.push({
          level: 'low', room: x.id, tag: '狭长',
          text: x.name + ' 长宽比约 ' + ratio.toFixed(1) + ':1，进深偏大，末端的采光与通风都会变差。',
          basis: '长边 ' + Math.max(x.w, x.h).toFixed(1) + ' m ÷ 短边 '
            + Math.min(x.w, x.h).toFixed(1) + ' m = ' + ratio.toFixed(1) + '，超过 2.2。'
        });
      }
      var t = KIND_TARGET[x.kind];
      if (t && t[1] < 900 && x.area < t[0] && (x.kind === 'bedroom' || x.kind === 'bath' || x.kind === 'kitchen')) {
        out.push({
          level: 'low', room: x.id, tag: '面积偏小',
          text: x.name + ' 面积约 ' + x.area.toFixed(1) + ' m²，低于常见住宅中'
            + (KIND_CN[x.kind] || x.kind) + '的 ' + t[0] + ' m² 参考下限。',
          basis: '面积由坐标实算：' + x.w.toFixed(1) + ' × ' + x.h.toFixed(1)
            + ' = ' + x.area.toFixed(1) + ' m²；参考区间取住宅设计常见净面积，'
            + '非强制规范条文。'
        });
      }
      if (x.detected && x.fill && x.fill < 0.55) {
        out.push({
          level: 'low', room: x.id, tag: '边界待核',
          text: x.name + ' 不是矩形（自动识别填充率 '
            + (x.fill * 100).toFixed(0) + '%）。当前按外接矩形计算，实际面积会偏小，'
            + '请对照图纸手动修正边界。',
          basis: '连通区域面积 ÷ 外接矩形面积 = ' + (x.fill * 100).toFixed(0)
            + '%，低于 55% 说明存在凹角。'
        });
      }
    });

    /* 单侧开口的房间合并成一条：这几间改法是同一件事，逐条列没有信息量。 */
    if (oneSided.length) {
      out.push({
        level: 'mid', room: null, tag: '单侧开口',
        text: oneSided.length + ' 个空间只有单侧外墙开口（'
          + oneSided.join('、') + '），空气进得来出不去，'
          + '夏末冬初容易返潮返味，室内空气长期不换。',
        basis: '这几间几何上都只有一条边与外轮廓重合，'
          + '南北与东西向均找不到成对开口，对穿开口 0.0 m → 通风指数 0.00。'
          + '内墙开门洞是最容易落地的改法。'
      });
    }

    r.overlaps.forEach(function (o) {
      out.push({
        level: 'high', room: o.a, tag: '数据重叠',
        text: '房间「' + o.a + '」与「' + o.b + '」重叠约 ' + o.area.toFixed(2) + ' m²，数据有误。',
        basis: '矩形相交面积 = ' + o.area.toFixed(2) + ' m² > 0。'
      });
    });
    r.outOfBounds.forEach(function (id) {
      var x = r.rooms.filter(function (k) { return k.id === id; })[0];
      out.push({
        level: 'high', room: id, tag: '超出边界',
        text: '房间「' + (x ? x.name : id) + '」超出户型轮廓边界。',
        basis: '房间右边界 ' + (x ? (x.x + x.w).toFixed(1) : '?') + ' m，总宽 '
          + r.width.toFixed(1) + ' m。'
      });
    });

    r.corners.forEach(function (c) {
      if (c.missing > 0.05) {
        out.push({
          level: c.missing > 0.35 ? 'mid' : 'low', room: '', tag: '缺' + c.dir + '角',
          text: c.dir + '方向存在缺角：外轮廓自户型中心向' + c.dir
            + '延伸时，房间覆盖不足该方向应有面积的 '
            + (c.missing * 100).toFixed(0) + '%。',
          basis: '以户型中心为原点作 ' + c.dir + '向角落方块，房间实际覆盖 '
            + c.covered.toFixed(1) + ' m²，归一后缺口 ' + (c.missing * 100).toFixed(0) + '%。'
        });
      }
    });

    if (r.wet.tags.length) {
      out.push({
        level: r.wet.tags.some(function (t) { return /紧邻|居中/.test(t); }) ? 'mid' : 'low',
        room: '', tag: '厨卫',
        text: '厨卫布局需要关注：' + r.wet.tags.join('、') + '。',
        basis: r.wet.notes
      });
    }

    if (r.usage < 0.72) {
      out.push({
        level: 'low', room: '', tag: '使用率',
        text: '房间面积合计占轮廓的 ' + (r.usage * 100).toFixed(0)
          + '%，其余为墙体、走道或未被识别的空间。',
        basis: 'Σ房间面积 ' + r.totalArea.toFixed(1) + ' m² ÷ 轮廓 '
          + (r.width * r.depth).toFixed(1) + ' m² = '
          + (r.usage * 100).toFixed(0) + '%，低于 72%。'
      });
    }
    if (r.entry.assumed) {
      out.push({
        level: 'low', room: '', tag: '入户门为推算',
        text: '入户门位置是按最短边推算的，不是从图纸读取的，动线结论仅供参考。',
        basis: '未提供入户门坐标，取轮廓较短一边的中点作为估计值。'
      });
    }
    return markIssues(out, r);
  }

  /* ==================== 问题标记：让每条问题都能在图上点出来 ====================
   *
   * 报告里写「客厅采光弱」是一句话，用户还得自己找到客厅在哪。
   * 这里给每条问题补两样东西：
   *   id   —— 稳定编号，整改计划靠它关联到具体问题
   *   mark —— 图上坐标（米），界面直接拿它画标记
   *
   * 标记点的取法有优先级，找不到依据时才退回户型中心 ——
   * 宁可标在中心让人自己看，也不要编一个假位置。
   */
  function markIssues(list, r) {
    var byId = {};
    r.rooms.forEach(function (x) { byId[x.id] = x; });
    var cx = r.width / 2;
    var cy = r.depth / 2;

    function centerOf(roomId) {
      var x = byId[roomId];
      if (!x) return null;
      return { x: x.x + x.w / 2, y: x.y + x.h / 2 };
    }

    /* 有些问题指向的是一组房间（如「单侧开口」汇总几条），
       取第一条有坐标的房间的中心，并在 why 里说明标的是哪一间。 */
    function firstRoomOf(text) {
      var hit = null;
      r.rooms.forEach(function (x) {
        if (!hit && text.indexOf(x.name) >= 0) hit = x.id;
      });
      return hit;
    }

    var seen = {};
    list.forEach(function (it, i) {
      var base = String(it.tag || 'issue').replace(/[^\u4e00-\u9fa5A-Za-z0-9]+/g, '-');
      var id = it.room ? base + '-' + it.room : base;
      /* 同 tag 同 room 只可能出现一条；若真重复了，加序号保证 id 唯一 */
      if (seen[id] !== undefined) { seen[id] += 1; id = id + '-' + seen[id]; }
      else { seen[id] = 0; }
      it.id = id;

      var m = centerOf(it.room);
      if (!m && it.text) m = centerOf(firstRoomOf(it.text));
      if (!m) {
        m = { x: cx, y: cy };
        it.markNote = '该问题涉及多个空间或整户，标记画在户型中心，具体位置见正文。';
      }
      it.mark = {
        x: Math.round(m.x * 100) / 100,
        y: Math.round(m.y * 100) / 100,
        /* 房间级问题标房间中心；户型级问题半径给大一点，一眼能看到 */
        r: it.room ? 0.35 : 0.6
      };
      it.plain = plainOfIssue(it);
    });
    return list;
  }

  /* 问题的「大白话」：一句话说清「这意味着什么、你会感觉到什么」。
     报告正文说依据，这里说人话 —— 两条都要有，不能只给依据让人自己翻译。 */
  function plainOfIssue(it) {
    var tag = it.tag;
    var map = {
      无外窗: '这间房又闷又暗，白天不开灯基本看不清书，一开门就一股憋久了的味儿。',
      采光弱: '这间房白天也偏暗，长期住着压抑、容易累，白天也想开灯。',
      通风偏弱: '这间房空气不流动，闷热和异味散不掉，晾一天还有味。',
      单侧开口: '这几间屋只能进风不能出风，像只开了半扇窗，夏末冬初最容易返潮发霉。',
      狭长: '这间房是个长条形，越往里越暗越闷，中间一段基本用不上。',
      面积偏小: '这间房偏小，该有的东西放下去就转不开身，日常收纳会一直别扭。',
      边界待核: '这间房的自动识别边界跟实际可能不完全一致，面积和采光结论请对着图再看一眼。',
      数据重叠: '这份数据里两间房的位置画到一块儿了，属于识别出错，请手动修正边界。',
      超出边界: '这间房画到了户型外面，属于识别出错，请手动修正边界。',
      使用率: '图纸里有相当一部分是墙、走道或没被识别出来的空间，不是真的浪费了。',
      入户门为推算: '入户门位置是猜的，动线相关的结论请以实际图纸为准。',
      厨卫: '厨房和卫生间挨着的地方容易串味、返味，做饭时卫生间味道也大。'
    };
    if (map[tag]) return map[tag];
    if (/^缺.+角$/.test(tag)) {
      return '户型在这个方向是缺角的，东南角一带的房间可能会互相挡采光，'
        + '实际以现场窗户间距为准。';
    }
    return '这条是几何上量出来的问题，依据见下方说明。';
  }

  /* ==================== 改进计划 ==================== */

  function planOf(r) {
    var out = [];

    /* 每条计划都要能算出「改完能提多少分」，这样排序才有依据，
       而不是把所有建议堆在一起让用户自己挑。 */
    var dark = r.rooms.filter(function (x) { return x.windows.length === 0; });
    if (dark.length) {
      /* 补一扇窗能把采光指数从 0 提到「该朝向权重下开口周长比」的水平，
         对总分的影响按面积加权折算 —— 这里给的是量级估算，不是精确承诺。 */
      var gainDark = Math.round(r.darkGain || dark.length / r.rooms.length * 45);
      out.push({
        issueTag: '无外窗',
        title: '给 ' + dark.map(function (x) { return x.name; }).join('、') + ' 补一处外窗或开口',
        action: '优先在这些房间的对外墙上开设可开启窗扇；若结构外墙无法开窗，'
          + '改用玻璃砖、内墙掏窗或上翻式高窗借光，并在同侧补机械通风。',
        effort: '大', gain: clamp(gainDark, 5, 40),
        why: '无外窗是本次检出的最高等级问题（' + dark.length + ' 处），'
          + '它同时拉低采光分与宫位落位分。'
      });
    }

    var weakAir = r.rooms.filter(function (x) { return x.windows.length && x.ventilation < 0.2; });
    if (weakAir.length) {
      out.push({
        issueTag: '单侧开口',
        title: '为 ' + weakAir.map(function (x) { return x.name; }).join('、') + ' 增加对侧开口',
        action: '在与现有外窗相对的一面增开一处可开启开口（内墙上门洞改窗最易落地），'
          + '使南北或东西两侧同时可进风，形成穿堂或对流。',
        effort: '中', gain: clamp(Math.round(weakAir.length / r.rooms.length * 30), 4, 25),
        why: '单侧开口无法形成对流（当前通风指数 '
          + weakAir.map(function (x) { return x.ventilation.toFixed(2); }).join('、') + '）。'
      });
    }

    var corners = r.corners.filter(function (c) { return c.missing > 0.2; });
    if (corners.length) {
      out.push({
        issueTag: '缺角',
        title: '处理 ' + corners.map(function (c) { return c.dir; }).join('、') + ' 方向的缺角',
        action: '若为结构限制无法补齐，优先在该角布置次要功能（储物、家政）；'
          + '若可调整，用轻质隔墙把相邻空间匀一部分过去，并保证补齐部分同样有外窗。',
        effort: '大', gain: clamp(Math.round(corners.length * 8), 4, 20),
        why: '缺角处既无面积也无采光，放置主要功能会长期不舒适。'
      });
    }

    if (r.farthest && r.farthest.group === 'sleep') {
      out.push({
        issueTag: '动线',
        title: '把最远的卧室调整到更近的位置，或提升其独立通风',
        action: '若墙体可动，把主卧或次卧与相邻空间互换；'
          + '若不能动，为该房补一处对侧开口并把书桌、床位避开最深端。',
        effort: '中', gain: 8,
        why: '离入户门最远的是' + r.farthest.name + '（' + r.farthest.path
          + ' m），而它是卧寝 —— 空间属性与实际使用频率不匹配。'
      });
    }

    if (r.wet.tags.some(function (t) { return /紧邻/.test(t); })) {
      out.push({
        issueTag: '厨卫',
        title: '在厨房与卫生间之间加门斗或加强密封隔音',
        action: '两者之间加一道有缓冲的隔断（门斗、玄关柜或双层密封门），'
          + '并分别核对排风是否独立出屋面。',
        effort: '中', gain: 6,
        why: '共用墙面会带来串味、返味与管道噪音，属于可低成本消除的使用缺陷。'
      });
    }

    var narrow = r.rooms.filter(function (x) {
      return Math.max(x.w, x.h) / Math.min(x.w, x.h) > 2.2;
    });
    if (narrow.length) {
      out.push({
        issueTag: '狭长',
        title: '调整狭长空间的比例或改变其用途',
        action: '把最长的一侧改作收纳（柜体到顶）压缩视觉进深，'
          + '或把该空间改为书房/储藏，减少停留时间。',
        effort: '小', gain: 4,
        why: '狭长空间的末端在几乎所有时间段都是最暗的位置。'
      });
    }

    if (!out.length) {
      out.push({
        issueTag: '',
        title: '当前几何条件下未检出需要优先整改的项',
        action: '继续保持；若后续改变格局（打通隔墙、改变门窗位置），'
          + '重新上传户型图再核一次。',
        effort: '无', gain: 0,
        why: '逐间检查外窗数、窗地比、对侧开口、长宽比、功能配比与缺角，未触发任何阈值。'
      });
    }

    /* 排序：先按收益降序；收益相同则小工作量优先 ——
       用户最需要的是「第一件该做什么」，不是一份并列清单。 */
    var RANK = { '小': 0, '中': 1, '大': 2, '无': -1 };
    out.sort(function (a, b) {
      if (b.gain !== a.gain) return b.gain - a.gain;
      return (RANK[a.effort] === undefined ? 9 : RANK[a.effort])
        - (RANK[b.effort] === undefined ? 9 : RANK[b.effort]);
    });
    out.forEach(function (p, i) { p.rank = i + 1; });

    /* 把 issueTag 解析成具体的问题 id，
       这样界面上点一条整改建议就能高亮图上对应的那个标记。
       解析不到时如实留空并说明，不硬凑一个 id 上去。 */
    var issues = r.issues || [];
    out.forEach(function (p) {
      var tag = p.issueTag;
      if (!tag) {
        p.issueId = '';
        p.issueNote = '这条是兜底建议，不对应图上单点标记。';
        return;
      }
      if (/^缺.+角$/.test(tag)) tag = /^缺.+角$/.test(tag) ? tag : tag;
      var hit = null;
      issues.forEach(function (it) {
        if (hit) return;
        if (it.tag === tag) hit = it;
      });
      /* 「缺角」的 tag 是「缺东南角」这类动态文案，用前缀匹配 */
      if (!hit && /角$/.test(tag)) {
        issues.forEach(function (it) {
          if (!hit && /角$/.test(it.tag)) hit = it;
        });
      }
      /* 「单侧开口」找不到汇总条目时，退到同类里的第一条通风类问题 */
      if (!hit && tag === '单侧开口') {
        issues.forEach(function (it) {
          if (!hit && /单侧|通风/.test(it.tag)) hit = it;
        });
      }
      p.issueId = hit ? hit.id : '';
      p.mark = hit ? hit.mark : null;
      p.issueNote = hit ? '' : '未能在问题清单中找到完全对应的一条，标记位置请以问题清单为准。';
      p.plain = plainOfPlan(p, hit);
    });
    return out;
  }

  /* 整改建议的大白话：一句话说清「先做哪一步、做完什么样」。
     action 说怎么改，why 说为什么，这条说「你会有什么感觉」。 */
  function plainOfPlan(p, issue) {
    var base = {
      无外窗: '先给没窗的那间开一扇窗。这一步做完，家里最闷最暗的那个角落就解决了，'
        + '白天不用开灯，进风也通了。',
      单侧开口: '在单侧没风的房间内墙上再开一处通向别的空间的口子，或者把门留成对开。'
        + '改完风能穿起来，闷味和返潮会明显减轻。',
      缺角: '把缺角那一侧的空间用途换一换（比如改成储藏或书房），'
        + '或者在该侧多补一处开口，让那个角落不再是个又暗又没人用的死角。',
      动线: '把卧室和进门那段距离换个位置。每天少走十几米、进门不绕路，'
        + '这个体感比什么都直接。',
      厨卫: '在厨房和卫生间中间加一道门斗或换成密封门。改完之后做饭时卫生间不再串味，'
        + '夜里也不被冲水声吵醒。',
      狭长: '长条那一侧做一整排到顶的柜子，视觉上把进深压短一半，'
        + '同时把末端改成不需要久留的功能（储物、洗衣）。'
    };
    if (base[p.issueTag]) return base[p.issueTag];
    if (issue && issue.plain) {
      return '这条是为了解决上面「' + issue.tag + '」这个问题：' + issue.plain;
    }
    return '照着上面写的做即可，属于不改动结构就能落地的改善。';
  }

  var BOUNDARY = '本工具的面积、采光、通风、动线、缺角与评分均为几何实算（按你确认后的房间数据），'
    + '不含楼层、朝向遮挡、窗型与季节修正，不构成建筑、消防或结构合规意见。'
    + '二十四山、宅星与流年紫白为传统方位文化的索引与标注，流派之间起例不一，'
    + '本模块只呈现其中一种，不据此断言宅居吉凶、人丁祸福或房价涨跌。';

  /* ==================== 九宫飞星（宅星起例） ====================
   * 独立的「按宅向起星」入口，供罗盘与家具布局共用。
   * 与 yearlyOf 的区别：yearlyOf 是流年紫白（按年份轮转），
   * 这里按**坐向**起宅星（八宅的坎宅/离宅/震宅…），两套不是一回事，
   * 混在一起就会得出互相矛盾的中宫星。
   *
   * 起例：坐向落在哪一卦，该卦的后天数为伏位，
   * 生气、天医、延年依次从伏位退（本门数顺数），
   * 五鬼、绝命、六害自伏位顺行。简化到本工具够用的程度：
   * 中宫取生气数，按洛书顺飞铺九宫。
   */
  var XUAN_GUA = {
    N: '坎', NE: '艮', E: '震', SE: '巽',
    S: '离', SW: '坤', W: '兑', NW: '乾'
  };
  /* 八卦数理：乾1兑2离3震4巽5坎6艮7坤8；洛书宫数另算 */
  var GUA_NUM = { 乾: 1, 兑: 2, 离: 3, 震: 4, 巽: 5, 坎: 6, 艮: 7, 坤: 8 };
  /* 生气/天医/延年的游走序：从伏位起，按洛书顺飞方向退宫 */
  var XUAN_OFFSET = {
    生气: -1, 伏位: 0, 延年: -2, 天医: -3,
    五鬼: 1, 六害: 2, 绝命: 3
  };
  /* 洛书顺飞序：坎→坤→震→巽→中→乾→兑→艮→离（生门顺行的九宫次序）*/
  var LUO_CYCLE = ['N', 'SW', 'E', 'SE', 'center', 'NW', 'W', 'NE', 'S'];

  var STAR_CN = ['一白', '二黑', '三碧', '四绿', '五黄', '六白', '七赤', '八白', '九紫'];

  function facingToGua(facing) {
    var f = String(facing || 'S').toUpperCase();
    /* 八宅只认四正四维共八卦：东南与西南是两个独立卦（巽/坤），不合并 */
    if (['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].indexOf(f) < 0) return '离';
    return XUAN_GUA[f] || '离';
  }

  function palacesOf(opts) {
    var o = opts || {};
    var facing = String(o.facing || 'S').toUpperCase();
    var gua = facingToGua(facing);
    /* 伏位：八卦数理 → 洛书宫数 */
    var fuNum = GUA_NUM[gua];
    var fuKey = null;
    PALACE_KEYS.forEach(function (k) {
      if (LUO_SHU[k] === fuNum) fuKey = k;
    });
    var fuIdx = Math.max(0, LUO_CYCLE.indexOf(fuKey || 'center'));

    var palaces = LUO_CYCLE.map(function (k, i) {
      return {
        key: k,
        palace: PALACE_CN[k],
        deg: PALACE_DEG[k],
        luoshu: LUO_SHU[k],
        /* 以伏位为原点，按洛书顺飞方向偏移 */
        star: STAR_CN[(LUO_SHU[LUO_CYCLE[(fuIdx + i) % 9]] - 1) % 9]
      };
    });

    /* 生气宫：伏位退一宫 */
    var shengIdx = (fuIdx + XUAN_OFFSET['生气'] + 9) % 9;
    var centerStar = STAR_CN[(LUO_SHU[LUO_CYCLE[shengIdx]] - 1) % 9];
    palaces.forEach(function (p) { p.gua = gua; });

    return {
      facing: facing,
      gua: gua,
      guaName: gua + '宅',
      fuPalace: PALACE_CN[LUO_CYCLE[fuIdx]],
      shengPalace: PALACE_CN[LUO_CYCLE[shengIdx]],
      centerStar: centerStar,
      palaces: palaces,
      note: '宅星按坐向起例，以' + gua + '宅的' + PALACE_CN[LUO_CYCLE[fuIdx]]
        + '为伏位，生气在' + PALACE_CN[LUO_CYCLE[shengIdx]]
        + '。各家起例与顺逆并不一致，此处仅作方位文化标注，'
        + '不表示该方位吉或凶，也不据此断言宅居吉凶与人丁祸福。'
    };
  }

  /* ==================== 门窗开口识别 ====================
   *
   * 做法：在二值化的墙线掩码上，四条外边各取一条「边线」，
   * 沿边扫描墨迹的连续段。**连续段＝墙**，
   * 墙与墙之间的空白段＝开口（门或窗）。
   *
   * 门与窗的区分不靠看图里的画法（画法千差万别），
   * 只看开口宽度：≥0.8 m 判门、<0.8 m 判窗。
   * 这是可复核的物理事实——人能走过去的洞是门，
   * 只透光的窄缝是窗。画不出这个区别的图纸，
   * 应该由用户在面板上改，而不是由算法猜。
   */
  function findOpenings(img) {
    if (!img || typeof img !== 'object') {
      throw new Error('缺少户型图像：无法识别门窗。');
    }
    var W = num(img.width), H = num(img.height);
    if (!(W > 0) || !(H > 0)) {
      throw new Error('图像尺寸无效，无法识别门窗。');
    }
    var data = img.data;
    if (!data || data.length < W * H * 3) {
      throw new Error('图像像素数据不完整，无法识别门窗。');
    }
    var ppm = num(img.ppm, 0) > 0 ? num(img.ppm) : W / 12;

    var gray = new Float64Array(W * H);
    var i;
    for (i = 0; i < W * H; i += 1) gray[i] = luma(data, i);
    var thr = otsu(gray);
    var sorted = Float64Array.from(gray).sort();
    var dyn = sorted[sorted.length - 1] - sorted[0];
    var inkThr = Math.min(254, thr + Math.max(2, dyn * 0.04));
    function isInk(x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      return gray[y * W + x] <= inkThr;
    }

    var MIN_OPEN_PX = Math.max(3, Math.round(0.35 * ppm));
    var out = [];

    /* 四条边：side、沿边坐标 t 的取值、以及墨迹点的取法 */
    var SIDES = [
      { side: 'N', t: 0, at: function (t) { return { x: t, y: 0 }; },
        fix: function (t, len) { return { x: t, y: 1.5 / ppm }; } },
      { side: 'S', t: 0, at: function (t) { return { x: t, y: H - 1 }; },
        fix: function (t, len) { return { x: t, y: len - 1.5 / ppm }; } },
      { side: 'W', t: 0, at: function (t) { return { x: 0, y: t }; },
        fix: function (t, len) { return { x: 1.5 / ppm, y: t }; } },
      { side: 'E', t: 0, at: function (t) { return { x: W - 1, y: t }; },
        fix: function (t, len) { return { x: len - 1.5 / ppm, y: t }; } }
    ];

    var planW = W / ppm, planH = H / ppm;

    SIDES.forEach(function (S) {
      var len = (S.side === 'N' || S.side === 'S') ? W : H;
      var segs = [];
      var run = null;
      for (var t = 0; t < len; t += 1) {
        var p = S.at(t);
        if (isInk(p.x, p.y)) {
          if (!run) run = { a: t, b: t };
          else run.b = t;
        } else {
          if (run) { segs.push(run); run = null; }
        }
      }
      if (run) segs.push(run);

      /* 边线上的空白段即开口。跳过两端各不足 1 像素的边角残留。 */
      var gaps = [];
      var cursor = 0;
      segs.forEach(function (s) {
        if (s.a - cursor >= MIN_OPEN_PX) gaps.push({ a: cursor, b: s.a });
        cursor = s.b + 1;
      });
      if (len - cursor >= MIN_OPEN_PX) gaps.push({ a: cursor, b: len - 1 });

      gaps.forEach(function (g) {
        var wPx = g.b - g.a + 1;
        if (wPx < MIN_OPEN_PX) return;
        var wM = wPx / ppm;
        var tMid = (g.a + g.b) / 2;
        var pos = S.fix(tMid, S.side === 'N' || S.side === 'S' ? planH : planW);
        var along = tMid / ppm;
        var total = (S.side === 'N' || S.side === 'S') ? planW : planH;
        out.push({
          kind: wM >= 0.8 ? 'door' : 'window',
          side: S.side,
          /* 沿墙的位置：从该墙左/北端算起的米数 */
          along: Math.round(along * 100) / 100,
          fromStart: Math.round(along * 100) / 100,
          fromEnd: Math.round((total - along) * 100) / 100,
          /* 离图纸中心的偏移，方便直接落成坐标 */
          offset: Math.round((along - total / 2) * 100) / 100,
          width: Math.round(wM * 100) / 100,
          /* 边上的位置：门在南墙用 y=深，窗在北墙用 y=0 */
          x: (S.side === 'N' || S.side === 'S') ? Math.round(pos.x * 100) / 100 : (S.side === 'W' ? 0 : planW),
          y: (S.side === 'W' || S.side === 'E') ? Math.round(pos.y * 100) / 100 : (S.side === 'N' ? 0 : planH),
          px: { a: g.a, b: g.b, len: wPx }
        });
      });
    });

    out.sort(function (a, b) {
      if (a.side !== b.side) return ['N', 'E', 'S', 'W'].indexOf(a.side) - ['N', 'E', 'S', 'W'].indexOf(b.side);
      return a.fromStart - b.fromStart;
    });
    return out;
  }

  /* ==================== 房间功能推断 ====================
   * 只用画得出来、量得出来的信息：面积、长宽比、位置（贴外墙与否）、
   * 与其他房间的邻接，以及同类房间在全宅里的数量。
   * 每条结论都带 basis（依据），用户能自己复核，也能改。
   */
  var KIND_RULE = {
    living: { minArea: 14, ratio: [0.62, 1.62] },
    bedroom: { minArea: 9, ratio: [0.5, 2.1], minSide: 2.7 },
    kitchen: { maxArea: 12, ratio: [0.5, 2.4] },
    bath: { maxArea: 8, ratio: [0.4, 2.8] },
    dining: { minArea: 8, maxArea: 26, ratio: [0.6, 2.2] },
    study: { minArea: 6, maxArea: 16, ratio: [0.5, 2.0] },
    storage: { maxArea: 6, ratio: [0.25, 4.5] },
    kids: { minArea: 8, maxArea: 18, ratio: [0.55, 1.9] },
    guest: { minArea: 8, maxArea: 18, ratio: [0.55, 1.9] },
    utility: { maxArea: 7, ratio: [0.5, 2.6] }
  };

  function inferRoomKinds(plan) {
    if (!plan || !Array.isArray(plan.rooms)) {
      throw new Error('缺少房间数据，无法推断房间功能。');
    }
    var W = num(plan.width, 0), D = num(plan.depth, 0);
    var facing = String(plan.facing || 'S').toUpperCase();
    /* 入户门在哪一侧，就那一侧的房间更可能是客厅/餐厅（入户过渡带） */
    var entrySide = entryOf(plan, W || 1, D || 1).side;

    var list = plan.rooms.map(function (r) {
      var w = num(r.w), h = num(r.h);
      var area = w * h;
      var ratio = Math.max(w, h) / Math.max(1e-6, Math.min(w, h));
      var outer = (r.x <= 0.05 || r.y <= 0.05
        || r.x + w >= W - 0.05 || r.y + h >= D - 0.05);
      return {
        src: r, id: String(r.id || ''), w: w, h: h, area: area, ratio: ratio, outer: outer,
        nearEntry: entrySide && (Math.abs(r.x - num(plan.entry && plan.entry.x, W / 2))
          + Math.abs(r.y - num(plan.entry && plan.entry.y, D / 2))) < 3.2
      };
    });

    var areas = list.map((r) => r.area).slice().sort(function (a, b) { return b - a; });
    var maxA = areas[0] || 0, minA = areas[areas.length - 1] || 0;

    return list.map(function (r, idx) {
      var cands = [];
      Object.keys(KIND_RULE).forEach(function (k) {
        var rule = KIND_RULE[k];
        var hit = true;
        if (rule.minArea != null && r.area < rule.minArea) hit = false;
        if (rule.maxArea != null && r.area > rule.maxArea) hit = false;
        if (rule.minSide != null && Math.min(r.w, r.h) < rule.minSide) hit = false;
        if (rule.ratio && (r.ratio < rule.ratio[0] || r.ratio > rule.ratio[1])) hit = false;
        if (hit) cands.push({ kind: k, score: 0 });
      });

      /* 几何证据打分：面积分位 + 长宽比分位 + 是否贴外墙 */
      cands.forEach(function (c) {
        var s = 0;
        s += (r.area / maxA) * 2;                        /* 越大越可能是公共区 */
        s += (1 / r.ratio) * 0.8;                       /* 越方正越可能是客厅 */
        if (r.outer) s += 0.5;                          /* 贴外墙多见于主要空间 */
        if (r.nearEntry) s += (c.kind === 'living' || c.kind === 'dining' ? 0.9 : 0);
        c.score = s;
      });
      cands.sort(function (a, b) { return b.score - a.score; });

      var best = cands[0];
      var kind = best ? best.kind : 'storage';
      var basis;

      if (r.area >= maxA - 1e-6 && r.area >= 14) {
        kind = 'living';
        basis = '全宅最大（' + r.area.toFixed(1) + ' m²）且长宽比 '
          + r.ratio.toFixed(2) + ' 接近方正，符合客厅的典型特征';
      } else if (r.area <= minA + 1e-6 && r.area <= 7 && r.ratio <= 2.6) {
        /* 最小的那间：靠面积与长宽比只能判到「小空间」，
           厨卫与储物都落在这个区间。这里不硬猜，
           只在确有依据时给倾向，并说明这是倾向而非结论。 */
        kind = r.area <= 6.5 ? 'bath' : 'storage';
        basis = '全宅最小（' + r.area.toFixed(1) + ' m²）、长宽比 '
          + r.ratio.toFixed(2) + '，落在厨卫或储物的常见区间；'
          + '仅凭平面图无法区分厨房与卫生间，请按实际装修确认';
      } else if (Math.min(r.w, r.h) < 2.7) {
        kind = r.ratio > 3 ? 'storage' : 'utility';
        basis = '最短边仅 ' + Math.min(r.w, r.h).toFixed(2)
          + ' m（低于卧室放床所需的 2.7 m），长宽比 ' + r.ratio.toFixed(2)
          + '，只能作储物或家政间';
      } else if (r.ratio <= 1.6 && r.area >= 13) {
        kind = r.nearEntry ? 'dining' : 'living';
        basis = '面积 ' + r.area.toFixed(1) + ' m²、长宽比 '
          + r.ratio.toFixed(2) + ' 接近方形'
          + (r.nearEntry ? '，且靠近入户门，符合餐厅或入户过渡区的位置' : '');
      } else if (r.area >= 9 && Math.min(r.w, r.h) >= 2.7) {
        kind = 'bedroom';
        basis = '面积 ' + r.area.toFixed(1) + ' m² ≥ 卧室下限 9 m²，'
          + '最短边 ' + Math.min(r.w, r.h).toFixed(2) + ' m ≥ 放床所需 2.7 m';
      } else {
        kind = 'storage';
        basis = '面积 ' + r.area.toFixed(1) + ' m²、长宽比 '
          + r.ratio.toFixed(2) + '，不满足任一主要功能的门槛，按储物处理';
      }

      /* 已在数据里明确写了 kind 的，保留用户的判断并注明 */
      if (r.src.kind && r.src.kind !== 'unknown') {
        return {
          id: r.id, name: r.src.name || r.id, kind: r.src.kind,
          confidence: 1, basis: '户型数据里已指定为「'
            + (KIND_CN[r.src.kind] || r.src.kind) + '」，按指定值采用',
          area: r.area, ratio: r.ratio, outer: r.outer, guessed: false
        };
      }
      return {
        id: r.id, name: r.src.name || r.id, kind: kind,
        confidence: clamp01(0.45 + Math.min(0.45, (best ? best.score : 0) / 6)),
        basis: basis,
        area: r.area, ratio: r.ratio, outer: r.outer, guessed: true
      };
    });
  }

  /* ==================== 图纸变换：旋转 / 镜像 / 缩放 ====================
   * 只接受 90° 的整数倍旋转与轴向镜像。
   * 任意角度会破坏「房间是轴对齐矩形」这个前提 ——
   * 上游所有几何实算（面积、采光、动线）都建立在轴对齐之上，
   * 悄悄给一个 37° 的结果比直接报错坏得多。
   */
  function transformPlan(plan, opts) {
    if (!plan || !Array.isArray(plan.rooms)) {
      throw new Error('缺少户型数据，无法变换图纸。');
    }
    var o = opts || {};
    var rot = num(o.rotate, 0) % 360;
    if (((rot % 90) + 90) % 90 !== 0) {
      throw new Error('旋转只接受 90° 的整数倍（0/90/180/270），收到 '
        + rot + '°。任意角度会破坏轴对齐前提，面积与采光结论将不再可信。');
    }
    if (rot < 0) rot += 360;
    var steps = rot / 90;

    var scale = num(o.scale, 1);
    if (!(scale > 0) || !Number.isFinite(scale)) {
      throw new Error('缩放倍数必须是正数，收到 ' + o.scale
        + '。0 或负数会把所有面积清零或翻负。');
    }
    if (scale > 50) {
      throw new Error('缩放倍数 ' + scale + ' 过大，会让坐标超出可处理范围。');
    }
    var mirrorX = !!o.mirrorX;
    var mirrorY = !!o.mirrorY;

    var W = num(plan.width), D = num(plan.depth);
    if (!(W > 0) || !(D > 0)) throw new Error('户型尺寸无效，无法变换。');

    var rooms = plan.rooms.map(function (r) {
      var x = num(r.x), y = num(r.y), w = num(r.w), h = num(r.h);
      /* 每个房间都从原始尺寸重新起算：
         若复用外层被交换过的 W/D，第二个房间起就会算在错的基础上。 */
      var wW = W, wD = D;
      for (var s = 0; s < steps; s += 1) {
        var nx = y;
        var ny = wW - (x + w);
        x = nx; y = ny;
        var tw = h, th = w;
        w = tw; h = th;
        var tW = wW; wW = wD; wD = tW;
      }
      /* 镜像（不交换宽高） */
      if (mirrorX) x = W - (x + w);
      if (mirrorY) y = D - (y + h);
      /* 最后统一缩放 */
      var out = {};
      Object.keys(r).forEach(function (k) { out[k] = r[k]; });
      out.x = x * scale;
      out.y = y * scale;
      out.w = w * scale;
      out.h = h * scale;
      return out;
    });

    var entry = plan.entry ? {
      x: num(plan.entry.x), y: num(plan.entry.y)
    } : null;
    if (entry) {
      /* 这里必须用未被交换过的原始尺寸 W0/D0：
         上面 rooms 循环已经把 W/D 原地交换过了，
         再拿它转一遍等于把整张图多旋了一次。 */
      var W0 = num(plan.width), D0 = num(plan.depth);
      for (var s2 = 0; s2 < steps; s2 += 1) {
        var ex = entry.y;
        var ey = W0 - entry.x;
        entry.x = ex; entry.y = ey;
        var tW2 = W0; W0 = D0; D0 = tW2;
      }
      var finW = steps % 2 === 0 ? num(plan.width) : num(plan.depth);
      var finD = steps % 2 === 0 ? num(plan.depth) : num(plan.width);
      if (mirrorX) entry.x = finW - entry.x;
      if (mirrorY) entry.y = finD - entry.y;
      entry.x *= scale; entry.y *= scale;
    }

    var out = {};
    Object.keys(plan).forEach(function (k) { out[k] = plan[k]; });
    out.width = (steps % 2 === 0 ? num(plan.width) : num(plan.depth)) * scale;
    out.depth = (steps % 2 === 0 ? num(plan.depth) : num(plan.width)) * scale;
    out.rooms = rooms;
    if (entry) out.entry = entry;
    out.transformed = {
      rotate: rot, scale: scale, mirrorX: mirrorX, mirrorY: mirrorY,
      note: '已按 ' + rot + '° 旋转' + (mirrorX ? '、左右镜像' : '')
        + (mirrorY ? '、上下镜像' : '') + '、缩放 ' + scale + ' 倍处理；'
        + '朝向请同步核对，八宅起星依赖坐向。'
    };
    return out;
  }

  /* ==================== 五行家具布局 ====================
   *
   * 分工要说清楚，否则就是把两套不相干的东西硬凑在一起：
   *   几何层（本函数做的）：床放哪儿有照有通风、床头不压梁、
   *     灶台不直冲入户门、书桌不背光。这些不依赖八字，
   *     谁都能自己量一遍复核。
   *   五行层（八字叠加时加的）：同朝向的床头朝哪边更贴合喜用神。
   *     这是传统命理的择吉用法，**只用于摆放朝向这一项**，
   *     不参与任何吉凶判断，也不动结构。
   *
   * 八字为可选输入。为空时全部走几何层，并明说「未叠加五行」。
   */
  var WX_COLOR = {
    木: { cn: '青绿', hex: '#4f9d6a' },
    火: { cn: '红紫', hex: '#d0604f' },
    土: { cn: '土黄棕', hex: '#c39a5b' },
    金: { cn: '白金银', hex: '#d8d2bd' },
    水: { cn: '黑蓝', hex: '#3f6d9e' }
  };

  /* 床的候选朝向，按「头不压窗、不背光」的常见做法排序 */
  var BED_FACING = [
    { dir: 'S', deg: 180 }, { dir: 'SE', deg: 135 }, { dir: 'E', deg: 90 },
    { dir: 'SW', deg: 225 }, { dir: 'W', deg: 270 }, { dir: 'N', deg: 0 },
    { dir: 'NE', deg: 45 }, { dir: 'NW', deg: 315 }
  ];

  function degToDir(deg) {
    var d = ((num(deg) % 360) + 360) % 360;
    var idx = Math.round(d / 45) % 8;
    return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][idx];
  }

  function dirToDeg(dir) {
    var m = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
    return m[String(dir || '').toUpperCase()];
  }

  /* 喜用神五行 → 摆放倾向的方位映射。
     取「该五行所旺之方」：木旺东、火旺南、土旺中、金旺西、水旺北。
     落不到单宫时退回对宫的生方，规则写在 plain 里让人能复核。 */
  var WX_PREFERRED_DIR = {
    木: { dir: 'E', why: '木旺于东' },
    火: { dir: 'S', why: '火旺于南' },
    土: { dir: 'center', why: '土旺于中宫（四正中央）' },
    金: { dir: 'W', why: '金旺于西' },
    水: { dir: 'N', why: '水旺于北' }
  };

  /* 「你是谁」的自述。八字字段缺失时返回 null，
     由调用方决定怎么措辞 —— 而不是把 undefined 拼进句子里。
     「日主undefined」这种话出现在给用户的建议里，比不说还糟。 */
  /* 「你的」前缀：拿不到自述就省掉整个前缀，
     而不是留下「你的null」这种比病句还糟的东西。 */
  function selfLead(bazi) {
    var me = selfOf(bazi);
    return me ? ('你的' + me + '，') : '';
  }

  function selfOf(bazi) {
    if (!bazi) return null;
    if (bazi.xingShui) return bazi.xingShui;
    if (bazi.dayWuXing) return '日主' + bazi.dayWuXing;
    return null;
  }

  function yongOf(bazi) {
    if (!bazi) return null;
    var y = bazi.yongshen || {};
    var wx = y['用神'] || y.yong || y.yongshen || null;
    if (!wx) {
      /* 退而求其次：取八字里最弱的一行作为「补」的倾向 */
      var sc = bazi.wuxingStat && bazi.wuxingStat.score;
      if (sc) {
        var keys = ['木', '火', '土', '金', '水'];
        var min = keys.slice().sort(function (a, b) { return sc[a] - sc[b]; })[0];
        return min;
      }
    }
    return wx || null;
  }

  function furniturePlan(analysis, bazi) {
    if (!analysis || !Array.isArray(analysis.rooms)) {
      throw new Error('需要一份 analyze() 的结果才能给出家具布局建议。');
    }
    var rooms = analysis.rooms;
    var wx = yongOf(bazi);
    var hasBazi = !!(wx && bazi);
    var W = num(analysis.width, 0), D = num(analysis.depth, 0);

    var out = [];
    function base(r, kind) { return { room: r.id, roomName: r.name, roomKind: kind }; }

    /* ---- 卧室：床 ---- */
    rooms.filter(function (r) { return r.kind === 'bedroom'; }).forEach(function (r) {
      /* 床头优先靠内墙（不靠外墙 = 不背窗、隔音好）。
         这里用「哪条边离外墙最远」近似 —— 靠内墙那一侧。 */
      var gaps = {
        W: r.x, E: W - (r.x + r.w), S: r.y, N: D - (r.y + r.h)
      };
      var wallSide = Object.keys(gaps).sort(function (a, b) { return gaps[b] - gaps[a]; })[0];
      var headDeg = dirToDeg(wallSide);
      var plainWall = '床头靠' + ({ W: '西侧', E: '东侧', S: '南侧', N: '北侧' }[wallSide])
        + '实墙，离窗'
        + gaps[wallSide].toFixed(1)
        + ' m。这样墙挡着，夜里翻身、外面的车声都不容易直接落到枕头上。';

      var facing = degToDir(headDeg + 180);
      var plain2 = '';
      if (hasBazi) {
        var pref = WX_PREFERRED_DIR[wx];
        var cur = facing;
        if (pref && pref.dir !== 'center') {
          /* 只有朝向偏好和几何朝向差 90° 以内才提「调整」，
             差太远就别提 —— 让人为了朝向去动床位，
             反而把「不靠窗」这个更实在的好处弄丢了。 */
          var diff = Math.abs(((dirToDeg(pref.dir) - dirToDeg(cur) + 540) % 360) - 180);
          if (diff >= 90) {
            facing = pref.dir;
            plain2 = selfLead(bazi)
              + '按喜用神取「' + wx + '」，' + wxColorText(wx) + pref.why
              + '，所以床的朝向优先往' + facingDirText(pref.dir) + '靠。';
          } else {
            plain2 = selfLead(bazi)
              + '喜用' + wx + '（' + pref.why + '），现在这个朝向已经够接近了，'
              + '不用为了朝向再挪床。';
          }
        } else if (pref && pref.dir === 'center') {
          plain2 = selfLead(bazi)
            + '喜用' + wx + '（' + pref.why + '）。'
            + '中宫是房屋正中，跟床头靠墙的要求不冲突，两条一起满足即可。';
        }
      } else {
        plain2 = '（未填出生年月，此处只按采光与通风的物理条件给建议。）';
      }

      out.push(merge(base(r, 'bedroom'), {
        item: '床',
        where: '贴' + ({ W: '西', E: '东', S: '南', N: '北' }[wallSide]) + '侧实墙摆放',
        facing: facingDirText(facing),
        facingDeg: dirToDeg(facing),
        /* 落点必须真落在所贴的那面墙线上，否则图上的点等于没定位。
           原写法是 r.x + r.w / 2 的三选一、三个分支值相同 ——
           贴西墙和贴东墙都落在房间正中，看着「有位置」，实际指不出东西。
           沿墙方向取房间中线，垂直于墙的方向顶到墙线。 */
        x: round2(wallSide === 'W' ? r.x
          : wallSide === 'E' ? r.x + r.w
          : r.x + r.w / 2),
        y: round2(wallSide === 'N' ? r.y
          : wallSide === 'S' ? r.y + r.h
          : r.y + r.h / 2),
        basis: '内墙距外沿 ' + gaps[wallSide].toFixed(1) + ' m（'
          + Object.keys(gaps).map(function (k) { return k + gaps[k].toFixed(1); }).join('、')
          + '）；采光 ' + r.daylight.toFixed(2) + '、通风 ' + r.ventilation.toFixed(2),
        plain: plainWall + plain2
      }));
    });

    /* ---- 客厅：沙发 ---- */
    rooms.filter(function (r) { return r.kind === 'living'; }).forEach(function (r) {
      var longest = r.w >= r.h ? 'W' : 'S';
      out.push(merge(base(r, 'living'), {
        item: '沙发',
        where: longest === 'W' ? '靠西侧实墙，横放' : '靠南侧实墙，横放',
        facing: facingDirText(longest === 'W' ? 'E' : 'N'),
        x: round2(longest === 'W' ? r.x + 0.6 : r.x + r.w / 2),
        y: round2(longest === 'W' ? r.y + r.h / 2 : r.y + 0.6),
        basis: '房间 ' + r.w.toFixed(1) + '×' + r.h.toFixed(1) + ' m，'
          + '最长边在' + (longest === 'W' ? '东西向' : '南北向')
          + '；采光 ' + r.daylight.toFixed(2),
        plain: '沙发顺着最长的那面墙放，背后有靠、看着也敞亮。'
          + '别把沙发堵在正对入户门的那条线上——进门一眼看见的是沙发背，'
          + '屋里就像少了一块；留出至少 ' + Math.max(0.9, Math.min(r.w, r.h) * 0.25).toFixed(1)
          + ' m 的进门过道，看着就敞亮。'
      }));
    });

    /* ---- 厨房：灶台 ---- */
    rooms.filter(function (r) { return r.kind === 'kitchen'; }).forEach(function (r) {
      /* 灶台不放在门口正对的那面：开门就撞灶，洗菜动线也回不去门口 */
      var doorSide = 'S';
      var wall = doorSide === 'S' ? 'N' : 'S';
      out.push(merge(base(r, 'kitchen'), {
        item: '灶台',
        where: '离门口最远的那面墙（' + ({ N: '内侧北墙', S: '内侧南墙' }[wall]) + '）',
        facing: facingDirText(doorSide),
        x: round2(r.x + r.w / 2),
        y: round2(wall === 'N' ? r.y + 0.6 : r.y + r.h - 0.6),
        basis: '厨房 ' + r.w.toFixed(1) + '×' + r.h.toFixed(1) + ' m，'
          + '通风 ' + r.ventilation.toFixed(2) + '（' + (r.ventType || '') + '）'
          + '、外窗 ' + (r.windows && r.windows.length ? r.windows.map(function (w) { return w.dir; }).join('') : '无'),
        plain: '灶台挪到离门口最远那面墙，一是炒菜油烟往屋里深处走、开门散不掉；'
          + '二是洗菜切菜的台面能连成一整条，不用来回转身。'
          + (r.windows && r.windows.length
            ? '这间有外窗（' + r.windows.map(function (w) { return w.dir; }).join('') + '），'
              + '油烟还能顺窗排掉，保持开窗就能散。'
            : '这间没有外窗，开门散油烟是唯一的路，所以更别把灶台对着门。')
      }));
    });

    /* ---- 卫生间：马桶与洗手台 ---- */
    rooms.filter(function (r) { return r.kind === 'bath'; }).forEach(function (r) {
      out.push(merge(base(r, 'bath'), {
        item: '马桶',
        where: '靠内侧墙角（进深最里面的那个角）',
        x: round2(r.x + r.w - 0.6),
        y: round2(r.y + r.h - 0.6),
        basis: '卫生间 ' + r.w.toFixed(1) + '×' + r.h.toFixed(1) + ' m，'
          + '通风 ' + r.ventilation.toFixed(2) + '（' + (r.ventType || '') + '）',
        plain: '马桶装进深最里侧的角，进门不直对着它。'
          + (r.ventilation < 0.2
            ? '这间通风指数只有 ' + r.ventilation.toFixed(2) + '，是全屋最容易返味的地方，'
              + '优先装排风扇，别靠开窗。'
            : '这间通风 ' + r.ventilation.toFixed(2) + '（' + (r.ventType || '') + '），'
              + '味道能自己散出去。')
      }));
      out.push(merge(base(r, 'bath'), {
        item: '洗手台',
        where: '进门后第一眼能看见的位置（门侧墙）',
        x: round2(r.x + 0.5),
        y: round2(r.y + r.h / 2),
        basis: '门侧留白对采光 ' + r.daylight.toFixed(2) + ' 的利用',
        plain: '洗手台放门侧，人一进来手就能洗到，不用走到最里面再折回来；'
          + '镜柜也装在这面墙上，光线从门口来，脸上看得清。'
      }));
    });

    /* ---- 书房/儿童房：书桌 ---- */
    rooms.filter(function (r) { return r.kind === 'study' || r.kind === 'kids'; }).forEach(function (r) {
      /* 书桌要侧光：整面墙都是窗会眩光，一面都没窗则太暗。
         取有外窗的那面墙的垂直方向摆。 */
      var winSide = (r.windows && r.windows.length)
        ? r.windows[0].dir : null;
      var side = 'W';
      if (winSide === 'E' || winSide === 'SE' || winSide === 'NE') side = 'W';
      else if (winSide === 'S') side = 'N';
      else if (winSide === 'N') side = 'S';
      out.push(merge(base(r, r.kind), {
        item: '书桌',
        where: '靠' + ({ W: '西', E: '东', S: '南', N: '北' }[side]) + '侧窗边，侧对窗户',
        facing: facingDirText(side === 'W' ? 'E' : side === 'E' ? 'W' : side === 'S' ? 'N' : 'S'),
        x: round2(side === 'W' ? r.x + 0.6 : side === 'E' ? r.x + r.w - 0.6 : r.x + r.w / 2),
        y: round2(r.y + r.h / 2),
        basis: '外窗在' + (winSide || '未识别到') + '，窗地比 '
          + (r.windowRatio * 100).toFixed(0) + '%，采光 ' + r.daylight.toFixed(2),
        plain: winSide
          ? '书桌侧对着窗，不要正对着。侧光不刺眼、写字时影子也不落在本子上；'
            + '背对窗更糟，人一抬头就是一片亮，纸反而看不清。'
          : '这间没识别到外窗，书桌要放在房间中央靠侧，配一盏护眼灯，'
            + '别只靠顶灯——顶灯在正上方，笔尖的影子正好落在纸上。'
      }));
    });

    out.forEach(function (f) {
      f.hasBazi = hasBazi;
      if (!f.basis) f.basis = '按房间几何实算';
    });
    return out;
  }

  function wxColorText(wx) {
    var c = WX_COLOR[wx];
    return c ? '五行属' + wx + '（' + c.cn + '）' : '';
  }

  function facingDirText(d) {
    var m = {
      N: '正北', NE: '东北', E: '正东', SE: '东南',
      S: '正南', SW: '西南', W: '正西', NW: '西北'
    };
    return m[String(d || '').toUpperCase()] || String(d || '');
  }

  function round2(v) { return Math.round(num(v) * 100) / 100; }

  function merge(a, b) {
    var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; });
    Object.keys(b).forEach(function (k) { o[k] = b[k]; });
    return o;
  }

  /* ==================== 挂画摆件开运布局 ====================
   *
   * 位置全部落在具体坐标上（房间内的相对位置），
   * 这样界面上能直接画出来，而不是给一句「放在客厅某处」。
   *
   * 边界：这是传统择吉的生活建议，说的是「怎么摆更顺眼、更有生气」，
   * 不承诺任何吉凶结果，也不要求改变房屋结构。
   */
  var DECOR_ITEMS = {
    living: [
      { what: '山水或流水画', pos: '沙发主墙的上方正中',
        rule: function (bazi) {
          var base = '山水属水，走「细水长流」的路子，配在客厅主墙能压住整屋的「燥」；'
            + '选横向长卷比竖幅好，横向铺开像把屋子撑宽了。';
          /* 有 bazi 不等于有 wx：BaziCore 在超出年份范围时会给出一个
             字段齐全但内容为空的八字。那种情况下必须退回 base，
             绝不能把 "喜用null" 印给用户。 */
          if (!bazi) return base;
          var wx = yongOf(bazi);
          if (!wx) return base;
          var pref = wx && WX_PREFERRED_DIR[wx];
          return '你是' + (bazi.xingShui || '') + '，喜用' + wx + '。'
            + (pref && pref.dir !== 'center'
              ? pref.why + '，所以画面主色取' + wxColorText(wx) + '——'
                + '画面最显眼的那块颜色对上你的用神，是民间「引气」的意思。'
              : '中宫属土，客厅主墙宜用土黄棕等沉稳色调压住，不宜大面积冷色。')
            + '山水属水，细水长流，配在主墙上整屋的节奏会缓下来。';
        } },
      { what: '圆形或半圆形摆件', pos: '客厅进深最里侧的墙角',
        rule: function () {
          return '圆的东西没有角，气是顺着走的；放在最里侧那个墙角，'
            + '等于把「角」这个最容易积气的地方圆过去。'
            + '注意别放在窗户正上方——挡光，也容易掉下来。';
        } },
      { what: '一盆大型绿植', pos: '采光最好那扇窗的内侧 0.6 m 处（不挡窗）',
        rule: function (r) {
          return '这间窗地比 ' + (r.windowRatio * 100).toFixed(0) + '%、采光 '
            + r.daylight.toFixed(2) + '。植物要光，所以放在窗内侧；'
            + '但要留出半个身位的距离，太贴窗会挡光，叶子也晒过头。'
            + '顺便说一句：植物吸不掉甲醛，别把它当净化器使。';
        } },
      { what: '玄关处小摆件或地毯', pos: '入户门内侧 0.5 m 处',
        rule: function () {
          return '进门这块地方是全屋最容易堆东西的地方。铺一张固定位置的地毯，'
            + '或放一个矮柜，脚下就有了「这里要停一下」的提示，'
            + '也顺手把进门直冲客厅的那条视线打断了一段。';
        } }
    ],
    bedroom: [
      { what: '床头挂画或软包', pos: '床头正上方的墙面',
        rule: function (bazi) {
          var base = '床头上方空一大片，视觉上会觉得房间没封口。'
            + '挂一幅中式的山水或花鸟，正对床头，人一睁眼看到的是让人安静的东西。'
            + '挂画别压着床沿，下沿离床头板留 20 cm 以上，夜里翻身不会磕到。';
          if (!bazi) return base;
          var wx = yongOf(bazi);
          if (!wx) return base;
          return base + '你是' + (bazi.xingShui || '') + '，喜用' + wx
            + '，画面主色可以往' + (WX_COLOR[wx] ? WX_COLOR[wx].cn : wx) + '上靠一点，'
            + '不用整张都是，能占三分之一就好。';
        } },
      { what: '床尾小柜或落地灯', pos: '床尾对侧墙，离床尾 0.6 m',
        rule: function (r) {
          return '床头那侧一般被衣柜占了，床头灯只能挂在墙上或者塞缝里。'
            + '在床尾加一个矮柜 + 落地灯，起夜不用摸黑走过去，'
            + '也不至于踩到地上东西。这间窗地比 '
            + (r.windowRatio * 100).toFixed(0) + '%，夜里先开这盏小的，别开顶灯晃眼。';
        } },
      { what: '衣柜顶上的收纳箱', pos: '衣柜顶部（够不到的位置）',
        rule: function () {
          return '衣柜顶上那层平时没人动，正好放换季的被子行李箱。'
            + '封住柜顶还有个实际好处：这间本来就小，柜顶堆成小山，'
            + '房间看着更逼仄；收干净了，视线能一直看到天花板。';
        } }
    ],
    kitchen: [
      { what: '厨具收纳架', pos: '灶台侧上方墙面',
        rule: function (r) {
          return '这间通风 ' + r.ventilation.toFixed(2) + '（' + (r.ventType || '') + '），'
            + (r.windows && r.windows.length
              ? '有外窗，油烟能顺窗散，架子上可以放常用调料，伸手就够。'
              : '没有外窗，架子上别放散装的东西——油烟全粘在上面，擦不掉。')
            + '台面空出来，切菜的地方才够大。';
        } },
      { what: '冰箱', pos: '厨房门口侧、离灶台至少 1.2 m',
        rule: function () {
          return '冰箱贴灶台，油烟一热就往冰箱里钻，压缩机还得多费电。'
            + '留 1.2 m 以上，门能全开、散热也够。'
            + '另外冰箱别正对门口：开门的人一抬头就是冰箱，屋里显得又窄又堵。';
        } }
    ],
    bath: [
      { what: '排气扇', pos: '卫生间顶面中心（或现有排风口）',
        rule: function (r) {
          return r.ventilation < 0.25
            ? '这间通风只有 ' + r.ventilation.toFixed(2) + '，是全屋最容易有味道的地方。'
              + '顶面装一个排气扇，记住这比任何摆件都有用——摆件不返味，风扇才返味。'
            : '这间通风 ' + r.ventilation.toFixed(2) + '（' + (r.ventType || '') + '），'
              + '顶上留一个排气扇做兜底，阴雨天关窗时靠它。';
        } },
      { what: '毛巾架与镜子', pos: '洗手台上方墙面',
        rule: function () {
          return '毛巾挂得离洗手台远一点、镜子正对灯。'
            + '这两样看着跟风水没关系，但卫生间返味、镜子起雾，'
            + '最后都让人不想在这个房间多待——住着别扭比摆件不对更影响心情。';
        } }
    ],
    dining: [
      { what: '餐边柜', pos: '餐桌长边一侧的墙面',
        rule: function () {
          return '餐桌四周都要留得下人拉椅子。餐边柜靠墙放，'
            + '把台面上的东西收进抽屉，桌面就干净了，'
            + '一家人吃饭也愿意多坐一会儿。';
        } }
    ]
  };

  var DECOR_FALLBACK = [{
    what: '一盏落地灯或小绿植',
    pos: '房间采光最弱的那处角落',
    rule: function (r) {
      return '这间采光 ' + r.daylight.toFixed(2) + '、窗地比 '
        + (r.windowRatio * 100).toFixed(0) + '%，是全屋最暗的地方。'
        + '补一盏暖色落地灯（2700K 左右），把光打在天花板上再散下来，'
        + '房间会亮一层，也比只开顶灯柔和。';
    }
  }];

  function decorPlan(analysis, bazi) {
    if (!analysis || !Array.isArray(analysis.rooms)) {
      throw new Error('需要一份 analyze() 的结果才能给出摆件建议。');
    }
    var out = [];
    analysis.rooms.forEach(function (r) {
      var list = DECOR_ITEMS[r.kind];
      if (!list) list = DECOR_FALLBACK;
      list.forEach(function (d) {
        var x, y;
        var w = num(r.w, 1), h = num(r.h, 1), rx = num(r.x, 0), ry = num(r.y, 0);
        if (r.kind === 'living') {
          if (/墙|玄关|角落|窗/.test(d.pos)) {
            x = round2(rx + w / 2);
            y = /玄关/.test(d.pos) ? round2(ry + 0.6) : round2(ry + h - 0.6);
          } else { x = round2(rx + w / 2); y = round2(ry + h / 2); }
        } else if (r.kind === 'bedroom') {
          if (/床头/.test(d.pos)) { x = round2(rx + w / 2); y = round2(ry + 0.6); }
          else if (/床尾/.test(d.pos)) { x = round2(rx + w / 2); y = round2(ry + h - 0.7); }
          else if (/衣柜/.test(d.pos)) { x = round2(rx + w - 0.7); y = round2(ry + 0.6); }
          else { x = round2(rx + w / 2); y = round2(ry + h / 2); }
        } else if (r.kind === 'kitchen') {
          if (/灶台/.test(d.pos)) { x = round2(rx + w / 2); y = round2(ry + 0.6); }
          else if (/冰箱|门口/.test(d.pos)) { x = round2(rx + 0.6); y = round2(ry + h - 0.6); }
          else { x = round2(rx + w / 2); y = round2(ry + 0.6); }
        } else if (r.kind === 'bath') {
          if (/顶面|排气/.test(d.pos)) { x = round2(rx + w / 2); y = round2(ry + h / 2); }
          else { x = round2(rx + 0.6); y = round2(ry + h / 2); }
        } else {
          x = round2(rx + w / 2); y = round2(ry + h / 2);
        }
        /* color / hasBazi 都以「真的取到用神」为准：
           bazi 对象存在但用神为空时，标成无五行才是事实，
           标成有五行却给不出颜色，界面上就会出现一个空色块。 */
        var wxHere = yongOf(bazi);
        out.push({
          what: d.what,
          where: d.pos,
          room: r.id,
          roomName: r.name,
          roomKind: r.kind,
          x: x,
          y: y,
          color: wxHere && WX_COLOR[wxHere] ? WX_COLOR[wxHere].cn : '',
          hasBazi: !!wxHere,
          plain: d.rule(r, bazi),
          basis: '房间 ' + num(r.w).toFixed(1) + '×' + num(r.h).toFixed(1)
            + ' m；采光 ' + r.daylight.toFixed(2) + '、通风 ' + r.ventilation.toFixed(2)
            + '、窗地比 ' + (r.windowRatio * 100).toFixed(0) + '%'
        });
      });
    });
    return out;
  }

  root.HouseScan = {
    version: 'house-scan-1.0.0',
    MOUNTAINS: MOUNTAINS,
    DIRECTIONS: DIRECTIONS,
    KIND_CN: KIND_CN,
    KIND_TARGET: KIND_TARGET,
    GROUP_CN: GROUP_CN,
    FACING_ANGLE: FACING_ANGLE,
    FACING_CN: FACING_CN,
    FACING_LIGHT: FACING_LIGHT,
    BOUNDARY: BOUNDARY,
    inspect: inspect,
    analyze: analyze,
    mountainAt: mountainAt,
    dirOf: dirOf,
    otsu: otsu,
    cornersOf: cornersOf,
    adjacent: adjacent,
    windowsOf: windowsOf,
    overlapArea: overlapArea,
    yearlyOf: yearlyOf,
    clamp: clamp,
    esc: esc,
    num: num,
    /* --- 第二阶段（任务 #20）：洛书九宫、八门、宅星起例 --- */
    LUO_SHU: LUO_SHU,
    PALACE_KEYS: PALACE_KEYS,
    PALACE_CN: PALACE_CN,
    PALACE_DEG: PALACE_DEG,
    BA_MEN: BA_MEN,
    STAR_CN: STAR_CN,
    WX_COLOR: WX_COLOR,
    palacesOf: palacesOf,
    /* --- 第二阶段：门窗开口、房间功能、图纸变换 --- */
    findOpenings: findOpenings,
    inferRoomKinds: inferRoomKinds,
    transformPlan: transformPlan,
    /* --- 第二阶段：五行家具布局、挂画摆件 --- */
    furniturePlan: furniturePlan,
    decorPlan: decorPlan
  };
})(typeof window !== 'undefined' ? window : globalThis);
