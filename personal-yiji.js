/** 今日宜忌：四维分数、日柱、十神、刑冲合害共同决定个人行动提示。 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.PersonalYiJi=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const label={wealth:'财务',love:'关系',career:'事务',health:'身心'};
  const stemElement={甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
  const byScore=(s,high,mid,low)=>s>=70?high:s>=50?mid:low;
  function action(k,side,ctx){
    const {score,shishen,clash,join,element,dayStem}=ctx;
    if(k==='wealth')return side==='yi'
      ? byScore(score,'复核可兑现的收入与项目预算','整理本周收支，把可支配额写清','先把必要支出与可延期支出分开')
      : byScore(score,'别因财务评分靠前就跳过合同与回款核验','避免凭一时乐观增加固定支出','暂缓大额承诺，先确认现金流和偿付能力');
    if(k==='love')return side==='yi'
      ? join?'把需要双方配合的一件事先谈成具体分工':byScore(score,'主动谈清一项长期期待','安排一次不被打断的沟通','先倾听对方真正要解决的事')
      : clash?'争执升温时先暂停，再核实事实与彼此边界':byScore(score,'避免替对方作决定','别把未说出口的期待当成承诺','不宜在情绪上头时追问旧事或作最终表态');
    if(k==='career')return side==='yi'
      ? /正官|七杀/.test(shishen)?'把责任范围、截止时间和验收标准写清':/食神|伤官/.test(shishen)?'先拿一份可展示的成果与人讨论':byScore(score,'推动一项已具备条件的任务','先清理最影响进度的卡点','只处理可独立完成的小步骤')
      : clash?'关键承诺先核对资料与相关人，再决定是否签下':byScore(score,'别同时接下过多新任务','避免跳过复核与交接','暂缓高成本变更，保留回退方案');
    return side==='yi'
      ? byScore(score,`保持${element}日的既定作息节奏`,'给工作与休息各留一段完整时间','优先补足睡眠并减少无谓奔波')
      : byScore(score,'别因为状态尚可就压缩休息','减少连续熬夜和久坐','避免透支精力；不适时寻求专业帮助');
  }
  function make(bazi,fortune){
    if(!bazi||!fortune||!fortune.scores)throw new Error('缺少个人盘或今日评分');
    const scores=fortune.scores;
    const ranked=['wealth','love','career','health'].map(key=>({key,score:Number(scores[key])||0}))
      .sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
    const relations=(fortune.relations||[]).filter(x=>['合','冲','刑','害'].includes(x.type));
    const join=relations.find(x=>x.type==='合');
    const clash=relations.find(x=>['冲','刑','害'].includes(x.type));
    const day=(bazi.pillars||[]).find(x=>x.key==='day')||(bazi.pillars||[])[2]||{};
    const dayStem=String(fortune.dayGanZhi||'').charAt(0);
    const ctx={shishen:fortune.shishen||'',join,clash,element:stemElement[dayStem]||'当',dayStem};
    const why=x=>`${label[x.key]} ${x.score} 分；${fortune.dayGanZhi||'今日干支'}与本命${day.gan||''}${day.zhi||''}${ctx.shishen?'，十神'+ctx.shishen:''}`;
    const yi=ranked.slice(0,2).map(x=>({text:action(x.key,'yi',{...ctx,score:x.score}),why:why(x),key:x.key}));
    const ji=ranked.slice(-2).reverse().map(x=>({text:action(x.key,'ji',{...ctx,score:x.score}),why:why(x),key:x.key}));
    const tenGodTask={比肩:'有同伴参与时先定分工',劫财:'涉及共享资源先写清边界',食神:'把想法整理成可交付的小成果',伤官:'提意见时先说事实与替代方案',正财:'逐项核对实际收支',偏财:'临时机会先估算成本',正官:'按明确规则安排步骤',七杀:'把压力任务拆成几个节点',正印:'先补齐资料与背景',偏印:'新思路先做小范围验证'};
    if(yi.length&&tenGodTask[ctx.shishen])yi[0].text+='；'+tenGodTask[ctx.shishen];
    if(join)yi.push({text:`先协调${join.pillar||'本命对应位置'}相关的配合与分工`,why:`今日地支与本命${join.pillar||'柱'}见合`,key:'relation'});
    if(clash)ji.push({text:`把${clash.pillar||'相关事务'}中不可逆的一步留到核实后`,why:`今日地支与本命${clash.pillar||'柱'}见${clash.type}`,key:'relation'});
    return{yi,ji,basis:`本命日柱 ${day.gan||''}${day.zhi||''} · 今日 ${fortune.dayGanZhi||''} · ${fortune.shishen||'十神未明'}；依据个人四维分数及本命与今日的刑冲合害。`,
      limit:'宜忌是个人盘的行动提醒，不是通书条目或可验证的吉凶预言。'};
  }
  return{make};
});
