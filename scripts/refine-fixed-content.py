from pathlib import Path
p=Path(r"Y:/Workspace/Tavo/测试版/Aozora-PhantomPop-alpha206-fixedframe-20261110/src/ui/workbench.js")
s=p.read_text(encoding="utf-8-sig")
block="""
  for(const card of root.querySelectorAll('.ad-log-entry:not([data-pp-ready])')){
   card.dataset.ppReady='true';
   const row=card.taskRecord,button=card.querySelector('button');if(!row||!button)continue;
   card.dataset.status=row.status;
   const badge=button.querySelector('.ad-log-badge');
   const copy=make('span','log-copy'),line=make('span','log-title-line');
   const name=document.createElement('strong');name.textContent=row.title;
   line.append(name,badge);
   const meta=make('span','log-meta');
   const seconds=Math.max(0,((row.finishedAt||row.updatedAt||row.startedAt)-(row.startedAt||0))/1000);
   meta.textContent=[new Date(row.startedAt||Date.now()).toLocaleTimeString('zh-CN',{hour12:false}),'耗时 '+seconds.toFixed(1)+' 秒',row.messageId?'回复 '+row.messageId:''].filter(Boolean).join(' · ');
   const summary=make('span','log-summary');summary.textContent=row.error||row.warning||(row.status==='done'?'任务已完成':row.status==='uncertain'?'结果待确认，可导出详情协助排查。':'查看运行详情');
   copy.append(line,meta,summary);
   const symbol=make('span','log-symbol');symbol.setAttribute('aria-hidden','true');symbol.innerHTML='<svg viewBox="0 0 32 36"><path d="M7 4h15l5 6v22H5V6ZM21 4v7h6M9 16h13M9 21h13M9 26h8M2 10v24h19" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
   const arrow=make('span','log-arrow');arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
   button.replaceChildren(symbol,copy,arrow);
  }
  if($('ad-log-export').textContent!=='导出全部详情')$('ad-log-export').textContent='导出全部详情';
  if($('ad-log-detail-export').textContent!=='导出详情')$('ad-log-detail-export').textContent='导出详情';
  fit();
 }
 function schedule()"""
b=s.index(' function schedule()');a=s.rfind('  fit();',0,b)
s=s[:a]+block+s[b+len(' function schedule()'):]
s=s.replace("root.dataset.ppScale=scale.toFixed(4);","root.dataset.ppScale=scale.toFixed(4);root.dataset.ppReady='true';")
p.write_text(s,encoding="utf-8")
