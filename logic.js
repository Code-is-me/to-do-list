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
const playPauseBtnIcon = document.getElementById('timer-play-pause-icon');
const playPauseBtnText = document.getElementById('timer-play-pause-text');
const resetBtn      = document.getElementById('timer-reset');
const resetBtnIcon  = document.getElementById('timer-reset-icon');
const resetBtnText  = document.getElementById('timer-reset-text');
const sub10Btn      = document.getElementById('timer-sub10');
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
    const phaseColor = remainingRatio > (2 / 3)
        ? timerPalette.start
        : remainingRatio > (1 / 3)
            ? timerPalette.mid
            : timerPalette.end;
    const timerColor = phaseColor;
    const phaseColorRgb = hexToRgb(phaseColor);
    const timerGlow = rgbToCss(phaseColorRgb, glowAlpha);
    const timerShadow = rgbToCss(phaseColorRgb, shadowAlpha);

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
        playPauseBtnIcon.src = 'play-button-icon.png';
        playPauseBtnText.textContent = 'START';
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
        playPauseBtnIcon.src = 'play-button-icon.png';
        playPauseBtnText.textContent = 'RESUME';
        timerStatus.textContent = 'PAUSED';
        timerDisplay.classList.remove('running', 'danger');
        document.title = 'Quest Log';
        playTimerStop();
    } else {
        if (totalSeconds <= 0) return;
        primeNotificationPermission();
        isRunning = true;
        intervalId = setInterval(tick, 1000);
        playPauseBtnIcon.src = 'pause.png';
        playPauseBtnText.textContent = 'PAUSE';
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
    playPauseBtnIcon.src = 'play-button-icon.png';
    playPauseBtnText.textContent = 'START';
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
sub10Btn.addEventListener('click', () => addTime(-10));
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
const inProgressList = document.getElementById('in-progress-list');
const completedList = document.getElementById('completed-list');
const addTaskBtn = document.getElementById('add-task-btn');
const newTaskInput = document.getElementById('new-task-input');
const activeCountEl = document.getElementById('active-count');
const inProgressCountEl = document.getElementById('in-progress-count');
const completedCountEl = document.getElementById('completed-count');
const activeEmpty = document.getElementById('active-empty');
const inProgressEmpty = document.getElementById('in-progress-empty');
const completedEmpty = document.getElementById('completed-empty');
const clearActiveBtn = document.getElementById('clear-active-btn');
const clearInProgressBtn = document.getElementById('clear-in-progress-btn');
const clearCompletedBtn = document.getElementById('clear-completed-btn');

// Recalculate counters and show/hide empty-state messages.
function updateCounts() {
    const ac = activeList.querySelectorAll('li').length;
    const ipc = inProgressList.querySelectorAll('li').length;
    const cc = completedList.querySelectorAll('li').length;
    activeCountEl.textContent = ac;
    inProgressCountEl.textContent = ipc;
    completedCountEl.textContent = cc;
    activeEmpty.style.display = ac === 0 ? 'block' : 'none';
    inProgressEmpty.style.display = ipc === 0 ? 'block' : 'none';
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

// Sound effect played when a task enters the in-progress section.
function playTaskInProgress() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [
            { freq: 392.00, start: 0,    dur: 0.10 },
            { freq: 523.25, start: 0.09, dur: 0.14 },
            { freq: 659.25, start: 0.20, dur: 0.20 },
        ].forEach(({ freq, start, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.2, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
        });
    } catch (_) { }
}

// Sound effect played when a single task is deleted.
function playTaskDelete() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [
            { freq: 293.66, start: 0,    dur: 0.08 },
            { freq: 220.00, start: 0.07, dur: 0.12 },
        ].forEach(({ freq, start, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.16, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
        });
    } catch (_) { }
}

