/** 开始测算：先完成各自的计算，再以 45 秒星象场景逐步揭示。 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.TransitionFX=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const TOTAL=45000;
  const VOICE_TIMING=[
  {
    "text": "太极生两仪",
    "start": 0,
    "end": 1.7,
    "chars": [
      {
        "char": "太",
        "start": 0,
        "end": 0.34
      },
      {
        "char": "极",
        "start": 0.34,
        "end": 0.6
      },
      {
        "char": "生",
        "start": 0.6,
        "end": 0.82
      },
      {
        "char": "两",
        "start": 0.82,
        "end": 1.02
      },
      {
        "char": "仪",
        "start": 1.02,
        "end": 1.4
      }
    ]
  },
  {
    "text": "两仪生三才",
    "start": 1.7,
    "end": 3.04,
    "chars": [
      {
        "char": "两",
        "start": 1.7,
        "end": 1.8
      },
      {
        "char": "仪",
        "start": 1.8,
        "end": 1.98
      },
      {
        "char": "生",
        "start": 1.98,
        "end": 2.2
      },
      {
        "char": "三",
        "start": 2.2,
        "end": 2.44
      },
      {
        "char": "才",
        "start": 2.44,
        "end": 2.68
      }
    ]
  },
  {
    "text": "三才生四象",
    "start": 3.04,
    "end": 4.34,
    "chars": [
      {
        "char": "三",
        "start": 3.04,
        "end": 3.12
      },
      {
        "char": "才",
        "start": 3.12,
        "end": 3.3
      },
      {
        "char": "生",
        "start": 3.3,
        "end": 3.52
      },
      {
        "char": "四",
        "start": 3.52,
        "end": 3.74
      },
      {
        "char": "象",
        "start": 3.74,
        "end": 3.96
      }
    ]
  },
  {
    "text": "四象生五行",
    "start": 4.34,
    "end": 5.9,
    "chars": [
      {
        "char": "四",
        "start": 4.34,
        "end": 4.52
      },
      {
        "char": "象",
        "start": 4.52,
        "end": 4.74
      },
      {
        "char": "生",
        "start": 4.74,
        "end": 5.1
      },
      {
        "char": "五",
        "start": 5.1,
        "end": 5.26
      },
      {
        "char": "行",
        "start": 5.26,
        "end": 5.54
      }
    ]
  },
  {
    "text": "五行生六合",
    "start": 5.9,
    "end": 7.24,
    "chars": [
      {
        "char": "五",
        "start": 5.9,
        "end": 5.94
      },
      {
        "char": "行",
        "start": 5.94,
        "end": 6.16
      },
      {
        "char": "生",
        "start": 6.16,
        "end": 6.44
      },
      {
        "char": "六",
        "start": 6.44,
        "end": 6.62
      },
      {
        "char": "合",
        "start": 6.62,
        "end": 6.96
      }
    ]
  },
  {
    "text": "六合生七星",
    "start": 7.24,
    "end": 8.72,
    "chars": [
      {
        "char": "六",
        "start": 7.24,
        "end": 7.28
      },
      {
        "char": "合",
        "start": 7.28,
        "end": 7.56
      },
      {
        "char": "生",
        "start": 7.56,
        "end": 7.82
      },
      {
        "char": "七",
        "start": 7.82,
        "end": 8.06
      },
      {
        "char": "星",
        "start": 8.06,
        "end": 8.32
      }
    ]
  },
  {
    "text": "七星生八卦",
    "start": 8.72,
    "end": 10.18,
    "chars": [
      {
        "char": "七",
        "start": 8.72,
        "end": 8.94
      },
      {
        "char": "星",
        "start": 8.94,
        "end": 9.14
      },
      {
        "char": "生",
        "start": 9.14,
        "end": 9.36
      },
      {
        "char": "八",
        "start": 9.36,
        "end": 9.64
      },
      {
        "char": "卦",
        "start": 9.64,
        "end": 9.88
      }
    ]
  },
  {
    "text": "八卦生九宫",
    "start": 10.18,
    "end": 11.7,
    "chars": [
      {
        "char": "八",
        "start": 10.18,
        "end": 10.3
      },
      {
        "char": "卦",
        "start": 10.3,
        "end": 10.5
      },
      {
        "char": "生",
        "start": 10.5,
        "end": 10.82
      },
      {
        "char": "九",
        "start": 10.82,
        "end": 11.04
      },
      {
        "char": "宫",
        "start": 11.04,
        "end": 11.28
      }
    ]
  },
  {
    "text": "十方定乾坤",
    "start": 11.7,
    "end": 13.14,
    "chars": [
      {
        "char": "十",
        "start": 11.7,
        "end": 11.96
      },
      {
        "char": "方",
        "start": 11.96,
        "end": 12.06
      },
      {
        "char": "定",
        "start": 12.06,
        "end": 12.28
      },
      {
        "char": "乾",
        "start": 12.28,
        "end": 12.54
      },
      {
        "char": "坤",
        "start": 12.54,
        "end": 12.86
      }
    ]
  },
  {
    "text": "阴阳顺逆妙难穷",
    "start": 13.14,
    "end": 15.16,
    "chars": [
      {
        "char": "阴",
        "start": 13.14,
        "end": 13.3
      },
      {
        "char": "阳",
        "start": 13.3,
        "end": 13.5
      },
      {
        "char": "顺",
        "start": 13.5,
        "end": 13.78
      },
      {
        "char": "逆",
        "start": 13.78,
        "end": 13.96
      },
      {
        "char": "妙",
        "start": 13.96,
        "end": 14.24
      },
      {
        "char": "难",
        "start": 14.24,
        "end": 14.36
      },
      {
        "char": "穷",
        "start": 14.36,
        "end": 14.7
      }
    ]
  },
  {
    "text": "二至还归一九宫",
    "start": 15.16,
    "end": 16.84,
    "chars": [
      {
        "char": "二",
        "start": 15.16,
        "end": 15.28
      },
      {
        "char": "至",
        "start": 15.28,
        "end": 15.38
      },
      {
        "char": "还",
        "start": 15.38,
        "end": 15.6
      },
      {
        "char": "归",
        "start": 15.6,
        "end": 15.82
      },
      {
        "char": "一",
        "start": 15.82,
        "end": 16.04
      },
      {
        "char": "九",
        "start": 16.04,
        "end": 16.26
      },
      {
        "char": "宫",
        "start": 16.26,
        "end": 16.52
      }
    ]
  },
  {
    "text": "若能了述阴阳理",
    "start": 16.84,
    "end": 18.48,
    "chars": [
      {
        "char": "若",
        "start": 16.84,
        "end": 17
      },
      {
        "char": "能",
        "start": 17,
        "end": 17.12
      },
      {
        "char": "了",
        "start": 17.12,
        "end": 17.3
      },
      {
        "char": "述",
        "start": 17.3,
        "end": 17.54
      },
      {
        "char": "阴",
        "start": 17.54,
        "end": 17.72
      },
      {
        "char": "阳",
        "start": 17.72,
        "end": 17.92
      },
      {
        "char": "理",
        "start": 17.92,
        "end": 18.18
      }
    ]
  },
  {
    "text": "天地都在一掌中",
    "start": 18.48,
    "end": 19.8,
    "chars": [
      {
        "char": "天",
        "start": 18.48,
        "end": 18.64
      },
      {
        "char": "地",
        "start": 18.64,
        "end": 18.74
      },
      {
        "char": "都",
        "start": 18.74,
        "end": 18.92
      },
      {
        "char": "在",
        "start": 18.92,
        "end": 19.1
      },
      {
        "char": "一",
        "start": 19.1,
        "end": 19.26
      },
      {
        "char": "掌",
        "start": 19.26,
        "end": 19.44
      },
      {
        "char": "中",
        "start": 19.44,
        "end": 19.66
      }
    ]
  }
];
  const VOICE_DURATION=20700;
  const STAGES=[
    {at:0,title:'太极生两仪',note:'阴阳初分 · 星河聚于一心',symbol:'☯'},
    {at:3500,title:'两仪生三才',note:'天 · 地 · 人，三才列位',symbol:'三'},
    {at:7000,title:'三才生四象',note:'阴阳再分，四象渐明',symbol:'四'},
    {at:10500,title:'四象生五行',note:'木火土金水 · 四柱五行显现',symbol:'五'},
    {at:14000,title:'五行生六合',note:'干支相参 · 六向相合',symbol:'合'},
    {at:17500,title:'六合生七星',note:'七星定序 · 生辰四柱列位',symbol:'✦'},
    {at:21000,title:'七星生八卦',note:'十八枚铜钱，六爻成卦',symbol:'卦'},
    {at:24500,title:'八卦生九宫',note:'先安紫微十二宫，再起时家奇门九宫',symbol:'宫'},
    {at:28000,title:'十方定乾坤',note:'多盘并观 · 保留异同和边界',symbol:'乾'},
    {at:31500,title:'阴阳顺逆妙难穷',note:'阴阳遁循节气 · 卦爻动静各有依据',symbol:'阴阳'},
    {at:35000,title:'二至还归一九宫',note:'九宫定局 · 十二宫星曜齐备',symbol:'定'},
    {at:38500,title:'若能了述阴阳理',note:'理解各盘所据 · 不强作互证',symbol:'理'},
    {at:42000,title:'天地都在一掌中',note:'测算结果已揭示 · 请进入完整排盘',symbol:'掌'}
  ];
  const TAU=Math.PI*2;
  const BAGUA=[['坎',[0,1,0]],['艮',[0,0,1]],['震',[1,0,0]],['巽',[0,1,1]],
    ['离',[1,0,1]],['坤',[0,0,0]],['兑',[1,1,0]],['乾',[1,1,1]]];
  const clamp=x=>Math.max(0,Math.min(1,x));
  function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
  function shouldReduceMotion(){
    try{if(root.MotionPref&&typeof root.MotionPref.effective==='function')return !root.MotionPref.effective();}catch(e){}
    try{return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}
  }
  function summary(opt){
    const e=opt.evidence||{},c=opt.cross||{},p=Array.isArray(opt.pillars)?opt.pillars:[];
    const out=[];
    out.push({at:0,tag:'起点',title:'太极 · 阴阳',body:'演化为文化视觉叙事；实际排盘分别依各自输入和规则完成。'});
    out.push({at:10500,tag:'四柱',title:'五行与日主',body:e.day?`${e.day.text} · ${e.element||''} · ${e.strength||''}`:'依出生年月日时与节气定柱。'});
    out.push({at:17500,tag:'生辰',title:'四柱列位',body:p.length===4?p.map((x,i)=>['年','月','日','时'][i]+(x.gan||'')+(x.zhi||'')).join('　'):'四柱未能列出'});
    if(c.liuyao&&!c.liuyao.error)out.push({at:21000,tag:'六爻',title:c.liuyao.name,body:`${c.liuyao.lines.join(' · ')}　动爻${c.liuyao.moving}；之卦：${c.liuyao.changed}`});
    else out.push({at:21000,tag:'六爻',title:'起卦未完成',body:c.liuyao?.error||'未得到有效六爻资料'});
    if(c.ziwei&&!c.ziwei.error)out.push({at:24500,tag:'紫微',title:`命宫${c.ziwei.ming} · 身宫${c.ziwei.shen}`,body:`${c.ziwei.fiveElementsClass} · 命宫星曜：${c.ziwei.mainStars.join('、')||'空宫'}；十二宫已安星。`});
    if(c.qimen&&!c.qimen.error)out.push({at:28000,tag:'奇门',title:`${c.qimen.term} · ${c.qimen.phase}${c.qimen.juNumber}局`,body:`旬首${c.qimen.xunHead}；九宫已布地天盘、九星八门与八神。`});
    out.push({at:38500,tag:'依据',title:'各法独立，不强作互证',body:'六爻与时家奇门依点击时刻；四柱与紫微依生辰。不同盘式各有规则。'});
    return out;
  }
  function play(opt){
    opt=opt||{};
    const done=typeof opt.onDone==='function'?opt.onDone:()=>{};
    const host=opt.host||(typeof document!=='undefined'?document.body:null);
    if(!host){done();return{skip(){}};}
    if(host.__txRunning)return{skip(){}};
    host.__txRunning=true;
    if(typeof document==='undefined'||!document.createElement('canvas').getContext){host.__txRunning=false;done();return{skip(){}};}
    const reduced=shouldReduceMotion();
    const duration=reduced?0:(Number(opt.dur)>0?Number(opt.dur):VOICE_DURATION);
    const mask=document.createElement('div');mask.className='tx-mask';mask.setAttribute('role','dialog');mask.setAttribute('aria-label','测算结果演化');
    const cvs=document.createElement('canvas');cvs.className='tx-canvas';mask.appendChild(cvs);
    const halo=document.createElement('div');halo.className='tx-halo';mask.appendChild(halo);
    const title=document.createElement('div');title.className='tx-stage-title';title.setAttribute('aria-live','polite');mask.appendChild(title);
    const note=document.createElement('div');note.className='tx-stage-note';mask.appendChild(note);
    const dock=document.createElement('div');dock.className='tx-insights';mask.appendChild(dock);
    function makeBoard(kind,heading,meta,items){
      const panel=document.createElement('section');panel.className=`tx-board tx-board--${kind}`;
      const h=document.createElement('div');h.className='tx-board-head';h.textContent=heading;
      const sub=document.createElement('div');sub.className='tx-board-sub';sub.textContent=meta;
      const grid=document.createElement('div');grid.className='tx-board-grid';
      const cells=items.map((item,i)=>{const cell=document.createElement('div');cell.className='tx-board-cell';
        const name=document.createElement('b');name.textContent=item.name;
        const detail=document.createElement('span');detail.textContent=item.detail;
        cell.append(name,detail);grid.appendChild(cell);return cell;});
      panel.append(h,sub,grid);mask.appendChild(panel);return{panel,cells};
    }
    const zi=opt.cross?.ziwei,qi=opt.cross?.qimen;
    const ziBoard=zi&&Array.isArray(zi.palaces)?makeBoard('ziwei','紫微 · 十二宫星曜盘',`命宫${zi.ming} · 身宫${zi.shen} · ${zi.fiveElementsClass||''}`,
      zi.palaces.map(p=>({name:`${p.name} ${p.branch}`,detail:(p.stars||[]).map(s=>s.name+(s.mutagen?'化'+s.mutagen:'')).join('·')||'空宫'}))):null;
    const qiBoard=qi&&Array.isArray(qi.palaces)?makeBoard('qimen','时家奇门 · 九宫盘',`${qi.term} · ${qi.phase}${qi.juNumber}局`,
      qi.palaces.map(p=>({name:`${p.trigram}${p.number}`,detail:[p.star,p.door,p.god].filter(Boolean).join('·')||'中宫'}))):null;
    const luo=[4,9,2,3,5,7,8,1,6],wx={1:'水',6:'水',2:'火',7:'火',3:'木',8:'木',4:'金',9:'金',5:'土'};
    const he={水:'一六共宗',火:'二七同道',木:'三八为朋',金:'四九为友',土:'五十同途'};
    const elem=opt.dayElement||opt.evidence?.element||'';
    const heBoard=makeBoard('hetu','河图 · 洛书', '日主'+elem+' · '+(he[elem]||'五行数理')+'；洛书方位固定',luo.map(n=>({name:String(n),detail:wx[n]+' · '+(n===qi?.juNumber?'本次奇门局数':(wx[n]===elem?'日主五行':'洛书方位'))})));
    heBoard.cells.forEach((cell,i)=>{cell.classList.toggle('active',wx[luo[i]]===elem);cell.dataset.he=luo[i];cell.setAttribute('role','button');cell.tabIndex=0;cell.style.cursor='pointer';});
    function dotMap(n){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 32');svg.setAttribute('aria-hidden','true');for(let k=0;k<n;k++){const c=document.createElementNS(svg.namespaceURI,'circle');c.setAttribute('cx',50+(k-(n-1)/2)*8);c.setAttribute('cy',16);c.setAttribute('r',2.5);c.setAttribute('fill',n%2?'#ffe6b1':'#0c1225');c.setAttribute('stroke','#d5b574');c.setAttribute('stroke-width','1');svg.appendChild(c)}return svg;}
    heBoard.cells.forEach((cell,i)=>{const dots=dotMap(luo[i]);dots.style.cssText='width:100%;height:16px;display:block';cell.insertBefore(dots,cell.lastChild);});
    const river=document.createElement('div');river.className='tx-river';river.style.cssText='display:flex;gap:4px;margin:5px 0 8px;border-bottom:1px solid #c5a86744;padding-bottom:5px';
    [1,2,3,4,5].forEach(n=>{const pair=document.createElement('div');pair.style.cssText='flex:1;text-align:center;min-width:0;font-size:10px;color:#dcc28a';pair.dataset.element=wx[n];pair.append(dotMap(n),dotMap(n+5));Array.from(pair.querySelectorAll('svg')).forEach(v=>v.style.cssText='width:100%;height:14px;display:block');const label=document.createElement('span');label.textContent=n+'·'+(n+5)+' '+wx[n];pair.appendChild(label);if(wx[n]===elem)pair.style.background='#d5b57420';pair.dataset.he=n;pair.dataset.pair='1';pair.setAttribute('role','button');pair.tabIndex=0;pair.style.cursor='pointer';river.appendChild(pair);});
    heBoard.panel.insertBefore(river,heBoard.panel.querySelector('.tx-board-grid'));
    const heInfo={element:elem,ju:qi?.juNumber,ys:opt.evidence?.yongshen||{}};
    heBoard.panel.querySelectorAll('[data-he]').forEach(cell=>{const n=+cell.dataset.he,pair=!!cell.dataset.pair;cell.onclick=()=>{if(window.InteractionSeven)InteractionSeven.openHe(n,{...heInfo,ys:InteractionSeven.model()?.ys||{}},pair);};cell.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();cell.click();}};cell.onpointerenter=cell.onfocus=()=>{heBoard.panel.querySelector('.tx-board-sub').textContent=(pair?'河图 '+n+'—'+(n+5):'洛书 '+n+'宫')+' · 配数属'+wx[n]+'；日主'+elem+'，点击查看本次依据';cell.style.boxShadow='inset 0 0 20px #e6c57d55';};cell.onpointerleave=cell.onblur=()=>{cell.style.boxShadow='';};});

    const progress=document.createElement('div');progress.className='tx-stage-progress';mask.appendChild(progress);
    const proceed=document.createElement('button');proceed.className='tx-proceed';proceed.type='button';proceed.textContent='进入完整排盘';mask.appendChild(proceed);
    host.appendChild(mask);
    const voice=!reduced&&!opt.dur?new Audio('assets/measurement-voice-finished.wav'):null;
    let voiceStarted=false;
    if(voice){const sound=document.createElement('button');sound.className='tx-audio-toggle';sound.type='button';sound.textContent='配音：开 ♪';sound.setAttribute('aria-label','切换题辞配音');mask.appendChild(sound);voice.preload='auto';voice.addEventListener('playing',()=>{voiceStarted=true;mask.dataset.voice='playing'});voice.play().catch(()=>{sound.textContent='点击播放题辞 ♪';});sound.onclick=()=>{if(!voiceStarted){voice.currentTime=Math.min((performance.now()-voiceStart)/1000,19.7);voice.play().then(()=>sound.textContent='配音：开 ♪').catch(()=>sound.textContent='配音暂不可用');}else{voice.muted=!voice.muted;sound.textContent=voice.muted?'配音：关 ♫':'配音：开 ♪';}};}
    const voiceStart=performance.now();
    const ctx=cvs.getContext('2d');let W=0,H=0,cx=0,cy=0,R=0,dpr=1,raf=0,t0=0,finished=false,revealed=0,ended=false;
    const insights=summary(opt),rand=rng(20261008),stars=[];
    for(let i=0;i<360;i++)stars.push({x:rand(),y:rand(),z:.2+rand()*1.8,r:.3+rand()*1.6,tw:rand()*TAU,hue:rand()<.16?'gold':'blue'});
    function resize(){dpr=Math.min(window.devicePixelRatio||1,2);W=window.innerWidth;H=window.innerHeight;cvs.width=Math.max(1,Math.round(W*dpr));cvs.height=Math.max(1,Math.round(H*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);cx=W*.5;cy=H*.52;R=Math.min(W*.39,H*.38);}
    resize();window.addEventListener('resize',resize);
    function card(item){const box=document.createElement('div');box.className='tx-insight';
      const tag=document.createElement('b');tag.textContent=item.tag;
      const head=document.createElement('strong');head.textContent=item.title;
      const body=document.createElement('span');body.textContent=item.body;
      box.append(tag,head,body);dock.appendChild(box);
      requestAnimationFrame(()=>box.classList.add('shown'));
    }
    function reveal(ms){while(revealed<insights.length&&insights[revealed].at<=ms)card(insights[revealed++]);}
    function revealBoards(ms){
      if(ms>=31500){heBoard.panel.classList.add('shown');heBoard.cells.forEach((cell,i)=>{if(ms>=31500+i*280)cell.classList.add('revealed')})}
      if(ziBoard&&ms>=24500){ziBoard.panel.classList.add('shown');ziBoard.cells.forEach((cell,i)=>{if(ms>=24500+i*280)cell.classList.add('revealed');});}
      if(qiBoard&&ms>=28000){qiBoard.panel.classList.add('shown');qiBoard.cells.forEach((cell,i)=>{if(ms>=28000+i*340)cell.classList.add('revealed');});}
    }
    function finalFrame(ts){if(finished)return;
      try{draw(duration+(ts%120000),STAGES[STAGES.length-1],1);}catch(e){mask.classList.add('tx-canvas-fallback');}
      raf=requestAnimationFrame(finalFrame);
    }
    function endScene(){if(ended||finished)return;ended=true;if(raf)cancelAnimationFrame(raf);raf=0;
      if(voice){voice.pause();}reveal(TOTAL);revealBoards(TOTAL);title.textContent=STAGES[STAGES.length-1].title;note.textContent=STAGES[STAGES.length-1].note;
      progress.style.width='84%';proceed.classList.add('shown');
      if(reduced)draw(duration,STAGES[STAGES.length-1],1);else raf=requestAnimationFrame(finalFrame);
      proceed.focus();
    }
    const guard=setTimeout(endScene,duration+1800);
    function finish(){if(finished)return;finished=true;clearTimeout(guard);if(raf)cancelAnimationFrame(raf);
      if(voice){voice.pause();voice.removeAttribute('src');voice.load();}window.removeEventListener('resize',resize);mask.remove();host.__txRunning=false;done();}
    proceed.addEventListener('click',finish);
    if(reduced){draw(0,STAGES[STAGES.length-1],1);endScene();return{skip:endScene};}
    function circle(x,y,r,alpha,width){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#f6d99b';ctx.lineWidth=width;ctx.shadowColor='#ffd586';ctx.shadowBlur=22;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();ctx.restore();}
    function yao(x,y,w,yang,opacity){ctx.save();ctx.globalAlpha=opacity;ctx.strokeStyle='#ffe5a5';ctx.lineWidth=Math.max(3,w*.1);ctx.lineCap='round';ctx.shadowColor='#fbd478';ctx.shadowBlur=14;ctx.beginPath();
      if(yang){ctx.moveTo(x-w/2,y);ctx.lineTo(x+w/2,y);}else{ctx.moveTo(x-w/2,y);ctx.lineTo(x-w*.14,y);ctx.moveTo(x+w*.14,y);ctx.lineTo(x+w/2,y);}ctx.stroke();ctx.restore();}
    function taiji(x,y,r,opacity,angle){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=opacity;
      ctx.shadowColor='#ffe29d';ctx.shadowBlur=24;ctx.fillStyle='#f8e5bb';ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle='#091327';ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,Math.PI/2);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.arc(0,-r/2,r/2,0,TAU);ctx.fill();ctx.fillStyle='#f8e5bb';ctx.beginPath();ctx.arc(0,r/2,r/2,0,TAU);ctx.fill();
      ctx.beginPath();ctx.arc(0,-r/2,r*.095,0,TAU);ctx.fill();ctx.fillStyle='#091327';ctx.beginPath();ctx.arc(0,r/2,r*.095,0,TAU);ctx.fill();ctx.restore();}
    function draw(t,stage,p){
      const c=ctx;
      const bg=c.createRadialGradient(cx,cy,R*.1,cx,cy,Math.max(W,H)*.8);
      bg.addColorStop(0,'#20243e');bg.addColorStop(.28,'#101c35');bg.addColorStop(.66,'#080e20');bg.addColorStop(1,'#020710');c.fillStyle=bg;c.fillRect(0,0,W,H);
      /* 两层漂移星云和中央银河尘埃，保持背景有空间深度。 */
      [[.2,.31,'#2c3f80',.28],[.82,.72,'#734c79',.23],[.56,.45,'#806044',.18]].forEach((n,i)=>{
        const x=W*n[0]+Math.sin(t*.00012+i)*W*.035,y=H*n[1]+Math.cos(t*.0001+i)*H*.03;
        const g=c.createRadialGradient(x,y,0,x,y,Math.max(W,H)*n[3]);g.addColorStop(0,n[2]+'aa');g.addColorStop(1,n[2]+'00');c.fillStyle=g;c.fillRect(0,0,W,H);
      });
      stars.forEach((s,i)=>{const drift=t*.006*s.z;const x=(s.x*W+drift)%W,y=(s.y*H+drift*.14)%H;
        const glow=.38+.55*Math.sin(t*.002*s.z+s.tw)**2;c.globalAlpha=glow;
        c.fillStyle=s.hue==='gold'?'#ffe6a8':'#b7d6ff';c.beginPath();c.arc(x,y,s.r*s.z,0,TAU);c.fill();
        if(i%13===0){c.strokeStyle=s.hue==='gold'?'#dcb45b':'#81b9ff';c.lineWidth=.4;c.beginPath();c.moveTo(x-drift*.01,y-drift*.002);c.lineTo(x,y);c.stroke();}
      });c.globalAlpha=1;
      const bloom=c.createRadialGradient(cx,cy,0,cx,cy,R*1.25);bloom.addColorStop(0,'#e9bd7040');bloom.addColorStop(.35,'#7b6b9350');bloom.addColorStop(1,'#33214300');c.fillStyle=bloom;c.beginPath();c.arc(cx,cy,R*1.25,0,TAU);c.fill();
      /* 椭圆透视星轨：三组轨道分别缓转，轮廓有近远明暗。 */
      for(let i=0;i<4;i++){c.save();c.translate(cx,cy);c.rotate(-.24+i*.05);c.scale(1,.38+i*.06);
        c.rotate(t*(i%2?-.000055:.00006));c.strokeStyle=`rgba(240,197,117,${.18+i*.055})`;c.lineWidth=i===0?2:1;
        c.shadowColor='#f7bd66';c.shadowBlur=8;c.beginPath();c.ellipse(0,0,R*(1.18+i*.16),R*(1.18+i*.16),0,0,TAU);c.stroke();c.restore();}
      for(let i=0;i<7;i++){const rr=R*(.31+i*.12),growth=clamp((p*1.15-i*.065)*2);
        circle(cx,cy,rr,.08+growth*(i%2?.23:.36),i===0?2:1);
        if(i>1){c.save();c.translate(cx,cy);c.rotate(t*.000045*(i%2?-1:1));c.globalAlpha=.15+growth*.26;c.strokeStyle='#f4d68c';c.lineWidth=.6;
          for(let j=0;j<36+i*8;j++){let a=j*TAU/(36+i*8),r=rr;c.beginPath();c.moveTo(Math.cos(a)*(r-5),Math.sin(a)*(r-5));c.lineTo(Math.cos(a)*r,Math.sin(a)*r);c.stroke();}c.restore();}
      }
      for(let i=0;i<32;i++){let a=i*TAU/32+t*.00004;const r0=R*.36,r1=R*(.92+.12*Math.sin(t*.001+i));c.strokeStyle=`rgba(244,213,147,${.04+.05*Math.sin(t*.002+i)**2})`;c.lineWidth=.7;c.beginPath();c.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0);c.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);c.stroke();}
      const ix=STAGES.indexOf(stage),age=(t*TOTAL/(duration||TOTAL))-stage.at,fade=clamp(age/550);
      taiji(cx,cy,R*.225,ix<3?fade:.78,t*.00012);
      if(ix===0){for(let i=0;i<2;i++){const a=t*.0007+i*Math.PI,x=cx+Math.cos(a)*R*.34,y=cy+Math.sin(a)*R*.34;circle(x,y,R*.052,fade*.85,2);}}
      if(ix===1){for(let i=0;i<3;i++){const a=-Math.PI/2+i*TAU/3+t*.00028,x=cx+Math.cos(a)*R*.43,y=cy+Math.sin(a)*R*.43;
        circle(x,y,R*.075,fade*.75,2);c.save();c.fillStyle='#ffe8b3';c.font=`bold ${Math.max(19,R*.07)}px KaiTi,serif`;c.textAlign='center';c.fillText(['天','地','人'][i],x,y+7);c.restore();}}
      if(ix>=2){for(let i=0;i<4;i++){let a=i*TAU/4-Math.PI/4,x=cx+Math.cos(a)*R*.49,y=cy+Math.sin(a)*R*.49;yao(x,y-7,R*.13,i&1,fade);yao(x,y+7,R*.13,i&2,fade);}}
      if(ix>=3){const els=['木','火','土','金','水'];els.forEach((s,i)=>{let a=i*TAU/5-Math.PI/2;c.save();c.globalAlpha=.42+fade*.48;c.fillStyle='#f5dfb2';c.font=`bold ${Math.max(17,R*.065)}px KaiTi,serif`;c.textAlign='center';c.shadowColor='#e6ad5c';c.shadowBlur=12;c.fillText(s,cx+Math.cos(a)*R*.77,cy+Math.sin(a)*R*.77);c.restore();});}
      if(ix===4){c.save();c.strokeStyle='#ffe0a2';c.shadowColor='#ffd180';c.shadowBlur=15;c.lineWidth=2;
        const dots=Array.from({length:6},(_,i)=>{const a=i*TAU/6-Math.PI/2+t*.00016;return polar(R*.62,a);});
        function polar(r,a){return[cx+Math.cos(a)*r,cy+Math.sin(a)*r];}
        dots.forEach((d,i)=>{if(i<3){const other=dots[i+3];c.globalAlpha=fade*.7;c.beginPath();c.moveTo(...d);c.lineTo(...other);c.stroke();}circle(d[0],d[1],R*.035,fade*.9,2);});c.restore();}
      if(ix===5){for(let i=0;i<7;i++){const a=-Math.PI/2+i*TAU/7+t*.0002,[x,y]=[cx+Math.cos(a)*R*.61,cy+Math.sin(a)*R*.61];
        c.save();c.globalAlpha=clamp((age-i*230)/650);c.fillStyle='#fff1c1';c.shadowColor='#ffe5a4';c.shadowBlur=24;c.beginPath();c.arc(x,y,5+i%3,0,TAU);c.fill();c.restore();}}
      if(ix>=6){BAGUA.forEach((g,i)=>{const a=i*TAU/8-Math.PI/2,x=cx+Math.cos(a)*R*.6,y=cy+Math.sin(a)*R*.6;
        for(let k=0;k<3;k++)yao(x,y+(k-1)*8,R*.075,g[1][k],.55+fade*.4);
        c.fillStyle='#f2dfb7';c.font='12px KaiTi,serif';c.textAlign='center';c.fillText(g[0],x,y+27);
      });}
      if(ix>=8){c.save();c.textAlign='center';c.fillStyle='#fff0c4';c.font=`bold ${Math.max(22,R*.12)}px KaiTi,serif`;c.shadowColor='#ffe0a0';c.shadowBlur=24;c.fillText(stage.symbol,cx,cy+R*.42);c.restore();}
      if(ix>=11){circle(cx,cy,R*.26,.65+.22*Math.sin(t*.004)**2,3);c.save();c.globalAlpha=.33;c.fillStyle='#ffe6a8';
        for(let i=0;i<16;i++){const a=i*TAU/16+t*.00011;c.beginPath();c.moveTo(cx+Math.cos(a)*R*.27,cy+Math.sin(a)*R*.27);c.lineTo(cx+Math.cos(a)*R*.48,cy+Math.sin(a)*R*.48);c.lineTo(cx+Math.cos(a+.015)*R*.27,cy+Math.sin(a+.015)*R*.27);c.fill();}c.restore();}
      c.save();c.globalAlpha=.8;c.fillStyle='#ffe5ae';for(let k=0;k<13;k++){const a=(k/13)*TAU+t*.00019,r=R*(.88+.06*Math.sin(k+t*.001));c.beginPath();c.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,1.5+(k%3),0,TAU);c.fill();}c.restore();
    }
    function frame(ts){if(finished||ended)return;if(voice&&voiceStarted&&voice.ended){endScene();return;}if(!t0)t0=ts;const t=ts-t0,elapsed=voice&&voiceStarted&&!voice.ended?voice.currentTime*1000:t,p=clamp(elapsed/duration),stageTime=p*TOTAL;
      let stage=STAGES[0];for(const s of STAGES)if(stageTime>=s.at)stage=s;
      if(voice){const seconds=elapsed/1000;let vi=VOICE_TIMING.findIndex(v=>seconds>=v.start&&seconds<v.end);if(vi<0)vi=seconds>=19.8?12:0;stage=STAGES[vi];if(title.dataset.stage!==String(vi)){title.dataset.stage=String(vi);title.replaceChildren(...VOICE_TIMING[vi].chars.map(c=>{const span=document.createElement('span');span.textContent=c.char;return span;}));}Array.from(title.children).forEach((span,i)=>{span.classList.toggle('read',seconds>=VOICE_TIMING[vi].chars[i].start);span.classList.toggle('unread',seconds<VOICE_TIMING[vi].chars[i].start);});}else title.textContent=stage.title;note.textContent=stage.note;progress.style.width=(p*84)+'%';reveal(stageTime);revealBoards(stageTime);draw(t,stage,p);
      if(p>=1&&(!voice||!voiceStarted||voice.ended))endScene();else raf=requestAnimationFrame(frame);
    }
    raf=requestAnimationFrame(frame);return{skip:endScene};
  }
  return {play,shouldReduceMotion,TOTAL,STAGES,_internals:{summary}};
});
