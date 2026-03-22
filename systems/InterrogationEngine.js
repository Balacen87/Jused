// ─── InterrogationEngine.js ──────────────────────────────────────────────────
// Движок допроса: генерирует вопросы и ответы для каждого свидетеля.
// Вопросы привязаны к observedNodeId свидетеля (EventGraph).
// Ответы зависят от personality, emotionalState и decideTruth().

export class InterrogationEngine {

    // ── Банк вопросов по типу узла ──────────────────────────────────────────

    static QUESTIONS = {
        prosecution: { // Вопросы обвинения — пытаются доказать вину
            preparation: [
                { id: 'p_prep_1', text: 'Видели ли вы подсудимого поблизости до совершения преступления?',    importance: 'key' },
                { id: 'p_prep_2', text: 'Можете ли вы описать поведение подозреваемого — выглядело ли оно целенаправленным?', importance: 'key' },
                { id: 'p_prep_3', text: 'Как давно вы заметили подозреваемого в этом районе?',               importance: 'neutral' },
            ],
            presence: [
                { id: 'p_pres_1', text: 'Вы утверждаете, что видели подозреваемого на месте. Вы уверены в личности?', importance: 'key' },
                { id: 'p_pres_2', text: 'Во сколько именно вы его там заметили?',                            importance: 'key' },
                { id: 'p_pres_3', text: 'Было ли что-то необычное в его поведении?',                        importance: 'neutral' },
            ],
            crime_action: [
                { id: 'p_act_1',  text: 'Вы наблюдали сам момент преступления. Опишите, что именно произошло.', importance: 'key' },
                { id: 'p_act_2',  text: 'Сколько времени это продолжалось?',                                 importance: 'neutral' },
                { id: 'p_act_3',  text: 'Это точно был подсудимый — вы видели его лицо?',                   importance: 'key' },
            ],
            escape: [
                { id: 'p_esc_1',  text: 'В каком направлении скрылся человек после инцидента?',             importance: 'key' },
                { id: 'p_esc_2',  text: 'Насколько быстро он покинул место? Это выглядело как бегство?',     importance: 'neutral' },
            ],
            alibi_event: [
                { id: 'p_ali_1',  text: 'Вы говорите, что видели подсудимого в другом месте. Почему вы в этом уверены?', importance: 'key' },
                { id: 'p_ali_2',  text: 'Кто ещё мог вас видеть вместе с ним в то время?',                  importance: 'key' },
            ],
            discovery: [
                { id: 'p_dis_1',  text: 'Где именно и при каких обстоятельствах вы обнаружили последствия?', importance: 'neutral' },
                { id: 'p_dis_2',  text: 'Что происходило вокруг в момент вашего обнаружения?',               importance: 'neutral' },
            ],
            _default: [
                { id: 'p_def_1',  text: 'Расскажите, что вы видели в тот день.',                             importance: 'neutral' },
                { id: 'p_def_2',  text: 'Не замечали ли вы подозреваемого в этом районе раньше?',            importance: 'neutral' },
            ],
        },
        defense: { // Вопросы защиты — ставят под сомнение обвинение
            preparation: [
                { id: 'd_prep_1', text: 'Возможно, это был другой человек? Освещение было хорошим?',          importance: 'key' },
                { id: 'd_prep_2', text: 'Вы ранее видели моего подзащитного? Как вы его узнали?',            importance: 'key' },
                { id: 'd_prep_3', text: 'Вы не отвлекались на что-то другое в тот момент?',                  importance: 'neutral' },
            ],
            presence: [
                { id: 'd_pres_1', text: 'Вы абсолютно уверены, что это именно мой подзащитный, а не схожий человек?', importance: 'key' },
                { id: 'd_pres_2', text: 'Насколько хорошо вы знаете подсудимого в лицо?',                   importance: 'key' },
                { id: 'd_pres_3', text: 'Вы были в стрессе или под давлением в тот момент?',                 importance: 'neutral' },
            ],
            crime_action: [
                { id: 'd_act_1',  text: 'Вы могли ошибиться — происходящее могло быть случайным?',            importance: 'key' },
                { id: 'd_act_2',  text: 'Откуда вы наблюдали? Ваш угол зрения мог исказить картину?',        importance: 'neutral' },
                { id: 'd_act_3',  text: 'Вы рассказывали об этом кому-то до показаний в суде?',              importance: 'neutral' },
            ],
            escape: [
                { id: 'd_esc_1',  text: 'Вы уверены, что видели именно подсудимого, а не постороннего человека?', importance: 'key' },
                { id: 'd_esc_2',  text: 'Этот человек — он вообще оглядывался или просто торопился?',         importance: 'neutral' },
            ],
            alibi_event: [
                { id: 'd_ali_1',  text: 'Вы подтверждаете — подсудимый был рядом с вами именно в это время?', importance: 'key' },
                { id: 'd_ali_2',  text: 'Есть ли что-то, что помогает вам точно вспомнить это время?',       importance: 'key' },
            ],
            discovery: [
                { id: 'd_dis_1',  text: 'Кто вам сказал немедленно звонить в полицию — это было ваше решение?', importance: 'neutral' },
                { id: 'd_dis_2',  text: 'Видели ли вы, кто ещё находился рядом в это время?',                importance: 'neutral' },
            ],
            _default: [
                { id: 'd_def_1',  text: 'Вы утверждаете это с уверенностью или только предполагаете?',       importance: 'key' },
                { id: 'd_def_2',  text: 'Вас просили рассказать именно так или это ваши слова?',             importance: 'neutral' },
            ],
        }
    };

