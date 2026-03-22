/**
 * ExpertiseCatalog.js — каталог экспертиз с полными моделями ошибок,
 * научной валидностью и параметрами улики.
 *
 * Структура каждой экспертизы:
 *  reliability        — базовая научная точность метода
 *  errorModel         — модель ошибок { falsePositive, falseNegative, subjective }
 *  scientificAcceptance — признанность методологии судами
 *  resultType         — categorical | probabilistic | exclusion | inconclusive_possible
 *  inconclusiveChance — вероятность неопределённого результата
 *  evidenceSensitivity — чувствительность к качеству образца
 *  canFake            — возможна ли подделка
 *  challengeability   — лёгкость оспаривания
 *  cost, time, durationDays
 *  requiredSampleMin  — минимальное количество материала (нг/мкл/мм²)
 */

export const EXPERTISE_CATALOG = {

    // ─────────────────── ДНК ──────────────────────────────────────────────────
    dna_test: {
        name:     'ДНК-генотипирование (STR)',
        icon:     '🧬',
        category: 'Молекулярно-биологическая',
        time: 3, cost: 250, durationDays: 5,
        reliability: 0.995,
        errorModel: {
            falsePositive:  0.000000001, // 1 на миллиард (Grim Sleeper case)
            falseNegative:  0.003,       // деградированный образец
            subjective:     0.00,        // объективный метод
        },
        scientificAcceptance: 0.99,
        resultType: 'probabilistic',
        inconclusiveChance: 0.06,       // малый образец / деградация
        evidenceSensitivity: 0.90,      // очень чувствительный к качеству
        canFake: false,
        challengeability: 0.10,
        requiredSampleMin: 0.5,         // нг
        desc: 'STR-профилирование по 15–20 локусам. Вероятность случайного совпадения у неродственных лиц: 1:10¹².',
    },

    // ─────────────────── Отпечатки ───────────────────────────────────────────
    fingerprint_test: {
        name:     'Дактилоскопическая экспертиза',
        icon:     '🔍',
        category: 'Криминалистическая',
        time: 1, cost: 50, durationDays: 1,
        reliability: 0.87,
        errorModel: {
            falsePositive:  0.008,  // Mayfield case — FBI ошиблись
            falseNegative:  0.05,   // частичный/смытый след
            subjective:     0.18,   // экспертная интерпретация
        },
        scientificAcceptance: 0.82, // снижена после NAS Report 2009
        resultType: 'categorical',
        inconclusiveChance: 0.12,
        evidenceSensitivity: 0.75,
        canFake: true,
        challengeability: 0.45,
        requiredSampleMin: null,
        desc: 'Сравнение папиллярных узоров методами ACE-V. ВНИМАНИЕ: в 2009 году Академия наук США выявила системный уровень ошибок.',
    },

    // ─────────────────── Баллистика ──────────────────────────────────────────
    ballistic_test: {
        name:     'Баллистическая экспертиза',
        icon:     '🔫',
        category: 'Криминалистическая',
        time: 2, cost: 130, durationDays: 3,
        reliability: 0.91,
        errorModel: {
            falsePositive:  0.012, // субъективное соответствие нарезов
            falseNegative:  0.04,
            subjective:     0.22,  // высокий субъективный элемент
        },
        scientificAcceptance: 0.78,
        resultType: 'categorical',
        inconclusiveChance: 0.09,
        evidenceSensitivity: 0.65,
        canFake: true,
        challengeability: 0.40,
        requiredSampleMin: null,
        desc: 'Идентификация оружия по нарезам ствола. Субъективный элемент признан Президентским советом советников по науке и технологии (PCAST) в 2016 году.',
    },

    // ─────────────────── Токсикология ────────────────────────────────────────
    toxicology_test: {
        name:     'Токсикологический анализ',
        icon:     '🧪',
        category: 'Судебно-медицинская',
        time: 3, cost: 180, durationDays: 7,
        reliability: 0.93,
        errorModel: {
            falsePositive:  0.003,
            falseNegative:  0.008,
            subjective:     0.05,
        },
        scientificAcceptance: 0.95,
        resultType: 'probabilistic',
        inconclusiveChance: 0.04,
        evidenceSensitivity: 0.80,
        canFake: false,
        challengeability: 0.20,
        requiredSampleMin: 1.0, // мл крови
        desc: 'ГХ-МС анализ. Высокая точность при правильном хранении образца.',
    },

    // ─────────────────── Почерк ──────────────────────────────────────────────
    handwriting_analysis: {
        name:     'Почерковедческая экспертиза',
        icon:     '✍️',
        category: 'Документальная',
        time: 2, cost: 85, durationDays: 4,
        reliability: 0.73,
        errorModel: {
            falsePositive:  0.035,
            falseNegative:  0.04,
            subjective:     0.35,   // очень высокий субъективный элемент
        },
        scientificAcceptance: 0.55, // спорная методология
        resultType: 'probabilistic',
        inconclusiveChance: 0.20,
        evidenceSensitivity: 0.60,
        canFake: true,
        challengeability: 0.70,
        requiredSampleMin: null,
        desc: 'ВНИМАНИЕ: NAS Report 2009 признал почерковедение недостаточно научно обоснованным. Рекомендуется принимать с осторожностью.',
    },

    // ─────────────────── Цифровые метаданные ─────────────────────────────────
    metadata_analysis: {
        name:     'Анализ цифровых метаданных',
        icon:     '💾',
        category: 'Компьютерно-техническая',
        time: 1, cost: 45, durationDays: 1,
        reliability: 0.96,
        errorModel: {
            falsePositive:  0.005,  // VPN/proxy
            falseNegative:  0.015,
            subjective:     0.03,
        },
        scientificAcceptance: 0.90,
        resultType: 'categorical',
        inconclusiveChance: 0.05,
        evidenceSensitivity: 0.50,
        canFake: false,
        challengeability: 0.25,
        requiredSampleMin: null,
        desc: 'EXIF, NTFS timestamps, MIME-заголовки. Относительно объективный метод.',
    },

    // ─────────────────── Видеотехника ────────────────────────────────────────
    image_authentication: {
        name:     'Видеотехническая экспертиза',
        icon:     '📹',
        category: 'Компьютерно-техническая',
        time: 3, cost: 320, durationDays: 6,
        reliability: 0.78,
        errorModel: {
            falsePositive:  0.025,  // deepfake False Positive
            falseNegative:  0.06,
            subjective:     0.28,   // идентификация лиц субъективна
        },
        scientificAcceptance: 0.72,
        resultType: 'probabilistic',
        inconclusiveChance: 0.18,
        evidenceSensitivity: 0.70,
        canFake: true,
        challengeability: 0.55,
        requiredSampleMin: null,
        desc: 'Анализ артефактов сжатия, шумового профиля, идентификация лиц (FaceNet). Технология deepfake создаёт риски false positive.',
    },

    // ─────────────────── Документы ───────────────────────────────────────────
    document_forgery: {
        name:     'Экспертиза подлинности документа',
        icon:     '📄',
        category: 'Документальная',
        time: 2, cost: 110, durationDays: 3,
        reliability: 0.89,
        errorModel: {
            falsePositive:  0.015,
            falseNegative:  0.025,
            subjective:     0.15,
        },
        scientificAcceptance: 0.84,
        resultType: 'categorical',
        inconclusiveChance: 0.08,
        evidenceSensitivity: 0.60,
        canFake: true,
        challengeability: 0.35,
        requiredSampleMin: null,
        desc: 'XRF-анализ чернил, датировка бумаги по составу, исследование защитных элементов.',
    },

    // ─────────────────── Голос ───────────────────────────────────────────────
    voiceprint_analysis: {
        name:     'Фоноскопическая экспертиза',
        icon:     '🎙️',
        category: 'Криминалистическая',
        time: 2, cost: 200, durationDays: 4,
        reliability: 0.71,
        errorModel: {
            falsePositive:  0.04,
            falseNegative:  0.06,
            subjective:     0.30,
        },
        scientificAcceptance: 0.60,
        resultType: 'probabilistic',
        inconclusiveChance: 0.22,
        evidenceSensitivity: 0.75,
        canFake: false,
        challengeability: 0.65,
        requiredSampleMin: 10, // секунд чистого аудио
        desc: 'Анализ форманты F0–F3, акустических параметров. Признан спорным методом рядом судебных систем.',
    },

    // ─────────────────── Химические следы ────────────────────────────────────
    odor_analysis: {
        name:     'Химико-трасологическая экспертиза',
        icon:     '🌫️',
        category: 'Химическая',
        time: 2, cost: 150, durationDays: 3,
        reliability: 0.80,
        errorModel: {
            falsePositive:  0.02,
            falseNegative:  0.05,
            subjective:     0.12,
        },
        scientificAcceptance: 0.78,
        resultType: 'probabilistic',
        inconclusiveChance: 0.10,
        evidenceSensitivity: 0.85,
        canFake: false,
        challengeability: 0.30,
        requiredSampleMin: 0.1,
        desc: 'ГХ-МС идентификация летучих органических соединений. Чувствителен к условиям хранения.',
    },

    // ─────────────────── Взрывчатка ──────────────────────────────────────────
    explosives_trace: {
        name:     'Взрывотехническая экспертиза',
        icon:     '💥',
        category: 'Специализированная',
        time: 3, cost: 400, durationDays: 8,
        reliability: 0.88,
        errorModel: {
            falsePositive:  0.008,
            falseNegative:  0.04,
            subjective:     0.08,
        },
        scientificAcceptance: 0.91,
        resultType: 'categorical',
        inconclusiveChance: 0.07,
        evidenceSensitivity: 0.90,
        canFake: false,
        challengeability: 0.20,
        requiredSampleMin: 0.05,
        desc: 'IMS + масс-спектрометрия. PETN, RDX, TNT, TATP идентифицируются в следовых количествах.',
    },

    // ─────────────────── Сетевая ─────────────────────────────────────────────
    network_forensics: {
        name:     'Компьютерно-сетевая экспертиза',
        icon:     '🌐',
        category: 'Компьютерно-техническая',
        time: 3, cost: 350, durationDays: 7,
        reliability: 0.88,
        errorModel: {
            falsePositive:  0.015, // VPN/spoofing
            falseNegative:  0.03,
            subjective:     0.10,
        },
        scientificAcceptance: 0.85,
        resultType: 'probabilistic',
        inconclusiveChance: 0.12,
        evidenceSensitivity: 0.55,
        canFake: false,
        challengeability: 0.35,
        requiredSampleMin: null,
        desc: 'Анализ логов, PCAP, DNS-истории. VPN и Tor создают неопределённость.',
    },

    // ─────────────────── Наркотики ───────────────────────────────────────────
    drug_test: {
        name:     'Химический анализ (наркотики)',
        icon:     '💊',
        category: 'Судебно-химическая',
        time: 1, cost: 60, durationDays: 2,
        reliability: 0.97,
        errorModel: {
            falsePositive:  0.002,
            falseNegative:  0.005,
            subjective:     0.02,
        },
        scientificAcceptance: 0.97,
        resultType: 'categorical',
        inconclusiveChance: 0.02,
        evidenceSensitivity: 0.70,
        canFake: false,
        challengeability: 0.10,
        requiredSampleMin: 0.01,
        desc: 'ГХ-МС + ИК-спектроскопия. Идентификация по структурной формуле. Высочайшая точность.',
    },

    // ─────────────────── Волокна ─────────────────────────────────────────────
    fiber_analysis: {
        name:     'Трасологическая экспертиза волокон',
        icon:     '🧵',
        category: 'Криминалистическая',
        time: 2, cost: 90, durationDays: 3,
        reliability: 0.68,
        errorModel: {
            falsePositive:  0.045,
            falseNegative:  0.06,
            subjective:     0.28,
        },
        scientificAcceptance: 0.65,
        resultType: 'probabilistic',
        inconclusiveChance: 0.18,
        evidenceSensitivity: 0.80,
        canFake: false,
        challengeability: 0.60,
        requiredSampleMin: null,
        desc: 'Спектральный анализ под микроскопом. Индивидуализация невозможна — только класс волокон.',
    },

    // ─────────────────── GPS ─────────────────────────────────────────────────
    gps_tracking: {
        name:     'Анализ геолокационных данных',
        icon:     '📍',
        category: 'Компьютерно-техническая',
        time: 1, cost: 30, durationDays: 1,
        reliability: 0.94,
        errorModel: {
            falsePositive:  0.007,
            falseNegative:  0.012,
            subjective:     0.04,
        },
        scientificAcceptance: 0.91,
        resultType: 'categorical',
        inconclusiveChance: 0.04,
        evidenceSensitivity: 0.40,
        canFake: false,
        challengeability: 0.22,
        requiredSampleMin: null,
        desc: 'Восстановление маршрута из cell-tower, GPS-трека и Wi-Fi BSSID. Точность: ±50–200 м в городе.',
    },
};

