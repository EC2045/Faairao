// ============================================================
//  定数・設定
// ============================================================
const BASE_URL = "https://ec2045.github.io/Faairao-letters/";

const ALL_PARTS = [
  "SYA", "SHU", "SYO",
  "FA", "RI", "RA",
  "A", "I", "U", "E", "O",
  "K", "S", "T", "N", "H", "M", "Y", "R", "W", "G", "C", "B"
];

// 有効なパーツ（チェックボックスで制御）
let activeParts = new Set(ALL_PARTS);

// 生成済みグリフデータ
let generatedGlyphs = []; // { name, codepoint, svgData, paths }

// キャッシュ済みSVG画像
const svgCache = {};
let loadedCount = 0;

// フォントオブジェクト
let builtFont = null;

// ============================================================
//  UI初期化
// ============================================================
const partsContainer = document.getElementById('parts-checkboxes');

ALL_PARTS.forEach(part => {
  const el = document.createElement('label');
  el.className = 'checkbox-item checked';
  el.dataset.part = part;
  el.innerHTML = `<span class="box">✓</span> ${part}<input type="checkbox" checked>`;
  el.addEventListener('click', () => {
    const checked = el.classList.toggle('checked');
    el.querySelector('.box').textContent = checked ? '✓' : '';
    if (checked) activeParts.add(part);
    else activeParts.delete(part);
  });
  partsContainer.appendChild(el);
});

// サイズチェックボックス
let enableSize = [true, true, true];
['cb-size1', 'cb-size2', 'cb-size3'].forEach((id, i) => {
  document.getElementById(id).addEventListener('click', () => {
    const el = document.getElementById(id);
    const checked = el.classList.toggle('checked');
    el.querySelector('.box').textContent = checked ? '✓' : '';
    enableSize[i] = checked;
  });
});

// タブ切り替え
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ============================================================
//  組み合わせ計算
// ============================================================
function calcCombinations() {
  const parts = [...activeParts];
  let combos = [];

  if (enableSize[0]) {
    parts.forEach(p => combos.push([p]));
  }
  if (enableSize[1]) {
    parts.forEach(p1 => parts.forEach(p2 => combos.push([p1, p2])));
  }
  if (enableSize[2]) {
    parts.forEach(p1 => parts.forEach(p2 => parts.forEach(p3 => combos.push([p1, p2, p3]))));
  }

  return combos;
}

document.getElementById('btn-all').addEventListener('click', () => {
  activeParts = new Set(ALL_PARTS);
  document.querySelectorAll('#parts-checkboxes .checkbox-item').forEach(el => {
    el.classList.add('checked');
    el.querySelector('.box').textContent = '✓';
  });
  enableSize = [true, true, true];
  ['cb-size1', 'cb-size2', 'cb-size3'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.add('checked');
    el.querySelector('.box').textContent = '✓';
  });
  document.getElementById('btn-calc').click();
});

document.getElementById('btn-calc').addEventListener('click', () => {
  const combos = calcCombinations();
  const total = combos.length;
  document.getElementById('stat-total').textContent = total.toLocaleString();
  document.getElementById('gen-summary').innerHTML =
    `<span class="badge badge-success">READY</span>&nbsp; ${total.toLocaleString()} グリフを生成します。<br>` +
    `アクティブパーツ: ${activeParts.size}個 / サイズ: ${enableSize.map((v, i) => v ? i + 1 : '').filter(Boolean).join(',')}音`;
  document.getElementById('btn-generate').disabled = false;

  // タブ移動
  document.querySelector('[data-tab="generate"]').click();
});

// ============================================================
//  SVG読み込みユーティリティ
// ============================================================
async function loadSVG(part) {
  if (svgCache[part]) return svgCache[part];
  const url = `${BASE_URL}${encodeURIComponent(part)}.svg`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(resp.status);
    const text = await resp.text();
    svgCache[part] = text;
    loadedCount++;
    document.getElementById('stat-loaded').textContent = loadedCount;
    return text;
  } catch (e) {
    svgCache[part] = null;
    return null;
  }
}

async function preloadAll() {
  const parts = [...activeParts];
  await Promise.all(parts.map(p => loadSVG(p)));
}

// ============================================================
//  SVG → Canvas描画ユーティリティ
// ============================================================

