'use strict';
function route(url,format='auto',motion=false){
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('请填写不含密钥的 HTTPS API 地址');
  if(!['auto','native','openai'].includes(format))throw Error('请选择有效的接口格式');
  u.pathname=u.pathname.replace(/\/+$/,'');
  let kind=format;
  if(kind==='auto')kind=/\/images\/generations$/.test(u.pathname)?'openai':/\/nai\/generate-image$/.test(u.pathname)?'native-json':u.hostname==='nai.rinko.ai'&&['','/v1'].includes(u.pathname)?'native-json':u.pathname==='/v1'?'openai':'native';
  if(motion&&kind==='openai'&&u.hostname==='nai.rinko.ai'&&['/v1','/v1/images/generations'].includes(u.pathname)){
    kind='native-json';
  }
  if(kind==='openai'){
    if(motion)throw Object.assign(Error('当前 API 接口不支持 NovelAI 原生图生图。请核对服务商提供的图生图接口。'),{code:'IMAGE_API_CONFIG'});
    if(!u.pathname.endsWith('/images/generations'))u.pathname+='/images/generations';
  }else if(kind==='native-json'){
    if(!u.pathname.endsWith('/nai/generate-image'))u.pathname='/v1/nai/generate-image';
  }else if(!u.pathname.endsWith('/ai/generate-image'))u.pathname+='/ai/generate-image';
  return {kind,url:u.toString()};
}
function body(native,kind,url){
  if(kind!=='openai')return native;
  const p=native.parameters,request={model:native.model,prompt:native.input,size:p.width+'x'+p.height,n:1,response_format:'b64_json'};
  if(new URL(url).hostname==='nai.rinko.ai')request.nai={action:native.action,...p};
  else Object.assign(request,{seed:p.seed,negative_prompt:p.negative_prompt,steps:p.steps,scale:p.scale,sampler:p.sampler,noise_schedule:p.noise_schedule});
  return request;
}
function seed(value){for(const v of [value?.seed,value?.metadata?.seed,value?.runtimeParams?.seed])if(v!==null&&v!==undefined&&/^\d+$/.test(String(v))&&Number.isSafeInteger(Number(v))&&Number(v)<=4294967295)return Number(v);return null;}
async function jsonImage(response,signal){
  const value=await response.json(),item=value.data?.[0]||value.images?.[0],raw=typeof item==='string'?item:item?.b64_json||item?.url;
  if(!raw)throw Object.assign(Error('API JSON 返回中没有图片。'),{code:'IMAGE_RESPONSE_INVALID'});
  let bytes;
  if(/^https:\/\//i.test(raw)){
    // Image links receive no API credentials. Never forward Authorization across hosts.
    const imageResponse=await fetch(raw,{signal,redirect:'error',credentials:'omit'});
    if(!imageResponse.ok)throw Object.assign(Error('图片下载返回 HTTP '+imageResponse.status),{code:'IMAGE_DOWNLOAD_HTTP',statusCode:imageResponse.status});
    bytes=new Uint8Array(await imageResponse.arrayBuffer());
  }else {const b64=raw.replace(/^data:image\/[^;,]+;base64,/i,'');bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));}
  return {bytes,seed:seed(item)??seed(value),responseFields:Object.keys(value),imageFields:item&&typeof item==='object'?Object.keys(item):[],jobId:value.job?.job_id||null};
}
module.exports={route,body,jsonImage,seed};
