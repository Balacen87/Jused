import { EvidenceBycrimeType, ForensicTests } from '../data/ForensicData.js';

// ─── Типы ошибок лаборатории ─────────────────────────────────────────────────
const LAB_ERRORS = [
    { type: 'contamination', prob: 0.04, detail: 'Образец загрязнён. Требуется повторный забор.' },
    { type: 'equipment', prob: 0.03, detail: 'Сбой оборудования. Результат аннулирован.' },
    { type: 'human_error', prob: 0.03, detail: 'Ошибка лаборанта: неверная маркировка образца.' },
    { type: 'sample_degraded', prob: 0.02, detail: 'Биоматериал деградировал — анализ невозможен.' },
];

// Словарь связей между тестами (один тест может рекомендовать другой)
const TEST_CHAINS = {
    fingerprint_test: { confirms: ['dna_test'], suggests: 'Для подтверждения рекомендуется ДНК-анализ.' },
    dna_test: { confirms: ['toxicology_test'], suggests: null },
    ballistic_test: { confirms: [], suggests: 'Проверьте регистрацию оружия.' },
    toxicology_test: { confirms: [], suggests: null },
    handwriting_analysis: { confirms: ['document_forgery'], suggests: 'Рекомендуется полная экспертиза документа.' },
    metadata_analysis: { confirms: ['image_authentication'], suggests: null },
    image_authentication: { confirms: [], suggests: null },
    document_forgery: { confirms: ['handwriting_analysis'], suggests: null },
};

/**
 * AdvancedEvidenceSystem — продвинутая система улик и экспертиз.
 *
 * Возможности:
 *  - Контекстные описания улик из пула по типу преступления
 *  - Цепочка хранения (chain of custody) для каждой улики
 *  - Перекрёстные связи: улики подтверждают / опровергают друг друга
 *  - Динамическая уверенность (confidence) обновляется по итогам тестов
 *  - Деградация: у некоторых улик вводится флаг деградации
 *  - Ложные следы из чужих типов преступлений
 *  - Симуляция ошибок лаборатории (4 типа)
 *  - Рекомендательные цепочки тестов
 *  - Подробные экспертные заключения с нарративом
 */
export class AdvancedEvidenceSystem {

    // ─── Публичный API ────────────────────────────────────────────────────────

    /**
     * Генерирует набор улик для дела.
     * @param {Object} scenario  — сценарий от CaseGenerator
     * @param {number} complexity — 0..1
     * @param {string} crimeType  — тип преступления
     * @returns {Array} массив объектов улик
     */
    static generate(scenario, complexity = 0.5, crimeType = 'theft') {
        // 🔥 Если есть граф событий — генерируем улики из него + дополняем из пула
        const graphEvidence = scenario.graph
            ? this.generateFromGraph(scenario.graph, scenario.isGuilty)
            : [];

        const pool = EvidenceBycrimeType[crimeType] || EvidenceBycrimeType.theft;
        const vars = this._extractVars(scenario);

        // Количество истинных улик растёт с complexity: 2..5
        const trueCount = Math.min(2 + Math.round(complexity * 3), pool.length);
        const shuffled = this._shuffle([...pool]);
        const trueItems = shuffled.slice(0, trueCount);

        // Количество ложных следов: 0..2 (только на средней/высокой сложности)
        const fakeCount = complexity > 0.5 ? Math.floor(complexity * 2) : 0;
        const fakeItems = this._buildFakeEvidence(scenario, vars, fakeCount, crimeType);

        const all = [...trueItems, ...fakeItems];

        const poolEvidence = all.map((tpl, idx) =>
            this._instantiate(tpl, idx, vars, scenario)
        );

        // Объединяем: сначала улики из графа (самые важные), потом из пула
        const evidenceList = [...graphEvidence, ...poolEvidence];

        // Устанавливаем перекрёстные связи между уликами
        this._buildRelationships(evidenceList, scenario);

        return evidenceList;
    }

