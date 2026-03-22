/**
 * SubjectPsychologyModel — психологический профиль допрашиваемого.
 *
 * Строится один раз для сессии из:
 *   - данных Witness (personality, motivation, memory)
 *   - архетипа (InterrogationArchetypes)
 *
 * Все числа: 0.0 – 1.0
 */

import { ARCHETYPES, detectArchetype } from './InterrogationArchetypes.js';

export class SubjectPsychologyModel {

    /**
     * @param {Object} witness — объект Witness из CaseGenerator
     * @returns {SubjectPsychologyModel}
     */
    static fromWitness(witness) {
        const archetypeKey = detectArchetype(witness);
        const base = ARCHETYPES[archetypeKey] ?? ARCHETYPES.chaotic_witness;

        const p   = witness?.personality ?? {};
        const m   = witness?.motivation  ?? {};
        const mem = witness?.memory      ?? {};

        // Смешиваем базу архетипа с реальными полями свидетеля
        const model = new SubjectPsychologyModel();
        model.archetypeKey = archetypeKey;
        model.archetypeLabel = base.label;

        model.honesty         = SubjectPsychologyModel._blend(base.honesty,         p.honesty    ?? 0.5, 0.55);
        model.fear            = SubjectPsychologyModel._blend(base.fear,            p.anxiety    ?? 0.5, 0.55);
        model.ego             = SubjectPsychologyModel._blend(base.ego,             p.impulsivity ?? 0.5, 0.55);
        model.suggestibility  = SubjectPsychologyModel._blend(base.suggestibility,  1 - (p.courage ?? 0.5), 0.60);
        model.stressTolerance = SubjectPsychologyModel._blend(base.stressTolerance, p.courage ?? 0.5, 0.50);
        model.aggression      = SubjectPsychologyModel._blend(base.aggression,      p.impulsivity ?? 0.5, 0.45);
        model.compliance      = SubjectPsychologyModel._blend(base.compliance,      p.empathy    ?? 0.5, 0.45);
        model.moralConflict   = SubjectPsychologyModel._blend(base.moralConflict,   m.justice    ?? 0.5, 0.60);
        model.lieComplexity   = base.lieComplexity;
        model.cognitiveLoad   = base.cognitiveLoad;
        model.memoryAccuracy  = mem.accuracy ?? 0.5;
        model.protectTarget   = m.protectDefendant ?? 0.0;

        model.weaknesses = base.weaknesses ?? [];
        model.strengths  = base.strengths  ?? [];

        return model;
    }

    constructor() {
        this.archetypeKey   = 'chaotic_witness';
        this.archetypeLabel = '?';
        this.honesty         = 0.5;
        this.fear            = 0.5;
        this.ego             = 0.5;
        this.suggestibility  = 0.5;
        this.stressTolerance = 0.5;
        this.aggression      = 0.5;
        this.compliance      = 0.5;
        this.moralConflict   = 0.5;
        this.lieComplexity   = 0.5;
        this.cognitiveLoad   = 0.5;
        this.memoryAccuracy  = 0.5;
        this.protectTarget   = 0.0;
        this.weaknesses      = [];
        this.strengths       = [];
    }

    /**
     * Насколько данный тип вопроса эффективен против этого субъекта.
     * Возвращает {effectiveness, isWeakness, isStrength}
     */
    questionEffectiveness(questionType) {
        const isWeakness = this.weaknesses.includes(questionType);
        const isStrength = this.strengths.includes(questionType);
        const base = isWeakness ? 1.35 : isStrength ? 0.60 : 1.0;
        return { effectiveness: base, isWeakness, isStrength };
    }

    /** Когнитивная нагрузка ложи — растёт с каждым вскрытым противоречием */
    computeLieLoad(exposedContradictionsCount, lockedClaimsCount, fatigue) {
        const raw =
            exposedContradictionsCount * 0.20 +
            lockedClaimsCount          * 0.10 +
            fatigue                    * 0.15 +
            (1 - this.lieComplexity)   * 0.25;
        return Math.min(1, Math.max(0, this.cognitiveLoad + raw));
    }

    /** Порог слома (0–1): когда субъект достигает этого давления — он ломается */
    breakThreshold() {
        return 0.55 + this.stressTolerance * 0.30 - this.moralConflict * 0.10;
    }

    static _blend(archetypeVal, witnessVal, archetypeWeight) {
        const w = Math.max(0, Math.min(1, archetypeWeight));
        const v = archetypeVal * w + witnessVal * (1 - w);
        return Math.max(0, Math.min(1, v));
    }
}
