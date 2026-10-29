/* 梦象检索 与 书籍与工具 —— 由规则溯源版 2.1 移植入占事版。
 *
 * 本模块自包含：不依赖 yi-engine.js / upgrade-ui.js，也不改动占事版任何算法文件。
 * 依赖占事版已有的宿主符号：PAGES、PAGE_META、render、go、bind、esc、curPage。
 * 底座若缺 PAGES/PAGE_META，本模块会自行建占位，避免抛错阻断其余页面。
 *
 * 原则：古籍原文按原文列读；算法出处与限制如实标明，不改述为预测。
 */
(function () {
  'use strict';

  // ===== 占位兜底：正常情况下这些宿主符号由 index.html 提供 =====
  if (typeof PAGES === 'undefined') {
    window.PAGES = {};
    render = function () {};   // eslint-disable-line
    go = function () {};       // eslint-disable-line
  }
  if (typeof PAGE_META === 'undefined') window.PAGE_META = {};

  // 典籍链接：与规则溯源版 yi-engine.js 中 SOURCES 保持一致，此处内联以避免引入整个引擎
  const SRC = {
    //《周易》与《易经》为同一部书的两名，均给出可点击的全文入口
    zhouyiA: 'https://zh.wikisource.org/zh-hans/周易',
    zhouyiB: 'https://zh.wikisource.org/zh-hans/易經',
    zhouyiC: 'https://ctext.org/book-of-changes/zh',
    meihua: 'https://zh.wikisource.org/zh-hans/梅花易數/卷一',
    liuyao:  'https://zh.wikisource.org/zh-hans/增刪卜易',
    zhouyi:  'https://zh.wikisource.org/zh-hans/周易',
    meng:    'https://zh.wikisource.org/zh-hans/周公解夢',
    guiguzi: 'https://zh.wikisource.org/zh-hans/鬼谷子/卷01',
    lunar:   'https://github.com/6tail/lunar-javascript'
  };

  // esc 在 index.html 中是顶层函数声明，会挂到 window；此处兜底以防底座改名
  const esc = typeof window.esc === 'function' ? window.esc : (s => String(s == null ? '' : s));

  // 样式与呈现 helper（沿用规则溯源版审计层的视觉规范）
  const style = document.createElement('style');
  style.textContent =
    '.audit-note{padding:14px 18px;border-left:3px solid #d4a853;background:#d4a85312;color:#cec8b8;line-height:1.8;margin:12px 0;border-radius:6px}' +
    '.audit-list{padding-left:22px;line-height:1.9;color:#c4c2d0}' +
    '.audit-table{width:100%;border-collapse:collapse;line-height:1.7;font-size:13px}' +
    '.audit-table td,.audit-table th{padding:10px 12px;border-bottom:1px solid #ffffff12;text-align:left;vertical-align:top}' +
    '.audit-table th{color:#d4a853;white-space:nowrap}' +
    '.audit-scroll{overflow-x:auto}' +
    '.audit-original{font-size:17px;line-height:1.9;color:#e4d6b9;padding:14px;background:#151522;border-radius:8px}' +
    '.audit-sub{color:#9996a9;font-size:12px;line-height:1.8}' +
    'a{color:#d4b778}.sidebar .nav{overflow-y:auto}' +
    /* hero 原以 source-atlas-reference.png 作背景。按需求移除该图片，
       改为纯深色渐变，科普视频由 sources-workbench.js 内嵌渲染。 */
    '.source-hero{grid-column:1/-1;position:relative;overflow:hidden;min-height:310px;border:1px solid #94754b;border-radius:18px;margin-bottom:20px;background:linear-gradient(120deg,#07101f 0%,#0a152c 52%,#091322 100%)}' +
    '.source-symbol{position:absolute;right:10%;top:4%;font-size:260px;line-height:1;color:#d6bd7d88;animation:sourceTurn 36s linear infinite}.source-hero-content{position:relative;padding:40px 6%;max-width:650px;text-shadow:0 2px 10px #02040b}' +
    '.source-hero h2{color:#ecd093;font-size:30px;letter-spacing:.14em}.source-hero p{line-height:1.9;color:#dfd3b6}.source-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:12px}' +
    '.source-tile{padding:15px;border:1px solid #8a714c80;border-radius:10px;background:#18243a;line-height:1.7}.source-tile strong{color:#e9c477}.source-tile small{display:block;color:#aeb6c8;margin:5px 0}.source-tile a{font-size:12px}' +
    '@keyframes sourceTurn{to{transform:rotate(360deg)}}@media(max-width:680px){.source-symbol{font-size:170px;right:-4%;top:25%}.source-hero{min-height:340px}}';
  document.head.appendChild(style);

  const card = (title, body) =>
    `<section class="card wide-card"><div class="card-title">${esc(title)}</div>${body}</section>`;
  const note = t => `<div class="audit-note">${esc(t)}</div>`;
  const list = xs => `<ul class="audit-list">${xs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`;
  const link = (url, label) =>
    `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  const table = (heads, rows) =>
    '<div class="audit-scroll"><table class="audit-table"><thead><tr>' +
    heads.map(h => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>' +
    rows.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') +
    '</tbody></table></div>';

  // ===== 二、科普与工具 =====
  PAGES.sources = function () {
    return '<div class="source-hero"><div class="source-symbol">☯</div><div class="source-hero-content"><h2>科普与工具</h2><p>洛书九宫 · 紫微斗数 · 四柱 · 易卦 · 六壬 · 星象</p><p>按原文、排法和解释阅读，逐项区分已实现的计算与仍供查阅的古籍。</p></div></div>' +
      card('典籍索引与实现状态','<div class="source-grid">'+"<div class=\"source-tile\"><strong>洛书与九宫</strong><small>局部规则已应用</small><div>九数方位与五行</div><a href=\"https://ctext.org/wiki.pl?chapter=71685&if=gb\" target=\"_blank\" rel=\"noopener noreferrer\">查阅原文 ↗</a></div><div class=\"source-tile\"><strong>紫微斗数全书 / 大全</strong><small>安星已实现</small><div>格局与版本待逐条核对</div><a href=\"https://ctext.org/library.pl?if=gb&res=85160\" target=\"_blank\" rel=\"noopener noreferrer\">查阅原文 ↗</a></div><div class=\"source-tile\"><strong>太乙神数</strong><small>典籍索引</small><div>积年与局数未计算</div><a href=\"https://ctext.org/wiki.pl?chapter=432219&if=gb\" target=\"_blank\" rel=\"noopener noreferrer\">查阅原文 ↗</a></div><div class=\"source-tile\"><strong>大六壬</strong><small>典籍索引</small><div>四课三传未计算</div><a href=\"https://ctext.org/wiki.pl?chapter=376291&if=gb\" target=\"_blank\" rel=\"noopener noreferrer\">查阅原文 ↗</a></div><div class=\"source-tile\"><strong>星象</strong><small>典籍索引</small><div>未接入天体星历</div><a href=\"https://ctext.org/wiki.pl?chapter=955155&if=gb\" target=\"_blank\" rel=\"noopener noreferrer\">查阅原文 ↗</a></div><div class=\"source-tile\"><strong>八字 / 纳音 / 四柱</strong><small>四柱已计算</small><div>纳音解释仍需逐项核对</div><a href=\"https://ctext.org/wiki.pl?chapter=117077&if=gb\" target=\"_blank\" rel=\"noopener noreferrer\">查阅原文 ↗</a></div><div class=\"source-tile\"><strong>测字</strong><small>典籍索引</small><div>未实现拆字算法</div><a href=\"https://ctext.org/wiki.pl?chapter=826021&if=gb\" target=\"_blank\" rel=\"noopener noreferrer\">查阅原文 ↗</a></div><div class=\"source-tile\"><strong>解梦</strong><small>原文检索已实现</small><div>无命中不编造</div><a href=\"https://zh.wikisource.org/zh-hans/周公解夢\" target=\"_blank\" rel=\"noopener noreferrer\">查阅原文 ↗</a></div><div class=\"source-tile\"><strong>相骨</strong><small>资料待核</small><div>未实现外貌识别</div><a href=\"https://ctext.org/zh\" target=\"_blank\" rel=\"noopener noreferrer\">查阅原文 ↗</a></div><div class=\"source-tile\"><strong>风水与相宅</strong><small>典籍索引</small><div>未实现实地勘测</div><a href=\"https://ctext.org/wiki.pl?chapter=412426&if=gb\" target=\"_blank\" rel=\"noopener noreferrer\">查阅原文 ↗</a></div><div class=\"source-tile\"><strong>周易与六爻</strong><small>卦爻与纳甲已实现</small><div>伏神等规则未覆盖</div><a href=\"https://ctext.org/book-of-changes/zh\" target=\"_blank\" rel=\"noopener noreferrer\">查阅原文 ↗</a></div><div class=\"source-tile\"><strong>梅花易数</strong><small>时间起卦已实现</small><div>三数法为软件约定</div><a href=\"https://zh.wikisource.org/zh-hans/梅花易數/卷一\" target=\"_blank\" rel=\"noopener noreferrer\">查阅原文 ↗</a></div>"+'</div>'+note('仅供查阅的体系不参与当前测算；未实现的算法不写成结果。')) +
      card('当前计算边界',table(['模块','已实现','未覆盖'],[['四柱','节气与年月日时柱','出生地真太阳时'],['紫微','十二宫与主辅星四化','各派所有格局'],['六爻','本变卦、动爻、纳甲六亲与世应','全部取用规则'],['奇门','时家九宫的星门神','各派完整推演']])+'<p class="audit-sub">历法组件：'+link(SRC.lunar,'lunar-javascript')+'。古籍底本和点校质量可能不同。</p>');
  };

  // 页面标题/副标题（占事版 render() 会读 PAGE_META）
  PAGE_META.sources = ['科普与工具', '原文、流派约定与软件模型'];

  // ===== 侧栏插入两个入口 =====
  const nav = document.querySelector('.nav');
  if (nav) {
    nav.insertAdjacentHTML('beforeend',
      '<div class="nav-item" data-page="sources"><span class="nav-ico">书</span><span>科普与工具</span></div>');
  }

  if(typeof bind!=='function') bind=function(){};
  // 首次渲染
  if (typeof render === 'function') render();
})();