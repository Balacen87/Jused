/**
 * EventBus.js — типизированная шина событий с аудит-трейлом.
 *
 * Паттерн: Observer / Pub-Sub
 * Применение: decoupling между Orchestrator, UI, и системами вердикта.
 *
 * Поддерживаемые события:
 *  ExpertiseCompleted   — экспертиза сгенерирована
 *  BribeAttempted       — попытка подкупа
 *  BribeAccepted        — взятка принята
 *  ReputationChanged    — изменение репутации эксперта
 *  RetestRequested      — запрошена повторная экспертиза
 *  ExpertFatigued       — эксперт достиг burnout
 *  FakeDetected         — обнаружена фальсификация
 */
export class EventBus {

    constructor({ maxAuditLength = 200 } = {}) {
        /** @type {Map<string, Set<Function>>} */
        this._handlers   = new Map();
        /** @type {DomainEvent[]} */
        this._auditTrail = [];
        this._maxAudit   = maxAuditLength;
        this._paused     = false;
    }

    // ─── Subscribe / Unsubscribe ─────────────────────────────────────────────

    /**
     * Подписка на тип события.
     * @param {string}   eventType
     * @param {Function} handler  (event) => void
     * @returns {Function} unsubscribe — вызови, чтобы отписаться
     */
    on(eventType, handler) {
        if (!this._handlers.has(eventType)) this._handlers.set(eventType, new Set());
        this._handlers.get(eventType).add(handler);
        return () => this.off(eventType, handler);
    }

    /**
     * Одноразовая подписка — сработает один раз и автоматически отпишется.
     */
    once(eventType, handler) {
        const wrapper = (event) => { handler(event); this.off(eventType, wrapper); };
        return this.on(eventType, wrapper);
    }

    off(eventType, handler) {
        this._handlers.get(eventType)?.delete(handler);
    }

    // ─── Publish ─────────────────────────────────────────────────────────────

    /**
     * Публикация события всем подписчикам.
     * @param {string} eventType
     * @param {object} payload
     */
    publish(eventType, payload = {}) {
        const event = new DomainEvent(eventType, payload);

        // Аудит
        this._auditTrail.push(event);
        if (this._auditTrail.length > this._maxAudit) this._auditTrail.shift();

        if (this._paused) return;

        this._handlers.get(eventType)?.forEach(fn => {
            try { fn(event); }
            catch (e) { console.error(`[EventBus] Handler error for "${eventType}":`, e); }
        });

        // Wildcard — подписчики на '*' получают все события
        this._handlers.get('*')?.forEach(fn => {
            try { fn(event); }
            catch (e) { console.error(`[EventBus] Wildcard handler error:`, e); }
        });
    }

    // ─── Управление ──────────────────────────────────────────────────────────

    pause()  { this._paused = true; }
    resume() { this._paused = false; }

    /** Аудит-трейл всех событий (для отладки и системы сохранения). */
    getAuditTrail(eventType = null) {
        return eventType
            ? this._auditTrail.filter(e => e.type === eventType)
            : [...this._auditTrail];
    }

    /** Фильтрация аудита по caseId. */
    getAuditForCase(caseId) {
        return this._auditTrail.filter(e => e.payload?.caseId === caseId);
    }

    /** Очистка подписчиков (для юнит-тестов). */
    clear() {
        this._handlers.clear();
        this._auditTrail = [];
    }

    /** Количество активных подписчиков. */
    get subscriberCount() {
        let count = 0;
        this._handlers.forEach(s => count += s.size);
        return count;
    }
}

// ─── DomainEvent ─────────────────────────────────────────────────────────────

export class DomainEvent {
    constructor(type, payload = {}) {
        this.id        = `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
        this.type      = type;
        this.payload   = Object.freeze({ ...payload });
        this.timestamp = Date.now();
    }

    toJSON() {
        return { id: this.id, type: this.type, payload: this.payload, timestamp: this.timestamp };
    }
}

// ─── Константы типов событий ─────────────────────────────────────────────────

export const EVENTS = Object.freeze({
    EXPERTISE_COMPLETED:   'ExpertiseCompleted',
    EXPERTISE_INCONCLUSIVE:'ExpertiseInconclusive',
    BRIBE_ATTEMPTED:       'BribeAttempted',
    BRIBE_ACCEPTED:        'BribeAccepted',
    BRIBE_REJECTED:        'BribeRejected',
    REPUTATION_CHANGED:    'ReputationChanged',
    RETEST_REQUESTED:      'RetestRequested',
    EXPERT_FATIGUED:       'ExpertFatigued',
    FAKE_DETECTED:         'FakeDetected',
    CHALLENGE_FILED:       'ChallengeFiled',
});

/** Глобальная шина событий (синглтон). */
export const globalEventBus = new EventBus();
