'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'local-llm.js'),'utf8');
function harness({secure=true,gpu=false}={}){
 const status={textContent:''};const button={disabled:false,addEventListener(type,fn){this.handler=fn}};
 const events=[];const context={
  window:{isSecureContext:secure,dispatchEvent:e=>events.push(e)},
  navigator:gpu?{gpu:{}}:{},
  document:{getElementById:id=>id==='localModelStatus'?status:id==='loadLocalModel'?button:null},
  CustomEvent:function(type,init){this.type=type;this.detail=init.detail},
  Set,Error,String,Promise
 };
 vm.runInNewContext(source,context,{timeout:1000});
 return {api:context.window.ShadowLocalLLM,status,button,events};
}
test('local model refuses to start outside a secure context',async()=>{
 const h=harness({secure:false,gpu:true});
 await assert.rejects(h.api.load(),/secure_context_required/);
 assert.equal(h.api.status,'blocked');
 assert.match(h.status.textContent,/HTTPS/);
});
test('local model reports WebGPU unavailable without calling a provider',async()=>{
 const h=harness({secure:true,gpu:false});
 await assert.rejects(h.api.load(),/webgpu_unavailable/);
 assert.equal(h.api.status,'unsupported');
 assert.match(h.status.textContent,/WebGPU/);
});
test('local module declares a browser-local model and no API key field',()=>{
 assert.match(source,/Qwen2\.5-0\.5B-Instruct-q4f16_1-MLC/);
 assert.match(source,/https:\/\/esm\.run\/\@mlc-ai\/web-llm/);
 assert.doesNotMatch(source,/GEMINI_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
});

test('concurrent load calls share one initialization promise',async()=>{
 const s=source.replace('await import(CDN_MODULE)','await Promise.resolve(globalThis.__mockWebLLM)');
 let calls=0;let release;const gate=new Promise(r=>release=r);
 const mock={prebuiltAppConfig:{model_list:[{model_id:'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'}]},CreateMLCEngine:async()=>{calls++;await gate;return {chat:{completions:{create:async()=>({choices:[{message:{content:'接続成功'}}]})}}}}};
 // Re-evaluate with an injectable mock module in a fresh VM context.
 const context={window:{isSecureContext:true,dispatchEvent(){}},navigator:{gpu:{}},document:{getElementById:id=>id==='localModelStatus'?{textContent:''}:id==='loadLocalModel'?{disabled:false,addEventListener(){}}:null},CustomEvent:function(t,i){this.type=t;this.detail=i.detail},Set,Error,String,Promise,__mockWebLLM:mock};
 vm.runInNewContext(s,context,{timeout:1000});
 const a=context.window.ShadowLocalLLM.load();const b=context.window.ShadowLocalLLM.load();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);release();assert.equal(await a,await b);assert.equal(context.window.ShadowLocalLLM.isReady(),true);
 const result=await context.window.ShadowLocalLLM.chat('テスト');assert.equal(result.text,'接続成功');assert.equal(result.local,true);
});

test('model catalog mismatch is reported and does not mark ready',async()=>{
 const s=source.replace('await import(CDN_MODULE)','await Promise.resolve(globalThis.__mockWebLLM)');
 const context={window:{isSecureContext:true,dispatchEvent(){}},navigator:{gpu:{}},document:{getElementById:id=>id==='localModelStatus'?{textContent:''}:id==='loadLocalModel'?{disabled:false,addEventListener(){}}:null},CustomEvent:function(t,i){this.type=t;this.detail=i.detail},Set,Error,String,Promise,__mockWebLLM:{prebuiltAppConfig:{model_list:[]},CreateMLCEngine:async()=>{throw Error('should_not_be_called')}}};
 vm.runInNewContext(s,context,{timeout:1000});
 await assert.rejects(context.window.ShadowLocalLLM.load(),/model_not_in_prebuilt_catalog/);
 assert.equal(context.window.ShadowLocalLLM.isReady(),false);assert.equal(context.window.ShadowLocalLLM.status,'error');
});

test('empty model response is rejected rather than presented as an answer',async()=>{
 const s=source.replace('await import(CDN_MODULE)','await Promise.resolve(globalThis.__mockWebLLM)');
 const mock={prebuiltAppConfig:{model_list:[{model_id:'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'}]},CreateMLCEngine:async()=>({chat:{completions:{create:async()=>({choices:[{message:{content:'  '}}]})}}})};
 const context={window:{isSecureContext:true,dispatchEvent(){}},navigator:{gpu:{}},document:{getElementById:id=>id==='localModelStatus'?{textContent:''}:id==='loadLocalModel'?{disabled:false,addEventListener(){}}:null},CustomEvent:function(t,i){this.type=t;this.detail=i.detail},Set,Error,String,Promise,__mockWebLLM:mock};
 vm.runInNewContext(s,context,{timeout:1000});
 await context.window.ShadowLocalLLM.load();await assert.rejects(context.window.ShadowLocalLLM.chat('テスト'),/local_model_empty_response/);
});

