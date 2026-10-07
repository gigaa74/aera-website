/* Select a fully translated application before it renders. */
(() => {
  'use strict';
  const query=new URLSearchParams(location.search);
  let saved='ru';
  try { saved=localStorage.getItem('aera-language')||'ru'; } catch {}
  const language=(query.get('lang')||saved)==='en'?'en':'ru';
  document.documentElement.lang=language;
  try { localStorage.setItem('aera-language',language); } catch {}
  document.querySelectorAll('[data-language]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.language===language));
    button.onclick=()=>{
      try { localStorage.setItem('aera-language',button.dataset.language); } catch {}
      const url=new URL(location.href);
      url.searchParams.set('lang',button.dataset.language);
      location.assign(url.href);
    };
  });
  if(language==='en'){
    const pairs=window.AERA_SHELL_EN||[];
    const translate=value=>{for(const [ru,en] of pairs)value=value.split(ru).join(en);return value;};
    const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walk.nextNode()){
      const node=walk.currentNode;
      if(!['SCRIPT','STYLE','NOSCRIPT'].includes(node.parentElement.tagName))node.nodeValue=translate(node.nodeValue);
    }
    document.querySelectorAll('[aria-label],[title],meta[name="description"]').forEach(el=>{
      if(el.closest('.language-switch'))return;
      for(const key of ['aria-label','title','content'])if(el.hasAttribute(key))el.setAttribute(key,translate(el.getAttribute(key)));
    });
    document.title=translate(document.title);
  }
  const script=document.createElement('script');
  const previewSource=document.getElementById('preview-app-'+language);
  if(previewSource)script.textContent=JSON.parse(previewSource.textContent);
  else script.src=language==='en'?'/assets/app.en.js':'/assets/app.js';
  script.onerror=()=>{document.querySelector('.loading').textContent=language==='en'?'Unable to load AERA. Please refresh the page.':'Не удалось загрузить AERA. Обновите страницу.';};
  document.body.append(script);
})();
