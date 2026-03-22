/**
 * ContradictionGraph — граф логических связей между сущностями дела.
 *
 * Архитектура v2 (Graph-driven):
 *   EventGraph.nodes → свидетели → улики → подозреваемый
 *
 * Ноды:  свидетели, улики, события EventGraph, обвиняемый, жертва.
 * Рёбра: confirms | contradicts | corroborates | alibi_supports | alibi_breaks | neutral
 *
 * Используется:
 *  - TrialSimulation для агрегации метрик.
 *  - UI — SVG-визуализация рядом с делом.
 */

/**
 * @typedef {Object} GraphNode
 * @property {string} id
 * @property {string} type ('witness'|'evidence'|'suspect'|'victim'|'event')
 * @property {string} label
 * @property {'low'|'medium'|'high'} riskLevel
 * @property {number} pressure
 */

/**
 * @typedef {Object} GraphEdge
 * @property {string} from
 * @property {string} to
 * @property {string} type
 * @property {string} note
 */

export class ContradictionGraph {

    // ─── Типы рёбер ───────────────────────────────────────────────────────────

    static EDGE_TYPES = {
        confirms:       { label: 'Подтверждает',        color: '#22c55e', dash: false, weight: +1.0 },
        contradicts:    { label: 'Противоречит',        color: '#ef4444', dash: false, weight: -1.0 },
        corroborates:   { label: 'Подкрепляет',         color: '#3b82f6', dash: true,  weight: +0.7 },
        alibi_supports: { label: 'Алиби подтверждено',  color: '#a3e635', dash: true,  weight: +0.8 },
        alibi_breaks:   { label: 'Алиби опровергнуто',  color: '#f97316', dash: false, weight: -0.8 },
        neutral:        { label: 'Связан с делом',      color: '#94a3b8', dash: true,  weight:  0.0 },
    };

    static NODE_TYPES = {
        witness:  { icon: '👤', color: '#6366f1', radius: 26 },
        evidence: { icon: '🔍', color: '#f59e0b', radius: 22 },
        suspect:  { icon: '⚖️', color: '#ef4444', radius: 32 },
        victim:   { icon: '🩸', color: '#64748b', radius: 22 },
        event:    { icon: '📍', color: '#8b5cf6', radius: 18 },
    };

    // ─── Публичный API ────────────────────────────────────────────────────────

    /**
     * Строит граф из данных дела.
     * Использует реальные id из EventGraph, Witness и Evidence.
     * @param {Object} caseData
     * @returns {ContradictionGraph}
     */
    static build(caseData) {
        const graph = new ContradictionGraph();
        graph._buildNodes(caseData);
        graph._buildWitnessEdges(caseData);
        graph._buildEvidenceEdges(caseData);
        graph._buildAutoContradictions(caseData);
        graph._computeScores();
        return graph;
    }

    constructor() {
        /** @type {Map<string, GraphNode>} */
        this.nodes = new Map();
        /** @type {GraphEdge[]} */
        this.edges = [];
    }

    // ─── Вычислительный API ───────────────────────────────────────────────────

    getConsistencyScore() {
        if (this.edges.length === 0) return 0.5;
        const total = this.edges.reduce((sum, e) =>
            sum + (ContradictionGraph.EDGE_TYPES[e.type]?.weight ?? 0), 0);
        const maxPossible = this.edges.length;
        return Math.min(1, Math.max(0, (total + maxPossible) / (2 * maxPossible)));
    }

    /**
     * Давление на узел: инвертированная сумма весов рёбер.
     * Высокое давление = много противоречий вокруг узла.
     * @param {string} nodeId
     * @returns {number}
     */
    getNodePressure(nodeId) {
        if (!this.nodes.has(nodeId)) return 0;
        let p = 0;
        for (const e of this.edges) {
            if (e.from === nodeId || e.to === nodeId) {
                p -= (ContradictionGraph.EDGE_TYPES[e.type]?.weight || 0);
            }
        }
        return p;
    }

