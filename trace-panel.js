/* ============================================================
 * 【1.9.0】排盘「查看依据」—— 可追溯抽屉
 *
 * 需求：中心显示测算结果摘要，并提供「查看依据」入口，可追溯
 *  1. 出生输入（原文，不做任何加工）
 *  2. 农历→公历换算（实际调用的换算结果）
 *  3. 节气边界 / 起运依据
 *  4. 四柱逐步计算（年/月/日/时各柱的天干地支）
 *  5. 所用规则与版本号
 *
 * 铁律：**只读既有输出，不自算**。
 * 每一项都来自 core.calcBazi / li.lunarToSolar 的真实返回值，
 * 拿不到就显示「未提供」，绝不编造。
 * ============================================================ */

/** 收集依据数据（全部来自真实计算结果） */
function traceFacts(bazi, birth) {
  const T = {};
  const safe = (fn, fb) => { try { const v = fn(); return (v == null || v === '') ? fb : v; } catch (e) { return fb; } };

  /* —— 1. 出生输入原文 —— */
  if (birth) {
    T.inputName = birth.name || '（未填）';
    T.inputGender = birth.gender || '—';
    T.inputLunar = birth.lunarYear
      ? ('农历 ' + birth.lunarYear + '年' + (birth.isLeap ? '闰' : '') + birth.lunarMonth + '月' + birth.lunarDay + '日')
      : '（未用农历录入）';
    T.inputSolar = birth.year
      ? (birth.year + '年' + birth.month + '月' + birth.day + '日 ' + (birth.hourText || ('时辰 ' + birth.hour)))
      : '—';
  }

  /* —— 2. 农历→公历换算（实际结果） —— */
  T.solarText = safe(() => bazi.solarDate, '');
  T.lunarText = safe(() => bazi.lunarText, '');
  T.lunarMD = safe(() => (bazi.lunarMonth + '月' + bazi.lunarDay), '');

  /* —— 3. 四柱（逐步：年→月→日→时） —— */
  if (bazi && Array.isArray(bazi.pillars)) {
    T.pillars = bazi.pillars.map((p) => ({
      key: p.key, gan: p.gan, zhi: p.zhi,
      ganWx: p.ganWx || '', zhiWx: p.zhiWx || '',
ganColor: p.ganColor || '', label: p.key === 'year' ? '年柱'
        : p.key === 'month' ? '月柱' : p.key === 'day' ? '日柱' : '时柱'
    }));
  }

  /* —— 4. 节气 / 起运边界 —— */
  T.yunStart = safe(() => {
    const y = bazi.yun && bazi.yun.items && bazi.yun.items[0];
    return y ? (y.startAge + ' 岁起运（' + y.startYear + ' 年）') : '';
  }, '');
  T.xunKong = safe(() => (bazi.xunKong ? ('日柱旬空：' + bazi.xunKong) : ''), '');

  /* —— 5. 规则与版本 —— */
  /* 算法版本：ALGO_VERSION 定义在 core/trace.js 内部且**未导出**，
   * 但 InputRecord 实例带 algoVersion 字段 —— 故用它的实例取真实版本。
   * 【1.9.0 修正】初版读 window.ALGO_VERSION / core.ALGO_VERSION
   * 这两条路径在页面里都不存在，导致「算法版本」永远显示「未提供」。*/
  T.algoVersion = safe(() => {
    const RT = (typeof window !== 'undefined') ? window.RuleTrace : null;
    if (RT && typeof RT.InputRecord === 'function') {
      return new RT.InputRecord({ system: 'bazi' }).algoVersion;
    }
    return '';
  }, '');
  /* 产品版本：页面环境无 package.json 直读入口，
   * 优先取构建时注入的 window.APP_VERSION（由 tools注入脚本设置）；
   * 没有就留空显示「未提供」——不臆造版本号。*/
  T.appVersion = safe(() => (typeof window !== 'undefined' && window.APP_VERSION)
    ? String(window.APP_VERSION) : '', '');
  T.rules = safe(() => (bazi.baziText ? ('四柱：' + bazi.baziText) : ''), '');
  T.strength = safe(() => (bazi.strength ? (bazi.strength.label + (bazi.strength.desc ? '　' + bazi.strength.desc : '')) : ''), '');
  T.yongshen = safe(() => (bazi.yongshen ? ('喜用 ' + bazi.yongshen.xiText + '　忌 ' + bazi.yongshen.jiText) : ''), '');
  T.xingShui = safe(() => ('行运：' + bazi.xingShui), '');

  return T;
}

