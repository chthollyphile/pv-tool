// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
//
// 主入口文件承担 UI、模板状态、分享码导入导出和 PVEngine 的连接工作。
// 这里有几类模板状态需要特别区分：
// 1. 内置模板：只需要 URL 参数 `t=` 指向模板索引。
// 2. 用户/AI 模板：配置可能包含 AI 生成的精细 effect.config，分享时必须序列化完整模板。
// 3. URL 分享模板：通过 `code=` 临时打开，不能自动写入 localStorage，避免刷新或 OBS 嵌入时制造重复模板。
// 4. Custom 编辑态：应在当前模板基础上编辑，保留已有 effect 参数；只有新增效果才回退到 catalog 默认值。

import './style.css';
import { PVEngine } from './core/engine';
import { parseLrc } from './core/lrc';
import { templates } from './templates';
import { effectCatalog } from './core/effectCatalog';
import type { TemplateConfig } from './core/types';
import { t, locale } from './i18n';
import {
  loadCustomTemplates,
  saveCustomTemplates,
  encodeShareCode,
  decodeShareCode,
} from './core/templateStore';
import { testNowPlayingConnection } from './core/nowPlayingProvider';
import { initCopyUrlButton } from './core/copyUrl';
import { generateConfigFromAI } from './core/aiService';
import { showToast, attachModalDismiss } from './core/uiHelpers';
import { initTemplateButtons, rebuildTemplateButtons } from './core/templateButtons';

console.log('%cPV Tool%c solaris:0914', 'color:#6688cc;font-weight:bold', 'color:#888');

document.title = t('page_title');

const app = document.querySelector<HTMLDivElement>('#app')!;

function tplName(tpl: TemplateConfig): string {
  if (tpl.nameKey) {
    return t(tpl.nameKey as any);
  }
  return tpl.name;
}

