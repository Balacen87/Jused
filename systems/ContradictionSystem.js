import { CredibilitySystem } from './CredibilitySystem.js';

/**
 * ContradictionSystem — расширенная система анализа противоречий.
 *
 * Возможности:
 *  - 6 категорий авто-анализа: свидетель↔свидетель, ↔улика, алиби, ложные улики,
 *    хронологические разрывы, психологические маркеры лжи
 *  - Ручная пометка игроком с заметкой
 *  - Сводный «индекс противоречий» для VerdictSystem
 *  - UI: renderHTML() с цветовой маркировкой и кнопками
 *  - Фильтрация по серьёзности
 *  - Экспорт для вердикта
 */
export class ContradictionSystem {

    // ─── Серьёзность ─────────────────────────────────────────────────────────
    static SEVERITY = {
        critical: { label: 'Критическое',     weight: 1.00, icon: '🔴', color: '#c0392b', bg: '#fff5f5' },
        major:    { label: 'Существенное',     weight: 0.60, icon: '🟠', color: '#e67e22', bg: '#fff9f0' },
        minor:    { label: 'Незначительное',   weight: 0.25, icon: '🟡', color: '#f39c12', bg: '#fefde7' },
        info:     { label: 'Примечание',       weight: 0.05, icon: '🔵', color: '#3498db', bg: '#f0f7ff' },
    };

    // ─── Названия типов противоречий ─────────────────────────────────────────
    static TYPE_LABELS = {
        timeline:       'Хронологическое противоречие',
        location:       'Противоречие по месту',
        identity:       'Ошибка идентификации',
        physical:       'Физическое несоответствие',
        statement_flip: 'Кардинальная смена показаний',
        omission:       'Умолчание важного факта',
        minor_slip:     'Незначительная оговорка',
        motive_bias:    'Предвзятость / заинтересованность',
        under_pressure: 'Изменение под давлением',
        psychological:  'Психологический маркер лжи',
        alibi_gap:      'Пробел в алиби',
        evidence_fake:  'Фальсификация доказательства',
    };

