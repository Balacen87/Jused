/**
 * ResponseResolver — решает, как именно отвечает субъект на вопрос.
 *
 * Учитывает:
 *   - психологический профиль (psychModel)
 *   - текущее давление (pressureState)
 *   - когнитивную нагрузку (lieLoad)
 *   - стадию слома (breakStage)
 *   - тип вопроса (qt)
 *   - архетипные слабости
 */

import { PressureEngine } from './PressureEngine.js';

export const RESPONSE_TYPES = {
    clear_truth:         { label: 'Чёткая правда',         icon: '✅', color: '#22c55e', changesTestimony: false },
    stable_lie:          { label: 'Устойчивая ложь',       icon: '❌', color: '#64748b', changesTestimony: false },
    partial_truth:       { label: 'Частичная правда',      icon: '🔶', color: '#f59e0b', changesTestimony: false },
    evasion:             { label: 'Уклонение',             icon: '🌫️', color: '#94a3b8', changesTestimony: false },
    memory_gap:          { label: 'Провал в памяти',       icon: '🌀', color: '#6366f1', changesTestimony: true  },
    deflection:          { label: 'Отведение',             icon: '↩️', color: '#818cf8', changesTestimony: false },
    anger_response:      { label: 'Агрессия',              icon: '💢', color: '#ef4444', changesTestimony: true  },
    overexplaining:      { label: 'Болтливость',           icon: '💬', color: '#f97316', changesTestimony: true  },
    contradictory_answer:{ label: 'Противоречивый ответ', icon: '⚡', color: '#a855f7', changesTestimony: true  },
    correction:          { label: 'Исправление',           icon: '✏️', color: '#f97316', changesTestimony: true  },
    partial_admission:   { label: 'Частичное признание',   icon: '🔓', color: '#ef4444', changesTestimony: true  },
    full_admission:      { label: 'Признание',             icon: '🔓', color: '#dc2626', changesTestimony: true  },
    shutdown:            { label: 'Молчание / ступор',     icon: '🚫', color: '#475569', changesTestimony: false },
};

export class ResponseResolver {