    /**
     * 🔥 НОВЫЙ МЕТОД: генерирует улики напрямую из узлов EventGraph.
     * Каждая улика имеет ссылку nodeId → можно соотносить с показаниями.
     * @param {{ nodes: Node[], edges: Edge[] }} graph
     * @param {boolean} isGuilty
     * @returns {Array} улики с nodeId
     */
    static generateFromGraph(graph, isGuilty) {
        const { EventGraphEngine } = this._getEGE();
        const result = [];
        let idx = 0;

        for (const node of graph.nodes) {
            const templates = EventGraphEngine.evidenceForNode(node);

            for (const tpl of templates) {
                // Если подозреваемый невиновен — не создаём улики, указывающие на него
                // (улики от crime_action и presence с actor=unknown ненадёжны)
                const skip = !isGuilty
                    && ['crime_action', 'presence'].includes(node.type)
                    && Math.random() < 0.5;
                if (skip) continue;

                result.push({
                    id:            `EG-${node.type.slice(0,3).toUpperCase()}-${idx++}`,
                    name:          tpl.description,
                    label:         tpl.description,   // ← для CaseView.renderEvidence
                    description:   tpl.description,
                    type:          tpl.type,
                    nodeId:        node.id,         // 🔥 связь с графом
                    nodeType:      node.type,
                    baseReliability: tpl.reliability,
                    confidence:    tpl.reliability,
                    isFake:        false,
                    isFromGraph:   true,             // маркер
                    tests:         [],
                    relations:     [],               // ← унифицировано с pool-уликами (было relationships)
                    chainOfCustody: [{
                        step:      'Фиксация',
                        officer:   'Следователь',
                        timestamp: new Date().toISOString()
                    }],
                });

            }
        }

        return result;
    }

    // Ленивая загрузка EventGraphEngine (избегаем циклического импорта)
    static _getEGE() {
        if (!this.__ege) {
            // EventGraphEngine уже должен быть загружен в CaseGenerator
            // Используем динамический import через глобальный кеш модулей
            this.__ege = { EventGraphEngine: globalThis.__EventGraphEngine };
        }
        return this.__ege;
    }

    /**
     * Выполняет криминалистический тест на улике.
     * @returns {Object} результат теста
     */
    static performTest(evidence, testType) {
        const meta = ForensicTests[testType];
        if (!meta) return { status: 'error', details: 'Тест не найден в базе.' };

        // Проверяем, не выполнялся ли тест ранее
        const alreadyDone = evidence.tests.some(t => t.type === testType);
        if (alreadyDone) {
            return { status: 'duplicate', details: 'Данный тест уже выполнялся. Результат не изменился.' };
        }

        // Проверяем деградацию перед выполнением
        if (evidence.degraded && ['dna_test', 'toxicology_test'].includes(testType)) {
            const r = this._makeResult(testType, meta, 'degraded', 'Биоматериал деградировал — анализ невозможен.', false);
            evidence.tests.push(r);
            this._updateConfidence(evidence);
            return r;
        }

        // Имитация ошибки лаборатории
        const labErr = this._rollLabError();
        if (labErr) {
            const r = this._makeResult(testType, meta, 'inconclusive', labErr.detail, false);
            evidence.tests.push(r);
            this._updateConfidence(evidence);
            return r;
        }

        // Основная логика результата
        const rawReliability = evidence.baseReliability * meta.reliability;
        const isMatch = Math.random() < rawReliability;

        let status, detail;
        if (evidence.isFake) {
            // Ложная улика при высоком качестве теста может быть разоблачена
            const exposed = Math.random() < meta.reliability * 0.7;
            status = exposed ? 'no_match' : 'inconclusive';
            detail = exposed
                ? this._fakeExposedDetail(testType)
                : 'Результат неоднозначен. Образец требует дополнительного изучения.';
        } else if (isMatch) {
            status = 'match';
            detail = this._buildSuccessDetail(testType, evidence);
        } else {
            status = 'inconclusive';
            detail = this._buildInconclusiveDetail(testType);
        }

        const result = this._makeResult(testType, meta, status, detail, true);

        // Добавляем рекомендацию следующего теста
        const chain = TEST_CHAINS[testType];
        if (chain?.suggests && status === 'match') {
            result.recommendation = chain.suggests;
        }

        evidence.tests.push(result);
        this._updateConfidence(evidence);

        // Обновляем перекрёстные связи при получении результата
        this._applyTestToRelations(evidence, result);

        return result;
    }

    // ─── Приватные методы ─────────────────────────────────────────────────────

