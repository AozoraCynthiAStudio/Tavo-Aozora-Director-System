"""Compare the built files, packaged entries and installed files; snapshot sources."""
from pathlib import Path
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist'
install=json.loads((OUT/'tavo-install.json').read_text(encoding='utf-8'))
installed=Path(install['installPath'])
runtime=json.loads((OUT/'tavo-contributions.json').read_text(encoding='utf-8'))
fragment=next((v for v in runtime.get('htmlFragmentRuntimeEntries',[]) if v.get('pluginId')=='com.aozora.director' and v.get('id')=='director-stage'),None)
enabled=install.get('enabled',True)
if enabled:assert fragment and 'id="ad-launcher"' in fragment.get('html',''),'Enabled plugin did not produce the runtime fragment'
else:assert fragment is None,'Disabled plugin unexpectedly exposes its runtime fragment'
version=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
package=OUT/('Aozora_Director_'+version+'.tpg')
sha=lambda data:hashlib.sha256(data).hexdigest()
checked=[]
with zipfile.ZipFile(package) as archive:
    for file in (OUT/'plugin').rglob('*'):
        if not file.is_file():continue
        relative=file.relative_to(OUT/'plugin').as_posix();data=file.read_bytes()
        assert archive.read(relative)==data,('package mismatch',relative)
        assert (installed/relative).read_bytes()==data,('installed mismatch',relative)
        checked.append(relative)
    assert set(archive.namelist())==set(checked)
source=OUT/('Aozora_Director_'+version+'_source.zip')
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED) as archive:
    for name in ['src','assets','scripts','tests','docs','package.json','README.md','THIRD_PARTY_NOTICES.txt','.gitignore']:
        base=ROOT/name
        for file in ([base] if base.is_file() else base.rglob('*')):
            if file.is_file() and '__pycache__' not in file.parts:archive.write(file,file.relative_to(ROOT).as_posix())
probe=json.loads((OUT/'transport-probe-report.json').read_text(encoding='utf-8')) if (OUT/'transport-probe-report.json').exists() else {}
report={'ok':True,'compared':'build = package = installed files','pluginEnabled':enabled,'hostRuntimeFragmentPresent':bool(fragment),'hostRuntimeFragmentCharacters':len(fragment['html']) if fragment else 0,'fileCount':len(checked),'pluginId':install['pluginId'],'version':install['version'],'packageSha256':sha(package.read_bytes()),'sourceSha256':sha(source.read_bytes()),'files':checked,'mainDialogueAccepted':False,'directImageProbeCompleted':probe.get('status')=='returned','nativeMultiCharacterIsolationAccepted':False}
(OUT/'delivery-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=False))
