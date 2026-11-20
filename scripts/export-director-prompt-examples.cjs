'use strict';
const fs=require('node:fs'),path=require('node:path');
const Core=require('../src/core.cjs'),rules=require('../src/assets/director-rules.json');
const dir=path.resolve(__dirname,'../docs/examples');fs.mkdirSync(dir,{recursive:true});
const examples=[
 ['nai45-story.txt',{id:'example-nai',kind:'story_cg',request:'只画两个人并排坐在教室里，桌下牵手，接触被桌子遮挡',storyInput:'放学后，两人在教室并排坐着，悄悄牵手。',style:{positive:'game cg, clean lineart'},config:{format:'nai45',shot:'near',ratio:'16:9'}}],
 ['generic-story.txt',{id:'example-generic',kind:'story_cg',request:'只画一个女孩坐在窗边阅读',storyInput:'窗边的女孩安静地翻开书本。',style:{positive:'cinematic still'},config:{format:'generic',shot:'near',ratio:'api'}}],
 ['character-design.txt',{id:'example-character',kind:'character_intro',targetName:'示例角色',targetForm:'默认形态',request:'初次设计一位外貌有辨识度的成年女性角色',storyInput:'',style:{positive:'game cg'},config:{format:'nai45',shot:'full',ratio:'2:3'}}]
];
for(const [name,req] of examples){const result=Core.buildInstruction(req,rules,[]);fs.writeFileSync(path.join(dir,name),result+'\n');console.log(name,result.length);}