/**
 * 对会写入 innerHTML 的模板名做最小 HTML 转义。
 *
 * AI 生成模板名、分享码模板名和用户自定义模板名都属于外部输入。
 * 下拉框 option 目前通过字符串拼接生成，因此插入前必须转义，避免
 * `<img onerror=...>` 这类名称被浏览器当成 HTML 解析。
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]!);
}

function showModal(contentHtml: string, confirmText: string): void {
  const overlay = document.createElement('div');
  overlay.className = 'pv-modal-overlay';
  overlay.innerHTML = `
    <div class="pv-modal-box">
      <div class="pv-modal-body">${contentHtml}</div>
      <div class="pv-modal-footer">
        <button class="btn pv-modal-confirm">${confirmText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.pv-modal-confirm')!
    .addEventListener('click', () => overlay.remove());
  attachModalDismiss(overlay);
}

app.innerHTML = `
  <div class="panels-wrapper" id="panels-wrapper">
    <div class="controls">
      <details class="collapsible-section" open>
        <summary class="panel-title">${t('template')}</summary>
      <div class="control-group">
          <select id="template-select">
            ${templates.map((tp, i) => `<option value="${i}">${escapeHtml(tplName(tp))}</option>`).join('')}
            <option value="custom">${t('custom')}</option>
          </select>
          <div class="template-actions">
            <button class="btn btn-sm" id="tpl-delete" title="${t('delete_tpl')}" style="display:none">${t('delete_tpl')}</button>
            <button class="btn btn-sm" id="tpl-export" title="${t('export_code')}" style="display:none">${t('export_code')}</button>
          </div>
          <div id="tpl-delete-confirm" class="tpl-inline-input" style="display:none">
            <span class="tpl-confirm-text" id="tpl-delete-text"></span>
            <button class="btn btn-sm btn-danger" id="tpl-delete-ok">${t('delete_tpl')}</button>
            <button class="btn btn-sm" id="tpl-delete-cancel">${t('cancel')}</button>
          </div>
        </div>
      <div class="control-group">
        <label>${t('canvas_color')}</label>
        <div class="color-swatches" id="canvas-color-swatches">
          <button class="swatch swatch-active" data-color="" title="${t('follow_template')}">
            <span class="swatch-auto">A</span>
          </button>
          <button class="swatch" data-color="#ffffff" title="${t('white')}" style="background:#ffffff"></button>
          <button class="swatch" data-color="#000000" title="${t('black')}" style="background:#000000"></button>
          <button class="swatch" data-color="#1122ee" title="${t('blue')}" style="background:#1122ee"></button>
          <button class="swatch" data-color="#8b1a1a" title="${t('red')}" style="background:#8b1a1a"></button>
          <button class="swatch" data-color="#EEDD11" title="${t('yellow')}" style="background:#EEDD11"></button>
          <button class="swatch" data-color="#f5c6d0" title="${t('pink')}" style="background:#f5c6d0"></button>
          <button class="swatch" data-color="#ED1C24" title="${t('p5red')}" style="background:#ED1C24"></button>
          <button class="swatch" data-color="#ABC5D2" title="${t('light_blue')}" style="background:#ABC5D2"></button>
        </div>
      </div>

      <div class="control-group">
        <label>${t('text_label')}</label>
        <textarea id="text-input" rows="1" placeholder="深夜東京/の6畳半夢">深夜東京/の6畳半夢/を見てた/灯りの灯らない蛍光灯/明日には消えてる電脳城/に/開幕戦/打ち上げて/いなくなんないよね/ここには誰もいない/ここには誰もいないから</textarea>
      </div>

      <div class="control-group">
        <label>${t('seg_duration')} <span id="seg-val">3.0s</span></label>
        <input type="range" id="seg-slider" min="1" max="10" step="0.5" value="3">
      </div>

      <div class="control-group">
        <label>${t('anim_speed')} <span id="speed-val">2.0x</span></label>
        <input type="range" id="speed-slider" min="0" max="4" step="0.1" value="2">
      </div>

      <div class="control-group">
        <label>${t('motion_intensity')} <span id="motion-val">1.0x</span></label>
        <input type="range" id="motion-slider" min="0" max="2" step="0.1" value="1">
      </div>

      <div class="control-group">
        <label>${t('bg_opacity')} <span id="opacity-val">100%</span></label>
        <input type="range" id="opacity-slider" min="0" max="1" step="0.05" value="1">
      </div>

      <div class="control-group">
        <label>${t('media')}</label>
        <div class="file-pick">
          <button class="btn btn-sm" id="media-pick-btn">${t('choose_file')}</button>
          <span class="file-pick-name" id="media-pick-name">${t('no_file')}</span>
          <input type="file" id="media-input" accept="image/*,video/mp4,video/webm,video/mov" hidden>
        </div>
      </div>

      <div class="control-group" id="media-mode-group" style="display:none">
        <label>${t('media_mode')}</label>
        <select id="media-mode">
          <option value="fit">${t('auto_fit')}</option>
          <option value="free">${t('free_mode')}</option>
        </select>
        <button id="media-apply" class="btn">${t('apply')}</button>
      </div>

      <div class="control-group">
        <label>${t('audio')}</label>
        <div class="file-pick">
          <button class="btn btn-sm" id="audio-pick-btn">${t('choose_file')}</button>
          <span class="file-pick-name" id="audio-pick-name">${t('no_file')}</span>
          <input type="file" id="audio-input" accept="audio/*,.mp3,.m4a,.aac,.ogg,.wav,.flac,.wma,.opus" hidden>
        </div>
      </div>

      <div class="control-group" id="audio-controls" style="display:none">
        <div class="audio-row">
          <button id="audio-toggle" class="btn">${t('pause')}</button>
          <span id="audio-status" class="audio-status">${t('playing')}</span>
        </div>
      </div>

      <div class="control-group">
        <label>LRC</label>
        <div class="file-pick">
          <button class="btn btn-sm" id="lrc-pick-btn">${t('lrc_import')}</button>
          <span class="file-pick-name" id="lrc-pick-name">${t('no_file')}</span>
          <input type="file" id="lrc-input" accept=".lrc,text/plain" hidden>
        </div>
      </div>

      <div class="control-group">
        <div class="timeline-header">
          <label>${t('timer_label')} <span id="playback-time">00:00 / 00:00</span></label>
          <button class="btn btn-sm" id="timeline-pause-btn">⏸</button>
        </div>
        <input type="range" id="seek-slider" min="0" max="1" step="0.001" value="0">
      </div>

      <div class="control-group">
        <label>${t('bpm')} <span id="bpm-val">120</span></label>
        <input type="range" id="bpm-slider" min="30" max="240" step="1" value="120">
      </div>

      <div class="control-group">
        <label>${t('beat_react')} <span id="beat-val">0.5</span></label>
        <input type="range" id="beat-slider" min="0" max="1" step="0.05" value="0.5">
      </div>
      </details>

      <div class="hide-hint" id="hide-hint">${t('hint_press')} <kbd>H</kbd> ${t('hint_hide_panels')}</div>
    </div>

    <div class="controls controls-right">
      <details class="collapsible-section" open>
        <summary class="panel-title">${t('postfx')}</summary>

        <div class="control-group">
          <label>${t('shake')} <span id="shake-val">0</span></label>
          <input type="range" id="shake-slider" min="0" max="1" step="0.05" value="0">
        </div>

        <div class="control-group">
          <label>${t('zoom')} <span id="zoom-val">0</span></label>
          <input type="range" id="zoom-slider" min="-1" max="1" step="0.05" value="0">
        </div>

        <div class="control-group">
          <label>${t('tilt')} <span id="tilt-val">0°</span></label>
          <input type="range" id="tilt-slider" min="-1" max="1" step="0.05" value="0">
        </div>

        <div class="control-group">
          <label>${t('glitch')} <span id="glitch-val">0</span></label>
          <input type="range" id="glitch-slider" min="0" max="1" step="0.05" value="0">
        </div>

        <div class="control-group">
          <label>${t('hue_shift')} <span id="hue-val">0°</span></label>
          <input type="range" id="hue-slider" min="-180" max="180" step="5" value="0">
        </div>

        <div class="control-group" id="media-pos-group" style="display:none">
          <label>${t('media_position')}</label>
          <div class="slider-row">
            <span class="slider-label">${t('offset_x')}</span>
            <input type="range" id="media-x" min="-500" max="500" step="5" value="0">
            <span id="media-x-val">0</span>
          </div>
          <div class="slider-row">
            <span class="slider-label">${t('offset_y')}</span>
            <input type="range" id="media-y" min="-500" max="500" step="5" value="0">
            <span id="media-y-val">0</span>
          </div>
          <div class="slider-row">
            <span class="slider-label">${t('scale')}</span>
            <input type="range" id="media-scale" min="0.5" max="3" step="0.05" value="1">
            <span id="media-scale-val">1.0x</span>
          </div>
        </div>
      </details>

      <details class="collapsible-section" open>
        <summary class="panel-title">${t('export')}</summary>

        <div class="control-group">
          <label class="effect-toggle">
            <input type="checkbox" id="alpha-toggle">
            <span>${t('alpha_export')}</span><span class="help-tip" data-tip="${t('alpha_tip')}">?</span>
          </label>
        </div>

        <div class="control-group rec-group">
          <button id="rec-btn" class="btn rec-btn" title="${t('rec')}">
            <span class="rec-icon"></span>
            <span id="rec-label">${t('rec')}</span>
          </button>
          <span id="rec-timer" class="rec-timer" style="display:none"></span>
        </div>
      </details>

      ${locale === 'zh' ? `
      <details class="collapsible-section" open>
        <summary class="panel-title">${t('listen')}</summary>

        <div class="control-group">
          <label class="effect-toggle">
            <input type="checkbox" id="np-listen-toggle">
            <span>${t('listen_now_playing')}</span><span class="help-tip" data-tip="${t('listen_np_tip')}">?</span>
          </label>
        </div>

        <div class="control-group copy-url-row">
          <button id="copy-url-btn" class="btn copy-url-btn" title="${t('copy_url')}">${t('copy_url')}</button><span class="help-tip" data-tip="${t('copy_url_tip')}">?</span>
        </div>
      </details>
      ` : ''}

      <details class="collapsible-section" open>
        <summary class="panel-title">${t('ai_panel')}</summary>
        <div class="control-group">
          <textarea id="ai-prompt-input" rows="3" placeholder="${t('ai_prompt_placeholder')}" style="width:100%; box-sizing:border-box; resize:vertical; padding:8px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-color); font-family:inherit;"></textarea>
          <button id="ai-generate-btn" class="btn" style="width:100%; margin-top:8px;">${t('ai_generate_btn')}</button>
        </div>
        <details class="collapsible-section" style="margin-top: 10px; border:none; padding: 0;">
          <summary class="panel-title" style="font-size: 11px; padding: 4px 0; border:none; display:flex; align-items:center;">⚙️ ${t('ai_settings')}</summary>
          <div class="control-group" style="margin-top:6px;">
            <label>${t('ai_api_key')}</label>
            <input type="password" id="ai-api-key" placeholder="sk-..." style="width:100%; box-sizing:border-box; padding:6px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-color);">
          </div>
          <div class="control-group">
            <label>${t('ai_api_url')}</label>
            <input type="text" id="ai-api-url" placeholder="https://api.deepseek.com" style="width:100%; box-sizing:border-box; padding:6px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-color);">
          </div>
          <div class="control-group">
            <label>${t('ai_api_model')}</label>
            <input type="text" id="ai-api-model" placeholder="deepseek-v4-flash" style="width:100%; box-sizing:border-box; padding:6px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-color);">
          </div>
        </details>
      </details>
    </div>

    <div class="controls controls-bottom" id="custom-panel" style="display:none">
      <details class="collapsible-section" open>
        <summary class="panel-title">${t('effects_library')}</summary>
        <div class="control-group">
          <div class="template-actions">
            <button class="btn btn-sm" id="tpl-save" title="${t('save_tpl')}">${t('save_tpl')}</button>
            <button class="btn btn-sm" id="tpl-import" title="${t('import_code')}">${t('import_code')}</button>
          </div>
        </div>
        <div class="control-group" id="tpl-save-input" style="display:none">
          <div class="tpl-inline-input">
            <input type="text" id="tpl-name-input" placeholder="${t('tpl_name_placeholder')}">
            <button class="btn btn-sm" id="tpl-save-ok">${t('confirm')}</button>
            <button class="btn btn-sm" id="tpl-save-cancel">${t('cancel')}</button>
          </div>
        </div>
        <div class="control-group" id="share-code-group" style="display:none">
          <label id="share-code-label">${t('share_code')}</label>
          <input type="text" id="share-code-text" placeholder="${t('paste_code')}">
          <div class="template-actions">
            <button class="btn btn-sm" id="share-code-ok">${t('confirm')}</button>
            <button class="btn btn-sm" id="share-code-cancel">${t('cancel')}</button>
          </div>
        </div>
        <div id="effect-grid">
        ${(() => {
          function fxKey(e: typeof effectCatalog[0]): string {
            if (e.type === 'organicBlob') return 'fx_organicBlob_' + (e.config.shape ?? 'blob');
            return 'fx_' + e.type;
          }
          const cats: Record<string, { idx: number; key: string; fallback: string }[]> = {};
          effectCatalog.forEach((e, i) => {
            (cats[e.category] ??= []).push({ idx: i, key: fxKey(e), fallback: e.label });
          });
          return Object.entries(cats).map(([cat, items]) => `
            <details class="effect-category" open>
              <summary class="effect-category-title">${t(('ecat_' + cat) as any) || cat}</summary>
              <div class="effect-grid">
                ${items.map(it => `
                  <label class="effect-toggle">
                    <input type="checkbox" data-effect-idx="${it.idx}">
                    <span>${t(it.key as any) || it.fallback}</span>
                  </label>
                `).join('')}
              </div>
            </details>
          `).join('');
        })()}
      </div>
      </details>
    </div>
  </div>

  <button class="mobile-toggle" id="mobile-toggle" title="☰">☰</button>
  <div id="pv-container"></div>

  <footer class="pv-footer" id="pv-footer">
    <span class="pv-footer-desc">${t('footer_desc')}</span>
    <span class="pv-footer-sep">·</span>
    <a href="https://github.com/DanteAlighieri13210914/pv-tool" target="_blank" rel="noopener" class="pv-footer-link">GitHub</a>
    <span class="pv-footer-sep">·</span>
    <a href="${import.meta.env.BASE_URL}contributors.html" target="_blank" class="pv-footer-link">${t('footer_contributors')}</a>
  </footer>
`;

const engine = new PVEngine();
const container = document.getElementById('pv-container')!;

engine.init(container).then(async () => {
  engine.setText('深夜東京/の6畳半夢/を見てた/灯りの灯らない蛍光灯/明日には消えてる電脳城/に/開幕戦/打ち上げて/いなくなんないよね/ここには誰もいない/ここには誰もいないから');

  const urlParams = new URLSearchParams(window.location.search);

  // URL param: code (custom template share code)
  const codeParam = urlParams.get('code');
  if (codeParam !== null) {
    try {
      const decodedTpl = await decodeShareCode(codeParam);
      // 分享链接用于“打开看看/OBS 嵌入/跨设备预览”等临时场景。
      // 因此这里只放入一个临时 shared 选项并加载到引擎，不写入
      // customTemplates/localStorage，避免每次刷新都产生一份重复模板。
      sharedUrlTemplate = cloneTemplateConfig(decodedTpl);
      rebuildTemplateSelect();
      templateSelect.value = 'shared';
      isCustomMode = false;
      customPanel.style.display = 'none';
      engine.loadTemplate(sharedUrlTemplate);
      syncCustomCheckboxes(sharedUrlTemplate);
    } catch (err) {
      console.warn('[PV] Failed to load config from URL code parameter:', err);
      engine.loadTemplate(templates[0]);
      templateSelect.value = '0';
    }
  } else {
    // URL param: t (template)
    const tParam = urlParams.get('t');
    if (tParam !== null) {
      if (tParam.startsWith('user-')) {
        const idx = parseInt(tParam.split('-')[1]);
        if (idx >= 0 && idx < customTemplates.length) {
          engine.loadTemplate(customTemplates[idx]);
          templateSelect.value = tParam;
        } else {
          engine.loadTemplate(templates[0]);
          templateSelect.value = '0';
        }
      } else {
        const idx = parseInt(tParam);
        if (!isNaN(idx) && idx >= 0 && idx < templates.length) {
          engine.loadTemplate(templates[idx]);
          templateSelect.value = String(idx);
        } else {
          engine.loadTemplate(templates[0]);
          templateSelect.value = '0';
        }
      }
    } else {
      engine.loadTemplate(templates[0]);
      templateSelect.value = '0';
    }
  }

  syncSpeedSlider();
  syncOpacitySlider();
  syncPostfxSliders();
  updateTemplateButtons();
  initTemplateButtons(templateSelect, () => customTemplates);

  // URL param: bg (transparent background)
  const bgParam = urlParams.get('bg');
  if (bgParam === '0') {
    engine.alphaMode = true;
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
  }

  // URL param: panel (hide panels)
  const panelParam = urlParams.get('panel');
  if (panelParam === '0') {
    panelsVisible = false;
    document.body.classList.add('pv-panels-hidden');
  }

  // URL param: np (Now Playing listener)
  const npParam = urlParams.get('np');
  if (npParam === '1' && npListenToggle) {
    npListenToggle.checked = true;
    npListenToggle.dispatchEvent(new Event('change'));
  }
});

// Mobile toggle
const mobileToggle = document.getElementById('mobile-toggle')!;
const panelsWrapper = document.getElementById('panels-wrapper')!;
const isMobile = window.matchMedia('(max-width: 768px)').matches;
if (isMobile) {
  panelsWrapper.classList.add('panels-hidden');
}
mobileToggle.addEventListener('click', () => {
  const hidden = panelsWrapper.classList.contains('panels-hidden');
  panelsWrapper.classList.toggle('panels-hidden', !hidden);
  mobileToggle.textContent = hidden ? '✕' : '☰';
});

// H key — toggle all panels visibility
let panelsVisible = true;
document.addEventListener('keydown', (e) => {
  // Skip when typing in input fields or when a modal is open
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (document.querySelector('.pv-modal-overlay')) return;

  if (e.key.toLowerCase() === 'h') {
    panelsVisible = !panelsVisible;
    document.body.classList.toggle('pv-panels-hidden', !panelsVisible);
  }
});

// Canvas color swatches
const swatchContainer = document.getElementById('canvas-color-swatches')!;
swatchContainer.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.swatch') as HTMLButtonElement | null;
  if (!btn) return;
  swatchContainer.querySelectorAll('.swatch').forEach(s => s.classList.remove('swatch-active'));
  btn.classList.add('swatch-active');
  const color = btn.dataset.color;
  engine.canvasColor = color || null;
});

// Template
const templateSelect = document.getElementById('template-select') as HTMLSelectElement;
const customPanel = document.getElementById('custom-panel')!;
const effectGrid = document.getElementById('effect-grid')!;

let isCustomMode = false;
let customTemplates = loadCustomTemplates();
let sharedUrlTemplate: TemplateConfig | null = null;

/**
 * JSON 结构深拷贝工具。
 *
 * TemplateConfig/EffectEntry 当前只包含纯 JSON 数据，适合用这种方式克隆。
 * 复制模板快照时不要保留原对象引用，否则后续 Custom 重建、保存或分享
 * 可能意外改到当前引擎正在使用的模板对象。
 */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 克隆完整模板配置。
 *
 * 单独封装一层，让调用处明确表达“这里需要模板级快照”。
 */
