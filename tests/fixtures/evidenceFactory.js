/**
 * evidenceFactory.js — фабрика тестовых улик для ExpertiseSystem.
 * Browser-compatible (нет node: imports).
 */

/**
 * @param {object} overrides
 * @returns {object}  Улика, пригодная для ExpertiseSystem.generateReport()
 */
export function createTestEvidence(overrides = {}) {
    const defaults = {
        id:             `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        label:          'Тестовая улика',
        description:    'Объект исследования',
        type:           'physical',
        quality:        0.80,
        contamination:  0.05,
        ageDays:        3,
        chainIntegrity: 0.95,
        tests:          [],
        validTests:     [],
    };
    const ev = { ...defaults, ...overrides };
    if (!ev.validTests.length) ev.validTests = _defaultValidTests(ev.type);
    return ev;
}

/**
 * Создаёт набор улик для типового дела.
 * @param {'homicide'|'fraud'|'drugs'|'robbery'} crimeType
 * @returns {object[]}
 */
export function createCaseEvidenceSet(crimeType = 'homicide') {
    const sets = {
        homicide: [
            createTestEvidence({ type: 'biological',  label: 'Кровь',     description: 'Образец крови с места' }),
            createTestEvidence({ type: 'firearm',     label: 'Гильза',    description: 'Стреляная гильза 9мм' }),
            createTestEvidence({ type: 'fingerprint', label: 'Отпечаток', description: 'Папиллярный след на рукояти' }),
        ],
        fraud: [
            createTestEvidence({ type: 'document', label: 'Договор', description: 'Подписанный договор купли-продажи' }),
            createTestEvidence({ type: 'digital',  label: 'Email',   description: 'Письмо с угрозами' }),
            createTestEvidence({ type: 'audio',    label: 'Запись',  description: 'Аудиозапись разговора' }),
        ],
        drugs: [
            createTestEvidence({ type: 'chemical',    label: 'Порошок',     description: 'Белый порошок в пакете' }),
            createTestEvidence({ type: 'biological',  label: 'Смыв',        description: 'Смыв с ладоней' }),
            createTestEvidence({ type: 'digital',     label: 'Телефон',     description: 'Переписка на смартфоне' }),
        ],
        robbery: [
            createTestEvidence({ type: 'fingerprint', label: 'Отпечаток', description: 'Следы на сейфе' }),
            createTestEvidence({ type: 'digital',     label: 'Камера',    description: 'Запись с камеры наблюдения' }),
            createTestEvidence({ type: 'textile',     label: 'Волокна',   description: 'Ворсинки с куртки' }),
        ],
    };
    return sets[crimeType] || sets.homicide;
}

function _defaultValidTests(type) {
    const map = {
        biological:  ['dna_test', 'toxicology_test', 'drug_test'],
        fingerprint: ['fingerprint_test'],
        firearm:     ['ballistic_test', 'explosives_trace'],
        document:    ['handwriting_analysis', 'document_forgery', 'metadata_analysis'],
        digital:     ['metadata_analysis', 'image_authentication', 'network_forensics'],
        audio:       ['voiceprint_analysis'],
        chemical:    ['toxicology_test', 'odor_analysis', 'drug_test'],
        textile:     ['fiber_analysis'],
        location:    ['gps_tracking'],
    };
    return map[type] || ['fingerprint_test'];
}
