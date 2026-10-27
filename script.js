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
const historySection = document.getElementById('historySection');
const rankingTableBody = document.getElementById('rankingTableBody');
const emptyRankingMessage = document.getElementById('emptyRankingMessage');
const userNameInput = document.getElementById('userNameInput');
const pausedNotice = document.getElementById('pausedNotice');
const pausedCountdownSec = document.getElementById('pausedCountdownSec');
const downloadResolvedCsvBtn = document.getElementById('downloadResolvedCsvBtn');

// 状態変数
let currentNumber = 0n;
let initialSeed = '196';
let step = 0;
let isRunning = false;
let isPalindromeFound = false;
let timerId = null;
let historyItemsCount = 0;
let stepHistoryNumbers = [];
const MAX_HISTORY_DOM = 20;
const RANKING_STORAGE_KEY = 'lychrel_user_ranking_v2';
const RESOLVED_STORAGE_KEY = 'lychrel_resolved_numbers_v2';
const USERNAME_STORAGE_KEY = 'lychrel_user_name';
const SESSION_STORAGE_KEY = 'lychrel_active_session_v2';

// 過去の古いローカルキャッシュを一掃
try {
  localStorage.removeItem('lychrel_user_ranking');
  localStorage.removeItem('lychrel_resolved_numbers');
  localStorage.removeItem('lychrel_active_session');
} catch (_) {}
const SHARED_API_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a17e2139ea2a01';
let isSyncingRanking = false;
let liveSyncTimer = null;
let isPageUnloading = false;
const LIVE_ACTIVE_THRESHOLD_MS = 9000; // 9秒以内に更新があれば「実行中」
const PAUSED_TIMEOUT_MS = 60000; // 60秒（1分）以上経過した停止中は自動で「断念」扱い
let pausedCountdownTimer = null;
let pausedStartTime = null;

// 一時停止カウントダウン警告
function startPausedCountdown() {
  stopPausedCountdown();
  pausedStartTime = Date.now();
  const totalSec = Math.floor(PAUSED_TIMEOUT_MS / 1000);

  const updateDisplay = () => {
    const elapsedSec = Math.floor((Date.now() - pausedStartTime) / 1000);
    const remaining = Math.max(0, totalSec - elapsedSec);
    if (pausedCountdownSec) {
      pausedCountdownSec.textContent = remaining;
    }
    if (remaining <= 0) {
      stopPausedCountdown();
      giveUpAtCurrentStep();
    }
  };

  updateDisplay();
  if (pausedNotice) {
    pausedNotice.style.display = 'block';
  }
  pausedCountdownTimer = setInterval(updateDisplay, 1000);
}

function stopPausedCountdown() {
  if (pausedCountdownTimer) {
    clearInterval(pausedCountdownTimer);
    pausedCountdownTimer = null;
  }
  pausedStartTime = null;
  if (pausedNotice) {
    pausedNotice.style.display = 'none';
  }
}

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getUserName() {
  if (!userNameInput) return '名無し';
  return userNameInput.value.trim() || '名無し';
}

// 初期化・リセット
function init() {
  stopPausedCountdown();
  if (step > 0 && !isPalindromeFound && initialSeed) {
    recordChallenge(initialSeed, step, currentNumber.toString().length, false, 'abandoned');
  }

  stopAuto(false);

  const rawVal = initialInput.value.trim();
  if (!rawVal || !/^\d+$/.test(rawVal)) {
    alert('半角数字を入力してください');
    initialInput.value = '196';
    currentNumber = 196n;
    initialSeed = '196';
  } else {
    currentNumber = BigInt(rawVal);
    initialSeed = rawVal;
  }

  step = 0;
  isPalindromeFound = false;
  historyItemsCount = 0;
  stepHistoryNumbers = [];
  historyList.innerHTML = '';
  if (historySection) historySection.style.display = 'none';

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
  stepBtn.textContent = '1ステップ';
}