    // ── Шаблоны ответов по типу свидетеля ───────────────────────────────────

    static ANSWER_MODIFIERS = {
        truthful_confident:  (q) => `Да, я уверен(а). ${q.baseAnswer}`,
        truthful_nervous:    (q) => `Ну... да, я помню это... хотя и волновался(ась). ${q.baseAnswer}`,
        lying_calm:          (q) => `Всё было именно так, как я сказал(а). ${q.baseAnswer}`,
        lying_stressed:      (q) => `Я... я говорю правду. Это было так. ${q.baseAnswer}`,
        confused:            (q) => `Честно говоря, многое уже размылось в памяти. Кажется... ${q.baseAnswer}`,
        deflecting:          (q) => `Зачем вы на меня давите? Я сказал(а) что видел(а). ${q.baseAnswer}`,
    };

    /**
     * Возвращает список вопросов для данного свидетеля и стороны.
     * @param {Witness} witness
     * @param {'prosecution'|'defense'} side
     * @returns {Question[]}
     */
    static getQuestions(witness, side) {
        const nodeType = this._getWitnessNodeType(witness);
        const pool = this.QUESTIONS[side];
        const questions = pool[nodeType] || pool['_default'];

        return questions.map(q => ({ ...q, answered: false, answer: null, witnessReaction: null }));
    }

    /**
     * Генерирует ответ свидетеля на вопрос.
     * @param {Witness} witness
     * @param {Question} question
     * @param {boolean} _isGuiltyCase — известна только движку, влияет на базовый ответ
     * @returns {AnswerResult}
     */
    static answerQuestion(witness, question, isGuiltyCase) {
        const isTruth = witness.decideTruth();
        const acc = witness.memory?.accuracy ?? 0.6;
        const stress = witness.emotionalState?.stress ?? 0.2;
        const courage = witness.personality?.courage ?? 0.5;
        const honesty = witness.personality?.honesty ?? 0.5;

        // Базовый ответ из узла
        const nodeType = this._getWitnessNodeType(witness);
        const baseAnswer = this._getBaseAnswer(question, nodeType, isGuiltyCase, isTruth);

        // Стиль подачи ответа
        let modifierKey;
        if (isTruth && courage > 0.6)         modifierKey = 'truthful_confident';
        else if (isTruth && stress > 0.5)     modifierKey = 'truthful_nervous';
        else if (!isTruth && honesty < 0.4)   modifierKey = 'lying_calm';
        else if (!isTruth && stress > 0.6)    modifierKey = 'lying_stressed';
        else if (acc < 0.45)                  modifierKey = 'confused';
        else                                  modifierKey = 'deflecting';

        const modifier = this.ANSWER_MODIFIERS[modifierKey];
        const fullAnswer = modifier({ baseAnswer });

        // Важность ответа и флаги
        const isKeyFact      = question.importance === 'key' && isTruth;
        const isMisleading   = question.importance === 'key' && !isTruth;
        const hasContradiction = this._checkContradiction(witness, question, isTruth);

        // Применяем давление от допроса
        witness.applyPressure(0.05, 1.0);

        return {
            questionId:     question.id,
            questionText:   question.text,
            answerText:     fullAnswer,
            isTruth,
            isKeyFact,       // Ключевой факт → попадает в FactJournal
            isMisleading,    // Ложный след → особое выделение
            hasContradiction,
            importance:     question.importance,
            witnessState: {
                stress:  Math.round(witness.emotionalState.stress * 100),
                courage: Math.round(witness.personality.courage * 100),
            }
        };
    }

    // ── Вспомогательные ──────────────────────────────────────────────────────

    static _getWitnessNodeType(witness) {
        // Читаем тип узла напрямую из поля (устанавливается CaseGenerator)
        if (witness.observedNodeType) return witness.observedNodeType;

        // Фоллбэк по роли — если observedNodeType не задан
        const roleMap = {
            'Очевидец':                     'presence',
            'Эксперт':                        'crime_action',
            'Сотрудник':                    'discovery',
            'Знакомый обвиняемого':   'alibi_event',
            'Родственник':                  'alibi_event',
            'Сосед':                         'preparation',
        };
        return roleMap[witness.role] ?? '_default';
    }

