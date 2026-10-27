// DOM要素の取得
const initialInput = document.getElementById('initialInput');
const resetBtn = document.getElementById('resetBtn');
const startStopBtn = document.getElementById('startStopBtn');
const stepBtn = document.getElementById('stepBtn');
const speedRange = document.getElementById('speedRange');
const speedDisplay = document.getElementById('speedDisplay');
const stepCountEl = document.getElementById('stepCount');
const digitCountEl = document.getElementById('digitCount');
const statusBadge = document.getElementById('statusBadge');
const currentCalcDisplay = document.getElementById('currentCalcDisplay');
const historyList = document.getElementById('historyList');
const historyCountEl = document.getElementById('historyCount');
const presetButtons = document.querySelectorAll('.btn-chip');

// 状態変数
let currentNumber = 0n;
let step = 0;
let isRunning = false;
let isPalindromeFound = false;
let timerId = null;
let historyItemsCount = 0;
const MAX_HISTORY_DOM = 200; // DOM肥大化防止（最新200件保持）

// 速度設定マッピング
const speedSettings = {
  1: { label: 'ゆっくり (800ms)', delay: 800, batch: 1 },
  2: { label: 'やや遅い (400ms)', delay: 400, batch: 1 },
  3: { label: '普通 (120ms)', delay: 120, batch: 1 },
  4: { label: '高速 (20ms)', delay: 20, batch: 1 },
  5: { label: '超高速 (MAX)', delay: 0, batch: 50 },
};

// ユーティリティ: 文字列反転
function reverseString(str) {
  return str.split('').reverse().join('');
}

// ユーティリティ: 回文判定
function isPalindrome(str) {
  return str === reverseString(str);
}

// 初期化・リセット
function init() {
  stopAuto();
  
  const rawVal = initialInput.value.trim();
  if (!rawVal || !/^\d+$/.test(rawVal)) {
    alert('半角数字を入力してください');
    initialInput.value = '196';
    currentNumber = 196n;
  } else {
    currentNumber = BigInt(rawVal);
  }

  step = 0;
  isPalindromeFound = false;
  historyItemsCount = 0;
  historyList.innerHTML = '';
  
  const numStr = currentNumber.toString();
  stepCountEl.textContent = '0';
  digitCountEl.textContent = numStr.length.toLocaleString();
  historyCountEl.textContent = '0';

  // 開始数字そのものが回文数かどうかチェック
  if (isPalindrome(numStr) && numStr.length > 1) {
    statusBadge.className = 'badge badge-found';
    statusBadge.textContent = '最初から回文数！';
    currentCalcDisplay.innerHTML = `<span class="calc-highlight">${numStr}</span> はすでに回文数です。`;
    stepBtn.disabled = true;
    startStopBtn.disabled = true;
    return;
  }

  statusBadge.className = 'badge badge-idle';
  statusBadge.textContent = '待機中';
  currentCalcDisplay.innerHTML = `<span class="placeholder-text">開始ボタンまたは「1ステップ進める」を押してください。<br>現在値: <strong style="color:var(--accent);">${numStr}</strong></span>`;

  stepBtn.disabled = false;
  startStopBtn.disabled = false;
}

// 1回の反転加算ステップを実行
function executeOneStep() {
  if (isPalindromeFound) return;

  step++;
  const currentStr = currentNumber.toString();
  const reversedStr = reverseString(currentStr);
  const reversedNumber = BigInt(reversedStr);
  const nextNumber = currentNumber + reversedNumber;
  const nextStr = nextNumber.toString();

  const found = isPalindrome(nextStr);

  // 画面表示用の計算結果更新
  renderLatestCalc(currentStr, reversedStr, nextStr, found);

  // 履歴に追加
  addHistoryItem(step, currentStr, reversedStr, nextStr, found);

  // 状態更新
  currentNumber = nextNumber;
  stepCountEl.textContent = step.toLocaleString();
  digitCountEl.textContent = nextStr.length.toLocaleString();

  if (found) {
    isPalindromeFound = true;
    stopAuto();
    statusBadge.className = 'badge badge-found';
    statusBadge.textContent = `回文数を達成！ (${step}手)`;
    stepBtn.disabled = true;
    startStopBtn.disabled = true;
  }
}

