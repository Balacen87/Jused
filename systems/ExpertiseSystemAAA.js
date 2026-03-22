/**
 * expertise-system-aaa.js (Improved Version)
 *
 * AAA-grade court expertise simulation architecture.
 *
 * Улучшения в этой версии:
 *  - Распакованы все minified-классы и методы для максимальной читаемости.
 *  - Добавлен подробный JSDoc с описанием параметров и возвращаемых типов.
 *  - В `ProbabilityEngine` сложная математика разбита на логические шаги.
 *  - Улучшены механизмы `EventBus` и добавлены проверки типов.
 *  - Код полностью готов к внедрению в `SimulationEngine` и `TrialSimulation`.
 */

// ─── Утилиты ─────────────────────────────────────────────────────────────────

/** Ограничивает значение в диапазоне [min, max] */
const clamp = (v, min = 0, max = 1) => Math.min(Math.max(v ?? 0, min), max);

/** Округляет до заданного числа знаков после запятой */
const round = (v, digits = 2) => +Number(v).toFixed(digits);

/** Случайное число с плавающей точкой в диапазоне [min, max] */
const randomBetween = (min, max) => min + Math.random() * (max - min);

/** Случайное целое число в диапазоне [min, max] */
const randomInt = (min, max) => Math.floor(randomBetween(min, max + 1));

/** Выбирает случайный элемент из массива */
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/** Возвращает true с вероятностью p */
const chance = p => Math.random() < clamp(p, 0, 1);

/** Генерирует уникальный ID */
const uid = (prefix = 'id') => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Выбирает элемент из массива на основе весов
 * @param {Array} items - Массив элементов
 * @param {Function} weightSelector - Функция, возвращающая вес элемента
 */
function weightedPick(items, weightSelector) {
    if (!items || !items.length) return null;
    const weights = items.map(i => Math.max(0, weightSelector(i)));
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return items[0];
    
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

/**
 * Генерирует нормально распределённый шум (Box-Muller transform)
 * @param {number} stdDev - Стандартное отклонение
 */
function gaussianNoise(stdDev = 0.03) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return z * stdDev;
}

/** Среднее арифметическое массива чисел */
function mean(values) {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** Глубокое копирование объекта */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}


// ─── Константы и Словари ─────────────────────────────────────────────────────

export const RESULT_TYPE = Object.freeze({
    MATCH: 'match',
    EXCLUSION: 'exclusion',
    INCONCLUSIVE: 'inconclusive',
    PROBABILISTIC: 'probabilistic',
    ANOMALOUS: 'anomalous',
});

export const TEST_STATUS = Object.freeze({
    PENDING: 'pending',
    COMPLETED: 'completed',
    INVALIDATED: 'invalidated',
    CHALLENGED: 'challenged',
    REPEATED: 'repeated',
});

export const LAB_TYPE = Object.freeze({
    STATE: 'state',
    PRIVATE: 'private',
    UNIVERSITY: 'university',
    MILITARY: 'military',
});

export const CHALLENGE_GROUND = Object.freeze({
    LOW_CERTAINTY: 'low_certainty',
    DEGRADED_SAMPLE: 'degraded_sample',
    CHAIN_BROKEN: 'chain_broken',
    LAB_ERROR: 'lab_error',
    EXPERT_BIAS: 'expert_bias',
    EXPERT_REPUTATION: 'expert_reputation',
    SCIENTIFIC_LIMITATION: 'scientific_limitation',
    FAKE_ARTIFACTS: 'fake_artifacts',
    CONTAMINATION: 'contamination',
    BACKLOG_RISK: 'backlog_risk',
    METHODOLOGY_LIMIT: 'methodology_limit',
});

export const EXPERT_ARCHETYPE = Object.freeze({
    METHODICAL: 'methodical',
    CAREERIST: 'careerist',
    BUREAUCRATIC: 'bureaucratic',
    BRILLIANT: 'brilliant',
    BURNT_OUT: 'burnt_out',
    CORRUPT: 'corrupt',
    PRAGMATIC: 'pragmatic',
    ACADEMIC: 'academic',
});

export const EXPERT_ERROR_TYPES = Object.freeze({
    misinterpretation: { label: 'Неверная интерпретация результатов', baseProbability: 0.05, reliabilityImpact: -0.12, certaintyImpact: -0.08 },
    instrumentFailure: { label: 'Сбой оборудования', baseProbability: 0.03, reliabilityImpact: -0.18, certaintyImpact: -0.10 },
    contamination: { label: 'Контаминация образца', baseProbability: 0.04, reliabilityImpact: -0.16, certaintyImpact: -0.12 },
    sampleSwap: { label: 'Перепутаны образцы', baseProbability: 0.01, reliabilityImpact: -0.40, certaintyImpact: -0.20 },
    reportingMistake: { label: 'Ошибка оформления заключения', baseProbability: 0.03, reliabilityImpact: -0.07, certaintyImpact: -0.04 },
});

