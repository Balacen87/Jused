/**
 * JuryAI — модель коллегии присяжных.
 *
 * Симулирует 7 присяжных с разными «профилями мышления».
 * Каждый оценивает дело по-своему, взвешивая:
 *  - байесовский скор (вероятность вины)
 *  - достоверность свидетелей
 *  - количество и серьёзность противоречий
 *  - свой психологический профиль
 *
 * Итог: {votes, verdict, reasoning, keyFactors}
 */

// ─── Профили присяжных ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} JurorProfile
 * @property {string} id
 * @property {string} name
 * @property {string} archetype      — «Рационалист», «Моралист» и т.д.
 * @property {number} bayesWeight    — насколько следует байесовской оценке [0..1]
 * @property {number} credWeight     — вес показаний свидетелей
 * @property {number} contradWeight  — вес противоречий (отрицательный эффект)
 * @property {number} guiltBias      — базовое смещение в сторону обвинения [−0.2..+0.2]
 */

const JUROR_PROFILES = [
    { id: 'rationalist', name: 'Аналитик', archetype: 'Следует фактам и доказательствам', bayesWeight: 0.65, credWeight: 0.20, contradWeight: 0.55, guiltBias: 0.00 },
    { id: 'moralist', name: 'Моралист', archetype: 'Опирается на моральные убеждения', bayesWeight: 0.30, credWeight: 0.45, contradWeight: 0.25, guiltBias: +0.10 },
    { id: 'skeptic', name: 'Скептик', archetype: 'Всегда сомневается в виновности', bayesWeight: 0.50, credWeight: 0.25, contradWeight: 0.70, guiltBias: -0.15 },
    { id: 'empathic', name: 'Эмпат', archetype: 'Верит человеческим показаниям', bayesWeight: 0.25, credWeight: 0.65, contradWeight: 0.30, guiltBias: -0.05 },
    { id: 'conformist', name: 'Конформист', archetype: 'Следует за большинством', bayesWeight: 0.40, credWeight: 0.35, contradWeight: 0.35, guiltBias: +0.05 },
    { id: 'legalist', name: 'Законник', archetype: 'Буква закона выше всего', bayesWeight: 0.55, credWeight: 0.30, contradWeight: 0.60, guiltBias: +0.08 },
    { id: 'pragmatist', name: 'Прагматик', archetype: 'Думает о последствиях для общества', bayesWeight: 0.45, credWeight: 0.40, contradWeight: 0.40, guiltBias: +0.03 },
];

export class JuryAI {

    /**
     * Формирует коллегию присяжных. 
     * В будущем можно будет случайно выбирать 7 из 20 доступных.
     * Сейчас используем фиксированные 7 архетипов, но с возможностью рандомизации их bias'ов через seed.
     *
     * @param {GameRandom} rng — генератор случайных чисел
     * @returns {JurorProfile[]}
     */
    static buildJurors(rng) {
        // Создаем копии базовых профилей и слегка варьируем их bias'ы
        return JUROR_PROFILES.map(p => ({
            ...p,
            guiltBias: p.guiltBias + (rng.next() - 0.5) * 0.05, // небольшое смещение (0..±0.025)
        }));
    }

    /**
     * Оценивает дело коллегией присяжных.
     *
     * @param {Object} trialData
     * @param {number} trialData.bayesScore          — P(вина) из BayesianEngine [0..1]
     * @param {number} trialData.credibilityAvg      — средний credibility свидетелей [0..1]
     * @param {Array}  trialData.contradictions      — массив из ContradictionSystem
     * @param {number} trialData.consistencyScore    — из ContradictionGraph [0..1]
     * @param {Array}  [trialData.expertReports]     — отчёты экспертов
     * @param {JurorProfile[]} jurors                — сформированная коллегия
     * @param {GameRandom} rng                       — генератор случайных чисел
     * @returns {JuryResult}
     */
    static evaluateTrial(trialData, jurors, rng) {
        if (!jurors || jurors.length === 0) throw new Error("JuryAI: jurors array is empty");

        const {
            bayesScore      = 0.5,
            credibilityAvg  = 0.5,
            contradictions  = [],
            consistencyScore = 0.5,
            expertReports   = [],
        } = trialData;

        // Считаем «вес» противоречий (критические = больше)
        const contradictionPressure = contradictions.reduce((acc, c) => {
            const w = c.severity === 'critical' ? 1.0
                    : c.severity === 'major'    ? 0.6
                    : c.severity === 'minor'    ? 0.2 : 0.05;
            return acc + w;
        }, 0);
        // cap at 1.0
        const normalizedContra = Math.min(1, contradictionPressure / 5);

        // Вес экспертных заключений
        const expertFactor = expertReports.length > 0
            ? expertReports.reduce((s, r) => s + (r.confidence ?? 0.5), 0) / expertReports.length
            : 0.5;

        // Оцениваем каждого присяжного
        const jurorVotes = jurors.map(juror =>
            JuryAI.evaluateJuror(juror, {
                bayesScore, credibilityAvg, normalizedContra, consistencyScore, expertFactor
            }, rng)
        );

        const guiltyVotes   = jurorVotes.filter(v => v.vote === 'guilty').length;
        const innocentVotes = jurorVotes.filter(v => v.vote === 'innocent').length;
        const total         = jurorVotes.length;

        // Для обвинения нужно ≥ 5 из 7 (71%)
        let verdict;
        if (guiltyVotes >= 5)      verdict = 'guilty';
        else if (innocentVotes >= 5) verdict = 'innocent';
        else                         verdict = 'hung_jury';

        return {
            verdict,
            guiltyVotes,
            innocentVotes,
            total,
            /** Уверенность коллегии */
            confidence: Math.max(guiltyVotes, innocentVotes) / total,
            /** Детали по каждому присяжному */
            jurorVotes,
            /** Нарративное описание для UI */
            reasoning: JuryAI._buildReasoning(verdict, guiltyVotes, innocentVotes, jurorVotes),
            /** Ключевые факторы, определившие решение */
            keyFactors: JuryAI._extractKeyFactors(jurorVotes, { bayesScore, normalizedContra, credibilityAvg }),
        };
    }

