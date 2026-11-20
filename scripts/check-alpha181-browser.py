import asyncio, re, pathlib, json, os
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).resolve().parents[1]
browser_js=(root/'tests/browser.cjs').read_text()
fixture=browser_js.split('const fixture=`',1)[1].split('`;\nnew (require',1)[0]
entry=(root/'dist/plugin/entry.js').read_text()
frag=(root/'dist/plugin/ui/panel.html').read_text()
frag=re.sub(r'<script>([\s\S]*?)</script>',lambda m:'<script>(function(tavo){\n'+m.group(1)+'\n})(window.__facade);</script>',frag)
head='''<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'''
html=head+'<script>'+fixture+'</script><script>(function(tavo){'+entry+'})(window.__facade);</script><script>window.__events["sidebar:open-settings"]();</script>'+frag+'</body></html>'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [320,390,1440]:
   page=await browser.new_page(viewport={'width':width,'height':844})
   errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   await page.set_content(html,wait_until='domcontentloaded')
   await page.wait_for_function('window.__ADirectorUI && window.__ADirectorApp && window.__ADirectorApp.snapshot().styles.length > 0',timeout=20000)
   assert await page.locator('#ad-settings').evaluate('(e)=>e.open')
   # Go to resource->styles, scroll: toolbar must be on top of cards and fit on one row
   await page.evaluate('window.__ADirectorUI.settingsDialog("styles")')
   await page.wait_for_timeout(150)
   state=await page.evaluate('''() => {
    const tools=document.querySelector('#ad-style-library-toolbar');const cards=document.querySelector('#ad-style-cards');
    const rects=[...tools.querySelectorAll('button')].map(n=>{const r=n.getBoundingClientRect();return {label:n.textContent.trim(),top:r.top,width:r.width,scroll:n.scrollWidth,client:n.clientWidth}});
    return {page:document.querySelector('#ad-settings').dataset.currentPage, count:rects.length,above:tools.getBoundingClientRect().top<cards.getBoundingClientRect().top,buttons:rects,bodyOverflow:document.documentElement.scrollWidth>innerWidth}
   }''')
   print('Layout',width,json.dumps(state,ensure_ascii=False))
   assert state['count']==5 and state['above'] and not state['bodyOverflow']
   assert all(abs(x['top']-state['buttons'][0]['top'])<=2 for x in state['buttons'])
   assert all(x['width']>30 for x in state['buttons'])
   # Scroll the resource list; five management actions remain pinned at the upper edge.
   sticky=await page.evaluate('''() => {const parent=document.getElementById('ad-workspace-content'),toolbar=document.getElementById('ad-style-library-toolbar');parent.scrollTop=180;return {parentTop:parent.getBoundingClientRect().top,toolbarTop:toolbar.getBoundingClientRect().top,scroll:parent.scrollTop}}''')
   assert sticky['toolbarTop']>=sticky['parentTop']-3,sticky
   # close X and reopen default from launcher/entry, should remain styles
   await page.click('#ad-settings-close')
   assert not await page.locator('#ad-settings').evaluate('(e)=>e.open')
   await page.evaluate('window.__ADirectorUI.settingsDialog()')
   assert await page.locator('#ad-settings').evaluate('(e)=>e.dataset.currentPage')=='styles'
   assert await page.locator('#studio-resources [data-studio-resource="styles"]').get_attribute('aria-selected')=='true'
   # Resource tab change (not default profiles) remains across close
   await page.locator('#studio-resources [data-studio-resource="seeds"]').click()
   await page.click('#ad-settings-close');await page.evaluate('window.__ADirectorUI.settingsDialog()')
   assert await page.locator('#ad-settings').evaluate('(e)=>e.dataset.currentPage')=='seeds'
   # page switching to profiles & style editor remains the last subpage, without losing unsaved entry
   await page.locator('#studio-resources [data-studio-resource="styles"]').click()
   await page.locator('.ad-style-edit').first.click()
   await page.locator('#ad-style-positive').fill('my unsaved test')
   await page.click('#ad-settings-close');await page.evaluate('window.__ADirectorUI.settingsDialog()')
   assert await page.locator('#ad-style-editor').is_visible()
   assert await page.locator('#ad-style-positive').input_value()=='my unsaved test'
   await page.locator('#studio-global-back').click()
   # copy/export uses selected, not last edited
   await page.locator('.ad-style-preset-card[data-style-id="mignon_allenes"]').click()
   await page.wait_for_function('window.__ADirectorApp.snapshot().config.styleId==="mignon_allenes"')
   await page.locator('#ad-style-export').click()
   await page.wait_for_function('window.__lastExport')
   val=await page.evaluate('window.__lastExport')
   print('Export',width, val['name'])
   # test styles default also updated (not only package JSON)
   default=await page.evaluate('window.__ADirectorApp.snapshot().styles.find(x=>x.id==="mignon_allenes")')
   assert default['positive'].startswith('0.45::artist:mignon::') and 'strong rim lighting' in default['negative']
   await page.screenshot(path=str(root/f'dist/style-ui-alpha181-{width}.png'))
   if errors: print('PAGE_ERRORS',errors[:3]); raise AssertionError(errors[:3])
   await page.close()
  await browser.close()
asyncio.run(main())
