// ─── EventGraphEngine.js ────────────────────────────────────────────────────
// Граф событий: строит цепочку узлов (nodes) и связей (edges),
// которая является ЕДИНОЙ истиной о произошедшем для всей игры.
// Свидетели, улики и вердикт — каждый ссылается на конкретные nodes.

export class EventGraphEngine {

    /**
     * Основной метод — строит граф для конкретного дела.
     * @param {Object} crime    — запись из CRIME_CATALOG
     * @param {Object} vars     — переменные (location, victimName, orgName, ...)
     * @param {boolean} isGuilty — виновен ли подозреваемый
     * @param {string} method   — метод совершения преступления
     * @param {string} motive   — мотив
     * @returns {{ nodes: Node[], edges: Edge[], timeline: TimelineEntry[] }}
     */
    static build(crime, vars, isGuilty, method, motive) {
        const nodes = [];
        const edges = [];
        const timeline = [];

        // ── 1. Подготовка ──────────────────────────────────────────────────
        const nPrep = this._node('preparation', {
            actor:       isGuilty ? 'suspect' : 'unknown',
            location:    this._nearbyLocation(vars.location),
            time:        vars.timeFrom,
            description: isGuilty
                ? `Подозреваемый готовился: изучал ${vars.location}, выбирал момент`
                : `Неустановленное лицо готовилось к преступлению`,
            visibility:  0.2 + Math.random() * 0.3  // низкая видимость — мало свидетелей
        });

        // ── 2. Присутствие на месте ────────────────────────────────────────
        const nPresence = this._node('presence', {
            actor:       isGuilty ? 'suspect' : 'unknown',
            location:    vars.location,
            time:        vars.timeFrom,
            description: isGuilty
                ? `Подозреваемый замечен в ${vars.location} около ${vars.timeFrom}`
                : `Другой человек (схожее описание) замечен у ${vars.location}`,
            visibility:  0.5 + Math.random() * 0.4  // высокая — ключевой момент
        });

        // ── 3. Основное действие ───────────────────────────────────────────
        const nAction = this._node('crime_action', {
            actor:       isGuilty ? 'suspect' : 'unknown',
            method,
            motive,
            target:      'victim',
            location:    vars.location,
            time:        vars.timeFrom,
            description: `Совершено: «${method}». Затронут: ${vars.victimName}`,
            visibility:  isGuilty ? 0.3 + Math.random() * 0.5 : 0.1
        });

        // ── 4. Побег / выход ───────────────────────────────────────────────
        const nEscape = this._node('escape', {
            actor:       isGuilty ? 'suspect' : 'unknown',
            location:    vars.location,
            time:        vars.timeTo,
            method:      'leave_scene',
            description: isGuilty
                ? `Подозреваемый срочно покинул место (зафиксирован GPS/камера)`
                : `Неустановленный нарушитель скрылся — следы вели в другом направлении`,
            visibility:  0.3 + Math.random() * 0.4
        });

        // ── 5. Алиби-событие (для невиновного — реальное) ────────────────
        let nAlibi = null;
        if (!isGuilty) {
            nAlibi = this._node('alibi_event', {
                actor:       'suspect',
                location:    this._nearbyLocation(vars.location),
                time:        vars.timeFrom,
                description: `Подозреваемый в то же время находился в другом месте — есть подтверждение`,
                visibility:  0.6 + Math.random() * 0.3
            });
        }

        // ── 6. Обнаружение последствий ─────────────────────────────────────
        const nDiscovery = this._node('discovery', {
            actor:       'first_responder',
            location:    vars.location,
            time:        vars.timeTo,
            description: `Последствия преступления обнаружены, вызвана полиция`,
            visibility:  0.95  // всегда известный факт
        });

        // ── Добавляем всё ──────────────────────────────────────────────────
        nodes.push(nPrep, nPresence, nAction, nEscape, nDiscovery);
        if (nAlibi) nodes.push(nAlibi);

        // ── Связи между узлами ─────────────────────────────────────────────
        edges.push(
            { from: nPrep.id,      to: nPresence.id, type: 'leads_to' },
            { from: nPresence.id,  to: nAction.id,   type: 'leads_to' },
            { from: nAction.id,    to: nEscape.id,   type: 'causes'   },
            { from: nEscape.id,    to: nDiscovery.id, type: 'precedes' }
        );
        if (nAlibi) {
            edges.push({ from: nAlibi.id, to: nAction.id, type: 'contradicts' });
        }

        // ── Временная шкала ────────────────────────────────────────────────
        timeline.push(
            { time: vars.timeFrom, nodeId: nPrep.id,      label: 'Начало подготовки' },
            { time: vars.timeFrom, nodeId: nPresence.id,  label: 'Появление у места' },
            { time: vars.timeFrom, nodeId: nAction.id,    label: 'Совершение преступления' },
            { time: vars.timeTo,   nodeId: nEscape.id,    label: 'Уход с места' },
            { time: vars.timeTo,   nodeId: nDiscovery.id, label: 'Обнаружение' }
        );
        if (nAlibi) {
            timeline.push({ time: vars.timeFrom, nodeId: nAlibi.id, label: 'Алиби подозреваемого' });
        }

        return { nodes, edges, timeline };
    }