export const EXPERTISE_CATALOG = Object.freeze({
    fingerprint_test: { 
        id: 'fingerprint_test', name: 'Дактилоскопическая экспертиза', icon: '🔍', category: 'Криминалистическая', 
        durationDays: 1, baseCost: 50, scientificAcceptance: 0.95, baseReliability: 0.87, baseInconclusiveChance: 0.08, 
        canFake: true, resultMode: 'categorical', specialties: ['trace', 'fingerprint'], 
        errorModel: { falsePositive: 0.04, falseNegative: 0.09 }, challengeSensitivity: 0.65, 
        desc: 'Сравнение папиллярных узоров с референсными образцами и базой следов.' 
    },
    dna_test: { 
        id: 'dna_test', name: 'ДНК-генотипирование', icon: '🧬', category: 'Молекулярно-биологическая', 
        durationDays: 3, baseCost: 250, scientificAcceptance: 0.99, baseReliability: 0.99, baseInconclusiveChance: 0.03, 
        canFake: false, resultMode: RESULT_TYPE.PROBABILISTIC, specialties: ['dna', 'biology'], 
        errorModel: { falsePositive: 0.000001, falseNegative: 0.005 }, challengeSensitivity: 0.35, 
        desc: 'STR-профилирование биологического материала.' 
    },
    ballistic_test: { 
        id: 'ballistic_test', name: 'Баллистическая экспертиза', icon: '🔫', category: 'Криминалистическая', 
        durationDays: 2, baseCost: 130, scientificAcceptance: 0.88, baseReliability: 0.91, baseInconclusiveChance: 0.11, 
        canFake: true, resultMode: RESULT_TYPE.PROBABILISTIC, specialties: ['ballistics', 'firearms'], 
        errorModel: { falsePositive: 0.03, falseNegative: 0.08 }, challengeSensitivity: 0.55, 
        desc: 'Сопоставление следов на пулях и гильзах с тестовыми выстрелами.' 
    },
    toxicology_test: { 
        id: 'toxicology_test', name: 'Токсикологический анализ', icon: '🧪', category: 'Судебно-медицинская', 
        durationDays: 3, baseCost: 180, scientificAcceptance: 0.96, baseReliability: 0.93, baseInconclusiveChance: 0.07, 
        canFake: false, resultMode: RESULT_TYPE.PROBABILISTIC, specialties: ['chemistry', 'toxicology'], 
        errorModel: { falsePositive: 0.02, falseNegative: 0.05 }, challengeSensitivity: 0.40, 
        desc: 'Поиск ядов, алкоголя, наркотиков и их метаболитов.' 
    },
    handwriting_analysis: { 
        id: 'handwriting_analysis', name: 'Почерковедческая экспертиза', icon: '✍️', category: 'Документальная', 
        durationDays: 2, baseCost: 85, scientificAcceptance: 0.72, baseReliability: 0.78, baseInconclusiveChance: 0.22, 
        canFake: true, resultMode: RESULT_TYPE.PROBABILISTIC, specialties: ['documents', 'handwriting'], 
        errorModel: { falsePositive: 0.10, falseNegative: 0.16 }, challengeSensitivity: 0.78, 
        desc: 'Сравнение почерка и подписи, оценка признаков имитации.' 
    },
    metadata_analysis: { 
        id: 'metadata_analysis', name: 'Анализ цифровых метаданных', icon: '💾', category: 'Компьютерно-техническая', 
        durationDays: 1, baseCost: 45, scientificAcceptance: 0.97, baseReliability: 0.96, baseInconclusiveChance: 0.04, 
        canFake: false, resultMode: RESULT_TYPE.PROBABILISTIC, specialties: ['digital', 'metadata'], 
        errorModel: { falsePositive: 0.01, falseNegative: 0.03 }, challengeSensitivity: 0.30, 
        desc: 'EXIF, файловые атрибуты, история изменений и таймлайн.' 
    },
    image_authentication: { 
        id: 'image_authentication', name: 'Видеотехническая экспертиза', icon: '📹', category: 'Компьютерно-техническая', 
        durationDays: 3, baseCost: 320, scientificAcceptance: 0.80, baseReliability: 0.82, baseInconclusiveChance: 0.19, 
        canFake: true, resultMode: RESULT_TYPE.PROBABILISTIC, specialties: ['video', 'digital'], 
        errorModel: { falsePositive: 0.08, falseNegative: 0.12 }, challengeSensitivity: 0.72, 
        desc: 'Подлинность видео, монтаж, идентификация силуэтов и лиц.' 
    },
    document_forgery: { 
        id: 'document_forgery', name: 'Экспертиза документа', icon: '📄', category: 'Документальная', 
        durationDays: 2, baseCost: 110, scientificAcceptance: 0.89, baseReliability: 0.89, baseInconclusiveChance: 0.10, 
        canFake: true, resultMode: 'categorical', specialties: ['documents', 'materials'], 
        errorModel: { falsePositive: 0.04, falseNegative: 0.09 }, challengeSensitivity: 0.50, 
        desc: 'Физико-химический анализ бумаги, чернил, печатей и защитных элементов.' 
    },
    voiceprint_analysis: { 
        id: 'voiceprint_analysis', name: 'Фоноскопическая экспертиза', icon: '🎙️', category: 'Криминалистическая', 
        durationDays: 2, baseCost: 200, scientificAcceptance: 0.70, baseReliability: 0.76, baseInconclusiveChance: 0.20, 
        canFake: false, resultMode: RESULT_TYPE.PROBABILISTIC, specialties: ['audio', 'phonoscopy'], 
        errorModel: { falsePositive: 0.11, falseNegative: 0.14 }, challengeSensitivity: 0.82, 
        desc: 'Сравнение акустических и лингвистических параметров голоса.' 
    },
    fiber_analysis: { 
        id: 'fiber_analysis', name: 'Трасологическая экспертиза волокон', icon: '🧵', category: 'Криминалистическая', 
        durationDays: 2, baseCost: 90, scientificAcceptance: 0.69, baseReliability: 0.72, baseInconclusiveChance: 0.24, 
        canFake: false, resultMode: RESULT_TYPE.PROBABILISTIC, specialties: ['trace', 'materials'], 
        errorModel: { falsePositive: 0.12, falseNegative: 0.15 }, challengeSensitivity: 0.83, 
        desc: 'Микроскопическое и спектральное сравнение волокон.' 
    },
    gps_tracking: { 
        id: 'gps_tracking', name: 'Анализ геолокации (GPS)', icon: '📍', category: 'Компьютерно-техническая', 
        durationDays: 1, baseCost: 30, scientificAcceptance: 0.94, baseReliability: 0.94, baseInconclusiveChance: 0.05, 
        canFake: false, resultMode: RESULT_TYPE.PROBABILISTIC, specialties: ['digital', 'geodata'], 
        errorModel: { falsePositive: 0.02, falseNegative: 0.04 }, challengeSensitivity: 0.32, 
        desc: 'GPS, данные БС, Wi-Fi и история перемещения.' 
    },
});

export const LAB_CATALOG = Object.freeze([
    { id: 'lab_state_central', name: 'ГЦСЭ — Центральная государственная', type: LAB_TYPE.STATE, reliability: 0.93, corruption: 0.06, equipmentLevel: 0.92, backlog: 0.35, staffQuality: 0.88, politicalPressure: 0.10, specialties: ['dna_test', 'toxicology_test', 'fingerprint_test', 'ballistic_test', 'document_forgery'] },
    { id: 'lab_private_digital', name: 'ForensiTech Private Lab', type: LAB_TYPE.PRIVATE, reliability: 0.90, corruption: 0.10, equipmentLevel: 0.95, backlog: 0.18, staffQuality: 0.84, politicalPressure: 0.03, specialties: ['metadata_analysis', 'image_authentication', 'voiceprint_analysis', 'gps_tracking'] },
    { id: 'lab_university_bio', name: 'Университетский центр МВД', type: LAB_TYPE.UNIVERSITY, reliability: 0.95, corruption: 0.03, equipmentLevel: 0.91, backlog: 0.28, staffQuality: 0.90, politicalPressure: 0.02, specialties: ['dna_test', 'toxicology_test', 'fiber_analysis'] },
    { id: 'lab_regional_trace', name: 'Региональная трасологическая лаборатория', type: LAB_TYPE.STATE, reliability: 0.84, corruption: 0.08, equipmentLevel: 0.76, backlog: 0.52, staffQuality: 0.79, politicalPressure: 0.07, specialties: ['fingerprint_test', 'fiber_analysis', 'document_forgery', 'handwriting_analysis'] },
]);

