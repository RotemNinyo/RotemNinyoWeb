/* <frame-player src="..." fps="60" autoplay loop> — minimal animator-style video player
   with play/pause, scrubber, mute, fullscreen. Keyboard (when focused): Space = play/pause. */
(function () {
  const ICONS = {
    play: '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 1.5 14 8 3 14.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="2.5" y="1.5" width="4" height="13" fill="currentColor"/><rect x="9.5" y="1.5" width="4" height="13" fill="currentColor"/></svg>',
    stepB: '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="1.5" y="2" width="2.5" height="12" fill="currentColor"/><path d="M14 2 5.5 8 14 14z" fill="currentColor"/></svg>',
    stepF: '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="12" y="2" width="2.5" height="12" fill="currentColor"/><path d="M2 2l8.5 6L2 14z" fill="currentColor"/></svg>',
    sndOn: '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 6h3l4-3.5v11L5 10H2z" fill="currentColor"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
    sndOff: '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 6h3l4-3.5v11L5 10H2z" fill="currentColor"/><path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" stroke-width="1.5"/></svg>',
    full: '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M1.5 6V1.5H6M10 1.5h4.5V6M14.5 10v4.5H10M6 14.5H1.5V10" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>'
  };
  class FramePlayer extends HTMLElement {
    static get observedAttributes() { return ['src']; }
    attributeChangedCallback(name, oldV, newV) {
      if (name === 'src' && this.v && newV && this.v.getAttribute('src') !== newV) { this.v.src = newV; }
    }
    connectedCallback() {
      if (this._built) return;
      this._built = true;
      this.fps = parseFloat(this.getAttribute('fps')) || 60;
      const auto = this.hasAttribute('autoplay');
      const loop = this.hasAttribute('loop');
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `
<style>
  :host { display: block; width: 100%; height: 100%; position: relative; background: #0c0d10; outline: none; }
  video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 8px;
    padding: 26px 14px 10px; box-sizing: border-box;
    background: linear-gradient(transparent, rgba(8,9,11,.85)); opacity: 0; transition: opacity .18s; }
  :host(:hover) .bar, :host(:focus) .bar, .bar.pinned { opacity: 1; }
  button { all: unset; cursor: pointer; color: #d3d7dd; width: 28px; height: 28px; border-radius: 6px;
    display: inline-flex; align-items: center; justify-content: center; }
  button:hover { color: #8ef0b6; background: rgba(255,255,255,.08); }
  .frame { font: 500 11px/1 monospace; color: #b7bcc4; letter-spacing: .04em; white-space: nowrap; min-width: 86px; text-align: center; }
  input[type=range] { flex: 1; -webkit-appearance: none; appearance: none; height: 3px; border-radius: 2px;
    background: rgba(255,255,255,.22); cursor: pointer; margin: 0; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%;
    background: #8ef0b6; border: none; }
  input[type=range]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #8ef0b6; border: none; }
  .time { font: 500 11px/1 monospace; color: #8a9099; white-space: nowrap; }
</style>
<video ${auto ? 'autoplay muted' : ''} ${loop ? 'loop' : ''} playsinline preload="auto"></video>
<div class="bar">
  <button class="play" title="Play / Pause (Space)"></button>
  <input type="range" min="0" max="0" step="1" value="0">
  <span class="time">0:00 / 0:00</span>
  <button class="mute" title="Mute / Unmute"></button>
  <button class="fs" title="Fullscreen">${ICONS.full}</button>
</div>`;
      const v = this.v = root.querySelector('video');
      v.src = this.getAttribute('src') || '';
      v.setAttribute('playsinline', '');
      if (auto) v.setAttribute('muted', '');
      this.setAttribute('tabindex', '0');
      const $ = (s) => root.querySelector(s);
      const playBtn = $('.play'), muteBtn = $('.mute'),
            range = $('input'), timeEl = $('.time'), bar = $('.bar');
      const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
      const totalF = () => Math.max(0, Math.round((v.duration || 0) * this.fps));
      const curF = () => Math.round(v.currentTime * this.fps);
      const setIcon = (el, html) => { if (el._ic !== html) { el._ic = html; el.innerHTML = html; } };
      const sync = () => {
        setIcon(playBtn, v.paused ? ICONS.play : ICONS.pause);
        setIcon(muteBtn, v.muted ? ICONS.sndOff : ICONS.sndOn);
        timeEl.textContent = `${fmt(v.currentTime || 0)} / ${fmt(v.duration || 0)}`;
        if (!this._scrubbing) range.value = curF();
        bar.classList.toggle('pinned', v.paused && v.currentTime > 0);
      };
      const toggle = () => {
        if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
        else v.pause();
      };
      v.addEventListener('loadedmetadata', () => { range.max = totalF(); sync(); });
      ['play', 'pause', 'timeupdate', 'volumechange', 'seeked'].forEach(e => v.addEventListener(e, sync));
      const raf = () => { if (!v.paused) sync(); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
      bar.addEventListener('pointerdown', (e) => e.stopPropagation());
      playBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); toggle(); });
      v.addEventListener('pointerdown', (e) => { e.stopPropagation(); toggle(); });
      muteBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); v.muted = !v.muted; });
      $('.fs').addEventListener('pointerdown', (e) => {
        e.stopPropagation(); e.preventDefault();
        if (document.fullscreenElement === this) document.exitFullscreen();
        else if (this.requestFullscreen) this.requestFullscreen();
        else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iOS Safari
      });
      range.oninput = () => { this._scrubbing = true; v.pause(); v.currentTime = range.value / this.fps; };
      range.onchange = () => { this._scrubbing = false; };
      this.addEventListener('keydown', (e) => {
        if (e.code === 'Space') { e.preventDefault(); toggle(); }
      });
      sync();
    }
  }
  if (!customElements.get('frame-player')) customElements.define('frame-player', FramePlayer);
})();