    // ─── Оценка одного присяжного ─────────────────────────────────────────────

    /**
     * @param {JurorProfile} juror 
     * @param {Object} factors 
     * @param {GameRandom} rng 
     */
    static evaluateJuror(juror, { bayesScore, credibilityAvg, normalizedContra, consistencyScore, expertFactor }, rng) {
        // Индивидуальный score = взвешенная сумма факторов
        let score = 0;
        score += bayesScore       * juror.bayesWeight;
        score += credibilityAvg   * juror.credWeight;
        score -= normalizedContra * juror.contradWeight;
        score += (expertFactor - 0.5) * 0.15;
        score += (consistencyScore - 0.5) * 0.10;
        score += juror.guiltBias;

        // Нормализация в [0, 1]
        score = Math.min(1, Math.max(0, score / (juror.bayesWeight + juror.credWeight + 0.15 + 0.10)));

        // Небольшая случайность — "человеческий фактор" (заменяем Math.random() на rng.next())
        const jitter = (rng.next() - 0.5) * 0.08;
        score = Math.min(1, Math.max(0, score + jitter));

        const vote = score >= 0.52 ? 'guilty' : 'innocent';
        const confidence = Math.abs(score - 0.5) * 2; // 0..1

        return {
            jurorId:    juror.id,
            name:       juror.name,
            archetype:  juror.archetype,
            vote,
            score:      +score.toFixed(2),
            confidence: +confidence.toFixed(2),
            /** Иконка уровня уверенности */
            confidenceIcon: confidence >= 0.6 ? '🟢' : confidence >= 0.35 ? '🟡' : '🟠',
        };
    }

    // ─── Нарративы ───────────────────────────────────────────────────────────

    static _buildReasoning(verdict, guilty, innocent, votes) {
        const swingVoters = votes.filter(v => v.confidence < 0.4).map(v => v.name).join(', ');

        const base = {
            guilty:    `Коллегия проголосовала ${guilty}:${innocent} ЗА обвинение.`,
            innocent:  `Коллегия проголосовала ${innocent}:${guilty} ЗА оправдание.`,
            hung_jury: `Голоса разделились: ${guilty} против ${innocent}. Единого решения нет.`,
        }[verdict];

        const swing = swingVoters
            ? ` Колеблющиеся присяжные: ${swingVoters}.`
            : ' Большинство было уверено в своём решении.';

        const conclusion = {
            guilty:    ' Доказательная база признана достаточной.',
            innocent:  ' Сомнения трактованы в пользу обвиняемого.',
            hung_jury: ' Требуется повторное заседание или замена состава.',
        }[verdict];

        return [base, swing, conclusion]; // Возвращаем массив строк, как запрошено в ревью
    }

    static _extractKeyFactors(votes, { bayesScore, normalizedContra, credibilityAvg }) {
        const factors = [];

        if (bayesScore >= 0.70) factors.push({ label: 'Сильная доказательная база', impact: 'positive', icon: '📊' });
        else if (bayesScore <= 0.35) factors.push({ label: 'Слабая доказательная база', impact: 'negative', icon: '📊' });

        if (normalizedContra >= 0.6) factors.push({ label: 'Множество противоречий', impact: 'negative', icon: '⚠️' });
        else if (normalizedContra <= 0.2) factors.push({ label: 'Показания согласованны', impact: 'positive', icon: '✅' });

        if (credibilityAvg >= 0.70) factors.push({ label: 'Достоверные свидетели', impact: 'positive', icon: '👤' });
        else if (credibilityAvg <= 0.40) factors.push({ label: 'Ненадёжные свидетели', impact: 'negative', icon: '👤' });

        const skepticVote = votes.find(v => v.jurorId === 'skeptic');
        if (skepticVote?.vote === 'guilty') factors.push({ label: 'Скептик проголосовал «виновен»', impact: 'positive', icon: '🔎' });

        return factors;
    }
}
