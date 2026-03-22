/**
 * ExpertModel.js — полная модель судебного эксперта.
 *
 * Улучшения v2:
 *  1. Правильная генерация ФИО (отдельный массив отчеств)
 *  2. getSkillModifier — реалистичная математика (skill-0.5)*0.4
 *  3. bias активно влияет на вывод эксперта
 *  4. fatigue накапливается / восстанавливается
 *  5. caseHistory даёт бонус к точности через практику
 *  6. Взвешенная случайная выборка ошибок (не первая-всегда)
 *  7. Архетипы экспертов (8 типов)
 *  8. Burnout при fatigue > 0.80
 *  9. Репутация влияет на модель подкупа
 *  10. Улучшенный generatePanel (varied tier)
 *  11. Ограничение reputationEvents до 50
 *  12. fee / publicProfile
 *  13. Конфликт интересов
 *  14. Специализация: 1–2 дисциплины, не все от лаборатории
 */

import { LAB_CATALOG, EXPERT_ERROR_TYPES } from '../data/ExpertiseCatalog.js';

const R     = arr  => arr[Math.floor(Math.random() * arr.length)];
const Rn    = n    => arr => arr.slice().sort(() => Math.random() - 0.5).slice(0, n);
const rndN  = (min, max) => +(min + Math.random() * (max - min)).toFixed(3);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// ─── Пулы данных ─────────────────────────────────────────────────────────────
const EXPERT_FIRST  = ['Андрей','Виктор','Олег','Сергей','Дмитрий','Алексей','Наталья','Елена','Ирина','Михаил','Павел','Антон','Юрий','Константин'];
const EXPERT_LAST   = ['Громов','Сорокин','Белов','Крылов','Носов','Лазарев','Макаров','Фролов','Зайцев','Попов','Волков','Лебедев','Краснов','Горин','Чёрных'];
const EXPERT_MIDDLE = ['Андреевич','Викторович','Олегович','Сергеевич','Дмитриевич','Алексеевич','Михайлович','Павлович','Антонович','Юрьевич','Ивановна','Сергеевна','Александровна','Викторовна'];
const EXPERT_TITLES = ['д.м.н.', 'к.х.н.', 'к.т.н.', 'к.б.н.', 'к.ф.-м.н.', 'к.ю.н.', 'PhD'];

// ─── Архетипы экспертов ──────────────────────────────────────────────────────
export const EXPERT_ARCHETYPES = {
    methodical: {
        label:         'Методичный',
        desc:          'Скрупулёзен, редко ошибается, медленный',
        skillRange:    [0.82, 0.96],
        biasRange:     [0.00, 0.08],
        corruptRange:  [0.00, 0.05],
        fatigueRate:   0.015,
        errorMult:     0.70,
    },
    bureaucratic: {
        label:         'Бюрократический',
        desc:          'Следует протоколу, малоинициативен, средняя точность',
        skillRange:    [0.60, 0.80],
        biasRange:     [0.05, 0.15],
        corruptRange:  [0.02, 0.12],
        fatigueRate:   0.010,
        errorMult:     1.00,
    },
    corrupt: {
        label:         'Коррумпированный',
        desc:          'Готов изменить вывод за вознаграждение',
        skillRange:    [0.55, 0.78],
        biasRange:     [0.20, 0.45],
        corruptRange:  [0.30, 0.80],
        fatigueRate:   0.012,
        errorMult:     1.30,
    },
    careerist: {
        label:         'Карьерист',
        desc:          'Завышает certainty для продвижения; обвинительный уклон',
        skillRange:    [0.70, 0.88],
        biasRange:     [0.18, 0.35],
        corruptRange:  [0.05, 0.20],
        fatigueRate:   0.018,
        errorMult:     0.90,
    },
    genius: {
        label:         'Гений',
        desc:          'Высочайшая квалификация, занят, высокая стоимость',
        skillRange:    [0.93, 0.99],
        biasRange:     [0.00, 0.05],
        corruptRange:  [0.00, 0.03],
        fatigueRate:   0.025,
        errorMult:     0.40,
    },
    honest_nervous: {
        label:         'Честный, нервный',
        desc:          'Высокая честность, но теряется под давлением защиты',
        skillRange:    [0.65, 0.85],
        biasRange:     [0.00, 0.10],
        corruptRange:  [0.00, 0.04],
        fatigueRate:   0.020,
        errorMult:     0.85,
    },
    pragmatic: {
        label:         'Прагматик',
        desc:          'Стандартный специалист средней руки',
        skillRange:    [0.62, 0.82],
        biasRange:     [0.05, 0.18],
        corruptRange:  [0.03, 0.15],
        fatigueRate:   0.012,
        errorMult:     1.00,
    },
    academic: {
        label:         'Академический',
        desc:          'Учёный. Осторожный в выводах, высокая scientificAcceptance',
        skillRange:    [0.78, 0.97],
        biasRange:     [0.00, 0.08],
        corruptRange:  [0.00, 0.03],
        fatigueRate:   0.010,
        errorMult:     0.65,
    },
};

