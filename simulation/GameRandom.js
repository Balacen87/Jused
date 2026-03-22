/**
 * Утилиты для детерминированной симуляции.
 */

export class GameRandom {
    /**
     * Создаёт генератор псевдослучайных чисел (PCG-подобная простая реализация LCG).
     * @param {number|string} seed
     */
    constructor(seed = Date.now()) {
        this.state = this._hashString(String(seed));
    }

    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
        }
        return hash === 0 ? 1 : hash; // 0 нельзя
    }

    /** Генерирует число от 0 до 1 (исключая 1) */
    next() {
        this.state = Math.imul(this.state, 1664525) + 1013904223 | 0;
        // Возвращаем положительное число [0, 1)
        return (this.state >>> 0) / 4294967296;
    }

    /** Ограничение в пределах [min, max] */
    between(min, max) {
        return min + this.next() * (max - min);
    }

    /** Случайное целое [min, max] */
    int(min, max) {
        return Math.floor(this.between(min, max + 1));
    }

    /** Выбрать элемент из массива */
    pick(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(this.next() * arr.length)];
    }

    /** Вероятность chance (0.0 - 1.0) */
    chance(prob) {
        return this.next() < prob;
    }
}
