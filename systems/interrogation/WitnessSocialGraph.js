/**
 * WitnessSocialGraph — социальная сеть свидетелей.
 *
 * Реализует:
 *   - Граф отношений (trust, influence)
 *   - Распространение влияния (InfluencePropagation)
 *   - Распространение лжи (LiePropagation)
 *   - Скрытые знания (HiddenKnowledge)
 *   - Социальное давление допроса (SocialPressure)
 *   - Кластеры показаний (ClusterEngine)
 */

// ──────────────────────────────────────────────────────────────────────────────
// ТИПЫ ОТНОШЕНИЙ
// ──────────────────────────────────────────────────────────────────────────────

export const RELATION_TYPES = {
    friend:      { label: 'Друг',        trust: 0.70, influence: 0.60, icon: '🤝' },
    family:      { label: 'Родственник', trust: 0.90, influence: 0.80, icon: '👨‍👩‍👧' },
    colleague:   { label: 'Коллега',     trust: 0.55, influence: 0.45, icon: '💼' },
    stranger:    { label: 'Незнакомец',  trust: 0.20, influence: 0.10, icon: '👤' },
    enemy:       { label: 'Враг',        trust:-0.50, influence: 0.35, icon: '⚔️' },
    accomplice:  { label: 'Сообщник',    trust: 0.95, influence: 0.95, icon: '🤫' },
    authority:   { label: 'Авторитет',   trust: 0.80, influence: 0.90, icon: '👮' },
    romantic:    { label: 'Партнёр',     trust: 0.85, influence: 0.75, icon: '❤️' },
};

// ──────────────────────────────────────────────────────────────────────────────
// ГРАФ
// ──────────────────────────────────────────────────────────────────────────────

export class WitnessSocialGraph {
    constructor() {
        this.nodes = new Map(); // witnessId → witness
        this.edges = [];        // { from, to, type, trust, influence }
    }

    addWitness(witness) {
        this.nodes.set(witness.id, witness);
        return this;
    }

    addRelation(fromId, toId, relationType = 'stranger') {
        const rel = RELATION_TYPES[relationType] ?? RELATION_TYPES.stranger;
        this.edges.push({ from: fromId, to: toId, type: relationType, trust: rel.trust, influence: rel.influence });
        return this;
    }

    getRelations(witnessId) {
        return this.edges.filter(e => e.from === witnessId || e.to === witnessId);
    }

    getNeighbors(witnessId) {
        return this.getRelations(witnessId).map(e => ({
            witness:  this.nodes.get(e.from === witnessId ? e.to : e.from),
            edge:     e,
        })).filter(n => n.witness);
    }

