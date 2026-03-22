/**
 * CareerManager.js v2 — менеджер карьеры судьи.
 *
 * Улучшения (code review):
 *  - EventTarget: career:initialized, score_changed, reputation_changed, rank_up, save_failed, reset
 *  - _persist(): авто-сохранение после каждого изменения
 *  - RANK_CONFIG: конфигурируемые ранги (cases + score + reputation)
 *  - getRankProgress(): прогресс до следующего ранга по всем параметрам
 *  - hasFeature() / getScoreMultiplier(): разблокированные возможности
 *  - _checkRankUp(): автопроверка ранга после каждого изменения
 *  - updateReputation(): валидация + лог (≤100 записей) + события
 *  - addScore(): валидация, опыт, события
 *  - ReputationEffects: динамические эффекты от обеих репутаций
 *  - getCareerSummary(): сводка для UI
 *  - reset(): сброс с опциональным сохранением достижений
 *  - CaseManager-совместимость: принимает любой объект с saveProgress/loadProgress
 */

// ─── RANK_CONFIG ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RankConfig
 * @property {string}   id
 * @property {string}   name
 * @property {string}   icon
 * @property {number}   minCases
 * @property {number}   minScore
 * @property {{law:number, shadow:number}} minReputation
 * @property {{scoreMultiplier:number, unlockFeatures:string[]}} bonuses
 */

/** @type {RankConfig[]} */
export const RANK_CONFIG = [
    {
        id: 'justice_of_peace',
        name: 'Мировой судья',
        icon: '⚖️',
        minCases: 0,
        minScore: 0,
        minReputation: { law: 0, shadow: 0 },
        bonuses: {
            scoreMultiplier: 1.0,
            unlockFeatures: ['basic_cases'],
        },
    },
    {
        id: 'district_judge',
        name: 'Районный судья',
        icon: '🏛️',
        minCases: 5,
        minScore: 500,
        minReputation: { law: 30, shadow: 0 },
        bonuses: {
            scoreMultiplier: 1.2,
            unlockFeatures: ['basic_cases', 'appeals', 'expert_requests'],
        },
    },
    {
        id: 'regional_judge',
        name: 'Областной судья',
        icon: '🏛️✨',
        minCases: 15,
        minScore: 2000,
        minReputation: { law: 60, shadow: 0 },
        bonuses: {
            scoreMultiplier: 1.5,
            unlockFeatures: ['basic_cases', 'appeals', 'expert_requests', 'high_profile_cases'],
        },
    },
    {
        id: 'supreme_judge',
        name: 'Верховный судья',
        icon: '👑',
        minCases: 30,
        minScore: 5000,
        minReputation: { law: 85, shadow: 0 },
        bonuses: {
            scoreMultiplier: 2.0,
            unlockFeatures: ['basic_cases', 'appeals', 'expert_requests', 'high_profile_cases', 'legislative_influence'],
        },
    },
];

// ─── ReputationEffects ────────────────────────────────────────────────────────

export class ReputationEffects {
    static getEffects({ law = 0, shadow = 0 } = {}) {
        const effects = [];

        // Закон
        if (law >= 90) effects.push({ id: 'law_legendary',  name: 'Легенда правосудия',   description: 'Свидетели охотнее дают показания',      bonus: { witnessReliability: +0.15 } });
        else if (law >= 70) effects.push({ id: 'law_respected', name: 'Уважаемый судья',   description: 'Прокуратура предоставляет лучшие улики', bonus: { evidenceQuality: +0.10 } });
        else if (law < 20) effects.push({ id: 'law_tainted',   name: 'Скомпрометированный',description: 'Свидетели избегают сотрудничества',       penalty: { witnessReliability: -0.10 } });

        // Тень
        if (shadow >= 80) effects.push({ id: 'shadow_powerful',  name: 'Теневой авторитет',description: 'Доступ к неофициальным источникам',    bonus: { unlockUndergroundContacts: true } });
        else if (shadow >= 50) effects.push({ id: 'shadow_connected', name: 'Связи в тенях', description: 'Шанс получить информацию неофициально', bonus: { undergroundInfoChance: +0.20 } });

        // Конфликт
        if (law >= 70 && shadow >= 70) effects.push({
            id: 'double_agent', name: 'На грани',
            description: 'Вы играете на двух фронтах — риск разоблачения +20%',
            penalty: { exposureRisk: +0.20 },
        });

        return effects;
    }
}

// ─── CareerManager ────────────────────────────────────────────────────────────

