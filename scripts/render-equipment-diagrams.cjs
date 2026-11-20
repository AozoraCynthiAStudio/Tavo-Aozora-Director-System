'use strict';
const fs=require('fs'),path=require('path'),out=path.resolve(__dirname,'../docs/equipment-v2');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function canvas(height,title,subtitle){let body='';const add=s=>body+=s;const text=(x,y,s,size=20,color='#262626',weight=400)=>add(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`);
 function box(x,y,w,h,title,lines=[],accent=false){add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${accent?'#fff3f5':'#fafafa'}" stroke="${accent?'#8b2337':'#c9c9c9'}" stroke-width="${accent?2:1.5}"/>`);text(x+18,y+31,title,21,accent?'#8b2337':'#262626',700);lines.forEach((s,i)=>text(x+18,y+59+i*26,s,17,'#555'));}
 function arrow(points,label='',x=0,y=0){add(`<polyline points="${points}" fill="none" stroke="#777" stroke-width="2" marker-end="url(#arrow)"/>`);if(label)text(x,y,label,16,'#666');}
 text(32,43,title,30,'#262626',800);text(32,76,subtitle,17,'#666');
 return {add,text,box,arrow,save(name){fs.writeFileSync(path.join(out,name+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8" fill="#777"/></marker></defs><rect width="1200" height="${height}" fill="white"/><g font-family="Microsoft YaHei,Noto Sans CJK SC,Arial,sans-serif">${body}</g></svg>`);}};}
{
 const c=canvas(1150,'装备系统 V2 · 完整结构图','八个部位保存最终结果；已知内搭继续记录，图片只表达实际可见部分');
 c.box(330,110,540,78,'人物装备快照',['正式姓名与形态，含唯一别名映射'],true);c.arrow('600,188 600,218');
 c.add('<rect x="26" y="220" width="1148" height="310" rx="12" fill="#fff" stroke="#dedede"/>');c.text(48,253,'八个装备部位：未知为 null，明确没有为 []，已知物品为数组',21,'#262626',700);
 const cells=[['HEAD · 头部','帽子、发卡、发箍'],['TOP · 上身','上衣、已知内搭'],['LOWER · 下身','裤子、裙子、已知内搭'],['FULL · 跨部位','大衣、连衣裙、连体衣'],['LEGWEAR · 腿部','丝袜、袜类、腿套'],['FOOTWEAR · 脚部','鞋子、靴子、拖鞋'],['HAND · 手部','手套等'],['ACCESSORIES · 饰品','眼镜、首饰、腰带等']];
 cells.forEach(([title,line],i)=>c.box(44+(i%4)*284,277+Math.floor(i/4)*118,262,98,title,[line],i===3));
 c.arrow('600,530 600,566');c.box(120,570,960,108,'每件物品的结构',['name 完整款式  ·  state 开合／披挂状态  ·  visible 是否可见','covers 跨部位衣物覆盖哪些区域；头发仍属于人物外貌'],true);
 c.arrow('600,678 600,710');c.box(44,716,534,130,'存储示例：扣合的大衣与已知内搭',['FULL：黑大衣，closed，可见','TOP：白衬衫，已知但不可见','LOWER：蓝长裤，已知但不可见']);c.box(622,716,534,130,'画面示例：脱掉大衣之后',['FULL：空列表','TOP／LOWER：原内搭继续存在并可见','其他部位没有变化就沿用']);c.arrow('578,781 620,781');
 c.text(44,897,'持久化与回溯',24,'#262626',700);c.box(44,923,322,108,'新对话初始化',['空装备状态','只建立当前装备日志']);c.box(439,923,322,108,'权威装备日志',['equipmentV2：events','按消息记录变更部位']);c.box(834,923,322,108,'重放当前状态',['删改／重生时移除或替换事件','保留后续独立部位更新']);c.arrow('367,977 437,977');c.arrow('762,977 832,977');
 c.text(44,1080,'普通文本回复同步穿着；静态设计与微调只改变候选图。',20,'#8b2337',700);c.text(44,1114,'ui.59  ·  原图、随机 Seed、镜头偏好沿用原策略。',17,'#777');c.save('structure');
}
{
 const c=canvas(1450,'装备系统 V2 · 完整逻辑图','同一次文本回复理解剧情；结构与来源校验后，消息保存才提交装备日志');
 c.box(40,110,330,80,'普通聊天',['同步正常剧情穿着']);c.box(435,110,330,80,'剧情导演',['同步穿着并准备画面']);c.box(830,110,330,80,'单独设计／微调',['准备局部候选，不推进穿着']);
 c.arrow('205,190 205,212 600,212 600,232');c.arrow('600,190 600,232');c.arrow('995,190 995,212 600,212');
 c.box(300,236,600,90,'原本那一次文本 AI 回复',['正文＋装备部位完整结果；导演另带画面快照'],true);c.arrow('600,326 600,360');
 c.box(300,365,600,100,'统一校验装备更新与可选画面快照',['核对身份、部位、完整引用及画面装备一致性','对真实剧情含义的判断仍依赖文本 AI'],true);
 c.arrow('300,418 190,418 190,493','无效',204,405);c.box(40,496,300,100,'校验失败',['隐藏机器数据并提示','不接受非法装备变化']);
 c.arrow('600,465 600,493','正常剧情',618,487);c.box(420,496,360,100,'待保存的完整部位更新',['不改变其他部位；矛盾图片另行拦截']);
 c.arrow('900,418 1010,418 1010,493','静态候选',919,404);c.box(860,496,300,100,'临时装备结果',['只用于当前设计或微调']);
 c.arrow('600,596 600,634');c.box(420,638,360,100,'消息保存确认后提交日志',['回读权威日志确认','失败时不提交依赖它的新图'],true);
 c.arrow('600,738 600,777');c.box(420,780,360,100,'重放得到当前装备',['普通回复到此完成同步']);
 c.box(40,680,292,180,'删除／编辑／重新生成',['检查关联用户与正文','移除或替换该轮事件','按原顺序重放','保留后续独立变化']);c.arrow('332,830 418,830');
 c.box(870,780,290,100,'历史图片新增／重抽',['使用所选图片原快照','不回写当前剧情装备']);
 c.arrow('600,880 600,925','存在生图任务',615,911);c.arrow('1010,596 1180,596 1180,908 840,908 840,925');
 c.box(300,930,600,100,'存在已通过校验的图片任务？',['画外人物更新不增加图片人数；外貌与镜头仍独立'],true);
 c.arrow('440,1030 260,1065 260,1090','无／图片已拦截',196,1067);c.box(40,1094,440,112,'本轮不提交新图',['普通回复：正常完成同步','图片不符：保留合法装备变化']);
 c.arrow('760,1030 870,1065 870,1090','有',809,1067);c.box(650,1094,450,112,'编译实际可见装备',['保留隐藏内搭记录','明确表达已脱去衣物／赤脚等可见状态']);
 c.arrow('1015,880 1138,880 1138,1150 1102,1150');
 c.arrow('875,1206 875,1248');c.box(650,1252,450,90,'提交图片 API',['沿用原随机 Seed／动态原图 Seed 策略'],true);
 c.text(40,1296,'恢复原始视觉块：',21,'#262626',700);c.text(40,1326,'走同一套校验、消息确认与日志提交。',18,'#555');
 c.text(40,1394,'只使用八部位装备；辅助模型调用隔离，不触发普通剧情同步或消耗待执行导演任务。',18,'#8b2337',700);c.save('logic');
}