    /**
     * Основной метод: определяет тип ответа.
     * @param {Object} psychModel — SubjectPsychologyModel
     * @param {Object} pressureState — из PressureEngine
     * @param {number} lieLoad — когнитивная нагрузка ложи (0..1)
     * @param {string} breakStage — из PressureEngine.breakStage()
     * @param {Object} qt — QuestionEngine.QUESTION_TYPES[type]
     * @param {Object} testimony — Testimony (может быть null)
     * @returns {{ kind: string, label: string, icon: string, color: string, changesTestimony: boolean }}
     */
    static resolve(psychModel, pressureState, lieLoad, breakStage, qt, testimony) {
        const isLying    = testimony?.type === 'lie';
        const isHonest   = !isLying;
        const isWeak     = qt?.weaknesses?.includes?.('current') ?? false;

        const { emotional, logical, evidence, fatigue, total } = pressureState;

        // ── Сначала проверяем экстремальные состояния ─────────────────────────

        // Полный слом
        if (breakStage === 'collapsed') {
            if (isLying) {
                if (Math.random() < 0.65) return ResponseResolver._make('full_admission');
                return ResponseResolver._make('partial_admission');
            }
            if (Math.random() < 0.40) return ResponseResolver._make('shutdown');
            return ResponseResolver._make('memory_gap');
        }

        // Ломается
        if (breakStage === 'fractured') {
            if (isLying) {
                const r = Math.random();
                if (r < 0.35) return ResponseResolver._make('partial_admission');
                if (r < 0.55) return ResponseResolver._make('correction');
                if (r < 0.70) return ResponseResolver._make('contradictory_answer');
                if (r < 0.80) return ResponseResolver._make('evasion');
                return ResponseResolver._make('anger_response');
            }
        }

        // ── Рассчитываем вероятности ──────────────────────────────────────────

        const shockedByEvidence = evidence > 0.65 && isLying;

        // 1. full_admission
        let p_full_admission =
            (isLying ? 0.02 : 0.0) +
            (shockedByEvidence ? 0.20 : 0.0) +
            psychModel.honesty * 0.08 +
            psychModel.moralConflict * 0.10 +
            total * 0.12 +
            lieLoad * 0.08 -
            psychModel.stressTolerance * 0.12 -
            psychModel.protectTarget * 0.10;

        // 2. partial_admission
        let p_partial_admission =
            (isLying ? 0.03 : 0.0) +
            psychModel.honesty * 0.10 +
            psychModel.moralConflict * 0.12 +
            evidence * 0.14 +
            lieLoad * 0.08 -
            psychModel.protectTarget * 0.08;

        // 3. correction
        let p_correction =
            (isLying ? 0.05 : 0.02) +
            logical * 0.14 +
            lieLoad * 0.10 +
            psychModel.compliance * 0.08;

        // 4. contradictory_answer
        let p_contradictory =
            (isLying ? 0.08 : 0.01) +
            lieLoad * 0.18 +
            fatigue * 0.14 +
            logical * 0.10 -
            psychModel.stressTolerance * 0.08;

        // 5. slip (в evolution займёт тип overexplaining)
        let p_overexplain =
            psychModel.ego * 0.12 +
            lieLoad * 0.08 +
            emotional * 0.06;

        // 6. memory_gap
        let p_memory_gap =
            (1 - psychModel.memoryAccuracy) * 0.20 +
            fatigue * 0.12 +
            (isHonest ? 0.10 : 0.02);

        // 7. evasion
        let p_evasion =
            psychModel.fear * 0.18 +
            emotional * 0.12 +
            (isLying ? 0.08 : 0.02) -
            psychModel.compliance * 0.10;

        // 8. deflection
        let p_deflection =
            psychModel.ego * 0.08 +
            emotional * 0.06 +
            psychModel.aggression * 0.05;

        // 9. anger_response
        let p_anger =
            psychModel.aggression * 0.16 +
            emotional * 0.10 -
            psychModel.compliance * 0.12;
        if (psychModel.archetypeKey === 'ego_defender') p_anger += 0.12;

        // 10. shutdown
        let p_shutdown =
            (breakStage === 'cracking' ? 0.04 : 0.0) +
            psychModel.fear * 0.06 +
            (isLying ? 0.02 : 0.0);
        if (psychModel.archetypeKey === 'traumatized_witness') p_shutdown += 0.10;

        // 11. stable_lie
        let p_stable_lie =
            (isLying ? 0.30 : 0.0) *
            psychModel.stressTolerance *
            (1 - lieLoad * 0.5);

        // 12. partial_truth
        let p_partial_truth =
            (isHonest ? 0.12 : 0.01) +
            psychModel.compliance * 0.06;

        // 13. clear_truth (baseline)
        let p_clear = isHonest ? 0.30 : 0.02;

        // ── Нормализуем и применяем порог ─────────────────────────────────────

        const C = v => Math.max(0, v);
        const candidates = [
            { kind: 'full_admission',      weight: C(p_full_admission)    },
            { kind: 'partial_admission',   weight: C(p_partial_admission) },
            { kind: 'correction',          weight: C(p_correction)        },
            { kind: 'contradictory_answer',weight: C(p_contradictory)     },
            { kind: 'overexplaining',      weight: C(p_overexplain)       },
            { kind: 'memory_gap',          weight: C(p_memory_gap)        },
            { kind: 'evasion',             weight: C(p_evasion)           },
            { kind: 'deflection',          weight: C(p_deflection)        },
            { kind: 'anger_response',      weight: C(p_anger)             },
            { kind: 'shutdown',            weight: C(p_shutdown)          },
            { kind: 'stable_lie',          weight: C(p_stable_lie)        },
            { kind: 'partial_truth',       weight: C(p_partial_truth)     },
            { kind: 'clear_truth',         weight: C(p_clear)             },
        ];

        const total_w = candidates.reduce((s, c) => s + c.weight, 0);
        let roll = Math.random() * total_w;
        for (const c of candidates) {
            roll -= c.weight;
            if (roll <= 0) return ResponseResolver._make(c.kind);
        }

        return ResponseResolver._make(isHonest ? 'clear_truth' : 'stable_lie');
    }

    static _make(kind) {
        const meta = RESPONSE_TYPES[kind] ?? { label: kind, icon: '?', color: '#94a3b8', changesTestimony: false };
        return { kind, ...meta };
    }
}
