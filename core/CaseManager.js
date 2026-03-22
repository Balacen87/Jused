/**
 * CaseManager.js — менеджер прогресса дел.
 *
 * Улучшения v2 (по code review):
 *  - StorageAdapter — абстракция хранилища (localStorage → можно заменить)
 *  - Обработка JSON.parse/QuotaExceededError без краша игры
 *  - Валидация загружаемых данных (_validateProgress)
 *  - Схема версий + _runMigrations()
 *  - Экспорт / импорт прогресса (base64 + checksum)
 *  - EventTarget — реактивные события (progress:saved, case:completed, ...)
 *  - JSDoc типизация
 *  - _handleStorageFull: trim → keep-recent → prompt
 *  - _wasCaseCompleted — без лишнего JSON.parse
 */

// ─── StorageAdapter ──────────────────────────────────────────────────────────
class StorageAdapter {
    constructor(storage = localStorage, prefix = '') {
        this._storage = storage;
        this._prefix  = prefix;
    }
    _key(name)        { return `${this._prefix}${name}`; }
    get(key, def = null) {
        try {
            const raw = this._storage.getItem(this._key(key));
            return raw !== null ? JSON.parse(raw) : def;
        } catch { return def; }
    }
    set(key, value) {
        try {
            this._storage.setItem(this._key(key), JSON.stringify(value));
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') return 'quota';
            return false;
        }
    }
    remove(key) { try { this._storage.removeItem(this._key(key)); } catch {} }
    clear()     { try { this._storage.clear(); } catch {} }
    estimatedSize(key) {
        try { return (this._storage.getItem(this._key(key)) || '').length * 2; } // UTF-16
        catch { return 0; }
    }
}

// ─── Текущая версия схемы данных ──────────────────────────────────────────────
const SCHEMA_VERSION = 2;
const APP_VERSION    = '1.0.0';

// ─── CaseManager ─────────────────────────────────────────────────────────────

/**
 * @typedef {'guilty'|'not_guilty'|'mistrial'|null} Verdict
 *
 * @typedef {Object} CaseResult
 * @property {number}  score
 * @property {boolean} isCorrect
 * @property {Verdict} [verdict]
 * @property {string[]} [evidenceSummary]
 *
 * @typedef {Object} CompletedCase
 * @property {string}  date             — ISO timestamp
 * @property {number}  score
 * @property {boolean} isCorrect
 * @property {Verdict} verdict
 * @property {string[]} evidenceSummary
 *
 * @typedef {Object} GameProgress
 * @property {number}                      version
 * @property {Record<string, CompletedCase>} completedCases
 * @property {number}                      totalScore
 * @property {{ lastSaved: string|null, gameVersion: string }} metadata
 */

export class CaseManager extends EventTarget {

    /**
     * @param {object} [opts]
     * @param {StorageAdapter} [opts.storageAdapter]   — иньекция для тестов
     * @param {number}         [opts.version]          — целевая версия схемы
     */
    constructor({ storageAdapter, version = SCHEMA_VERSION } = {}) {
        super();
        this.storage    = storageAdapter ?? new StorageAdapter(localStorage, 'court_game:');
        this.version    = version;
        this.STORAGE_KEY = 'progress';

        this._migrationHandlers = {
            2: this._migrateToV2.bind(this),
        };
    }

    // ─── Публичный API ────────────────────────────────────────────────────────

    /**
     * Сохранить произвольный объект прогресса (используется CareerManager).
     * @param {object} data
     * @returns {boolean}
     */
    saveProgress(data) {
        return this.storage.set(this.STORAGE_KEY, data);
    }

    /**
     * Сохранить результат дела.
     * @param {string}     caseId
     * @param {CaseResult} result
     * @param {number}     totalScore
     * @returns {boolean}  Успешность сохранения
     */
    saveResult(caseId, result, totalScore) {
        const isNew      = !this._wasCaseCompleted(caseId);
        const progress   = this.loadProgress();

        progress.completedCases[caseId] = {
            date:            new Date().toISOString(),
            score:           result.score        ?? 0,
            isCorrect:       result.isCorrect    ?? false,
            verdict:         result.verdict      ?? null,
            evidenceSummary: result.evidenceSummary ?? [],
        };
        progress.totalScore          = totalScore;
        progress.metadata.lastSaved  = new Date().toISOString();

        const saved = this._save(progress);

        if (saved) {
            this.dispatchEvent(new CustomEvent('progress:saved', { detail: {
                caseId, totalScore, timestamp: Date.now(),
            }}));
            if (isNew) {
                this.dispatchEvent(new CustomEvent('case:completed', { detail: {
                    caseId, result, isNew: true,
                }}));
            }
        }

        return saved;
    }

    /**
     * Загрузить прогресс с валидацией и миграцией.
     * @returns {GameProgress}
     */
    loadProgress() {
        let data;
        try {
            data = this.storage.get(this.STORAGE_KEY);
        } catch (e) {
            console.warn('[CaseManager] Ошибка загрузки прогресса:', e);
            return this._createDefaultProgress();
        }

        if (!data || !this._validateProgress(data)) {
            return this._createDefaultProgress();
        }

        if ((data.version ?? 1) < this.version) {
            data = this._runMigrations(data);
            this._save(data); // сохраняем мигрированное
        }

        return data;
    }

    /**
     * Сброс прогресса.
     */
    reset() {
        this.storage.remove(this.STORAGE_KEY);
        this.dispatchEvent(new CustomEvent('progress:reset'));
    }

