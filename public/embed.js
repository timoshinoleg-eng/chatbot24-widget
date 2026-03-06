(function() {
  'use strict';

  // Default configuration
  const defaultConfig = {
    position: 'bottom-right',
    primaryColor: '#14b8a6',
    apiUrl: 'https://widget.chatbot24.su',
    title: 'ChatBot24 AI',
    subtitle: 'AI-ассистент',
  };

  // Widget initialization
  window.ChatBot24Widget = {
    init: function(userConfig) {
      const config = { ...defaultConfig, ...userConfig };
      
      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.src = config.apiUrl + '/widget?color=' + encodeURIComponent(config.primaryColor);
      iframe.id = 'chatbot24-iframe';
      iframe.style.cssText = `
        position: fixed;
        ${config.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
        ${config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
        width: 400px;
        height: 600px;
        border: none;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        z-index: 9999;
        display: none;
        transition: all 0.3s ease;
        max-width: calc(100vw - 40px);
        max-height: calc(100vh - 40px);
      `;
      
      // Open button
      const button = document.createElement('button');
      button.id = 'chatbot24-button';
      button.innerHTML = '💬';
      button.style.cssText = `
        position: fixed;
        ${config.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
        ${config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: ${config.primaryColor};
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      button.onmouseover = function() {
        button.style.transform = 'scale(1.1)';
        button.style.boxShadow = '0 15px 30px -5px rgba(0, 0, 0, 0.3)';
      };
      
      button.onmouseout = function() {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.2)';
      };
      
      let isOpen = false;
      
      button.onclick = function() {
        isOpen = !isOpen;
        iframe.style.display = isOpen ? 'block' : 'none';
        button.style.display = isOpen ? 'none' : 'flex';
        
        // Notify parent if needed
        if (isOpen && config.onOpen) {
          config.onOpen();
        }
      };
      
      // Close handler from iframe
      window.addEventListener('message', function(e) {
        if (e.data === 'close-widget') {
          iframe.style.display = 'none';
          button.style.display = 'flex';
          isOpen = false;
          
          if (config.onClose) {
            config.onClose();
          }
        }
        
        // Handle lead submitted event
        if (e.data && e.data.type === 'lead-submitted') {
          if (config.onLeadSubmit) {
            config.onLeadSubmit(e.data.lead);
          }
        }
      });
      
      // Append to body when DOM is ready
      function appendWidget() {
        if (document.body) {
          document.body.appendChild(iframe);
          document.body.appendChild(button);
        } else {
          setTimeout(appendWidget, 100);
        }
      }
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', appendWidget);
      } else {
        appendWidget();
      }
      
      // API methods
      window.ChatBot24Widget.open = function() {
        iframe.style.display = 'block';
        button.style.display = 'none';
        isOpen = true;
      };
      
      window.ChatBot24Widget.close = function() {
        iframe.style.display = 'none';
        button.style.display = 'flex';
        isOpen = false;
      };
      
      window.ChatBot24Widget.toggle = function() {
        if (isOpen) {
          window.ChatBot24Widget.close();
        } else {
          window.ChatBot24Widget.open();
        }
      };
      
      window.ChatBot24Widget.isOpen = function() {
        return isOpen;
      };
    }
  };

  // Auto-init if config is present
  if (window.ChatBot24Config) {
    window.ChatBot24Widget.init(window.ChatBot24Config);
  }
})();
