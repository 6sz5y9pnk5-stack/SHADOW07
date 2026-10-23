/* wake: 画面を1回タップすると待機開始。「シャドウ」と呼ぶと返事して、続けて話した言葉をそのまま会話に渡す */
;(function(root,factory){
  var api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ShadowWake=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  var WAKE=/(シャドウ|シャドー|ジャドウ|しゃどう|しゃどー|ｼｬﾄﾞｳ|shadow)/i;
  var GREETING='はい、主。お傍におります。何なりと';
  function parse(text){
    var t=String(text||'').replace(/\s+/g,'');
    var m=WAKE.exec(t);
    if(!m)return null;
    return {rest:t.slice(m.index+m[0].length).replace(/^[、，,。.！!？?]+/,'')};
  }
  var api={parse:parse,GREETING:GREETING,state:'off',caption:''};
  var doc=root.document;
  if(!doc||typeof doc.addEventListener!=='function')return api;

  var SR=root.SpeechRecognition||root.webkitSpeechRecognition,synth=root.speechSynthesis;
  var rec=null,muted=false,timer=0,latest='',replySeen=false,busySince=0,ignoreSpeak=0,
      muteHold=0,armAwait=false,deadline=0,capAt=0;

  function setCap(t){api.caption=t;capAt=Date.now();}
  function voice(){
    var vs=synth&&synth.getVoices?synth.getVoices():[];
    var ja=vs.filter(function(v){return /^ja/i.test(v.lang);});
    return ja.filter(function(v){return /otoya|male|男/i.test(v.name);})[0]||ja[0]||null;
  }
  /* 読み上げ全体を、低めで落ち着いた声にそろえる(画面側の返事にも効く) */
  if(synth&&typeof synth.speak==='function'){
    var origSpeak=synth.speak.bind(synth);
    synth.speak=function(u){
      try{var v=voice();if(v&&!u.voice)u.voice=v;u.lang='ja-JP';u.pitch=Math.min(u.pitch||1,.82);u.rate=.94;}catch(_){}
      return origSpeak(u);
    };
  }
  function speak(text){
    if(!synth)return;
    try{synth.cancel();var u=new SpeechSynthesisUtterance(text);u.lang='ja-JP';synth.speak(u);}catch(_){}
  }
  function stopRec(){try{if(rec)rec.abort();}catch(_){}}
  function startRec(){if(rec&&api.state!=='off'){try{rec.start();}catch(_){}}}
  function set(s){api.state=s;}

  function build(){
    rec=new SR();rec.lang='ja-JP';rec.continuous=true;rec.interimResults=true;
    rec.onresult=function(e){
      var tx='';
      for(var i=e.resultIndex;i<e.results.length;i++)tx+=e.results[i][0].transcript;
      latest=tx;clearTimeout(timer);
      timer=setTimeout(decide,e.results[e.results.length-1].isFinal?250:1000);
    };
    rec.onerror=function(e){
      if(e&&(e.error==='not-allowed'||e.error==='service-not-allowed')){
        set('off');setCap('マイクか音声認識が許可されてないよ。iPhoneの設定で許可してね');
      }
    };
    rec.onend=function(){if(api.state!=='off'&&!muted)setTimeout(startRec,350);};
  }

  function greet(){
    set('awaiting');muted=true;muteHold=Date.now()+900;armAwait=true;
    stopRec();setCap(GREETING);speak(GREETING);
  }
  function command(text){
    var ta=doc.getElementById('message'),btn=doc.getElementById('send');
    if(!ta||!btn){set('idle');return;}
    set('busy');replySeen=false;busySince=Date.now();setCap('');
    ta.value=text;btn.click();
  }
  function decide(){
    var tx=latest;latest='';
    if(api.state==='idle'){
      var p=parse(tx);
      if(!p)return;
      if(p.rest.length>=2)command(p.rest);else greet();
    }else if(api.state==='awaiting'){
      var q=parse(tx),text=q?q.rest:String(tx).replace(/\s+/g,'');
      if(text.length>=2)command(text);
    }
  }

  /* 0.3秒ごとの見回り: 読み上げ中はマイクを止め、終わったら再開 */
  setInterval(function(){
    if(api.state==='off')return;
    var sp=!!(synth&&synth.speaking)&&Date.now()>ignoreSpeak,now=Date.now();
    if(sp&&!muted){muted=true;stopRec();}
    else if(!sp&&muted&&now>muteHold){
      muted=false;startRec();
      if(armAwait){armAwait=false;deadline=now+10000;}
    }
    if(api.state==='awaiting'&&deadline&&now>deadline&&!muted){set('idle');deadline=0;}
    if(api.state==='busy'&&((replySeen&&!sp)||now-busySince>30000))set('idle');
    if(api.state==='idle'&&api.caption&&now-capAt>15000)api.caption='';
  },300);

  /* 返事が画面に出たら、字幕として保存 */
  if(typeof MutationObserver==='function'){
    new MutationObserver(function(ms){
      ms.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if(n.nodeType===1&&n.classList&&n.classList.contains('bubble')&&n.classList.contains('shadow')&&api.state==='busy'){
            var b=n.querySelector('div'),t=(b?b.textContent:n.textContent)||'';
            setCap(t.replace(/^\[[^\]]*\]\s*/,'').slice(0,90));replySeen=true;
          }
        });
      });
    }).observe(doc.body,{childList:true,subtree:true});
  }

  /* 画面のどこかを1回タップ → 待機開始(iPhoneはタップが必要) */
  doc.addEventListener('click',function(ev){
    if(api.state!=='off')return;
    var t=ev.target;
    if(t&&t.closest&&t.closest('button,a,input,textarea,select'))return;
    if(doc.body.classList.contains('feature-mode'))return;
    if(!SR){setCap('この端末では音声認識が使えないよ');return;}
    if(!rec)build();
    set('idle');setCap('');muted=false;ignoreSpeak=Date.now()+1200;
    try{rec.start();}catch(_){}
    try{var u=new SpeechSynthesisUtterance('。');u.volume=0;synth.speak(u);}catch(_){}
  });
  return api;
});