// 1ステップ実行
function executeOneStep() {
  stopPausedCountdown();
  if (isPalindromeFound) return;

  if (historySection && historySection.style.display === 'none') {
    historySection.style.display = 'block';
  }

  step++;
  const currentStr = currentNumber.toString();
  stepHistoryNumbers.push({ seed: currentStr, stepAt: step - 1 });
  const reversedStr = reverseString(currentStr);
  const reversedNumber = BigInt(reversedStr);
  const nextNumber = currentNumber + reversedNumber;
  const nextStr = nextNumber.toString();

  const found = isPalindrome(nextStr);

  currentNumber = nextNumber;
  stepCountEl.textContent = step.toLocaleString();
  digitCountEl.textContent = nextStr.length.toLocaleString();

  addHistoryItem(step, currentStr, reversedStr, nextStr, found);

  if (found) {
    isPalindromeFound = true;
    stopAuto();
    statusBadge.className = 'status-text status-found';
    statusBadge.textContent = `回文数 (${step}手)`;
    stepBtn.disabled = true;
    startStopBtn.disabled = true;

    const currentUserName = getUserName();
    const now = Date.now();
    const digits = nextStr.length;

    // 開始数および途中経過のすべての数字、ならびにその左右反転数（例: 534に対して435）も「功績」として登録
    const resolvedEntries = [];
    const addedSeeds = new Set();

    stepHistoryNumbers.forEach(item => {
      const remainingSteps = step - item.stepAt;
      const seedStr = item.seed;

      if (!addedSeeds.has(seedStr)) {
        addedSeeds.add(seedStr);
        resolvedEntries.push({
          seed: seedStr,
          discoverer: currentUserName,
          steps: remainingSteps,
          digits: digits,
          palindrome: nextStr,
          resolvedAt: now
        });
      }

      // 末尾0でなければ、左右反転させた数（例: 534のときの435）も全く同じステップで回文数になるため登録
      if (!seedStr.endsWith('0')) {
        const revSeed = reverseString(seedStr);
        if (revSeed !== seedStr && !addedSeeds.has(revSeed)) {
          addedSeeds.add(revSeed);
          resolvedEntries.push({
            seed: revSeed,
            discoverer: currentUserName,
            steps: remainingSteps,
            digits: digits,
            palindrome: nextStr,
            resolvedAt: now
          });
        }
      }
    });

    renderLatestCalc(currentStr, reversedStr, nextStr, found, resolvedEntries);
    markHistoryAsResolved(step);

    recordChallenge(initialSeed, step, digits, true, 'abandoned', resolvedEntries);
  } else {
    renderLatestCalc(currentStr, reversedStr, nextStr, found);
    if (!isRunning) {
      recordChallenge(initialSeed, step, digits, false, 'paused');
      startStopBtn.textContent = '再開';
      stepBtn.textContent = 'このステップで諦める';
    }
  }
}

// 履歴の全アイテムに回文数到達証明バッジを付与
function markHistoryAsResolved(totalStep) {
  if (!historyList) return;
  const items = historyList.querySelectorAll('.history-item');
  items.forEach(el => {
    const meta = el.querySelector('.history-meta');
    const stepMatch = meta ? meta.textContent.match(/Step\s+(\d+)/) : null;
    if (stepMatch && !meta.querySelector('.history-resolved-badge')) {
      const stepNum = parseInt(stepMatch[1], 10);
      const remaining = totalStep - stepNum;
      if (remaining > 0) {
        const badge = document.createElement('span');
        badge.className = 'history-resolved-badge';
        badge.style.marginLeft = '8px';
        badge.style.color = '#15803d';
        badge.style.fontWeight = '600';
        badge.textContent = `✓ あと${remaining}手で回文数到達（証明済み）`;
        meta.appendChild(badge);
      }
    }
  });
}

