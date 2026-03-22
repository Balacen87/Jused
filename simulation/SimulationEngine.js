/**
 * SimulationEngine — главный оркестратор судебной симуляции.
 *
 * Единая точка входа для всей игровой логики:
 *
 *   runCase({ seed }) →
 *     1. CaseGenerator (case:generated)
 *     2. TrialSimulation пайплайн (trial:started -> trial:completed)
 *     3. VerdictPhase (verdict:recommended)
 *     4. ConsequencePhase
 *     → FullCaseResult
 *
 * Архитектура: Dependency Injection + EventTarget для UI.
 */

/**
 * @typedef {Object} FullCaseResult
 * @property {Object} caseData
 * @property {import('./TrialSimulation.js').TrialReport} trial
 * @property {Object} metrics
 * @property {import('./TrialSimulation.js').SystemRecommendation} systemRecommendation
 * @property {Object} [consequencePreview]
 * @property {number} simulatedAt
 */

import { TrialSimulation }    from './TrialSimulation.js';
import { BayesianEngine }     from './BayesianEngine.js';
import { VerdictSystem }      from '../systems/VerdictSystem.js';
import { GameRandom }         from './GameRandom.js';

export class SimulationEngine extends EventTarget {

    /**
     * @param {Object} deps
     * @param {Object}   deps.caseGenerator       — CaseGenerator
     * @param {Object}   [deps.consequenceManager] — ConsequenceManager
     * @param {Object}   [deps.career]             — CareerManager
     * @param {Object}   [deps.eventBus]           — EventBus
     * @param {Object}   [deps.config]
     * @param {boolean}  [deps.config.runJury=true]
     * @param {boolean}  [deps.config.buildGraph=true]
     * @param {boolean}  [deps.config.verbose=false]
     */
    constructor({ caseGenerator, consequenceManager = null, career = null, eventBus = null, config = {} }) {
        super();
        this.caseGenerator      = caseGenerator;
        this.consequenceManager = consequenceManager;
        this.career             = career;
        this.eventBus           = eventBus;
        this.config = {
            runJury:    config.runJury    ?? true,
            buildGraph: config.buildGraph ?? true,
            verbose:    config.verbose    ?? false,
        };

        /** Последний полный результат (доступен как window.game.engine.lastResult) */
        /** @type {FullCaseResult|null} */
        this.lastResult = null;
    }

    // ─── Главный метод ────────────────────────────────────────────────────────

    /**
     * Полный цикл одного дела: генерация → суд → вердикт → последствия.
     *
     * @param {Object} [opts]
     * @param {string|number} [opts.seed]         — сид для генератора (для детерминированности)
     * @param {string}        [opts.rankName]     — ранг судьи
     * @param {Object}        [opts.existingCase] — уже готовое дело (если не нужна генерация)
     * @returns {FullCaseResult}
     */
    runCase({ seed = Date.now(), rankName = 'Мировой судья', existingCase = null } = {}) {
        this._emit('simulation:started', { seed, rankName });

        const rng = new GameRandom(seed);

        // ── 1. Получить или использовать дело ─────────────────────────────────
        const caseData = existingCase ?? this.caseGenerator.generate(rankName, seed); // передаем seed если генератор его поддерживает
        this._log('📁 Дело сгенерировано:', caseData.id);

        this._emit('case:generated', { caseData, seed });

        // ── 2. TrialSimulation pipeline ────────────────────────────────────────
        this._emit('trial:started', { caseId: caseData.id });

        const trialReport = TrialSimulation.simulate(caseData, {
            runJury:    this.config.runJury,
            buildGraph: this.config.buildGraph,
            rng:        rng,
        });

        this._log('⚖️ Trial report:', trialReport.systemRecommendation);
        this._emit('jury:evaluated', { jury: trialReport.jury });
        this._emit('trial:completed', { trialReport });

        // ── 3. Собрать FullCaseResult ─────────────────────────────────────────
        const result = this._buildFullResult(caseData, trialReport);
        this.lastResult = result;

        this._emit('verdict:recommended', { recommendation: result.systemRecommendation });
        this._emit('simulation:completed', { result });

        return result;
    }

    /**
     * Обрабатывает решение игрока (playerVerdict) и вычисляет итоговый счёт.
     *
     * @param {string} playerDecision — 'guilty' | 'innocent'
     * @param {Object} activeCase     — текущее дело
     */
    processVerdict(playerDecision, activeCase) {
        // Оценка с поддержкой байеса и присяжных
        const enriched = VerdictSystem.evaluateProbabilistic(playerDecision, activeCase, this.lastResult?.trial);

        // Обновить карьеру
        if (this.career) {
            try {
                this.career.addScore(enriched.score, { reason: 'case_completed', caseId: activeCase.id });
                const rep = enriched.reputation;
                if (rep?.law)    this.career.updateReputation('law',    rep.law,    { caseId: activeCase.id });
                if (rep?.shadow) this.career.updateReputation('shadow', rep.shadow, { caseId: activeCase.id });
            } catch(e) { console.warn('[SimulationEngine] career update error:', e.message); }
        }

        // ConsequenceManager
        if (this.consequenceManager?.onCaseCompleted) {
            try {
                this.consequenceManager.onCaseCompleted(enriched);
            } catch(e) { console.warn('[SimulationEngine] consequence error:', e.message); }
        }

        this._emit('consequence:processed', { verdict: playerDecision, result: enriched });
        return enriched;
    }

    // ─── Публичный доступ к аналитике ────────────────────────────────────────

    getBayesianAnalysis() {
        return this.lastResult?.trial?.bayes ?? null;
    }

    getContradictionGraph() {
        return this.lastResult?.trial?.graph?.instance ?? null;
    }

    getSystemRecommendation() {
        return this.lastResult?.systemRecommendation ?? null;
    }

    getJuryResult() {
        return this.lastResult?.trial?.jury ?? null;
    }

    // ─── Приватные ───────────────────────────────────────────────────────────

    /**
     * @returns {FullCaseResult}
     */
    _buildFullResult(caseData, trialReport) {
        return {
            caseData: caseData,
            trial: trialReport,
            metrics: {
                bayesScore:       trialReport.bayes.score,          // 0..100
                probability:      trialReport.bayes.probability,    // 0..1
                confidence:       trialReport.bayes.confidence,     // Уверенность байеса
                credibilityAvg:   trialReport.credibility.average,  // 0..1
                contradictions:   trialReport.contradictions.count,
                criticalContra:   trialReport.contradictions.critical,
                consistencyScore: trialReport.graph.snapshot?.consistencyScore ?? 0.5,
                juryVerdict:      trialReport.jury?.verdict ?? 'n/a',
                juryGuilty:       trialReport.jury?.guiltyVotes ?? 0,
                juryInnocent:     trialReport.jury?.innocentVotes ?? 0,
            },
            systemRecommendation: trialReport.systemRecommendation,
            simulatedAt: trialReport.simulatedAt,
        };
    }

    _emit(eventName, detail = {}) {
        this.dispatchEvent(new CustomEvent(eventName, { detail }));
        if (this.eventBus?.publish) {
            this.eventBus.publish(eventName, detail);
        }
    }

    _log(...args) {
        if (this.config.verbose) console.log('[SimulationEngine]', ...args);
    }
}
