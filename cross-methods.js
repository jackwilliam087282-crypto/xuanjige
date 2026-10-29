/**
 * 起盘并列证据。每套方法保留自己的输入、规则和适用范围；不把不同体系的
 * 符号相似性包装成相互证明。六爻由用户点击“开始测算”触发一次独立三钱起卦。
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.CrossMethods=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const BRANCH=['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
  const ZHI=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const NAMES=['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','仆役','官禄','田宅','福德','父母'];
  const PALACES=[['巽',4,'东南'],['离',9,'南'],['坤',2,'西南'],['震',3,'东'],['中',5,'中'],['兑',7,'西'],['艮',8,'东北'],['坎',1,'北'],['乾',6,'西北']];
  const mod=(n,m)=>(n%m+m)%m;
  const solarApi=()=>root.Solar||(typeof require==='function'?require('./vendor/lunar.js').Solar:null);
  function getLunar(birth){
    return solarApi().fromYmdHms(+birth.year,+birth.month,+birth.day,+birth.hour||0,0,0).getLunar();
  }
  function ziweiAnchors(birth){
    const lunar=getLunar(birth),month=Math.abs(lunar.getMonth()),day=lunar.getDay();
    const hourZhi=ZHI[Math.floor(((+birth.hour+1)%24)/2)];
    const hourIndex=ZHI.indexOf(hourZhi);
    const mingIndex=mod(month-1-hourIndex,12),shenIndex=mod(month-1+hourIndex,12);
    return {
      method:'紫微斗数·命身宫定位', lunar:`农历${month}月${day}日${hourZhi}时`,
      ming:BRANCH[mingIndex], shen:BRANCH[shenIndex],
      palaces:NAMES.map((name,i)=>({name,branch:BRANCH[mod(mingIndex-i,12)]})),
      rule:'寅宫起正月，顺数至生月；命宫逆数生时，身宫顺数生时；十二人事宫由命宫逆排。',
      scope:'仅定位命宫、身宫；未安五行局、十四主星、四化与大限，不据此断吉凶。'
    };
  }
  function ziweiChart(birth){
 if(birth.hour==null||birth.hour===""||!Number.isFinite(Number(birth.hour))||Number(birth.hour)<0)throw new Error("出生时辰未知，紫微十二宫暂不定盘");
    let library=root.iztro;
    if(!library&&typeof require==='function'){
      if(typeof root.self==='undefined')root.self=root;
      library=require('./vendor/iztro.min.js');
    }
    if(!library||!library.astro)throw new Error('紫微排盘库未加载');
    const hourIndex=Math.floor(((+birth.hour+1)%24)/2);
    const date=`${birth.year}-${birth.month}-${birth.day}`;
    const a=library.astro.bySolar(date,hourIndex,birth.gender==='女'?'女':'男');
    const palaces=NAMES.map(name=>{
      const p=a.palaces.find(x=>x.name===name);
      if(!p)throw new Error('缺少十二宫：'+name);
      return {name,branch:p.earthlyBranch,stem:p.heavenlyStem,isBody:!!p.isBodyPalace,
        stars:(p.majorStars||[]).map(s=>({name:s.name,brightness:s.brightness||'',mutagen:s.mutagen||''})),
        minor:(p.minorStars||[]).map(s=>s.name),range:p.stage&&p.stage.range?p.stage.range.slice():[]};
    });
    const main=palaces.find(p=>p.name==='命宫');
    return {method:'紫微斗数·星曜盘',source:'iztro 2.6.1（MIT）',solar:date,lunar:a.lunarDate,
      ming:a.earthlyBranchOfSoulPalace,shen:a.earthlyBranchOfBodyPalace,
      fiveElementsClass:a.fiveElementsClass,soul:a.soul,body:a.body,palaces,
      mainStars:main.stars.map(s=>s.name),
      rule:'输入阳历生日、出生时辰与性别；由 iztro 安十二宫、五行局、主星、辅星、四化与大限。',
      scope:'展示可复核的星曜位置和化曜，不自动将星曜组合判为命运事实；不同流派的闰月、子时及四化规则可能不同。'};
  }
  function qiMenSeason(date){
    const d=date instanceof Date?date:new Date(date);
    if(!root.YhQimen||!root.YhQimen.TimeDunjia)throw new Error('奇门排盘库未加载');
    const board=root.YhQimen.TimeDunjia.create({datetime:d,type:'hour'}),meta=board.meta;
    if(!meta||!Number.isInteger(meta.juNumber)||meta.juNumber<1||meta.juNumber>9)throw new Error('奇门定局无效');
    const palaces=PALACES.map((x,i)=>{
      const p=board.palace(i);
      if(!p||p.position!==x[1])throw new Error('奇门九宫位置不匹配');
      return {trigram:x[0],number:x[1],direction:x[2],groundGan:p.groundGan||'',skyGan:p.skyGan||'',
        star:p.star?.name||'',door:p.door?.name||'',god:p.god?.name||'',outGan:p.outGan||''};
    });
    return {method:'时家奇门·九宫盘',source:'@yhjs/dunjia 1.0.1（MIT）',term:meta.solarTerm,
      phase:meta.yinyang==='阴'?'阴遁':'阳遁',juNumber:meta.juNumber,ganZhi:meta.ganZhi,
      xunHead:meta.xunHead,xunHeadGan:meta.xunHeadGan,palaces,
      rule:'以点击时刻按时家奇门排阴阳遁与局数，布地盘天干、天盘天干、九星、八门、八神；中宫不布星门神。',
      scope:'盘面是所选库的一种时家奇门规则实现；置闰、拆补、转盘等流派可能异盘，方位或吉凶不构成可验证的现实预测。'};
  }
  function castLiuYao(date,cast){
    const LY=root.LiuYao||require('./core/liuyao.js');
    const GT=root.GuaText||require('./core/gua-text.js');
    const out=LY.byCoin({date:date||new Date(),question:'本次综合卦象',cast});
    const palaceWx={乾:'金',兑:'金',坎:'水',艮:'土',坤:'土',震:'木',巽:'木',离:'火'}[out.chart.palace?.palace];
    const sheng={木:'火',火:'土',土:'金',金:'水',水:'木'},ke={木:'土',土:'水',水:'火',火:'金',金:'木'};
    const relative=wx=>!palaceWx||!wx?'':wx===palaceWx?'兄弟':sheng[palaceWx]===wx?'子孙':ke[palaceWx]===wx?'妻财':ke[wx]===palaceWx?'官鬼':'父母';
    const movingText=GT.explainMoving(out.chart.gua,(out.chart.yaos||[]).filter(y=>y.moving).map(y=>({pos:y.pos,isYang:y.yang})));
    const readings=(out.interpretation.paragraphs||[])
      .filter(p=>['gua','shiyou','moving','change'].includes(p.kind))
      .map(p=>({kind:p.kind,title:p.title,body:p.body||'',lines:p.lines||[],ruleIds:p.ruleIds||[]}));
    return {method:'三钱六爻·综合卦象',name:out.chart.gua,changed:out.chart.changedName||'无变卦',
      moving:out.chart.movingCount,lines:out.input.cast.lines.slice(),coins:out.input.cast.coins.slice(),
      readings,
      guaci:GT.guaCi(out.chart.gua).text,culture:GT.cultureNote(out.chart.gua).text,
      changedGuaci:out.chart.changedName?GT.guaCi(out.chart.changedName).text:'',changedCulture:out.chart.changedName?GT.cultureNote(out.chart.changedName).text:'',movingText,
      yaos:(out.chart.yaos||[]).map(y=>({pos:y.pos,posName:y.posName,moving:y.moving,liuqin:relative(y.zhiWx),bianLiuqin:relative(y.bianWx),isShi:y.isShi,isYou:y.isYou,ganZhi:y.ganZhi,bianGanZhi:y.bianGanZhi||''})),
      liuqinBasis:palaceWx?`${out.chart.palace.palace}宫五行${palaceWx}`:'未归八宫，不展示六亲',
      day:out.chart.dayGZ,month:out.chart.monthGZ,
      rule:'点击开始测算时，18 枚独立虚拟铜钱组成六爻；初爻在下，老阴六、老阳九为动爻。',
      scope:'本卦以点击时刻的随机三钱起卦，概览卦辞、动爻与卦变；不选事项用神，也不作具体成败或应期判断。它不由出生四柱推导。'};
  }
  function build(birth,now){
    const date=now||new Date(),parts={};
    try{parts.liuyao=castLiuYao(date);}catch(e){parts.liuyao={error:e.message};}
    try{parts.ziwei=ziweiChart(birth);}catch(e){parts.ziwei={error:e.message};}
    try{parts.qimen=qiMenSeason(date);}catch(e){parts.qimen={error:e.message};}
    return parts;
  }
  return {build,castLiuYao,ziweiAnchors,ziweiChart,qiMenSeason};
});
