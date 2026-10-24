/* hologram v11「影」: 闇と、影のもやと、鋭い目だけ。ぼかし・影フィルタは使わず、事前に作った柔らかい円を数枚重ねるだけ */
(function(){
  'use strict';
  var host=document.querySelector('.visual')||document.body;
  var c=document.createElement('canvas');
  c.id='holo';c.setAttribute('aria-hidden','true');
  host.insertBefore(c,host.firstChild);
  var g=c.getContext('2d');
  if(!g)return;
  var W=0,H=0,dpr=1,last=0,raf=0,fonts='"Hiragino Sans",sans-serif';
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU=Math.PI*2;

  /* 柔らかい円のスプライト(最初に1回だけ作る) */
  function sprite(n,stops){
    var s=document.createElement('canvas');s.id='holo';s.width=s.height=n;
    var x=s.getContext('2d'),r=x.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);
    for(var i=0;i<stops.length;i++)r.addColorStop(stops[i][0],stops[i][1]);
    x.fillStyle=r;x.fillRect(0,0,n,n);return s;
  }
  var HAZE=sprite(160,[[0,'rgba(160,100,255,.55)'],[.4,'rgba(95,55,200,.26)'],[1,'rgba(40,20,100,0)']]);
  var DARK=sprite(160,[[0,'rgba(2,1,8,.95)'],[.55,'rgba(2,1,8,.5)'],[1,'rgba(2,1,8,0)']]);
  var RING=sprite(160,[[0,'rgba(170,120,255,0)'],[.7,'rgba(170,120,255,0)'],[.86,'rgba(190,150,255,.5)'],[1,'rgba(170,120,255,0)']]);
  var GLOW=sprite(160,[[0,'rgba(200,170,255,.8)'],[.35,'rgba(130,80,240,.35)'],[1,'rgba(60,30,140,0)']]);

  /* もや8つ(紫)・影5つ(黒)・粒26個。位置は「ゆっくり進む位相」から決める */
  var HZ=[],DK=[],PT=[],i;
  for(i=0;i<8;i++)HZ.push({ax:.10+Math.random()*.22,ay:.07+Math.random()*.14,sp:.55+Math.random()*.9,ph:Math.random()*TAU,s:.32+Math.random()*.22,a:.30+Math.random()*.14});
  for(i=0;i<5;i++)DK.push({ax:.22+Math.random()*.22,ay:.18+Math.random()*.2,sp:.3+Math.random()*.5,ph:Math.random()*TAU,s:.34+Math.random()*.2,a:.38+Math.random()*.2});
  for(i=0;i<26;i++)PT.push({x:Math.random(),y:Math.random(),v:.012+Math.random()*.03,w:Math.random()*TAU,z:.8+Math.random()*2.2});

  var back=null,vig=null,fog=null,f=null,FS=4;
  function size(){
    dpr=Math.min(window.devicePixelRatio||1,2);
    W=Math.max(1,innerWidth);H=Math.max(1,innerHeight);
    c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);
    g.setTransform(dpr,0,0,dpr,0,0);
    /* もや・影・輪・覆いは小さい絵(1/4)に描いて、最後に1回だけ拡大する(塗る面積を減らして軽くする) */
    var fw=Math.ceil(W/FS),fh=Math.ceil(H/FS);
    function mk(){var q=document.createElement('canvas');q.id='holo';q.width=fw;q.height=fh;var x=q.getContext('2d');x.setTransform(fw/W,0,0,fh/H,0,0);return [q,x];}
    var m1=mk(),m2=mk(),m3=mk();
    back=m1[0];fog=m3[0];f=m3[1];vig=m2[0];
    var lg=m1[1].createLinearGradient(0,0,0,H);
    lg.addColorStop(0,'#04030b');lg.addColorStop(.5,'#0a0618');lg.addColorStop(1,'#030209');
    m1[1].fillStyle=lg;m1[1].fillRect(0,0,W,H);
    var rg=m2[1].createRadialGradient(W/2,H*.46,Math.min(W,H)*.25,W/2,H*.46,Math.max(W,H)*.75);
    rg.addColorStop(0,'rgba(2,1,6,0)');rg.addColorStop(1,'rgba(2,1,6,.85)');
    m2[1].fillStyle=rg;m2[1].fillRect(0,0,W,H);
  }

  function eye(t,cx,cy,R,amp){
    var w=R*.78,open=1,bp=(t%5200)/5200;
    if(bp>.97)open=Math.abs(bp-.985)/.015*.9+.1;
    var h=w*.36*open;
    /* 色: ふだんは紫。ときどきゆっくり青緑へ寄って戻る */
    var hue=275-115*Math.pow(Math.max(0,Math.sin(t*.00009)),6);
    /* 白目: 透き通ったシルバー */
    var lgr=g.createLinearGradient(cx-w,cy,cx+w,cy);
    lgr.addColorStop(0,'rgba(210,225,240,.08)');lgr.addColorStop(.5,'rgba(235,243,250,.30)');lgr.addColorStop(1,'rgba(210,225,240,.08)');
    g.fillStyle=lgr;
    g.beginPath();g.moveTo(cx-w,cy);g.quadraticCurveTo(cx,cy-h*1.9,cx+w,cy);g.quadraticCurveTo(cx,cy+h*1.9,cx-w,cy);g.fill();
    g.strokeStyle='rgba(225,236,246,.7)';g.lineWidth=1.3;g.stroke();
    /* 瞳孔: 縦に鋭く細い */
    var pr=R*.22*open+1,pw=R*.05+amp*R*.012;
    var rg=g.createRadialGradient(cx,cy,0,cx,cy,pr*1.7);
    rg.addColorStop(0,'hsla('+hue+',90%,70%,.95)');rg.addColorStop(.5,'hsla('+hue+',90%,55%,.5)');rg.addColorStop(1,'hsla('+hue+',90%,50%,0)');
    g.fillStyle=rg;g.beginPath();g.ellipse(cx,cy,pr*.9,pr*1.5,0,0,TAU);g.fill();
    g.fillStyle='rgba(3,2,10,.97)';
    g.beginPath();g.ellipse(cx,cy,pw,pr,0,0,TAU);g.fill();
    g.strokeStyle='hsla('+hue+',95%,75%,.9)';g.lineWidth=1.1;g.stroke();
  }

  var HINT={off:'画面をタップして、呼びかけ待機をはじめる',idle:'「シャドウ」と呼んでね',awaiting:'どうぞ',busy:'考え中'};
  function words(){
    var wk=window.ShadowWake;if(!wk)return;
    g.textAlign='center';g.font='13px '+fonts;
    g.fillStyle='rgba(170,200,235,'+(wk.state==='off'?.8:.45)+')';
    var hint=HINT[wk.state]||'';
    if(wk.state==='idle'&&wk.brain==='loading')hint='脳を準備中…（少し待ってね）';
    if(wk.state==='idle'&&wk.brain==='error')hint='脳なしで待機中。「シャドウ」と呼んでね';
    g.fillText(hint,W/2,H*.955);
    g.textAlign='left';g.font='10px '+fonts;g.fillStyle='rgba(170,200,235,.35)';g.fillText(window.SHADOW_BUILD||'',10,H-8);g.textAlign='center';
    if(!wk.caption)return;
    g.font='15px '+fonts;g.fillStyle='rgba(228,238,252,.9)';
    var lines=[],cur='',tx=wk.caption.replace(/\s+/g,' ');
    for(var i=0;i<tx.length&&lines.length<3;i++){
      cur+=tx[i];
      if(g.measureText(cur).width>W*.84){lines.push(cur);cur='';}
    }
    if(cur&&lines.length<3)lines.push(cur);
    for(i=0;i<lines.length;i++)g.fillText(lines[i],W/2,H*.86+i*22);
  }

  function draw(now){
    raf=requestAnimationFrame(draw);
    if(document.hidden||now-last<33)return;
    var dt=Math.min(now-last,100);last=now;var T0=performance.now();
    var sp=window.speechSynthesis&&speechSynthesis.speaking?1:0;
    draw.amp=(draw.amp||0)+(sp-(draw.amp||0))*.12;
    var wk=window.ShadowWake,st=wk?wk.state:'off',amp=draw.amp,t=now;
    if(st==='awaiting')amp=Math.max(amp,.35);else if(st==='busy')amp=Math.max(amp,.2+.15*Math.sin(t*.01));
    /* 位相は少しずつ足す(声の大きさで時間が飛ばない) */
    var P=draw.ph=(draw.ph||0)+dt*.00022*(1+amp*1.1);
    var cx=W/2,cy=H*.46,m=Math.min(W,H),R=m*.30*(1+.025*Math.sin(t*.0013)+.03*amp*Math.sin(t*.012));
    f.globalAlpha=1;f.globalCompositeOperation='source-over';
    f.drawImage(back,0,0,W,H);
    var k,b,x,y,r;
    f.globalCompositeOperation='lighter';
    for(k=0;k<HZ.length;k++){b=HZ[k];
      x=cx+Math.cos(P*b.sp+b.ph)*W*b.ax*(1+amp*.5);
      y=cy+Math.sin(P*b.sp*1.3+b.ph*1.7)*H*b.ay*(1+amp*.4);
      r=m*b.s*(1+amp*.55+.06*Math.sin(P*2+b.ph));
      f.globalAlpha=Math.min(.75,b.a*(1+amp*.9));f.drawImage(HAZE,x-r,y-r,r*2,r*2);}
    f.globalCompositeOperation='source-over';
    for(k=0;k<DK.length;k++){b=DK[k];
      x=cx+Math.cos(P*b.sp+b.ph)*W*b.ax;y=cy+Math.sin(P*b.sp*1.1+b.ph*1.3)*H*b.ay;
      r=m*b.s*(1+amp*.25);
      f.globalAlpha=b.a;f.drawImage(DARK,x-r,y-r,r*2,r*2);}
    f.globalCompositeOperation='lighter';
    r=R*(1.5+amp*.5);f.globalAlpha=.35+amp*.5;f.drawImage(GLOW,cx-r,cy-r,r*2,r*2);
    if(amp>.05){
      for(k=0;k<3;k++){var s=((P*1.1+k/3)%1);r=R*(.5+s*2.4);
        f.globalAlpha=(1-s)*Math.min(1,amp)*.55;f.drawImage(RING,cx-r,cy-r,r*2,r*2);}}
    f.globalCompositeOperation='source-over';f.globalAlpha=1;f.drawImage(vig,0,0,W,H);
    g.globalAlpha=1;g.globalCompositeOperation='source-over';
    g.drawImage(fog,0,0,W,H);
    /* 立ちのぼる影の粒 */
    g.fillStyle='rgb(176,140,255)';
    for(k=0;k<PT.length;k++){b=PT[k];
      y=((b.y-P*b.v*6)%1+1)%1;x=b.x+Math.sin(P*2+b.w)*.03;
      g.globalAlpha=Math.sin(y*Math.PI)*.45;g.fillRect(x*W,y*H,b.z,b.z);}
    g.globalAlpha=1;
    eye(t,cx,cy,R,amp);words();
    var HS=window.ShadowHoloStats||(window.ShadowHoloStats={frames:0,ms:0});HS.frames++;HS.ms+=performance.now()-T0;
    if(reduce){cancelAnimationFrame(raf);raf=0;}
  }

  function start(){size();if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);}
  var rt=0;
  addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(size,250);},{passive:true});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&!raf&&!reduce)start();});
  start();
})();
