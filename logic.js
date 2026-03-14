// ── Pomodoro Timer ──
const POMODORO_DEFAULT = 25 * 60;

let totalSeconds = POMODORO_DEFAULT;
let isRunning = false;
let intervalId = null;

const timerDisplay  = document.getElementById('timer-display');
const timerStatus   = document.getElementById('timer-status');
const playPauseBtn  = document.getElementById('timer-play-pause');
const resetBtn      = document.getElementById('timer-reset');
const add5Btn       = document.getElementById('timer-add5');
const add10Btn      = document.getElementById('timer-add10');

function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateDisplay() {
    timerDisplay.textContent = formatTime(totalSeconds);
    timerDisplay.classList.toggle('danger',  isRunning && totalSeconds <= 60);
    timerDisplay.classList.toggle('running', isRunning && totalSeconds >  60);
}

function playAddTask() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Soft rising blip: E4 → G4
        [
            { freq: 329.63, start: 0,    dur: 0.10 },
            { freq: 392.00, start: 0.09, dur: 0.16 },
        ].forEach(({ freq, start, dur }) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.18, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
        });
    } catch (_) { /* AudioContext unavailable */ }
}

function playTimerStart() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Three-note ascending sweep: C4 → E4 → G4
        [
            { freq: 261.63, start: 0,    dur: 0.14 },
            { freq: 329.63, start: 0.12, dur: 0.14 },
            { freq: 392.00, start: 0.24, dur: 0.22 },
        ].forEach(({ freq, start, dur }) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.22, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
        });
    } catch (_) { /* AudioContext unavailable */ }
}

function playTimerStop() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Single low dull thud: G3 fading quickly
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(196.00, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(130.00, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.22);
    } catch (_) { /* AudioContext unavailable */ }
}

function playAlarm() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.45, 0.9, 1.35].forEach((offset) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(660, ctx.currentTime + offset);
            gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.38);
            osc.start(ctx.currentTime + offset);
            osc.stop(ctx.currentTime + offset + 0.38);
        });
    } catch (_) { /* AudioContext unavailable */ }
}

function tick() {
    if (totalSeconds <= 0) {
        clearInterval(intervalId);
        isRunning = false;
        totalSeconds = 0;
        updateDisplay();
        timerStatus.textContent    = 'QUEST COMPLETE!';
        playPauseBtn.textContent   = '\u25B6 START';
        timerDisplay.classList.remove('running', 'danger');
        playAlarm();
        document.title = '\u2705 Done! | Quest Log';
        return;
    }
    totalSeconds--;
    updateDisplay();
    document.title = `${formatTime(totalSeconds)} | Quest Log`;
}

function togglePlayPause() {
    if (isRunning) {
        clearInterval(intervalId);
        isRunning = false;
        playPauseBtn.textContent = '\u25B6 RESUME';
        timerStatus.textContent  = 'PAUSED';
        timerDisplay.classList.remove('running', 'danger');
        document.title = 'Quest Log';
        playTimerStop();
    } else {
        if (totalSeconds <= 0) return;
        isRunning  = true;
        intervalId = setInterval(tick, 1000);
        playPauseBtn.textContent = '\u23F8 PAUSE';
        timerStatus.textContent  = 'FOCUSING...';
        updateDisplay();
        playTimerStart();
    }
}

function resetTimer() {
    clearInterval(intervalId);
    isRunning    = false;
    totalSeconds = POMODORO_DEFAULT;
    updateDisplay();
    timerStatus.textContent   = 'READY';
    playPauseBtn.textContent  = '\u25B6 START';
    timerDisplay.classList.remove('running', 'danger');
    document.title = 'Quest Log';
}

function addTime(minutes) {
    totalSeconds += minutes * 60;
    updateDisplay();
    if (!isRunning) timerStatus.textContent = 'READY';
}

playPauseBtn.addEventListener('click', togglePlayPause);
resetBtn.addEventListener('click', resetTimer);
add5Btn.addEventListener('click',  () => addTime(5));
add10Btn.addEventListener('click', () => addTime(10));

updateDisplay();

// ── Task list ──
const activeList        = document.getElementById('active-list');
const completedList     = document.getElementById('completed-list');
const addTaskBtn        = document.getElementById('add-task-btn');
const newTaskInput      = document.getElementById('new-task-input');
const activeCountEl     = document.getElementById('active-count');
const completedCountEl  = document.getElementById('completed-count');
const activeEmpty       = document.getElementById('active-empty');
const completedEmpty    = document.getElementById('completed-empty');
const clearCompletedBtn = document.getElementById('clear-completed-btn');

function updateCounts() {
    const ac = activeList.querySelectorAll('li').length;
    const cc = completedList.querySelectorAll('li').length;
    activeCountEl.textContent    = ac;
    completedCountEl.textContent = cc;
    activeEmpty.style.display    = ac === 0 ? 'block' : 'none';
    completedEmpty.style.display = cc === 0 ? 'block' : 'none';
}

function playTaskDone() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Two-note rising chime: C5 → E5
        [
            { freq: 523.25, start: 0,    dur: 0.18 },
            { freq: 659.25, start: 0.16, dur: 0.28 },
        ].forEach(({ freq, start, dur }) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.28, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
        });
    } catch (_) { /* AudioContext unavailable */ }
}

function attachCheckboxListener(checkbox) {
    checkbox.addEventListener('change', () => {
        const li       = checkbox.closest('li');
        const taskText = checkbox.nextElementSibling;
        if (checkbox.checked) {
            taskText.classList.add('completed');
            completedList.appendChild(li);
            playTaskDone();
        } else {
            taskText.classList.remove('completed');
            activeList.appendChild(li);
        }
        updateCounts();
    });
}

// Attach to existing tasks
document.querySelectorAll('#active-list input[type="checkbox"]').forEach(attachCheckboxListener);

function addTask() {
    const text = newTaskInput.value.trim();
    if (!text) return;

    const li       = document.createElement('li');
    const label    = document.createElement('label');
    const checkbox = document.createElement('input');
    const span     = document.createElement('span');

    checkbox.type    = 'checkbox';
    span.textContent = text;  // textContent prevents XSS

    label.appendChild(checkbox);
    label.appendChild(span);
    li.appendChild(label);
    activeList.appendChild(li);

    attachCheckboxListener(checkbox);
    updateCounts();
    playAddTask();
    newTaskInput.value = '';
    newTaskInput.focus();
}

addTaskBtn.addEventListener('click', addTask);

newTaskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
});

clearCompletedBtn.addEventListener('click', () => {
    completedList.innerHTML = '';
    updateCounts();
});

updateCounts();