// 最新の計算表示
function renderLatestCalc(a, b, res, found, resolvedEntries = []) {
  let achievementNote = '';
  if (found) {
    const extraCount = resolvedEntries.length > 1 ? resolvedEntries.length - 1 : 0;
    achievementNote = `
      <div style="margin-top: 12px; padding: 10px 14px; border: 1.5px solid #000000; border-radius: 6px; background-color: #f0fdf4; font-size: 0.85rem; line-height: 1.6; text-align: left;">
        🎉 <strong>回文数到達！</strong><br>
        この探索の開始数だけでなく、途中経過の数字やその左右反転数（例: 534に対する435など）を含む <strong>計${resolvedEntries.length}個の数字</strong> が、<strong>${escapeHtml(getUserName())}</strong> の功績として「回文数になる数」に認定・記録されました！
      </div>
    `;
  }

  currentCalcDisplay.innerHTML = `
    <div>[Step ${step}]</div>
    <div>${a}</div>
    <div>+</div>
    <div>${b}</div>
    <div>=</div>
    <div><strong>${res}</strong></div>
    ${found ? '<div>(回文数達成)</div>' : ''}
    ${achievementNote}
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
  stopPausedCountdown();
  if (isPalindromeFound) return;
  if (checkAndDisplayResolved(initialSeed)) return;
  isRunning = true;
  startStopBtn.textContent = '一時停止';
  startStopBtn.classList.add('running');
  stepBtn.textContent = 'このステップで諦める';
  statusBadge.className = 'status-text status-running';
  statusBadge.textContent = '探索中...';
  startLiveSync();
  runLoop();
}

function stopAuto(sendRecord = true) {
  isRunning = false;
  stopLiveSync();
  if (timerId) {
    clearTimeout(timerId);
    cancelAnimationFrame(timerId);
    timerId = null;
  }
  startStopBtn.textContent = step > 0 ? '再開' : '開始';
  startStopBtn.classList.remove('running');
  stepBtn.textContent = step > 0 ? 'このステップで諦める' : '1ステップ';

  if (!isPalindromeFound) {
    statusBadge.className = 'status-text status-idle';
    statusBadge.textContent = '一時停止中';
    if (sendRecord && step > 0) {
      recordChallenge(initialSeed, step, currentNumber.toString().length, false, 'paused');
      startPausedCountdown();
    } else {
      stopPausedCountdown();
    }
  } else {
    stopPausedCountdown();
  }
}

function giveUpAtCurrentStep() {
  stopPausedCountdown();
  if (step === 0 || isPalindromeFound) return;
  stopAuto(false);
  recordChallenge(initialSeed, step, currentNumber.toString().length, false, 'abandoned');
  statusBadge.className = 'status-text state-abandoned';
  statusBadge.textContent = '断念';
  startStopBtn.textContent = '開始';
  stepBtn.textContent = '1ステップ';
}

// 入力欄の数字が変更されたかチェックして同期
function checkInputChanged() {
  const rawVal = initialInput.value.trim();
  if (rawVal && /^\d+$/.test(rawVal) && rawVal !== initialSeed) {
    init();
    return true;
  }
  return false;
}

// イベント
startStopBtn.addEventListener('click', () => {
  if (isRunning) {
    stopAuto();
  } else {
    checkInputChanged();
    startAuto();
  }
});

stepBtn.addEventListener('click', () => {
  if (isRunning || (step > 0 && !isPalindromeFound && stepBtn.textContent === 'このステップで諦める')) {
    giveUpAtCurrentStep();
  } else {
    checkInputChanged();
    if (checkAndDisplayResolved(initialSeed)) return;
    executeOneStep();
  }
});

resetBtn.addEventListener('click', () => {
  init();
});

// 入力欄を編集した瞬間に自動反映（Enterキー不要に）
initialInput.addEventListener('input', () => {
  if (!isRunning) {
    const rawVal = initialInput.value.trim();
    if (rawVal && /^\d+$/.test(rawVal) && rawVal !== initialSeed) {
      init();
    }
  }
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

// 全端末共通ランキング管理ロジック
function loadLocalRanking() {
  try {
    const raw = localStorage.getItem(RANKING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalRanking(list) {
  try {
    localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save ranking locally', e);
  }
}

// 解決済み（回文数到達確認済み＝リクレル数ではない数）リストの管理
function loadLocalResolved() {
  try {
    const raw = localStorage.getItem(RESOLVED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalResolved(list) {
  try {
    localStorage.setItem(RESOLVED_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save resolved numbers locally', e);
  }
}

function findResolvedInfo(seed) {
  const list = loadLocalResolved();
  return list.find(item => (typeof item === 'object' ? item.seed === seed : item === seed));
}

// 解決済みリスト同士をマージ
function mergeResolvedList(remoteResolved = [], localResolved = []) {
  const map = new Map();

  [...remoteResolved, ...localResolved].forEach(item => {
    if (!item) return;
    const s = typeof item === 'object' ? item.seed : item;
    if (!s) return;

    const existing = map.get(s);
    if (!existing) {
      map.set(s, typeof item === 'object' ? item : { seed: s, discoverer: '名無し' });
    } else if (typeof item === 'object') {
      if (!existing.steps || (item.steps && item.steps < existing.steps) || (item.palindrome && !existing.palindrome)) {
        map.set(s, item);
      }
    }
  });

  return Array.from(map.values());
}

// 発見済みメッセージの表示判定
function checkAndDisplayResolved(seed) {
  const resolvedInfo = findResolvedInfo(seed);
  if (resolvedInfo) {
    statusBadge.className = 'status-text status-found';
    statusBadge.textContent = '発見済み';

    const disc = escapeHtml(resolvedInfo.discoverer || '名無し');
    const digits = resolvedInfo.digits ? `${resolvedInfo.digits.toLocaleString()}桁` : (resolvedInfo.palindrome ? `${resolvedInfo.palindrome.length.toLocaleString()}桁` : '');
    const steps = resolvedInfo.steps ? `${resolvedInfo.steps.toLocaleString()}手` : '';
    const palin = resolvedInfo.palindrome ? escapeHtml(resolvedInfo.palindrome) : '回文数';

    currentCalcDisplay.innerHTML = `
      <div style="font-weight: 600; line-height: 1.7;">この数は、<strong>${disc}</strong>が、${digits}${steps ? `（${steps}）` : ''}、<br><span style="word-break: break-all; color: var(--text-main); font-weight: 700;">${palin}</span> で回文数になることを発見しました。</div>
    `;

    const calcBox = document.querySelector('.calc-box');
    if (calcBox) calcBox.open = true;

    startStopBtn.textContent = '開始';
    stepBtn.textContent = '1ステップ';
    return true;
  }
  return false;
}

// 実行中のリアルタイム同期タイマー
function startLiveSync() {
  if (liveSyncTimer) clearInterval(liveSyncTimer);
  liveSyncTimer = setInterval(() => {
    if (isRunning && !isPalindromeFound && step > 0) {
      syncChallengeToCloud(initialSeed, step, currentNumber.toString().length, false, 'running');
    }
  }, 2500);
}

function stopLiveSync() {
  if (liveSyncTimer) {
    clearInterval(liveSyncTimer);
    liveSyncTimer = null;
  }
}

// リモートとローカルのリストをマージしてソート（解決済みの数は除外）
function mergeRankings(remoteList, localList, resolvedList = []) {
  const resolvedSet = new Set(resolvedList);
  const map = new Map();

  [...remoteList, ...localList].forEach(item => {
    // 誰かが回文数に到達（リクレル数ではないと確認）した数はランキングに乗せない！
    if (!item || !item.seed || resolvedSet.has(item.seed)) return;
    const existing = map.get(item.seed);
    if (!existing) {
      map.set(item.seed, {
        seed: item.seed,
        userName: item.userName || '名無し',
        steps: item.steps,
        digits: item.digits,
        status: item.status || 'abandoned',
        lastActiveAt: item.lastActiveAt || 0,
        pausedAt: item.pausedAt || 0
      });
    } else {
      let chosenLastActiveAt = existing.lastActiveAt || 0;
      let chosenPausedAt = Math.max(item.pausedAt || 0, existing.pausedAt || 0);
      let chosenStatus = existing.status || 'abandoned';
      let chosenUserName = existing.userName || item.userName || '名無し';

      if (item.steps > existing.steps) {
        chosenLastActiveAt = item.lastActiveAt || 0;
        chosenPausedAt = item.pausedAt || 0;
        chosenStatus = item.status || existing.status;
        if (item.userName) chosenUserName = item.userName;
      } else if (item.steps === existing.steps) {
        chosenLastActiveAt = Math.max(item.lastActiveAt || 0, existing.lastActiveAt || 0);
        chosenPausedAt = Math.max(item.pausedAt || 0, existing.pausedAt || 0);
        if (item.userName && item.userName !== '名無し') chosenUserName = item.userName;

        const itemTime = Math.max(item.lastActiveAt || 0, item.pausedAt || 0);
        const existingTime = Math.max(existing.lastActiveAt || 0, existing.pausedAt || 0);
        chosenStatus = itemTime >= existingTime ? (item.status || existing.status) : existing.status;
      }

      map.set(item.seed, {
        seed: item.seed,
        userName: chosenUserName,
        steps: Math.max(item.steps, existing.steps),
        digits: item.steps > existing.steps ? item.digits : existing.digits,
        status: chosenStatus,
        lastActiveAt: chosenLastActiveAt,
        pausedAt: chosenPausedAt
      });
    }
  });

  const merged = Array.from(map.values());
  merged.sort((a, b) => b.steps - a.steps);
  return merged.slice(0, 30);
}

// クラウドからランキングを取得
async function fetchSharedRanking() {
  try {
    const res = await fetch(SHARED_API_URL);
    if (!res.ok) throw new Error('Failed to fetch shared ranking');
    const json = await res.json();
    const remoteList = json.data && Array.isArray(json.data.list) ? json.data.list : [];
    const remoteResolved = json.data && Array.isArray(json.data.resolved) ? json.data.resolved : [];
    const localResolved = loadLocalResolved();

    const allResolved = mergeResolvedList(remoteResolved, localResolved);
    saveLocalResolved(allResolved);

    const localList = loadLocalRanking();
    const merged = mergeRankings(remoteList, localList, allResolved);
    saveLocalRanking(merged);
    renderRankingTable(merged);
  } catch (err) {
    console.warn('Using offline/cached ranking:', err);
    renderRankingTable(loadLocalRanking());
  }
}

// クラウドへ挑戦記録を同期
async function syncChallengeToCloud(seed, currentStep, digits, found, state = 'abandoned', resolvedData = null) {
  if (!seed || currentStep < 1) return;

  const now = Date.now();
  const currentUserName = getUserName();
  let localList = loadLocalRanking();
  let localResolved = loadLocalResolved();

  if (found) {
    // 誰かが回文数に到達（リクレル数ではないことを確認）した！
    const newEntries = Array.isArray(resolvedData) ? resolvedData : (resolvedData ? [resolvedData] : [{
      seed: seed,
      discoverer: currentUserName,
      steps: currentStep,
      digits: digits,
      palindrome: currentNumber.toString(),
      resolvedAt: now
    }]);
    localResolved = mergeResolvedList(localResolved, newEntries);
    saveLocalResolved(localResolved);

    const resolvedSeeds = new Set(newEntries.map(e => (typeof e === 'object' ? e.seed : e)));
    localList = localList.filter(item => !resolvedSeeds.has(item.seed));
  } else {
    // まだ回文数になっていない挑戦
    // すでに誰かが確認済み（リクレル数でない）ならランキングに乗せない
    const isAlreadyResolved = localResolved.some(r => (typeof r === 'object' ? r.seed === seed : r === seed));
    if (isAlreadyResolved) {
      localList = localList.filter(item => item.seed !== seed);
    } else {
      const idx = localList.findIndex(item => item.seed === seed);
      if (idx >= 0) {
        if (currentStep >= localList[idx].steps) {
          localList[idx].steps = currentStep;
          localList[idx].digits = digits;
          localList[idx].status = state;
          localList[idx].userName = currentUserName;
          if (state === 'running') localList[idx].lastActiveAt = now;
          if (state === 'paused') localList[idx].pausedAt = now;
        } else if (state !== 'running') {
          localList[idx].status = state;
        }
      } else {
        // 10手で回文になる数でも、5手で諦めたらその状態でランキングに乗る！
        localList.push({
          seed,
          userName: currentUserName,
          steps: currentStep,
          digits,
          status: state,
          lastActiveAt: state === 'running' ? now : 0,
          pausedAt: state === 'paused' ? now : 0
        });
      }
      localList.sort((a, b) => b.steps - a.steps);
    }
  }
  saveLocalRanking(localList);
  renderRankingTable(localList);

  // 過去記録を下回っている実行中は通信をスキップ
  const currentBest = localList.find(item => item.seed === seed);
  if (currentBest && currentStep < currentBest.steps && state === 'running') {
    return;
  }

  // 同時リクエスト重複防止
  if (isSyncingRanking) return;
  isSyncingRanking = true;

  try {
    let remoteList = [];
    let remoteResolved = [];
    try {
      const getRes = await fetch(SHARED_API_URL);
      if (getRes.ok) {
        const json = await getRes.json();
        remoteList = json.data && Array.isArray(json.data.list) ? json.data.list : [];
        remoteResolved = json.data && Array.isArray(json.data.resolved) ? json.data.resolved : [];
      }
    } catch (_) {}

    let allResolved = mergeResolvedList(remoteResolved, localResolved);
    if (found && resolvedData) {
      const entries = Array.isArray(resolvedData) ? resolvedData : [resolvedData];
      allResolved = mergeResolvedList(allResolved, entries);
    }
    saveLocalResolved(allResolved);

    const allResolvedSeeds = new Set(allResolved.map(r => (typeof r === 'object' ? r.seed : r)));
    let merged = mergeRankings(remoteList, localList, allResolved);
    if (found || allResolvedSeeds.has(seed)) {
      merged = merged.filter(item => !allResolvedSeeds.has(item.seed));
    } else {
      const mIdx = merged.findIndex(i => i.seed === seed);
      if (mIdx >= 0) {
        if (currentStep >= merged[mIdx].steps) {
          merged[mIdx].steps = currentStep;
          merged[mIdx].digits = digits;
          merged[mIdx].status = state;
          merged[mIdx].userName = currentUserName;
          if (state === 'running') merged[mIdx].lastActiveAt = now;
          if (state === 'paused') merged[mIdx].pausedAt = now;
        } else if (state !== 'running') {
          merged[mIdx].status = state;
        }
      }
    }

    await fetch(SHARED_API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        name: 'lychrel_shared_ranking',
        data: {
          list: merged,
          resolved: allResolved
        }
      })
    });
  } catch (e) {
    console.warn('Cloud sync error:', e);
  } finally {
    isSyncingRanking = false;
  }
}

function recordChallenge(seed, currentStep, digits, found, state = 'abandoned', resolvedData = null) {
  syncChallengeToCloud(seed, currentStep, digits, found, state, resolvedData);
}

function renderRankingTable(list = loadLocalRanking()) {
  if (!list || list.length === 0) {
    rankingTableBody.innerHTML = '';
    emptyRankingMessage.style.display = 'block';
    return;
  }

  emptyRankingMessage.style.display = 'none';
  const now = Date.now();

  rankingTableBody.innerHTML = list.map((item, index) => {
    const isLive = item.status === 'running' && item.lastActiveAt && (now - item.lastActiveAt < LIVE_ACTIVE_THRESHOLD_MS);
    const isRecentlyPaused = item.status === 'paused' && item.pausedAt && (now - item.pausedAt < PAUSED_TIMEOUT_MS);

    let stateLabel = '<span class="state-abandoned">断念</span>';
    if (isLive) {
      stateLabel = '<span class="state-running">実行中</span>';
    } else if (isRecentlyPaused) {
      stateLabel = '<span class="state-paused">停止中</span>';
    } else {
      stateLabel = '<span class="state-abandoned">断念</span>';
    }

    return `
      <tr>
        <td><strong>${index + 1}位</strong></td>
        <td class="num-cell">${item.seed}</td>
        <td>${escapeHtml(item.userName || '名無し')}</td>
        <td>${stateLabel}</td>
        <td>${item.steps.toLocaleString()} 手</td>
        <td>${item.digits.toLocaleString()} 桁</td>
        <td><button class="btn-try" data-val="${item.seed}">試す</button></td>
      </tr>
    `;
  }).join('');

  rankingTableBody.querySelectorAll('.btn-try').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      initialInput.value = val;
      init();
      initialInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

// ユーザー名保存ロジック
if (userNameInput) {
  try {
    const savedName = localStorage.getItem(USERNAME_STORAGE_KEY);
    if (savedName) {
      userNameInput.value = savedName;
    } else {
      userNameInput.value = '名無し';
    }
  } catch (_) {
    userNameInput.value = '名無し';
  }

  userNameInput.addEventListener('input', (e) => {
    try {
      localStorage.setItem(USERNAME_STORAGE_KEY, e.target.value.trim());
    } catch (_) {}
  });
}

// ページ離脱・リロード時は「諦める」と同じ扱いで断念を記録
window.addEventListener('beforeunload', () => {
  if (step > 0 && !isPalindromeFound && initialSeed) {
    recordChallenge(initialSeed, step, currentNumber.toString().length, false, 'abandoned');
  }
});

// 初期実行 & 定期自動フェッチ（3.5秒ごと）
speedDisplay.textContent = speedSettings[speedRange.value].label;
fetchSharedRanking();
setInterval(fetchSharedRanking, 3500);

// 日時フォーマット関数 (YYYY/MM/DD HH:mm:ss)
function formatDateTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  const Y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${Y}/${M}/${D} ${h}:${m}:${s}`;
}

