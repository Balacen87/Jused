/**
 * WitnessAgentSystem — полная система автономного свидетеля.
 *
 * Архитектура:
 *   EventGraph → PerceptionEngine → MemoryEngine → MotivationEngine
 *               → TestimonyEngine → BehaviorEngine
 *
 * Все движки — чистые статические классы, работают с объектом Witness.
 */

// ──────────────────────────────────────────────────────────────────────────────
// АРХЕТИПЫ
// ──────────────────────────────────────────────────────────────────────────────

export const WitnessArchetypes = {
    honest: {
        label: 'Честный свидетель',
        personality: { honesty: 0.90, courage: 0.65, anxiety: 0.30, empathy: 0.70, impulsivity: 0.25 },
        motivation:  { protectDefendant: 0.05, fearOfPunishment: 0.20, desireToHelp: 0.85, selfPreservation: 0.35 },
        memory:      { accuracy: 0.75, decayRate: 0.012 }
    },
    liar_protector: {
        label: 'Защитник',
        personality: { honesty: 0.20, courage: 0.55, anxiety: 0.60, empathy: 0.80, impulsivity: 0.40 },
        motivation:  { protectDefendant: 0.90, fearOfPunishment: 0.50, desireToHelp: 0.30, selfPreservation: 0.60 },
        memory:      { accuracy: 0.65, decayRate: 0.018 }
    },
    nervous: {
        label: 'Нервный свидетель',
        personality: { honesty: 0.60, courage: 0.25, anxiety: 0.90, empathy: 0.55, impulsivity: 0.65 },
        motivation:  { protectDefendant: 0.20, fearOfPunishment: 0.75, desireToHelp: 0.50, selfPreservation: 0.80 },
        memory:      { accuracy: 0.50, decayRate: 0.025 }
    },
    confident_liar: {
        label: 'Уверенный лжец',
        personality: { honesty: 0.15, courage: 0.85, anxiety: 0.20, empathy: 0.25, impulsivity: 0.35 },
        motivation:  { protectDefendant: 0.70, fearOfPunishment: 0.15, desireToHelp: 0.10, selfPreservation: 0.75 },
        memory:      { accuracy: 0.80, decayRate: 0.008 }
    },
    traumatized: {
        label: 'Травмированный',
        personality: { honesty: 0.75, courage: 0.20, anxiety: 0.85, empathy: 0.60, impulsivity: 0.55 },
        motivation:  { protectDefendant: 0.10, fearOfPunishment: 0.65, desireToHelp: 0.40, selfPreservation: 0.90 },
        memory:      { accuracy: 0.40, decayRate: 0.035 }
    },
};

// ──────────────────────────────────────────────────────────────────────────────
// PERCEPTION ENGINE
// ──────────────────────────────────────────────────────────────────────────────

export class WitnessPerceptionEngine {

    /**
     * Вычисляет что именно свидетель воспринял из события EventGraph.
     * @param {Object} witness
     * @param {Object} eventNode — узел EventGraph { id, time, type, location }
     * @returns {Object|null} — null если не воспринял
     */
    static perceive(witness, eventNode) {
        const visibility = WitnessPerceptionEngine._computeVisibility(witness, eventNode);
        const attention  = 0.3 + Math.random() * 0.7;
        const perceived  = visibility * attention;

        if (perceived < 0.18) return null;     // не заметил вообще

        return {
            nodeId:    eventNode.id,
            nodeType:  eventNode.type,
            clarity:   Math.min(1, perceived),
            partial:   perceived < 0.55,
            distorted: perceived < 0.40,
            perceivedTime: eventNode.time ?? null,
        };
    }

    /**
     * Воспринимает все наблюдаемые узлы EventGraph и записывает в witness.memoryMap.
     */
    static perceiveAll(witness, eventGraph) {
        const nodes = eventGraph?.nodes ?? [];
        const observedIds = new Set(witness.observedNodes ?? []);

        for (const node of nodes) {
            if (!observedIds.has(node.id)) continue;
            const perception = WitnessPerceptionEngine.perceive(witness, node);
            if (perception) {
                WitnessMemoryEngine.encode(witness, perception);
            }
        }
    }