const EXPERT_FIRST = ['Андрей', 'Виктор', 'Олег', 'Сергей', 'Дмитрий', 'Алексей', 'Наталья', 'Елена', 'Ирина', 'Татьяна', 'Михаил', 'Павел'];
const EXPERT_LAST = ['Громов', 'Сорокин', 'Белов', 'Крылов', 'Носов', 'Лазарев', 'Орлова', 'Соловьёв', 'Макаров', 'Фролов', 'Зайцева', 'Попов'];
const EXPERT_PATRONYMIC = ['Андреевич', 'Викторович', 'Олегович', 'Сергеевич', 'Дмитриевич', 'Алексеевич', 'Михайлович', 'Павлович', 'Игоревна', 'Сергеевна', 'Андреевна'];
const EXPERT_TITLES = ['д.м.н.', 'к.х.н.', 'к.т.н.', 'к.ю.н.', 'к.б.н.', 'к.ф.-м.н.'];

// ─── Ядро Событий ────────────────────────────────────────────────────────────

export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(event, handler) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        const list = this.listeners.get(event);
        if (!list) return;
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
    }

    emit(event, payload) {
        const list = this.listeners.get(event) || [];
        for (const fn of list) {
            try { fn(payload); } catch (e) { console.error(`[EventBus] Error in handler for ${event}:`, e); }
        }
    }
}

export const EVENTS = Object.freeze({
    REQUEST_CREATED: 'expertise:request_created',
    REPORT_GENERATED: 'expertise:report_generated',
    REPORT_RETESTED: 'expertise:report_retested',
    REPORT_CHALLENGED: 'expertise:report_challenged',
    EXPERT_ASSIGNED: 'expertise:expert_assigned',
    LAB_ASSIGNED: 'expertise:lab_assigned'
});

// ─── Доменные Сущности ───────────────────────────────────────────────────────

/**
 * Объект Улики (Evidence), содержащий криминалистические метрики сохранности
 */
export class Evidence {
    constructor(data = {}) {
        this.id = data.id || uid('ev');
        this.label = data.label || data.description || 'Улика';
        this.description = data.description || this.label;
        this.type = data.type || 'generic';
        this.source = data.source || 'crime_scene';
        
        // Физические метрики
        this.quality = clamp(data.quality ?? randomBetween(0.55, 0.98));
        this.contamination = clamp(data.contamination ?? randomBetween(0.0, 0.15));
        this.ageDays = Math.max(0, data.ageDays ?? randomInt(0, 14));
        this.amount = clamp(data.amount ?? randomBetween(0.4, 1.0));
        
        // Метрики хранения (Chain of Custody)
        this.storageQuality = clamp(data.storageQuality ?? randomBetween(0.65, 1.0));
        this.chainIntegrity = clamp(data.chainIntegrity ?? randomBetween(0.7, 1.0));
        this.collectionIntegrity = clamp(data.collectionIntegrity ?? randomBetween(0.72, 1.0));
        
        this.validTests = data.validTests || [];
        this.tests = data.tests || [];
        this.metadata = data.metadata || {};
    }

    /** Насколько улика испорчена со временем и от контаминации */
    getDegradationScore() {
        const ageHit = clamp(this.ageDays / 30, 0, 0.35);
        const contaminationHit = this.contamination * 0.4;
        const storageHit = (1 - this.storageQuality) * 0.25;
        return round(clamp(ageHit + contaminationHit + storageHit, 0, 0.8), 3);
    }

    /** Общий балл целостности для суда */
    getIntegrityScore() {
        return round(clamp(mean([
            this.quality,
            1 - this.contamination,
            this.storageQuality,
            this.chainIntegrity,
            this.collectionIntegrity,
            this.amount
        ]), 0, 1), 3);
    }

    toSnapshot() {
        return {
            id: this.id, label: this.label, type: this.type,
            quality: this.quality, contamination: this.contamination,
            ageDays: this.ageDays, amount: this.amount,
            storageQuality: this.storageQuality,
            chainIntegrity: this.chainIntegrity,
            collectionIntegrity: this.collectionIntegrity,
            integrityScore: this.getIntegrityScore(),
            degradationScore: this.getDegradationScore()
        };
    }
}

/**
 * Профиль Лаборатории
 */
export class LabProfile {
    constructor(data = {}) {
        this.id = data.id || uid('lab');
        this.name = data.name || 'Лаборатория';
        this.type = data.type || LAB_TYPE.STATE;
        this.reliability = clamp(data.reliability ?? 0.85);
        this.corruption = clamp(data.corruption ?? 0.05);
        this.equipmentLevel = clamp(data.equipmentLevel ?? 0.8);
        this.backlog = clamp(data.backlog ?? 0.25);
        this.staffQuality = clamp(data.staffQuality ?? 0.8);
        this.politicalPressure = clamp(data.politicalPressure ?? 0.05);
        this.specialties = data.specialties || [];
    }

    supports(testType) {
        return this.specialties.includes(testType);
    }

    getMultiplierFor(testType) {
        const specialtyBonus = this.supports(testType) ? 0.05 : -0.06;
        const equipmentBonus = (this.equipmentLevel - 0.5) * 0.18;
        const staffBonus = (this.staffQuality - 0.5) * 0.14;
        const backlogPenalty = this.backlog * 0.10;
        return round(clamp(1 + specialtyBonus + equipmentBonus + staffBonus - backlogPenalty, 0.7, 1.1), 3);
    }
}

/**
 * Профиль конкретного Эксперта
 */
export class ExpertProfile {
    constructor(data = {}) {
        this.id = data.id || uid('exp');
        this.firstName = data.firstName || pick(EXPERT_FIRST);
        this.lastName = data.lastName || pick(EXPERT_LAST);
        this.patronymic = data.patronymic || pick(EXPERT_PATRONYMIC);
        this.name = data.name || `${this.lastName} ${this.firstName} ${this.patronymic}`;
        this.title = data.title || pick(EXPERT_TITLES);
        
        this.labId = data.labId || null;
        this.labName = data.labName || 'Неизвестная лаборатория';
        this.archType = data.archType || pick(Object.values(EXPERT_ARCHETYPE));
        
        // Навыки и состояния
        this.skill = clamp(data.skill ?? randomBetween(0.55, 0.98));
        this.bias = clamp(data.bias ?? randomBetween(0.0, 0.3));
        this.fatigue = clamp(data.fatigue ?? randomBetween(0.0, 0.25));
        this.corruption = clamp(data.corruption ?? randomBetween(0.0, 0.15));
        this.reputation = clamp(data.reputation ?? randomBetween(0.5, 0.97));
        this.experience = Math.max(1, data.experience ?? randomInt(2, 30));
        
        this.specialties = data.specialties || [];
        this.caseHistory = data.caseHistory || {};
        
        // Взятки и репутация
        this.isBribed = !!data.isBribed;
        this.bribeAmount = data.bribeAmount || 0;
        this.reputationEvents = Array.isArray(data.reputationEvents) ? data.reputationEvents.slice(-50) : [];
    }