/**
 * @typedef {'law'|'shadow'} ReputationType
 * @typedef {{law:number, shadow:number}} ReputationValues
 */

export class CareerManager extends EventTarget {

    /**
     * @param {object} storage   — объект с методами saveProgress/loadProgress
     * @param {object} [config]
     * @param {number} [config.reputationCap=100]
     */
    constructor(storage, config = {}) {
        super();
        this.storage = storage;
        this.config  = {
            reputationCap:      config.reputationCap      ?? 100,
            maxScorePerCase:    config.maxScorePerCase     ?? 10000,
            maxRepLogEntries:   config.maxRepLogEntries    ?? 100,
        };
        this.data           = null;
        this._initialized   = false;
        this._lastKnownRankId = null;
    }

    // ─── Инициализация ────────────────────────────────────────────────────────

    /**
     * Загружает данные и инициализирует структуры по умолчанию.
     * @returns {CareerManager}
     */
    init() {
        this.data = this.storage.loadProgress();
        this._ensureDefaults();
        this._initialized   = true;
        this._lastKnownRankId = this.getCurrentRank().id;

        this.dispatchEvent(new CustomEvent('career:initialized', { detail: {
            rank:  this._lastKnownRankId,
            score: this.getScore(),
        }}));

        return this;
    }

    _ensureDefaults() {
        if (!this.data.career) {
            this.data.career = {
                reputation:    { law: 50, shadow: 0 },
                totalScore:    0,
                experience:    0,
                lastRankUp:    null,
                achievements:  [],
                reputationLog: [],
            };
        }
        const rep = this.data.career.reputation;
        rep.law    = Math.max(0, Math.min(this.config.reputationCap, rep.law    ?? 50));
        rep.shadow = Math.max(0, Math.min(this.config.reputationCap, rep.shadow ?? 0));
        if (!Array.isArray(this.data.career.achievements))  this.data.career.achievements  = [];
        if (!Array.isArray(this.data.career.reputationLog)) this.data.career.reputationLog = [];
        if (!this.data.career.cabinet)                      this.data.career.cabinet       = { upgrades: {}, cooldowns: {}, reserveScore: 0 };
        if (!this.data.completedCases) this.data.completedCases = {};

        // Backward compat: перенести старую репутацию если она была в корне
        if (this.data.reputation && !this.data.career.reputation.law) {
            this.data.career.reputation = this.data.reputation;
            delete this.data.reputation;
        }
    }

    // ─── Ранги ────────────────────────────────────────────────────────────────

    /**
     * Возвращает текущий ранг на основе дел, очков и репутации.
     * @returns {RankConfig}
     */
    getCurrentRank() {
        const caseCount = Object.keys(this.data?.completedCases ?? {}).length;
        const score     = this.getScore();
        const rep       = this.getReputation();

        const eligible = RANK_CONFIG.filter(r =>
            caseCount >= r.minCases &&
            score     >= r.minScore &&
            rep.law    >= (r.minReputation?.law    ?? 0) &&
            rep.shadow >= (r.minReputation?.shadow ?? 0)
        );
        return eligible[eligible.length - 1] ?? RANK_CONFIG[0];
    }

    /**
     * Прогресс до следующего ранга.
     * @returns {{ current:RankConfig, next:RankConfig|null, progress:number, isMaxRank:boolean, requirements:object }}
     */
    getRankProgress() {
        const cur  = this.getCurrentRank();
        const idx  = RANK_CONFIG.findIndex(r => r.id === cur.id);
        const next = RANK_CONFIG[idx + 1] ?? null;

        if (!next) return { current: cur, next: null, progress: 1.0, isMaxRank: true };

        const caseCount = Object.keys(this.data.completedCases ?? {}).length;
        const score     = this.getScore();
        const rep       = this.getReputation();

        const pCases  = Math.min(1, caseCount           / Math.max(next.minCases, 1));
        const pScore  = Math.min(1, score                / Math.max(next.minScore, 1));
        const pLaw    = Math.min(1, rep.law              / Math.max(next.minReputation?.law    ?? 1, 1));
        const pShadow = Math.min(1, rep.shadow           / Math.max(next.minReputation?.shadow ?? 1, 1));

        const overall = +Math.min(pCases, pScore, pLaw, pShadow).toFixed(2);

        return {
            current: cur,
            next,
            progress: overall,
            isMaxRank: false,
            requirements: {
                cases:      { current: caseCount, required: next.minCases,               done: caseCount >= next.minCases },
                score:      { current: score,     required: next.minScore,               done: score     >= next.minScore },
                reputation: {
                    law:    { current: rep.law,    required: next.minReputation?.law    ?? 0, done: rep.law    >= (next.minReputation?.law    ?? 0) },
                    shadow: { current: rep.shadow, required: next.minReputation?.shadow ?? 0, done: rep.shadow >= (next.minReputation?.shadow ?? 0) },
                },
            },
        };
    }

