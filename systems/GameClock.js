/**
 * GameClock.js — Игровые часы симулятора судьи.
 *
 * 30 секунд реального времени = 1 игровой час.
 * Рабочий день: 09:00 – 18:00. После 18:00 часы перематываются на следующее утро.
 */
export class GameClock {
    /**
     * @param {Object} [opts]
     * @param {string} [opts.storageKey='gameClock']
     */
    constructor(opts = {}) {
        this._storageKey = opts.storageKey ?? 'gameClock';
        this._listeners  = new Set();

        // Игровое время — объект Date (используется только дата/время, не TZ)
        this._gameTime = null;
        this._realTickMs = 30_000; // 30 сек реального = 1 ч игрового
        this._tickTimer  = null;

        this._load();
    }

    // ─── Сериализация ────────────────────────────────────────────────────────

    _load() {
        try {
            const raw = localStorage.getItem(this._storageKey);
            if (raw) {
                const ts = parseInt(raw, 10);
                if (!isNaN(ts)) {
                    this._gameTime = new Date(ts);
                    return;
                }
            }
        } catch { /* ignore */ }
        // Начальная точка: пн, 10 марта 2025, 09:00
        this._gameTime = new Date(2025, 2, 10, 9, 0, 0, 0);
    }

    _save() {
        try {
            localStorage.setItem(this._storageKey, String(this._gameTime.getTime()));
        } catch { /* ignore */ }
    }

    // ─── Время ───────────────────────────────────────────────────────────────

    /** Текущее игровое время как Date */
    get now() { return new Date(this._gameTime); }

    /** Форматирует дату: «Понедельник, 10 марта 2025» */
    getDateFormatted() {
        return this._gameTime.toLocaleDateString('ru-RU', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    /** Форматирует время: «09:30» */
    getTimeFormatted() {
        return this._gameTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    /** Сдвигает игровое время на N часов и M минут */
    advance(hours = 0, minutes = 0) {
        this._gameTime = new Date(
            this._gameTime.getTime() + (hours * 60 + minutes) * 60_000
        );
        this._save();
        this._emit();
    }

    /** Переход к следующему рабочему дню (09:00 следующего дня) */
    nextDay() {
        const d = new Date(this._gameTime);
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        // Пропускаем выходные
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
        this._gameTime = d;
        this._save();
        this._emit();
    }

    // ─── Автотик ─────────────────────────────────────────────────────────────

    /** Запускает автоматический тик (30с реального = 1ч игрового) */
    startTick() {
        if (this._tickTimer) return;
        this._tickTimer = setInterval(() => {
            this._tick();
        }, this._realTickMs);
    }

    stopTick() {
        clearInterval(this._tickTimer);
        this._tickTimer = null;
    }

    _tick() {
        const h = this._gameTime.getHours();
        if (h >= 18) {
            this.nextDay();
        } else {
            this.advance(1, 0);
        }
    }

    // ─── Мини-календарь ──────────────────────────────────────────────────────

    /**
     * Возвращает данные для мини-календаря текущего месяца.
     * @returns {{ year:number, month:number, days: Array<{day:number|null, isToday:boolean, isFuture:boolean}> }}
     */
    getCalendarMonth() {
        const now   = this._gameTime;
        const year  = now.getFullYear();
        const month = now.getMonth();
        const today = now.getDate();

        const firstDay  = new Date(year, month, 1).getDay(); // 0=вс ... 6=сб
        const totalDays = new Date(year, month + 1, 0).getDate();

        // Стартуем с понедельника (рус. неделя)
        const startOffset = (firstDay + 6) % 7;

        const days = [];
        for (let i = 0; i < startOffset; i++) days.push({ day: null, isToday: false, isFuture: false });
        for (let d = 1; d <= totalDays; d++) {
            days.push({ day: d, isToday: d === today, isFuture: d > today });
        }
        return { year, month, days };
    }

    // ─── Подписки ─────────────────────────────────────────────────────────────

    /** @param {Function} fn */
    on(fn) { this._listeners.add(fn); }
    off(fn) { this._listeners.delete(fn); }

    _emit() {
        for (const fn of this._listeners) try { fn(this); } catch { /* ignore */ }
    }
}
