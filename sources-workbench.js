
/* Offline reader and explicit algorithm tools. All input and output is escaped. */
(function(){
'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selected='',lastResult=null;
const books=window.KnowledgeCatalog||[];
const css=document.createElement('style');
css.textContent+='.work-viz{margin:16px 0;overflow-x:auto}.work-viz svg{display:block;width:100%;max-width:560px;height:auto;margin:0 auto;background:#080c14;border:1px solid #c7a45733;border-radius:12px}.work-viz .xext-wv-cell{fill:#101725;stroke:#2a3446;stroke-width:1}.work-viz .xext-wv-cell.is-focus{stroke:#c8a457;fill:#181d2c}.work-viz text{font-family:inherit}';css.textContent+='.source-hero{display:block!important;background:#080b12!important;padding:24px!important;min-height:0!important;overflow:visible!important}.source-atlas{display:block;width:100%;max-width:1000px;max-height:85vh;width:auto;height:auto;margin:16px auto;object-fit:contain;cursor:zoom-in;border-radius:12px}.source-hero h2,.source-hero p{text-align:center}.source-video-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;margin:18px 0}.source-video-frame{position:relative;width:min(1000px,100%);aspect-ratio:2560/1080;background:#000;border:1px solid #d4ad6055;border-radius:14px;overflow:hidden;cursor:zoom-in}.source-video-frame video{display:block;width:100%;height:100%;object-fit:contain}.source-video-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);padding:6px 16px;border-radius:14px;background:#020712b3;border:1px solid #c7a45766;color:#f0dcb0;font-size:13px;letter-spacing:.05em;white-space:nowrap;pointer-events:none}.source-video-note{font-size:12px;color:#b8a98a;text-align:center;line-height:1.9;margin:0}.source-video-stage{position:fixed;inset:0;z-index:1200;background:#000;display:none;place-items:center}.source-video-stage.is-open{display:grid}.source-video-stage video{max-width:100vw;max-height:100vh;width:100%;height:100%;object-fit:contain;background:#000}.source-video-close{position:absolute;top:18px;right:20px;width:44px;height:44px;font-size:26px;line-height:1;border:1px solid #c7a457;background:#020712cc;color:#f5dba3;border-radius:50%;cursor:pointer;z-index:2}.source-video-close:hover{background:#c7a45722}.source-tile{display:flex;flex-direction:column;gap:10px}.source-tile button{cursor:pointer}.work-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0}.work-grid label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:#d7c89f}.work-grid .input{width:100%;min-width:0}.work-output{margin-top:18px;line-height:1.9}.work-output table{width:100%;border-collapse:collapse}.work-output td,.work-output th{border-bottom:1px solid #b5a27333;padding:8px;text-align:left;vertical-align:top}.work-output p{white-space:pre-wrap}.reader-mask{position:fixed;inset:0;background:#020712dd;z-index:900;display:grid;place-items:center;padding:24px}.reader-paper{position:relative;max-width:900px;max-height:90vh;width:100%;overflow:auto;background:#0e1830;border:1px solid #d4ad60;border-radius:14px;padding:32px;color:#d7d6d0;line-height:2;box-sizing:border-box}.reader-paper h2{color:#eed5a0;padding-right:50px}.reader-close{position:absolute;right:16px;top:16px;font-size:24px;border:1px solid #c7a457;background:transparent;color:#f5dba3;border-radius:8px;cursor:pointer}.reader-paper .source-atlas{max-width:none;max-height:none;width:100%;height:auto}.work-original{white-space:pre-wrap;border-left:2px solid #d4ad60;padding:12px 18px;background:#d4ad6010}.source-actions{display:flex;gap:8px;margin-top:auto}.work-note{font-size:12px;color:#b8a98a;line-height:1.8}.manual-area{min-height:140px;width:100%}@media(max-width:760px){.work-grid{grid-template-columns:1fr}.reader-paper{padding:24px 16px}.reader-mask{padding:12px}}';
document.head.appendChild(css);
function button(key,label,attr='data-reader'){return '<button type="button" class="btn-ghost" '+attr+'="'+E(key)+'">'+E(label)+'</button>'}
function table(rows){return '<table><tbody>'+rows.map(([k,v])=>'<tr><th>'+E(k)+'</th><td>'+format(v)+'</td></tr>').join('')+'</tbody></table>'}
function format(v){
 if(Array.isArray(v))return v.every(x=>typeof x!=='object')?E(v.join(' · ')):v.map(format).join('<br>');
 if(v&&typeof v==='object')return '<dl>'+Object.entries(v).map(([k,x])=>'<dt style="color:#e5cc97">'+E(k)+'</dt><dd style="margin:0 0 8px">'+format(x)+'</dd>').join('')+'</dl>';
 return E(v);
}
function modal(body){
 document.querySelector('.reader-mask')?.remove();const mask=document.createElement('div');mask.className='reader-mask';mask.setAttribute('role','dialog');mask.setAttribute('aria-modal','true');
 mask.innerHTML='<section class="reader-paper"><button class="reader-close" aria-label="关闭">×</button>'+body+'</section>';
 const before=document.activeElement,close=()=>{mask.remove();document.removeEventListener('keydown',key);before?.focus?.()},key=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const nodes=[...mask.querySelectorAll('button,a,input,select')];const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};
 mask.onclick=e=>{if(e.target===mask)close()};mask.querySelector('button').onclick=close;document.addEventListener('keydown',key);document.body.appendChild(mask);mask.querySelector('button').focus();return mask;
}
function showBook(key){
 const b=books.find(x=>x.key===key);if(!b)return;
 const mask=modal('<h2>'+E(b.title)+'</h2><p class="work-note">本地导读与算法说明 · 可离线阅读；导读不是古籍全文</p>'+b.body.map(p=>'<p>'+E(p)+'</p>').join('')+
 '<p>'+button(b.algorithm,'打开对应工具','data-open-tool')+'</p><p class="work-note">核对来源：<a target="_blank" rel="noopener" href="'+E(b.url)+'">'+E(b.url)+'</a>。外部站点可用性受网络影响，本页阅读不依赖它。</p>');
 mask.querySelector('[data-open-tool]').onclick=()=>{mask.querySelector('.reader-close').click();selected=b.algorithm;lastResult=null;render();document.querySelector('#algorithm-workbench')?.scrollIntoView({block:'start'})};
}
const options=(xs,defaultIndex=0)=>xs.map((x,i)=>'<option value="'+i+'"'+(i===defaultIndex?' selected':'')+'>'+E(x)+'</option>').join('');
function field(label,id,value,type='number'){return '<label>'+E(label)+'<input class="input" id="'+id+'" type="'+type+'" value="'+E(value)+'"></label>'}
function workshop(){
 if(!selected)return '';
 const b=books.find(x=>x.algorithm===selected),birth=typeof loadBirth==='function'?loadBirth():null,now=new Date();
 const t=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')+'T'+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
 let inputs=field('演算时刻（北京时间）','work-date',t,'datetime-local');
 if(selected==='taiyi')inputs+='<label>计式<select class="input" id="work-style">'+options(['年计','月计','日计','時計','分计'],3)+'</select></label><label>积年法<select class="input" id="work-method">'+options(['统宗','金镜','淘金歌','太乙局'])+'</select></label>';
 if(selected==='qimen')inputs+='<label>定局法<select class="input" id="work-method"><option value="1">拆补</option><option value="2">置闰</option></select></label>';
 if(selected==='liuren')inputs+='<label>贵人排列实现<select class="input" id="work-method"><option value="0">实现口径 0</option><option value="1">实现口径 1</option></select></label>';
 if(selected==='solar'||selected==='astronomy')inputs+=field('经度（东正西负）','work-longitude',birth?.longitude??121.47);
 if(selected==='solar')inputs+=field('民用时实际 UTC 偏移','work-zone',8);
 if(selected==='astronomy')inputs+=field('纬度（北正南负）','work-latitude',31.23);
 if(selected==='fengshui')inputs+=field('真北向度（北0°，顺时针）','work-facing',0);
 if(selected==='ziwei')inputs='<p class="work-note">读取首页保存的真实出生资料，核对命宮与三方四正。先录入生辰再运行。</p>';
 if(selected==='dream')inputs='<label>梦中关键词<input class="input" id="work-query" placeholder="例如：水 桥"></label>';
 if(selected==='cezi'||selected==='xianggu')inputs='<label>原字／观察部位<input class="input" id="work-query" placeholder="'+(selected==='cezi'?'写一个字及所问':'如：额、颧、下颌、肩背')+'"></label><label style="grid-column:1/-1">观察笔记<textarea class="input manual-area" id="work-notes" placeholder="'+(selected==='cezi'?'偏旁拆分：\n增笔取象：\n减笔取象：\n关联词与问题：':'来源及日期：\n观察条件：\n部位与术语：\n待核对资料：')+'"></textarea></label>';
 if(selected==='liuyao')inputs='<label>离线原文<select class="input" id="work-gua">'+(window.GuaText?.KING_WEN_ORDER||[]).map(x=>'<option>'+E(x)+'</option>').join('')+'</select></label>'+
 '<label>六个爻值（初→上，6/7/8/9）<input class="input" id="work-lines" value="9 9 7 6 7 7"></label>'+
 '<label>观察用神所属六亲<select class="input" id="work-yong">'+['未指定','父母','兄弟','子孙','妻财','官鬼'].map(x=>'<option>'+E(x)+'</option>').join('')+'</select></label>';
 return '<section class="card wide-card" id="algorithm-workbench"><div class="card-title">'+E(b?.title||'算法工具')+'</div><div class="work-grid">'+inputs+'</div>'+
 '<button class="btn-primary" id="work-run">'+((selected==='cezi'||selected==='xianggu')?'保存观察记录':'演 算 / 查 读')+'</button><div class="work-output" id="work-output" aria-live="polite">'+(lastResult||'')+'</div></section>';
}
/* 科普视频小窗：内嵌播放器。点击进入全屏舞台，Esc / 点空白 / 关闭按钮退出。
   音轨已与画面合成在同一个文件内（视频 + 神迹音频），无需二次加载。*/
const MEDIA_SRC='assets/kePu-video.mp4';
const MEDIA_TITLE='周易与六爻 · 科普动画';
function mediaBlock(){
 return '<div class="source-video-wrap">'+
  '<div class="source-video-frame" id="kp-open" role="button" tabindex="0" aria-label="全屏播放'+MEDIA_TITLE+'">'+
   '<video id="kp-thumb" src="'+MEDIA_SRC+'" preload="metadata" muted playsinline></video>'+
   '<div class="source-video-hint">点击全屏播放 · '+MEDIA_TITLE+'</div>'+
  '</div>'+
  '<div class="source-video-note">《周易与六爻》科普动画（'+MEDIA_TITLE+'）<br>点击画面可全屏播放，按 Esc 退出。</p>'+
 '</div>';
}
PAGES.sources=function(){return '<section class="source-hero"><h2>河洛 · 阴阳 · 诸法图谱</h2><p>科普动画 · 点击全屏观看</p>'+mediaBlock()+'</section>'+
 '<section class="card wide-card"><div class="card-title">典籍阅读与算法工具</div><div class="source-grid">'+books.map(b=>'<article class="source-tile"><strong>'+E(b.title)+'</strong><small>'+E(b.status)+'</small><div class="source-actions">'+button(b.key,'本地阅读')+button(b.algorithm,'打开工具','data-algo')+'</div></article>').join('')+'</div></section>'+workshop()+
 '<section class="card wide-card"><div class="card-title">采用口径与可核对范围</div>'+table([['四柱','节气四柱、纳音、藏干与十神；可选经度和均时差校正'],['紫微','已安星数据及9类严格格局规则；并非宣称各派所有格局'],['六爻','八宫纳甲、世应六亲、旬空、伏神、回头生克与进退；按事项选择候选用神'],['奇门','主盘现有实现；工具另提供拆补与置闰独立盘'],['太乙／大六壬','离线计算明示开源实现与流派选项'],['星象','Astronomy Engine 天文坐标；不与命运解释混淆'],['测字／相骨','人工观察记录与导读；不伪称自动未来预测或外貌鉴定'],['相宅','24山坐向和年度九星；实地建筑安全仍需勘察']])+'</section>'};
function parseDate(){const v=document.getElementById('work-date')?.value;if(!v)throw Error('请填写完整日期时间');const match=v.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/);if(!match)throw Error('日期格式错误');const [year,month,day,hour,minute]=match.slice(1).map(Number);return {year,month,day,hour,minute}}
/* 盘面渲染：结果有空间结构的走图，其余仍按 key/value 表格。
   早先一律 table(Object.entries(r)) —— 奇门九宫、六壬天地盘、紫微十二宫
   本来是有位置关系的东西，摊平成表格等于逼读者在脑子里重建一次盘面。 */