// 最新の計算式を表示
function renderLatestCalc(a, b, res, found) {
  currentCalcDisplay.innerHTML = `
    <div><span class="calc-step-line">Step ${step}:</span></div>
    <div>&nbsp;&nbsp;${a}</div>
    <div>+ ${b} (反転)</div>
    <div style="border-top: 1px dashed var(--card-border); margin: 4px 0;"></div>
    <div>= <span class="calc-result" style="color: ${found ? 'var(--success)' : '#fff'};">${res}</span> ${found ? '🎉 <strong>(回文数！)</strong>' : ''}</div>
  `;
}

// 履歴アイテムを追加
function addHistoryItem(stepNum, a, b, res, found) {
  historyItemsCount++;
  historyCountEl.textContent = historyItemsCount.toLocaleString();

  const item = document.createElement('div');
  item.className = `history-item ${found ? 'found' : ''}`;
  item.innerHTML = `
    <span class="history-step-num">Step ${stepNum} (桁数: ${res.length})</span>
    <div class="history-formula">
      ${a}<span class="plus">+</span>${b}<span class="equals">=</span><span class="result-val">${res}</span>
      ${found ? ' 🌟' : ''}
    </div>
  `;

  // 最新を一番上に追加
  historyList.insertBefore(item, historyList.firstChild);

  // DOMが多すぎたら下を削除
  if (historyList.childElementCount > MAX_HISTORY_DOM) {
    historyList.removeChild(historyList.lastChild);
  }
}

// 自動ループ処理
function runLoop() {
  if (!isRunning || isPalindromeFound) return;

  const currentSpeed = speedSettings[speedRange.value];

  if (currentSpeed.batch > 1) {
    // バッチ実行（超高速モード）
    for (let i = 0; i < currentSpeed.batch; i++) {
      executeOneStep();
      if (isPalindromeFound) break;
    }
    if (isRunning && !isPalindromeFound) {
      timerId = requestAnimationFrame(runLoop);
    }
  } else {
    executeOneStep();
    if (isRunning && !isPalindromeFound) {
      timerId = setTimeout(runLoop, currentSpeed.delay);
    }
  }
}

function startAuto() {
  if (isPalindromeFound) return;
  isRunning = true;
  startStopBtn.textContent = '停止';
  startStopBtn.classList.add('running');
  statusBadge.className = 'badge badge-running';
  statusBadge.textContent = '探索中...';
  runLoop();
}

function stopAuto() {
  isRunning = false;
  if (timerId) {
    clearTimeout(timerId);
    cancelAnimationFrame(timerId);
    timerId = null;
  }
  startStopBtn.textContent = '自動スタート';
  startStopBtn.classList.remove('running');
  if (!isPalindromeFound) {
    statusBadge.className = 'badge badge-idle';
    statusBadge.textContent = '一時停止中';
  }
}

// イベントリスナー
startStopBtn.addEventListener('click', () => {
  if (isRunning) {
    stopAuto();
  } else {
    startAuto();
  }
});

stepBtn.addEventListener('click', () => {
  if (isRunning) stopAuto();
  executeOneStep();
});

resetBtn.addEventListener('click', () => {
  init();
});

initialInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    init();
  }
});

speedRange.addEventListener('input', (e) => {
  const cfg = speedSettings[e.target.value];
  speedDisplay.textContent = cfg.label;
  if (isRunning) {
    // 速度が変更されたらタイマーを再スケジュール
    if (timerId) {
      clearTimeout(timerId);
      cancelAnimationFrame(timerId);
      timerId = null;
    }
    runLoop();
  }
});

// プリセットボタン
presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const val = btn.getAttribute('data-val');
    initialInput.value = val;
    init();
  });
});

// 初期実行
init();
