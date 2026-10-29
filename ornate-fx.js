/** 命盘与今日命盘的绘制层。输入仅取已有排盘和评分，光效不参与推算。 */
(function(root){
  'use strict';
  const FX=root.VisualFX;if(!FX)return;
  const previousFortuneMount=FX.FXFortune.mount,previousFortuneDestroy=FX.FXFortune.destroy;
  const TAU=Math.PI*2;
  const clamp=x=>Math.max(0,Math.min(1,x));
  const polar=(x,y,r,a)=>[x+Math.cos(a)*r,y+Math.sin(a)*r];
  function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  function setup(host,klass,size){
    host.replaceChildren();const canvas=document.createElement('canvas');canvas.className=klass;host.appendChild(canvas);
    const resize=()=>{const dpr=Math.min(root.devicePixelRatio||1,2),w=Math.max(1,host.clientWidth);
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(w*dpr);
      canvas.getContext('2d').setTransform(canvas.width/size,0,0,canvas.height/size,0,0);};
    resize();root.addEventListener('resize',resize);return{canvas,resize,dispose:()=>root.removeEventListener('resize',resize)};
  }
  function stars(seed,count,size){const r=seeded(seed);return Array.from({length:count},()=>({x:r()*size,y:r()*size,a:.2+r()*.6,z:.5+r()*1.5,t:r()*TAU}));}
  function space(c,size,arr,t){
    const bg=c.createRadialGradient(size*.5,size*.43,size*.04,size*.5,size*.5,size*.73);
    bg.addColorStop(0,'#242237');bg.addColorStop(.37,'#111b32');bg.addColorStop(.75,'#080e1e');bg.addColorStop(1,'#020611');c.fillStyle=bg;c.fillRect(0,0,size,size);
    for(const n of [[.25,.22,'67,77,143'],[.74,.76,'83,52,111'],[.56,.39,'130,89,48']]){
      const g=c.createRadialGradient(size*n[0],size*n[1],0,size*n[0],size*n[1],size*.45);
      g.addColorStop(0,`rgba(${n[2]},.24)`);g.addColorStop(1,`rgba(${n[2]},0)`);c.fillStyle=g;c.fillRect(0,0,size,size);
    }
    arr.forEach(s=>{c.globalAlpha=s.a*(.55+.45*Math.sin(t*.0016*s.z+s.t)**2);c.fillStyle=s.z>1.5?'#ffe1aa':'#a4c8f5';
      c.beginPath();c.arc(s.x,s.y,s.z*.9,0,TAU);c.fill();});c.globalAlpha=1;
  }
  function ring(c,x,y,r,a,w=1){c.save();c.strokeStyle=`rgba(250,212,141,${a})`;c.lineWidth=w;c.shadowColor='#ffc572';c.shadowBlur=11;
    c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();c.restore();}
  function taiji(c,x,y,r){
    c.save();c.translate(x,y);c.shadowColor='#ffe9ac';c.shadowBlur=22;c.fillStyle='#efd7a0';c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
    c.shadowBlur=0;c.fillStyle='#11192d';c.beginPath();c.arc(0,0,r,-Math.PI/2,Math.PI/2);c.closePath();c.fill();
    c.beginPath();c.arc(0,-r/2,r/2,0,TAU);c.fill();c.fillStyle='#efd7a0';c.beginPath();c.arc(0,r/2,r/2,0,TAU);c.fill();
    c.beginPath();c.arc(0,-r/2,r*.09,0,TAU);c.fill();c.fillStyle='#11192d';c.beginPath();c.arc(0,r/2,r*.09,0,TAU);c.fill();c.restore();
  }
  function animate(module,host,klass,size,paint){
    module.destroy();const surface=setup(host,klass,size);module._dispose=surface.dispose;
    const c=surface.canvas.getContext('2d'),start=performance.now(),motion=FX.motionOn();
    function frame(now){c.setTransform(surface.canvas.width/size,0,0,surface.canvas.height/size,0,0);
      paint(c,motion?now-start:6000,motion?now:6000);module.raf=motion?requestAnimationFrame(frame):0;}
    module.raf=requestAnimationFrame(frame);
    return surface;
  }
  function destroy(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;if(this._dispose)this._dispose();this._dispose=null;
    if(this._hoverHost){this._hoverHost.onpointermove=null;this._hoverHost.onpointerleave=null;this._hoverHost.onclick=null;this._hoverHost=null;}}
  FX.FXChart.destroy=destroy;
  FX.FXChart.mount=function(host,ctx){
    const b=ctx?.bazi||{},pillars=ctx?.pillars||[],zw=ctx?.ziwei||{},palaces=Array.isArray(zw.palaces)?zw.palaces:[];
    const size=720,C=360,R=322,starfield=stars(771904,225,size);
    animate(this,host,'fx-chart-canvas',size,(c,elapsed,t)=>{
      space(c,size,starfield,t);const p=clamp(elapsed/3200),e=1-(1-p)**3;
      const glow=c.createRadialGradient(C,C,18,C,C,310);glow.addColorStop(0,'rgba(255,234,173,.31)');glow.addColorStop(.42,'rgba(205,147,76,.13)');glow.addColorStop(1,'rgba(105,73,105,0)');
      c.fillStyle=glow;c.fillRect(0,0,size,size);
      this._chartAngle=FX.motionOn()?t*.000015:0;
      c.save();c.translate(C,C);c.rotate(this._chartAngle);c.translate(-C,-C);
      for(const radius of [74,92,137,165,239,289,304,318])ring(c,C,C,radius,.15+e*.44,radius===318?2:1);
      c.save();c.translate(C,C);c.rotate(t*.000015);for(let i=0;i<72;i++){const a=i*TAU/72;
        c.strokeStyle=`rgba(250,217,151,${i%6===0?.64:.24})`;c.lineWidth=i%6===0?1.5:.6;c.beginPath();
        c.moveTo(Math.cos(a)*306,Math.sin(a)*306);c.lineTo(Math.cos(a)*(i%6===0?319:312),Math.sin(a)*(i%6===0?319:312));c.stroke();}c.restore();
      for(let i=0;i<12;i++){
        const age=clamp((elapsed-i*150)/650),a0=-Math.PI/2+i*TAU/12,a1=a0+TAU/12,mid=(a0+a1)/2;
        c.save();c.globalAlpha=.18+age*.82;c.beginPath();c.arc(C,C,286,a0+.012,a1-.012);c.arc(C,C,168,a1-.012,a0+.012,true);c.closePath();
        const fill=c.createRadialGradient(C,C,160,C,C,290);fill.addColorStop(0,'rgba(255,220,147,.01)');fill.addColorStop(1,i%2?'rgba(213,160,82,.10)':'rgba(228,194,118,.17)');
        c.fillStyle=fill;c.fill();c.strokeStyle='rgba(255,221,156,.6)';c.lineWidth=1.3;c.shadowColor='#ffd58f';c.shadowBlur=age*13;c.stroke();c.restore();
        const palace=palaces[i]||{},[tx,ty]=polar(C,C,227,mid),name=palace.name||['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','仆役','官禄','田宅','福德','父母'][i];
        c.save();c.globalAlpha=age;c.textAlign='center';c.textBaseline='middle';c.shadowColor='#ffd98d';c.shadowBlur=10;
        c.fillStyle='#ffdda0';c.font='bold 21px KaiTi,serif';c.fillText(name,tx,ty-13);
        c.shadowBlur=0;c.fillStyle='#c8b792';c.font='15px KaiTi,serif';c.fillText(palace.branch||'',tx,ty+9);
        c.fillStyle='#a8bed6';c.font='12px sans-serif';const names=(palace.stars||[]).map(s=>s.name).slice(0,2).join('·');c.fillText(names||'空宫',tx,ty+25,86);c.restore();
      }
      palaces.forEach((palace,i)=>{const a=-Math.PI/2+(i+.5)*TAU/12,[x,y]=polar(C,C,298,a);c.textAlign='center';c.textBaseline='middle';c.fillStyle='rgba(239,207,148,.68)';c.font='14px KaiTi,serif';c.fillText(palace.branch||'',x,y);});
      c.restore();
      c.save();c.translate(C,C);c.rotate(FX.motionOn()?-t*.00009:0);c.translate(-C,-C);taiji(c,C,C,55);c.restore();ring(c,C,C,69,.8,2);
      c.textAlign='center';c.fillStyle='#ffe9b6';c.font='bold 20px KaiTi,serif';c.fillText('命 盘',C,C+101);
      c.font='16px KaiTi,serif';c.fillStyle='#dfc391';c.fillText(`日柱 ${(pillars[2]?.gan||'')+(pillars[2]?.zhi||'')} · ${b.dayWuXing||''}日主`,C,C+123);
      c.save();c.globalAlpha=.8;c.strokeStyle='rgba(255,226,167,.18)';for(let i=0;i<12;i++){
        const a=i*TAU/12+t*.000025,[x,y]=polar(C,C,332,a);c.beginPath();c.arc(x,y,i%3?1.3:2.5,0,TAU);c.fillStyle='#ffe5a9';c.fill();}c.restore();
    });
    if(palaces.length&&root.PalaceInsight){
      host.style.position='relative';this._hoverHost=host;
      const tip=document.createElement('div');tip.className='fx-chart-tip';tip.setAttribute('aria-live','polite');host.appendChild(tip);
      const locate=event=>{const rect=host.getBoundingClientRect(),scale=size/rect.width,x=(event.clientX-rect.left)*scale-C,y=(event.clientY-rect.top)*scale-C,r=Math.hypot(x,y);
        if(r<168||r>290)return -1;
        // 命中检测直接读取本帧绘制角度，消除动画起点和鼠标事件时钟的偏差。
        const angle=Math.atan2(y,x)+Math.PI/2-(this._chartAngle||0);
        return Math.floor(((angle%TAU+TAU)%TAU)/(TAU/12))%12;};
      host.onpointermove=event=>{const i=locate(event);tip.style.display=i<0?'none':'block';host.style.cursor=i<0?'default':'pointer';
        if(i>=0){const info=root.PalaceInsight.topic(palaces[i]);tip.textContent=`${info.title}：${info.topic}`;
          tip.style.left=Math.min(event.clientX-host.getBoundingClientRect().left+14,host.clientWidth-190)+'px';tip.style.top=Math.max(8,event.clientY-host.getBoundingClientRect().top-45)+'px';}};
      host.onpointerleave=()=>{tip.style.display='none';host.style.cursor='default';};
      host.onclick=event=>{const i=locate(event);if(i>=0)root.PalaceInsight.open(root.PalaceInsight.topic(palaces[i]));};
    }
  };
  FX.FXFortune.destroy=destroy;
  FX.FXFortune.mount=function(host,ctx){
    const f=ctx?.fortune||{},scores=f.scores||{},size=360,C=180,starfield=stars(778122,140,size);
    const dims=[['财',scores.wealth||0,'#eeb858'],['缘',scores.love||0,'#ef677e'],['业',scores.career||0,'#45d3a8'],['康',scores.health||0,'#659efa']];
    animate(this,host,'fx-fortune-canvas',size,(c,elapsed,t)=>{
      space(c,size,starfield,t);const p=clamp(elapsed/3000),breath=.85+.15*Math.sin(t*.0013);
      ring(c,C,C,166,.55,1.2);ring(c,C,C,155,.22);ring(c,C,C,64,.55,1.8);
      c.save();c.translate(C,C);c.rotate(t*.00004);for(let i=0;i<80;i++){
        const a=i*TAU/80;c.strokeStyle=i%10===0?'rgba(255,215,157,.7)':'rgba(185,211,255,.3)';c.lineWidth=i%10===0?1.2:.6;
        c.beginPath();c.moveTo(Math.cos(a)*157,Math.sin(a)*157);c.lineTo(Math.cos(a)*(i%10===0?165:161),Math.sin(a)*(i%10===0?165:161));c.stroke();}c.restore();
      dims.forEach((d,i)=>{
        const grow=clamp((p*4-i*.55)/1.55),score=clamp(d[1]/100),rad=(96+score*49)*grow*breath;
        if(rad<4)return;const a=-Math.PI/2+i*TAU/4,spread=.46;
        const tip=polar(C,C,rad,a),left=polar(C,C,rad*.72,a-spread),right=polar(C,C,rad*.72,a+spread),innerL=polar(C,C,64,a-.42),innerR=polar(C,C,64,a+.42);
        c.save();c.globalAlpha=grow;c.shadowColor=d[2];c.shadowBlur=19;
        c.beginPath();c.moveTo(...innerL);c.lineTo(...left);c.lineTo(...tip);c.lineTo(...right);c.lineTo(...innerR);c.closePath();
        const g=c.createRadialGradient(C,C,57,C,C,Math.max(rad,65));g.addColorStop(0,'rgba(255,255,255,.08)');g.addColorStop(.55,d[2]+'77');g.addColorStop(1,d[2]+'c8');c.fillStyle=g;c.fill();
        c.shadowBlur=0;c.strokeStyle='rgba(255,245,218,.78)';c.lineWidth=1.1;c.stroke();
        c.strokeStyle='rgba(255,255,255,.35)';c.beginPath();c.moveTo(...innerL);c.lineTo(...tip);c.lineTo(...innerR);c.stroke();
        const label=polar(C,C,157,a);c.textAlign='center';c.textBaseline='middle';c.shadowColor=d[2];c.shadowBlur=14;
        c.fillStyle=d[2];c.font='bold 23px KaiTi,serif';c.fillText(d[0],label[0],label[1]);c.restore();
      });
      c.save();c.shadowColor='#42f1a0';c.shadowBlur=20;c.fillStyle='rgba(5,31,31,.93)';c.beginPath();c.arc(C,C,61,0,TAU);c.fill();c.restore();
      ring(c,C,C,61,.8,1.5);c.textAlign='center';c.textBaseline='middle';c.shadowColor='#67f6ac';c.shadowBlur=13;
      c.fillStyle='#8bf5ab';c.font='bold 32px KaiTi,serif';c.fillText(f.dayGanZhi||'',C,C-4);
      c.shadowBlur=0;c.font='12px sans-serif';c.fillStyle='#c8ecd6';c.fillText('今日干支',C,C+29);
    });
  };
  // 今日命盘恢复原版四维扇区；命盘定盘仍采用上方的新绘制层。
  FX.FXFortune.mount=previousFortuneMount;
  FX.FXFortune.destroy=previousFortuneDestroy;
})(typeof globalThis!=='undefined'?globalThis:this);