test('empty and overlong prompts are rejected before model initialization',async()=>{
 const s=source.replace('await import(CDN_MODULE)','await Promise.resolve(globalThis.__mockWebLLM)');
 let initCalls=0;const mock={prebuiltAppConfig:{model_list:[{model_id:'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'}]},CreateMLCEngine:async()=>{initCalls++;return {chat:{completions:{create:async()=>({choices:[{message:{content:'ok'}}]})}}}}};
 const context={window:{isSecureContext:true,dispatchEvent(){}},navigator:{gpu:{}},document:{getElementById:id=>id==='localModelStatus'?{textContent:''}:id==='loadLocalModel'?{disabled:false,addEventListener(){}}:null},CustomEvent:function(t,i){this.type=t;this.detail=i.detail},Set,Error,String,Promise,__mockWebLLM:mock};
 vm.runInNewContext(s,context,{timeout:1000});
 await assert.rejects(context.window.ShadowLocalLLM.chat('   '),/invalid_message/);
 await assert.rejects(context.window.ShadowLocalLLM.chat('x'.repeat(3001)),/invalid_message/);
 assert.equal(initCalls,0);
});

test('failed model initialization clears the loading lock so retry can work',async()=>{
 const s=source.replace('await import(CDN_MODULE)','await Promise.resolve(globalThis.__mockWebLLM)');
 let attempts=0;const mock={prebuiltAppConfig:{model_list:[{model_id:'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'}]},CreateMLCEngine:async()=>{attempts++;if(attempts===1)throw Error('temporary_failure');return {chat:{completions:{create:async()=>({choices:[{message:{content:'再試行成功'}}]})}}}}};
 const context={window:{isSecureContext:true,dispatchEvent(){}},navigator:{gpu:{}},document:{getElementById:id=>id==='localModelStatus'?{textContent:''}:id==='loadLocalModel'?{disabled:false,addEventListener(){}}:null},CustomEvent:function(t,i){this.type=t;this.detail=i.detail},Set,Error,String,Promise,__mockWebLLM:mock};
 vm.runInNewContext(s,context,{timeout:1000});
 await assert.rejects(context.window.ShadowLocalLLM.load(),/temporary_failure/);
 assert.equal(context.window.ShadowLocalLLM.status,'error');
 await context.window.ShadowLocalLLM.load();
 assert.equal(context.window.ShadowLocalLLM.isReady(),true);assert.equal(attempts,2);
 assert.equal((await context.window.ShadowLocalLLM.chat('再試行')).text,'再試行成功');
});

test('CDN module acquisition failure is surfaced and a later retry can initialize',async()=>{
 const s=source.replace('await import(CDN_MODULE)','await Promise.resolve(globalThis.__getWebLLM())');
 let attempts=0;const good={prebuiltAppConfig:{model_list:[{model_id:'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'}]},CreateMLCEngine:async()=>({chat:{completions:{create:async()=>({choices:[{message:{content:'取得後の推論テスト'}}]})}}})};
 const status={textContent:''};const button={disabled:false,addEventListener(){}};
 const context={window:{isSecureContext:true,dispatchEvent(){}},navigator:{gpu:{}},document:{getElementById:id=>id==='localModelStatus'?status:id==='loadLocalModel'?button:null},CustomEvent:function(t,i){this.type=t;this.detail=i.detail},Set,Error,String,Promise,__getWebLLM:()=>{attempts++;if(attempts===1)return Promise.reject(Error('simulated_dns_failure'));return Promise.resolve(good)}};
 vm.runInNewContext(s,context,{timeout:1000});
 await assert.rejects(context.window.ShadowLocalLLM.load(),/simulated_dns_failure/);
 assert.equal(context.window.ShadowLocalLLM.status,'error');
 assert.match(status.textContent,/simulated_dns_failure/);
 assert.equal(context.window.ShadowLocalLLM.isReady(),false);
 await context.window.ShadowLocalLLM.load();
 assert.equal(context.window.ShadowLocalLLM.status,'ready');
 assert.equal(context.window.ShadowLocalLLM.isReady(),true);
 const answer=await context.window.ShadowLocalLLM.chat('日本語の短いテスト');
 assert.equal(answer.text,'取得後の推論テスト');
 assert.equal(attempts,2);
});
