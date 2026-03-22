/**
 * TrialSimulation — пайплайн судебного заседания.
 *
 * Связывает все подсистемы в единый поток:
 *
 *   CaseData (witnesses, evidence)
 *      ↓
 *   CredibilitySystem   — оценка каждого свидетеля
 *      ↓
 *   ContradictionSystem — автоанализ противоречий
 *      ↓
 *   BayesianEngine      — P(вина | улики + свидетели)
 *      ↓
 *   ContradictionGraph  — граф связей (для UI)
 *      ↓
 *   JuryAI              — коллегия присяжных
 *      ↓
 *   TrialReport { credibility, bayes, contradictions, graph, jury, systemRecommendation }
 */

/**
 * @typedef {Object} SystemRecommendation
 * @property {'guilty'|'innocent'|'insufficient_evidence'|'hung_jury'} verdict
 * @property {number} confidence
 * @property {string[]} rationale
 */

/**
 * @typedef {Object} TrialReport
 * @property {string} caseId
 * @property {Object} credibility
 * @property {Object} contradictions
 * @property {Object} bayes
 * @property {Object} graph
 * @property {Object} jury
 * @property {SystemRecommendation} systemRecommendation
 * @property {number} simulatedAt
 */

import { CredibilitySystem }  from '../systems/CredibilitySystem.js';
import { ContradictionSystem } from '../systems/ContradictionSystem.js';
import { BayesianEngine }     from './BayesianEngine.js';
import { ContradictionGraph } from './ContradictionGraph.js';
import { JuryAI }             from './JuryAI.js';

export class TrialSimulation {

    /**
     * Запускает полный пайплайн судебного заседания.
     *
     * @param {Object}  caseData    — данные дела из CaseGenerator
     * @param {Object}  [opts]
     * @param {boolean} [opts.runJury=true]   — включить модель присяжных
     * @param {boolean} [opts.buildGraph=true] — строить граф противоречий
     * @param {import('./GameRandom.js').GameRandom} [opts.rng] — генератор случайных чисел
     * @returns {TrialReport}
     */
    static simulate(caseData, opts = {}) {
        const { runJury = true, buildGraph = true, rng } = opts;
        const fallbackRng = rng || { next: () => Math.random() };

        // ── Шаг 1: Credibility всех свидетелей ────────────────────────────────
        const credibilityProfiles = TrialSimulation._evaluateWitnesses(caseData);
        const credibilityAvg = credibilityProfiles.length > 0
            ? credibilityProfiles.reduce((s, p) => s + p.score, 0) / credibilityProfiles.length
            : 0.5;

        // Обогащаем свидетелей их credibility score для последующих шагов
        (caseData.witnesses || []).forEach((w, i) => {
            w.credibilityScore = credibilityProfiles[i]?.score ?? 0.5;
        });

        // ── Шаг 2: Анализ противоречий ────────────────────────────────────────
        const contradictions = ContradictionSystem.analyze(caseData);

        // ── Шаг 3: Байесовская оценка ─────────────────────────────────────────
        const bayesResult = BayesianEngine.evaluateCase(caseData, {
            credibilityProfiles,
            contradictions,
        });

        // ── Шаг 4: Граф противоречий (для UI/вычислений) ─────────────────────
        let graph = null;
        if (buildGraph) {
            // Graph-driven v2: build() теперь автоматически вычисляет все противоречия
            // через EventGraph, Witness.testimonies и Evidence.nodeId — без внешнего аргумента
            graph = ContradictionGraph.build(caseData);

        }

        // ── Шаг 5: Присяжные ──────────────────────────────────────────────────
        let juryResult = null;
        if (runJury) {
            const jurors = JuryAI.buildJurors(fallbackRng);
            juryResult = JuryAI.evaluateTrial({
                bayesScore:       bayesResult.probability,
                credibilityAvg,
                contradictions,
                consistencyScore: graph?.getConsistencyScore() ?? 0.5,
                expertReports:    TrialSimulation._extractExpertReports(caseData),
            }, jurors, fallbackRng);
        }

        // ── Шаг 6: Сборка итогового отчёта ───────────────────────────────────
        return TrialSimulation._buildReport({
            caseData,
            credibilityProfiles,
            credibilityAvg,
            contradictions,
            bayesResult,
            graph,
            juryResult,
        });
    }

    // ─── Оценка свидетелей ───────────────────────────────────────────────────

    static _evaluateWitnesses(caseData) {
        const witnesses = caseData.witnesses || [];
        return witnesses.map(witness => {
            try {
                const profile = CredibilitySystem.evaluate(witness, caseData);
                return {
                    witnessId: witness.id || witness.name,
                    name:      witness.name || 'Неизвестный',
                    score:     profile?.score ?? 0.5,
                    badge:     profile?.badge ?? '—',
                    flags:     profile?.flags ?? [],
                    profile,
                };
            } catch {
                return { witnessId: witness.name, name: witness.name, score: 0.5, badge: '—', flags: [], profile: null };
            }
        });
    }

