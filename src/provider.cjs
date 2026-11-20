'use strict';
const Official=typeof require==='function'?require('./official-direct.cjs'):DirectorOfficial;
function createProvider(tavo,core){
  const finiteNumber=(...values)=>{for(const value of values){if(value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value)))return Number(value);}return null;};
  async function pngInfo(base64){
    try{
      const bytes=Uint8Array.from(atob(base64.replace(/^data:[^,]*,/,'')),c=>c.charCodeAt(0));
      if(bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)return null;
      const view=new DataView(bytes.buffer),decoder=new TextDecoder(),metadata={},textChunks=[];
      for(let at=8;at+12<=bytes.length;){
        const size=view.getUint32(at),kind=decoder.decode(bytes.slice(at+4,at+8));if(at+12+size>bytes.length)return null;
        if(size<=1048576&&(kind==='tEXt'||kind==='zTXt'||kind==='iTXt')){
          const data=bytes.slice(at+8,at+8+size);
          const split=data.indexOf(0);if(split>0){let text;
            textChunks.push({type:kind,key:decoder.decode(data.slice(0,split))});if(kind==='iTXt'){const compressed=data[split+1],method=data[split+2],languageEnd=data.indexOf(0,split+3),translatedEnd=data.indexOf(0,languageEnd+1);if(languageEnd>=0&&translatedEnd>=0){const payload=data.slice(translatedEnd+1);if(compressed===0)text=decoder.decode(payload);else if(compressed===1&&method===0&&typeof DecompressionStream==='function')text=await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate'))).text();}}
            else if(kind==='tEXt')text=decoder.decode(data.slice(split+1));
            else if(typeof DecompressionStream==='function'&&data[split+1]===0)text=await new Response(new Blob([data.slice(split+2)]).stream().pipeThrough(new DecompressionStream('deflate'))).text();
            if(text)metadata[decoder.decode(data.slice(0,split))]=text;
          }
        }
        at+=size+12;
      }
      let comment;try{comment=JSON.parse(metadata.Comment||'null');if(comment&&typeof comment.Comment==='string')comment=JSON.parse(comment.Comment);}catch{}let seed=core.confirmedSeed(comment)??core.confirmedSeed(comment?.parameters)??core.confirmedSeed(comment?.params);
      const parameterText=String(metadata.parameters||''),parameterRoot=comment?.parameters||comment?.params||comment||{};
      if(seed===null){const m=parameterText.match(/(?:^|,\s*)Seed:\s*(\d+)(?:,|$)/);if(m&&Number.isSafeInteger(Number(m[1])))seed=Number(m[1]);}
      const strength=finiteNumber(parameterRoot.strength,parameterRoot.img2img?.strength,comment?.strength,parameterText.match(/(?:^|,\s*)Strength:\s*([0-9.]+)/)?.[1]);
      const noise=finiteNumber(parameterRoot.noise,parameterRoot.img2img?.noise,comment?.noise,parameterText.match(/(?:^|,\s*)Noise:\s*([0-9.]+)/)?.[1]);
      const caption=comment?.v4_prompt?.caption,negative=comment?.v4_negative_prompt?.caption;
      return {metadataStorage:{textChunks,readStatus:textChunks.length?'text-chunks-read':'no-readable-text-chunks'},steps:finiteNumber(parameterRoot.steps),scale:finiteNumber(parameterRoot.scale),sampler:parameterRoot.sampler||null,seed,width:view.getUint32(16),height:view.getUint32(20),strength,noise,noiseSchedule:parameterRoot.noise_schedule??null,prompt:comment?.prompt||metadata.Description||'',baseCaption:caption?.base_caption||'',characterPrompts:(caption?.char_captions||[]).map(x=>x.char_caption||''),negativePrompt:comment?.uc||negative?.base_caption||'',generationSeconds:Number(metadata.Generation_time)||null,source:metadata.Source||'',hasPrompt:!!(comment?.prompt||metadata.Description||caption)};
    }catch{/* Missing metadata is an optional capability, never an image failure. */}
    return null;
  }
  async function pngSeed(base64){const info=await pngInfo(base64);return info?.seed!==null&&info?.seed!==undefined?{value:info.seed,source:'image-metadata'}:null;}
  function verify(compiled,info,seed){
    const normalize=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
    const actual=normalize([info?.prompt,info?.baseCaption,...(info?.characterPrompts||[])].join('\n')),missing=[];
    if(info?.hasPrompt)for(const [index,c]of(compiled.characters||[]).entries()){
      // Character compilation may remove repeated simple tags. Confirm the
      // actual submitted section before comparing its uncompiled fields.
      const submitted=normalize(compiled.sections?.characters?.[index]?.prompt);
      if(submitted&&actual.includes(submitted))continue;
      for(const field of ['identity','outfit'])if(c[field]&&!actual.includes(normalize(c[field])))missing.push({character:index+1,field});
    }
    const seedMismatch=compiled.fixedSeed===true&&seed!==null&&seed!==compiled.requestedSeed;
    const negativeUnconfirmed=!!(info?.negativePrompt&&compiled.options?.negativePrompt&&!normalize(info.negativePrompt).includes(normalize(compiled.options.negativePrompt)));
    const isolationUnconfirmed=!!(info?.hasPrompt&&compiled.format==='nai45'&&compiled.characters?.length>1&&(info.characterPrompts||[]).length<compiled.characters.length);
    const warnings=[];
    if(missing.length)warnings.push('返回图片元数据缺少部分人物提示词，请核对接口传递');
    if(seedMismatch)warnings.push('接口实际 Seed 与固定值不同，不能按已固定处理');
    if(negativeUnconfirmed)warnings.push('本次画风负面词未在返回元数据中确认');
    const pipeSyntax=compiled.format==='nai45'&&compiled.syntax==='nai45-pipe';
    if(isolationUnconfirmed&&!pipeSyntax)warnings.push('元数据未确认独立人物栏，需核对接口传递');
    const notes=isolationUnconfirmed&&pipeSyntax?['采用单段提示词；元数据未单列人物栏，不能据此判断动作或人物是否混合']:[];
    return {seedStatus:seed===null?'not-returned':compiled.requestedSeed===null||compiled.requestedSeed===undefined?'returned':seed===compiled.requestedSeed?'matched':'mismatch',status:info?.hasPrompt?(missing.length?'mismatch':'prompt-fields-confirmed'):'unknown',missing,seedMismatch,seedDifferent:seed!==null&&compiled.requestedSeed!==null&&compiled.requestedSeed!==undefined&&seed!==compiled.requestedSeed,negativeUnconfirmed,isolationUnconfirmed,characterPromptSyntax:pipeSyntax?'nai45-pipe':'generic',visualConsistency:'not-evaluated',notes,warning:warnings.join('；')};
  }
  async function generate(compiled,job,guard,onReturned=()=>{}){
    await guard();const options={...compiled.options,timeout:0,saveAs:'ad_image_'+job.id+'.png',scope:'chat'};
    const requestAudit={method:'tavo.image.generate',referenceImages:Array.isArray(options.referenceImages)?options.referenceImages.slice():[],extraBody:structuredClone(options.extraBody||{}),promptTransportAudit:{schema:'aozora-prompt-transport-audit-v1',capturePoint:'plugin-provider-boundary',transport:compiled.officialDirect?'official-direct-delegated':'tavo.image.generate',prompt:compiled.prompt||'',syntax:compiled.syntax||'',format:compiled.format||'',sections:compiled.sections||null,negativePrompt:options.negativePrompt||'',options:Object.fromEntries(Object.entries(options).filter(([k,v])=>!/(key|token|auth|password|secret|credential)/i.test(k)&&k!=='referenceImages'&&!(typeof v==='string'&&/^data:/i.test(v)))),referenceImageNames:(Array.isArray(options.referenceImages)?options.referenceImages:[]).map(v=>String(v).split('/').pop()),downstreamProviderPayload:compiled.officialDirect?'CAPTURED_BY_OFFICIAL_DIRECT_AUDIT':'UNKNOWN_HOST_CONTROLLED'},submittedAt:Date.now(),providerExecutionConfirmed:false};
    const timings={imageCallStartedAt:Date.now()};let result;try{if(compiled.officialDirect)result=await Official.generate(tavo,compiled,job,guard);else result=await tavo.image.generate(compiled.prompt,options);timings.imageCallReturnedAt=Date.now();}catch(error){const detail=String(error?.message||error),mapping=detail.includes('CUSTOM_MODEL_MAPPING_REQUIRED');const failure=new Error(mapping?'图片 API 拒绝请求：CUSTOM_MODEL_MAPPING_REQUIRED（自定义模型映射缺失）。请核对 Tavo 图片 API 的实际 model ID 和站点映射；生成提示词已保留，未自动重试。':'图片 API 调用失败：'+detail);failure.source=compiled.officialDirect?'novelai-direct':'tavo.image.generate';failure.code=mapping?'CUSTOM_MODEL_MAPPING_REQUIRED':String(error?.code||'IMAGE_REQUEST_FAILED');failure.statusCode=error?.statusCode||error?.status||error?.response?.status||null;failure.details=error?.details||detail;throw failure;}
    await guard();onReturned();let pointer=typeof result==='string'?result:(result?.path||result?.url||result?.image||'');
    if(result?.data)pointer=String(result.data).startsWith('data:')?result.data:'data:image/png;base64,'+result.data;
    if(/^data:image\//i.test(pointer)){
      try{pointer=await tavo.file.save(options.saveAs,pointer,{encoding:'dataUrl',scope:'chat'});}
      catch(error){throw Object.assign(Error('图片已返回但保存失败'),{code:'IMAGE_STORAGE_FAILED',details:String(error?.message||error)});}
      await guard();
    }
    if(!/^files\/(?:chat|global)\//.test(String(pointer)))throw Object.assign(Error('图片返回未包含可确认的持久化文件，请查看记录后再重试'),{code:'IMAGE_RESPONSE_INVALID'});
    if(!await tavo.file.exists(pointer))throw Object.assign(Error('服务返回的图片文件不存在'),{code:'IMAGE_STORAGE_FAILED'});await guard();
    let seed=core.confirmedSeed(result),seedSource=seed===null?'':'response',metadata=null;
    timings.metadataStartedAt=Date.now();try{const raw=await tavo.file.load(pointer,{encoding:'base64'});await guard();if(typeof raw==='string'){metadata=await pngInfo(raw);if(metadata?.seed!==null&&metadata?.seed!==undefined){seed=metadata.seed;seedSource='image-metadata';}}}catch{/* Metadata extraction is optional. */}timings.metadataFinishedAt=Date.now();
    if(result?.directAudit)Object.assign(requestAudit,result.directAudit);
    const runtime=result&&typeof result==='object'?(result.runtimeParams||result.parameters||result.metadata?.parameters||result.metadata||result):{};
    const returnedStrength=finiteNumber(metadata?.strength,runtime?.strength,runtime?.img2img?.strength),returnedNoise=finiteNumber(metadata?.noise,runtime?.noise,runtime?.img2img?.noise);
    const requestedStrength=finiteNumber(result?.directAudit?.extraBody?.strength,options.extraBody?.strength),requestedNoise=finiteNumber(result?.directAudit?.extraBody?.noise,options.extraBody?.noise);
    const hasReturnedMotionParameter=returnedStrength!==null||returnedNoise!==null;
    const strengthMatches=requestedStrength===null||returnedStrength===null||returnedStrength===requestedStrength,noiseMatches=requestedNoise===null||returnedNoise===null||returnedNoise===requestedNoise;
    const parameterVerification=requestedStrength===null&&requestedNoise===null?{status:'host-controlled',requestedStrength,requestedNoise,returnedStrength,returnedNoise}:hasReturnedMotionParameter?{status:!strengthMatches||!noiseMatches?'mismatch':returnedStrength!==null&&returnedNoise!==null?'matched':'partial',requestedStrength,requestedNoise,returnedStrength,returnedNoise}: {status:'not-returned',requestedStrength,requestedNoise,returnedStrength:null,returnedNoise:null};
    requestAudit.providerExecutionConfirmed=parameterVerification.status==='matched';requestAudit.parameterVerification=parameterVerification;
    if(compiled.officialDirect&&metadata){requestAudit.returnedNoiseSchedule=metadata.noiseSchedule;requestAudit.returnedWidth=metadata.width;requestAudit.returnedHeight=metadata.height;requestAudit.providerExecutionConfirmed=requestAudit.providerExecutionConfirmed&&metadata.width===result.directAudit.extraBody.width&&metadata.height===result.directAudit.extraBody.height&&metadata.noiseSchedule===result.directAudit.extraBody.noise_schedule&&seed===compiled.requestedSeed;}
    return {pointer,seed,seedSource,requestedSeed:compiled.requestedSeed,seedVerification:{status:seed===null?'not-returned':compiled.requestedSeed===null||compiled.requestedSeed===undefined?'returned':seed===compiled.requestedSeed?'matched':'mismatch',requestedSeed:compiled.requestedSeed??null,returnedSeed:seed,source:seedSource||null},metadata,parameterVerification,requestAudit,verification:verify(compiled,metadata,seed),timings,providerFields:result&&typeof result==='object'?Object.keys(result).filter(k=>!['data','image'].includes(k)):[]};
  }
  return {generate,pngSeed,pngInfo,verify};
}
if(typeof module!=='undefined')module.exports={createProvider};
