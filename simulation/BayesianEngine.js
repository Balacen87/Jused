/**
 * BayesianEngine — байесовское обновление вероятности вины.
 *
 * Ядро: P(G|E) = P(E|G) * P(G) / [P(E|G)*P(G) + P(E|¬G)*(1−P(G))]
 *
 * Применимо к любым данным через паттерн LikelihoodInput:
 * @typedef {Object} LikelihoodInput
 * @property {'evidence'|'witness'|'expertise'|'contradiction'} sourceType
 * @property {'prosecution'|'defense'|'neutral'} polarity
 * @property {number} strength (0..1) — Сила влияния на prior
 * @property {number} reliability (0..1) — Достоверность источника (шанс, что это не ошибка)
 * @property {string} explain — Описание для UI
 */

export class BayesianEngine {

    // ─── Весовые коэффициенты типов улик ─────────────────────────────────────

    static EVIDENCE_LIKELIHOODS = {
        // P(E|G) — вероятность найти улику если виновен
        dna_test:             { forGuilty: 0.95, forInnocent: 0.01 },
        fingerprint_test:     { forGuilty: 0.88, forInnocent: 0.03 },
        ballistic_test:       { forGuilty: 0.90, forInnocent: 0.02 },
        toxicology_test:      { forGuilty: 0.85, forInnocent: 0.05 },
        handwriting_analysis: { forGuilty: 0.80, forInnocent: 0.08 },
        metadata_analysis:    { forGuilty: 0.75, forInnocent: 0.10 },
        image_authentication: { forGuilty: 0.70, forInnocent: 0.12 },
        document_forgery:     { forGuilty: 0.82, forInnocent: 0.06 },
        voiceprint_analysis:  { forGuilty: 0.72, forInnocent: 0.10 },
        fiber_analysis:       { forGuilty: 0.65, forInnocent: 0.15 },
        gps_tracking:         { forGuilty: 0.88, forInnocent: 0.04 },
        biological:           { forGuilty: 0.82, forInnocent: 0.06 },
        physical:             { forGuilty: 0.68, forInnocent: 0.15 },
        digital:              { forGuilty: 0.76, forInnocent: 0.09 },
        default:              { forGuilty: 0.70, forInnocent: 0.15 },
    };

    /** Максимально возможный сдвиг prior (на 100% надёжный вход максимальной силы) */
    static MULTIPLIER_CAPPED = {
        prosecution: 4.5,
        defense: 0.22,      // 1 / 4.5
    };

    // ─── Ядро расчёта (Likelihood Inputs) ────────────────────────────────────

    /**
     * Вычисляет P(вина) для массива универсальных входов.
     * @param {LikelihoodInput[]} inputs 
     * @param {number} initialPrior начальная вероятность (обычно 0.5)
     */
    static evaluateInputs(inputs, initialPrior = 0.50) {
        const steps = [];
        let prior = initialPrior;

        for (const input of inputs) {
            const priorBefore = prior;
            let lhGuilty = 0.5;
            let lhInnocent = 0.5;

            // Расчет Likelihood Ratio на основе Polarity, Strength и Reliability
            if (input.polarity === 'prosecution') {
                // Если улика надежная (reliability=1) и сильная (strength=1) -> lr = 4.5
                // Если reliability=0 -> lr = 1.0 (ничего не меняет)
                const effectiveLR = 1 + (this.MULTIPLIER_CAPPED.prosecution - 1) * input.strength * input.reliability;
                lhGuilty = effectiveLR;
                lhInnocent = 1;

            } else if (input.polarity === 'defense') {
                // LR < 1
                const effectiveLR = 1 - (1 - this.MULTIPLIER_CAPPED.defense) * input.strength * input.reliability;
                lhGuilty = effectiveLR;
                lhInnocent = 1;

            } else {
                // Neutral
                lhGuilty = 0.5;
                lhInnocent = 0.5;
            }

            // Байесовское обновление: Bayes’ theorem in odds form
            // Odds(G|E) = Odds(G) * LR
            // LR = P(E|G) / P(E|¬G) -> здесь мы сразу смоделировали LR
            const currentOdds = prior / (1 - prior);
            const LR = lhGuilty / lhInnocent;
            let posteriorOdds = currentOdds * LR;

            // Защита от Infinity
            if (!isFinite(posteriorOdds)) posteriorOdds = 999;
            
            prior = posteriorOdds / (1 + posteriorOdds);

            // Защитный Clamp
            prior = Math.min(0.999, Math.max(0.001, prior));

            if (Math.abs(prior - priorBefore) >= 0.001) {
                 steps.push({
                    sourceType: input.sourceType,
                    polarity:   input.polarity,
                    explain:    input.explain,
                    delta:      +(prior - priorBefore).toFixed(3),
                    posterior:  +prior.toFixed(3)
                });
            }
        }

        return this._buildResult(prior, steps);
    }

    // ─── Парсинг CaseData в LikelihoodInputs ─────────────────────────────────

