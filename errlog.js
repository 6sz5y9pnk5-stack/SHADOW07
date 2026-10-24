/* errlog: エラーを拾って画面に出し、ワンタップでコピーできるようにする。Claudeにそのまま貼れる形 */
;(function(root){
  'use strict';
  var KEY='shadow.errlog',MAX=12,list=[];
  try{list=JSON.parse(root.localStorage.getItem(KEY)||'[]');}catch(_){list=[];}
  function save(){try{root.localStorage.setItem(KEY,JSON.stringify(list.slice(-MAX)));}catch(_){}}
  function stamp(t){var d=new Date(t||Date.now());return d.toLocaleString('ja-JP');}
  function add(kind,msg,where){
    list.push({t:Date.now(),kind:kind,msg:String(msg||'').slice(0,700),where:String(where||'').slice(0,160)});
    list=list.slice(-MAX);save();render();
  }
  function report(){
    var ua=(root.navigator&&root.navigator.userAgent)||'';
    var wk=root.ShadowWake||{},ll=root.ShadowLocalLLM||{};
    var head=['【SHADOWエラー報告】','版: '+(root.SHADOW_BUILD||'不明'),'時刻: '+stamp(),
      '端末: '+ua.slice(0,120),
      '脳の状態: '+(wk.brain||'-')+' / モデル状態: '+(ll.status||'-')+' / 読み込み元: '+(ll.source||'-')+(ll.error?' / '+ll.error:''),
      '呼びかけ状態: '+(wk.state||'-'),
      '読み込み段階: '+((ll.stageLog&&ll.stageLog())||'なし'),
      '端末情報: WebGPU='+((root.navigator&&root.navigator.gpu)?'あり':'なし')+' / 対象モデル='+(ll.model||'-')+' / iPhone判定='+(ll.isIOS?'はい':'いいえ'),
      '前回の記録: '+(function(){try{return root.localStorage.getItem('shadow.brain.log')||'なし';}catch(_){return '不明';}})(),
      wk.crashed?'注意: '+wk.crashed:'', '---'];
    var body=list.map(function(e){return stamp(e.t)+' ['+e.kind+'] '+e.msg+(e.where?' @'+e.where:'');});
    return head.filter(Boolean).concat(body.length?body:['(エラーは記録されていません)']).join('\n');
  }
  function copy(text){
    function fallback(){var ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(_){}ta.remove();}
    try{if(root.navigator.clipboard&&root.navigator.clipboard.writeText){return root.navigator.clipboard.writeText(text).catch(fallback);}}catch(_){}
    fallback();return Promise.resolve();
  }
  var box=null,btn=null;
  function render(){
    var doc=root.document;if(!doc||!doc.body)return;
    if(!btn){
      btn=doc.createElement('button');btn.type='button';btn.id='errlogBtn';
      btn.style.cssText='position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);right:8px;z-index:99999;width:44px;height:44px;border-radius:22px;border:1px solid rgba(255,120,140,.7);background:rgba(40,8,16,.8);color:#ffb3bf;font-size:22px;line-height:1;padding:0;display:none';
      btn.addEventListener('click',function(ev){ev.stopPropagation();open();});
      doc.body.appendChild(btn);
    }
    btn.textContent='⚠';btn.setAttribute('aria-label','エラー '+list.length+'件。押すと詳細');btn.title='エラー '+list.length+'件';
    btn.style.display=list.length?'block':'none';
  }
  function open(){
    var doc=root.document;if(box){box.remove();box=null;return;}
    box=doc.createElement('div');
    box.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(6,8,18,.96);color:#e6eefc;padding:calc(env(safe-area-inset-top,0px) + 16px) 16px 16px;overflow:auto;font-size:13px;line-height:1.6';
    var pre=doc.createElement('pre');pre.style.cssText='white-space:pre-wrap;word-break:break-all;margin:0 0 12px';pre.textContent=report();
    function mk(label,fn){var b=doc.createElement('button');b.type='button';b.textContent=label;b.style.cssText='margin:0 8px 8px 0;padding:12px 16px;border-radius:14px;border:1px solid #8a7cff;background:#1c1840;color:#fff;font-size:15px';b.addEventListener('click',function(ev){ev.stopPropagation();fn(b);});return b;}
    box.appendChild(mk('コピーする',function(b){copy(report()).then(function(){b.textContent='コピーしたよ';});}));
    box.appendChild(mk('記録を消す',function(){list=[];save();render();pre.textContent=report();}));
    box.appendChild(mk('閉じる',function(){box.remove();box=null;}));
    box.appendChild(pre);doc.body.appendChild(box);
  }
  root.addEventListener('error',function(e){add('error',e.message,(e.filename||'').split('/').pop()+':'+e.lineno);});
  root.addEventListener('unhandledrejection',function(e){var r=e.reason;add('promise',r&&r.message||r,'');});
  root.addEventListener('shadow-local-llm-state',function(e){var d=e.detail||{};if(d.status==='error'||d.status==='unsupported'||d.status==='blocked')add('brain',d.status+': '+(d.error||''),'local-llm');});
  root.ShadowErrLog={add:add,report:report,count:function(){return list.length;}};
  if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',render);else render();}
})(typeof globalThis!=='undefined'?globalThis:this);
