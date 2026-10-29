/* ============================================================
 * visual-fx.js —— 玄机阁 1.8.0 动态视觉系统
 *
 * 五个模块，全部按「数据驱动」设计：
 *   FXClock    首页罗盘时钟：按真实时间实时走动（时/分/秒三针）
 *   FXChart    排盘命盘旋转：多层罗盘快速转动 → 逐渐变慢 → 停在测算结果
 *   FXFortune  运势动态罗盘：星云背景 + 四维辉光扇区
 *   FXZaiyun   灾运生命线：加高 + 极光背景 + 转折点脉冲
 *   FXReview   复盘星盘交互：星云背景 + 五维雷达 + 分项复盘
 *
 * 1.8.0 视觉升级：底图统一交给 cosmos.js 的宇宙星云引擎，
 * 盘面结构参考传统罗盘重做为多层同心环。
 * 算法侧仍只读不写——动画落点与配色完全由上游既有算法决定。
 * ============================================================ */
(function (root) {
  'use strict';

  /* ---------- 通用工具 ---------- */

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ============================================================
   * 【1.9.0 新增】动效门控
   *
   * 规范 §2.4：关闭动效时「所有循环动效停止」。
   * 本模块的五个可视化全部是 requestAnimationFrame 常驻循环，
   * 若只靠 CSS 停不掉 —— canvas 绘制不受 CSS transition/animation 影响。
   * 故这里显式读同一个 MotionPref：
   *   · 有动效 → rAF 照旧（60fps 星云闪烁 + 秒针走动）
   *   · 无动效 → **只绘制一帧**然后停 rAF，画面仍是完整正确的，
   *     即「一帧定妆」而非「空白」或「半成品」。
   * 这样关掉动效同时省电、静止，且不牺牲任何信息可读性。
   * ============================================================ */
  function motionOn() {
    try {
      if (root.MotionPref && typeof root.MotionPref.effective === 'function') {
        return root.MotionPref.effective();
      }
    } catch (e) { /* ignore */ }
    // 降级：MotionPref 未就绪时读系统偏好
    try {
      if (typeof window.matchMedia === 'function'
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    } catch (e) { /* ignore */ }
    return true;
  }

  /* ============================================================
   * 【1.9.0 新增】clearHost —— 清除宿主内上一轮插入的节点
   *
   * 起因（真实缺陷）：五个模块的 destroy() 原先只停 rAF，
   * **不删已插入的 canvas / 包裹层**。而 mount() 开头都会调 destroy()，
   * 于是「切页重挂」「切换动效重挂」每做一次就多留一个节点。
   *
   * 实测：连续三次重挂后同一宿主内 canvas 数 1→2→3→4。
   * 后果有二：
   *   1. 旧 canvas 仍占位、仍占显存，反复切换必然内存增长；
   *   2. 外部按 querySelector('canvas') 取到的是**最早那个已静止的**，
   *      读它的像素会误判为「动画没恢复」—— 实机验证脚本就栽在这里。
   *
   * 修法：mount 一律先清宿主。用原生 DOM 逐个 removeChild，
   * 不用 innerHTML='' —— 后者会连带销毁宿主里可能存在的非本模块节点。
   * ============================================================ */
  function clearHost(host) {
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
  }

  /* ============================================================
   * 【1.9.0 新增】响应式缩放层
   *
   * 背景：1.8.x 的所有盘面都用**固定逻辑坐标**（如 const size = 340）
   * 绘制，画布再由 CSS 拉伸到容器。当时容器也是固定 340px，故两者一致。
   * 1.9.0 要把罗盘/命盘放大到主视觉（直径可达 560px），
   * 若只改 CSS，圆形与文字会**等比拉伸变形**（圆变椭圆、字变形）。
   *
   * 解法：绘制层坐标**完全不动**，只在每帧绘制前按
   *   scale = 容器实测宽 / 逻辑尺寸
   * 做一次 ctx.scale()。这样线条粗细、字号、环距**等比正确**，
   * 且不必改动任何既有绘制代码。
   *
   * 另用 ResizeObserver 监听容器尺寸变化（窗口缩放、侧栏折叠、
   * 高DPI 切换），变化时重设画布像素尺寸。
   * ============================================================ */

  /** 容器 → 画布的绑定：返回 { scale() }，每帧调用即可 */
  function responsive(cvs, logical) {
    let lastCssW = 0, lastCssH = 0;
    const apply = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = cvs.getBoundingClientRect();
      const w = Math.max(1, r.width || logical);
      const h = Math.max(1, r.height || logical);
      /* 像素尺寸按 CSS 尺寸 × dpr，避免高分屏发虚 */
      const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (cvs.width !== pw) cvs.width = pw;
      if (cvs.height !== ph) cvs.height = ph;
      lastCssW = w; lastCssH = h;
    };
    apply();
    let raf = 0;
    const onResize = () => {
      /* 用 rAF 合并高频 resize 事件，避免连续重设画布导致卡顿 */
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; apply(); });
    };
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(onResize);
      if (cvs.parentNode) ro.observe(cvs.parentNode);
      responsive._ro = ro;
    } else {
      window.addEventListener('resize', onResize);
      responsive._win = true;
    }
    return {
      /** 每帧开头调用：设定像素尺寸与缩放，返回实际缩放比 */
      begin() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const r = cvs.getBoundingClientRect();
        const w = Math.max(1, r.width || logical);
        const h = Math.max(1, r.height || logical);
        if (Math.abs(w - lastCssW) > 0.5 || Math.abs(h - lastCssH) > 0.5) apply();
        const c = cvs.getContext('2d');
        if (!c) return 1;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const s = w / logical;
        if (s !== 1) c.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
        return s;
      },
      dispose() {
        try {
          if (responsive._ro) responsive._ro.disconnect();
          if (responsive._win) window.removeEventListener('resize', onResize);
        } catch (e) { /* ignore */ }
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }
    };
  }

  function polarToXY(cx, cy, r, deg) {
    const a = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  /** 把角度均分为 n 份，第 i 份中心角（度，0=正上方，顺时针） */
  function sectorCenter(i, n) { return (360 / n) * (i + 0.5); }

  const WX_COLOR = { 木: '#4a7c59', 火: '#c23a2e', 土: '#b8860b', 金: '#c0c0c0', 水: '#2c5f8a' };
  const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const SHICHEN_HOUR = [23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
  const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

  const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const BAGUA = [
    { name: '坎', sym: '☵', dir: '北' }, { name: '艮', sym: '☶', dir: '东北' },
    { name: '震', sym: '☳', dir: '东' }, { name: '巽', sym: '☴', dir: '东南' },
    { name: '离', sym: '☲', dir: '南' }, { name: '坤', sym: '☷', dir: '西南' },
    { name: '兑', sym: '☱', dir: '西' }, { name: '乾', sym: '☰', dir: '西北' }
  ];
  /* 二十四山：传统罗盘最外圈的方位名，与「立春…大寒」节气一并标注 */
  const ERSHAN = ['壬', '子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳',
    '丙', '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥'];
  const JIEQI24 = ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
    '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
    '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
    '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'];

  function shichenIndex(h) {
    // 23:00 起算子时；0 点仍属子时
    // 【1.7.0】显式取整：birth.hour 可能是来自表单的字符串，'8'/' 8 ' 直接参与
    // 运算会得到 NaN，导致本命时辰显示为 undefined。
    const n = parseInt(h, 10);
    if (!isFinite(n)) return 0;
    return Math.floor(((n + 1) % 24) / 2);
  }

  /* ---------- 【1.7.0】钟面角度基准统一 ----------
   * 真实缺陷：原先钟面存在三套互不兼容的角度基准——
   *   1) 24 小时刻度环用 i*6°（60 格 × 6° = 360°，实为 12 小时盘）；
   *   2) 时辰标注用 polarToXY（0° 在正上方）；
   *   3) 时针用 (h%12)*30°。
   * 三者混用导致时辰环整体错转 90°、高亮扇区与真实时辰对不上；
   * 更严重的是 12 小时盘上子时(0h) 与午时(12h) 落在同一点，12 时辰无法区分。
   *
   * 现统一为「真 24 小时盘」：0 点固定在正上方（子时），每小时 15°，顺时针为正。
   * 时辰 i 中心在 2i 点方向（子 0 点 / 丑 2 点 / … / 亥 22 点），
   * 恰好把 24 小时盘均分为 12 份，与传统罗盘「子午在南北」一致。 */
  function hourAngleDeg(h) { return -90 + ((h % 24) + 24) % 24 * 15; }
  function shichenCenterAngleDeg(i) { return -90 + (((i % 12) + 12) % 12) * 30; }
  /** 分钟/秒针：每小时/每分钟一圈，0 分在正上方 */
  function minuteAngleDeg(m, s) { return -90 + (m + (s || 0) / 60) * 6; }
  function secondAngleDeg(s) { return -90 + (s % 60) * 6; }
  /* polarToXY 自己会减 90°；把画布三角角度转成标签角度时只补偿一次。 */
  function clockLabelAngleDeg(h) { return hourAngleDeg(h) + 90; }
  function shichenLabelAngleDeg(i) { return shichenCenterAngleDeg(i) + 90; }

  /* ---------- 宇宙星云背景（cosmos.js 提供，各模块复用） ----------
   * 1.8.0 起所有模块底图改由cosmos.js 绘制：多层径向渐变 + 星云团块
   * + 三层视差星点 + 亮星十字光芒，营造参考图那种深邃神秘感。 */
  function makeCosmos(canvas, opts) {
    if (root.CosmosBG && typeof root.CosmosBG.create === 'function') {
      return root.CosmosBG.create(canvas, opts);
    }
    /* 兜底：cosmos.js 未加载时退化为纯色，避免整块画布空白 */
    let raf = 0;
    return {
      resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const r = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(r.width * dpr));
        canvas.height = Math.max(1, Math.round(r.height * dpr));
      },
      draw(t) {
        const c = canvas.getContext('2d');
        if (!c) return;
        const w = canvas.width, h = canvas.height;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.fillStyle = '#0a0e26';
        c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(226,232,255,.6)';
        for (let i = 0; i < 60; i++) {
          const a = (i * 2.399);
          const rr = (i / 60);
          c.fillRect((0.5 + Math.cos(a) * rr * 0.5) * w, (0.5 + Math.sin(a) * rr * 0.5) * h, 1.4, 1.4);
        }
      },
      isEmpty() { return false; }
    };
  }

  /* ---------- 盘面通用绘制件 ---------- */

  /** 圆环描边（可选渐变描边） */
  function ring(c, cx, cy, r, color, lw) {
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = color; c.lineWidth = lw == null ? 1 : lw; c.stroke();
  }

    /**
     * 沿圆周排布文字。
     * @param opt.keepUpright true = 文字始终水平正立（不随圆周旋转）。
     *        二十四山、时辰字用此模式——传统罗盘上它们本就是正立排版的，
     *        若跟随圆周旋转，下半圈的字会倒过来，无法辨读。
     *        opt.tangential = true 时才沿切线旋转（备用，本次未用）。
     */
  function ringText(c, cx, cy, r, deg, text, opt) {
    opt = opt || {};
    const p = polarToXY(cx, cy, r, deg);
    c.save();
    c.translate(p.x, p.y);
    if (opt.tangential) c.rotate((deg * Math.PI) / 180);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = opt.color || '#c8bea0';
    c.font = opt.font || '9px sans-serif';
 c.fillText(text, 0, 0);
    c.restore();
  }

  /** 中心对称的刻度线 */
  function tick(c, cx, cy, deg, r1, r2, color, lw) {
    const a = polarToXY(cx, cy, r1, deg), b = polarToXY(cx, cy, r2, deg);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
    c.strokeStyle = color; c.lineWidth = lw == null ? 0.8 : lw; c.stroke();
  }

  /* ============================================================
   * 1. FXClock —— 首页罗盘时钟（1.8.1 按参考图重做）
   *
   * 参考图特征拆解 → 本实现逐项对应：
   *   参考图：深空星云底 + 密布星点
   *        → cosmos.js 宇宙星云（本版已增强星星闪动）
   *   参考图：外圈 0~23 数字刻度环（每 2 小时标数）
   *        → 第 1 层：真 24 小时盘，每 2 小时一个数字
   *   参考图：次圈干支+ 节气文字环绕（甲 乙 丙 … 寅 卯 辰 …）
   *        → 第 2 层：十天干 + 十二地支双环
   *   参考图：**黑色扇形高亮块**标示当前时段
   *        → 第 3 层：当前时辰的深色扇形块（参考图最醒目的元素）
   *   参考图：中心为黑色圆盘，内含大号时分「21:35」+ 小号秒「18°」
   *        → 第 4 层：中心黑盘 + 三行数字（时辰 / 时:分 / 秒）
   *   参考图：三针 —— 白色分针、红色秒针、金色时针
   *        → 时针金色加粗、分针银白、秒针红色带辉光拖尾
   *
   * 【1.8.0→1.8.1 保留的正确设计】
   *   · 时针走 24 小时盘（每天一圈），与外圈刻度一一对应；
   *   · 二十四山以时辰为组居中排布（壬子癸同属子位），与时辰环严格对齐；
   *   · 中心信息移至盘外空白带，彻底避免被三针穿透。
   * ============================================================ */

  const FXClock = {
    id: 'fx-clock',
    raf: 0,

    mount(host, ctx) {
      if (!host) return;
      this.destroy();
      /* 【1.9.0】清除上一轮插入的节点，避免重挂时 canvas 层层堆积 */
      clearHost(host);

      /* 【1.9.0】逻辑尺寸仍为 340，但绘制前按容器实测宽度等比缩放，
       * 故罗盘可随窗口放大到 560px 而不变形。详见 responsive() 注释。*/
      const size = 340;
      const cvs = el('canvas', 'fx-clock-canvas');
      cvs.style.width = '100%'; cvs.style.height = '100%';
      host.appendChild(cvs);
      const resp = responsive(cvs, size);
      FXClock._resp = resp;   /* 供 destroy() 释放（工厂对象为单例式常量） */

      /* 宇宙星云底：星点 240，含亮星十字光芒（1.8.1 已增强闪烁） */
      const cos = makeCosmos(cvs, { seed: 20261006, stars: 240, nebula: true, spikes: true });

      const draw = (t) => {
        const now = new Date();
        /* 【1.9.0】先按容器尺寸设定像素与缩放，再画星云与盘面 */
        resp.begin();
        cos.draw(t);
        /* 星空绘制会重置 Canvas transform；盘面须重新应用逻辑尺寸缩放。 */
        resp.begin();

        const c = cvs.getContext('2d');

        const cx = size / 2, cy = size / 2, R = size / 2 - 3;
        const shiNow = shichenIndex(now.getHours());
        const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
        const ms = now.getMilliseconds();

        /* 中心盘半径：第 3 层（高亮块内边界）与第 4 层（中心盘）共用，
         * 故提前声明，避免第 3 层引用时落入 TDZ（Cannot access before initialization）。*/
        const R_IN = R * 0.27;

        /* 金色多层罗盘和缓慢轨道星尘：以参考图的发光层次重新组织盘面。
         * 所有文字/指针仍由实时钟表数据驱动，装饰环不参与时辰计算。 */
        c.save();
        const aura = c.createRadialGradient(cx, cy, R*.16, cx, cy, R*1.1);
        aura.addColorStop(0,'rgba(251,220,151,.07)');
        aura.addColorStop(.63,'rgba(194,128,51,.11)');
        aura.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=aura; c.beginPath(); c.arc(cx,cy,R*1.1,0,Math.PI*2); c.fill();
        for(let j=0;j<5;j++){
          const rr=R*(.34+j*.155);
          c.beginPath(); c.arc(cx,cy,rr,0,Math.PI*2);
          c.strokeStyle=`rgba(250,207,126,${.22+j*.07})`;
          c.lineWidth=j===4?1.5:.8;
          c.shadowColor='#e9b25f'; c.shadowBlur=j===4?13:5; c.stroke();
        }
        for(let i=0;i<84;i++){
          const a=i*2.399963+t*.000055*(i%3+1);
          const rr=R*(.59+(i%7)*.067);
          const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;
          c.fillStyle=i%6===0?'rgba(255,238,183,.8)':'rgba(224,167,79,.44)';
          c.shadowBlur=i%6===0?9:0;
          c.beginPath();c.arc(x,y,i%6===0?.7:.35,0,Math.PI*2);c.fill();
        }
        /* 八方金纹：每卦用真实的三爻阴阳结构绘制，作为盘面装饰。
         * 方位按本页后天八卦排列；它不参与钟表和命理计算。 */
        const trigram = [[0,1,0],[0,0,1],[1,0,0],[0,1,1],
          [1,0,1],[0,0,0],[1,1,0],[1,1,1]];
        c.save();
        for(let i=0;i<8;i++){
          const a=(-90+i*45)*Math.PI/180;
          const rr=R*.405;
          const px=cx+Math.cos(a)*rr, py=cy+Math.sin(a)*rr;
          c.save();c.translate(px,py);c.rotate(a+Math.PI/2);
          c.lineWidth=1.3;c.lineCap='round';c.strokeStyle='rgba(255,222,148,.77)';
          c.shadowColor='#ffc979';c.shadowBlur=7;
          for(let row=0;row<3;row++){
            const yy=(row-1)*3.2;
            if(trigram[i][row]){c.beginPath();c.moveTo(-6,yy);c.lineTo(6,yy);c.stroke();}
            else for(const xx of [-1,1]){c.beginPath();c.moveTo(xx<0?-6:1.2,yy);c.lineTo(xx<0?-1.2:6,yy);c.stroke();}
          }
          c.restore();
        }
        /* 缓慢掠过的八道光束与两条反向轨道，强化宇宙深度。 */
        c.globalCompositeOperation='screen';
        for(let i=0;i<8;i++){
          const a=(i*45+t*.0008)*Math.PI/180;
          const x1=cx+Math.cos(a)*R*.55,y1=cy+Math.sin(a)*R*.55;
          const x2=cx+Math.cos(a)*R*.99,y2=cy+Math.sin(a)*R*.99;
          const beam=c.createLinearGradient(x1,y1,x2,y2);
          beam.addColorStop(0,'rgba(255,221,151,0)');
          beam.addColorStop(.48,'rgba(255,221,151,.13)');
          beam.addColorStop(1,'rgba(255,221,151,0)');
          c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=beam;c.lineWidth=1;c.stroke();
        }
        c.restore();
        c.restore();

        /* ========== 第 1 层：外圈 24 小时数字刻度环 ========== */
        ring(c, cx, cy, R, 'rgba(212,168,83,.50)', 1.3);
        for (let i = 0; i < 60; i++) {
          const major = i % 5 === 0;
          tick(c, cx, cy, i * 6, R, R - (major ? 8 : 4),
            major ? 'rgba(245,224,168,.85)' : 'rgba(212,168,83,.32)',
            major ? 1.4 : 0.7);
        }
        /* 每 2 小时标一个数字（0,2,4…22），与 24 小时盘严格对应 */
        for (let hh = 0; hh < 24; hh += 2) {
          const p = polarToXY(cx, cy, R - 16, clockLabelAngleDeg(hh));
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillStyle = 'rgba(214,204,178,.80)';
          c.font = '600 9.5px sans-serif';
          c.fillText(String(hh), p.x, p.y);
        }

        /* ========== 第 2 层：二十四山 + 干支双环 ========== */
        const R_SHAN = R - 27;
        ring(c, cx, cy, R_SHAN, 'rgba(212,168,83,.20)', 0.7);
        /* 【1.8.1】二十四山与天干同圈交错排布。
         *
         * 【真实缺陷 · 已修】第一版按 12 时辰 × 3 山 = 36 项去切 ERSHAN，
         * 但 ERSHAN 只有 24 项（二十四山本为 8 卦 × 3山），
         * 后 4 个时辰切出undefined，页面上出现一片「undefined」字样。
         *
         * 现按正确语义分组：ERSHAN 每 3 项为「一卦的三山」
         * （壬子癸 / 艮寅甲 / 卯乙辰 / 巽巳丙 / 午丁未 / 坤申庚 / 酉辛戌 / 乾亥），
         * 共 8 组。每组与两个时辰共享一格，组内三山在 60° 内均分，
         * 并把天干插在组中心，形成「山·山·干·山」的疏密节奏。*/
        /* 二十四山每山占 15°，子、卯、午、酉位分别落在正北、东、南、西。 */
        ERSHAN.forEach((shan, i) => {
          const deg = (i - 1) * 15;
          ringText(c, cx, cy, R_SHAN - 8, deg, shan, {
            color: i % 3 === 1 ? 'rgba(246,224,160,.90)' : 'rgba(188,178,152,.68)',
            font: (i % 3 === 1 ? '600 ' : '') + '8.5px sans-serif'
          });
        });

        /* 地支环（十二地支每 30° 一个） */
        const R_ZHI = R_SHAN - 26;
        ring(c, cx, cy, R_ZHI, 'rgba(212,168,83,.22)', 0.7);
        for (let i = 0; i < 12; i++) {
          /* 【1.8.1 修复】原先用 i*30+15（丑落在 45°），
           * 而时辰高亮块用 shichenCenterAngleDeg（子在 0°），
           * 两套基准差一圈 —— 结果「亥时」的深色块画到了戌位。
           * 现统一为 shichenCenterAngleDeg：子=0°、丑=30°…亥=330°。*/
          const deg = shichenCenterAngleDeg(i);
          const isShiNow = i === shiNow;
          ringText(c, cx, cy, R_ZHI - 8, shichenLabelAngleDeg(i), DIZHI[i], {
            color: isShiNow ? '#ffe9b0' : 'rgba(200,190,164,.66)',
            font: (isShiNow ? '600 ' : '') + (isShiNow ? '11px' : '9px') + ' sans-serif'
          });
        }

        /* ========== 第 3 层：深色扇形高亮块（参考图最醒目元素） ========== */
        /* 【1.8.1 修复 · 真实缺陷】原先用 moveTo(圆心) → arc → closePath，
         * 画出来是一个「三角扇形」；但圆心随后被中心盘盖住，
         * 视觉上就成了一角突兀的黑色缺口（截图实证）。
         * 现改为**环带**（annulus）：内外两条同心弧之间填充，
         * 只覆盖时辰环的宽度，既不侵入中心、也不产生缺口。*/
        const shiDeg = shichenCenterAngleDeg(shiNow);
        const halfW = 13.5;              /* 半角，略窄于 30° 的时辰格 */
        const a0 = (shiDeg - halfW) * Math.PI / 180;
        const a1 = (shiDeg + halfW) * Math.PI / 180;
        const rIn = R_IN + 4, rOut = R_ZHI - 2;
        c.save();
        c.beginPath();
        c.arc(cx, cy, rOut, a0, a1);
        c.arc(cx, cy, rIn, a1, a0, true);
        c.closePath();
        const hg = c.createRadialGradient(cx, cy, rIn, cx, cy, rOut);
        hg.addColorStop(0, 'rgba(255,208,112,.07)');
        hg.addColorStop(0.5, 'rgba(220,151,69,.16)');
        hg.addColorStop(1, 'rgba(48,31,28,.36)');
        c.fillStyle = hg;
        c.fill();
        c.strokeStyle = 'rgba(255,214,133,.65)';
        c.lineWidth = 1;
        c.shadowColor='#eebc66';c.shadowBlur=10;
        c.stroke();
        c.restore();

        /* ========== 第 4 层：中心黑盘 + 三行数字 ========== */
      /* R_IN 已在上方统一声明 */
        c.beginPath(); c.arc(cx, cy, R_IN, 0, Math.PI * 2);
        const hub = c.createRadialGradient(cx-R_IN*.25,cy-R_IN*.28,2,cx,cy,R_IN);
        hub.addColorStop(0,'rgba(60,45,38,.98)');
        hub.addColorStop(.55,'rgba(13,16,31,.98)');
        hub.addColorStop(1,'rgba(4,7,18,.98)');
        c.fillStyle = hub; c.fill();
        ring(c, cx, cy, R_IN, 'rgba(212,168,83,.55)', 1.3);
        ring(c, cx, cy, R_IN - 4, 'rgba(212,168,83,.14)', 0.6);

        c.textAlign = 'center'; c.textBaseline = 'middle';
        const p2 = (v) => String(v).padStart(2, '0');

c.save();c.translate(cx,cy);c.globalAlpha=.28;const rr=R_IN*.65;c.beginPath();c.arc(0,0,rr,0,Math.PI*2);c.fillStyle='#d8bc79';c.fill();c.beginPath();c.moveTo(0,-rr);c.arc(0,0,rr,-Math.PI/2,Math.PI/2);c.arc(0,rr/2,rr/2,Math.PI/2,Math.PI*1.5);c.arc(0,-rr/2,rr/2,Math.PI/2,-Math.PI/2,true);c.fillStyle='#091227';c.fill();c.beginPath();c.arc(0,-rr/2,rr*.12,0,Math.PI*2);c.fillStyle='#091227';c.fill();c.beginPath();c.arc(0,rr/2,rr*.12,0,Math.PI*2);c.fillStyle='#e7cb85';c.fill();c.globalAlpha=.88;[7,3,5,1,6,2,4,0].forEach((v,i)=>{c.save();c.rotate(i*Math.PI/4);c.translate(0,-R_IN*.85);c.strokeStyle='#e8c983';c.lineWidth=1.5;for(let j=0;j<3;j++){c.beginPath();c.moveTo(-6,j*3);if((v>>j)&1)c.lineTo(6,j*3);else{c.lineTo(-2,j*3);c.moveTo(2,j*3);c.lineTo(6,j*3);}c.stroke();}c.restore();});c.restore();
        /* 第 1 行：当前时辰（大字） */
        c.save();
        c.shadowColor = 'rgba(255,214,120,.9)';
        c.shadowBlur = 9;
        c.fillStyle = '#ffe9b0';
        c.font = '600 19px sans-serif';
        c.fillText(SHICHEN[shiNow], cx, cy - R_IN * 0.44);
        c.restore();
        /* 第 2 行：大号时:分（参考图的核心信息） */
        c.font = '600 23px sans-serif';
        c.fillStyle = 'rgba(240,244,255,.97)';
        c.fillText(p2(h) + ':' + p2(m), cx, cy + R_IN * 0.04);
        /* 第 3 行：秒（红色，小号，参考图是「18°」样式） */
        c.save();
        c.shadowColor = 'rgba(232,110,90,.85)';
        c.shadowBlur = 7;
        c.fillStyle = '#e8705c';
        c.font = '600 14px sans-serif';
        c.fillText(p2(s), cx, cy + R_IN * 0.44);
        c.restore();
        /* 时与分之间的小分隔 */
        c.strokeStyle = 'rgba(212,168,83,.22)'; c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(cx - R_IN * 0.52, cy + R_IN * 0.22);
        c.lineTo(cx + R_IN * 0.52, cy + R_IN * 0.22);
        c.stroke();

        /* ========== 三针：金色时针 / 银白分针 / 红色秒针 ========== */
   /* 【1.8.1 修复 · 真实缺陷】原先三针都从圆心 (cx,cy) 起笔，
         * 而中心盘半径 0.30R，三条针的起点全落在盘内，
         * 针身正好压在「亥」字与「21:49」上（截图实证）。
         * 现改为：**从中心盘边缘起笔、向外延伸**，中心信息区彻底干净。*/
        const hand = (deg, len, wid, color, glow) => {
          const a = deg * Math.PI / 180;
  if (glow) { c.shadowColor = color; c.shadowBlur = glow; }
          c.strokeStyle = color; c.lineWidth = wid; c.lineCap = 'round';
          c.beginPath();
          c.moveTo(cx + Math.cos(a) * (R_IN - 1), cy + Math.sin(a) * (R_IN - 1));
          c.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
          c.stroke();
          c.shadowBlur = 0;
        };
        /* 时针：金色加粗，走24 小时盘 */
        hand(hourAngleDeg(h + m / 60 + s / 3600), R * 0.36, 4.6, 'rgba(246,214,140,.97)', 7);
        /* 分针：银白 */
        hand(minuteAngleDeg(m, s + ms / 1000), R * 0.52, 2.6, 'rgba(226,236,255,.92)', 5);
        /* 秒针：红色带辉光，最长 */
        const secDeg = secondAngleDeg(s + ms / 1000);
        hand(secDeg, R * 0.60, 1.3, 'rgba(232,96,80,.96)', 10);
        hand(secDeg + 180, R * 0.14, 1.5, 'rgba(232,96,80,.55)', 0);

        /* 中心轴 */
        c.beginPath(); c.arc(cx, cy, 4.4, 0, Math.PI * 2);
        c.fillStyle = '#f0d696'; c.fill();
        c.beginPath(); c.arc(cx, cy, 1.8, 0, Math.PI * 2);
        c.fillStyle = 'rgba(18,12,6,.92)'; c.fill();

        /* 【1.9.0】动效门控：关闭动效时只画这一帧，不再自续帧 */
        this.raf = motionOn() ? requestAnimationFrame(draw) : 0;
      };
      this.raf = requestAnimationFrame(draw);

      this._ro = function () { cos.resize(); };
      window.addEventListener('resize', this._ro);
    },

    destroy() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      if (this._ro) { window.removeEventListener('resize', this._ro); this._ro = 0; }
      /* 【1.9.0】释放响应式监听，避免离开页面后仍在观察容器 */
      if (this._resp) { this._resp.dispose(); this._resp = null; }
      /* 【1.9.0 修复 · 真实缺陷】原destroy() 只停rAF，**不删已插入的 canvas**。
       * 而 mount() 开头会调 destroy()，于是「切页→重挂」「切动效→重挂」
       * 每做一次就多留一个 canvas。
       * 实测：连续三次重挂后同一宿主内canvas 数 1→2→3→4，
       * 旧canvas 仍占位、仍占显存，且 querySelector('canvas') 会取到
       * **最早那个已静止的**画布 —— 既涨内存又让外部读数失真。
       * 现统一清除本模块插入的画布。*/
      if (this._cvs && this._cvs.parentNode) {
        this._cvs.parentNode.removeChild(this._cvs);
      }
      this._cvs = null;
    }
  };

  /* ============================================================
   * 2. FXChart —— 排盘命盘旋转定盘（1.8.0 二次重做） —— 排盘命盘旋转定盘（1.8.0 二次重做）
   *
   * 【第一版踩坑 · 必须记住的教训】
   * 第一版照搬参考图堆了五层环（节气 + 角度数字 + 山 + 八卦 + 地支 + 四柱），
   * 340px 的小盘根本装不下，实测出现 4 个真实缺陷：
   *   1) 文字重叠成糊团 —— 多层文字落在相邻半径，逐字压边不可读；
   *   2) 星云底图被多层不透明环完全盖住，等于白做背景；
   *   3) 中心四柱干支全挤在中心区，互相叠字；
   *   4) 外圈文字随盘旋转，下半圈整圈倒立。
   * 结论：传统罗盘的信息密度不适合直接塞进小盘。
   *
   * 【1.8.0 二次重做的取舍】
   * 保留参考图的视觉气质（多层同心环 + 金色罗盘线 + 深空星云），
   * 降低信息密度：
   *   · 外圈只留「二十四山」一环文字，不再叠节气名与角度数字；
   *   · 第二圈八卦名 + 卦符，卦符用几何线条绘制（不用字体，避免缺字方框）；
   *   · 第三圈是四柱扇区（核心信息，颜色对应五行）；
   *   · 中心区放大到容得下日柱干支；
   *   · 随盘旋转的文字按下半圈翻转 180°，始终朝外可读；
   *   · 各环只描线不填不透明底，星云能从环间透出。
   *
   * 数据对应：四柱各占一扇区，扇区色 = 该柱天干五行（p.ganColor），
   * 扇区内文字 = 该柱干支。停盘后日柱对准正上方指针。视觉只读不写。
   * ============================================================ */

  const FXChart = {
    id: 'fx-chart',
    raf: 0,
    timer: 0,

    mount(host, ctx) {
      if (!host) return;
      this.destroy();
      /* 【1.9.0】清除上一轮插入的节点，避免重挂时 canvas 层层堆积 */
      clearHost(host);

 const pillars = (ctx && ctx.pillars) || [];
 const bazi = (ctx && ctx.bazi) || null;
      const size = 340;
      /* 【1.9.0】同 FXClock：逻辑坐标不变，绘制前按容器实测宽度等比缩放，
       * 命盘可放大到 620px 而圆与字均不变形。*/
      const cvs = el('canvas', 'fx-chart-canvas');
      cvs.style.width = '100%'; cvs.style.height = '100%';
      host.appendChild(cvs);
      const resp = responsive(cvs, size);
      FXChart._resp = resp;
      /* 星云底图：seed 固定，星点略少以免抢盘面读数重心 */
      const cos = makeCosmos(cvs, { seed: 770415, stars: 150, nebula: true, spikes: true });

      const N = Math.max(1, pillars.length);
      const mainIdx = Math.max(0, pillars.findIndex((p) => p.key === 'day'));
   const DUR = 3400;
      const SPINS = 6;
      const easeOutQuint = (x) => 1 - Math.pow(1 - x, 5);
      const targetCenter = sectorCenter(mainIdx, N);
      const finalRot = SPINS * 360 + (360 - (targetCenter % 360));
      const IDLE_SPEED = 1.4;   /* 度/秒，停盘后极慢自转，保持「活着」 */

      let t0 = 0;
      let settled = false;
   /* 文字朝向：世界角度落在下半圈时翻转 180°，使字始终朝外可读 */
      function orientOut(c, worldDeg) {
   let f = worldDeg % 360;
        if (f < 0) f += 360;
        if (f > 90 && f < 270) c.rotate(Math.PI);
      }

  const draw = (t) => {
        if (!t0) t0 = t;
        const el2 = t - t0;
        const e = el2 < DUR ? easeOutQuint(Math.min(1, el2 / DUR)) : 1;
        const rot = el2 < DUR
       ? finalRot * e
          : finalRot + (el2 - DUR) / 1000 * IDLE_SPEED;

 /* 【1.9.0】先设定画布像素尺寸与等比缩放，再画星云与盘面 */
 resp.begin();
 cos.draw(t);
 resp.begin();  /* cosmos.draw 重置了 transform，恢复 340 逻辑坐标的等比缩放 */

      const c = cvs.getContext('2d');
      const cx = size / 2, cy = size / 2, R = size / 2 - 4;
  const R3 = R - 62;   /* 四柱扇区半径（固定层与旋转层共用） */

    /* 中心星云辉光先画，让多层环透出光晕（环不再填不透明底） */
        const cg = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.7);
   cg.addColorStop(0, 'rgba(96,112,200,.20)');
        cg.addColorStop(0.6, 'rgba(60,70,150,.07)');
 cg.addColorStop(1, 'rgba(60,70,150,0)');
        c.fillStyle = cg;
        c.beginPath(); c.arc(cx, cy, R * 0.7, 0, Math.PI * 2); c.fill();

        /* ================= 旋转盘体 ================= */
        c.save();
        c.translate(cx, cy);
      c.rotate((rot * Math.PI) / 180);

        /* --- 圈 1（最外）：二十四山 --- */
        ring(c, 0, 0, R, 'rgba(212,168,83,.55)', 1.2);
        const R1T = R - 13;
        for (let i = 0; i < 24; i++) {
          const degAdj = (i - 1) * 15;
   const isCardinal = i % 3 === 1;
        const p = polarToXY(0, 0, R1T, degAdj);
          c.save();
          c.translate(p.x, p.y);
     orientOut(c, degAdj + rot);
      c.textAlign = 'center'; c.textBaseline = 'middle';
   c.fillStyle = isCardinal ? 'rgba(245,222,158,.92)' : 'rgba(190,180,155,.60)';
  c.font = (isCardinal ? '600 ' : '') + '9px sans-serif';
      c.fillText(ERSHAN[i], 0, 0);
 c.restore();
        }
      ring(c, 0, 0, R - 24, 'rgba(212,168,83,.24)', 0.7);

        /* --- 圈 2：八卦名（只留名字，不再叠卦符）---
         * 【1.8.0 三次踩坑的最终结论】
         * 卦符（三爻线条）在 340px 盘上无论放内圈还是外圈，都会与
         * 二十四山或四柱扇区压字，且三横线条本身在缩放后像「乱码」。
         * 故最终取舍：**只保留八卦名**，卦符信息以「名字」承载即可，
         * 腾出的空间让山 / 八卦 / 扇区三层各归其位、互不干涉。 */
        const R2T = R - 40;
        BAGUA.forEach((bg, i) => {
          const deg = (360 / 8) * i;
          const p = polarToXY(0, 0, R2T, deg);
          c.save();
          c.translate(p.x, p.y);
          orientOut(c, deg + rot);
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillStyle = 'rgba(238,226,190,.88)';
          c.font = '600 15px sans-serif';
          c.fillText(bg.name, 0, 0);
          c.restore();
        });

        /* --- 圈 3：四柱扇区 ---
         * 【1.9.0】改为**线描式**：只描边、不做实心填充。
         * 依据 —— 参考 MP4 第 8% 帧（实机抽帧）与 151515.jpeg
         * 均为纯线条盘，无任何色块填充；1.8.x 的实心扇区在深空底上
         * 形成四块醒目色块，与参考气质相反。
         * 现改为：仅留极低透明度晕染（0.05）提示五行，
         * 盘面主要靠金色描边与弧线构成。
         * 四柱色仍取自各柱天干五行（真实数据，不变）。*/
        pillars.forEach((p, i) => {
          const a0 = (i * (360 / N)) * Math.PI / 180;
          const a1 = ((i + 1) * (360 / N)) * Math.PI / 180;
          const wx = (p && p.ganColor) ? p.ganColor : '#888';
          c.beginPath();
          c.moveTo(0, 0);
          c.arc(0, 0, R3, a0 + 0.02, a1 - 0.02);
          c.closePath();
          const fg = c.createRadialGradient(0, 0, R3 * 0.55, 0, 0, R3);
          fg.addColorStop(0, hexA(wx, 0));
          fg.addColorStop(1, hexA(wx, 0.05));
          c.fillStyle = fg;
          c.fill();
          /* 主描边用统一金色，保持全盘调性一致 */
          c.strokeStyle = 'rgba(240,214,150,.72)';
          c.lineWidth = 1.5;
          c.stroke();
          /* 内弧：呼应参考图的爻线环，强化线描感 */
          c.beginPath();
          c.arc(0, 0, R3 * 0.62, a0 + 0.04, a1 - 0.04);
          c.strokeStyle = hexA(wx, 0.55);
          c.lineWidth = 1.0;
          c.stroke();
        });
        /* 扇区分隔线 */
        for (let i = 0; i < N; i++) {
   const a = (i * (360 / N)) * Math.PI / 180;
          const p1 = polarToXY(0, 0, R3 * 0.16, a);
          const p2 = polarToXY(0, 0, R3, a);
          c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y);
          c.strokeStyle = 'rgba(240,214,150,.40)';
    c.lineWidth = 0.9;
    c.stroke();
        }
        c.restore();

        /* ================= 固定层：四柱文字（正立、随盘转位置） ================= */
  pillars.forEach((p, i) => {
       const midDeg = (i + 0.5) * (360 / N);
  const gx = (p && p.gan) || '', zx = (p && p.zhi) || '';
          const p0 = polarToXY(cx, cy, R3 * 0.90, rot + midDeg);
          const p1 = polarToXY(cx, cy, R3 * 0.72, rot + midDeg);
        const p2 = polarToXY(cx, cy, R3 * 0.49, rot + midDeg);
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillStyle = 'rgba(210,200,175,.85)';
    c.font = '9px sans-serif';
          c.fillText(['年', '月', '日', '时'][i] || '', p0.x, p0.y);
c.save();
          c.shadowColor = hexA((p && p.ganColor) || '#f0d696', 0.95);
        c.shadowBlur = 9;
          c.fillStyle = (p && p.ganColor) || '#f0d696';
          c.font = '600 20px sans-serif';
  c.fillText(gx, p1.x, p1.y);
     c.restore();
   c.fillStyle = (p && p.zhiColor) || '#c8bea0';
          c.font = '600 17px sans-serif';
    c.fillText(zx, p2.x, p2.y);
        });

        /* 指针（固定正上方） */
        c.save();
  c.shadowColor = 'rgba(240,140,110,.95)';
  c.shadowBlur = 9;
        c.fillStyle = '#e08878';
        c.beginPath();
        c.moveTo(cx, cy - R - 1);
        c.lineTo(cx - 4.5, cy - R - 12);
        c.lineTo(cx + 4.5, cy - R - 12);
        c.closePath();
        c.fill();
    c.restore();

        /* 中心区：日柱定盘结果 */
        const R_IN = R * 0.205;
   c.beginPath(); c.arc(cx, cy, R_IN, 0, Math.PI * 2);
        c.fillStyle = 'rgba(8,10,26,.95)'; c.fill();
ring(c, cx, cy, R_IN, 'rgba(212,168,83,.6)', 1.3);
  const mp = pillars[mainIdx];
        if (mp) {
      c.textAlign = 'center'; c.textBaseline = 'middle';
          if (el2 < DUR) {
            c.fillStyle = 'rgba(240,214,150,.92)';
      c.font = '600 15px sans-serif';
  c.fillText('定 盘 中', cx, cy);
        c.fillStyle = 'rgba(200,190,160,.5)';
    c.font = '8.5px sans-serif';
            c.fillText('乾 坤 艮 巽', cx, cy + 13);
          } else {
    if (!settled) { settled = true; this.onSettled && this.onSettled(); }
    /* 【1.9.0】盘心结果摘要：日柱 + 日主五行与强弱 + 四柱天干。
     * 全部取自 ctx.bazi（真实排盘输出），不自造、不另设算法。
     * 依据见 docs/visual-spec-1.9.0.md §5.2。*/
            const dm = (bazi && bazi.dayWuXing) ? bazi.dayWuXing : '';
        const st = (bazi && bazi.strength && bazi.strength.label) ? bazi.strength.label : '';
            const gans = pillars.map((x) => (x && x.gan) || '').join(' ');
        c.save();
            c.shadowColor = hexA(mp.ganColor || '#f0d696', 0.95);
            c.shadowBlur = 11;
        c.fillStyle = mp.ganColor || '#f0d696';
            c.font = '600 18px sans-serif';
        c.fillText(mp.gan, cx, cy - 17);
 c.restore();
        c.fillStyle = mp.zhiColor || '#c8bea0';
c.font = '600 18px sans-serif';
 c.fillText(mp.zhi, cx, cy + 1);
    /* 日主五行 + 强弱 */
            if (dm || st) {
   c.fillStyle = 'rgba(200,190,160,.72)';
            c.font = '8px sans-serif';
              c.fillText((dm ? dm + '日主' : '') + (st ? (dm ? ' ' : '') + st : ''), cx, cy + 14);
          }
        /* 四柱天干：中心区够宽时才显示，避免小盘拥挤 */
    if (R_IN * 2 > 74 && gans) {
       c.fillStyle = 'rgba(180,172,150,.50)';
            c.font = '6.5px sans-serif';
  c.fillText(gans, cx, cy + 25);
        }
          }
        }

        /* 【1.9.0】动效门控：关闭动效时只画这一帧，不再自续帧 */
        this.raf = motionOn() ? requestAnimationFrame(draw) : 0;
      };
      this.raf = requestAnimationFrame(draw);
    },

    destroy() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
 if (this.timer) clearTimeout(this.timer);
      this.timer = 0;
      /* 【1.9.0】释放响应式监听 */
      if (FXChart._resp) { FXChart._resp.dispose(); FXChart._resp = null; }
    }
  };

  function hexA(hex, a) {
    const h = String(hex || '#888').replace('#', '');
    const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ============================================================
   * 3. FXFortune —— 运势动态罗盘（1.8.0 重做）
   *
   * 改进点（对照用户反馈「太单调、不够炫酷」）：
   *   1) 底图由旧 starfield 换成 cosmos.js 星云引擎，多层渐变 + 呼吸辉光；
   *   2) 四维扇区改为「双层」：外圈渐变辉光带 + 内圈实体扇区，边界更清晰；
   *   3) 停盘后不停留——改为持续缓慢呼吸（辉光强度正弦起伏）+ 星云漂移，
   *      画面始终在动，避免死板；
   *   4) 外环加一圈随时间缓慢旋转的光弧（“能量环”），增加神秘感；
   *   5) 中心干支外加呼吸光晕，视觉焦点更集中。
   *
   * 数据对应：扇区角度占比 = 该维评分 / 四维总分；扇区半径 = 该维评分 / 100。
   * 全部来自 dailyFortune()，视觉层不做任何吉凶判断。
   * ============================================================ */

  const FXFortune = {
    id: 'fx-fortune',
    raf: 0,

    mount(host, ctx) {
      if (!host) return;
      this.destroy();
      /* 【1.9.0】清除上一轮插入的节点，避免重挂时 canvas 层层堆积 */
      clearHost(host);
      const f = (ctx && ctx.fortune) || {};
    const size = 280;
      const cvs = el('canvas', 'fx-fortune-canvas');
      cvs.setAttribute('viewBox', `0 0 ${size} ${size}`);
  cvs.style.width = '100%'; cvs.style.height = '100%';
    host.appendChild(cvs);
      const cos = makeCosmos(cvs, { seed: 552211, stars: 130, nebula: true, spikes: true });

      const scores = (f && f.scores) || {};
      const dims = [
        { k: 'wealth', t: '财', v: scores.wealth || 0, c: '#d4a853' },
        { k: 'love', t: '缘', v: scores.love || 0, c: '#c23a2e' },
      { k: 'career', t: '业', v: scores.career || 0, c: '#4a7c59' },
        { k: 'health', t: '康', v: scores.health || 0, c: '#2c5f8a' }
      ];
      const total = dims.reduce((a, d) => a + d.v, 0) || 1;

      let t0 = 0;
      const DUR = 2600;               /* 入场生长时长 */
      const draw = (t) => {
  if (!t0) t0 = t;
        const el2 = t - t0;
  const p = Math.min(1, el2 / DUR);
     const e = 1 - Math.pow(1 - p, 4);          /* 入场缓出 */
   const tt = t / 1000;

  cos.draw(t);

 const c = cvs.getContext('2d');
  const k = cvs.width / size;
   c.setTransform(k, 0, 0, k, 0, 0);
        const cx = size / 2, cy = size / 2, R = size / 2 - 6;

        /* ---------- 中心呼吸光晕 ---------- */
        const breath = 0.5 + 0.5 * Math.sin(tt * 1.1);
        const cg = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.55);
        cg.addColorStop(0, 'rgba(150,140,220,' + (0.16 + 0.08 * breath).toFixed(3) + ')');
        cg.addColorStop(1, 'rgba(150,140,220,0)');
 c.fillStyle = cg;
   c.beginPath(); c.arc(cx, cy, R * 0.55, 0, Math.PI * 2); c.fill();

        /* ---------- 能量环：缓慢旋转的光弧 ---------- */
      const spinA = (tt * 12) % 360;
        for (let i = 0; i < 3; i++) {
          const a0 = ((spinA + i * 120) - 90) * Math.PI / 180;
     const a1 = a0 + 42 * Math.PI / 180;
          c.beginPath();
          c.arc(cx, cy, R, a0, a1);
  c.strokeStyle = 'rgba(240,214,150,' + (0.10 + 0.10 * breath).toFixed(3) + ')';
       c.lineWidth = 2;
          c.stroke();
        }
      /* 外环静止圈 */
        ring(c, cx, cy, R, 'rgba(212,168,83,.28)', 1);
        ring(c, cx, cy, R - 5, 'rgba(212,168,83,.12)', 0.6);

      /* ---------- 中心留白区（不透明，保证干支可读） ---------- */
        const R_IN = R * 0.32;
        c.beginPath(); c.arc(cx, cy, R_IN, 0, Math.PI * 2);
   c.fillStyle = 'rgba(8,10,26,.86)'; c.fill();
   ring(c, cx, cy, R_IN, 'rgba(212,168,83,.34)', 0.9);

      /* ---------- 四维扇区：外辉光带 + 内实体 ---------- */
        let acc = 0;
        dims.forEach((d) => {
          const frac = d.v / total;
          const a0 = (acc * 360 - 90) * Math.PI / 180;
        const a1 = ((acc + frac) * 360 - 90) * Math.PI / 180;
          acc += frac;
          const v = Math.max(0, Math.min(100, d.v));
    /* 半径：入场时生长到位后，随呼吸轻微起伏（±1.5%），既不呆也不乱 */
const rOuter = (R_IN + (R * 0.84 - R_IN) * (v / 100)) * e
      * (1 + 0.015 * Math.sin(tt * 1.3 + acc * 6));
          const rGlow = rOuter + 4;

      /* 外辉光带（lighter叠加，制造发光边缘） */
          c.save();
c.globalCompositeOperation = 'lighter';
          c.beginPath();
     c.arc(cx, cy, rGlow, a0 + 0.02, a1 - 0.02);
        c.arc(cx, cy, rOuter, a1 - 0.02, a0 + 0.02, true);
    c.closePath();
      const gg = c.createRadialGradient(cx, cy, rOuter * 0.7, cx, cy, rGlow);
  gg.addColorStop(0, hexA(d.c, 0));
          gg.addColorStop(1, hexA(d.c, 0.30));
      c.fillStyle = gg;
c.fill();
        c.restore();

          /* 内实体扇区：径向渐变，中心淡外缘浓 */
   c.beginPath();
          c.arc(cx, cy, rOuter, a0 + 0.03, a1 - 0.03);
          c.arc(cx, cy, R_IN, a1 - 0.03, a0 + 0.03, true);
    c.closePath();
          const fg = c.createRadialGradient(cx, cy, R_IN, cx, cy, Math.max(1, rOuter));
          fg.addColorStop(0, hexA(d.c, 0.10 + 0.04 * breath));
          fg.addColorStop(1, hexA(d.c, 0.34));
      c.fillStyle = fg;
     c.fill();
          /* 边界 */
          c.strokeStyle = hexA(d.c, 0.85);
          c.lineWidth = 1.1;
          c.stroke();

          /* 晶体切面：几何顶点取当前扇区的实际半径，随评分与入场生长。
           * 明暗面仅为视觉，面积仍由原评分决定。 */
          if (rOuter > R_IN + 5) {
            const midA=(a0+a1)/2;
            const p0={x:cx+Math.cos(a0+.05)*R_IN,y:cy+Math.sin(a0+.05)*R_IN};
            const p1={x:cx+Math.cos(a0+.05)*rOuter,y:cy+Math.sin(a0+.05)*rOuter};
            const p2={x:cx+Math.cos(midA)*rOuter,y:cy+Math.sin(midA)*rOuter};
            const p3={x:cx+Math.cos(a1-.05)*rOuter,y:cy+Math.sin(a1-.05)*rOuter};
            c.save();c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.lineTo(p2.x,p2.y);c.closePath();
            c.fillStyle=hexA('#ffffff',.09);c.fill();
            c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p2.x,p2.y);c.lineTo(p3.x,p3.y);c.closePath();
            c.fillStyle=hexA(d.c,.17);c.fill();
            c.strokeStyle='rgba(255,244,221,.26)';c.lineWidth=.7;
            c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p2.x,p2.y);c.lineTo(p3.x,p3.y);c.stroke();
            c.restore();
          }

          /* 标签：贴在扇区外侧，夹紧在画布内 */
     const mid = (a0 + a1) / 2;
          const lp = polarToXY(cx, cy, Math.min(R * 0.96, rGlow + 12), (mid * 180 / Math.PI) + 90);
          c.textAlign = 'center';
        c.textBaseline = 'middle';
    c.save();
          c.shadowColor = hexA(d.c, 0.9);
          c.shadowBlur = 6;
          c.fillStyle = d.c;
          c.font = '600 13px sans-serif';
          c.fillText(d.t, Math.max(11, Math.min(size - 11, lp.x)), lp.y);
 c.restore();
        });

        /* ---------- 中心当日干支 ---------- */
        const dayGz = (f && f.dayGanZhi) || '';
      c.save();
        c.shadowColor = (f && f.dayGanColor) || '#f0d696';
      c.shadowBlur = 10 + 6 * breath;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = (f && f.dayGanColor) || '#f0d696';
  c.font = '600 23px sans-serif';
        c.fillText(dayGz, cx, cy - 4);
        c.restore();
        c.fillStyle = 'rgba(200,190,160,.65)';
        c.font = '10px sans-serif';
        c.fillText('今日干支', cx, cy + 15);

        /* 中心外圈呼吸描边 */
        c.beginPath();
        c.arc(cx, cy, R_IN - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (0.4 + 0.6 * breath));
    c.strokeStyle = 'rgba(240,214,150,.4)';
        c.lineWidth = 1.4;
     c.stroke();

        /* 【1.9.0】动效门控：关闭动效时只画这一帧，不再自续帧 */
        this.raf = motionOn() ? requestAnimationFrame(draw) : 0;
      };
      this.raf = requestAnimationFrame(draw);
    },

    destroy() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  };

  /* ============================================================
   * 4. FXZaiyun —— 灾运一生大运起伏曲线（1.8.0 加高 + 极光背景）
   *
   * 用户反馈「太扁」→ 画布高度从 170 提到 260（CSS 同步调整）；
   * 用户反馈「太死板」→ 底图换成极光氛围：星云 + 极光带 + 流动光带。
   *
   * 曲线下方新增「总体分析与概括」区（见 index.html pageZaiyun）：
   * 文字全部来自既有算法输出（z.summary / z.yunItems / z.turning），
   * 只是把已有数据重新组织为可读的归纳，不新增任何命理判断。
   * ============================================================ */

  const FXZaiyun = {
id:'fx-zaiyun',raf:0,
mount(host, ctx) {if(!host)return;this.destroy();clearHost(host);host.style.height='auto';host.style.overflow='visible';const yun=ctx?.yunItems||[],turning=ctx?.turning||[];
/* 【1.10.0-p1】画布尺寸改为完全交给 CSS（.fx-zaiyun-canvas/.fx-zaiyun-wrap）控制。
   原先此处用内联 style 写死 320px，覆盖了 index.html 里的 260px，
   而 .fx-zaiyun-holder 只有 290px，导致「320px 画布 + 标签行 + 说明块」
   三段总高超出宿主，标签行被挤到画布与说明文字之间形成图文重叠。
   现在 JS 里的绘制坐标系常量 H 与 CSS 保持一致，且不再写内联 height。 */
const CANVAS_H=260;
const wrap=el('div','fx-zaiyun-wrap'),cvs=el('canvas','fx-zaiyun-canvas');cvs.style.width='100%';wrap.appendChild(cvs);host.appendChild(wrap);
const cos=makeCosmos(cvs,{seed:31611,stars:70,nebula:true,spikes:false}),size=900,H=CANVAS_H;
const lab=el('div','fx-zaiyun-labels');const detail=el('div','fx-zaiyun-detail');detail.style.cssText='padding:14px 18px;color:#e9d6aa;background:linear-gradient(90deg,#223a4055,#352c1955);line-height:1.8;min-height:54px';
let selected=0;const pick=i=>{selected=i;const d=yun[i];if(!d)return;const risk=Number(d.risk||0),tp=turning.filter(t=>Math.round(((parseInt(t.age)||0)-(parseInt(yun[0]?.startAge)||0))/10)===i);detail.textContent=d.ganzhi+'大运 · '+(d.startAge!=null?d.startAge+'岁起 · ':'')+'风险参考 '+risk+'/100。'+(risk>=70?'这一段模型提示需要多留意风险，重大投入先复核条件。':risk>=40?'这一段风险处于中间区间，推进时分步确认，保留调整余地。':'这一段风险相对较低，也要把承诺、预算和责任说清。')+(tp.length?' 本段转折记录：'+tp.map(t=>t.text||t.desc||({low:'风险回落',high:'风险上升'}[t.level]||'转折')).join('；'):'')+' 数值来自本次大运模型，不能当作真实事件发生概率。';Array.from(lab.children).forEach((x,j)=>{x.style.background=j===i?'#59472a':'#142238';x.setAttribute('aria-pressed',String(j===i));});};
/* 按钮外观交给 CSS（.fx-zaiyun-labels button），此处只绑行为，
   选中态背景由 pick() 内联切换。 */
yun.forEach((d,i)=>{const btn=el('button','fx-zaiyun-lab',esc(d.ganzhi));btn.type='button';btn.onclick=()=>pick(i);btn.onmouseenter=()=>pick(i);btn.onfocus=()=>pick(i);btn.setAttribute('aria-pressed',String(i===0));lab.appendChild(btn);});host.appendChild(lab);host.appendChild(detail);pick(0);
let t0=0;const draw=t=>{if(!t0)t0=t;cos.draw(t);const c=cvs.getContext('2d');c.setTransform(cvs.width/size,0,0,cvs.height/H,0,0);
/* 绘图区按实际画布高 H 推导，避免写死坐标与容器高度脱节（原bottom=265 就是
   配合 320px 画的，画布降到 260px 后底线会跑到容器外，导致折线被裁、点标签压边）。*/
const left=65,right=835,top=Math.round(H*0.16),bottom=H-Math.round(H*0.14);
const span=bottom-top,n=yun.length;
const x=i=>n<2?450:left+i*(right-left)/(n-1),y=i=>bottom-(Number(yun[i]?.risk||0)/100)*span;
c.strokeStyle='#9aacbc22';c.lineWidth=1;c.setLineDash([2,8]);[0,25,50,75,100].forEach(v=>{const yy=bottom-(v/100)*span;c.beginPath();c.moveTo(left,yy);c.lineTo(right,yy);c.stroke();c.fillStyle='#9aadb9';c.font='11px sans-serif';c.textAlign='right';c.fillText(v,left-15,yy+4);});c.setLineDash([]);c.textAlign='left';c.fillStyle='#dfc58b';c.font='12px sans-serif';c.fillText('大运航线 / 风险参考',left,22);
if(n){const progress=motionOn()?Math.min(1,(t-t0)/2600):1;c.save();c.beginPath();c.rect(left-20,0,(right-left+40)*progress,H);c.clip();
const path=()=>{c.beginPath();c.moveTo(x(0),y(0));for(let i=1;i<n;i++){const mid=(x(i-1)+x(i))/2;c.bezierCurveTo(mid,y(i-1),mid,y(i),x(i),y(i));}};
path();c.lineTo(x(n-1),bottom);c.lineTo(x(0),bottom);c.closePath();const fill=c.createLinearGradient(0,top,0,bottom);fill.addColorStop(0,'#d6b97155');fill.addColorStop(1,'#3aabbc03');c.fillStyle=fill;c.fill();
path();const line=c.createLinearGradient(left,0,right,0);line.addColorStop(0,'#63c8ce');line.addColorStop(.5,'#ffe1a0');line.addColorStop(1,'#cbacfa');c.strokeStyle=line;c.lineWidth=3;c.shadowColor='#edcc87';c.shadowBlur=12;c.stroke();c.shadowBlur=0;
yun.forEach((d,i)=>{const xx=x(i),yy=y(i),color=Number(d.risk)>=70?'#efad9b':'#88d5cf';if(i===selected){c.beginPath();c.arc(xx,yy,15+Math.sin(t/500)*2,0,Math.PI*2);c.strokeStyle='#ffe6a777';c.lineWidth=1;c.stroke();c.beginPath();c.moveTo(xx,yy+18);c.lineTo(xx,bottom);c.strokeStyle='#e9c98644';c.stroke();}c.beginPath();c.arc(xx,yy,i===selected?5:3,0,Math.PI*2);c.fillStyle=color;c.fill();c.fillStyle='#fff0cf';c.font=(i===selected?'600 ':'')+'12px sans-serif';c.textAlign='center';
/* 数值标签钳制在画布内，避免高峰点标签被顶部裁切（原yy-16 无下限保护） */
c.fillText(String(d.risk||0),xx,Math.max(top+12,yy-16));});c.restore();}
this.raf=motionOn()?requestAnimationFrame(draw):0;};this.raf=requestAnimationFrame(draw);
},
destroy(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;}
};

  /* ============================================================
   * 5. FXReview —— 复盘五维星盘（交互式）
   * 点击维度高亮，显示该项复盘详情
   * ============================================================ */

  const FXReview = {
    id: 'fx-review',
    raf: 0,
    onPick: null,

    mount(host, ctx) {
      if (!host) return;
      this.destroy();
      /* 【1.9.0】清除上一轮插入的节点，避免重挂时 canvas 层层堆积 */
      clearHost(host);
      const rows = (ctx && ctx.rows) || [];
      const size = 280;
      const wrap = el('div', 'fx-review-wrap');
      const cvs = el('canvas', 'fx-review-canvas');
      cvs.setAttribute('viewBox', `0 0 ${size} ${size}`);
      cvs.style.width = '100%'; cvs.style.height = '100%';
      wrap.appendChild(cvs);
      host.appendChild(wrap);
      /* 【1.8.0】底图由旧 starfield 换成宇宙星云引擎；
       * 种子按 rows 维度数派生，使不同命盘背景略有差异。 */
      const sf = makeCosmos(cvs, {
        seed: 4400 + (rows.length || 1) * 137,
        stars: 150, nebula: true, spikes: true
      });

      // 五维（对应分项复盘的维度），g:好 m:平 b:待改善
      const dims = rows.map((r, i) => ({
        name: r.dim || ('项' + (i + 1)),
        g: r.g,
        score: r.g === 'g' ? 78 : (r.g === 'm' ? 58 : 40),
        row: r
      }));

      const detail = (ctx && ctx.detailHost) ? ctx.detailHost : el('div', 'fx-review-detail');
      if (detail.parentNode !== host) host.parentNode.insertBefore(detail, host.nextSibling);
      let hoverIdx = -1, pickedIdx = -1;

      function showDetail(i) {
        if (i < 0 || !dims[i]) {
          detail.innerHTML = '<div class="fr-hint">点击星盘任一维度，查看该项复盘与方案</div>';
          return;
        }
        const d = dims[i];
        const cls = d.g === 'g' ? 'good' : (d.g === 'm' ? 'mid' : 'bad');
        const vt = d.g === 'g' ? '好 · 锦上添花' : (d.g === 'm' ? '平 · 顺势而为' : '待改善 · 需解法');
        detail.innerHTML =
          '<div class="fr-dim ' + cls + '">' + esc(d.name) + '<span class="fr-verdict">' + vt + '</span></div>' +
          '<div class="fr-fact">' + esc(d.row.fact || '') + '</div>' +
          (d.row.fix ? '<div class="fr-fix">' + d.row.fix + '</div>' : '');
      }
      showDetail(-1);

      cvs.style.cursor = 'pointer';
      /* 屏幕坐标 → 画布逻辑坐标（size×size 坐标系）。
       * 绘制端已按 setTransform(kx,ky) 映射到 size×size 逻辑坐标，
       * 故事件只需按 rect 比例映射到同一逻辑坐标系即可精确对齐。 */
      const toLocal = (ev) => {
        const r = cvs.getBoundingClientRect();
        return {
          x: ((ev.clientX - r.left) / r.width) * size,
          y: ((ev.clientY - r.top) / r.height) * size
        };
      };
      cvs.addEventListener('mousemove', (ev) => {
        const m = toLocal(ev);
        const i = pickDim(m.x, m.y, dims, size);
        if (i !== hoverIdx) { hoverIdx = i; repaint(); }
        cvs.title = hoverIdx >= 0 ? dims[hoverIdx].name : '';
      });
      cvs.addEventListener('mouseleave', () => {
        if (hoverIdx !== -1) { hoverIdx = -1; repaint(); }
      });
      cvs.addEventListener('click', (ev) => {
        const m = toLocal(ev);
        const i = pickDim(m.x, m.y, dims, size);
        pickedIdx = (i === pickedIdx) ? -1 : i;
        showDetail(pickedIdx);
        this.onPick && this.onPick(pickedIdx >= 0 ? dims[pickedIdx] : null);
        repaint();
      });

      function pickDim(mx, my, dims2, size2) {
        if (!dims2.length) return -1;
        /* 与 paintFrame 保持同一套几何（逻辑坐标 size×size），保证点得中 */
        const R = Math.max(40, size2 / 2 - 26);
        const cx = size2 / 2, cy = size2 / 2;
        const ang = Math.atan2(mx - cx, -(my - cy)) * 180 / Math.PI; // 0=上
        let best = -1, bestD = 1e9;
        dims2.forEach((d, i) => {
          const c = sectorCenter(i, dims2.length);
          let da = Math.abs(((ang - c + 540) % 360) - 180);
          if (da < bestD) { bestD = da; best = i; }
        });
        // 必须落在雷达外环附近才算命中，避免点击远端空白也选中最近维度
        const dist = Math.hypot(mx - cx, my - cy);
        if (dist > R + 16) return -1;
        return bestD < (360 / dims2.length) / 2 ? best : -1;
      }

      let t0 = 0;
      const DUR = 2600;
      /* 绘制一帧静态画面。e 为入场进度（0→1）。
       * 入场动画结束后 rAF 停止，但悬停/点击仍需重绘高亮，
       * 故交互事件直接调用本函数以 e=1 重画。 */
      const paintFrame = (e) => {
        const nowMs = performance.now();
        sf.draw(nowMs);
        const tt = nowMs / 1000;
        const c2 = cvs.getContext('2d');
        /* 【1.7.0 修复】真实缺陷：canvas 原先被 CSS height:auto 压成扁矩形
         * （实测 268x134），而此处 R 固定按 size/2-34 计算并以单轴缩放绘制，
         * 导致雷达图纵向越出画布、标签被裁。现在：
         *   1) CSS 改为 width/height:100% + 容器 aspect-ratio:1/1，画布恒为正方形；
         *   2) 绘制统一在 size×size 逻辑坐标系内按双轴缩放；
         *   3) 外环留 26px 给标签，长标签用 measureText 夹紧防溢出。 */
        const kx = cvs.width / size, ky = cvs.height / size;
        c2.setTransform(kx, 0, 0, ky, 0, 0);
        const R = size / 2 - 26;
        const cx = size / 2, cy = size / 2;

        /* ---------- 【1.8.0】中心辉光 + 呼吸 ---------- */
        const breath = 0.5 + 0.5 * Math.sin(tt * 1.2);
        const cg = c2.createRadialGradient(cx, cy, 0, cx, cy, R * 0.7);
        cg.addColorStop(0, 'rgba(120,110,200,' + (0.14 + 0.08 * breath).toFixed(3) + ')');
        cg.addColorStop(1, 'rgba(120,110,200,0)');
        c2.fillStyle = cg;
        c2.beginPath(); c2.arc(cx, cy, R * 0.7, 0, Math.PI * 2); c2.fill();

        // 同心环（外环随呼吸微亮）
        [0.33, 0.66, 1].forEach((f, i) => {
          c2.strokeStyle = i === 2
            ? 'rgba(212,168,83,' + (0.20 + 0.12 * breath).toFixed(3) + ')'
            : 'rgba(212,168,83,.12)';
          c2.lineWidth = i === 2 ? 1.1 : 0.7;
          c2.beginPath(); c2.arc(cx, cy, R * f, 0, Math.PI * 2); c2.stroke();
        });

        // 独立轨道缓转，节点与命盘维度保持静止以便点击。
        c2.save();c2.translate(cx,cy);c2.rotate(-.18);c2.scale(1,.65);
        for(let j=0;j<3;j++){
          const rr=R*(.51+j*.24);
          c2.beginPath();c2.arc(0,0,rr,tt*(.13+j*.04),tt*(.13+j*.04)+Math.PI*1.35);
          c2.strokeStyle='rgba(237,198,122,'+(.26+j*.09)+')';c2.lineWidth=1.1;c2.stroke();
          const a=tt*(.13+j*.04)+Math.PI*1.35;
          c2.beginPath();c2.arc(Math.cos(a)*rr,Math.sin(a)*rr,2.4,0,Math.PI*2);
          c2.fillStyle='#ffe3a8';c2.shadowColor='#ffc96b';c2.shadowBlur=12;c2.fill();
        }
        c2.restore();
        // 中心小点 + 十字微光
        c2.strokeStyle = 'rgba(212,168,83,.22)'; c2.lineWidth = 0.6;
        c2.beginPath();
        c2.moveTo(cx - 7, cy); c2.lineTo(cx + 7, cy);
        c2.moveTo(cx, cy - 7); c2.lineTo(cx, cy + 7);
        c2.stroke();

        if (dims.length) {
          // 雷达多边形
          const pts = dims.map((d, i) => {
            const ang = sectorCenter(i, dims.length) * Math.PI / 180;
            const rr = R * (d.score / 100) * e;
            return { x: cx + rr * Math.sin(ang), y: cy - rr * Math.cos(ang) };
          });
          // 填充：中心浓、边缘淡，避免糊成一块
          c2.beginPath();
          pts.forEach((pt, i) => { i ? c2.lineTo(pt.x, pt.y) : c2.moveTo(pt.x, pt.y); });
          c2.closePath();
          const fg = c2.createRadialGradient(cx, cy, 0, cx, cy, R);
          fg.addColorStop(0, 'rgba(212,168,83,.26)');
          fg.addColorStop(1, 'rgba(212,168,83,.10)');
          c2.fillStyle = fg;
          c2.fill();
          c2.save();
          c2.shadowColor = 'rgba(240,214,150,.85)';
          c2.shadowBlur = 8;
          c2.strokeStyle = 'rgba(240,214,150,.92)';
          c2.lineWidth = 1.6;
          c2.stroke();
          c2.restore();
          // 顶点 + 标签
          dims.forEach((d, i) => {
            const ang = sectorCenter(i, dims.length) * Math.PI / 180;
            const pt = pts[i];
            const active = (i === hoverIdx) || (i === pickedIdx);
            const col = d.g === 'g' ? '#7a9b8a' : (d.g === 'm' ? '#d4a853' : '#e08878');
            // 轴线
            c2.strokeStyle = active ? hexA(col, .5) : 'rgba(212,168,83,.18)';
            c2.lineWidth = active ? 1.2 : 0.6;
            c2.beginPath(); c2.moveTo(cx, cy); c2.lineTo(pt.x, pt.y); c2.stroke();
            /* 【1.8.0】选中/悬停时在顶点外扩一圈脉冲光环，
             * 让「点了哪一项」在视觉上一眼可辨。*/
            if (active) {
              const pl = 0.5 + 0.5 * Math.sin(tt * 3.2);
              c2.beginPath();
              c2.arc(pt.x, pt.y, 6 + pl * 6, 0, Math.PI * 2);
              c2.strokeStyle = hexA(col, (0.5 - pl * 0.32).toFixed(3));
              c2.lineWidth = 1.4;
              c2.stroke();
            }
            // 点（带辉光）
            c2.save();
            if (active) { c2.shadowColor = col; c2.shadowBlur = 9; }
            c2.beginPath(); c2.arc(pt.x, pt.y, active ? 5 : 3.4, 0, Math.PI * 2);
            c2.fillStyle = col; c2.fill();
            c2.restore();
            /* 标签：贴外环，并夹紧在画布内防止左右/上下溢出被裁。
             * 维度名较长（如「事业健康」）时用 measureText 估算半宽做夹取。 */
            const cdeg = sectorCenter(i, dims.length);
            const lp = polarToXY(cx, cy, R + 15, cdeg);
            c2.font = (active ? '600 ' : '') + '11px sans-serif';
            const halfW = c2.measureText(d.name).width / 2 + 2;
            const lx = Math.max(halfW, Math.min(size - halfW, lp.x));
            const ly = Math.max(9, Math.min(size - 4, lp.y));
            c2.fillStyle = active ? col : 'rgba(210,200,175,.8)';
            c2.textAlign = 'center';
            c2.textBaseline = 'middle';
            c2.fillText(d.name, lx, ly);
          });
        } else {
          c2.fillStyle = 'rgba(200,190,160,.5)';
          c2.font = '12px sans-serif';
          c2.textAlign = 'center';
          c2.textBaseline = 'middle';
          c2.fillText('暂无复盘数据', cx, cy);
        }
      };

      /* 交互重绘：动画播完后依然能响应悬停与选中高亮。
         【1.8.0】脉冲相位统一走 performance.now()，与 paintFrame 内一致，
         否则悬停重绘时 tt 归零、光环会闪一下再重新开始。*/
      function repaint() { paintFrame(1); }

      const draw = (t) => {
        if (!t0) t0 = t;
        const p = Math.min(1, (t - t0) / DUR);
        const e = 1 - Math.pow(1 - p, 4);
        paintFrame(e);
        this.raf = motionOn() ? requestAnimationFrame(draw) : 0;
      };
      this.raf = requestAnimationFrame(draw);
    },

    destroy() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  };

  /* ---------- 统一挂载 / 清理 ---------- */

  const ALL = { 'fx-clock': FXClock, 'fx-chart': FXChart, 'fx-fortune': FXFortune, 'fx-zaiyun': FXZaiyun, 'fx-review': FXReview };

  /* 【1.9.0】记录当前挂载点，供动效开关切换后原样重挂。
   * 动效关闭时模块只画一帧就停rAF；用户重新打开动效后，
   * 若不重挂，页面会一直停在那一帧不动（看似 bug）。
   * 故保存 { which, host, ctx }，remountAll() 按同一参数重建。 */
  let MOUNTED = [];
  function trackMount(which, host, ctx) {
    MOUNTED = MOUNTED.filter((x) => x.host !== host);
    MOUNTED.push({ which, host, ctx });
  }
  function untrackHost(host) {
    MOUNTED = MOUNTED.filter((x) => x.host !== host);
  }

  const VisualFX = {
    FXClock, FXChart, FXFortune, FXZaiyun, FXReview,
    // 【1.7.0】导出内部几何工具，供测试直接断言真实实现（而非复算公式）
    _internals: {
      shichenIndex, shichenCenterAngleDeg, sectorCenter, polarToXY,
      hourAngleDeg, minuteAngleDeg, secondAngleDeg,
      clockLabelAngleDeg, shichenLabelAngleDeg
    },
    /** 动效是否开启（供外部与测试读取，与内部门控同一真源） */
    motionOn,
    /** 挂载某个模块到容器 */
    mount(which, host, ctx) {
      const m = ALL[which];
      if (!m || !host) return;
      m.mount(host, ctx);
      trackMount(which, host, ctx);
    },
    /** 【1.9.0】按当前动效开关重建全部在挂模块 */
    remountAll() {
      const list = MOUNTED.slice();
      MOUNTED = [];
      list.forEach(({ which, host, ctx }) => {
        // 容器可能已被页面切换移除，此时跳过而不是报错
        if (!host || !host.isConnected) return;
        try { const m = ALL[which]; if (m) m.mount(host, ctx); } catch (e) { /* ignore */ }
        trackMount(which, host, ctx);
      });
    },
    /** 当前在挂的模块数（供测试断言重挂后数量不变） */
    mountedCount() { return MOUNTED.length; },
    destroyAll() {
      Object.keys(ALL).forEach((k) => { try { ALL[k].destroy(); } catch (e) { /* ignore */ } });
      MOUNTED = [];
    }
  };

  /* 把重挂能力暴露给全局：动效开关的 UI 回调会调用 */
  root.remountAllFX = function () { try { VisualFX.remountAll(); } catch (e) { /* ignore */ } };

  root.VisualFX = VisualFX;
  if (typeof module === 'object' && module.exports) module.exports = VisualFX;
})(typeof globalThis !== 'undefined' ? globalThis : this);