    /** Сводка для UI */
    summary() {
        return {
            witnessCount:  this.nodes.size,
            edgeCount:     this.edges.length,
            accomplices:   this.edges.filter(e => e.type === 'accomplice').length,
            families:      this.edges.filter(e => e.type === 'family').length,
        };
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// INFLUENCE ENGINE
// ──────────────────────────────────────────────────────────────────────────────

export class WitnessInfluenceEngine {

    /**
     * Распространяет влияние по всем рёбрам графа.
     * Вызывать после генерации всех показаний.
     */
    static propagate(graph) {
        for (const edge of graph.edges) {
            const w1 = graph.nodes.get(edge.from);
            const w2 = graph.nodes.get(edge.to);
            if (!w1 || !w2) continue;
            WitnessInfluenceEngine._influencePair(w1, w2, edge);
        }
    }

    static _influencePair(w1, w2, edge) {
        const inf = edge.influence;

        // Согласование показаний по общим узлам
        if (Math.random() < inf * 0.55) {
            WitnessInfluenceEngine._alignTestimonies(w1, w2, inf);
        }

        // Стресс от враждебных отношений
        if (edge.type === 'enemy') {
            w1.state = w1.state ?? { stress: 0, fatigue: 0, trust: 0.5 };
            w2.state = w2.state ?? { stress: 0, fatigue: 0, trust: 0.5 };
            w1.state.stress = Math.min(1, (w1.state.stress ?? 0) + 0.08);
            w2.state.stress = Math.min(1, (w2.state.stress ?? 0) + 0.08);
        }

        // Давление авторитета
        if (edge.type === 'authority') {
            w1.state = w1.state ?? { stress: 0, fatigue: 0, trust: 0.5 };
            w1.state.stress = Math.min(1, (w1.state.stress ?? 0) + 0.15);
        }
    }

    static _alignTestimonies(w1, w2, influence) {
        const t1s = w1.testimonies ?? [];
        const t2s = w2.testimonies ?? [];
        for (const t1 of t1s) {
            const t2 = t2s.find(t => t.nodeId === t1.nodeId);
            if (!t2) continue;
            if (Math.random() < influence * 0.5) {
                t2.aligned = true;
                t2.alignedWith = w1.id;
                // частичное согласование — не копируем текст, только тип
                if (Math.random() < 0.45) t2.type = t1.type;
            }
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// LIE PROPAGATION ENGINE
// ──────────────────────────────────────────────────────────────────────────────

export class LiePropagationEngine {

    /**
     * Распространяет ложь по рёбрам типа friend/accomplice/family.
     * Создаёт «кластеры лжи» — несколько свидетелей с одинаковой версией.
     */
    static propagate(graph) {
        const contagious = ['friend', 'accomplice', 'family', 'romantic'];
        for (const edge of graph.edges) {
            if (!contagious.includes(edge.type)) continue;
            const w1 = graph.nodes.get(edge.from);
            const w2 = graph.nodes.get(edge.to);
            if (!w1 || !w2) continue;

            for (const t1 of (w1.testimonies ?? [])) {
                if (t1.type !== 'lie') continue;
                if (Math.random() < edge.influence * 0.7) {
                    LiePropagationEngine._copyLie(w2, t1, w1.id);
                }
            }
        }
    }

    static _copyLie(targetWitness, srcTestimony, sourceId) {
        const existing = (targetWitness.testimonies ?? []).find(t => t.nodeId === srcTestimony.nodeId);
        if (!existing) return;
        const prevType = existing.type;
        existing.text      = srcTestimony.text;
        existing.type      = 'lie';
        existing.lieSource = sourceId;
        existing.revisions = existing.revisions ?? [];
        existing.revisions.push({
            at: Date.now(), oldText: existing.text, newText: srcTestimony.text,
            oldType: prevType, newType: 'lie', reason: 'social_lie_propagation'
        });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// HIDDEN KNOWLEDGE ENGINE
// ──────────────────────────────────────────────────────────────────────────────

export class HiddenKnowledgeEngine {

    /** Случайно назначает скрытые знания из узлов графа (30% шанс на узел) */
    static assign(witness, graphNodes) {
        witness.hiddenKnowledge = [];
        for (const node of (graphNodes ?? [])) {
            if (Math.random() < 0.30) {
                witness.hiddenKnowledge.push(node.id);
            }
        }
    }

    /**
     * Попытка раскрыть скрытое знание под давлением.
     * @returns {boolean} true = раскрыто
     */
    static reveal(witness, nodeId, pressureTotal = 0) {
        if (!(witness.hiddenKnowledge ?? []).includes(nodeId)) return false;
        const honesty  = witness.personality?.honesty  ?? 0.5;
        const courage  = witness.personality?.courage  ?? 0.5;
        const threshold = honesty * 0.6 + pressureTotal * 0.4;
        return Math.random() < threshold;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// SOCIAL PRESSURE ENGINE  (допрос → другие свидетели)
// ──────────────────────────────────────────────────────────────────────────────

export class SocialPressureEngine {

    /**
     * Применяет эффект допроса одного свидетеля на остальных в сети.
     * Вызывать после каждого значимого ответа на допросе.
     *
     * @param {WitnessSocialGraph} graph
     * @param {Object} interrogatedWitness
     * @param {Object} answerEvent — из InterrogationDirector.ask()
     */
    static applyFromInterrogation(graph, interrogatedWitness, answerEvent) {
        const relations = graph.getRelations(interrogatedWitness.id);
        const broke     = answerEvent?.responseType === 'full_admission';
        const stressed  = (interrogatedWitness.state?.stress ?? 0) > 0.65;

        for (const rel of relations) {
            const otherId = rel.from === interrogatedWitness.id ? rel.to : rel.from;
            const other   = graph.nodes.get(otherId);
            if (!other) continue;

            other.state = other.state ?? { stress: 0, fatigue: 0, trust: 0.5 };

            // Слом одного — паника у связанных
            if (broke) {
                other.state.stress = Math.min(1, other.state.stress + rel.influence * 0.30);
            } else if (stressed) {
                other.state.stress = Math.min(1, other.state.stress + rel.influence * 0.12);
            }

            // Враги радуются чужому краху — их давление снижается
            if (rel.type === 'enemy' && broke) {
                other.state.stress = Math.max(0, other.state.stress - 0.10);
            }
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// CLUSTER ENGINE
// ──────────────────────────────────────────────────────────────────────────────

export class WitnessClusterEngine {

    /**
     * Находит кластеры доверяющих друг другу свидетелей (DFS по trust > 0.5).
     * @returns {Array<string[]>} массив кластеров (id свидетелей)
     */
    static findClusters(graph) {
        const clusters = [];
        const visited  = new Set();

        for (const w of graph.nodes.values()) {
            if (visited.has(w.id)) continue;
            const cluster = [];
            const stack   = [w];

            while (stack.length) {
                const curr = stack.pop();
                if (visited.has(curr.id)) continue;
                visited.add(curr.id);
                cluster.push(curr.id);

                for (const { witness: neighbor, edge } of graph.getNeighbors(curr.id)) {
                    if (edge.trust > 0.5) stack.push(neighbor);
                }
            }
            if (cluster.length) clusters.push(cluster);
        }
        return clusters;
    }

    /**
     * Находит «ядро лжи» — свидетелей с максимальным количеством lie-показаний в сообщниках.
     */
    static findLieCore(graph) {
        const lieScore = new Map();
        for (const [id, w] of graph.nodes.entries()) {
            const lies = (w.testimonies ?? []).filter(t => t.type === 'lie').length;
            lieScore.set(id, lies);
        }
        return [...lieScore.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    }
}