function cloneTemplateConfig(template: TemplateConfig): TemplateConfig {
  return cloneJson(template);
}

/**
 * 从模板基底生成“当前运行态快照”。
 *
 * 模板对象保存的是初始配置，而 UI slider 和播放面板会在运行时修改
 * engine 上的 bpm、animationSpeed、bgOpacity、postfx 等字段。保存、
 * 导出分享码或复制 URL 时，用户期望拿到的是屏幕上正在看的效果，
 * 所以这里以模板为基底，再用 engine 当前值覆盖这些运行态参数。
 */
function buildRuntimeTemplateSnapshot(base: TemplateConfig, name = base.name): TemplateConfig {
  const snapshot = cloneTemplateConfig(base);
  snapshot.name = name;
  snapshot.bpm = engine.beat.bpm;
  snapshot.animationSpeed = engine.animationSpeed;
  snapshot.bgOpacity = engine.effectOpacity;
  snapshot.postfx = {
    shake: engine.shake,
    zoom: engine.zoom,
    tilt: engine.tilt,
    glitch: engine.glitch,
    hueShift: engine.hueShift
  };
  return snapshot;
}

/**
 * 根据 Custom 面板的勾选状态生成自定义模板。
 *
 * 关键点：不能简单地按 checkbox 从 effectCatalog 重建所有效果。
 * AI 生成模板和分享模板往往会在 effect.config 里写入颜色、透明度、
 * 速度、形态等细节参数；如果切到 Custom 就全部套回 catalog 默认值，
 * 画面会明显变样。这里先把当前模板已有 effects 建成可消费的池子，
 * 勾选项命中已有 effect 时复用其完整 config；只有新增勾选的效果
 * 才使用 catalog preset 默认配置。
 */
