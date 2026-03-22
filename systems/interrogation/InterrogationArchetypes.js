/**
 * InterrogationArchetypes — психологические архетипы допрашиваемых.
 *
 * Каждый архетип задаёт базовые трейты, которые SubjectPsychologyModel
 * применяет к конкретному Witness.
 */

export const ARCHETYPES = {

    /**
     * Хладнокровный лжец — спокоен, версию держит хорошо,
     * но доказательства его разрушают.
     */
    cold_liar: {
        label:           'Хладнокровный лжец',
        honesty:         0.10,
        fear:            0.15,
        ego:             0.55,
        suggestibility:  0.10,
        stressTolerance: 0.80,
        aggression:      0.25,
        compliance:      0.15,
        moralConflict:   0.20,
        lieComplexity:   0.85,
        cognitiveLoad:   0.30,
        weaknesses:      ['evidence_push', 'impossibility_exposure', 'timeline_check'],
        strengths:       ['moral_pressure', 'open_question'],
    },

    /**
     * Тревожный лжец — сразу уходит в уклонение под давлением.
     */
    anxious_liar: {
        label:           'Тревожный лжец',
        honesty:         0.20,
        fear:            0.75,
        ego:             0.25,
        suggestibility:  0.65,
        stressTolerance: 0.25,
        aggression:      0.15,
        compliance:      0.50,
        moralConflict:   0.55,
        lieComplexity:   0.45,
        cognitiveLoad:   0.60,
        weaknesses:      ['repetition', 'silence_pressure', 'sequence_trap'],
        strengths:       ['open_question', 'clarify_detail'],
    },

    /**
     * Защищающий свидетель — врёт ради другого, внутренне конфликтует.
     */
    protective_witness: {
        label:           'Защищающий свидетель',
        honesty:         0.70,
        fear:            0.45,
        ego:             0.30,
        suggestibility:  0.50,
        stressTolerance: 0.45,
        aggression:      0.20,
        compliance:      0.60,
        moralConflict:   0.80,
        lieComplexity:   0.35,
        cognitiveLoad:   0.55,
        weaknesses:      ['moral_pressure', 'witness_confrontation', 'confession_window'],
        strengths:       ['evidence_push', 'alibi_attack'],
    },

    /**
     * Эго-защитник — спорит, злится, не любит уступать.
     */
    ego_defender: {
        label:           'Эго-защитник',
        honesty:         0.35,
        fear:            0.20,
        ego:             0.90,
        suggestibility:  0.15,
        stressTolerance: 0.60,
        aggression:      0.75,
        compliance:      0.10,
        moralConflict:   0.25,
        lieComplexity:   0.60,
        cognitiveLoad:   0.40,
        weaknesses:      ['impossibility_exposure', 'commitment_question', 'credibility_attack'],
        strengths:       ['moral_pressure', 'silence_pressure'],
    },

    /**
     * Хаотичный свидетель — сам по себе путаный, ложь от небрежности не отличить.
     */
    chaotic_witness: {
        label:           'Хаотичный свидетель',
        honesty:         0.60,
        fear:            0.35,
        ego:             0.30,
        suggestibility:  0.70,
        stressTolerance: 0.40,
        aggression:      0.30,
        compliance:      0.55,
        moralConflict:   0.35,
        lieComplexity:   0.15,
        cognitiveLoad:   0.80,
        weaknesses:      ['timeline_check', 'sequence_trap', 'micro_contradiction_probe'],
        strengths:       ['open_question'],
    },

    /**
     * Честный, но слабая память — правдив, но неточен.
     */
    honest_weak_memory: {
        label:           'Честный, слабая память',
        honesty:         0.90,
        fear:            0.30,
        ego:             0.25,
        suggestibility:  0.60,
        stressTolerance: 0.50,
        aggression:      0.10,
        compliance:      0.75,
        moralConflict:   0.10,
        lieComplexity:   0.05,
        cognitiveLoad:   0.60,
        weaknesses:      ['sensory_check', 'memory_load'],
        strengths:       ['open_question', 'clarify_detail'],
    },

    /**
     * Травмированный свидетель — память рваная, давление ухудшает точность.
     */
    traumatized_witness: {
        label:           'Травмированный свидетель',
        honesty:         0.80,
        fear:            0.70,
        ego:             0.20,
        suggestibility:  0.75,
        stressTolerance: 0.20,
        aggression:      0.15,
        compliance:      0.65,
        moralConflict:   0.20,
        lieComplexity:   0.10,
        cognitiveLoad:   0.85,
        weaknesses:      ['memory_load', 'silence_pressure', 'moral_pressure'],
        strengths:       ['leading_question'],
    },

    /**
     * Расчётливый оператор — заранее подготовлен, сложная версия.
     */
    calculated_operator: {
        label:           'Расчётливый оператор',
        honesty:         0.05,
        fear:            0.10,
        ego:             0.70,
        suggestibility:  0.05,
        stressTolerance: 0.90,
        aggression:      0.35,
        compliance:      0.05,
        moralConflict:   0.05,
        lieComplexity:   0.95,
        cognitiveLoad:   0.20,
        weaknesses:      ['evidence_push', 'impossibility_exposure', 'witness_confrontation'],
        strengths:       ['moral_pressure', 'open_question', 'silence_pressure'],
    },
};

/**
 * Определяет архетип свидетеля по его полям Witness.
 * @param {Object} witness
 * @returns {string} ключ архетипа из ARCHETYPES
 */
export function detectArchetype(witness) {
    const p   = witness?.personality ?? {};
    const m   = witness?.motivation  ?? {};
    const mem = witness?.memory      ?? {};

    const honesty    = p.honesty    ?? 0.5;
    const courage    = p.courage    ?? 0.5;
    const anxiety    = p.anxiety    ?? 0.5;
    const ego        = p.impulsivity ?? 0.5;
    const protect    = m.protectDefendant ?? 0.0;
    const memAcc     = mem.accuracy ?? 0.5;

    // Приоритизированные правила
    if (protect > 0.65 && honesty > 0.55) return 'protective_witness';
    if (honesty > 0.85 && memAcc < 0.40)  return 'honest_weak_memory';
    if (honesty > 0.80 && anxiety > 0.65) return 'traumatized_witness';
    if (anxiety > 0.70 && honesty < 0.40) return 'anxious_liar';
    if (ego > 0.75 && honesty < 0.50)     return 'ego_defender';
    if (anxiety > 0.50 && memAcc < 0.45)  return 'chaotic_witness';
    if (honesty < 0.15 && courage > 0.70) return 'calculated_operator';
    if (honesty < 0.35)                   return 'cold_liar';

    return 'chaotic_witness'; // fallback
}
