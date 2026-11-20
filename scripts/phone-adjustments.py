from pathlib import Path
import json
p=Path(r"Y:/Workspace/Tavo/测试版/Aozora-PhantomPop-alpha207-phone-20261110")
f=p/"package.json";d=json.loads(f.read_text(encoding="utf-8-sig"));d["version"]="0.1.0-alpha.207";f.write_text(json.dumps(d,indent=2,ensure_ascii=False),encoding="utf-8")
f=p/"src/ui/controller.js";s=f.read_text(encoding="utf-8-sig").replace("version:'0.1.0-alpha.206'","version:'0.1.0-alpha.207'");f.write_text(s,encoding="utf-8")
f=p/"src/ui/workbench.js";s=f.read_text(encoding="utf-8-sig")
s=s.replace("const safeW=rect.width-12,safeH=rect.height-12;","const safeW=rect.width-8,safeH=rect.height-8;")
s=s.replace("safeW/443.5,safeH/887","safeW/398,safeH/788")
f.write_text(s,encoding="utf-8")
# Retire the old dialog sizing rules instead of stacking another conflicting skin.
f=p/"src/ui/phantom-surfaces.css"
lines=f.read_text(encoding="utf-8-sig").splitlines()
lines=[line for line in lines if '.ph-dialog' not in line]
f.write_text(chr(10).join(lines),encoding="utf-8")
