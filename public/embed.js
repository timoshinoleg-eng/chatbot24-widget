/**
 * ChatBot24 Widget Embed Script
 * Встраивает чат-виджет на любой сайт
 * 
 * Использование:
 * <script>
 *   window.ChatBot24Config = {
 *     apiUrl: 'https://chatbot24-widget.vercel.app/api',
 *     primaryColor: '#0d9488',
 *     greeting: 'Добрый день! Чем могу помочь?',
 *     position: 'bottom-right'
 *   };
 * </script>
 * <script src="https://chatbot24-widget.vercel.app/embed.js" async></script>
 */

(function() {
  'use strict';

  // Конфигурация по умолчанию
  const defaultConfig = {
    apiUrl: 'https://chatbot24-widget.vercel.app/api',
    widgetUrl: 'https://chatbot24-widget.vercel.app',
    primaryColor: '#0d9488',
    greeting: 'Добрый день! Чем могу помочь?',
    position: 'bottom-right', // bottom-right | bottom-left
    autoOpen: false,
    openDelay: 5000, // ms перед автооткрытием
    width: '380px',
    height: '600px',
    mobileHeight: '80vh'
  };

  // Получаем конфигурацию
  const config = Object.assign({}, defaultConfig, window.ChatBot24Config || {});

  // Проверяем, не загружен ли уже виджет
  if (document.getElementById('chatbot24-widget')) {
    console.log('[ChatBot24] Widget already loaded');
    return;
  }

  // Создаём контейнер
  const container = document.createElement('div');
  container.id = 'chatbot24-widget';
  container.style.cssText = `
    position: fixed;
    z-index: 999999;
    ${config.position === 'bottom-right' ? 'right: 20px; bottom: 20px;' : 'left: 20px; bottom: 20px;'}
    display: flex;
    flex-direction: column;
    align-items: ${config.position === 'bottom-right' ? 'flex-end' : 'flex-start'};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Создаём iframe для чата
  const iframe = document.createElement('iframe');
  iframe.id = 'chatbot24-iframe';
  iframe.src = `${config.widgetUrl}/embed.html?color=${encodeURIComponent(config.primaryColor)}&greeting=${encodeURIComponent(config.greeting)}&position=${config.position}`;
  iframe.style.cssText = `
    width: ${config.width};
    height: ${config.height};
    border: none;
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
    background: white;
    display: none;
    opacity: 0;
    transform: translateY(20px) scale(0.95);
    transition: opacity 0.3s ease, transform 0.3s ease;
  `;

  // Мобильная адаптация
  if (window.innerWidth <= 480) {
    iframe.style.cssText += `
      width: calc(100vw - 40px);
      height: ${config.mobileHeight};
      position: fixed;
      ${config.position === 'bottom-right' ? 'right: 20px; left: auto;' : 'left: 20px; right: auto;'}
      bottom: 90px;
    `;
  }

  // Кнопка открытия/закрытия
  const button = document.createElement('button');
  button.id = 'chatbot24-button';
  button.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  `;
  button.style.cssText = `
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, ${config.primaryColor}, ${adjustColor(config.primaryColor, -20)});
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    margin-top: 12px;
  `;

  // Hover эффект
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = '0 6px 30px rgba(0,0,0,0.4)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
  });

  // Индикатор непрочитанных
  const badge = document.createElement('span');
  badge.id = 'chatbot24-badge';
  badge.style.cssText = `
    position: absolute;
    top: -4px;
    ${config.position === 'bottom-right' ? 'right: -4px;' : 'left: -4px;'}
    width: 20px;
    height: 20px;
    background: #ef4444;
    color: white;
    border-radius: 50%;
    font-size: 12px;
    font-weight: bold;
    display: none;
    align-items: center;
    justify-content: center;
  `;
  badge.textContent = '1';
  button.appendChild(badge);

  // Состояние виджета
  let isOpen = false;

  // Переключение виджета
  function toggleWidget() {
    isOpen = !isOpen;
    if (isOpen) {
      iframe.style.display = 'block';
      setTimeout(() => {
        iframe.style.opacity = '1';
        iframe.style.transform = 'translateY(0) scale(1)';
      }, 10);
      button.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      badge.style.display = 'none';
      // Отправляем сообщение в iframe
      iframe.contentWindow.postMessage({ type: 'CHATBOT24_OPEN' }, '*');
    } else {
      iframe.style.opacity = '0';
      iframe.style.transform = 'translateY(20px) scale(0.95)';
      setTimeout(() => {
        iframe.style.display = 'none';
      }, 300);
      button.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      // Отправляем сообщение в iframe
      iframe.contentWindow.postMessage({ type: 'CHATBOT24_CLOSE' }, '*');
    }
  }

  button.addEventListener('click', toggleWidget);

  // Добавляем элементы в DOM
  container.appendChild(iframe);
  container.appendChild(button);
  document.body.appendChild(container);

  // Автооткрытие через задержку
  if (config.autoOpen) {
    setTimeout(() => {
      if (!isOpen) toggleWidget();
    }, config.openDelay);
  }

  // Показываем badge с анимацией
  setTimeout(() => {
    badge.style.display = 'flex';
    badge.style.animation = 'chatbot24-pulse 2s infinite';
  }, 3000);

  // Добавляем CSS-анимации
  const style = document.createElement('style');
  style.textContent = `
    @keyframes chatbot24-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    @media (max-width: 480px) {
      #chatbot24-iframe {
        width: calc(100vw - 40px) !important;
        height: ${config.mobileHeight} !important;
        position: fixed !important;
        ${config.position === 'bottom-right' ? 'right: 20px !important; left: auto !important;' : 'left: 20px !important; right: auto !important;'}
        bottom: 90px !important;
      }
    }
  `;
  document.head.appendChild(style);

  // Обработка сообщений из iframe
  window.addEventListener('message', (e) => {
    if (e.data.type === 'CHATBOT24_MESSAGE') {
      // Показываем badge при новом сообщении
      if (!isOpen) {
        badge.style.display = 'flex';
        const count = parseInt(badge.textContent || '0') + 1;
        badge.textContent = count.toString();
      }
    }
  });

  // API для управления виджетом
  window.ChatBot24 = {
    open: () => { if (!isOpen) toggleWidget(); },
    close: () => { if (isOpen) toggleWidget(); },
    toggle: toggleWidget,
    config: config
  };

  console.log('[ChatBot24] Widget loaded successfully');

  // Вспомогательная функция для затемнения цвета
  function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
})();
