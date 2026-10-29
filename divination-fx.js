/** 三种起卦法分别使用钱面、连星、时轮视觉；动效只延迟展示，不改变已生成的原始输入。 */
(function(root){
  'use strict';
  let busy=false,audioCtx=null;
  const soundEnabled=()=>{try{return localStorage.getItem('xjg_cast_sound')==='on';}catch(e){return false;}};
  function tone(freq,at,duration){
    if(!soundEnabled())return;
    try{
      audioCtx=audioCtx||new (root.AudioContext||root.webkitAudioContext)();
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audioCtx.currentTime+at);
      g.gain.setValueAtTime(.0001,audioCtx.currentTime+at);g.gain.exponentialRampToValueAtTime(.13,audioCtx.currentTime+at+.02);
      g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+at+duration);
      o.connect(g);g.connect(audioCtx.destination);o.start(audioCtx.currentTime+at);o.stop(audioCtx.currentTime+at+duration+.02);
    }catch(e){}
  }
  function play(kind){
    if(kind==='coin-roll'){if(soundEnabled()){try{const a=new Audio('assets/coin-drop.wav');a.volume=1;a.play().catch(()=>{});}catch(e){}}}
    else if(kind==='numbers'){[523,784,1047].forEach((f,i)=>{tone(f,i*.22,.75);tone(f*2,i*.22,.35);});}
    else if(kind==='time'){tone(110,0,1.25);tone(165,.12,1.1);tone(440,.68,.6);}
    else {tone(294,0,.22);tone(440,.28,.28);tone(588,.6,.5);}
  }
  function scene(kind,n){
    if(kind==='coin-roll')return `<div class="cf-coinset">${[0,1,2].map(i=>`<i class="cf-coin" style="--i:${i}">玄</i>`).join('')}</div><div class="cf-label">第 ${n} 轮 · 铜钱未定</div><div class="cf-note">钱面落定后才显出本爻</div>`;
    if(kind==='coin-result')return `<div class="cf-yaos">${Array.from({length:6},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div><div class="cf-label">六爻归位</div><div class="cf-note">初爻在下 · 上爻在上</div>`;
    if(kind==='numbers')return `<div class="cf-stars"><i>一</i><i>二</i><i>三</i><b>✦</b></div><div class="cf-label">三星连珠</div><div class="cf-note">三数合参 · 上下卦与动爻依次成形</div>`;
    return `<div class="cf-time"><i></i><i></i><i></i><b>时</b></div><div class="cf-label">此刻入卦</div><div class="cf-note">记录当下时刻 · 日月入轮</div>`;
  }
  function run(kind,done,n){
    if(busy)return false;
    const on=!(root.MotionPref&&root.MotionPref.effective&&!root.MotionPref.effective());
    if(!on){done();return true;}
    busy=true;
    const mask=document.createElement('div');mask.className=`cast-fx cast-fx-${kind}`;mask.setAttribute('role','status');mask.setAttribute('aria-live','polite');
    mask.innerHTML=`<div class="cf-halo"></div>${scene(kind,n||1)}`;document.body.appendChild(mask);
    play(kind);
    setTimeout(()=>{try{done();}finally{mask.remove();busy=false;}},kind==='coin-roll'?1250:1550);
    return true;
  }
  root.DivinationFX={run,soundEnabled,toggleSound(){const next=!soundEnabled();try{localStorage.setItem('xjg_cast_sound',next?'on':'off');}catch(e){}return next;},get busy(){return busy;}};
})(typeof globalThis!=='undefined'?globalThis:this);