    getCriticalContradictions() {
        return this.edges.filter(e => {
            if (e.type !== 'contradicts' && e.type !== 'alibi_breaks') return false;
            return this.getNodePressure(e.from) > 0 && this.getNodePressure(e.to) > 0;
        });
    }

    getSupportClusters() {
        const clusters = [];
        const visited  = new Set();
        const posEdges = this.edges.filter(e =>
            e.type === 'confirms' || e.type === 'corroborates' || e.type === 'alibi_supports'
        );
        const adj = new Map();
        for (const { from, to } of posEdges) {
            if (!adj.has(from)) adj.set(from, []);
            if (!adj.has(to))   adj.set(to,   []);
            adj.get(from).push(to);
            adj.get(to).push(from);
        }
        for (const [nodeId] of this.nodes) {
            if (!visited.has(nodeId) && adj.has(nodeId)) {
                const cluster = [];
                const queue   = [nodeId];
                visited.add(nodeId);
                while (queue.length > 0) {
                    const curr = queue.shift();
                    cluster.push(curr);
                    for (const nb of (adj.get(curr) || [])) {
                        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
                    }
                }
                if (cluster.length > 1) clusters.push(cluster);
            }
        }
        return clusters;
    }

    getNarrativeBreakpoints() {
        const clusters = this.getSupportClusters();
        const breakpoints = [];
        const contradictions = this.edges.filter(e =>
            e.type === 'contradicts' || e.type === 'alibi_breaks'
        );
        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                const c1 = clusters[i], c2 = clusters[j];
                const conflicts = contradictions.filter(e =>
                    (c1.includes(e.from) && c2.includes(e.to)) ||
                    (c1.includes(e.to)   && c2.includes(e.from))
                );
                if (conflicts.length > 0) breakpoints.push({ clusterA: c1, clusterB: c2, conflicts });
            }
        }
        return breakpoints;
    }

    getHighRiskNodes(topN = 3) {
        return [...this.nodes.values()]
            .sort((a, b) => b.pressure - a.pressure)
            .slice(0, topN);
    }

    getStats() {
        const stats = { confirms: 0, contradicts: 0, corroborates: 0, alibi_supports: 0, alibi_breaks: 0, neutral: 0 };
        for (const e of this.edges) stats[e.type] = (stats[e.type] ?? 0) + 1;
        return stats;
    }

    toSnapshot() {
        return {
            consistencyScore:          +this.getConsistencyScore().toFixed(3),
            stats:                     this.getStats(),
            highRiskNodes:             this.getHighRiskNodes(3).map(n => ({ id: n.id, label: n.label, riskLevel: n.riskLevel, pressure: n.pressure })),
            criticalContradictions:    this.getCriticalContradictions().map(e => ({ from: e.from, to: e.to, type: e.type })),
            supportClustersCount:      this.getSupportClusters().length,
            narrativeBreakpointsCount: this.getNarrativeBreakpoints().length,
            nodes: Array.from(this.nodes.values()),
            edges: this.edges.map(e => ({ ...e }))
        };
    }

    // ─── SVG Визуализация ─────────────────────────────────────────────────────

    renderSVG(container, { width = 440, height = 320 } = {}) {
        const nodeList = [...this.nodes.values()];
        if (nodeList.length === 0) {
            container.innerHTML = '<p style="color:#94a3b8;font-size:12px;text-align:center;">Граф пуст</p>';
            return;
        }

        const cx = width / 2;
        const cy = height / 2;
        const R  = Math.min(cx, cy) - 50;

        // Подозреваемый в центре, остальные по кругу
        const suspectNode = this.nodes.get('suspect');
        const ringNodes   = nodeList.filter(n => n.id !== 'suspect');
        if (suspectNode) { suspectNode._x = cx; suspectNode._y = cy; }
        ringNodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / ringNodes.length - Math.PI / 2;
            node._x = cx + R * Math.cos(angle);
            node._y = cy + R * Math.sin(angle);
        });

        const svgLines = this.edges.map(edge => {
            const from = this.nodes.get(edge.from);
            const to   = this.nodes.get(edge.to);
            if (!from || !to || from._x === undefined) return '';
            const et   = ContradictionGraph.EDGE_TYPES[edge.type] ?? ContradictionGraph.EDGE_TYPES.neutral;
            const dash = et.dash ? 'stroke-dasharray="5,3"' : '';
            return `<line x1="${from._x.toFixed(1)}" y1="${from._y.toFixed(1)}"
                         x2="${to._x.toFixed(1)}"   y2="${to._y.toFixed(1)}"
                         stroke="${et.color}" stroke-width="1.5" opacity="0.7" ${dash}/>`;
        }).join('\n');

        const svgNodes = nodeList.map(node => {
            const nt    = ContradictionGraph.NODE_TYPES[node.type] ?? ContradictionGraph.NODE_TYPES.witness;
            const label = node.label.length > 12 ? node.label.slice(0, 11) + '…' : node.label;
            const color = node.riskLevel === 'high'   ? '#ef4444'
                        : node.riskLevel === 'medium' ? '#f59e0b' : nt.color;
            return `
                <g class="graph-node" data-id="${node.id}">
                    <circle cx="${node._x.toFixed(1)}" cy="${node._y.toFixed(1)}"
                            r="${nt.radius}" fill="${color}" opacity="0.9"
                            stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
                    <text x="${node._x.toFixed(1)}" y="${(node._y - 4).toFixed(1)}"
                          text-anchor="middle" font-size="14" fill="#fff">${nt.icon}</text>
                    <text x="${node._x.toFixed(1)}" y="${(node._y + nt.radius + 13).toFixed(1)}"
                          text-anchor="middle" font-size="10" fill="#e2e8f0">${label}</text>
                </g>`;
        }).join('\n');

        const consistency = (this.getConsistencyScore() * 100).toFixed(0);
        const stats = this.getStats();

        container.innerHTML = `
            <div style="background:#0f172a;border-radius:8px;padding:8px;">
                <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
                     style="display:block;margin:0 auto;">
                    <defs>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="2" result="blur"/>
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                    </defs>
                    ${svgLines}
                    ${svgNodes}
                </svg>
                <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:11px;color:#94a3b8;justify-content:center;">
                    <span>🟢 Подтверждает: <b style="color:#22c55e">${stats.confirms + stats.corroborates + stats.alibi_supports}</b></span>
                    <span>🔴 Противоречит: <b style="color:#ef4444">${stats.contradicts + stats.alibi_breaks}</b></span>
                    <span>⚖️ Согласованность: <b style="color:#f59e0b">${consistency}%</b></span>
                </div>
                <div style="margin-top:6px;font-size:10px;color:#475569;text-align:center;">
                    ${this._getLegendHTML()}
                </div>
            </div>`;
    }

    // ─── Построение (Graph-driven) ────────────────────────────────────────────

    /**
     * Ноды: подозреваемый + EventGraph.nodes + свидетели + улики.
     * Используем РЕАЛЬНЫЕ id из данных, а не индексы.
     */
    _buildNodes(caseData) {
        this._addNode('suspect', 'suspect', caseData.defendantName || 'Обвиняемый');

        if (caseData.trueScenario?.victimName) {
            this._addNode('victim', 'victim', caseData.trueScenario.victimName);
        }

        const EVENT_LABELS = {
            preparation:  'Подготовка',
            presence:     'Присутствие',
            crime_action: 'Преступление',
            escape:       'Побег',
            alibi_event:  'Алиби',
            discovery:    'Обнаружение',
        };
        for (const node of caseData.trueScenario?.graph?.nodes ?? []) {
            this._addNode(node.id, 'event', EVENT_LABELS[node.type] ?? node.type);
        }

        for (const w of caseData.witnesses ?? []) {
            this._addNode(w.id, 'witness', w.name || 'Свидетель');
        }

        for (const ev of caseData.evidence ?? []) {
            this._addNode(ev.id, 'evidence', ev.label || ev.name || ev.type || 'Улика');
        }
    }

    /**
     * Свидетель → событие EventGraph по t.nodeId.
     * Тип показания (true|lie) → тип ребра.
     */
    _buildWitnessEdges(caseData) {
        for (const w of caseData.witnesses ?? []) {
            for (const t of w.testimonies ?? []) {
                if (!t.nodeId) continue;
                this._addEdge(w.id, t.nodeId, t.type === 'true' ? 'confirms' : 'contradicts');
            }
            if (w.confirmsAlibi)      this._addEdge(w.id, 'suspect', 'alibi_supports');
            if (w.contradictsSuspect) this._addEdge(w.id, 'suspect', 'alibi_breaks');
        }
    }

    /**
     * Улика → событие EventGraph (через ev.nodeId) + подозреваемый.
     * Надёжность определяет тип ребра.
     */
    _buildEvidenceEdges(caseData) {
        for (const ev of caseData.evidence ?? []) {
            const rel = ev.confidence ?? ev.baseReliability ?? 0.5;

            // Улика → событие
            if (ev.nodeId && this.nodes.has(ev.nodeId)) {
                const edgeType = ev.isFake  ? 'contradicts'
                    : rel > 0.7 ? 'confirms'
                    :             'corroborates';
                this._addEdge(ev.id, ev.nodeId, edgeType);
            }

            // Улика → подозреваемый
            if (!ev.isFake && rel >= 0.6) {
                this._addEdge(ev.id, 'suspect', 'confirms');
            } else if (ev.isFake) {
                this._addEdge(ev.id, 'suspect', 'contradicts');
            } else {
                this._addEdge(ev.id, 'suspect', 'neutral');
            }

            // Перекрёстные связи между уликами
            for (const r of (ev.relations ?? [])) {
                const target = caseData.evidence?.find(e => e.id === r.targetId);
                if (target) {
                    this._addEdge(ev.id, target.id,
                        r.type === 'confirms' ? 'corroborates' : 'contradicts');
                }
            }
        }
    }

    /**
     * Авто-поиск противоречий: если два свидетеля дают разные показания
     * об одном событии (nodeId) → ребро contradicts между ними.
     */
    _buildAutoContradictions(caseData) {
        const byNode = new Map();
        for (const w of caseData.witnesses ?? []) {
            for (const t of w.testimonies ?? []) {
                if (!t.nodeId) continue;
                if (!byNode.has(t.nodeId)) byNode.set(t.nodeId, []);
                byNode.get(t.nodeId).push({ w, t });
            }
        }
        for (const [, arr] of byNode) {
            const hasTruth = arr.some(x => x.t.type === 'true');
            const hasLie   = arr.some(x => x.t.type === 'lie');
            if (!hasTruth || !hasLie) continue;
            for (const a of arr) {
                for (const b of arr) {
                    if (a === b || a.t.type === b.t.type) continue;
                    this._addEdge(a.w.id, b.w.id, 'contradicts',
                        `Показания о ${a.t.nodeId} расходятся`);
                }
            }
        }
    }

    _computeScores() {
        for (const [id, node] of this.nodes) {
            node.pressure  = this.getNodePressure(id);
            node.riskLevel = node.pressure >= 2.0 ? 'high'
                           : node.pressure >  0.5 ? 'medium'
                           : 'low';
        }
    }

    // ─── Хелперы ─────────────────────────────────────────────────────────────

    _addNode(id, type, label) {
        if (!this.nodes.has(id)) {
            this.nodes.set(id, { id, type, label, riskLevel: 'low', pressure: 0, _x: 0, _y: 0 });
        }
    }

    _addEdge(from, to, type, note = '') {
        if (!from || !to || from === to) return;
        const dup = this.edges.some(e => e.from === from && e.to === to && e.type === type);
        if (!dup) this.edges.push({ from, to, type, note });
    }

    _getLegendHTML() {
        return Object.entries(ContradictionGraph.EDGE_TYPES)
            .filter(([k]) => k !== 'neutral')
            .map(([, et]) => `<span style="color:${et.color};margin:0 6px">— ${et.label}</span>`)
            .join('');
    }
}