    /**
     * Экспорт прогресса в base64-строку с контрольной суммой.
     * @returns {string}
     */
    exportProgress() {
        const progress = this.loadProgress();
        const payload  = {
            version:     this.version,
            exportedAt:  new Date().toISOString(),
            gameVersion: APP_VERSION,
            progress,
            checksum:    this._checksum(progress),
        };
        return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    }

    /**
     * Импорт прогресса из base64-строки.
     * @param {string} encoded
     * @returns {{ success: boolean, error?: string }}
     */
    importProgress(encoded) {
        try {
            const payload  = JSON.parse(decodeURIComponent(escape(atob(encoded))));
            if (!payload?.progress) throw new Error('Неверный формат экспорта');
            if (payload.checksum !== undefined && payload.checksum !== this._checksum(payload.progress))
                throw new Error('Нарушена целостность данных (checksum)');

            let progress = payload.progress;
            if (!this._validateProgress(progress)) throw new Error('Повреждённая схема данных');

            if ((progress.version ?? 1) < this.version) {
                progress = this._runMigrations(progress);
            }

            this._save(progress);
            this.dispatchEvent(new CustomEvent('progress:imported', { detail: {
                sourceVersion: payload.version, importedAt: new Date().toISOString(),
            }}));
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /** Было ли дело завершено ранее? */
    isCaseCompleted(caseId) { return this._wasCaseCompleted(caseId); }

    /** Количество завершённых дел. */
    getCompletedCount() {
        return Object.keys(this.loadProgress().completedCases).length;
    }

    /** Общий счёт. */
    getTotalScore() {
        return this.loadProgress().totalScore;
    }

    // ─── Приватное ────────────────────────────────────────────────────────────

    /** @returns {GameProgress} */
    _createDefaultProgress() {
        return {
            version: this.version,
            completedCases: {},
            totalScore: 0,
            metadata: {
                lastSaved:   null,
                gameVersion: APP_VERSION,
            },
        };
    }

    _validateProgress(data) {
        return (
            data !== null &&
            typeof data === 'object' &&
            !Array.isArray(data) &&
            typeof data.completedCases === 'object' &&
            !Array.isArray(data.completedCases) &&
            typeof data.totalScore === 'number'
        );
    }

    /**
     * Сохраняет с обработкой QuotaExceededError.
     * @returns {boolean}
     */
    _save(progress) {
        const result = this.storage.set(this.STORAGE_KEY, progress);
        if (result === true)    return true;
        if (result === 'quota') return this._handleStorageFull(progress);
        return false;
    }

    _handleStorageFull(progress) {
        // Шаг 1: убрать metadata → сжать
        const slim = { ...progress, metadata: { lastSaved: progress.metadata?.lastSaved } };
        if (this.storage.set(this.STORAGE_KEY, slim) === true) return true;

        // Шаг 2: оставить только последние 50 завершённых дел
        const kept = this._keepRecentCases(progress.completedCases, 50);
        const trimmed = { ...slim, completedCases: kept };
        if (this.storage.set(this.STORAGE_KEY, trimmed) === true) {
            console.warn('[CaseManager] Хранилище почти заполнено — удалены старые дела');
            return true;
        }

        // Шаг 3 — крайний случай: предложить экспорт
        const exportStr = this.exportProgress();
        this.dispatchEvent(new CustomEvent('progress:storage_full', { detail: { exportStr } }));
        console.error('[CaseManager] Хранилище заполнено. Сохранение невозможно.');
        return false;
    }

    _keepRecentCases(cases, limit) {
        return Object.fromEntries(
            Object.entries(cases)
                .sort(([, a], [, b]) => new Date(b.date) - new Date(a.date))
                .slice(0, limit)
        );
    }

    _wasCaseCompleted(caseId) {
        const progress = this.storage.get(this.STORAGE_KEY);
        return !!(progress?.completedCases?.[caseId]);
    }

    // ─── Миграции ─────────────────────────────────────────────────────────────

    /**
     * Последовательно применяет все миграции до текущей версии.
     * @param {object} progress
     * @returns {GameProgress}
     */
    _runMigrations(progress) {
        let current = { ...progress };
        const fromVersion = current.version ?? 1;
        for (let v = fromVersion + 1; v <= this.version; v++) {
            if (this._migrationHandlers[v]) {
                current = this._migrationHandlers[v](current);
                current.version = v;
            }
        }
        return current;
    }

    /** Миграция v1 → v2: добавляет поле verdict и evidenceSummary к старым записям. */
    _migrateToV2(progress) {
        for (const caseData of Object.values(progress.completedCases)) {
            if (!caseData.verdict)         caseData.verdict = caseData.isCorrect ? 'guilty' : 'not_guilty';
            if (!caseData.evidenceSummary) caseData.evidenceSummary = [];
        }
        if (!progress.metadata) {
            progress.metadata = { lastSaved: null, gameVersion: APP_VERSION };
        }
        return progress;
    }

    // ─── Checksum ─────────────────────────────────────────────────────────────

    _checksum(obj) {
        const str = JSON.stringify(obj);
        let h = 0xDEADBEEF;
        for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x9E3779B9);
        return ((h ^ (h >>> 16)) >>> 0).toString(36);
    }
}

// Синглтон для удобного использования во всём проекте
export const caseManager = new CaseManager();
