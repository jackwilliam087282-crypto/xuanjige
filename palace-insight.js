/** 盘格白话释义：只解释本次已排出的符号，不作事件预言。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PalaceInsight=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const topics={命宫:'自己的性格、天赋、外貌气质、行事习惯与一生整体基调',兄弟:'兄弟姐妹、同辈朋友、合伙人及彼此分工和资源往来',夫妻:'亲密关系、伴侣特征、相处方式、承诺与婚姻议题',子女:'子女缘分、晚辈、学生、下属及养育和带领方式',财帛:'收入来源、赚钱方式、资源管理、花钱习惯与财务选择',疾厄:'身体照护、作息压力、健康习惯和风险意识；不能据此诊断疾病',迁移:'外出、远行、搬家、异地生活与在外合作的处境',仆役:'朋友、下属、员工、人脉、合作边界与团队关系',官禄:'事业、工作、学业、职责、专业能力与社会角色',田宅:'房产、家运、居住环境、家庭资源与固定资产',福德:'精神享受、休息方式、内在满足、潜意识与享用资源的方式',父母:'父母缘分、长辈、上司、支持系统与出身家庭'};
  const topicDetail={命宫:'这是十二宫的观察起点，常用来组织对自我风格的讨论；外貌和人生走向不能只凭一宫确定。',兄弟:'既看手足，也可借来讨论同辈关系中支持、竞争、距离与合作方式。',夫妻:'关注亲密关系的互动模式和期待，不把宫位解释成婚姻必然顺逆。',子女:'传统上兼看生育及子女；现代生活里也可讨论照顾晚辈、指导学生和带领团队。',财帛:'区分收入、支出和资源配置；它不是一张可直接预测资产数额的表。',疾厄:'只作传统生活主题索引；病症、治疗和风险评估应以专业医疗意见为准。',迁移:'讨论离开熟悉环境时的适应、外部机会与关系，而非规定出行吉凶。',仆役:'旧称仆役，也常称交友宫；适合观察朋友、同事和团队之间的信任与分工。',官禄:'旧称官禄，也可称事业宫；涵盖职业、责任、学习路径及社会评价。',田宅:'除房产之外，也关乎与居所和家庭资源的关系，不能据此判断产权或具体房价。',福德:'更侧重内在体验、休息与满足感，和财富并非同一件事。',父母:'可谈家庭背景与长辈互动，也延伸到上司、导师和帮助你的人。'};
  const stars={紫微:'组织与统筹',天机:'思考与变通',太阳:'表达与照拂',武曲:'执行与财务管理',天同:'协调与安适',廉贞:'原则与边界',天府:'储备与管理',太阴:'细致与积累',贪狼:'社交与尝试',巨门:'沟通与辨析',天相:'协作与规范',天梁:'照护与经验',七杀:'决断与开拓',破军:'调整与重建'};
  const doors={休门:'休整、修复与积累',生门:'生长与资源经营',伤门:'竞争和摩擦',杜门:'收束、保密与整理',景门:'展示、传播与形象',死门:'结束旧事与清理',惊门:'突发消息与警觉',开门:'沟通、开拓与启动'};
  const starWords={天蓬星:'流动与谋划',天芮星:'琐事与修整',天冲星:'行动与推进',天辅星:'学习与辅佐',天禽星:'居中与统合',天心星:'判断与筹划',天柱星:'表达与阻力',天任星:'承担与稳定',天英星:'表现与声望'};
  const starAdvice={紫微:'先明确主次和决策责任，授权时留下反馈机制',天机:'把新想法做成小规模试验，避免反复改方向',太阳:'在表达和帮助别人时留意自己的精力边界',武曲:'列清预算、现金流和执行步骤，再谈扩张',天同:'保留合作弹性，也给关键决定设期限',廉贞:'先说清规则与底线，减少模糊承诺',天府:'建立储备与台账，把现有资源管稳',太阴:'重视细节、长期积累与书面记录',贪狼:'利用社交和尝试寻找线索，同时控制分心',巨门:'重要事项多核对、多留书面证据',天相:'明确角色和流程，借团队协作推进',天梁:'向有经验者求证，也避免独自承担全部',七杀:'先评估代价和退出路径，再做果断选择',破军:'要改变旧模式时分阶段实施，预留缓冲'};
  const doorAdvice={休门:'宜先盘点和修整，再定下一步节奏',生门:'宜积累可持续资源，核算投入与回报',伤门:'竞争或摩擦容易成为讨论主题，先澄清边界和成本',杜门:'适合保密、收束资料与内部整理',景门:'适合把成果讲清楚，也要核对表面信息',死门:'适合结束无效环节与善后，不据字面联想到疾病或死亡',惊门:'遇到突发消息先核验来源，再决定如何回应',开门:'适合发起沟通与尝试，但要写清目标和条件'};
  const godWords={值符:'统筹与主导',螣蛇:'疑虑与反复',腾蛇:'疑虑与反复',太阴:'细节与隐蔽',六合:'协作与协调',白虎:'力度与冲突',玄武:'信息不明与核对',九地:'稳固与积累',九天:'扩展与远景'};
  const mutagenWords={禄:'资源与机会',权:'推动与掌控',科:'声誉与条理',忌:'牵挂与阻滞'};
  const starProfiles={紫微:'重统筹、主导与组织资源',天机:'重分析、策划与灵活调整',太阳:'重公开表达、服务与责任',武曲:'重执行、数字与财务纪律',天同:'重协调、体验与稳定节奏',廉贞:'重规则、边界与复杂关系',天府:'重储备、管理与长期经营',太阴:'重细节、积累与审美',贪狼:'重人脉、探索与多元机会',巨门:'重论证、沟通与辨别',天相:'重协作、制度与支持',天梁:'重经验、照护与公信',七杀:'重独立决断与开拓',破军:'重改革、转换与重新配置'};
  const palaceAction={命宫:'适合先辨认自己的工作节奏与擅长角色，不把“领导星”直接等同于必须创业',兄弟:'适合约定同辈合作的责任、钱和退出条件',夫妻:'适合把相处中的期待、边界和冲突处理方式讲清楚',子女:'适合观察带人、教学或照顾晚辈的方式',财帛:'适合核算主要收入来源、现金流和风险承受度',疾厄:'适合检视作息、压力和医疗检查安排',迁移:'适合评估异地机会的资源、成本和支持网络',仆役:'适合梳理朋友、员工与合作方的信任及分工',官禄:'适合把专业能力与岗位要求逐条对照',田宅:'适合盘点居住与家庭资产的实际责任',福德:'适合安排休息、兴趣和长期精神支持',父母:'适合看清长辈及上司能提供的支持与边界'};
  const mainOf=p=>(p?.stars||[]).map(s=>s.name);
  function palaceLine(p){
    if(!p)return '未排出';
    const names=mainOf(p);
    return `${p.name}（${p.branch}）${names.length?names.join('・'):'空宫'}`;
  }
  function focusOf(p){
    if(!p)return '尚无可读资料';
    const n=mainOf(p);
    if(!n.length)return '此宫无十四主星，需借对宫及三方四正观察，不能按空宫断为没有机会';
    return n.map(x=>starProfiles[x]||'另看该星传统象意').join('，并且');
  }
  function practical(p,kind){
    const names=mainOf(p),has=x=>names.includes(x);
    if(!names.length)return '无主星，宜借对宫星曜和实际处境观察，不能直接说好或坏';
    if(kind==='money'){
      if(has('武曲')&&has('天相'))return '偏向靠专业执行、规范管理与正业收入来积累，适合先管好账和稳定客户，而不是凭运气下注';
      if(has('武曲')||has('天府'))return '偏向靠技能、管理与长期储备获得资源，财务上适合预算和稳健经营';
      if(has('贪狼'))return '人脉与多元尝试可能是机会线索，但应控制投机和分心';
      if(has('太阴'))return '偏向细水长流的积累，适合长期记录、审慎配置和保留储蓄';
      if(has('廉贞')||has('巨门'))return '合同、规则与沟通是财务重点，收入判断前应先核对条款和成本';
      return `财务象意偏${focusOf(p)}；适合先辨认主要收入、现金流与可承受风险`;
    }
    if(kind==='career'){
      if(has('廉贞')&&has('天府'))return '适合制度、经营、资源管理一类有章法的工作；若想开店或创业，仍要先验证需求和现金流';
      if(has('紫微')&&has('天府'))return '适合统筹团队、管理项目与守住资源的岗位，先练决策和授权';
      if(has('天机'))return '适合策划、研究、咨询或需快速调整的工作，但要把想法落成可执行步骤';
      if(has('七杀')||has('破军'))return '适合有自主权、解决难题或变革的工作，同时要预留风险缓冲';
      if(has('太阳')||has('巨门'))return '适合表达、教学、沟通或对外服务，重要判断需以事实核对';
      return `事业象意偏${focusOf(p)}；可把相应能力与真实岗位要求逐条对照`;
    }
    if(kind==='love'){
      if(has('七杀'))return '关系里可能更重自主和直率，适合找能尊重边界、愿意坦诚协商的人；不据此断婚姻顺逆';
      if(has('贪狼'))return '互动和吸引力是主题，但要把短期热情与长期承诺区分开';
      if(has('太阴')||has('天同'))return '更看重照顾、情绪回应与相处舒适，适合明确表达需求';
      if(has('巨门')||has('廉贞'))return '对话与原则容易成为重点，分歧时宜先说清事实和界限';
      return `感情象意偏${focusOf(p)}；关键还是实际沟通和双方选择`;
    }
    if(kind==='travel'){
      if(has('贪狼'))return '异地社交、探索新圈子可能带来线索，适合主动拓展联系，同时筛选机会';
      if(has('天机')||has('破军'))return '外部变化多，适合试探新路径，但先算迁居与转换成本';
      return `在外象意偏${focusOf(p)}；出行与迁居仍以现实资源和安全条件为准`;
    }
    return focusOf(p);
  }
  function ziweiOverview(chart){
    if(!chart?.palaces)return '';
    const find=name=>chart.palaces.find(p=>p.name===name);
    const ming=find('命宫'),money=find('财帛'),career=find('官禄'),love=find('夫妻'),body=chart.palaces.find(p=>p.isBody);
    const tag=p=>p?`${p.branch}${mainOf(p).map(n=>{const s=p.stars.find(x=>x.name===n);return n+(s.mutagen?'化'+s.mutagen:'');}).join('、')||'空宫'}`:'未排出';
    return `命宫${tag(ming)}偏${focusOf(ming)}；官禄${tag(career)}提示${practical(career,'career')}。财帛${tag(money)}可参考${practical(money,'money')}。夫妻${tag(love)}偏${practical(love,'love')}。${body?`身宫在${body.name}（${body.branch}），${focusOf(body)}更值得长期留意。`:''}这些是传统象意，不能保证工作、收入或关系结果。`;
  }
  function topic(p){return{title:`${p.name}${p.branch?'（'+p.branch+'）':''}`,topic:topics[p.name]||'此宫所管的人事主题',body:topicDetail[p.name]||'此宫用于整理相应的人事主题。',source:'十二宫职责为传统紫微斗数的主题说明；这里只解释宫位，不解释本次排盘，也不作个人建议。'};}
  function ziwei(p,chart){
    const title=`${p.name}（${p.branch}）${p.isBody?' · 身宫':''}`;
    const listed=(p.stars||[]).map(s=>`${s.name}${s.mutagen?'化'+s.mutagen:''}${s.brightness?'（'+s.brightness+'）':''}`);
    const meanings=(p.stars||[]).map(s=>`${s.name}常用来观察${stars[s.name]||'该星所代表的主题'}${s.mutagen?'；本盘标记化'+s.mutagen:''}`);
    const opposite=(chart?.palaces||[]).find(x=>x.branch===['子午','丑未','寅申','卯酉','辰戌','巳亥'].map(x=>x.includes(p.branch)?x.replace(p.branch,''):'').find(Boolean));
    const body=listed.length?`本宫概括：${palaceLine(p)}。在“${topics[p.name]}”上，${(p.stars||[]).map(s=>`${s.name}偏${starProfiles[s.name]||stars[s.name]||'特定主题'}`).join('；')}。${p.stars.length>1?`双星同宫，要把${mainOf(p).join('与')}一起看，不能只摘一颗星下结论。`:''}${(p.stars||[]).filter(s=>s.mutagen).map(s=>`${s.name}化${s.mutagen}，把${mutagenWords[s.mutagen]||'变化'}议题提到前面`).join('；')}${p.minor?.length?`；辅星${p.minor.slice(0,4).join('、')}会修饰表达方式。`:''}${p.isBody?'身宫也在这里，可把此主题列为更常投入精力的领域。':''}\n\n可参考的方向：${(p.stars||[]).map(s=>starAdvice[s.name]).filter(Boolean).join('；')||'先记录实际处境，再判断如何行动'}；${palaceAction[p.name]||'先核对现实条件'}。`:
      `本宫概括：${palaceLine(p)}。这里没有十四主星，不等于这方面没有生活内容。${opposite?`对宫${palaceLine(opposite)}，可借其星曜观察相对的人事与资源。`:'可借对宫以及三方四正观察。'}${p.minor?.length?`本宫另有辅星${p.minor.slice(0,4).join('、')}。`:''}\n\n可参考的方向：${palaceAction[p.name]||'先核对现实条件'}；不要因“空宫”二字直接判好坏。`;
    const minorWords={天魁:'长辈或制度资源的支持',天钺:'贵人与协助的线索',左辅:'协作与辅佐',右弼:'同伴支持',文昌:'文字与学习',文曲:'表达与审美',禄存:'资源保存',擎羊:'摩擦与推进成本',陀罗:'拖延与反复',火星:'行动急、投入快',铃星:'急迫与警觉',地空:'落空感与精神探索',地劫:'资源损耗与取舍',天马:'奔波与流动'};
    const has=n=>(p.stars||[]).some(s=>s.name===n),minor=n=>(p.minor||[]).includes(n),trans=(n,m)=>(p.stars||[]).some(s=>s.name===n&&s.mutagen===m);
    const blends=[];
    if(p.name==='命宫'&&has('廉贞')&&minor('天钺'))blends.push('廉贞的规则意识遇到天钺的协助线索，可把坚持原则与向有经验者请教结合；有主见时也保留被提醒的空间');
    if(p.name==='官禄'&&has('武曲')&&has('天府'))blends.push(`武曲重执行和财务纪律，天府重储备与管理${trans('武曲','禄')?'；武曲化禄又把资源获取放大为本宫主题':''}：可考虑以专业技能、项目管理或长期经营积累成果，而不是据此断定必然创业成功`);
    if(p.name==='财帛'&&has('紫微')&&has('天相'))blends.push(`紫微偏统筹，天相偏制度与协作：赚钱议题可放在平台、团队和规范分工中观察${minor('火星')?'；火星提醒行动容易偏急，大额投入前先做预算和止损线':''}`);
    if(p.name==='迁移'&&trans('贪狼','权'))blends.push('贪狼的社交探索加上化权的主动推动，在外部接触与争取机会时可能更有发挥空间；先筛选对象、计算往返成本，不能直接断言异地一定更好');
    if(p.name==='福德'&&p.isBody&&has('破军'))blends.push(`身宫落福德，长期投入与内在满足值得留意；破军偏求新与重建${minor('地空')?'，地空可引出空落感、精神探索等象意':''}。可安排稳定的休息与试新节奏，不把好奇心误当成现实结论`);
    if(p.name==='夫妻'&&has('七杀'))blends.push('七杀强调独立和决断，亲密关系里更适合把自主空间、共同责任和争执后的修复方式说清楚');
    if(p.name==='仆役'&&(minor('左辅')||minor('右弼')))blends.push('辅弼在交友与团队主题下，重点是有人配合时如何分权、反馈与确认责任，而非“贵人一定会来”');
    if(p.name==='田宅'&&has('天府'))blends.push('天府的储备象意落在田宅，更适合讨论居所维护、家庭账目与长期资产安排；产权与价格仍须看现实资料');
    const relevant=p.name==='财帛'?practical(p,'money'):p.name==='官禄'?practical(p,'career'):p.name==='夫妻'?practical(p,'love'):p.name==='迁移'?practical(p,'travel'):p.name==='福德'?`精神与休息方式偏${focusOf(p)}；宜观察什么能带来真实满足，不必把财富等同于安宁`:p.name==='命宫'?`行事方式偏${focusOf(p)}；把优势放在适合自己的角色，同时留意过度用力的地方`:`在${topics[p.name]}方面，${focusOf(p)}；先对照真实关系与资源再作选择`;
    const minors=(p.minor||[]).map(x=>`${x}提示${minorWords[x]||'需要结合本宫主题再看'}`).join('；');
    const local=`\n\n本宫合看：${listed.length?`本宫${listed.join('、')}，${relevant}。`:`本宫无十四主星，${opposite?`借对宫${palaceLine(opposite)}观察相关人事，但对宫与本宫并非同一主题。`:'须合看对宫与三方四正。'}`}${minors?`辅星方面，${minors}。`:''}${blends.length?`叠加来看，${blends.join('；')}。`:''}${p.isBody?`身宫落此宫，说明${topics[p.name]}也是持续投入的主题；不表示一定发生某事。`:''}\n建议：${palaceAction[p.name]||'结合现实条件作判断'}。`;
    return{title,topic:topics[p.name]||'此宫所管的人事主题',body:body+local,source:'位置、星曜、四化、辅星与身宫来自本次 iztro 排盘；白话为传统象意的主题化转述，并非事实预测。'};
  }
  function qimen(p){
    const title=`${p.trigram}${p.number} · ${p.direction}`;
    if(p.number===5)return{title,topic:'九宫的中心位置',body:'中五宫为空是本次排盘的正常规则：这里不布八门、九星与八神。它不代表“事情空了”或漏算；读盘时看其余八宫的实际配置。',source:'位置与空宫规则来自本次时家奇门盘。'};
    const starDetail={天心星:'传统多与判断、筹划、专业技术及管理相关',天任星:'偏稳定、承担与长期执行',天辅星:'偏学习、辅佐与文书',天冲星:'偏行动、速度与突破',天英星:'偏表现、传播与可见度',天蓬星:'偏流动、冒险与信息复杂',天芮星:'偏修整、琐事与照护',天柱星:'偏言语、阻力与原则',天禽星:'偏居中、统合与协调'};
    const doorDetail={开门:'传统列为吉门，象意是开启、公开、沟通和事业启动',生门:'传统列为吉门，象意是生长、资源与求财机会',休门:'传统列为吉门，象意是休整、积累与恢复',景门:'偏展示、宣传和形象',杜门:'偏封存、保密与内部整理',伤门:'偏竞争、冲突与行动成本',惊门:'偏突发消息、警觉与核验',死门:'偏结束、清理和善后',中门:'此库在该宫使用中门标记，需按本库排法理解，不能当作八门中的吉凶门'};
    const godDetail={九地:'偏稳固、低调与长期积累',九天:'偏向扩展、视野与远行',值符:'八神之首，偏主导者、统筹与决策',六合:'偏协作、媒合与关系',太阴:'偏细节、隐蔽与准备',白虎:'偏强硬、竞争和摩擦成本',玄武:'偏信息不明、保密和核验',腾蛇:'偏疑虑、反复与想象',螣蛇:'偏疑虑、反复与想象'};
    const blend=p.door==='开门'&&p.star==='天心星'&&p.god==='九地'?'有判断和专业能力的人，以公开沟通打开一项长期事业，先把流程和资源做稳':
      p.door==='生门'&&p.god==='白虎'?'资源增长是这宫的主题，但白虎提示竞争与执行代价；先核算成本，再谈扩张':
      p.god==='值符'?`主导与决策是这宫的突出主题；${p.door==='中门'?'先看其他八宫的具体门星，再决定怎样推动':'行动方式仍要回到'+p.door+'的具体象意'}`:
      `${p.star||'九星'}提供“${starWords[p.star]||'当前状态'}”线索，${p.door||'八门'}提示“${doors[p.door]||'行动方式'}”，${p.god||'八神'}补充“${godWords[p.god]||'环境'}”；三者合看，比单凭某一个吉字或凶字更稳妥`;
    const body=`本宫组合：${p.direction}${p.trigram}${p.number}宫，${p.star||'无星'}＋${p.door||'无门'}＋${p.god||'无神'}。\n\n${p.star}：${starDetail[p.star]||'需结合本盘与所用流派观察'}。\n${p.door}：${doorDetail[p.door]||'需结合本盘与所用流派观察'}。\n${p.god}：${godDetail[p.god]||'补充环境与人事线索'}。\n天盘${p.skyGan||'—'}／地盘${p.groundGan||'—'}：分别记录此时天盘与地盘的天干，并非单凭两个字就能判断成败。\n\n三层合看：${blend}。若把方位用于自我观察，${p.direction}位可提醒你关注上述主题，不意味着往该方向行动一定获利或遇贵人。建议：${doorAdvice[p.door]||'先明确目标与实际条件'}，再核对成本、合作者和当前时机。`;
    return{title,topic:`本次${p.direction}位的门、星、神与天地盘`,body,source:'位置、干、星、门、神来自本次 @yhjs/dunjia 时家奇门盘；八门和九星主题参照该排盘体系，解释不是方位吉凶保证。'};
  }
  function liuyao(ly){
    const moving=(ly.lines||[]).map((v,i)=>v===6||v===9?i+1:0).filter(Boolean);
    return `本次由十八枚虚拟钱面组成六爻，自下而上为${(ly.lines||[]).join('、')}；第${moving.join('、')||'无'}爻为动爻。本卦「${ly.name}」表示本次抽得的起始卦象，${ly.changed&&ly.changed!=='无变卦'?`动爻变化后为「${ly.changed}」`:'没有变卦'}。可把卦辞和动爻当作反思当前处境的线索；由于没有具体事项与用神，不能据此推出事业、感情或财务的成败。`;
  }
  function liuyaoDetail(ly){
    const moving=(ly.movingText||[]).filter(x=>x.pos<=6);
    const rel={父母:'文书、长辈与庇护',兄弟:'同辈、同行与资源分配',子孙:'晚辈、舒缓与解决压力',妻财:'钱物与现实资源',官鬼:'职责、约束与压力'};
    const motifs=[[/密云不雨/,'乌云聚起，却还没有下雨：准备在形成，结果尚未落地'],[/复自道/,'回到自己原来走的正路，重点是纠偏而非强闯'],[/牵复/,'被牵引着一起返回，适合借助已有联系调整方向'],[/血去惕出/,'伤害与惊惧渐退，先确认风险确已解除'],[/潜龙勿用/,'龙还潜在水下，暂不急于展露或动用全部力量'],[/见龙在田/,'龙已出现于田野，可以让可靠的人看见能力'],[/飞龙在天/,'龙升到高处，提示能力发挥也要承担相应责任'],[/亢龙有悔/,'升得过高会后悔，越顺利越要留意过度扩张'],[/履霜/,'踩到薄霜，提醒留意小迹象及其后续发展'],[/直方大/,'行为正直、方正而宽大，可从清楚的原则入手'],[/旅琐琐/,'旅途中被琐碎之事困住，先整理随身资源和边界'],[/不利涉大川/,'不适合贸然渡河：先检查行动条件与风险'],[/利涉大川/,'适合渡过大河的形象，但动身前仍须备足条件'],[/勿用/,'文字说暂且不要采取该行动，可考虑等待或更换做法'],[/有孚/,'“孚”强调可信与诚意，可先核对承诺是否能兑现'],[/归/,'“归”有返回、归属之意，核对该回到哪里'],[/往/,'“往”指向外行动，先看原文是否为此附加条件'],[/来/,'“来”指回到当前一方，宜观察资源与人是否归位']];
    const verdicts=[[/无咎/,'“无咎”是没有过失，不等于一定成功'],[/凶/,'“凶”提示代价或阻力，宜准备退路'],[/吉/,'“吉”是经文的有利判断，仍须满足该句条件'],[/悔/,'“悔”提示反省与修正'],[/吝/,'“吝”提示局促、遗憾或难以伸展'],[/贞/,'“贞”强调持守与审慎']];
    const explain=t=>{const s=t||'';const a=motifs.filter(([re])=>re.test(s)).slice(0,2).map(x=>x[1]);const b=verdicts.filter(([re])=>re.test(s)).slice(0,1).map(x=>x[1]);return a.concat(b).join('；')||`原文写“${s.replace(/[。，；].*$/,'').slice(0,16)}”，这句的对象、行动与结果须合在一起读；目前没有可核实的逐句今译，不据此补造事件`;};
    const parts=[`本卦「${ly.name}」卦辞：${ly.guaci||'本次未保存卦辞原文'}。\n白话：${explain(ly.guaci)}。${ly.culture?`通行文化释义：${ly.culture}`:''}`];
    for(const y of moving){
      const row=(ly.yaos||[]).find(x=>x.pos===y.pos)||{};
      const line=`${y.title||y.posName}：「${y.text||'原文待核'}」。\n白话：${explain(y.text)}。${row.liuqin?`本爻纳甲${row.ganZhi||''}、六亲${row.liuqin}（传统上对应${rel[row.liuqin]||'相应人事'}）`:''}${row.bianLiuqin?`，变后为${row.bianGanZhi||''}${row.bianLiuqin}；这是盘内关系变化，不等于现实事件已经发生`:''}${row.isShi?'；此爻为世爻，标记占者位置':''}${row.isYou?'；此爻为应爻，标记所对照的一方':''}。建议：围绕这句爻辞的行动、条件和后果，核对自己能证实的事实。`;
      parts.push(line);
    }
    if(!moving.length)parts.push('本次没有动爻：没有需要逐条解释的动爻爻辞，重点仍是本卦卦辞与当前实际问题。');
    const shi=(ly.yaos||[]).find(x=>x.isShi),ying=(ly.yaos||[]).find(x=>x.isYou);
    if(shi||ying)parts.push(`世应：${shi?`${shi.posName}世爻为${shi.ganZhi}${shi.liuqin}`:'世爻未保存'}；${ying?`${ying.posName}应爻为${ying.ganZhi}${ying.liuqin}`:'应爻未保存'}。世应只是本盘角色标记；未给出具体占问对象，不能擅自指认为某个人。`);
    if(ly.changed&&ly.changed!=='无变卦')parts.push(`变卦「${ly.changed}」卦辞：${ly.changedGuaci||'原文待核'}。\n白话：${explain(ly.changedGuaci)}。${ly.changedCulture||''} 变卦是变化后的象征性观察方向，并非既定结局。`);
    parts.push(`行动建议：先从${moving.length?`第${moving.map(x=>x.pos).join('、')}爻所说的条件与结果`:'本卦卦辞'}中找出能够核实的一项，再决定是推进、调整还是暂缓；保留代价与退路的记录。没有具体事项与用神，不能推断某段纠纷、收入、疾病或应期。`);
    return parts.join('\n\n');
  }
  function open(info){
    if(typeof document==='undefined')return;document.getElementById('palace-insight-dialog')?.remove();
    const mask=document.createElement('div');mask.id='palace-insight-dialog';mask.className='palace-dialog';mask.setAttribute('role','dialog');mask.setAttribute('aria-modal','true');
    const card=document.createElement('div');card.className='palace-dialog-card';
    const close=document.createElement('button');close.type='button';close.className='palace-dialog-close';close.textContent='×';close.setAttribute('aria-label','关闭解释');
    const h=document.createElement('h2');h.textContent=info.title;const topic=document.createElement('p');topic.className='palace-topic';topic.textContent='看什么：'+info.topic;
    const body=document.createElement('p');body.style.whiteSpace='pre-line';body.textContent=info.body;const source=document.createElement('small');source.textContent=info.source;
    card.append(close,h,topic,body,source);mask.appendChild(card);document.body.appendChild(mask);
    const end=()=>mask.remove();close.onclick=end;mask.onclick=e=>{if(e.target===mask)end();};close.focus();
  }
  return{topics,topic,ziwei,ziweiOverview,qimen,liuyao,liuyaoDetail,open};
});
