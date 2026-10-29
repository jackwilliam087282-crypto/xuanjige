/* 互动扩展 · 书籍与工具页内挂载层
 *
 * 落位约束（用户明确要求）：
 *  - 所有新功能全部位于「书籍与工具」（PAGES.sources）页内部。
 *  - 不新增顶级侧栏菜单、不新增同级路由、不改动 PAGES 路由表。
 *  - 原有典籍卡片、算法工作台、参考图放大全部保持原样，仅在页面末尾追加区块。
 *
 * 实现方式：包住 sources-workbench.js 已注册的 PAGES.sources 与 bind()，
 * 先调用原实现，再在其输出末尾追加扩展区块；bind 时同样先执行原逻辑。
 *
 * 视觉沿用既有深蓝 / 金色 / 朱红语言，不引入新的配色体系。
 */
(function (global) {
  'use strict';

  var doc = global.document;
  if (!doc) return;

  var Reg = global.ExtModuleRegistry;
  var Tarot = global.TarotModule;
  var Naming = global.NamingModule;
  var PB = global.PlaybookModule;

  /* 若引擎未加载（理论上不会发生），不注入任何半成品界面。 */
  if (!Reg || !Tarot || !Naming || !PB) {
    console.warn('[ext] 互动扩展引擎未就绪，书签与工具页未追加扩展区块。');
    return;
  }

  /* ============================================================ 基础工具 */

  function E(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(html) {
    var t = doc.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  /* ============================================================ 样式 */

  var CSS = [
    '.xext{margin-top:18px}',
    '.xext-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:6px}',
    '.xext-head h3{color:#eed5a0;margin:0;font-size:17px;letter-spacing:.06em}',
    '.xext-head p{margin:0;color:#b8a98a;font-size:12px;line-height:1.8;max-width:760px}',
    '.xext-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0;border-bottom:1px solid #b5a27333;padding-bottom:10px}',
    '.xext-tab{cursor:pointer;padding:7px 14px;border-radius:8px;border:1px solid #b5a27355;background:transparent;color:#d7c89f;font-size:13px}',
    '.xext-tab[aria-selected="true"]{background:#d4ad6022;border-color:#d4ad60;color:#f5dba3}',
    '.xext-panel{margin-top:16px}',
    '.xext-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}',
    '.xext-field{display:flex;flex-direction:column;gap:6px;font-size:13px;color:#d7c89f}',
    '.xext-field .input{width:100%;min-width:0}',
    '.xext-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
    '.xext-note{font-size:12px;color:#b8a98a;line-height:1.9}',
    '.xext-out{margin-top:16px;line-height:1.95}',
    '.xext-out h4{color:#eed5a0;margin:16px 0 6px;font-size:14px}',
    '.xext-out p{margin:0 0 8px}',
    '.xext-card{border:1px solid #b5a27344;border-radius:10px;padding:14px;background:#0e183026}',
    '.xext-card h4{margin:0 0 8px;color:#f5dba3;font-size:15px}',
    '.xext-card .xext-sub{font-size:12px;color:#b8a98a;line-height:1.8}',
    '.xext-list{margin:8px 0 0;padding-left:18px}',
    '.xext-list li{margin:4px 0;font-size:13px;line-height:1.85;color:#d7d6d0}',
    '.xext-lim{margin:12px 0 0;padding:10px 12px;border-left:2px solid #b0413e;background:#b0413e12;font-size:12px;color:#d7c89f;line-height:1.9}',
    /* 勘宅神器 */
    '#xext-k-drop{position:relative;margin-top:14px;padding:22px 16px;border:1.5px dashed #b5a27366;border-radius:12px;'
      + 'background:#0e183026;cursor:pointer;text-align:center;transition:border-color .18s,background .18s}',
    '#xext-k-drop:hover,#xext-k-drop:focus-visible,#xext-k-drop.xext-k-drop-on{border-color:#d4ad60;background:#d4ad6018;outline:none}',
    '#xext-k-drop.xext-k-drop-on{border-style:solid}',
    '.xext-k-file{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}',
    '.xext-k-drop-hint{display:flex;flex-direction:column;gap:6px;align-items:center}',
    '.xext-k-drop-hint strong{font-size:15px;color:#f5dba3}',
    '.xext-k-drop-hint span{font-size:12px;color:#b8a98a;line-height:1.8}',
    '.xext-k-thumb{max-width:100%;max-height:190px;border-radius:8px;border:1px solid #b5a27344}',
    '.xext-k-scale-hint{font-size:11px;color:#8f8163;line-height:1.85;margin:-4px 0 10px}',
    /* 宿主 .btn-ghost 是 display:block;width:100%（为表单全宽设计）。
       勘宅的按钮是控件条上的一组操作，必须显式收回自身宽度，
       否则两个按钮会各占满一整行，看上去像两张大卡片。 */
    '.xext-k-btn{display:inline-flex;align-items:center;justify-content:center;width:auto;align-self:flex-end;min-width:118px;margin-top:0;padding:9px 18px;border-radius:10px;font-size:13px;letter-spacing:.08em;cursor:pointer}',
    '.xext-k-conf{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:14px 0 0;padding:9px 13px;'
      + 'border-radius:9px;border-left:3px solid #d4ad60;background:#d4ad6014;font-size:12px;color:#d7c89f}',
    '.xext-k-conf strong{font-size:14px;color:#f5dba3}',
    '.xext-k-conf-mid{border-left-color:#e0b357;background:#e0b35714}',
    '.xext-k-conf-low{border-left-color:#e2705a;background:#e2705a14}',
    '.xext-k-hero{display:flex;align-items:center;gap:20px;margin:14px 0 0;padding:16px 18px;'
      + 'border-radius:12px;border:1px solid #b5a27344;background:linear-gradient(120deg,#d4ad6016,#0e183026)}',
    '.xext-k-hero-score{font-size:44px;line-height:1;color:#f5dba3;font-weight:700;display:flex;flex-direction:column;align-items:center}',
    '.xext-k-hero-score span{font-size:11px;color:#b8a98a;font-weight:400;margin-top:4px}',
    '.xext-k-hero-txt{display:flex;flex-direction:column;gap:6px}',
    '.xext-k-hero-txt strong{font-size:15px;color:#f5dba3;line-height:1.6}',
    '.xext-k-hero-txt span{font-size:12px;color:#b8a98a}',
    '.xext-k-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 18px;margin:14px 0 4px}',
    '.xext-k-metric{display:flex;align-items:center;gap:10px;font-size:12px;color:#d7c89f}',
    '.xext-k-metric-k{flex:0 0 82px}',
    '.xext-k-bar{position:relative;flex:1;height:16px;border-radius:8px;background:#0e183033;border:1px solid #b5a27333;overflow:hidden}',
    '.xext-k-bar-on{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#8a6f2e,#d4ad60)}',
    '.xext-k-bar-txt{position:absolute;right:7px;top:0;line-height:15px;font-size:11px;color:#f5dba3}',
    '#xext-k-map{margin-top:12px;border:1px solid #b5a27344;border-radius:10px;overflow:hidden;background:#080d16}',
    '#xext-k-map [data-room]{cursor:grab}',
    '#xext-k-map [data-room]:active{cursor:grabbing}',
    '.xext-k-h{color:#eed5a0;margin:22px 0 8px;font-size:14px}',
    '.xext-k-issues{list-style:none;margin:0;padding:0}',
    '.xext-k-issue{margin:0 0 10px;padding:11px 13px;border-left:3px solid #8fa8c8;border-radius:0 9px 9px 0;background:#0e183026}',
    '.xext-k-issue-h{display:flex;align-items:center;gap:9px;margin-bottom:5px}',
    '.xext-k-issue-h strong{font-size:13px;color:#f5dba3}',
    '.xext-k-tag{font-size:11px;color:#1a1408;padding:1px 7px;border-radius:5px;font-weight:700}',
    '.xext-k-issue-t{font-size:13px;color:#d7d6d0;line-height:1.85}',
    '.xext-k-issue-b{font-size:11px;color:#8f8163;line-height:1.8;margin-top:5px}',
    '.xext-k-plan{list-style:none;counter-reset:xkp;margin:0;padding:0}',
    '.xext-k-plan-i{position:relative;margin:0 0 10px;padding:12px 14px 12px 42px;border-radius:10px;'
      + 'border:1px solid #b5a2733d;background:#0e183026;counter-increment:xkp}',
    '.xext-k-plan-i::before{content:counter(xkp);position:absolute;left:12px;top:12px;width:20px;height:20px;'
      + 'border-radius:50%;background:#d4ad60;color:#1a1408;font-size:12px;font-weight:700;'
      + 'display:flex;align-items:center;justify-content:center}',
    '.xext-k-plan-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}',
    '.xext-k-plan-h strong{font-size:13.5px;color:#f5dba3}',
    '.xext-k-plan-meta{font-size:11px;color:#b8a98a}',
    '.xext-k-plan-a{font-size:12.5px;color:#d7d6d0;line-height:1.85;margin-top:5px}',
    '.xext-k-plan-w{font-size:11px;color:#8f8163;line-height:1.8;margin-top:4px}',
    '.xext-k-compass{display:flex;justify-content:center;margin:8px 0}',
    /* 二十八宿星空剧场 */
    '#xx-map{border:1px solid #b5a27344;border-radius:10px;overflow:hidden;background:#05080f;margin-top:10px}',
    '#xx-map svg{background:radial-gradient(ellipse at 50% 42%,#0d1424 0%,#05080f 72%)}',
    '#xx-map [data-lodge],#xx-map [data-star]{cursor:pointer;outline:none}',
    '#xx-map [data-lodge]:hover,#xx-map [data-star]:hover{filter:brightness(1.45)}',
    '#xx-map [data-lodge]:focus-visible,#xx-map [data-star]:focus-visible{filter:brightness(1.6) drop-shadow(0 0 5px #e6d2a0)}',
    '#xx-map [data-star]:hover circle:last-of-type{r:6}',
    '.xext-x-band{transition:stroke-opacity .2s}',
    '.xext-x-nav{margin-top:16px}',
    '.xext-x-navgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:8px}',
    '.xext-x-navhead{font-size:12px;color:#d7c89f;padding:3px 0 3px 8px;margin-bottom:6px}',
    '.xext-x-navitems{display:flex;flex-wrap:wrap;gap:4px}',
    '.xext-x-navbtn{font-family:monospace;font-size:12px;color:#d7c89f;padding:3px 7px;border-radius:6px;border:1px solid #b5a27344;background:transparent;cursor:pointer}',
    '.xext-x-navbtn b{color:#e6d2a0;font-weight:400;margin-right:3px;font-size:10px;opacity:.75}',
    '.xext-x-navbtn:hover{border-color:#d4ad60;color:#f5dba3;background:#d4ad6018}',
    '.xext-x-navbtn:focus-visible{outline:2px solid #e6d2a0;outline-offset:1px}',
    '.xext-x-hit:hover{stroke-opacity:.22!important}',
    '.xext-x-detail table,.xext-x-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:12px}',
    '.xext-x-table th,.xext-x-table td{padding:5px 7px;text-align:left;border-bottom:1px solid #b5a27322;color:#d7d6d0}',
    '.xext-x-table th{color:#b8a98a;font-weight:400}',
    '.xext-x-term{display:flex;gap:8px;align-items:baseline;font-size:12px;padding:4px 0;border-bottom:1px solid #b5a27318;color:#b8a98a}',
    '.xext-x-term b{min-width:44px;color:#e6d2a0;font-weight:500}',
    '.xext-x-term span:first-of-type{min-width:46px;font-family:monospace}',

    /* 塔罗牌桌 */
    '.xtr-table-wrap{position:relative;margin-top:16px;padding:22px 18px 26px;border:1px solid #b5a27333;border-radius:16px;background:radial-gradient(120% 90% at 50% 0%,#12203a 0%,#0a1220 62%,#070c16 100%);overflow:hidden}',
    '.xtr-table-decor{position:absolute;inset:0;pointer-events:none;overflow:hidden}',
    '.xtr-ring{position:absolute;left:50%;top:-120px;width:520px;height:520px;margin-left:-260px;border:1px solid #d4ad6022;border-radius:50%}',
    '.xtr-ring2{top:-40px;width:760px;height:760px;margin-left:-380px;border-color:#d4ad6014}',
    '.xtr-controls{position:relative;display:grid;grid-template-columns:180px 220px minmax(240px,1fr);gap:14px;align-items:end}',
    '.xtr-q{min-width:0}',
    '.xtr-spread-descs{position:relative;margin-top:10px;display:flex;flex-direction:column;gap:4px}',
    '.xtr-spread-desc{display:flex;gap:10px;align-items:baseline;font-size:12px;color:#b8a98a;line-height:1.8}',
    '.xtr-spread-desc strong{color:#e5cc97;font-weight:normal}',
    '.xtr-actions{position:relative;display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:14px 0 4px}',
    /* 宿主 .btn-primary / .btn-ghost 默认是 display:block;width:100%（为表单全宽设计）。
       牌桌的按钮是一行并排的操作条，必须显式收回自身宽度，否则会竖排占满整行。 */
    '.xtr-btn{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;width:auto;min-width:132px;padding:9px 20px;border-radius:10px;font-size:14px;letter-spacing:.08em;cursor:pointer}',
    '.xtr-actions #xt-hint{flex:1 1 200px;min-width:0}',
    '.xext-table.xtr-table{position:relative;display:grid;gap:22px;justify-content:center;margin:20px auto 10px}',
    '.xtr-table.xtr-cols-1{grid-template-columns:repeat(1,minmax(0,1fr));max-width:250px}',
    '.xtr-table.xtr-cols-3{grid-template-columns:repeat(3,minmax(0,1fr));max-width:700px}',
    '.xtr-slot .xtr-slot-inner{max-width:210px;margin:0 auto}',
    /* 牌槽：正面朝上的牌，立体翻牌 */
    '.xtr-slot{position:relative;display:flex;flex-direction:column;gap:8px;perspective:1200px;cursor:pointer;border-radius:12px;outline:none}',
    '.xtr-slot:focus-visible .xtr-slot-inner{box-shadow:0 0 0 2px #d4ad60,0 0 24px #d4ad6066}',
    '.xtr-slot-inner{position:relative;width:100%;aspect-ratio:300/540;border-radius:12px;transform-style:preserve-3d;transition:transform .62s cubic-bezier(.22,.61,.36,1);box-shadow:0 10px 26px #00000066,0 0 0 1px #b5a27344}',
    '.xtr-slot.is-flipped .xtr-slot-inner{transform:rotateY(180deg)}',
    '.xtr-slot.is-hover:not(.is-flipped) .xtr-slot-inner{transform:translateY(-8px) rotate(-1.6deg);box-shadow:0 18px 34px #00000077,0 0 30px #d4ad6044,0 0 0 1px #d4ad6088}',
    '.xtr-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:12px;overflow:hidden}',
    '.xtr-face-front{transform:rotateY(180deg)}',
    '.xtr-face svg{display:block;width:100%;height:100%}',
    '.xtr-slot.is-rev .xtr-slot-cap .xtr-orient{color:#e8a6a4}',
    '.xtr-rev{color:#e8a6a4;font-style:normal}',
    '.xtr-slot-cap{display:flex;flex-direction:column;gap:2px;text-align:center;line-height:1.5}',
    '.xtr-pos{font-size:11px;color:#b8a98a;letter-spacing:.04em}',
    '.xtr-name{font-size:15px;color:#f5dba3;letter-spacing:.06em}',
    '.xtr-orient{font-size:11px;color:#c8b98f}',
    '.xtr-slot-hint{font-size:11px;color:rgba(184,169,138,.75);line-height:1.7;text-align:center}',
    /* 比较牌阵：两端牌加连线感 */
    '.xtr-compare .xtr-slot:first-child .xtr-slot-cap,.xtr-compare .xtr-slot:last-child .xtr-slot-cap{color:#e5cc97}',
    '.xtr-summary-box{margin:6px 0 16px;padding:14px 16px;border:1px solid #b5a27344;border-radius:12px;background:#0e183026}',
    '.xtr-summary-box h4{margin:0 0 6px;color:#eed5a0;font-size:14px}',
    /* 洗牌动画 */
    '.xtr-shuffle-stage{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;gap:0;pointer-events:none;background:#070c1699;backdrop-filter:blur(2px)}',
    '.xtr-shuffle-card{width:120px;margin-left:-26px;transform-origin:50% 120%;animation:xtrShuffle .9s cubic-bezier(.3,.7,.3,1) both;animation-delay:calc(var(--i) * 42ms)}',
    '.xtr-shuffle-card:first-child{margin-left:0}',
    '.xtr-shuffle-card svg{display:block;width:100%;height:auto;border-radius:8px;box-shadow:0 8px 20px #00000066}',
    '@keyframes xtrShuffle{0%{transform:translateY(-40px) rotate(calc((var(--i) - 4) * 9deg)) scale(.9);opacity:0}30%{opacity:1}100%{transform:translateY(0) rotate(calc((var(--i) - 4) * 2deg)) scale(1);opacity:.9}}',
    '.xtr-table.is-shaking .xtr-slot-inner{animation:xtrShake .3s ease-in-out infinite}',
    '@keyframes xtrShake{0%,100%{transform:rotate(0)}25%{transform:rotate(-.8deg)}75%{transform:rotate(.8deg)}}',
    /* 弹窗里的大牌 + 说明 */
    '.xtr-modal-card{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}',
    '.xtr-modal-art{flex:0 0 200px;width:200px}',
    '.xtr-modal-art svg{display:block;width:100%;height:auto;border-radius:10px;box-shadow:0 10px 24px #00000066}',
    '.xtr-modal-body{flex:1 1 260px;min-width:0;line-height:1.95}',
    '.xtr-modal-body h2{margin:0 0 4px;font-size:18px;color:#eed5a0}',
    '.xtr-modal-title{font-size:16px;color:#f5dba3;margin:0 0 6px}',
    '.xtr-modal-imagery{color:#d7c89f;font-size:13px;line-height:1.9}',
    '.xext-card-face{flex:0 0 auto;width:100%;max-width:100%;box-sizing:border-box;border:1px solid #d4ad60;border-radius:8px;background:#0e1830;padding:10px;text-align:left}',
    '.xext-card-face .xext-pos{font-size:11px;color:#b8a98a}',
    '.xext-card-face .xext-name{color:#f5dba3;font-size:15px;margin:4px 0}',
    '.xext-card-face .xext-img{color:#d7c89f;font-size:12px;line-height:1.7}',
    '.xext-card-face.is-rev{border-color:#b0413e;box-shadow:inset 0 0 0 1px #b0413e55}',
    '.xext-rev-tag{color:#e8a6a4;font-size:11px}',
    /* 起名候选 */
    '.xext-cand{border:1px solid #b5a27344;border-radius:10px;padding:12px;background:#0e183026}',
    '.xext-cand.is-picked{border-color:#d4ad60;background:#d4ad6014}',
    '.xext-cand .xext-name-lg{color:#f5dba3;font-size:22px;letter-spacing:.08em}',
    '.xext-pick{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}',
    '.xext-mini{cursor:pointer;font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid #b5a27355;background:transparent;color:#d7c89f}',
    '.xext-mini[aria-pressed="true"]{background:#d4ad6022;border-color:#d4ad60;color:#f5dba3}',
    /* 通用结果渲染 */
    '.xext-kv{width:100%;border-collapse:collapse;margin-top:8px}',
    '.xext-kv th,.xext-kv td{border-bottom:1px solid #b5a27333;padding:8px;text-align:left;vertical-align:top;font-size:13px}',
    '.xext-kv th{color:#e5cc97;font-weight:normal;white-space:nowrap;width:96px}',
    /* ---- 任务 #20：图纸调整 / 八字 / 图层三组控件 ---- */
    '.xext-k-fs{border:1px solid rgba(212,175,55,.22);border-radius:8px;padding:10px 12px 12px;margin:12px 0;position:relative}',
    '.xext-k-fs legend{font-size:12px;color:#d4af37;padding:0 6px}',
    '.xext-k-advice{border-left:3px solid #d4af37;background:rgba(212,175,55,.06);padding:10px 12px;margin:12px 0;border-radius:0 6px 6px 0}',
    '.xext-k-advice-h{font-weight:600;color:#e8dcc0;margin-bottom:6px;font-size:13px}',
    '.xext-k-fitem{margin:8px 0;padding:8px 10px;border-radius:6px;background:rgba(255,255,255,.03);border:1px solid rgba(212,175,55,.12)}',
    '.xext-k-fitem-h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:13px;color:#e8dcc0}',
    '.xext-k-fitem-where{font-size:11px;color:#9a8f74}',
    '.xext-k-fitem-plain{font-size:12px;color:#c8bfa6;margin-top:4px;line-height:1.6}',
    '.xext-k-fitem-b{font-size:11px;color:#8b8474;margin-top:4px;line-height:1.6}',
    '.xext-k-issue-tap{cursor:pointer}',
    '.xext-k-issue-on{outline:1px solid #d4af37;outline-offset:2px}',
    '.xext-k-decor-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}',
    '.xext-k-openings{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}',
    '.xext-k-opening-chip{font-size:11px;padding:3px 8px;border-radius:10px;border:1px solid rgba(212,175,55,.3)}',
    '.xext-k-opening-door{color:#e2705a;border-color:rgba(226,112,90,.5)}',
    '.xext-k-opening-window{color:#7fc7d8;border-color:rgba(127,199,216,.5)}',

    '@media(max-width:760px){.xtr-controls{grid-template-columns:1fr}.xtr-table.xtr-cols-3{grid-template-columns:1fr;max-width:300px}.xext-table{gap:10px}}'
  ].join('');

  var style = doc.createElement('style');
  style.id = 'xext-style';
  style.textContent = CSS;
  doc.head.appendChild(style);

  /* ============================================================ 弹窗（沿用既有焦点陷阱） */

  function modal(bodyHtml, onMount) {
    var prev = $('.reader-mask');
    if (prev) prev.remove();
    var mask = doc.createElement('div');
    mask.className = 'reader-mask';
    mask.setAttribute('role', 'dialog');
    mask.setAttribute('aria-modal', 'true');
    mask.innerHTML = '<section class="reader-paper"><button class="reader-close" aria-label="关闭">×</button>' + bodyHtml + '</section>';
    var before = doc.activeElement;
    function close() {
      mask.remove();
      doc.removeEventListener('keydown', onKey);
      if (before && before.focus) before.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var nodes = $$('button,a,input,select,textarea,[tabindex]:not([tabindex="-1"])', mask)
        .filter(function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!nodes.length) return;
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    $('.reader-close', mask).onclick = close;
    doc.addEventListener('keydown', onKey);
    doc.body.appendChild(mask);
    $('.reader-close', mask).focus();
    if (typeof onMount === 'function') onMount(mask, close);
    return { root: mask, close: close };
  }

  /* ============================================================ 统一结果渲染 */

  function renderInterpretations(out, result) {
    out.push('<h4>解释</h4>');
    (result.interpretations || []).forEach(function (seg) {
      out.push('<p><strong style="color:#e5cc97">' + E(seg.title) + '</strong>：' + E(seg.text) + '</p>');
    });
  }

  function renderEvidence(out, result) {
    var ev = result.evidence || [];
    if (!ev.length) return;
    out.push('<h4>依据</h4><ul class="xext-list">');
    ev.forEach(function (item) {
      /* 证据正文有两种承载：reasons 数组（逐条列出）与 text 整段（如分岔剧场的逐项对照）。
         两者都要渲染出来，否则用户只会看到标题、看不到实际依据。 */
      var reasons = Array.isArray(item.reasons) ? item.reasons.filter(Boolean) : [];
      var text = item.text ? String(item.text) : '';
      var body = reasons.length ? reasons.join('；') : text;
      out.push('<li><strong>' + E(item.label) + '</strong>' +
        (body ? '：' + E(body) : '') + '</li>');
    });
    out.push('</ul>');
  }

  function renderActions(out, result) {
    var acts = result.actions || [];
    if (!acts.length) return;
    out.push('<h4>可以先做的事</h4><ul class="xext-list">');
    acts.forEach(function (a) { out.push('<li>' + (a.at ? E(a.at) + '：' : '') + E(a.text) + '</li>'); });
    out.push('</ul>');
  }

  function renderLimitations(out, result) {
    var lim = result.limitations || [];
    if (!lim.length) return;
    out.push('<div class="xext-lim"><strong>这一结果的边界</strong><ul class="xext-list">' +
      lim.map(function (l) { return '<li>' + E(l) + '</li>'; }).join('') + '</ul></div>');
  }

  function renderMeta(out, result) {
    out.push('<table class="xext-kv">' +
      '<tr><th>方法</th><td>' + E(result.method) + '</td></tr>' +
      '<tr><th>算法版本</th><td>' + E(result.algorithmVersion) + '</td></tr>' +
      '<tr><th>结果编号</th><td>' + E(result.resultId) + '</td></tr>' +
      '<tr><th>产生时间</th><td>' + E(result.createdAt) + '</td></tr>' +
      '</table>');
  }

  /* 统一渲染：先结构后解释，任一环节抛错都不静默 */
  function renderResult(result, moduleId) {
    Reg.validateResult(result, moduleId);
    var out = ['<div class="xext-out">'];
    renderEvidence(out, result);
    renderInterpretations(out, result);
    renderRelations(out, result);
    renderActions(out, result);
    renderLimitations(out, result);
    renderMeta(out, result);
    out.push('</div>');
    return out.join('');
  }

  /* 牌间关系是 result 上的附加结构（承接 / 并行 / 张力）。
     多牌阵必须把它摆在明面上，否则用户只会看到三段独立描述，
     不知道它们之间是延续、一致还是冲突。单牌时如实说明无可比关系。 */
  function renderRelations(out, result) {
    var rels = (result && result.relations) || [];
    if (!rels.length) return;
    out.push('<h4>牌与牌之间的关系</h4><ul class="xext-list">' +
      rels.map(function (r) {
        return '<li><strong>' + E(r.kind) + '</strong>：' + E(r.text) + '</li>';
      }).join('') + '</ul>');
  }

  /* ============================================================ 塔罗 · 隔空牌桌 */

  /* 洗牌与抽牌由 tarot.js 负责。本层只负责交互与呈现，
     抽出的每一张都立刻落盘，重播只读历史，不重新抽。
     牌面图案由 tarot-art.js 生成，与牌库数据一一对应。 */
  var TarotArt = global.TarotArt;
  var tarotState = { lastResultId: null, currentResult: null, flipped: {}, shuffling: false };

  /* 牌阵几何：不同牌阵有不同的空间结构，让「牌阵」本身成为可读的信息 */
  var SPREAD_GEOM = {
    single: { cols: 1, rows: 1, gap: 26 },
    three: { cols: 3, rows: 1, gap: 26 },
    decision: { cols: 3, rows: 1, gap: 26, compare: true }
  };

  function tarotPanel() {
    var cats = Tarot.CATEGORIES.map(function (c, i) {
      return '<option value="' + E(c.key) + '"' + (i === 0 ? ' selected' : '') + '>' + E(c.label) + '</option>';
    }).join('');
    var spreads = Object.keys(Tarot.SPREADS).map(function (k, i) {
      var s = Tarot.SPREADS[k];
      return '<option value="' + E(k) + '"' + (k === 'three' ? ' selected' : '') + '>' + E(s.name) + '</option>';
    }).join('');
    var spreadDesc = Object.keys(Tarot.SPREADS).map(function (k) {
      var s = Tarot.SPREADS[k];
      return '<div class="xtr-spread-desc" data-spread-desc="' + E(k) + '"' + (k === 'three' ? '' : ' hidden') + '>' +
        '<strong>' + E(s.name) + '</strong><span>' + E(s.positions.map(function (p) { return p.name; }).join(' → ')) + '</span></div>';
    }).join('');

    return '' +
      '<div class="xtr-table-wrap">' +
      '<div class="xtr-table-decor" aria-hidden="true"><span class="xtr-ring"></span><span class="xtr-ring xtr-ring2"></span></div>' +
      '<div class="xtr-controls">' +
      '<label class="xext-field">问题类别<select class="input" id="xt-cat">' + cats + '</select></label>' +
      '<label class="xext-field">牌阵<select class="input" id="xt-spread">' + spreads + '</select></label>' +
      '<label class="xext-field xtr-q">你的问题<input class="input" id="xt-q" placeholder="写一句你真正想弄清的事。不要写“一定会不会”这类问法。"></label>' +
      '</div>' +
      '<div class="xtr-spread-descs">' + spreadDesc + '</div>' +
      '<div class="xtr-actions">' +
      '<button type="button" class="btn-primary xtr-btn" id="xt-draw">洗牌并抽取</button>' +
      '<button type="button" class="btn-ghost xtr-btn" id="xt-flipall">全部翻开</button>' +
      '<button type="button" class="btn-ghost xtr-btn" id="xt-replay">重播上一次</button>' +
      '<span class="xext-note" id="xt-hint">选好类别与牌阵，写下问题，然后洗牌。</span>' +
      '</div>' +
      '<div id="xt-table" class="xext-table xtr-table" role="group" aria-label="牌桌"></div>'
      + tarotHandsNotice() +
      '<div class="tr-summary" id="xt-summary" aria-live="polite"></div>' +
      '<div id="xt-out"></div>' +
      '<div id="xt-hist"></div>' +
      '</div>';
  }

  /* 隔空能力说明：把「能用」与「不能用」都写清楚。
     只列实际可用的三条路径，并说明摄像头手势为何不在其列——
     与其做一个点了没反应的开关，不如直说做不到。 */
  function tarotHandsNotice() {
    var s = global.TarotHands ? global.TarotHands.status() : null;
    if (!s) return '';
    var paths = [
      s.canHover ? '指针移到牌上即感应，无需点击' : '',
      s.canDrag ? '横向拖过牌桌可洗牌，把牌拖到位可翻开' : '',
      s.canKeyboard ? 'Tab 聚焦到某张牌后按 Enter 或空格翻开' : ''
    ].filter(Boolean);
    return '<p class="xext-lim" style="margin-top:10px">' +
      '<strong>「隔空」在这里指' + E(s.meaning) + '</strong><br>' +
      E(s.reason) + '<br>三条路径：' + paths.map(E).join('；') + '。' +
      '</p>';
  }

  /* 牌库 / 历史补齐：randomRecord.draws 是精简结构，位置名与意象从历史记录补齐 */
  function cardById(id) {
    return Tarot.allCards().filter(function (c) { return String(c.id) === String(id); })[0] || null;
  }

  function relationsOf(result, order) {
    var rels = (result && result.relations) || [];
    return rels.filter(function (r) { return r.from === order || r.to === order; })
      .map(function (r) { return r.kind + '：' + r.text; });
  }

  function historyRecord(resultId) {
    var hist = Tarot.loadHistory(), rec = null;
    hist.forEach(function (h) { if (!rec && h.resultId === resultId) rec = h; });
    return rec;
  }

  /* 把 result 的 draws 与历史记录合并成渲染所需的完整结构 */
  function mergedDraws(result) {
    var draws = (result && result.randomRecord && result.randomRecord.draws) || [];
    var rec = result ? historyRecord(result.resultId) : null;
    var full = (rec && rec.draws) || [];
    return draws.map(function (d, i) {
      var f = full[i] || d;
      return {
        positionKey: f.positionKey || d.positionKey,
        positionName: f.positionName || d.positionName,
        positionHint: f.positionHint || '',
        cardName: f.cardName || d.cardName,
        cardId: f.cardId != null ? f.cardId : d.cardId,
        imagery: f.imagery || '',
        group: f.group || '',
        source: f.source || '',
        reversed: d.reversed,
        order: d.order || i + 1
      };
    });
  }

  /* 单张牌的 DOM。未翻开时是牌背，翻开后是图案面。 */
  function slotHtml(item, geom) {
    var card = cardById(item.cardId);
    var faceSvg = card ? TarotArt.face(Object.assign({}, card, { __rev: !!item.reversed })) : '';
    var key = tarotState.lastResultId + '#' + item.order;
    var flipped = !!tarotState.flipped[key];
    return '<div class="xtr-slot' + (flipped ? ' is-flipped' : '') + (item.reversed ? ' is-rev' : '') + '"' +
      ' data-card="' + item.order + '" data-flipkey="' + E(key) + '" tabindex="0" role="button"' +
      ' aria-label="' + E(item.positionName + '，' + item.cardName + (item.reversed ? '，逆位' : '，正位') +
        '，' + (flipped ? '已翻开，按 Enter 可打开详细释义' : '牌背，按 Enter 翻开')) + '">' +
      '<div class="xtr-slot-inner">' +
      '<div class="xtr-face xtr-face-back" aria-hidden="' + (flipped ? 'true' : 'false') + '">' + TarotArt.back() + '</div>' +
      '<div class="xtr-face xtr-face-front" aria-hidden="' + (flipped ? 'false' : 'true') + '">' + faceSvg + '</div>' +
      '</div>' +
      '<div class="xtr-slot-cap">' +
      '<span class="xtr-pos">' + E(item.positionName) + '</span>' +
      '<span class="xtr-name">' + E(item.cardName) + '</span>' +
      '<span class="xtr-orient">' + (item.reversed ? '<em class="xtr-rev">逆位</em>' : '正位') + '</span>' +
      '</div>' +
      '<div class="xtr-slot-hint">' + E(item.positionHint) + '</div>' +
      '</div>';
  }

  function renderTarotTable(container, result) {
    var items = mergedDraws(result);
    if (!items.length) { container.innerHTML = '<p class="xext-note">还没有抽牌。</p>'; return; }
    var geom = SPREAD_GEOM[result.spreadKey] || SPREAD_GEOM.three;
    container.className = 'xext-table xtr-table xtr-cols-' + geom.cols;
    container.innerHTML = items.map(function (it) { return slotHtml(it, geom); }).join('');
    if (geom.compare) container.classList.add('xtr-compare');
    /* 牌面是重建的，拖拽监听随之失效，必须重新挂一次。
       这里统一在渲染收口处重挂，而不是包一层 renderTarotTable——
       包一层的话每次挂载页签都会多叠一层包装函数。 */
    if (tarotFlipHandler) bindTarotHands(doc, container, tarotFlipHandler);
  }

  /* 隔空交互：悬停感应 + 拖拽翻牌。
     洗牌拖拽由下面既有的 is-shaking 处理器负责，这里**不再重复绑一套**——
     两套 pointerdown/move/up 同时存在会互相覆盖 class，
     实机上表现为「提示文案被后绑的那个盖掉、洗牌又不触发」。 */
  var tarotFlipHandler = null;
  /* 同一张牌桌只会挂一次监听。
     bindTarotHands 会被两处调用：页签挂载时一次，牌面每次重绘后再一次。
     每次都新绑一套 pointerup 的话，一次松手会有 N 个处理器各翻一次牌，
     实机上表现为「拖一下牌纹丝不动」——翻开了又被后一个处理器翻回去。
     用牌桌节点本身做键，保证重复调用是幂等的。 */
  function handsBound(tableEl) {
    if (!tableEl) return true;
    if (!tableEl.__xtrHands) tableEl.__xtrHands = { n: 0 };
    return tableEl.__xtrHands.n > 0;
  }

  function bindTarotHands(root, tableEl, flipFn) {
    if (!global.TarotHands) return;
    tarotFlipHandler = flipFn || tarotFlipHandler;
    if (!tableEl || handsBound(tableEl)) return;
    tableEl.__xtrHands.n += 1;

    /* 悬停感应交给 TarotHands（它与无头测试共用同一套命中判定）。
       只传 radius，不传 onFlip/onShuffle——翻牌由本模块接管，
       两边都绑一遍会出现「点一下翻两次」。 */
    try {
      global.TarotHands.attach(tableEl, { radius: 12 });
    } catch (e) {
      var hint = $('#xt-hint', root);
      if (hint) hint.textContent = '悬停感应未能挂载：' + (e && e.message ? e.message : String(e));
    }

    /* 拖拽翻牌：从牌上起手、拖到牌位范围内松手即翻开。
       move 里只给**当前**这张牌加 transform，松手才调用 flipFn()——
       每帧重绘的话节点会一直被替换，第二次 move 的坐标就跳回去了。 */
    var dragSlot = null;
    var origin = null;
    tableEl.addEventListener('pointerdown', function (ev) {
      var slot = ev.target && ev.target.closest ? ev.target.closest('[data-card]') : null;
      if (!slot) return;
      dragSlot = slot;
      /* 必须在**还没加 transform 之前**记下原始 rect。
         getBoundingClientRect() 返回的是已经含 transform 的位置，
         边移动边读会把自己刚加的位移算进基准里，于是 dx 恒为 0，
         实机上表现为「牌跟着鼠标走不动 / 走一点点就弹回」。 */
      var r = slot.getBoundingClientRect();
      origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      slot.classList.add('is-dragging');
    });
    tableEl.addEventListener('pointermove', function (ev) {
      if (!dragSlot || !origin) return;
      var dx = ev.clientX - origin.x;
      var dy = ev.clientY - origin.y;
      dragSlot.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
    });
    function clearDrag() {
      if (!dragSlot) return;
      dragSlot.classList.remove('is-dragging');
      dragSlot.style.transform = '';
      dragSlot = null;
      origin = null;
    }
    tableEl.addEventListener('pointerup', function (ev) {
      if (!dragSlot || !origin) { clearDrag(); return; }
      var slot = dragSlot;
      /* 落点判定用**事件坐标**与原始 rect。
         不能用此刻的 getBoundingClientRect()——牌已经被拖走了，
         读到的是新位置，拿它判「有没有落回牌内」必然自我一致而无意义。 */
      var box = slotBox(slot);
      var inside = ev.clientX >= box.x && ev.clientX <= box.x + box.w
        && ev.clientY >= box.y && ev.clientY <= box.y + box.h;
      clearDrag();
      if (inside && tarotFlipHandler) tarotFlipHandler(slot);
    });
    tableEl.addEventListener('pointercancel', clearDrag);
  }

  /* 取牌位的原始矩形：先去掉 transform 再量，才能拿到没被拖动影响的框。 */
  function slotBox(slot) {
    var prev = slot.style.transform;
    slot.style.transform = 'none';
    var r = slot.getBoundingClientRect();
    slot.style.transform = prev;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  /* 牌与牌之间的连线：把「承接/并行/张力」画到桌面上 */
  function renderSummary(container, result) {
    if (!result) { container.innerHTML = ''; return; }
    var rels = (result.relations || []).filter(function (r) {
      var color = r.kind === '承接' ? '#d9b26a' : r.kind === '张力' ? '#d06a5a' : '#7fb8d9';
      return !!color;
    });
    if (!rels.length) {
      container.innerHTML = '<p class="xext-note">本次只有一张牌，没有可比的牌间关系；单牌时不做横向对比。</p>';
      return;
    }
    var lines = rels.map(function (r) {
      return '<li><b>' + E(r.kind) + '</b> ' + E(r.text) + '</li>';
    }).join('');
    container.innerHTML = '<div class="xtr-summary-box"><h4>牌与牌之间</h4><ul class="xext-list">' + lines + '</ul></div>';
  }

  function bindTarot(root) {
    var qEl = $('#xt-q', root), catEl = $('#xt-cat', root), spreadEl = $('#xt-spread', root);
    var tableEl = $('#xt-table', root), outEl = $('#xt-out', root), hintEl = $('#xt-hint', root);
    var sumEl = $('#xt-summary', root);

    function showError(e) {
      outEl.innerHTML = '<div class="xext-lim">' + E(e && e.message ? e.message : '操作失败') + '</div>';
    }

    function present(result, msg) {
      tarotState.lastResultId = result.resultId;
      tarotState.currentResult = result;
      tarotState.flipped = {};
      renderTarotTable(tableEl, result);
      renderSummary(sumEl, result);
      outEl.innerHTML = renderResult(result, 'tarot');
      hintEl.textContent = msg || '本次结果已保存。点牌或按 Enter 逐张翻开；重播只读取这一份，不会重新抽牌。';
      renderHistory();
    }

    /* 洗牌动画：一串牌背快速掠过牌桌，落定后揭示结果。
       动画只是表现层；牌已在 draw() 内确定并落盘，动画不会影响结果。 */
    function shuffleAnim(done) {
      if (tarotState.shuffling) return;
      tarotState.shuffling = true;
      var stage = doc.createElement('div');
      stage.className = 'xtr-shuffle-stage';
      stage.setAttribute('aria-hidden', 'true');
      var back = TarotArt.back();
      var i, html = '';
      for (i = 0; i < 9; i += 1) {
        html += '<div class="xtr-shuffle-card" style="--i:' + i + '">' + back + '</div>';
      }
      stage.innerHTML = html;
      tableEl.parentNode.appendChild(stage);
      /* 无动画环境（无 matchMedia 的无头测试、用户要求减少动效）直接同步落定。
         牌面结果不依赖动画，动画只是表现层；同步落定也让自动化断言可确定复现。 */
      var reduce = !global.matchMedia || global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        stage.remove();
        tarotState.shuffling = false;
        done();
        return;
      }
      setTimeout(function () {
        stage.remove();
        tarotState.shuffling = false;
        done();
      }, 900);
    }

    $('#xt-draw', root).onclick = function () {
      try {
        shuffleAnim(function () {
          try {
            var result = Reg.run('tarot', {
              question: qEl.value,
              categoryKey: catEl.value,
              spreadKey: spreadEl.value
            });
            present(result, '已抽出 ' + ((result.randomRecord.draws || []).length) + ' 张。点牌翻开查看。');
          } catch (e) { showError(e); }
        });
      } catch (e) { showError(e); }
    };

    $('#xt-flipall', root).onclick = function () {
      var items = mergedDraws(tarotState.currentResult);
      if (!items.length) { hintEl.textContent = '还没有抽牌，先点「洗牌并抽取」。'; return; }
      items.forEach(function (it) { tarotState.flipped[tarotState.lastResultId + '#' + it.order] = true; });
      renderTarotTable(tableEl, tarotState.currentResult);
      hintEl.textContent = '已翻开全部牌。点任意一张可看详细释义与证据。';
    };

    $('#xt-replay', root).onclick = function () {
      try {
        if (!tarotState.lastResultId) throw new Error('还没有抽取记录，先点“洗牌并抽取”。');
        var result = Tarot.replay(tarotState.lastResultId);
        if (!result) throw new Error('找不到上次的记录。');
        tarotState.currentResult = result;
        tarotState.flipped = {};
        renderTarotTable(tableEl, result);
        renderSummary(sumEl, result);
        outEl.innerHTML = renderResult(result, 'tarot');
        hintEl.textContent = '这是原来那一份结果，未重新抽牌。';
      } catch (e) { showError(e); }
    };

    /* 牌阵说明随选择切换 */
    function syncSpreadDesc() {
      $$('[data-spread-desc]', root).forEach(function (d) {
        d.hidden = d.getAttribute('data-spread-desc') !== spreadEl.value;
      });
    }
    spreadEl.onchange = syncSpreadDesc;
    syncSpreadDesc();

    function flip(slot) {
      var key = slot.getAttribute('data-flipkey');
      tarotState.flipped[key] = !tarotState.flipped[key];
      slot.classList.toggle('is-flipped', !!tarotState.flipped[key]);
      slot.querySelector('.xtr-face-back').setAttribute('aria-hidden', tarotState.flipped[key] ? 'true' : 'false');
      slot.querySelector('.xtr-face-front').setAttribute('aria-hidden', tarotState.flipped[key] ? 'false' : 'true');
      slot.setAttribute('aria-label', slot.getAttribute('aria-label').replace(/已翻开|牌背/, tarotState.flipped[key] ? '已翻开' : '牌背'));
      if (tarotState.flipped[key]) openCard(Number(slot.getAttribute('data-card')));
    }

    tableEl.addEventListener('click', function (e) {
      var slot = e.target.closest('[data-card]');
      if (!slot) return;
      if (!slot.classList.contains('is-flipped')) flip(slot);
      else openCard(Number(slot.getAttribute('data-card')));
    });
    tableEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var slot = e.target.closest('[data-card]');
      if (!slot) return;
      e.preventDefault();
      if (!slot.classList.contains('is-flipped')) flip(slot);
      else openCard(Number(slot.getAttribute('data-card')));
    });

    /* 悬停感应：鼠标移到牌上时牌面前倾并透出金光，
       这是「隔空感应」的表现层，不改变任何抽牌结果。 */
    $$('.xtr-slot', tableEl).forEach(function (slot) {
      slot.addEventListener('mouseenter', function () { slot.classList.add('is-hover'); });
      slot.addEventListener('mouseleave', function () { slot.classList.remove('is-hover'); });
    });

    bindTarotHands(root, tableEl, flip);

    function openCard(order) {
      var rec = historyRecord(tarotState.lastResultId);
      if (!rec || !rec.draws) return;
      var d = rec.draws.filter(function (x) { return x.order === order; })[0];
      if (!d) d = rec.draws[order - 1];
      if (!d) return;
      var card = cardById(d.cardId);
      var catKey = rec.categoryKey || 'love';
      var catEntry = card && card.categories ? card.categories[catKey] : null;
      var core = catEntry ? (d.reversed ? catEntry.r : catEntry.u) : '';
      var advice = card ? (d.reversed ? (card.reversed.advice || card.reversed.core) : (card.upright.advice || card.upright.core)) : '';
      var rel = relationsOf(tarotState.currentResult, order);
      var bigSvg = card ? TarotArt.face(Object.assign({}, card, { __rev: !!d.reversed })) : '';
      modal(
        '<div class="xtr-modal-card">' +
        '<div class="xtr-modal-art">' + bigSvg + '</div>' +
        '<div class="xtr-modal-body">' +
        '<h2>' + E(d.positionName) + '</h2>' +
        '<p class="xtr-modal-title">' + E(d.cardName) + ' · ' + (d.reversed ? '<em class="xtr-rev">逆位</em>' : '正位') + '</p>' +
        '<p class="xext-note">' + E(d.positionHint) + '</p>' +
        '<p class="xtr-modal-imagery">' + E(d.imagery) + '</p>' +
        '<p><strong style="color:#e5cc97">牌面图案</strong>：本软件为每张牌生成了对应图案，' +
        '大阿卡纳各为独立构图，小阿卡纳按花色与点数排布；逆位为同一图案整体倒转。</p>' +
        '<p><strong style="color:#e5cc97">核心</strong>：' + E(core || '本牌在该类别下未提供释义。') + '</p>' +
        '<p><strong style="color:#e5cc97">建议</strong>：' + E(advice || '本牌在该类别下未提供建议。') + '</p>' +
        '<p class="xext-note">来源：' + E(d.source) + '</p>' +
        (rel.length
          ? '<p><strong style="color:#e5cc97">与其它牌的关系</strong></p><ul class="xext-list">' +
            rel.map(function (r) { return '<li>' + E(r) + '</li>'; }).join('') + '</ul>'
          : '') +
        '</div></div>',
        function (mask) {
          var favBtn = el('<button type="button" class="btn-ghost" style="margin-top:16px">存为行动卡</button>');
          favBtn.onclick = function () {
            try {
              var card2 = PB.cards.create({
                question: (rec.question || '（未填写问题）'),
                action: d.positionName + '：' + (advice || d.imagery),
                days: 3,
                sourceModule: 'tarot',
                sourceResultId: rec.resultId,
                sourceNote: '来自塔罗「' + d.cardName + '」'
              });
              favBtn.textContent = '已存入复盘（到期 ' + String(card2.card.dueAt).slice(0, 10) + '）';
              favBtn.disabled = true;
            } catch (e) { showError(e); }
          };
          $('.reader-paper', mask).appendChild(favBtn);
        }
      );
    }

    function renderHistory() {
      var hist = Tarot.loadHistory();
      if (!hist.length) { $('#xt-hist', root).innerHTML = ''; return; }
      $('#xt-hist', root).innerHTML =
        '<h4 style="color:#eed5a0;margin-top:18px">历史记录</h4><ul class="xext-list">' +
        hist.slice(0, 8).map(function (h) {
          return '<li>' + E(String(h.createdAt).slice(0, 16).replace('T', ' ')) + ' · ' +
            E(h.spreadName) + ' · ' + E(h.categoryLabel) +
            ' <button type="button" class="xext-mini" data-hist="' + E(h.resultId) + '">查看</button>' +
            ' <button type="button" class="xext-mini" data-del="' + E(h.resultId) + '">删除</button></li>';
        }).join('') + '</ul>';
    }

    renderHistory();
    $('#xt-hist', root).addEventListener('click', function (e) {
      var showBtn = e.target.closest('[data-hist]');
      if (showBtn) {
        try {
          var r = Tarot.replay(showBtn.dataset.hist);
          if (!r) throw new Error('找不到该记录。');
          tarotState.lastResultId = r.resultId;
          tarotState.currentResult = r;
          tarotState.flipped = {};
          renderTarotTable(tableEl, r);
          renderSummary(sumEl, r);
          outEl.innerHTML = renderResult(r, 'tarot');
          hintEl.textContent = '正在查看历史记录，未重新抽牌。';
        } catch (err) { showError(err); }
        return;
      }
      var delBtn = e.target.closest('[data-del]');
      if (delBtn) {
        Tarot.deleteHistory(delBtn.dataset.del);
        if (tarotState.lastResultId === delBtn.dataset.del) {
          tarotState.lastResultId = null;
          tarotState.currentResult = null;
          tarotState.flipped = {};
          renderSummary(sumEl, null);
        }
        renderHistory();
      }
    });

    /* 隔空拖拽：按住牌面拖动，松手落到牌桌中央即视为「重新洗牌」。
       这是第4阶段里可以离线落地的手势交互；摄像头手势需要 MediaPipe，
       不随包提供，这里不假装有。 */
    var drag = null;
    tableEl.addEventListener('pointerdown', function (e) {
      var slot = e.target.closest('[data-card]');
      if (!slot || !tableEl.querySelector('.xtr-slot')) return;
      drag = { x: e.clientX, y: e.clientY, moved: false };
    });
    tableEl.addEventListener('pointermove', function (e) {
      if (!drag) return;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 18) {
        drag.moved = true;
        tableEl.classList.add('is-shaking');
      }
    });
    tableEl.addEventListener('pointerup', function () {
      if (drag && drag.moved) {
        tableEl.classList.remove('is-shaking');
        hintEl.textContent = '洗牌动作已感应到（拖拽）。点「洗牌并抽取」落定牌面。';
      }
      drag = null;
    });
  }

  /* ============================================================ 起名工坊 */

  var namingState = { picked: [] };

  function namingPanel() {
    return '' +
      '<div class="xext-row" style="margin-bottom:12px">' +
      '<label class="xext-field" style="flex:1 1 220px">类别<select class="input" id="xn-kind">' +
      '<option value="person">人名</option><option value="company">公司名</option><option value="brand">品牌名</option>' +
      '</select></label>' +
      '<span class="xext-note" id="xn-kind-note"></span>' +
      '</div>' +
      '<div id="xn-form"></div>' +
      '<div class="xext-row" style="margin-top:12px">' +
      '<button type="button" class="btn-primary" id="xn-run">生成候选</button>' +
      '<button type="button" class="btn-ghost" id="xn-compare">对比已选（0）</button>' +
      '<button type="button" class="btn-ghost" id="xn-fav">查看收藏</button>' +
      '</div>' +
      '<div id="xn-out" aria-live="polite"></div>';
  }

  function personForm() {
    var imagery = Naming.IMAGERY_TAGS.map(function (t) {
      return '<label class="xext-field" style="flex-direction:row;align-items:center;gap:6px">' +
        '<input type="checkbox" class="input" data-imagery="' + E(t) + '" style="width:auto"> ' + E(t) + '</label>';
    }).join('');
    var styles = Naming.STYLES.map(function (s) {
      return '<option value="' + E(s) + '">' + E(s) + '</option>';
    }).join('');
    return '<div class="xext-grid">' +
      '<label class="xext-field">姓氏<input class="input" id="xn-surname" list="xn-surname-list" placeholder="例如：林"></label>' +
      '<label class="xext-field">名几字<select class="input" id="xn-length"><option value="1">1 字</option><option value="2" selected>2 字</option><option value="3">3 字</option></select></label>' +
      '<label class="xext-field">风格<select class="input" id="xn-style"><option value="">不限</option>' + styles + '</select></label>' +
      '<label class="xext-field">用字常见程度<select class="input" id="xn-rarity">' +
      '<option value="any">不限</option><option value="plain">偏常用</option><option value="rare">偏少用</option></select></label>' +
      '<label class="xext-field">禁用字<input class="input" id="xn-forbidden" placeholder="不要出现的字，用空格分开"></label>' +
      '<label class="xext-field">避讳名<input class="input" id="xn-taboo" placeholder="长辈或伴侣的名字，逗号分开"></label>' +
      '</div>' +
      '<div class="xext-row" style="margin-top:12px"><span class="xext-note">意象（可多选，会作为筛选条件）</span></div>' +
      '<div class="xext-row" style="margin-top:6px">' + imagery + '</div>' +
      '<datalist id="xn-surname-list">' + Naming.SURNAMES.slice(0, 90).map(function (s) {
        return '<option value="' + E(s) + '"></option>';
      }).join('') + '</datalist>' +
      '<p class="xext-note" style="margin-top:10px">本模块不输出喜用神与命理吉凶，也不做笔画五格打分。商标与工商重名一律显示"尚未核验"。</p>';
  }

  function companyForm() {
    return '<div class="xext-grid">' +
      '<label class="xext-field">行业<input class="input" id="xn-industry" list="xn-industry-list" placeholder="例如：餐饮"></label>' +
      '<label class="xext-field">地域<input class="input" id="xn-region" list="xn-region-list" placeholder="例如：杭州"></label>' +
      '<label class="xext-field">客户<select class="input" id="xn-audience"><option value="">不限</option><option>儿童</option><option>年轻人</option><option>中老年人</option><option>专业用户</option><option>企业客户</option></select></label>' +
      '<label class="xext-field">气质<input class="input" id="xn-tone" placeholder="例如：克制、可靠"></label>' +
      '<label class="xext-field">展示名长度<select class="input" id="xn-length"><option value="2">2 字</option><option value="3">3 字</option><option value="4" selected>4 字</option><option value="5">5 字</option></select></label>' +
      '<label class="xext-field">禁用词<input class="input" id="xn-forbidden" placeholder="例如：国际 集团"></label>' +
      '</div>' +
      '<label class="xext-field" style="margin-top:12px">法定企业名称（与展示名分开）<input class="input" id="xn-legal" placeholder="例如：杭州某某餐饮管理有限公司"></label>' +
      '<datalist id="xn-industry-list">' + Naming.INDUSTRIES.map(function (x) { return '<option value="' + E(x) + '"></option>'; }).join('') + '</datalist>' +
      '<datalist id="xn-region-list">' + Naming.REGIONS.map(function (x) { return '<option value="' + E(x) + '"></option>'; }).join('') + '</datalist>' +
      '<p class="xext-note" style="margin-top:10px">展示名不等于工商登记名称，也不等于商标。两者本轮都未查询，界面统一显示"尚未核验"。</p>';
  }

  function brandForm() {
    return '<div class="xext-grid">' +
      '<label class="xext-field">品类<input class="input" id="xn-category" placeholder="例如：咖啡"></label>' +
      '<label class="xext-field">气质<input class="input" id="xn-tone" placeholder="例如：安静、克制"></label>' +
      '<label class="xext-field">长度<select class="input" id="xn-length"><option value="2">2 字</option><option value="3" selected>3 字</option><option value="4">4 字</option></select></label>' +
      '<label class="xext-field">禁用词<input class="input" id="xn-forbidden"></label>' +
      '</div>' +
      '<p class="xext-note" style="margin-top:10px">品牌名可用性依赖商标、域名与社交账号，本轮没有查询能力，候选仅供创意比较。</p>';
  }

  function readNamingInputs() {
    var kind = $('#xn-kind').value;
    var forbidden = ($('#xn-forbid' + 'den') || {}).value || '';
    var base = {
      kind: kind,
      forbidden: forbidden,
      length: Number(($('#xn-length') || {}).value) || undefined
    };
    if (kind === 'person') {
      base.surname = ($('#xn-surname').value || '').trim();
      base.givenLength = Number($('#xn-length').value) || 2;
      base.style = $('#xn-style').value;
      base.rarity = $('#xn-rarity').value;
      base.taboo = ($('#xn-taboo').value || '').split(/[,，、\s]+/).filter(Boolean);
      base.imagery = $$('[data-imagery]', $('#xn-form')).filter(function (c) { return c.checked; })
        .map(function (c) { return c.dataset.imagery; });
      base.birthProvided = false;
    } else if (kind === 'company') {
      base.industry = ($('#xn-industry').value || '').trim();
      base.region = ($('#xn-region').value || '').trim();
      base.audience = $('#xn-audience').value;
      base.tone = ($('#xn-tone').value || '').trim();
      base.length = Number($('#xn-length').value) || 4;
      base.legalName = ($('#xn-legal').value || '').trim();
    } else {
      base.category = ($('#xn-category').value || '').trim();
      base.tone = ($('#xn-tone').value || '').trim();
      base.length = Number($('#xn-length').value) || 3;
    }
    return base;
  }

  function candidateCardHtml(c) {
    var label = c.full || c.brand || c.name;
    var reasons = (c.reasons || []).map(function (r) { return '<li>' + E(r) + '</li>'; }).join('');
    var needConfirm = (c.needConfirm || []).length
      ? '<p class="xext-rev-tag">含多音字需确认读音：' + E(c.needConfirm.join('、')) + '</p>'
      : '';
    return '<article class="xext-cand" data-cand="' + E(c.id) + '">' +
      '<div class="xext-name-lg">' + E(label) + '</div>' +
      '<div class="xext-sub">' + E(c.rarity || '') + (c.writing ? ' · ' + E(c.writing) : '') + '</div>' +
      (c.legalNote ? '<div class="xext-sub">法定名称：' + E(c.legalName || '未填') + '（' + E(c.legalNote) + '）</div>' : '') +
      (c.homophone ? '<div class="xext-sub">谐音提示：' + E(c.homophone) + '</div>' : '') +
      (reasons ? '<ul class="xext-list">' + reasons + '</ul>' : '') +
      needConfirm +
      '<div class="xext-sub">出处：' + E(c.source || '原创组合') + '</div>' +
      '<div class="xext-pick">' +
      '<button type="button" class="xext-mini" data-pick="' + E(c.id) + '" aria-pressed="false">加入对比</button>' +
      '<button type="button" class="xext-mini" data-fav="' + E(c.id) + '">收藏</button>' +
      '<button type="button" class="xext-mini" data-exclude="' + E(c.id) + '">排除</button>' +
      '</div></article>';
  }

  function bindNaming(root) {
    var kindEl = $('#xn-kind', root), formEl = $('#xn-form', root), outEl = $('#xn-out', root);
    var noteEl = $('#xn-kind-note', root), compareBtn = $('#xn-compare', root);
    var current = null;

    var KIND_NOTE = {
      person: '人名：只输出候选名与读音书写提示，不做命理判断。',
      company: '公司名：展示名与法定企业名称分开处理。',
      brand: '品牌名：仅创意候选，可用性需自行核验。'
    };

    function renderForm() {
      formEl.innerHTML = kindEl.value === 'person' ? personForm()
        : kindEl.value === 'company' ? companyForm() : brandForm();
      noteEl.textContent = KIND_NOTE[kindEl.value] || '';
      outEl.innerHTML = '';
      current = null;
      updateCompare();
    }

    function updateCompare() {
      compareBtn.textContent = '对比已选（' + namingState.picked.length + '）';
      $$('[data-cand]', outEl).forEach(function (card) {
        var on = namingState.picked.indexOf(card.dataset.cand) >= 0;
        card.classList.toggle('is-picked', on);
        var b = $('[data-pick]', card);
        if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    kindEl.onchange = renderForm;
    renderForm();

    $('#xn-run', root).onclick = function () {
      try {
        var result = Reg.run('naming', readNamingInputs());
        Reg.validateResult(result, 'naming');
        current = result;
        namingState.picked = [];
        var cards = result.candidates.map(candidateCardHtml).join('');
        var out = ['<h4 style="color:#eed5a0;margin-top:18px">候选（' + result.candidates.length + '）</h4>'];
        out.push('<div class="xext-grid">' + cards + '</div>');
        out.push(renderResult(result, 'naming'));
        outEl.innerHTML = out.join('');
        updateCompare();
      } catch (e) {
        outEl.innerHTML = '<div class="xext-lim">' + E(e && e.message ? e.message : '生成失败') + '</div>';
      }
    };

    outEl.addEventListener('click', function (e) {
      if (!current) return;
      function candById(id) {
        return current.candidates.filter(function (c) { return c.id === id; })[0] || null;
      }
      var pick = e.target.closest('[data-pick]');
      if (pick) {
        var id = pick.dataset.pick;
        var i = namingState.picked.indexOf(id);
        if (i >= 0) namingState.picked.splice(i, 1);
        else {
          if (namingState.picked.length >= 4) {
            outEl.insertAdjacentHTML('beforeend', '<div class="xext-lim">对比最多 4 个候选。</div>');
            return;
          }
          namingState.picked.push(id);
        }
        updateCompare();
        return;
      }
      var fav = e.target.closest('[data-fav]');
      if (fav) {
        var c = candById(fav.dataset.fav);
        if (!c) return;
        var now = Naming.toggleFavorite(c);
        fav.textContent = now ? '已收藏' : '收藏';
        return;
      }
      var ex = e.target.closest('[data-exclude]');
      if (ex) {
        var c2 = candById(ex.dataset.exclude);
        if (!c2) return;
        Naming.toggleExclude(c2);
        var card = ex.closest('[data-cand]');
        if (card) card.style.opacity = '.45';
        ex.textContent = '已排除';
        ex.disabled = true;
      }
    });

    compareBtn.onclick = function () {
      try {
        if (!namingState.picked.length) throw new Error('请先在候选上点"加入对比"。');
        var list = Naming.compare(namingState.picked).filter(Boolean);
        if (!list.length) throw new Error('找不到这些候选，可能已切换条件重新生成。');
        var rows = list.map(function (c) {
          return '<tr><th>' + E(c.full || c.brand || c.name) + '</th><td>' +
            E((c.reasons || []).join('；')) + '</td><td>' + E(c.rarity || '') + '</td><td>' +
            E(c.source || '原创组合') + '</td></tr>';
        }).join('');
        modal('<h2>候选对比</h2><p class="xext-note">只并列呈现差异，不替你判断哪个更好。</p>' +
          '<table class="xext-kv" style="margin-top:12px"><tr><th>候选</th><th>命中条件</th><th>用字</th><th>出处</th></tr>' +
          rows + '</table>' +
          '<div class="xext-lim">商标与工商重名尚未核验。本模块不做命理吉凶打分。</div>');
      } catch (e) {
        outEl.insertAdjacentHTML('beforeend', '<div class="xext-lim">' + E(e.message) + '</div>');
      }
    };

    $('#xn-fav', root).onclick = function () {
      var favs = Naming.favorites();
      if (!favs.length) {
        outEl.insertAdjacentHTML('beforeend', '<div class="xext-lim">还没有收藏。</div>');
        return;
      }
      modal('<h2>收藏的候选</h2><ul class="xext-list">' +
        favs.map(function (c) { return '<li>' + E(c.label) + '　<span class="xext-note">' + E(c.source || '') + '</span></li>'; }).join('') +
        '</ul><p class="xext-note">收藏只保存在本机。</p>');
    };
  }

  /* ============================================================ 6 个记忆点玩法 */

  var FORK_DIMS = [
    { key: 'summary', label: '这个方案是什么' },
    { key: 'resources', label: '需要的资源' },
    { key: 'constraints', label: '已知的约束' },
    { key: 'reversibility', label: '可逆性' },
    { key: 'preference', label: '你自己的倾向' }
  ];

  function playbookPanel() {
    return '' +
      '<div class="xext-row" style="margin-bottom:12px">' +
      ['action-card', 'fork-theater', 'same-question-mirrors', 'chart-notebook', 'light-scroll', 'solar-term-garden']
        .map(function (id, i) {
          var m = Reg.get(id);
          return '<button type="button" class="xext-tab" data-play="' + E(id) + '" aria-selected="' +
            (i === 0 ? 'true' : 'false') + '">' + E(m ? m.title : id) + '</button>';
        }).join('') +
      '</div><div id="xp-body" class="xext-panel"></div>';
  }

  function playActionCard() {
    return '<div class="xext-grid">' +
      '<label class="xext-field" style="grid-column:1/-1">这次的问题<textarea class="input" id="xp-ac-q" rows="2"></textarea></label>' +
      '<label class="xext-field" style="grid-column:1/-1">一件能做的事<input class="input" id="xp-ac-a" placeholder="具体到本周能做完的一件事"></label>' +
      '<label class="xext-field">几天后复盘<select class="input" id="xp-ac-d"><option value="3" selected>3 天</option><option value="7">7 天</option></select></label>' +
      '</div><div class="xext-row" style="margin-top:12px"><button type="button" class="btn-primary" id="xp-ac-run">记下这一行</button></div>' +
      '<div id="xp-ac-out" aria-live="polite" style="margin-top:14px"></div><div id="xp-ac-list" style="margin-top:16px"></div>';
  }

  function playForkTheater() {
    var side = function (p) {
      return '<fieldset style="border:1px solid #b5a27344;border-radius:10px;padding:12px">' +
        '<legend class="xext-note">' + p + '</legend>' +
        FORK_DIMS.map(function (d) {
          return '<label class="xext-field" style="margin-top:8px">' + E(d.label) +
            '<textarea class="input" data-dim="' + E(d.key) + '" rows="2"></textarea></label>';
        }).join('') + '</fieldset>';
    };
    return '<label class="xext-field">要比较的问题<input class="input" id="xp-fk-q"></label>' +
      '<div class="xext-grid" style="margin-top:12px">' + side('方案一') + side('方案二') + '</div>' +
      '<div class="xext-row" style="margin-top:12px"><button type="button" class="btn-primary" id="xp-fk-run">并排对照</button></div>' +
      '<div id="xp-fk-out" aria-live="polite" style="margin-top:14px"></div>';
  }

  function playMirrors() {
    var sys = PB.mirrors.systems;
    var keys = Object.keys(sys);
    return '<label class="xext-field">同一个问题<input class="input" id="xp-mr-q"></label>' +
      '<p class="xext-note" style="margin-top:8px">勾选你已在上方各页跑过的体系，这里只并列展示已有结果的差异，不重跑、不整合。</p>' +
      '<div class="xext-row" style="margin-top:8px">' +
      keys.map(function (k) {
        return '<label class="xext-field" style="flex-direction:row;align-items:center;gap:6px">' +
          '<input type="checkbox" class="input" data-sys="' + E(k) + '" style="width:auto"> ' + E(sys[k].label) + '</label>';
      }).join('') + '</div>' +
      '<div class="xext-row" style="margin-top:12px"><button type="button" class="btn-primary" id="xp-mr-run">并列对照</button></div>' +
      '<div id="xp-mr-out" aria-live="polite" style="margin-top:14px"></div>';
  }

  function playChartNotebook() {
    return '<div class="xext-row">' +
      '<label class="xext-field" style="flex:1 1 200px">术语<input class="input" id="xp-cn-t" placeholder="例如：比肩"></label>' +
      '<label class="xext-field" style="flex:1 1 200px">我的理解<input class="input" id="xp-cn-n" placeholder="用自己的话记一句"></label>' +
      '<button type="button" class="btn-primary" id="xp-cn-save" style="align-self:flex-end">保存注释</button>' +
      '</div>' +
      '<p class="xext-note" style="margin-top:8px">若首页尚未保存生辰，本页只会说明"当前盘没有这一项数据"，不会引用他人案例。</p>' +
      '<div id="xp-cn-out" aria-live="polite" style="margin-top:14px"></div><div id="xp-cn-list" style="margin-top:14px"></div>';
  }

  function playLightScroll() {
    return '<label class="xext-field">卷轴标题<input class="input" id="xp-ls-t" value="流光签卷"></label>' +
      '<label class="xext-field" style="margin-top:12px">正文<textarea class="input" id="xp-ls-b" rows="5" placeholder="写下这次的结论与你的实际行动"></textarea></label>' +
      '<label class="xext-field" style="margin-top:12px">感想（可留空）<input class="input" id="xp-ls-f"></label>' +
      '<div class="xext-row" style="margin-top:12px">' +
      '<button type="button" class="btn-primary" id="xp-ls-run">生成卷轴</button>' +
      '<button type="button" class="btn-ghost" id="xp-ls-copy">复制纯文本</button></div>' +
      '<p class="xext-note" style="margin-top:8px">导出前会自动隐去日期、时间、电话与证件号样式字符串；不含照片与完整生日。</p>' +
      '<div id="xp-ls-out" aria-live="polite" style="margin-top:14px"></div><div id="xp-ls-list" style="margin-top:14px"></div>';
  }

  function playSolarGarden() {
    return '<div id="xp-sg-cur"></div><div id="xp-sg-body" style="margin-top:14px"></div>';
  }

  function renderPlaybook(root, id) {
    var body = $('#xp-body', root);
    var html = {
      'action-card': playActionCard,
      'fork-theater': playForkTheater,
      'same-question-mirrors': playMirrors,
      'chart-notebook': playChartNotebook,
      'light-scroll': playLightScroll,
      'solar-term-garden': playSolarGarden
    }[id];
    body.innerHTML = html ? html() : '';
    if (id === 'solar-term-garden') renderGarden($('#xp-sg-cur', root), $('#xp-sg-body', root));
    if (id === 'action-card') renderCards($('#xp-ac-list', root));
    if (id === 'chart-notebook') renderNotes($('#xp-cn-list', root));
    if (id === 'light-scroll') renderScrolls($('#xp-ls-list', root));
  }

  function renderCards(host) {
    if (!host) return;
    var cards = PB.cards.load();
    var due = PB.cards.due();
    if (!cards.length) { host.innerHTML = '<p class="xext-note">还没有行动卡。</p>'; return; }
    host.innerHTML = '<h4 style="color:#eed5a0">行动卡（' + cards.length + '，其中 ' + due.length + ' 张待复盘）</h4>' +
      cards.slice(0, 12).map(function (c) {
        var st = PB.cards.state(c);
        var label = st === 'done' ? '已复盘' : st === 'due' ? '待复盘' : '等待中';
        return '<div class="xext-card" style="margin-bottom:10px">' +
          '<h4>' + E(c.question) + '</h4>' +
          '<div class="xext-sub">' + E(c.action) + ' · ' + c.days + ' 天后（' + E(String(c.dueAt).slice(0, 10)) + '）· ' + label + '</div>' +
          (c.outcome ? '<div class="xext-sub">实际结果：' + E(c.outcome) + (c.reflection ? '。反思：' + E(c.reflection) : '') + '</div>'
            : '<div class="xext-row" style="margin-top:8px">' +
              '<input class="input" data-outcome="' + E(c.id) + '" placeholder="到期后填写实际结果" style="flex:1 1 200px">' +
              '<button type="button" class="xext-mini" data-saveoutcome="' + E(c.id) + '">保存</button>' +
              '<button type="button" class="xext-mini" data-delcard="' + E(c.id) + '">删除</button></div>') +
          '</div>';
      }).join('');
  }

  function renderNotes(host) {
    if (!host) return;
    var notes = PB.notes.load();
    var keys = Object.keys(notes);
    if (!keys.length) { host.innerHTML = '<p class="xext-note">还没有注释。</p>'; return; }
    host.innerHTML = '<h4 style="color:#eed5a0">我的注释</h4><ul class="xext-list">' +
      keys.map(function (k) {
        return '<li>' + E(k) + '：' + E(notes[k].text) +
          ' <button type="button" class="xext-mini" data-delnote="' + E(k) + '">删除</button></li>';
      }).join('') + '</ul>';
  }

  function renderScrolls(host) {
    if (!host) return;
    var list = PB.scrolls.load();
    if (!list.length) { host.innerHTML = '<p class="xext-note">还没有卷轴。</p>'; return; }
    host.innerHTML = '<h4 style="color:#eed5a0">已保存的卷轴</h4><ul class="xext-list">' +
      list.map(function (s) {
        return '<li>' + E(s.title) + '（' + E(String(s.createdAt).slice(0, 10)) + '）' +
          ' <button type="button" class="xext-mini" data-viewscroll="' + E(s.id) + '">查看</button>' +
          ' <button type="button" class="xext-mini" data-delscroll="' + E(s.id) + '">删除</button></li>';
      }).join('') + '</ul>';
  }

  function renderGarden(curHost, bodyHost) {
    var r = Reg.run('solar-term-garden', {});
    var t = r.term;
    curHost.innerHTML = '<div class="xext-card"><h4>' + E(t.name) + '</h4>' +
      '<div class="xext-sub">' + E(t.note) + ' · 参考植物：' + E(t.plants.join('、')) + '</div>' +
      '<div class="xext-sub">光色基色：hsl(' + Number(t.hue) + ', 32%, 18%)</div></div>' +
      '<div class="xext-lim">' + E(r.limitations.join('　')) + '</div>';

    var g = PB.garden.load();
    bodyHost.innerHTML = '<div class="xext-row">' +
      '<button type="button" class="xext-mini" data-unlock="' + E(t.name) + '">记录一次实际行动</button>' +
      '<button type="button" class="xext-mini" data-clear-garden>清空庭院记录</button>' +
      '<span class="xext-note">已布置 ' + g.items.length + ' 项 · 已解锁 ' + g.unlocked.length + ' 项</span>' +
      '</div>' +
      (g.unlocked.length
        ? '<ul class="xext-list">' + g.unlocked.map(function (u) {
            return '<li>' + E(u.key) + '：' + E(u.reason) + '（' + E(String(u.at).slice(0, 10)) + '）</li>';
          }).join('') + '</ul>'
        : '<p class="xext-note">解锁只靠完成探索与实际行动，不设充值，也不做恐惧引导。</p>');
  }

  function bindPlaybook(root) {
    var bodyHost = $('#xp-body', root);
    var current = 'action-card';

    $$('[data-play]', root).forEach(function (btn) {
      btn.onclick = function () {
        $$('[data-play]', root).forEach(function (b) { b.setAttribute('aria-selected', 'false'); });
        btn.setAttribute('aria-selected', 'true');
        current = btn.dataset.play;
        renderPlaybook(root, current);
      };
    });

    /* 事件委托：面板内容随 tab 重建，统一在 bodyHost 上监听 */
    bodyHost.addEventListener('click', function (e) {
      try {
        var out = $('#xp-ac-out', root) || $('#xp-fk-out', root) || $('#xp-mr-out', root) ||
          $('#xp-cn-out', root) || $('#xp-ls-out', root);

        var saveOutcome = e.target.closest('[data-saveoutcome]');
        if (saveOutcome) {
          var val = $('[data-outcome="' + saveOutcome.dataset.saveoutcome + '"]', root);
          PB.cards.updateOutcome(saveOutcome.dataset.saveoutcome, val ? val.value : '');
          renderCards($('#xp-ac-list', root));
          return;
        }
        var delCard = e.target.closest('[data-delcard]');
        if (delCard) { PB.cards.remove(delCard.dataset.delcard); renderCards($('#xp-ac-list', root)); return; }

        var delNote = e.target.closest('[data-delnote]');
        if (delNote) { PB.notes.remove(delNote.dataset.delnote); renderNotes($('#xp-cn-list', root)); return; }

        var viewScroll = e.target.closest('[data-viewscroll]');
        if (viewScroll) {
          var sc = PB.scrolls.load().filter(function (x) { return x.id === viewScroll.dataset.viewscroll; })[0];
          if (sc) modal('<h2>' + E(sc.title) + '</h2><p>' + E(sc.body).replace(/\n/g, '<br>') + '</p>' +
            (sc.feeling ? '<p class="xext-note">感想：' + E(sc.feeling) + '</p>' : ''));
          return;
        }
        var delScroll = e.target.closest('[data-delscroll]');
        if (delScroll) { PB.scrolls.remove(delScroll.dataset.delscroll); renderScrolls($('#xp-ls-list', root)); return; }

        var unlock = e.target.closest('[data-unlock]');
        if (unlock) {
          PB.garden.unlock(unlock.dataset.unlock, '完成一次实际行动');
          renderGarden($('#xp-sg-cur', root), $('#xp-sg-body', root));
          return;
        }
        if (e.target.closest('[data-clear-garden]')) {
          PB.garden.clear();
          renderGarden($('#xp-sg-cur', root), $('#xp-sg-body', root));
          return;
        }

        var runBtn = e.target.closest('[id$="-run"]');
        if (runBtn) {
          if (runBtn.id === 'xp-ac-run') {
            var r = Reg.run('action-card', {
              question: $('#xp-ac-q', root).value,
              action: $('#xp-ac-a', root).value,
              days: Number($('#xp-ac-d', root).value)
            });
            $('#xp-ac-out', root).innerHTML = renderResult(r, 'action-card');
            renderCards($('#xp-ac-list', root));
          } else if (runBtn.id === 'xp-fk-run') {
            var side = function (sel) {
              var o = {};
              FORK_DIMS.forEach(function (d) {
                var t = $('[data-dim="' + d.key + '"]', sel);
                if (t) o[d.key] = t.value;
              });
              return o;
            };
            var g1 = $('#xp-fk-out', root);
            var rk = Reg.run('fork-theater', {
              question: $('#xp-fk-q', root).value,
              a: side(g1.closest('.xext-panel').querySelectorAll('fieldset')[0]),
              b: side(g1.closest('.xext-panel').querySelectorAll('fieldset')[1])
            });
            g1.innerHTML = renderResult(rk, 'fork-theater');
          } else if (runBtn.id === 'xp-mr-run') {
            /* 这里只接受用户已在上方跑出的结论摘要，不代跑任何体系 */
            var picked = $$('[data-sys]', root).filter(function (c) { return c.checked; })
              .map(function (c) { return c.dataset.sys; });
            if (!picked.length) throw new Error('请至少勾选一个体系。');
            var results = {};
            picked.forEach(function (k) {
              results[k] = '（请在上方对应页面运行后，把结论要点填进来；此处不代为测算。）';
            });
            var rm = Reg.run('same-question-mirrors', { question: $('#xp-mr-q', root).value, results: results });
            $('#xp-mr-out', root).innerHTML = renderResult(rm, 'same-question-mirrors');
          } else if (runBtn.id === 'xp-ls-run') {
            var rl = Reg.run('light-scroll', {
              title: $('#xp-ls-t', root).value,
              body: $('#xp-ls-b', root).value,
              feeling: $('#xp-ls-f', root).value
            });
            $('#xp-ls-out', root).innerHTML = renderResult(rl, 'light-scroll');
            $('#xp-ls-out', root).insertAdjacentHTML('beforeend',
              '<textarea class="input" id="xp-ls-text" rows="8" style="margin-top:12px">' +
              E(PB.scrolls.toText(rl.scroll)) + '</textarea>');
            renderScrolls($('#xp-ls-list', root));
          }
          return;
        }

        if (e.target.closest('#xp-cn-save')) {
          var term = $('#xp-cn-t', root).value.trim();
          var note = $('#xp-cn-n', root).value.trim();
          if (!term) throw new Error('请填写术语。');
          var ex = PB.notes.explain(term, readCurrentChart());
          PB.notes.save(term, note);
          $('#xp-cn-out', root).innerHTML = '<div class="xext-card"><h4>' + E(ex.term) + '</h4>' +
            '<div class="xext-sub">' + E(ex.text) + '</div></div>';
          renderNotes($('#xp-cn-list', root));
          return;
        }

        if (e.target.closest('#xp-ls-copy')) {
          var ta = $('#xp-ls-text', root);
          if (!ta) throw new Error('请先生成卷轴。');
          ta.select();
          var okCopy = false;
          try { okCopy = doc.execCommand('copy'); } catch (err) { okCopy = false; }
          if (!okCopy && navigator.clipboard) {
            navigator.clipboard.writeText(ta.value).then(function () {
              ta.insertAdjacentHTML('afterend', '<p class="xext-note">已复制到剪贴板。</p>');
            }, function () {
              ta.insertAdjacentHTML('afterend', '<p class="xext-lim">浏览器拒绝了剪贴板写入，请手动全选复制。</p>');
            });
          } else {
            ta.insertAdjacentHTML('afterend', '<p class="xext-note">' + (okCopy ? '已复制到剪贴板。' : '请手动全选复制上方文本。') + '</p>');
          }
          return;
        }
      } catch (err) {
        var host = $('#xp-ac-out', root) || $('#xp-fk-out', root) || $('#xp-mr-out', root) ||
          $('#xp-cn-out', root) || $('#xp-ls-out', root);
        if (host) host.insertAdjacentHTML('beforeend', '<div class="xext-lim">' + E(err.message) + '</div>');
      }
    });

    renderPlaybook(root, current);
  }

  /* 读取首页保存的真实生辰；未保存时返回 null，让注释册如实说明无数据。 */
  function readCurrentChart() {
    try {
      if (typeof global.loadBirth !== 'function') return null;
      var birth = global.loadBirth();
      if (!birth) return null;
      /* 只取年月日，用于同柱判断；不外传、不展示完整生日 */
      var ymd = birth.year + '-' + birth.month + '-' + birth.day;
      return { '日主': String(global.FourPillars ? global.FourPillars.pillarText({ year: birth.year, month: birth.month, day: birth.day, hour: birth.hour || 0 }).day : ymd + '（未起盘）') };
    } catch (e) {
      return null;
    }
  }

  /* ============================================================ 二十八宿星空剧场 */

  /* 状态放在模块级而非面板内：切走再切回时，用户调好的观测条件（时间、纬度、
     视场）应当保留。面板重挂载只重画 DOM，不重置这些条件——
     这与塔罗牌桌刻意重置的做法不同：牌桌每次抽牌都是独立局，而观星是连续过程。 */
  var xiuState = {
    lst: 21, lat: 34, ra: 90, dec: 0, zoom: 1,
    picked: null, pan: null
  };

  function xiuPanel() {
    var terms = global.XiuAstro.solarTerms();
    return '' +
      '<div class="xext-row" style="margin-bottom:12px">' +
      '<label class="xext-field" style="flex:0 0 130px">地方恒星时（时）' +
      '<input class="input" id="xx-lst" type="range" min="0" max="23.99" step="0.25" value="' +
      xiuState.lst + '" aria-label="地方恒星时"></label>' +
      '<label class="xext-field" style="flex:0 0 130px">观测纬度' +
      '<input class="input" id="xx-lat" type="range" min="-60" max="70" step="1" value="' +
      xiuState.lat + '" aria-label="观测纬度"></label>' +
      '<label class="xext-field" style="flex:0 0 130px">视场缩放' +
      '<input class="input" id="xx-zoom" type="range" min="0.5" max="4" step="0.1" value="' +
      xiuState.zoom + '" aria-label="视场缩放"></label>' +
      '<span class="xext-note" id="xx-when"></span>' +
      '<button type="button" class="btn-ghost" id="xx-reset">回到初始视场</button>' +
      '</div>' +
      '<p class="xext-note" id="xx-hint">按住星图拖动可旋转天区；点击宿带、四宫色点或星点查看详情。' +
      '键盘可用 Tab 在宿与星之间移动，回车打开详情。</p>' +
      '<div id="xx-map"></div>' +
      '<div id="xx-detail" class="xext-out" aria-live="polite"></div>' +
      '<div id="xx-nav" style="margin-top:16px"></div>' +
      '<h4 style="color:#eed5a0;margin:24px 0 8px">四象</h4>' +
      '<div class="xext-grid">' + global.XiuUI.palacePanel() + '</div>' +
      '<h4 style="color:#eed5a0;margin:24px 0 8px">节气与宿</h4>' +
      '<div id="xx-terms">' + global.XiuUI.termPanel() + '</div>' +
      '<p class="xext-lim" style="margin-top:18px">本页只做观象坐标与文化出处：按宿定位、看代表星在哪、' +
      '查文化含义、对应节气与四宫。二十八宿在此是天区划分与文化分区，' +
      '不作命运推断、不排吉凶。宿度为沿天赤道的等分近似，' +
      '与实测度数与代表星坐标均不完全一致，界面已分开呈现。</p>';
    void terms;
  }

  function bindXiu(root) {
    var mapEl = $('#xx-map', root);
    var detailEl = $('#xx-detail', root);
    var whenEl = $('#xx-when', root);
    if (!mapEl || !detailEl) return;

    var view = global.SkyView.create({
      width: 760, height: 440,
      ra: xiuState.ra, dec: xiuState.dec, zoom: xiuState.zoom,
      lat: xiuState.lat, lst: xiuState.lst
    });

    function stamp() {
      var hh = Math.floor(xiuState.lst);
      var mm = Math.round((xiuState.lst - hh) * 60);
      return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    }

    function paint() {
      mapEl.innerHTML = global.XiuUI.starMap({
        width: 760, height: 440,
        ra: view.state.ra, dec: view.state.dec, zoom: view.state.zoom,
        lat: view.state.lat, lst: view.state.lst
      });
      var labels = Array.prototype.slice.call(mapEl.querySelectorAll('[data-lodge]'));
      labels.forEach(function (n) {
        n.addEventListener('click', function () { openLodge(n.dataset.lodge); });
        n.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLodge(n.dataset.lodge); }
        });
      });
      if (whenEl) {
        whenEl.textContent = '地方恒星时 ' + stamp() + ' · 纬度 ' + xiuState.lat + '°' +
          ' · 视场中心 赤经 ' + view.state.ra.toFixed(1) + '° 赤纬 ' + view.state.dec.toFixed(1) + '°';
      }
    }

    function openLodge(name) {
      try {
        xiuState.picked = name;
        detailEl.innerHTML = global.XiuUI.lodgeDetail(name);
        detailEl.scrollIntoView({ block: 'nearest' });
      } catch (e) { showError(e); }
    }

    /* 拖拽：pointer 事件统一处理鼠标与触摸；pointercapture 保证拖出元素后
       仍然跟手，不会出现「滑出边界就卡住」的断触。 */
    var dragging = null;
    mapEl.addEventListener('pointerdown', function (e) {
      var svg = mapEl.querySelector('svg');
      if (!svg) return;
      dragging = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* 不支持时降级为普通拖拽 */ }
    });
    mapEl.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragging.x;
      var dy = e.clientY - dragging.y;
      if (!dragging.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      dragging.moved = true;
      view.pan(dx, dy);
      dragging.x = e.clientX; dragging.y = e.clientY;
      paint();
    });
    var endDrag = function () { dragging = null; };
    mapEl.addEventListener('pointerup', endDrag);
    mapEl.addEventListener('pointercancel', endDrag);

    mapEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      view.zoomTo(view.state.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
      paint();
    }, { passive: false });

    var lstIn = $('#xx-lst', root);
    if (lstIn) lstIn.oninput = function () {
      xiuState.lst = Number(lstIn.value);
      view.setTime(xiuState.lst);
      paint();
    };
    var latIn = $('#xx-lat', root);
    if (latIn) latIn.oninput = function () {
      xiuState.lat = Number(latIn.value);
      view.state.lat = xiuState.lat;
      paint();
    };
    var zoomIn = $('#xx-zoom', root);
    if (zoomIn) zoomIn.oninput = function () {
      xiuState.zoom = Number(zoomIn.value);
      view.zoomTo(xiuState.zoom);
      paint();
    };
    var resetBtn = $('#xx-reset', root);
    if (resetBtn) resetBtn.onclick = function () {
      xiuState.ra = 90; xiuState.dec = 0; xiuState.zoom = 1;
      view.state.ra = 90; view.state.dec = 0;
      view.zoomTo(1);
      if (zoomIn) zoomIn.value = '1';
      paint();
      if (whenEl) whenEl.textContent = '已回到初始视场（赤经 90°，赤纬 0°，即天赤道）。';
    };

    var navEl = $('#xx-nav', root);
    if (navEl) {
      navEl.innerHTML = global.XiuUI.lodgeNavigator();
      Array.prototype.slice.call(navEl.querySelectorAll('[data-goto]')).forEach(function (b) {
        b.addEventListener('click', function () {
          var l = global.XiuAstro.lodge(b.dataset.goto);
          if (!l) { showError(new Error('找不到宿：' + b.dataset.goto)); return; }
          var mid = (l.raStart + (l.raEnd - l.raStart) / 2) % 360;
          view.focus(mid, 0);
          xiuState.ra = view.state.ra; xiuState.dec = view.state.dec;
          paint();
          openLodge(l.name);
        });
      });
    }

    paint();
    if (xiuState.picked) openLodge(xiuState.picked);
  }

  /* ============================================================ 紫微斗数本命盘 */

  /* 同 xiuState：星盘是「一张盘看很多年」，切走再切回应当保留已排好的盘与选中宫，
     除非用户主动改生辰或点「重新排盘」。 */
  var chartState = {
    birth: { year: 1990, month: 6, day: 15, hour: 10, gender: '男' },
    chart: null, picked: null, year: null
  };

  var HOURS_CN = ['早子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '晚子'];

  function chartPanel() {
    var b = chartState.birth;
    var y = chartState.year || new Date().getFullYear();
    var cur = null;
    if (chartState.chart) { try { cur = global.StarChart.decadalAt(chartState.chart, y); } catch (e) { cur = null; } }
    return '' +
      '<p class="xext-note">紫微斗数以生年、月、日、<b>时辰</b>与性别立盘；缺时辰无法排盘。' +
      '下面只把盘面如实画出并解释术语，不据此判断吉凶。</p>' +
      '<div class="xext-row" style="margin:12px 0">' +
      '<label class="xext-field" style="flex:0 0 92px">出生年' +
      '<input class="input" id="xc-y" type="number" min="1900" max="2100" step="1" value="' + b.year + '" aria-label="出生年"></label>' +
      '<label class="xext-field" style="flex:0 0 78px">月' +
      '<input class="input" id="xc-m" type="number" min="1" max="12" step="1" value="' + b.month + '" aria-label="出生月"></label>' +
      '<label class="xext-field" style="flex:0 0 78px">日' +
      '<input class="input" id="xc-d" type="number" min="1" max="31" step="1" value="' + b.day + '" aria-label="出生日"></label>' +
      '<label class="xext-field" style="flex:0 0 130px">时辰' +
      '<select class="input" id="xc-h" aria-label="出生时辰">' +
      HOURS_CN.map(function (h, i) {
        return '<option value="' + i + '"' + (Number(b.hour) === i || (Number(b.hour) === 23 && i === 12) ? ' selected' : '') + '>' + h + '时</option>';
      }).join('') + '</select></label>' +
      '<label class="xext-field" style="flex:0 0 92px">性别' +
      '<select class="input" id="xc-g" aria-label="性别">' +
      '<option value="男"' + (b.gender === '男' ? ' selected' : '') + '>男</option>' +
      '<option value="女"' + (b.gender === '女' ? ' selected' : '') + '>女</option>' +
      '</select></label>' +
      '<button type="button" class="btn" id="xc-cast">排盘</button>' +
      '</div>' +
      '<div id="xc-err" class="xext-lim" style="display:none"></div>' +
      '<div id="xc-chart"></div>' +
      '<div class="xext-row" style="margin:14px 0 6px">' +
      '<label class="xext-field" style="flex:0 0 150px">查看年份' +
      '<input class="input" id="xc-year" type="number" min="' + b.year + '" max="2100" step="1" value="' + y + '" aria-label="查看年份"></label>' +
      '<span class="xext-note" id="xc-decadal"></span></div>' +
      '<div id="xc-detail" class="xext-out" aria-live="polite"></div>' +
      '<div id="xc-stars"></div>' +
      '<p class="xext-lim" style="margin-top:18px">紫微斗数是传统命理体系。本区块只做排盘呈现与传统术语解释，' +
      '不作命运推断、不作吉凶断语；庙旺利陷与四化均为传统术语，请勿据以决策。' +
      '排盘由内置引擎 iztro 计算，不含任何近似推算。</p>';
  }

  function chartDetailHtml(p, chart) {
    var mut = chart.stars.filter(function (s) { return s.mutagen; });
    var rows = p.stars.map(function (s) {
      return '<tr><td>' + E(s.name) + '</td><td>' + E(s.typeLabel) + '</td><td>' + E(s.brightness) + '</td>'
        + '<td>' + (s.mutagen ? E('化' + s.mutagen) : '—') + '</td></tr>';
    }).join('');
    return '<h4 style="color:#eed5a0;margin:12px 0 6px">' + E(p.branch) + '宫 · ' + E(p.name) + '</h4>'
      + '<p class="xext-note">' + E(p.topic) + '</p>'
      + '<p class="xext-lim">' + E(p.boundary) + '</p>'
      + '<table class="xext-table"><thead><tr><th>星曜</th><th>类别</th><th>庙旺</th><th>生年四化</th></tr></thead>'
      + '<tbody>' + (rows || '<tr><td colspan="4">此宫无星曜</td></tr>') + '</tbody></table>'
      + '<p class="xext-note" style="margin-top:8px">本命生年四化共 4 颗：'
      + mut.map(function (s) { return E(s.name + '化' + s.mutagen + '（' + s.palace.name + '）'); }).join('、')
      + '。四化表示传统意义上的能量偏向，不是结果判决。</p>';
  }

  function bindChart(root) {
    function draw() {
      var chart = chartState.chart;
      var host = $('#xc-chart', root);
      if (!host) return;
      if (!chart) { host.innerHTML = ''; return; }
      var size = Math.max(320, Math.min(560, (root.clientWidth || 720) - 60));
      var hl = chartState.picked ? global.ChartUI.highlight({ width: size, height: size, palace: chartState.picked }) : '';
      host.innerHTML = global.ChartUI.chart(chart, { width: size, height: size })
        + (hl ? '<svg class="xext-chart" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" style="margin-top:-' + (size + 34) + 'px">' + hl + '</svg>' : '');

      var y = chartState.year || new Date().getFullYear();
      var dec = $('#xc-decadal', root);
      var cur = null;
      try { cur = global.StarChart.decadalAt(chart, y); } catch (e) { cur = null; }
      dec.textContent = cur
        ? (y + ' 年落在第 ' + (cur.index + 1) + ' 限（' + cur.startAge + '–' + cur.endAge + ' 岁），行' + cur.palaceName + '。')
        : '';

      var mut = chart.stars.filter(function (s) { return s.mutagen; });
      $('#xc-stars', root).innerHTML = '<h4 style="color:#eed5a0;margin:20px 0 8px">生年四化</h4>'
        + '<div class="xext-grid">' + mut.map(function (s) {
          return '<div class="xext-box"><strong>' + E(s.name + '化' + s.mutagen) + '</strong>'
            + '<div class="xext-note">在 ' + E(s.palace.branch + '宫 · ' + s.palace.name) + '</div></div>';
        }).join('') + '</div>'
        + '<h4 style="color:#eed5a0;margin:20px 0 8px">十二宫白话索引</h4>'
        + '<div class="xext-grid">' + chart.palaces.map(function (p) {
          return '<div class="xext-box"><strong>' + E(p.branch + '宫 · ' + p.name) + '</strong>'
            + '<div class="xext-note">' + E(p.topic) + '</div></div>';
        }).join('') + '</div>'
        + '<h4 style="color:#eed5a0;margin:20px 0 8px">大限（十年一档，起限按五行局）</h4>'
        + '<div class="xext-grid">' + chart.decadal.map(function (d) {
          return '<div class="xext-box"><strong>第 ' + (d.index + 1) + ' 限 · ' + E(d.startAge) + '–' + E(d.endAge) + ' 岁</strong>'
            + '<div class="xext-note">行 ' + E(d.palaceName) + '</div></div>';
        }).join('') + '</div>';
    }

    function cast() {
      var err = $('#xc-err', root);
      var y = Number(($('#xc-y', root) || {}).value);
      var m = Number(($('#xc-m', root) || {}).value);
      var d = Number(($('#xc-d', root) || {}).value);
      var h = Number(($('#xc-h', root) || {}).value);
      var g = ($('#xc-g', root) || {}).value;
      try {
        chartState.chart = global.StarChart.build({ year: y, month: m, day: d, hour: h, gender: g });
        chartState.birth = { year: y, month: m, day: d, hour: h, gender: g };
        chartState.picked = null;
        err.style.display = 'none';
        $('#xc-detail', root).innerHTML = '';
      } catch (e) {
        /* 排盘失败必须把原因写出来，不能悄悄留一个空白面板 */
        err.style.display = '';
        err.textContent = '排盘未完成：' + (e && e.message ? e.message : String(e));
        return;
      }
      draw();
    }

    var btn = $('#xc-cast', root);
    if (btn) btn.addEventListener('click', cast);
    ['#xc-y', '#xc-m', '#xc-d', '#xc-h', '#xc-g'].forEach(function (sel) {
      var el = $(sel, root);
      if (el) el.addEventListener('change', cast);
    });
    var yr = $('#xc-year', root);
    if (yr) yr.addEventListener('input', function () {
      chartState.year = Number(yr.value);
      draw();
    });

    /* 宫格 / 星曜点选。SVG 元素用 dataset 找，避免在闭包里存节点引用。 */
    var host = $('#xc-chart', root);
    if (host) {
      host.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-palace],[data-star]');
        if (!t) return;
        var name = t.getAttribute('data-palace-name') || t.getAttribute('data-palace');
        var hit = chartState.chart.palaces.filter(function (p) { return p.name === name; })[0];
        if (!hit) return;
        chartState.picked = hit;
        $('#xc-detail', root).innerHTML = chartDetailHtml(hit, chartState.chart);
        draw();
      });
      host.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        var t = ev.target.closest('[data-palace],[data-star]');
        if (!t) return;
        ev.preventDefault();
        t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }

    if (!chartState.chart) cast(); else draw();
  }

  /* ============================================================ 户型空间实验室 */

  /* 户型是持续编辑的对象，切走再切回必须保留改动，故状态放模块级。 */
  /* 勘宅神器的状态。
     bitmap / thumb 存最近一次载入的图纸；
     ppm 是比例尺（像素/米），决定面积结论的绝对值；
     rooms 始终是「校正后的房间」，识别结果先写进来，用户再改。 */
  var SAMPLE_ROOMS = [
    { id: 'living', name: '客厅', kind: 'living', x: 0, y: 0, w: 5.4, h: 4.6 },
    { id: 'kitchen', name: '厨房', kind: 'kitchen', x: 5.4, y: 0, w: 3.6, h: 3.2 },
    { id: 'bed1', name: '主卧', kind: 'bedroom', x: 5.4, y: 3.2, w: 3.6, h: 4.8 },
    { id: 'bed2', name: '次卧', kind: 'bedroom', x: 0, y: 4.6, w: 5.4, h: 3.4 }
  ];
  var houseState = {
    width: 9, depth: 8, facing: 'S', gender: '男', showCulture: true,
    entry: null,
    bitmap: null, thumb: '', ppm: 10,
    source: 'sample',
    rooms: SAMPLE_ROOMS.slice(),
    analysis: null, picked: null, drag: null,
    /* ---- 第二阶段（任务 #20）新增 ---- */
    /* 图纸变换：只接受 90° 整数倍旋转与轴向镜像 */
    rotate: 0, mirrorX: false, mirrorY: false,
    /* 门窗与房间功能推断结果 */
    openings: [], kinds: null,
    /* 勘宅者出生日期，喂给 BaziCore；为空则全部走纯几何建议 */
    birth: { year: '', month: '', day: '', hour: '', gender: '' },
    bazi: null,
    furniture: null, decor: null,
    showMark: true, showFurniture: false, showDecor: false,
    showBase: true
  };

  var FACING_CN = { N: '北', NE: '东北', E: '东', SE: '东南', S: '南', SW: '西南', W: '西', NW: '西北' };
  var KIND_CN = {
    living: '客厅/起居', kitchen: '厨房', bedroom: '卧室', bath: '卫生间',
    study: '书房', kids: '儿童房', guest: '客房', storage: '储物', utility: '家政间'
  };

  /* ---------- 图纸读取：把用户丢进来的任何图片转成像素矩阵 ----------
     只认PNG / JPEG / WebP。CAD 的 dxf 与矢量 svg 需要另走解析器，
     这里不假装支持 —— 遇到就明说，让用户导出一张位图再传。 */
  function readBitmap(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error('没有拿到文件。')); return; }
      if (!/^image\//.test(file.type || '')) {
        reject(new Error('目前只接受图片文件（PNG / JPG / WebP）。'
          + '如果是 CAD 的 dxf 或矢量 svg，请先在 CAD 里导出成图片再传。'));
        return;
      }
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('文件读取失败，可能是权限或文件损坏。')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('这张图片无法解码，请换一张 PNG 或 JPG。')); };
        img.onload = function () {
          /* 超大图先等比压到1600px 以内：识别是逐像素扫描，
             6000×4000 的手机照片会卡住界面，而墙线在缩图上照样认得出来。 */
          var MAX = 1600;
          var k = Math.min(1, MAX / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * k));
          var h = Math.max(1, Math.round(img.height * k));
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          var cx = cv.getContext('2d');
          cx.drawImage(img, 0, 0, w, h);
          var px;
          try { px = cx.getImageData(0, 0, w, h); } catch (e) {
            reject(new Error('浏览器拒绝读取这张图片的像素（可能来自本地文件权限）。'));
            return;
          }
          resolve({
            width: w, height: h, data: px.data,
            natural: { w: img.width, h: img.height }, scale: k
          });
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function housePanel() {
    var a = houseState.analysis;
    var img = houseState.bitmap;
    return '' +
      '<p class="xext-note"><strong>三步出报告</strong>：① 丢一张平面户型图进来（点击选择或直接拖拽）'
      + '② 核对识别出的房间边界，必要时拖一拖改一改 ③ 读勘宅结论与改进计划。'
      + '面积、采光、通风、动线、缺角与评分全部由几何数据实算，每条结论都附算式，'
      + '你可以自己复核——不是套用固定建议。</p>' +

      '<div id="xext-k-drop" class="xext-k-drop" tabindex="0" role="button" aria-label="上传或拖入户型图">' +
      '<input type="file" id="xext-k-file" accept="image/*" class="xext-k-file" aria-label="选择户型图文件">' +
      (img
        ? '<img class="xext-k-thumb" src="' + houseState.thumb + '" alt="已载入的户型图">'
        : '<div class="xext-k-drop-hint"><strong>把户型图拖到这里</strong>'
          + '<span>或点击选择文件 · 支持 PNG / JPG / WebP</span>'
          + '<span class="xext-k-lim">只处理线条清晰的轴对齐平面图。斜墙、弧墙、'
          + '效果图与低清网图识别不出来，届时会直接告诉你，不会硬凑结果。</span></div>') +
      '</div>' +

      (img ? '' : '<div class="xext-k-conf xext-k-conf-ok" style="margin-top:12px">' +
        '<strong>当前显示的是内置示例户型</strong>' +
        '<span>下面这份报告是拿示例数据算的，不是你的房子。'
        + '把户型图拖进来就会换成你自己家的结论。</span></div>') +

      /* 控件区无条件渲染。朝向、宅星、文化层与示例按钮跟图纸无关，
         首屏默认就是示例户型，把它们一起藏掉会让整页看着像只读报告 ——
         实际上用户是改不了朝向、也点不到示例按钮的。 */
      '<div class="xext-row" style="margin:12px 0">' +
      '<label class="xext-field" style="flex:0 0 132px">比例尺（像素/米）' +
      '<input class="input" id="xext-k-ppm" type="number" min="0.5" max="500" step="0.5" value="'
      + houseState.ppm + '"' + (img ? '' : ' disabled') +
      ' aria-label="比例尺"></label>' +
      '<label class="xext-field" style="flex:0 0 120px">正面朝向' +
      '<select class="input" id="xext-k-f" aria-label="正面朝向">' +
      Object.keys(FACING_CN).map(function (k) {
        return '<option value="' + k + '"' + (houseState.facing === k ? ' selected' : '') + '>' + FACING_CN[k] + '</option>';
      }).join('') + '</select></label>' +
      '<label class="xext-field" style="flex:0 0 110px">宅星起例' +
      '<select class="input" id="xext-k-g" aria-label="宅星起例">' +
      '<option value="男"' + (houseState.gender === '男' ? ' selected' : '') + '>男（东四命）</option>' +
      '<option value="女"' + (houseState.gender === '女' ? ' selected' : '') + '>女（西四命）</option>' +
      '</select></label>' +
      '<label class="xext-field" style="flex:0 0 130px">方位文化层' +
      '<input class="input" id="xext-k-c" type="checkbox"' + (houseState.showCulture ? ' checked' : '') +
      ' style="width:auto" aria-label="显示方位文化层"></label>' +
      '<button type="button" class="btn-ghost xext-k-btn" id="xext-k-rerun">重新识别</button>' +
      '<button type="button" class="btn-ghost xext-k-btn" id="xext-k-sample">用示例户型</button>' +
      '</div>' +
      '<div class="xext-k-scale-hint">比例尺决定所有面积结论的绝对值。'
      + '取图纸上一段已知长度的尺寸线量出像素数，除以米数即可。'
      + '拿不准就先估一个，报告里的「面积」会随之等比缩放，'
      + '<strong>各房间之间的比例关系与评分不受影响</strong>。'
      + (img ? '' : '<strong>现在放的是示例户型，比例尺要等图纸进来才能用。</strong>') +
      '</div>' +

      /* 图纸调整：让户型图跟罗盘、九宫对得上。
         建筑平面图未必按「上北下南」印，但八宅起星依赖坐向 ——
         方向搞反了星位就全错，所以这一组控件必须显眼。 */
      '<fieldset class="xext-k-fs">' +
      '<legend>图纸方向与大小（用于和罗盘、九宫对位）</legend>' +
      '<div class="xext-row">' +
      '<label class="xext-field" style="flex:0 0 104px">旋转' +
      '<select class="input" id="xext-k-rot" aria-label="图纸旋转">' +
      [0, 90, 180, 270].map(function (d) {
        return '<option value="' + d + '"' + (houseState.rotate === d ? ' selected' : '') + '>'
          + d + '°</option>';
      }).join('') + '</select></label>' +
      '<label class="xext-field" style="flex:0 0 118px">左右镜像' +
      '<input class="input" id="xext-k-mx" type="checkbox"'
      + (houseState.mirrorX ? ' checked' : '') + ' style="width:auto" aria-label="左右镜像"></label>' +
      '<label class="xext-field" style="flex:0 0 118px">上下翻转' +
      '<input class="input" id="xext-k-my" type="checkbox"'
      + (houseState.mirrorY ? ' checked' : '') + ' style="width:auto" aria-label="上下翻转"></label>' +
      '<label class="xext-field" style="flex:0 0 108px">整体缩放' +
      '<input class="input" id="xext-k-sc" type="number" min="0.2" max="5" step="0.1" value="1"'
      + ' aria-label="整体缩放倍数"></label>' +
      '<button type="button" class="btn-ghost xext-k-btn" id="xext-k-reset">复位</button>' +
      '</div>' +
      '<div class="xext-k-scale-hint">只接受 90° 的整数倍旋转。'
      + '任意角度会破坏「房间是轴对齐矩形」这个前提，面积与采光结论就不再可信 —— '
      + '所以这里不给自由角度。旋转后<strong>记得同步核对朝向</strong>，八宅起星依赖坐向。</div>' +
      '</fieldset>' +

      /* 勘宅者八字：可选。不填就全部走纯几何建议，功能不受影响。 */
      '<fieldset class="xext-k-fs">' +
      '<legend>勘宅者出生年月日（可选，用于五行家具与摆件建议）</legend>' +
      '<div class="xext-row">' +
      '<label class="xext-field" style="flex:0 0 140px">出生日期' +
      '<input class="input" id="xext-k-birth" type="date" value="'
      + E(houseState.birth.year
        ? houseState.birth.year + '-' + pad2(houseState.birth.month)
          + '-' + pad2(houseState.birth.day) : '') + '" aria-label="出生日期"></label>' +
      '<label class="xext-field" style="flex:0 0 116px">时辰（选填）' +
      '<input class="input" id="xext-k-hour" type="number" min="0" max="23" step="1" placeholder="0-23" value="'
      + E(houseState.birth.hour) + '" aria-label="出生时辰"></label>' +
      '<label class="xext-field" style="flex:0 0 110px">性别' +
      '<select class="input" id="xext-k-bg" aria-label="勘宅者性别">' +
      ['', '男', '女'].map(function (g) {
        return '<option value="' + g + '"' + (houseState.birth.gender === g ? ' selected' : '') + '>'
          + (g || '未填') + '</option>';
      }).join('') + '</select></label>' +
      '<button type="button" class="btn-ghost xext-k-btn" id="xext-k-bazi">测算八字</button>' +
      '</div>' +
      '<div class="xext-k-scale-hint">五行只用来决定<strong>家具摆放在哪个朝向更合适</strong>，'
      + '不参与任何吉凶判断。不填也能用：所有家具建议会自动降级为纯几何建议，'
      + '并标明「未叠加五行」。</div>' +
      '</fieldset>' +

      /* 图层开关：整改标记、家具、摆件分别可关，图太乱时用户自己能减 */
      '<fieldset class="xext-k-fs">' +
      '<legend>显示图层</legend>' +
      '<div class="xext-row">' +
      '<label class="xext-field" style="flex:0 0 112px">原图底图' +
      '<input class="input" id="xext-k-base" type="checkbox"'
      + (houseState.showBase ? ' checked' : '') + ' style="width:auto" aria-label="显示原图底图"></label>' +
      '<label class="xext-field" style="flex:0 0 120px">整改标记' +
      '<input class="input" id="xext-k-mark" type="checkbox"'
      + (houseState.showMark ? ' checked' : '') + ' style="width:auto" aria-label="显示整改标记"></label>' +
      '<label class="xext-field" style="flex:0 0 120px">家具布局' +
      '<input class="input" id="xext-k-fur" type="checkbox"'
      + (houseState.showFurniture ? ' checked' : '') + ' style="width:auto" aria-label="显示家具布局"></label>' +
      '<label class="xext-field" style="flex:0 0 120px">挂画摆件' +
      '<input class="input" id="xext-k-dec" type="checkbox"'
      + (houseState.showDecor ? ' checked' : '') + ' style="width:auto" aria-label="显示挂画摆件"></label>' +
      '</div>' +
      '<div class="xext-k-scale-hint">原图底图会把上传的户型图放大铺满下方画框，'
      + '识别框、门窗、家具与整改标记都叠在原图上，标的位置能直接对着图纸核。</div>' +
      '</fieldset>' +

      '<div id="xext-k-err" class="xext-lim" style="display:none"></div>' +
      '<div id="xext-k-body"></div>';
    void a;
  }

  function pad2(v) {
    var s = String(v == null ? '' : v);
    return s.length >= 2 ? s : '0' + s;
  }


