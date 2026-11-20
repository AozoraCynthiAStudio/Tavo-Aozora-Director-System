from pathlib import Path
p=Path(r"Y:/Workspace/Tavo/测试版/Aozora-PhantomPop-alpha206-fixedframe-20261110")
original=(p/"scripts/export-studio-preview.cjs").read_text(encoding="utf-8-sig")
a=original.index("const match=");b=original.index(";if(!match)",a)
line=original[a:b]+";"
line=line.replace("test.match(","source.match(")
f=p/"scripts/export-packaged-preview.cjs"
s=f.read_text(encoding="utf-8-sig")
lines=s.splitlines()
lines=[line if v.startswith("const match=") else v for v in lines]
s=chr(10).join(lines)
a=s.index("code.replace(");b=s.index("+'</script></body></html>'",a)
s=s[:a]+"code.split('</'+'script').join('<'+String.fromCharCode(92)+'/script')"+s[b:]
f.write_text(s,encoding="utf-8")
