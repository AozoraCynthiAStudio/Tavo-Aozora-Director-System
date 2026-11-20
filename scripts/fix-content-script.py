from pathlib import Path
root=Path(r"Y:/Workspace/Tavo/测试版/Aozora-PhantomPop-alpha206-fixedframe-20261110")
old=(root/"scripts/refine-fixed-content.py").read_text(encoding="utf-8-sig")
start=old.index('anchor=')
end=old.index('block="""',start)
old=old[:start]+old[end:]
old=old.replace("assert anchor in s","b=s.index(' function schedule()');a=s.rfind('  fit();',0,b)")
old=old.replace("s=s.replace(anchor,block)","s=s[:a]+block+s[b+len(' function schedule()'):]")
(root/"scripts/refine-fixed-content.py").write_text(old,encoding="utf-8")
