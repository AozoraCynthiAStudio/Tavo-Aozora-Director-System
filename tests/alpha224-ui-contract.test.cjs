"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('status captions no longer inject or animate changing ellipsis text on any stage surface',()=>{
 const controller=read('src/ui/controller.js'),launcher=read('src/ui/launcher.css'),stage=read('src/ui/stage.html'),stageCss=read('src/ui/stage.css');
 assert.match(controller,/function paintLauncherCaption\(text\).*ad-caption-copy/);
 assert.doesNotMatch(controller,/dots\.textContent\s*=|className\s*=\s*['\"]ad-caption-dots/);
 assert.doesNotMatch(launcher,/ad-caption-dots|ad-caption-light|@keyframes ad-caption-dots/);
 assert.doesNotMatch(stage,/addock-ui-ellipsis/);
 assert.doesNotMatch(stageCss,/addock-ui-ellipsis/);
});
test('style scope is left aligned while the current format remains at the right edge',()=>{
 const css=read('src/ui/workbench.css');
 assert.match(css,/\.style-scope > span\{margin-left:\s*0;/);
 assert.match(css,/#ad-style-current-format\{margin:0 0 0 auto/);
});
test('opening settings does not emit an automatic-save notice and restores the current stage context',()=>{
 const controller=read('src/ui/controller.js');
 assert.doesNotMatch(controller,/if\(target==='settings'&&!resume\)status\('设置自动保存'\)/);
 assert.match(controller,/settingsStageContext=captureSettingsStageContext\(\)/);
 assert.match(controller,/restoreSettingsStage\(saved\)/);
});
test('the live card resolves the current chat reply on opening and after message removal',()=>{
 const controller=read('src/ui/controller.js');
 assert.match(controller,/function currentCardMessage\(snapshot=app\.snapshot\(\)\)\{return String\(snapshot\.latestMessageId/);
 assert.match(controller,/if\(follow\)await app\.readCurrentReply\(\)/);
 assert.match(controller,/event.type==='removed'&&!event.replaced\)\)Promise.resolve\(followCurrentReply\(\)\)/);
});
