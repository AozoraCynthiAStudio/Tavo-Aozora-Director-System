'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Core=require('../src/core.cjs'),rules=require('../src/assets/director-rules.json');
const html=fs.readFileSync(path.join(__dirname,'../src/ui/menu.html'),'utf8');
function prompt(shot,request=''){
 return Core.buildInstruction({id:'shot199',kind:'story_cg',request,config:{format:'nai45',shot,maxActors:2,ratio:'api'},storyInput:'继续剧情',style:{positive:'game cg'}},rules,[]);
}
test('alpha225: near framing remains a strong priority but cannot redesign the action',()=>{
 const text=prompt('near');
 assert.match(text,/本轮镜头范围：近景优先/);
 assert.match(text,/只扩大到读懂主要动作所需的最小范围/);
 assert.match(text,/开阔地点只说明所在空间/);
 assert.match(text,/不要用含糊的 medium distance 代替人物裁切/);
 assert.doesNotMatch(text,/必须近景构图/);
 assert.match(text,/场景：medium close-up, waist-up framing, 1girl/);
});
test('alpha225: full framing is a selectable composition preference',()=>{
 const text=prompt('full');
 assert.match(text,/本轮镜头范围：全身/);
 assert.match(text,/场景：full-body shot, head-to-toe framing, 1girl/);
});
test('alpha225: explicit natural-language camera request overrides the selected shot mode',()=>{
 const text=prompt('near','两个人全部入镜，能看到鞋子和脚下地面');
 assert.match(text,/两个人全部入镜，能看到鞋子和脚下地面/);
 assert.match(text,/玩家明确指定的机位、景别、只拍的身体部位、不露脸要求和入镜人物优先/);
});
test('alpha199: homepage contains the original functional seed editor, not a second unsynced copy',()=>{
 const home=html.indexOf('<div id="studio-home"'),frame=html.indexOf('<div id="studio-frame-panel"');
 const seed=html.indexOf('id="studio-seed"');
 assert(home>=0&&seed>home&&seed<frame);
 for(const id of ['studio-seed','ad-director-seed','ad-director-seed-fixed','ad-director-seed-save','local-seed-hint'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.match(html,/id="studio-home-quick-size"/);
 for(const pair of ['1216,832','832,1216','1024,1024'])assert.equal((html.match(new RegExp('data-studio-size="'+pair+'"','g'))||[]).length,2);
 assert.match(html,/近景优先/);
 assert.match(html,/全身优先/);
});

