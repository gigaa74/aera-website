'use strict';
const $ = (s, root = document) => root.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main = $('#main');
let config = {auth_enabled:false,backend_enabled:false,bot_url:'https://t.me/AERAVPN_BOT'};
let toastTimer;
function toast(message){ $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000); }
async function api(path, method='GET'){
  const response=await fetch('/api/web/'+path,{method,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  const body=await response.json();
  if(!response.ok){const e=new Error(body.detail||'Unable to load data.');e.status=response.status;throw e;}
  return body;
}
const money=(amount,currency='RUB')=>currency==='XTR'?`${Number(amount).toLocaleString('en-US')} Stars`:new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:2}).format(amount/100);
const date=value=>value?new Intl.DateTimeFormat('en-US',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'The subscription has not started yet';
const statusName=s=>({ACTIVE:'Active',WAITING:'Waiting for the first connection',EXPIRED:'Expired',UNKNOWN:'Checking status',ACTIVATING:'Activating',BLOCKED:'Access restricted',PENDING_PROVISIONING:'Preparing your connection',EXPIRING:'Expiring soon',TRIAL:'Trial access',PAID:'Paid',PENDING:'Awaiting payment',FAILED:'Incomplete',CANCELED:'Cancelled',CANCELLED:'Cancelled',REFUNDED:'Refunded'})[s]||'Checking status';
const head=(eyebrow,title,copy='')=>`<div class="page-head"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${copy?`<p>${copy}</p>`:''}</div>`;
const botButton=(label='Open Telegram bot')=>`<a class="button primary bot-link" href="${config.bot_url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const faqs=[
 ['What do I need to connect?','An active AERA subscription, the Hiddify app and your private link. Copy the link from the bot or your account, add it to Hiddify and connect.'],
 ['Which devices support Hiddify?','Hiddify is available for Android, iPhone, iPad, Windows, macOS and Linux. Select your device under “How to connect” for official download links.'],
 ['Can I share my private link?','Your link grants access to your subscription. Do not publish it or send it to others. Device limits depend on your plan. Contact support if your link has been exposed.'],
 ['I paid but have no access. What should I do?','Check your subscription and payment history first. Returning to a success page does not confirm payment. If the status has not updated, send support the payment ID, amount and time. Do not pay again until it has been checked.'],
 ['Hiddify will not connect. Where should I start?','Check your internet connection with the VPN off and make sure your subscription is active. Update your Hiddify profile, close other VPN apps and try again. If this does not help, send support your app version, operating system and error message, without your private link.']
];
const faqHtml=()=>`<div class="faq">${faqs.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`;

function home(){
 main.innerHTML=`<div class="wrap"><section class="hero"><div class="eyebrow">AERA VPN / YOUR PERSONAL CONNECTION</div><div class="hero-graphic" aria-hidden="true"></div><h1>Stay connected.<br><em>On your terms.</em></h1><p class="hero-copy">One subscription for your devices. Connect with Hiddify, manage your access and get help on our website.</p><div class="actions"><a class="button primary" href="/plans">Choose a plan</a><a class="button" href="/setup">How to connect</a></div><div class="hero-bottom"><span>5 platforms</span><span>From one device</span><span>Support on our website</span></div></section><div class="quick-grid"><a href="/plans" class="quick-card"><span class="card-number">01 / CHOOSE</span><h3>For you. Or everyone.</h3><p>From your own phone to every device on your team.</p></a><a href="/setup" class="quick-card"><span class="card-number">02 / CONNECT</span><h3>Your device is ready.</h3><p>Install Hiddify and add your private AERA link.</p></a><a href="/account" class="quick-card"><span class="card-number">03 / MANAGE</span><h3>Your access at a glance.</h3><p>Your subscription, expiry date and payment history in one place.</p></a></div><section class="section"><div class="section-heading"><h2>Less setup.<br>More time for yourself.</h2><p>Start with the device you use every day. Our guides take you from installation to connection.</p></div><div class="mini-features"><div><h3>One familiar app</h3><p>Hiddify for your phone and computer. Download the app from official sources.</p></div><div><h3>Simple subscriptions</h3><p>Plans for 1 or 6 months. See the device limit before choosing.</p></div><div><h3>Help is close</h3><p>Contact support on our website whenever you need help with access.</p></div></div></section><section class="section"><div class="section-heading"><h2>Have a question?</h2><a class="text-link" href="/support">Contact support</a></div>${faqHtml()}</section></div>`;
}

const snapshotPlans=[['solo','SOLO',1,100,500],['plus','PLUS',3,200,1000],['infinity','INFINITY',10,500,3000],['business','BUSINESS',null,5000,25000]].flatMap(([family,name,devices,p1,p6])=>[1,6].map(m=>({slug:`${family}-${m}m`,name:`AERA ${name}`,duration_months:m,duration_days:m*30,device_limit:devices,unlimited_devices:devices===null,price_minor:(m===1?p1:p6)*100,currency:'RUB',traffic_limit_bytes:0})));
async function plans(){
 main.innerHTML=`<div class="wrap page-space">${head('PLANS','Find your fit.','For one device, your family or your team. Choose a duration and compare plans.')}<div class="segmented" aria-label="Subscription duration"><button data-months="1" aria-pressed="true">1 month</button><button data-months="6" aria-pressed="false">6 months</button></div><div id="plan-grid" class="plans-grid" aria-live="polite"></div><p id="plan-source" class="fine">Loading plans…</p><section class="panel account-payment"><h3>Payment methods</h3><div class="account-payment-methods"><span class="button">SBP</span><span class="button">Card</span><span class="button">Cryptocurrency</span><span class="button">Telegram Stars</span></div><p class="fine">SBP payments through FreeKassa / FKWallet are available and require signing in to FKWallet. Telegram Stars are available in the bot. Direct SBP payments through Platega and cryptocurrency payments are being connected.</p></section></div>`;
 let catalog=snapshotPlans.filter(p=>p.price_minor<=1000000),months=1;
 function paint(){ $('#plan-grid').innerHTML=catalog.filter(p=>(p.duration_months||Math.round(p.duration_days/30))===months).map(p=>`<article class="plan"><span class="tag">${p.unlimited_devices?'For teams':p.device_limit===1?'Personal':p.device_limit<=3?'Everyday':'For family'}</span><h3>${esc(p.name.replace(/^AERA /,''))}</h3><div class="plan-price">${esc(money(p.price_minor,p.currency))}</div><p class="period">for ${months===1?'1 month':'6 months'}</p><ul><li>${p.unlimited_devices?'Unlimited devices':`${p.device_limit} ${p.device_limit===1?'device':p.device_limit<5?'devices':'devices'}`}</li><li>${p.traffic_limit_bytes===0?'Unlimited traffic':`${Math.round(p.traffic_limit_bytes/1073741824)} GB of traffic`}</li><li>Hiddify on 5 platforms</li></ul><a href="${esc(config.bot_url)}" data-checkout-plan="${esc(p.id)}" class="button">Pay with Stars</a><a href="${esc(config.bot_url)}" data-checkout-plan="${esc(p.id)}" data-checkout-method="rub" class="button plan-bank-payment">Card / SBP</a></article>`).join('')||'<p class="empty">No plans are available for this duration yet.</p>'; }
 paint();
 document.querySelectorAll('[data-months]').forEach(b=>b.onclick=()=>{months=Number(b.dataset.months);document.querySelectorAll('[data-months]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paint();});
 try{const result=await api('plans');catalog=result.plans.filter(p=>p.price_minor<=1000000);$('#plan-source').textContent='Plans loaded from the AERA catalogue. Prices cover the entire selected period.';paint();}catch{$('#plan-source').textContent='Reference prices from the project catalogue dated 5 October 2026. Current plans and Stars prices are available in the bot.';}
}

const guideSources={install:'https://hiddify.com/app/How-to-install-Hiddify-app/',use:'https://hiddify.com/app/How-to-use-Hiddify-app/',releases:'https://github.com/hiddify/hiddify-app/releases/latest'};
const platforms={
 android:{title:'Android',download:'https://play.google.com/store/apps/details?id=app.hiddify.com',label:'Open Google Play',install:'Install Hiddify from Google Play. If the store is unavailable, get the APK from the official releases page. Choose the build for your device.',image:'android-1.png',caption:'App image published by Hiddify on Google Play. The appearance may differ from your installed version.',source:'https://play.google.com/store/apps/details?id=app.hiddify.com',connect:'Tap the connect button and approve the system request to create a VPN connection.'},
 ios:{title:'iPhone / iPad',download:'https://apps.apple.com/us/app/hiddify-proxy-vpn/id6596777532',label:'Open App Store',install:'Install Hiddify Proxy & VPN from the App Store. The store lists iOS 15 or later as a requirement. Availability depends on your Apple ID region.',image:'ios-1.png',caption:'An original Hiddify screenshot published by its developer on the App Store. The interface uses the language of the source image.',source:'https://apps.apple.com/us/app/hiddify-proxy-vpn/id6596777532',connect:'Tap connect, allow the VPN configuration to be added and confirm as prompted by iOS.'},
 windows:{title:'Windows',download:guideSources.releases,label:'Download for Windows',install:'Open the official releases page and choose the Windows installer for your architecture. Run the installer, complete setup and open Hiddify.',image:'install-10.png',caption:'A Windows screen from the official Hiddify guide, showing version 0.6.0. The current version may have a different layout.',source:guideSources.install,connect:'Click connect. If your selected mode requests administrator rights, approve only the official Hiddify app you installed.'},
 macos:{title:'macOS',download:guideSources.releases,label:'Download for macOS',install:'Choose a macOS DMG or PKG from the official releases. For a DMG, open the image and drag Hiddify into Applications, then launch it. Check compatibility with your macOS version.',image:'install-12.png',caption:'A macOS installation image from the official Hiddify guide, showing the app being moved to Applications. The guide may show an earlier version.',source:guideSources.install,connect:'Click connect and approve system permissions if macOS requests them.'},
 linux:{title:'Linux',download:guideSources.releases,label:'Download for Linux',install:'Choose the Linux AppImage for your architecture from the official releases. Enable execution in the file properties and run it. AppImage/FUSE requirements depend on your distribution; a Debian package is also available.',image:'use-4.png',caption:'An example of “Add from clipboard” from the official guide, captured on macOS. This is not a Linux screenshot; a current Linux-specific screenshot has not been verified.',source:guideSources.use,connect:'Click connect. If TUN mode requires extra permissions, follow the Hiddify prompts and the documentation for your distribution.'}
};
function setup(){
 const selected=new URLSearchParams(location.search).get('platform');
 main.innerHTML=`<div class="wrap page-space">${head('CONNECTION','Set up once.<br>Then just connect.','Choose your device. You will need Hiddify and your private AERA link.')}<div class="platforms" aria-label="Choose a device">${Object.entries(platforms).map(([id,p])=>`<button data-platform="${id}" aria-pressed="false">${p.title}</button>`).join('')}</div><div id="guide" aria-live="polite"></div><section class="section"><h2>If something goes wrong</h2><p class="fine">Check your internet connection, subscription expiry and profile updates. Do not post your private link in group chats.</p><a class="button primary account-card-action" href="/support">Open support</a></section></div>`;
 function choose(id){
  const p=platforms[id];if(!p)return;
  document.querySelectorAll('[data-platform]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.platform===id)));
  $('#guide').innerHTML=`<div class="guide-layout"><div class="guide-steps"><section class="step"><h3>Install Hiddify</h3><p>${p.install}</p><a class="button primary" href="${p.download}" target="_blank" rel="noopener noreferrer">${p.label}</a>${id==='android'?`<p class="fine"><a class="text-link" href="${guideSources.releases}" target="_blank" rel="noopener noreferrer">Official APKs and other builds</a></p>`:''}</section><section class="step"><h3>Copy your private link</h3><p>Open <a class="text-link" href="/account">your account</a> or the AERA Telegram bot. Open your connection details and copy the link. Keep it private.</p></section><section class="step"><h3>Add your profile</h3><p>In Hiddify, tap “+” and choose “Add from clipboard”. Check that the profile appears in the list.</p></section><section class="step"><h3>Connect</h3><p>${p.connect} Wait for the app to show that you are connected.</p></section><p class="fine">Checked against official materials on 5 October 2026. Button names may vary by language and version. <a class="text-link" href="${guideSources.use}" target="_blank" rel="noopener noreferrer">Hiddify guide</a></p></div><aside class="guide-art"><p class="image-label">HIDDIFY / ${p.title.toUpperCase()}</p><figure><a href="/assets/screens/${p.image}" target="_blank" rel="noopener"><img src="/assets/screens/${p.image}" alt="${esc(p.caption)}" loading="lazy"></a><figcaption>${p.caption}<br>© Hiddify. <a href="${p.source}" target="_blank" rel="noopener noreferrer">Image source</a>. Click the image to enlarge it.</figcaption></figure></aside></div>`;
 }
 document.querySelectorAll('[data-platform]').forEach(b=>b.onclick=()=>{choose(b.dataset.platform);history.replaceState(null,'',`/setup?platform=${b.dataset.platform}`);});
 choose(platforms[selected]?selected:'android');
}

function signIn(message=''){
 $('#account-content').innerHTML=`<div class="login-layout"><section class="login-card"><div class="eyebrow">YOUR AERA ACCOUNT</div><h2>Sign in with Telegram</h2><p>Use the same Telegram account you used in the bot. Your subscription and payments will appear after you sign in.</p>${message?`<div class="notice">${esc(message)}</div>`:''}${config.auth_enabled?'<a class="button primary" href="/auth/start">Sign in with Telegram</a>':`<div class="notice">Website sign-in is not available yet. Manage your access in the bot.</div>${botButton()}`}<p class="fine">AERA does not need your Telegram password. Sign-in is confirmed through Telegram. <a class="text-link" href="/privacy">How your data is used</a></p></section><aside class="login-note"><h3>Everything you need, together</h3><p>Your subscription expiry, private connection link and payment history.</p><h3>New to AERA?</h3><p>Start with the bot. You need an existing AERA profile to sign in to your account.</p><a class="text-link bot-link" href="${config.bot_url}" target="_blank" rel="noopener noreferrer">Open the AERA bot</a></aside></div>`;
 if(config.auth_enabled && config.login_method==='bot') prepareBotLogin();
}
async function account(){
 main.innerHTML=`<div class="wrap page-space">${head('YOUR ACCOUNT','Your access.<br>Under control.')}<div id="account-content"><p class="empty">Checking your session…</p></div></div>`;
 const result=new URLSearchParams(location.search).get('login');
 const messages={unknown:'Your AERA profile was not found or is unavailable. Open the bot with the same Telegram account.',failed:'Sign-in was not completed or confirmation expired. Please try again.',unavailable:'Sign-in is temporarily unavailable.'};
 if(result){history.replaceState(null,'','/account');signIn(messages[result]||'');return;}
 if(!config.backend_enabled){signIn();return;}
 try{renderAccount(await api('account'));}catch(e){if(e.status===401)signIn();else $('#account-content').innerHTML=`<div class="notice"><p>${esc(e.message)}</p></div><div class="actions"><button class="button" id="retry-account">Try again</button>${botButton()}</div>`;if($('#retry-account'))$('#retry-account').onclick=account;}
}
function renderAccount(data){
 const sub=data.subscription;
 $('#account-content').innerHTML=`<div class="account-top"><h2>Hello, ${esc(data.user.name)}.</h2><button class="button small" id="logout">Sign out</button></div><div class="account-grid"><section class="panel"><h3>Subscription</h3>${sub?`<span class="status">${esc(statusName(sub.status))}</span><h2>${esc(sub.label)}</h2><dl class="stats"><div><dt>Valid until · your local time</dt><dd>${esc(date(sub.expires_at))}</dd></div><div><dt>Devices</dt><dd>${sub.plan?(sub.plan.unlimited_devices?'Unlimited':sub.plan.device_limit):'Trial access'}</dd></div></dl>${sub.status==='UNKNOWN'?'<p class="fine">The status has not been confirmed recently. Refresh your account later or contact support.</p>':''}${sub.checked_at?`<p class="fine">Last checked: ${esc(date(sub.checked_at))}</p>`:''}`:'<p>You do not have a subscription yet. Browse the plans or open the bot.</p><a class="button primary account-card-action" href="/plans">Choose a plan</a>'}</section><section class="panel"><h3>Connection</h3><p>${data.connection_available?'Your private link is revealed only when you request it. Do not share it with others.':'Your link is not available yet. Check your subscription expiry and connection status.'}</p>${data.connection_available?'<button id="reveal" class="button primary">Show private link</button>':'<a class="button primary account-card-action" href="/support">Contact support</a>'}<div id="connection" class="connection-box"></div><a class="text-link" href="/setup">Connection guide</a></section></div><section class="panel history"><h3>Payment history</h3><p class="fine">The latest 100 records. Status is confirmed using AERA data.</p>${data.payments.length?`<div class="table-scroll"><table><thead><tr><th scope="col">Date</th><th scope="col">Amount</th><th scope="col">Method</th><th scope="col">Status</th><th scope="col">ID</th></tr></thead><tbody>${data.payments.filter(p=>p.status==='PAID').map(p=>`<tr><td>${esc(date(p.created_at))}</td><td>${esc(money(p.amount_minor,p.currency))}</td><td>${esc(({telegram_stars:'Stars',stars:'Stars',crypto_pay:'Cryptocurrency',freekassa:'FreeKassa',manual:'Manual',wata:'Card / SBP',yookassa:'Card / SBP'})[p.provider]||p.provider)}</td><td>${esc(statusName(p.status))}</td><td>${esc(p.id)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No payments yet.</p>'}</section><section class="panel account-payment"><h3>Payment</h3><p>Choose a payment method, then a plan.</p><div class="account-payment-methods"><a class="button" href="/plans?method=sbp">SBP</a><a class="button" href="/plans?method=card">Card</a><span class="button payment-unavailable" aria-disabled="true">Cryptocurrency<span class="payment-soon">Soon</span></span><a class="button" href="${esc(config.bot_url)}">Telegram Stars</a></div></section>`;
 $('#logout').onclick=async()=>{try{await api('logout','POST');signIn();toast('You have signed out');}catch(e){toast(e.message);}};
 if($('#reveal'))$('#reveal').onclick=async()=>{
  const button=$('#reveal');button.disabled=true;
  try{const data=await api('connection','POST');const raw=String(data.connection||'');if(!/^(https:\/\/|vless:\/\/|vmess:\/\/|trojan:\/\/|ss:\/\/)/i.test(raw))throw new Error('This link format is not supported. Please contact support.');
   $('#connection').innerHTML='<label for="private-link" class="fine">Your private link</label><input id="private-link" readonly autocomplete="off" spellcheck="false"><div class="actions"><button class="button small" id="copy-link">Copy</button><button class="button small" id="hide-link">Hide</button></div><p class="fine">Add the link to Hiddify using “+”. Do not publish it.</p>';
   $('#private-link').value=raw;
   $('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(raw);toast('Link copied');}catch{$('#private-link').select();toast('Link selected — copy it manually');}};
   $('#hide-link').onclick=()=>{$('#connection').replaceChildren();button.disabled=false;};
  }catch(e){toast(e.message);button.disabled=false;}
 };
}

function support(){window.renderAeraSupport(main,'en',location.pathname==='/support/admin');}

const legalPages=window.AERA_LEGAL.en;
function legal(key){const doc=legalPages[key];main.innerHTML=`<div class="wrap page-space"><div class="legal">${head('AERA VPN',doc.title,doc.intro)}<nav class="legal-nav" aria-label="Documents"><a href="/privacy">Privacy policy</a><a href="/terms">User agreement</a><a href="/cookies">Cookies</a></nav>${doc.sections.map(([title,body])=>`<section><h2>${esc(title)}</h2><p>${esc(body)}</p></section>`).join('')}<section><h2>Support</h2><p><a href="/support" class="text-link">AERA support</a> · <a href="/support" class="text-link">Support ticket</a></p></section></div></div>`;}
function paymentResult(success){main.innerHTML=`<div class="wrap page-space">${head('PAYMENT RESULT',success?'Checking your payment.':'Payment incomplete.',success?'Returning from the payment service does not confirm receipt of payment. Check your payment history for the current status.':'If you were charged, check your payment history first. Paying again may result in a duplicate charge.')}<div class="actions"><a class="button primary" href="/account">Check your account</a><a class="button primary account-card-action" href="/support">Contact support</a></div></div>`;}
async function boot(){
 try{config=await api('config');}catch{}
 const path=location.pathname;
 const titleMap={'/support/admin':'Customer requests','/':'Stay connected. On your terms.','/plans':'Plans','/setup':'Hiddify setup','/account':'My account','/support':'Support','/privacy':'Privacy','/terms':'User agreement','/cookies':'Cookie','/payments/success':'Payment verification','/payments/failure':'Payment incomplete'};
 document.title=`${titleMap[path]||'Page not found'} — AERA VPN`;
 document.querySelectorAll('#navigation a').forEach(a=>{if(a.getAttribute('href')===path)a.setAttribute('aria-current','page');});
 if(path==='/')home();else if(path==='/plans')await plans();else if(path==='/setup')setup();else if(path==='/account')await account();else if((path==='/support'||path==='/support/admin'))support();else if(legalPages[path.slice(1)])legal(path.slice(1));else if(path.startsWith('/payments/'))paymentResult(path==='/payments/success');else main.innerHTML=`<div class="wrap page-space">${head('404','Nothing here.','The link may be out of date.')}<a class="button primary" href="/">Go to homepage</a></div>`;
}
$('.menu-button').onclick=()=>{const open=$('#navigation').classList.toggle('open');$('.menu-button').setAttribute('aria-expanded',String(open));};
window.addEventListener('pageshow',e=>{if(e.persisted&&location.pathname==='/account')account();});
boot();

async function prepareBotLogin(){
 const button=$('#account-content a[href="/auth/start"]'); if(!button)return;
 const notice=document.createElement('div'); notice.className='notice'; button.before(notice);
 const words={"preparing": "Preparing Telegram sign-in…", "code": "Request code: ", "instruction": "Press Start in the bot, then return to this browser tab.", "fallback": "Open using a Telegram link", "expired": "Sign-in expired. Refresh this page and try again."};
 notice.textContent=words.preparing; button.href='#'; button.setAttribute('aria-disabled','true'); button.onclick=e=>e.preventDefault();
 try{
  const flow=await api('bot/start','POST'); if(!button.isConnected)return;
  notice.textContent=words.instruction;
  button.href=flow.deep_link; button.removeAttribute('aria-disabled');
  const fallback=document.createElement('a'); fallback.className='text-link'; fallback.textContent=words.fallback; fallback.href=flow.fallback; fallback.target='_blank'; fallback.rel='noopener noreferrer'; button.after(fallback);
  const deadline=Date.now()+flow.expires_in*1000; let started=false;
  async function poll(){
   if(!button.isConnected)return;
   if(Date.now()>deadline){notice.textContent=words.expired;button.href='#';button.onclick=e=>e.preventDefault();fallback.remove();return;}
   try{
    const result=await api('bot/status','POST');
    if(result.status==='approved'){await account();return;}
   }catch(error){if([401,403,410].includes(error.status)){notice.textContent=error.message;button.href='#';button.onclick=e=>e.preventDefault();fallback.remove();return;}}
   setTimeout(poll,2000);
  }
  const start=()=>{if(!started){started=true;poll();}};
  button.onclick=start; fallback.onclick=start;
 }catch(error){notice.textContent=error.message;}
}

document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-checkout-plan]'); if(!button)return;
 event.preventDefault(); if(button.dataset.checkoutMethod==='rub'){const chosen=new URLSearchParams(location.search).get('method');location.href='/checkout?plan='+encodeURIComponent(button.dataset.checkoutPlan)+(chosen==='card'?'&method=36':chosen==='sbp'?'&method=42':'');return;} if(button.dataset.busy)return;button.dataset.busy='1';
 const popup=window.open('about:blank','_blank');const original=button.textContent;button.textContent=document.documentElement.lang==='en'?'Opening Telegram…':'Открываем Telegram…';
 try{
  const response=await fetch('/api/web/bot/start',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_id:button.dataset.checkoutPlan,method:button.dataset.checkoutMethod||'stars'})});
  const flow=await response.json();if(!response.ok)throw Error(flow.detail||'Checkout unavailable');
  const deadline=Date.now()+flow.expires_in*1000;
  const poll=async()=>{if(Date.now()>deadline)return;try{const result=await api('bot/status','POST');if(result.status==='approved'){location.href=sessionStorage.getItem('aera-checkout-return')||'/account';sessionStorage.removeItem('aera-checkout-return');return;}}catch(error){if([401,403,410].includes(error.status))return;}setTimeout(poll,2000);};
  poll();if(popup){popup.location.href=flow.fallback;}else{location.href=flow.deep_link;}
 }catch(error){if(popup)popup.close();toast(error.message);}finally{button.textContent=original;delete button.dataset.busy;}
});

let accountRefreshTimer;
function refreshVisibleAccount(){if(location.pathname==='/account'&&document.visibilityState==='visible'){clearTimeout(accountRefreshTimer);accountRefreshTimer=setTimeout(account,250);}}
document.addEventListener('visibilitychange',refreshVisibleAccount);
window.addEventListener('focus',refreshVisibleAccount);
