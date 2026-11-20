'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../src/ui',p),'utf8');
const html=read('menu.html'),controller=read('controller.js'),css=read('workbench.css');

test('three homepage size shortcuts follow the mode and style controls',()=>{
 const paper=html.indexOf('<div class="studio-paper">'),quick=html.indexOf('id="studio-home-quick-size"'),service=html.indexOf('id="studio-service"'),frame=html.indexOf('id="studio-frame"'),style=html.indexOf('id="studio-style"');
 assert(service<style&&style<paper&&paper<quick&&quick<frame);
 assert.equal((html.match(/id="studio-home-quick-size"/g)||[]).length,1);
 assert.equal((html.match(/id="studio-frame-size"/g)||[]).length,1);
 for(const pair of ['1216,832','832,1216','1024,1024'])assert.equal((html.match(new RegExp('data-studio-size="'+pair+'"','g'))||[]).length,2);
 assert.match(controller,/querySelectorAll\('\[data-studio-size\]'\)/);
 assert.match(css,/\.pp-ui \.ratio\[aria-pressed=true\]/);
});

test('the homepage Seed description is short and accurately describes identical-request protection',()=>{
 const home=html.match(/<small id="local-seed-hint">([^<]*)<\/small>/)?.[1]||'';
 assert(home.length>10&&home.length<100);
 assert.match(home,/完全相同/);
 assert.doesNotMatch(html,/因此开启后会禁用重抽和新增/);
});

test('duplicate fixed Seed opens an existing modal from card actions and reader actions',()=>{
 assert.match(html,/<dialog id="ad-seed-locked"[\s\S]*?重复生成警告/);
 assert.match(html,/再次提交可能生成重复图片并产生额外费用/);
 assert.match(controller,/function handleUiError\(error\)\{if\(error\?\.code==='UNCHANGED_FIXED_SEED'\)\{show\('ad-seed-locked'\)/);
 assert.match(controller,/Promise\.resolve\(fn\(e\)\)\.catch\(handleUiError\)/);
 assert.match(controller,/return target\?\.recoverableImage\?app\.recover\(messageId\)/);
 assert.match(controller,/catch\(error\)\{if\(error\?\.code==='UNCHANGED_FIXED_SEED'\)\{show\('ad-seed-locked'\)/);
 assert.match(controller,/bind\(\$\('ad-seed-locked-close'\),'click',\(\)=>hide\('ad-seed-locked'\)\)/);
});

