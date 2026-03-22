/**
 * CredibilitySystem — расширенная система достоверности и психотипического анализа свидетеля.
 *
 * Модели:
 *  - Психотип свидетеля (нейротизм, экстраверсия, покорность)
 *  - Динамическая история доверия (timeline)
 *  - 8 типов показаний с весовыми коэфф.
 *  - 10 типов противоречий со штрафами
 *  - 7 бонусов
 *  - Контекстуальные факторы: стресс, СМИ, угрозы, аффилированность
 *  - Детектор противоречий по тексту (лексика + семантика)
 *  - Профиль доверия: числовой + текстовый + HTML-бейдж
 */
export class CredibilitySystem {

    // ─── Типы показаний ──────────────────────────────────────────────────────
    static TESTIMONY_WEIGHTS = {
        eyewitness:      1.00,  // Очевидец — видел лично
        alibi:           0.85,  // Подтверждение алиби
        character:       0.65,  // Характеристика личности
        hearsay:         0.40,  // Слухи / с чужих слов
        expert:          0.95,  // Официальный эксперт
        anonymous:       0.20,  // Анонимная наводка
        corroborating:   0.70,  // Косвенное подтверждение
        recanted:        0.10,  // Отказался от показаний
    };

    // ─── Штрафы за противоречия ──────────────────────────────────────────────
    static CONTRADICTION_PENALTIES = {
        statement_flip:  0.35,  // Полная смена показаний
        perjury_hint:    0.40,  // Признаки лжесвидетельства
        identity:        0.25,  // Ошибка в описании личности
        timeline:        0.22,  // Несовпадение хронологии
        location:        0.20,  // Несовпадение места
        physical:        0.15,  // Физические несоответствия
        motive_bias:     0.18,  // Заинтересованное лицо
        omission:        0.12,  // Умолчание важного факта
        minor_slip:      0.05,  // Незначительная оговорка
        under_pressure:  0.08,  // Изменил под давлением
    };

    // ─── Бонусы ──────────────────────────────────────────────────────────────
    static BONUSES = {
        corroborated_by_evidence:  +0.22,  // Подтверждено уликой
        consistent_cross_exam:     +0.12,  // Выдержал перекрёстный допрос
        expert_confirmed:          +0.18,  // Совпадение с экспертом
        stayed_calm_under_stress:  +0.08,  // Не сломался под давлением
        voluntary_detail:          +0.06,  // Добавил детали самостоятельно
        corroborated_by_witness:   +0.10,  // Другой свидетель подтвердил
        no_prior_statement:        +0.04,  // Показания не менялись
    };

    // ─── Психотипы свидетеля ─────────────────────────────────────────────────
    static PSYCHOTYPES = {
        anxious:         { credMod: -0.08, stressMult: 1.40, desc: 'Тревожный тип: нестабилен под вопросами' },
        authoritative:   { credMod: +0.12, stressMult: 0.80, desc: 'Авторитарный тип: уверен, убедителен' },
        submissive:      { credMod: -0.05, stressMult: 1.20, desc: 'Покорный тип: легко поддаётся влиянию' },
        manipulative:    { credMod: -0.15, stressMult: 0.70, desc: 'Манипулятивный тип: показания стратегические' },
        honest_nervous:  { credMod: +0.03, stressMult: 1.30, desc: 'Честный, но нервный: правду говорит, но выглядит ненадёжно' },
        stoic:           { credMod: +0.08, stressMult: 0.60, desc: 'Хладнокровный тип: контролирует эмоции' },
        impulsive:       { credMod: -0.10, stressMult: 1.50, desc: 'Импульсивный: может противоречить себе' },
        neutral:         { credMod:  0.00, stressMult: 1.00, desc: 'Нейтральный тип' },
    };

    // ─── Внешние события ─────────────────────────────────────────────────────
    static EXTERNAL_EVENTS = {
        none:             0,
        media_pressure:  -0.08,
        corrupt_offer:   -0.15,
        threat:          -0.22,
        witness_support:  +0.10,
        police_escort:    +0.06,
        public_pressure:  -0.10,
        family_pressure: -0.12,
    };

