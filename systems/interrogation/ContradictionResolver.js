/**
 * ContradictionResolver — детектор противоречий в показаниях.
 *
 * Различает 8 типов противоречий:
 *   temporal / spatial / sensory / behavioral /
 *   evidence / relational / narrative_overload / alibi
 *
 * Используется InterrogationDirector для оценки что «вскрыто»
 * и PressureEngine для логического давления.
 */

export const CONTRADICTION_TYPES = {
    temporal: {
        label:       'Временное',
        description: 'Не сходится время событий в показаниях.',
        severity:    'high',
        icon:        '⏱️'
    },
    spatial: {
        label:       'Пространственное',
        description: 'Не сходится место: свидетель не мог наблюдать то, что описывает.',
        severity:    'high',
        icon:        '📍'
    },
    sensory: {
        label:       'Сенсорное',
        description: 'Описывает то, что не мог видеть, слышать или чувствовать.',
        severity:    'medium',
        icon:        '👁️'
    },
    behavioral: {
        label:       'Поведенческое',
        description: 'Поведение в описанной версии нелогично или неестественно.',
        severity:    'medium',
        icon:        '🧠'
    },
    evidence: {
        label:       'Доказательственное',
        description: 'Показание противоречит объективной улике.',
        severity:    'critical',
        icon:        '🔬'
    },
    relational: {
        label:       'Реляционное',
        description: 'Ложь о знакомстве, связи или мотивации.',
        severity:    'high',
        icon:        '🔗'
    },
    narrative_overload: {
        label:       'Перегрузка нарратива',
        description: 'Версия слишком детальна и начинает рассыпаться.',
        severity:    'medium',
        icon:        '💬'
    },
    alibi: {
        label:       'Алиби',
        description: 'Алиби не подтверждается или прямо опровергается.',
        severity:    'critical',
        icon:        '🛡️'
    },
};

export class ContradictionResolver {

    /**
     * Проверяет показание свидетеля и evidence на наличие противоречий.
     *
     * @param {Object} testimony — объект Testimony {type, text, nodeId, ...}
     * @param {Object|null} evidence — связанная улика (может быть null)
     * @param {Object} witness — Witness object
     * @param {Object} psychModel — SubjectPsychologyModel
     * @param {Object} session — InterrogationSession
     * @returns {Array<{type, label, description, severity, icon}>}
     */
    static detect(testimony, evidence, witness, psychModel, session) {
        const found = [];

        if (!testimony) return found;

        // 1. Temporal — ложь часто нарушает хронологию
        if (testimony.type === 'lie') {
            const timeConflict = ContradictionResolver._checkTemporal(testimony, session);
            if (timeConflict) found.push({ ...CONTRADICTION_TYPES.temporal, id: `C_T_${testimony.id ?? Date.now()}` });
        }

        // 2. Evidence — если улика существует и показание ей противоречит
        if (evidence && testimony.type === 'lie') {
            const evRel = evidence.confidence ?? evidence.reliability ?? 0.5;
            if (evRel > 0.55) {
                found.push({ ...CONTRADICTION_TYPES.evidence, id: `C_E_${evidence.id ?? 'ev'}` });
            }
        }

        // 3. Sensory contradiction — не мог видеть то, что описывает
        if (psychModel.lieComplexity > 0.55 && testimony.type === 'lie') {
            if (Math.random() < 0.35 + psychModel.cognitiveLoad * 0.2) {
                found.push({ ...CONTRADICTION_TYPES.sensory, id: `C_S_${Date.now()}` });
            }
        }

        // 4. Behavioral — поведение в версии неестественно
        if (testimony.type === 'lie' && Math.random() < 0.25 + session.pressureState.logical * 0.3) {
            found.push({ ...CONTRADICTION_TYPES.behavioral, id: `C_B_${Date.now()}` });
        }

        // 5. Alibi contradiction
        if (testimony.nodeId && testimony.type === 'lie') {
            const alibiCheck = ContradictionResolver._checkAlibi(witness, testimony, evidence);
            if (alibiCheck) found.push({ ...CONTRADICTION_TYPES.alibi, id: `C_A_${Date.now()}` });
        }

        // 6. Narrative overload — слишком сложная история рассыпается
        const lieLoad = psychModel.computeLieLoad(
            session.exposedContradictions.length,
            session.lockedClaims.length,
            session.pressureState.fatigue
        );
        if (lieLoad > 0.7) {
            found.push({ ...CONTRADICTION_TYPES.narrative_overload, id: `C_N_${Date.now()}` });
        }

        // 7. Relational contradiction — врёт о связях
        if (psychModel.protectTarget > 0.5 && testimony.type === 'lie') {
            if (Math.random() < 0.20 + session.pressureState.social * 0.25) {
                found.push({ ...CONTRADICTION_TYPES.relational, id: `C_R_${Date.now()}` });
            }
        }

        return found;
    }

    /**
     * Быстрая оценка силы противоречия для PressureEngine.
     * @returns {number} 0..1
     */
    static contradictionStrength(testimony, evidence, psychModel, session) {
        let score = 0.10;
        if (testimony?.type === 'lie')  score += 0.25;
        if (evidence) {
            const rel = evidence.confidence ?? evidence.reliability ?? 0.5;
            score += rel * 0.35;
            if (evidence.isFake) score -= 0.18;
        }
        score += session.exposedContradictions.length * 0.06;
        score += psychModel.cognitiveLoad * 0.10;
        return Math.max(0, Math.min(1, score));
    }

    static _checkTemporal(testimony, session) {
        // Если уже есть зафиксированные утверждения о времени — проверяем коллизию
        const timeLocks = session.lockedClaims.filter(lc => lc.topic === 'timeline');
        return timeLocks.length > 0 && testimony.type === 'lie';
    }

    static _checkAlibi(witness, testimony, evidence) {
        // Алиби противоречит, если есть улика с nodeId связанным с alibi_event
        if (!evidence) return false;
        const rel = evidence.confidence ?? 0.5;
        return rel > 0.65 && testimony.type === 'lie';
    }
}
