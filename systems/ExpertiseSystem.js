/**
 * ExpertiseSystem.js — тонкий фасад (Facade) над ExpertiseOrchestrator.
 *
 * BACKWARD COMPATIBILITY: все публичные методы из предыдущей версии сохранены.
 * Новый код должен использовать ExpertiseOrchestrator напрямую.
 *
 * Импортирует и переэкспортирует новую архитектуру:
 *   systems/expertise/ExpertiseOrchestrator.js  — pipeline
 *   systems/expertise/SeededRNG.js              — детерминированный RNG
 *   systems/expertise/EventBus.js              — события
 *   systems/expertise/ValueObjects.js           — Certainty, Reliability, ...
 *   systems/expertise/ExpertEntity.js           — DDD Expert
 *   systems/expertise/strategies/DetailStrategies.js — 15 стратегий
 *   systems/expertise/MemoryRepository.js       — репозиторий экспертов
 */

import { ExpertiseOrchestrator }     from './expertise/ExpertiseOrchestrator.js';
import { MemoryExpertRepository, MemoryReportRepository } from './expertise/MemoryRepository.js';
import { globalEventBus, EVENTS }    from './expertise/EventBus.js';
import { globalRNG, SeededRNG }      from './expertise/SeededRNG.js';
import { DetailStrategyRegistry }    from './expertise/strategies/DetailStrategies.js';
import { ExpertEntity }              from './expertise/ExpertEntity.js';
import {
    SkillLevel, Certainty, Reliability,
    Reputation, EvidenceQuality, ConfidenceInterval,
} from './expertise/ValueObjects.js';
import { EXPERTISE_CATALOG }         from '../data/ExpertiseCatalog.js';
import { ExpertModel }               from './ExpertModel.js';

// ─── Singleton инфраструктура ─────────────────────────────────────────────────
const _expertRepo  = new MemoryExpertRepository();
const _reportRepo  = new MemoryReportRepository();
const _orchestrator = new ExpertiseOrchestrator({
    expertRepo: _expertRepo,
    eventBus:   globalEventBus,
    rng:        globalRNG,
});

// ─── ExpertiseSystem (публичный API) ─────────────────────────────────────────
export class ExpertiseSystem {

    // ─── Основные методы ─────────────────────────────────────────────────────

    /**
     * Генерация отчёта экспертизы.
     * @param {string}  testType
     * @param {object}  evidence
     * @param {boolean} isGuilty
     * @param {object}  [options]
     * @returns {ExpertiseReport}
     */
    static generateReport(testType, evidence = {}, isGuilty = true, options = {}) {
        const report = _orchestrator.generateReport(testType, evidence, isGuilty, options);
        // Сохраняем в репозиторий если есть caseId
        if (options.caseId) {
            report.caseId = options.caseId;
            _reportRepo.save(report);
        }
        return report;
    }

    /**
     * Повторная экспертиза с новым экспертом.
     * @param {ExpertiseReport} original
     * @param {object} evidence
     * @param {boolean} isGuilty
     * @returns {ExpertiseReport}
     */
    static retest(original, evidence, isGuilty) {
        return _orchestrator.retest(original, evidence, isGuilty);
    }

    /**
     * Байесовская агрегация нескольких отчётов.
     * @param {ExpertiseReport[]} reports
     * @param {number} [prior=0.50]
     * @returns {{ posterior, prosecutionScore, defenseScore, dominant }}
     */
    static summarize(reports, prior = 0.50) {
        return _orchestrator.summarize(reports, prior);
    }

    /**
     * Вердикт по одному отчёту (краткий текст для UI).
     * @param {ExpertiseReport} report
     * @returns {string}
     */
    static getVerdict(report) {
        if (report.inconclusive) return `${report.name}: результат неопределённый — требуется повторная экспертиза.`;
        if (report.isFake)       return `⚠️ ${report.name}: признаки фальсификации.`;
        const word = report.match ? 'ПОДТВЕРЖДАЕТ' : 'ОПРОВЕРГАЕТ';
        const cert = Math.round((report.certainty ?? 0) * 100);
        return `${report.name}: ${word} причастность (достоверность ${cert}%). ${report.canChallenge ? '⚖️ Оспоримо.' : ''}`;
    }

    /**
     * Упрощённая генерация для всей пачки улик дела.
     * @param {object[]} evidenceList  — массив улик с полем .tests (ForensicData)
     * @param {boolean}  isGuilty
     * @param {string}   crimeType
     * @param {string}   [caseId]
     * @returns {ExpertiseReport[]}
     */
    static generateBatch(evidenceList, isGuilty, crimeType, caseId) {
        const reports = [];
        for (const ev of evidenceList) {
            // ev.tests=[] (пустой) → используем validTests как fallback
            const tests = (ev.tests?.length ? ev.tests : ev.validTests) || [];
            for (const test of tests) {
                const testType = typeof test === 'string' ? test : test.type;
                if (!EXPERTISE_CATALOG[testType]) continue;
                const report = ExpertiseSystem.generateReport(testType, ev, isGuilty, { caseId });
                reports.push(report);
            }
        }
        return reports;
    }

    // ─── Эксперты ─────────────────────────────────────────────────────────────

    /**
     * Генерация панели экспертов для выбора игроком.
     * @param {string} testType
     * @param {number} [count=3]
     * @returns {ExpertProfile[]}
     */
    static generatePanel(testType, count = 3) {
        return ExpertModel.generatePanel(testType, count);
    }

    /**
     * Получить эксперта из репозитория.
     * @param {string} id
     * @returns {ExpertEntity|ExpertProfile|null}
     */
    static getExpert(id) { return _expertRepo.findById(id); }

    /**
     * Найти экспертов по специализации.
     */
    static findExperts(testType, opts) {
        return _expertRepo.findBySpecialty(testType, opts);
    }

    // ─── Отчёты ───────────────────────────────────────────────────────────────

    /**
     * Все отчёты по делу.
     * @param {string} caseId
     */
    static getReportsForCase(caseId) {
        return _reportRepo.findByCase(caseId);
    }

    // ─── События ──────────────────────────────────────────────────────────────

    /**
     * Подписка на события системы экспертиз.
     * @param {string} eventType — из EVENTS
     * @param {Function} handler
     * @returns {Function} unsubscribe
     */
    static on(eventType, handler) { return globalEventBus.on(eventType, handler); }

    /** Аудит-трейл событий. */
    static getAudit(eventType) { return globalEventBus.getAuditTrail(eventType); }

    // ─── Инструменты разработчика ─────────────────────────────────────────────

    /**
     * Передать другой RNG (для тестов и воспроизводимых сценариев).
     * @param {SeededRNG} rng
     */
    static setRNG(rng) { _orchestrator.rng = rng; }

    /** Список всех поддерживаемых типов экспертиз. */
    static get supportedTypes() { return Object.keys(EXPERTISE_CATALOG); }

    /** Регистрация кастомной стратегии деталей (для моддинга). */
    static registerStrategy(type, strategy) {
        DetailStrategyRegistry.register(type, strategy);
    }
}

// ─── Реэкспорт для удобства ──────────────────────────────────────────────────
export { EVENTS, globalEventBus, globalRNG, SeededRNG };
export { ExpertEntity, SkillLevel, Certainty, Reliability, Reputation, EvidenceQuality, ConfidenceInterval };
export { DetailStrategyRegistry };
export { MemoryExpertRepository, MemoryReportRepository };

export default ExpertiseSystem;