    // ─── Извлечение экспертных отчётов ───────────────────────────────────────

    static _extractExpertReports(caseData) {
        const reports = [];
        for (const ev of (caseData.evidence || [])) {
            for (const test of (ev.tests || [])) {
                if (test.status === 'match') {
                    reports.push({ type: test.type, confidence: ev.confidence ?? 0.7, evLabel: ev.label });
                }
            }
        }
        return reports;
    }

    // ─── Сборка отчёта ───────────────────────────────────────────────────────

    static _buildReport({ caseData, credibilityProfiles, credibilityAvg, contradictions, bayesResult, graph, juryResult }) {
        const graphStats = graph?.getStats() ?? {};
        const highRiskNodes = graph?.getHighRiskNodes ? graph.getHighRiskNodes(3) : [];
        const consistencyScore = graph?.getConsistencyScore() ?? 0.5;

        // Итоговая рекомендация системы — консенсус байеса и присяжных
        /** @type {SystemRecommendation} */
        const systemRecommendation = TrialSimulation._computeRecommendation(bayesResult, juryResult);

        // Snapshot графа (если метод toSnapshot существует, иначе null)
        const graphSnapshot = graph?.toSnapshot ? graph.toSnapshot() : { 
            consistencyScore: +consistencyScore.toFixed(2),
            stats: graphStats,
            highRiskNodes 
        };

        return {
            caseId: caseData.id,
            credibility: {
                profiles: credibilityProfiles,
                average: +credibilityAvg.toFixed(2),
                reliable:   credibilityProfiles.filter(p => p.score >= 0.65).length,
                unreliable: credibilityProfiles.filter(p => p.score <  0.40).length,
            },
            contradictions: {
                list: contradictions,
                count: contradictions.length,
                critical: contradictions.filter(c => c.severity === 'critical').length,
                major:    contradictions.filter(c => c.severity === 'major').length,
                minor:    contradictions.filter(c => c.severity === 'minor').length,
            },
            bayes: bayesResult,
            graph: {
                instance: graph, // Для совместимости/рендера
                snapshot: graphSnapshot
            },
            jury: juryResult,
            systemRecommendation,
            simulatedAt: Date.now(),
        };
    }

    /**
     * Консенсус между байесовской оценкой и вердиктом присяжных.
     * @returns {SystemRecommendation}
     */
    static _computeRecommendation(bayesResult, juryResult) {
        const bayesVerdict = bayesResult.recommendation; // 'guilty'|'innocent'|'insufficient_evidence'
        const juryVerdict  = juryResult?.verdict;        // 'guilty'|'innocent'|'hung_jury'

        if (!juryVerdict || juryVerdict === 'hung_jury') {
            return {
                verdict: bayesVerdict,
                confidence: bayesResult.probability,
                rationale: [
                    'Присяжные не смогли прийти к консенсусу (hung jury).',
                    `Байесовский анализ уверен на ${(bayesResult.probability * 100).toFixed(0)}%: ${bayesResult.description}`
                ],
            };
        }

        if (bayesVerdict === juryVerdict) {
            return {
                verdict: bayesVerdict,
                confidence: Math.max(bayesResult.probability, juryResult.confidence),
                rationale: [
                    `Байесовский анализ и присяжные согласны: ${bayesVerdict === 'guilty' ? 'виновен' : 'невиновен'}`,
                    `Байесовская уверенность: ${(bayesResult.probability * 100).toFixed(0)}%. Уверенность присяжных: ${(juryResult.confidence * 100).toFixed(0)}%.`
                ],
            };
        }

        // Расхождение
        const bayesConf = Math.abs(bayesResult.probability - 0.5) * 2;
        const juryConf  = juryResult.confidence;

        if (bayesConf > juryConf) {
            return {
                verdict: bayesVerdict,
                confidence: bayesConf,
                rationale: [
                    `Расхождение. Байесовская система (${(bayesResult.probability * 100).toFixed(0)}%) приоритетнее присяжных (${juryVerdict}).`,
                    `Основание: строгие математические вероятности по уликам доминируют над слабым решением жюри.`
                ],
            };
        }

        return {
            verdict: juryVerdict,
            confidence: juryConf,
            rationale: [
                `Расхождение. Присяжные (${juryVerdict}, ${(juryConf * 100).toFixed(0)}%) приоритетнее байесовской системы (${(bayesResult.probability * 100).toFixed(0)}%).`,
                `Основание: присяжные выявили сильный человеческий фактор (уверенная победа голосов), несмотря на слабую байесовскую базу.`
            ],
        };
    }
}