    /**
     * Главный метод: полный расчёт достоверности с учётом всех факторов.
     * @param {Witness} witness
     * @param {Object} options
     * @param {string} [options.testimonyType='eyewitness']
     * @param {number} [options.stressLevel]   0–1, переопределяет traits.stress
     * @param {string} [options.externalEvent] Ключ из EXTERNAL_EVENTS
     * @param {string} [options.psychotype]    Ключ из PSYCHOTYPES
     * @returns {CredibilityProfile}
     */
    static evaluate(witness, options = {}) {
        const { traits = {} } = witness;
        const tex = options.testimonyType || 'eyewitness';
        const stress = options.stressLevel ?? traits.stress ?? 0.3;
        const event  = options.externalEvent || 'none';
        const psychotype = options.psychotype || CredibilitySystem._detectPsychotype(traits);

        // 1. Базовая достоверность из черт характера
        let score = CredibilitySystem.calculateInitialCredibility(witness, tex);

        // 2. Психотип
        const pst = CredibilitySystem.PSYCHOTYPES[psychotype] || CredibilitySystem.PSYCHOTYPES.neutral;
        score += pst.credMod;

        // 3. Стресс (с мультипликатором психотипа)
        score = CredibilitySystem.applyStress(score, stress * pst.stressMult);

        // 4. Внешние события
        score = CredibilitySystem.applyExternalEvent(score, event);

        // 5. Аффилированность (заинтересованное лицо)
        if (traits.loyalty > 0.7) {
            score = CredibilitySystem.penalize(score, 'motive_bias');
        }

        // 6. Предыдущая история — если свидетель менял показания
        if (traits.hasRetracted) {
            score = CredibilitySystem.penalize(score, 'statement_flip');
        }

        score = Math.min(Math.max(+score.toFixed(2), 0.01), 0.99);

        return {
            score,
            label:      CredibilitySystem._label(score),
            badge:      CredibilitySystem._badge(score),
            psychotype,
            psychotypeDesc: pst.desc,
            testimonyType: tex,
            stressImpact: +(stress * pst.stressMult * 0.15).toFixed(2),
            externalEvent: event,
            breakdown: {
                base:    +(traits.honesty * 0.5 + 0.20).toFixed(2),
                psychotypeMod: pst.credMod,
                stressMod: -(stress * pst.stressMult * 0.15).toFixed(2),
                eventMod: CredibilitySystem.EXTERNAL_EVENTS[event] || 0,
                final: score,
            }
        };
    }

    /**
     * Начальный базовый расчёт по чертам и типу показания.
     */
    static calculateInitialCredibility(witness, testimonyType = 'eyewitness') {
        const { traits = {} } = witness;
        let base = (traits.honesty ?? 0.5) * 0.50;
        base += (1 - (traits.stress  ?? 0.3)) * 0.10;
        base += (traits.loyalty ?? 0.5)        * 0.08;
        base += (1 - (traits.fear   ?? 0.3))   * 0.07;

        const typeWeight = CredibilitySystem.TESTIMONY_WEIGHTS[testimonyType] ?? 0.60;
        base *= typeWeight;

        return Math.min(Math.max(base + 0.20, 0.05), 0.95);
    }

    /** Штраф за противоречие. */
    static penalize(current, type = 'minor_slip') {
        const penalty = CredibilitySystem.CONTRADICTION_PENALTIES[type] ?? 0.10;
        return Math.max(+(current - penalty).toFixed(2), 0);
    }

    /** Бонус. */
    static reward(current, type = 'consistent_cross_exam') {
        const bonus = CredibilitySystem.BONUSES[type] ?? 0.05;
        return Math.min(+(current + bonus).toFixed(2), 1.0);
    }