    /**
     * Конвертирует дело в LikelihoodInputs и запускает вычисление. 
     * @param {Object} caseData 
     * @param {Object} trialSignals (credibilityProfiles, contradictions и др)
     */
    static evaluateCase(caseData, trialSignals = {}) {
        const inputs = [];

        // 1. Улики (Evidence & Expertise)
        for (const ev of (caseData.evidence || [])) {
            const lastTest = ev.tests?.[ev.tests.length - 1]; // Берем последний (самый релевантный) тест
            const typeKey = this._getLikelihoodKey(ev);
            const lhRates = this.EVIDENCE_LIKELIHOODS[typeKey] ?? this.EVIDENCE_LIKELIHOODS.default;

            let polarity = 'neutral';
            let strength = 0;

            if (ev.isFake) {
                // Ложная улика трактуется как попытка подставы -> играет за защиту
                polarity = 'defense';
                strength = 0.8;
                inputs.push({
                    sourceType: 'evidence',
                    polarity,
                    strength,
                    reliability: ev.confidence ?? 0.8,
                    explain: `Ложная улика (${ev.label}) — явная попытка подставы.`
                });
                continue;
            }

            if (!lastTest) {
                // Улика без теста
                polarity = 'prosecution';
                strength = 0.2; // Очень слабая сила
            } else if (lastTest.status === 'match') {
                polarity = 'prosecution';
                // Strength выводится из P(E|G)
                strength = lhRates.forGuilty; 
            } else if (lastTest.status === 'no_match') {
                polarity = 'defense';
                strength = 1 - lhRates.forInnocent; // Если шанс найти это если он невиновен был очень мал, то несовпадение очень сильно его оправдывает
            }

            if (polarity !== 'neutral') {
                inputs.push({
                    sourceType: lastTest ? 'expertise' : 'evidence',
                    polarity,
                    strength,
                    reliability: ev.confidence ?? Math.max(0.2, 1 - (ev.originalQuality ? (1-ev.originalQuality) : 0)),
                    explain: `${lastTest ? 'Экспертиза' : 'Улика'} [${ev.label}]: ${lastTest?.status ?? 'без тестов'}`
                });
            }
        }

        // 2. Свидетели (Witnesses via Credibility Profiles)
        const credProfiles = trialSignals.credibilityProfiles || [];
        for (const wp of credProfiles) {
            // Если свидетель говорит против обвиняемого — prosecution.
            // Но мы сейчас упрощенно считаем всех свидетелей обвинителями из CaseGenerator.
            // В Production: witness.testimony.target === 'suspect'
            
            const isAlibi = wp.profile?.badge?.includes('Алиби') || false;
            const polarity = isAlibi ? 'defense' : 'prosecution';

            // Насколько мы ему верим (reliability)
            const reliability = Math.max(0, wp.score);
            
            // Если reliability < 0.3, свидетель может сработать в обратную сторону (ему не верят)
            if (reliability < 0.3 && polarity === 'prosecution') {
                inputs.push({ sourceType: 'witness', polarity: 'defense', strength: 0.3, reliability: (0.3 - reliability) * 2, explain: `Сомнительные показания против обвиняемого (${wp.name})` });
            } else if (reliability > 0.6) {
                 inputs.push({ sourceType: 'witness', polarity, strength: 0.5, reliability, explain: `Показания свидетеля: ${wp.name}` });
            }
        }

        // 3. Противоречия (Contradictions)
        const contradictions = trialSignals.contradictions || [];
        for (const c of contradictions) {
            // Противоречия разрушают стройность обвинения
            const strengthMap = { critical: 1.0, major: 0.6, minor: 0.3 };
            inputs.push({
                sourceType: 'contradiction',
                polarity: 'defense',
                strength: strengthMap[c.severity] || 0.5,
                reliability: 0.9, // Противоречия фактологичны
                explain: `Противоречие: ${c.type}`
            });
        }

        return this.evaluateInputs(inputs, 0.50);
    }

    // ─── Утилиты ─────────────────────────────────────────────────────────────

    static describeConfidence(p) {
        if (p >= 0.90) return 'Вина доказана категорически';
        if (p >= 0.75) return 'Веские основания считать виновным';
        if (p >= 0.60) return 'Перевес улик в сторону обвинения';
        if (p >= 0.45) return 'Неоднозначная картина доказательств';
        if (p >= 0.30) return 'Перевес в сторону невиновности';
        if (p >= 0.15) return 'Серьёзные сомнения в вине';
        return 'Отсутствие доказательств вины';
    }

    static recommendVerdict(p) {
        if (p >= 0.70) return 'guilty';
        if (p <= 0.35) return 'innocent';
        return 'insufficient_evidence';
    }

    static _getLikelihoodKey(ev) {
        const lastTest = ev.tests?.[ev.tests.length - 1];
        if (lastTest?.type && this.EVIDENCE_LIKELIHOODS[lastTest.type]) return lastTest.type;
        const validTest = ev.validTests?.[0];
        if (validTest && this.EVIDENCE_LIKELIHOODS[validTest]) return validTest;
        return ev.type || 'default';
    }

    static _buildResult(finalPrior, steps) {
        return {
            probability: +finalPrior.toFixed(3),
            confidence: Math.abs(finalPrior - 0.5) * 2, // 0..1
            score: Math.round(finalPrior * 100),
            recommendation: this.recommendVerdict(finalPrior),
            description: this.describeConfidence(finalPrior),
            breakdown: steps,
            positiveCount: steps.filter(s => s.delta > 0).length,
            negativeCount: steps.filter(s => s.delta < 0).length,
            color: finalPrior >= 0.70 ? '#ef4444' : finalPrior <= 0.35 ? '#22c55e' : '#f59e0b',
        };
    }
}
