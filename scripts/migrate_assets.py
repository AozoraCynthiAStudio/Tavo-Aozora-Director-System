"""One-time, reviewable extraction of existing UI assets and literal rules. No old runtimes."""
from pathlib import Path
import re, json, hashlib, shutil

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT.parent / '发布/v1.0.0/Aozora_Chat_CG_System_v1.0.0_源码/plugin'
DEST = ROOT / 'src/ui'
DEST.mkdir(parents=True, exist_ok=True)
panel = (BASE / 'ui/panel.html').read_text(encoding='utf-8-sig')

def isolate(text):
    return text.replace('com.aozora.duya-shengtu-conversation', 'com.aozora.director').replace('aozora', 'adirector').replace('Aozora', 'ADirector').replace('duya', 'adlegacy').replace('azdock', 'addock')

start = panel.index('<div id="aozora-cg-dock"')
end = panel.index('<script id="aozora-cg-dock-controller">', start)
markup = isolate(panel[start:end]).replace('ADirector 对话CG系统', '青空导演系统').replace('登记人物', '登记角色')
(DEST / 'stage.html').write_text(markup, encoding='utf-8')
styles = [isolate((BASE / 'ui/cg-dock.css').read_text(encoding='utf-8-sig'))]
styles += [isolate((BASE / 'ui'/name).read_text(encoding='utf-8-sig')) for name in ['mobile-pages.css','viewer-pages.css']]
# Retain existing responsive cascade for the validated stage geometry. No scripts imported.
styles += [isolate(m.group(1)) for m in re.finditer(r'<style\b[^>]*>(.*?)</style>', panel, re.S | re.I)]
(DEST / 'stage.css').write_text('\n'.join(styles), encoding='utf-8')
# Original style strings stay unchanged; sampler/steps/CFG are deliberately not imported. Director rules live in src/assets/director-rules.json.
match = re.search(r'var\s+BUILTIN\s*=\s*(\{.*?\});', panel, re.S)
raw_styles = match.group(1) if match else None
assets = ROOT / 'src/assets'
assets.mkdir(exist_ok=True)
if raw_styles:
    (assets / 'legacy-style-literal.txt').write_text(raw_styles, encoding='utf-8')
    source_styles = json.loads(raw_styles)
    styles = [dict(id=k, name=v['name'], positive=', '.join(filter(None, [v.get('prefix'),v.get('suffix')])), negative=v.get('neg',''), useNegative=False, basis='NAI 4.5') for k,v in source_styles.items()]
    (assets / 'styles.json').write_text(json.dumps(styles,ensure_ascii=False,indent=2),encoding='utf-8')
mem_start = panel.index("(function(){\n'use strict';\nvar owner=window;")
mem_end = panel.index('</script>',mem_start)
(DEST/'image-memory.js').write_text(isolate(panel[mem_start:mem_end]),encoding='utf-8')
shutil.copyfile(BASE / 'THIRD_PARTY_NOTICES.txt', ROOT / 'THIRD_PARTY_NOTICES.txt')
provenance = {'source': str(BASE), 'sourcePanelSha256': hashlib.sha256((BASE / 'ui/panel.html').read_bytes()).hexdigest(), 'sourceEntrySha256': hashlib.sha256((BASE / 'entry.js').read_bytes()).hexdigest(), 'stage': 'Same DOM and responsive CSS, IDs isolated; no old execution scripts', 'rules': 'src/assets/director-rules.json', 'upstream': '渡鸦 / Raven image core; Aozora CG evolution. See project attribution.'}
(assets / 'provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'stageBytes': len(markup.encode()), 'cssBytes': (DEST/'stage.css').stat().st_size, 'styleLiteral': bool(raw_styles)}, ensure_ascii=False))
