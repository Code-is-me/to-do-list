// ── Pomodoro Timer ──
// Default focus session length in seconds (25 minutes).
const POMODORO_DEFAULT = 25 * 60;

// Timer state values.
let totalSeconds = POMODORO_DEFAULT;
let sessionDurationSeconds = POMODORO_DEFAULT;
let isRunning = false;
let intervalId = null;

const TIMER_COLOR_DEFAULTS = {
    start: '#44ff88',
    mid: '#ffb000',
    end: '#ff3355'
};

let timerPalette = { ...TIMER_COLOR_DEFAULTS };

// Timer-related DOM references.
const timerDisplay  = document.getElementById('timer-display');
const timerStatus   = document.getElementById('timer-status');
const playPauseBtn  = document.getElementById('timer-play-pause');
const resetBtn      = document.getElementById('timer-reset');
const sub5Btn       = document.getElementById('timer-sub5');
const add5Btn       = document.getElementById('timer-add5');
const add10Btn      = document.getElementById('timer-add10');
const timerColorStartInput = document.getElementById('timer-color-start');
const timerColorMidInput = document.getElementById('timer-color-mid');
const timerColorEndInput = document.getElementById('timer-color-end');
const timerColorResetBtn = document.getElementById('timer-color-reset');

// Convert total seconds to MM:SS format for the timer display.
function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function hexToRgb(hex) {
    const normalized = hex.replace('#', '');
    const safeHex = normalized.length === 3
        ? normalized.split('').map((char) => char + char).join('')
        : normalized;

    return {
        r: parseInt(safeHex.slice(0, 2), 16),
        g: parseInt(safeHex.slice(2, 4), 16),
        b: parseInt(safeHex.slice(4, 6), 16)
    };
}

function interpolateColor(startHex, endHex, amount) {
    const start = hexToRgb(startHex);
    const end = hexToRgb(endHex);
    const clampedAmount = Math.min(Math.max(amount, 0), 1);

    return {
        r: Math.round(start.r + ((end.r - start.r) * clampedAmount)),
        g: Math.round(start.g + ((end.g - start.g) * clampedAmount)),
        b: Math.round(start.b + ((end.b - start.b) * clampedAmount))
    };
}

function rgbToCss(rgb, alpha = 1) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function syncTimerColorInputs() {
    timerColorStartInput.value = timerPalette.start;
    timerColorMidInput.value = timerPalette.mid;
    timerColorEndInput.value = timerPalette.end;
}

function saveTimerPalette() {
    localStorage.setItem('quest-log-timer-palette', JSON.stringify(timerPalette));
}

function loadTimerPalette() {
    const savedPalette = localStorage.getItem('quest-log-timer-palette');
    if (!savedPalette) return;

    try {
        const parsedPalette = JSON.parse(savedPalette);
        timerPalette = {
            start: parsedPalette.start || TIMER_COLOR_DEFAULTS.start,
            mid: parsedPalette.mid || TIMER_COLOR_DEFAULTS.mid,
            end: parsedPalette.end || TIMER_COLOR_DEFAULTS.end
        };
    } catch (_) {
        timerPalette = { ...TIMER_COLOR_DEFAULTS };
    }
}

// Update timer text and visual state classes based on current time.
function updateDisplay() {
    const safeDuration = Math.max(sessionDurationSeconds, 1);
    const remainingRatio = Math.min(Math.max(totalSeconds / safeDuration, 0), 1);
    const glowAlpha = remainingRatio > 0.5 ? '0.55' : '0.75';
    const shadowAlpha = remainingRatio > 0.5 ? '0.25' : '0.45';
    const blendedColor = remainingRatio > 0.5
        ? interpolateColor(timerPalette.mid, timerPalette.start, (remainingRatio - 0.5) / 0.5)
        : interpolateColor(timerPalette.end, timerPalette.mid, remainingRatio / 0.5);
    const timerColor = rgbToCss(blendedColor, 1);
    const timerGlow = rgbToCss(blendedColor, glowAlpha);
    const timerShadow = rgbToCss(blendedColor, shadowAlpha);

    timerDisplay.textContent = formatTime(totalSeconds);
    timerDisplay.style.setProperty('--timer-color', timerColor);
    timerDisplay.style.setProperty('--timer-glow', timerGlow);
    timerDisplay.style.setProperty('--timer-shadow', timerShadow);
    timerDisplay.classList.toggle('danger',  isRunning && totalSeconds <= 60);
    timerDisplay.classList.toggle('running', isRunning && totalSeconds > 60);
}

function updateTimerPalette() {
    timerPalette = {
        start: timerColorStartInput.value,
        mid: timerColorMidInput.value,
        end: timerColorEndInput.value
    };
    saveTimerPalette();
    updateDisplay();
}

// Sound effect played when a new task is added.
function playAddTask() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [
            { freq: 329.63, start: 0,    dur: 0.10 },
            { freq: 392.00, start: 0.09, dur: 0.16 },
        ].forEach(({ freq, start, dur }) => {
            const osc = ctx.createOscillator();
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
    } catch (_) { }
}

// Sound effect played when timer starts/resumes.
function playTimerStart() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [
            { freq: 261.63, start: 0,    dur: 0.14 },
            { freq: 329.63, start: 0.12, dur: 0.14 },
            { freq: 392.00, start: 0.24, dur: 0.22 },
        ].forEach(({ freq, start, dur }) => {
            const osc = ctx.createOscillator();
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
    } catch (_) { }
}

// Sound effect played when timer is paused.
function playTimerStop() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
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
    } catch (_) { }
}