function buildCustomTemplate(): TemplateConfig {
  const curTpl = engine.currentTemplateConfig;
  const existingEffects = new Map<string, TemplateConfig['effects']>();
  curTpl?.effects.forEach((effect) => {
    const key = effectSelectionKey(effect);
    const pool = existingEffects.get(key) ?? [];
    pool.push(cloneJson(effect));
    existingEffects.set(key, pool);
  });

  const checks = effectGrid.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const effects: TemplateConfig['effects'] = [];
  checks.forEach((cb) => {
    if (cb.checked) {
      const idx = parseInt(cb.dataset.effectIdx!);
      const preset = effectCatalog[idx];
      const existingPool = existingEffects.get(effectSelectionKey(preset));
      const existing = existingPool?.shift();
      effects.push(existing ?? { type: preset.type, layer: preset.layer, config: { ...preset.config } });
    }
  });

  const template = curTpl
    ? buildRuntimeTemplateSnapshot(curTpl, 'Custom')
    : {
      name: 'Custom',
      palette: {
        background: '#ffffff',
        primary: '#000000',
        secondary: '#888888',
        accent: '#ff3366',
        text: '#000000',
      },
      effects,
      bpm: engine.beat.bpm,
      animationSpeed: engine.animationSpeed,
      bgOpacity: engine.effectOpacity,
      postfx: {
        shake: engine.shake,
        zoom: engine.zoom,
        tilt: engine.tilt,
        glitch: engine.glitch,
        hueShift: engine.hueShift
      },
    };
  template.effects = effects;
  return template;
}

function syncSpeedSlider() {
  const v = engine.animationSpeed;
  speedSlider.value = String(v);
  speedVal.textContent = `${v.toFixed(1)}x`;
}

function syncOpacitySlider() {
  const v = engine.effectOpacity;
  opacitySlider.value = String(v);
  opacityVal.textContent = `${Math.round(v * 100)}%`;
}

function syncPostfxSliders() {
  const sk = document.getElementById('shake-slider') as HTMLInputElement;
  const sv = document.getElementById('shake-val')!;
  const zm = document.getElementById('zoom-slider') as HTMLInputElement;
  const zv = document.getElementById('zoom-val')!;
  const tl = document.getElementById('tilt-slider') as HTMLInputElement;
  const tv = document.getElementById('tilt-val')!;
  const gl = document.getElementById('glitch-slider') as HTMLInputElement;
  const gv = document.getElementById('glitch-val')!;
  const hu = document.getElementById('hue-slider') as HTMLInputElement;
  const hv = document.getElementById('hue-val')!;
  sk.value = String(engine.shake); sv.textContent = engine.shake.toFixed(2);
  zm.value = String(engine.zoom); zv.textContent = engine.zoom.toFixed(2);
  tl.value = String(engine.tilt); tv.textContent = `${(engine.tilt * 17.2).toFixed(0)}°`;
  gl.value = String(engine.glitch); gv.textContent = engine.glitch.toFixed(2);
  hu.value = String(engine.hueShift); hv.textContent = `${engine.hueShift.toFixed(0)}°`;
}

/**
 * 根据模板配置同步 Custom 面板的 checkbox。
 *
 * 大多数效果用 type 就能唯一识别；organicBlob 在 catalog 中有 blob/wave/cloud
 * 多个同 type 变体，因此需要 effectSelectionKey 把 shape 也纳入匹配，
 * 否则加载其中一个变体时会把同 type 的其它变体也误勾选。
 */
function syncCustomCheckboxes(config: TemplateConfig) {
  const checks = effectGrid.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const configKeys = new Set(config.effects.map(effectSelectionKey));
  checks.forEach((cb) => {
    const idx = parseInt(cb.dataset.effectIdx!);
    const preset = effectCatalog[idx];
    cb.checked = configKeys.has(effectSelectionKey(preset));
  });
}

/**
 * 生成 Custom 面板和模板配置之间的稳定匹配 key。
 *
 * 这个 key 只用于判断“UI 勾选项是否对应同一个 catalog 预设”。
 */
function effectSelectionKey(entry: Pick<TemplateConfig['effects'][number], 'type' | 'config'>): string {
  if (entry.type === 'organicBlob') {
    return `${entry.type}:${entry.config?.shape ?? 'blob'}`;
  }
  return entry.type;
}

/**
 * 提供给复制 URL 功能的当前模板快照。
 *
 * 内置模板可以继续用 `t=` 短链接；用户模板、AI 模板、临时 shared 模板
 * 必须走完整 `code=`，否则对方机器没有对应的 localStorage 模板，或会丢掉
 * AI 生成的精细 effect.config。Custom 编辑态则直接按当前勾选和运行态生成。
 */
function getCurrentTemplateSnapshot(): { isCustom: boolean; config: TemplateConfig } {
  const val = templateSelect.value;
  if (isCustomMode || val === 'custom') {
    return { isCustom: true, config: buildCustomTemplate() };
  }
  if (val === 'shared' && sharedUrlTemplate) {
    return { isCustom: true, config: buildRuntimeTemplateSnapshot(sharedUrlTemplate) };
  }
  if (val.startsWith('user-')) {
    const idx = parseInt(val.split('-')[1]);
    const config = customTemplates[idx] ?? engine.currentTemplateConfig ?? templates[0];
    return { isCustom: true, config: buildRuntimeTemplateSnapshot(config) };
  }
  const idx = parseInt(val);
  const config = !isNaN(idx) && idx >= 0 && idx < templates.length
    ? templates[idx]
    : engine.currentTemplateConfig ?? templates[0];
  return { isCustom: false, config: buildRuntimeTemplateSnapshot(config) };
}

const syncChannel = new BroadcastChannel('pv-tool-sync');