    supports(testType) {
        return this.specialties.includes(testType);
    }

    getExperienceBonus(testType) {
        const specializedCount = this.caseHistory[testType] || 0;
        const practice = Math.log(1 + specializedCount) / Math.log(25);
        const experienceYears = Math.min(this.experience / 30, 1);
        return round(clamp(practice * 0.06 + experienceYears * 0.05, 0, 0.11), 3);
    }

    getSkillModifier(testType) {
        const specializationBonus = this.supports(testType) ? 0.06 : -0.04;
        const skillBase = (this.skill - 0.5) * 0.38;
        const fatiguePenalty = this.fatigue * 0.09;
        const biasPenalty = this.bias * 0.04;
        const experienceBonus = this.getExperienceBonus(testType);
        
        let archBonus = 0;
        switch(this.archType) {
            case EXPERT_ARCHETYPE.METHODICAL: archBonus = 0.03; break;
            case EXPERT_ARCHETYPE.BRILLIANT:  archBonus = 0.05; break;
            case EXPERT_ARCHETYPE.ACADEMIC:   archBonus = 0.04; break;
            case EXPERT_ARCHETYPE.BUREAUCRATIC: archBonus = -0.01; break;
            case EXPERT_ARCHETYPE.CAREERIST:  archBonus = -0.02; break;
            case EXPERT_ARCHETYPE.CORRUPT:    archBonus = -0.04; break;
            case EXPERT_ARCHETYPE.BURNT_OUT:  archBonus = -0.06; break;
        }

        return round(clamp(skillBase + specializationBonus + experienceBonus + archBonus - fatiguePenalty - biasPenalty, -0.25, 0.2), 3);
    }

    getBiasPressure(isGuilty) {
        const direction = isGuilty ? 1 : -1;
        let archPressure = 0;
        if (this.archType === EXPERT_ARCHETYPE.CAREERIST) archPressure += 0.03;
        if (this.archType === EXPERT_ARCHETYPE.BUREAUCRATIC) archPressure += 0.02;
        if (this.archType === EXPERT_ARCHETYPE.CORRUPT && this.isBribed) archPressure += 0.10;
        return round(direction * (this.bias * 0.10 + archPressure), 3);
    }

    getCourtroomCredibility() {
        const rep = (this.reputation - 0.5) * 0.5;
        const exp = Math.min(this.experience / 30, 1) * 0.10;
        const fatigue = this.fatigue * 0.08;
        return round(clamp(0.7 + rep + exp - fatigue, 0.3, 1.0), 3);
    }

    rollExpertError(testType) {
        const entries = Object.entries(EXPERT_ERROR_TYPES).map(([key, value]) => {
            const specialtyFactor = this.supports(testType) ? 0.85 : 1.15;
            const fatigueFactor = 1 + this.fatigue * 1.4;
            const skillFactor = 1 + (1 - this.skill) * 1.3;
            const archFactor = this.archType === EXPERT_ARCHETYPE.BURNT_OUT ? 1.4 : 1;
            const weight = value.baseProbability * specialtyFactor * fatigueFactor * skillFactor * archFactor;
            return { key, ...value, weight };
        });
        
        const triggered = entries.filter(e => chance(e.weight));
        if (!triggered.length) return null;
        return weightedPick(triggered, e => e.weight);
    }

    increaseFatigue(amount = 0.08) {
        this.fatigue = round(clamp(this.fatigue + amount, 0, 1), 3);
    }

    incrementCaseHistory(testType) {
        this.caseHistory[testType] = (this.caseHistory[testType] || 0) + 1;
    }

    recordOutcome(outcome, deltaOverride = null) {
        const deltas = { accurate: 0.01, error: -0.05, bribed: -0.2, challenged_successfully: -0.07, challenged_unsuccessfully: 0.01 };
        const delta = deltaOverride ?? (deltas[outcome] || 0);
        this.reputation = round(clamp(this.reputation + delta, 0.01, 1), 3);
        this.reputationEvents.push({ outcome, delta, at: Date.now() });
        this.reputationEvents = this.reputationEvents.slice(-50);
    }

    toCard() {
        return {
            id: this.id,
            name: `${this.name}, ${this.title}`,
            lab: this.labName,
            skill: `${Math.round(this.skill * 100)}%`,
            fatigue: `${Math.round(this.fatigue * 100)}%`,
            experience: `${this.experience} лет`,
            reputation: this.reputation,
            courtroomCredibility: this.getCourtroomCredibility(),
            specialties: this.specialties.slice(),
        };
    }
}

export class ExpertiseRequest {
    constructor(data = {}) {
        this.id = data.id || uid('req');
        this.testType = data.testType;
        this.evidence = data.evidence instanceof Evidence ? data.evidence : new Evidence(data.evidence || {});
        this.isGuilty = !!data.isGuilty;
        this.isFake = !!data.isFake;
        this.priority = clamp(data.priority ?? 0.5);
        this.requestedAt = data.requestedAt || Date.now();
        this.context = data.context || {};
    }
}

export class ExpertiseReport {
    constructor(data = {}) {
        Object.assign(this, {
            id: data.id || uid('report'),
            requestId: data.requestId || null,
            evidenceId: data.evidenceId || null,
            testType: data.testType,
            name: data.name || data.testType,
            icon: data.icon || '🔬',
            category: data.category || 'Неизвестная',
            status: data.status || TEST_STATUS.COMPLETED,
            
            // Основные метрики результата
            match: !!data.match,
            resultType: data.resultType || RESULT_TYPE.INCONCLUSIVE,
            isFake: !!data.isFake,
            isGuilty: !!data.isGuilty,
            inconclusive: !!data.inconclusive,
            
            // Оценки качества
            scientificReliability: clamp(data.scientificReliability ?? 0.5),
            operationalReliability: clamp(data.operationalReliability ?? 0.5),
            certainty: clamp(data.certainty ?? 0.5),
            confidenceInterval: data.confidenceInterval || [0.4, 0.6],
            weight: clamp(data.weight ?? 0.5),
            courtroomWeight: clamp(data.courtroomWeight ?? 0.5),
            probabilityOfMatch: clamp(data.probabilityOfMatch ?? 0.5),
            
            // Дефекты
            labError: !!data.labError,
            sampleDegraded: !!data.sampleDegraded,
            contaminated: !!data.contaminated,
            chainBroken: !!data.chainBroken,
            expertError: data.expertError || null,
            
            // Сущности
            expert: data.expert || null,
            lab: data.lab || null,
            evidenceSnapshot: data.evidenceSnapshot || null,
            
            // Заключение для UI
            details: data.details || '',
            reasoning: data.reasoning || [],
            challengeGrounds: data.challengeGrounds || [],
            canChallenge: !!data.canChallenge,
            conclusion: data.conclusion || '',
            generatedAt: data.generatedAt || Date.now(),
            audit: data.audit || []
        });
    }
}

