/**
 * InterrogationTactics — тактики ведения допроса.
 *
 * Каждая тактика определяет:
 *   - множитель давления (pressureMultiplier)
 *   - предпочтительные типы вопросов
 *   - риски (против каких архетипов хуже работает)
 *   - сильные стороны
 */

export const TACTICS = {
    soft: {
        key:               'soft',
        label:             'Мягкая',
        icon:              '🤝',
        description:       'Доверие, открытые вопросы, снижение тревоги. Эффективна с защищающими свидетелями.',
        pressureMultiplier: 0.60,
        preferredQuestions:['open_question', 'clarify_detail', 'sensory_check'],
        bonusVsArchetypes: ['protective_witness', 'traumatized_witness', 'honest_weak_memory'],
        riskVsArchetypes:  ['cold_liar', 'calculated_operator'],
        exhaustionRate:    0.5,
    },
    analytical: {
        key:               'analytical',
        label:             'Аналитическая',
        icon:              '📊',
        description:       'Хронология, детали, последовательность. Создаёт ловушки через уточнения.',
        pressureMultiplier: 0.90,
        preferredQuestions:['timeline_check', 'sequence_trap', 'clarify_detail', 'micro_contradiction_probe'],
        bonusVsArchetypes: ['cold_liar', 'chaotic_witness'],
        riskVsArchetypes:  ['ego_defender'],
        exhaustionRate:    0.7,
    },
    legal: {
        key:               'legal',
        label:             'Юридическая',
        icon:              '⚖️',
        description:       'Фиксация версии, lock_statement, уточнение формулировок.',
        pressureMultiplier: 0.85,
        preferredQuestions:['lock_statement', 'commitment_question', 'force_precision', 'repeat_question'],
        bonusVsArchetypes: ['anxious_liar', 'chaotic_witness'],
        riskVsArchetypes:  ['calculated_operator'],
        exhaustionRate:    0.6,
    },
    aggressive: {
        key:               'aggressive',
        label:             'Агрессивная',
        icon:              '⚔️',
        description:       'Высокое давление, быстрый рост стресса. Риск shutdown и молчания.',
        pressureMultiplier: 1.45,
        preferredQuestions:['witness_confrontation', 'credibility_attack', 'alibi_attack', 'moral_pressure'],
        bonusVsArchetypes: ['anxious_liar', 'protective_witness'],
        riskVsArchetypes:  ['ego_defender', 'calculated_operator', 'cold_liar'],
        exhaustionRate:    1.3,
    },
    moral: {
        key:               'moral',
        label:             'Моральная',
        icon:              '🕊️',
        description:       'Апелляция к совести, справедливости, последствиям для других.',
        pressureMultiplier: 0.95,
        preferredQuestions:['moral_pressure', 'confession_window', 'choice_trap'],
        bonusVsArchetypes: ['protective_witness', 'honest_weak_memory'],
        riskVsArchetypes:  ['cold_liar', 'calculated_operator', 'ego_defender'],
        exhaustionRate:    0.65,
    },
    evidence_based: {
        key:               'evidence_based',
        label:             'Доказательственная',
        icon:              '🔬',
        description:       'Предъявление улик, объективные данные, impossibility_exposure.',
        pressureMultiplier: 1.15,
        preferredQuestions:['evidence_push', 'impossibility_exposure', 'timeline_check'],
        bonusVsArchetypes: ['cold_liar', 'calculated_operator', 'ego_defender'],
        riskVsArchetypes:  ['traumatized_witness'],
        exhaustionRate:    0.8,
    },
    detail_trap: {
        key:               'detail_trap',
        label:             'Ловушка на деталях',
        icon:              '🪤',
        description:       'Перегрузка деталями, memory_load, micro_contradiction_probe.',
        pressureMultiplier: 1.10,
        preferredQuestions:['memory_load', 'micro_contradiction_probe', 'sensory_check', 'location_check'],
        bonusVsArchetypes: ['cold_liar', 'anxious_liar', 'chaotic_witness'],
        riskVsArchetypes:  ['calculated_operator'],
        exhaustionRate:    0.9,
    },
    confrontational: {
        key:               'confrontational',
        label:             'Конфронтационная',
        icon:              '🥊',
        description:       'Лобовое столкновение с показаниями других свидетелей. Хороша после фиксации версии.',
        pressureMultiplier: 1.30,
        preferredQuestions:['witness_confrontation', 'impossibility_exposure', 'sequence_trap'],
        bonusVsArchetypes: ['protective_witness', 'anxious_liar'],
        riskVsArchetypes:  ['ego_defender', 'calculated_operator'],
        exhaustionRate:    1.1,
    },
};

/**
 * Рекомендует тактику для данного архетипа и фазы допроса.
 * @param {string} archetypeKey
 * @param {string} phase — фаза допроса
 * @returns {Object} тактика из TACTICS
 */
export function recommendTactic(archetypeKey, phase) {
    const recommendations = {
        protective_witness: { baseline: 'soft', probing: 'soft', containment: 'moral', pressure: 'confrontational', break: 'moral', closure: 'legal' },
        cold_liar:          { baseline: 'analytical', probing: 'detail_trap', containment: 'legal', pressure: 'evidence_based', break: 'confrontational', closure: 'legal' },
        anxious_liar:       { baseline: 'soft', probing: 'analytical', containment: 'legal', pressure: 'aggressive', break: 'aggressive', closure: 'legal' },
        ego_defender:       { baseline: 'analytical', probing: 'analytical', containment: 'legal', pressure: 'evidence_based', break: 'evidence_based', closure: 'confrontational' },
        chaotic_witness:    { baseline: 'soft', probing: 'detail_trap', containment: 'legal', pressure: 'detail_trap', break: 'analytical', closure: 'legal' },
        honest_weak_memory: { baseline: 'soft', probing: 'soft', containment: 'soft', pressure: 'soft', break: 'moral', closure: 'soft' },
        traumatized_witness:{ baseline: 'soft', probing: 'soft', containment: 'soft', pressure: 'moral', break: 'moral', closure: 'soft' },
        calculated_operator:{ baseline: 'analytical', probing: 'detail_trap', containment: 'legal', pressure: 'evidence_based', break: 'confrontational', closure: 'evidence_based' },
    };

    const rec = recommendations[archetypeKey] ?? {};
    const tacticKey = rec[phase] ?? 'analytical';
    return TACTICS[tacticKey];
}
