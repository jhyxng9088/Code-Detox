const CHO = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'
];

const BASE_CYCLE = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const TENSE_TO_BASE = { 'ㄲ':'ㄱ', 'ㄸ':'ㄷ', 'ㅃ':'ㅂ', 'ㅆ':'ㅅ', 'ㅉ':'ㅈ' };
const BASE_TO_TENSE = { 'ㄱ':'ㄲ', 'ㄷ':'ㄸ', 'ㅂ':'ㅃ', 'ㅅ':'ㅆ', 'ㅈ':'ㅉ' };

function decomposeSyllable(char) {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;

  const offset = code - 0xac00;
  return {
    initialIndex: Math.floor(offset / 588),
    medialIndex: Math.floor((offset % 588) / 28),
    finalIndex: offset % 28,
  };
}

function composeSyllable(initialIndex, medialIndex, finalIndex) {
  return String.fromCharCode(0xac00 + initialIndex * 588 + medialIndex * 28 + finalIndex);
}

function shiftedInitial(initial) {
  const base = TENSE_TO_BASE[initial] ?? initial;
  const index = BASE_CYCLE.indexOf(base);
  if (index === -1) return initial;
  return BASE_CYCLE[(index + 1) % BASE_CYCLE.length];
}

function encryptChar(char) {
  const part = decomposeSyllable(char);
  if (!part) return char;

  const currentInitial = CHO[part.initialIndex];
  const nextInitial = shiftedInitial(currentInitial);
  return composeSyllable(CHO.indexOf(nextInitial), part.medialIndex, part.finalIndex);
}

function encrypt(text) {
  return [...text].map(encryptChar).join('');
}

function possibleOriginalInitials(cipherInitial) {
  const normalized = TENSE_TO_BASE[cipherInitial] ?? cipherInitial;
  const index = BASE_CYCLE.indexOf(normalized);
  if (index === -1) return [cipherInitial];

  const previousBase = BASE_CYCLE[(index - 1 + BASE_CYCLE.length) % BASE_CYCLE.length];
  const candidates = [previousBase];
  const tense = BASE_TO_TENSE[previousBase];
  if (tense) candidates.push(tense);
  return candidates;
}

function decryptCharCandidates(char) {
  const part = decomposeSyllable(char);
  if (!part) return [char];

  const cipherInitial = CHO[part.initialIndex];
  return possibleOriginalInitials(cipherInitial).map(initial =>
    composeSyllable(CHO.indexOf(initial), part.medialIndex, part.finalIndex)
  );
}

function decryptAll(text) {
  let results = [''];

  for (const char of [...text]) {
    const candidates = decryptCharCandidates(char);
    const next = [];
    for (const prefix of results) {
      for (const candidate of candidates) {
        next.push(prefix + candidate);
      }
    }
    results = next;
  }

  return results;
}

const encryptMode = document.getElementById('encryptMode');
const decryptMode = document.getElementById('decryptMode');
const inputLabel = document.getElementById('inputLabel');
const inputText = document.getElementById('inputText');
const resultCount = document.getElementById('resultCount');
const clearBtn = document.getElementById('clearBtn');
const emptyState = document.getElementById('emptyState');
const singleResult = document.getElementById('singleResult');
const singleResultText = document.getElementById('singleResultText');
const copySingle = document.getElementById('copySingle');
const multiResult = document.getElementById('multiResult');
const candidateList = document.getElementById('candidateList');
const copyAll = document.getElementById('copyAll');
const toast = document.getElementById('toast');

let mode = 'encrypt';
let currentResults = [];
let toastTimer;

function setMode(nextMode) {
  mode = nextMode;
  const encrypting = mode === 'encrypt';

  encryptMode.classList.toggle('is-active', encrypting);
  decryptMode.classList.toggle('is-active', !encrypting);
  encryptMode.setAttribute('aria-selected', String(encrypting));
  decryptMode.setAttribute('aria-selected', String(!encrypting));
  inputLabel.textContent = encrypting ? '일반 문장' : '암호문';
  inputText.placeholder = encrypting ? '암호로 바꿀 문장을 입력하세요' : '해독할 암호를 입력하세요';

  render();
}

function showToast(message = '복사했어') {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast();
  } catch {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
    showToast();
  }
}

function resetResultView() {
  emptyState.hidden = true;
  singleResult.hidden = true;
  multiResult.hidden = true;
  resultCount.hidden = true;
  candidateList.replaceChildren();
}

function render() {
  const text = inputText.value;
  resetResultView();

  if (!text) {
    currentResults = [];
    emptyState.hidden = false;
    emptyState.textContent = '입력하면 바로 변환돼.';
    return;
  }

  if (mode === 'encrypt') {
    const result = encrypt(text);
    currentResults = [result];
    singleResultText.textContent = result;
    singleResult.hidden = false;
    return;
  }

  currentResults = decryptAll(text);
  resultCount.textContent = `${currentResults.length.toLocaleString('ko-KR')}개 후보`;
  resultCount.hidden = false;

  if (currentResults.length === 1) {
    singleResultText.textContent = currentResults[0];
    singleResult.hidden = false;
    return;
  }

  const fragment = document.createDocumentFragment();
  currentResults.forEach(result => {
    const row = document.createElement('div');
    row.className = 'candidate';

    const textNode = document.createElement('p');
    textNode.className = 'candidate-text';
    textNode.textContent = result;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-btn';
    button.textContent = '복사';
    button.addEventListener('click', () => copyText(result));

    row.append(textNode, button);
    fragment.appendChild(row);
  });

  candidateList.appendChild(fragment);
  multiResult.hidden = false;
}

encryptMode.addEventListener('click', () => setMode('encrypt'));
decryptMode.addEventListener('click', () => setMode('decrypt'));
inputText.addEventListener('input', render);
clearBtn.addEventListener('click', () => {
  inputText.value = '';
  inputText.focus();
  render();
});
copySingle.addEventListener('click', () => {
  if (currentResults[0]) copyText(currentResults[0]);
});
copyAll.addEventListener('click', () => {
  if (currentResults.length) copyText(currentResults.join('\n'));
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

setMode('encrypt');
