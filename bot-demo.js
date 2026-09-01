(function () {
  'use strict';

  const services = [
    { id:'color', title:'Окрашивание волос', price:'4 500 ₽', duration:'3 часа', prepay:'1 000 ₽', image:'/assets/demo-service-color.jpg', alt:'Окрашивание волос в салоне' },
    { id:'cut', title:'Стрижка + укладка', price:'2 500 ₽', duration:'1 час 30 минут', prepay:'500 ₽', image:'/assets/demo-service-cut.jpg', alt:'Стрижка волос в салоне' },
    { id:'care', title:'Уход и восстановление', price:'2 200 ₽', duration:'1 час', prepay:'500 ₽', image:'/assets/demo-service-care.jpg', alt:'Профессиональный уход за волосами' }
  ];
  const dates = ['04(пт)', '05(сб)', '06(вс)'];
  const times = ['10:00 – 13:00', '12:30 – 15:30', '16:00 – 19:00'];

  function esc(value) {
    return String(value).replace(/[&<>'"]/g, function (char) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[char];
    });
  }

  function now() { return '23:02'; }
  function botBubble(html, image, imageClass) {
    return `<div class="tg-row"><div class="tg-bubble">${image ? `<img class="tg-bubble-media ${imageClass || ''}" src="${image}" alt="">` : ''}${html}<time>${now()}</time></div></div>`;
  }
  function userBubble(text) {
    return `<div class="tg-row out"><div class="tg-bubble">${esc(text)}<time>${now()}</time></div></div>`;
  }
  function inlineButtons(items, actionName, columns) {
    const cls = columns === 2 ? ' two' : columns === 3 ? ' three' : '';
    return `<div class="tg-inline${cls}">${items.map(function (item) {
      const wide = item.wide ? ' wide' : '';
      if (item.href) return `<a class="tg-inline-btn${wide}" href="${item.href}">${item.label}</a>`;
      return `<button type="button" class="tg-inline-btn${wide}" data-${actionName}="${item.action}">${item.label}</button>`;
    }).join('')}</div>`;
  }

  function clientKeyboard() {
    const buttons = [
      ['📅 Запись на сеанс','book'], ['📌 Моя запись','my-booking'],
      ['📋 Список услуг','services'], ['ℹ️ Важно','important'],
      ['💬 Обращение к мастеру','contact'], ['⭐ Отзывы','reviews'],
      ['🗺️ Как дойти','route'], ['🆘 Поддержка','support']
    ];
    return buttons.map(function (item) { return `<button type="button" class="tg-reply-btn" data-client="${item[1]}">${item[0]}</button>`; }).join('');
  }

  function adminKeyboard() {
    const buttons = [
      ['📋 Записи','records'], ['🗓 Расписание','schedule'],
      ['✂️ Услуги','admin-services'], ['👥 Клиенты','clients'],
      ['👤 Профиль','profile'], ['👩‍🎨 Мастера','masters'],
      ['📊 Статистика','stats'], ['⚙️ Настройки','settings'],
      ['📖 Инструкция','guide']
    ];
    return buttons.map(function (item, index) { return `<button type="button" class="tg-reply-btn${index === buttons.length - 1 ? ' wide' : ''}" data-admin="${item[1]}">${item[0]}</button>`; }).join('');
  }

  function phoneShell(kind) {
    const isClient = kind === 'client';
    return `<div class="tg-phone aethel-bot-demo" data-tg-phone="${kind}">
      <div class="tg-status"><span>23:02</span><i class="tg-island"></i><span>▮▮▮ LTE&nbsp; 32</span></div>
      <div class="tg-head"><span class="tg-back">‹ <b>45</b></span><span class="tg-head-title"><b>ALINA • запись</b><small>бот</small></span><img class="tg-avatar" src="/assets/demo-master.jpg" alt="Мастер Алина"></div>
      <div class="tg-chat" data-${kind}-chat aria-live="polite"></div>
      <div class="tg-composer" aria-hidden="true"><span class="tg-round-icon">📎</span><span class="tg-input">Сообщение <b>⌨</b></span><span class="tg-round-icon">🎙</span></div>
      <div class="tg-reply-keyboard">${isClient ? clientKeyboard() : adminKeyboard()}</div>
    </div>`;
  }

  function demoMarkup() {
    return `<section class="bot-demo-section" id="interactive-demo">
      <div class="bot-demo-heading aethel-bot-demo"><span class="bot-demo-eyebrow">● Демо настоящего Telegram-интерфейса</span><h2>Запишитесь как клиент. Подтвердите как владелец.</h2><p>Нажимайте те же кнопки, которые видит пользователь в Telegram. Заявка из клиентского меню сразу появится во втором чате — в админ-панели.</p></div>
      <div class="bot-demo-stage">
        <article class="tg-demo-column"><div class="tg-demo-label aethel-bot-demo"><b>Клиентский бот</b><span><i class="tg-live-dot"></i>интерактивный</span></div>${phoneShell('client')}</article>
        <article class="tg-demo-column"><div class="tg-demo-label aethel-bot-demo"><b>Админ-панель в Telegram</b><span><i class="tg-live-dot"></i>связана с записью</span></div>${phoneShell('admin')}</article>
      </div>
      <p class="tg-demo-note aethel-bot-demo">Это безопасное демо: введённые действия остаются только в текущей вкладке.</p>
    </section>`;
  }

  function setupClient(root, onBooking) {
    const chat = root.querySelector('[data-client-chat]');
    const state = { service:null, date:null, time:null, status:null, interactions:0, ctaShown:false };

    function append(html) {
      chat.insertAdjacentHTML('beforeend', html);
      chat.scrollTop = chat.scrollHeight;
    }
    function sayUser(text) { append(userBubble(text)); }
    function sayBot(html, image, imageClass) { append(botBubble(html, image, imageClass)); }
    function addInline(items, columns) { append(inlineButtons(items, 'client', columns)); }
    function maybeCta(force) {
      if (state.ctaShown || (!force && state.interactions < 5)) return;
      state.ctaShown = true;
      sayBot('<strong>Хотите опробовать все возможности бота?</strong><p class="tg-cta-copy">Создайте своего бота, добавьте услуги и проверьте полный сценарий на реальных настройках.</p>');
      addInline([{label:'🚀 Подключить AETHEL',href:'/connect/'}]);
    }
    function welcome() {
      chat.innerHTML = botBubble('<strong>Добро пожаловать в мою уютную студию 💗</strong><p><u>Нажми кнопку ниже для записи на процедуру ↓</u></p><p>Этот бот разработан с любовью командой <a href="#">AETHEL ♡</a></p>', '/assets/demo-master.jpg', 'tg-master-media');
      chat.scrollTop = chat.scrollHeight;
    }
    function startBooking() {
      sayUser('📅 Запись на сеанс');
      sayBot('<strong>✨ Алина ✨</strong><p><strong>Колорист-стилист · опыт 7 лет</strong></p><div class="tg-quote">Сделаю цвет и форму, которые легко поддерживать дома</div><p>Выберите услугу:</p>', '/assets/demo-master.jpg', 'tg-master-media');
      addInline(services.map(function (service) { return {label:service.title,action:'service:'+service.id}; }));
    }
    function showServices(outgoing) {
      if (outgoing) sayUser('📋 Список услуг');
      sayBot('<strong>Актуальные услуги и цены</strong><p>Нажмите на услугу, чтобы увидеть длительность, стоимость бронирования и свободные окна.</p>');
      addInline(services.map(function (service) { return {label:service.title,action:'service:'+service.id}; }));
    }
    function chooseService(id) {
      const service = services.find(function (item) { return item.id === id; });
      if (!service) return;
      state.service = service;
      sayBot(`<strong>✨ ${service.title} ✨</strong><p>Индивидуальная консультация перед процедурой.</p><p>💰 Цена: ${service.price}<br>⏱ Продолжительность: ${service.duration}<br>💳 Стоимость бронирования: ${service.prepay}</p><p>👩‍🎨 Мастер: Алина</p>`, service.image);
      addInline([{label:'❌ Требуется снятие',action:'removal'},{label:'✧ Записаться ✧',action:'month'},{label:'✧ Назад ✧',action:'services-inline'}]);
    }
    function chooseMonth() {
      sayBot('<strong>✧ 📅 Доступен Сентябрь ✧</strong>');
      addInline([{label:'Сентябрь',action:'dates'},{label:'✧Назад✧',action:'services-inline'}]);
    }
    function chooseDates() {
      sayBot('<strong>✧📅 Выберите дату: ✧</strong>');
      addInline(dates.map(function (date, index) { return {label:date,action:'date:'+index}; }).concat([{label:'✧Назад✧',action:'month',wide:true}]), 3);
    }
    function chooseDate(index) {
      state.date = dates[index];
      sayBot(`<strong>✧ 🕘 Выберите удобное время для записи на ${state.date}.09.2026: ✧</strong>`);
      addInline(times.map(function (time) { return {label:time,action:'time:'+time}; }).concat([{label:'✧Назад✧',action:'dates'}]));
    }
    function chooseTime(value) {
      state.time = value;
      sayBot(`<strong>✧ Есть что сообщить мастеру? ✧</strong><p>Здесь можно написать о пожеланиях, предупредить об аллергии или отправить фото желаемого результата.</p><p>Можно отправить текст до 200 символов и до 2 фото.</p><p>⏳ У вас есть 5 минут, чтобы добавить информацию.</p><p>Если добавлять ничего не нужно — нажмите кнопку «✅ Записаться».</p>`);
      addInline([{label:'✅ Записаться',action:'finish'},{label:'❌ Отменить запись',action:'cancel'}]);
    }
    function finishBooking() {
      const service = state.service || services[0];
      state.status = 'pending';
      const booking = {service:service.title,date:state.date || dates[1],time:state.time || times[1],price:service.price,prepay:service.prepay,status:'pending'};
      sayBot(`<strong>✅ Заявка на запись отправлена</strong><p>👩‍🎨 Мастер: Алина<br>✂️ ${booking.service}<br>📅 ${booking.date}.09.2026<br>🕘 ${booking.time}<br>💳 ${booking.price}</p><p>Ожидайте подтверждения мастера.</p>`);
      if (onBooking) onBooking(booking);
      maybeCta(true);
    }
    function info(action) {
      const data = {
        'my-booking':['📌 Моя запись', state.status ? 'Ваша заявка ожидает подтверждения мастера.' : 'Активных записей пока нет. Нажмите «Запись на сеанс», чтобы выбрать время.'],
        important:['ℹ️ Важно','Перенос записи возможен не позднее чем за 24 часа. Предоплата учитывается в полной стоимости услуги.'],
        contact:['💬 Обращение к мастеру','Отправьте вопрос, комментарий или фотографии — мастер получит сообщение вместе с вашей записью.'],
        reviews:['⭐ Отзывы','«Наконец-то можно записаться вечером и не ждать ответа мастера» — Мария.<br><br>«Напоминание пришло вовремя, всё очень удобно» — Ксения.'],
        route:['🗺️ Как дойти','Москва, ул. Примерная, 12. Второй этаж, кабинет 7. От метро — 6 минут пешком.'],
        support:['🆘 Поддержка','В реальном боте клиент сможет обратиться в поддержку AETHEL прямо из этого раздела.']
      };
      const item = data[action] || data.important;
      sayUser(item[0]);
      sayBot(`<strong>${item[0]}</strong><p>${item[1]}</p>`);
      maybeCta(action === 'support');
    }

    root.addEventListener('click', function (event) {
      const target = event.target.closest('[data-client]');
      if (!target) return;
      state.interactions += 1;
      const action = target.dataset.client;
      if (action === 'book') startBooking();
      else if (action === 'services') showServices(true);
      else if (action === 'services-inline') showServices(false);
      else if (action.indexOf('service:') === 0) chooseService(action.slice(8));
      else if (action === 'month') chooseMonth();
      else if (action === 'dates') chooseDates();
      else if (action.indexOf('date:') === 0) chooseDate(Number(action.slice(5)));
      else if (action.indexOf('time:') === 0) chooseTime(action.slice(5));
      else if (action === 'finish') finishBooking();
      else if (action === 'removal') { sayBot('✅ Снятие добавлено к записи. Итоговую длительность мастер уточнит при подтверждении.'); maybeCta(false); }
      else if (action === 'cancel') { state.status = null; sayBot('❌ Оформление записи отменено. Вы можете начать заново в любой момент.'); }
      else info(action);
    });
    root.updateStatus = function (status) {
      state.status = status;
      if (status === 'confirmed') sayBot('<strong>✅ Мастер подтвердил запись</strong><p>Запись сохранена. Напоминание о визите придёт автоматически.</p>');
      else sayBot('<strong>❌ Запись отклонена</strong><p>Выберите другое свободное время или обратитесь к мастеру.</p>');
    };
    welcome();
    return root;
  }

  function setupAdmin(root) {
    const chat = root.querySelector('[data-admin-chat]');
    let clientRoot = null;
    let interactions = 0;
    let ctaShown = false;
    let booking = {service:'Окрашивание волос',date:'05(сб)',time:'12:30 – 15:30',price:'4 500 ₽',prepay:'1 000 ₽',status:'pending'};

    function append(html) { chat.insertAdjacentHTML('beforeend', html); chat.scrollTop = chat.scrollHeight; }
    function sayUser(text) { append(userBubble(text)); }
    function sayBot(html) { append(botBubble(html)); }
    function addInline(items, columns) { append(inlineButtons(items, 'admin', columns)); }
    function cta(force) {
      if (ctaShown || (!force && interactions < 4)) return;
      ctaShown = true;
      sayBot('<strong>Хотите опробовать все возможности AETHEL?</strong><p>Подключите тестового бота и настройте настоящее расписание, услуги, мастеров и уведомления.</p>');
      addInline([{label:'🚀 Открыть инструкцию по подключению',href:'/connect/'}]);
    }
    function pendingRecord() {
      sayBot(`<strong>📋 Поступила новая запись</strong><p>👩‍🎨 Мастер: Алина<br>👤 Клиент: Анна К.<br>📱 Телефон: +7 ••• •••-12-34</p><p>📋 Детали записи:<br>• Услуга: ${esc(booking.service)}<br>• Дата: ${esc(booking.date)}.09.2026<br>• Время: ${esc(booking.time)}<br>• Сумма: ${esc(booking.price)}<br>• Предоплата: ${esc(booking.prepay)}</p>`);
      addInline([{label:'✅ Подтвердить',action:'confirm'},{label:'❌ Отклонить',action:'reject'},{label:'📝 Заметка о клиенте',action:'note-client'},{label:'📋 Заметка к записи',action:'note-booking'}], 2);
    }
    function recordsMenu() {
      sayUser('📋 Записи');
      sayBot('<strong>📋 Записи</strong><p>Что хотите сделать?</p>');
      addInline([{label:'👀 Посмотреть записи',action:'view-records'},{label:'✍️ Записать клиента вручную',action:'manual'},{label:'❌ Отменить запись',action:'cancel-record'},{label:'⬅️ Назад',action:'back'}]);
    }
    function scheduleMenu() {
      sayUser('🗓 Расписание');
      sayBot('<strong>🗓 Расписание</strong><p>Что хотите сделать?</p>');
      addInline([{label:'👀 Посмотреть расписание',action:'view-schedule'},{label:'⭐ Свободные окна',action:'free'},{label:'⚙️ Рабочий график',action:'work-hours'},{label:'🚫 Закрыть время',action:'close-time'},{label:'☕ Перерывы',action:'breaks'},{label:'⬅️ Назад',action:'back'}]);
    }
    function profileMenu() {
      sayUser('👤 Профиль');
      sayBot('<strong>👤 Профиль</strong><p>Что хотите сделать?</p>');
      addInline([{label:'✏️ Настроить профиль',action:'profile-edit'},{label:'🏦 Реквизиты для предоплаты',action:'payment'},{label:'🔧 Опция требуется снятие',action:'removal-setting'},{label:'⬅️ Назад',action:'back'}]);
    }
    function settingsMenu() {
      sayUser('⚙️ Настройки');
      sayBot('<strong>⚙️ Настройки бота</strong><p>Здесь можно изменить оформление бота, правила записи, уведомления и логику работы.</p><p>Выберите раздел 👇</p>');
      addInline([{label:'🎨 Оформление и информация',action:'design'},{label:'📅 Правила записи',action:'rules'},{label:'🔔 Уведомления',action:'notifications'},{label:'⚙️ Системные и доп. настройки',action:'system'},{label:'⬅️ Назад',action:'back'}]);
    }
    function scheduleView() {
      sayBot(`<strong>🗓 Расписание на 05.09.2026</strong><p>10:00 — Мария · Стрижка<br>12:30 — Анна · ${esc(booking.service)}<br>16:00 — ⭐ Свободное окно<br>18:30 — Елена · Уход</p>`);
      addInline([{label:'⭐ Показать свободные окна',action:'free'},{label:'⬅️ Назад',action:'schedule-inline'}]);
    }
    function advanced(action, title, text) {
      sayUser(title);
      sayBot(`<strong>${title}</strong><p>${text}</p>`);
      cta(true);
    }

    root.addEventListener('click', function (event) {
      const target = event.target.closest('[data-admin]');
      if (!target) return;
      interactions += 1;
      const action = target.dataset.admin;
      if (action === 'records') recordsMenu();
      else if (action === 'schedule' || action === 'schedule-inline') scheduleMenu();
      else if (action === 'profile') profileMenu();
      else if (action === 'settings') settingsMenu();
      else if (action === 'view-records') pendingRecord();
      else if (action === 'view-schedule') scheduleView();
      else if (action === 'confirm') { booking.status='confirmed'; sayBot('<strong>✅ Запись подтверждена</strong><p>Клиенту отправлено уведомление. Запись добавлена в расписание.</p>'); if (clientRoot) clientRoot.updateStatus('confirmed'); cta(false); }
      else if (action === 'reject') { booking.status='rejected'; sayBot('<strong>❌ Запись отклонена</strong><p>Клиент получил уведомление и сможет выбрать другое время.</p>'); if (clientRoot) clientRoot.updateStatus('rejected'); cta(false); }
      else if (action === 'free') { sayBot('<strong>⭐ Свободные окна</strong><p>Сегодня: 16:00<br>Завтра: 10:00, 13:30<br>6 сентября: 12:00, 18:00</p>'); cta(false); }
      else if (action === 'work-hours') { sayBot('<strong>⚙️ Рабочий график</strong><p>Пн–Сб · 10:00–20:00<br>Вс · выходной</p>'); cta(false); }
      else if (action === 'close-time' || action === 'breaks' || action === 'manual' || action === 'cancel-record' || action.indexOf('note-') === 0) cta(true);
      else if (action === 'back') sayBot('<strong>🔧 Админ-панель</strong><p>Выберите раздел в меню ниже.</p>');
      else if (action === 'admin-services') advanced(action,'✂️ Услуги','Добавляйте фото, описание, цену, длительность и стоимость бронирования.');
      else if (action === 'clients') advanced(action,'👥 Клиенты','История визитов, заметки, рассылки, сообщения и чёрный список.');
      else if (action === 'masters') advanced(action,'👩‍🎨 Мастера','Раздельные услуги, расписания и доступы сотрудников студии или салона.');
      else if (action === 'stats') advanced(action,'📊 Статистика','Выручка, загрузка, отмены, популярные услуги и повторные визиты.');
      else if (action === 'guide') advanced(action,'📖 Инструкция','Пошаговая настройка бота и запуск первой записи.');
      else cta(true);
    });

    root.setClient = function (client) { clientRoot = client; };
    root.setBooking = function (newBooking) {
      booking = newBooking;
      pendingRecord();
    };
    chat.innerHTML = botBubble('<strong>🔧 Админ-панель</strong><p>Что хотите сделать?</p>');
    pendingRecord();
    return root;
  }

  document.querySelectorAll('[data-aethel-demo-mount][data-mode="full"]').forEach(function (mount) {
    mount.innerHTML = demoMarkup();
    const admin = setupAdmin(mount.querySelector('[data-tg-phone="admin"]'));
    const client = setupClient(mount.querySelector('[data-tg-phone="client"]'), function (booking) { admin.setBooking(booking); });
    admin.setClient(client);
  });
})();