// SVGテキストを画像として返す（Blobを使わず data URL で）
function svgToDataURL(svgText) {
  const encoded = encodeURIComponent(svgText);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

// SVGをオフスクリーンキャンバスに描画してピクセルデータを返す
function drawSVGToCanvas(svgText, x, y, size, ctx) {
  return new Promise((resolve) => {
    if (!svgText) { resolve(); return; }
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, x, y, size, size);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = svgToDataURL(svgText);
  });
}

// ブロックをキャンバスに描画する
// positions: A=左上, D=右上, S=右下(2音)またはセンター下(3音)
async function renderBlockToCanvas(block, cellSize) {
  const size = block.length;
  const canvasW = size <= 2 ? cellSize * 2 : cellSize * 2;
  const canvasH = cellSize * 2;

  const canvas = new OffscreenCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  const positions = [
    [0, 0], // A: 左上
    [cellSize, 0], // D: 右上
    size === 3
      ? [cellSize / 2, cellSize] // S (3音): 中央下
      : [cellSize, cellSize] // S (2音): 右下
  ];

  for (let i = 0; i < block.length; i++) {
    const svg = svgCache[block[i]];
    if (!svg) continue;
    const [px, py] = positions[i];
    await drawSVGToCanvas(svg, px, py, cellSize, ctx);
  }

  return canvas;
}

// ============================================================
//  キャンバス → opentype.js PathData
// ============================================================

// キャンバスのアルファチャンネルからopentypeのPathを生成（シルエット抽出）
function canvasToOpentypePath(canvas, em, ascender, xOffset) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const path = new opentype.Path();

  const scaleX = em / w;
  const scaleY = (ascender) / h;  // ascenderをフルハイトに

  // 各ピクセルを小さな矩形グリフとしてopentypePathに追加
  // （高品質化のためにはベジェ変換が必要だが、まずは矩形近似）
  for (let row = 0; row < h; row++) {
    let inRun = false;
    let runStart = 0;
    for (let col = 0; col < w + 1; col++) {
      const alpha = col < w ? data[(row * w + col) * 4 + 3] : 0;
      const isOn = alpha > 64; // しきい値

      if (isOn && !inRun) {
        inRun = true;
        runStart = col;
      } else if (!isOn && inRun) {
        inRun = false;
        // 矩形を追加（フォント座標系：Y軸反転、ascenderをベースに）
        const x1 = xOffset + runStart * scaleX;
        const x2 = xOffset + col * scaleX;
        const y1 = ascender - row * scaleY;
        const y2 = ascender - (row + 1) * scaleY;

        path.moveTo(x1, y1);
        path.lineTo(x2, y1);
        path.lineTo(x2, y2);
        path.lineTo(x1, y2);
        path.close();
      }
    }
  }

  return path;
}

