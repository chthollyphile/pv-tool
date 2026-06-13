// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import { t } from '../i18n';
import { showToast, attachModalDismiss } from './uiHelpers';
import { encodeShareCode } from './templateStore';
import type { TemplateConfig } from './types';

export function initCopyUrlButton(
  copyUrlBtn: HTMLButtonElement,
  templateSelect: HTMLSelectElement,
  npListenToggle: HTMLInputElement,
  getCurrentConfig: () => { isCustom: boolean; config: TemplateConfig },
): void {
  copyUrlBtn.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'pv-modal-overlay';
    overlay.innerHTML = `
      <div class="pv-modal-box">
        <div class="pv-modal-body">
          <p class="pv-modal-title">${t('copy_url_settings')}</p>
          <label class="effect-toggle" style="margin-bottom:8px">
            <input type="checkbox" id="copy-url-bg-check" checked>
            <span>${t('copy_url_transparent_bg')}</span>
          </label>
          <label class="effect-toggle" style="margin-bottom:8px">
            <input type="checkbox" id="copy-url-tpl-check" checked>
            <span>${t('copy_url_use_template')}</span>
          </label>
        </div>
        <div class="pv-modal-footer">
          <button class="btn pv-modal-confirm">${t('copy_url_copy_btn')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const confirmBtn = overlay.querySelector('.pv-modal-confirm')!;
    confirmBtn.addEventListener('click', async () => {
      const bgCheck = overlay.querySelector('#copy-url-bg-check') as HTMLInputElement;
      const tplCheck = overlay.querySelector('#copy-url-tpl-check') as HTMLInputElement;

      const baseUrl = window.location.origin + window.location.pathname;
      const params = new URLSearchParams();
      params.set('panel', '0');
      if (bgCheck.checked) params.set('bg', '0');
      if (npListenToggle.checked) params.set('np', '1');

      if (tplCheck.checked) {
        const { isCustom, config } = getCurrentConfig();
        if (isCustom) {
          try {
            const code = await encodeShareCode(config);
            params.set('code', code);
          } catch (err) {
            console.warn('[PV] Encode share code failed, fallback to t=custom', err);
            params.set('t', 'custom');
          }
        } else {
          params.set('t', templateSelect.value);
        }
      }

      const url = baseUrl + '?' + params.toString();

      try { await navigator.clipboard.writeText(url); } catch { /* noop */ }
      overlay.remove();
      showToast(t('url_copied'));
    });

    attachModalDismiss(overlay);
  });
}
