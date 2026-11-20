import asyncio, re, pathlib, json
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).resolve().parents[1]
source=(root/'tests/browser.cjs').read_text()
fixture=source.split('const fixture=`',1)[1].split('`;\nnew (require',1)[0]
entry=(root/'dist/plugin/entry.js').read_text()
frag=(root/'dist/plugin/ui/panel.html').read_text()
frag=re.sub(r'<script>([\s\S]*?)</script>',lambda m:'<script>(function(tavo){\n'+m.group(1)+'\n})(window.__facade);</script>',frag)
html='<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+'<script>'+fixture+'</script><script>(function(tavo){'+entry+'})(window.__facade);</script>'+frag+'</body></html>'

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':390,'height':844})
  errors=[]
  page.on('pageerror',lambda e: errors.append(str(e)))
  await page.set_content(html,wait_until='domcontentloaded')
  await page.wait_for_function('window.__ADirectorUI && window.__ADirectorApp && window.__ADirectorApp.snapshot().styles.length > 0',timeout=20000)
  await page.evaluate('''() => {
    window.__messages.clear();
    window.__readerRanges = [];
    for(let i=0;i<462;i++)window.__messages.set(1000+i,{id:1000+i,role:i%2===1?'assistant':'user',content:'历史正文 · 第 '+(i+1)+' 楼'});
    window.__facade.chat.current = async () => ({id:1,messageCount:199});
    window.__facade.message.count = async () => 462;
    window.__facade.message.find = async (range,filter) => {
      if(filter)throw Error('should use unfiltered floor ranges');
      window.__readerRanges.push([...range]);
      return {items:Array.from(window.__messages.values()).slice(range[0],range[1]+1)};
    };
    window.__ADirectorApp.index = async () => [];
  }''')
  await page.evaluate('window.__ADirectorUI.openReader("1461")')
  await page.wait_for_function('window.__ADirectorUI.readerState()?.rows === 231',timeout=20000)
  assert await page.locator('#ar-floor').inner_text()=='第 462 楼'
  print('beforeDirectory',await page.evaluate('''() => ({hidden:document.getElementById('ad-reader').hidden,display:getComputedStyle(document.getElementById('ad-reader')).display,rows:window.__ADirectorUI.readerState(),floor:document.getElementById('ar-floor').textContent})'''))
  await page.evaluate('document.querySelector("#ar-directory").click()')
  await page.wait_for_function('document.querySelector("#ar-directory-page").textContent === "1 / 24"',timeout=10000)
  assert '第 462 楼' in await page.locator('#ar-directory-list').inner_text()
  await page.evaluate('document.querySelector("#ar-order").click()')
  for _ in range(9):await page.evaluate('document.querySelector("#ar-directory-next").click()')
  text=await page.locator('#ar-directory-list').inner_text()
  assert '第 200 楼' in text,text
  await page.evaluate('document.querySelector("#ar-directory-next").click()')
  text=await page.locator('#ar-directory-list').inner_text()
  assert '第 202 楼' in text and '第 220 楼' in text,text
  ranges=await page.evaluate('window.__readerRanges')
  assert any(r[0]==200 for r in ranges) and any(r[0]==400 for r in ranges),ranges
  assert not errors,errors
  print(json.dumps({'result':'PASS','rows':231,'pages':24,'floor199_boundary':'visible','rangeReads':ranges,'jsErrors':errors},ensure_ascii=False))
  await page.screenshot(path=str(root/'dist/alpha182-history-page11.png'))
  await browser.close()

asyncio.run(main())