// ============================================================
//  フォント生成メイン
// ============================================================
function log(msg, cls = '') {
  const logEl = document.getElementById('progress-log');
  const line = document.createElement('div');
  line.className = 'line ' + cls;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function setProgress(pct) {
  document.getElementById('progress-fill').style.width = pct + '%';
}

document.getElementById('btn-generate').addEventListener('click', async () => {
  const btn = document.getElementById('btn-generate');
  btn.disabled = true;
  document.getElementById('stat-status').textContent = 'LOADING';
  document.getElementById('progress-wrap').classList.add('visible');
  document.getElementById('progress-log').innerHTML = '';
  generatedGlyphs = [];

  const em = parseInt(document.getElementById('em-size').value);
  const ascender = parseInt(document.getElementById('ascender').value);
  const descender = parseInt(document.getElementById('descender').value);

  log('▶ SVGパーツをプリロード中...', 'info');
  await preloadAll();

  const combos = calcCombinations();
  const total = combos.length;
  log(`✓ ${Object.keys(svgCache).length}パーツ読み込み完了。${total}グリフ生成開始。`, 'ok');

  document.getElementById('stat-status').textContent = 'GEN';

  const cellSize = 80; // レンダリング解像度（px）
  let codepoint = 0xE000;
  let doneCount = 0;

  const CONCURRENCY = 64; // 同時並列数

  // コンボを CONCURRENCY ずつのチャンクに分割して並列処理
  for (let i = 0; i < combos.length; i += CONCURRENCY) {
    const chunk = combos.slice(i, Math.min(i + CONCURRENCY, combos.length));

    const results = await Promise.all(chunk.map(async (block) => {
      try {
        const canvas = await renderBlockToCanvas(block, cellSize);
        const path = canvasToOpentypePath(canvas, em, ascender, 0);
        return { ok: true, block, canvas, path };
      } catch (e) {
        return { ok: false, block, error: e.message };
      }
    }));

    for (const r of results) {
      if (r.ok) {
        generatedGlyphs.push({
          name: r.block.join('_'),
          codepoint,
          block: r.block,
          canvas: r.canvas,
          path: r.path,
          advanceWidth: em
        });
        codepoint++;
      } else {
        log(`  ✗ ${r.block.join('+')} エラー: ${r.error}`, 'err');
      }
      doneCount++;
      document.getElementById('stat-generated').textContent = doneCount;
      setProgress((doneCount / total) * 100);
    }

    if (Math.floor(i / CONCURRENCY) % 10 === 0) {
      log(`  → ${doneCount}/${total} 完了`, 'ok');
    }

    // UIブロッキング回避
    await new Promise(r => setTimeout(r, 0));
  }

  log(`✓ ${doneCount}グリフ生成完了！フォントをビルド中...`, 'ok');
  document.getElementById('stat-status').textContent = 'BUILD';

  // opentypeフォントを構築
  try {
    const fontName = document.getElementById('font-name').value || 'Faarao';
    const familyName = document.getElementById('family-name').value || 'Faarao';

    const notdefGlyph = new opentype.Glyph({
      name: '.notdef',
      unicode: 0,
      advanceWidth: em,
      path: new opentype.Path()
    });

    // スペースグリフ
    const spaceGlyph = new opentype.Glyph({
      name: 'space',
      unicode: 32,
      advanceWidth: em,
      path: new opentype.Path()
    });

    const glyphs = [notdefGlyph, spaceGlyph];

    for (const g of generatedGlyphs) {
      glyphs.push(new opentype.Glyph({
        name: g.name,
        unicode: g.codepoint,
        advanceWidth: g.advanceWidth,
        path: g.path
      }));
    }

    builtFont = new opentype.Font({
      familyName: familyName,
      styleName: 'Regular',
      unitsPerEm: em,
      ascender: ascender,
      descender: descender,
      glyphs: glyphs
    });

    log(`✓ フォントビルド完了！ (${glyphs.length}グリフ)`, 'ok');
    document.getElementById('stat-status').textContent = 'READY';

    document.getElementById('btn-dl-otf').disabled = false;
    document.getElementById('btn-dl-svg').disabled = false;

    // グリフテーブル更新
    buildGlyphTable();

    log('✓ ダウンロード可能です！', 'ok');
  } catch (e) {
    log(`✗ ビルドエラー: ${e.message}`, 'err');
    document.getElementById('stat-status').textContent = 'ERROR';
  }

  btn.disabled = false;
});

// ============================================================
//  ダウンロード
// ============================================================
document.getElementById('btn-dl-otf').addEventListener('click', () => {
  if (!builtFont) return;
  const name = document.getElementById('font-name').value || 'Faarao';
  const buf = builtFont.download ? builtFont.download() : null;

  // opentype.jsのdownload()は直接ファイルを保存するので、
  // ArrayBufferを取得してBlobダウンロードに変換
  const arrayBuffer = builtFont.arrayBuffer ? builtFont.arrayBuffer() : null;
  if (arrayBuffer) {
    const blob = new Blob([arrayBuffer], { type: 'font/otf' });
    triggerDownload(blob, `${name}.otf`);
  } else {
    // fallback: opentype.jsのdownload()を使う
    builtFont.download(`${name}.otf`);
  }
});

document.getElementById('btn-dl-svg').addEventListener('click', () => {
  if (!builtFont) return;
  const name = document.getElementById('font-name').value || 'Faarao';
  const svgFont = fontToSVGFont(builtFont);
  const blob = new Blob([svgFont], { type: 'image/svg+xml' });
  triggerDownload(blob, `${name}.svg`);
});

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// SVGフォント生成
function fontToSVGFont(font) {
  const em = font.unitsPerEm;
  const asc = font.ascender;
  const desc = font.descender;
  const name = font.names.fontFamily.en || 'Faarao';

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg">
<defs>
<font id="${name}" horiz-adv-x="${em}">
<font-face
  font-family="${name}"
  units-per-em="${em}"
  ascent="${asc}"
  descent="${desc}"
/>
<missing-glyph horiz-adv-x="${em}"/>
`;

  for (const g of font.glyphs.glyphs) {
    if (!g || g.name === '.notdef') continue;
    const d = g.path.toSVG ? g.path.toSVG(2) : '';
    const uni = g.unicode ? `unicode="&#x${g.unicode.toString(16).toUpperCase()};"` : '';
    svg += `<glyph glyph-name="${g.name}" ${uni} horiz-adv-x="${g.advanceWidth}" d="${extractPathD(d)}"/>\n`;
  }

  svg += `</font>
</defs>
</svg>`;
  return svg;
}

function extractPathD(svgPath) {
  const m = svgPath.match(/d="([^"]+)"/);
  return m ? m[1] : '';
}

// ============================================================
//  グリフテーブル
// ============================================================
function buildGlyphTable() {
  const table = document.getElementById('glyph-table');
  table.innerHTML = '';
  document.getElementById('glyph-count-badge').textContent = `${generatedGlyphs.length} glyphs`;
  document.getElementById('glyph-count-badge').className = 'badge badge-success';

  // 最初の200件だけ表示（全件はとんでもない数になるので）
  const shown = generatedGlyphs.slice(0, 200);

  shown.forEach(g => {
    const cell = document.createElement('div');
    cell.className = 'glyph-cell';

    // プレビュー用小キャンバス
    const miniCanvas = document.createElement('canvas');
    miniCanvas.width = 60;
    miniCanvas.height = 60;
    const mctx = miniCanvas.getContext('2d');

    if (g.canvas) {
      mctx.drawImage(g.canvas, 0, 0, 60, 60);
    }

    const nameDiv = document.createElement('div');
    nameDiv.className = 'glyph-name';
    nameDiv.textContent = g.block.join('+');

    const cpDiv = document.createElement('div');
    cpDiv.className = 'glyph-name';
    cpDiv.textContent = `U+${g.codepoint.toString(16).toUpperCase()}`;

    cell.appendChild(miniCanvas);
    cell.appendChild(nameDiv);
    cell.appendChild(cpDiv);
    table.appendChild(cell);
  });

  if (generatedGlyphs.length > 200) {
    const more = document.createElement('div');
    more.style.cssText = 'grid-column:1/-1;color:var(--muted);font-size:0.7rem;padding:8px;';
    more.textContent = `... 他 ${generatedGlyphs.length - 200} グリフ（テーブルには200件まで表示）`;
    table.appendChild(more);
  }
}

// ============================================================
//  プレビュー
// ============================================================
document.getElementById('btn-preview').addEventListener('click', renderPreview);

async function renderPreview() {
  if (generatedGlyphs.length === 0) {
    alert('先にフォントを生成してください。');
    return;
  }

  const text = document.getElementById('preview-text').value.toUpperCase();
  const fontSize = parseInt(document.getElementById('preview-size').value);
  const canvas = document.getElementById('preview-canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = canvas.clientWidth || 800;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // テキストをパーツに分解（FaaraoEngineのparseTextと同じロジック）
  const words = text.split(' ').filter(w => w);
  let xOff = 20;
  const yOff = 20;

  for (const word of words) {
    const blocks = parseTextSimple(word);
    for (const block of blocks) {
      const key = block.join('_');
      const g = generatedGlyphs.find(g => g.name === key);
      if (g && g.canvas) {
        ctx.drawImage(g.canvas, xOff, yOff, fontSize, fontSize);
      }
      xOff += fontSize + 4;
    }
    xOff += fontSize / 2;
  }
}

// 簡易テキストパーサ（FaaraoEngineのparseTextと同等）
function parseTextSimple(text) {
  const dict = ["SYA", "SHU", "SYO", "FA", "RI", "RA", "A", "I", "U", "E", "O", "K", "S", "T", "N", "H", "M", "Y", "R", "W", "G", "C", "B"];
  let parts = [];
  let remaining = text.replace(/[^A-Z]/g, '');

  while (remaining.length > 0) {
    let matched = false;
    for (const p of dict) {
      if (remaining.startsWith(p)) {
        parts.push(p);
        remaining = remaining.slice(p.length);
        matched = true;
        break;
      }
    }
    if (!matched) remaining = remaining.slice(1);
  }

  // ブロック化
  const vowels = ["A", "I", "U", "E", "O"];
  const isVowel = p => vowels.includes(p);
  let blocks = [], cur = [];

  for (let j = 0; j < parts.length; j++) {
    const next = parts[j + 1];
    const nextnext = parts[j + 2];

    if (cur.length === 2 && next) {
      if (isVowel(next) && (!nextnext || isVowel(nextnext))) {
        blocks.push(cur);
        cur = [];
      }
    }

    cur.push(parts[j]);
    if (cur.length === 3) { blocks.push(cur); cur = []; }
  }
  if (cur.length > 0) blocks.push(cur);
  return blocks;
}