// ─── Фабрики Сущностей ───────────────────────────────────────────────────────

export class LabFactory {
    static fromCatalog(testType) {
        const candidates = LAB_CATALOG.map(item => new LabProfile(item));
        return weightedPick(candidates, lab => (lab.supports(testType) ? 2.5 : 0.8) * lab.reliability * (1 - lab.backlog * 0.5));
    }
}

export class ExpertFactory {
    static generate(testType, override = {}) {
        const lab = override.lab instanceof LabProfile ? override.lab : LabFactory.fromCatalog(testType);
        
        return new ExpertProfile({
            labId: lab.id,
            labName: lab.name,
            specialties: [lab.supports(testType) ? testType : pick(lab.specialties) || testType],
            skill: clamp(lab.reliability * randomBetween(0.86, 1.06), 0.35, 0.99),
            corruption: clamp(lab.corruption * randomBetween(0.7, 1.5), 0, 0.95),
            reputation: clamp(randomBetween(0.55, 0.96) * (0.8 + lab.staffQuality * 0.2), 0.25, 0.99),
            bias: clamp(randomBetween(0, 0.22) + lab.politicalPressure * 0.25, 0, 0.5),
            fatigue: clamp(randomBetween(0.02, 0.18) + lab.backlog * 0.2, 0, 0.8),
            ...override
        });
    }

    static generatePanel(testType, count = 3) {
        return Array.from({ length: count }, () => {
            const lab = LabFactory.fromCatalog(testType);
            const expert = ExpertFactory.generate(testType, { lab });
            return {
                ...expert.toCard(),
                hireCost: randomInt(40, 220),
                availabilityDays: Math.max(1, randomInt(1, 8) + Math.round(lab.backlog * 5))
            };
        }).sort((a, b) => b.courtroomCredibility - a.courtroomCredibility);
    }
}

// ─── Симуляционные Движки (Ядро) ─────────────────────────────────────────────

export class EvidenceAnalyzer {
    static getEvidenceModifiers(testMeta, evidence) {
        const degradation = evidence.getDegradationScore();
        const qualityModifier = (evidence.quality - 0.5) * 0.24;
        const amountModifier = (evidence.amount - 0.5) * 0.15;
        const contaminationPenalty = evidence.contamination * 0.25;
        const degradationPenalty = degradation * 0.22;
        const chainPenalty = (1 - evidence.chainIntegrity) * 0.20;
        const collectionPenalty = (1 - evidence.collectionIntegrity) * 0.18;
        const specializedTypeAdjustment = EvidenceAnalyzer._typeAdjustment(testMeta.id, evidence.type);
        
        return {
            degradation,
            totalReliabilityDelta: round(qualityModifier + amountModifier + specializedTypeAdjustment - contaminationPenalty - degradationPenalty - chainPenalty - collectionPenalty, 3),
            totalCertaintyDelta: round(qualityModifier * 0.7 + amountModifier * 0.5 - contaminationPenalty * 0.8 - degradationPenalty * 0.8 - chainPenalty * 0.7, 3)
        };
    }

    static _typeAdjustment(testType, evidenceType) {
        const matrix = {
            dna_test: { blood: 0.06, saliva: 0.04, hair: 0.01, touch_dna: -0.03 },
            fingerprint_test: { glass: 0.04, metal: 0.03, paper: -0.02, fabric: -0.05 },
            ballistic_test: { bullet: 0.05, shell: 0.03, fragment: -0.04 },
            metadata_analysis: { file: 0.04, phone: 0.02 },
            image_authentication: { video: 0.05, image: 0.01 },
            fiber_analysis: { fabric: 0.05, mixed_trace: -0.03 },
            gps_tracking: { phone: 0.04, vehicle_module: 0.03 }
        };
        return round(matrix[testType]?.[evidenceType] ?? 0, 3);
    }
}

export class LabSimulator {
    static getOperationalModifiers(lab, testType, priority = 0.5) {
        const multiplier = lab.getMultiplierFor(testType);
        const backlogPenalty = lab.backlog * 0.08;
        const equipmentBonus = (lab.equipmentLevel - 0.5) * 0.15;
        const staffBonus = (lab.staffQuality - 0.5) * 0.08;
        const pressurePenalty = lab.politicalPressure * 0.07;
        const rushPenalty = priority > 0.85 ? 0.03 : 0;
        const labErrorChance = clamp(0.02 + lab.backlog * 0.07 + (1 - lab.equipmentLevel) * 0.06 + rushPenalty, 0.01, 0.3);
        
        return {
            multiplier,
            backlogPenalty: round(backlogPenalty, 3),
            equipmentBonus: round(equipmentBonus, 3),
            staffBonus: round(staffBonus, 3),
            pressurePenalty: round(pressurePenalty, 3),
            labErrorChance: round(labErrorChance, 3)
        };
    }
}

export class ExpertSimulator {
    static getExpertModifiers(expert, testType, isGuilty) {
        return {
            skillModifier: expert.getSkillModifier(testType),
            biasPressure: expert.getBiasPressure(isGuilty),
            credibility: expert.getCourtroomCredibility(),
            fatiguePenalty: round(expert.fatigue * 0.05, 3),
            briberyPressure: expert.isBribed ? round(0.08 + Math.min(expert.bribeAmount / 1000, 0.12), 3) : 0
        };
    }

    static maybeRollError(expert, testType) {
        const err = expert.rollExpertError(testType);
        if (!err) return { error: null, reliabilityDelta: 0, certaintyDelta: 0 };
        return { error: err, reliabilityDelta: err.reliabilityImpact, certaintyDelta: err.certaintyImpact };
    }
}

