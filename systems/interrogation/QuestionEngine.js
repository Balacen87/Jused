/**
 * Движок классификации и генерации вопросов.
 * Содержит все типы вопросов, доступных в игре, и их характеристики:
 *   - влияние на состояние свидетеля (emotional, logical, etc.)
 *   - совместимые фазы
 *   - текст-шаблон
 */

export class QuestionEngine {

    // Категории вопросов
    static CATEGORIES = {
        basic:     { label: 'Базовые',            color: '#6366f1' },
        strategic: { label: 'Тактические',        color: '#f59e0b' },
        pressure:  { label: 'Давление',           color: '#ef4444' },
        breakdown: { label: 'Разлом версии',      color: '#dc2626' }
    };

    // Тип вопроса → полный профиль
    static QUESTION_TYPES = {

        // ── БАЗОВЫЕ ──────────────────────────────────────────────────────────

        open_question: {
            label:'Открытый вопрос', icon:'💬', category:'basic',
            emotional:0.04, logical:0.02, evidence:0.00, fatigue:0.01, social:0.03,
            contradictionChance:0.05, rapportRisk:-0.05,
            phases:['baseline','probing'],
            templates: [
                'Расскажите своими словами всё, что произошло в тот день.',
                'Опишите в подробностях, как разворачивались события.',
                'Давайте начнем с самого начала: расскажите мне вашу версию.',
                'Как вы можете описать то, что случилось?'
            ]
        },
        clarify_detail: {
            label:'Уточнение детали', icon:'🔎', category:'basic',
            emotional:0.06, logical:0.08, evidence:0.00, fatigue:0.02, social:0.02,
            contradictionChance:0.12, rapportRisk:0.02,
            phases:['probing','containment','pressure'],
            templates: [
                'Уточните: что именно вы имели в виду, когда упомянули "{detail}"?',
                'Давайте остановимся на этом. Можете рассказать про "{detail}" подробнее?',
                'Вы упомянули "{detail}". Объясните конкретнее эти слова.',
                'Заострим внимание: что кроется за фразой "{detail}"?'
            ]
        },
        repeat_question: {
            label:'Повторный вопрос', icon:'🔄', category:'basic',
            emotional:0.10, logical:0.10, evidence:0.00, fatigue:0.04, social:0.05,
            contradictionChance:0.18, rapportRisk:0.06,
            phases:['probing','containment','pressure'],
            templates: [
                'Прошу ответить ещё раз: что именно вы делали в {time}?',
                'Давайте вернемся немного назад. Повторите: чем вы занимались в {time}?',
                'Я задам этот вопрос снова. Ответьте предельно ясно: ваши действия в {time}?',
                'Спрошу еще раз. Что конкретно происходило в {time}?'
            ]
        },
        timeline_check: {
            label:'Проверка времени', icon:'⏱️', category:'basic',
            emotional:0.08, logical:0.18, evidence:0.05, fatigue:0.03, social:0.03,
            contradictionChance:0.25, rapportRisk:0.04,
            phases:['probing','containment','pressure'],
            templates: [
                'Во сколько именно вы {action}? Точное время, пожалуйста.',
                'Назовите точное время, когда вы {action}. Это важно для дела.',
                'Постарайтесь вспомнить до минут: в какой момент вы {action}?',
                'Если взглянуть на хронологию, во сколько вы совершили "{action}"?'
            ]
        },
        location_check: {
            label:'Проверка места', icon:'📍', category:'basic',
            emotional:0.06, logical:0.14, evidence:0.08, fatigue:0.02, social:0.02,
            contradictionChance:0.20, rapportRisk:0.03,
            phases:['probing','containment','pressure'],
            templates: [
                'Где именно вы находились? Опишите точное место.',
                'Назовите ваше точное местоположение в этот момент времени.',
                'Опишите локацию. Где вы стояли и что вас окружало?',
                'Укажите конкретную точку вашего нахождения, когда всё случилось.'
            ]
        },
        sensory_check: {
            label:'Сенсорная проверка', icon:'👁️', category:'basic',
            emotional:0.05, logical:0.12, evidence:0.04, fatigue:0.02, social:0.01,
            contradictionChance:0.16, rapportRisk:0.02,
            phases:['baseline','probing'],
            templates: [
                'Что именно вы видели, слышали, ощущали в тот момент?',
                'Попробуйте вспомнить запахи, звуки или освещение в ту минуту.',
                'На чём был сфокусирован ваш взгляд? Что привлекло внимание?',
                'Вспомните сенсорные детали. Любой шум, блик или тень.'
            ]
        },

        // ── ТАКТИЧЕСКИЕ ──────────────────────────────────────────────────────

        leading_question: {
            label:'Наводящий вопрос', icon:'🎯', category:'strategic',
            emotional:0.08, logical:0.06, evidence:0.00, fatigue:0.02, social:0.08,
            contradictionChance:0.14, rapportRisk:0.10,
            phases:['probing','pressure'],
            templates: [
                'Значит, вы не могли не заметить {fact}, верно?',
                'Согласитесь, очевидно, что вы в курсе про {fact}?',
                'То есть вы подтверждаете этот очевидный факт — {fact}?',
                'Следовательно, вы должны были обратить внимание на {fact}. Это так?'
            ]
        },
        narrowing_question: {
            label:'Сужающий вопрос', icon:'🔦', category:'strategic',
            emotional:0.10, logical:0.14, evidence:0.04, fatigue:0.03, social:0.04,
            contradictionChance:0.20, rapportRisk:0.05,
            phases:['containment','pressure'],
            templates: [
                'Правильно понимаю: это произошло строго между {time1} и {time2}?',
                'Давайте сузим рамки: это случилось не раньше {time1} и не позже {time2}. Верно?',
                'То есть окно возможностей ограничивается промежутком от {time1} до {time2}?',
                'Значит, иного времени, кроме как с {time1} до {time2}, быть не могло?'
            ]
        },
        choice_trap: {
            label:'Ложная развилка', icon:'🪤', category:'strategic',
            emotional:0.12, logical:0.16, evidence:0.00, fatigue:0.04, social:0.08,
            contradictionChance:0.28, rapportRisk:0.12,
            phases:['containment','pressure'],
            templates: [
                'Или вы были там в {time1}, или в {time2} — другого варианта нет. Что выбираете?',
                'Либо вы соглашаетесь с {prev}, либо подтверждаете {now}. Определяйтесь.',
                'Тут только два пути: либо {prev}, либо вы лжете прямо сейчас. Выбор за вами.',
                'Выберите одно из двух: вы действительно сделали "{action}", или просто наблюдали?'
            ]
        },
        sequence_trap: {
            label:'Проверка порядка событий', icon:'📋', category:'strategic',
            emotional:0.10, logical:0.20, evidence:0.06, fatigue:0.05, social:0.03,
            contradictionChance:0.30, rapportRisk:0.07,
            phases:['probing','containment','pressure'],
            templates: [
                'Восстановите порядок: что произошло сначала, что потом?',
                'Давайте шаг за шагом. Сначала вы сделали это, а после — что именно?',
                'Хронология не сходится. Опишите последовательность действий ещё раз.',
                'Что было раньше: ваше действие или этот момент?'
            ]
        },
        memory_load: {
            label:'Перегрузка памяти', icon:'🧩', category:'strategic',
            emotional:0.12, logical:0.14, evidence:0.00, fatigue:0.08, social:0.03,
            contradictionChance:0.22, rapportRisk:0.08,
            phases:['pressure','break'],
            templates: [
                'Назовите: цвет одежды, точное время, кто был рядом, что держали в руках?',
                'Опишите всё сразу: где стояли люди, куда смотрели, что говорили, и какая была погода?',
                'А теперь быстро: номер машины, порода собаки, цвет куртки и время на часах!',
                'Дайте мне конкретику по каждой мелочи в этой комнате без раздумий!'
            ]
        },
        micro_contradiction_probe: {
            label:'Микро-противоречие', icon:'🔬', category:'strategic',
            emotional:0.08, logical:0.22, evidence:0.06, fatigue:0.03, social:0.04,
            contradictionChance:0.35, rapportRisk:0.08,
            phases:['probing','containment','pressure'],
            templates: [
                'В прошлый раз вы сказали "{prev}". Сейчас говорите "{now}". Как это объяснить?',
                'Интересно получается. Минуту назад было "{prev}", а теперь "{now}". Где правда?',
                'Ваши слова не сходятся. Вы только что утверждали "{prev}", а выводите "{now}". Почему?',
                'Заметили нестыковку? Сначала "{prev}", затем неожиданно "{now}". Прокомментируйте.'
            ]
        },

        // ── ДАВЛЕНИЕ ─────────────────────────────────────────────────────────

        evidence_push: {
            label:'Предъявление улики', icon:'📁', category:'pressure',
            emotional:0.14, logical:0.18, evidence:0.38, fatigue:0.04, social:0.10,
            contradictionChance:0.50, rapportRisk:0.15,
            phases:['pressure','break'],
            templates: [
                'Вот {evidence_label}. Как вы объясните, что это противоречит вашим словам?',
                'Ознакомьтесь: {evidence_label}. Теперь вы понимаете, что ваша версия сыпется?',
                'Материалы дела, а именно {evidence_label}, прямо опровергают то, что вы сказали.',
                'У меня в руках {evidence_label}. Хотите изменить свои показания с учётом этого факта?'
            ]
        },
        alibi_attack: {
            label:'Атака на алиби', icon:'🛡️', category:'pressure',
            emotional:0.18, logical:0.22, evidence:0.28, fatigue:0.05, social:0.12,
            contradictionChance:0.45, rapportRisk:0.18,
            phases:['pressure','break'],
            templates: [
                'Ваше алиби не подтверждается. Почему в {time} вас не было там, где вы утверждаете?',
                'Мы проверили ваше алиби на {time}. Оно развалилось. Где вы были на самом деле?',
                'Нет ни одного подтверждения вашему алиби. Прекратите лгать, скажите правду.',
                'Люди не видели вас в {time}. Камеры тоже. Придумайте новую басню или скажите правду!'
            ]
        },
        witness_confrontation: {
            label:'Конфронтация со свидетелем', icon:'⚔️', category:'pressure',
            emotional:0.20, logical:0.18, evidence:0.20, fatigue:0.06, social:0.22,
            contradictionChance:0.48, rapportRisk:0.20,
            phases:['pressure','break'],
            templates: [
                'Другой свидетель говорит, что {other_claim}. Кто из вас лжёт?',
                'Интересно, но другие люди утверждают {other_claim}. Как так вышло?',
                'Мы опросили свидетелей, и они описывают {other_claim}. Кому из вас мне верить?',
                'Показания расходятся. Кто-то заявляет про {other_claim}. У вас есть комментарии?'
            ]
        },
        moral_pressure: {
            label:'Моральное давление', icon:'🕊️', category:'pressure',
            emotional:0.22, logical:0.05, evidence:0.00, fatigue:0.03, social:0.25,
            contradictionChance:0.18, rapportRisk:0.12,
            phases:['pressure','break','closure'],
            templates: [
                'Вы понимаете, что ложные показания — это преступление? Вы готовы нести ответственность?',
                'Скрывая убийцу, вы берете кровь на свои руки. Как вы спите по ночам?',
                'Взгляните мне в глаза и скажите, что вам не стыдно выгораживать преступника.',
                'Ради чего вы губите себя? Соучастие в сокрытии стоит уголовного срока?'
            ]
        },
        silence_pressure: {
            label:'Давление молчанием', icon:'🤐', category:'pressure',
            emotional:0.16, logical:0.04, evidence:0.00, fatigue:0.05, social:0.18,
            contradictionChance:0.10, rapportRisk:0.05,
            phases:['pressure','break'],
            templates: [
                '[Пауза. Молчание. Ожидание ответа без нового вопроса]',
                '[Продолжительный пристальный взгляд в ожидании вашей капитуляции]',
                '[Тишина. Следователь убирает ручку и просто сверлит вас взглядом]',
                '[Не прерывая молчание, следователь показательно ждет от вас большего]'
            ]
        },
        credibility_attack: {
            label:'Атака на доверие', icon:'❌', category:'pressure',
            emotional:0.18, logical:0.10, evidence:0.12, fatigue:0.04, social:0.20,
            contradictionChance:0.30, rapportRisk:0.25,
            phases:['pressure','break'],
            templates: [
                'Вы многократно меняли показания. Почему суд должен вам хоть в чем-то верить?',
                'Вы лгали с первого слова. Как можно доверять вашей версии сейчас?',
                'С каждым ответом вы закапываете себя. Ваше слово больше ничего не стоит.',
                'Любой присяжный рассмеется, услышав вашу историю. Остались ли у вас крохи совести?'
            ]
        },

        // ── РАЗЛОМ ВЕРСИИ ─────────────────────────────────────────────────────

        lock_statement: {
            label:'Фиксация версии', icon:'🔒', category:'breakdown',
            emotional:0.06, logical:0.12, evidence:0.06, fatigue:0.02, social:0.06,
            contradictionChance:0.08, rapportRisk:0.04,
            phases:['containment','closure'],
            templates: [
                'Правильно ли я понимаю: ваша позиция такова — {claim}? Вы это подтверждаете?',
                'Заносим в протокол: {claim}. Верно? Вы подпишетесь под этими словами?',
                'Последнее уточнение. Ваш окончательный ответ звучит так: {claim}. Без колебаний?',
                'Я фиксирую это в деле. {claim} - это ваше официальное заявление следователю.'
            ]
        },
        force_precision: {
            label:'Принуждение к точности', icon:'📌', category:'breakdown',
            emotional:0.12, logical:0.20, evidence:0.08, fatigue:0.05, social:0.08,
            contradictionChance:0.28, rapportRisk:0.10,
            phases:['containment','pressure'],
            templates: [
                'Не "около", не "примерно". Дайте точный ответ: время, место, последовательность.',
                'Хватит юлить и использовать слова вроде "наверное". Дайте чёткий и однозначный ответ.',
                'Откинем все "может быть". Если вы там были, назовите точные факты.',
                'Отвечайте прямо, без виляний! Только точная, сухая выжимка фактов.'
            ]
        },
        commitment_question: {
            label:'Вопрос-обязательство', icon:'✍️', category:'breakdown',
            emotional:0.10, logical:0.14, evidence:0.06, fatigue:0.03, social:0.12,
            contradictionChance:0.20, rapportRisk:0.08,
            phases:['containment','pressure','closure'],
            templates: [
                'Вы настаиваете на этой версии? Понимаете, что это теперь зафиксировано официально?',
                'Если вы сейчас подпишете эти слова и они окажутся ложью — вас ждёт суд. Настаиваете?',
                'Готовы присягнуть в суде под страхом тюремного заключения, что всё было именно так?',
                'Пути назад не будет. Осознаете ли вы серьёзность этих заявлений?'
            ]
        },
        impossibility_exposure: {
            label:'Явная невозможность', icon:'💥', category:'breakdown',
            emotional:0.20, logical:0.28, evidence:0.24, fatigue:0.05, social:0.14,
            contradictionChance:0.60, rapportRisk:0.18,
            phases:['pressure','break'],
            templates: [
                'То, что вы описываете, физически невозможно: {reason}. Как вы это объясняете?',
                'Законы физики и логики против вас. Это невозможно, ведь {reason}. Что скажете?',
                'Ваша сказка не выдерживает проверки реальностью! То, как вы всё описали, исключено из-за {reason}.',
                'Это просто абсурд. Такого быть не могло по причине: {reason}. Мы вас поймали.'
            ]
        },
        confession_window: {
            label:'Окно для признания', icon:'🚪', category:'breakdown',
            emotional:0.18, logical:0.08, evidence:0.08, fatigue:0.02, social:0.20,
            contradictionChance:0.15, rapportRisk:-0.05,
            phases:['break','closure'],
            templates: [
                'Этот момент — последняя возможность рассказать, как было на самом деле. Что вы хотите сказать?',
                'Я знаю, что вам тяжело. Облегчите душу прямо сейчас, дальше будет больно.',
                'Давайте закончим это. Я готов выслушать чистосердечное признание без давления.',
                'Суд зачтёт вашу искренность. Признайтесь, чтобы мы все пошли сегодня домой.'
            ]
        }
    };