    /**
     * Генерирует тип улики, которую может оставить узел.
     * Используется в AdvancedEvidenceSystem.
     */
    static evidenceForNode(node) {
        switch (node.type) {
            case 'preparation':
                return [
                    { type: 'surveillance', reliability: 0.5,
                      description: `Камера зафиксировала фигуру рядом с ${node.location}` }
                ];
            case 'presence':
                return [
                    { type: 'camera',       reliability: 0.75 + Math.random() * 0.2,
                      description: `Камера наблюдения зафиксировала присутствие в ${node.location} в ${node.time}` },
                    { type: 'eyewitness',   reliability: 0.4 + Math.random() * 0.4,
                      description: `Очевидец заметил человека в ${node.location}` }
                ];
            case 'crime_action':
                return [
                    { type: 'biological',   reliability: 0.85,
                      description: `Следы биоматериала на месте преступления` },
                    { type: 'physical',     reliability: 0.7 + Math.random() * 0.25,
                      description: `Следы использования метода «${node.method}»` },
                    { type: 'digital',      reliability: 0.6 + Math.random() * 0.35,
                      description: `Цифровой след: GPS/звонки в промежутке` }
                ];
            case 'escape':
                return [
                    { type: 'camera',       reliability: 0.55,
                      description: `Камера зафиксировала быстрый уход с места в ${node.time}` },
                    { type: 'transport',    reliability: 0.5,
                      description: `Транспортная карта / такси в нужном направлении` }
                ];
            case 'alibi_event':
                return [
                    { type: 'receipt',      reliability: 0.9,
                      description: `Чек или транзакция подтверждает нахождение в другом месте` },
                    { type: 'camera',       reliability: 0.8,
                      description: `Камера другого заведения фиксирует подозреваемого` }
                ];
            case 'discovery':
                return [
                    { type: 'police_report', reliability: 0.99,
                      description: `Официальный протокол обнаружения` }
                ];
            default:
                return [];
        }
    }

    /**
     * Описывает узел с точки зрения очевидца (для показаний).
     * @param {Node} node
     * @param {{ memory: { accuracy: number } }} witness
     * @returns {string}
     */
    static describeNodeForWitness(node, witness) {
        const acc = witness.memory?.accuracy ?? 0.5;
        const blur = acc < 0.45;  // плохая память — размытые показания

        switch (node.type) {
            case 'preparation':
                return blur
                    ? `Кажется, я видел кого-то поблизости... Но не уверен.`
                    : `Я заметил человека рядом с ${node.location}, он оглядывался. Это было раньше.`;
            case 'presence':
                return blur
                    ? `Там был человек — не запомнил лицо. Точное время не скажу.`
                    : `Я отчётливо видел: в ${node.time} у ${node.location} стоял человек. Он явно что-то ждал.`;
            case 'crime_action':
                return blur
                    ? `Что-то там происходило, я не разглядел точно.`
                    : `Я видел, как это происходило. Метод был — ${node.method}. Это точно.`;
            case 'escape':
                return blur
                    ? `Кто-то убегал, или просто быстро шёл — не могу сказать.`
                    : `После этого человек стремительно покинул место. Он нервничал.`;
            case 'alibi_event':
                return `Я видел ${node.actor === 'suspect' ? 'этого человека' : 'кого-то'} совсем в другом месте примерно в то же время.`;
            case 'discovery':
                return `Это я обнаружил последствия и сразу вызвал полицию.`;
            default:
                return `Я видел что-то, но не могу точно описать.`;
        }
    }

    // ── Вспомогательные ──────────────────────────────────────────────────

    static _node(type, data) {
        return {
            id: 'N' + Math.random().toString(36).slice(2, 8).toUpperCase(),
            type,
            ...data
        };
    }

    static _nearbyLocation(location) {
        const nearby = {
            'Парк Победы':                      'Двор у парка',
            'Переулок Садовый':                 'Улица Садовая',
            'Торговый центр «Луч»':             'Парковка ТЦ',
            'Автостоянка ул. Ленина':           'Ул. Ленина, дом 5',
            'Подъезд дома №14':                 'Двор дома №12',
            'Ресторан «Берег»':                 'Набережная рядом',
            'Складской комплекс «Маяк»':        'Промышленная зона',
            'Жилой дом на ул. Садовой':         'Ул. Садовая, остановка',
            'Подземный переход ст. Октябрьская':'Сквер у станции',
            'Административное здание №7':       'Площадь перед зданием'
        };
        return nearby[location] ?? `рядом с ${location}`;
    }
}