    static _computeVisibility(witness, node) {
        const accuracy = witness.memory?.accuracy ?? 0.5;
        const anxiety  = witness.personality?.anxiety ?? 0.5;
        // Тревожные люди хуже запоминают под стрессом
        const stressPenalty = witness.state?.stress * 0.15 ?? 0;
        return Math.min(1, accuracy * 0.7 + (1 - anxiety) * 0.2 + Math.random() * 0.2 - stressPenalty);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// MEMORY ENGINE
// ──────────────────────────────────────────────────────────────────────────────

export class WitnessMemoryEngine {

    /** Кодирует восприятие в долгосрочную память */
    static encode(witness, perception) {
        if (!perception) return;
        if (!witness.memoryMap) witness.memoryMap = new Map();

        witness.memoryMap.set(perception.nodeId, {
            nodeId:       perception.nodeId,
            nodeType:     perception.nodeType,
            clarity:      perception.clarity,
            timestamp:    Date.now(),
            perceivedTime:perception.perceivedTime,
            distortions:  perception.distorted ? ['initial_blur'] : [],
            confidence:   perception.clarity,
            partial:      perception.partial,
        });
    }

    /**
     * Воспроизводит воспоминание с учётом деградации и давления.
     * @returns {Object|null}
     */
    static recall(witness, nodeId) {
        const mem = witness.memoryMap?.get(nodeId);
        if (!mem) return null;

        const decayRate = witness.memory?.decayRate ?? 0.01;
        const stress    = witness.state?.stress ?? 0;

        // Время прошло — деградация
        const timePassed = (Date.now() - mem.timestamp) / 1000;
        const decay = timePassed * decayRate;

        // Стресс ухудшает воспроизведение
        const stressNoise = stress * 0.20;
        let clarity = Math.max(0, mem.clarity - decay - stressNoise + (Math.random() * 0.06 - 0.03));

        // Накапливаем искажения
        if (clarity < 0.5 && !mem.distortions.includes('blur'))   mem.distortions.push('blur');
        if (clarity < 0.3 && !mem.distortions.includes('fill'))   mem.distortions.push('fill');  // выдумывает детали

        return {
            nodeId,
            clarity:    Math.min(1, Math.max(0, clarity)),
            distorted:  clarity < 0.40,
            distortions:mem.distortions,
            confidence: mem.confidence,
            partial:    mem.partial,
            perceivedTime: mem.perceivedTime,
        };
    }

    /** Искажает всю память под сильным стрессом (вызывается BehaviorEngine) */
    static applyStressDistortion(witness, stressDelta) {
        if (!witness.memoryMap) return;
        for (const [id, mem] of witness.memoryMap.entries()) {
            mem.clarity = Math.max(0, mem.clarity - stressDelta * 0.15);
            if (stressDelta > 0.3 && !mem.distortions.includes('stress_blur')) {
                mem.distortions.push('stress_blur');
            }
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// MOTIVATION ENGINE
// ──────────────────────────────────────────────────────────────────────────────

export class WitnessMotivationEngine {

    /**
     * Решает — говорить ли правду по данному узлу.
     * @returns {boolean} true = правда
     */
    static decideTruth(witness, nodeId) {
        const p = witness.personality;
        const m = witness.motivation;
        const s = witness.state?.stress ?? 0;

        const truthScore =
            (p?.honesty   ?? 0.5) * 0.45 +
            (m?.desireToHelp ?? 0.5) * 0.25 +
            (1 - (m?.fearOfPunishment ?? 0.5)) * 0.15 +
            (1 - (m?.selfPreservation ?? 0.5)) * 0.15;

        const lieScore =
            (m?.protectDefendant   ?? 0) * 0.40 +
            (m?.fearOfPunishment   ?? 0) * 0.25 +
            (m?.selfPreservation   ?? 0) * 0.20 +
            s * 0.15;

        // Нравственный конфликт — лжец под давлением всё равно может сорваться
        const moralSlip = (p?.empathy ?? 0.5) * s * 0.15;

        return (truthScore + moralSlip) >= lieScore;
    }

    /**
     * Вычисляет уровень мотивационного конфликта (0..1).
     * Чем выше — тем быстрее свидетель ломается.
     */
    static moralConflict(witness) {
        const protects = witness.motivation?.protectDefendant ?? 0;
        const honesty  = witness.personality?.honesty ?? 0.5;
        return Math.min(1, protects * honesty * 1.5);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// TESTIMONY GENERATOR
// ──────────────────────────────────────────────────────────────────────────────

export class WitnessTestimonyEngine {

    /**
     * Генерирует показание для узла EventGraph.
     * @param {Object} witness
     * @param {Object} node — { id, type, time, label }
     * @returns {Object|null} Testimony
     */
    static generate(witness, node) {
        const memory = WitnessMemoryEngine.recall(witness, node.id);
        if (!memory) return null;

        const isTruth = WitnessMotivationEngine.decideTruth(witness, node.id);
        const text    = isTruth
            ? WitnessTestimonyEngine._truthText(node, memory, witness)
            : WitnessTestimonyEngine._lieText(node, memory, witness);

        const testimony = {
            id:         `t_${node.id}_${Date.now()}`,
            nodeId:     node.id,
            nodeType:   node.type,
            text,
            type:       isTruth ? 'true' : 'lie',
            confidence: memory.clarity,
            memory,
            versions:   [],
            revisions:  [],
        };

        // Инициализируем версию
        testimony.versions.push({ step: 0, text, type: testimony.type, trigger: 'initial', changeType: 'initial' });

        if (!witness.testimonies) witness.testimonies = [];
        witness.testimonies.push(testimony);

        return testimony;
    }

    /** Генерирует показания для всех наблюдаемых узлов */
    static generateAll(witness, eventGraph) {
        const nodes       = eventGraph?.nodes ?? [];
        const observedIds = new Set(witness.observedNodes ?? []);
        const results     = [];

        for (const node of nodes) {
            if (!observedIds.has(node.id)) continue;
            const t = WitnessTestimonyEngine.generate(witness, node);
            if (t) results.push(t);
        }
        return results;
    }

    static _truthText(node, memory, witness) {
        const time = memory.perceivedTime ?? node.time ?? 'неизвестное время';
        const qual = memory.clarity > 0.7
            ? 'Я отчётливо видел'
            : memory.clarity > 0.45
            ? 'Насколько я помню'
            : 'Точно не уверен, но мне кажется';

        const distortion = memory.distortions.includes('blur')
            ? ' — детали немного размыты в памяти'
            : '';

        return `${qual}: событие (${node.label ?? node.type}) произошло около ${time}${distortion}.`;
    }

    static _lieText(node, memory, witness) {
        const protect = witness.motivation?.protectDefendant ?? 0;
        if (protect > 0.6) {
            return `Я ничего подобного не видел. Это могло произойти в другое время — я не присутствовал рядом.`;
        }
        const time = memory.perceivedTime ?? node.time ?? 'вечером';
        return `Я не уверен — кажется, это было позже, не в то время, о котором идёт речь. Может, около ${time}, но я мог спутать.`;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// BEHAVIOR ENGINE  (реакция на допросе)
// ──────────────────────────────────────────────────────────────────────────────

export class WitnessBehaviorEngine {

    /**
     * Применяет давление допроса к состоянию свидетеля.
     * Мутирует witness.state.
     * @param {Object} witness
     * @param {number} pressureDelta — рост давления (0..1)
     * @returns {'stable'|'nervous'|'unstable'|'breakdown'}
     */
    static react(witness, pressureDelta) {
        if (!witness.state) witness.state = { stress: 0, trust: 0.5, fatigue: 0 };

        const anxiety    = witness.personality?.anxiety    ?? 0.5;
        const tolerance  = witness.personality?.courage    ?? 0.5;
        const amplified  = pressureDelta * (1 + anxiety * 0.5 - tolerance * 0.3);

        witness.state.stress  = Math.min(1, witness.state.stress + amplified);
        witness.state.fatigue = Math.min(1, witness.state.fatigue + pressureDelta * 0.4);

        // Стресс искажает память
        if (amplified > 0.1) {
            WitnessMemoryEngine.applyStressDistortion(witness, amplified);
        }

        // Логируем поведение
        if (!witness.behaviorLog) witness.behaviorLog = [];
        witness.behaviorLog.push({
            at: Date.now(),
            pressureDelta,
            stress: witness.state.stress,
            stage: WitnessBehaviorEngine.stage(witness),
        });

        return WitnessBehaviorEngine.stage(witness);
    }

    static stage(witness) {
        const s = witness.state?.stress ?? 0;
        if (s > 0.82) return 'breakdown';
        if (s > 0.60) return 'unstable';
        if (s > 0.35) return 'nervous';
        return 'stable';
    }

    static STAGE_LABELS = {
        stable:    { label: 'Спокоен',   color: '#22c55e', icon: '😐' },
        nervous:   { label: 'Нервничает',color: '#f59e0b', icon: '😰' },
        unstable:  { label: 'Нестабилен',color: '#f97316', icon: '😱' },
        breakdown: { label: 'Сломан',    color: '#ef4444', icon: '💥' },
    };
}
