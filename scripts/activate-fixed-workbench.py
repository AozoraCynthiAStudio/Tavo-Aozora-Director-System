from pathlib import Path
p=Path(r"Y:/Workspace/Tavo/测试版/Aozora-PhantomPop-alpha206-fixedframe-20261110")
f=p/"scripts/read-ui-source.cjs";s=f.read_text(encoding="utf-8")
s=s.replace("if(p==='src/ui/phantom.css')","if(['src/ui/phantom.css','src/ui/phantom-surfaces.css'].includes(p))")
s=s.replace("return s;};","""if(p==='src/ui/workbench.css'){s=s.replace(/__WORKBENCH_([a-zA-Z0-9.-]+)__/g,(_,name)=>'data:image/'+(name.endsWith('.svg')?'svg+xml':name.endsWith('.jpg')?'jpeg':'png')+';base64,'+fs.readFileSync(path.join(root,'src/assets/workbench',name)).toString('base64'));}return s;};""")
f.write_text(s,encoding="utf-8")
f=p/"scripts/build.cjs";s=f.read_text(encoding="utf-8")
a=s.index("read('src/ui/stage.css')");b=s.index("+'\\n</style>",a)
css="+ '\\n' +".join("read('src/ui/"+name+".css')" for name in ["stage","status","reader-base","phantom-surfaces","workbench"])
s=s[:a]+css+s[b:]
s=s.replace("'ui/reader.js','ui/phantom.js']","'ui/reader.js','ui/phantom.js','ui/workbench.js']")
s=s.replace("'\\n</script>'));","'\\n</script>\\n<script>\\n'+read('src/ui/workbench.js').replace(/<\\/script/gi,'<\\\\/script')+'\\n</script>'));")
s=s.replace("manifest.releaseNotes='青空导演视觉升级内测，更新工作台、设置页、历史阅读、大图模式、弹窗和悬浮入口。';","manifest.releaseNotes='固定比例放映终端：使用确认稿视觉层替换旧设置皮肤；真实控制器与存储接口保持原有入口。';")
f.write_text(s,encoding="utf-8")
f=p/"scripts/export-studio-preview.cjs";s=f.read_text(encoding="utf-8")
a=s.index("['stage','menu','status'");b=s.index(".map(name=>read('src/ui/'",a)
s=s[:a]+"['stage','status','reader-base','phantom-surfaces','workbench']"+s[b:]
needle=chr(36)+"{read('src/ui/phantom.js')}"
s=s.replace(needle,needle+chr(10)+chr(36)+"{read('src/ui/workbench.js')}")
f.write_text(s,encoding="utf-8")
f=p/"src/ui/controller.js";s=f.read_text(encoding="utf-8-sig").replace("version:'0.1.0-alpha.205'","version:'0.1.0-alpha.206'")
f.write_text(s,encoding="utf-8")
