//* game.js
    仮素材はSVGデータURIを使ってるので、そのまますぐに動きます。
    後で images/xxx.png を作って差し替えてください（下に手順あり）。
    ★スマホで音を鳴らすための「タップしてスタート」処理と、背景10枚分に対応済★
*/

(() => {
  // --- 設定（あとでいじれる） ---
  const WIDTH = 1280, HEIGHT = 720;
  const PROB_FART = 0.6; // おなら確率（0〜1）
  const SCORE_CORRECT = 10;
  const SCORE_PENALTY = 5;

  // --- 要素 ---
  const gameRoot = document.getElementById('game-root'); // ★ゲーム全体をタップ対象に
  const bg = document.getElementById('bg');
  const character = document.getElementById('character');
  const effect = document.getElementById('effect');
  const centerText = document.getElementById('center-text');
  const btnFart = document.getElementById('btn-fart');
  const btnToilet = document.getElementById('btn-toilet');
  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('highscore');
  const msgEl = document.getElementById('msg');
  const restartBtn = document.getElementById('btn-restart');

  // --- 仮SVG素材（デフォルト） ---
  // → 後で images/your.png に差し替える方法は下に記載。
  const placeholderSVG = (w, h, bgColor, text) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
      <rect width='100%' height='100%' fill='${bgColor}'/>
      <text x='50%' y='50%' font-size='28' fill='#222' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif'>${text}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  const backgrounds = [
    placeholderSVG(1280,720,'#f7f3d9','教室（仮）'),
    placeholderSVG(1280,720,'#d9f7f3','電車（仮）'),
    placeholderSVG(1280,720,'#f3d9f7','友達の家（仮）'),
    placeholderSVG(1280,720,'#e9e9e9','デート（仮）'),
    placeholderSVG(1280,720,'#fbe2d8','コンビニ前（仮）'),
    placeholderSVG(1280,720,'#dff0d8','試験中（仮）'),
    placeholderSVG(1280,720,'#d8e9fb','トイレ（仮）'),
    placeholderSVG(1280,720,'#f0d8e9','商店街（仮）'),
    placeholderSVG(1280,720,'#efe6d6','スタジオ（仮）'),
    placeholderSVG(1280,720,'#d6efe6','夜の道（仮）')
  ];

  const imgs = {
    pain: placeholderSVG(420,420,'#ffe5d9','ギュルルル・・・・お腹が痛い'),
    strain: placeholderSVG(420,420,'#fff0b3','ドキドキ・・・'),
    toilet: placeholderSVG(420,420,'#dff7ff','フンっっ！'),
    safePop: placeholderSVG(300,120,'#c2f0c2','セーフ'),
    outPop: placeholderSVG(300,120,'#f0c2c2','アウト'),
    brownExplode: placeholderSVG(700,200,'#b07a39','ぶちぶちブリブリピシャァ〜〜〜！残念。ゲームオーバー')
  };

// AudioContextを定義
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let soundsLoaded = false; 

  // --- 音源（ファイル読み込み設定） ---
const SOUND_PATHS = {
  fart: 'sounds/fart.mp3',      // おなら音
  diarrhea: 'sounds/diarrhea.mp3', // 下痢音
  success: 'sounds/success.mp3',   // 成功音
  fail: 'sounds/fail.mp3',      // 失敗音
  rumble: 'sounds/rumble.mp3'    // ギュルルル音
};
const soundBuffers = {};

// ファイルを非同期で読み込み、デコードする関数
async function loadSound(name, url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        soundBuffers[name] = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.error(`Error loading sound ${name}:`, e);
    }
}

// 読み込まれたバッファを再生する汎用関数
function playSound(name) {
    if (audioCtx.state === 'suspended') audioCtx.resume(); 

    const buffer = soundBuffers[name];
    if (!buffer) return;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
}

// 全ての音源をロードする（ゲーム開始前に実行）
async function loadAllSounds() {
    const loadPromises = Object.entries(SOUND_PATHS).map(([name, path]) => loadSound(name, path));
    await Promise.all(loadPromises);
    soundsLoaded = true; 
}

