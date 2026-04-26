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
const timerTextInput = document.getElementById('timer-text-input');
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
    const safeSeconds = Math.max(0, Math.floor(secs));
    const h = Math.floor(safeSeconds / 3600);
    const m = Math.floor((safeSeconds % 3600) / 60);
    const s = safeSeconds % 60;

    if (h > 0) {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

    const displayText = formatTime(totalSeconds);

    timerDisplay.textContent = displayText;
    timerDisplay.style.setProperty('--timer-color', timerColor);
    timerDisplay.style.setProperty('--timer-glow', timerGlow);
    timerDisplay.style.setProperty('--timer-shadow', timerShadow);
    timerDisplay.classList.toggle('danger',  isRunning && totalSeconds <= 60);
    timerDisplay.classList.toggle('running', isRunning && totalSeconds > 60);
    timerDisplay.classList.toggle('hour-format', displayText.includes(':') && displayText.split(':').length === 3);

    if (timerTextInput && document.activeElement !== timerTextInput) {
        timerTextInput.value = formatTime(totalSeconds);
    }
}

function updateTimerPalette() {
    timerPalette = {
        start: timerColorStartInput.value,
        mid: timerColorMidInput.value,
        end: timerColorEndInput.value
    };
    saveTimerPalette();
    updateDisplay();
    refreshAllTaskTimerDisplays();
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

// Parse global timer text input (MM:SS, HH:MM:SS, or minutes).
function parseGlobalTimerText(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) return null;

    const lowerValue = value.toLowerCase();
    const unitPattern = /(-?\d+(?:\.\d+)?)\s*([hms])/g;
    let unitMatch;
    let unitSeconds = 0;
    let lastUnitMatchIndex = 0;

    while ((unitMatch = unitPattern.exec(lowerValue)) !== null) {
        const amount = Number(unitMatch[1]);
        if (!Number.isFinite(amount) || amount < 0) return null;

        const unit = unitMatch[2];
        if (unit === 'h') unitSeconds += amount * 3600;
        if (unit === 'm') unitSeconds += amount * 60;
        if (unit === 's') unitSeconds += amount;

        lastUnitMatchIndex = unitPattern.lastIndex;
    }

    if (lastUnitMatchIndex > 0) {
        const remainingText = lowerValue.slice(lastUnitMatchIndex).trim();
        if (remainingText.length > 0) return null;
        return Math.max(0, Math.floor(unitSeconds));
    }

    if (value.includes(':')) {
        const chunks = value.split(':').map((chunk) => Number(chunk));
        if (chunks.some((chunk) => !Number.isFinite(chunk) || chunk < 0)) {
            return null;
        }

        if (chunks.length === 2) {
            const [mm, ss] = chunks;
            if (ss > 59) return null;
            return Math.max(0, (Math.floor(mm) * 60) + Math.floor(ss));
        }

        if (chunks.length === 3) {
            const [hh, mm, ss] = chunks;
            if (mm > 59 || ss > 59) return null;
            return Math.max(0, (Math.floor(hh) * 3600) + (Math.floor(mm) * 60) + Math.floor(ss));
        }

        return null;
    }

    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes < 0) return null;

    return Math.max(0, Math.floor(minutes * 60));
}

// Apply parsed value to global timer.
function applyGlobalTimerTextValue(rawValue) {
    const nextSeconds = parseGlobalTimerText(rawValue);
    if (nextSeconds === null || nextSeconds === undefined) {
        updateDisplay();
        return;
    }

    if (isRunning) return;

    totalSeconds = nextSeconds;
    sessionDurationSeconds = Math.max(nextSeconds, 1);
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
    refreshAllTaskTimerDisplays();
});

// Wire global timer text input.
timerTextInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyGlobalTimerTextValue(timerTextInput.value);
    timerTextInput.blur();
});

timerTextInput.addEventListener('blur', () => {
    applyGlobalTimerTextValue(timerTextInput.value);
});

// Initial render on page load.
loadTimerPalette();
syncTimerColorInputs();
updateDisplay();

// ── Task list ──
const TASKS_STORAGE_KEY = 'quest-log-tasks-v1';
const TASK_TIMER_DEFAULT_SECONDS = 25 * 60;
const TASK_TIMER_STEP_SECONDS = 60;
const TASK_TIMER_MAX_SECONDS = 4 * 60 * 60;