// ─── ExpertProfile ────────────────────────────────────────────────────────────
export class ExpertProfile {

    constructor(data = {}) {
        this.id = `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

        // ФИО
        const firstName   = data.firstName || R(EXPERT_FIRST);
        const lastName    = data.lastName  || R(EXPERT_LAST);
        const middleName  = data.middleName || R(EXPERT_MIDDLE);
        this.name         = `${lastName} ${firstName[0]}. ${middleName[0]}.`;
        this.fullName     = `${lastName} ${firstName} ${middleName}`;
        this.title        = data.title || R(EXPERT_TITLES);

        // Лаборатория
        this.labId        = data.labId   || null;
        this.labName      = data.labName || 'Неизвестная лаборатория';
        this.labType      = data.labType || 'state';

        // Архетип
        this.archetype    = data.archetype || 'pragmatic';
        const arch        = EXPERT_ARCHETYPES[this.archetype] || EXPERT_ARCHETYPES.pragmatic;

        // Основные параметры
        this.skill        = clamp(data.skill      ?? rndN(...arch.skillRange),   0.10, 0.99);
        this.bias         = clamp(data.bias       ?? rndN(...arch.biasRange),    0.00, 1.00);
        this.fatigue      = clamp(data.fatigue    ?? rndN(0.00, 0.30),           0.00, 1.00);
        this.corruption   = clamp(data.corruption ?? rndN(...arch.corruptRange), 0.00, 1.00);
        this.reputation   = clamp(data.reputation ?? rndN(0.50, 0.95),           0.05, 1.00);
        this.experience   = data.experience ?? Math.floor(rndN(2, 28));

        // Экономика
        this.fee          = Math.round((500 + this.skill * 2000 + this.reputation * 1000) / 100) * 100;
        this.publicProfile = this.reputation > 0.80 && Math.random() > 0.60;

        // Специализация: 1–2 дисциплины из лаборатории
        const allSpecs = data.labSpecialties || [];
        this.specialties  = allSpecs.length
            ? Rn(Math.min(2, allSpecs.length))(allSpecs)
            : (data.specialties || []);

        // История дел { testType: count }
        this.caseHistory  = data.caseHistory || {};

        // Флаги
        this.isBribed     = false;
        this.bribeAmount  = 0;
        this.burnout      = this.fatigue > 0.80;
        this.conflictOfInterest = data.conflictOfInterest || false;

        // Архетипные модификаторы
        this._fatigueRate  = arch.fatigueRate;
        this._errorMult    = arch.errorMult;

        // Репутация: последние 50 событий
        this.reputationEvents = (data.reputationEvents || []).slice(-50);
    }

    // ─── Модификатор навыка ──────────────────────────────────────────────────

    /**
     * Реалистичная математика: skill=0.5 → 0, skill=0.9 → +0.16, skill=0.3 → -0.08.
     * Дополнительно учитываются: специализация, опыт, усталость, caseHistory, burnout.
     * @param {string} testType
     * @returns {number}  −0.25 … +0.20
     */
    getSkillModifier(testType) {
        const isSpecialist  = this.specialties.includes(testType);
        const practiceCount = this.caseHistory[testType] || 0;

        // Базовый модификатор: симметричный вокруг 0 при skill=0.5
        const base       = (this.skill - 0.50) * 0.40;

        // Специализация: +0.06 если специалист
        const specBonus  = isSpecialist ? 0.06 : 0;

        // Практика: log-кривая, плато ~50 дел → +0.05
        const practiceBonus = Math.min(Math.log1p(practiceCount) / Math.log1p(50) * 0.05, 0.05);

        // Стаж: каждые 10 лет → +0.02, плато ~30 лет
        const expBonus   = Math.min(this.experience / 30, 1) * 0.02;

        // Усталость: штраф до -0.10 при полном fatigue
        const fatigueHit = this.fatigue * 0.10;

        // Burnout: дополнительный штраф -0.08
        const burnoutHit = this.burnout ? 0.08 : 0;

        // Репутационный бонус (высокая репутация → небольшой доп. модификатор)
        const repBonus   = (this.reputation - 0.50) * 0.04;

        return +clamp(base + specBonus + practiceBonus + expBonus + repBonus - fatigueHit - burnoutHit, -0.30, 0.22).toFixed(3);
    }

    /**
     * Смещение вывода из-за bias эксперта.
     * bias > 0.20 → увеличивает вероятность обвинительного вывода
     * @param {boolean} tentativeMatch  Предварительный результат
     * @returns {boolean}               Скорректированный результат
     */
    applyBias(tentativeMatch, isGuilty) {
        if (this.bias < 0.05) return tentativeMatch;                  // нет смещения
        const biasFlipChance = this.bias * 0.20;                      // max 20% при bias=1.0
        if (!tentativeMatch && isGuilty && Math.random() < biasFlipChance) {
            return true;  // «дотянул» до обвинительного — когнитивный уклон
        }
        if (tentativeMatch && !isGuilty && Math.random() < biasFlipChance * 0.5) {
            return true;  // подтвердил ложно — обвинительный уклон
        }
        return tentativeMatch;
    }

    // ─── Усталость ───────────────────────────────────────────────────────────

    /**
     * Накапливает усталость после проведения экспертизы.
     * @param {number} workloadHours  Затраченное время (часы)
     */
    increaseFatigue(workloadHours = 4) {
        this.fatigue = clamp(+(this.fatigue + workloadHours * this._fatigueRate).toFixed(3), 0, 1);
        this.burnout = this.fatigue > 0.80;
    }

    /** Восстановление после отдыха */
    rest() {
        this.fatigue = clamp(+(this.fatigue - 0.20).toFixed(3), 0, 1);
        this.burnout = this.fatigue > 0.80;
    }

    // ─── Подкуп ──────────────────────────────────────────────────────────────

    /**
     * Попытка подкупа. Вероятность зависит от corruption, суммы, репутации, стажа.
     */
    attemptBribe(amountThousands) {
        const bribeStrength = Math.min(amountThousands / 500, 1.0);
        const chance = clamp(
            this.corruption
            + bribeStrength * 0.40
            - this.reputation * 0.35
            - (this.experience / 30) * 0.10,
            0, 1
        );

        if (Math.random() < chance) {
            this.isBribed     = true;
            this.bribeAmount  = amountThousands;
            this.reputation   = clamp(+(this.reputation - 0.06).toFixed(2), 0.01, 1);
            this.reputationEvents.push({ outcome: 'bribed', delta: -0.06, at: Date.now() });
            if (this.reputationEvents.length > 50) this.reputationEvents.shift();
            return {
                success: true,
                message: `Эксперт ${this.name} принял вознаграждение ${amountThousands} тыс. руб. Результат экспертизы будет скорректирован.`,
            };
        }

        return {
            success: false,
            message: `Эксперт ${this.name} отказал. ${this.reputation > 0.80 ? 'Намерен уведомить прокуратуру.' : 'Инцидент зафиксирован.'}`,
        };
    }

    // ─── Ошибки ──────────────────────────────────────────────────────────────

    /**
     * Взвешенная случайная выборка типа ошибки.
     * Вероятность каждого типа корректируется навыком и архетипом.
     */
    rollExpertError() {
        const candidates = [];

        for (const [key, err] of Object.entries(EXPERT_ERROR_TYPES)) {
            const adjustedProb = err.probability * (1.0 - this.skill * 0.7) * this._errorMult;
            if (adjustedProb > 0) candidates.push({ key, err, prob: adjustedProb });
        }

        // Взвешенный отбор
        const totalWeight = candidates.reduce((s, c) => s + c.prob, 0);
        let roll = Math.random() * totalWeight;

        for (const { key, err, prob } of candidates) {
            roll -= prob;
            if (roll <= 0) return { error: key, impact: err.impact, label: err.label };
        }

        return { error: null, impact: 0, label: null };
    }

    // ─── История / репутация ─────────────────────────────────────────────────

    /**
     * Фиксирует исход дела и обновляет опыт.
     */
    recordOutcome(outcome, testType) {
        const deltas = { accurate: +0.012, error: -0.040, bribed: -0.180 };
        const delta  = deltas[outcome] ?? 0;
        this.reputation = clamp(+(this.reputation + delta).toFixed(2), 0.01, 1.0);
        this.reputationEvents.push({ outcome, delta, at: Date.now() });
        if (this.reputationEvents.length > 50) this.reputationEvents.shift();

        // Накапливаем практику
        if (testType) {
            this.caseHistory[testType] = (this.caseHistory[testType] || 0) + 1;
        }

        // Опыт растёт медленно
        if (Math.random() < 0.05) this.experience++;
    }

    /**
     * Модификатор репутации для суда (используется в UI и challenge system).
     * @returns {{ label: string, modifier: number, courtNote: string|null }}
     */
    getReputationModifier() {
        if (this.reputation >= 0.88) return { label: '⭐⭐⭐ Признанный эксперт',  modifier: +0.08, courtNote: null };
        if (this.reputation >= 0.70) return { label: '⭐⭐ Опытный специалист',   modifier: +0.03, courtNote: null };
        if (this.reputation >= 0.50) return { label: '⭐ Практикующий специалист', modifier:  0.00, courtNote: null };
        return {
            label:    '⚠️ Спорная репутация',
            modifier: -0.10,
            courtNote: `Суд принимает во внимание оспариваемую репутацию эксперта ${this.name} — показания принимаются с ограниченным весом.`,
        };
    }

    /** Визитная карточка для UI */
    toCard() {
        const rep    = this.getReputationModifier();
        const arch   = EXPERT_ARCHETYPES[this.archetype] || {};
        const burnoutNote = this.burnout ? ' 🔴 Перегружен' : '';
        return {
            name:        `${this.fullName}, ${this.title}`,
            shortName:   `${this.name}, ${this.title}`,
            lab:         this.labName,
            repLabel:    rep.label,
            repScore:    this.reputation,
            archetype:   arch.label || this.archetype,
            archetypeDesc: arch.desc || '',
            exp:         `${this.experience} лет стажа`,
            skill:       `${Math.round(this.skill * 100)}%`,
            fee:         `${this.fee.toLocaleString('ru-RU')} руб.`,
            burnout:     this.burnout,
            publicProfile: this.publicProfile,
            courtNote:   rep.courtNote,
            status:      this.burnout ? `Перегружен${burnoutNote}` : 'Доступен',
        };
    }
}

// ─── ExpertModel (фабрика) ────────────────────────────────────────────────────
export class ExpertModel {

    /**
     * Генерирует одного эксперта для конкретного типа теста.
     * @param {string} testType
     * @param {object} [override]
     */
    static generate(testType, override = {}) {
        // Находим подходящую лабораторию
        const specializedLabs = LAB_CATALOG.filter(l => l.specialties.includes(testType));
        const lab = specializedLabs.length ? R(specializedLabs) : R(LAB_CATALOG);

        // Архетип: случайный с весами
        const archetype = ExpertModel._randomArchetype();

        const expert = new ExpertProfile({
            labId:          lab.id,
            labName:        lab.name,
            labType:        lab.type || 'state',
            archetype,
            labSpecialties: lab.specialties,
            corruption:     EXPERT_ARCHETYPES[archetype].corruptRange[0]
                          + Math.random() * (EXPERT_ARCHETYPES[archetype].corruptRange[1] - EXPERT_ARCHETYPES[archetype].corruptRange[0])
                          + lab.corruption * 0.5,
            ...override,
        });

        return expert;
    }

    /**
     * Панель из count экспертов с разным уровнем (tier) и ценой.
     * @param {string} testType
     * @param {number} [count=3]
     */
    static generatePanel(testType, count = 3) {
        const tiers = [
            { archetype: 'bureaucratic', label: 'Бюджетный',   tier: 1 },
            { archetype: 'pragmatic',    label: 'Стандартный', tier: 2 },
            { archetype: 'methodical',   label: 'Опытный',     tier: 3 },
            { archetype: 'genius',       label: 'Элитный',     tier: 4 },
            { archetype: 'academic',     label: 'Академический', tier: 3 },
        ].slice(0, count);

        return tiers.map(t => {
            const exp = ExpertModel.generate(testType, { archetype: t.archetype });
            exp._panelTier  = t.tier;
            exp._panelLabel = t.label;
            return exp;
        });
    }

    /**
     * Надёжность лаборатории для конкретного типа теста.
     */
    static labReliabilityMultiplier(labId, testType) {
        const lab = LAB_CATALOG.find(l => l.id === labId);
        if (!lab) return 0.85;
        const isSpec = lab.specialties.includes(testType);
        return +(lab.reliability * (isSpec ? 1.04 : 0.91)).toFixed(3);
    }

    /**
     * Взвешенный случайный архетип (genius редкий, corrupt редкий).
     */
    static _randomArchetype() {
        const weights = {
            methodical:    12,
            bureaucratic:  20,
            corrupt:        5,
            careerist:     15,
            genius:         3,
            honest_nervous: 18,
            pragmatic:     22,
            academic:       5,
        };
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        let roll = Math.random() * total;
        for (const [key, w] of Object.entries(weights)) {
            roll -= w;
            if (roll <= 0) return key;
        }
        return 'pragmatic';
    }
}
