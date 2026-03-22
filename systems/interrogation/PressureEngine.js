/**
 * PressureEngine — многомерная система давления на допрашиваемого.
 *
 * Вместо одной переменной "стресс" — 5 шкал:
 *   emotional / logical / evidence / fatigue / social
 *
 * Каждый вопрос двигает разные шкалы. Когнитивная нагрузка считается отдельно.
 */

export class PressureEngine {

    static INITIAL_STATE() {
        return {
            emotional: 0.0,
            logical:   0.0,
            evidence:  0.0,
            fatigue:   0.0,
            social:    0.0,
            total:     0.0,
        };
    }

    /**
     * Обновляет состояние давления после вопроса.
     *
     * @param {Object} pressureState — текущее давление (мутируется!)
     * @param {Object} psychModel — SubjectPsychologyModel
     * @param {Object} qt — QuestionEngine.QUESTION_TYPES[type]
     * @param {Object} tactic — InterrogationTactics.TACTICS[key]
     * @param {number} contradictionStrength — 0..1
     * @param {number} evidenceReliability — 0..1
     * @param {number} questionNumber — сколько вопросов уже задано
     * @returns {Object} обновлённый pressureState
     */
    static apply(pressureState, psychModel, qt, tactic, contradictionStrength, evidenceReliability, questionNumber) {
        const anxiety  = psychModel.fear;
        const courage  = psychModel.stressTolerance;
        const ego      = psychModel.ego;
        const moral    = psychModel.moralConflict;
        const protect  = psychModel.protectTarget;

        // Тактический множитель
        const tacticMult = tactic?.pressureMultiplier ?? 1.0;

        // 1. Эмоциональное давление — страх, усталость, тревога
        const emotionalDelta =
            (qt.emotional ?? 0.1) * tacticMult +
            anxiety * 0.14 -
            courage * 0.10;

        // 2. Логическое давление — противоречия, хронология
        const logicalDelta =
            (qt.logical ?? 0.05) * tacticMult +
            contradictionStrength * 0.22;

        // 3. Доказательственное — предъявление улик
        const evidenceDelta =
            (qt.evidence ?? 0.00) * tacticMult +
            evidenceReliability * 0.30;

        // 4. Усталость — накапливается линейно
        const fatigueDelta =
            0.028 +
            (qt.fatigue ?? 0.02) +
            questionNumber * 0.002;

        // 5. Социальное давление — конфронтация, мораль, защита
        const socialDelta =
            (qt.social ?? 0.05) * tacticMult +
            moral * 0.10 +
            protect * 0.05;

        pressureState.emotional = PressureEngine._clamp(pressureState.emotional + emotionalDelta);
        pressureState.logical   = PressureEngine._clamp(pressureState.logical   + logicalDelta);
        pressureState.evidence  = PressureEngine._clamp(pressureState.evidence  + evidenceDelta);
        pressureState.fatigue   = PressureEngine._clamp(pressureState.fatigue   + fatigueDelta);
        pressureState.social    = PressureEngine._clamp(pressureState.social    + socialDelta);

        // Взвешенное итоговое давление
        pressureState.total = PressureEngine._clamp(
            pressureState.emotional * 0.28 +
            pressureState.logical   * 0.25 +
            pressureState.evidence  * 0.22 +
            pressureState.fatigue   * 0.12 +
            pressureState.social    * 0.13
        );

        return pressureState;
    }

    /**
     * Индекс слома на основе давления + когнитивной нагрузки + психологии.
     * Возвращает 0..1
     */
    static breakIndex(pressureState, cognitiveLoad, exposedCount, psychModel) {
        const exposedNorm = Math.min(1, exposedCount / 4);
        const resistance  = psychModel.stressTolerance;

        return PressureEngine._clamp(
            pressureState.total     * 0.30 +
            cognitiveLoad            * 0.25 +
            exposedNorm              * 0.20 +
            pressureState.fatigue    * 0.10 +
            psychModel.moralConflict * 0.15 -
            resistance               * 0.20
        );
    }

    /**
     * Определяет стадию слома по индексу.
     * @returns {'stable'|'strained'|'cracking'|'fractured'|'collapsed'}
     */
    static breakStage(breakIdx) {
        if (breakIdx >= 0.90) return 'collapsed';
        if (breakIdx >= 0.70) return 'fractured';
        if (breakIdx >= 0.48) return 'cracking';
        if (breakIdx >= 0.25) return 'strained';
        return 'stable';
    }

    static STAGE_LABELS = {
        stable:    { label: 'Стабилен',      color: '#22c55e', icon: '🔒' },
        strained:  { label: 'Напряжён',      color: '#84cc16', icon: '😐' },
        cracking:  { label: 'Трещит',        color: '#f59e0b', icon: '⚠️' },
        fractured: { label: 'Ломается',      color: '#f97316', icon: '💥' },
        collapsed: { label: 'Сломан',        color: '#ef4444', icon: '🔓' },
    };

    static _clamp(v) { return Math.max(0, Math.min(1, v)); }
}
