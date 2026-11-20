from pathlib import Path
p=Path(r"Y:/Workspace/Tavo/测试版/Aozora-PhantomPop-alpha206-fixedframe-20261110")
f=p/"src/ui/workbench.css";s=f.read_text(encoding="utf-8")
mapping={
"#character-browser":"#ad-profiles-browse","#character-list":"#ad-profile-list","#character-editor":"#ad-profile-editor",
"#style-browser":"#ad-style-browse","#style-editor":"#ad-style-editor","#style-cards":"#ad-style-cards","#style-scope":"#ad-style-scope",
"#seed-page":"[data-ad-page=seeds]","#seed-list":"#ad-seed-list","#seed-add":"#ad-seed-add","#seed-count":"#city-seed-count",
"#motion-form":"#ad-motion-settings","#motion-url":"#local-motion-url","#motion-key":"#local-motion-key","#motion-state":"#studio-motion-connection-state",
"#motion-official":"#local-motion-official","#motion-reset":"#local-motion-reset","#motion-paste":"#motion-api-paste","#motion-strength":"#local-strength",
"#strength-value":"#local-strength-value","#motion-noise":"#local-noise","#motion-schedule":"#local-schedule","#logs-page":"[data-ad-page=logs]",
"#logs-list":"#ad-log-list","#logs-count":"#ad-log-count","#logs-export":"#ad-log-export","#logs-clear":"#ad-log-clear",
"#size-page":"#studio-frame-panel","#size-form":"#studio-frame-size","#size-width":"#studio-width","#size-height":"#studio-height","#size-status":"#studio-size-status"
}
for a,b in sorted(mapping.items(),key=lambda v:-len(v[0])):s=s.replace(a,b)
s=s.replace(".page-heading h1",".page-heading #studio-page-title")
f.write_text(s,encoding="utf-8")
f=p/"src/ui/workbench.js";s=f.read_text(encoding="utf-8-sig")
s=s.replace("const artwork=card.querySelector('.ad-style-artwork')||card.querySelector('img')?.parentElement;","const artwork=card.querySelector('img')||card.querySelector('.studio-preset-pattern');")
f.write_text(s,encoding="utf-8")
