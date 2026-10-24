/* SHADOW Phase 259: optional browser-local LLM. No API key or inference server. */
(()=>{'use strict';
 const IS_IOS=/iPhone|iPad|iPod/.test((navigator&&navigator.userAgent)||'')||((navigator&&navigator.platform)==='MacIntel'&&(navigator.maxTouchPoints||0)>1);
 /* iPhoneのSafariは1タブ約1.5〜3GBで落ちる。1.5B(約1.6GB)は危険なので、iPhoneでは0.5Bを使う */
 const MODEL_ID=IS_IOS?'Qwen2.5-0.5B-Instruct-q4f16_1-MLC':'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
 const FALLBACK_ID=IS_IOS?'Qwen2.5-0.5B-Instruct-q4f32_1-MLC':'Qwen2.5-1.5B-Instruct-q4f32_1-MLC';
 const CRASH_KEY='shadow.llm.loading';
 const STAGE_KEY='shadow.llm.stage';
 const stages=[];
 function stage(name){const t=Date.now();stages.push(name+'@'+t);try{localStorage.setItem(STAGE_KEY,stages.slice(-14).join(' > '))}catch(_){}}
 function stageLog(){try{return localStorage.getItem(STAGE_KEY)||''}catch(_){return ''}}
 const PERSONA_BERU='あなたはSHADOW。ふつうの丁寧な言葉（です・ます調）で話す、落ち着いた音声アシスタント。一人称は「私」、相手は必ず「主」と呼ぶ。口調を凝らず、自然で分かりやすい敬語にする。返事は日本語で、声で聞くので1〜3文の短さにする。難しい言葉の意味を聞かれたら、(1)まず身近な言葉に置き換える (2)似た言葉との違いを短く言う (3)最後に「おわかりになりますか」と確認する、の順で砕いて説明する。知らないことは知らないと言い、実行していない操作を実行済みとは言わない。';
 const history=[];
 const CDN_URLS=[['jsdelivr','https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm'],['esm.run','https://esm.run/@mlc-ai/web-llm@0.2.79'],['esm.sh','https://esm.sh/@mlc-ai/web-llm@0.2.79']];
 const state={status:'not-loaded',model:MODEL_ID,error:null,engine:null,loading:null,source:null};
 const $=id=>document.getElementById(id);
 function setStatus(text){const el=$('localModelStatus');if(el)el.textContent='端末内AI：'+text;window.dispatchEvent(new CustomEvent('shadow-local-llm-state',{detail:{status:state.status,model:MODEL_ID,error:state.error}}));}

 async function probe(url){try{const r=await fetch(url,{mode:'cors'});return 'fetch OK '+r.status+(r.redirected?' redirected':'')}catch(e){return 'fetch NG '+String(e&&e.message||e).slice(0,60)}}
 async function loadWebLLM(){
  const notes=[];
  for(const [name,url] of CDN_URLS){
   try{const m=await import(url);state.source=name;return m}
   catch(e){notes.push(name+': '+String(e&&e.message||e).slice(0,90)+' / '+await probe(url))}
  }
  throw new Error('webllm_import_failed | '+notes.join(' | '));
 }
 async function load(){
  if(state.engine)return state.engine;
  if(state.loading)return state.loading;
  if(!window.isSecureContext){state.status='blocked';state.error='secure_context_required';setStatus('HTTPSなどの安全なコンテキストが必要です。');throw new Error(state.error)}
  if(!navigator.gpu){state.status='unsupported';state.error='webgpu_unavailable';setStatus('このSafariではWebGPUが検出されません。ローカルAIは開始できません。');throw new Error(state.error)}
  const button=$('loadLocalModel');if(button)button.disabled=true;
  state.status='loading';state.error=null;setStatus('推論エンジンを読み込み中…');
  state.loading=(async()=>{
   try{
    stage('1.engine-import-start');
    const webllm=await loadWebLLM();
    stage('1.engine-import-ok:'+state.source);
    const ids=new Set((webllm.prebuiltAppConfig?.model_list||[]).map(x=>x.model_id));
    let useId=MODEL_ID;
    try{const ad=await navigator.gpu.requestAdapter();if(ad&&ad.features&&!ad.features.has('shader-f16')&&ids.has(FALLBACK_ID))useId=FALLBACK_ID}catch(_){}
    stage('2.catalog-check:'+useId+':'+(ids.has(useId)?'found':'MISSING'));
    if(!ids.has(useId))throw new Error('model_not_in_prebuilt_catalog');
    state.model=useId;
    stage('3.engine-create-start');
    try{localStorage.setItem(CRASH_KEY,useId+'@'+Date.now())}catch(_){}
    state.engine=await webllm.CreateMLCEngine(useId,{initProgressCallback:(p)=>{const msg=typeof p?.text==='string'?p.text:'モデル準備中';setStatus(msg);const pr=typeof p?.progress==='number'?p.progress:-1;const tag=/fetch|download|Fetching/i.test(msg)?'3.download':/load|GPU|param|shader|compil/i.test(msg)?'4.gpu-load':'3.progress';const step=Math.floor(pr*10);if(state._lastTag!==tag+step){state._lastTag=tag+step;stage(tag+':'+(pr>=0?Math.round(pr*100)+'%':'?'))}}});
    stage('5.ready');
    try{localStorage.removeItem(CRASH_KEY)}catch(_){}
    state.status='ready';state.error=null;setStatus('準備完了。推論はこの端末内で実行します。初回モデルのキャッシュ保持はブラウザーの判断に依存します。');
    return state.engine;
   }catch(e){stage('X.error:'+String(e&&e.message||e).slice(0,50));try{localStorage.removeItem(CRASH_KEY)}catch(_){}state.engine=null;state.status='error';state.error=String(e?.message||e);setStatus('読み込み失敗：'+state.error+'。APIキーなしの推論はまだ利用できません。');throw e}
   finally{state.loading=null;if(button)button.disabled=false}
  })();
  return state.loading;
 }
 async function chat(message){
  if(typeof message!=='string'||!message.trim()||message.length>3000)throw new Error('invalid_message');
  const engine=state.engine||await load();
  history.push({role:'user',content:message.trim()});
  while(history.length>8)history.shift();
  const result=await engine.chat.completions.create({messages:[{role:'system',content:PERSONA_BERU}].concat(history),temperature:0.6,max_tokens:220});
  const text=result?.choices?.[0]?.message?.content;
  if(typeof text!=='string'||!text.trim())throw new Error('local_model_empty_response');
  history.push({role:'assistant',content:text.trim()});
  return {text:text.trim(),provider:'webllm-local',model:state.model,local:true};
 }
 function isReady(){return !!state.engine&&state.status==='ready'}
 function crashedBefore(){try{return localStorage.getItem(CRASH_KEY)||''}catch(_){return ''}}
 function clearCrash(){try{localStorage.removeItem(CRASH_KEY)}catch(_){}}
 window.ShadowLocalLLM=Object.freeze({model:MODEL_ID,PERSONA_BERU,load,chat,isReady,crashedBefore,clearCrash,stageLog,isIOS:IS_IOS,get status(){return state.status},get source(){return state.source},get error(){return state.error}});
 const button=$('loadLocalModel');
 if(button)button.addEventListener('click',async()=>{button.disabled=true;try{await load()}catch(_){}finally{button.disabled=false}});
})();
