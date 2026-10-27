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

// 状態変数
let currentNumber = 0n;
let initialSeed = '196';
let step = 0;
let isRunning = false;
let isPalindromeFound = false;
let timerId = null;
let historyItemsCount = 0;
const MAX_HISTORY_DOM = 20;
const RANKING_STORAGE_KEY = 'lychrel_user_ranking';
const RESOLVED_STORAGE_KEY = 'lychrel_resolved_numbers';
const USERNAME_STORAGE_KEY = 'lychrel_user_name';
const SESSION_STORAGE_KEY = 'lychrel_active_session';
const SHARED_API_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a17e2139ea2a01';
let isSyncingRanking = false;
let liveSyncTimer = null;
let isPageUnloading = false;
const LIVE_ACTIVE_THRESHOLD_MS = 9000; // 9秒以内に更新があれば「実行中」

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
  if (step > 0 && !isPalindromeFound && initialSeed) {
    recordChallenge(initialSeed, step, currentNumber.toString().length, false, 'abandoned');
  }

  stopAuto();

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
  if (isPalindromeFound) return;

  if (historySection && historySection.style.display === 'none') {
    historySection.style.display = 'block';
  }

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

    const resolvedData = {
      seed: initialSeed,
      discoverer: getUserName(),
      steps: step,
      digits: nextStr.length,
      palindrome: nextStr,
      resolvedAt: Date.now()
    };
    recordChallenge(initialSeed, step, nextStr.length, true, 'abandoned', resolvedData);
  } else if (!isRunning) {
    recordChallenge(initialSeed, step, nextStr.length, false, 'paused');
    startStopBtn.textContent = '再開';
    stepBtn.textContent = 'このステップで諦める';
  }
}

// 最新の計算表示
function renderLatestCalc(a, b, res, found) {
  currentCalcDisplay.innerHTML = `
    <div>[Step ${step}]</div>
    <div>${a}</div>
    <div>+</div>
    <div>${b}</div>
    <div>=</div>
    <div><strong>${res}</strong></div>
    ${found ? '<div>(回文数達成)</div>' : ''}
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

function stopAuto() {
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
    if (step > 0) {
      recordChallenge(initialSeed, step, currentNumber.toString().length, false, 'paused');
    }
  }
}

function giveUpAtCurrentStep() {
  if (step === 0 || isPalindromeFound) return;
  stopAuto();
  recordChallenge(initialSeed, step, currentNumber.toString().length, false, 'abandoned');
  statusBadge.className = 'status-text state-abandoned';
  statusBadge.textContent = '断念';
  startStopBtn.textContent = '開始';
  stepBtn.textContent = '1ステップ';
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
  if (isRunning || (step > 0 && !isPalindromeFound && stepBtn.textContent === 'このステップで諦める')) {
    giveUpAtCurrentStep();
  } else {
    if (checkAndDisplayResolved(initialSeed)) return;
    executeOneStep();
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
    } else if (typeof item === 'object' && item.palindrome) {
      map.set(s, item);
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
        chosenStatus = item.status || existing.status;
        if (item.userName) chosenUserName = item.userName;
      } else if (item.steps === existing.steps) {
        chosenLastActiveAt = Math.max(item.lastActiveAt || 0, existing.lastActiveAt || 0);
        if (item.userName && item.userName !== '名無し') chosenUserName = item.userName;
        if (item.status === 'running' || existing.status === 'running') {
          chosenStatus = 'running';
        } else if (item.status === 'paused' || existing.status === 'paused') {
          chosenStatus = 'paused';
        } else {
          chosenStatus = 'abandoned';
        }
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
    const newEntry = resolvedData || {
      seed: seed,
      discoverer: currentUserName,
      steps: currentStep,
      digits: digits,
      palindrome: currentNumber.toString(),
      resolvedAt: now
    };
    localResolved = mergeResolvedList(localResolved, [newEntry]);
    saveLocalResolved(localResolved);
    localList = localList.filter(item => item.seed !== seed);
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
      allResolved = mergeResolvedList(allResolved, [resolvedData]);
    }
    saveLocalResolved(allResolved);

    let merged = mergeRankings(remoteList, localList, allResolved);
    if (found || allResolved.some(r => (typeof r === 'object' ? r.seed === seed : r === seed))) {
      merged = merged.filter(item => item.seed !== seed);
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

    let stateLabel = '<span class="state-abandoned">断念</span>';
    if (isLive) {
      stateLabel = '<span class="state-running">実行中</span>';
    } else if (item.status === 'paused') {
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
init();
