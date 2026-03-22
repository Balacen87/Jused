/**
 * SeededRNG.js — детерминированный генератор случайных чисел (LCG).
 *
 * Преимущества перед Math.random():
 *  - Воспроизводимые сценарии — один seed = один исход
 *  - Тестируемость — можно подменить seed и проверить граничные случаи
 *  - Replay-система — сохрани seed и воспроизведи ход дела
 *  - Ветвление — clone() создаёт независимый fork генератора
 *
 * Алгоритм: LCG (Knuth / Numerical Recipes parameters)
 *  State(n+1) = (1664525 × State(n) + 1013904223) mod 2³²
 */
export class SeededRNG {
    /**
     * @param {number|string} seed — число или строка (хешируется автоматически)
     */
    constructor(seed) {
        this.seed = typeof seed === 'string'
            ? SeededRNG._hashString(seed)
            : (seed || Math.floor(Math.random() * 0xFFFFFFFF));
        this._state = this.seed;
        this._callCount = 0;
    }

    // ─── Базовые генераторы ──────────────────────────────────────────────────

    /** Равномерное вещественное число в [0, 1). */
    next() {
        this._state = (1664525 * this._state + 1013904223) >>> 0; // unsigned 32-bit
        this._callCount++;
        return this._state / 0x100000000;
    }

    /** Целое число в диапазоне [min, max] (включительно). */
    int(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /** Вещественное число в [min, max] с заданным порядком точности. */
    float(min, max, decimals = 3) {
        return +(min + this.next() * (max - min)).toFixed(decimals);
    }

    /** Случайный элемент массива. */
    choice(arr) {
        if (!arr.length) return undefined;
        return arr[this.int(0, arr.length - 1)];
    }

    /** Случайные N элементов без повторений (shuffle + slice). */
    sample(arr, n) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy.slice(0, Math.min(n, copy.length));
    }

    /** Случайная строка заданной длины. */
    string(len, charset = 'abcdefghijklmnopqrstuvwxyz0123456789') {
        return Array.from({ length: len }, () => charset[this.int(0, charset.length - 1)]).join('');
    }

    /**
     * Взвешенный случайный выбор.
     * @param {Array<{item: any, weight: number}>} weighted
     * @returns {any}
     */
    weighted(weighted) {
        const total = weighted.reduce((s, w) => s + w.weight, 0);
        let roll = this.next() * total;
        for (const { item, weight } of weighted) {
            roll -= weight;
            if (roll <= 0) return item;
        }
        return weighted[weighted.length - 1].item;
    }

    /** Бросок монеты: вернуть true с вероятностью p. */
    chance(p) { return this.next() < p; }

    // ─── Управление состоянием ───────────────────────────────────────────────

    /** Сброс к исходному seed (для юнит-тестов). */
    reset() {
        this._state    = this.seed;
        this._callCount = 0;
        return this;
    }

    /**
     * Создаёт независимый fork с текущим состоянием.
     * Используется для параллельных симуляций (напр., defense + prosecution).
     */
    clone() {
        const c = new SeededRNG(this.seed);
        c._state     = this._state;
        c._callCount = this._callCount;
        return c;
    }

    /** Сериализация для сохранения состояния (save/load). */
    toJSON() {
        return { seed: this.seed, state: this._state, calls: this._callCount };
    }

    /** Восстановление из сериализованного состояния. */
    static fromJSON({ seed, state, calls }) {
        const rng = new SeededRNG(seed);
        rng._state     = state;
        rng._callCount = calls;
        return rng;
    }

    // ─── Внутреннее ─────────────────────────────────────────────────────────

    static _hashString(str) {
        let h = 0xDEADBEEF;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 0x9E3779B9);
        }
        return Math.abs((h ^ (h >>> 16)) >>> 0);
    }
}

/** Глобальный экземпляр по умолчанию (может быть заменён в тестах). */
export const globalRNG = new SeededRNG(Date.now());
