// faairao.js が公開する FaaraoEngine を使ってテスト UI を初期化する
window.addEventListener('load', () => {
  const inputEl = document.getElementById('input-text');
  const renderBtn = document.getElementById('render-btn');
  const outputEl = document.getElementById('faairao-output');
  const parseDump = document.getElementById('parse-dump');
  const domDump = document.getElementById('dom-dump');
  const errBanner = document.getElementById('error-banner');
  const statusEl = document.getElementById('engine-status');
  const countEl = document.getElementById('block-count');

  if (typeof FaaraoEngine === 'undefined') {
    statusEl.textContent = '✕ FaaraoEngine not found (faairao.js 読み込み失敗?)';
    statusEl.className = 'err';
    return;
  }
  const engine = new FaaraoEngine();
  statusEl.textContent = '● FaaraoEngine (faairao.js)';
  statusEl.className = 'ok';

  const doRender = () => {
    const text = inputEl.value.trim();
    errBanner.className = 'error-banner';

    if (!text) {
      outputEl.innerHTML = '';
      outputEl.className = 'empty';
      parseDump.textContent = '—';
      domDump.textContent = '—';
      countEl.textContent = 'blocks: 0';
      return;
    }

    try {
      engine.render(text, 'faairao-output');
      const parsed = engine.parseText(text);
      parseDump.textContent = JSON.stringify(parsed, null, 2);
      countEl.textContent = `blocks: ${parsed.length}`;

      setTimeout(() => {
        const blocks = outputEl.querySelectorAll('.faarao-block');
        outputEl.classList.toggle('empty', blocks.length === 0);
        countEl.textContent = `blocks: ${blocks.length}`;

        let snap = '';
        blocks.forEach((b, i) => {
          const parts = [...b.querySelectorAll('img:not(.diaeresis)')].map(img =>
            img.src.split('/').pop().replace('.svg', '')
          );
          snap += `block[${i}]: [${parts.join(', ')}]\n`;
        });
        domDump.textContent = snap.trim() || '(no blocks)';

        const debugGrid = document.getElementById('debug-grid');
        debugGrid.innerHTML = '';
        if (blocks.length === 0) {
          debugGrid.innerHTML = '<div class="debug-card" style="color:var(--muted)">blocks: 0</div>';
          return;
        }
        blocks.forEach((b, i) => {
          const allImgs = [...b.querySelectorAll('img')];
          const card = document.createElement('div');
          card.className = 'debug-card';
          const rows = allImgs.map(img => {
            const name = img.src.split('/').pop();
            const cls = img.className;
            const isDia = img.classList.contains('diaeresis');
            const loaded = img.complete && img.naturalWidth > 0;
            const status = loaded ? '<span class="ok">✓</span>' : '<span class="err">✗ 404?</span>';
            const tag = isDia ? '<span class="warn">[¨]</span>' : '<span class="ok">[img]</span>';
            return `${tag} ${status} <b>${name}</b> <span style="color:var(--muted)">.${cls.split(' ').join('.')}</span>`;
          });
          card.innerHTML = `
            <div class="card-title">block[${i}]
              <span style="color:var(--muted);font-weight:400"> .${b.className.split(' ').join('.')}</span>
            </div>
            ${rows.join('<br>')}
            <div style="margin-top:.4rem;color:var(--muted)">img total: ${allImgs.length}</div>
          `;
          debugGrid.appendChild(card);
        });
      }, 300);

    } catch (e) {
      errBanner.textContent = '⚠ ' + e.message;
      errBanner.className = 'error-banner visible';
    }
  };

  // HTMLの oninput 属性から実行できるようにグローバルスコープへ公開
  window.doRender = doRender;

  renderBtn.addEventListener('click', doRender);
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) doRender();
  });
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inputEl.value = btn.dataset.text;
      doRender();
    });
  });
});
