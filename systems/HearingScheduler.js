/**
 * HearingScheduler.js — Планировщик судебных слушаний.
 *
 * Хранит очередь назначенных слушаний, проверяет пропущенные
 * и начисляет штрафы через CareerManager.
 */
export class HearingScheduler {

    static PENALTY_REPUTATION = -15; // % репутации за пропущенное слушание
    static PENALTY_SCORE      = -50; // очков за пропущенное слушание
    static RESCHEDULE_MAX_DAYS = 7;  // макс. кол-во дней переноса вперёд

    /**
     * @param {Object} opts
     * @param {import('../core/CareerManager.js').CareerManager} opts.career
     * @param {string} [opts.storageKey='hearingQueue']
     */
    constructor({ career, storageKey = 'hearingQueue' } = {}) {
        this._career = career;
        this._storageKey = storageKey;
        /** @type {HearingEntry[]} */
        this._queue = [];
        this._listeners = new Set(); // Подписчики на изменения очереди
        this._load();
    }

    // ─── Сериализация ─────────────────────────────────────────────────────────

    _load() {
        try {
            const raw = localStorage.getItem(this._storageKey);
            if (raw) this._queue = JSON.parse(raw);
        } catch { this._queue = []; }
    }

    _save() {
        try {
            // Не сохраняем полные caseData (слишком большие), только мета
            const slim = this._queue.map(e => ({
                id:          e.id,
                caseId:      e.caseId,
                caseMeta:    e.caseMeta,
                scheduledAt: e.scheduledAt,
                status:      e.status,
                penalty:     e.penalty,
            }));
            localStorage.setItem(this._storageKey, JSON.stringify(slim));
        } catch { /* ignore */ }
    }

    // ─── API ──────────────────────────────────────────────────────────────────

    /**
     * @typedef {Object} HearingEntry
     * @property {string}  id          — уникальный ID записи
     * @property {string}  caseId      — ID дела
     * @property {Object}  caseMeta    — {defendantName, description, type, label}
     * @property {Object}  caseData    — полные данные дела (не персистятся)
     * @property {number}  scheduledAt — timestamp игрового времени (ms)
     * @property {'pending'|'active'|'completed'|'missed'|'rescheduled'} status
     * @property {boolean} penalty     — был ли уже применён штраф
     */

    /**
     * Планирует слушание на конкретный игровой timestamp.
     * @param {Object} caseData
     * @param {number} gameTimestamp — Date.getTime() игрового времени
     * @returns {HearingEntry}
     */
    schedule(caseData, gameTimestamp) {
        const entry = {
            id:          `h_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
            caseId:      caseData.id,
            caseMeta: {
                defendantName: caseData.defendantName,
                description:   caseData.description,
                type:          caseData.type,
                label:         caseData.label || caseData.type,
            },
            caseData,
            scheduledAt: gameTimestamp,
            status:      'pending',
            penalty:     false,
        };
        this._queue.push(entry);
        this._save();
        this._emit('scheduled', entry);
        return entry;
    }

    /**
     * Перепланирует существующее слушание на новый timestamp.
     * @param {string} hearingId
     * @param {number} newGameTimestamp
     */
    reschedule(hearingId, newGameTimestamp) {
        const entry = this._queue.find(e => e.id === hearingId);
        if (!entry) return null;
        entry.scheduledAt = newGameTimestamp;
        entry.status = 'pending';
        entry.penalty = false;
        this._save();
        this._emit('rescheduled', entry);
        return entry;
    }

    /**
     * Помечает слушание активным (начато).
     * @param {string} hearingId
     */
    markActive(hearingId) {
        const entry = this._queue.find(e => e.id === hearingId);
        if (entry) { entry.status = 'active'; this._save(); }
    }

    /**
     * Помечает слушание завершённым (вердикт вынесен).
     * @param {string} hearingId
     */
    markCompleted(hearingId) {
        const entry = this._queue.find(e => e.id === hearingId);
        if (entry) { entry.status = 'completed'; this._save(); this._emit('completed', entry); }
    }

    /**
     * Проверяет пропущенные слушания на основе текущего игрового времени.
     * За каждое пропущенное начисляет штраф.
     * @param {GameClock} gameClock
     * @returns {HearingEntry[]} — пропущенные слушания
     */
    checkMissed(gameClock) {
        const now    = gameClock.now.getTime();
        const missed = [];

        for (const entry of this._queue) {
            if (entry.status !== 'pending') continue;
            // Слушание считается пропущенным, если его время уже прошло
            if (entry.scheduledAt < now && !entry.penalty) {
                entry.status  = 'missed';
                entry.penalty = true;
                this._applyMissedPenalty(entry);
                missed.push(entry);
            }
        }

        if (missed.length > 0) {
            this._save();
            this._emit('missed', missed);
        }
        return missed;
    }

    _applyMissedPenalty(entry) {
        if (this._career) {
            this._career.updateReputation('law',    HearingScheduler.PENALTY_REPUTATION);
            this._career.addScore(HearingScheduler.PENALTY_SCORE);
        }
        console.warn(`[HearingScheduler] Пропущено слушание: ${entry.caseMeta?.description}. Штраф применён.`);
    }

    // ─── Геттеры ──────────────────────────────────────────────────────────────

    /** Все записи очереди */
    getQueue() { return [...this._queue]; }

    /** Только ожидающие слушания */
    getPending() { return this._queue.filter(e => e.status === 'pending'); }

    /** Найти запись по ID */
    getById(hearingId) { return this._queue.find(e => e.id === hearingId) ?? null; }

    /** Найти активное слушание по делу */
    getActiveByCaseId(caseId) { return this._queue.find(e => e.caseId === caseId && e.status === 'active') ?? null; }

    /** Ближайшее запланированное слушание */
    getNext() {
        const pending = this.getPending().sort((a, b) => a.scheduledAt - b.scheduledAt);
        return pending[0] ?? null;
    }

    // ─── Подписки ─────────────────────────────────────────────────────────────

    /** @param {Function} fn */
    on(fn) { this._listeners.add(fn); }
    off(fn) { this._listeners.delete(fn); }

    _emit(event, data) {
        for (const fn of this._listeners) try { fn(event, data); } catch { /* ignore */ }
    }
}