export class ProbabilityEngine {
    static computeOutcome(meta, request, expertMods, evidenceMods, labMods, errorPack) {
        // 1. Оценка надёжности
        const scientificReliability = clamp(meta.baseReliability);
        const operationalReliability = clamp(
            scientificReliability + evidenceMods.totalReliabilityDelta + expertMods.skillModifier + 
            labMods.equipmentBonus + labMods.staffBonus - labMods.backlogPenalty - 
            labMods.pressurePenalty - expertMods.fatiguePenalty + errorPack.reliabilityDelta, 
            0.05, 0.999
        );
        
        // 2. Расчет шанса на 'Неоднозначный' результат (Inconclusive)
        const inconclusiveChance = clamp(
            meta.baseInconclusiveChance + (1 - request.evidence.amount) * 0.10 + 
            request.evidence.contamination * 0.12 + request.evidence.getDegradationScore() * 0.14 + 
            (1 - request.evidence.chainIntegrity) * 0.08 + Math.max(0, -expertMods.skillModifier) * 0.10, 
            0.01, 0.85
        );
        
        const chainBroken = request.evidence.chainIntegrity < 0.65;
        const sampleDegraded = request.evidence.getDegradationScore() > 0.25;
        const contaminated = request.evidence.contamination > 0.18 || errorPack.error?.key === 'contamination';
        const labError = chance(labMods.labErrorChance) || errorPack.error?.key === 'instrumentFailure';
        
        // --- Фильтр 1: Inconclusive
        if (!request.isFake && chance(inconclusiveChance)) {
            return {
                resultType: RESULT_TYPE.INCONCLUSIVE, match: false, inconclusive: true, probabilityOfMatch: 0.5,
                scientificReliability, operationalReliability, certainty: clamp(0.35 + gaussianNoise(0.04), 0.15, 0.6),
                confidenceInterval: [0.30, 0.58], sampleDegraded, contaminated, labError, chainBroken
            };
        }
        
        // --- Фильтр 2: Fake Evidence
        if (request.isFake && meta.canFake) {
            return ProbabilityEngine._fakeOutcome(meta, request, expertMods, evidenceMods);
        }
        
        // 3. Вычисление вероятностей False Positive / False Negative
        const fp = clamp(meta.errorModel.falsePositive + request.evidence.contamination * 0.03 + Math.max(0, -expertMods.skillModifier) * 0.04, 0, 0.45);
        const fn = clamp(meta.errorModel.falseNegative + request.evidence.getDegradationScore() * 0.08 + Math.max(0, -expertMods.skillModifier) * 0.05, 0, 0.5);
        
        // 4. Определение совпадения (Match Rate)
        let probabilityOfMatch = 0.5;
        if (request.isGuilty) {
            probabilityOfMatch = clamp(1 - fn + expertMods.biasPressure + expertMods.briberyPressure + gaussianNoise(0.025), 0.01, 0.999);
        } else {
            probabilityOfMatch = clamp(fp + Math.max(0, expertMods.biasPressure) * 0.8 + expertMods.briberyPressure * 0.9 + gaussianNoise(0.025), 0.001, 0.95);
        }
        
        const match = chance(probabilityOfMatch);
        
        // 5. Оценка уверенности (Certainty)
        const certainty = clamp(
            operationalReliability + evidenceMods.totalCertaintyDelta + (match ? 0.03 : -0.01) + 
            expertMods.skillModifier * 0.6 + (expertMods.credibility - 0.7) * 0.18 + 
            errorPack.certaintyDelta + gaussianNoise(0.02), 
            0.12, 0.99
        );
        const ciHalf = clamp(0.22 - certainty * 0.15 + request.evidence.getDegradationScore() * 0.08, 0.03, 0.24);
        
        return {
            resultType: meta.resultMode === RESULT_TYPE.PROBABILISTIC ? RESULT_TYPE.PROBABILISTIC : match ? RESULT_TYPE.MATCH : RESULT_TYPE.EXCLUSION,
            match,
            inconclusive: false,
            probabilityOfMatch: round(probabilityOfMatch, 4),
            scientificReliability,
            operationalReliability: round(operationalReliability, 4),
            certainty: round(certainty, 4),
            confidenceInterval: [round(clamp(certainty - ciHalf, 0.01, 1), 2), round(clamp(certainty + ciHalf, 0.01, 1), 2)],
            sampleDegraded, contaminated, labError, chainBroken
        };
    }

    static _fakeOutcome(meta, request, expertMods, evidenceMods) {
        const desiredMatch = !request.isGuilty; // Ложная улика всегда пытается показать обратное
        const certainty = clamp(0.90 + gaussianNoise(0.025), 0.82, 0.97);
        const operationalReliability = clamp(meta.baseReliability - 0.18 + expertMods.skillModifier * 0.1 - evidenceMods.totalReliabilityDelta * 0.1, 0.25, 0.92);
        
        return {
            resultType: chance(0.65) ? RESULT_TYPE.ANOMALOUS : RESULT_TYPE.PROBABILISTIC,
            match: desiredMatch,
            inconclusive: false,
            probabilityOfMatch: desiredMatch ? 0.96 : 0.04,
            scientificReliability: meta.baseReliability,
            operationalReliability: round(operationalReliability, 4),
            certainty: round(certainty, 4),
            confidenceInterval: [round(certainty - 0.04, 2), round(certainty + 0.03, 2)],
            sampleDegraded: false, contaminated: false, labError: false, chainBroken: false
        };
    }
}

export class WeightCalculator {
    static calculate(report, expert, lab) {
        if (report.inconclusive) return { weight: 0.18, courtroomWeight: 0.12 };
        
        const rawWeight = clamp(
            report.scientificReliability * 0.35 + report.operationalReliability * 0.25 + 
            report.certainty * 0.25 + (report.evidenceSnapshot?.integrityScore ?? 0.6) * 0.10 + 
            expert.getCourtroomCredibility() * 0.05, 
            0.05, 1
        );
        
        const courtroomPenalty = (report.chainBroken ? 0.14 : 0) + (report.labError ? 0.10 : 0) + 
            (report.sampleDegraded ? 0.07 : 0) + (report.contaminated ? 0.08 : 0) + 
            (report.expertError ? 0.10 : 0) + (expert.reputation < 0.45 ? 0.09 : 0) + 
            (lab.backlog > 0.55 ? 0.04 : 0);
            
        return {
            weight: round(rawWeight, 4),
            courtroomWeight: round(clamp(rawWeight - courtroomPenalty, 0.01, 1), 4)
        };
    }
}

export class ChallengeEngine {
    static buildGrounds(meta, report, expert, lab) {
        const grounds = [];
        if (report.certainty < Math.max(0.65, meta.challengeSensitivity)) 
            grounds.push({ code: CHALLENGE_GROUND.LOW_CERTAINTY, text: `Недостаточный уровень достоверности (${Math.round(report.certainty * 100)}%).` });
        if (report.sampleDegraded) 
            grounds.push({ code: CHALLENGE_GROUND.DEGRADED_SAMPLE, text: 'Образец деградирован, снижается идентификационная ценность.' });
        if (report.chainBroken) 
            grounds.push({ code: CHALLENGE_GROUND.CHAIN_BROKEN, text: 'Нарушена цепочка хранения улики.' });
        if (report.labError) 
            grounds.push({ code: CHALLENGE_GROUND.LAB_ERROR, text: 'Есть признаки лабораторной ошибки или технического сбоя.' });
        if (report.contaminated) 
            grounds.push({ code: CHALLENGE_GROUND.CONTAMINATION, text: 'Обнаружены признаки контаминации исследуемого материала.' });
        if (expert.bias > 0.28) 
            grounds.push({ code: CHALLENGE_GROUND.EXPERT_BIAS, text: 'Есть основания ставить под сомнение беспристрастность эксперта.' });
        if (expert.reputation < 0.45) 
            grounds.push({ code: CHALLENGE_GROUND.EXPERT_REPUTATION, text: 'Репутация эксперта в судебной системе спорная.' });
        if (meta.scientificAcceptance < 0.8) 
            grounds.push({ code: CHALLENGE_GROUND.SCIENTIFIC_LIMITATION, text: 'Метод имеет ограниченную научную признанность.' });
        if (lab.backlog > 0.55) 
            grounds.push({ code: CHALLENGE_GROUND.BACKLOG_RISK, text: 'Высокая перегруженность лаборатории повышает риск процедурных дефектов.' });
        if (report.isFake || report.resultType === RESULT_TYPE.ANOMALOUS) 
            grounds.push({ code: CHALLENGE_GROUND.FAKE_ARTIFACTS, text: 'Выявлены артефакты, характерные для фальсификации или подгонки результата.' });
        if (meta.challengeSensitivity >= 0.75) 
            grounds.push({ code: CHALLENGE_GROUND.METHODOLOGY_LIMIT, text: 'Метод требует осторожной судебной интерпретации.' });
        return grounds;
    }

