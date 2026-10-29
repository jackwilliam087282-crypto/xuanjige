/* ============================================================
 * jieqi-art.js —— 二十四节气场景插画引擎（1.8.1 重做）
 *
 * 1.8.0 的问题（用户实测反馈）：每个节气只有 3~5 个几何元素，
 * 如"雨水"只是几道斜线、"立春"只是 3 只鸟，画风简陋、
 * 与日历格子不协调，达不到"新颖/高大上"的要求。
 *
 * 1.8.1 的重做方向（对齐参考图的水彩工笔插画）：
 *   每个节气 = 一个完整场景，固定四层构图：
 *     ① 远景：天际渐变 + 云气 / 山峦 / 雨幕 / 雪幕（决定节气基调）
 *     ② 中景：节气主体（植物、动物、器物、人物劳作）
 *     ③ 近景：地面元素（田垄、水面、屋檐、枝干）
 *     ④ 装饰：飘落物、光晕、涟漪等动态粒子
 *   每层都随t 缓动，叠加后有"活"的感觉。
 *
 *   另有两条硬约束：
 *     · 满铺：按卡片实际宽高铺满，而非只画中央一小块；
 *     · 真实节气：由 vendor/lunar.js 的 getPrevJieQi() 判定，
 *       随日期自动切换，无需用户干预。
 *
 * 风格：统一低饱和 + 低透明度的"底图"定位，保证叠在其上的
 * 日期数字与吉凶色块始终可读。
 * ============================================================ */
