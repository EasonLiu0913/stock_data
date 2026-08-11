(() => {
  'use strict';

  const BUTTON_ID = 'predictionBackToTop';
  const STYLE_ID = 'predictionBackToTopStyle';
  const FUNDAMENTAL_SIGNAL_SCRIPT_ID = 'predictionFundamentalSignalContextScript';
  const FUNDAMENTAL_SIGNAL_SCRIPT = 'prediction-fundamental-signal-context.js?v=3';
  const EXISTING_CONTROL_SELECTOR = [
    '.to-top',
    '.back-to-top',
    '.back-to-top-button',
    '[data-back-to-top]',
    'button[aria-label="回到最上方"]',
    'a[aria-label="回到最上方"]',
  ].join(', ');
  const WRAPPER_IFRAME_SELECTOR = 'iframe#viewer, iframe.viewer';

  function installFundamentalSignalContext() {
    if (document.getElementById(FUNDAMENTAL_SIGNAL_SCRIPT_ID)) return;
    const script = document.createElement('script');
    script.id = FUNDAMENTAL_SIGNAL_SCRIPT_ID;
    script.src = FUNDAMENTAL_SIGNAL_SCRIPT;
    script.defer = true;
    document.head.appendChild(script);
  }

  function install() {
    installFundamentalSignalContext();

    // Replay wrapper pages contain the real scrollable report in a nested iframe.
    // Installing a second fixed button in the wrapper creates overlapping arrows.
    if (document.querySelector(WRAPPER_IFRAME_SELECTOR)) return;
    if (document.querySelector(EXISTING_CONTROL_SELECTOR) || document.getElementById(BUTTON_ID)) return;

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        .prediction-back-to-top {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 1000;
          width: 48px;
          height: 48px;
          border: 1px solid #2f6fae;
          border-radius: 999px;
          background: #2f6fae;
          color: #fff;
          box-shadow: 0 8px 20px rgba(22, 31, 44, .18);
          cursor: pointer;
          font: 900 22px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .prediction-back-to-top:hover { background: #245985; }
        .prediction-back-to-top:focus-visible {
          outline: 3px solid rgba(47, 111, 174, .32);
          outline-offset: 3px;
        }
        @media (max-width: 640px) {
          .prediction-back-to-top {
            right: 14px;
            bottom: 14px;
            width: 44px;
            height: 44px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = 'prediction-back-to-top';
    button.type = 'button';
    button.textContent = '↑';
    button.setAttribute('aria-label', '回到最上方');
    button.setAttribute('title', '回到最上方');
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.appendChild(button);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
