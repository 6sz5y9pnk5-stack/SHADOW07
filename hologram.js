/* hologram: 1枚のcanvasだけで描く軽量ホログラム。ぼかし・影は使わない */
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

  /* 渦: 3本の腕に粒を並べる(紫・青・金) */
  var ARMS=[270,215,42],PER=84,V=[];
  for(var ar=0;ar<3;ar++)for(var k=0;k<PER;k++)V.push({a:ar,u:k/PER,j:(Math.random()-.5)*.5,s:.8+Math.random()*1.5});
  /* 光の粒: 66個 */
  var DOT=[],DC=['167,139,250','255,205,110','110,235,160','100,170,255'];
  for(var d=0;d<66;d++)DOT.push({x:Math.random(),y:Math.random(),c:DC[d%4],r:d%9===0?7:.9+Math.random()*2.2,ph:Math.random()*TAU});
  /* 背景に浮かぶ文字: 14個 */
  var CH='ｱｲｳｴｵｶｷｸｹｺ0123456789ABCDEF'.split(''),F=[];
  for(var i=0;i<14;i++)F.push({x:Math.random(),y:Math.random(),s:.00002+Math.random()*.00004,
    ch:CH[(Math.random()*CH.length)|0],ph:Math.random()*TAU,deep:i%3===0,sz:11+Math.random()*7});

  var sx=[],sy=[],sz=[];
  function size(){
    dpr=Math.min(window.devicePixelRatio||1,2);
    W=Math.max(1,innerWidth);H=Math.max(1,innerHeight);
    c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);
    g.setTransform(dpr,0,0,dpr,0,0);
  }

  function aurora(t){
    var bands=[['47,227,160',.55,.9,.0004],['58,160,255',.4,1.3,.00031],['167,139,250',.7,1.7,.00025]];
    g.lineCap='round';
    for(var b=0;b<3;b++){
      var B=bands[b],yy=H*(.2+b*.22),amp=H*.05,pulse=.5+.5*Math.sin(t*B[3]*3+b);
      g.strokeStyle='rgba('+B[0]+','+(.028+.034*pulse).toFixed(3)+')';
      g.lineWidth=H*.1;
      g.beginPath();
      for(var x=-20;x<=W+20;x+=W/12){
        var yv=yy+Math.sin(x*.006*B[2]+t*B[3])*amp+Math.sin(x*.0023+t*B[3]*.6+b)*amp*.7;
        if(x<0)g.moveTo(x,yv);else g.lineTo(x,yv);
      }
      g.stroke();
    }
  }

  function letters(t){
    g.textAlign='center';
    for(var i=0;i<F.length;i++){
      var f=F[i];
      f.y-=f.s*16;if(f.y<-.05){f.y=1.05;f.x=Math.random();}
      var al=.16+.2*(.5+.5*Math.sin(t*.0011+f.ph));
      g.fillStyle=f.deep?'rgba(120,150,215,'+al.toFixed(3)+')':'rgba(47,227,160,'+al.toFixed(3)+')';
      g.font=f.sz+'px '+fonts;
      g.fillText(f.ch,f.x*W+Math.sin(t*.0006+f.ph)*8,f.y*H);
    }
  }

  function dots(t){
    for(var i=0;i<DOT.length;i++){
      var o=DOT[i],al=.25+.5*(.5+.5*Math.sin(t*.0012+o.ph));
      g.fillStyle='rgba('+o.c+','+(o.r>5?al*.22:al).toFixed(2)+')';
      if(o.r<2){g.fillRect(o.x*W,o.y*H,o.r,o.r);}else{g.beginPath();g.arc(o.x*W,o.y*H,o.r,0,TAU);g.fill();}
    }
  }

  function vortex(t,cx,cy,R,amp){
    var sp=t*.00042*(1+amp*.8);
    /* 渦の腕: 3色 × 3本の流れる筋 */
    for(var ar=0;ar<3;ar++){
      for(var st=0;st<3;st++){
        g.strokeStyle='hsla('+ARMS[ar]+',90%,'+(ar===2?'66%':'62%')+','+(.62-st*.14).toFixed(2)+')';
        g.lineWidth=1.9-st*.5;g.beginPath();
        for(var k=0;k<=34;k++){
          var u=k/34,rr=R*(.1+1.25*Math.pow(u,.85))*(1+st*.035);
          var an=ar*2.0944+u*5.4+st*.17-sp*(1.5-u*.9);
          var px=cx+Math.cos(an)*rr,py=cy+Math.sin(an)*rr*.96;
          if(k)g.lineTo(px,py);else g.moveTo(px,py);
        }
        g.stroke();
      }
      g.fillStyle='hsla('+ARMS[ar]+',90%,75%,.8)';
      for(k=0;k<PER;k+=2){
        var p=V[ar*PER+k],uu=p.u,r2=R*(.1+1.25*Math.pow(uu,.85))+p.j*R*.12;
        var a2=ar*2.0944+uu*5.4+p.j*.5-sp*(1.5-uu*.9);
        g.fillRect(cx+Math.cos(a2)*r2,cy+Math.sin(a2)*r2*.96,p.s+.4,p.s+.4);
      }
    }
    g.lineWidth=2;
    for(var q=0;q<2;q++){
      var rot=t*.00018*(q?-1:1)+q*1.6,ph=sp*1.6*(q?-1:1);
      g.strokeStyle='rgba(255,215,130,'+(.55+.25*amp).toFixed(2)+')';
      g.beginPath();g.ellipse(cx,cy,R*(1.18-q*.12),R*(.62+q*.05),rot,ph,ph+3.2);g.stroke();
    }
    g.strokeStyle='rgba(167,139,250,.35)';g.lineWidth=1;
    g.beginPath();g.arc(cx,cy,R*.34,0,TAU);g.stroke();
  }

  var mg=null;
  function mesh(t,cx,amp){
    var y0=H*.06,y1=H*.94,ROWS=15,COLS=6,SEG=26,wv=W*.2*(1+amp*.35);
    function ctr(y){return cx+Math.sin(y*.0085+t*.0013)*W*.06*(1+amp*.6);}
    function hw(y){return wv*(.55+.45*Math.sin(y*.0052+t*.0009));}
    if(!mg||mg.h!==H){mg=g.createLinearGradient(0,y0,0,y1);
      mg.addColorStop(0,'rgba(90,235,215,.7)');mg.addColorStop(.5,'rgba(255,208,120,.6)');
      mg.addColorStop(.85,'rgba(255,135,120,.55)');mg.addColorStop(1,'rgba(90,235,215,.45)');mg.h=H;}
    g.strokeStyle=mg;g.lineWidth=.8;g.beginPath();
    for(var r=0;r<=ROWS;r++){
      var y=y0+(y1-y0)*r/ROWS,m=ctr(y),w=hw(y);
      for(var c=0;c<=4;c++){
        var u=c/2-1,yy=y+Math.sin(u*2.4+t*.0021+y*.01)*7;
        if(c)g.lineTo(m+u*w,yy);else g.moveTo(m+u*w,yy);
      }
    }
    for(var cl=0;cl<=COLS;cl++){
      var uu=cl/COLS*2-1;
      for(var s=0;s<=SEG;s++){
        var y2=y0+(y1-y0)*s/SEG,x2=ctr(y2)+uu*hw(y2),yo=y2+Math.sin(uu*2.4+t*.0021+y2*.01)*7;
        if(s)g.lineTo(x2,yo);else g.moveTo(x2,yo);
      }
    }
    g.stroke();
    /* リボンに沿う細い光の線(話している時に大きく揺れる) */
    var cols=['rgba(90,235,215,.8)','rgba(255,205,110,.75)'];
    g.lineWidth=1.6;
    for(var n=0;n<2;n++){
      g.strokeStyle=cols[n];g.beginPath();
      for(var s2=0;s2<=40;s2++){
        var y3=y0+(y1-y0)*s2/40,x3=ctr(y3)+Math.sin(y3*.021+t*(.0032+n*.0011)+n*2)*(W*.07+amp*W*.05)*Math.sin(s2/40*Math.PI);
        if(s2)g.lineTo(x3,y3);else g.moveTo(x3,y3);
      }
      g.stroke();
    }
  }

  function flame(cx,cy,w,dir,t,hue,amp){
    for(var k=0;k<3;k++){
      var sw=Math.sin(t*(.0021+k*.0007)+k*2+dir)*w*.12,len=w*(.55+k*.18+.1*amp),
          bx=cx+dir*w*(.02+k*.06),by=cy-w*.02;
      g.fillStyle='hsla('+(hue+k*22)+',85%,66%,'+(.34-k*.07).toFixed(2)+')';
      g.beginPath();g.moveTo(bx,by);
      g.quadraticCurveTo(bx+dir*w*.2+sw,by-len*.55,bx+dir*w*.05+sw*1.6,by-len);
      g.quadraticCurveTo(bx-dir*w*.04+sw,by-len*.5,bx-dir*w*.04,by);
      g.closePath();g.fill();
    }
  }

  function eye(t,cx,cy,R,amp){
    var w=R*.78,open=1,bp=(t%5200)/5200;
    if(bp>.97)open=Math.abs(bp-.985)/.015*.9+.1;
    var h=w*.36*open,hue=160+((Math.sin(t*.00045)+1)/2)*(270-160);
    /* 目の端から立ちのぼる炎 */
    flame(cx-w,cy,w,-1,t,hue,amp);flame(cx+w,cy,w,1,t,hue+30,amp);
    /* 白目: 透き通ったシルバー */
    var gr=g.createLinearGradient(cx-w,cy,cx+w,cy);
    gr.addColorStop(0,'rgba(210,225,240,.10)');gr.addColorStop(.5,'rgba(235,243,250,.34)');gr.addColorStop(1,'rgba(210,225,240,.10)');
    g.fillStyle=gr;
    g.beginPath();g.moveTo(cx-w,cy);g.quadraticCurveTo(cx,cy-h*1.9,cx+w,cy);g.quadraticCurveTo(cx,cy+h*1.9,cx-w,cy);g.fill();
    g.strokeStyle='rgba(225,236,246,.75)';g.lineWidth=1.4;g.stroke();
    /* 瞳孔: 縦に細く、色がゆっくり変わる */
    var pr=R*.2*open+1,pw=R*.055+amp*R*.012;
    var rg=g.createRadialGradient(cx,cy,0,cx,cy,pr*1.7);
    rg.addColorStop(0,'hsla('+hue+',90%,70%,.95)');rg.addColorStop(.5,'hsla('+hue+',90%,55%,.5)');rg.addColorStop(1,'hsla('+hue+',90%,50%,0)');
    g.fillStyle=rg;g.beginPath();g.ellipse(cx,cy,pr*.9,pr*1.5,0,0,TAU);g.fill();
    g.fillStyle='rgba(4,10,24,.96)';
    g.beginPath();g.ellipse(cx,cy,pw,pr,0,0,TAU);g.fill();
    g.strokeStyle='hsla('+hue+',95%,75%,.9)';g.lineWidth=1.2;g.stroke();
  }

  var HINT={off:'画面をタップして、呼びかけ待機をはじめる',idle:'「シャドウ」と呼んでね',awaiting:'どうぞ',busy:'考え中'};
  function words(){
    var wk=window.ShadowWake;if(!wk)return;
    g.textAlign='center';g.font='13px '+fonts;
    g.fillStyle='rgba(170,200,235,'+(wk.state==='off'?.8:.45)+')';
    g.fillText(HINT[wk.state]||'',W/2,H*.955);
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
    last=now;
    var sp=window.speechSynthesis&&speechSynthesis.speaking?1:0;
    draw.amp=(draw.amp||0)+(sp-(draw.amp||0))*.12;
    var wk=window.ShadowWake,st=wk?wk.state:'off',amp=draw.amp,t=now;
    if(st==='awaiting')amp=Math.max(amp,.35);else if(st==='busy')amp=Math.max(amp,.2+.15*Math.sin(t*.01));
    var bg=g.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#050b1c');bg.addColorStop(.6,'#081631');bg.addColorStop(1,'#04091a');
    g.fillStyle=bg;g.fillRect(0,0,W,H);
    aurora(t);dots(t);letters(t);
    var cx=W/2,cy=H*.46,R=Math.min(W,H)*.32*(1+.03*Math.sin(t*.0013)+.04*amp*Math.sin(t*.012));
    vortex(t,cx,cy,R,amp);mesh(t,cx,amp);eye(t,cx,cy,R,amp);words();
    if(reduce){cancelAnimationFrame(raf);raf=0;}
  }

  function start(){size();if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);}
  var rt=0;
  addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(size,250);},{passive:true});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&!raf&&!reduce)start();});
  start();
})();
