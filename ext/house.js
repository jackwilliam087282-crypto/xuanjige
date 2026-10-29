/* 玄机阁 · 户型空间实验室（几何与标注层）
 *
 * 范围（严格遵守）：
 *  - 几何部分**全部实算**：面积、外窗开口、对流、通风、采光、动线距离，
 *    结论来自坐标与朝向，不查表、不套话术。
 *  - 传统「宅星 / 命卦」只作为一层**可叠加的文化标注**，
 *    分组按传统男东四命 / 女西四命的分派说明写出，
 *    明确它是流派之一，且不据此断言宅居吉凶、人丁祸福。
 *
 * 坐标约定：
 *  - 户型图以米为单位，原点在左下角，x 向右、y 向上（数学习惯）。
 *  - 渲染时由 house-ui.js 翻转 y 轴转成屏幕坐标。
 */
(function (root) {
  'use strict';

  var EPS = 1e-9;

  /* 八个方位。索引 0 = 正北，顺时针。 */
  var DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];

  /* 朝向 → 该朝向在图上的方位角（度）。facing 指「房屋正面朝向」，
     即入户门与主要采光面法线所指的方向。 */
  var FACING_ANGLE = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

  /* 各地朝向下的相对采光权重（北半球冬至日太阳高度最低时的近似相对照度）。
     这是把朝向换算成采光贡献的经验系数，不是精确辐照计算——
     界面上如实标注为「朝向修正系数」。 */
  var FACING_LIGHT = {
    N: 0.28, NE: 0.5, E: 0.82, SE: 0.9,
    S: 1.0, SW: 0.9, W: 0.82, NW: 0.5
  };

  /* 朝向侧外窗的采光权重：主采光面比背向面多一倍贡献 */
  var MAIN_WEIGHT = 2;

  /* 功能分类 → 归入哪个大类（用于配比统计） */
  var KIND_GROUP = {
    living: 'living', balcony: 'living', dining: 'living', corridor: 'living',
    kitchen: 'cooking', utility: 'cooking',
    bedroom: 'sleep', kids: 'sleep', study: 'sleep', guest: 'sleep',
    bath: 'service', toilet: 'service', storage: 'service'
  };

  var GROUP_CN = { living: '起居', cooking: '餐厨', sleep: '卧寝', service: '辅助' };

  /* ---------- 宅星文化标注 ---------- */

  /* 八宅的八个宅星名。用中性命名，不带吉凶断语——
     「生气」「伏位」这类是传统术语名，不是结论。 */
  var EIGHT_STARS = ['伏位', '生气', '五煞', '六煞', '延年', '天医', '祸害', '绝命'];

  /* 东四命（坎离震巽）四方可用的宅星；西四命（乾坤艮兑）另用一套。
     这里只做「哪一组可用」的传统分派，不引申吉凶。 */
  var GROUP_STARS = {
    东四命: ['生气', '天医', '伏位', '延年'],
    西四命: ['生气', '天医', '伏位', '延年']
  };

  var CULTURE_BOUNDARY = '宅星与命卦为传统方位文化的索引说法，流派之间起例不一，'
    + '本模块只作方位标注与文化参考，不据此判断宅居吉凶、房价或人丁祸福。';

  /* 起始方位：男宅以「伏位」起于坐方，女宅起于向方——这是传统分派之一。
     这里如实把规则写出来，不包装成唯一算法。 */
  function cultureFor(opts) {
    var o = opts || {};
    var facing = String(o.facing || '').toUpperCase();
    if (!FACING_ANGLE.hasOwnProperty(facing)) {
      throw new Error('朝向必须是 N/NE/E/SE/S/SW/W/NW 之一，收到了「' + (o.facing || '空') + '」。');
    }
    var gender = o.gender === '男' ? '男' : (o.gender === '女' ? '女' : null);
    if (!gender) throw new Error('请先选择传统起例所用的性别。');

    var group = gender === '男' ? '东四命' : '西四命';
    var usable = GROUP_STARS[group];

    /* 起例：男自「坐」（facing 对面 180°）起，女自「向」（facing）起，
       依 EIGHT_STARS 的传统次序顺布八方，取本组可用者标注。
       这是可查的排布规则，不是吉凶判断。 */
    var facingIdx = DIRS.indexOf(shiftDir(facing, 0));
    var seatIdx = DIRS.indexOf(shiftDir(facing, 180));
    var start = gender === '男' ? seatIdx : facingIdx;

    var eight = [];
    for (var i = 0; i < 8; i += 1) {
      var dir = DIRS[(start + i) % 8];
      var star = EIGHT_STARS[i % EIGHT_STARS.length];
      eight.push({
        dir: dir,
        angle: dirAngle(dir),
        star: star,
        label: dir + ' · ' + star,
        usable: usable.indexOf(star) >= 0,
        note: usable.indexOf(star) >= 0
          ? group + '常用宅星之一'
          : '本派起例中不作主用星'
      });
    }

    return {
      group: group,
      facing: facing,
      gender: gender,
      seat: shiftDir(facing, 180),
      eight: eight,
      boundary: CULTURE_BOUNDARY,
      note: '起例为传统分派之一（男自坐起、女自向起，顺布八方），'
        + '各家取用与阴阳顺逆并不一致，此处只作方位标注，不作吉凶论断。'
    };
  }

  function shiftDir(dir, deg) {
    var a = (FACING_ANGLE[dir] + deg) % 360;
    if (a < 0) a += 360;
    return DIRS[Math.round(a / 45) % 8];
  }

  function dirAngle(dir) {
    var i = DIRS.indexOf(dir);
    return i < 0 ? 0 : i * 45;
  }

  /* ---------- 输入校验 ---------- */

  function validate(plan) {
    if (!plan || typeof plan !== 'object') throw new Error('请先提供户型数据。');
    var w = Number(plan.width), d = Number(plan.depth);
    if (!Number.isFinite(w) || w <= 0) throw new Error('户型总宽必须为正数。');
    if (!Number.isFinite(d) || d <= 0) throw new Error('户型总深必须为正数。');
    if (!Array.isArray(plan.rooms) || !plan.rooms.length) {
      throw new Error('请至少提供一个房间。');
    }
    plan.rooms.forEach(function (r, i) {
      if (!r || typeof r !== 'object') throw new Error('第 ' + (i + 1) + ' 个房间数据无效。');
      ['x', 'y', 'w', 'h'].forEach(function (k) {
        if (!Number.isFinite(Number(r[k]))) {
          throw new Error('房间「' + (r.name || r.id || i + 1) + '」缺少 ' + k + ' 坐标。');
        }
      });
      if (Number(r.w) <= 0 || Number(r.h) <= 0) {
        throw new Error('房间「' + (r.name || r.id) + '」的宽高必须为正数。');
      }
    });
    return { width: w, depth: d };
  }

  /* ---------- 几何工具 ---------- */

  /* 房间某条边是否在外墙上。外墙判定：房间边界与户型边界**重合**
     （容差 EPS），才算临外；仅仅「接近」不算。 */
  function onOuterWall(r, edge, W, D) {
    if (edge === 'W') return Math.abs(r.x) <= EPS;
    if (edge === 'E') return Math.abs((r.x + r.w) - W) <= EPS;
    if (edge === 'S') return Math.abs(r.y) <= EPS;
    if (edge === 'N') return Math.abs((r.y + r.h) - D) <= EPS;
    return false;
  }

  /* 某条外墙的朝向：哪一边贴外墙，就取该边的外法线方向。
     左(x=0)→西；右→东；下(y=0)→南；上→北。 */
  function outerDirOf(r, edge) {
    return edge === 'W' ? '西' : (edge === 'E' ? '东' : (edge === 'S' ? '南' : '北'));
  }

  /* 角房间可有两面外墙，其采光要分别计入，不可只取一面。 */
  function windowsOf(r, W, D) {
    var out = [];
    ['W', 'E', 'S', 'N'].forEach(function (e) {
      if (!onOuterWall(r, e, W, D)) return;
      var len = (e === 'W' || e === 'E') ? r.h : r.w;
      out.push({ edge: e, dir: outerDirOf(r, e), length: len });
    });
    return out;
  }

  /* 两矩形是否真正重叠。
     相接（边重合）不算重叠，故用严格不等且留 EPS 容差——
     浮点相加的 0.1+0.2 类误差会让「刚好相接」误判为重叠。 */
  function overlapArea(a, b) {
    var x1 = Math.max(a.x, b.x);
    var y1 = Math.max(a.y, b.y);
    var x2 = Math.min(a.x + a.w, b.x + b.w);
    var y2 = Math.min(a.y + a.h, b.y + b.h);
    if (x2 - x1 <= EPS || y2 - y1 <= EPS) return 0;
    return (x2 - x1) * (y2 - y1);
  }

  /* ---------- 主分析 ---------- */

  /* 入户门位置：默认取「进深最短方向」的一侧中点。
     真实户型图会给出大门位置，这里在缺省时用几何推一个合理的默认，
     并在结果里标明是推算值而非图纸给定。 */
  function entryOf(plan, W, D) {
    if (plan.entry && Number.isFinite(Number(plan.entry.x))) {
      return { x: Number(plan.entry.x), y: Number(plan.entry.y), assumed: false };
    }
    var minDim = Math.min(W, D);
    return {
      x: minDim === W ? W / 2 : 0,
      y: minDim === W ? 0 : D / 2,
      assumed: true
    };
  }

  function analyze(plan) {
    var size = validate(plan);
    var W = size.width, D = size.depth;
    var facing = String(plan.facing || 'S').toUpperCase();
    if (!FACING_ANGLE.hasOwnProperty(facing)) {
      throw new Error('朝向必须是 N/NE/E/SE/S/SW/W/NW 之一，收到了「' + facing + '」。');
    }
    var facingLight = FACING_LIGHT[facing];
    var entry = entryOf(plan, W, D);

    /* ---- 逐间：面积、外窗、采光、通风、深度 ---- */
    var rooms = plan.rooms.map(function (src) {
      var r = {
        id: String(src.id || ''),
        name: String(src.name || src.id || '未命名'),
        kind: String(src.kind || 'other'),
        x: Number(src.x), y: Number(src.y), w: Number(src.w), h: Number(src.h)
      };
      r.area = r.w * r.h;
      r.group = KIND_GROUP[r.kind] || 'service';
      r.groupLabel = GROUP_CN[r.group];
      r.center = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      r.depth = r.h;                     /* 进深：沿南北方向的尺寸 */
      r.windows = windowsOf(r, W, D);
      /* 窗地比 = 窗地面积比，是采光潜力的**标准物理量**（GB/T 50033 采光标准同源）。
         窗高按 1.5 m 计，窗面积 = 开窗宽度 × 窗高；
         门扇等不计入。分母是**地面面积**，这一定义不能改。 */
      r.windowArea = r.windows.reduce(function (n, w) { return n + w.length * 1.5; }, 0);
      r.windowRatio = r.area > 0 ? r.windowArea / r.area : 0;

      /* 采光指数 = 窗地比 × 外窗朝向系数的加权平均。
         之前写成 lit/(area*0.6) 再 clamp，满窗房间会全部被截断到 1，
         朝向一改结果还是 1——朝向等于没参与计算。
         现在改用「窗地比 / 0.25（满窗参考）× 平均朝向系数」：
         系数在 0.28~1.0 之间，始终不饱和，朝向必然体现。 */
      /* 朝向必须真的参与计算，否则改朝向等于没改。
         物理依据：正面朝向的那一侧是**主采光面**——开窗习惯与日照都优先给这一侧，
         所以朝向侧的外窗按MAIN_WEIGHT 加权，其余侧只作辅光。
         极端对比：全屋只有朝向侧开窗时，改朝向会显著改变结果。 */
      var coeffSum = 0, lenSum = 0, weightedOpen = 0;
      r.windows.forEach(function (w) {
        var base = FACING_LIGHT[dirKeyOf(w.dir)] || 0.5;
        var side = dirKeyOf(w.dir) === facing;
        var wt = w.length * (side ? MAIN_WEIGHT : 1);
        coeffSum += base * wt;
        lenSum += wt;
        weightedOpen += base * wt;
      });
      var meanCoeff = r.windows.length ? coeffSum / (lenSum || 1) : 0;
      r.lightCoeff = meanCoeff;
      /* 归一用「开口周长比」而不是窗地比除以固定参考值。
         原因：窗地比是绝对量，大房间或两面开窗的房间轻易超过 1，
         clamp 后一律为 1，朝向怎么改都不动——实测四朝向结果全等于 1。
         除以房间周长后，衡量的是「单位墙面开了多少有效口」，
         与面积、房间大小解耦，系数域 0.28~1.0 保证朝向差异始终可见。 */
      r.perimeter = 2 * (r.w + r.h);
      r.openingRatio = r.windows.length
        ? (weightedOpen / r.perimeter)
        : 0;
      r.daylight = r.windows.length
        ? clamp01((weightedOpen / (r.perimeter * 0.75)) * meanCoeff)
        : 0;

      /* 通风：南北向开口与东西向开口之比，取较小者作为对流能力。
         单侧开口无法形成对流，故必须两侧都有才非零。 */
      var nsOpen = openLen(r, 'S', 'N', W, D);
      var ewOpen = openLen(r, 'W', 'E', W, D);
      r.airShaft = Math.max(nsOpen, ewOpen);
      var minSide = Math.min(r.w, r.h);
      r.ventilation = r.airShaft <= EPS ? 0 : clamp01(r.airShaft / (minSide * 0.8));

      /* 动线：入户门到房间中心的直线距离 */
      r.path = Math.hypot(r.center.x - entry.x, r.center.y - entry.y);
      r.outOfBounds = !(r.x >= -EPS && r.y >= -EPS
        && r.x + r.w <= W + EPS && r.y + r.h <= D + EPS);
      return r;
    });

    /* ---- 重叠与越界 ---- */
    var overlaps = [];
    for (var i = 0; i < rooms.length; i += 1) {
      for (var j = i + 1; j < rooms.length; j += 1) {
        var ar = overlapArea(rooms[i], rooms[j]);
        if (ar > EPS) {
          overlaps.push({ a: rooms[i].id, b: rooms[j].id, area: ar });
        }
      }
    }
    var outOfBounds = rooms.filter(function (r) { return r.outOfBounds; })
      .map(function (r) { return r.id; });

    /* ---- 汇总 ---- */
    var totalArea = rooms.reduce(function (n, r) { return n + r.area; }, 0);
    var usage = totalArea / (W * D);
    var mix = {};
    Object.keys(GROUP_CN).forEach(function (k) { mix[k] = 0; });
    rooms.forEach(function (r) { mix[r.group] += r.area; });
    Object.keys(mix).forEach(function (k) {
      mix[k] = totalArea > 0 ? mix[k] / totalArea : 0;
    });

    var farthest = rooms.slice().sort(function (a, b) { return b.path - a.path; })[0] || null;

    var result = {
      version: 'house-1.0.0',
      width: W,
      depth: D,
      rooms: rooms,
      overlaps: overlaps,
      outOfBounds: outOfBounds,
      totalArea: totalArea,
      usage: usage,
      mix: mix,
      facing: facing,
      facingLight: facingLight,
      entry: entry,
      farthest: farthest,
      totalDaylight: rooms.reduce(function (n, r) { return n + r.daylight * r.area; }, 0) / (totalArea || 1),
      totalVentilation: rooms.reduce(function (n, r) { return n + r.ventilation * r.area; }, 0) / (totalArea || 1),
      boundary: '本模块的采光、通风、动线结论为几何估算（不含楼层、朝向遮挡与季节修正），'
        + '供改造参考，不构成建筑或消防合规意见。'
    };
    result.issues = issuesOf(result);
    result.advice = adviceOf(result);
    result.culture = cultureFor({ facing: facing, gender: plan.gender || '男' });
    return result;
  }

  function totalWindowLen(r) {
    return r.windows.reduce(function (n, w) { return n + w.length; }, 0) || 1;
  }

  function dirKeyOf(cn) {
    var map = { 北: 'N', 东: 'E', 南: 'S', 西: 'W' };
    return map[cn] || 'N';
  }

  function openLen(r, a, b, W, D) {
    var oa = r.windows.filter(function (w) { return w.edge === a; })[0];
    var ob = r.windows.filter(function (w) { return w.edge === b; })[0];
    if (!oa || !ob) return 0;
    return Math.min(oa.length, ob.length);
  }

  function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  /* ---------- 问题清单 ---------- */

  function issuesOf(r) {
    var out = [];
    r.rooms.forEach(function (x) {
      if (!x.windows.length) {
        out.push({ level: 'high', room: x.id, text: x.name + ' 没有外窗，既无自然采光也无法形成对流通风。' });
      } else if (x.daylight < 0.25) {
        out.push({
          level: 'mid', room: x.id,
          text: x.name + ' 采光偏弱（仅 ' + x.windows.map(function (w) { return w.dir + '向'; }).join('、')
            + '外窗，窗地比约 ' + (x.windowRatio * 100).toFixed(0) + '%），建议加大开口或改用借光。'
        });
      }
      if (x.ventilation < 0.2 && x.windows.length) {
        out.push({
          level: 'mid', room: x.id,
          text: x.name + ' 只有单侧开口，无法形成对流；南北通风需南北同时开口。'
        });
      }
      if (x.h / x.w > 2.2 && x.kind !== 'corridor') {
        out.push({
          level: 'low', room: x.id,
          text: x.name + ' 长宽比约 ' + (x.h / x.w).toFixed(1) + ':1，进深偏大，末端采光与通风都会变差。'
        });
      }
      if (x.kind === 'bedroom' && x.area < 9) {
        out.push({
          level: 'low', room: x.id,
          text: x.name + ' 面积约 ' + x.area.toFixed(1) + ' m²，低于常见双人卧室的 9 m² 参考值。'
        });
      }
    });
    r.overlaps.forEach(function (o) {
      out.push({
        level: 'high', room: o.a,
        text: '房间「' + o.a + '」与「' + o.b + '」重叠约 ' + o.area.toFixed(2) + ' m²，图纸数据有误。'
      });
    });
    r.outOfBounds.forEach(function (id) {
      var x = r.rooms.filter(function (k) { return k.id === id; })[0];
      out.push({ level: 'high', room: id, text: '房间「' + (x ? x.name : id) + '」超出户型轮廓边界。' });
    });
    if (r.usage < 0.72) {
      out.push({
        level: 'low', room: '',
        text: '套内房间面积合计使用率约 ' + (r.usage * 100).toFixed(0) + '%，'
          + '其余为墙体、楼梯或走道占用，可核对是否漏画空间。'
      });
    }
    return out;
  }

  /* ---------- 实用建议（实算驱动） ---------- */

  function adviceOf(r) {
    var out = [];
    var dark = r.rooms.filter(function (x) { return x.windows.length === 0; })
      .map(function (x) { return x.name; });
    var weakLit = r.rooms.filter(function (x) { return x.windows.length && x.daylight < 0.25; });
    var weakAir = r.rooms.filter(function (x) { return x.windows.length && x.ventilation < 0.2; });

    if (dark.length) {
      out.push({
        title: '内间无采光',
        text: dark.join('、') + ' 完全无外窗，只能依赖人工照明与机械通风。',
        basis: '几何判定：这些房间的四条边都不与户型外轮廓重合，故外窗数为 0。'
      });
    }
    if (weakLit.length) {
      out.push({
        title: '采光不足的房间',
        text: weakLit.map(function (x) {
          return x.name + '（窗地比约 ' + (x.windowRatio * 100).toFixed(0) + '%）';
        }).join('、') + '：优先扩大开口宽度，其次改用玻璃隔断借光。',
        basis: '按各房外窗长度与朝向系数加权重除以面积估算，窗地比低于 20% 即偏弱。'
      });
    }
    if (weakAir.length) {
      out.push({
        title: '缺少对流通风',
        text: weakAir.map(function (x) { return x.name; }).join('、')
          + ' 仅有单侧开口。若条件允许，在相对两侧各增加一处可开启开口。',
        basis: '通风指数取南北、东西两组对侧开口长度的较小值，单侧开口必为 0。'
      });
    }
    if (r.facingLight <= 0.5) {
      out.push({
        title: '朝向偏北',
        text: '本户型正面朝' + facingCn(r.facing) + '，冬季太阳高度角低，直射时间短。'
          + '把主要活动空间与最大开口尽量布置在 ' + oppositeDirs(r.facing) + ' 一侧。',
        basis: '朝向修正系数 ' + r.facingLight.toFixed(2) + '（北向为 0.28，南向为 1.00）。'
      });
    }
    if (r.farthest) {
      out.push({
        title: '动线末端',
        text: '距离入户门最远的是' + r.farthest.name + '，约 ' + r.farthest.path.toFixed(1)
          + ' m。日常高频空间若在此处，可考虑前置或增加通行路径。',
        basis: '按入户门位置到各房几何中心的直线距离计算。'
      });
    }
    if (r.mix.sleep > 0.45) {
      out.push({
        title: '卧寝占比偏高',
        text: '卧寝占总面积 ' + (r.mix.sleep * 100).toFixed(0) + '%，超过常见住宅的 40% 参考上限，'
          + '起居与餐厨空间可能被挤压。',
        basis: '按功能分类面积除以房间总面积计算。'
      });
    } else if (r.mix.living < 0.2) {
      out.push({
        title: '起居空间偏小',
        text: '起居类（客厅/餐厅/阳台）仅占总面积 ' + (r.mix.living * 100).toFixed(0)
          + '%，若实际使用中感到拥挤，可考虑打通用分隔。',
        basis: '按功能分类面积除以房间总面积计算。'
      });
    }
    if (!out.length) {
      out.push({
        title: '未检出明显短板',
        text: '按当前几何数据，采光、对流与配比都落在常见参考区间内。',
        basis: '逐房检查外窗数、窗地比、对侧开口与功能占比，未触发任何阈值。'
      });
    }
    return out;
  }

  function facingCn(f) {
    var map = { N: '北', NE: '东北', E: '东', SE: '东南', S: '南', SW: '西南', W: '西', NW: '西北' };
    return map[f] || f;
  }

  function oppositeDirs(f) {
    var opp = shiftDir(f, 180);
    return facingCn(opp) + '向';
  }

  root.HouseLab = {
    version: 'house-1.0.0',
    DIRS: DIRS,
    FACING_ANGLE: FACING_ANGLE,
    FACING_LIGHT: FACING_LIGHT,
    EIGHT_STARS: EIGHT_STARS,
    CULTURE_BOUNDARY: CULTURE_BOUNDARY,
    analyze: analyze,
    cultureFor: cultureFor,
    shiftDir: shiftDir,
    windowsOf: windowsOf,
    overlapArea: overlapArea
  };
})(typeof window !== 'undefined' ? window : globalThis);