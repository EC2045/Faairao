/**
 * FaaraoEngine - index.js
 * * 修正・機能追加点:
 * 1. [改善] 音節パースルール（母音単体防止）の最適化:
 * 「INI AHA」と入力された際、[I, N, I] (INI) と [A, H, A] (AHA) に美しくパースされるように調整。
 * 次のパーツが母音であっても、さらにその次が子音であれば打ち切らず、次のブロックの先頭が孤立しない場合に限り3音ブロックを許容します。
 * 2. [追加] 新しい文字パーツ「G」および「C」をサポート。
 * 3. [修正] ウムラウト (¨) 画像がグリッドシステムに干渉して右上にズレたり、横に表示される不具合を防止。
 * (img.diaeresis に対して grid-column / grid-row を強制的に auto にリセット)
 * 4. 3音表示（size-3）のとき、右上（pos-D）にある「I」「H」の文字を小さく（35px）表示。
 * 5. KU接近ルール:「K」の直後にある「U」パーツを左にスライド。
 * 6. ウムラウト (¨) のサイズを小さく配置調整。　
 * 7. CSSスタイルシートをJS側で自動生成して挿入。
 */

class FaaraoEngine {
    constructor() {
        this.baseUrl = "https://ec2045.github.io/Faairao-letters/";

        // 長いパーツを先に並べてgreedy matchを保証
        // 「G」と「C」を辞書に追加
        this.partsDictionary = [
            "SYA", "SHU", "SYO",
            "FA", "RI", "RA", 
            "A", "I", "U", "E", "O",
            "K", "S", "T", "N", "H", "M", "Y", "R", "W", "G", "C","B","D","L",":","-","—","?","!","/",",","¡","¿"
        ];

        // ウムラウト画像パス
        this.diaeresisPath = `${this.baseUrl}%C2%A8.svg`;

        // ウムバウト母音とベースとなる母音パーツの対応マップ
        this.umlautMap = {
            "Ä": "A",
            "Ï": "I",
            "Ü": "U",
            "Ë": "E",
            "Ö": "O"
        };

        // 必要なCSSスタイルを自動でドキュメントに注入
        this.injectStyles();
    }

