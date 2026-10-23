'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function loadClient(fetchImpl){
  const events=[];
  const window={dispatchEvent:e=>events.push(e.type)};
  const context={window,fetch:fetchImpl,Event:class{constructor(type){this.type=type}},AbortController,setTimeout,clearTimeout,JSON,Error,String};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'shadow-ai.js'),'utf8'),context,{filename:'shadow-ai.js'});
  return {api:window.ShadowAI,events};
}
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
test('client clears connected state after a network failure',async()=>{
  let chatCalls=0;
  const {api}=loadClient(async(url)=>{
    if(url==='/api/health')return response({ok:true,configured:true,model:'test-model'});
    chatCalls++;
    if(chatCalls===1)return response({ok:true,text:'verified mock answer'});
    throw new TypeError('simulated network failure');
  });
  assert.equal(await api.isConfigured(),true);
  const first=await api.chat('hello');
  assert.equal(first.text,'verified mock answer');
  assert.equal(api.connected,true);
  await assert.rejects(api.chat('again'));
  assert.equal(api.connected,false);
  assert.equal(api.state.lastError,'network_error');
});
test('client rejects empty and overlong messages before fetch',async()=>{
  let calls=0;
  const {api}=loadClient(async()=>{calls++;return response({ok:true,configured:true,model:'test'});});
  await assert.rejects(api.chat('  '),/invalid_message/);
  await assert.rejects(api.chat('x'.repeat(3001)),/invalid_message/);
  assert.equal(calls,1); // only initial health check
});
test('UI does not label deterministic fallback text as a real AI answer when no model is configured',()=>{
  const html=['index.html','script.js','storage.js'].map(n=>fs.readFileSync(path.join(__dirname,n),'utf8')).join('\n');
  const guard=html.indexOf("if(!window.ShadowAI||!(await window.ShadowAI.isConfigured()))return 'AIモデル未接続");
  const fallback=html.indexOf('const base=localReply(t);');
  assert.ok(guard>=0,'explicit no-model guard exists');
  assert.ok(fallback>guard,'no-model guard runs before deterministic fallback');
});