const taskTimerIntervals = new Map();

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

function clampTaskTimerSeconds(value) {
    return Math.min(Math.max(value, 0), TASK_TIMER_MAX_SECONDS);
}

function parseTaskNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTaskBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return fallback;
}

function generateTaskId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `task-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function normalizeTaskState(value) {
    if (value === 'in-progress' || value === 'completed') return value;
    return 'active';
}

function normalizeHexColor(value) {
    const color = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : '';
}

function normalizeTaskRecord(rawTask) {
    const duration = clampTaskTimerSeconds(
        parseTaskNumber(rawTask.timerDurationSeconds, TASK_TIMER_DEFAULT_SECONDS)
    );
    const remaining = clampTaskTimerSeconds(
        parseTaskNumber(rawTask.timerRemainingSeconds, duration)
    );
    const running = parseTaskBoolean(rawTask.timerRunning, false) && remaining > 0;

    return {
        id: rawTask.id || generateTaskId(),
        text: String(rawTask.text || '').trim(),
        state: normalizeTaskState(rawTask.state),
        timerDurationSeconds: Math.max(duration, 1),
        timerRemainingSeconds: remaining,
        timerRunning: running,
        timerLastTickAt: running
            ? parseTaskNumber(rawTask.timerLastTickAt, Date.now())
            : null,
        timerCustomColor: normalizeHexColor(rawTask.timerCustomColor),
        createdAt: parseTaskNumber(rawTask.createdAt, Date.now())
    };
}

function applyElapsedTimeToTask(task) {
    if (!task.timerRunning || !task.timerLastTickAt) return task;

    const elapsedSeconds = Math.floor((Date.now() - task.timerLastTickAt) / 1000);
    if (elapsedSeconds <= 0) return task;

    const nextRemaining = clampTaskTimerSeconds(task.timerRemainingSeconds - elapsedSeconds);
    task.timerRemainingSeconds = nextRemaining;

    if (nextRemaining <= 0) {
        task.timerRunning = false;
        task.timerLastTickAt = null;
    } else {
        task.timerLastTickAt = Date.now();
    }

    return task;
}

function getAllTaskItems() {
    return [
        ...activeList.querySelectorAll('li'),
        ...inProgressList.querySelectorAll('li'),
        ...completedList.querySelectorAll('li')
    ];
}

function serializeTaskItem(li) {
    const text = li.querySelector('.task-text')?.textContent || '';
    const createdAt = parseTaskNumber(li.dataset.createdAt, Date.now());
    const duration = Math.max(1, clampTaskTimerSeconds(parseTaskNumber(
        li.dataset.timerDurationSeconds,
        TASK_TIMER_DEFAULT_SECONDS
    )));
    const remaining = clampTaskTimerSeconds(parseTaskNumber(
        li.dataset.timerRemainingSeconds,
        duration
    ));
    const running = parseTaskBoolean(li.dataset.timerRunning, false) && remaining > 0;

    return {
        id: li.dataset.taskId || generateTaskId(),
        text,
        state: normalizeTaskState(li.dataset.state),
        timerDurationSeconds: duration,
        timerRemainingSeconds: remaining,
        timerRunning: running,
        timerLastTickAt: running ? parseTaskNumber(li.dataset.timerLastTickAt, Date.now()) : null,
        timerCustomColor: normalizeHexColor(li.dataset.timerCustomColor),
        createdAt
    };
}

function saveTasks() {
    const payload = getAllTaskItems().map(serializeTaskItem);
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(payload));
}

function loadTasks() {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map(normalizeTaskRecord)
            .filter((task) => task.text.length > 0)
            .map(applyElapsedTimeToTask);
    } catch (_) {
        return [];
    }
}

function showTaskTimerDoneNotification(taskText) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
        new Notification('Task Timer Complete', {
            body: `Finished: ${taskText}`,
            tag: `quest-log-task-timer-${taskText}`
        });
    } catch (_) { }
}

function stopTaskTimerInterval(taskId) {
    const existing = taskTimerIntervals.get(taskId);
    if (!existing) return;
    clearInterval(existing);
    taskTimerIntervals.delete(taskId);
}

function updateTaskTimerDisplay(li) {
    const remaining = clampTaskTimerSeconds(parseTaskNumber(li.dataset.timerRemainingSeconds, 0));
    const duration = Math.max(1, clampTaskTimerSeconds(parseTaskNumber(
        li.dataset.timerDurationSeconds,
        TASK_TIMER_DEFAULT_SECONDS
    )));
    const isTaskRunning = parseTaskBoolean(li.dataset.timerRunning, false) && remaining > 0;
    const remainingRatio = Math.min(Math.max(remaining / duration, 0), 1);
    const phaseColor = remainingRatio > (2 / 3)
        ? timerPalette.start
        : remainingRatio > (1 / 3)
            ? timerPalette.mid
            : timerPalette.end;
    const customColor = normalizeHexColor(li.dataset.timerCustomColor);
    const displayColor = customColor || phaseColor;
    const displayColorRgb = hexToRgb(displayColor);

    const display = li.querySelector('.task-timer-display');
    const textInput = li.querySelector('.task-timer-text-input');
    const colorInput = li.querySelector('.task-timer-color-input');
    const toggleBtn = li.querySelector('.task-timer-toggle-btn');
    const minusBtn = li.querySelector('.task-timer-minus-btn');
    const plusBtn = li.querySelector('.task-timer-plus-btn');

    display.textContent = formatTime(remaining);
    display.style.setProperty('--task-timer-color', displayColor);
    display.style.setProperty('--task-timer-glow', rgbToCss(displayColorRgb, 0.7));
    display.classList.toggle('running', isTaskRunning);
    display.classList.toggle('danger', isTaskRunning && remaining <= 60);
    display.classList.toggle('done', remaining <= 0);

    if (textInput && document.activeElement !== textInput) {
        textInput.value = formatTime(remaining);
    }

    if (colorInput && document.activeElement !== colorInput) {
        colorInput.value = customColor || phaseColor;
    }

    toggleBtn.textContent = isTaskRunning ? 'PAUSE' : 'START';
    toggleBtn.disabled = !isTaskRunning && remaining <= 0;
    minusBtn.disabled = remaining <= 0;
    plusBtn.disabled = remaining >= TASK_TIMER_MAX_SECONDS;
}

function refreshAllTaskTimerDisplays() {
    getAllTaskItems().forEach((li) => {
        updateTaskTimerDisplay(li);
    });
}

function pauseTaskTimer(li, options = {}) {
    const { playSound = true, shouldSave = true } = options;

    li.dataset.timerRunning = 'false';
    li.dataset.timerLastTickAt = '';
    stopTaskTimerInterval(li.dataset.taskId);

    updateTaskTimerDisplay(li);
    if (playSound) playTimerStop();
    if (shouldSave) saveTasks();
}

function finishTaskTimer(li, shouldSave = true) {
    li.dataset.timerRemainingSeconds = '0';
    li.dataset.timerRunning = 'false';
    li.dataset.timerLastTickAt = '';
    stopTaskTimerInterval(li.dataset.taskId);

    updateTaskTimerDisplay(li);
    playAlarm();

    const taskText = li.querySelector('.task-text')?.textContent || 'Task';
    showTaskTimerDoneNotification(taskText);

    if (shouldSave) saveTasks();
}

function tickTaskTimer(li) {
    if (!document.body.contains(li)) {
        stopTaskTimerInterval(li.dataset.taskId);
        return;
    }

    const isTaskRunning = parseTaskBoolean(li.dataset.timerRunning, false);
    if (!isTaskRunning) {
        stopTaskTimerInterval(li.dataset.taskId);
        return;
    }

    const remaining = clampTaskTimerSeconds(parseTaskNumber(li.dataset.timerRemainingSeconds, 0));
    if (remaining <= 0) {
        finishTaskTimer(li);
        return;
    }

    const nextRemaining = clampTaskTimerSeconds(remaining - 1);
    li.dataset.timerRemainingSeconds = String(nextRemaining);
    li.dataset.timerLastTickAt = String(Date.now());

    if (nextRemaining <= 0) {
        finishTaskTimer(li);
        return;
    }

    updateTaskTimerDisplay(li);
    saveTasks();
}

function startTaskTimer(li, options = {}) {
    const { playSound = true, shouldSave = true } = options;
    const remaining = clampTaskTimerSeconds(parseTaskNumber(li.dataset.timerRemainingSeconds, 0));

    if (remaining <= 0) return;
    if (taskTimerIntervals.has(li.dataset.taskId)) return;

    li.dataset.timerRunning = 'true';
    li.dataset.timerLastTickAt = String(Date.now());

    const taskInterval = setInterval(() => {
        tickTaskTimer(li);
    }, 1000);

    taskTimerIntervals.set(li.dataset.taskId, taskInterval);
    updateTaskTimerDisplay(li);

    if (playSound) playTimerStart();
    if (shouldSave) saveTasks();
}

function toggleTaskTimer(li) {
    const isTaskRunning = parseTaskBoolean(li.dataset.timerRunning, false);
    if (isTaskRunning) {
        pauseTaskTimer(li);
        return;
    }

    primeNotificationPermission();
    startTaskTimer(li);
}

function resetTaskTimer(li) {
    pauseTaskTimer(li, { playSound: false, shouldSave: false });

    li.dataset.timerDurationSeconds = String(TASK_TIMER_DEFAULT_SECONDS);
    li.dataset.timerRemainingSeconds = String(TASK_TIMER_DEFAULT_SECONDS);
    updateTaskTimerDisplay(li);
    saveTasks();
}

function adjustTaskTimer(li, deltaSeconds) {
    const currentRemaining = clampTaskTimerSeconds(parseTaskNumber(li.dataset.timerRemainingSeconds, 0));
    const nextRemaining = clampTaskTimerSeconds(currentRemaining + deltaSeconds);

    li.dataset.timerRemainingSeconds = String(nextRemaining);

    const duration = Math.max(1, clampTaskTimerSeconds(parseTaskNumber(
        li.dataset.timerDurationSeconds,
        TASK_TIMER_DEFAULT_SECONDS
    )));

    if (nextRemaining > duration) {
        li.dataset.timerDurationSeconds = String(nextRemaining);
    }

    if (nextRemaining <= 0) {
        pauseTaskTimer(li, { playSound: false, shouldSave: false });
    }

    updateTaskTimerDisplay(li);
    saveTasks();
}

function parseTaskTimerTextToSeconds(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) return null;

    if (value.includes(':')) {
        const chunks = value.split(':').map((chunk) => Number(chunk));
        if (chunks.some((chunk) => !Number.isFinite(chunk) || chunk < 0)) {
            return null;
        }

        if (chunks.length === 2) {
            const [mm, ss] = chunks;
            if (ss > 59) return null;
            return clampTaskTimerSeconds((Math.floor(mm) * 60) + Math.floor(ss));
        }

        if (chunks.length === 3) {
            const [hh, mm, ss] = chunks;
            if (mm > 59 || ss > 59) return null;
            return clampTaskTimerSeconds((Math.floor(hh) * 3600) + (Math.floor(mm) * 60) + Math.floor(ss));
        }

        return null;
    }

    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes < 0) return null;

    return clampTaskTimerSeconds(Math.floor(minutes * 60));
}

function applyTaskTimerTextValue(li, rawValue) {
    const nextSeconds = parseTaskTimerTextToSeconds(rawValue);
    if (nextSeconds === null) {
        updateTaskTimerDisplay(li);
        return;
    }

    if (nextSeconds <= 0) {
        pauseTaskTimer(li, { playSound: false, shouldSave: false });
    }

    li.dataset.timerDurationSeconds = String(Math.max(nextSeconds, 1));
    li.dataset.timerRemainingSeconds = String(nextSeconds);
    updateTaskTimerDisplay(li);
    saveTasks();
}

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

    listEl.querySelectorAll('li').forEach((li) => {
        pauseTaskTimer(li, { playSound: false, shouldSave: false });
    });
    listEl.innerHTML = '';
    updateCounts();
    saveTasks();
}

function setTaskState(li, state, shouldPlayMoveSound = false, shouldSave = true) {
    const checkbox = li.querySelector('input[type="checkbox"]');
    const taskText = li.querySelector('.task-text');
    const statusBtn = li.querySelector('.task-status-btn');

    li.dataset.state = state;

    if (state === 'completed') {
        pauseTaskTimer(li, { playSound: false, shouldSave: false });
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
    if (shouldSave) saveTasks();
}

// Attach change behavior to one checkbox.
function attachCheckboxListener(checkbox) {
    checkbox.addEventListener('change', () => {
        const li = checkbox.closest('li');
        if (checkbox.checked) {
            setTaskState(li, 'completed', false, true);
            playTaskDone();
        } else {
            setTaskState(li, 'active', false, true);
        }
    });
}

function attachStatusButtonListener(button) {
    button.addEventListener('click', () => {
        const li = button.closest('li');
        const nextState = li.dataset.state === 'in-progress' ? 'active' : 'in-progress';
        setTaskState(li, nextState, nextState === 'in-progress', true);
    });
}

function attachDeleteButtonListener(deleteBtn, confirmWrap, yesBtn, noBtn) {
    function showConfirmButtons() {
        deleteBtn.style.display = 'none';
        confirmWrap.style.display = 'flex';
    }

    function hideConfirmButtons() {
        confirmWrap.style.display = 'none';
        deleteBtn.style.display = 'inline-block';
    }

    deleteBtn.addEventListener('click', () => {
        showConfirmButtons();
    });

    noBtn.addEventListener('click', () => {
        hideConfirmButtons();
    });

    yesBtn.addEventListener('click', () => {
        const li = deleteBtn.closest('li');
        pauseTaskTimer(li, { playSound: false, shouldSave: false });
        li.remove();
        playTaskDelete();
        updateCounts();
        saveTasks();
    });
}

function attachTaskTimerListeners(li, minusBtn, plusBtn, toggleBtn, resetBtnEl, textInput, colorInput) {
    minusBtn.addEventListener('click', () => {
        adjustTaskTimer(li, -TASK_TIMER_STEP_SECONDS);
    });

    plusBtn.addEventListener('click', () => {
        adjustTaskTimer(li, TASK_TIMER_STEP_SECONDS);
    });

    toggleBtn.addEventListener('click', () => {
        toggleTaskTimer(li);
    });

    resetBtnEl.addEventListener('click', () => {
        resetTaskTimer(li);
    });

    textInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        applyTaskTimerTextValue(li, textInput.value);
        textInput.blur();
    });

    textInput.addEventListener('blur', () => {
        applyTaskTimerTextValue(li, textInput.value);
    });

    colorInput.addEventListener('input', () => {
        li.dataset.timerCustomColor = normalizeHexColor(colorInput.value);
        updateTaskTimerDisplay(li);
        saveTasks();
    });
}

function createTaskItem(task) {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    const span = document.createElement('span');
    const timerPanel = document.createElement('div');
    const timerDisplayEl = document.createElement('span');
    const timerAdjustRow = document.createElement('div');
    const timerInputRow = document.createElement('div');
    const timerTextInput = document.createElement('input');
    const timerColorWrap = document.createElement('label');
    const timerColorHint = document.createElement('span');
    const timerColorInput = document.createElement('input');
    const timerMinusBtn = document.createElement('button');
    const timerPlusBtn = document.createElement('button');
    const timerActionRow = document.createElement('div');
    const timerToggleBtn = document.createElement('button');
    const timerResetBtn = document.createElement('button');
    const statusBtn = document.createElement('button');
    const deleteBtn = document.createElement('button');
    const deleteConfirmWrap = document.createElement('div');
    const deleteYesBtn = document.createElement('button');
    const deleteNoBtn = document.createElement('button');

    li.dataset.taskId = task.id;
    li.dataset.createdAt = String(task.createdAt);
    li.dataset.timerDurationSeconds = String(task.timerDurationSeconds);
    li.dataset.timerRemainingSeconds = String(task.timerRemainingSeconds);
    li.dataset.timerRunning = task.timerRunning ? 'true' : 'false';
    li.dataset.timerLastTickAt = task.timerLastTickAt ? String(task.timerLastTickAt) : '';
    li.dataset.timerCustomColor = normalizeHexColor(task.timerCustomColor);

    checkbox.type = 'checkbox';
    span.className = 'task-text';
    span.textContent = task.text;

    timerPanel.className = 'task-timer-panel';
    timerDisplayEl.className = 'task-timer-display';
    timerDisplayEl.textContent = formatTime(task.timerRemainingSeconds);

    timerTextInput.type = 'text';
    timerTextInput.className = 'task-timer-text-input';
    timerTextInput.inputMode = 'numeric';
    timerTextInput.placeholder = 'MM:SS / HH:MM:SS / min';
    timerTextInput.value = formatTime(task.timerRemainingSeconds);

    timerInputRow.className = 'task-timer-input-row';
    timerColorWrap.className = 'task-timer-color-wrap';
    timerColorHint.className = 'task-timer-color-hint';
    timerColorHint.textContent = 'CLR';

    timerColorInput.type = 'color';
    timerColorInput.className = 'task-timer-color-input';
    timerColorInput.value = normalizeHexColor(task.timerCustomColor) || timerPalette.start;

    timerAdjustRow.className = 'task-timer-row';
    timerMinusBtn.type = 'button';
    timerMinusBtn.className = 'task-timer-minus-btn';
    timerMinusBtn.textContent = '-1M';
    timerPlusBtn.type = 'button';
    timerPlusBtn.className = 'task-timer-plus-btn';
    timerPlusBtn.textContent = '+1M';

    timerActionRow.className = 'task-timer-row';
    timerToggleBtn.type = 'button';
    timerToggleBtn.className = 'task-timer-toggle-btn';
    timerToggleBtn.textContent = 'START';
    timerResetBtn.type = 'button';
    timerResetBtn.className = 'task-timer-reset-btn';
    timerResetBtn.textContent = 'RESET';

    statusBtn.type = 'button';
    statusBtn.className = 'task-status-btn';
    statusBtn.textContent = 'START';

    deleteBtn.type = 'button';
    deleteBtn.className = 'task-delete-btn';
    deleteBtn.textContent = 'DELETE';

    deleteConfirmWrap.className = 'task-delete-confirm';
    deleteYesBtn.type = 'button';
    deleteYesBtn.className = 'task-delete-yes-btn';
    deleteYesBtn.textContent = 'YES';
    deleteNoBtn.type = 'button';
    deleteNoBtn.className = 'task-delete-no-btn';
    deleteNoBtn.textContent = 'NO';

    timerAdjustRow.appendChild(timerMinusBtn);
    timerAdjustRow.appendChild(timerPlusBtn);
    timerActionRow.appendChild(timerToggleBtn);
    timerActionRow.appendChild(timerResetBtn);

    timerColorWrap.appendChild(timerColorHint);
    timerColorWrap.appendChild(timerColorInput);
    timerInputRow.appendChild(timerTextInput);
    timerInputRow.appendChild(timerColorWrap);

    timerPanel.appendChild(timerDisplayEl);
    timerPanel.appendChild(timerInputRow);
    timerPanel.appendChild(timerAdjustRow);
    timerPanel.appendChild(timerActionRow);

    deleteConfirmWrap.appendChild(deleteYesBtn);
    deleteConfirmWrap.appendChild(deleteNoBtn);

    label.appendChild(checkbox);
    label.appendChild(span);

    li.appendChild(label);
    li.appendChild(timerPanel);
    li.appendChild(statusBtn);
    li.appendChild(deleteBtn);
    li.appendChild(deleteConfirmWrap);

    attachCheckboxListener(checkbox);
    attachStatusButtonListener(statusBtn);
    attachDeleteButtonListener(deleteBtn, deleteConfirmWrap, deleteYesBtn, deleteNoBtn);
    attachTaskTimerListeners(li, timerMinusBtn, timerPlusBtn, timerToggleBtn, timerResetBtn, timerTextInput, timerColorInput);
    updateTaskTimerDisplay(li);

    return li;
}

// Create and append a new task item from user input.
function addTask() {
    const text = newTaskInput.value.trim();
    if (!text) return;

    const task = normalizeTaskRecord({
        id: generateTaskId(),
        text,
        state: 'active',
        timerDurationSeconds: TASK_TIMER_DEFAULT_SECONDS,
        timerRemainingSeconds: TASK_TIMER_DEFAULT_SECONDS,
        timerRunning: false,
        createdAt: Date.now()
    });

    const li = createTaskItem(task);
    setTaskState(li, task.state, false, true);
    playAddTask();
    newTaskInput.value = '';
    newTaskInput.focus();
}

function hydrateTasksFromStorage() {
    const savedTasks = loadTasks();
    if (savedTasks.length === 0) return;

    savedTasks.forEach((task) => {
        const li = createTaskItem(task);
        setTaskState(li, task.state, false, false);

        if (task.timerRunning && task.timerRemainingSeconds > 0) {
            startTaskTimer(li, { playSound: false, shouldSave: false });
        } else {
            updateTaskTimerDisplay(li);
        }
    });

    saveTasks();
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
hydrateTasksFromStorage();
updateCounts();