    static _getBaseAnswer(question, nodeType, isGuiltyCase, isTruth) {
        // Определяем сторону по первому символу id вопроса (p_ = prosecution, d_ = defense)
        const side = question.id.startsWith('p_') ? 'prosecution' : 'defense';

        const answers = {
            prosecution: {
                preparation:
                    isGuiltyCase
                        ? (isTruth ? 'Да, там был кто-то. Оглядывался, вел себя настороженно.' : 'Не знаю, не очень запомнил(a).')
                        : 'Нет, специфически этого человека я не заметил(a).',
                presence:
                    isGuiltyCase
                        ? (isTruth ? 'Я точно видел(а) его там в указанное время.' : 'Возможно, там кто-то был, но я не уверен(a).')
                        : 'Там был совершенно другой человек. Я уверен(a) в этом.',
                crime_action:
                    isGuiltyCase
                        ? (isTruth ? 'Происходящее явно не было случайным.' : 'Всё произошло само собой, никто никого не трогал.')
                        : 'Это мог быть совершенно другой человек, не подсудимый.',
                escape:
                    isGuiltyCase
                        ? 'Уходил очень быстро, не ольдываясь. Это выглядело как бегство.'
                        : 'Кто-то очень быстро отшёл от места. Был ли это подсудимый — не знаю.',
                alibi_event:
                    isGuiltyCase
                        ? 'Он говорит, что был у меня, но я этого не помню точно.'
                        : 'Мы были вместе, я абсолютно уверен(a).',
                discovery:       'Я обнаружил(a) последствия и сразу вызвал(a) полицию.',
                _default:  isTruth ? 'Да, именно так и было.' : 'Я рассказал(а) всё, что видел(а).'
            },
            defense: {
                preparation:
                    !isGuiltyCase
                        ? 'Нет, я не видел(а) здесь моего подзащитного в то время.'
                        : 'Честно говоря — кто-то там был. Но это был ли он — не готов утверждать.',
                presence:
                    !isGuiltyCase
                        ? 'Нет, я уверен(a) — это был другой человек. Подсудимого там не было.'
                        : 'Я не уверен(a) на 100%. Было темно, я мог(a) ошибаться.',
                crime_action:
                    !isGuiltyCase
                        ? 'Это мог быть несчастный случай. Мой подзащитный там не причём.'
                        : 'Я видел(а) что-то, но не уверен(a) это был он.',
                escape:
                    !isGuiltyCase
                        ? 'Кто-то ушёл, но это точно не мой подзащитный. Ходьба совершенно другая.'
                        : 'Человек ушёл — но это мог быть любой человек.',
                alibi_event:
                    !isGuiltyCase
                        ? 'Да, он был рядом со мной. Я ручаюсь за это.'
                        : 'Он говорил что придёт, но... я не уверен(a) точно.',
                discovery:       'Я видел(a) несколько человек. Незнакомых.',
                _default:  isTruth ? 'Насколько я помню — так и было.' : 'Я рассказал(а) вам всё.'
            }
        };

        const sideAnswers = answers[side];
        return (sideAnswers[nodeType] ?? sideAnswers['_default']) ?? 'Не могу вспомнить.';
    }

    static _checkContradiction(witness, question, isTruth) {
        // Если свидетель давал показания раньше и теперь меняет позицию
        const prevTestimony = witness.testimonies?.[0];
        if (!prevTestimony) return false;
        const prevWasTruth = prevTestimony.type === 'true';
        return prevWasTruth !== isTruth; // Противоречие с предыдущими показаниями
    }
}


// ── FactJournal — глобальный журнал ключевых фактов ─────────────────────────

export class FactJournal {
    constructor() {
        this.entries = [];
    }

    /**
     * Добавляет ключевой факт из допроса.
     * @param {Witness} witness
     * @param {AnswerResult} answer
     * @param {'prosecution'|'defense'} side
     */
    addFact(witness, answer, side) {
        if (!answer.isKeyFact && !answer.isMisleading && !answer.hasContradiction) return;

        this.entries.push({
            id:             `fact_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
            witnessName:    witness.name,
            witnessRole:    witness.role,
            side,
            questionText:   answer.questionText,
            answerText:     answer.answerText,
            isKeyFact:      answer.isKeyFact,
            isMisleading:   answer.isMisleading,
            hasContradiction: answer.hasContradiction,
            importance:     answer.importance,
            timestamp:      new Date().toLocaleTimeString('ru'),
        });
    }

    /** Возвращает факты, отсортированные по важности */
    getSorted() {
        const w = { key: 3, neutral: 1, misleading: 2 };
        return [...this.entries].sort((a, b) =>
            (w[b.isKeyFact ? 'key' : b.isMisleading ? 'misleading' : 'neutral'] || 0) -
            (w[a.isKeyFact ? 'key' : a.isMisleading ? 'misleading' : 'neutral'] || 0)
        );
    }

    clear() { this.entries = []; }
}