templateSelect.addEventListener('change', () => {
  const val = templateSelect.value;
  if (val === 'custom') {
    isCustomMode = true;
    customPanel.style.display = '';
    engine.loadTemplate(buildCustomTemplate());
  } else if (val === 'shared' && sharedUrlTemplate) {
    isCustomMode = false;
    customPanel.style.display = 'none';
    engine.loadTemplate(sharedUrlTemplate);
    syncCustomCheckboxes(sharedUrlTemplate);
    syncSpeedSlider();
    syncOpacitySlider();
    syncPostfxSliders();
  } else if (val.startsWith('user-')) {
    isCustomMode = false;
    customPanel.style.display = 'none';
    const idx = parseInt(val.split('-')[1]);
    const config = customTemplates[idx];
    engine.loadTemplate(config);
    syncCustomCheckboxes(config);
    syncSpeedSlider();
    syncPostfxSliders();
  } else {
    isCustomMode = false;
    customPanel.style.display = 'none';
    const config = templates[parseInt(val)];
    engine.loadTemplate(config);
    syncCustomCheckboxes(config);
    syncSpeedSlider();
    syncOpacitySlider();
    syncPostfxSliders();
  }
  updateTemplateButtons();
  if (val !== 'custom') {
    syncChannel.postMessage({ type: 'template', value: val });
  }
});

syncChannel.addEventListener('message', (ev) => {
  const { type, value } = ev.data;
  if (type !== 'template' || value === 'custom') return;
  if (value === 'shared') {
    if (sharedUrlTemplate) {
      engine.loadTemplate(sharedUrlTemplate);
      syncCustomCheckboxes(sharedUrlTemplate);
      templateSelect.value = value;
    }
  } else if (value.startsWith('user-')) {
    const idx = parseInt(value.split('-')[1]);
    if (idx >= 0 && idx < customTemplates.length) {
      const config = customTemplates[idx];
      engine.loadTemplate(config);
      syncCustomCheckboxes(config);
      templateSelect.value = value;
    }
  } else {
    const idx = parseInt(value);
    if (!isNaN(idx) && idx >= 0 && idx < templates.length) {
      const config = templates[idx];
      engine.loadTemplate(config);
      syncCustomCheckboxes(config);
      templateSelect.value = String(idx);
    }
  }
  isCustomMode = false;
  customPanel.style.display = 'none';
  syncSpeedSlider();
  syncOpacitySlider();
  syncPostfxSliders();
  updateTemplateButtons();
});

function rebuildTemplateSelect() {
  // 下拉框会展示用户输入/AI 输出/分享码里的模板名，统一转义后再拼 HTML。
  const builtInHtml = templates.map((tp, i) => `<option value="${i}">${escapeHtml(tplName(tp))}</option>`).join('');
  const customHtml = customTemplates.map((tp, i) =>
    `<option value="user-${i}">⭐ ${escapeHtml(tp.name)}</option>`
  ).join('');
  const sharedHtml = sharedUrlTemplate
    ? `<option value="shared">↗ ${escapeHtml(sharedUrlTemplate.name)}</option>`
    : '';
  templateSelect.innerHTML = builtInHtml + customHtml + sharedHtml + `<option value="custom">${t('custom')}</option>`;
  rebuildTemplateButtons();
}

function updateTemplateButtons() {
  const val = templateSelect.value;
  const isUser = val.startsWith('user-');
  tplDeleteBtn.style.display = isUser ? '' : 'none';
  tplExportBtn.style.display = isUser ? '' : 'none';
  // Hide inline inputs when switching
  tplSaveInput.style.display = 'none';
  tplDeleteConfirm.style.display = 'none';
  rebuildTemplateButtons();
}

const tplSaveBtn = document.getElementById('tpl-save')!;
const tplDeleteBtn = document.getElementById('tpl-delete')!;
const tplExportBtn = document.getElementById('tpl-export')!;
const tplImportBtn = document.getElementById('tpl-import')!;
const tplSaveInput = document.getElementById('tpl-save-input')!;
const tplNameInput = document.getElementById('tpl-name-input') as HTMLInputElement;
const tplSaveOk = document.getElementById('tpl-save-ok')!;
const tplSaveCancel = document.getElementById('tpl-save-cancel')!;
const tplDeleteConfirm = document.getElementById('tpl-delete-confirm')!;
const tplDeleteText = document.getElementById('tpl-delete-text')!;
const tplDeleteOk = document.getElementById('tpl-delete-ok')!;
const tplDeleteCancel = document.getElementById('tpl-delete-cancel')!;
const shareCodeGroup = document.getElementById('share-code-group')!;
const shareCodeLabel = document.getElementById('share-code-label')!;
const shareCodeText = document.getElementById('share-code-text') as HTMLInputElement;
const shareCodeOk = document.getElementById('share-code-ok')!;
const shareCodeCancel = document.getElementById('share-code-cancel')!;


// Save: show inline name input
tplSaveBtn.addEventListener('click', () => {
  tplSaveInput.style.display = '';
  tplNameInput.value = '';
  tplNameInput.focus();
});

tplSaveCancel.addEventListener('click', () => {
  tplSaveInput.style.display = 'none';
});

function doSave() {
  const name = tplNameInput.value.trim();
  if (!name) return;
  // 保存 Custom 时保留当前模板已有 effect.config，同时覆盖运行态 slider 参数。
  // 这保证“保存后再选择该用户模板”看到的就是保存瞬间的画面。
  const tpl = { ...buildCustomTemplate(), name };
  customTemplates.push(tpl);
  saveCustomTemplates(customTemplates);
  rebuildTemplateSelect();
  templateSelect.value = `user-${customTemplates.length - 1}`;
  isCustomMode = false;
  customPanel.style.display = 'none';
  engine.loadTemplate(tpl);
  updateTemplateButtons();
  syncSpeedSlider();
  syncOpacitySlider();
  syncPostfxSliders();
}

tplSaveOk.addEventListener('click', doSave);
tplNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSave();
  if (e.key === 'Escape') tplSaveInput.style.display = 'none';
});

// Delete: show inline confirmation
tplDeleteBtn.addEventListener('click', () => {
  const val = templateSelect.value;
  if (!val.startsWith('user-')) return;
  const idx = parseInt(val.split('-')[1]);
  tplDeleteText.textContent = `${t('confirm_delete')} "${customTemplates[idx].name}"？`;
  tplDeleteConfirm.style.display = '';
});

tplDeleteCancel.addEventListener('click', () => {
  tplDeleteConfirm.style.display = 'none';
});

tplDeleteOk.addEventListener('click', () => {
  const val = templateSelect.value;
  if (!val.startsWith('user-')) return;
  const idx = parseInt(val.split('-')[1]);
  customTemplates.splice(idx, 1);
  saveCustomTemplates(customTemplates);
  rebuildTemplateSelect();
  templateSelect.value = '0';
  engine.loadTemplate(templates[0]);
  updateTemplateButtons();
  syncSpeedSlider();
  tplDeleteConfirm.style.display = 'none';
});

// Export share code
tplExportBtn.addEventListener('click', async () => {
  const val = templateSelect.value;
  if (!val.startsWith('user-')) return;
  const idx = parseInt(val.split('-')[1]);
  // 导出分享码时也使用运行态快照，避免用户调过速度/透明度/postfx 后导出的
  // 仍是模板初始值。
  const code = await encodeShareCode(buildRuntimeTemplateSnapshot(customTemplates[idx]));
  try { await navigator.clipboard.writeText(code); } catch { /* noop */ }
  showToast(t('code_copied'));
});

// Import share code
tplImportBtn.addEventListener('click', () => {
  shareCodeLabel.classList.remove('label-error');
  shareCodeLabel.textContent = t('import_code');
  shareCodeText.value = '';
  shareCodeText.readOnly = false;
  shareCodeOk.textContent = t('import_btn');
  shareCodeGroup.style.display = '';
});