    /** Влияние стресса. */
    static applyStress(credibility, stress) {
        const impact = Math.min(stress, 1.0) * 0.15;
        return Math.max(+(credibility - impact).toFixed(2), 0);
    }

    /** Влияние внешнего события. */
    static applyExternalEvent(credibility, event) {
        const delta = CredibilitySystem.EXTERNAL_EVENTS[event] ?? 0;
        return Math.min(Math.max(+(credibility + delta).toFixed(2), 0), 1);
    }

    /**
     * getCredibilityInfo — быстрый UI-объект для числа доверия.
     */
    static getCredibilityInfo(credibility) {
        const info = CredibilitySystem._label(credibility);
        return { level: credibility, ...info };
    }

    /**
     * Детектирует тип противоречия между двумя текстами показаний.
     * Многоуровневая проверка: время → место → личность → позиция → умолчание.
     * @returns {string|null} Тип противоречия или null
     */
    static detectContradictionType(text1, text2) {
        if (!text1 || !text2) return null;
        const a = text1.toLowerCase();
        const b = text2.toLowerCase();

        if (CredibilitySystem._timeDiffers(a, b))      return 'timeline';
        if (CredibilitySystem._locationDiffers(a, b))  return 'location';
        if (CredibilitySystem._identityDiffers(a, b))  return 'identity';
        if (CredibilitySystem._physicalDiffers(a, b))  return 'physical';
        if (CredibilitySystem._positionFlipped(a, b))  return 'statement_flip';
        if (CredibilitySystem._keyFactMissing(a, b))   return 'omission';
        return null;
    }

    /**
     * Анализирует один свидетельский текст на признаки лжи.
     * Возвращает массив «красных флагов».
     */
    static analyzeTestimony(text) {
        const flags = [];
        if (!text) return flags;
        const t = text.toLowerCase();

        const hedges = ['кажется','по-моему','наверное','примерно','не уверен','возможно','не помню точно','как-то','что ли'];
        const hedgeCount = hedges.filter(h => t.includes(h)).length;
        if (hedgeCount >= 2)
            flags.push({ type: 'uncertainty', label: 'Высокая неопределённость', detail: `Обнаружено ${hedgeCount} модальных оговорок` });

        if ((t.match(/я\s+не/g) || []).length >= 3)
            flags.push({ type: 'excessive_negation', label: 'Избыточное отрицание', detail: 'Многократное «я не» — защитная реакция' });

        const tmFwd = ['сначала','потом','затем','до того'];
        const tmBwd = ['потому что','так как','ещё до'];
        if (tmFwd.some(w => t.includes(w)) && tmBwd.some(w => t.includes(w)))
            flags.push({ type: 'timeline_conflict', label: 'Внутренняя хронологическая непоследовательность', detail: 'Фразы нарушают причинно-следственную цепь' });

        const overconfident = ['точно знаю','совершенно уверен','100 процентов','клянусь'];
        if (overconfident.some(w => t.includes(w)) && text.length < 120)
            flags.push({ type: 'overconfidence', label: 'Чрезмерная уверенность', detail: 'Очень краткое показание с категоричными утверждениями — нехарактерно для правдивого свидетеля' });

        return flags;
    }

    /**
     * Строит HTML-виджет доверия для WitnessView.
     */
    static renderBadge(credibilityProfile) {
        const { score, label, badge, psychotypeDesc, breakdown } = credibilityProfile;
        const pct = Math.round(score * 100);
        const barColor = label.color;
        return `
        <div style="border:1px solid #e0e0e0;border-radius:8px;padding:10px;margin-top:8px;font-size:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span style="font-weight:600;color:#333">Уровень доверия суда</span>
                <span style="background:${barColor};color:#fff;padding:2px 10px;border-radius:20px;font-weight:700">${label.text}</span>
            </div>
            <div style="background:#f0f0f0;border-radius:4px;height:8px;margin-bottom:8px">
                <div style="background:${barColor};width:${pct}%;height:8px;border-radius:4px;transition:width .4s"></div>
            </div>
            <div style="color:#777;font-size:11px">${pct}% · ${psychotypeDesc}</div>
            ${badge ? `<div style="margin-top:6px;color:#c0392b;font-size:11px">⚠️ ${badge}</div>` : ''}
        </div>`;
    }

