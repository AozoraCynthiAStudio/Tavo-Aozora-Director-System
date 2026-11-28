'use strict';
const Official=typeof require==='function'?require('./official-direct.cjs'):DirectorOfficial;
const endpoint='https://api.hamubox.com/v1/image/generations';
const CoreRules=typeof require==='function'?require('./core.cjs'):Core;
const keyName='aozora_hamubox_key_v1';

async function generate(tavo,compiled,guard){
  const gpt=!!compiled.gptImageConnection;
  const connection=compiled.gptImageConnection||compiled.seedreamConnection;
  const url=connection?.endpoint||endpoint;
  const key=connection?connection.key:await tavo.variable.get(keyName,'global');
  if(!key)throw Object.assign(Error('请在静态 API 设置中保存生图 API Key'),{code:'IMAGE_API_CONFIG'});
  const model=compiled.hamuboxModel??CoreRules.HAMUBOX_DEFAULT;
  if(!Object.hasOwn(CoreRules.HAMUBOX_MODELS,model))throw Error('不支持的 Hamubox 模型');
  const seedream=model===CoreRules.HAMUBOX_DEFAULT;
  const {aspectRatio,referenceImages=[]}=compiled.options||{};
  const images=[];
  for(const pointer of (seedream&&!gpt)||compiled.gptImageEdit?referenceImages:[]){
    await guard();
    const data=await tavo.file.load(pointer,{encoding:'dataUrl'});
    if(typeof data!=='string'||!/^data:image\/(png|jpeg|webp);base64,/i.test(data))throw Error('无法读取所选参考图');
    images.push(data);
  }
  const resolution=seedream?(compiled.hamuboxResolution||'1k'):'1K';
  const sync=!!connection&&compiled.seedreamProtocol==='sync';
  const body=gpt?{model:connection.model,prompt:compiled.prompt,size:compiled.gptImageSize,n:1,...(compiled.gptImageEdit?{images:images.map(image_url=>({image_url}))}:{})}:sync?{model:connection.model,prompt:compiled.prompt,size:CoreRules.seedreamSize(resolution,aspectRatio),response_format:'url',output_format:'png',...(images.length?{image:images}: {})}:{model:connection?.model||model,prompt:compiled.prompt,resolution,...(aspectRatio?{aspect_ratio:aspectRatio}:{}),...(seedream?{output_format:'png'}:{}),...(images.length?{images}:{})};
  const headers={Authorization:'Bearer '+key,Accept:'application/json'};
  const controller=new AbortController(), signal=controller.signal;
  const timer=setTimeout(()=>controller.abort(),gpt?300000:180000);
  let taskId='';
  const contentRejection=/content[_ -](?:policy[_ -]violation|moderation|filter)|moderation[_ -]blocked|safety[_ -](?:system|violation|rejection)|responsibleaipolicyviolation|blocked by (?:the )?(?:safety|moderation)|内容审核|安全审核/i;
  function providerError(code,message,statusCode){
    const sourceCode=String(code||'').replaceAll(key,'[已隐藏]').slice(0,80);
    const detail=String(message||'').replaceAll(key,'[已隐藏]').slice(0,300);
    const providerCode=gpt&&contentRejection.test(sourceCode+' '+detail)?'GPT_IMAGE_CONTENT_REJECTED':sourceCode;
    return Object.assign(Error([statusCode?'图片服务返回 HTTP '+statusCode:'',sourceCode,detail].filter(Boolean).join(' · ')||'图片任务失败'),{statusCode,code:providerCode||undefined});
  }
  async function request(address,options){
    await guard();
    const response=await fetch(address,{...options,signal,redirect:'error',credentials:'omit'});
    if(!response.ok){
      const failure=await response.json().catch(()=>null);
      throw providerError(failure?.error?.code,failure?.error?.message,response.status);
    }
    return response;
  }
  try{
    let task=await (await request(url,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
    if(task?.error)throw providerError(task.error.code,task.error.message);
    const direct=Array.isArray(task.data)&&!!(task.data[0]?.url||task.data[0]?.b64_json);
    if(!direct){
    if(gpt&&url===CoreRules.GPT_IMAGE_OFFICIAL_ENDPOINT)throw Error('OpenAI 官方生图接口未返回图片数据');
    taskId=task.id||task.task_id||'';
    if(typeof taskId!=='string'||!/^[A-Za-z0-9_-]+$/.test(taskId))throw Error('图片服务未返回可识别的图片或任务 ID，请核对生图接口协议');
    while(['queued','in_progress','unknown'].includes(task.status)){
      await new Promise(resolve=>setTimeout(resolve,5000));
      task=await (await request(url+'/'+taskId,{headers})).json();
    }
    if(task.status==='failed'&&typeof task.error?.message==='string')throw providerError(task.error.code||'HAMUBOX_TASK_FAILED',task.error.message);
    if(task.status!=='completed')throw Error('Hamubox 任务未完成，状态：'+String(task.status||'未知'));
    }
    const item=direct?task.data[0]:task.outputs?.[0];
    let bytes;
    if(typeof item?.b64_json==='string')bytes=Official.decode(item.b64_json);
    else{
      if(typeof item?.url!=='string'||!/^https:\/\//i.test(item.url))throw Error('图片服务未返回有效的图片');
      bytes=new Uint8Array(await (await request(item.url)).arrayBuffer());
    }
    const jpeg=bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if(!jpeg)Official.pngDimensions(bytes);
    const mime=jpeg?'image/jpeg':'image/png';
    return {data:'data:'+mime+';base64,'+Official.encode(bytes),imageExtension:jpeg?'jpg':'png',directAudit:{method:gpt?'gpt-image-direct':connection?(sync?'seedream-sync':'seedream-async'):'hamubox-direct',endpoint:url,model:body.model,taskId,resolution:body.resolution||body.size,referenceCount:images.length,actualCostUsd:task.usage?.actual_cost_usd??null}};
  }catch(error){
    if(error.name==='AbortError')throw Error('Hamubox 等待或下载超时'+(taskId?'，可在站内查询任务 '+taskId:'，请先核对站内是否已创建任务'));
    if(taskId)error.message+='（任务 '+taskId+'）';
    throw error;
  }finally{clearTimeout(timer);}
}
module.exports={generate,keyName};
