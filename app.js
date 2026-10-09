/* ============================================================
   My Day — Планер: вся логика приложения
   ============================================================ */

// ---------- 1. РЕГИСТРАЦИЯ SERVICE WORKER ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('[App] Service Worker зарегистрирован:', registration.scope);

        // Проверяем обновления SW
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[App] Доступна новая версия. Перезагрузите страницу.');
              // При желании: показать пользователю кнопку "Обновить"
            }
          });
        });
      })
      .catch((error) => {
        console.log('[App] Ошибка регистрации Service Worker:', error);
      });
  });
}

// ---------- 2. PWA: КНОПКА УСТАНОВКИ ----------
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'block';
});

window.addEventListener('appinstalled', () => {
  console.log('[App] Приложение установлено');
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'none';
  deferredPrompt = null;
});

function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choiceResult) => {
    console.log('[App] Выбор пользователя:', choiceResult.outcome);
    deferredPrompt = null;
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'none';
  });
}

// ---------- 3. ПРОФИЛЬ ----------
let savedPhoto = localStorage.getItem('myday_profile_photo') || '';

function updateAllAvatars() {
  const h1 = document.getElementById('headerAvatar1');
  const h2 = document.getElementById('headerAvatar2');
  const m = document.getElementById('menuAvatar');
  const modalA = document.getElementById('modalAvatar');

  const imgHTML = savedPhoto
    ? `<img src="${savedPhoto}" alt="Profile">`
    : '';

  if (h1) h1.innerHTML = imgHTML;
  if (h2) h2.innerHTML = imgHTML;
  if (m) m.innerHTML = imgHTML;

  if (modalA) {
    modalA.innerHTML = savedPhoto
      ? `<img src="${savedPhoto}" alt="Profile">`
      : '<span class="placeholder-icon">&#128247;</span>';
  }
}

function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Ограничение по размеру (2 МБ), чтобы не забивать localStorage
  if (file.size > 2 * 1024 * 1024) {
    alert('Файл слишком большой. Максимум 2 МБ.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    savedPhoto = e.target.result;
    try {
      localStorage.setItem('myday_profile_photo', savedPhoto);
      updateAllAvatars();
    } catch (err) {
      alert('Не удалось сохранить фото (хранилище переполнено).');
      console.error(err);
    }
  };
  reader.readAsDataURL(file);
}

function saveProfile() {
  const nameInput = document.getElementById('profileName');
  const name = nameInput ? nameInput.value.trim() : '';
  if (name) {
    localStorage.setItem('myday_profile_name', name);
  }
  closeModal('profileModal');
}

// ---------- 4. НАВИГАЦИЯ ПО ЭКРАНАМ ----------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const target = document.getElementById('screen-' + name);
  if (target) target.classList.add('active');

  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.classList.toggle('visible', name !== 'main');
}

// ---------- 5. МОДАЛЬНЫЕ ОКНА ----------
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// Закрытие по клику на оверлей
document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('active');
  });
});

// Закрытие по Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach((m) => {
      m.classList.remove('active');
    });
  }
});

// ---------- 6. ТАЙМЕР ----------
let timerInterval = null;
let timerSeconds = 0;

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  const display = document.getElementById('timerDisplay');
  if (display) display.textContent = `${m}:${s}`;
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  stopTimer();
  timerSeconds = 0;
  updateTimerDisplay();
}

// ---------- 7. СОБЫТИЯ ----------
let events = [];
try {
  events = JSON.parse(localStorage.getItem('myday_events') || '[]');
  if (!Array.isArray(events)) events = [];
} catch {
  events = [];
}

// Экранирование HTML, чтобы имя события не сломало разметку
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function addEvent() {
  const nameInput = document.getElementById('eventName');
  const dateInput = document.getElementById('eventDate');
  const timeInput = document.getElementById('eventTime');

  const name = nameInput.value.trim();
  const date = dateInput.value;
  const time = timeInput.value;

  if (!name) {
    alert('Please enter an event name!');
    return;
  }

  events.push({
    id: Date.now(),
    name,
    date: date || 'No date',
    time: time || 'No time',
  });

  localStorage.setItem('myday_events', JSON.stringify(events));

  nameInput.value = '';
  dateInput.value = '';
  timeInput.value = '';

  closeModal('eventModal');
  renderEvents();
}

function deleteEvent(id) {
  events = events.filter((e) => e.id !== id);
  localStorage.setItem('myday_events', JSON.stringify(events));
  renderEvents();
}

function renderEvents() {
  const list = document.getElementById('eventsList');
  if (!list) return;

  if (events.length === 0) {
    list.innerHTML = '<p style="color:#8060a0;font-style:italic;">No events yet. Add your first event!</p>';
    return;
  }

  const html = events.map((e) => `
    <div class="event-item">
      <div>
        <div class="event-name">${escapeHTML(e.name)}</div>
        <div class="event-date">
          ${escapeHTML(e.date)}${e.time && e.time !== 'No time' ? ' at ' + escapeHTML(e.time) : ''}
        </div>
      </div>
      <button class="event-delete" data-id="${e.id}" aria-label="Удалить">&#10005;</button>
    </div>
  `).join('');

  list.innerHTML = html;

  // Обработчики удаления через делегирование (безопаснее, чем inline onclick)
  list.querySelectorAll('.event-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteEvent(Number(btn.dataset.id));
    });
  });
}

// ---------- 8. СОХРАНЕНИЕ ПЛАНА ----------
function savePlan() {
  const btn = document.querySelector('.save-btn');
  if (!btn) return;

  const originalText = btn.textContent;
  const originalBg = btn.style.background;

  btn.textContent = 'Saved!';
  btn.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(150,240,150,0.7) 50%, rgba(120,220,120,0.75) 100%)';

  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.background = originalBg;
  }, 1500);
}

// ---------- 9. ИНИЦИАЛИЗАЦИЯ ----------
document.addEventListener('DOMContentLoaded', () => {
  // Профиль
  const savedName = localStorage.getItem('myday_profile_name');
  const nameInput = document.getElementById('profileName');
  if (savedName && nameInput) nameInput.value = savedName;

  updateAllAvatars();
  renderEvents();
  updateTimerDisplay();

  // Кнопка установки PWA
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', installPWA);
  }

  // Проверка query-параметров (для shortcuts из манифеста)
  const params = new URLSearchParams(location.search);
  const screen = params.get('screen');
  if (screen === 'plan') {
    showScreen('plan');
  } else if (screen === 'timer') {
    openModal('timerModal');
  }
});