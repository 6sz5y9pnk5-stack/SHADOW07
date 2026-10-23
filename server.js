'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 12 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const requestBuckets = new Map();
const PUBLIC_FILES = new Set(['/index.html','/style.css','/storage.js','/script.js','/microphone.js','/shadow-ai.js','/local-llm.js','/service-worker.js','/manifest.webmanifest','/icon-192.png','/icon-512.png']);
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const KEY = process.env.GEMINI_API_KEY || '';
const API_BASE = process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com';
if (process.env.NODE_ENV !== 'test' && !API_BASE.startsWith('https://')) throw new Error('GEMINI_API_BASE_URL must use HTTPS outside tests');
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.json':'application/json; charset=utf-8'};
const CSP = (fs.readFileSync(path.join(ROOT,'index.html'),'utf8').match(/<meta http-equiv=\"Content-Security-Policy\" content=\"([^\"]+)\"/i)||[])[1] || "default-src 'none'; connect-src 'self'";
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Cache-Control','no-store');
  if (req.method === 'GET' && req.url === '/api/health') {
    return sendJson(res, 200, {ok:true, provider:'gemini', configured:Boolean(KEY), model:MODEL, connected:false, note:'configured means key exists; connected becomes true only after successful inference'});
  }
  if (req.method === 'POST' && req.url === '/api/chat') {
    const now=Date.now(), ip=req.socket.remoteAddress || 'unknown';
    const bucket=requestBuckets.get(ip);
    if (!bucket || now-bucket.start >= RATE_WINDOW_MS) requestBuckets.set(ip,{start:now,count:1});
    else if (bucket.count >= RATE_MAX) return sendJson(res,429,{error:'rate_limited',message:'リクエストが多すぎます。1分待って再試行してください。'});
    else bucket.count++;
    if (!KEY) return sendJson(res, 503, {error:'model_not_configured', message:'サーバーにGEMINI_API_KEYが設定されていません。'});
    let raw='';
    try {
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > MAX_BODY) return sendJson(res, 413, {error:'body_too_large'}); }
      const body=JSON.parse(raw || '{}');
      if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 3000) return sendJson(res, 400, {error:'invalid_message', message:'message must be a non-empty string of at most 3000 characters'});
      let upstream;
      upstream=await fetch(API_BASE+'/v1beta/models/'+encodeURIComponent(MODEL)+':generateContent', {
        method:'POST', signal:AbortSignal.timeout(20000),
        headers:{'Content-Type':'application/json','x-goog-api-key':KEY},
        body:JSON.stringify({contents:[{role:'user',parts:[{text:body.message.trim()}]}],generationConfig:{maxOutputTokens:1200,temperature:0.4}})
      });
      const data=await upstream.json().catch(()=>({}));
      if (!upstream.ok) {
        const status=upstream.status===401||upstream.status===403?502:upstream.status===429?429:502;
        return sendJson(res,status,{error:upstream.status===429?'provider_rate_limited':'provider_request_failed', providerStatus:upstream.status, message:'モデル提供元への要求に失敗しました。認証・利用制限・モデル名を確認してください。秘密情報は返しません。'});
      }
      const text=(data.candidates||[]).flatMap(c=>c.content&&c.content.parts||[]).map(p=>typeof p.text==='string'?p.text:'').join('').trim();
      if (!text) return sendJson(res,502,{error:'empty_model_response',message:'モデルからテキスト応答を取得できませんでした。'});
      return sendJson(res,200,{ok:true, provider:'gemini', model:MODEL, text});
    } catch (error) {
      if (error && (error.name==='AbortError' || error.name==='TimeoutError')) return sendJson(res,504,{error:'provider_timeout',message:'モデル応答が20秒以内に返りませんでした。'});
      if (error instanceof SyntaxError) return sendJson(res,400,{error:'invalid_json'});
      return sendJson(res,502,{error:'provider_unavailable',message:'モデル提供元に接続できませんでした。ネットワークとサーバーログを確認してください。'});
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res,405,{error:'method_not_allowed'});
  let pathname;
  try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch (_) { return sendJson(res,400,{error:'bad_path'}); }
  if (pathname === '/') pathname='/index.html';
  if (!PUBLIC_FILES.has(pathname)) return sendJson(res,404,{error:'not_found'});
  const full=path.resolve(ROOT,'.'+pathname);
  if (!full.startsWith(ROOT+path.sep)) return sendJson(res,403,{error:'forbidden'});
  fs.readFile(full,(err,bytes)=>{
    if(err) return sendJson(res,404,{error:'not_found'});
    res.statusCode=200; res.setHeader('Content-Type',MIME[path.extname(full)]||'application/octet-stream');
    if(req.method==='HEAD') return res.end();
    res.end(bytes);
  });
});
function sendJson(res,status,obj){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(obj));}
server.listen(PORT,process.env.HOST || '0.0.0.0',()=>console.log(`SHADOW Phase 256 listening on http://127.0.0.1:${PORT}; Gemini configured=${Boolean(KEY)}`));