shareCodeOk.addEventListener('click', async () => {
  const code = shareCodeText.value.trim();
  if (!code) return;
  try {
    const tpl = await decodeShareCode(code);
    customTemplates.push(tpl);
    saveCustomTemplates(customTemplates);
    rebuildTemplateSelect();
    const newIdx = customTemplates.length - 1;
    templateSelect.value = `user-${newIdx}`;
    isCustomMode = false;
    customPanel.style.display = 'none';
    engine.loadTemplate(tpl);
    updateTemplateButtons();
    syncSpeedSlider();
    shareCodeGroup.style.display = 'none';
  } catch (err) {
    shareCodeLabel.textContent = t('code_invalid');
    shareCodeLabel.classList.add('label-error');
    console.warn('[PV] Share code decode failed:', err);
    return;
  }
});

shareCodeCancel.addEventListener('click', () => {
  shareCodeGroup.style.display = 'none';
});

// Rebuild select to include saved custom templates
rebuildTemplateSelect();

let customRebuildTimer: ReturnType<typeof setTimeout>;
effectGrid.addEventListener('change', () => {
  if (isCustomMode) {
    clearTimeout(customRebuildTimer);
    customRebuildTimer = setTimeout(() => {
      try {
        engine.loadTemplate(buildCustomTemplate());
      } catch (err) {
        console.warn('[PV] Custom template rebuild failed:', err);
      }
    }, 300);
  }
});

// Text input with auto-expand on focus
const textInput = document.getElementById('text-input') as HTMLTextAreaElement;

textInput.addEventListener('focus', () => {
  textInput.rows = 6;
  textInput.classList.add('text-expanded');
});

textInput.addEventListener('blur', () => {
  textInput.rows = 1;
  textInput.classList.remove('text-expanded');
});

let textTimer: ReturnType<typeof setTimeout>;