// Alarm sound played when timer reaches 00:00.
function playAlarm() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.45, 0.9, 1.35].forEach((offset) => {
            const osc = ctx.createOscillator();
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
    } catch (_) { }
}

// Ask notification permission from a user action (start button click).
function primeNotificationPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
}

// Show desktop/browser notification when focus timer finishes.
function showTimerDoneNotification() {
    if (!("Notification" in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
        new Notification('⏰ Timer Complete', {
            body: 'Your focus session reached 00:00. Great work!',
            tag: 'quest-log-timer-done'
        });
    } catch (_) { }
}

// One timer tick: decrease remaining time and refresh UI.
function tick() {
    if (totalSeconds <= 0) {
        clearInterval(intervalId);
        isRunning = false;
        totalSeconds = 0;
        updateDisplay();
        timerStatus.textContent = 'QUEST COMPLETE!';
        playPauseBtn.textContent = '\u25B6 START';
        timerDisplay.classList.remove('running', 'danger');
        playAlarm();
        showTimerDoneNotification();
        document.title = '\u2705 Done! | Quest Log';
        return;
    }

    totalSeconds--;
    updateDisplay();
    document.title = `${formatTime(totalSeconds)} | Quest Log`;
}

// Start/pause toggle for Pomodoro timer.
function togglePlayPause() {
    if (isRunning) {
        clearInterval(intervalId);
        isRunning = false;
        playPauseBtn.textContent = '\u25B6 RESUME';
        timerStatus.textContent = 'PAUSED';
        timerDisplay.classList.remove('running', 'danger');
        document.title = 'Quest Log';
        playTimerStop();
    } else {
        if (totalSeconds <= 0) return;
        primeNotificationPermission();
        isRunning = true;
        intervalId = setInterval(tick, 1000);
        playPauseBtn.textContent = '\u23F8 PAUSE';
        timerStatus.textContent = 'FOCUSING...';
        updateDisplay();
        playTimerStart();
    }
}

// Stop timer and return it to default 25:00 state.
function resetTimer() {
    clearInterval(intervalId);
    isRunning = false;
    totalSeconds = POMODORO_DEFAULT;
    sessionDurationSeconds = POMODORO_DEFAULT;
    updateDisplay();
    timerStatus.textContent = 'READY';
    playPauseBtn.textContent = '\u25B6 START';
    timerDisplay.classList.remove('running', 'danger');
    document.title = 'Quest Log';
}

// Add or subtract minutes from the timer (clamped to zero).
function addTime(minutes) {
    totalSeconds = Math.max(0, totalSeconds + (minutes * 60));
    sessionDurationSeconds = Math.max(totalSeconds, 1);
    updateDisplay();
    if (!isRunning) timerStatus.textContent = 'READY';
}

// Wire timer buttons to their actions.
playPauseBtn.addEventListener('click', togglePlayPause);
resetBtn.addEventListener('click', resetTimer);
sub5Btn.addEventListener('click', () => addTime(-5));
add5Btn.addEventListener('click', () => addTime(5));
add10Btn.addEventListener('click', () => addTime(10));
timerColorStartInput.addEventListener('input', updateTimerPalette);
timerColorMidInput.addEventListener('input', updateTimerPalette);
timerColorEndInput.addEventListener('input', updateTimerPalette);
timerColorResetBtn.addEventListener('click', () => {
    timerPalette = { ...TIMER_COLOR_DEFAULTS };
    syncTimerColorInputs();
    saveTimerPalette();
    updateDisplay();
});

// Initial render on page load.
loadTimerPalette();
syncTimerColorInputs();
updateDisplay();

// ── Task list ──
// Task-related DOM references.
const activeList = document.getElementById('active-list');
const completedList = document.getElementById('completed-list');
const addTaskBtn = document.getElementById('add-task-btn');
const newTaskInput = document.getElementById('new-task-input');
const activeCountEl = document.getElementById('active-count');
const completedCountEl = document.getElementById('completed-count');
const activeEmpty = document.getElementById('active-empty');
const completedEmpty = document.getElementById('completed-empty');
const clearCompletedBtn = document.getElementById('clear-completed-btn');

// Recalculate counters and show/hide empty-state messages.
function updateCounts() {
    const ac = activeList.querySelectorAll('li').length;
    const cc = completedList.querySelectorAll('li').length;
    activeCountEl.textContent = ac;
    completedCountEl.textContent = cc;
    activeEmpty.style.display = ac === 0 ? 'block' : 'none';
    completedEmpty.style.display = cc === 0 ? 'block' : 'none';
}

// Sound effect played when a task is marked as completed.
function playTaskDone() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [
            { freq: 523.25, start: 0,    dur: 0.18 },
            { freq: 659.25, start: 0.16, dur: 0.28 },
        ].forEach(({ freq, start, dur }) => {
            const osc = ctx.createOscillator();
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
    } catch (_) { }
}

// Attach change behavior to one checkbox.
function attachCheckboxListener(checkbox) {
    checkbox.addEventListener('change', () => {
        const li = checkbox.closest('li');
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

// Attach to existing tasks.
document.querySelectorAll('#active-list input[type="checkbox"]').forEach(attachCheckboxListener);

// Create and append a new task item from user input.
function addTask() {
    const text = newTaskInput.value.trim();
    if (!text) return;

    const li = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    const span = document.createElement('span');

    checkbox.type = 'checkbox';
    span.textContent = text;

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

// Add task by button click.
addTaskBtn.addEventListener('click', addTask);

// Add task by pressing Enter in input field.
newTaskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
});

// Clear completed section quickly.
clearCompletedBtn.addEventListener('click', () => {
    completedList.innerHTML = '';
    updateCounts();
});

// Initial counter/empty-state sync on first load.
updateCounts();