// 回文数達成ログのCSV (Excel対応) ダウンロード
if (downloadResolvedCsvBtn) {
  downloadResolvedCsvBtn.addEventListener('click', async () => {
    try {
      downloadResolvedCsvBtn.disabled = true;
      downloadResolvedCsvBtn.textContent = 'ダウンロード準備中...';

      // 最新のresolvedリストを取得
      let resolvedList = loadLocalResolved();
      try {
        const res = await fetch(SHARED_API_URL);
        if (res.ok) {
          const json = await res.json();
          const remoteResolved = json.data && Array.isArray(json.data.resolved) ? json.data.resolved : [];
          resolvedList = mergeResolvedList(remoteResolved, resolvedList);
          saveLocalResolved(resolvedList);
        }
      } catch (_) {}

      if (!resolvedList) {
        resolvedList = [];
      }

      // 元の数（seed）の小さい順にソート（BigInt比較）
      const sorted = [...resolvedList].sort((a, b) => {
        const aSeed = typeof a === 'object' ? a.seed : a;
        const bSeed = typeof b === 'object' ? b.seed : b;
        try {
          const aBig = BigInt(aSeed);
          const bBig = BigInt(bSeed);
          if (aBig < bBig) return -1;
          if (aBig > bBig) return 1;
          return 0;
        } catch (_) {
          return String(aSeed).localeCompare(String(bSeed));
        }
      });

      // CSVヘッダー: 数,ステップ,桁数,日時,名前,回文数
      const headers = ['数', 'ステップ', '桁数', '日時', '名前', '回文数'];
      const escapeCsvCell = (val) => {
        const str = val == null ? '' : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      };

      const downloadTimeStr = formatDateTime(Date.now());
      const rows = [
        escapeCsvCell(`${downloadTimeStr}時点`),
        '',
        headers.map(escapeCsvCell).join(',')
      ];

      sorted.forEach(item => {
        const isObj = typeof item === 'object' && item !== null;
        const seed = isObj ? item.seed : item;
        const steps = isObj && item.steps != null ? item.steps : '-';
        const digits = isObj && item.digits != null ? item.digits : '-';
        const dateStr = isObj && item.resolvedAt ? formatDateTime(item.resolvedAt) : '-';
        const discoverer = isObj && item.discoverer ? item.discoverer : '名無し';
        const palindrome = isObj && item.palindrome ? item.palindrome : '-';

        rows.push([
          escapeCsvCell(seed),
          escapeCsvCell(steps),
          escapeCsvCell(digits),
          escapeCsvCell(dateStr),
          escapeCsvCell(discoverer),
          escapeCsvCell(palindrome)
        ].join(','));
      });

      const csvContent = rows.join('\r\n');
      // Excelで文字化けしないよう UTF-8 BOM付き Blob を生成
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `回文数達成ログ_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV download error:', err);
      alert('CSVの出力中にエラーが発生しました。');
    } finally {
      downloadResolvedCsvBtn.disabled = false;
      downloadResolvedCsvBtn.textContent = 'CSV (Excel) ダウンロード';
    }
  });
}
init();