    /** Разблокирована ли функция на текущем ранге. */
    hasFeature(featureId) {
        return this.getCurrentRank().bonuses?.unlockFeatures?.includes(featureId) ?? false;
    }

    /** Текущий множитель очков. */
    getScoreMultiplier() {
        return this.getCurrentRank().bonuses?.scoreMultiplier ?? 1.0;
    }

    // ─── Очки ─────────────────────────────────────────────────────────────────

    /**
     * Добавляет (или вычитает) очки.
     * @param {number} points
     * @param {{ reason?:string, caseId?:string }} [opts]
     * @returns {{ old:number, new:number, delta:number }}
     */
    addScore(points, { reason = 'case_completed', caseId = null } = {}) {
        if (typeof points !== 'number' || !isFinite(points))
            throw new TypeError('[CareerManager] points должен быть конечным числом');
        if (Math.abs(points) > this.config.maxScorePerCase)
            console.warn(`[CareerManager] Подозрительное изменение очков: ${points}`, { reason, caseId });

        const old = this.getScore();
        this.data.career.totalScore = Math.max(0, old + points);
        this.data.career.experience = +(( this.data.career.experience ?? 0) + Math.abs(points) * 0.1).toFixed(1);

        this._persist();
        this.dispatchEvent(new CustomEvent('career:score_changed', { detail: {
            old, new: this.getScore(), delta: points, reason, caseId,
        }}));
        this._checkRankUp();

        return { old, new: this.getScore(), delta: points };
    }

    getScore()      { return this.data?.career?.totalScore ?? 0; }
    getExperience() { return this.data?.career?.experience ?? 0; }

    // ─── Репутация ────────────────────────────────────────────────────────────

    /**
     * Обновляет репутацию с валидацией, логом и событием.
     * @param {'law'|'shadow'} type
     * @param {number} delta
     * @param {{ reason?:string, caseId?:string }} [opts]
     * @returns {{ old:number, new:number, delta:number }}
     */
    updateReputation(type, delta, { reason = 'unknown', caseId = null } = {}) {
        if (!['law', 'shadow'].includes(type))
            throw new Error(`[CareerManager] Недопустимый тип репутации: "${type}"`);
        if (typeof delta !== 'number' || !isFinite(delta))
            throw new TypeError('[CareerManager] delta должна быть числом');

        const cap = this.config.reputationCap;
        const old = this.data.career.reputation[type];
        const next = Math.max(0, Math.min(cap, old + delta));
        const actualDelta = next - old;

        this.data.career.reputation[type] = next;
        this._logRepChange({ type, delta: actualDelta, reason, caseId, old, new: next });

        this._persist();
        this.dispatchEvent(new CustomEvent('career:reputation_changed', { detail: {
            type, old, new: next, delta: actualDelta, reason,
        }}));
        this._checkRankUp();

        return { old, new: next, delta: actualDelta };
    }

    getReputation() {
        return { ...this.data.career.reputation };
    }

    getReputationLabel(value, type) {
        const labels = {
            law:    [{ t: 80, l: 'Законопослушный' }, { t: 60, l: 'Уважаемый' }, { t: 40, l: 'Нейтральный' }, { t: 20, l: 'Сомнительный' }, { t: 0, l: 'Скомпрометированный' }],
            shadow: [{ t: 80, l: 'Влиятельный в тенях' }, { t: 60, l: 'Связанный' }, { t: 40, l: 'Известный' }, { t: 20, l: 'Замеченный' }, { t: 0, l: 'Неизвестный' }],
        };
        return (labels[type] ?? labels.law).find(r => value >= r.t)?.l ?? 'Неизвестно';
    }

    getReputationColor(value, type) {
        const hue = type === 'law'
            ? (value / 100) * 120
            : 120 - (value / 100) * 120;
        return `hsl(${hue}, 70%, 45%)`;
    }

    /** Активные эффекты от текущей репутации. */
    getActiveEffects() {
        return ReputationEffects.getEffects(this.getReputation());
    }

    // ─── UI / Аналитика ───────────────────────────────────────────────────────

