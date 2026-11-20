from pathlib import Path
import re,shutil
p=Path(r"Y:/Workspace/Tavo/测试版/Aozora-PhantomPop-alpha206-fixedframe-20261110")
a=Path(r"Y:/Workspace/Tavo/UI预览/全屏工作台-HTML/assets")
for name in set(re.findall(r"__WORKBENCH_([a-zA-Z0-9.-]+)__",(p/"src/ui/workbench.css").read_text(encoding="utf-8-sig"))):
 if not (p/"src/assets/workbench"/name).exists():shutil.copy2(a/name,p/"src/assets/workbench"/name)
print("All visual dependencies present")