// ─── Лаборатории ─────────────────────────────────────────────────────────────
export const LAB_CATALOG = [
    {
        id: 'rfcse',
        name: 'ФГБУ РФЦСЭ (Москва)',
        reliability: 0.95,
        corruption: 0.02,
        queueDays: 10,
        specialties: ['dna_test','toxicology_test','ballistic_test','explosives_trace'],
    },
    {
        id: 'region_lab_1',
        name: 'ЭКЦ ГУ МВД (региональный)',
        reliability: 0.84,
        corruption: 0.07,
        queueDays: 4,
        specialties: ['fingerprint_test','drug_test','fiber_analysis','odor_analysis'],
    },
    {
        id: 'private_lab',
        name: 'ООО «ФорензикЛаб»',
        reliability: 0.78,
        corruption: 0.14,
        queueDays: 2,
        specialties: ['handwriting_analysis','document_forgery','voiceprint_analysis'],
    },
    {
        id: 'tech_lab',
        name: 'НИИ Цифровой криминалистики',
        reliability: 0.91,
        corruption: 0.03,
        queueDays: 5,
        specialties: ['metadata_analysis','image_authentication','network_forensics','gps_tracking'],
    },
];

// ─── Типы ошибок эксперта ─────────────────────────────────────────────────────
export const EXPERT_ERROR_TYPES = {
    misinterpretation: {
        label: 'Неверная интерпретация',
        impact: -0.12,
        probability: 0.08,
    },
    instrumentFailure: {
        label: 'Отказ оборудования',
        impact: -0.20,
        probability: 0.03,
    },
    sampleSwap: {
        label: 'Путаница образцов',
        impact: -0.35,
        probability: 0.015,
    },
    transcriptionError: {
        label: 'Ошибка транскрипции протокола',
        impact: -0.08,
        probability: 0.05,
    },
    confirmationBias: {
        label: 'Когнитивный уклон (предвзятость)',
        impact: -0.10,
        probability: 0.10,
    },
};