/** 在盘下方渲染「查看依据」入口（内容由抽屉承载） */
function renderTraceEntry(bazi, birth) {
  const host = document.getElementById('trace-entry');
  if (!host) return;
  host.innerHTML =
    '<button class="btn-ghost trace-btn" type="button" id="btn-trace">查看依据</button>'
    + '<span class="trace-hint">出生输入 · 农历换算 · 节气起运 · 四柱 · 规则版本</span>';
  const btn = document.getElementById('btn-trace');
  if (btn) btn.onclick = () => openTraceDrawer(bazi, birth);
}

/** 打开依据抽屉 */
function openTraceDrawer(bazi, birth) {
  const T = traceFacts(bazi || {}, birth || null);
  const row = (k, v) => (v
    ? '<div class="tr-row"><div class="tr-k">' + esc(k) + '</div><div class="tr-v">' + esc(v) + '</div></div>'
    : '<div class="tr-row tr-empty"><div class="tr-k">' + esc(k) + '</div><div class="tr-v">未提供</div></div>');

  const pillarRows = (T.pillars || []).map((p) =>
    '<tr><td>' + esc(p.label) + '</td>'
    + '<td style="color:' + esc(p.ganColor || '#e8ecf5') + '">' + esc(p.gan) + '</td>'
    + '<td>' + esc(p.zhi) + '</td>'
    + '<td>' + esc(p.ganWx) + '</td>'
    + '<td>' + esc(p.zhiWx) + '</td></tr>').join('');

  const body =
      '<div class="tr-sec">① 出生输入（原文）</div>'
    + row('称呼', T.inputName) + row('性别', T.inputGender)
    + row('录入方式', T.inputLunar) + row('公历', T.inputSolar)
    + '<div class="tr-sec">② 农历 → 公历换算</div>'
    + row('公历日期', T.solarText) + row('农历日期', T.lunarText) + row('农历月日', T.lunarMD)
    + '<div class="tr-sec">③ 四柱逐步计算</div>'
    + '<table class="tr-table"><thead><tr><th>柱</th><th>天干</th><th>地支</th><th>干五行</th><th>支五行</th></tr></thead>'
    + '<tbody>' + (pillarRows || '<tr><td colspan="5">未提供</td></tr>') + '</tbody></table>'
    + row('四柱汇总', T.rules)
    + '<div class="tr-sec">④ 节气边界与起运</div>'
    + row('起运', T.yunStart) + row('旬空', T.xunKong) + row('行运', T.xingShui)
    + '<div class="tr-sec">⑤ 所用规则与版本</div>'
    + row('日主强弱', T.strength) + row('喜用忌神', T.yongshen)
    + row('算法版本', T.algoVersion ? ('ALGO_VERSION ' + T.algoVersion) : '')
    + row('产品版本', T.appVersion)
    + '<div class="tr-note">以上各项均取自本次真实计算结果，未经二次加工；'
    + '本软件只做传统命理推演与文化展示，不作任何医学、安全或功效承诺。</div>';

  const mask = document.getElementById('trace-mask');
  if (!mask) {
    const d = document.createElement('div');
    d.id = 'trace-mask';
    d.className = 'tr-mask hide';
    d.innerHTML = '<div class="tr-panel">'
      + '<div class="tr-title">测算依据<span class="tr-close" id="tr-close">关闭</span></div>'
      + '<div class="tr-body" id="tr-body"></div>'
      + '</div>';
    document.body.appendChild(d);
    const close = () => d.classList.add('hide');
    d.querySelector('#tr-close').onclick = close;
    d.addEventListener('click', (e) => { if (e.target === d) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }
  const m = document.getElementById('trace-mask');
  m.querySelector('#tr-body').innerHTML = body;
  m.classList.remove('hide');
}