    static canChallenge(grounds) {
        return grounds.length > 0;
    }
}

export class BayesianAggregator {
    static likelihoodRatio(report) {
        if (report.inconclusive) return 1.0;
        const c = clamp(report.courtroomWeight, 0.01, 0.99);
        return report.match ? round(1 + c * 8, 4) : round(1 / (1 + c * 8), 4);
    }

    static updatePosterior(prior, report) {
        const p = clamp(prior, 0.001, 0.999);
        const odds = p / (1 - p);
        const lr = BayesianAggregator.likelihoodRatio(report);
        const posteriorOdds = odds * lr;
        // Защита от деления Infinity / Infinity
        if (!isFinite(posteriorOdds)) return 0.999;
        return round(posteriorOdds / (1 + posteriorOdds), 6);
    }

    static summarize(reports, prior = 0.50) {
        let posterior = clamp(prior, 0.001, 0.999);
        let prosecutionWeight = 0;
        let defenseWeight = 0;
        
        for (const report of reports) {
            posterior = BayesianAggregator.updatePosterior(posterior, report);
            if (!report.inconclusive) {
                if (report.match) prosecutionWeight += report.courtroomWeight;
                else defenseWeight += report.courtroomWeight;
            }
        }
        
        const total = prosecutionWeight + defenseWeight || 1;
        return {
            prior: round(prior, 4),
            posterior: round(posterior, 4),
            prosecutionScore: round(prosecutionWeight / total, 4),
            defenseScore: round(defenseWeight / total, 4),
            dominant: prosecutionWeight > defenseWeight ? 'prosecution' : defenseWeight > prosecutionWeight ? 'defense' : 'neutral'
        };
    }
}

// ─── Репозитории ─────────────────────────────────────────────────────────────

export class MemoryExpertRepository {
    constructor() { this.items = new Map(); }
    save(expert) { this.items.set(expert.id, expert); return expert; }
    getById(id) { return this.items.get(id) || null; }
}

export class MemoryReportRepository {
    constructor() { this.items = new Map(); }
    save(report) { this.items.set(report.id, report); return report; }
    getById(id) { return this.items.get(id) || null; }
    findAll() { return [...this.items.values()]; }
}

// ─── Оркестратор Экспертиз ───────────────────────────────────────────────────

export class ExpertiseOrchestrator {
    constructor({ eventBus = new EventBus(), expertRepo = new MemoryExpertRepository(), reportRepo = new MemoryReportRepository() } = {}) {
        this.eventBus = eventBus;
        this.expertRepo = expertRepo;
        this.reportRepo = reportRepo;
    }

    generateReport(testType, evidence = {}, isGuilty = true, options = {}) {
        const meta = EXPERTISE_CATALOG[testType];
        if (!meta) {
            return new ExpertiseReport({ testType, name: testType, category: 'Неизвестный метод', inconclusive: true, resultType: RESULT_TYPE.INCONCLUSIVE, conclusion: 'Результат неприменим.' });
        }
        
        const ev = evidence instanceof Evidence ? evidence : new Evidence(evidence);
        const request = new ExpertiseRequest({ testType, evidence: ev, isGuilty, isFake: !!options.isFake, priority: options.priority ?? 0.5, context: options.context || {} });
        
        this.eventBus.emit(EVENTS.REQUEST_CREATED, { request });
        
        const lab = options.lab instanceof LabProfile ? options.lab : LabFactory.fromCatalog(testType);
        const expert = options.expert instanceof ExpertProfile ? options.expert : ExpertFactory.generate(testType, { lab });
        this.expertRepo.save(expert);
        
        const evidenceMods = EvidenceAnalyzer.getEvidenceModifiers(meta, ev);
        const labMods = LabSimulator.getOperationalModifiers(lab, testType, request.priority);
        const expertMods = ExpertSimulator.getExpertModifiers(expert, testType, isGuilty);
        const errorPack = ExpertSimulator.maybeRollError(expert, testType);
        
        const outcome = ProbabilityEngine.computeOutcome(meta, request, expertMods, evidenceMods, labMods, errorPack);
        
        const provisional = new ExpertiseReport({
            requestId: request.id, evidenceId: ev.id, testType, name: meta.name, icon: meta.icon, category: meta.category,
            status: TEST_STATUS.COMPLETED, match: outcome.match, resultType: outcome.resultType, isFake: !!options.isFake && meta.canFake, isGuilty,
            inconclusive: outcome.inconclusive, scientificReliability: outcome.scientificReliability, operationalReliability: outcome.operationalReliability,
            certainty: outcome.certainty, confidenceInterval: outcome.confidenceInterval, probabilityOfMatch: outcome.probabilityOfMatch,
            labError: outcome.labError, sampleDegraded: outcome.sampleDegraded, contaminated: outcome.contaminated, chainBroken: outcome.chainBroken,
            expertError: errorPack.error || null, expert: expert.toCard(), lab: deepClone(lab), evidenceSnapshot: ev.toSnapshot()
        });
        
        const weights = WeightCalculator.calculate(provisional, expert, lab);
        provisional.weight = weights.weight;
        provisional.courtroomWeight = weights.courtroomWeight;
        
        provisional.challengeGrounds = ChallengeEngine.buildGrounds(meta, provisional, expert, lab);
        provisional.canChallenge = ChallengeEngine.canChallenge(provisional.challengeGrounds);
        
        provisional.details = `${meta.name}: certainty ${Math.round(provisional.certainty * 100)}%; CI ${Math.round(provisional.confidenceInterval[0] * 100)}–${Math.round(provisional.confidenceInterval[1] * 100)}%. Эксперт: ${expert.name}. Лаборатория: ${lab.name}.`;
        
        provisional.reasoning = [
            { step: 'method', text: `Метод: ${meta.name}.` },
            { step: 'evidence', text: `Integrity score: ${ev.getIntegrityScore()}.` },
            { step: 'expert', text: `Expert modifier: ${expertMods.skillModifier}.` },
            { step: 'lab', text: `Lab error chance: ${labMods.labErrorChance}.` },
            { step: 'result', text: `Result type: ${provisional.resultType}.` },
        ];
        
        provisional.conclusion = provisional.isFake 
            ? `⚠️ Заключение по экспертизе «${meta.name}» содержит признаки фальсификации.` 
            : provisional.inconclusive 
                ? `${meta.name}: определённый вывод не достигнут.` 
                : provisional.match 
                    ? `С высокой вероятностью подтверждается связь с обвиняемым.` 
                    : `Причастность обвиняемого данным методом не подтверждена.`;
                    
        provisional.audit = [{ at: Date.now(), type: 'report', text: `Создан отчёт ${provisional.id}.` }];
        
        expert.incrementCaseHistory(testType);
        expert.increaseFatigue(meta.durationDays * 0.03 + request.priority * 0.02);
        
        this.reportRepo.save(provisional);
        this.eventBus.emit(EVENTS.REPORT_GENERATED, { request, report: provisional, expert, lab });
        
        return provisional;
    }