    // ─── Внутренние методы ────────────────────────────────────────────────────

    static _detectPsychotype(traits) {
        if (!traits) return 'neutral';
        if ((traits.stress || 0) > 0.7)     return 'anxious';
        if ((traits.honesty || 0) < 0.3)    return 'manipulative';
        if ((traits.loyalty || 0) > 0.8)    return 'submissive';
        if ((traits.fear || 0) > 0.6)       return 'honest_nervous';
        if ((traits.courage || 0) > 0.7)    return 'authoritative';
        if ((traits.calm || 0) > 0.7)       return 'stoic';
        if ((traits.impulsivity || 0) > 0.6) return 'impulsive';
        return 'neutral';
    }

    static _label(score) {
        if (score >= 0.82) return { text: 'Высокое доверие',     color: '#27ae60' };
        if (score >= 0.62) return { text: 'Умеренное доверие',   color: '#f39c12' };
        if (score >= 0.40) return { text: 'Пониженное доверие',  color: '#e67e22' };
        if (score >= 0.20) return { text: 'Низкое доверие',      color: '#e74c3c' };
        return                    { text: 'Критически низкое',   color: '#c0392b' };
    }

    static _badge(score) {
        if (score < 0.20) return 'Суд рекомендует с осторожностью принимать показания данного свидетеля';
        if (score < 0.40) return 'Необходимо перекрёстное подтверждение показаний';
        return null;
    }

    static _timeDiffers(a, b) {
        const re = /\b(\d{1,2}:\d{2}|\d{1,2}\s*(час|утра|вечера|ночи|дня))\b/g;
        const ta = [...a.matchAll(re)].map(m => m[0].trim());
        const tb = [...b.matchAll(re)].map(m => m[0].trim());
        if (!ta.length || !tb.length) return false;
        return ta[0] !== tb[0];
    }

    static _locationDiffers(a, b) {
        const locs = ['парк','переулок','улица','ул.','дом','стоянка','кафе','ресторан','метро','двор','подъезд','магазин','офис','склад','гараж','перекрёсток','больница'];
        const la = locs.filter(l => a.includes(l));
        const lb = locs.filter(l => b.includes(l));
        if (!la.length || !lb.length) return false;
        return la[0] !== lb[0];
    }

    static _identityDiffers(a, b) {
        const markers = ['чёрн','белый','рыж','блонд','лысый','высок','низк','худ','полн','бород','мужчина','женщина','парень','девушка'];
        const ma = markers.filter(m => a.includes(m));
        const mb = markers.filter(m => b.includes(m));
        if (!ma.length || !mb.length) return false;
        return ma.some(x => !mb.includes(x));
    }

    static _physicalDiffers(a, b) {
        const colors = ['синий','красный','чёрный','белый','серый','зелёный','жёлтый'];
        const ca = colors.filter(c => a.includes(c));
        const cb = colors.filter(c => b.includes(c));
        if (!ca.length || !cb.length) return false;
        return ca.some(x => !cb.includes(x));
    }

    static _positionFlipped(a, b) {
        // Один говорит «видел» другой «не видел» / «да» vs «нет»
        const negA = (a.match(/\bне\b/g) || []).length;
        const negB = (b.match(/\bне\b/g) || []).length;
        return Math.abs(negA - negB) >= 3;
    }

    static _keyFactMissing(a, b) {
        // Если одно показание значительно длиннее и содержит ключевые слова, которых нет в другом
        const keywords = ['видел','слышал','был','находился','ударил','взял','убежал','сказал'];
        const ka = keywords.filter(k => a.includes(k));
        const kb = keywords.filter(k => b.includes(k));
        const missing = ka.filter(k => !kb.includes(k));
        return missing.length >= 2;
    }
}