// Alerting warning sound played before clear-all confirmation.
function playClearAllAlert() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [
            { freq: 880.00, start: 0.00, dur: 0.12 },
            { freq: 660.00, start: 0.12, dur: 0.12 },
            { freq: 880.00, start: 0.24, dur: 0.12 },
        ].forEach(({ freq, start, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.32, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
        });
    } catch (_) { }
}

function confirmAndClearList(listEl, sectionLabel) {
    const taskCount = listEl.querySelectorAll('li').length;
    if (taskCount === 0) return;

    playClearAllAlert();
    const shouldClear = window.confirm(`Are you sure you want to clear all ${sectionLabel} tasks?`);
    if (!shouldClear) return;

    listEl.innerHTML = '';
    updateCounts();
}

function setTaskState(li, state, shouldPlayMoveSound = false) {
    const checkbox = li.querySelector('input[type="checkbox"]');
    const taskText = li.querySelector('span');
    const statusBtn = li.querySelector('.task-status-btn');

    li.dataset.state = state;

    if (state === 'completed') {
        checkbox.checked = true;
        taskText.classList.add('completed');
        li.classList.add('completed-task');
        li.classList.remove('in-progress-task');
        completedList.appendChild(li);
    } else if (state === 'in-progress') {
        checkbox.checked = false;
        taskText.classList.remove('completed');
        li.classList.remove('completed-task');
        li.classList.add('in-progress-task');
        statusBtn.textContent = 'BACK';
        inProgressList.appendChild(li);
        if (shouldPlayMoveSound) playTaskInProgress();
    } else {
        checkbox.checked = false;
        taskText.classList.remove('completed');
        li.classList.remove('completed-task', 'in-progress-task');
        statusBtn.textContent = 'START';
        activeList.appendChild(li);
    }

    updateCounts();
}

// Attach change behavior to one checkbox.
function attachCheckboxListener(checkbox) {
    checkbox.addEventListener('change', () => {
        const li = checkbox.closest('li');
        if (checkbox.checked) {
            setTaskState(li, 'completed');
            playTaskDone();
        } else {
            setTaskState(li, 'active');
        }
    });
}

function attachStatusButtonListener(button) {
    button.addEventListener('click', () => {
        const li = button.closest('li');
        const nextState = li.dataset.state === 'in-progress' ? 'active' : 'in-progress';
        setTaskState(li, nextState, nextState === 'in-progress');
    });
}

function attachDeleteButtonListener(button) {
    button.addEventListener('click', () => {
        const li = button.closest('li');
        li.remove();
        playTaskDelete();
        updateCounts();
    });
}

function createTaskItem(text) {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    const span = document.createElement('span');
    const statusBtn = document.createElement('button');
    const deleteBtn = document.createElement('button');

    checkbox.type = 'checkbox';
    span.textContent = text;
    statusBtn.type = 'button';
    statusBtn.className = 'task-status-btn';
    statusBtn.textContent = 'START';
    deleteBtn.type = 'button';
    deleteBtn.className = 'task-delete-btn';
    deleteBtn.textContent = 'DELETE';

    label.appendChild(checkbox);
    label.appendChild(span);
    li.appendChild(label);
    li.appendChild(statusBtn);
    li.appendChild(deleteBtn);

    attachCheckboxListener(checkbox);
    attachStatusButtonListener(statusBtn);
    attachDeleteButtonListener(deleteBtn);

    return li;
}

// Create and append a new task item from user input.
function addTask() {
    const text = newTaskInput.value.trim();
    if (!text) return;

    const li = createTaskItem(text);
    activeList.appendChild(li);
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

clearActiveBtn.addEventListener('click', () => {
    confirmAndClearList(activeList, 'active');
});

clearInProgressBtn.addEventListener('click', () => {
    confirmAndClearList(inProgressList, 'in-progress');
});

clearCompletedBtn.addEventListener('click', () => {
    confirmAndClearList(completedList, 'completed');
});

// Initial counter/empty-state sync on first load.
updateCounts();
