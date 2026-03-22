/**
 * Менеджер особых событий (Special Event Manager)
 * Генерирует случайные события в ходе судебного процесса.
 */
export class SpecialEventManager {
    static EVENT_TYPES = {
        MEDIA_PRESSURE: 'media_pressure', // Давление СМИ
        BRIBERY_ATTEMPT: 'bribery_attempt', // Попытка подкупа
        ANONYMOUS_CALL: 'anonymous_call', // Анонимный звонок
        FAKE_EXPERTISE: 'fake_expertise' // Поддельная экспертиза
    };

    /**
     * Генерирует случайное событие для текущего дела
     */
    static generateEvent(activeCase, careerRank) {
        const rand = Math.random();
        
        // Вероятность события зависит от сложности (ранга)
        let probability = 0.3;
        if (careerRank === "Районный судья") probability = 0.4;
        if (careerRank === "Областной судья") probability = 0.5;
        if (careerRank === "Верховный судья") probability = 0.6;

        if (rand > probability) return null;

        const types = Object.values(this.EVENT_TYPES);
        const type = types[Math.floor(Math.random() * types.length)];

        return this._createEventData(type, activeCase);
    }

    static _createEventData(type, activeCase) {
        switch (type) {
            case this.EVENT_TYPES.MEDIA_PRESSURE:
                return {
                    type,
                    title: "Давление СМИ 📰",
                    description: "Крупное издание опубликовало статью, требуя самого строгого наказания для подсудимого. Присяжные и общество ждут обвинительного приговора.",
                    effect: "Ожидание: Виновен. Отклонение может снизить репутацию сильнее."
                };
            case this.EVENT_TYPES.BRIBERY_ATTEMPT:
                return {
                    type,
                    title: "Попытка подкупа 💰",
                    description: "Через посредника вам намекнули, что вынесение оправдательного приговора будет щедро вознаграждено ( +500 очков).",
                    effect: "Коррупционный выбор. Огромные очки, но риск мгновенного завершения карьеры при проверке."
                };
            case this.EVENT_TYPES.ANONYMOUS_CALL:
                return {
                    type,
                    title: "Анонимный звонок 📞",
                    description: "Неизвестный сообщил, что один из ключевых свидетелей был запуган защитой.",
                    effect: "Подсказка: Снижение доверия к свидетелю с самым высоким уровнем страха."
                };
            case this.EVENT_TYPES.FAKE_EXPERTISE:
                return {
                    type,
                    title: "Сомнительная экспертиза 📑",
                    description: "Анализ улик выглядит подозрительно аккуратным. Возможно, выводы были подделаны.",
                    effect: "Риск: Увеличена вероятность ошибки в автоматических выводах."
                };
            default:
                return null;
        }
    }
}