    retest(originalReport, evidence = {}, isGuilty = true, options = {}) {
        const retestReport = this.generateReport(originalReport.testType, evidence, isGuilty, { 
            ...options, priority: options.priority ?? 0.75, context: { ...(options.context || {}), retestOf: originalReport.id } 
        });
        retestReport.status = TEST_STATUS.REPEATED;
        retestReport.audit.push({ at: Date.now(), type: 'retest', text: `Повторная экспертиза вместо отчёта ${originalReport.id}.` });
        this.eventBus.emit(EVENTS.REPORT_RETESTED, { originalReport, retestReport });
        return retestReport;
    }

    challengeReport(report) {
        const updated = new ExpertiseReport({ 
            ...report, status: TEST_STATUS.CHALLENGED, audit: [...(report.audit || []), { at: Date.now(), type: 'challenge', text: 'Отчёт переведён в статус судебного оспаривания.' }] 
        });
        this.reportRepo.save(updated);
        this.eventBus.emit(EVENTS.REPORT_CHALLENGED, { report: updated });
        return updated;
    }

    summarize(reports, prior = 0.5) {
        return BayesianAggregator.summarize(reports, prior);
    }

    getVerdict(report) {
        if (report.isFake) return `⚠️ ВНИМАНИЕ: Заключение по ${report.name} содержит признаки фальсификации.`;
        if (report.inconclusive) return `${report.name}: результат неопределённый — требуется повторная экспертиза.`;
        
        const strength = report.certainty >= 0.90 ? 'Категорически' : report.certainty >= 0.70 ? 'С высокой вероятностью' : 'Предположительно';
        return `${strength} ${report.match ? 'подтверждает причастность обвиняемого' : 'не подтверждает причастность обвиняемого'}. ${report.canChallenge ? '⚖️ Заключение может быть оспорено.' : ''}`.trim();
    }
}

// ─── Главный Синглтон Системы (Facade) ───────────────────────────────────────

const _globalEventBus = new EventBus();
const _globalExpertRepo = new MemoryExpertRepository();
const _globalReportRepo = new MemoryReportRepository();
const _orchestrator = new ExpertiseOrchestrator({ eventBus: _globalEventBus, expertRepo: _globalExpertRepo, reportRepo: _globalReportRepo });

/**
 * Главный фасад для взаимодействия с AAA Expertise System
 */
export class ExpertiseSystemAAA {
    /** Сгенерировать новый отчет об экспертизе */
    static generateReport(testType, evidence = {}, isGuilty = true, options = {}) { return _orchestrator.generateReport(testType, evidence, isGuilty, options); }
    
    /** Провести повторную экспертизу (перетест) */
    static retest(originalReport, evidence = {}, isGuilty = true, options = {}) { return _orchestrator.retest(originalReport, evidence, isGuilty, options); }
    
    /** Получить байесовскую сводку по массиву отчетов */
    static summarize(reports, prior = 0.50) { return _orchestrator.summarize(reports, prior); }
    
    /** Получить готовый текстовый вердикт по конкретному отчету */
    static getVerdict(report) { return _orchestrator.getVerdict(report); }
    
    /** Оспорить отчет в суде */
    static challengeReport(report) { return _orchestrator.challengeReport(report); }
    
    /** Сгенерировать выборку экспертов (для UI) */
    static generateExpertPanel(testType, count = 3) { return ExpertFactory.generatePanel(testType, count); }
    
    /** Доступ к глобальным репозиториям */
    static getRepositories() { return { expertRepo: _globalExpertRepo, reportRepo: _globalReportRepo }; }
    
    /** Доступ к шине событий */
    static getEventBus() { return _globalEventBus; }
}

// ─── Интеграционная Доска Улик ───────────────────────────────────────────────

/**
 * TrialEvidenceBoard — агрегатор улик для судебного заседания.
 * Повышает удобство подключения к TrialSimulation и JuryAI.
 */
export class TrialEvidenceBoard {
    constructor(reports = []) { this.reports = [...reports]; }
    
    add(report) { this.reports.push(report); }
    getProsecutionReports() { return this.reports.filter(r => r.match && !r.inconclusive); }
    getDefenseReports() { return this.reports.filter(r => !r.match && !r.inconclusive); }
    getInconclusiveReports() { return this.reports.filter(r => r.inconclusive); }
    getChallengeableReports() { return this.reports.filter(r => r.canChallenge); }
    
    summarize(prior = 0.5) { return BayesianAggregator.summarize(this.reports, prior); }
}

/**
 * Демонстрационный сценарий для проверки
 */
export function demoAAAExpertiseScenario() {
    const evidence = new Evidence({ 
        label: 'Кровь на рукояти ножа', description: 'Бурые следы на рукояти ножа, изъятого с кухни', 
        type: 'blood', quality: 0.92, contamination: 0.03, ageDays: 2, amount: 0.88, 
        storageQuality: 0.95, chainIntegrity: 0.90, collectionIntegrity: 0.94 
    });
    
    const report1 = ExpertiseSystemAAA.generateReport('dna_test', evidence, true, { priority: 0.7 });
    const report2 = ExpertiseSystemAAA.generateReport('fingerprint_test', new Evidence({ 
        label: 'Бокал со стола', type: 'glass', quality: 0.79, contamination: 0.08, chainIntegrity: 0.82 
    }), true, { priority: 0.5 });
    
    const board = new TrialEvidenceBoard([report1, report2]);
    return { reports: board.reports, summary: board.summarize(0.5) };
}
