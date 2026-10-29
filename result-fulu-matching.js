/** 可追溯的符箓用途主题匹配。随机仅用于已命中的候选，不改变盘面。 */
(function(root){
'use strict';
const topicRules=[
[/财|投资|回款|收入|借款|生意/,'祈财','收支与经营',6],
[/事业|项目|岗位|工作|职业|升职/,'官禄','工作与职责',6],
[/感情|婚|夫妻|伴侣/,'婚姻','关系经营',6],
[/合作|纠纷|争议|合同|官司/,'和解','沟通与分歧',6],
[/学|考试|读书/,'学业','学习与文书',6],
[/出行|旅|异地|迁移/,'出行','出行安排',6],
[/家宅|房|住|装修/,'镇宅','居住安排',6],
[/健康|身心|照护/,'调身','身心照护祈愿',6]];
function signals(ctx){
const out=[],add=(cat,weight,evidence,rule)=>out.push({cat,weight,evidence,rule});
const text=(ctx.category||ctx.theme||'')+' '+(ctx.question||'');
topicRules.forEach(([re,cat,label,w])=>{if(re.test(text))add(cat,w,'本次占问关注'+label,'TOPIC-'+cat);});
const r=ctx.result||{};
if(ctx.kind==='gua'){
const c=r.chart||{},name=c.pureName||r.gua?.fullName||'本卦',short=r.gua?.short||name.replace(/^[天地雷风水火山泽]{2}/,'');
if(/否|困|蹇|坎|剥/.test(short))add('消灾',7,'实际本卦为'+name+'，取减压、保底的祈愿主题','GUA-OBSTACLE');
if(/讼|睽|夬/.test(short))add('和解',8,'实际本卦为'+name+'，取化解分歧的主题','GUA-DISPUTE');
if(/萃|比|同人/.test(short)||/萃|比|同人/.test(c.changedName||''))add('和解',7,'本卦或变卦出现'+(c.changedName||name)+'，取协作与凝聚主题','GUA-COLLAB');
if(/需|小畜|遁|艮|节|损/.test(short))add('护身',6,'实际本卦为'+name+'，取守持与减负主题','GUA-RESERVE');
if(/升|晋|益|大畜/.test(short)&&/事业|工作|项目|学|考/.test(text))add(/学|考/.test(text)?'学业':'官禄',8,'实际本卦为'+name+'，与当前成长事项共同匹配','GUA-DEVELOP');
const moving=(c.yaos||[]).filter(y=>y.moving);
moving.forEach(y=>{if((y.motionRelations||[]).includes('回头克'))add('化煞',8,'第'+y.pos+'动爻为回头克，取减少阻力的主题','YAO-RETURN-KE-'+y.pos);if(y.xianKong||y.yuePo)add('护身',7,'第'+y.pos+'动爻有'+(y.xianKong?'旬空':'月破')+'标记，取稳住基本安排的主题','YAO-LIMIT-'+y.pos);});
if(!out.some(s=>s.rule.startsWith('GUA-')||s.rule.startsWith('YAO-')))add('祈福',3,'实际本卦'+name+(moving.length?'、'+moving.length+'个动爻':'、六爻皆静')+'，取日常祝愿主题','GUA-DAILY');
}
else if(ctx.kind==='hepan'){
const rel=r.dayZhiRel||'无明显关系',day=r.dayMasterRel?.rel||'无明显生克';
add('婚姻',5,'双方日支关系为'+rel+'、日主关系为'+day+'，取相处经营主题','HEPAN-RELATION');
const negatives=(r.dimensions||[]).filter(x=>x.direction<0);
if(negatives.length)negatives.forEach(x=>add('和解',9,'合盘「'+x.name+'」为'+x.fact+'，取磨合与互相尊重主题','HEPAN-'+x.key));
else add('和解',4,'本次合盘未显示负向关系维度，取协商与持续沟通主题','HEPAN-COMMUNICATE');
if((r.complement||[]).length)add('祈福',3,'五行互补记录为'+r.complement.length+'项，取彼此支持主题','HEPAN-COMPLEMENT');
}
else if(ctx.kind==='jiugong'){
if(r.coins){const bad=r.coins.filter(c=>c.level==='凶');if(bad.length)add('化煞',9,'六数九宫第'+bad.map(c=>c.idx).join('、')+'项为凶，取减少阻力主题','JIUGONG-COINS');else add('祈福',4,'六数九宫实际吉'+r.nJi+'、平'+r.nPing+'、凶'+r.nXiong+'，取日常祝愿主题','JIUGONG-COINS-BASE');}
if(!r.coins){const rel=r.rel?.key||r.rel?.text||r.relation||'';
if(/克我/.test(rel))add('化煞',9,'九宫实际用宫'+(r.useGua||r.useGuaPos||'')+'与验宫'+(r.testGua||'')+'关系为'+rel,'JIUGONG-KE');
else if(/我生/.test(rel))add('护身',7,'九宫实际关系为'+rel+'，取节制消耗主题','JIUGONG-DRAIN');
else add('祈福',4,'实际九宫用宫'+(r.useGua||r.useGuaPos||'')+'、验宫'+(r.testGua||'')+'、时宫'+(r.timeGua||'')+'，关系为'+(rel||'本页所列关系'),'JIUGONG-BASE');
if(Number.isFinite(r.levelIdx)&&r.levelIdx<4)add('消灾',7,'本次规则等级为'+r.level+'，取减压与保底主题','JIUGONG-LEVEL');}
}
return out.map(s=>({...s,evidence:ctx.kind==='hepan'&&root.ResultInsights?root.ResultInsights.replaceAB(s.evidence,r):s.evidence}));
}
function pick(ctx,library,random){
random=random||Math.random;const facts=signals(ctx);
const excluded=/(妾室|安胎|催生|催丁|避孕|生子|送子|迷魂)/;
const matter=(ctx.category||ctx.theme||'')+' '+(ctx.question||'');
const gates=[[/雨|旱|水旱|鎮水|镇水|火灾|防火|鎮火/,/雨|旱|水灾|临水|火灾|防火/],[/上樑|上梁|动土|地基|宅|房|土地|灶|灶君/,/家宅|房|住|装修|营建|灶|土地/],[/醫|医药|病|解毒|五脏|延寿|延生|养元|養元/,/健康|身心|照护|寿|病/],[/討債|讨债|催财|催財/,/财|债|欠款|回款/],[/官司|诉讼|訴訟|牢狱|牢獄/,/官司|诉讼|纠纷|合同/],[/本命|太岁|太歲|禳星|五黄|五黃/,/本命|太岁|太歲|岁运|流年|五黄/],[/招魂|復魂|复魂|鎮妖|镇妖|斩妖|斬妖|驱鬼|驅鬼/,/魂|妖|鬼/],[/桃花|招姻|姻缘|姻緣/,/恋爱|婚|姻缘|伴侣|感情/]];
function suitable(f){return !excluded.test(f.name)&&gates.every(([name,need])=>!name.test(f.name)||need.test(matter));}
const scored=library.filter(suitable).map(f=>{
const hits=facts.filter(s=>s.cat===f.cat);
return{f,score:hits.reduce((a,h)=>a+h.weight,0),evidence:hits.map(h=>h.evidence),rules:hits.map(h=>h.rule)};
}).filter(x=>x.score>0);
if(!scored.length)return{items:[],signals:facts,total:0};
const count=Math.min(scored.length,3+Math.floor(random()*4)),items=[],used=new Set();
const groups=Array.from(new Set(facts.map(s=>s.cat))).map(cat=>({cat,weight:Math.max(...facts.filter(s=>s.cat===cat).map(s=>s.weight))})).sort((a,b)=>b.weight-a.weight);
function choose(pool){
const weights=pool.map(x=>x.score*x.score),total=weights.reduce((a,b)=>a+b,0);let t=random()*total,index=pool.length-1;
for(let i=0;i<pool.length;i++){t-=weights[i];if(t<0){index=i;break;}}
const x=pool[index];used.add(x.f.id);items.push(x);
}
groups.slice(0,Math.min(count,3)).forEach(g=>{const pool=scored.filter(x=>x.f.cat===g.cat&&!used.has(x.f.id));if(pool.length)choose(pool);});
while(items.length<count)choose(scored.filter(x=>!used.has(x.f.id)));
return{items,signals:facts,total:scored.length};
}
root.ResultFuluMatching={signals,pick};
if(typeof module==='object'&&module.exports)module.exports=root.ResultFuluMatching;
})(typeof globalThis!=='undefined'?globalThis:this);