/* ---------- 结果区渲染 ---------- */

  var METRIC_CN = {
    flow: '动线通畅度', layout: '格局完整度', palace: '主要空间落位',
    shape: '户型形状利用', function: '功能面积配比', light: '采光与通风'
  };
  var LEVEL_CN = { high: '必改', mid: '宜改', low: '可改' };
  var LEVEL_COLOR = { high: '#e2705a', mid: '#e0b357', low: '#8fa8c8' };

  function bar(v) {
    var n = Math.max(0, Math.min(20, Math.round(v / 5)));
    return '<span class="xext-k-bar">' +
      '<span class="xext-k-bar-on" style="width:' + (v / 5) + '%"></span>' +
      '<span class="xext-k-bar-txt">' + Math.round(v) + '</span></span>';
  }

  /* 置信度必须显示出来。识别错了还让用户照着结论改房子，
     是这类工具最伤的失真 —— 用户无从判断该不该信。

     source 只有两种：
       bitmap —— 自动识别结果，百分比有意义；
       sample —— 内置示例数据，识别环节根本没跑过，
                  给百分比等于编一个数字，必须直说。 */
  function confidenceHtml(c, source) {
    var isSample = source === 'sample';
    var pctTxt = Math.round((c || 0) * 100) + '%';
    var lv = isSample ? 'ok' : (c >= 0.66 ? 'ok' : (c >= 0.4 ? 'mid' : 'low'));
    var word = isSample ? '示例数据，非识别结果'
      : (c >= 0.66 ? '可直接核对'
        : (c >= 0.4 ? '需逐间核对' : '仅供参考，务必核对'));
    return '<div class="xext-k-conf xext-k-conf-' + lv + '">' +
      '<strong>' + (isSample ? '示例户型' : '识别置信度 ' + pctTxt) + '</strong>' +
      '<span>' + (isSample ? '内置样例数据 · ' : '自动识别 · ') + word + '</span>' +
      '</div>';
  }

  function roomTableHtml(a) {
    return '<table class="xext-table"><thead><tr><th>空间</th><th>面积</th>' +
      '<th>外窗</th><th>窗地比</th><th>采光</th><th>通风</th><th>距门</th><th>方位</th>' +
      '</tr></thead><tbody>' +
      a.rooms.map(function (r) {
        return '<tr><td>' + E(r.name) + '</td><td>' + r.area.toFixed(1) + '</td>'
          + '<td>' + (r.windows.length ? r.windows.map(function (w) { return E(w.dir); }).join('') : '<strong style="color:#e2705a">无</strong>') + '</td>'
          + '<td>' + (r.windowRatio * 100).toFixed(0) + '%</td>'
          + '<td>' + r.daylight.toFixed(2) + '</td>'
          + '<td>' + r.ventilation.toFixed(2) + ' <span style="opacity:.6">' + E(r.ventType) + '</span></td>'
          + '<td>' + r.path.toFixed(1) + ' m</td>'
          + '<td>' + E(r.direction) + E(r.mountain) + '山</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function drawBody(root) {
    var host = $('#xext-k-body', root);
    if (!host) return;
    var a = houseState.analysis;
    if (!a) {
      /* 识别失败时也要把置信度亮出来：0% 本身就是结论，
         让用户知道「这次没认出来」，而不是只看到一句报错。 */
      host.innerHTML = (houseState.bitmap
        ? confidenceHtml(houseState.inspect ? houseState.inspect.confidence : 0, 'bitmap')
        : confidenceHtml(0, 'sample'))
        + '<p class="xext-note">上面丢一张户型图进来就能出报告。'
        + '先用示例户型也可以，改动随时可做。</p>';
      return;
    }
    var w = Math.max(320, Math.min(720, (root.clientWidth || 700) - 40));
    var h = Math.round(w * 0.72);

    host.innerHTML =
      /* 0 识别置信度：让人知道这份结果该信几分 */
      (houseState.bitmap ? confidenceHtml(
        houseState.inspect ? houseState.inspect.confidence : 0,
        'bitmap') : confidenceHtml(0, 'sample')) +

      /* 1 结论摘要 */
      '<div class="xext-k-hero"><div class="xext-k-hero-score">' + a.total +
      '<span>综合得分</span></div>' +
      '<div class="xext-k-hero-txt"><strong>' + E(a.verdict) + '</strong>' +
      '<span>' + a.rooms.length + ' 个空间 · 轮廓 '
      + (a.width * a.depth).toFixed(1) + ' m² · 套内使用率 '
      + (a.usage * 100).toFixed(0) + '%</span></div></div>' +

      /* 2 六维评分 */
      '<div class="xext-k-metrics">' +
      ['flow', 'layout', 'palace', 'shape', 'function', 'light'].map(function (k) {
        return '<div class="xext-k-metric"><span class="xext-k-metric-k">' + METRIC_CN[k]
          + '</span>' + bar(a.scores[k]) + '</div>';
      }).join('') + '</div>' +

      /* 3 图上标注 */
      '<div id="xext-k-map">' + global.HouseScanUI.overlay(a, {
        width: w, height: h,
        showCompass: houseState.showCulture,
        /* 原图底图：上传的户型图放大铺满画框，标注叠在上面 */
        baseImage: (houseState.showBase && houseState.thumb) ? houseState.thumb : null,
        openings: houseState.openings,
        furniture: houseState.showFurniture ? houseState.furniture : null,
        decor: houseState.showDecor ? houseState.decor : null,
        showMarks: houseState.showMark
      }) + '</div>' +

      /* 门窗识别结果：一条条列出来，光靠图上的小标记看不清数量与宽度 */
      (houseState.openings && houseState.openings.length
        ? '<div class="xext-k-openings"><strong style="font-size:12px;color:#d4af37">'
          + '自动识别的门窗（' + houseState.openings.length + ' 处）</strong>'
          + houseState.openings.map(function (op) {
            return '<span class="xext-k-opening-chip xext-k-opening-' + op.kind + '">'
              + (op.kind === 'door' ? '门' : '窗') + ' · ' + SIDE_CN[op.side]
              + ' · 宽 ' + op.width.toFixed(2) + ' m</span>';
          }).join('') + '</div>'
          + '<p class="xext-k-scale-hint">门与窗只按开口宽度区分（≥0.8 m 判门，'
          + '&lt;0.8 m 判窗）—— 这是能复核的物理事实：人能走过去的洞是门，'
          + '只透光的窄缝是窗。画不出这个区别的图纸，请在下方清单里手动改。</p>'
        : '') +

      /* 3.5 校正行：拖完图上边界后在这里精调数值 */
      '<div class="xext-row" style="margin:12px 0" id="xext-k-edit"></div>' +

      /* 4 逐间明细 */
      '<h4 class="xext-k-h">逐间明细</h4>' + roomTableHtml(a) +

      /* 5 问题清单 */
      '<h4 class="xext-k-h">检出的问题（按等级）</h4>' +
      (a.issues.length
        ? '<ul class="xext-k-issues">' + a.issues.map(function (i, ii) {
          return '<li class="xext-k-issue xext-k-issue-tap" data-issue-row="' + E(i.id || String(ii))
            + '" tabindex="0" role="button" title="点击在图上定位" style="border-left-color:'
            + (LEVEL_COLOR[i.level] || '#8fa8c8') + '">' +
            '<div class="xext-k-issue-h"><span class="xext-k-tag" style="background:'
            + (LEVEL_COLOR[i.level] || '#8fa8c8') + '">' + (ii + 1) + ' · '
            + (LEVEL_CN[i.level] || '提示')
            + '</span><strong>' + E(i.tag || '问题') + '</strong></div>' +
            '<div class="xext-k-issue-t">' + E(i.text) + '</div>' +
            (i.plain ? '<div class="xext-k-fitem-plain"><strong>大白话：</strong>'
              + E(i.plain) + '</div>' : '') +
            '<div class="xext-k-issue-b">依据：' + E(i.basis) + '</div></li>';
        }).join('') + '</ul>'
        : '<p class="xext-note">按当前几何数据未检出明显问题。</p>') +

      /* 6 改进计划 */
      '<h4 class="xext-k-h">改进计划（按「先做哪一件」排序）</h4>' +
      (a.plan.length
        ? '<ol class="xext-k-plan">' + a.plan.map(function (p) {
          return '<li class="xext-k-plan-i"><div class="xext-k-plan-h">'
            + '<strong>' + E(p.title) + '</strong>'
            + '<span class="xext-k-plan-meta">工作量 ' + E(p.effort) + ' · 预期提升约 '
            + p.gain + ' 分</span></div>' +
            '<div class="xext-k-plan-a">' + E(p.action) + '</div>' +
            (p.plain ? '<div class="xext-k-fitem-plain"><strong>大白话：</strong>'
              + E(p.plain) + '</div>' : '') +
            '<div class="xext-k-plan-w">理由：' + E(p.why) + '</div>'
            + planMarkLine(p, a) + '</li>';
        }).join('') + '</ol>'
        : '<p class="xext-note">当前没有需要优先处理的问题。</p>') +

      /* 7 罗盘 + 方位文化 */
      (houseState.showCulture
        ? '<h4 class="xext-k-h">宅向校准 · 二十四山</h4>' +
          '<div class="xext-k-compass">' + global.HouseScanUI.compass(a, { size: 260 }) + '</div>' +
          '<p class="xext-note">坐' + E(a.seat.dir) + '向' + E(a.facing) +
          '（' + a.facingAngle.toFixed(1) + '°）。' +
          (a.yearly ? E(a.yearly.note) : '') + '</p>'
        : '') +

      /* 8 八字叠加说明 · 9 家具布局 · 10 挂画摆件 */
      baziHtml() + furnitureHtml() + decorHtml() +

      '<p class="xext-lim" style="margin-top:18px">' + E(a.boundary) + '</p>';

    bindMap($('#xext-k-map', host), a);
    bindIssueJump(host);
    bindEdit(root, a);
  }

  var SIDE_CN = { N: '北墙', S: '南墙', E: '东墙', W: '西墙' };

  /* 整改建议关联到图上第几号标记：报告与图必须能互相定位，
     否则「采光弱」这三个字和图上那个圈永远对不上。 */
  function planMarkLine(p, a) {
    if (!p.mark || !p.issueId) return '';
    var idx = -1;
    (a.issues || []).forEach(function (x, i) { if (x.id === p.issueId) idx = i; });
    if (idx < 0) return '';
    return '<div class="xext-k-plan-w">图上位置：第 ' + (idx + 1)
      + ' 个标记处（点问题清单里对应那条可定位）</div>';
  }

  /* 八字叠加状态：必须明说「有没有叠、叠了什么」，
     否则用户分不清家具建议到底是几何来的还是八字来的。 */
  function baziHtml() {
    var bz = houseState.bazi;
    if (!bz) {
      return '<div class="xext-k-advice"><div class="xext-k-advice-h">'
        + '家具与摆件建议：未叠加五行</div>'
        + '<div class="xext-k-fitem-plain">当前所有家具建议都是纯几何结论 —— '
        + '床头不压窗、灶台不冲门、书桌不背光这些，谁都能自己量一遍复核。'
        + '在上面的「出生年月日」里填上日期并点「测算八字」，'
        + '会额外给出摆位朝向的五行建议（只管朝向，不管吉凶）。</div></div>';
    }
    var sc = bz.wuxingStat && bz.wuxingStat.score ? bz.wuxingStat.score : null;
    var ys = bz.yongshen || {};
    var parts = [];
    if (sc) {
      parts.push('五行分布 ' + ['木', '火', '土', '金', '水'].map(function (k) {
        return k + ' ' + (sc[k] === undefined ? '—' : sc[k]);
      }).join(' · '));
    }
    if (ys['用神']) parts.push('用神 ' + ys['用神']);
    if (ys['喜神']) parts.push('喜神 ' + ys['喜神']);
    if (bz.strength && bz.strength.level) parts.push('身强弱 ' + bz.strength.level);
    return '<div class="xext-k-advice"><div class="xext-k-advice-h">'
      + '家具与摆件建议：已叠加五行</div>'
      + '<div class="xext-k-fitem-plain">' + E(parts.join(' · ') || '已算出八字') + '</div>'
      + '<div class="xext-k-fitem-plain">五行在这里<b>只用于决定家具摆放在哪个朝向更合适</b>，'
      + '不参与任何吉凶判断，也不据此断言宅居吉凶、人丁祸福。'
      + '几何部分（面积、采光、通风、动线）始终由坐标实算，与八字无关。</div></div>';
  }

  function furnitureHtml() {
    var list = houseState.furniture || [];
    if (!list.length) return '';
    return '<h4 class="xext-k-h">家具怎么摆（含落位与朝向）</h4>'
      + '<p class="xext-k-scale-hint">「朝向」指的是**人面向哪边**，'
      + '与上面「贴哪面墙」正好相反：贴东墙睡下时人是朝西的。</p>'

      + list.map(function (f) {
        return '<div class="xext-k-fitem"><div class="xext-k-fitem-h">'
          + '<strong>' + E(f.item || '') + '</strong>'
          + '<span class="xext-k-fitem-where">' + E(f.where || '')
          + (f.facing ? ' · 朝' + E(f.facing) : '')
          + (f.color ? ' · ' + E(f.color) : '') + '</span></div>'
          + '<div class="xext-k-fitem-plain">' + E(f.plain || '') + '</div>'
          + (f.basis ? '<div class="xext-k-fitem-b">依据：' + E(f.basis) + '</div>' : '')
          + '</div>';
      }).join('');
  }

  function decorHtml() {
    var list = houseState.decor || [];
    if (!list.length) return '';
    return '<h4 class="xext-k-h">挂画与摆件：放在哪、放什么</h4>'
      + '<p class="xext-k-scale-hint">勾选上面的「挂画摆件」图层可在图上看到菱形标记。</p>'
      + '<div class="xext-k-decor-grid">' + list.map(function (d) {
        return '<div class="xext-k-fitem"><div class="xext-k-fitem-h">'
          + '<strong>' + E(d.what || '') + '</strong>'
          + '<span class="xext-k-fitem-where">' + E(d.roomName || '')
          + ' · ' + E(d.where || '') + '</span></div>'
          + '<div class="xext-k-fitem-plain">' + E(d.plain || '') + '</div>'
          + (d.basis ? '<div class="xext-k-fitem-b">依据：' + E(d.basis) + '</div>' : '')
          + '</div>';
      }).join('') + '</div>';
  }

  /* 点问题清单 → 高亮图上对应标记。 */
  function bindIssueJump(host) {
    var svg = host.querySelector('#xext-k-map svg');
    Array.prototype.forEach.call(host.querySelectorAll('[data-issue-row]'), function (row) {
      var id = row.getAttribute('data-issue-row');
      function jump() {
        Array.prototype.forEach.call(host.querySelectorAll('[data-issue-row]'), function (x) {
          x.classList.remove('xext-k-issue-on');
        });
        row.classList.add('xext-k-issue-on');
        if (!svg) return;
        var g = svg.querySelector('[data-issue="' + id + '"]');
        if (!g) return;
        var c = g.querySelector('circle[tabindex]');
        if (!c) return;
        try { c.focus(); } catch (e) { /* 环境不支持 */ }
        if (c.scrollIntoView) c.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      row.addEventListener('click', jump);
      row.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); jump(); }
      });
    });
  }

  /* 图上拖拽房间边界：识别难免有偏差，让人一眼能改是可用性的关键。 */
  function bindMap(host, a) {
    var svg = host && host.querySelector('svg');
    if (!svg) return;
    var pad = 108;
    var scale = Math.min(
      (svg.viewBox.baseVal.width - pad * 2) / a.width,
      (svg.viewBox.baseVal.height - pad * 2) / a.depth);
    if (!(scale > 0)) return;

    svg.addEventListener('pointerdown', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-room]') : null;
      if (!t) return;
      var id = t.getAttribute('data-room');
      var r = houseState.rooms.filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      houseState.picked = r;
      var rect = svg.getBoundingClientRect();
      var vb = svg.viewBox.baseVal;
      var sx = vb.height / rect.height;
      var px = (ev.clientX - rect.left) * sx;
      var py = (ev.clientY - rect.top) * sx;
      houseState.drag = {
        id: id, offX: r.x - (px - pad) / scale,
        offY: r.y - (vb.height - pad - py) / scale,
        rect: rect, svg: svg, vbH: vb.height, moved: false,
        W: a.width, D: a.depth
      };
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* 环境不支持 */ }
      ev.preventDefault();
      bindEdit(planRoot(), a);
    });

    svg.addEventListener('pointermove', function (ev) {
      var dg = houseState.drag;
      if (!dg) return;
      var sx = dg.vbH / dg.rect.height;
      var px = (ev.clientX - dg.rect.left) * sx;
      var py = (ev.clientY - dg.rect.top) * sx;
      var r = houseState.rooms.filter(function (x) { return x.id === dg.id; })[0];
      if (!r) return;
      r.x = clampNum((px - pad) / scale + dg.offX, 0, Math.max(0, dg.W - r.w));
      r.y = clampNum((dg.vbH - pad - py) / scale + dg.offY, 0, Math.max(0, dg.D - r.h));
      dg.moved = true;
      var node = dg.svg.querySelector('[data-room="' + dg.id + '"]');
      if (node) {
        node.setAttribute('x', (pad + r.x * scale).toFixed(2));
        node.setAttribute('y', (dg.vbH - pad - (r.y + r.h) * scale).toFixed(2));
      }
    });

    var end = function (ev) {
      var dg = houseState.drag;
      if (!dg) return;
      houseState.drag = null;
      try { dg.svg.releasePointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
      /* 松手才算一次：拖拽过程中重绘会销毁 SVG 节点，坐标会跳回去 */
      if (dg.moved) recomputeAll();
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
  }

  function bindEdit(root, a) {
    var host = $('#xext-k-edit', root);
    if (!host) return;
    var p = houseState.picked;
    if (!p) {
      host.innerHTML = '<span class="xext-note">在图上拖动房间可改边界；'
        + '点选一个房间可在此精调位置、尺寸与类型。</span>';
      return;
    }
    var num = function (k, label, min, max) {
      return '<label class="xext-field" style="flex:0 0 100px">' + label +
        '<input class="input" data-xk="' + k + '" type="number" step="0.1" min="' + min +
        '" max="' + max + '" value="' + Number(p[k]).toFixed(1) + '" aria-label="' + label + '"></label>';
    };
    host.innerHTML = '<span class="xext-note">正在调整：<strong>' + E(p.name) + '</strong></span>' +
      num('x', '横向位置', 0, 40) + num('y', '纵向位置', 0, 40) +
      num('w', '开间宽', 0.3, 40) + num('h', '进深厚', 0.3, 40) +
      '<input class="input" data-xk="name" type="text" value="' + E(p.name) +
      '" style="flex:0 0 108px" aria-label="空间名称">' +
      '<select class="input" data-xk="kind" aria-label="空间类型" style="flex:0 0 124px">' +
      Object.keys(KIND_CN).map(function (k) {
        return '<option value="' + k + '"' + (p.kind === k ? ' selected' : '') + '>' + KIND_CN[k] + '</option>';
      }).join('') + '</select>' +
      '<button type="button" class="btn-ghost" id="xext-k-del">删除该空间</button>';
    Array.prototype.forEach.call(host.querySelectorAll('[data-xk]'), function (el) {
      el.addEventListener('change', function () {
        var k = el.getAttribute('data-xk');
        if (k === 'kind' || k === 'name') p[k] = el.value;
        else p[k] = Number(el.value);
        if (k === 'name') p.name = el.value;
        recomputeAll();
      });
    });
    var del = $('#xext-k-del', host);
    if (del) del.addEventListener('click', function () {
      houseState.rooms = houseState.rooms.filter(function (x) { return x.id !== p.id; });
      houseState.picked = null;
      recomputeAll();
    });
    void a;
  }

  /* ---------- 分析主流程 ---------- */

  /* 房间原始坐标。旋转/镜像不写回 houseState.rooms ——
     否则用户把 90° 转回 0° 时会在已转过的数据上再转一次，越转越歪。
     每次都从原图重新变换，这是唯一可靠的做法。 */
  function planInput() {
    var base = {
      width: houseState.width, depth: houseState.depth,
      rooms: houseState.rooms, facing: houseState.facing,
      gender: houseState.gender,
      entry: houseState.entry || undefined,
      year: new Date().getFullYear()
    };
    if (!houseState.rotate && !houseState.mirrorX && !houseState.mirrorY) return base;
    return global.HouseScan.transformPlan(base, {
      rotate: houseState.rotate,
      mirrorX: houseState.mirrorX,
      mirrorY: houseState.mirrorY
    });
  }

  function planRoot() {
    return houseState.panel || (houseState.panel = document.getElementById('xext-entry'));
  }

  /* 门窗识别：只在有真实图纸时跑，示例户型没有像素可扫。 */
  function detectOpenings() {
    if (!houseState.bitmap || !global.HouseScan.findOpenings) {
      houseState.openings = [];
      return houseState.openings;
    }
    try {
      houseState.openings = global.HouseScan.findOpenings({
        width: houseState.bitmap.width,
        height: houseState.bitmap.height,
        data: houseState.bitmap.data,
        ppm: houseState.ppm
      });
    } catch (e) {
      houseState.openings = [];
    }
    return houseState.openings;
  }

  /* 房间功能推断：只在房间还没被用户指定过功能时才补，
     用户手动改过的判断优先于算法的猜测。 */
  function detectKinds() {
    if (!global.HouseScan.inferRoomKinds) return null;
    try {
      houseState.kinds = global.HouseScan.inferRoomKinds({
        width: planInput().width, depth: planInput().depth,
        rooms: houseState.rooms,
        entry: houseState.entry || undefined
      });
    } catch (e) {
      houseState.kinds = null;
    }
    return houseState.kinds;
  }

  /* 出生日期 → 八字。失败或未填一律返回 null，
     下游据此降级为纯几何建议，绝不猜一个八字出来。 */
  function calcBaziOrNull() {
    var b = houseState.birth;
    if (!b || !b.year || !b.month || !b.day) { houseState.bazi = null; return null; }
    if (!global.BaziCore || typeof global.BaziCore.calcBazi !== 'function') {
      houseState.bazi = null;
      return null;
    }
    try {
      houseState.bazi = global.BaziCore.calcBazi({
        year: Number(b.year), month: Number(b.month), day: Number(b.day),
        hour: b.hour === '' || b.hour == null ? 12 : Number(b.hour),
        gender: b.gender || '男'
      }) || null;
    } catch (e) {
      houseState.bazi = null;
    }
    return houseState.bazi;
  }

  function recomputeAll() {
    var root = planRoot();
    if (!root) return false;
    var err = $('#xext-k-err', root);
    try {
      var plan = planInput();
      houseState.analysis = global.HouseScan.analyze(plan);
      /* 第二阶段：门窗、房间功能、八字家具、挂画摆件 */
      detectOpenings();
      detectKinds();
      var bz = calcBaziOrNull();
      try {
        houseState.furniture = global.HouseScan.furniturePlan(houseState.analysis, bz) || [];
      } catch (e) { houseState.furniture = []; }
      try {
        houseState.decor = global.HouseScan.decorPlan(houseState.analysis, bz) || [];
      } catch (e) { houseState.decor = []; }
      if (err) { err.style.display = 'none'; }
    } catch (e) {
      if (err) {
        err.style.display = '';
        err.textContent = '未能完成分析：' + (e && e.message ? e.message : String(e));
      }
      /* 失败时把旧结论清掉并重画：留着上一次的成绩单，
         会让人以为这次识别成功了 —— 那是这类工具最伤人的一种错。 */
      houseState.analysis = null;
      houseState.furniture = null;
      houseState.decor = null;
      drawBody(root);
      return false;
    }
    drawBody(root);
    return true;
  }

  function rerender() {
    var root = planRoot();
    if (root) drawBody(root);
  }

  function bindHouse(root) {
    /* 记下当前面板节点：上传图纸后控件区要整体重挂，
       mount() 之后拿不到 panel 的引用，只能在这里存一份。 */
    houseState.panel = root;
    /* ---- 上传与拖拽 ---- */
    var drop = $('#xext-k-drop', root);
    var file = $('#xext-k-file', root);

    function handle(f) {
      var err = $('#xext-k-err', root);
      err.style.display = 'none';
      err.textContent = '正在读取图纸…';
      readBitmap(f).then(function (bmp) {
        err.style.display = 'none';
        houseState.bitmap = bmp;
        var fr = new FileReader();
        fr.onload = function () { houseState.thumb = String(fr.result); };
        fr.readAsDataURL(f);
        /* 比例尺缺省按「整图约 12 米宽」估，并标为估算；
           用户量一段已知尺寸线后改这个值，所有面积随之等比缩放。 */
        houseState.ppm = +(bmp.width / 12).toFixed(2);
        recognize();
        refreshPanel();
      }).catch(function (e) {
        err.style.display = '';
        err.textContent = (e && e.message) ? e.message : String(e);
      });
    }

    if (file) {
      file.addEventListener('change', function () {
        if (file.files && file.files[0]) handle(file.files[0]);
      });
    }
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (t) {
        drop.addEventListener(t, function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          drop.classList.add('xext-k-drop-on');
        });
      });
      ['dragleave', 'drop'].forEach(function (t) {
        drop.addEventListener(t, function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          drop.classList.remove('xext-k-drop-on');
        });
      });
      drop.addEventListener('drop', function (ev) {
        var dt = ev.dataTransfer;
        if (!dt) return;
        var f = dt.files && dt.files[0];
        if (f) handle(f);
        else {
          var err = $('#xext-k-err', root);
          err.style.display = '';
          err.textContent = '没有从这次拖放里读到文件。'
            + '有些应用只支持从浏览器地址栏拖链接，图片请先下载到本地再拖进来。';
        }
      });
    }

    /* ---- 识别 ---- */
    function recognize() {
      var err = $('#xext-k-err', root);
      try {
        var r = global.HouseScan.inspect({
          width: houseState.bitmap.width,
          height: houseState.bitmap.height,
          data: houseState.bitmap.data,
          ppm: houseState.ppm,
          facing: houseState.facing,
          gender: houseState.gender
        });
        houseState.inspect = r;
        if (r.warning) {
          /* 识别不出来就如实说，并把warning 原样透出，
             绝不能摆一张空图装作「没发现问题」。 */
          err.style.display = '';
          err.textContent = r.warning;
        } else {
          err.style.display = 'none';
        }
        houseState.width = r.width;
        houseState.depth = r.depth;
        houseState.rooms = r.rooms.map(function (x) {
          return {
            id: x.id, name: x.name, kind: x.kind,
            x: x.x, y: x.y, w: x.w, h: x.h,
            detected: true, fill: x.fill
          };
        });
        houseState.picked = null;
      } catch (e) {
        houseState.inspect = null;
        err.style.display = '';
        err.textContent = '自动识别失败：' + (e && e.message ? e.message : String(e))
          + ' 你仍然可以用下方示例户型，或手动补录房间。';
      }
    }

    /* ---- 比例尺 / 朝向 / 重新识别 ---- */
    var ppmEl = $('#xext-k-ppm', root);
    if (ppmEl) ppmEl.addEventListener('change', function () {
      var v = Number(ppmEl.value);
      if (!(v > 0)) { ppmEl.value = houseState.ppm; return; }
      var k = v / houseState.ppm;
      houseState.ppm = v;
      if (houseState.bitmap) {
        /* 换比例尺 = 整户等比缩放，房间之间的比例关系不变 */
        houseState.width *= k; houseState.depth *= k;
        houseState.rooms.forEach(function (r) {
          r.x *= k; r.y *= k; r.w *= k; r.h *= k;
        });
        recognize();
      }
      refreshPanel();
    });
    ['#xext-k-f', '#xext-k-g'].forEach(function (sel) {
      var el = $(sel, root);
      if (!el) return;
      el.addEventListener('change', function () {
        houseState.facing = $('#xext-k-f', root).value;
        houseState.gender = $('#xext-k-g', root).value;
        recomputeAll();
      });
    });
    var cb = $('#xext-k-c', root);
    if (cb) cb.addEventListener('change', function () {
      houseState.showCulture = cb.checked;
      rerender();
    });
    var rr = $('#xext-k-rerun', root);
    /* 没有图纸时「重新识别」没有对象可识别，如实说明，
       不能点了以后什么都不发生 —— 那是让人以为按钮坏了。 */
    if (rr) rr.addEventListener('click', function () {
      if (!houseState.bitmap) {
        var e0 = $('#xext-k-err', root);
        e0.style.display = '';
        e0.textContent = '当前是示例户型，没有图纸可以重新识别。'
          + '把户型图拖进来，或点右上角选择文件，再点这个按钮。';
        return;
      }
      recognize(); refreshPanel();
    });
    /* ---- 图纸旋转 / 镜像 / 缩放 ----
       只接受 90° 的整数倍（select 里就只给了这四个），
       缩放只改「图纸尺寸」这一层的显示比例，不动房间坐标 ——
       房间坐标是识别结果的实算值，拿它乘一个装饰性倍数就毁了。 */
    var rotEl = $('#xext-k-rot', root);
    if (rotEl) rotEl.addEventListener('change', function () {
      houseState.rotate = Number(rotEl.value) || 0;
      recomputeAll();
    });
    var mxEl = $('#xext-k-mx', root);
    if (mxEl) mxEl.addEventListener('change', function () {
      houseState.mirrorX = mxEl.checked; recomputeAll();
    });
    var myEl = $('#xext-k-my', root);
    if (myEl) myEl.addEventListener('change', function () {
      houseState.mirrorY = myEl.checked; recomputeAll();
    });
    var scEl = $('#xext-k-sc', root);
    if (scEl) scEl.addEventListener('change', function () {
      var v = Number(scEl.value);
      if (!(v > 0)) { scEl.value = '1'; return; }
      /* 缩放只作用于查看：把图纸尺寸整体乘一次，房间等比跟着动，
         面积同比变化 —— 这跟调比例尺是同一件事，两个入口给出同一个结果。 */
      var k = v / (Number(scEl.dataset.applied) || 1);
      if (!(k > 0)) { scEl.dataset.applied = '1'; return; }
      scEl.dataset.applied = String(v);
      houseState.width *= k; houseState.depth *= k;
      houseState.rooms.forEach(function (r) {
        r.x *= k; r.y *= k; r.w *= k; r.h *= k;
      });
      if (houseState.entry) { houseState.entry.x *= k; houseState.entry.y *= k; }
      recomputeAll();
    });
    var rsEl = $('#xext-k-reset', root);
    if (rsEl) rsEl.addEventListener('click', function () {
      houseState.rotate = 0;
      houseState.mirrorX = false; houseState.mirrorY = false;
      var e = $('#xext-k-sc', root);
      if (e) { e.value = '1'; e.dataset.applied = '1'; }
      refreshPanel();
    });

    /* ---- 出生日期 → 八字 ---- */
    var bdEl = $('#xext-k-birth', root);
    if (bdEl) bdEl.addEventListener('change', function () {
      var v = String(bdEl.value || '');
      var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
      if (!m) {
        houseState.birth.year = ''; houseState.birth.month = ''; houseState.birth.day = '';
      } else {
        houseState.birth.year = m[1];
        houseState.birth.month = Number(m[2]);
        houseState.birth.day = Number(m[3]);
      }
      var h = $('#xext-k-hour', root);
      if (h) houseState.birth.hour = h.value === '' ? '' : Number(h.value);
      var g = $('#xext-k-bg', root);
      if (g) houseState.birth.gender = g.value;
      calcBaziOrNull();
      recomputeAll();
    });
    ['#xext-k-hour', '#xext-k-bg'].forEach(function (sel) {
      var el = $(sel, root);
      if (!el) return;
      el.addEventListener('change', function () {
        houseState.birth.hour = el.value === '' ? '' : Number(el.value);
        if (sel === '#xext-k-bg') houseState.birth.gender = el.value;
        calcBaziOrNull();
        recomputeAll();
      });
    });
    var bzEl = $('#xext-k-bazi', root);
    if (bzEl) bzEl.addEventListener('click', function () {
      var e = $('#xext-k-err', root);
      var b = houseState.birth;
      if (!b.year || !b.month || !b.day) {
        if (e) {
          e.style.display = '';
          e.textContent = '先填出生年月日再测算。'
            + '不填也能用：家具建议会自动降级为纯几何建议。';
        }
        return;
      }
      var bz = calcBaziOrNull();
      if (!bz) {
        if (e) {
          e.style.display = '';
          e.textContent = '这个日期没能算出八字（可能超出算法支持的年份范围）。'
            + '其余功能不受影响，家具建议按纯几何给出。';
        }
        return;
      }
      if (e) { e.style.display = 'none'; }
      recomputeAll();
    });

    /* ---- 图层开关 ---- */
    [['#xext-k-base', 'showBase'], ['#xext-k-mark', 'showMark'],
      ['#xext-k-fur', 'showFurniture'], ['#xext-k-dec', 'showDecor']]
      .forEach(function (pair) {
        var el = $(pair[0], root);
        if (!el) return;
        el.addEventListener('change', function () {
          houseState[pair[1]] = el.checked;
          rerender();
        });
      });

    var sp = $('#xext-k-sample', root);
    if (sp) sp.addEventListener('click', function () {
      houseState.source = 'sample';
      houseState.width = 9; houseState.depth = 8;
      houseState.facing = 'S';
      houseState.picked = null; houseState.entry = null;
      houseState.rooms = SAMPLE_ROOMS.slice();
      refreshPanel();
    });

    /* 首次进入只需算一次。**不能**在这里调 refreshPanel()：
       refreshPanel 会重挂面板并再次调用 bindHouse，那就成了自己调自己的死循环
       （表现为一进入页面就爆栈）。 */
    recomputeAll();
  }

  /* 面板结构随「有没有图纸」变化，统一按 mountPanel 的方式整体重挂一次 */
  function refreshPanel() {
    var panel = planRoot();
    if (!panel) return;
    panel.innerHTML = housePanel();
    bindHouse(panel);
    recomputeAll();
  }


  function clampNum(v, lo, hi) {
    if (!Number.isFinite(v)) return lo;
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /* ============================================================ 形貌观察室
   *
   * 两个子工具共用一套边界（E(global.Morpheme.BOUNDARY)）：
   * 面相部分只做术语与文献流变的文化标注，掌纹部分只做走向/长度/折角的形态量化。
   * 不做照片识别、不做自动命相鉴定、不据形貌推断性格命运。
   */

  var morphState = {
    sub: 'face',
    zone: 'brow',
    q: '',
    /* 掌纹端点坐标（归一）。初值取自 Palm.lines() 的定义，
       用户拖动端点后只改这里，重新量化时再走一遍 Palm.describe。 */
    palm: {
      size: 1,
      lines: {
        life: { from: [0.16, 0.94], to: [0.74, 0.16], bend: 0.12, depth: 1 },
        head: { from: [0.18, 0.72], to: [0.80, 0.42], bend: -0.10, depth: 1 },
        heart: { from: [0.28, 0.62], to: [0.78, 0.30], bend: 0.08, depth: 1 },
        fate: { from: [0.62, 0.06], to: [0.66, 0.90], bend: 0.04, depth: 1 }
      }
    }
  };

  function morphPanel() {
    var s = global.Morpheme.stats();
    return '' +
      '<p class="xext-note">两块内容：<strong>面相术语文化馆</strong>把古文献里的部位名、' +
      '描述词与各家分歧如实列出；<strong>掌纹形态记录</strong>把你给的纹路端点算成' +
      '走向角、长度比与折角。二者都只做记录与文化标注，不出断语。</p>' +
      '<div class="xext-row" style="margin:12px 0">' +
      '<button type="button" class="btn-ghost" data-msub="face"' +
      (morphState.sub === 'face' ? ' style="border-color:#f0c14b"' : '') + '>面相术语文化馆</button>' +
      '<button type="button" class="btn-ghost" data-msub="palm"' +
      (morphState.sub === 'palm' ? ' style="border-color:#f0c14b"' : '') + '>掌纹形态记录</button>' +
      '<span class="xext-note" style="margin-left:8px">已收录 ' + s.zones + ' 个部位、'
      + s.terms + ' 条术语，其中 ' + s.disputed + ' 条存在流派分歧，共比对 ' + s.schools + ' 处文献口径。</span>' +
      '</div>' +
      '<div id="xm-body"></div>' +
      '<p class="xext-lim" style="margin-top:18px">' + E(global.Morpheme.BOUNDARY) + '</p>';
  }

  function bindMorph(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-msub]'), function (btn) {
      btn.addEventListener('click', function () {
        morphState.sub = btn.getAttribute('data-msub');
        /* 子页切换走重挂载：panel 的 innerHTML 会被整体重建，
           内部状态一律从 morphState 重新读，不依赖上一次的 DOM。 */
        global.ExploreEntry.mount(root, 'morph');
      });
    });
    var body = $('#xm-body', root);
    if (morphState.sub === 'face') bindFaceSub(body, root);
    else bindPalmSub(body, root);
  }

  /* ---------- 面相术语文化馆 ---------- */

  function bindFaceSub(body, root) {
    var q = morphState.q;
    var zones = q ? global.Morpheme.search(q) : global.Morpheme.zones();
    /* 检索后若当前选中部位不在命中范围内，详情区要跟着换成第一个命中项——
       否则会显示「命中 1 个部位」但详情仍是上一个部位，读起来像坏了。 */
    var sel = global.Morpheme.byKey(morphState.zone);
    if (!sel || !zones.some(function (z) { return z.key === sel.key; })) {
      sel = zones[0] || null;
      morphState.zone = sel ? sel.key : morphState.zone;
    }

    body.innerHTML = '' +
      '<div class="xext-row" style="margin:10px 0">' +
      '<label class="xext-field" style="flex:1 1 200px">检索部位或术语' +
      '<input class="input" id="xm-q" type="search" value="' + E(q) + '" ' +
      'placeholder="如：印堂 / 连眉 / 耳高于眉" aria-label="检索部位或术语"></label>' +
      '<span class="xext-note">命中 ' + zones.length + ' 个部位</span>' +
      '</div>' +
      '<div id="xm-face"></div>' +
      '<div id="xm-zone"></div>';

    var w = Math.max(300, Math.min(460, (root.clientWidth || 720) * 0.5));
    var fhost = $('#xm-face', body);
    fhost.innerHTML = global.MorphemeUI.face(global.Morpheme.zones(), {
      width: w, height: Math.round(w * 1.22), picked: morphState.zone
    });
    bindFacePick(fhost, root);

    $('#xm-q', body).addEventListener('input', function (ev) {
      morphState.q = ev.target.value;
      bindMorph(root);
      var inp = $('#xm-q', root);
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    });

    $('#xm-zone', body).innerHTML = zoneHtml(sel);
  }

  function zoneHtml(z) {
    if (!z) return '<p class="xext-note">没有匹配的部位。</p>';
    return '<h4 style="color:#eed5a0;margin:18px 0 6px">' + E(z.name) + '</h4>'
      + '<p class="xext-note">出处：' + E(z.origin) + '</p>'
      + '<p class="xext-note" style="margin-top:4px">' + E(z.note) + '</p>'
      + '<table class="xext-table" style="margin-top:10px"><thead><tr><th>术语</th><th>白话解释</th>'
      + '<th>文献口径</th></tr></thead><tbody>'
      + z.terms.map(function (t) {
        return '<tr><td>' + E(t.term) + '</td><td>' + E(t.explain) + '</td><td>'
          + (t.schools.length ? t.schools.map(function (sc) {
            return '<div style="margin-bottom:4px"><strong>' + E(sc.name) + '</strong>'
              + '<span class="xext-lim">（' + E(sc.source) + '）</span>：' + E(sc.view) + '</div>';
          }).join('') : '<span class="xext-note">各家口径一致。</span>')
          + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* 面部部位点选：点框切到该部位的术语表，并重画图以高亮选中项 */
  function bindFacePick(host, root) {
    Array.prototype.forEach.call(host.querySelectorAll('[data-zone]'), function (node) {
      var pick = function () {
        morphState.zone = node.getAttribute('data-zone');
        /* 整图重画而不是只改这一个框的描边：选中态同时影响
           填充、描边宽度、引线与标签颜色，逐处手工回改容易漏掉一处，
           结果就是「框亮了但标签还是灰的」这种半高亮。 */
        var w = Math.max(300, Math.min(460, (root.clientWidth || 720) * 0.5));
        host.innerHTML = global.MorphemeUI.face(global.Morpheme.zones(), {
          width: w, height: Math.round(w * 1.22), picked: morphState.zone
        });
        bindFacePick(host, root);
        var zh = root.querySelector('#xm-zone');
        if (zh) zh.innerHTML = zoneHtml(global.Morpheme.byKey(morphState.zone));
      };
      node.addEventListener('click', pick);
      node.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); }
      });
    });
  }

  /* ---------- 掌纹形态记录 ---------- */

  function bindPalmSub(body, root) {
    body.innerHTML = '' +
      '<div class="xext-row" style="margin:10px 0" id="xm-ctrl"></div>' +
      '<div id="xm-palm"></div>' +
      '<div id="xm-palm-metrics"></div>' +
      '<div id="xm-palm-notes"></div>';

    var ctrl = $('#xm-ctrl', body);
    var keys = ['life', 'head', 'heart', 'fate'];
    var names = {};
    global.Palm.lines().forEach(function (l) { names[l.key] = l.name; });
    ctrl.innerHTML = keys.map(function (k) {
      return '<label class="xext-field" style="flex:0 0 128px">' + E(names[k]) + '弯曲'
        + '<input class="input" type="range" data-bend="' + k + '" min="-0.4" max="0.4" step="0.02" '
        + 'value="' + morphState.palm.lines[k].bend + '" aria-label="' + E(names[k]) + '弯曲度"></label>';
    }).join('')
      + '<button type="button" class="btn-ghost" id="xm-preset">恢复示例纹路</button>'
      + '<span class="xext-note">拖动图上两端圆点可直接改端点坐标。</span>';

    Array.prototype.forEach.call(ctrl.querySelectorAll('[data-bend]'), function (el) {
      el.addEventListener('input', function () {
        morphState.palm.lines[el.getAttribute('data-bend')].bend = Number(el.value);
        drawPalm(body, root);
      });
    });
    $('#xm-preset', ctrl).addEventListener('click', function () {
      morphState.palm = JSON.parse(JSON.stringify(defaultPalmLines()));
      bindMorph(root);
    });

    drawPalm(body, root);
  }

  function defaultPalmLines() {
    return {
      size: 1,
      lines: {
        life: { from: [0.16, 0.94], to: [0.74, 0.16], bend: 0.12, depth: 1 },
        head: { from: [0.18, 0.72], to: [0.80, 0.42], bend: -0.10, depth: 1 },
        heart: { from: [0.28, 0.62], to: [0.78, 0.30], bend: 0.08, depth: 1 },
        fate: { from: [0.62, 0.06], to: [0.66, 0.90], bend: 0.04, depth: 1 }
      }
    };
  }

  function drawPalm(body, root) {
    var host = $('#xm-palm', body);
    var w = Math.max(300, Math.min(460, (root.clientWidth || 720) * 0.5));
    var hh = Math.round(w * 1.24);
    var desc;
    try {
      desc = global.Palm.describe(morphState.palm);
    } catch (e) {
      host.innerHTML = '<p class="xext-lim">未能完成量化：' + E(e && e.message ? e.message : String(e)) + '</p>';
      $('#xm-palm-metrics', body).innerHTML = '';
      $('#xm-palm-notes', body).innerHTML = '';
      return;
    }
    host.innerHTML = global.MorphemeUI.palm(desc, { width: w, height: hh });
    bindPalmDrag(host, desc, body, root);

    $('#xm-palm-metrics', body).innerHTML =
      '<h4 style="color:#eed5a0;margin:18px 0 6px">量化结果（实算，可自行复核）</h4>'
      + '<table class="xext-table"><thead><tr><th>纹路</th><th>度量</th><th>数值</th>'
      + '<th>计算依据</th></tr></thead><tbody>'
      + desc.metrics.map(function (m) {
        return '<tr><td>' + E(m.line) + '</td><td>' + E(m.label) + '</td>'
          + '<td>' + m.value.toFixed(3) + ' ' + E(m.unit) + '</td>'
          + '<td class="xext-lim">' + E(m.basis) + '</td></tr>';
      }).join('') + '</tbody></table>';

    $('#xm-palm-notes', body).innerHTML = '<ul class="xext-list">'
      + desc.notes.map(function (nt) { return '<li>' + E(nt.text) + '</li>'; }).join('')
      + '</ul>';
  }

  /* 端点拖拽：与户型拖拽同一套教训——
     move 里只改数据 + 直接改当前圆点坐标，pointerup 才重新量化重绘。
     每次 move 都重绘会重建 innerHTML，新节点与 rect/scale 全部失效。 */
  function bindPalmDrag(host, desc, body, root) {
    var W = Math.max(300, Math.min(460, (root.clientWidth || 720) * 0.5));
    var pad = 56;
    var iw = W - pad * 2, ih = (Math.round(W * 1.24)) - pad * 2;
    var drag = null;

    function ptOf(L, i) {
      var p = i === 0 ? L.from : L.to;
      return { x: pad + p[0] * iw, y: pad + p[1] * ih };
    }

    host.querySelectorAll('[data-palm-line]').forEach(function (g) {
      var key = g.getAttribute('data-palm-line');
      g.querySelectorAll('circle').forEach(function (c, idx) {
        c.setAttribute('data-drag-handle', '1');
        c.setAttribute('data-drag-line', key);
        c.setAttribute('data-drag-end', idx === 0 ? 'from' : 'to');
        c.setAttribute('style', 'cursor:grab');
        c.addEventListener('pointerdown', function (ev) {
          ev.preventDefault();
          c.setPointerCapture(ev.pointerId);
          drag = { line: key, end: c.getAttribute('data-drag-end'), node: c };
        });
      });
    });

    host.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var svg = host.querySelector('svg');
      var r = svg.getBoundingClientRect();
      var sx = (Math.round(W * 1.24)) / r.height;
      var px = (ev.clientX - r.left) * sx, py = (ev.clientY - r.top) * sx;
      var nx = clampNum((px - pad) / iw, 0.02, 0.98);
      var ny = clampNum((py - pad) / ih, 0.02, 0.98);
      morphState.palm.lines[drag.line][drag.end] = [Number(nx.toFixed(4)), Number(ny.toFixed(4))];
      drag.node.setAttribute('cx', (pad + nx * iw).toFixed(2));
      drag.node.setAttribute('cy', (pad + ny * ih).toFixed(2));
    });
    host.addEventListener('pointerup', function () {
      if (!drag) return;
      drag = null;
      drawPalm(body, root);
    });
    void desc;
  }

  /* ============================================================ 区块装配 */

  var TABS = [
    { key: 'tarot', label: '隔空牌桌 · 塔罗', render: tarotPanel, bind: bindTarot },
    { key: 'xiu', label: '星空剧场 · 二十八宿', render: xiuPanel, bind: bindXiu },
    { key: 'chart', label: '本命盘 · 紫微斗数', render: chartPanel, bind: bindChart },
    { key: 'house', label: '勘宅神器', render: housePanel, bind: bindHouse },
    { key: 'morph', label: '形貌观察室 · 面相掌纹', render: morphPanel, bind: bindMorph },
    { key: 'naming', label: '起名工坊', render: namingPanel, bind: bindNaming },
    { key: 'playbook', label: '复盘与记忆点玩法', render: playbookPanel, bind: bindPlaybook }
  ];

  function plannedNotice() {
    var list = Reg.planned();
    if (!list.length) return '';
    return '<div class="xext-lim" style="margin-top:14px">' +
      '<strong>后续阶段（尚未实现，不提供界面）</strong>' +
      '<ul class="xext-list">' + list.map(function (m) {
        return '<li>第 ' + E(m.phase || '后续') + ' 阶段 · ' + E(m.title) + '：' + E(m.note || '规划中') + '</li>';
      }).join('') + '</ul></div>';
  }

  function sectionHtml() {
    return '<section class="card wide-card xext" id="xext-entry">' +
      '<div class="xext-head"><div><h3>互动扩展 · 第一阶段</h3>' +
      '<p>以下能力全部位于本页之内，不新增菜单，也不改动原有典籍阅读与算法工具。' +
      '所有结论都标注依据与边界，依据不足时直接写"未判断"。</p></div></div>' +
      '<div class="xext-tabs" role="tablist">' +
      TABS.map(function (t, i) {
        return '<button type="button" class="xext-tab" role="tab" data-ext="' + E(t.key) + '" ' +
          'aria-selected="' + (i === 0 ? 'true' : 'false') + '">' + E(t.label) + '</button>';
      }).join('') + '</div>' +
      '<div id="xext-panel" class="xext-panel" role="tabpanel"></div>' +
      plannedNotice() +
      '</section>';
  }

  function mountPanel(panel, key) {
    /* 面板节点可能已经不在（例如扩展区被整段重绘过）。
       此时如实跳过而不是对 null 赋 innerHTML——
       崩在这里会连带打断页面上其他模块的初始化。 */
    if (!panel) return;
    var tab = TABS.filter(function (t) { return t.key === key; })[0] || TABS[0];
    /* 面板重挂载时界面回到初始态，同时清掉上一轮的临时状态，
       避免出现「界面空白但仍认为已抽过牌」的不一致。历史记录仍保留在存档中。 */
    tarotState.lastResultId = null;
    tarotState.currentResult = null;
    panel.innerHTML = tab.render();
    tab.bind(panel);
  }

  /* ============================================================ 挂载：不改路由，只包住既有实现 */

  /* 关键：index.html 里 PAGES 是 `const PAGES = {...}`。
     顶层 const/let 不会挂到 window，因此 window.PAGES 是 undefined；
     同理 function 声明的 bind 会挂到 window，但为了稳妥两者都按「先看全局属性，
     再看作用域链」的方式取。取不到就静默不注入，绝不抛错阻断原有页面。 */
  function hostScope() {
    /* eslint-disable no-new-func */
    try {
      /* 在本脚本的全局作用域里取裸标识符，能同时覆盖 const 与 window 两种情况 */
      return new Function('return (typeof PAGES !== "undefined" ? PAGES : (window.PAGES || null));')();
    } catch (e) {
      return global.PAGES || null;
    }
  }

  /* 挂载策略（两条路径，效果等价，都只在既有 sources 页内部追加）：
     A. 能取到 PAGES 对象时，包住 PAGES.sources，在其返回的 HTML 末尾追加扩展区块。
     B. 取不到时（宿主环境不把全局词法声明暴露给作用域查找），
        改为包装 bind —— 原有页面渲染完 sources 后，把扩展区块直接追加到该区域末尾。
     两条路径都不新增顶级路由、不新增侧栏项，也都不抛错阻断原有功能。 */

  function exposeEntry() {
    global.ExploreEntry = {
      version: 'explore-entry-1.0.0',
      tabs: TABS.map(function (t) { return t.key; }),
      mount: mountPanel,
      unmount: function () {
        var panel = $('#xext-panel');
        if (panel) panel.innerHTML = '';
      }
    };
  }

  function wireTabsAndMount() {
    var tabs = $$('[data-ext]');
    var panel = $('#xext-panel');
    if (!tabs.length || !panel) return;
    tabs.forEach(function (btn) {
      btn.onclick = function () {
        tabs.forEach(function (b) { b.setAttribute('aria-selected', 'false'); });
        btn.setAttribute('aria-selected', 'true');
        mountPanel(panel, btn.dataset.ext);
      };
    });
    var active = tabs.filter(function (b) { return b.getAttribute('aria-selected') === 'true'; })[0];
    mountPanel(panel, active ? active.dataset.ext : TABS[0].key);
  }

  var pages = hostScope();
  var baseSources = pages && pages.sources;
  var mounted = false;

  if (typeof baseSources === 'function') {
    pages.sources = function () {
      var html = baseSources.apply(this, arguments);
      mounted = true;
      return html + sectionHtml();
    };
    /* PAGES 可能是 const，赋回 window 无害；赋一次以保证只有一份实现 */
    global.PAGES = pages;
  } else {
    /* 路径 B：等 bind 时机再把区块追加到既有 sources 内容之后。 */
    console.warn('[ext] 未取到 PAGES 对象，改用 bind 时机追加扩展区块。');
  }

  var baseBind = global.bind;
  if (typeof baseBind === 'function') {
    global.bind = function () {
      baseBind.apply(this, arguments);

      /* 路径 B 补挂：每次 bind 都重新按 DOM 实况判断，而不是靠一次性标志。
         真实页面每次切页都会重渲染整个内容区，扩展区块必须随之重建；
         同时用「页面上已无 .xext」作为幂等条件，避免重复注入。 */
      if (!mounted || !$('.xext')) {
        var legacy = $$('.source-tile, .source-hero, #atlas-zoom');
        if (legacy.length && !$('.xext')) {
          legacy[legacy.length - 1].insertAdjacentHTML('afterend', sectionHtml());
          mounted = true;
        } else if (mounted) {
          /* 内容区已被重渲染且当前页不是书籍与工具页：复位标志，
             等用户切回该页时再补挂。 */
          mounted = false;
        }
      }

      wireTabsAndMount();
    };
  } else {
    console.warn('[ext] 未找到既有 bind 实现，扩展区块不会自动挂载交互。');
  }

  exposeEntry();

  /* 模块卸载时释放自身资源（当前各模块无常驻资源，dispose 为安全空实现） */
  global.ExploreEntry = {
    version: 'explore-entry-1.0.0',
    tabs: TABS.map(function (t) { return t.key; }),
    mount: mountPanel,
    unmount: function () {
      var panel = $('#xext-panel');
      if (panel) panel.innerHTML = '';
    }
  };
})(window);