// --- 新しい音源再生関数（既存の関数名を流用） ---
function seFart() { playSound('fart'); }
function seDiarrhea() { playSound('diarrhea'); }
function seSuccess(){ playSound('success'); }
function seFail(){ playSound('fail'); }

// ギュルルル音を鳴らす関数を追加
function seRumble() { playSound('rumble'); }

  // --- ゲーム状態 ---
  let score = 0;
  let highscore = Number(localStorage.getItem('poop_high') || 0);
  let locked = true;
  let currentIsFart = true; // 真＝おなら, 偽＝下痢

// ★ここからスタート画面処理★
function showStartScreen() {
    centerText.textContent = '画面をタップしてスタート';
    character.src = imgs.pain;
    btnFart.style.display = 'none';
    btnToilet.style.display = 'none';
    restartBtn.style.display = 'none';
    
    // 最初のタップを待つ
    gameRoot.addEventListener('click', startSequence, { once: true });
}

async function startSequence() {
    centerText.textContent = '音源を読み込み中...';
    // 音源の読み込みとオーディオコンテキストの有効化
    await loadAllSounds(); 
    
    centerText.textContent = 'ぎゅルルル……';
    btnFart.style.display = 'inline-block';
    btnToilet.style.display = 'inline-block';
    initUI();
}
// ★ここまでスタート画面処理★

  // 初期表示
  function initUI(){
    bg.src = backgrounds[Math.floor(Math.random()*backgrounds.length)];
    character.src = imgs.pain;
    effect.classList.add('hidden');
    scoreEl.textContent = score;
    highEl.textContent = highscore;
    msgEl.textContent = '';
    restartBtn.style.display = 'none';
    locked = true;
    // small delayでチャンス表示
    setTimeout(() => {
      spawnChance();
    }, 900);
  }

  // チャンスを生成
  function spawnChance(){
    // 決定（確率）
    currentIsFart = Math.random() < PROB_FART;
    // テキストをちょっと変える
    centerText.textContent = 'おならかな？下痢かな？';
    // enable buttons
    locked = false;
    // キャラは痛い
    character.src = imgs.pain;
    // play a small rumble音 
    seRumble();
  }

  // 判定処理
  function handleChoice(choseToFart){
    if (locked) return;
    locked = true;

    // ビジュアル変化：力む or トイレ
    if (choseToFart){
      character.src = imgs.strain;
    } else {
      character.src = imgs.toilet;
    }

    // 判定タイミング（ちょっと演出の間）
    setTimeout(() => {
      if (currentIsFart && choseToFart){
        // 正解（おなら当て）
        seFart(); seSuccess();
        score += SCORE_CORRECT;
        showEffect('safe');
        centerText.textContent = 'ぷすぅ〜 おならだった。セーフ！ +'+SCORE_CORRECT;
        continueRound();
      } else if (!currentIsFart && !choseToFart){
        // 正解（下痢でトイレに行った）
        seDiarrhea(); seSuccess();
        score += SCORE_CORRECT;
        showEffect('safe');
        centerText.textContent = 'ジャーッ トイレに間に合った。セーフ！ +'+SCORE_CORRECT;
        continueRound();
      } else if (!currentIsFart && choseToFart){
        // 致命的ミス：おならしたら下痢だった → 漏らしてゲームオーバー
        seDiarrhea(); seFail();
        showEffect('out', true);
        centerText.textContent = 'ブリブリピシャァ〜〜〜！下痢を漏らした。ゲームオーバー';
        gameOver();
      } else if (currentIsFart && !choseToFart){
        // トイレでおならしてしまった → マイナス
        seFart(); seFail();
        score = Math.max(0, score - SCORE_PENALTY);
        showEffect('penalty');
        centerText.textContent = 'おならだった -'+SCORE_PENALTY;
        continueRound();
      }
      scoreEl.textContent = score;
    }, 450);
  }

  function showEffect(type, showBrown=false){
    effect.classList.remove('hidden');
    if (type === 'safe'){
      effect.src = imgs.safePop;
      effect.classList.remove('effect-out');
      effect.classList.add('effect-safe');
      setTimeout(()=> effect.classList.add('hidden'),700);
    } else if (type === 'out'){
      effect.src = imgs.outPop;
      effect.classList.remove('effect-safe');
      effect.classList.add('effect-out');
      setTimeout(()=> effect.classList.add('hidden'),900);
      // ブラウン爆発風の要素をつくって一瞬表示
      const be = document.createElement('div');
      be.className = 'brown-explode visible';
      document.getElementById('stage').appendChild(be);
      setTimeout(()=> { be.classList.remove('visible'); be.remove(); }, 900);
    } else if (type === 'penalty'){
      effect.src = imgs.outPop;
      effect.classList.add('effect-out');
      setTimeout(()=> effect.classList.add('hidden'),700);
    }
  }

  // 続行 or 次ラウンド
  function continueRound(){
    // 少し間をあけて次の背景or同背景で続ける
    setTimeout(()=> {
      // ランダムで背景を変える確率（ここでは50%で変える）
      if (Math.random() < 0.5) bg.src = backgrounds[Math.floor(Math.random()*backgrounds.length)];
      // 次のチャンスまで少し待つ
      centerText.textContent = 'next';
      setTimeout(()=> {
        // spawn new chance
        spawnChance();
      }, 800);
    }, 700);
  }

  function gameOver(){
    // 保存
    if (score > highscore){
      highscore = score;
      localStorage.setItem('poop_high', highscore);
      highEl.textContent = highscore;
    }
    // 表示とリスタート
    restartBtn.style.display = 'inline-block';
    msgEl.textContent = `最終スコア：${score}`;
    // lock buttons
    locked = true;
  }

  // イベント登録
  btnFart.addEventListener('click', () => {
    handleChoice(true);
  });
  btnToilet.addEventListener('click', () => {
    handleChoice(false);
  });
  restartBtn.addEventListener('click', () => {
    score = 0;
    scoreEl.textContent = score;
    msgEl.textContent = '';
    initUI();
  });

  // 初期化
  // ★音源のロードを削除し、showStartScreenを呼び出す★
  showStartScreen(); 

  // --- 画像差し替え用の便利関数（デバッグ用） ---
  window.PoopGame = {
    setImagePaths: (obj) => {
      // 例: PoopGame.setImagePaths({pain:'images/char_pain.png', strain:'images/char_strain.png', ...})
      for (let k in obj){
        if (imgs[k] !== undefined) imgs[k] = obj[k];
      }
      // UIへ反映
      character.src = imgs.pain;
      bg.src = backgrounds[Math.floor(Math.random()*backgrounds.length)];
    },
    setBackgrounds: (arr) => {
      // arr: ['images/bg1.png', ...]
      // ★修正点：仮素材の10個すべてを上書きできるように変更
      for (let i=0;i<arr.length && i<10;i++){ 
        backgrounds[i] = arr[i];
      }
      bg.src = backgrounds[Math.floor(Math.random()*backgrounds.length)];
    },
    // 音を外部ファイルに切り替えるためのフラグ（未実装の簡易フック）
    useExternalSounds: false
  };

  // --- ここから追記：画像ファイルを固定名で差し替え設定 ---
  // ユーザーが images/ フォルダに指定された名前のファイルを置くと、自動的に読み込まれます。
  
  // キャラクター・ポップアップ画像の設定
  window.PoopGame.setImagePaths({
    pain: 'images/pain.png',
    strain: 'images/strain.png',
    toilet: 'images/toilet.png',
    safePop: 'images/pop_safe.png', 
    outPop: 'images/pop_out.png'
  });

  // 背景画像の設定（10枚すべて設定）
  window.PoopGame.setBackgrounds([
    'images/bg_1.png', 
    'images/bg_2.png', 
    'images/bg_3.png',
    'images/bg_4.png',
    'images/bg_5.png',
    'images/bg_6.png',
    'images/bg_7.png',
    'images/bg_8.png',
    'images/bg_9.png',
    'images/bg_10.png'
  ]);
  // --- 追記ここまで ---

})();
