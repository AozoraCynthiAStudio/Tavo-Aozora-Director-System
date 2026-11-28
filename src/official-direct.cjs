'use strict';
const Dynamic=typeof require==='function'?require('./dynamic-settings.cjs'):DirectorDynamicSettings;
const Transport=typeof require==='function'?require('./api-transport.cjs'):DirectorApiTransport;
const ENDPOINT='https://image.novelai.net/ai/generate-image';
const DEFAULT_RELAY='';
function requestError(message,code,statusCode){return Object.assign(Error(message),{code,...(statusCode?{statusCode}:{})});}
async function imageHttpError(response,mode,key){
  const data=await Promise.resolve().then(()=>response.json()).catch(()=>null);
  const error=data?.error;
  const field=Array.isArray(data?.detail)?data.detail[0]:null;
  const location=Array.isArray(field?.loc)?field.loc.filter(part=>typeof part==='string'||typeof part==='number').join('.'):'';
  const message=error?.message??error?.detail??data?.message??field?.msg??data?.detail??error;
  const clean=(value,limit)=>typeof value==='string'?value
    .replaceAll(key,'[已隐藏]')
    .replace(/Bearer\s+[^\s,;"']+/gi,'Bearer [已隐藏]')
    .replace(/[A-Za-z0-9+/_=-]{80,}/g,'[已隐藏]')
    .replace(/\s+/g,' ').trim().slice(0,limit):'';
  const details=[clean(error?.code??data?.code??field?.type,80),clean(location,100),clean(message,260)].filter(Boolean).join(' · ');
  const status=response.status;
  return requestError(mode+' API 返回 HTTP '+status+(status===401?'（鉴权失败）':'')+(details?' · '+details:''),'IMAGE_HTTP_ERROR',status);
}
function endpoint(url){const address=String(url||'').trim();if(!address)throw requestError('请先填写自己的中转 API 地址','IMAGE_API_CONFIG');let u;try{u=new URL(address);}catch{throw requestError('中转 API 地址格式无效','IMAGE_API_CONFIG');}if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw requestError('API URL需为不含密钥或查询参数的HTTPS地址','IMAGE_API_CONFIG');u.pathname=u.pathname.replace(/\/+$/,'');if(!u.pathname.endsWith('/ai/generate-image'))u.pathname+='/ai/generate-image';return u.toString();}
function connectionProfile(connection={},requested){connection=connection||{};const provider=requested||connection.provider||'official',relay=connection.thirdParty||{};if(!['official','thirdparty'].includes(provider))throw requestError('API 类型无效','IMAGE_API_CONFIG');return {provider,endpoint:provider==='official'?ENDPOINT:(relay.url?endpoint(relay.url):''),apiKey:provider==='official'?connection.apiKey||'':relay.apiKey||'',url:relay.url||DEFAULT_RELAY,strength:connection.strength??Dynamic.DEFAULTS.strength,dynamicSeedMode:Dynamic.normalize(connection.parameters,connection.strength).seedMode,parameters:Dynamic.normalize(connection.parameters,connection.strength)};}
module.exports={};
function decode(text){const plain=String(text||'').replace(/^data:[^,]*,/,'');return Uint8Array.from(atob(plain),c=>c.charCodeAt(0));}
function encode(bytes){let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(binary);}
function pngDimensions(bytes){if(bytes.length<24||[137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v))throw Error('官方直连目前仅支持 PNG 来源图，请选择已生成的 PNG');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return {width:view.getUint32(16),height:view.getUint32(20)};}
async function unzipPng(bytes){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(v.getUint32(p,true)===0x06054b50){end=p;break;}if(end<0)throw Error('官方返回未包含有效 ZIP 图片');let at=v.getUint32(end+16,true);const count=v.getUint16(end+10,true);for(let i=0;i<count;i++){if(v.getUint32(at,true)!==0x02014b50)throw Error('官方图片压缩目录损坏');const method=v.getUint16(at+10,true),size=v.getUint32(at+20,true),expected=v.getUint32(at+24,true),nl=v.getUint16(at+28,true),xl=v.getUint16(at+30,true),cl=v.getUint16(at+32,true),offset=v.getUint32(at+42,true),name=new TextDecoder().decode(bytes.subarray(at+46,at+46+nl));if(/\.png$/i.test(name)){if(expected>50*1024*1024||v.getUint32(offset,true)!==0x04034b50)throw Error('官方图片大小或压缩数据无效');const start=offset+30+v.getUint16(offset+26,true)+v.getUint16(offset+28,true),data=bytes.subarray(start,start+size);let png;if(method===0)png=data;else if(method===8&&typeof DecompressionStream==='function')png=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());else throw Error('当前运行环境不支持官方 ZIP 解压，请更新系统 WebView');if(png.length!==expected)throw Error('官方图片解压长度不一致');pngDimensions(png);return png;}at+=46+nl+xl+cl;}throw Error('官方返回 ZIP 中没有 PNG');}
// Official native text-to-image can split Base and character captions.
// Relays keep one prompt string. Multi-API caption columns are not used.
function nativeCaptionRoute(provider,routeKind){return provider==='official'&&routeKind==='native';}
function applyNativeNaiCaptions(body,compiled){
 const groups=compiled?.sections,characters=groups?.characters;
 if(compiled?.format!=='nai45'||!['nai45-pipe','nai5-pipe'].includes(compiled.syntax)||!groups||!Array.isArray(characters)||!characters.length)return false;
 const base=String(groups.base||''),parts=characters.map(c=>String(c.prompt||''));
 if(!base||parts.some(p=>!p)||[base,...parts].join(' | ')!==compiled.prompt)return false;
 const centers=[{x:0.5,y:0.5}]; // coords disabled: let the model place characters.
 body.input=base;
 body.parameters.v4_prompt={caption:{base_caption:base,char_captions:parts.map(char_caption=>({char_caption,centers}))},use_coords:false,use_order:true,legacy_uc:false};
 const uc=String(compiled.options?.negativePrompt||'');
 body.parameters.v4_negative_prompt={caption:{base_caption:uc,char_captions:parts.map(()=>({char_caption:'',centers}))},use_coords:false,use_order:true,legacy_uc:false};
 return true;
}
function requestBody(compiled,source,strength=Dynamic.DEFAULTS.strength,settings={}){const p=Dynamic.validate({...Dynamic.normalize(settings),strength});const original=pngDimensions(source),{width,height}=p.sizeMode==='custom'?p:original;if(width%64||height%64)throw Error('官方直连要求原图宽高为64的倍数');const prompt=compiled.prompt,negative=compiled.options.negativePrompt||'',seed=compiled.requestedSeed??Math.floor(Math.random()*4294967296);return {input:prompt,model:p.model,action:'img2img',parameters:{params_version:3,width,height,scale:p.scale,sampler:p.sampler,steps:p.steps,n_samples:1,seed,extra_noise_seed:seed===0?1:seed-1,strength,noise:p.noise,noise_schedule:p.noiseSchedule,image:encode(source),negative_prompt:negative,ucPreset:0,qualityToggle:false,cfg_rescale:0,sm:false,sm_dyn:false,dynamic_thresholding:false,legacy:false,legacy_v3_extend:false,add_original_image:false,deliberate_euler_ancestral_bug:true,prefer_brownian:false,color_correct:false,v4_prompt:{caption:{base_caption:prompt,char_captions:[]},use_coords:true,use_order:true,legacy_uc:false},v4_negative_prompt:{caption:{base_caption:negative,char_captions:[]},use_coords:false,use_order:false,legacy_uc:false}}};}
async function generate(tavo,compiled,job,guard){
  const mode=compiled.staticDirect&&!compiled.nai5EditConnection?'文生图':'图生图';await guard();
  const edit=compiled.nai5EditConnection;
  const connection=edit?(edit.endpoint===ENDPOINT?{provider:'official',apiKey:edit.key}:{provider:'thirdparty',thirdParty:{url:edit.endpoint,apiKey:edit.key}}):compiled.staticDirect?await tavo.variable.get(compiled.syntax==='nai5-pipe'?'aozora_nai5_static_v1':'aozora_direct_official_v1','global'):await tavo.variable.get('aozora_motion_connection_v1','global'),profile=connectionProfile(connection,compiled.directProvider);
  let key=String(profile.apiKey).trim().replace(/^Bearer\s+/i,'');if(!key)throw requestError('请先在对应的 API 设置中保存密钥。','IMAGE_API_CONFIG');if(profile.provider==='thirdparty'&&key.startsWith('pst-'))throw requestError('第三方 API 请填写站点密钥。','IMAGE_API_CONFIG');
  if(!profile.endpoint)throw requestError('请先填写 API 地址。','IMAGE_API_CONFIG');if(typeof fetch!=='function')throw requestError('当前环境不支持发送图片请求','IMAGE_RUNTIME_UNAVAILABLE');
  const parameters={...profile.parameters,...compiled.directSettings},format=compiled.staticDirect?parameters.apiFormat||'auto':connection.apiFormat||'auto',route=compiled.syntax==='nai5-pipe'?Transport.nai5Route(profile.provider==='official'?ENDPOINT:profile.url):Transport.route(profile.provider==='official'?ENDPOINT:profile.url,profile.provider==='official'?'native':format,!compiled.staticDirect);
  const pointer=compiled.options.referenceImages?.[0];let source=null;if(!compiled.staticDirect||edit){if(!pointer)throw Error('图生图缺少来源图片');source=decode(await tavo.file.load(pointer,{encoding:'base64'}));await guard();}
  const native=compiled.staticDirect?staticRequestBody(compiled,parameters):requestBody(compiled,source,parameters.strength,parameters);
  if(edit){native.action='img2img';Object.assign(native.parameters,{image:encode(source),strength:parameters.strength,noise:parameters.noise});}
  const nativeCaptionApplied=!!(compiled.staticDirect&&(compiled.syntax==='nai5-pipe'||nativeCaptionRoute(profile.provider,route.kind))&&applyNativeNaiCaptions(native,compiled));
  const body=Transport.body(native,route.kind,route.url);
  const {image,...parametersSent}=body.parameters||{};
  const {image:naiImage,...naiSent}=body.nai||{};
  const {image:taskImage,...taskParameters}=body.payload?.parameters||{};
  const wireAudit={schema:'aozora-provider-wire-audit-v1',capturePoint:'immediately-before-fetch',method:'POST',endpoint:route.url,apiFormat:route.kind,contentType:'application/json',model:native.model,action:native.action,input:route.kind==='nai-task'?body.payload.input:body.input||body.prompt||'',v4Prompt:nativeCaptionApplied?native.parameters.v4_prompt:body.parameters?.v4_prompt||null,v4NegativePrompt:nativeCaptionApplied?native.parameters.v4_negative_prompt:body.parameters?.v4_negative_prompt||null,parameterFields:Object.keys(body.payload?.parameters||body.nai||parametersSent),imagePayloadIncluded:!!(image||naiImage||taskImage),imagePayloadBytes:(image||naiImage||taskImage)?.length??null,authorizationHeaderPresent:true,authorizationValue:'REDACTED',body:{...body,...(body.payload?{payload:{...body.payload,parameters:taskParameters}}:{}),...(body.parameters?{parameters:parametersSent}:{}),...(body.nai?{nai:naiSent}:{})}};
  const audit={method:route.kind==='openai'?'openai-compatible-direct':profile.provider==='official'?'novelai-direct':'novelai-compatible-direct',apiFormat:route.kind,captionTransport:nativeCaptionApplied?(compiled.syntax==='nai5-pipe'?'nai5-native-captions':'nai45-native-captions'):'legacy-unchanged',endpoint:route.url,model:native.model,action:native.action,referenceImages:source?[pointer]:[],sourceWidth:source?pngDimensions(source).width:null,sourceHeight:source?pngDimensions(source).height:null,extraBody:Object.fromEntries(['width','height','seed','extra_noise_seed','strength','noise','noise_schedule','scale','steps','sampler'].filter(k=>native.parameters[k]!==undefined).map(k=>[k,native.parameters[k]])),wireAudit,submittedAt:Date.now(),providerExecutionConfirmed:false};
  try{
    let response;
    const headers={Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:route.kind==='native'?'application/zip':'application/json',...(profile.provider==='thirdparty'?{'Idempotency-Key':'aozora-'+job.id}:{})};
    const signal=route.kind==='nai-task'?AbortSignal.timeout(600000):undefined;
    try{response=await fetch(route.url,{method:'POST',headers,body:JSON.stringify(body),signal,redirect:'error'});}
    catch(error){if(error.name==='AbortError')throw error;throw requestError(mode+'图片请求连接失败','IMAGE_NETWORK_FAILED');}
    audit.taskId=response.headers?.get('X-NovelAI-Task-Id')||null;
    const type=response.headers?.get('Content-Type')||'';
    audit.response={status:response.status,contentType:type};
    if(!response.ok)throw await imageHttpError(response,mode,key);
    key='';
    let png,returnedSeed=null;
    try{
      if(route.kind==='nai-task'){
        png=await pollNaiTask(route.url,response,headers.Authorization,guard,audit,signal);
      }else if(route.kind!=='native'||/json/i.test(type)){const result=await Transport.jsonImage(response);png=result.bytes;returnedSeed=result.seed;audit.responseFields=result.responseFields;audit.responseImageFields=result.imageFields;audit.taskId=audit.taskId||result.jobId;}
      else png=await unzipPng(new Uint8Array(await response.arrayBuffer()));
      const dimensions=pngDimensions(png);audit.response={...audit.response,...dimensions,bytes:png.length};
    }catch(error){
      if(error.name==='AbortError'||typeof error.code==='string')throw error;
      if(String(error.message).includes('当前运行环境不支持官方 ZIP 解压'))throw requestError(error.message,'IMAGE_RUNTIME_UNAVAILABLE');
      const readFailure=/failed to fetch|network error|load failed|fetch failed|terminated/i.test(String(error.message));
      if(readFailure)throw requestError('读取图片服务响应时连接中断','IMAGE_DOWNLOAD_NETWORK');
      const invalid=requestError('图片服务返回的数据无法读取为 PNG','IMAGE_RESPONSE_INVALID');
      invalid.details=String(error?.message||error);throw invalid;
    }
    await guard();
    let saved;
    try{saved=await tavo.file.save(job.filename||'ad_image_'+job.id+'.png',encode(png),{scope:job.filename?'global':'chat',encoding:'base64'});}
    catch(error){const failure=requestError('图片已返回但保存失败','IMAGE_STORAGE_FAILED');failure.details=String(error?.message||error);throw failure;}
    await guard();
    if(!saved)throw requestError('图片已返回但保存未确认，请先查看记录','IMAGE_STORAGE_FAILED');
    return {path:saved,...(returnedSeed!==null?{seed:returnedSeed}:{}),directAudit:audit};
  }finally{key='';}
}
async function pollNaiTask(url,response,authorization,guard,audit,signal){
  let task=await response.json();
  const id=task.id;
  if(typeof id!=='string'||!/^[a-z0-9_-]+$/i.test(id))throw requestError('服务商未返回有效任务编号','IMAGE_RESPONSE_INVALID');
  audit.taskId=id;
  try{
    while(['queued','in_progress','unknown'].includes(task.status)){
      await guard();
      await new Promise(resolve=>setTimeout(resolve,5000));
      await guard();
      const result=await fetch(url+'/'+id,{headers:{Authorization:authorization},signal,redirect:'error'});
      if(!result.ok)throw requestError('任务查询返回 HTTP '+result.status,'IMAGE_HTTP_ERROR',result.status);
      task=await result.json();
    }
    if(task.status!=='completed')throw requestError('生图任务未完成（'+task.status+'）','IMAGE_RESPONSE_INVALID');
    const result=await Transport.jsonImage({json:async()=>({images:task.result?.images?.map(image=>image.url)})},signal);
    return result.bytes;
  }catch(error){
    if(error.name==='AbortError')throw error;
    throw requestError((error.name==='TimeoutError'?'等待生图超时':error.message)+'，可在站内查询任务 '+id,error.code||'IMAGE_RESPONSE_INVALID',error.statusCode);
  }
}
function nai5RequestBody(compiled,p){
  const prompt=compiled.prompt,negative=compiled.options.negativePrompt||'';
  const caption=(base_caption,use_order)=>({caption:{base_caption,char_captions:[]},use_coords:false,use_order});
  return {input:prompt,model:'nai-diffusion-5-full',action:'generate',parameters:{
    params_version:4,width:p.width,height:p.height,steps:p.steps,scale:p.scale,
    sampler:p.sampler,noise_schedule:p.noiseSchedule,seed:compiled.requestedSeed??Math.floor(Math.random()*4294967296),
    n_samples:1,image_format:'png',negative_prompt:negative,v4_prompt:caption(prompt,true),v4_negative_prompt:caption(negative,false)
  }};
}
function staticRequestBody(compiled,settings={}){const p=Dynamic.validate({...Dynamic.normalize(settings),sizeMode:'custom'});if(compiled.syntax==='nai5-pipe')return nai5RequestBody(compiled,p);const fake=new Uint8Array(24);fake.set([137,80,78,71,13,10,26,10]);const view=new DataView(fake.buffer);view.setUint32(16,p.width);view.setUint32(20,p.height);const body=requestBody(compiled,fake,p.strength,p);body.action='generate';delete body.parameters.image;delete body.parameters.strength;delete body.parameters.noise;delete body.parameters.extra_noise_seed;body.parameters.qualityToggle=true;return body;}
module.exports={generate,requestBody,staticRequestBody,applyNativeNaiCaptions,nativeCaptionRoute,unzipPng,pngDimensions,decode,encode,ENDPOINT,DEFAULT_RELAY,endpoint,connectionProfile};
