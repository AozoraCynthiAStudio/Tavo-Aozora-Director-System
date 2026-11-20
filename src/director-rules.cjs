'use strict';
// One concern per rule. The compiler selects only the rules relevant to this turn.
const clean=value=>String(value??'').trim();
const CLEAR_SUBJECT_KEY='clearSubjectDefinition';
const ADULT_GATE_KEY='adultGate';
const ADULT_DETAIL_KEYS=['adultFraming','adultSurface','adultInsertion','adultVolume','adultPresence','adultPlayer'];
const ADULT_KEYS=[ADULT_GATE_KEY,...ADULT_DETAIL_KEYS];
const REQUIRED=['requestBoundary','sceneComposition',CLEAR_SUBJECT_KEY,'scaleDifference','castComposition','narrativeBridge','sceneSingle','identityContinuity','wardrobeState','characterDesign','nai45Format','genericFormat','qualityPolicy',...ADULT_KEYS];
function validateCatalog(catalog={}){
 const missing=REQUIRED.filter(key=>!clean(catalog[key]));
 const legacy=Object.entries(catalog).filter(([,value])=>/<cg-prompt\b|<cg-design\b/i.test(clean(value))).map(([key])=>key);
 if(missing.length||legacy.length)throw Error('单Scene规则目录无效：'+(missing.length?'缺少 '+missing.join(', '):'')+(legacy.length?'；含旧Action规则 '+legacy.join(', '):''));
 return true;
}
const fixedAction='先锁定玩家已明确的动作、瞬间和画面要求。谁在做什么、相对位置、身体朝向、接触点和动作阶段，已指定的都要保留。机位、景别和可见反应只在玩家留白的范围内安排。';
function selectionPriority(savedReply=false){
 const events=savedReply
  ?'只从已保存正文确认发生的事件中选景。'
  :'只从本轮会实际写进正文的事件中选景。';
 return events+'单有愿望、假设、提议或面向以后可能发生的计划不触发。成人情节已经结束并进入后续生活场景时，按本轮当前事件选景。符合成人画面适用范围，且玩家未锁定具体瞬间时，优先选择最有表现力的一帧：比较关键互动是否清楚、姿态是否有张力、反应是否可见。已确立的体量在构图自然可见时可纳入比较，保持动作和裁切成立。表现力始终服从剧情事实和玩家明确要求。';
}
function nextTurnCatalog(catalog={},request={}){
 const pictureRequest=clean(request.request);
 return {...catalog,
  requestBoundary:'【下一轮选景】结合上文、已知人物状态和玩家本轮剧情，理解本轮要推进的事件。'+fixedAction+(pictureRequest?'优先落实玩家明确的画面要求，结合剧情决定其余细节。':'选最值得呈现的一个关键动作、转折或人物互动。')+selectionPriority()+'确定一帧后，把该机位、可见反应和已确定的动作写进同一份 Scene。',
  narrativeBridge:'【定格与正文】在正文前输出唯一画面块，一次写定英文场景、入镜人物及定格当下的状态和穿着。正文让同一幕自然发生，随后可以继续推进。正文结尾的持久状态变化单独记录。'
 };
}
function savedReplyCatalog(catalog={}){
 return {...catalog,
  requestBoundary:'【事后补图模式·画面选择】只为对应的已保存回复选择一张图、同一时空中的一个定格。理解玩家画面要求后分三种情况：没有具体画面要求时，梳理正文已发生的事件→判断情节性质与选景重点→选定关键瞬间；指定的具体事件或时刻在正文出现过时，先定位该瞬间，固定当时的人物、动作、位置、状态与穿着；只有玩家指定了具体画面内容且正文没有出现过时，才跳过正文选景，按要求设计一张独立画面。独立画面以本次要求和已确认人物资料为依据，不改写原正文，不将该画面记作已经发生的剧情，不更新长期人物、身体或衣着状态。只指定人物、机位、景别或裁切等部分维度，不等于指定了正文外的事件；固定这些维度后，其余部分仍从正文实际事件中选择。成人选景优先级仅用于正文选景，不能给独立画面另造剧情。'+fixedAction+selectionPriority(true),
  narrativeBridge:'【已保存正文的画面对应】正文选景必须对应一个实际瞬间，依事件先后还原当时的人物、动作、位置、时间、表情和穿着，不拼接前后阶段。独立画面仅按玩家本次要求与已确认人物资料安排；未指定且不冲突的身份与状态保持延续，不把愿望、计划或旧画面改写成正文事实。两种画面都先锁定内容，再使用同一套机位、景别、裁切、可见反应和适用的成人画面规则。后续视觉表现规则中的“所选剧情瞬间”，在独立画面模式下指本次明确指定的同一帧，不能据此替换玩家画面或将其变成正文事件。表现规则不能反过来改写事件或玩家要求。只输出视觉块，不得续写、改写、复述、总结或输出任何剧情正文；不输出判定或分析过程。方案结果摘要仅写在视觉块的导演记录字段；独立画面的本轮事件摘要须注明“独立画面，非正文事件”。',
  qualityPolicy:clean(catalog.qualityPolicy).replace('来自所选剧情瞬间','符合所选正文瞬间；独立画面则符合本次画面要求及已确认的人物资料')
 };
}
function compileRuleLayers(request,catalog={}){
 validateCatalog(catalog);
 const isCharacter=request.kind==='character_intro',isNai=request.config?.format!=='generic';
 const adultKeys=isCharacter?[]:ADULT_KEYS;
 const keys=['requestBoundary','sceneComposition',CLEAR_SUBJECT_KEY,'scaleDifference',...(isNai?['castComposition']:[]),...(request.storyInput?['narrativeBridge']:[]),'sceneSingle','identityContinuity','wardrobeState',...(isCharacter?['characterDesign']:[]),isNai?'nai45Format':'genericFormat','qualityPolicy',...adultKeys];
 return keys.map((key,i)=>({name:String(i+1).padStart(2,'0')+'-'+key,text:catalog[key],stage:key===ADULT_GATE_KEY?'gate':ADULT_DETAIL_KEYS.includes(key)?'conditional-detail':'core'}));
}
function buildAdultContext(catalog={},options={}){
 const kind=options.kind||'story_cg';
 // Initial character design remains outside the adult system. A selected
 // source image may be tuned/animated with the same one-pass Gate flow.
 if(kind==='character_intro'&&options.sourceImage!==true)return '';
 validateCatalog(catalog);
 const parts=[
  '【成人画面共用定义】',
  clean(catalog[CLEAR_SUBJECT_KEY]),
  clean(catalog[ADULT_GATE_KEY]),
  ...ADULT_DETAIL_KEYS.map(key=>clean(catalog[key]))
 ];
 return parts.join('\n\n');
}
module.exports={CLEAR_SUBJECT_KEY,ADULT_GATE_KEY,ADULT_DETAIL_KEYS,ADULT_KEYS,REQUIRED,validateCatalog,nextTurnCatalog,savedReplyCatalog,compileRuleLayers,buildAdultContext};