    /**
     * Полная сводка для UI (панель карьеры, профиль судьи).
     */
    getCareerSummary() {
        const rank   = this.getCurrentRank();
        const prog   = this.getRankProgress();
        const rep    = this.getReputation();
        return {
            rank: { id: rank.id, name: rank.name, icon: rank.icon },
            progression: prog,
            reputation: {
                law:    { value: rep.law,    label: this.getReputationLabel(rep.law,    'law'),    color: this.getReputationColor(rep.law,    'law') },
                shadow: { value: rep.shadow, label: this.getReputationLabel(rep.shadow, 'shadow'), color: this.getReputationColor(rep.shadow, 'shadow') },
            },
            stats: {
                totalScore:      this.getScore(),
                casesCompleted:  Object.keys(this.data.completedCases ?? {}).length,
                experience:      Math.floor(this.getExperience()),
            },
            achievements: this.data.career.achievements?.length ?? 0,
            effects:      this.getActiveEffects(),
        };
    }

    getAchievements() { return [...(this.data.career.achievements ?? [])]; }
    getAllData()       { return this.data; }

    // ─── Управление ───────────────────────────────────────────────────────────

    /**
     * Сброс карьеры (с опциональным сохранением достижений).
     * @param {{ keepAchievements?:boolean }} [opts]
     */
    reset({ keepAchievements = false } = {}) {
        const achievements = keepAchievements ? [...(this.data.career.achievements ?? [])] : [];
        this.data.career = {
            reputation: { law: 50, shadow: 0 },
            totalScore: 0, experience: 0,
            lastRankUp: null,
            achievements,
            reputationLog: [],
        };
        this._persist();
        this._lastKnownRankId = RANK_CONFIG[0].id;
        this.dispatchEvent(new CustomEvent('career:reset', { detail: { keepAchievements } }));
    }

    // ─── Cabinet API (Улучшения, Перки, Резерв) ───────────────────────────────

    getUpgradeLevel(id) {
        return this.data.career.cabinet?.upgrades?.[id] || 0;
    }

    setUpgradeLevel(id, level) {
        if (!this.data.career.cabinet) this.data.career.cabinet = { upgrades: {}, cooldowns: {}, reserveScore: 0 };
        this.data.career.cabinet.upgrades[id] = level;
        this._persist();
    }

    getPerkCooldown(id) {
        return this.data.career.cabinet?.cooldowns?.[id] ?? null;
    }

    setPerkCooldown(id, caseNumber) {
        if (!this.data.career.cabinet) this.data.career.cabinet = { upgrades: {}, cooldowns: {}, reserveScore: 0 };
        this.data.career.cabinet.cooldowns[id] = caseNumber;
        this._persist();
    }

    getReserveScore() {
        return this.data.career.cabinet?.reserveScore || 0;
    }

    setReserveScore(amount) {
        if (!this.data.career.cabinet) this.data.career.cabinet = { upgrades: {}, cooldowns: {}, reserveScore: 0 };
        this.data.career.cabinet.reserveScore = Math.max(0, amount);
        this._persist();
    }

    getCompletedCasesCount() {
        return Object.keys(this.data?.completedCases ?? {}).length;
    }

    // ─── Приватные ────────────────────────────────────────────────────────────

    _persist() {
        // Обновляем метаданные
        if (this.data.metadata) this.data.metadata.lastUpdated = new Date().toISOString();
        const ok = this.storage.saveProgress ? this.storage.saveProgress(this.data) : false;
        if (!ok) {
            this.dispatchEvent(new CustomEvent('career:save_failed', { detail: { timestamp: Date.now() } }));
        }
        return ok;
    }

    _checkRankUp() {
        const newRank = this.getCurrentRank();
        if (this._lastKnownRankId && newRank.id !== this._lastKnownRankId) {
            this.data.career.lastRankUp = new Date().toISOString();
            this.data.career.achievements.push({
                id:         `rank_up_${newRank.id}`,
                unlockedAt: Date.now(),
                rank:       newRank.id,
            });
            this.dispatchEvent(new CustomEvent('career:rank_up', { detail: {
                oldRank: this._lastKnownRankId,
                newRank: newRank.id,
                rankData: newRank,
                bonuses:  newRank.bonuses,
            }}));
        }
        this._lastKnownRankId = newRank.id;
    }

    _logRepChange({ type, delta, reason, caseId, old, new: next }) {
        const log = this.data.career.reputationLog;
        log.push({ timestamp: Date.now(), type, delta, reason, caseId, values: { before: old, after: next } });
        if (log.length > this.config.maxRepLogEntries)
            this.data.career.reputationLog = log.slice(-this.config.maxRepLogEntries);
    }
}