const VIZ_KIND={qimen:'qimen',liuren:'liuren',taiyi:'taiyi',astronomy:'astronomy',
 fengshui:'fengshui',ziwei:'ziwei',liuyao:'liuyao',solar:'solar'};
function viz(kind,r){
 const fn=window.WorkbenchViz?.render;if(typeof fn!=='function')return '';
 const svg=fn(VIZ_KIND[kind],r);
 if(!svg)return '';
 return '<div class="work-viz">'+svg+'</div>';
}
async function execute(){
 const out=document.getElementById('work-output'),btn=document.getElementById('work-run');btn.disabled=true;out.textContent='正在核对输入并演算…';
 try{
  let r,html='',q=selected;
  if(['taiyi','liuren','qimen'].includes(q)){
   if(!window.LocalAlgorithms?.run)throw Error('本地计算接口未加载，请使用交付版或从 main.js 启动应用');
   r=await LocalAlgorithms.run({...parseDate(),kind:q,style:Number(document.getElementById('work-style')?.value??3),method:Number(document.getElementById('work-method')?.value??0)});
  }else if(q==='solar'){
   /* Number('') 是 0，不是 NaN —— 经度或时区留空时，
      0 经度会算出 −480 分钟这种一眼荒唐的结果，却仍然被当作有效结果画成图。
      这里先挡掉空值与越界值，让用户看到「要填经度」而不是一张假条形图。 */
   const lon=document.getElementById('work-longitude').value.trim(),zone=document.getElementById('work-zone').value.trim();
   if(!lon||!zone)throw Error('请填写经度与民用时 UTC 偏移；空值按 0 参与计算会得出无意义的时刻');
   r=SupplementalAlgorithms.solarTime(parseDate(),Number(lon),Number(zone));
  }else if(q==='ziwei'){
   const birth=loadBirth();if(!birth)throw Error('请先在首页保存生辰');
   const z=CrossMethods.ziweiChart(birth);if(z.error)throw Error(z.error);
   const hits=SupplementalAlgorithms.patterns(z);
   html=viz(q,z)+table([['命宫',z.ming],['身宫',z.shen],['五行局',z.fiveElementsClass],['农历',z.lunar]].concat(hits.map(x=>[x.name,x.palace+'；'+x.rule])))+
    '<p>'+E(hits.length?'只列出本次满足明示条件的格局。':'本次未满足这9类规则，不表示命盘不好。')+'</p>';
  }else if(q==='astronomy'){
   const x=parseDate(),date=new Date(x.year+'-'+String(x.month).padStart(2,'0')+'-'+String(x.day).padStart(2,'0')+'T'+String(x.hour).padStart(2,'0')+':'+String(x.minute).padStart(2,'0')+':00+08:00');
   const lat=Number(document.getElementById('work-latitude').value),lon=Number(document.getElementById('work-longitude').value);
   if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180)throw Error('经纬度无效');
   const observer=new Astronomy.Observer(lat,lon,0),bodies=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'],names=['太阳','月亮','水星','金星','火星','木星','土星'];
   r=Object.fromEntries(bodies.map((body,i)=>{const eq=Astronomy.Equator(body,date,observer,true,true),hz=Astronomy.Horizon(date,observer,eq.ra,eq.dec,'normal'),ecl=Astronomy.Ecliptic(Astronomy.GeoVector(body,date,true));return[names[i],{赤经小时:eq.ra.toFixed(4),赤纬度:eq.dec.toFixed(3),黄经度:ecl.elon.toFixed(3),方位度:hz.azimuth.toFixed(3),高度度:hz.altitude.toFixed(3)}]}));
  }else if(q==='fengshui'){
   const d=parseDate(),degree=Number(document.getElementById('work-facing').value),sum=String(d.year).split('').reduce((a,n)=>a+Number(n),0),center=((10-sum)%9+9)%9+1;
   r=SupplementalAlgorithms.fengshui(degree);const numbers=[4,9,2,3,5,7,8,1,6],offset={5:0,6:1,7:2,8:3,9:4,1:5,2:6,3:7,4:8};
   r.年度中心星=center;r.年度九宫=Object.fromEntries(numbers.map(n=>[n+'宫',((center-1+offset[n])%9)+1]));r.年度口径='年度九星顺飞，非住宅山向宅盘';
  }else if(q==='dream'){
   const words=document.getElementById('work-query').value.trim().split(/\s+/).filter(Boolean);if(!words.length)throw Error('请输入关键词');
   const rows=(window.DreamText||[]).filter(x=>words.every(w=>x.text.includes(w)));html='<p>原文命中 '+rows.length+' 条</p>'+rows.slice(0,60).map(x=>'<div class="work-original">'+E(x.text)+'<small> · '+E(x.section)+'</small></div>').join('');
  }else if(q==='cezi'||q==='xianggu'){
   const term=document.getElementById('work-query').value.trim(),notes=document.getElementById('work-notes').value.trim();if(!term||!notes)throw Error('请填写原字／部位与观察记录');
   const records=JSON.parse(localStorage.getItem('xjg_observation_notes')||'[]');records.push({kind:q,term,notes,at:new Date().toISOString()});localStorage.setItem('xjg_observation_notes',JSON.stringify(records.slice(-200)));
   html='<p>已保存本地观察记录。</p><div class="work-original">'+E(term)+'\n'+E(notes)+'</div>';
  }else if(q==='liuyao'){
   const name=document.getElementById('work-gua').value,lines=document.getElementById('work-lines').value.trim().split(/[\s,，]+/).map(Number);
   if(lines.length!==6||lines.some(n=>![6,7,8,9].includes(n)))throw Error('请输入六个有效爻值');
   const c=LiuYaoChart.build({lines,date:new Date()}),rel=document.getElementById('work-yong').value;
   html='<h3>'+E(name)+' · 离线原文</h3><div class="work-original">'+E(GuaText.guaCi(name).text)+'\n'+E(GuaText.xiangCi(name).text)+'\n'+[1,2,3,4,5,6].map(p=>E(GuaText.yaoCi(name,p).text||'')).join('\n')+'</div>'+
    '<h3>实际输入：'+E(c.gua)+' → '+E(c.changedName||'无变卦')+'</h3>'+
    viz(q,c)+
    table(c.yaos.map(y=>[y.posName+'爻',y.ganZhi+' '+y.liuqin+(y.isShi?' 世':'')+(y.isYou?' 应':'')+(y.fushen?'；伏 '+y.fushen.ganZhi+' '+y.fushen.liuqin:'')+(y.moving?' → '+y.bianGanZhi+' '+y.bianLiuqin+'；'+y.motionRelations.join('、'):'')]))+
    '<p>'+E(rel==='未指定'?'尚未指定事项用神，不默认按求财断事。':rel+'明爻候选：'+(c.yongCandidates[rel].join('、')||'没有，另看伏神')+'；同类多现须结合具体对象择用。')+'</p>';
  }
  /* 走图的结果，图后面仍跟一份明细表 —— 图给位置，表给可核对的逐项值。
     这里必须用 += 而非 =：奇门/太乙/六壬等分支已经拼好了图与原文，
     直接赋值会把刚画好的盘面整块覆盖掉。 */
  if(r)html+=viz(q,r)+table(Object.entries(r));
  lastResult=html;out.innerHTML=html;
 }catch(e){lastResult=null;out.textContent=e.message||'演算失败'}finally{btn.disabled=false}
}
/* 全屏舞台：只创建一个并常驻 DOM，切页时不销毁，避免每次重渲染重建解码器。
   打开时从 0 开始播放，关闭时暂停并卸载，避免后台持续解码占 CPU。*/
