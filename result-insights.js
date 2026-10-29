/** 展示层解释：不修改合盘与九宫计算结果。 */
(function(root){'use strict';
const wx={甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'},sheng={木:'火',火:'土',土:'金',金:'水',水:'木'},ke={木:'土',土:'水',水:'火',火:'金',金:'木'};
const manner={木:'把成长计划讲清楚，约定下一步怎么做',火:'先表达感受，再给对方回应时间',土:'把生活安排与承诺落到实处，同时留出调整余地',金:'讲清规则和底线，也听完对方的理由',水:'把真实需求说出来，别让对方一直猜'};
function sex(p){return p?.gender==='女'||p?.gender==='female'?'女方':p?.gender==='男'||p?.gender==='male'?'男方':'性别未录入';}
function labels(r){const ps=[r.a||{},r.b||{}],s=ps.map(sex);return ps.map((p,i)=>s[i]==='性别未录入'?'第'+(i+1)+'位（性别未录入）':s[0]===s[1]?s[i]+'（'+(!/^(甲方|乙方)$/.test(p.name||'')&&p.name?p.name:i?'右侧':'左侧')+'）':s[i]);}
function replaceAB(text,r){const ls=labels(r);return String(text||'').replace(/A方/g,ls[0]).replace(/B方/g,ls[1]).replace(/A生B/g,ls[0]+'生'+ls[1]).replace(/B生A/g,ls[1]+'生'+ls[0]).replace(/A克B/g,ls[0]+'克'+ls[1]).replace(/B克A/g,ls[1]+'克'+ls[0]);}
function relationLabel(r){return replaceAB(r.dayMasterRel?.rel||'未提供',r);}
function relationText(r){const ls=labels(r),a=wx[r.a?.dayGan],b=wx[r.b?.dayGan],rel=r.dayMasterRel?.rel;
if(rel==='A克B'||rel==='B克A'){const i=rel==='A克B'?0:1;return ls[i]+'日主属'+(i?b:a)+'，'+ls[1-i]+'日主属'+(i?a:b)+'；五行上'+relationLabel(r)+'。这里的“克”是五行制约关系，不表示谁一定强势、谁会伤害谁。相处时，提出标准的一方要给对方表达空间，另一方要明确自己的底线。';}
if(rel==='A生B'||rel==='B生A'){const i=rel==='A生B'?0:1;return ls[i]+'的'+(i?b:a)+'生'+ls[1-i]+'的'+(i?a:b)+'，即'+relationLabel(r)+'。可把它理解为支持与承接的线索：支持的一方别包办，得到支持的一方主动回应；实际谁付出更多还要看生活中的分工。';}
return '双方日主分别为'+r.a?.dayGan+'（'+a+'）与'+r.b?.dayGan+'（'+b+'），关系为'+relationLabel(r)+'。同类象意可参考为习惯相近，但也要保留各自做事的方法，不把相近当作一定合得来。';
}
function branch(r,i){const mine=i?r.b:r.a,other=i?r.a:r.b,l=labels(r),rel=r.dayZhiRel;
const own=manner[wx[mine?.dayGan]]||'说清自己的习惯与需求';
if(rel==='无明显关系')return '你的日支'+mine.dayZhi+'与'+l[1-i]+'日支'+other.dayZhi+'在当前规则中未命中合、冲、刑、害、破。这一项不能直接说明关系平稳。对你更实用的做法是：'+own+'，再核对对方能否接受。';
const tips={合:'相合可以作为靠近、配合的线索；你主动把共同目标说具体，别因为熟悉就省略确认',冲:'相冲可作为节奏差异的线索；你先讲自己的安排，别要求对方立刻照办',刑:'相刑可提醒反复较劲；你把分歧限定在当前一件事，不翻旧账',害:'相害可提醒容易误解；你把不满明说，少用试探或暗示',破:'相破可提醒小事打断计划；你先约定变更和失约后怎么补救'};
return '你的日支'+mine.dayZhi+'与'+l[1-i]+'日支'+other.dayZhi+'为'+rel+'。'+(tips[rel]||'先对照实际生活中的分工与沟通')+'。';
}
function personal(r,i){const p=i?r.b:r.a,q=i?r.a:r.b,l=labels(r),e=wx[p.dayGan],oe=wx[q.dayGan],top=Object.entries(p.wuxing||{}).sort((a,b)=>b[1]-a[1])[0];return l[i]+' · 日主'+p.dayGan+'（'+e+'），日支'+p.dayZhi+'。盘面侧重：'+(top?top[0]+'占比最高，为'+Number(top[1]).toFixed(1)+'%。':'未提供五行比例。')+' 与'+l[1-i]+'日主'+q.dayGan+'（'+oe+'）对照，五行关系是'+relationLabel(r)+'。这个方向来自日干五行生克，不代表生活里谁一定强势；日支配对在下方单独说明。';}
function branchPair(r){const l=labels(r),z=r.dayZhiRel;const meanings={合:'两支命中相合规则，传统上看重靠近与配合；合不等于没有分歧，也不是婚姻保证',冲:'两支命中相冲规则，传统上看重节奏、习惯或安排的对立；冲不等于一定分开',刑:'两支命中相刑规则，传统上看重反复较劲与内耗',害:'两支命中相害规则，传统上看重隐性误会与互相牵制',破:'两支命中相破规则，传统上看重计划容易被小事打断'};return l[0]+'日支'+r.a.dayZhi+'，'+l[1]+'日支'+r.b.dayZhi+'。核对结果：'+z+'。'+(meanings[z]||'当前规则没有命中合、冲、刑、害、破；这只说明这一组日支没有这些特定结构，不能推出感情必然平稳。')+'。本框只解释日支这一个配对依据，不重复日主生克结论。';}
function coupleAdvice(r){const l=labels(r),rel=r.dayMasterRel?.rel,actor=/^A/.test(rel||'')?0:1;const own=[0,1].map(i=>{let t;if(/克/.test(rel||''))t=i===actor?'注意别把建议说成命令。谈钱、工作和家庭安排前，先问对方怎么想；把你担心的风险讲清，再一起决定，别替对方拍板。':'注意别为了息事宁人什么都答应。不同意就说清原因和可接受的方案，别攒着不满突然爆发；给出自己的选择，而不是只说随便。';else if(/生/.test(rel||''))t=i===actor?'注意别越帮越累、最后觉得委屈。帮忙前问对方需要哪一件，约好你能承担到哪里；自己的休息和计划也要保留。':'注意别把对方的照顾当成默认安排。收到帮助要回应，也主动接手一项具体责任；需要什么直接说，别让对方猜。';else t=i===0?'注意别把习惯相近当作对方必须同意。遇到分歧先听完，再轮流决定小事；重要安排把各自理由摆出来。':'注意别因为熟悉就省掉表达。自己的需求当天说清，对方做得好也及时肯定；分工写具体，别只靠默契。';return l[i]+'：'+t;});const z=r.dayZhiRel;const joint=z==='冲'?'两人一起：日程冲突先协调时间，争执时暂停二十分钟再谈；不在情绪最高的时候做分手、借钱或搬家的决定。':z==='刑'?'两人一起：一次只解决一件事，不翻旧账、不互相打分；说清这次要改哪一个行为，下周一起看看有没有改善。':z==='害'?'两人一起：不靠试探和冷脸传话。听到不舒服的话，先确认对方原意，再说自己的感受。':z==='破'?'两人一起：约定变更要提前说，失约要有补救；把能做到的小承诺做稳，比说大话更管用。':z==='合'?'两人一起：共同目标可以一起推进，但各自保留朋友、兴趣和独处时间；每周聊一次钱、家务和近期压力。':'两人一起：这组日支没有明显刑冲合，先从真实生活建立配合。每周留半小时聊开销、家务和彼此最累的一件事，定下一周各自负责的事情。';return own.concat(joint,'大白话：别争谁压过谁。要求讲清楚，付出有回应，分工能兑现；遇到问题就修正做法，不能拿五行关系给对方贴标签。');}
function hepan(r){const l=labels(r),v={...r};v.a={...r.a,name:l[0]+(!/^(甲方|乙方)$/.test(r.a.name)&&r.a.name?' · '+r.a.name:'')};v.b={...r.b,name:l[1]+(!/^(甲方|乙方)$/.test(r.b.name)&&r.b.name?' · '+r.b.name:'')};
v.dayMasterRel={...r.dayMasterRel,rel:relationLabel(r),text:relationText(r)};v.dayRelText=branchPair(r);v.dimensions=(r.dimensions||[]).map(d=>({...d,fact:replaceAB(d.fact,r),text:d.key==='dayMaster'?relationText(r):replaceAB(d.text,r),note:replaceAB(d.note,r)}));v.complement=(r.complement||[]).map(c=>({...c,text:replaceAB(c.text,r)}));v.advice=coupleAdvice(r);return v;}
const palaceMap={1:['坎','北','水','核对信息、风险与退路','先列出还没核实的信息，给每一步留出回退空间'],2:['坤','西南','土','承接任务、后勤与协作','确认谁承接、谁负责收尾，别把所有责任揽过来'],3:['震','东','木','启动、行动与变化','先启动一个小步骤，明确负责人和反馈时间'],4:['巽','东南','木','沟通、流程与渐进','拆开沟通顺序，先取得小范围确认，再推进下一步'],5:['中宫','中央','土','统筹与平衡','核对目标、资源和分工是否对得上，不另起一套八卦吉凶'],6:['乾','西北','金','规则、决策与权限','核对谁有决定权，把标准、合同和授权说清'],7:['兑','西','金','交流、协商与兑现','把口头承诺落实为具体条件，确认双方理解一致'],8:['艮','东北','土','边界、停顿与复核','先明确做到哪里该停，完成复核再追加投入'],9:['离','南','火','表达、可见成果与文书','把成果和证据整理出来，表达清楚，避免只求声势']};
function palaceDetail(r,n){const [gua,dir,e,theme,tip]=palaceMap[n],roles=[];
if(gua===r.useGuaPos)roles.push('用卦落位（所问事项的实际落位）');
if(gua===r.testGua)roles.push('验卦（当前条件的取象）');
if(gua===r.timeGua)roles.push('时卦（本次时间取象）');
let t='洛书'+n+'宫 · '+gua+' · '+dir+' · '+e+'。传统象意侧重'+theme+'。';
if(r.coins){const cs=r.coins.filter(c=>c.num===n);t+=cs.length?' 本次落入这里的是'+cs.map(c=>'第'+c.idx+'项，原始数'+c.rawNum+'，层'+c.layer+'，卦'+c.gua+'，记录为'+c.level+'；依据：'+c.relText).join('；')+'。':' 本次六项没有落入此宫，不为它追加个人吉凶判断。';}
else{t+=roles.length?' 本次该宫承担：'+roles.join('、')+'。':' 本次用卦落位、验卦、时卦都不在此宫，它是参照宫。';
if(n!==5&&r.useElem){const u=r.useElem;let compare;
if(e===u)compare='本宫'+e+'与用卦'+r.useGua+'的'+u+'同类，可用于比较资源相近时怎样分工';
else if(sheng[e]===u)compare='本宫'+e+'生用卦'+r.useGua+'的'+u+'，可参考为此处向目标提供支持，也需要估算付出成本';
else if(sheng[u]===e)compare='用卦'+r.useGua+'的'+u+'生本宫'+e+'，可参考为目标资源流向此处，需要核对是否会分散投入';
else if(ke[e]===u)compare='本宫'+e+'克用卦'+r.useGua+'的'+u+'，可参考为要求与限制，先核对权限、条件和底线';
else compare='用卦'+r.useGua+'的'+u+'克本宫'+e+'，可参考为目标约束此处的安排，先明确可调整的范围';
t+=' 局部对照：'+compare+'。';}else if(n===5)t+=' 中宫没有独立八卦，不能把它当成另一个用卦或验卦。';}
return t+' 大白话：'+tip+'。'+(roles.length?'先结合本宫承担的实际角色检查上述事项。':'这是一种宫位对照提示，不替代本页原有测算结果。');
}
const api={labels,replaceAB,relationLabel,relationText,personal,hepan,palaceDetail,palaceMap};root.ResultInsights=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
