/* ============================================================
 * cosmos.js —— 宇宙星云背景引擎（1.8.0 新增）
 *
 * 用途：为 visual-fx.js 的五个模块提供「像参考图那样」的深空星云底图。
 * 参考图特征拆解：
 *   1) 深蓝到近黑的多层径向渐变（不是单一色块）；
 *   2) 若干团块状星云（nebula），边缘柔和、缓慢流动；
 *   3) 三层视差星点：远层小而暗、近层大而亮，亮度各自独立呼吸；
 *   4) 少量「亮星」带十字光芒（bloom spike），是神秘感的关键；
 *   5) 极低频的色相漂移，整体呼吸，避免死板。
 *
 * 关键设计：所有随机量在 seed 时一次性生成并缓存，
 * 之后每帧只做相位推进，不重新摇随机数 —— 既保证每帧稳定，
 * 又避免帧率波动导致的画面抖动。
 * ============================================================ */
(function (root) {
  'use strict';

  /** 简易确定性伪随机（同一 seed 必得同一序列），保证背景可复现 */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 星云团块：若干大尺度柔和光斑 ---------- */

  function makeNebula(seed) {
    const rnd = mulberry32(seed);
    const N = 5;
    const blobs = [];
    for (let i = 0; i < N; i++) {
      /* 色相偏向参考图的蓝紫/青白，少量暖橙作点缀 */
      const hueChoice = rnd();
      const hue = hueChoice < 0.42 ? 218 + rnd() * 18        /* 蓝 */
        : hueChoice < 0.72 ? 258 + rnd() * 26               /* 紫 */
          : hueChoice < 0.9 ? 188 + rnd() * 20              /* 青 */
            : 26 + rnd() * 14;                              /* 暖橙点缀 */
      blobs.push({
        x: 8 + rnd() * 84,
        y: 8 + rnd() * 84,
        r: 26 + rnd() * 40,                                 /* 半径（占画布 %） */
        hue: hue,
        sat: 45 + rnd() * 30,
        lum: 22 + rnd() * 16,
        alpha: 0.16 + rnd() * 0.20,
        /* 极缓慢漂移：振幅 1~3%，周期 40~90 秒，视觉上几乎察觉不到但能「活」 */
        dx: (rnd() - 0.5) * 2.4,
        dy: (rnd() - 0.5) * 2.0,
        spd: 0.011 + rnd() * 0.014,
        ph: rnd() * Math.PI * 2
      });
    }
    return blobs;
  }

  /* ---------- 星点：三层视差 ---------- */

  function makeStars(seed, count) {
    const rnd = mulberry32(seed);
    const stars = [];
    for (let i = 0; i < count; i++) {
      /* layer: 0 远（小/暗/多） 1 中  2 近（大/亮/少，带光芒） */
      const lr = rnd();
      const layer = lr < 0.56 ? 0 : (lr < 0.87 ? 1 : 2);
      const base = layer === 0 ? 0.42 : (layer === 1 ? 0.78 : 1.25);
      /* 是否为「会自己闪」的星星（约三成） */
      const TW = rnd() < 0.30;
      stars.push({
        x: rnd() * 100,
        y: rnd() * 100,
        layer: layer,
        r: base * (0.5 + rnd() * 0.85),
        /* 各星独立初相，避免「一起闪」的廉价感 */
        ph: rnd() * Math.PI * 2,
        /* 【1.8.1】闪烁强度分档，让「一些星星会自己闪」肉眼可辨：
      *   twinkle 档（30%）—— 走高频，肉眼明显看到忽明忽暗
         *   其余（70%）      —— 走低频，仅作稳定基底
* 原实现只有 14% 为强闪烁且幅度仅 0.45~0.55，实测看不出「星星在闪」。 */
        twinkle: TW,
        /* twinkle 档额外给高频：sp 是绘制端 sin() 的角频率，
         * 越大闪得越快。3.2~7.0 对应周期约 0.9~2.0 秒，肉眼可辨。*/
        sp: TW ? (3.2 + rnd() * 3.8) : (0.30 + rnd() * 0.75),
        amp: TW ? (0.62 + rnd() * 0.38) : (0.28 + rnd() * 0.52),
        blink: 1,
        /* 色彩：多数偏冷白，少量暖白/淡蓝 */
        warm: rnd() < 0.18
      });
    }
    return stars;
  }

  /* ---------- 主工厂 ---------- */

  /**
   * 创建宇宙背景
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts
   *   seed      随机种子（同一 seed 背景完全一致）
   *   stars     星点数量（默认 160）
   *   nebula    是否绘制星云（默认 true）
   *   spikes     是否绘制亮星十字光芒（默认 true）
   *   base      底色（默认深空蓝黑）
   * @returns {{resize:Function, draw:Function, isEmpty:Function}}
   */
  function createCosmos(canvas, opts) {
    opts = opts || {};
    const seed = opts.seed == null ? 20261006 : opts.seed;
    const starCount = opts.stars == null ? 160 : opts.stars;
    const useNebula = opts.nebula !== false;
    const useSpikes = opts.spikes !== false;
    const baseTop = opts.baseTop || '#0a0e26';
    const baseBot = opts.baseBot || '#05060f';

    const nebula = useNebula ? makeNebula(seed) : [];
    const stars = makeStars(seed + 7, starCount);

    let w = 0, h = 0, dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    function draw(t) {
      const c = canvas.getContext('2d');
      if (!c) return;
      const tt = (t || 0) / 1000;

      /* 背景必须铺满画布，不能只 clearRect —— 星空是不透明底图 */
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalCompositeOperation = 'source-over';

      /* 1) 底色：纵向渐变，营造「上深下更深」的太空纵深 */
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, baseTop);
      g.addColorStop(0.55, baseBot);
      g.addColorStop(1, baseBot);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);

      const isSquare = Math.abs(w - h) < 2;
      const R = Math.max(w, h);

      /* 2) 星云团块：用 lighter 叠加，柔和且有辉光感 */
      if (useNebula) {
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < nebula.length; i++) {
          const b = nebula[i];
          const bx = (b.x + b.dx * Math.sin(tt * b.spd + b.ph)) / 100 * w;
          const by = (b.y + b.dy * Math.cos(tt * b.spd * 0.83 + b.ph)) / 100 * h;
          const br = b.r / 100 * R;
          /* 呼吸：透明度随时间缓慢起伏，幅度小以免察觉 */
          const pulse = 0.82 + 0.18 * Math.sin(tt * b.spd * 1.6 + b.ph);
          const rad = c.createRadialGradient(bx, by, 0, bx, by, br);
          const col = b.hue + ', ' + b.sat + '%, ' + b.lum + '%';
          rad.addColorStop(0, 'hsla(' + col + ', ' + (b.alpha * pulse).toFixed(3) + ')');
          rad.addColorStop(0.45, 'hsla(' + col + ', ' + (b.alpha * 0.42 * pulse).toFixed(3) + ')');
          rad.addColorStop(1, 'hsla(' + col + ', 0)');
          c.fillStyle = rad;
          c.beginPath();
          c.arc(bx, by, br, 0, Math.PI * 2);
          c.fill();
        }
      }

      /* 3) 中心辉光：把视觉重心收拢到盘面中心 */
      c.globalCompositeOperation = 'lighter';
      const cg = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, R * 0.55);
      cg.addColorStop(0, isSquare ? 'rgba(70,86,168,.20)' : 'rgba(70,86,168,.13)');
      cg.addColorStop(1, 'rgba(70,86,168,0)');
      c.fillStyle = cg;
      c.fillRect(0, 0, w, h);

      /* 4) 星点：三层视差，亮星带十字光芒 */
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        /* 【1.8.1】双频叠加闪烁：
   * 高频项制造「忽明忽暗」的跳动感，低频项制造整体呼吸。
         * twinkle 星只取高频（闪得明显），steady 星只取低频（保持稳定）。
         * 原实现只有 14% 为强闪烁且幅度仅 0.45~0.55，用户肉眼看不出「星星在闪」。 */
        const lo = 0.5 + 0.5 * Math.sin(tt * s.sp * 0.55 + s.ph * 1.7);
        let mix = lo;
        if (s.twinkle) {
   /* 高频项制造「忽明忽暗」；叠一层低频让明暗节奏不呆板 */
          const hi = 0.5 + 0.5 * Math.sin(tt * s.sp * 1.9 + s.ph);
          mix = 0.30 + 0.70 * (0.62 * hi + 0.38 * lo);
        }
        let al = (0.12 + 0.88 * mix) * s.amp;
        if (al > 1) al = 1;
     if (al < 0.04) al = 0.04;
        const x = s.x / 100 * w;
        const y = s.y / 100 * h;
        const r = s.r;
        const tint = s.warm ? '255,236,206' : (s.layer === 2 ? '206,222,255' : '226,232,255');

        if (s.layer === 2 && useSpikes) {
          /* 亮星：先画十字光芒，再画核 */
     /* 【1.8.1】此处原先引用已删除的 tw 变量，导致每帧抛
     *「tw is not defined」，进而让整幅画布静止、动画全部停摆。
           * 改用新算出的 mix（twinkle星为高频、steady 星为低频）。*/
    const spike = r * (2.6 + 1.6 * mix);
          const lg = c.createLinearGradient(x - spike, y, x + spike, y);
          lg.addColorStop(0, 'rgba(' + tint + ',0)');
          lg.addColorStop(0.5, 'rgba(' + tint + ',' + (al * 0.42).toFixed(3) + ')');
          lg.addColorStop(1, 'rgba(' + tint + ',0)');
          c.fillStyle = lg;
          c.fillRect(x - spike, y - r * 0.28, spike * 2, r * 0.56);
          const vg = c.createLinearGradient(x, y - spike, x, y + spike);
          vg.addColorStop(0, 'rgba(' + tint + ',0)');
          vg.addColorStop(0.5, 'rgba(' + tint + ',' + (al * 0.34).toFixed(3) + ')');
          vg.addColorStop(1, 'rgba(' + tint + ',0)');
          c.fillStyle = vg;
          c.fillRect(x - r * 0.28, y - spike, r * 0.56, spike * 2);
        }

        const bg = c.createRadialGradient(x, y, 0, x, y, r * 2.6);
        bg.addColorStop(0, 'rgba(' + tint + ',' + al.toFixed(3) + ')');
        bg.addColorStop(0.4, 'rgba(' + tint + ',' + (al * 0.42).toFixed(3) + ')');
        bg.addColorStop(1, 'rgba(' + tint + ',0)');
        c.fillStyle = bg;
        c.beginPath();
        c.arc(x, y, r * 2.6, 0, Math.PI * 2);
        c.fill();
      }

      c.globalCompositeOperation = 'source-over';
    }

    /** 已绘制像素占比过低时视为「空画布」，供测试判定 */
    function isEmpty() {
      try {
        const c = canvas.getContext('2d');
        if (!c || !canvas.width) return true;
        const d = c.getImageData(0, 0, canvas.width, canvas.height).data;
        let n = 0;
        /* 抽样步长 40 像素，足够判定又不会太慢 */
        for (let i = 0; i < d.length; i += 160) if (d[i] + d[i + 1] + d[i + 2] > 40) n++;
        return n < 30;
      } catch (e) { return false; }
    }

    resize();
    return { resize: resize, draw: draw, isEmpty: isEmpty };
  }

  /* ---------- 供测试直接断言的内部工具 ---------- */

  root.CosmosBG = {
    create: createCosmos,
    _internals: { mulberry32: mulberry32, makeNebula: makeNebula, makeStars: makeStars }
  };
  if (typeof module === 'object' && module.exports) module.exports = root.CosmosBG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