    /**
     * Возвращает рекомендованные типы вопросов для данной фазы и тактики.
     * @param {string} phase
     * @param {Object} tactic — из InterrogationTactics.TACTICS
     * @returns {string[]} список ключей вопросов
     */
    static recommend(phase, tactic) {
        const preferred = tactic?.preferredQuestions ?? [];
        const phaseOk = Object.entries(QuestionEngine.QUESTION_TYPES)
            .filter(([, qt]) => qt.phases.includes(phase))
            .map(([k]) => k);

        // Пересечение: предпочтительные тактикой И допустимые для фазы
        const intersection = preferred.filter(k => phaseOk.includes(k));
        return intersection.length > 0 ? intersection : phaseOk.slice(0, 4);
    }

    /**
     * Генерирует текст вопроса, выбирая случайный шаблон и заменяя {placeholder} значениями context.
     * @param {string} questionType
     * @param {Object} context — { detail, action, fact, time1, time2, evidence_label, prev, now, claim, other_claim, reason }
     * @returns {string}
     */
    static buildText(questionType, context = {}) {
        const qt = QuestionEngine.QUESTION_TYPES[questionType];
        if (!qt) return 'Что вы можете добавить к своим показаниям?';

        let templates = qt.templates || [qt.template] || ['Что вы можете добавить к своим показаниям?'];
        let text = templates[Math.floor(Math.random() * templates.length)];
        if (!text) text = 'Что вы можете добавить к своим показаниям?';
        
        // Значения по умолчанию для того, чтобы игроку не выводились технические {теги}
        const defaultPlaceholders = {
            detail: 'эту деталь',
            action: 'это действие',
            time1: 'указанное время',
            time2: 'другое время',
            time: 'это время',
            fact: 'этот факт',
            prev: 'одно',
            now: 'совершенно другое',
            evidence_label: 'эти материалы дела',
            other_claim: 'всё было иначе',
            claim: 'то, что вы описали',
            reason: 'по ряду объективных причин'
        };

        // Находим все {текст} и заменяем из context или из дефолтных
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            if (context[key] !== undefined && context[key] !== null) {
                return context[key];
            }
            return defaultPlaceholders[key] || 'это';
        });
    }
}
