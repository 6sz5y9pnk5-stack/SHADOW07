/* SHADOW Phase 259: optional browser-local LLM. No API key or inference server. */
(()=>{'use strict';
 const MODEL_ID='Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
 const CDN_MODULE='https://esm.run/@mlc-ai/web-llm';
 const state={status:'not-loaded',model:MODEL_ID,error:null,engine:null,loading:null};
 const $=id=>document.getElementById(id);
 function setStatus(text){const el=$('localModelStatus');if(el)el.textContent='端末内AI：'+text;window.dispatchEvent(new CustomEvent('shadow-local-llm-state',{detail:{status:state.status,model:MODEL_ID,error:state.error}}));}
 async function load(){
  if(state.engine)return state.engine;
  if(state.loading)return state.loading;
  if(!window.isSecureContext){state.status='blocked';state.error='secure_context_required';setStatus('HTTPSなどの安全なコンテキストが必要です。');throw new Error(state.error)}
  if(!navigator.gpu){state.status='unsupported';state.error='webgpu_unavailable';setStatus('このSafariではWebGPUが検出されません。ローカルAIは開始できません。');throw new Error(state.error)}
  const button=$('loadLocalModel');if(button)button.disabled=true;
  state.status='loading';state.error=null;setStatus('推論エンジンを読み込み中…');
  state.loading=(async()=>{
   try{
    const webllm=await import(CDN_MODULE);
    const ids=new Set((webllm.prebuiltAppConfig?.model_list||[]).map(x=>x.model_id));
    if(!ids.has(MODEL_ID))throw new Error('model_not_in_prebuilt_catalog');
    state.engine=await webllm.CreateMLCEngine(MODEL_ID,{initProgressCallback:(p)=>{const msg=typeof p?.text==='string'?p.text:'モデル準備中';setStatus(msg);}});
    state.status='ready';state.error=null;setStatus('準備完了。推論はこの端末内で実行します。初回モデルのキャッシュ保持はブラウザーの判断に依存します。');
    return state.engine;
   }catch(e){state.engine=null;state.status='error';state.error=String(e?.message||e);setStatus('読み込み失敗：'+state.error+'。APIキーなしの推論はまだ利用できません。');throw e}
   finally{state.loading=null;if(button)button.disabled=false}
  })();
  return state.loading;
 }
 async function chat(message){
  if(typeof message!=='string'||!message.trim()||message.length>3000)throw new Error('invalid_message');
  const engine=state.engine||await load();
  const result=await engine.chat.completions.create({messages:[{role:'system',content:'あなたはSHADOWという端末内アシスタントです。日本語で簡潔に答えます。実行していない操作を実行済みと主張しません。'},{role:'user',content:message.trim()}],temperature:0.4,max_tokens:512});
  const text=result?.choices?.[0]?.message?.content;
  if(typeof text!=='string'||!text.trim())throw new Error('local_model_empty_response');
  return {text:text.trim(),provider:'webllm-local',model:MODEL_ID,local:true};
 }
 function isReady(){return !!state.engine&&state.status==='ready'}
 window.ShadowLocalLLM=Object.freeze({model:MODEL_ID,load,chat,isReady,get status(){return state.status},get error(){return state.error}});
 const button=$('loadLocalModel');
 if(button)button.addEventListener('click',async()=>{button.disabled=true;try{await load()}catch(_){}finally{button.disabled=false}});
})();
