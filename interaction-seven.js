(function(root){
'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const style=document.createElement('style');style.textContent=[
'.method-tabs{display:flex;align-items:center}.method-tabs .cast-sound{float:none;position:absolute;right:6px;top:50%;transform:translateY(-50%);height:32px;margin:0}',
'.he-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.he-cell{min-height:100px;border:1px solid #b89a5a70;border-radius:8px;color:#e8d09a;background:radial-gradient(ellipse,#bc985520,#0b1328);cursor:pointer}.he-cell{transition:transform .2s,box-shadow .2s,border-color .2s}.he-cell:hover,.he-river button:hover,.he-cell:focus-visible,.he-river button:focus-visible{transform:translateY(-3px);border-color:#ffe5a5;box-shadow:0 0 24px #efc57655;outline:1px solid #dfbb74}.he-live-detail{color:#d7c28e;min-height:38px;font-size:12px;line-height:1.8}.he-cell b{font-size:20px}.he-cell.active{border-color:#f2cf81;box-shadow:inset 0 0 22px #dfb25830}.he-cell small{display:block;line-height:1.6}.he-river{display:flex;gap:8px;margin:12px 0 16px}.he-river button{flex:1;min-width:0;border:1px solid #c7a46c55;background:#111a2f;color:#e2cb92;border-radius:6px;padding:8px 3px;cursor:pointer}.he-river .active{background:#b9984a33;border-color:#dfbc70}.he-dots{width:100%;height:22px;display:block}',
'.result-fulu{margin-top:20px}.result-fulu-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.result-fulu-item{border:1px solid #b99b5e66;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:9px;background:#11172d}.result-fulu-item canvas{align-self:center;cursor:zoom-in}.result-fulu-item p{font-size:12px;line-height:1.8;margin:0}.result-fulu-item h4{color:#e7cb8b;margin:0}.result-fulu-item small{color:#b7a886;line-height:1.7}',
'.pair-fx{position:fixed;inset:0;z-index:10000;background:#030817;overflow:hidden;display:flex;align-items:center;justify-content:center}.pair-fx:before{content:"";position:absolute;inset:0;background:url("assets/hepan-reference.png") center/cover no-repeat;opacity:.88;animation:pairBackdrop 10s ease-in-out both}.pair-orbit{position:absolute;width:min(42vw,530px);aspect-ratio:1;border:2px solid #f3d57b;border-radius:50%;box-shadow:0 0 30px #dcb85880,inset 0 0 35px #f1c35c40;left:calc(50% - min(21vw,265px));top:44%;animation:pairMerge 10s ease-in-out both}.pair-orbit:after{content:"";position:absolute;inset:14px;border:2px dashed #fff0ab;border-radius:50%;animation:pairSpin 6s linear infinite}.pair-orbit.b{animation-name:pairMergeB}.pair-caption{position:absolute;left:10%;right:10%;bottom:5%;text-align:center;border:1px solid #dcc17466;border-radius:15px;background:#050b1ed9;padding:18px;color:#ffe8ad;backdrop-filter:blur(12px)}.pair-caption b{font-size:22px;display:block;margin-bottom:8px}.pair-progress{position:absolute;bottom:0;height:3px;background:#ffdc83;left:0;animation:pairProgress 10s linear both}.pair-skip{position:absolute;right:20px;bottom:20px;background:#121b2b;color:#e8d198;border:1px solid #ddbd72;border-radius:20px;padding:8px 14px;cursor:pointer}',
'@keyframes pairBackdrop{0%{opacity:0;transform:scale(1.1)}20%{opacity:.85}80%{opacity:.9;transform:scale(1)}100%{opacity:.1;transform:scale(1.03)}}@keyframes pairMerge{0%{transform:translate(-55%,-50%) scale(.55);opacity:0}20%{opacity:1}65%{transform:translate(-24%,-50%) scale(1)}90%{transform:translate(0,-50%) scale(1.06);opacity:1}100%{transform:translate(0,-50%) scale(1.2);opacity:0}}@keyframes pairMergeB{0%{transform:translate(55%,-50%) scale(.55);opacity:0}20%{opacity:1}65%{transform:translate(24%,-50%) scale(1)}90%{transform:translate(0,-50%) scale(1.06);opacity:1}100%{transform:translate(0,-50%) scale(1.2);opacity:0}}@keyframes pairSpin{to{rotate:360deg}}@keyframes pairProgress{from{width:0}to{width:100%}}html.motion-off .pair-fx *{animation:none!important}@media(max-width:600px){.he-cell{min-height:88px}.he-river{gap:3px}.he-river button{font-size:11px}.pair-caption{bottom:10%;padding:12px}.pair-caption b{font-size:18px}}',
'.pair-disc{width:100%;height:100%;animation:pairDiscSpin 1.25s linear infinite;filter:drop-shadow(0 0 14px #e7bb67)}.pair-orbit.b .pair-disc{animation-direction:reverse}.pair-orbit:after{display:none}.pair-caption{border:0;background:linear-gradient(90deg,transparent,#050b1ebb,transparent);border-radius:0}.pair-orbit{top:52%;width:min(58vw,700px);left:calc(50% - min(29vw,350px))}@keyframes pairDiscSpin{to{transform:rotate(360deg)}}'
].join('');document.head.appendChild(style);
function pairDisc(){let g='';const bits=[7,3,5,1,6,2,4,0];bits.forEach((v,i)=>{g+='<g transform="translate(200 200) rotate('+i*45+') translate(0 -132)">';for(let j=0;j<3;j++)g+='<path d="'+((v>>j)&1?'M-22 '+j*10+'h44':'M-22 '+j*10+'h17 M5 '+j*10+'h17')+'" stroke="#ffe5a0" stroke-width="5"/>';g+='</g>';});return '<svg class="pair-disc" viewBox="0 0 400 400"><circle cx="200" cy="200" r="190" fill="#08102299" stroke="#f4d17c"/><circle cx="200" cy="200" r="175" fill="none" stroke="#efcc78" stroke-dasharray="2 7"/>'+g+'<circle cx="200" cy="200" r="90" fill="#e8cf86"/><path d="M200 110a90 90 0 0 1 0 180a45 45 0 0 1 0-90a45 45 0 0 0 0-90" fill="#071121"/><circle cx="200" cy="155" r="12" fill="#071121"/><circle cx="200" cy="245" r="12" fill="#e8cf86"/></svg>';}
let pairBusy=false;
root.PairFX={run(A,B,done,opt){
if(pairBusy)return;pairBusy=true;
const reduced=root.MotionPref&&root.MotionPref.effective&&!root.MotionPref.effective();
const duration=10000,mask=document.createElement('div');
mask.className='pair-fx';mask.setAttribute('role','status');mask.setAttribute('aria-live','polite');
mask.innerHTML='<div class="pair-orbit a">'+pairDisc()+'</div><div class="pair-orbit b">'+pairDisc()+'</div><div class="pair-caption"><b>双盘启合</b><span>'+E(A.name||'甲方')+' · '+E(B.name||'乙方')+'</span><p>两份出生资料 · 独立排盘 · 对照五行与干支</p></div><div class="pair-progress"></div>';
document.body.appendChild(mask);let timer,phase;
const end=()=>{if(!pairBusy)return;clearTimeout(timer);clearInterval(phase);mask.remove();pairBusy=false;done();};

let step=0;phase=setInterval(()=>{step++;mask.querySelector('.pair-caption b').textContent=['双盘启合','四柱成形','干支交织','五行合参','合盘呈现'][Math.min(step,4)];},duration/5);
timer=setTimeout(end,duration);
},get busy(){return pairBusy;}};
const luo=[4,9,2,3,5,7,8,1,6],wx={1:'水',6:'水',2:'火',7:'火',3:'木',8:'木',4:'金',9:'金',5:'土'};
const names={水:'一六共宗',火:'二七同道',木:'三八为朋',金:'四九为友',土:'五十同途'};
const palace={1:['坎','北','水'],2:['坤','西南','土'],3:['震','东','木'],4:['巽','东南','木'],5:['中','中','土'],6:['乾','西北','金'],7:['兑','西','金'],8:['艮','东北','土'],9:['离','南','火']};
function dots(n){return '<svg class="he-dots" viewBox="0 0 100 30" aria-hidden="true">'+Array.from({length:n},(_,k)=>'<circle cx="'+(50+(k-(n-1)/2)*8)+'" cy="15" r="2.6" fill="'+(n%2?'#ffe6b1':'#0c1225')+'" stroke="#d5b574"/>').join('')+'</svg>';}
function model(){
const r=compute();if(!r)return null;
let saved;try{saved=JSON.parse(localStorage.getItem('xjg_cross_latest'));}catch(e){}
const born=loadBirth();const q=saved?.birthKey===crossBirthKey(born)?saved.reading?.qimen:null;
return{element:r.bazi.dayWuXing,ju:q&&!q.error?q.juNumber:null,ys:r.bazi.yongshen};
}
function openHe(n,m,pair){
const t=palace[n],note={水:'多做信息核对、学习与沟通，别让想法一直停在脑中',火:'把表达与执行落实到具体目标，冲动决定先停一下',木:'考虑成长、规划与持续行动，把大目标拆成步骤',金:'考虑规则、专业能力与管理，别让标准变成僵硬争执',土:'把稳定、承接与日常安排做实，避免一直拖着不调整'}[wx[n]];
const body=(pair?'河图'+n+'与'+(n+5)+'配为'+wx[n]+'，传统称「'+names[wx[n]]+'」。':'洛书'+n+'数位于'+t[1]+'方，对应'+t[0]+'宫；九宫数位固定，横、竖、斜三数和为十五。')+'\n\n本次日主五行是'+m.element+'；'+(wx[n]===m.element?'这组河图数理与日主相同，因此测算动画与这里都会高亮。':'这组没有被标成日主，不表示吉凶。')+(m.ju===n?'\n本次数值也对应奇门'+m.ju+'局；这只是本次局数标记，不表示该方向必然有利。':'')+'\n\n大白话：'+note+'。结合本盘实际喜用方向'+((m.ys?.xi||[]).join('、')||'尚需权衡')+'、需节制的方向'+((m.ys?.ji||[]).join('、')||'尚需权衡')+'一起看，不能只凭一个数字决定补什么。'+(!pair?'\n\n这里数字的「'+wx[n]+'」沿用河图配数；洛书后天'+t[0]+'宫自身五行是'+t[2]+'，两种对应分开看。':'');
PalaceInsight.open({title:pair?'河图 · '+n+'—'+(n+5)+' '+wx[n]:'洛书 · '+t[0]+n+' '+t[1],topic:'传统数理、当前日主与生活建议',body,source:'固定河图配数与洛书方位；日主、喜用与奇门局数读取本次测算，和动画保持对应。'});if(document.querySelector('.tx-mask'))document.getElementById('palace-insight-dialog').style.zIndex='12000';
}
function addHe(){
if(curPage!=='chart'||document.getElementById('chart-hetu'))return;
const target=Array.from(document.querySelectorAll('.chart-fact')).find(x=>x.querySelector('.chart-fact-k')?.textContent.includes('紫微斗数'));
const m=model();if(!target||!m)return;
const card=document.createElement('div');card.id='chart-hetu';card.className='chart-fact';
card.innerHTML='<div class="chart-fact-k">河图 · 洛书盘</div><div class="chart-fact-v">日主'+E(m.element)+' · '+names[m.element]+'</div><p class="chart-evidence">与测算动画同一日主与局数标记；点配数或九宫查看白话。</p><div class="he-river">'+[1,2,3,4,5].map(n=>'<button type="button" data-he="'+n+'" data-pair="1" class="'+(wx[n]===m.element?'active':'')+'">'+dots(n)+dots(n+5)+n+'—'+(n+5)+' '+wx[n]+'</button>').join('')+'</div><div class="he-grid">'+luo.map(n=>'<button type="button" data-he="'+n+'" class="he-cell '+(wx[n]===m.element?'active':'')+'"><b>'+n+'</b>'+dots(n)+'<small>'+wx[n]+' · '+(m.ju===n?'本次奇门局数':wx[n]===m.element?'日主五行':'洛书方位')+'</small></button>').join('')+'</div>';
card.insertAdjacentHTML('beforeend','<p class="he-live-detail" aria-live="polite">鼠标移到配数或宫位可查看提示；点击打开大白话详情。</p>');
target.before(card);const boards=[card,target,Array.from(document.querySelectorAll('.chart-fact')).find(x=>x.querySelector('.chart-fact-k')?.textContent.includes('奇门遁甲'))].filter(Boolean);const height=Math.max(...boards.map(x=>x.getBoundingClientRect().height));boards.forEach(x=>x.style.minHeight=Math.ceil(height)+'px');card.querySelectorAll('[data-he]').forEach(b=>{b.title='点击查看 '+(b.dataset.pair?'河图配数':'洛书宫位')+'白话';b.setAttribute('aria-label',b.title+' '+b.dataset.he);});
}
function context(){
if(curPage==='gua'&&divState.result){const d=divState.result,c=d.chart;return{label:(c?.pureName||d.gua?.fullName||'六爻问事')+(c?.changedName?' → '+c.changedName:''),theme:divState.session.category||'综合',categories:divState.session.category==='感情'?['婚姻','和解']:divState.session.category==='财运'?['祈财','官禄']:divState.session.category==='事业'?['官禄','学业']:divState.session.category==='健康'?['调身','护身']:['护身','和解','祈福']};}
if(curPage==='hepan'&&heState.result)return{label:(heState.a?.name||'甲方')+'与'+(heState.b?.name||'乙方')+'的合盘',theme:'相处与协作',categories:['婚姻','和解','护身']};
if(curPage==='jiugong'){const r=jdState.method==='coin'?coinState.result:jdState.result;if(r)return{label:'九宫八卦 · '+jdState.type,theme:jdState.type,categories:/财/.test(jdState.type)?['祈财','官禄']:/感情|婚/.test(jdState.type)?['婚姻','和解']:/出行/.test(jdState.type)?['出行','护身']:/事业/.test(jdState.type)?['官禄','学业']:['护身','祈福','和解']};}
return null;
}
function addFulu(){
const ctx=context();if(!ctx||document.getElementById('result-fulu'))return;
ctx.kind=curPage;ctx.result=curPage==='gua'?divState.result:curPage==='hepan'?heState.result:jdState.method==='coin'?coinState.result:jdState.result;ctx.question=curPage==='gua'?divState.session.question:'';ctx.category=curPage==='gua'?divState.session.category:ctx.theme;
const card=document.createElement('section');card.className='card result-fulu';card.id='result-fulu';
card.innerHTML='<div class="card-title"><span>符箓改命 · 本次主题参考</span><span class="card-title-line"></span></div><p>'+E(ctx.label)+'</p><button class="btn-primary fulu-gen-btn" type="button" style="width:100%;color:#ffe0a0">符 箓 改 命</button><p class="chart-evidence">先依据本卦、动爻或关系维度筛选，再从对应候选中选3—6张；每张均显示匹配依据。用于传统祈愿主题参考。</p><div class="result-fulu-list"></div>';
document.getElementById('content').appendChild(card);
card.querySelector('button').onclick=()=>{
const selected=ResultFuluMatching.pick(ctx,FuluLibrary.LIB);const items=selected.items.map(x=>x.f),count=items.length;
const out=card.querySelector('.result-fulu-list');
out.innerHTML=items.map(f=>'<article class="result-fulu-item"><h4>'+E(f.name)+' <small>'+E(f.id)+'</small></h4><p>匹配依据：'+E((selected.items.find(x=>x.f.id===f.id)?.evidence||[]).join('；'))+'，对应「'+E(f.cat)+'」用途主题。</p><p>'+E(f.desc)+'　用法：'+E(f.use.replace(/^用法[:：]\s*/,''))+'</p><canvas width="300" height="400" style="width:150px;height:200px" data-id="'+E(f.id)+'"></canvas><small>点击放大并保存高清图'+(f.form?' · 符头 '+E(f.form.head)+' · 符胆 '+E(f.form.dan)+' · 符脚 '+E(f.form.foot)+' · 奉 '+E(f.form.deity):'')+'</small></article>').join('');
out.dataset.picked=String(count);out.dataset.rules=JSON.stringify(selected.signals);out.querySelectorAll('canvas').forEach((cv,i)=>{const f=items[i];cv.onclick=()=>root.openFuluZoom(f);setTimeout(()=>{if(cv.isConnected)FuluArt.animate(cv,f,{dur:1200});},i*260);});
};
}
function augment(){
if(typeof curPage==='undefined')return;
const sound=document.getElementById('cast-sound'),tabs=document.querySelector('.method-tabs');
if(sound&&tabs&&sound.parentElement!==tabs)tabs.appendChild(sound);
addHe();addFulu();
}
const original=render;render=function(){original();augment();};augment();
root.InteractionSeven={augment,model,luo,wx,context,openHe};
document.addEventListener('click',e=>{const b=e.target.closest?.('#chart-hetu [data-he]');if(b){const m=model();if(m)openHe(Number(b.dataset.he),m,!!b.dataset.pair);}});
function hoverHe(e){const b=e.target.closest?.('#chart-hetu [data-he]');if(!b)return;const n=Number(b.dataset.he),m=model(),live=document.querySelector('.he-live-detail');if(live&&m)live.textContent=(b.dataset.pair?'河图 '+n+'—'+(n+5)+' · '+names[wx[n]]:'洛书 '+palace[n][0]+n+' · '+palace[n][1])+'，'+(wx[n]===m.element?'与本次日主'+m.element+'对应':'河图配数属'+wx[n])+'；点击查看本盘建议。';}
document.addEventListener('pointerover',hoverHe);document.addEventListener('focusin',hoverHe);
})(window);