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
  if(!response.ok){const e=new Error(body.detail||'Не удалось загрузить данные.');e.status=response.status;throw e;}
  return body;
}
const money=(amount,currency='RUB')=>currency==='XTR'?`${Number(amount).toLocaleString('ru-RU')} Stars`:new Intl.NumberFormat('ru-RU',{style:'currency',currency,maximumFractionDigits:2}).format(amount/100);
const date=value=>value?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'Срок ещё не начался';
const statusName=s=>({ACTIVE:'Активна',WAITING:'Ожидает первого подключения',EXPIRED:'Срок истёк',UNKNOWN:'Статус уточняется',ACTIVATING:'Активация',BLOCKED:'Доступ ограничен',PENDING_PROVISIONING:'Подключение готовится',EXPIRING:'Скоро истекает',TRIAL:'Пробный доступ',PAID:'Оплачено',PENDING:'Ожидает оплаты',FAILED:'Не завершён',CANCELED:'Отменено',CANCELLED:'Отменено',REFUNDED:'Возвращено'})[s]||'Статус уточняется';
const head=(eyebrow,title,copy='')=>`<div class="page-head"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${copy?`<p>${copy}</p>`:''}</div>`;
const botButton=(label='Открыть Telegram-бота')=>`<a class="button primary bot-link" href="${config.bot_url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const faqs=[
 ['Что нужно для подключения?','Действующий доступ AERA, приложение Hiddify и ваша личная ссылка. Скопируйте её в боте или кабинете, добавьте в Hiddify и включите подключение.'],
 ['На каких устройствах работает Hiddify?','Есть версии для Android, iPhone и iPad, Windows, macOS и Linux. Выберите устройство в разделе «Как подключить»: там указаны официальные источники загрузки.'],
 ['Можно ли передавать личную ссылку?','Ссылка даёт доступ к вашей подписке. Не публикуйте её и не отправляйте посторонним. Количество устройств зависит от тарифа. Если ссылка попала к другим людям, обратитесь в поддержку.'],
 ['Оплата прошла, а доступа нет. Что делать?','Сначала проверьте подписку и историю платежей. Возврат на страницу «Успешно» сам по себе не подтверждает оплату. Если статус не обновился, отправьте в поддержку номер платежа, сумму и время. Не оплачивайте повторно до проверки.'],
 ['Hiddify не подключается. С чего начать?','Проверьте интернет без VPN и срок подписки. Обновите профиль в Hiddify, выключите другие VPN-приложения и подключитесь снова. Если это не помогло, напишите в поддержку версию приложения, систему и текст ошибки — без личной ссылки.']
];
const faqHtml=()=>`<div class="faq">${faqs.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`;

function home(){
 main.innerHTML=`<div class="wrap"><section class="hero"><div class="eyebrow">AERA VPN / ВАШ ЛИЧНЫЙ ДОСТУП</div><div class="hero-graphic" aria-hidden="true"></div><h1>На связи.<br><em>На ваших условиях.</em></h1><p class="hero-copy">Одна подписка для ваших устройств. Подключайтесь через Hiddify, управляйте доступом и получайте помощь на сайте.</p><div class="actions"><a class="button primary" href="/plans">Выбрать тариф</a><a class="button" href="/setup">Как подключить</a></div><div class="hero-bottom"><span>5 платформ</span><span>От одного устройства</span><span>Поддержка на сайте</span></div></section><div class="quick-grid"><a href="/plans" class="quick-card"><span class="card-number">01 / ВЫБЕРИТЕ</span><h3>Для вас. Или для всех.</h3><p>От личного смартфона до устройств всей команды.</p></a><a href="/setup" class="quick-card"><span class="card-number">02 / ПОДКЛЮЧИТЕ</span><h3>Ваше устройство готово.</h3><p>Установите Hiddify и добавьте личную ссылку AERA.</p></a><a href="/account" class="quick-card"><span class="card-number">03 / УПРАВЛЯЙТЕ</span><h3>Всё о вашем доступе.</h3><p>Подписка, срок действия и история платежей в одном месте.</p></a></div><section class="section"><div class="section-heading"><h2>Меньше настроек.<br>Больше своего времени.</h2><p>Начните с устройства, которым пользуетесь каждый день. Инструкции проведут от установки до подключения.</p></div><div class="mini-features"><div><h3>Один знакомый клиент</h3><p>Hiddify для телефона и компьютера. Загружайте приложение из официальных источников.</p></div><div><h3>Понятная подписка</h3><p>Тарифы на 1 и 6 месяцев. Лимит устройств указан до выбора.</p></div><div><h3>Помощь рядом</h3><p>Оставьте обращение на сайте, если понадобится помощь с доступом.</p></div></div></section><section class="section"><div class="section-heading"><h2>Есть вопрос?</h2><a class="text-link" href="/support">Перейти в поддержку</a></div>${faqHtml()}</section></div>`;
}

const snapshotPlans=[['solo','SOLO',1,100,500],['plus','PLUS',3,200,1000],['infinity','INFINITY',10,500,3000],['business','BUSINESS',null,5000,25000]].flatMap(([family,name,devices,p1,p6])=>[1,6].map(m=>({slug:`${family}-${m}m`,name:`AERA ${name}`,duration_months:m,duration_days:m*30,device_limit:devices,unlimited_devices:devices===null,price_minor:(m===1?p1:p6)*100,currency:'RUB',traffic_limit_bytes:0})));
async function plans(){
 main.innerHTML=`<div class="wrap page-space">${head('ТАРИФЫ','Выберите свой масштаб.','Для одного устройства, близких или команды. Выберите срок и сравните условия.')}<div class="segmented" aria-label="Срок подписки"><button data-months="1" aria-pressed="true">1 месяц</button><button data-months="6" aria-pressed="false">6 месяцев</button></div><div id="plan-grid" class="plans-grid" aria-live="polite"></div><p id="plan-source" class="fine">Уточняем тарифы…</p><section class="panel account-payment"><h3>Способы оплаты</h3><div class="account-payment-methods"><span class="button">СБП</span><span class="button">Карта</span><span class="button">Криптовалюта</span><span class="button">Telegram Stars</span></div><p class="fine">Оплата СБП через FreeKassa / FKWallet уже доступна — потребуется вход в FKWallet. Telegram Stars доступны в боте. Прямая оплата СБП через Platega и криптовалюта подключаются.</p></section></div>`;
 let catalog=snapshotPlans.filter(p=>p.price_minor<=1000000),months=1;
 function paint(){ $('#plan-grid').innerHTML=catalog.filter(p=>(p.duration_months||Math.round(p.duration_days/30))===months).map(p=>`<article class="plan"><span class="tag">${p.unlimited_devices?'Для команды':p.device_limit===1?'Личный':p.device_limit<=3?'На каждый день':'Для близких'}</span><h3>${esc(p.name.replace(/^AERA /,''))}</h3><div class="plan-price">${esc(money(p.price_minor,p.currency))}</div><p class="period">за ${months===1?'1 месяц':'6 месяцев'}</p><ul><li>${p.unlimited_devices?'Безлимит устройств':`${p.device_limit} ${p.device_limit===1?'устройство':p.device_limit<5?'устройства':'подключений'}`}</li><li>${p.traffic_limit_bytes===0?'Безлимитный трафик':`${Math.round(p.traffic_limit_bytes/1073741824)} ГБ трафика`}</li><li>Hiddify на 5 платформах</li></ul><a href="${esc(config.bot_url)}" data-checkout-plan="${esc(p.id)}" class="button">Оплатить Stars</a><a href="${esc(config.bot_url)}" data-checkout-plan="${esc(p.id)}" data-checkout-method="rub" class="button plan-bank-payment">Карта / СБП</a></article>`).join('')||'<p class="empty">Тарифов на этот срок пока нет.</p>'; }
 paint();
 document.querySelectorAll('[data-months]').forEach(b=>b.onclick=()=>{months=Number(b.dataset.months);document.querySelectorAll('[data-months]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paint();});
 try{const result=await api('plans');catalog=result.plans.filter(p=>p.price_minor<=1000000);$('#plan-source').textContent='Тарифы загружены из каталога AERA. Полная стоимость указана за выбранный срок.';paint();}catch{$('#plan-source').textContent='Справочные цены из каталога проекта на 5 октября 2026. Актуальные тарифы и стоимость в Stars доступны в боте.';}
}

const guideSources={install:'https://hiddify.com/app/How-to-install-Hiddify-app/',use:'https://hiddify.com/app/How-to-use-Hiddify-app/',releases:'https://github.com/hiddify/hiddify-app/releases/latest'};
const platforms={
 android:{title:'Android',download:'https://play.google.com/store/apps/details?id=app.hiddify.com',label:'Открыть Google Play',install:'Установите Hiddify из Google Play. Если магазин недоступен, APK можно найти на официальной странице релизов. Выбирайте сборку для своего устройства.',image:'android-1.png',caption:'Изображение приложения, опубликованное Hiddify в Google Play. Оформление может отличаться от установленной версии.',source:'https://play.google.com/store/apps/details?id=app.hiddify.com',connect:'Нажмите кнопку подключения и подтвердите системный запрос на создание VPN-соединения.'},
 ios:{title:'iPhone / iPad',download:'https://apps.apple.com/us/app/hiddify-proxy-vpn/id6596777532',label:'Открыть App Store',install:'Установите Hiddify Proxy & VPN из App Store. По данным магазина, требуется iOS 15 или новее. Доступность приложения зависит от региона Apple ID.',image:'ios-1.png',caption:'Настоящий скриншот Hiddify, опубликованный разработчиком в App Store. Интерфейс показан на языке исходного изображения.',source:'https://apps.apple.com/us/app/hiddify-proxy-vpn/id6596777532',connect:'Нажмите кнопку подключения. Разрешите добавление VPN-конфигурации и подтвердите действие способом, который предложит iOS.'},
 windows:{title:'Windows',download:guideSources.releases,label:'Скачать для Windows',install:'Откройте официальный список релизов и выберите установщик Windows для своей архитектуры. Запустите установщик, завершите установку и откройте Hiddify.',image:'install-10.png',caption:'Экран Windows из официального руководства Hiddify. На изображении версия 0.6.0; в актуальной версии расположение элементов может отличаться.',source:guideSources.install,connect:'Нажмите кнопку подключения. Если выбранный режим запрашивает права администратора, подтвердите запрос только для установленного официального Hiddify.'},
 macos:{title:'macOS',download:guideSources.releases,label:'Скачать для macOS',install:'Выберите macOS DMG или PKG в официальных релизах. Для DMG откройте образ и перенесите Hiddify в «Программы», затем запустите приложение. Сверьте требования версии с вашей macOS.',image:'install-12.png',caption:'Реальная установка macOS из официального руководства Hiddify: перенос приложения в Applications. Иллюстрация руководства может относиться к более ранней версии.',source:guideSources.install,connect:'Нажмите кнопку подключения и подтвердите системные разрешения, если macOS их запросит.'},
 linux:{title:'Linux',download:guideSources.releases,label:'Скачать для Linux',install:'Выберите Linux AppImage для своей архитектуры в официальных релизах. В свойствах файла разрешите выполнение и запустите его. Требования AppImage/FUSE зависят от дистрибутива; также доступен пакет Debian.',image:'use-4.png',caption:'Пример команды «Add from clipboard» из официальной инструкции, снятый на macOS. Это не скриншот Linux; отдельный актуальный Linux-скриншот не подтверждён.',source:guideSources.use,connect:'Нажмите кнопку подключения. Если режим TUN требует дополнительных прав, следуйте подсказкам Hiddify и документации вашего дистрибутива.'}
};
function setup(){
 const selected=new URLSearchParams(location.search).get('platform');
 main.innerHTML=`<div class="wrap page-space">${head('ПОДКЛЮЧЕНИЕ','Один раз настроить.<br>Дальше — просто включать.','Выберите своё устройство. Понадобится приложение Hiddify и личная ссылка из AERA.')}<div class="platforms" aria-label="Выбор устройства">${Object.entries(platforms).map(([id,p])=>`<button data-platform="${id}" aria-pressed="false">${p.title}</button>`).join('')}</div><div id="guide" aria-live="polite"></div><section class="section"><h2>Если что-то не получилось</h2><p class="fine">Проверьте интернет, срок подписки и обновление профиля. Не отправляйте свою личную ссылку в общие чаты.</p><a class="button primary account-card-action" href="/support">Открыть поддержку</a></section></div>`;
 function choose(id){
  const p=platforms[id];if(!p)return;
  document.querySelectorAll('[data-platform]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.platform===id)));
  $('#guide').innerHTML=`<div class="guide-layout"><div class="guide-steps"><section class="step"><h3>Установите Hiddify</h3><p>${p.install}</p>${id==='ios'?`<p><strong>Рекомендуем выбрать регион «Соединённые Штаты».</strong></p><p>Откройте App Store → нажмите значок профиля → откройте настройки учётной записи. В поле «Страна/регион» выберите «Соединённые Штаты», затем заполните форму по образцу ниже. Имя и фамилию укажите свои.</p><figure class="region-help"><a href="/assets/screens/ios-region-aera.png" target="_blank" rel="noopener"><img src="/assets/screens/ios-region-aera.png" alt="Как выбрать регион Соединённые Штаты и заполнить форму в настройках App Store" loading="lazy" width="1536" height="1024"></a><figcaption>Пример заполнения формы. Нажмите на изображение, чтобы увеличить.</figcaption></figure><p class="fine">Смене региона могут мешать остаток на балансе и действующие подписки. <a class="text-link" href="https://support.apple.com/ru-ru/118283" target="_blank" rel="noopener noreferrer">Инструкция Apple</a></p>`:''}<a class="button primary" href="${p.download}" target="_blank" rel="noopener noreferrer">${p.label}</a>${id==='android'?`<p class="fine"><a class="text-link" href="${guideSources.releases}" target="_blank" rel="noopener noreferrer">Официальные APK и другие сборки</a></p>`:''}</section><section class="step"><h3>Скопируйте личную ссылку</h3><p>Откройте <a class="text-link" href="/account">личный кабинет</a> или Telegram-бота AERA. Перейдите к своему подключению и скопируйте ссылку. Она конфиденциальна.</p></section><section class="step"><h3>Добавьте профиль</h3><p>В Hiddify нажмите «+» и выберите «Добавить из буфера обмена» / «Add from clipboard». Проверьте, что профиль появился в списке.</p></section><section class="step"><h3>Включите подключение</h3><p>${p.connect} Дождитесь состояния подключения в приложении.</p></section><p class="fine">Проверено по официальным материалам 5 октября 2026. Названия кнопок могут различаться по языку и версии. <a class="text-link" href="${guideSources.use}" target="_blank" rel="noopener noreferrer">Руководство Hiddify</a></p></div><aside class="guide-art"><p class="image-label">HIDDIFY / ${p.title.toUpperCase()}</p><figure><a href="/assets/screens/${p.image}" target="_blank" rel="noopener"><img src="/assets/screens/${p.image}" alt="${esc(p.caption)}" loading="lazy"></a><figcaption>${p.caption}<br>© Hiddify. <a href="${p.source}" target="_blank" rel="noopener noreferrer">Источник изображения</a>. Нажмите на изображение, чтобы увеличить.</figcaption></figure></aside></div>`;
 }
 document.querySelectorAll('[data-platform]').forEach(b=>b.onclick=()=>{choose(b.dataset.platform);history.replaceState(null,'',`/setup?platform=${b.dataset.platform}`);});
 choose(platforms[selected]?selected:'android');
}

function signIn(message=''){
 $('#account-content').innerHTML=`<div class="login-layout"><section class="login-card"><div class="eyebrow">ВАШ АККАУНТ AERA</div><h2>Войдите через Telegram</h2><p>Используйте тот же Telegram-аккаунт, с которым вы подключались в боте. Подписка и платежи появятся после входа.</p>${message?`<div class="notice">${esc(message)}</div>`:''}${config.auth_enabled?'<a class="button primary" href="/auth/start">Войти через Telegram</a>':`<div class="notice">Вход на сайте ещё не подключён. Управляйте доступом в боте.</div>${botButton()}`}<p class="fine">Пароль от Telegram на сайте AERA не нужен. Вход подтверждается на стороне Telegram. <a class="text-link" href="/privacy">Как используются данные</a></p></section><aside class="login-note"><h3>Всё важное — рядом</h3><p>Срок подписки, ваша ссылка подключения и история платежей.</p><h3>Впервые в AERA?</h3><p>Начните с бота. Для входа в кабинет нужен существующий профиль AERA.</p><a class="text-link bot-link" href="${config.bot_url}" target="_blank" rel="noopener noreferrer">Открыть бота AERA</a></aside></div>`;
 if(config.auth_enabled && config.login_method==='bot') prepareBotLogin();
}
async function account(){
 main.innerHTML=`<div class="wrap page-space">${head('ЛИЧНЫЙ КАБИНЕТ','Ваш доступ.<br>Под контролем.')}<div id="account-content"><p class="empty">Проверяем сессию…</p></div></div>`;
 const result=new URLSearchParams(location.search).get('login');
 const messages={unknown:'Профиль AERA не найден или недоступен. Откройте бота с тем же Telegram-аккаунтом.',failed:'Вход не завершён или время подтверждения истекло. Попробуйте ещё раз.',unavailable:'Вход временно недоступен.'};
 if(result){history.replaceState(null,'','/account');signIn(messages[result]||'');return;}
 if(!config.backend_enabled){signIn();return;}
 try{renderAccount(await api('account'));}catch(e){if(e.status===401)signIn();else $('#account-content').innerHTML=`<div class="notice"><p>${esc(e.message)}</p></div><div class="actions"><button class="button" id="retry-account">Повторить</button>${botButton()}</div>`;if($('#retry-account'))$('#retry-account').onclick=account;}
}
function renderAccount(data){
 const sub=data.subscription;
 $('#account-content').innerHTML=`<div class="account-top"><h2>Здравствуйте, ${esc(data.user.name)}.</h2><button class="button small" id="logout">Выйти</button></div><div class="account-grid"><section class="panel"><h3>Подписка</h3>${sub?`<span class="status">${esc(statusName(sub.status))}</span><h2>${esc(sub.label)}</h2><dl class="stats"><div><dt>Действует до · ваше время</dt><dd>${esc(date(sub.expires_at))}</dd></div><div><dt>Устройства</dt><dd>${sub.plan?(sub.plan.unlimited_devices?'Без ограничений':sub.plan.device_limit):'Пробный доступ'}</dd></div></dl>${sub.status==='UNKNOWN'?'<p class="fine">Давно не получали подтверждение статуса. Обновите кабинет позже или обратитесь в поддержку.</p>':''}${sub.checked_at?`<p class="fine">Последняя проверка: ${esc(date(sub.checked_at))}</p>`:''}`:'<p>Подписки пока нет. Посмотрите тарифы или обратитесь в бот.</p><a class="button primary account-card-action" href="/plans">Выбрать тариф</a>'}</section><section class="panel"><h3>Подключение</h3><p>${data.connection_available?'Личная ссылка откроется только по вашему запросу. Не передавайте её посторонним.':'Ссылка пока недоступна. Проверьте срок подписки и статус подключения.'}</p>${data.connection_available?'<button id="reveal" class="button primary">Показать личную ссылку</button>':'<a class="button primary account-card-action" href="/support">Обратиться в поддержку</a>'}<div id="connection" class="connection-box"></div><a class="text-link" href="/setup">Инструкция по подключению</a></section></div><section class="panel history"><h3>История платежей</h3><p class="fine">Только оплаченные покупки. Последние 100 операций.</p>${data.payments.length?`<div class="table-scroll"><table><thead><tr><th scope="col">Дата</th><th scope="col">Сумма</th><th scope="col">Способ</th><th scope="col">Статус</th><th scope="col">Номер</th></tr></thead><tbody>${data.payments.filter(p=>p.status==='PAID').map(p=>`<tr><td>${esc(date(p.created_at))}</td><td>${esc(money(p.amount_minor,p.currency))}</td><td>${esc(({telegram_stars:'Stars',stars:'Stars',crypto_pay:'Криптовалюта',freekassa:'FreeKassa',manual:'Вручную',wata:'Карта / СБП',yookassa:'Карта / СБП'})[p.provider]||p.provider)}</td><td>${esc(statusName(p.status))}</td><td>${esc(p.id)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Платежей пока нет.</p>'}</section><section class="panel account-payment"><h3>Оплата</h3><p>Выберите способ оплаты, затем тариф.</p><div class="account-payment-methods"><a class="button" href="/plans?method=sbp">СБП</a><a class="button" href="/plans?method=card">Карта</a><span class="button payment-unavailable" aria-disabled="true">Криптовалюта<span class="payment-soon">Скоро</span></span><a class="button" href="${esc(config.bot_url)}">Telegram Stars</a></div></section>`;
 $('#logout').onclick=async()=>{try{await api('logout','POST');signIn();toast('Вы вышли из кабинета');}catch(e){toast(e.message);}};
 if($('#reveal'))$('#reveal').onclick=async()=>{
  const button=$('#reveal');button.disabled=true;
  try{const data=await api('connection','POST');const raw=String(data.connection||'');if(!/^(https:\/\/|vless:\/\/|vmess:\/\/|trojan:\/\/|ss:\/\/)/i.test(raw))throw new Error('Формат ссылки не поддерживается. Обратитесь в поддержку.');
   $('#connection').innerHTML='<label for="private-link" class="fine">Ваша личная ссылка</label><input id="private-link" readonly autocomplete="off" spellcheck="false"><div class="actions"><button class="button small" id="copy-link">Скопировать</button><button class="button small" id="hide-link">Скрыть</button></div><p class="fine">Вставьте ссылку в Hiddify через «+». Не публикуйте её.</p>';
   $('#private-link').value=raw;
   $('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(raw);toast('Ссылка скопирована');}catch{$('#private-link').select();toast('Выделили ссылку — скопируйте вручную');}};
   $('#hide-link').onclick=()=>{$('#connection').replaceChildren();button.disabled=false;};
  }catch(e){toast(e.message);button.disabled=false;}
 };
}

function support(){window.renderAeraSupport(main,'ru',location.pathname==='/support/admin');}

const legalPages=window.AERA_LEGAL.ru;
function legal(key){const doc=legalPages[key];main.innerHTML=`<div class="wrap page-space"><div class="legal">${head('AERA VPN',doc.title,doc.intro)}<nav class="legal-nav" aria-label="Documents"><a href="/privacy">Политика конфиденциальности</a><a href="/terms">Пользовательское соглашение</a><a href="/cookies">Cookie</a></nav>${doc.sections.map(([title,body])=>`<section><h2>${esc(title)}</h2><p>${esc(body)}</p></section>`).join('')}<section><h2>Поддержка</h2><p><a href="/support" class="text-link">Поддержка AERA</a> · <a href="/support" class="text-link">Обращение в поддержку</a></p></section></div></div>`;}
function paymentResult(success){main.innerHTML=`<div class="wrap page-space">${head('РЕЗУЛЬТАТ ОПЛАТЫ',success?'Проверим ваш платёж.':'Оплата не завершена.',success?'Возврат от платёжного сервиса ещё не подтверждает зачисление. Актуальный статус доступен в истории платежей.':'Если деньги списались, сначала проверьте историю платежей. Повторная оплата может привести к двойному списанию.')}<div class="actions"><a class="button primary" href="/account">Проверить в кабинете</a><a class="button primary account-card-action" href="/support">Связаться с поддержкой</a></div></div>`;}
async function boot(){
 try{config=await api('config');}catch{}
 const path=location.pathname;
 const titleMap={'/support/admin':'Обращения клиентов','/':'На связи. На ваших условиях.','/plans':'Тарифы','/setup':'Подключение Hiddify','/account':'Личный кабинет','/support':'Поддержка','/privacy':'Конфиденциальность','/terms':'Соглашение','/cookies':'Cookie','/payments/success':'Проверка платежа','/payments/failure':'Оплата не завершена'};
 document.title=`${titleMap[path]||'Страница не найдена'} — AERA VPN`;
 document.querySelectorAll('#navigation a').forEach(a=>{if(a.getAttribute('href')===path)a.setAttribute('aria-current','page');});
 if(path==='/')home();else if(path==='/plans')await plans();else if(path==='/setup')setup();else if(path==='/account')await account();else if((path==='/support'||path==='/support/admin'))support();else if(legalPages[path.slice(1)])legal(path.slice(1));else if(path.startsWith('/payments/'))paymentResult(path==='/payments/success');else main.innerHTML=`<div class="wrap page-space">${head('404','Здесь ничего нет.','Возможно, ссылка устарела.')}<a class="button primary" href="/">На главную</a></div>`;
}
$('.menu-button').onclick=()=>{const open=$('#navigation').classList.toggle('open');$('.menu-button').setAttribute('aria-expanded',String(open));};
window.addEventListener('pageshow',e=>{if(e.persisted&&location.pathname==='/account')account();});
boot();

async function prepareBotLogin(){
 const button=$('#account-content a[href="/auth/start"]'); if(!button)return;
 const notice=document.createElement('div'); notice.className='notice'; button.before(notice);
 const words={"preparing": "Готовим вход через Telegram…", "code": "Код запроса: ", "instruction": "Нажмите «Старт» в боте и вернитесь в эту вкладку браузера.", "fallback": "Открыть через ссылку Telegram", "expired": "Время входа истекло. Обновите страницу и попробуйте снова."};
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