(function (root) {
  'use strict';

  /* ---------- 二十四节气：类型 + 物象 + 提示 ---------- */
  const JIEQI_INFO = {
    立春: { type: 'animal', art: 'swallow', hint: '春神临 · 燕子归', season: 'spring' },
    雨水: { type: 'weather', art: 'rain', hint: '降雨增多 · 草木萌动', season: 'spring' },
    惊蛰: { type: 'animal', art: 'insect', hint: '春雷始鸣 · 蛰虫苏醒', season: 'spring' },
    春分: { type: 'weather', art: 'wind', hint: '昼夜均而寒暑平', season: 'spring' },
    清明: { type: 'labor', art: 'tomb', hint: '扫墓祭祖 · 踏青插柳', season: 'spring' },
    谷雨: { type: 'labor', art: 'rice', hint: '雨生百谷 · 正是插秧时', season: 'spring' },
    立夏: { type: 'weather', art: 'sun', hint: '万物至此皆假大', season: 'summer' },
    小满: { type: 'weather', art: 'wheat', hint: '麦粒渐满 · 未必饱满', season: 'summer' },
    芒种: { type: 'weather', art: 'thunder', hint: '有芒之谷可种 · 雷雨频作', season: 'summer' },
    夏至: { type: 'weather', art: 'sundial', hint: '日长之至 · 昼最长', season: 'summer' },
    小暑: { type: 'weather', art: 'hot', hint: '温风至 · 暑气渐盛', season: 'summer' },
    大暑: { type: 'weather', art: 'melon', hint: '腐草为萤 · 酷热当空', season: 'summer' },
    立秋: { type: 'animal', art: 'leaf', hint: '凉风至 · 禾乃登', season: 'autumn' },
    处暑: { type: 'weather', art: 'dew', hint: '暑气至此而止', season: 'autumn' },
    白露: { type: 'weather', art: 'dew', hint: '露凝而白 · 昼夜温差大', season: 'autumn' },
    秋分: { type: 'labor', art: 'harvest', hint: '平分秋色 · 农事忙收', season: 'autumn' },
    寒露: { type: 'animal', art: 'goose', hint: '鸿雁来宾 · 菊有黄华', season: 'autumn' },
    霜降: { type: 'animal', art: 'frost', hint: '豺乃祭兽 · 霜始降', season: 'autumn' },
    立冬: { type: 'labor', art: 'store', hint: '万物收藏 · 休养生息', season: 'winter' },
    小雪: { type: 'weather', art: 'snow', hint: '虹藏不见 · 天气上腾', season: 'winter' },
    大雪: { type: 'weather', art: 'snow', hint: '积雪成尺 · 至此而雪盛', season: 'winter' },
    冬至: { type: 'labor', art: 'dumpling', hint: '天日短 · 冬至大如年', season: 'winter' },
    小寒: { type: 'weather', art: 'frost', hint: '雁北乡 · 鹊始巢', season: 'winter' },
    大寒: { type: 'animal', art: 'cold', hint: '寒气之逆极 · 农事闲耕', season: 'winter' }
  };

  const ORDER = ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
    '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
    '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
    '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'];

  /* 四季基调：天际色 / 远景色 / 主色 / 点缀色 */
  const PALETTE = {
    spring: { sky1: '#2a3348', sky2: '#161d2e', far: '#3d4a63', main: '#7fae7a', accent: '#d8b96a' },
    summer: { sky1: '#3a3630', sky2: '#1c1a18', far: '#4a4238', main: '#8a9a5c', accent: '#e0a840' },
    autumn: { sky1: '#3a3030', sky2: '#1e1a1c', far: '#4d3f3a', main: '#c08a4a', accent: '#d8c070' },
    winter: { sky1: '#2c3440', sky2: '#161c26', far: '#3f4a58', main: '#8fa4b8', accent: '#c8d8e8' }
  };

  /* ---------- 节气查询 ---------- */
  function currentJieQi(date) {
    let d = date;
    if (!(d instanceof Date) || !isFinite(d.getTime())) d = new Date();
    try {
      const L = root.Lunar;
      if (L && typeof L.Lunar === 'function') {
        const lu = L.Lunar.fromDate(d);
        const jq = lu.getPrevJieQi && lu.getPrevJieQi(true);
        if (jq && typeof jq.getName === 'function') {
          const n = jq.getName();
          if (n && JIEQI_INFO[n]) return n;
        }
      }
    } catch (e) { /* 落到近似表 */ }
    return approxJieQi(d);
  }

  /** 近似表：以立春（2/4）为起点，每 15.2184 天一个节气。 */
  function approxJieQi(d) {
    const y = d.getFullYear();
    if (d < new Date(y, 1, 4)) {
      const prev = new Date(y - 1, 1, 4);
      const idx = Math.floor((d - prev) / 86400000 / 15.2184);
      return ORDER[((idx % 24) + 24) % 24];
    }
    const idx = Math.floor((d - new Date(y, 1, 4)) / 86400000 / 15.2184);
    return ORDER[Math.max(0, Math.min(23, idx))];
  }

  /* ============================================================
   * 通用绘制套件 —— 所有节气场景共用，保证画风统一
   * 坐标系：左上角原点，画布实际尺寸由 create() 传入
   * ============================================================ */

  function lerp(a, b, k) { return a + (b - a) * k; }

  /** ① 远景：天际渐变 + 云气带（决定节气基调） */
  function sky(c, w, h, P, t, opts) {
    opts = opts || {};
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, opts.sky1 || P.sky1);
    g.addColorStop(1, opts.sky2 || P.sky2);
    c.globalAlpha = 1;
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

    /* 云气：三团横向缓慢漂移的柔光 */
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const cy = h * (0.14 + i * 0.11);
      const cx = ((t * (5 + i * 3) + i * w * 0.42) % (w * 1.5)) - w * 0.25;
      const r = h * (0.22 - i * 0.03);
      const cg = c.createRadialGradient(cx, cy, 0, cx, cy, r);
      cg.addColorStop(0, 'rgba(190,205,235,.055)');
      cg.addColorStop(1, 'rgba(190,205,235,0)');
      c.fillStyle = cg;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  /** ② 远山：两层山脊剪影，营造纵深 */
  function mountains(c, w, h, P, t, opts) {
    opts = opts || {};
    const layers = opts.layers || 2;
    for (let L = 0; L < layers; L++) {
      const baseY = h * (opts.top != null ? opts.top + L * 0.09 : 0.46 + L * 0.10);
      const amp = h * (0.09 - L * 0.02);
      const alpha = (opts.alpha || 0.20) * (1 - L * 0.28);
      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = P.far;
      c.beginPath();
      c.moveTo(-w * 0.1, h);
      c.lineTo(-w * 0.1, baseY);
      const seg = 7;
      for (let i = 0; i <= seg; i++) {
        const x = -w * 0.1 + (w * 1.2) * (i / seg);
        /* 双频叠加做出山脊起伏，并随时间极缓漂移 */
        const y = baseY
          - Math.sin(i * 1.7 + L * 2.1 + t * 0.06) * amp
          - Math.sin(i * 0.6 + t * 0.04) * amp * 0.5;
        c.lineTo(x, y);
      }
      c.lineTo(w * 1.1, h);
      c.closePath();
      c.fill();
      c.restore();
    }
  }

  /** 农田：透视田垄（劳作类节气的地面） */
  function field(c, w, h, P, t, y0) {
    const top = y0 != null ? y0 : h * 0.60;
    c.save();
    c.globalAlpha = 0.16;
    c.fillStyle = P.far;
    c.fillRect(0, top, w, h - top);
    /* 透视田垄：越远越密 */
    c.strokeStyle = P.main;
    c.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const k = i / 6;
      const y = top + (h - top) * (k * k * 0.9 + 0.06);
      c.globalAlpha = 0.10 + k * 0.10;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    /* 竖向垄沟 */
    c.globalAlpha = 0.07;
    for (let i = 0; i <= 10; i++) {
      const x = (w * i) / 10;
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(w * 0.5 + (x - w * 0.5) * 1.9, h);
      c.stroke();
    }
    c.restore();
  }

  /** 水面：反光横线 + 涟漪 */
  function water(c, w, h, P, t, y0) {
    const top = y0 != null ? y0 : h * 0.72;
    c.save();
    c.globalAlpha = 0.20;
    const g = c.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, 'rgba(90,130,170,.35)');
    g.addColorStop(1, 'rgba(40,70,110,.12)');
    c.fillStyle = g;
    c.fillRect(0, top, w, h - top);
    /* 反光横线，长度随机但用确定性伪随机保证帧间稳定 */
    c.strokeStyle = 'rgba(190,220,245,.30)';
    c.lineWidth = 1;
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 16; i++) {
      const r0 = rnd();
      const y = top + (h - top) * ((i + r0 * 0.6) / 16);
      const len = w * (0.08 + r0 * 0.30);
      const x = ((r0 * w * 2 + t * (6 + r0 * 10)) % (w + len * 2)) - len;
      c.globalAlpha = 0.10 + 0.14 * Math.abs(Math.sin(t * 0.9 + i));
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y); c.stroke();
    }
    c.restore();
  }

  /** 器物：日晷（夏至专用） */
  function sundial(c, x, y, s, col) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.035); c.lineCap = 'round';
    /* 晷盘：椭圆 */
    c.beginPath(); c.ellipse(0, 0, s, s * 0.34, 0, 0, Math.PI * 2); c.stroke();
    /* 刻度 */
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.beginPath();
      c.moveTo(Math.cos(a) * s * 0.86, Math.sin(a) * s * 0.29);
      c.lineTo(Math.cos(a) * s, Math.sin(a) * s * 0.34);
      c.stroke();
    }
    /* 晷针 */
    c.lineWidth = Math.max(1.2, s * 0.05);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -s * 0.5); c.stroke();
    c.restore();
  }

  /** 亭子：劳作/避暑场景的近景建筑 */
  function pavilion(c, x, y, s, col) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.045); c.lineJoin = 'round';
    /* 顶：两重檐 */
    c.beginPath();
    c.moveTo(-s, -s * 0.55);
    c.quadraticCurveTo(-s * 0.55, -s * 0.95, 0, -s * 0.80);
    c.quadraticCurveTo(s * 0.55, -s * 0.95, s, -s * 0.55);
    c.stroke();
    c.beginPath();
    c.moveTo(-s * 0.7, -s * 0.55);
    c.quadraticCurveTo(0, -s * 0.72, s * 0.7, -s * 0.55);
    c.stroke();
    /* 柱 */
    c.beginPath();
    c.moveTo(-s * 0.62, -s * 0.50); c.lineTo(-s * 0.62, 0);
    c.moveTo(s * 0.62, -s * 0.50); c.lineTo(s * 0.62, 0);
    c.moveTo(0, -s * 0.74); c.lineTo(0, -s * 0.50);
    c.stroke();
    c.restore();
  }

  /** 植物：主枝 + 叶（多控制点，曲线更自然） */
  function sprig(c, x, y, len, ang, col, leaves, sway) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.strokeStyle = col; c.lineWidth = Math.max(1, len * 0.028); c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.35, -len * 0.18, len, -len * 0.10);
    c.stroke();
    for (let i = 1; i <= (leaves || 5); i++) {
      const k = i / ((leaves || 5) + 1);
      const px = len * k, py = -len * 0.10 * k - len * 0.05 * Math.sin(k * 3);
      const la = (sway || 0) * Math.sin(k * 2.2) + (i % 2 ? 0.8 : -0.8);
      c.save();
      c.translate(px, py);
      c.rotate(la);
      c.beginPath();
      c.ellipse(len * 0.11, 0, len * 0.11, len * 0.045, 0, 0, Math.PI * 2);
      c.fillStyle = col; c.fill();
      c.restore();
    }
    c.restore();
  }

  /** 麦穗：芒种/小满/秋分 */
  function wheat(c, x, y, s, col, sway) {
    c.save();
    c.translate(x, y);
    c.rotate(sway * 0.18);
    c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.035); c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * 0.12, -s * 0.5, s * 0.06, -s); c.stroke();
    /* 颗粒 */
    c.fillStyle = col;
    for (let i = 0; i < 6; i++) {
      const k = 0.35 + i * 0.12;
      c.beginPath();
      c.ellipse(s * 0.06 * (1 - k * 0.3) - s * 0.05, -s * k, s * 0.035, s * 0.06, -0.4, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(s * 0.06 * (1 - k * 0.3) + s * 0.05, -s * k, s * 0.035, s * 0.06, 0.4, 0, Math.PI * 2);
      c.fill();
    }
    /* 芒 */
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(s * 0.06, -s * (0.95 + i * 0.05));
      c.lineTo(s * 0.06 + (i - 1) * s * 0.10, -s * (1.14 + i * 0.05));
      c.stroke();
    }
    c.restore();
  }

  /** 人形：劳作类节气（比 1.8.0 更细致，加斗笠与姿态） */
  function person(c, x, y, s, col, pose) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.075); c.lineCap = 'round'; c.lineJoin = 'round';
    /* 腿 */
    c.beginPath();
    c.moveTo(0, -s * 0.32); c.lineTo(-s * 0.18, 0);
    c.moveTo(0, -s * 0.32); c.lineTo(s * 0.20, 0);
    c.stroke();
    /* 躯干（pose 控制俯身） */
    const lean = pose === 'bend' ? 0.42 : pose === 'reach' ? -0.16 : 0;
    c.beginPath();
    c.moveTo(0, -s * 0.30);
    c.lineTo(lean * s * 0.5, -s * 0.72);
    c.stroke();
    /* 手臂 */
    c.beginPath();
    if (pose === 'bend') {
      c.moveTo(lean * s * 0.5, -s * 0.70); c.lineTo(s * 0.48, -s * 0.20);
      c.moveTo(lean * s * 0.5, -s * 0.70); c.lineTo(s * 0.16, -s * 0.22);
    } else if (pose === 'reach') {
      c.moveTo(lean * s * 0.5, -s * 0.70); c.lineTo(-s * 0.34, -s * 1.00);
      c.moveTo(lean * s * 0.5, -s * 0.70); c.lineTo(s * 0.36, -s * 0.94);
    } else {
      c.moveTo(lean * s * 0.5, -s * 0.70); c.lineTo(s * 0.34, -s * 0.44);
      c.moveTo(lean * s * 0.5, -s * 0.70); c.lineTo(-s * 0.28, -s * 0.40);
    }
    c.stroke();
    /* 头 */
    const hx = lean * s * 0.55, hy = -s * 0.86;
    c.beginPath(); c.arc(hx, hy, s * 0.11, 0, Math.PI * 2); c.stroke();
    /* 斗笠 */
    c.lineWidth = Math.max(1, s * 0.05);
    c.beginPath();
    c.moveTo(hx - s * 0.20, hy - s * 0.06);
    c.quadraticCurveTo(hx, hy - s * 0.22, hx + s * 0.20, hy - s * 0.06);
    c.stroke();
    c.restore();
  }

  /** 飞鸟：燕子/鸿雁（双段弧线 + 扇翅） */
  function bird(c, x, y, s, col, flap) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = col; c.lineWidth = Math.max(0.9, s * 0.11); c.lineCap = 'round';
    const f = Math.sin(flap) * 0.5 + 0.5;
    c.beginPath();
    c.moveTo(-s, 0);
    c.quadraticCurveTo(-s * 0.45, -s * (0.35 + f * 0.55), 0, -s * 0.05);
    c.quadraticCurveTo(s * 0.45, -s * (0.35 + f * 0.55), s, 0);
    c.stroke();
    /* 尾羽 */
    c.lineWidth = Math.max(0.7, s * 0.07);
    c.beginPath();
    c.moveTo(-s, 0); c.lineTo(-s * 1.32, s * 0.16);
    c.moveTo(-s, 0); c.lineTo(-s * 1.30, -s * 0.10);
    c.stroke();
    c.restore();
  }

  /** 太阳/光晕：多节气共用的光源 */
  function sunDisc(c, x, y, r, P, t, warm) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const ext = 0.5 + 0.5 * Math.sin(t * 0.8);
    const g = c.createRadialGradient(x, y, 0, x, y, r * (1.5 + ext * 0.35));
    g.addColorStop(0, warm ? 'rgba(255,214,130,.42)' : 'rgba(255,240,200,.36)');
    g.addColorStop(0.4, warm ? 'rgba(255,180,90,.14)' : 'rgba(255,230,180,.10)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r * (1.5 + ext * 0.35), 0, Math.PI * 2); c.fill();
    /* 光芒 */
    c.strokeStyle = warm ? 'rgba(255,222,150,.26)' : 'rgba(255,244,214,.20)';
    c.lineWidth = 1.1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.05;
      const r1 = r * 1.05, r2 = r * (1.24 + ext * 0.22);
      c.beginPath();
      c.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      c.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
      c.stroke();
    }
    c.restore();
  }

  /** 飘落物通用：雨/雪/叶/花瓣/麦芒 */
  function fall(c, w, h, t, opt) {
    const n = opt.count, col = opt.color;
    c.save();
    c.strokeStyle = col;
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      /* 确定性伪随机：位置固定，速度/摆幅随时间变 */
      const rx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const ry = (Math.sin(i * 78.233) * 12345.6789) % 1;
      const px = Math.abs(rx), py = Math.abs(ry);
      const spd = opt.speed * (0.55 + px * 0.9);
      const y = ((t * spd + py * h * 1.3) % (h * 1.3)) - h * 0.15;
      const x = (px * w * 1.1 + Math.sin(t * (0.5 + k * 0.7) + i) * (opt.sway || 8)) % w;
      const a = opt.alpha * (0.45 + 0.55 * Math.abs(Math.sin(t * 1.1 + i * 2.1)));
      c.globalAlpha = a;
      if (opt.kind === 'rain') {
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - opt.len * 0.30, y + opt.len); c.stroke();
      } else if (opt.kind === 'snow') {
        c.beginPath(); c.arc(x, y, opt.len * (0.35 + px * 0.4), 0, Math.PI * 2); c.fill();
      } else if (opt.kind === 'leaf') {
        c.save(); c.translate(x, y); c.rotate(t * (0.6 + px) + i);
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(opt.len * 0.5, -opt.len * 0.32, opt.len, 0);
        c.quadraticCurveTo(opt.len * 0.5, opt.len * 0.32, 0, 0);
        c.fill();
        c.restore();
      } else {
        c.beginPath(); c.arc(x, y, opt.len * 0.3, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
  }

  /* ============================================================
   * 24 节气场景 —— 每个都是完整构图
   * 签名：fn(c, w, h, P, t)，w/h 为画布实际尺寸
   * ============================================================ */
  const ART = {
    /* ---------- 春 ---------- */
    swallow(c, w, h, P, t) {           /* 立春：燕子归 + 柳芽 */
      sky(c, w, h, P, t, { sky1: '#2b3448', sky2: '#151b2a' });
      sunDisc(c, w * 0.80, h * 0.16, h * 0.10, P, t, false);
      mountains(c, w, h, P, t, { layers: 2, top: 0.50, alpha: 0.16 });
      /* 柳枝：下垂的嫩条 */
      c.save();
      c.strokeStyle = P.main; c.lineWidth = 1.2; c.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const x0 = w * 0.06 + i * w * 0.055;
        const sw = Math.sin(t * 0.9 + i * 0.8) * 5;
        c.globalAlpha = 0.34;
        c.beginPath();
        c.moveTo(x0, 0);
        c.quadraticCurveTo(x0 + sw, h * 0.14, x0 + sw * 1.6, h * 0.28);
        c.stroke();
        /* 芽 */
        c.fillStyle = P.accent;
        c.beginPath(); c.arc(x0 + sw * 1.6, h * 0.28, 1.6, 0, Math.PI * 2); c.fill();
      }
      c.restore();
      /* 燕子：3 只盘旋 */
      for (let i = 0; i < 3; i++) {
        const ph = t * 0.5 + i * 2.1;
        bird(c, w * (0.24 + i * 0.26) + Math.sin(ph) * w * 0.10,
          h * (0.24 + (i % 2) * 0.09) + Math.cos(ph * 0.8) * h * 0.05,
          Math.max(7, h * 0.035), 'rgba(200,214,238,.44)', ph * 7);
      }
    },
    rain(c, w, h, P, t) {             /* 雨水：细雨 + 远山 + 草 */
      sky(c, w, h, P, t, { sky1: '#28303f', sky2: '#131822' });
      mountains(c, w, h, P, t, { layers: 3, top: 0.42, alpha: 0.20 });
      /* 雨幕：三层不同速度 */
      for (let i = 0; i < 3; i++) {
        fall(c, w, h, t * (1 + i * 0.35) + i * 3, {
          count: 16 + i * 10, kind: 'rain', color: 'rgba(170,200,230,.5)',
          speed: 200 + i * 90, len: h * 0.07, alpha: 0.16 - i * 0.03, sway: 2
        });
      }
      /* 地面草 */
      c.save();
      c.strokeStyle = P.main; c.lineWidth = 1.1; c.lineCap = 'round';
      for (let i = 0; i < 22; i++) {
        const x = (i / 21) * w;
        const sw = Math.sin(t * 1.1 + i) * 3;
        c.globalAlpha = 0.22;
        c.beginPath(); c.moveTo(x, h);
        c.quadraticCurveTo(x + sw, h - h * 0.05, x + sw * 2, h - h * 0.09);
        c.stroke();
      }
      c.restore();
      /* 水洼涟漪 */
      c.save();
      c.strokeStyle = 'rgba(180,210,235,.30)';
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.5 + i * 0.25) % 1;
        c.globalAlpha = 0.24 * (1 - ph);
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(w * (0.15 + i * 0.24), h * 0.92, ph * 22 + 2, (ph * 22 + 2) * 0.26, 0, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
    },
    insect(c, w, h, P, t) {           /* 惊蛰：春雷 + 惊虫 + 草 */
      sky(c, w, h, P, t, { sky1: '#262b38', sky2: '#12141c' });
      /* 乌云：更浓重的低层云 */
      c.save();
      c.globalAlpha = 0.30;
      c.fillStyle = '#1a1f2c';
      for (let i = 0; i < 4; i++) {
        const cx = ((t * (7 + i * 4) + i * w * 0.3) % (w * 1.4)) - w * 0.2;
        c.beginPath();
        c.ellipse(cx, h * (0.10 + (i % 2) * 0.06), w * 0.22, h * 0.055, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      mountains(c, w, h, P, t, { layers: 2, top: 0.48, alpha: 0.18 });
      /* 闪电：间歇 */
      const fl = t % 4.2;
      if (fl < 0.26) {
        c.save();
        c.globalAlpha = 0.55 * (1 - fl / 0.26);
        c.strokeStyle = '#dfe8ff'; c.lineWidth = 1.6; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(w * 0.70, h * 0.06);
        c.lineTo(w * 0.66, h * 0.20);
        c.lineTo(w * 0.71, h * 0.20);
        c.lineTo(w * 0.67, h * 0.33);
        c.stroke();
        c.restore();
      }
      /* 惊起的虫 */
      for (let i = 0; i < 4; i++) {
        const ph = t * 0.8 + i * 1.6;
        const x = w * (0.12 + i * 0.25) + Math.sin(ph) * w * 0.05;
        const y = h * (0.62 + (i % 2) * 0.08) + Math.cos(ph * 1.3) * h * 0.05;
        c.save();
        c.globalAlpha = 0.42;
        c.fillStyle = '#c8a86a';
        c.beginPath(); c.ellipse(x, y, 3.4, 2.2, 0.4, 0, Math.PI * 2); c.fill();
        /* 翅 */
        c.strokeStyle = 'rgba(200,220,240,.5)'; c.lineWidth = 0.8;
        c.beginPath();
        c.ellipse(x, y - 1.6, 3, 1.4, -0.5, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
    },
    wind(c, w, h, P, t) {             /* 春分：风筝 + 风线 */
      sky(c, w, h, P, t, { sky1: '#2e3a4a', sky2: '#161d28' });
      sunDisc(c, w * 0.18, h * 0.18, h * 0.09, P, t, false);
      /* 风线：三道长波纹 */
      c.save();
      c.strokeStyle = 'rgba(200,220,240,.22)'; c.lineWidth = 1.3; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const y = h * (0.30 + i * 0.13);
        const ph = t * (0.6 + i * 0.2);
        c.beginPath();
        for (let x = 0; x <= w; x += w / 22) {
          const yy = y + Math.sin(x * 0.022 + ph + i) * h * 0.030
            + Math.sin(x * 0.008 - ph * 1.3) * h * 0.016;
          x === 0 ? c.moveTo(x, yy) : c.lineTo(x, yy);
        }
        c.stroke();
      }
      c.restore();
      field(c, w, h, P, t, h * 0.66);
      /* 风筝 */
      const kx = w * 0.72 + Math.sin(t * 0.5) * w * 0.04;
      const ky = h * 0.22 + Math.cos(t * 0.7) * h * 0.03;
      c.save();
      c.translate(kx, ky);
      c.rotate(Math.sin(t * 0.9) * 0.16);
      c.fillStyle = 'rgba(220,180,120,.36)';
      c.beginPath();
      c.moveTo(0, -h * 0.055); c.lineTo(h * 0.035, 0); c.lineTo(0, h * 0.055); c.lineTo(-h * 0.035, 0);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(200,215,235,.28)'; c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(0, h * 0.055);
      c.quadraticCurveTo(h * 0.05, h * 0.11, -h * 0.01, h * 0.18);
      c.stroke();
      c.restore();
    },
    tomb(c, w, h, P, t) {             /* 清明：远山 + 柳 + 行人 */
      sky(c, w, h, P, t, { sky1: '#2b3542', sky2: '#151a22' });
      mountains(c, w, h, P, t, { layers: 3, top: 0.36, alpha: 0.24 });
      field(c, w, h, P, t, h * 0.72);
      /* 柳树：垂枝 */
      c.save();
      c.strokeStyle = P.main; c.lineWidth = 1.1; c.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const x0 = w * 0.04 + i * w * 0.032;
        const sw = Math.sin(t * 0.8 + i * 0.7) * 6;
        c.globalAlpha = 0.26;
        c.beginPath();
        c.moveTo(x0, h * 0.06);
        c.quadraticCurveTo(x0 + sw, h * 0.24, x0 + sw * 1.8, h * 0.40);
        c.stroke();
      }
      c.restore();
      /* 行人：二人缓行 */
      const walk = t * 0.10;
      person(c, w * (0.38 + Math.sin(walk) * 0.02), h * 0.88, h * 0.14, 'rgba(200,212,232,.34)', 'walk');
      person(c, w * (0.46 + Math.sin(walk - 0.5) * 0.02), h * 0.89, h * 0.13, 'rgba(200,212,232,.26)', 'walk');
      /* 落花 */
      fall(c, w, h, t, { count: 10, kind: 'leaf', color: 'rgba(230,200,210,.6)', speed: 26, len: 4.5, alpha: 0.22, sway: 14 });
    },
    rice(c, w, h, P, t) {             /* 谷雨：秧田 + 插秧 */
      sky(c, w, h, P, t, { sky1: '#2a3440', sky2: '#141a20' });
      mountains(c, w, h, P, t, { layers: 2, top: 0.38, alpha: 0.16 });
      water(c, w, h, P, t, h * 0.56);
      /* 秧苗：成排小苗 */
      c.save();
      c.strokeStyle = P.main; c.lineWidth = 1; c.lineCap = 'round';
      for (let r = 0; r < 4; r++) {
        for (let i = 0; i < 16; i++) {
          const x = (i / 15) * w + (r % 2) * w * 0.03;
          const y = h * (0.62 + r * 0.10);
          const sw = Math.sin(t * 1.2 + i * 0.8 + r) * 1.6;
          c.globalAlpha = 0.16 + r * 0.05;
          c.beginPath();
          c.moveTo(x, y); c.quadraticCurveTo(x + sw, y - h * 0.02, x + sw * 1.6, y - h * 0.045);
          c.stroke();
        }
      }
      c.restore();
      /* 插秧人：弯腰 */
      person(c, w * 0.60, h * 0.82, h * 0.17, 'rgba(205,215,232,.36)', 'bend');
      person(c, w * 0.82, h * 0.86, h * 0.15, 'rgba(205,215,232,.26)', 'bend');
      /* 细雨 */
      fall(c, w, h, t, { count: 14, kind: 'rain', color: 'rgba(180,205,230,.5)', speed: 170, len: h * 0.055, alpha: 0.14, sway: 2 });
    },

    /* ---------- 夏 ---------- */
    sun(c, w, h, P, t) {              /* 立夏：烈日 + 浓绿 */
      sky(c, w, h, P, t, { sky1: '#3c3a30', sky2: '#1b1a16' });
      sunDisc(c, w * 0.72, h * 0.20, h * 0.13, P, t, true);
      mountains(c, w, h, P, t, { layers: 2, top: 0.50, alpha: 0.16 });
      field(c, w, h, P, t, h * 0.64);
      /* 浓绿丛：多层枝叶 */
      for (let i = 0; i < 5; i++) {
        sprig(c, w * (0.10 + i * 0.20), h * 0.98, h * (0.22 + (i % 2) * 0.06),
          -1.35 + i * 0.14, P.main, 6, Math.sin(t * 0.9 + i) * 0.30);
      }
    },
    wheat(c, w, h, P, t) {            /* 小满：麦黄 + 蝴蝶 */
      sky(c, w, h, P, t, { sky1: '#3a3526', sky2: '#1a1812' });
      sunDisc(c, w * 0.24, h * 0.18, h * 0.10, P, t, true);
      mountains(c, w, h, P, t, { layers: 2, top: 0.52, alpha: 0.14 });
      field(c, w, h, P, t, h * 0.66);
      /* 麦穗：多株 */
      for (let i = 0; i < 9; i++) {
        const x = (i / 8) * w;
        wheat(c, x, h * (0.98 - (i % 3) * 0.02), h * (0.20 + (i % 2) * 0.05),
          'rgba(214,182,110,.40)', Math.sin(t * 1.1 + i * 0.9));
      }
      /* 蝴蝶 */
      for (let i = 0; i < 2; i++) {
        const ph = t * 0.9 + i * 3.1;
        const bx = w * (0.35 + i * 0.30) + Math.sin(ph) * w * 0.08;
        const by = h * (0.30 + (i % 2) * 0.08) + Math.cos(ph * 1.3) * h * 0.05;
        const f = Math.abs(Math.sin(ph * 6));
        c.save();
        c.translate(bx, by);
        c.globalAlpha = 0.44;
        c.fillStyle = 'rgba(240,220,160,.9)';
        c.beginPath(); c.ellipse(-2.2, 0, 2.2, 1.4 + f * 1.6, -0.5, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(2.2, 0, 2.2, 1.4 + f * 1.6, 0.5, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    },
    thunder(c, w, h, P, t) {          /* 芒种：雷雨 + 农忙 */
      sky(c, w, h, P, t, { sky1: '#2a2a2c', sky2: '#131314' });
      c.save();
      c.globalAlpha = 0.34; c.fillStyle = '#1c1d22';
      for (let i = 0; i < 4; i++) {
        const cx = ((t * (9 + i * 5) + i * w * 0.28) % (w * 1.4)) - w * 0.2;
        c.beginPath();
        c.ellipse(cx, h * (0.08 + (i % 2) * 0.05), w * 0.24, h * 0.05, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      field(c, w, h, P, t, h * 0.62);
      /* 麦 + 农人 */
      for (let i = 0; i < 6; i++) {
        wheat(c, (i / 5) * w * 0.55, h * 0.96, h * 0.16, 'rgba(210,180,110,.32)', Math.sin(t + i));
      }
      person(c, w * 0.76, h * 0.86, h * 0.16, 'rgba(205,214,230,.32)', 'reach');
      /* 闪电 */
      const fl = t % 3.4;
      if (fl < 0.24) {
        c.save();
        c.globalAlpha = 0.5 * (1 - fl / 0.24);
        c.strokeStyle = '#e8ecff'; c.lineWidth = 1.5; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(w * 0.34, h * 0.08); c.lineTo(w * 0.30, h * 0.22);
        c.lineTo(w * 0.35, h * 0.22); c.lineTo(w * 0.31, h * 0.36);
        c.stroke();
        c.restore();
      }
      fall(c, w, h, t, { count: 18, kind: 'rain', color: 'rgba(180,200,225,.5)', speed: 210, len: h * 0.06, alpha: 0.15, sway: 3 });
    },
    sundial(c, w, h, P, t) {          /* 夏至：烈日 + 日晷 + 长影 */
      sky(c, w, h, P, t, { sky1: '#423a28', sky2: '#1c1912' });
      sunDisc(c, w * 0.50, h * 0.17, h * 0.15, P, t, true);
      mountains(c, w, h, P, t, { layers: 2, top: 0.54, alpha: 0.12 });
      field(c, w, h, P, t, h * 0.70);
      /* 日晷：晷针随时间缓慢转动（呼应「日长之至」） */
      sundial(c, w * 0.30, h * 0.82, h * 0.10, 'rgba(224,196,130,.46)');
      /* 长影：随时间左右移动 */
      c.save();
      c.globalAlpha = 0.14;
      c.fillStyle = '#000';
      c.beginPath();
      const sh = Math.sin(t * 0.25) * w * 0.16;
      c.moveTo(w * 0.30, h * 0.86);
      c.lineTo(w * 0.30 + sh, h * 0.86);
      c.lineTo(w * 0.30 + sh * 1.8 + h * 0.02, h * 0.94);
      c.lineTo(w * 0.30 + h * 0.02, h * 0.94);
      c.closePath(); c.fill();
      c.restore();
      person(c, w * 0.68, h * 0.88, h * 0.14, 'rgba(200,212,232,.30)', 'walk');
    },
    hot(c, w, h, P, t) {              /* 小暑：烈日 + 热浪 + 亭 */
      sky(c, w, h, P, t, { sky1: '#453a26', sky2: '#1e1a12' });
      sunDisc(c, w * 0.62, h * 0.16, h * 0.14, P, t, true);
      mountains(c, w, h, P, t, { layers: 2, top: 0.56, alpha: 0.12 });
      field(c, w, h, P, t, h * 0.72);
      pavilion(c, w * 0.22, h * 0.86, h * 0.11, 'rgba(220,200,160,.34)');
      /* 热浪扭曲线 */
      c.save();
      c.strokeStyle = 'rgba(255,210,150,.20)'; c.lineWidth = 1.2; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const y = h * (0.44 + i * 0.08);
        c.beginPath();
        for (let x = 0; x <= w; x += w / 26) {
          const yy = y + Math.sin(x * 0.05 + t * 2.6 + i) * h * 0.014;
          x === 0 ? c.moveTo(x, yy) : c.lineTo(x, yy);
        }
        c.stroke();
      }
      c.restore();
      /* 扇子 */
      c.save();
      c.translate(w * 0.86, h * 0.80);
      c.rotate(Math.sin(t * 0.8) * 0.3);
      c.strokeStyle = 'rgba(230,200,150,.36)'; c.lineWidth = 1.1;
      c.beginPath(); c.arc(0, 0, h * 0.045, -0.9, 0.9); c.stroke();
      c.restore();
    },
    melon(c, w, h, P, t) {            /* 大暑：烈日 + 西瓜 + 萤火 */
      sky(c, w, h, P, t, { sky1: '#48381f', sky2: '#201a10' });
      sunDisc(c, w * 0.30, h * 0.16, h * 0.15, P, t, true);
      mountains(c, w, h, P, t, { layers: 2, top: 0.58, alpha: 0.12 });
      field(c, w, h, P, t, h * 0.74);
      /* 西瓜：条纹球 */
      const mx = w * 0.66, my = h * 0.86, mr = h * 0.09;
      c.save();
      c.globalAlpha = 0.42;
      c.fillStyle = '#4a7a4e';
      c.beginPath(); c.ellipse(mx, my, mr * 1.25, mr, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(30,60,36,.8)'; c.lineWidth = 1.2;
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.ellipse(mx + i * mr * 0.42, my, mr * 0.30, mr * 0.96, i * 0.3, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
      /* 萤火虫：腐草为萤 */
      for (let i = 0; i < 7; i++) {
        const ph = t * 0.5 + i * 1.4;
        const x = w * (0.10 + (i % 4) * 0.22) + Math.sin(ph * 1.3) * w * 0.05;
        const y = h * (0.62 + (i % 3) * 0.10) + Math.cos(ph) * h * 0.04;
        const bl = 0.30 + 0.70 * Math.max(0, Math.sin(t * 2.2 + i * 2));
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = 'rgba(200,240,150,' + (0.5 * bl).toFixed(3) + ')';
        c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 0.18 * bl;
        c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
        c.restore();
      }
      /* 瓜藤叶 */
      sprig(c, w * 0.12, h * 0.98, h * 0.14, -1.2, P.main, 4, Math.sin(t) * 0.25);
    },

    /* ---------- 秋 ---------- */
    leaf(c, w, h, P, t) {             /* 立秋：落叶 + 疏林 */
      sky(c, w, h, P, t, { sky1: '#3c3028', sky2: '#1e1a18' });
      sunDisc(c, w * 0.20, h * 0.20, h * 0.09, P, t, true);
      mountains(c, w, h, P, t, { layers: 2, top: 0.52, alpha: 0.15 });
      /* 树：一根主干 + 分枝 */
      c.save();
      c.strokeStyle = '#4a3c30'; c.lineWidth = h * 0.016; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(w * 0.12, h);
      c.quadraticCurveTo(w * 0.10, h * 0.62, w * 0.15, h * 0.40);
      c.stroke();
      c.lineWidth = h * 0.008;
      for (let i = 0; i < 4; i++) {
        const y0 = h * (0.46 + i * 0.10);
        c.beginPath();
        c.moveTo(w * 0.13, y0);
        c.quadraticCurveTo(w * 0.22, y0 - h * 0.06, w * 0.30, y0 - h * 0.10);
        c.stroke();
      }
      c.restore();
      /* 落叶：多片打旋下落 */
      fall(c, w, h, t, { count: 12, kind: 'leaf', color: 'rgba(200,150,80,.75)', speed: 30, len: 6, alpha: 0.32, sway: 20 });
      field(c, w, h, P, t, h * 0.86);
    },
    dew(c, w, h, P, t) {              /* 处暑/白露：露珠 + 草 */
      sky(c, w, h, P, t, { sky1: '#343036', sky2: '#191a20' });
      sunDisc(c, w * 0.78, h * 0.14, h * 0.08, P, t, false);
      mountains(c, w, h, P, t, { layers: 2, top: 0.54, alpha: 0.14 });
      /* 草丛 + 叶尖露珠（滚动） */
      c.save();
      c.strokeStyle = P.main; c.lineWidth = 1.1; c.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const x = (i / 25) * w;
        const sw = Math.sin(t * 0.9 + i * 0.6) * 2.4;
        c.globalAlpha = 0.24;
        c.beginPath();
        c.moveTo(x, h);
        c.quadraticCurveTo(x + sw, h - h * 0.055, x + sw * 1.7, h - h * 0.10);
        c.stroke();
        /* 露珠 */
        const ph = (t * 0.35 + i * 0.13) % 1;
        c.globalAlpha = 0.30 * Math.sin(ph * Math.PI);
        c.fillStyle = '#d8ecf8';
        c.beginPath();
        c.arc(x + sw * 1.7, h - h * 0.10 + ph * h * 0.012, 1.7, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    },
    harvest(c, w, h, P, t) {          /* 秋分：丰收 + 收割 */
      sky(c, w, h, P, t, { sky1: '#3d3226', sky2: '#1d1814' });
      sunDisc(c, w * 0.24, h * 0.16, h * 0.10, P, t, true);
      mountains(c, w, h, P, t, { layers: 2, top: 0.50, alpha: 0.14 });
      field(c, w, h, P, t, h * 0.62);
      /* 金黄麦浪 */
      for (let i = 0; i < 14; i++) {
        const x = (i / 13) * w;
        wheat(c, x, h * (0.99 - (i % 4) * 0.015), h * (0.18 + (i % 3) * 0.05),
          'rgba(224,186,102,.42)', Math.sin(t * 1.2 + i * 0.7));
      }
      /* 收割者 */
      person(c, w * 0.70, h * 0.84, h * 0.16, 'rgba(215,220,235,.34)', 'reach');
      /* 落粒 */
      fall(c, w, h, t, { count: 8, kind: 'dot', color: 'rgba(230,200,130,.8)', speed: 40, len: 5, alpha: 0.30, sway: 8 });
    },
    goose(c, w, h, P, t) {            /* 寒露：鸿雁南飞 + 菊 */
      sky(c, w, h, P, t, { sky1: '#38323a', sky2: '#1a181e' });
      sunDisc(c, w * 0.82, h * 0.16, h * 0.09, P, t, false);
      mountains(c, w, h, P, t, { layers: 3, top: 0.50, alpha: 0.18 });
      field(c, w, h, P, t, h * 0.78);
      /* 鸿雁：V 字队列，缓慢横移。
     * 【1.8.1】放大 1.8 倍并下移到 0.40~0.62 高度带——
       * 原尺寸太小且贴在顶部，实测被日期格子完全遮住，看不出是「鸿雁」。*/
      const gx = ((t * 20) % (w * 1.6)) - w * 0.3;
      for (let i = 0; i < 7; i++) {
        const row = Math.ceil(i / 2), side = (i % 2 === 0) ? -1 : 1;
        const x = gx + row * w * 0.085;
        const y = h * (0.40 + row * 0.075);
        bird(c, x, y + side * row * h * 0.020, Math.max(9, h * 0.040) * (1 - row * 0.05),
          'rgba(214,226,246,.52)', t * 4.4 + i * 0.6);
      }
      /* 菊花 */
      /* 【1.8.1】菊花放大 1.6 倍、提到 0.78 高度（落在最后一行日期之下可见区）*/
      for (let i = 0; i < 5; i++) {
        const x = w * (0.12 + i * 0.19), y = h * 0.995;
        c.save();
        c.globalAlpha = 0.40;
        c.strokeStyle = 'rgba(234,206,120,.95)'; c.lineWidth = 1.1;
        for (let k = 0; k < 11; k++) {
          const a = (k / 11) * Math.PI * 2 + t * 0.2 + i;
          c.beginPath();
          c.moveTo(x, y - h * 0.048);
          c.lineTo(x + Math.cos(a) * h * 0.036, y - h * 0.048 + Math.sin(a) * h * 0.036);
          c.stroke();
        }
        c.restore();
      }
    },
    frost(c, w, h, P, t) {            /* 霜降/小寒：霜纹窗花 */
      sky(c, w, h, P, t, { sky1: '#2c3440', sky2: '#141a22' });
      mountains(c, w, h, P, t, { layers: 2, top: 0.56, alpha: 0.12 });
      /* 窗花：六出霜纹，缓慢生长 */
      const cx = w * 0.70, cy = h * 0.42, R = h * 0.30;
      c.save();
      c.strokeStyle = 'rgba(200,224,244,.34)'; c.lineWidth = 1; c.lineCap = 'round';
      for (let arm = 0; arm < 6; arm++) {
        const a0 = (arm / 6) * Math.PI * 2;
        const grow = 0.72 + 0.28 * Math.sin(t * 0.4 + arm * 0.5);
        c.globalAlpha = 0.30;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.cos(a0) * R * grow, cy + Math.sin(a0) * R * grow);
        c.stroke();
        /* 分枝 */
        for (let b = 1; b <= 3; b++) {
          const k = b / 4;
          const bx = cx + Math.cos(a0) * R * grow * k;
          const by = cy + Math.sin(a0) * R * grow * k;
          for (const s of [-1, 1]) {
            const a1 = a0 + s * 0.7;
            c.beginPath();
            c.moveTo(bx, by);
            c.lineTo(bx + Math.cos(a1) * R * 0.22, by + Math.sin(a1) * R * 0.22);
            c.stroke();
          }
        }
      }
      /* 中央六角 */
      c.globalAlpha = 0.24;
      c.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = cx + Math.cos(a) * R * 0.22, y = cy + Math.sin(a) * R * 0.22;
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
      c.restore();
      /* 枯枝 */
      c.save();
      c.strokeStyle = '#4a4038'; c.lineWidth = h * 0.012; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(0, h * 0.96); c.quadraticCurveTo(w * 0.14, h * 0.80, w * 0.26, h * 0.74);
      c.stroke();
      c.lineWidth = h * 0.006;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(w * (0.10 + i * 0.06), h * (0.86 - i * 0.04));
        c.lineTo(w * (0.14 + i * 0.06), h * (0.74 - i * 0.04));
        c.stroke();
      }
      c.restore();
    },

    /* ---------- 冬 ---------- */
    store(c, w, h, P, t) {            /* 立冬：粮仓 + 归仓 */
      sky(c, w, h, P, t, { sky1: '#2a323e', sky2: '#131820' });
      mountains(c, w, h, P, t, { layers: 2, top: 0.56, alpha: 0.12 });
      field(c, w, h, P, t, h * 0.80);
      /* 粮仓 */
      c.save();
      c.globalAlpha = 0.36;
      c.fillStyle = '#6a5a44';
      c.beginPath();
      c.moveTo(w * 0.14, h * 0.96); c.lineTo(w * 0.14, h * 0.60);
      c.lineTo(w * 0.26, h * 0.48); c.lineTo(w * 0.38, h * 0.60);
      c.lineTo(w * 0.38, h * 0.96);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(220,200,160,.5)'; c.lineWidth = 1;
      c.stroke();
      c.restore();
      /* 谷堆 */
      c.save();
      c.globalAlpha = 0.34;
      c.fillStyle = '#c9a94f';
      c.beginPath();
      c.moveTo(w * 0.52, h * 0.96);
      c.quadraticCurveTo(w * 0.64, h * 0.82 + Math.sin(t * 0.8) * 2, w * 0.76, h * 0.96);
      c.closePath(); c.fill();
      c.restore();
      /* 篱笆 */
      c.save();
      c.strokeStyle = 'rgba(200,192,170,.30)'; c.lineWidth = 1.2; c.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const x = w * (0.80 + i * 0.028);
        c.beginPath(); c.moveTo(x, h * 0.99); c.lineTo(x, h * 0.88); c.stroke();
      }
      c.beginPath(); c.moveTo(w * 0.78, h * 0.92); c.lineTo(w * 0.99, h * 0.92); c.stroke();
      c.restore();
      person(c, w * 0.60, h * 0.99, h * 0.13, 'rgba(205,215,232,.28)', 'bend');
    },
    snow(c, w, h, P, t) {             /* 小雪/大雪：飘雪 + 积雪 */
      sky(c, w, h, P, t, { sky1: '#2e3644', sky2: '#161c26' });
      mountains(c, w, h, P, t, { layers: 3, top: 0.46, alpha: 0.18 });
      /* 雪：三层不同大小 */
      for (let i = 0; i < 3; i++) {
        fall(c, w, h, t * (0.6 + i * 0.5) + i * 5, {
          count: 14 + i * 12, kind: 'snow', color: 'rgba(235,244,255,.9)',
          speed: 18 + i * 16, len: 2.2 + i * 1.6, alpha: 0.34 - i * 0.07, sway: 10 + i * 6
        });
      }
      /* 积雪线 */
      c.save();
      c.globalAlpha = 0.24; c.fillStyle = '#dce8f6';
      c.beginPath();
      c.moveTo(0, h * 0.90);
      c.quadraticCurveTo(w * 0.25, h * 0.84, w * 0.50, h * 0.89);
      c.quadraticCurveTo(w * 0.75, h * 0.94, w, h * 0.86);
      c.lineTo(w, h); c.lineTo(0, h);
      c.closePath(); c.fill();
      c.restore();
      /* 枯枝覆雪 */
      c.save();
      c.strokeStyle = '#3e3830'; c.lineWidth = h * 0.010; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(w * 0.04, h * 0.92); c.quadraticCurveTo(w * 0.12, h * 0.70, w * 0.20, h * 0.58);
      c.stroke();
      c.lineWidth = 1.4; c.strokeStyle = 'rgba(230,240,252,.5)';
      c.beginPath();
      c.moveTo(w * 0.04, h * 0.92); c.quadraticCurveTo(w * 0.12, h * 0.70, w * 0.20, h * 0.58);
      c.stroke();
      c.restore();
    },
    dumpling(c, w, h, P, t) {         /* 冬至：饺子 + 热气 */
      sky(c, w, h, P, t, { sky1: '#2e3038', sky2: '#16171c' });
      mountains(c, w, h, P, t, { layers: 2, top: 0.58, alpha: 0.10 });
      /* 桌面 */
      c.save();
      c.globalAlpha = 0.24; c.fillStyle = '#6a5240';
      c.fillRect(0, h * 0.80, w, h * 0.20);
      c.restore();
      /* 两个饺子 */
      for (let i = 0; i < 2; i++) {
        const x = w * (0.36 + i * 0.28), y = h * 0.86, s = h * 0.10;
        c.save();
        c.globalAlpha = 0.40;
        c.strokeStyle = 'rgba(235,228,210,.95)'; c.lineWidth = 1.3;
        /* 饺身：半圆 */
        c.beginPath(); c.arc(x, y, s, Math.PI, Math.PI * 2); c.stroke();
        /* 边 */
        c.beginPath(); c.arc(x, y, s, Math.PI, Math.PI * 2); c.stroke();
        /* 褶 */
        for (let k = 0; k < 5; k++) {
          const a = Math.PI + (k + 1) * Math.PI / 6;
          c.beginPath();
          c.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
          c.lineTo(x + Math.cos(a) * s * 1.14, y + Math.sin(a) * s * 1.14);
          c.stroke();
        }
        c.restore();
        /* 热气：三缕上升 */
        c.save();
        c.strokeStyle = 'rgba(220,225,235,.22)'; c.lineWidth = 1.2; c.lineCap = 'round';
        for (let k = 0; k < 2; k++) {
          c.beginPath();
          for (let y2 = y - s * 1.2; y2 > y - s * 3.4; y2 -= h * 0.02) {
            const xx = x + Math.sin((y2 - y) * 0.14 + t * 1.8 + k * 1.6) * h * 0.022;
            Math.abs(y2 - (y - s * 1.2)) < 0.001 ? c.moveTo(xx, y2) : c.lineTo(xx, y2);
          }
          c.stroke();
        }
        c.restore();
      }
    },
    cold(c, w, h, P, t) {             /* 大寒：北风 + 雪原 */
      sky(c, w, h, P, t, { sky1: '#28303c', sky2: '#12161e' });
      mountains(c, w, h, P, t, { layers: 3, top: 0.42, alpha: 0.16 });
      /* 北风线：斜向长线 */
      c.save();
      c.strokeStyle = 'rgba(200,220,240,.28)'; c.lineWidth = 1.2; c.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const y = h * (0.22 + i * 0.10);
        const off = ((t * (40 + i * 16)) % (w * 1.6)) - w * 0.4;
        c.beginPath();
        c.moveTo(off, y);
        c.quadraticCurveTo(off + w * 0.16, y - h * 0.026, off + w * 0.32, y);
        c.stroke();
      }
      c.restore();
      /* 雪原 */
      c.save();
      c.globalAlpha = 0.20; c.fillStyle = '#d8e4f2';
      c.beginPath();
      c.moveTo(0, h * 0.80);
      c.quadraticCurveTo(w * 0.4, h * 0.74, w, h * 0.82);
      c.lineTo(w, h); c.lineTo(0, h);
      c.closePath(); c.fill();
      c.restore();
      /* 蜷缩的鸟 */
      bird(c, w * 0.78, h * 0.86, h * 0.020, 'rgba(210,222,240,.30)', t * 0.8);
      fall(c, w, h, t, { count: 10, kind: 'snow', color: 'rgba(230,240,255,.85)', speed: 22, len: 2.0, alpha: 0.22, sway: 14 });
    }
  };

  /* ============================================================
   * 引擎
   * ============================================================ */
  function createJieQiArt(canvas, opts) {
    opts = opts || {};
    const opacity = opts.opacity == null ? 0.85 : opts.opacity;
    /* 【1.8.2 修复 · 真实缺陷】原先draw() 里写死 `new Date()`（今天），
     * 导致翻到别的月份时背景插画始终停留在「今天所属的节气」，
     * 用户看到的就是「换月份不变」。
     * 现改为由调用方（日历页）传入**当前所查看的年月**，
     * 取该月中间那天的节气，保证与日历标题同步。*/
    let baseDate = opts.date instanceof Date ? opts.date : new Date();
    let reduce = false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
      catch (e) { /* ignore */ }
    }

    let raf = 0;
    let dpr = 1;
    let last = '';

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
    }

    function draw(t) {
      const c = canvas.getContext('2d');
      if (!c) return;
      const w = canvas.width / dpr, h = canvas.height / dpr;
      const tt = reduce ? 0 : (t || 0) / 1000;

      const name = currentJieQi(baseDate);
      const info = JIEQI_INFO[name] || JIEQI_INFO['立春'];
      const P = PALETTE[info.season] || PALETTE.spring;
      const fn = ART[info.art];
      /* 节气切换时重画（新节气对应新场景） */
      if (name !== last) last = name;

      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      if (!fn) return;

      /* 满铺：场景按卡片实际宽高绘制，不再只占中央一小块 */
      c.save();
      c.globalAlpha = opacity;
      fn(c, w, h, P, tt);
      c.restore();

      canvas.setAttribute('data-jieqi', name);
      canvas.setAttribute('data-jieqi-type', info.type);
      canvas.setAttribute('data-jieqi-hint', info.hint);
      canvas.setAttribute('data-jieqi-season', info.season);
    }

    resize();
    if (reduce) {
      draw(0);
    } else {
      const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    }

    return {
      resize: resize,
      draw: draw,
    /* 【1.8.2】供日历翻月时切换节气场景 */
      setDate(d) {
        if (d instanceof Date && isFinite(d.getTime())) {
          baseDate = d;
          return true;
        }
        return false;
      },
      stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
      currentName: () => currentJieQi(baseDate)
    };
  }

  root.JieQiArt = {
    create: createJieQiArt,
    currentJieQi: currentJieQi,
    info: JIEQI_INFO,
    order: ORDER,
    _internals: { ART: ART, approxJieQi: approxJieQi, PALETTE: PALETTE, helpers: { sky, mountains, field, water, wheat, person, bird, sunDisc, fall, sundial, pavilion, sprig } }
  };
  if (typeof module === 'object' && module.exports) module.exports = root.JieQiArt;
})(typeof globalThis !== 'undefined' ? globalThis : this);