function applyTextInput(rawText: string): void {
  const hasTimestamps = /\[\d{1,2}:\d{2}/.test(rawText);
  if (hasTimestamps) {
    const parsed = parseLrc(rawText);
    if (parsed.length > 0) {
      engine.setLyricTimeline(parsed);
      return;
    }
  }

  engine.setText(rawText.replace(/\r?\n/g, '/'));
}

textInput.addEventListener('input', () => {
  clearTimeout(textTimer);
  textTimer = setTimeout(() => {
    applyTextInput(textInput.value);
  }, 400);
});

const lrcInput = document.getElementById('lrc-input') as HTMLInputElement;
const lrcPickBtn = document.getElementById('lrc-pick-btn') as HTMLButtonElement;
const lrcPickName = document.getElementById('lrc-pick-name')!;

lrcPickBtn.addEventListener('click', () => lrcInput.click());

lrcInput.addEventListener('change', async () => {
  const file = lrcInput.files?.[0];
  if (!file) return;

  lrcPickName.textContent = file.name;
  const content = await file.text();
  textInput.value = content;
  applyTextInput(content);
  lrcInput.value = '';
});

const playbackTimeEl = document.getElementById('playback-time')!;

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const seekSlider = document.getElementById('seek-slider') as HTMLInputElement;
let isSeeking = false;

seekSlider.addEventListener('mousedown', () => { isSeeking = true; });
seekSlider.addEventListener('touchstart', () => { isSeeking = true; });
seekSlider.addEventListener('input', () => {
  const total = engine.timelineDuration;
  const target = parseFloat(seekSlider.value) * total;
  engine.seek(target);
});
seekSlider.addEventListener('mouseup', () => { isSeeking = false; });
seekSlider.addEventListener('touchend', () => { isSeeking = false; });

function updatePlaybackTimer(): void {
  const current = engine.playbackTime;
  const total = engine.timelineDuration;
  playbackTimeEl.textContent = `${formatClock(current)} / ${formatClock(total)}`;
  if (!isSeeking && total > 0) {
    seekSlider.value = String(current / total);
  }
  requestAnimationFrame(updatePlaybackTimer);
}

requestAnimationFrame(updatePlaybackTimer);

const timelinePauseBtn = document.getElementById('timeline-pause-btn')!;
timelinePauseBtn.addEventListener('click', () => {
  if (engine.paused) {
    engine.resume();
    timelinePauseBtn.textContent = '⏸';
  } else {
    engine.pause();
    timelinePauseBtn.textContent = '▶';
  }
});

// Segment duration
const segSlider = document.getElementById('seg-slider') as HTMLInputElement;
const segVal = document.getElementById('seg-val')!;
segSlider.addEventListener('input', () => {
  const v = parseFloat(segSlider.value);
  engine.segmentDuration = v;
  segVal.textContent = `${v.toFixed(1)}s`;
});

// Animation speed
const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
const speedVal = document.getElementById('speed-val')!;
speedSlider.addEventListener('input', () => {
  const v = parseFloat(speedSlider.value);
  engine.animationSpeed = v;
  speedVal.textContent = `${v.toFixed(1)}x`;
});

// Motion intensity
const motionSlider = document.getElementById('motion-slider') as HTMLInputElement;
const motionVal = document.getElementById('motion-val')!;
motionSlider.addEventListener('input', () => {
  const v = parseFloat(motionSlider.value);
  engine.motionIntensity = v;
  motionVal.textContent = `${v.toFixed(1)}x`;
});

// Effect opacity
const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement;
const opacityVal = document.getElementById('opacity-val')!;
opacitySlider.addEventListener('input', () => {
  const v = parseFloat(opacitySlider.value);
  engine.effectOpacity = v;
  opacityVal.textContent = `${Math.round(v * 100)}%`;
});

// --- Post FX panel ---
const shakeSlider = document.getElementById('shake-slider') as HTMLInputElement;
const shakeVal = document.getElementById('shake-val')!;
shakeSlider.addEventListener('input', () => {
  const v = parseFloat(shakeSlider.value);
  engine.shake = v;
  shakeVal.textContent = v.toFixed(2);
});

const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement;
const zoomVal = document.getElementById('zoom-val')!;
zoomSlider.addEventListener('input', () => {
  const v = parseFloat(zoomSlider.value);
  engine.zoom = v;
  zoomVal.textContent = v.toFixed(2);
});

const tiltSlider = document.getElementById('tilt-slider') as HTMLInputElement;
const tiltVal = document.getElementById('tilt-val')!;
tiltSlider.addEventListener('input', () => {
  const v = parseFloat(tiltSlider.value);
  engine.tilt = v;
  tiltVal.textContent = `${(v * 17.2).toFixed(0)}°`;
});

const glitchSlider = document.getElementById('glitch-slider') as HTMLInputElement;
const glitchVal = document.getElementById('glitch-val')!;
glitchSlider.addEventListener('input', () => {
  const v = parseFloat(glitchSlider.value);
  engine.glitch = v;
  glitchVal.textContent = v.toFixed(2);
});

const hueSlider = document.getElementById('hue-slider') as HTMLInputElement;
const hueVal = document.getElementById('hue-val')!;
hueSlider.addEventListener('input', () => {
  const v = parseFloat(hueSlider.value);
  engine.hueShift = v;
  hueVal.textContent = `${v}°`;
});

// File pick button triggers
document.getElementById('media-pick-btn')!.addEventListener('click', () => mediaInput.click());
document.getElementById('audio-pick-btn')!.addEventListener('click', () => audioInput.click());

// Audio upload
const audioInput = document.getElementById('audio-input') as HTMLInputElement;
const audioControls = document.getElementById('audio-controls')!;
const audioToggle = document.getElementById('audio-toggle') as HTMLButtonElement;
const audioStatus = document.getElementById('audio-status')!;

audioInput.addEventListener('change', async () => {
  const file = audioInput.files?.[0];
  if (!file) return;
  document.getElementById('audio-pick-name')!.textContent = file.name;
  await engine.beat.loadAudio(file);
  audioControls.style.display = 'flex';
  audioStatus.textContent = t('playing');
  audioToggle.textContent = t('pause');
});

audioToggle.addEventListener('click', () => {
  if (engine.beat.paused) {
    engine.beat.resume();
    audioToggle.textContent = t('pause');
    audioStatus.textContent = t('playing');
  } else {
    engine.beat.pause();
    audioToggle.textContent = t('play');
    audioStatus.textContent = t('paused');
  }
});


// BPM (used when no audio is loaded)
const bpmSlider = document.getElementById('bpm-slider') as HTMLInputElement;
const bpmVal = document.getElementById('bpm-val')!;
bpmSlider.addEventListener('input', () => {
  const v = parseInt(bpmSlider.value);
  engine.beat.bpm = v;
  bpmVal.textContent = String(v);
});

// Beat reactivity
const beatSlider = document.getElementById('beat-slider') as HTMLInputElement;
const beatVal = document.getElementById('beat-val')!;
beatSlider.addEventListener('input', () => {
  const v = parseFloat(beatSlider.value);
  engine.beatReactivity = v;
  beatVal.textContent = v.toFixed(2);
});

// Media upload
const mediaInput = document.getElementById('media-input') as HTMLInputElement;
const mediaModeGroup = document.getElementById('media-mode-group')!;
const mediaModeSelect = document.getElementById('media-mode') as HTMLSelectElement;
const mediaApplyBtn = document.getElementById('media-apply')!;

let pendingFile: File | null = null;

mediaInput.addEventListener('change', () => {
  const file = mediaInput.files?.[0];
  if (file) {
    pendingFile = file;
    document.getElementById('media-pick-name')!.textContent = file.name;
    mediaModeGroup.style.display = 'flex';
  }
});

const mediaPosGroup = document.getElementById('media-pos-group')!;
const mediaXSlider = document.getElementById('media-x') as HTMLInputElement;
const mediaYSlider = document.getElementById('media-y') as HTMLInputElement;
const mediaScaleSlider = document.getElementById('media-scale') as HTMLInputElement;
const mediaXVal = document.getElementById('media-x-val')!;
const mediaYVal = document.getElementById('media-y-val')!;
const mediaScaleVal = document.getElementById('media-scale-val')!;

function resetMediaSliders() {
  mediaXSlider.value = '0';
  mediaYSlider.value = '0';
  mediaScaleSlider.value = '1';
  mediaXVal.textContent = '0';
  mediaYVal.textContent = '0';
  mediaScaleVal.textContent = '1.0x';
}

mediaXSlider.addEventListener('input', () => {
  const x = parseFloat(mediaXSlider.value);
  const y = parseFloat(mediaYSlider.value);
  mediaXVal.textContent = String(x);
  engine.setMediaOffset(x, y);
});
mediaYSlider.addEventListener('input', () => {
  const x = parseFloat(mediaXSlider.value);
  const y = parseFloat(mediaYSlider.value);
  mediaYVal.textContent = String(y);
  engine.setMediaOffset(x, y);
});
mediaScaleSlider.addEventListener('input', () => {
  const s = parseFloat(mediaScaleSlider.value);
  mediaScaleVal.textContent = `${s.toFixed(1)}x`;
  engine.setMediaScale(s);
});

mediaApplyBtn.addEventListener('click', async () => {
  if (pendingFile) {
    const mode = mediaModeSelect.value as 'fit' | 'free';
    try {
      await engine.addMedia(pendingFile, mode);
      engine.effectOpacity = 0.7;
      opacitySlider.value = '0.7';
      opacityVal.textContent = '70%';
      mediaPosGroup.style.display = 'flex';
      resetMediaSliders();
    } catch (err) {
      console.warn('[PV] Media load failed:', err);
    }
    pendingFile = null;
  }
});

// --- Alpha mode ---
const alphaToggle = document.getElementById('alpha-toggle') as HTMLInputElement;
alphaToggle.addEventListener('change', () => {
  engine.alphaMode = alphaToggle.checked;
});

// --- Now Playing & Copy URL (zh only) ---
const npListenToggle = document.getElementById('np-listen-toggle') as HTMLInputElement | null;
const copyUrlBtn = document.getElementById('copy-url-btn') as HTMLButtonElement | null;

if (copyUrlBtn && npListenToggle) {
  initCopyUrlButton(copyUrlBtn, templateSelect, npListenToggle, getCurrentTemplateSnapshot);
}

let npConnecting = false;
npListenToggle?.addEventListener('change', async () => {
  if (!npListenToggle) return;
  if (npListenToggle.checked) {
    if (npConnecting) {
      npListenToggle.checked = false;
      return;
    }
    npConnecting = true;
    const ok = await testNowPlayingConnection();
    npConnecting = false;

    if (!ok) {
      npListenToggle.checked = false;
      const npFailLink = 'https://github.com/Widdit/now-playing-service';
      showModal(
        `<p class="pv-modal-title">${t('np_fail_title')}</p>
         <p>${t('np_fail_body')}</p>
         <p><a href="${npFailLink}" target="_blank" rel="noopener">${npFailLink}</a></p>`,
        t('modal_confirm'),
      );
      return;
    }
  }
  engine.nowPlayingListening = npListenToggle.checked;
});

// --- Recording ---
const recBtn = document.getElementById('rec-btn')!;
const recLabel = document.getElementById('rec-label')!;
const recTimer = document.getElementById('rec-timer')!;

const templateSlugs = [
  'blueBold', 'kineticSplit', 'bluePlane', 'cyberGrunge', 'geometric',
  'rainCity', 'cyberpunkHud', 'emotionCinema', 'hystericNight',
  'spiderWeb', 'staggeredText', 'calmVillain', 'girlyClouds',
];

function getTemplateSlug(): string {
  const val = templateSelect.value;
  if (val === 'custom') return 'custom';
  const idx = parseInt(val);
  return templateSlugs[idx] ?? 'unknown';
}

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let recStartTime = 0;
let recTimerInterval: ReturnType<typeof setInterval> | null = null;

// PNG sequence capture for alpha mode
let pngFrameBuffer: Record<number, Blob> = {};
let pngFrameIndex = 0;
let pngCaptureRaf = 0;
let pngRecording = false;
let pngLastCaptureTime = 0;
const PNG_FPS = 30;

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function capturePngFrame(canvas: HTMLCanvasElement) {
  if (!pngRecording) return;

  const now = performance.now();
  const interval = 1000 / PNG_FPS;

  if (now - pngLastCaptureTime >= interval) {
    pngLastCaptureTime = now;
    const idx = pngFrameIndex++;
    canvas.toBlob((blob) => {
      if (blob) pngFrameBuffer[idx] = blob;
    }, 'image/png');
  }

  pngCaptureRaf = requestAnimationFrame(() => capturePngFrame(canvas));
}

async function finishPngExport(slug: string) {
  recLabel.textContent = t('packing');

  // Wait briefly for any pending toBlob callbacks to settle
  await new Promise(r => setTimeout(r, 200));

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folder = zip.folder('frames')!;
  const totalFrames = pngFrameIndex;
  for (let i = 0; i < totalFrames; i++) {
    if (pngFrameBuffer[i]) {
      folder.file(`frame_${String(i).padStart(5, '0')}.png`, pngFrameBuffer[i]);
    }
  }
  zip.file('.pv', JSON.stringify({ v: '0914', t: Date.now(), fps: PNG_FPS, f: totalFrames }));
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pv-${slug}-${PNG_FPS}fps-${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  pngFrameBuffer = {};
  pngFrameIndex = 0;
  recLabel.textContent = t('rec');
}

function showRecordingUI() {
  recBtn.classList.add('recording');
  recLabel.textContent = t('stop');
  recTimer.style.display = '';
}

function hideRecordingUI() {
  recBtn.classList.remove('recording');
  recLabel.textContent = t('rec');
  recTimer.textContent = '';
  recTimer.style.display = 'none';
}

recBtn.addEventListener('click', () => {
  const useAlpha = engine.alphaMode;
  const slug = getTemplateSlug();

  // --- Alpha mode: PNG sequence capture ---
  if (useAlpha) {
    if (pngRecording) {
      pngRecording = false;
      cancelAnimationFrame(pngCaptureRaf);
      if (recTimerInterval) { clearInterval(recTimerInterval); recTimerInterval = null; }
      hideRecordingUI();
      finishPngExport(slug);
      return;
    }

    pngFrameBuffer = {};
    pngFrameIndex = 0;
    pngLastCaptureTime = 0;
    pngRecording = true;
    recStartTime = performance.now();
    showRecordingUI();
    recTimerInterval = setInterval(() => {
      recTimer.textContent = formatTime(performance.now() - recStartTime);
    }, 500);
    capturePngFrame(engine.canvas);
    return;
  }

  // --- Normal mode: MediaRecorder ---
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }

  const canvas = engine.canvas;
  const stream = canvas.captureStream(60);

  if (engine.beat.audioContext && engine.beat.sourceNode) {
    const dest = engine.beat.audioContext.createMediaStreamDestination();
    engine.beat.sourceNode.connect(dest);
    for (const track of dest.stream.getAudioTracks()) {
      stream.addTrack(track);
    }
  }

  const mp4Supported = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1');
  const mimeType = mp4Supported
    ? 'video/mp4;codecs=avc1'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
  const ext = mp4Supported ? 'mp4' : 'webm';

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    if (recTimerInterval) { clearInterval(recTimerInterval); recTimerInterval = null; }
    hideRecordingUI();

    if (recordedChunks.length === 0) return;
    const blob = new Blob(recordedChunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pv-${slug}-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  mediaRecorder.start(100);
  recStartTime = performance.now();
  showRecordingUI();
  recTimerInterval = setInterval(() => {
    recTimer.textContent = formatTime(performance.now() - recStartTime);
  }, 500);
});

// --- Help tooltips ---
{
  let bubble: HTMLDivElement | null = null;
  const show = (el: HTMLElement) => {
    const tip = el.getAttribute('data-tip');
    if (!tip) return;
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'help-tip-bubble';
      document.body.appendChild(bubble);
    }
    bubble.textContent = tip;
    bubble.style.display = '';
    const r = el.getBoundingClientRect();
    bubble.style.left = Math.max(4, r.right - 220) + 'px';
    bubble.style.top = (r.top - bubble.offsetHeight - 6) + 'px';
  };
  const hide = () => { if (bubble) bubble.style.display = 'none'; };
  document.addEventListener('pointerenter', (e) => {
    const el = (e.target as HTMLElement).closest?.('.help-tip') as HTMLElement | null;
    if (el) show(el);
  }, true);
  document.addEventListener('pointerleave', (e) => {
    const el = (e.target as HTMLElement).closest?.('.help-tip');
    if (el) hide();
  }, true);
}

// ── AI Generation Feature Event Binding ──
(() => {
  const aiPromptInput = document.getElementById('ai-prompt-input') as HTMLTextAreaElement;
  const aiGenerateBtn = document.getElementById('ai-generate-btn') as HTMLButtonElement;
  const aiApiKey = document.getElementById('ai-api-key') as HTMLInputElement;
  const aiApiUrl = document.getElementById('ai-api-url') as HTMLInputElement;
  const aiApiModel = document.getElementById('ai-api-model') as HTMLInputElement;

  if (!aiPromptInput || !aiGenerateBtn || !aiApiKey || !aiApiUrl || !aiApiModel) return;

  // Restore configurations from LocalStorage
  aiApiKey.value = localStorage.getItem('pv-tool-ai-api-key') || '';
  aiApiUrl.value = localStorage.getItem('pv-tool-ai-api-url') || '';
  aiApiModel.value = localStorage.getItem('pv-tool-ai-api-model') || '';

  // Listen to inputs and save to LocalStorage
  aiApiKey.addEventListener('change', () => localStorage.setItem('pv-tool-ai-api-key', aiApiKey.value.trim()));
  aiApiUrl.addEventListener('change', () => localStorage.setItem('pv-tool-ai-api-url', aiApiUrl.value.trim()));
  aiApiModel.addEventListener('change', () => localStorage.setItem('pv-tool-ai-api-model', aiApiModel.value.trim()));

  aiGenerateBtn.addEventListener('click', async () => {
    const prompt = aiPromptInput.value.trim();
    const apiKey = aiApiKey.value.trim();
    const apiUrl = aiApiUrl.value.trim();
    const model = aiApiModel.value.trim();

    if (!apiKey) {
      showToast(t('ai_key_required'));
      return;
    }

    aiGenerateBtn.disabled = true;
    aiGenerateBtn.textContent = t('ai_generating');

    // Create Mesh Gradient Loader Overlay
    const loaderOverlay = document.createElement('div');
    loaderOverlay.className = 'ai-loader-overlay';
    loaderOverlay.innerHTML = `
      <div class="ai-loader-dots"></div>
      <div class="ai-loader-halo-wrapper">
        <div class="ai-loader-halo"></div>
        <div class="ai-loader-halo" style="animation-delay: 1.25s;"></div>
      </div>
      <div class="ai-loader-content">
        <div class="ai-loader-text">${t('ai_conceiving')}</div>
      </div>
    `;
    container.appendChild(loaderOverlay);

    try {
      const config = await generateConfigFromAI(prompt, apiKey, apiUrl, model);
      
      // Load generated template configuration into PV Engine
      engine.loadTemplate(config);
      
      // Push config to custom user templates list
      customTemplates.push(config);
      saveCustomTemplates(customTemplates);
      
      // Rebuild dropdown selection and select the newly created template
      rebuildTemplateSelect();
      templateSelect.value = `user-${customTemplates.length - 1}`;
      isCustomMode = false;
      customPanel.style.display = 'none';

      // Update control panel action buttons & settings sliders
      updateTemplateButtons();
      syncSpeedSlider();
      syncOpacitySlider();
      syncPostfxSliders();
      
      // Sync effect-grid checklist checkboxes
      syncCustomCheckboxes(config);

      showToast(t('ai_generate_success'));
    } catch (err) {
      console.error('[PV] AI generate config execution failed:', err);
      showToast(t('ai_generate_error'));
    } finally {
      aiGenerateBtn.disabled = false;
      aiGenerateBtn.textContent = t('ai_generate_btn');
      
      // Fade out and remove the loader overlay
      loaderOverlay.classList.add('ai-loader-fadeout');
      setTimeout(() => {
        loaderOverlay.remove();
      }, 400);
    }
  });
})();
