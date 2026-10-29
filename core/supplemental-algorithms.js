
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SupplementalAlgorithms=api})(globalThis,function(){
'use strict';
function solarTime(b,longitude,zone=8){
 const {year:y,month:m,day:d,hour:h}=b,mi=b.minute??30;
 if(![y,m,d,h,mi,longitude,zone].every(Number.isFinite)||h<0||h>23||mi<0||mi>59||longitude<-180||longitude>180||zone<-12||zone>14)throw Error('真太阳时需要有效日期、准确时分、经度和时区');
 const stamp=Date.UTC(y,m-1,d,h,mi),dt=new Date(stamp);
 if(dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)throw Error('出生日期无效');
 const doy=Math.floor((Date.UTC(y,m-1,d)-Date.UTC(y,0,0))/86400000);
 const days=(y%4===0&&(y%100!==0||y%400===0))?366:365;
 const gamma=2*Math.PI/days*(doy-1+(h+mi/60-12)/24);
 const equation=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma));
 const longitudeOffset=longitude*4-zone*60,offset=equation+longitudeOffset;
 const out=new Date(stamp+Math.round(offset*60000));
 return {year:out.getUTCFullYear(),month:out.getUTCMonth()+1,day:out.getUTCDate(),hour:out.getUTCHours(),minute:out.getUTCMinutes(),
 longitude,zone,equationMinutes:equation,longitudeMinutes:longitudeOffset,offsetMinutes:offset,
 formula:'真太阳时≈民用时+4×经度−60×时区+均时差（NOAA近似式）',
 accuracy:'均时差为近似值；时区应填出生时当地实际UTC偏移，夏令时须自行核实'};
}
function normalizeBirth(b){
 if(!b?.trueSolar)return b;
 if(b.hour<0)throw Error('时辰不确定不能作真太阳时校正');
 const raw={...b,hour:b.exactHour??b.hour,minute:b.minute??30};
 const t=solarTime(raw,Number(b.longitude),Number(b.utcOffset??8));
 return {...b,year:t.year,month:t.month,day:t.day,hour:t.hour,minute:t.minute,solarTime:t,civilBirth:{...raw,trueSolar:false}};
}
const Z=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
function patterns(chart){
 if(!chart?.palaces)return[];
 const m=chart.palaces.find(p=>p.name==='命宫');if(!m)return[];
 const names=p=>[...(p?.stars||[]).map(s=>s.name),...(p?.minor||[])];
 const has=(p,...ns)=>ns.every(n=>names(p).includes(n)),find=offset=>chart.palaces.find(p=>p.branch===Z[(Z.indexOf(m.branch)+offset+12)%12]);
 const tri=[m,find(4),find(8),find(6)],triNames=tri.flatMap(names),bad=triNames.some(n=>['擎羊','陀罗','火星','铃星','地空','地劫'].includes(n))||tri.some(p=>(p?.stars||[]).some(s=>s.mutagen==='忌'));
 const out=[],add=(name,rule,p=m)=>out.push({name,rule,palace:p.name+'（'+p.branch+'）',source:'https://docs.iztro.com/learn/pattern'});
 if(has(m,'紫微','天府')&&['寅','申'].includes(m.branch))add('紫府同宫','命宫寅或申，紫微与天府同宫');
 if(has(m,'天机','天梁'))add('善荫朝纲','天机、天梁同守命宫');
 if(has(m,'天机','巨门'))add('机巨同临','天机、巨门同守命宫');
 if(has(m,'太阳','巨门')&&['寅','申'].includes(m.branch))add('巨日同宫','寅或申命宫有太阳、巨门');
 if(has(m,'太阳','太阴')&&['丑','未'].includes(m.branch))add('日月同宫','丑或未命宫有太阳、太阴');
 if(has(m,'太阳','天梁')&&m.branch==='卯')add('日照雷门','卯宫太阳、天梁同坐命宫');
 if(['天机','太阴','天同','天梁'].every(n=>triNames.includes(n)))add('机月同梁','命宫三方四正具天机、太阴、天同、天梁；本规则不借未显示的星');
 if(has(m,'紫微')&&m.branch==='午'&&!bad)add('极向离明','紫微午宫坐命且命宫三方四正无本规则所列煞忌');
 const flank=[find(1),find(-1)];
 const c1=has(m,'紫微','破军')&&((has(flank[0],'左辅')&&has(flank[1],'右弼'))||(has(flank[1],'左辅')&&has(flank[0],'右弼')));
 const c2=has(m,'紫微','天相')&&((has(m,'文昌')&&has(find(6),'文曲'))||(has(m,'文曲')&&has(find(6),'文昌')));
 const c3=has(m,'天府')&&['天机','太阴','天同','天梁'].every(n=>flank.flatMap(names).includes(n));
 if(!bad&&(c1||c2||c3))add('君臣庆会','采用iztro严格结构：紫破辅弼夹／紫相命迁昌曲／府命机月同梁夹，且三方四正无煞忌');
 return out;
}
function fengshui(degree){
 if(!Number.isFinite(degree)||degree<0||degree>=360)throw Error('方向角须为0至小于360度');
 const mountains=['子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥','壬'];
 const dirs=['坎·北','艮·东北','震·东','巽·东南','离·南','坤·西南','兑·西','乾·西北'];
 const facing=mountains[Math.floor((degree+7.5)%360/15)],sit=mountains[(mountains.indexOf(facing)+12)%24];
 return {向度:degree,坐山:sit,朝向:facing,八卦方位:dirs[Math.floor((degree+22.5)%360/45)],口径:'0°为正北，顺时针；由测得向度按24山每山15°分区。临界角需复测，不据方位直接断住宅吉凶。'};
}
return{solarTime,normalizeBirth,patterns,fengshui};
});