let stageEl=null,stageVideo=null,thumbEl=null,lastFocus=null;
function ensureStage(){
 if(stageEl&&document.body.contains(stageEl))return;
 stageEl=document.createElement('div');stageEl.className='source-video-stage';stageEl.id='kp-stage';
 stageEl.setAttribute('role','dialog');stageEl.setAttribute('aria-modal','true');
 stageEl.innerHTML='<button class="source-video-close" id="kp-close" aria-label="关闭全屏">×</button>'+
  '<video id="kp-stage-video" src="'+MEDIA_SRC+'" preload="auto" playsinline controls></video>';
 document.body.appendChild(stageEl);
 stageVideo=stageEl.querySelector('#kp-stage-video');
 stageEl.querySelector('#kp-close').onclick=closeStage;
 stageEl.onclick=e=>{if(e.target===stageEl)closeStage()};
 stageEl.addEventListener('keydown',e=>{if(e.key==='Escape')closeStage()});
}
function closeStage(){
 if(!stageEl)return;stageEl.classList.remove('is-open');
 stageVideo?.pause();try{stageVideo.currentTime=0}catch(_){}
 lastFocus?.focus?.();lastFocus=null;document.removeEventListener('keydown',onStageKey);
}
function onStageKey(e){if(e.key==='Escape'){e.preventDefault();closeStage()}}
function openStage(trigger){
 ensureStage();lastFocus=trigger||document.activeElement;
 stageVideo.currentTime=0;
 stageEl.classList.add('is-open');
 const p=stageVideo.play();
 if(p&&p.catch)p.catch(()=>{});   // 用户手势外的自动播放可能被拒，交给 controls 手动点
 stageEl.querySelector('#kp-close').focus();
 document.addEventListener('keydown',onStageKey);
}
const prior=bind;bind=function(){prior();
 document.querySelectorAll('[data-reader]').forEach(b=>b.onclick=()=>showBook(b.dataset.reader));
 document.querySelectorAll('[data-algo]').forEach(b=>b.onclick=()=>{selected=b.dataset.algo;lastResult=null;render();document.getElementById('algorithm-workbench')?.scrollIntoView({block:'start'})});
 const thumb=document.getElementById('kp-thumb');thumbEl=thumb;
 const open=document.getElementById('kp-open');
 if(open){
  open.onclick=()=>openStage(open);
  open.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openStage(open)}};
 }
 // 小窗静音自动播放：静音是自动播放策略豁免的前提，离开本页一律暂停
 if(thumb){thumb.muted=true;thumb.play().catch(()=>{});}
 const run=document.getElementById('work-run');if(run)run.onclick=execute;
};
if(typeof render==='function')render();
})();
