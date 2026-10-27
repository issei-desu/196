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

// 状態変数
let currentNumber = 0n;
let step = 0;
let isRunning = false;
let isPalindromeFound = false;
let timerId = null;
let historyItemsCount = 0;
const MAX_HISTORY_DOM = 20;

// 速度設定
const speedSettings = {
  1: { label: 'ゆっくり (800ms/step)', delay: 800, batch: 1 },
  2: { label: 'やや遅い (400ms/step)', delay: 400, batch: 1 },
  3: { label: '普通 (100ms/step)', delay: 100, batch: 1 },
  4: { label: '高速 (20ms/step)', delay: 20, batch: 1 },
  5: { label: '超高速 (約0.3ms/step)', delay: 0, batch: 50 },
};

function reverseString(str) {
  return str.split('').reverse().join('');
}

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

  if (isPalindrome(numStr) && numStr.length > 1) {
    statusBadge.className = 'status-text status-found';
    statusBadge.textContent = '回文数です';
    currentCalcDisplay.innerHTML = `<strong>${numStr}</strong> はすでに回文数です。`;
    stepBtn.disabled = true;
    startStopBtn.disabled = true;
    return;
  }

  statusBadge.className = 'status-text status-idle';
  statusBadge.textContent = '待機中';
  currentCalcDisplay.innerHTML = `<span class="placeholder">現在値: <strong>${numStr}</strong></span>`;

  stepBtn.disabled = false;
  startStopBtn.disabled = false;
  startStopBtn.textContent = '開始';
}

// 1ステップ実行
function executeOneStep() {
  if (isPalindromeFound) return;

  step++;
  const currentStr = currentNumber.toString();
  const reversedStr = reverseString(currentStr);
  const reversedNumber = BigInt(reversedStr);
  const nextNumber = currentNumber + reversedNumber;
  const nextStr = nextNumber.toString();

  const found = isPalindrome(nextStr);

  renderLatestCalc(currentStr, reversedStr, nextStr, found);
  addHistoryItem(step, currentStr, reversedStr, nextStr, found);

  currentNumber = nextNumber;
  stepCountEl.textContent = step.toLocaleString();
  digitCountEl.textContent = nextStr.length.toLocaleString();

  if (found) {
    isPalindromeFound = true;
    stopAuto();
    statusBadge.className = 'status-text status-found';
    statusBadge.textContent = `回文数 (${step}手)`;
    stepBtn.disabled = true;
    startStopBtn.disabled = true;
  }
}

// 最新の計算表示
function renderLatestCalc(a, b, res, found) {
  currentCalcDisplay.innerHTML = `
    <div>Step ${step}: ${a} + ${b} = <strong>${res}</strong>${found ? ' (回文数達成)' : ''}</div>
  `;
}

// 履歴追加
function addHistoryItem(stepNum, a, b, res, found) {
  const item = document.createElement('div');
  item.className = `history-item ${found ? 'found' : ''}`;
  item.innerHTML = `
    <div class="history-meta">Step ${stepNum} (桁数: ${res.length})</div>
    <div class="history-calc">${a} + ${b} = ${res}${found ? ' ✓' : ''}</div>
  `;

  historyList.insertBefore(item, historyList.firstChild);

  if (historyList.childElementCount > MAX_HISTORY_DOM) {
    historyList.removeChild(historyList.lastChild);
  }

  historyCountEl.textContent = historyList.childElementCount.toLocaleString();
}

// 自動実行ループ
function runLoop() {
  if (!isRunning || isPalindromeFound) return;

  const currentSpeed = speedSettings[speedRange.value];

  if (currentSpeed.batch > 1) {
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
  startStopBtn.textContent = '一時停止';
  startStopBtn.classList.add('running');
  statusBadge.className = 'status-text status-running';
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
  startStopBtn.textContent = step > 0 ? '再開' : '開始';
  startStopBtn.classList.remove('running');
  if (!isPalindromeFound) {
    statusBadge.className = 'status-text status-idle';
    statusBadge.textContent = '一時停止中';
  }
}

// イベント
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
  if (!isPalindromeFound && !isRunning) {
    startStopBtn.textContent = '再開';
  }
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
    if (timerId) {
      clearTimeout(timerId);
      cancelAnimationFrame(timerId);
      timerId = null;
    }
    runLoop();
  }
});

// 初期実行
speedDisplay.textContent = speedSettings[speedRange.value].label;
init();
