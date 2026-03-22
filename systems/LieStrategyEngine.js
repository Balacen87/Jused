/**
 * Движок стратегий лжи (Lie Strategy Engine) v2
 *
 * v2 добавляет:
 *  - 3 новые стратегии: CORROBORATE, DEFLECT, EMOTIONAL
 *  - getSeverityScore(strategy) → 0..1
 *  - getStrategyDescription(strategy) → string
 */
export class LieStrategyEngine {
    static STRATEGIES = {
        DENY:          'deny',          // «Я ничего не видел»
        MINIMIZE:      'minimize',      // «Он просто стоял рядом»
        MISIDENTIFY:   'misidentify',   // «Это был другой человек»
        SHIFT_BLAME:   'shift_blame',   // «Я видел, как другой взял»
        PARTIAL_TRUTH: 'partial_truth', // «Я видел его там, но не сам акт»
        // Новые в v2:
        CORROBORATE:   'corroborate',   // Подтверждает ложное алиби другого свидетеля
        DEFLECT:       'deflect',       // Уводит разговор на второстепенное
        EMOTIONAL:     'emotional',     // Эмоциональный взрыв, чтобы уйти от вопроса
    };

    /** Насколько «опасна» стратегия для обнаружения лжи (0=легко поймать, 1=трудно) */
    static SEVERITY_SCORES = {
        deny:          0.55,
        minimize:      0.70,
        misidentify:   0.65,
        shift_blame:   0.75,
        partial_truth: 0.85,
        corroborate:   0.80,
        deflect:       0.72,
        emotional:     0.60,
    };

    /**
     * Выбор стратегии лжи на основе профиля свидетеля.
     */
    static chooseStrategy(witness) {
        if (witness.motivation?.protectDefendant > 0.6) {
            return this.STRATEGIES.CORROBORATE;
        }
        if (witness.motivation?.selfProtection > 0.5) {
            return this.STRATEGIES.PARTIAL_TRUTH;
        }
        if (witness.personality?.impulsivity > 0.7) {
            return this.STRATEGIES.EMOTIONAL;
        }
        if (witness.personality?.impulsivity > 0.5) {
            return this.STRATEGIES.MISIDENTIFY;
        }
        if (witness.motivation?.selfProtection > 0.3) {
            return this.STRATEGIES.DEFLECT;
        }
        const keys = Object.values(this.STRATEGIES);
        return keys[Math.floor(Math.random() * keys.length)];
    }

    /**
     * Оценка «опасности» стратегии [0..1].
     * Высокий score = сложнее поймать, меньше влияние на credibility.
     */
    static getSeverityScore(strategy) {
        return this.SEVERITY_SCORES[strategy] ?? 0.5;
    }

    /**
     * Краткое описание стратегии для UI.
     */
    static getStrategyDescription(strategy) {
        const desc = {
            deny:          'Полное отрицание — свидетель утверждает, что ничего не видел',
            minimize:      'Преуменьшение — действия подозреваемого изображаются невинными',
            misidentify:   'Подмена личности — свидетель описывает другого человека',
            shift_blame:   'Перекладывание — указывает на третье лицо',
            partial_truth: 'Полуправда — сообщает часть фактов, умалчивая ключевое',
            corroborate:   'Лжеподдержка — подтверждает показания другого лжесвидетеля',
            deflect:       'Уход от темы — переключает внимание на несущественное',
            emotional:     'Эмоциональная защита — взрыв эмоций вместо ответа',
        };
        return desc[strategy] ?? 'Неизвестная стратегия';
    }

    /**
     * Генерация текста лжи на основе стратегии.
     */
    static generateLieText(strategy, trueScenario) {
        switch (strategy) {
            case this.STRATEGIES.DENY:
                return `Я ничего не видел в районе ${trueScenario?.location || 'места событий'}. Я вообще был в другом месте.`;
            case this.STRATEGIES.MINIMIZE:
                return `Подсудимый просто стоял рядом, он ничего не делал противозаконного. Это обычный человек.`;
            case this.STRATEGIES.MISIDENTIFY:
                return `Там был человек, похожий на подсудимого, но я уверен — это был кто-то другой, повыше ростом.`;
            case this.STRATEGIES.SHIFT_BLAME:
                return `Я видел, как какой-то неизвестный мужчина быстро уходил со стороны ${trueScenario?.location || 'места'}. Наверное, это он.`;
            case this.STRATEGIES.PARTIAL_TRUTH:
                return `Да, я видел обвиняемого около ${trueScenario?.location || 'места'} примерно в ${trueScenario?.time || 'указанное время'}. Но я не видел самого момента происшествия.`;
            case this.STRATEGIES.CORROBORATE:
                return `Всё именно так, как сказал предыдущий свидетель. Подсудимый был с нами — я могу это подтвердить.`;
            case this.STRATEGIES.DEFLECT:
                return `Вы знаете, важнее другое — я слышал, что у потерпевшей стороны были свои мотивы в этом деле...`;
            case this.STRATEGIES.EMOTIONAL:
                return `(Голос дрожит) Вы не понимаете, как это тяжело вспоминать! Я не могу говорить об этом спокойно!`;
            default:
                return 'Я затрудняюсь ответить точно.';
        }
    }
}