    /** Создаёт объект улики из шаблона */
    static _instantiate(tpl, idx, vars, scenario) {
        const degraded = tpl.type === 'biological' && Math.random() < 0.1; // 10% биоулик деградированы

        return {
            id: `ev_${idx}_${tpl.id}`,
            type: tpl.type,
            label: tpl.label,
            description: tpl.descFn ? tpl.descFn(vars, scenario) : tpl.label,
            validTests: [...(tpl.validTests || [])],
            baseReliability: tpl.reliabilityBase ?? 0.80,
            isFake: tpl._fake || false,
            degraded,

            // Цепочка хранения
            custody: {
                foundBy: this._pickInvestigator(),
                foundAt: `${scenario.location || vars.location}, ${vars.timeFrom}`,
                condition: degraded ? 'деградировало' : this._pickCondition()
            },

            // Динамическая уверенность (0..1)
            confidence: 0.5,

            // Перекрёстные связи  [{ targetId, type: 'confirms'|'contradicts' }]
            relations: [],

            // История тестов
            tests: [],

            // Метка игрока
            playerMark: null
        };
    }

    /** Извлекает переменные из сценария в унифицированную форму */
    static _extractVars(scenario) {
        return {
            victimName: scenario.victimName || 'Потерпевший',
            orgName: scenario.orgName || 'Организация',
            location: scenario.location || 'место происшествия',
            timeFrom: scenario.time || '12:00',
            timeTo: scenario.timeTo || '18:00',
            amount: scenario.amount || '100'
        };
    }

    /** Генерирует ложные улики из пула другого типа преступления */
    static _buildFakeEvidence(scenario, vars, count, crimeType) {
        if (count === 0) return [];
        const otherTypes = Object.keys(EvidenceBycrimeType).filter(t => t !== crimeType);
        return Array.from({ length: count }, () => {
            const rType = otherTypes[Math.floor(Math.random() * otherTypes.length)];
            const pool = EvidenceBycrimeType[rType];
            const tpl = pool[Math.floor(Math.random() * pool.length)];
            return {
                ...tpl,
                id: tpl.id + '_planted',
                label: tpl.label + ' (неустановленный источник)',
                descFn: () => `Предмет обнаружен вблизи ${vars.location}. Связь с делом под вопросом. Источник происхождения устанавливается.`,
                reliabilityBase: 0.35 + Math.random() * 0.25,
                _fake: true
            };
        });
    }

    /** Устанавливает перекрёстные связи между уликами */
    static _buildRelationships(list, scenario) {
        // Биологические и физические могут взаимоподтверждаться
        const biological = list.filter(e => e.type === 'biological' && !e.isFake);
        const physical = list.filter(e => e.type === 'physical' && !e.isFake);
        const digital = list.filter(e => e.type === 'digital' && !e.isFake);

        biological.forEach(bio => {
            physical.forEach(phys => {
                bio.relations.push({ targetId: phys.id, type: 'confirms' });
                phys.relations.push({ targetId: bio.id, type: 'confirms' });
            });
        });

        // Ложные улики противоречат истинным
        list.filter(e => e.isFake).forEach(fake => {
            const trueEv = list.filter(e => !e.isFake && e.type === fake.type);
            trueEv.forEach(te => {
                fake.relations.push({ targetId: te.id, type: 'contradicts' });
            });
        });
    }

