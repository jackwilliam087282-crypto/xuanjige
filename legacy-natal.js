(function(root){'use strict';let selected=null;
function html(birth) {

  let saved;try{saved=JSON.parse(localStorage.getItem("xjg_cross_latest")||"null");}catch(_){} const qm=birth&&saved?.birthKey===crossBirthKey(birth)?saved.reading?.qimen:null; const model=birth?NatalStars.build(birth,qm):null; const raw=model&&!model.ambiguous?(birth.gender==="女"?((14-model.center)%9+1):model.center):null; const ming=raw===5?(birth.gender==="女"?8:2):raw; const list=dy.getJiuGong(null).map(g=>Object.assign({},g,{isSelf:+g.num===ming})); list.push({gua:"中",num:5,name:"中宫",dir:"中宫",elem:"土",symbol:"·",color:"#d4a853",desc:"九星顺飞的起点，不对应八卦或地理方向。",person:"统筹与平衡",health:"传统取象不用于健康判断。",feng:"核对入中星，不据此作居家改造。",good:"给全局留出协调空间。",goodDo:"分清优先级，再安排资源。",bad:"把所有任务堆在一起。",badDo:"拆分责任，留出缓冲。"});
  const self = list.find(g => g.isSelf);
  const star=model?(()=>{const rows=model.list.map(p=>{const g=list.find(g=>g.gua===p.gua),advice=(p.qimen?"同方位奇门记录："+[p.qimen.star,p.qimen.door,p.qimen.god].filter(Boolean).join(" · ")+"；与出生年星分别计算。":"")+"出生年"+model.year+"，"+model.center+"星入中。"+p.advice+" 星宫关系："+p.relation+"（宫五行"+p.element+"，星五行"+p.starElement+"）。"+p.use+"。"+model.uncertainty;return Object.assign({},g,{xing:p.star,xingColor:g.color,xingType:"出生年九星",xingDesc:p.topic+"；"+p.relation+"，不直接等同吉凶。"+(p.alternateStar?"另一候选："+p.alternateStar:""),level:"参考",advice:{吉:advice,凶:advice,平:advice}})});return{list:rows,best:rows.find(p=>p.gua==="中"),worst:rows.find(p=>p.isSelf)||rows[0],method:model.source,summary:(model.ambiguous?"立春临界，命卦与入中星需确认时刻。":model.year+"年，"+model.center+"星入中。八宅命卦与九星分别计算。")+model.uncertainty};})():null;
  const sel = selected;

  // 洛书九宫格：上南下北。行索引 0/1/2 对应上/中/下排
  const nums = [['4','9','2'], ['3','5','7'], ['8','1','6']];
  const posMap = { '0-0':'巽','0-1':'离','0-2':'坤', '1-0':'震','1-1':'中','1-2':'兑', '2-0':'艮','2-1':'坎','2-2':'乾' };
  const starOf = {};
  if (star) star.list.forEach(o => { starOf[o.num] = o; });

  const cell = (guaName, num) => {
    const g = list.find(x => x.gua === guaName);
    if (!g) return '';
    const st = starOf[num];
    const lv = st ? st.level : '';
    const isSel = sel === g.gua;
    const cls = ['jg-cell'];
    if (g.isSelf) cls.push('jg-self');
    if (lvKind(lv) === 'ji') cls.push('jg-ji');
    else if (lvKind(lv) === 'xiong') cls.push('jg-xiong');
    if (isSel) cls.push('jg-selected');
    return `<div class="${cls.join(' ')}" role="button" tabindex="0" data-legacy-gua="${g.gua}" style="border-color:${g.color}66;background:${g.color}14">
      <span class="jg-num">${num}</span>
      <span class="jg-sym" style="color:${g.color}">${g.symbol}</span>
      <span class="jg-name" style="color:${g.color}">${g.gua}</span>
      ${st ? `<span class="jg-star" style="color:${st.xingColor}">${st.xing}</span>` : ''}
      ${st ? `<span class="jg-lv lv-${lvKind(lv)}">${lvTag(lv)}</span>` : ''}
    </div>`;
  };

  const cells = nums.map((row, ri) => row.map((n, ci) => {
    const g = posMap[`${ri}-${ci}`];

    return cell(g, n);
  }).join('')).join('');

  // 选中宫位（或本命宫）的详解
  const focusName = sel || (self ? self.gua : '中');
  const fg = focusName ? list.find(x => x.gua === focusName) : null;
  const fs = focusName && star ? star.list.find(x => x.gua === focusName) : null;

  const focusBox = fg ? `
  <div class="card focus-card">
    <div class="card-title"><span>${esc(fg.gua)}·${esc(fg.name)}　${esc(fg.dir)}</span><span class="card-title-line"></span></div>
    ${fs ? `<div class="focus-star">
      <span class="fs-xing" style="color:${fs.xingColor}">${esc(fs.xing)}</span>
      <span class="fs-type">${esc(fs.xingType)}</span>
      <span class="fs-lv lv-${lvKind(fs.level)}">${esc(fs.level)}</span>
    </div>
    <div class="fs-desc">${esc(fs.xingDesc)}</div>` : ''}
    <div class="fg-row"><span class="fg-k">卦象</span><span class="fg-v">${esc(fg.desc)}</span></div>
    <div class="fg-row"><span class="fg-k">对应人事</span><span class="fg-v">${esc(fg.person)}</span></div>
    <div class="fg-row"><span class="fg-k">身体取象</span><span class="fg-v">${esc(fg.health)}</span></div>
    <div class="fg-row"><span class="fg-k">居家取象</span><span class="fg-v">${esc(fg.feng)}</span></div>

    <div class="plain-box" style="margin-top:16px">
      <div class="pb-label">这一方的好处 · 怎么变得更好</div>
      <div class="term-item"><span class="term-n">优势</span><span class="term-p">${esc(fg.good)}</span></div>
      <div class="term-item"><span class="term-n">怎么做</span><span class="term-p">${esc(fg.goodDo)}</span></div>
    </div>

    <div class="plain-box" style="margin-top:12px;background:rgba(194,58,46,.07);border-left-color:#c23a2e">
      <div class="pb-label">这一方的短板 · 如何破解</div>
      <div class="term-item"><span class="term-n">短板</span><span class="term-p">${esc(fg.bad)}</span></div>
      <div class="term-item"><span class="term-n">怎么破</span><span class="term-p">${esc(fg.badDo)}</span></div>
    </div>

    ${fs ? `<div class="plain-box" style="margin-top:12px;background:rgba(212,168,83,.07)">
      <div class="pb-label">${esc(fs.xing)}星在此宫的落位建议</div>
      <div class="term-item"><span class="term-n">${lvKind(fs.level)==='ji'?'趋吉':(lvKind(fs.level)==='xiong'?'化解':'守常')}</span><span class="term-p">${esc(fs.advice[lvTag(fs.level)])}</span></div>
    </div>` : ''}
  </div>` : '';

  // 飞星总览表
  const starTable = star ? `
  <div class="card wide-card">
    <div class="card-title"><span>九星飞布总览</span><span class="card-title-line"></span></div>
    <div class="st-method">出生年九星规则：${esc(star.method)}</div>
    <div class="st-row" role="button" tabindex="0" data-legacy-gua="${star.best.gua}">
      <span class="st-tag st-best">入中星</span>
      <span class="st-dir">${esc(star.best.dir)}</span>
      <span class="st-xing" style="color:${star.best.xingColor}">${esc(star.best.xing)}</span>
      <span class="st-txt">${esc(star.best.advice.吉)}</span>
    </div>
    <div class="st-row" role="button" tabindex="0" data-legacy-gua="${star.worst.gua}">
      <span class="st-tag st-worst">命卦参考</span>
      <span class="st-dir">${esc(star.worst.dir)}</span>
      <span class="st-xing" style="color:${star.worst.xingColor}">${esc(star.worst.xing)}</span>
      <span class="st-txt">${esc(star.worst.advice.凶)}</span>
    </div>
    <div class="st-grid">
      ${star.list.map(o => `
      <div class="st-cell lv-${lvKind(o.level)} ${sel===o.gua?'on':''}" role="button" tabindex="0" data-legacy-gua="${o.gua}">
        <div class="stc-top"><span class="stc-dir">${esc(o.dir)}</span><span class="stc-gua" style="color:${o.color}">${esc(o.gua)}</span></div>
        <div class="stc-xing" style="color:${o.xingColor}">${esc(o.xing)}</div>
        <div class="stc-lv">${esc(o.level)}</div>
        <div class="stc-advice">${esc(o.advice[lvTag(o.level)])}</div>
      </div>`).join('')}
    </div>
    <div class="disclaimer disclaimer-sm">
      九星按出生年立春界计算；八宅命卦另取出生年与性别，五黄寄宫男坤女艮。上方奇门取起盘时刻，天芮等与贪狼等不是同一套星曜。两盘只对齐洛书宫位和方位。身体与居家内容是传统取象，不作为健康判断或必然吉凶。
    </div>
  </div>` : `
  <div class="card wide-card">
    <div class="card-title"><span>九宫飞星占卜</span><span class="card-title-line"></span></div>
    <div class="empty-hint">录入生辰后，将以你的本命卦起星，推断八方吉凶与化解之法。</div>
    <button class="btn-primary" data-go="index" style="margin-top:16px">前往录入生辰</button>
  </div>`;

  // 八卦详解（收起式，保留原信息）
  const detail = list.filter(g=>g.gua!=="中").map(g => `
    <div class="jg-item ${g.isSelf ? 'jg-item-self' : ''}" role="button" tabindex="0" data-legacy-gua="${g.gua}">
      <div class="jgi-head">
        <span class="jgi-sym" style="color:${g.color}">${g.symbol}</span>
        <span class="jgi-name">${g.gua}·${g.name}</span>
        <span class="jgi-dir">${g.dir}</span>
        ${g.isSelf ? '<span class="jgi-self">本命</span>' : ''}
      </div>
      <div class="jgi-attr">五行属${g.elem} · 应${g.season} · 洛书数${g.num}</div>
      <div class="jgi-desc">${esc(g.desc)}</div>
    </div>`).join('');

  const shis = birth ? dy.explain(['五行', '大运', '流年', '驿马', '桃花', '华盖']) : [];

  return `
  

  <div class="card wide-card">
    <div class="card-title"><span>九宫飞星 · 点宫查看详解</span><span class="card-title-line"></span></div>
    <div class="jg-tip">上南下北，左东右西。点任一宫位查看该方的<b style="color:#d4a853">好处、破解之法</b>。</div>
    <div class="jg-grid">${cells}</div>
    ${star ? `<div class="jg-selfinfo">八宅命卦参考：${self ? self.gua+"（"+self.dir+"）" : "立春临界待确认"}。${esc(star.summary)}</div>`
           : '<div class="jg-selfinfo">录入生辰后，可标注本命宫位并起九星飞星</div>'}
  </div>

  ${starTable}

  ${focusBox}

  <div class="card">
    <div class="card-title"><span>八卦对应人事</span><span class="card-title-line"></span></div>
    ${detail}
  </div>

  ${shis.length ? `<div class="card">
    <div class="card-title"><span>术语白话</span><span class="card-title-line"></span></div>
    ${shis.map(t => `<div class="term-item"><span class="term-n">${esc(t.term)}</span><span class="term-p">${esc(t.plain)}</span></div>`).join('')}
  </div>` : ''}`;
}
function section(birth){return '<section id="legacy-natal" class="legacy-natal">'+html(birth)+'</section>';}
const style=document.createElement('style');style.textContent='.legacy-natal{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.legacy-natal .wide-card{grid-column:1/-1}.legacy-natal .card{min-width:0;margin:0}.legacy-natal [data-legacy-gua]{cursor:pointer}.legacy-natal [data-legacy-gua]:focus-visible{outline:2px solid #e5bd68}@media(max-width:1000px){.legacy-natal{grid-template-columns:1fr}.legacy-natal .st-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.appendChild(style);
function choose(e){const button=e.target.closest?.('[data-legacy-gua]'),host=button?.closest('#legacy-natal');if(!host)return;if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;if(e.type==='keydown')e.preventDefault();selected=button.dataset.legacyGua;const scroll=document.getElementById('content').scrollTop;host.innerHTML=html(loadBirth());document.getElementById('content').scrollTop=scroll;}
document.addEventListener('click',choose);document.addEventListener('keydown',choose);root.LegacyNatal={html:section};})(window);
