/**
 * MemoryRepository.js — in-memory репозиторий экспертов с индексами.
 *
 * Интерфейс совместим с любым другим Repository (IndexedDB, Fetch-based и т.д.),
 * что позволяет заменить реализацию без изменения Orchestrator.
 *
 * Индексы:
 *  - по id              — O(1) lookup
 *  - по labId           — быстрый поиск по лаборатории
 *  - по специализации   — для подбора эксперта к типу теста
 */

export class MemoryExpertRepository {

    constructor() {
        /** @type {Map<string, ExpertEntity>} */
        this._byId       = new Map();
        /** @type {Map<string, Set<string>>} labId → Set<expertId> */
        this._byLab      = new Map();
        /** @type {Map<string, Set<string>>} testType → Set<expertId> */
        this._bySpecialty= new Map();
    }

    // ─── CRUD ─────────────────────────────────────────────────────────────────

    /** Сохранить или обновить эксперта. */
    save(expert) {
        const old = this._byId.get(expert.id);

        // Очистить старые индексы
        if (old) this._removeFromIndexes(old);

        this._byId.set(expert.id, expert);
        this._addToIndexes(expert);
        return expert;
    }

    /** @returns {ExpertEntity|null} */
    findById(id) {
        return this._byId.get(id) ?? null;
    }

    /** Удалить эксперта. */
    delete(id) {
        const expert = this._byId.get(id);
        if (!expert) return false;
        this._removeFromIndexes(expert);
        this._byId.delete(id);
        return true;
    }

    // ─── Запросы ──────────────────────────────────────────────────────────────

    /** Все эксперты в лаборатории. */
    findByLab(labId) {
        const ids = this._byLab.get(labId) || new Set();
        return [...ids].map(id => this._byId.get(id)).filter(Boolean);
    }

    /**
     * Найти экспертов по специализации.
     * @param {string} testType
     * @param {object} [opts]
     * @param {number} [opts.minReputation]  — минимальная репутация (0..1)
     * @param {number} [opts.maxFatigue]     — максимальная усталость (0..1)
     * @param {number} [opts.limit]          — лимит результатов
     * @returns {ExpertEntity[]}
     */
    findBySpecialty(testType, { minReputation = 0, maxFatigue = 0.85, limit = 10 } = {}) {
        const ids = this._bySpecialty.get(testType) || new Set();
        return [...ids]
            .map(id => this._byId.get(id))
            .filter(e => e
                && e.reputation >= minReputation
                && e.fatigue    <= maxFatigue)
            .sort((a, b) => b.reputation - a.reputation)
            .slice(0, limit);
    }

    /**
     * Топ-N экспертов по репутации (для панели выбора).
     * @param {string} testType
     * @param {number} [n=3]
     * @returns {ExpertEntity[]}
     */
    getPanel(testType, n = 3) {
        return this.findBySpecialty(testType, { limit: n });
    }

    /** Все эксперты (для отладки). */
    findAll() {
        return [...this._byId.values()];
    }

    /** Количество экспертов. */
    get size() { return this._byId.size; }

    // ─── Агрегация ────────────────────────────────────────────────────────────

    /** Средняя репутация по всем экспертам. */
    averageReputation() {
        if (!this._byId.size) return 0;
        const sum = [...this._byId.values()].reduce((s, e) => s + e.reputation, 0);
        return +(sum / this._byId.size).toFixed(3);
    }

    /** Эксперты в состоянии burnout. */
    getBurnouts() {
        return [...this._byId.values()].filter(e => e.isBurnout || e._fatigue?.isBurnout?.());
    }

    // ─── Индексы (приватные) ──────────────────────────────────────────────────

    _addToIndexes(expert) {
        // По лаборатории
        if (expert.labId) {
            if (!this._byLab.has(expert.labId)) this._byLab.set(expert.labId, new Set());
            this._byLab.get(expert.labId).add(expert.id);
        }

        // По специализации
        const specs = expert.specialties instanceof Set
            ? [...expert.specialties]
            : (expert.specialties || []);

        for (const spec of specs) {
            if (!this._bySpecialty.has(spec)) this._bySpecialty.set(spec, new Set());
            this._bySpecialty.get(spec).add(expert.id);
        }
    }

    _removeFromIndexes(expert) {
        this._byLab.get(expert.labId)?.delete(expert.id);
        const specs = expert.specialties instanceof Set
            ? [...expert.specialties]
            : (expert.specialties || []);
        for (const spec of specs) this._bySpecialty.get(spec)?.delete(expert.id);
    }

    // ─── Snapshot (save/load) ─────────────────────────────────────────────────

    toSnapshot() {
        return [...this._byId.values()].map(e =>
            typeof e.toSnapshot === 'function' ? e.toSnapshot() : e
        );
    }

    /** @param {ExpertEntity} EntityClass */
    fromSnapshot(snapshots, EntityClass) {
        this._byId.clear(); this._byLab.clear(); this._bySpecialty.clear();
        for (const snap of snapshots) {
            const entity = EntityClass ? EntityClass.fromSnapshot(snap) : snap;
            this.save(entity);
        }
    }
}

// ─── ExpertiseReportRepository ────────────────────────────────────────────────
/**
 * In-memory хранилище сгенерированных отчётов с поиском по делу/типу.
 */
export class MemoryReportRepository {

    constructor({ maxPerCase = 50 } = {}) {
        /** @type {Map<string, ExpertiseReport>} */
        this._byId   = new Map();
        /** @type {Map<string, string[]>}  caseId → reportId[] */
        this._byCase = new Map();
        this._maxPerCase = maxPerCase;
    }

    save(report) {
        this._byId.set(report.id, report);
        if (!this._byCase.has(report.caseId)) this._byCase.set(report.caseId, []);
        const caseReports = this._byCase.get(report.caseId);
        caseReports.push(report.id);
        // Лимит — удаляем самый старый
        if (caseReports.length > this._maxPerCase) {
            const old = caseReports.shift();
            this._byId.delete(old);
        }
        return report;
    }

    findById(id) { return this._byId.get(id) ?? null; }

    findByCase(caseId) {
        const ids = this._byCase.get(caseId) || [];
        return ids.map(id => this._byId.get(id)).filter(Boolean);
    }

    findByCaseAndType(caseId, testType) {
        return this.findByCase(caseId).filter(r => r.testType === testType);
    }

    get size() { return this._byId.size; }
}
