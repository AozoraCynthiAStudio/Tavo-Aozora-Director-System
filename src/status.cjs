 'use strict';
const PHASES={ready:['待手动生成','提示词已保存，点击生成开始。',false],idle:['导演待命','设定下一轮导演后，发送消息开始。',false],pending:['下一轮已设定','发送消息后开始整理导演提示词。',false],'no-director':['未设置下一轮导演','本轮正文不会自动生成画面。',true],preparing:['整理导演提示词','与本轮文本回复同时处理，尚未提交生成任务。',true],'prompt-ready':['导演提示词已就绪','等待回复保存后提交生成。',true],queued:['等待生成','导演方案已保存，正在准备提交。',true],generating:['正在生成','收起界面后，生成仍会继续。',true],saving:['正在保存','结果已返回，正在核对文件并保存记录。',true],loading:['正在加载','正在读取已保存的结果，不会重新生成。',true],done:['生成完成','',false],failed:['生成未完成','查看运行记录后，可使用原按钮重试。',false],uncertain:['生成结果待确认','先查看记录或恢复返回结果，避免重复提交。',false],cancelled:['本轮已取消','没有自动提交新的生成任务。',false]};
function describe(value={}){const phase=PHASES[value.phase]?value.phase:'idle',row=PHASES[phase];return {...value,phase,label:phase==='preparing'&&value.taskType?'正在准备'+(value.taskType==='申请动态'?'动态画面':value.taskType):row[0],hint:value.error||(phase==='preparing'&&value.taskType?'正在整理画面变化，收起窗口仍会继续。':row[1]),busy:row[2],tone:phase==='failed'?'error':phase==='uncertain'?'warning':phase==='done'?'success':'normal'};}
function fromRecord(record){if(!record)return describe();const phase=record.status==='generating'?(record.generationPhase||'generating'):record.status==='done'?(record.images?.length?'done':'idle'):PHASES[record.status]?record.status:'idle';return describe({phase,messageId:String(record.messageId||''),error:record.error||'',errorCode:record.errorCode||'',statusCode:record.errorStatus||null});}
function imageFailure(value){
 const message=String(value?.message||value?.error||(typeof value==='string'?value:'')).trim();
 const code=String(value?.code||value?.errorCode||'');
 const http=[value?.statusCode,value?.status,message.match(/\b(?:HTTP|status(?: code)?)\s*[:：=]?\s*([45]\d{2})\b/i)?.[1]].map(Number).find(status=>status>=400&&status<=599)||0;
 const context=[code,message].join(' ');
 const response=hint=>({title:http?'图片服务返回 HTTP '+http:'图片服务拒绝请求',hint});
 if(code==='TEXT_MODEL_REFUSED')return {title:'文本模型拒绝请求',hint:'未返回画面方案，原图已保留，尚未提交图片生成；具体返回见运行记录。'};
 if(code==='IMAGE_DOWNLOAD_NETWORK')return {title:'读取图片结果时连接中断',hint:'请先确认服务是否已生成图片。'};
 if(code==='IMAGE_DOWNLOAD_HTTP'||/图片下载返回 HTTP/i.test(message))return {title:'图片下载失败'+(http?'（HTTP '+http+'）':''),hint:'服务已返回图片地址，当前未取到图片。'};
 if(code==='IMAGE_STORAGE_FAILED')return {title:'图片保存失败',hint:'未能确认本地图片文件。'};
 if(code==='IMAGE_RESPONSE_INVALID'||/返回.{0,12}(?:没有图片|未包含|无效|损坏)|(?:JSON|ZIP).{0,12}(?:没有图片|没有 PNG)/i.test(message))return {title:'图片服务返回异常',hint:'未取得可用的图片结果，可查看运行记录。'};
 if(code==='IMAGE_API_CONFIG'||code==='CUSTOM_MODEL_MAPPING_REQUIRED'||/^(?:图片 API 调用失败[：:]\s*)?(?:请先(?:填写|保存|在.{0,14}设置中保存).{0,14}(?:API 地址|API Key|密钥)|第三方 API 请填写站点密钥|(?:中转 )?API 地址格式无效|API (?:URL|类型)无效|API URL需为|请选择有效的接口格式)/i.test(message))return {title:'图片 API 配置未就绪',hint:message};
 if(code==='IMAGE_NETWORK_FAILED')return {title:'图片请求连接失败',hint:'可检查网络连接，稍后再试。'};
 if(http===401||(!http&&/\b(?:UNAUTHENTICATED|UNAUTHORIZED|INVALID_API_KEY)\b|鉴权失败|密钥无效/i.test(context)))return response('图片服务未通过鉴权，可核对 API 密钥。');
 if(http===403||(!http&&/\bFORBIDDEN\b/.test(code)))return response('图片服务拒绝访问，可查看服务返回的原因。');
 if(http===429||(!http&&/\b(?:RATE_LIMIT|TOO_MANY_REQUESTS)\b|限流|请求过多/i.test(context)))return {title:'图片服务请求过多',hint:'请稍后再试。'};
 if(http===408||http===504||/超时|timed?\s*out|timeout|ETIMEDOUT|AbortError/i.test(context))return {title:'图片请求超时',hint:'请先确认是否已出图，再决定是否重试。'};
 if(http>=500)return {title:'图片服务暂时异常（HTTP '+http+'）',hint:'请稍后再试。'};
 if(http)return response('可在运行记录查看服务返回的信息。');
 if(/\b(?:ECONN[A-Z]+|ENOTFOUND|EAI_AGAIN|ENETUNREACH)\b|网络.{0,9}(?:失败|错误|中断)|连接.{0,9}(?:失败|断开)|failed to fetch|fetch failed|network error|network request failed|Failed host lookup|SocketException|connection (?:reset|refused)/i.test(context))return {title:'图片请求连接失败',hint:'可检查网络连接，稍后再试。'};
 return {title:'本轮画面未完成',hint:message||'可在运行记录查看本次任务。'};
}
function createTracker(){let serial=0;const tasks=new Map();return {update(id,value){const previous=tasks.get(id);tasks.set(id,{...previous,...value,operationId:id,order:previous?.order||++serial,updated:++serial});if(tasks.size>40){for(const [key,row]of tasks){if(!describe(row).busy&&key!==id){tasks.delete(key);if(tasks.size<=24)break;}}}return this.snapshot();},drop(id){tasks.delete(id);return this.snapshot();},dropMessage(mid){for(const [key,row]of tasks)if(String(row.messageId)===String(mid))tasks.delete(key);return this.snapshot();},snapshot(){const rows=[...tasks.values()],busy=rows.filter(r=>describe(r).busy);return describe((busy.length?busy.sort((a,b)=>a.order-b.order):rows.sort((a,b)=>a.updated-b.updated)).at(-1)||{});},reset(){tasks.clear();}};}
module.exports={describe,fromRecord,createTracker,imageFailure};