    /**
     * 必要なレイアウトCSSを自動的に生成してheadタグに挿入します。
     */
    injectStyles() {
        if (document.getElementById('faarao-engine-styles')) return;

        const style = document.createElement('style');
        style.id = 'faarao-engine-styles';
        style.textContent = `
            /* 基本の2音以下のレイアウト (120px * 120px, 画像 60px) */
            .faarao-block {
                position: relative;
                display: inline-grid;
                grid-template-columns: 1fr 1fr;
                grid-template-rows: 1fr 1fr;
                width: 120px;
                height: 120px;
                vertical-align: middle;
                margin: 2px;
            }
            .faarao-block img {
                width: 60px;
                height: 60px;
                object-fit: contain;
                transition: transform 0.2s ease; /* 変化を滑らかに */
            }
            .faarao-block img.pos-A { grid-column: 1; grid-row: 1; }  /* 左上 */
            .faarao-block img.pos-D { grid-column: 2; grid-row: 1; }  /* 右上 */
            .faarao-block img.pos-S { grid-column: 2; grid-row: 2; }  /* 右下 (デフォルト/size-2以下向け) */

            /* ウムラウト (¨) の基本設定：大幅にサイズ縮小 (60px -> 24px) */
            /* grid-column / grid-row が pos-* クラス経由で適用されて横ズレするのを !important で防止 */
            .faarao-block img.diaeresis {
                position: absolute;
                pointer-events: none;
                width: 24px;
                height: 24px;
                grid-column: auto !important;
                grid-row: auto !important;
            }
            /* 各ポジションごとの配置微調整 (中央上部) */
            /* 左上のセル(60x60): 左右中央は (60 - 24) / 2 = 18px */
            .faarao-block img.pos-A.diaeresis { top: 2px;    left: 18px;   }
            /* 右上のセル(60x60): セル開始位置が 60px なので 60 + 18 = 78px */
            .faarao-block img.pos-D.diaeresis { top: 2px;    left: 78px;   }
            /* 右下のセル(60x60): セル開始位置が top:60px, left:60px なので top: 60+2, left: 60+18 */
            .faarao-block img.pos-S.diaeresis { top: 62px;   left: 78px;   }

            /* KUのときに「U」パーツを左（Kの方向）に引き寄せる設定 */
            /* 通常サイズ（画像60px）では15px左にずらして密着させます */
            .faarao-block img.near-K {
                transform: translateX(-15px);
            }

            /* 3音表示 (size-3) の時は文字・ブロックを一回り小さく縮小 (100px * 100px, 画像 50px) */
            .faarao-block.size-3 {
                width: 100px;
                height: 100px;
                grid-template-columns: 50px 50px;
                grid-template-rows: 50px 50px;
            }
            .faarao-block.size-3 img {
                width: 50px;
                height: 50px;
            }
            
            /* 3つ目の音（下のパーツ）を中央に寄せる設定 */
            .faarao-block.size-3 img.pos-S {
                grid-column: 1 / span 2; /* 下段の2列分を結合 */
                grid-row: 2;             /* 下段 */
                justify-self: center;    /* 横方向中央に配置 */
            }

            /* 3音用 ウムラウト (¨) サイズ調整：さらに縮小して 20px */
            .faarao-block.size-3 img.diaeresis {
                width: 20px;
                height: 20px;
            }
            /* 3音 左上のセル(50x50): 左右中央は (50 - 20) / 2 = 15px */
            .faarao-block.size-3 img.pos-A.diaeresis { top: 1px;    left: 15px; }
            /* 3音 右上のセル(50x50): 50 + 15 = 65px */
            .faarao-block.size-3 img.pos-D.diaeresis { top: 1px;    left: 65px; }
            /* 3音 下の中央寄せセル(幅100pxの中に画像50px): 画像開始位置は left: 25px。
               よって左右中央は 25 + (50 - 20) / 2 = 40px */
            .faarao-block.size-3 img.pos-S.diaeresis { top: 51px;   left: 40px; }

            /* 3音表示のとき、KUの「U」引き寄せ量を小さめのサイズ（画像50px）に合わせて12pxに変更 */
            .faarao-block.size-3 img.near-K {
                transform: translateX(-12px);
            }

            /* 3音表示の時の、右上(pos-D)の「I」および「H」をさらに小さく（35px）表示 */
            .faarao-block.size-3 img.pos-D.char-I,
            .faarao-block.size-3 img.pos-D.char-H {
                width: 35px;
                height: 35px;
                justify-self: center;
                align-self: center;
            }
            /* 「I」「H」専用に縮小されたウムラウトの位置微調整 (ウムラウトサイズを16pxまで縮小) */
            /* 画像上端は 7.5px、画像左端は 57.5px */
            /* ウムラウトの左右中央: 57.5 + (35 - 16) / 2 = 67px */
            .faarao-block.size-3 img.pos-D.char-I.diaeresis,
            .faarao-block.size-3 img.pos-D.char-H.diaeresis {
                width: 16px;
                height: 16px;
                top: 8.5px;
                left: 67px;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * テキストを解析して、パーツ名とウムラウト要否をセットにしたオブジェクトの配列（ブロック単位）に分割します。
     */
    parseText(text) {
        // 大文字化。ただし Ä, Ï, Ü, Ë, Ö は判定のためにそのまま残す。アルファベットとこれらウムラウト母音以外の文字を除去
        let cleanText = text.toUpperCase().replace(/[^A-ZÄÏÜËÖ\-:—,?! \/¡¿]/g, '');
        let parts = [];

        // --- フェーズ 1: テキストをパーツ配列に分解する ---
        while (cleanText.length > 0) {
            let matched = false;

            for (let part of this.partsDictionary) {
                let isDiaeresis = false;
                let matchLength = part.length;

                // 通常のパーツ判定
                if (cleanText.startsWith(part)) {
                    matched = true;
                } 
                // ウムラウト母音（Ä, Ï, Ü, Ë, Ö）の場合の判定
                else {
                    const firstChar = cleanText[0];
                    if (this.umlautMap[firstChar] === part) {
                        matched = true;
                        isDiaeresis = true;
                        matchLength = 1; // ウムラウト付き文字は1文字として処理
                    }
                }

                if (matched) {
                    parts.push({
                        part: part,
                        diaeresis: isDiaeresis
                    });
                    cleanText = cleanText.slice(matchLength);
                    break;
                }
            }

            // どのパーツにもマッチしなかった文字はスキップ
            if (!matched) {
                cleanText = cleanText.slice(1);
            }
        }

        // --- フェーズ 2: パーツ配列を「母音単体防止ルール」を適用しながらブロック化する ---
        const vowels = ["A", "I", "U", "E", "O"];
        let result = [];
        let currentBlock = [];

        const isVowel = (p) => p && vowels.includes(p.part);

        for (let j = 0; j < parts.length; j++) {
            const currentPart = parts[j];
            const nextPart = parts[j + 1];
            const nextNextPart = parts[j + 2];

            // 現在のブロックにすでに2パーツ入っており（currentBlock.length === 2）、
            // かつ次のパーツ（nextPart）が存在し、それが「単体母音」である場合：
            // もしそのさらに次のパーツ（nextNextPart）が存在しない、もしくはそれも「単体母音」である場合のみ、
            // 次のブロックの先頭（または全体）が単体母音だけで孤立してしまいます。
            // 逆に、さらに次が子音である場合（例: I -> N -> I -> A -> H -> A の3番目のIの時点）は、
            // 打ち切る必要はなく、[I, N, I] と [A, H, A] のように美しい3音構成に分けることができます。
            if (currentBlock.length === 2 && nextPart) {
                if (isVowel(nextPart) && (!nextNextPart || isVowel(nextNextPart))) {
                    result.push(currentBlock);
                    currentBlock = [];
                }
            }

            currentBlock.push(currentPart);

            if (currentBlock.length === 3) {
                result.push(currentBlock);
                currentBlock = [];
            }
        }

        if (currentBlock.length > 0) {
            result.push(currentBlock);
        }

        return result;
    }

    /**
     * 指定されたコンテナ要素内にファラオ文字をレンダリングします。
     */
 render(text, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    // スペースで単語に分割
    const words = text.split(' ').filter(w => w.length > 0);

    words.forEach((word, wordIdx) => {
        const blocks = this.parseText(word);

        // 単語ラッパー
        const wordDiv = document.createElement('div');
        wordDiv.className = 'faarao-word';
        wordDiv.style.cssText = 'display:inline-flex; align-items:center; margin-right:24px;';

        blocks.forEach(block => {
            const blockDiv = document.createElement('div');
            blockDiv.className = `faarao-block size-${block.length}`;

            block.forEach((item, idx) => {
                const pos = ['A', 'D', 'S'][idx];
                const part = item.part;

                const img = document.createElement('img');
                img.src = `${this.baseUrl}${part}.svg`;
                img.alt = part;
                img.className = `pos-${pos}`;

                if (part === "I" || part === "H") {
                    img.classList.add(`char-${part}`);
                }
                const prevItem = block[idx - 1];
                if (part === "U" && prevItem && prevItem.part === "K") {
                    img.classList.add('near-K');
                }

                blockDiv.appendChild(img);

                if (item.diaeresis) {
                    const dia = document.createElement('img');
                    dia.src = this.diaeresisPath;
                    dia.alt = '';
                    dia.className = `pos-${pos} diaeresis`;
                    if (part === "I" || part === "H") dia.classList.add(`char-${part}`);
                    if (part === "U" && prevItem && prevItem.part === "K") dia.classList.add('near-K');
                    blockDiv.appendChild(dia);
                }
            });

            wordDiv.appendChild(blockDiv);
        });

        container.appendChild(wordDiv);
    });
}
}

// =========================================================================
// 自動実行・監視システム
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const engine = new FaaraoEngine();

    // MutationObserver の無限ループ防止フラグ
    let isRendering = false;

    const autoRenderAll = () => {
        if (isRendering) return;
        isRendering = true;

        try {
            // id="faairao" および class="faairao" の要素をまとめて処理
            const targets = document.querySelectorAll('#faairao, .faairao');

            targets.forEach((el, index) => {
                // data-faarao-text にオリジナルテキストを保存済みか確認
                // 未保存の場合のみ textContent から取得（レンダリング前の状態）
                if (!el.dataset.faaraoText) {
                    const originalText = el.textContent.trim();
                    if (!originalText) return;
                    el.dataset.faaraoText = originalText;
                }

                // すでにレンダリング済みの場合はスキップ
                if (el.dataset.faaraoRendered === "true") return;

                // id がなければ自動採番
                if (!el.id) {
                    el.id = `faairao-auto-${index}-${Math.random().toString(36).substr(2, 9)}`;
                }

                // レンダリング実行
                engine.render(el.dataset.faaraoText, el.id);

                // レンダリング済みフラグを立てる
                el.dataset.faaraoRendered = "true";
            });
        } finally {
            isRendering = false;
        }
    };

    // 初回実行
    autoRenderAll();

    // 動的に追加された要素の監視
    const observer = new MutationObserver(() => {
        if (!isRendering) {
            autoRenderAll();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
});