    /** Обновляет уверенность улики по результатам тестов */
    static _updateConfidence(evidence) {
        if (evidence.tests.length === 0) return;
        const scores = evidence.tests.map(t => {
            if (t.status === 'match') return 1.0;
            if (t.status === 'no_match') return 0.0;
            if (t.status === 'inconclusive') return 0.5;
            return 0.5;
        });
        evidence.confidence = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    /** Обновляет перекрёстные связи после теста */
    static _applyTestToRelations(evidence, result) {
        if (result.status === 'no_match' && !evidence.isFake) {
            // Позитивная улика дала обратный результат — добавляем противоречие
            evidence.relations.push({ targetId: '__scenario__', type: 'contradicts' });
        }
    }

    /** Бросок кубика на ошибку лаборатории */
    static _rollLabError() {
        for (const err of LAB_ERRORS) {
            if (Math.random() < err.prob) return err;
        }
        return null;
    }

    /** Создаёт объект результата теста */
    static _makeResult(testType, meta, status, details, isReliable) {
        return {
            type: testType,
            name: meta.name,
            timestamp: Date.now(),
            status,
            details,
            isReliable,
            cost: meta.cost,
            time: meta.time
        };
    }

    // ─── Генерация текстов результатов ───────────────────────────────────────

    static _buildSuccessDetail(testType, ev) {
        const narratives = {
            fingerprint_test: [
                'Совпадение по 14 из 16 маркеров. Идентифицированы как отпечатки подозреваемого.',
                'Три полных отпечатка принадлежат одному лицу, совпадают с картотекой МВД.',
            ],
            dna_test: [
                'ДНК-профиль совпадает с образцом подозреваемого (99.97%). Вероятность случайного совпадения: 1 из 6 млрд.',
                'Аутентификация по 20 локусам подтверждает принадлежность образца подозреваемому.',
            ],
            ballistic_test: [
                'Нарезка ствола и следы бойка соответствуют оружию из картотеки. Оружие зарегистрировано на связанное лицо.',
                'Пуля выпущена из пистолета модели ПМ, серийный номер уточняется. Возможна связь с подозреваемым.',
            ],
            toxicology_test: [
                'Обнаружен этанол (2.4 промилле) и следы барбитуратов. Соответствует версии отравления.',
                'Присутствие яда группы антихолинэстераз подтверждено. Концентрация летальная.',
            ],
            handwriting_analysis: [
                'Почерк (84% совпадение) идентичен образцу подозреваемого. 12 характерных элементов совпадают.',
                'Подпись выполнена рукой подозреваемого: нажим, наклон и форма букв характерны.',
            ],
            metadata_analysis: [
                'Метаданные не изменялись. Геолокация совпадает с местом преступления ±50 м. Время точное.',
                'IP-адрес зафиксирован в сети поблизости от места преступления в указанное время.',
            ],
            image_authentication: [
                'Видео подлинное. Монтаж не обнаружен. Лицевые маркеры совпадают с фото подозреваемого на 79%.',
                'EXIF-данные и временной штамп камеры соответствуют дате преступления. Изображение не ретушировано.',
            ],
            document_forgery: [
                'Чернила датируются позднее указанной даты. Подпись — качественное факсимиле.',
                'Цифровая печать не соответствует периоду, обозначенному в тексте. Документ изготовлен позже.',
            ]
        };
        const options = narratives[testType] || ['Результат подтверждает версию обвинения.'];
        return options[Math.floor(Math.random() * options.length)];
    }

    static _buildInconclusiveDetail(testType) {
        const options = [
            'Образец частично пригоден для анализа. Результат не является однозначным.',
            'Качество материала недостаточно для формирования заключения.',
            'Тест дал пограничный результат. Рекомендуется повторное исследование в другой лаборатории.',
        ];
        return options[Math.floor(Math.random() * options.length)];
    }

    static _fakeExposedDetail(testType) {
        const map = {
            fingerprint_test: 'Отпечатки принадлежат третьему лицу — не подозреваемому. Улика могла быть подброшена.',
            dna_test: 'ДНК-профиль не совпадает с образцом подозреваемого. Возможна фальсификация.',
            handwriting_analysis: 'Подпись выполнена не рукой подозреваемого. Документ мог быть подделан другим лицом.',
            metadata_analysis: 'Метаданные изменены. Геолокация и временная метка сфабрикованы.',
            image_authentication: 'Видео отредактировано: обнаружены следы монтажа. Свидетельство ненадёжно.',
        };
        return map[testType] || 'Доказательство не относится к делу. Возможна подброска.';
    }

    // ─── Вспомогательные ─────────────────────────────────────────────────────

    static _pickInvestigator() {
        const names = ['ст. следователь Карпов Д.В.', 'эксперт Волкова М.С.', 'инсп. Тарасов П.Г.', 'крим. Ефремова Р.В.'];
        return names[Math.floor(Math.random() * names.length)];
    }

    static _pickCondition() {
        const states = ['удовлетворительное', 'хорошее', 'частично повреждено', 'нетронутое'];
        return states[Math.floor(Math.random() * states.length)];
    }

    static _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}