    /**
     * Полный авто-анализ дела — все 6 категорий.
     * @param {Object} activeCase
     * @returns {ContradictionRecord[]}
     */
    static analyze(activeCase) {
        const results = [];
        const witnesses = activeCase.witnesses || [];
        const evidence  = activeCase.evidence  || [];
        const s = activeCase.trueScenario || {};

        // ── 1. Свидетель ↔ свидетель ─────────────────────────────────────────
        for (let i = 0; i < witnesses.length; i++) {
            for (let j = i + 1; j < witnesses.length; j++) {
                const w1 = witnesses[i];
                const w2 = witnesses[j];
                const t1 = ContradictionSystem._joinTestimonies(w1);
                const t2 = ContradictionSystem._joinTestimonies(w2);
                if (!t1 || !t2) continue;

                const cType = CredibilitySystem.detectContradictionType(t1, t2);
                if (cType) {
                    results.push(ContradictionSystem._record(
                        'witness_vs_witness',
                        `${w1.name} ↔ ${w2.name}`,
                        cType,
                        ContradictionSystem._typeSeverity(cType),
                        ContradictionSystem._describeWitnessConflict(cType, w1, w2),
                        { witnessIds: [w1.id, w2.id] }
                    ));
                }

                // Дополнительно: психологические маркеры в показаниях
                const flags1 = CredibilitySystem.analyzeTestimony(t1);
                const flags2 = CredibilitySystem.analyzeTestimony(t2);
                [...flags1, ...flags2].forEach(flag => {
                    results.push(ContradictionSystem._record(
                        'psychological_flag',
                        `Психологический маркер: ${w1.name}${flags2.includes(flag) ? '/' + w2.name : ''}`,
                        'psychological',
                        'info',
                        `${flag.label}. ${flag.detail}`,
                        { witnessId: flags2.includes(flag) ? w2.id : w1.id }
                    ));
                });
            }
        }

        // ── 2. Свидетель ↔ улика ─────────────────────────────────────────────
        witnesses.forEach(w => {
            const t = ContradictionSystem._joinTestimonies(w);
            evidence.forEach(ev => {
                const desc = ev.description || '';
                const cType = CredibilitySystem.detectContradictionType(t, desc);
                if (cType) {
                    results.push(ContradictionSystem._record(
                        'witness_vs_evidence',
                        `${w.name} ↔ улика «${ev.label || ev.type}»`,
                        cType,
                        ContradictionSystem._typeSeverity(cType),
                        ContradictionSystem._describeEvidenceConflict(cType, w, ev),
                        { witnessId: w.id, evidenceId: ev.id }
                    ));
                }
            });
        });

        // ── 3. Алиби — анализ ─────────────────────────────────────────────────
        if (s.alibi) {
            const alibi = s.alibi;

            if (!alibi.verified) {
                results.push(ContradictionSystem._record(
                    'alibi_unverified',
                    `Алиби подсудимого`,
                    'alibi_gap',
                    'major',
                    `Заявленное алиби: «${alibi.claim}». Ни один свидетель или улика не подтверждают местонахождение обвиняемого в указанное время. Алиби не верифицировано.`,
                    {}
                ));
            }

            // Аффилированный алиби-свидетель
            if (alibi.witness && ContradictionSystem._isAffiliated(alibi, witnesses)) {
                results.push(ContradictionSystem._record(
                    'alibi_affiliate',
                    `Алиби-свидетель «${alibi.witness}»`,
                    'motive_bias',
                    'major',
                    `Свидетель алиби «${alibi.witness}» определён как аффилированное лицо (родственник или деловой партнёр подсудимого). Показания могут быть предвзятыми.`,
                    {}
                ));
            }

            // Временной разрыв — алиби охватывает не весь период
            if (alibi.timeFrom && alibi.timeTo && s.time) {
                const slotOk = ContradictionSystem._alibiCoversTime(alibi, s.time);
                if (!slotOk) {
                    results.push(ContradictionSystem._record(
                        'alibi_gap_time',
                        `Временной пробел в алиби`,
                        'alibi_gap',
                        'critical',
                        `Заявленное алиби действует с ${alibi.timeFrom} по ${alibi.timeTo}, однако преступление совершено в ${s.time} — этот период НЕ перекрывается алиби.`,
                        {}
                    ));
                }
            }
        }

        // ── 4. Ложные / сомнительные улики ───────────────────────────────────
        evidence.forEach(ev => {
            if (ev.isFake) {
                results.push(ContradictionSystem._record(
                    'fake_evidence',
                    `Улика «${ev.label || ev.type}» — признаки фальсификации`,
                    'evidence_fake',
                    'critical',
                    `Установлено: улика «${ev.label}» является сфабрикованной или нерелевантной. Основание: ${ev.fakeReason || 'происхождение и цепочка хранения не установлены'}. Данная улика исключается из доказательной базы.`,
                    { evidenceId: ev.id }
                ));
            }

            // Улика без цепочки хранения
            if (!ev.chainOfCustody && ev.type !== 'expertise') {
                results.push(ContradictionSystem._record(
                    'chain_of_custody',
                    `Нарушение цепочки хранения: «${ev.label || ev.type}»`,
                    'omission',
                    'minor',
                    `Улика не имеет задокументированной цепочки хранения (chain of custody). Возможно оспаривание допустимости.`,
                    { evidenceId: ev.id }
                ));
            }
        });

        // ── 5. Хронологические разрывы в фактах ──────────────────────────────
        const facts = s.facts || [];
        for (let i = 0; i < facts.length - 1; i++) {
            const f1 = facts[i];
            const f2 = facts[i + 1];
            if (f1.when && f2.when && ContradictionSystem._timeGap(f1.when, f2.when) > 3) {
                results.push(ContradictionSystem._record(
                    'timeline_gap',
                    `Хронологический разрыв между событиями`,
                    'timeline',
                    'minor',
                    `Между событием «${f1.text}» (${f1.when}) и «${f2.text}» (${f2.when}) — необъяснённый временной разрыв. Этот период не охвачен ни одним свидетелем.`,
                    {}
                ));
            }
        }

        // Дедупликация: убираем повторные записи с одинаковым title
        const seen = new Set();
        return results.filter(r => {
            const key = `${r.category}:${r.title}:${r.contradictionType}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Ручная пометка противоречия игроком.
     * @param {string} sourceId
     * @param {string} targetId
     * @param {string} [note]
     * @param {'minor'|'major'|'critical'} [severity]
     * @returns {ContradictionRecord}
     */
    static markContradiction(sourceId, targetId, note = '', severity = 'minor') {
        return ContradictionSystem._record(
            'player_marked',
            `[Помечено] ${sourceId} ↔ ${targetId}`,
            'omission',
            severity,
            note || 'Помечено игроком как подозрительное.',
            { sourceId, targetId, markedByPlayer: true }
        );
    }

    /**
     * Фильтрует противоречия по минимальной серьёзности.
     * @param {ContradictionRecord[]} contradictions
     * @param {'minor'|'major'|'critical'} minSeverity
     */
    static filterBySeverity(contradictions, minSeverity = 'minor') {
        const levels = { info: 0, minor: 1, major: 2, critical: 3 };
        const min = levels[minSeverity] ?? 0;
        return contradictions.filter(c => (levels[c.severity] ?? 0) >= min);
    }

    /**
     * Индекс противоречий (0–1) для системы вердикта.
     */
    static calculateScore(contradictions) {
        if (!contradictions.length) return { score: 0, dominant: null, counts: {} };

        const counts = { critical: 0, major: 0, minor: 0, info: 0 };
        let total = 0;

        contradictions.forEach(c => {
            const sev = ContradictionSystem.SEVERITY[c.severity];
            if (!sev) return;
            total += sev.weight;
            counts[c.severity] = (counts[c.severity] || 0) + 1;
        });

        const max = contradictions.length * 1.0;
        const score = Math.min(total / max, 1.0);
        const dominant = counts.critical > 0 ? 'critical' : counts.major > 0 ? 'major' : 'minor';

        return { score: +score.toFixed(2), dominant, counts };
    }

    /**
     * Готовит краткое резюме для VerdictSystem.
     */
    static summarizeForVerdict(contradictions) {
        const { score, counts } = ContradictionSystem.calculateScore(contradictions);
        const bullets = [];
        if (counts.critical > 0) bullets.push(`${counts.critical} критических противоречий`);
        if (counts.major    > 0) bullets.push(`${counts.major} существенных`);
        if (counts.minor    > 0) bullets.push(`${counts.minor} незначительных`);

        return {
            score,
            summary: bullets.length ? bullets.join(', ') : 'Противоречия не обнаружены',
            verdict_impact: score > 0.70 ? 'Значительные сомнения в версии обвинения'
                :           score > 0.40 ? 'Умеренные сомнения, рекомендуется перекрёстный допрос'
                :                          'Незначительные несоответствия, не влияют на вердикт',
        };
    }

    /**
     * Рендерит HTML-список с фильтром по серьёзности и кнопками.
     * @param {ContradictionRecord[]} contradictions
     * @param {string} [minSeverity]
     */
    static renderHTML(contradictions, minSeverity = 'info') {
        const filtered = ContradictionSystem.filterBySeverity(contradictions, minSeverity);

        if (!filtered.length) {
            return `<div style="padding:12px;background:#f0fff4;border-radius:6px;color:#27ae60;font-size:13px">
                ✅ Явных противоречий не обнаружено${minSeverity !== 'info' ? ` (фильтр: ${minSeverity}+)` : ''}.
            </div>`;
        }

        // Группировка по серьёзности
        const groups = { critical: [], major: [], minor: [], info: [] };
        filtered.forEach(c => (groups[c.severity] = groups[c.severity] || []).push(c));

        let html = '';

        ['critical', 'major', 'minor', 'info'].forEach(sev => {
            const items = groups[sev];
            if (!items?.length) return;
            const s = ContradictionSystem.SEVERITY[sev];

            html += `<div style="margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${s.color};font-weight:700">${s.icon} ${s.label} (${items.length})</div>`;

            items.forEach(c => {
                const typeLabel = ContradictionSystem.TYPE_LABELS[c.contradictionType] || c.contradictionType;
                html += `
                <div style="
                    border-left:4px solid ${s.color};
                    padding:10px 14px;margin-bottom:8px;border-radius:0 6px 6px 0;
                    background:${s.bg}">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <span style="font-weight:600;font-size:13px;color:#2c3e50">${c.title}</span>
                        <span style="font-size:11px;color:#999;background:#f0f0f0;padding:1px 7px;border-radius:10px">${typeLabel}</span>
                    </div>
                    <div style="font-size:12px;color:#555;line-height:1.5">${c.description}</div>
                    ${c.meta?.markedByPlayer ? '<div style="font-size:11px;color:#9b59b6;margin-top:4px">📌 Помечено вами</div>' : ''}
                    <div style="font-size:10px;color:#ccc;margin-top:4px">${new Date(c.discoveredAt).toLocaleTimeString('ru-RU')}</div>
                </div>`;
            });
        });

        return html;
    }

    // ─── Внутренние методы ────────────────────────────────────────────────────

    static _record(category, title, contradictionType, severity, description, meta = {}) {
        return {
            id: `con_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            category,
            title,
            contradictionType,
            severity,
            description,
            meta,
            discoveredAt: Date.now(),
        };
    }

    static _typeSeverity(type) {
        const map = {
            statement_flip: 'critical',
            evidence_fake:  'critical',
            perjury_hint:   'critical',
            alibi_gap:      'major',
            identity:       'major',
            timeline:       'major',
            location:       'major',
            motive_bias:    'major',
            physical:       'minor',
            omission:       'minor',
            under_pressure: 'minor',
            minor_slip:     'minor',
            psychological:  'info',
        };
        return map[type] || 'minor';
    }

    static _joinTestimonies(witness) {
        return (witness.testimonies || [])
            .map(t => (typeof t === 'string' ? t : t.text) || '')
            .filter(Boolean)
            .join(' ');
    }

    static _describeWitnessConflict(cType, w1, w2) {
        const labels = {
            timeline:       `${w1.name} и ${w2.name} называют разное время. Один из них либо ошибается, либо вводит суд в заблуждение.`,
            location:       `${w1.name} и ${w2.name} расходятся в описании места событий.`,
            identity:       `${w1.name} и ${w2.name} по-разному описывают внешность фигуранта — серьёзное основание для перекрёстного допроса.`,
            physical:       `Физические детали в показаниях ${w1.name} и ${w2.name} не совпадают.`,
            statement_flip: `${w1.name} и ${w2.name} дают принципиально противоположные показания — один из них заведомо лжёт.`,
            omission:       `${w2.name} умалчивает о ключевых деталях, которые упомянул ${w1.name}.`,
        };
        return labels[cType] || `Между показаниями ${w1.name} и ${w2.name} обнаружено расхождение типа «${cType}».`;
    }

    static _describeEvidenceConflict(cType, w, ev) {
        const labels = {
            timeline: `Время, упомянутое ${w.name}, не совпадает с временными метками улики «${ev.label}».`,
            location: `${w.name} помещает события в другое место, чем физическая улика «${ev.label}».`,
            identity: `Описание ${w.name} не совпадает с идентификационными данными улики «${ev.label}».`,
            omission: `${w.name} не упоминает обстоятельства, зафиксированные уликой «${ev.label}».`,
        };
        return labels[cType] || `Показания ${w.name} расходятся с данными улики «${ev.label}» по параметру «${cType}».`;
    }

    static _isAffiliated(alibi, witnesses) {
        if (!alibi.witness) return false;
        const name = alibi.witness.toLowerCase();
        return witnesses.some(w => {
            const wn = (w.name || '').toLowerCase().split(' ');
            return wn.some(p => p.length > 3 && name.includes(p));
        });
    }

    static _alibiCoversTime(alibi, crimeTime) {
        if (!alibi.timeFrom || !alibi.timeTo || !crimeTime) return true;
        const toMin = t => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + (m || 0);
        };
        const crime = toMin(crimeTime);
        return crime >= toMin(alibi.timeFrom) && crime <= toMin(alibi.timeTo);
    }

    static _timeGap(t1, t2) {
        const toH = t => parseInt(t.split(':')[0]) || 0;
        return Math.abs(toH(t2) - toH(t1));
    }
}
