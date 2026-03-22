/**
 * VerdictSystem v2 — система вынесения вердикта и аналитики.
 *
 * v2 добавляет:
 *  - evaluateProbabilistic() — вердикт с байесовской поддержкой
 *  - compareToTruth() — для аналитики и дебага симуляций
 *  - Старый evaluate() сохранён для backward-compat
 */
import { BayesianEngine } from '../simulation/BayesianEngine.js';

export class VerdictSystem {

    // ─── Оригинальный evaluate (backward-compat) ──────────────────────────────

    /**
     * Стандартная оценка решения игрока (до внедрения Bayesian Engine).
     * @param {string} playerDecision — 'guilty' | 'innocent' | 'retry'
     * @param {Object} activeCase
     * @returns {VerdictResult}
     */
    static evaluate(playerDecision, activeCase) {
        const trueScenario = activeCase.trueScenario;
        const actual = trueScenario.isGuilty ? 'guilty' : 'innocent';
        const isCorrect = (playerDecision === actual);

        // Бонусы от событий
        let bonus = 0;
        if (activeCase.currentEvent?.type === 'bribery_attempt' && playerDecision === 'innocent') {
            bonus = 500;
        }

        if (isCorrect) {
            const finalScore = 100 + bonus;
            return {
                isCorrect: true,
                score: finalScore,
                reputation: { law: bonus > 0 ? -10 : 5, shadow: bonus > 0 ? 10 : 0 },
                feedback: bonus > 0
                    ? 'УСПЕХ. Вы получили вознаграждение, но закон смотрит на вас с подозрением.'
                    : 'Абсолютно верно! Вы верно оценили доказательства и вынесли правосудный приговор.',
                trueScenario,
            };
        } else {
            return {
                isCorrect: false,
                score: -50,
                reputation: { law: -15, shadow: 0 },
                feedback: 'ОШИБКА. Общественность возмущена вашим решением.',
                trueScenario,
            };
        }
    }

    // ─── Новый probabilistic evaluate ────────────────────────────────────────

    /**
     * Вердикт с байесовской поддержкой и детальным breakdown.
     * Возвращается из SimulationEngine.processVerdict.
     *
     * @param {string} playerDecision — 'guilty' | 'innocent'
     * @param {Object} activeCase
     * @param {Object} [trialData]    — из TrialSimulation.simulate() (опционально)
     */
    static evaluateProbabilistic(playerDecision, activeCase, trialData = null) {
        // Базовый результат
        const base = this.evaluate(playerDecision, activeCase);

        // Согласованность с системой
        const systemRec = trialData?.systemRecommendation?.verdict ?? 'unknown';
        const followedSystem = playerDecision === systemRec;
        const systemBonus = followedSystem ? 50 : 0;

        // Итоговый score
        const totalScore = base.score + systemBonus;

        return {
            ...base,
            score: totalScore,

            /** Насколько решение согласовано с системой */
            systemAlignment: {
                systemRecommended: systemRec,
                followed:          followedSystem,
                bonus:             systemBonus,
                note:              followedSystem
                    ? '✅ Ваш вердикт совпал с рекомендацией системы (+50 очков)'
                    : `⚠️ Система рекомендовала: ${systemRec === 'guilty' ? 'виновен' : 'невиновен'}`,
            },

            /** Присяжные */
            jury: trialData?.jury ?? null,
        };
    }

    // ─── Post-Trial Аналитика ────────────────────────────────────────────────

    /**
     * Сравнивает вынесенное системой/игроком решение с истинным сценарием.
     * Полезно для аналитики и тестирования детерминированности.
     * 
     * @param {import('../simulation/SimulationEngine.js').FullCaseResult} fullResult
     * @returns {Object} метрики точности
     */
    static compareToTruth(fullResult) {
        const truth = fullResult.caseData?.trueScenario;
        if (!truth) return null;

        const actualGuilty = truth.isGuilty;
        const actualVerdict = actualGuilty ? 'guilty' : 'innocent';

        const sysRec = fullResult.systemRecommendation?.verdict;
        const juryVerdict = fullResult.trial?.jury?.verdict;
        const bayesRec = fullResult.trial?.bayes?.recommendation;

        return {
            actualVerdict,
            systemCorrect: sysRec === actualVerdict,
            juryCorrect: juryVerdict === actualVerdict || (juryVerdict === 'hung_jury' && !actualGuilty),
            bayesCorrect: bayesRec === actualVerdict,
            bayesianConfidence: fullResult.trial?.bayes?.probability ?? 0,
            divergence: {
                bayesVsJury: bayesRec !== juryVerdict && juryVerdict !== 'hung_jury',
                systemVsTruth: sysRec !== actualVerdict
            }
        };
    }

    /**
     * Генерирует человекочитаемый разбор итогов (HTML) для UI модалки результатов дела.
     * @param {Object} probResult — результат evaluateProbabilistic или processVerdict
     */
    static buildFeedbackHTML(probResult) {
        const { isCorrect, score, systemAlignment, jury, bayesAnalysis } = probResult;
        const color = isCorrect ? '#22c55e' : '#ef4444';

        const juryLine = jury
            ? `<div style="margin-top:6px;font-size:12px;color:#94a3b8;">⚖️ Присяжные: <b style="color:${jury.verdict === 'guilty' ? '#ef4444' : '#22c55e'}">${jury.guiltyVotes}:${jury.innocentVotes}</b> — ${jury.verdict === 'hung_jury' ? 'нет единого мнения' : jury.verdict === 'guilty' ? 'за обвинение' : 'за оправдание'}</div>`
            : '';
            
        const bayesLine = bayesAnalysis 
            ? `<div style="margin-top:8px;font-size:12px;color:#94a3b8;">
                📊 Системная аналитика: <b style="color:${bayesAnalysis.color || '#f59e0b'}">${bayesAnalysis.score}% вероятность вины</b>
               </div>` 
            : '';

        return `
            <div style="padding:12px;border-radius:8px;background:rgba(0,0,0,0.4);border:1px solid ${color}40;">
                <div style="font-size:15px;font-weight:bold;color:${color};">
                    ${isCorrect ? '✅ Верное решение' : '❌ Неверное решение'} · ${score > 0 ? '+' : ''}${score} очков
                </div>
                ${bayesLine}
                <div style="margin-top:4px;font-size:12px;color:${systemAlignment?.followed ? '#22c55e' : '#f59e0b'}">
                    ${systemAlignment?.note || ''}
                </div>
                ${juryLine}
            </div>`;
    }
}
