/* 玄机阁 · 掌纹形态记录
 *
 * 范围（严格遵守，不得越界）：
 *  - 只做**形态学量化**：走向角度、长度（按掌长归一）、深度、是否中断、
 *    起点终点位置。全部由用户输入的坐标实算得出。
 *  - 不做命理推断：不解释纹路与性格、命运、寿夭、疾病的关系，
 *    也不做照片识别或自动命相鉴定。
 *
 * 坐标系：掌心归一坐标（0~1，左上原点），与 morpheme.js 同一约定。
 *  palm 不含任何"命理输入"——没有生日、没有性别参与计算，
 *  这样从设计上就排除了"由输入推出命理结论"的可能。
 */
(function (root) {
  'use strict';

  var EPS = 1e-6;
  var TAU = Math.PI * 180;

  /* 边界声明与面相馆共用同一口径，避免一处允许一处禁止 */
  var BOUNDARY = '面相与掌纹属传统相术的观察术语，本模块只做文化标注与形态记录：'
    + '不做照片识别或自动命相鉴定，不据形貌推断性格、命运、贵贱与寿夭，'
    + '也不对任何个人下断语。';

  /* 三条主线 + 一条辅线。path 为归一坐标的 [from, to] 两点，
     实际绘制时用 bend 生成二次曲线，度量只按端点直线算——
     度量必须可复核，不能用曲线弧长这种无法手算的量。
     path 同时暴露出来，调用方不必知道内部是从 from/to 拼的。 */
  var LINES = [
    {
      key: 'life',
      name: '生命线',
      term: '掌主线之一，环绕拇指根部并向下绕行',
      note: '描述走向、起止位置与长度比例。手相文献据它联系体质与生活状态，'
        + '此处只记录形态，不采用那些推论。',
      from: [0.16, 0.94],
      to: [0.74, 0.16]
    },
    {
      key: 'head',
      name: '智慧线',
      term: '掌主线之二，自掌心向小指侧斜行',
      note: '描述其倾角与长度。手相文献多以此关联思维方式，属文化记录内容，'
        + '本模块不据此推断。',
      from: [0.18, 0.72],
      to: [0.80, 0.42]
    },
    {
      key: 'heart',
      name: '感情线',
      term: '掌主线之三，自掌下方向小指侧横斜行',
      note: '描述其位置高低与末端走向。相关的心性解释属传统附会，只作术语记录。',
      from: [0.28, 0.62],
      to: [0.78, 0.30]
    },
    {
      key: 'fate',
      name: '事业线（辅线）',
      term: '自掌根向中指方向的纵向纹，传统称事业线',
      note: '并非三大主线之一，故按辅线标注。多数人并不明显，'
        + '描述其是否出现与走向即可。',
      from: [0.62, 0.06],
      to: [0.66, 0.90],
      minor: true
    }
  ];

  function lines() {
    /* 返回副本并补上 path：{x, y} 形式的两端点。
       用对象而不是 [x, y] 数组，是为了让调用方（绘制层、脚本、测试）
       能直接按 pt.x / pt.y 取值，不必各自记一套下标约定。 */
    return LINES.map(function (x) {
      var c = { key: x.key, name: x.name, term: x.term, note: x.note };
      c.path = [
        { x: x.from[0], y: x.from[1] },
        { x: x.to[0], y: x.to[1] }
      ];
      if (x.minor) c.minor = true;
      return c;
    });
  }

  function validate(palm) {
    if (!palm || typeof palm !== 'object') throw new Error('请先提供掌纹数据。');
    if (!palm.lines || typeof palm.lines !== 'object') throw new Error('掌纹数据缺少纹路线。');
    var keys = Object.keys(palm.lines);
    /* 三条主线必须齐全；缺一条就画不出完整掌图，
       此时应当报错而不是悄悄用默认值补上——补出来的线是假的。 */
    ['life', 'head', 'heart'].forEach(function (k) {
      if (!palm.lines[k]) throw new Error('缺少主线「' + k + '」，无法绘制完整掌图。');
    });
    keys.forEach(function (k) {
      var l = palm.lines[k];
      if (!l || !Array.isArray(l.from) || !Array.isArray(l.to)) {
        throw new Error('纹路「' + k + '」缺少起点或终点。');
      }
      [l.from, l.to].forEach(function (pt) {
        if (!Array.isArray(pt) || pt.length !== 2
          || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
          throw new Error('纹路「' + k + '」的端点坐标无效。');
        }
        if (pt[0] < -EPS || pt[0] > 1 + EPS || pt[1] < -EPS || pt[1] > 1 + EPS) {
          throw new Error('纹路「' + k + '」的端点坐标越出掌心范围（应为 0~1）。');
        }
      });
      if (l.depth != null && (!Number.isFinite(l.depth) || l.depth <= 0)) {
        throw new Error('纹路「' + k + '」的深度必须为正数。');
      }
    });
    var size = palm.size == null ? 1 : Number(palm.size);
    if (!Number.isFinite(size) || size <= 0) throw new Error('掌形尺寸必须为正数。');
    return { size: size };
  }

  /* 端点直线距离（归一单位） */
  function dist(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  }

  /* 走向角：相对掌宽方向的夹角，取 −90°~90°。
     atan2 的结果在 (−180,180]，翻转 y 后需取负才能得到
     「向右为正、向上为负」的直觉角度。 */
  function heading(from, to) {
    return Math.atan2(-(to[1] - from[1]), to[0] - from[0]) / (Math.PI / 180);
  }

  /* 曲线生成：二次贝塞尔，控制点沿法线偏移 bend。
     bend 是相对端点长度的比例，这样不同长度的纹路弯曲程度一致。 */
  function curvePoints(from, to, bend, steps) {
    var n = steps || 24;
    var mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2;
    var dx = to[0] - from[0], dy = to[1] - from[1];
    var len = Math.hypot(dx, dy) || 1;
    /* 法线 = 端向量逆时针转 90° */
    var nx = -dy / len, ny = dx / len;
    var cx = mx + nx * bend * len, cy = my + ny * bend * len;
    var pts = [];
    for (var i = 0; i <= n; i += 1) {
      var t = i / n, u = 1 - t;
      pts.push([
        u * u * from[0] + 2 * u * t * cx + t * t * to[0],
        u * u * from[1] + 2 * u * t * cy + t * t * to[1]
      ]);
    }
    return { points: pts, control: [cx, cy] };
  }

  /* 中断判定：看折线相邻段的方向突变。
     只报形态事实（「在中段出现折角」），不解释含义。 */
  function detectBreak(pts) {
    var worst = 0, at = -1;
    for (var i = 1; i < pts.length - 1; i += 1) {
      var ax = pts[i][0] - pts[i - 1][0], ay = pts[i][1] - pts[i - 1][1];
      var bx = pts[i + 1][0] - pts[i][0], by = pts[i + 1][1] - pts[i][1];
      var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < EPS || lb < EPS) continue;
      var dot = (ax * bx + ay * by) / (la * lb);
      var turn = Math.acos(Math.max(-1, Math.min(1, dot))) / (Math.PI / 180);
      if (turn > worst) { worst = turn; at = i / (pts.length - 1); }
    }
    return { turn: worst, at: at, broken: worst > 32 };
  }

  function describe(palm) {
    var size = validate(palm);
    var out = [];
    LINES.forEach(function (meta) {
      var l = palm.lines[meta.key];
      /* 辅线缺失不是错误：多数人本就没有明显的事业线 */
      if (!l) return;
      var len = dist(l.from, l.to);
      var ang = heading(l.from, l.to);
      var bend = Number(l.bend || 0);
      var c = curvePoints(l.from, l.to, bend, 24);
      var brk = detectBreak(c.points);
      out.push({
        key: meta.key,
        name: meta.name,
        term: meta.term,
        note: meta.note,
        minor: !!meta.minor,
        from: l.from,
        to: l.to,
        bend: bend,
        points: c.points,
        control: c.control,
        length: len,
        heading: ang,
        depth: Number(l.depth == null ? 1 : l.depth),
        broken: brk.broken,
        turn: brk.turn,
        breakAt: brk.at
      });
    });
    if (!out.length) throw new Error('没有可用于测量的纹路数据。');

    /* 掌长基准：所有长度按它归一，才能跨手掌大小比较 */
    var handLength = out.reduce(function (n, x) { return Math.max(n, x.length); }, 0) || 1;

    var metrics = [];
    out.forEach(function (x) {
      metrics.push({
        key: x.key + 'Length',
        line: x.key,
        label: x.name + '长度',
        value: x.length / handLength,
        unit: '掌长倍数',
        basis: '端点直线距离 ÷ 本掌最长纹路长度（' + handLength.toFixed(3)
          + ' 归一单位），分子分母都在同一掌内，故与手掌大小无关。'
      });
      metrics.push({
        key: x.key + 'Heading',
        line: x.key,
        label: x.name + '走向',
        value: x.heading,
        unit: '度',
        basis: '自起点指向终点的方向角，水平向右为 0°，'
          + '向上为负、向下为正，按 atan2(−Δy, Δx) 换算，范围 ±90°。'
      });
    });

    var linesPer = metrics.filter(m => /Length/.test(m.key));
    var headings = metrics.filter(m => /Heading/.test(m.key));

    /* 结论条目：只陈述形态事实与可复核的量，不含任何解释性判断 */
    var notes = [];
    var longest = out.slice().sort(function (a, b) { return b.length - a.length; })[0];
    var steepest = out.slice().sort(function (a, b) {
      return Math.abs(b.heading) - Math.abs(a.heading);
    })[0];
    var brkLines = out.filter(function (x) { return x.broken; });

    notes.push({
      kind: 'measure',
      text: '本掌共记录 ' + out.length + ' 条纹路，其中主线 '
        + out.filter(function (x) { return !x.minor; }).length + ' 条。'
        + '最长的是' + longest.name + '，为掌长基准的 '
        + (longest.length / handLength).toFixed(2) + ' 倍。'
    });
    notes.push({
      kind: 'measure',
      text: '倾角最大的是' + steepest.name + '，走向 '
        + steepest.heading.toFixed(1) + '°。以上均为坐标实算值，可自行复核。'
    });
    notes.push({
      kind: 'shape',
      text: '各条纹路走向分别为：'
        + out.map(function (x) { return x.name + ' ' + x.heading.toFixed(1) + '°'; }).join('、')
        + '。走向角由端点坐标实算，纹路一改即随之改变。'
    });
    if (brkLines.length) {
      notes.push({
        kind: 'shape',
        text: '检测到 ' + brkLines.length + ' 条纹路在中段存在明显折角（'
          + brkLines.map(function (x) { return x.name; }).join('、')
          + '）。这是走向的形态描述，是否中断须结合实际观察判断。'
      });
    } else {
      notes.push({
        kind: 'shape',
        text: '各条纹路走向连续，未检测到明显折角。'
      });
    }
    notes.push({
      kind: 'limit',
      text: '以上仅为走向、长度与折角的形态记录。手相文献对这些纹路另有解释，'
        + '本模块不采用——形态观察不足以支持性格、命运或健康方面的推断。'
    });

    void linesPer; void headings;

    return {
      version: 'palm-1.0.0',
      boundary: BOUNDARY,
      size: size.size,
      handLength: handLength,
      lines: out,
      metrics: metrics,
      notes: notes
    };
  }

  root.Palm = {
    version: 'palm-1.0.0',
    BOUNDARY: BOUNDARY,
    lines: lines,
    describe: describe,
    curvePoints: curvePoints,
    dist: dist,
    heading: heading
  };
})(typeof window !== 'undefined' ? window : globalThis);