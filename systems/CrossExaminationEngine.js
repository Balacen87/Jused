/**
 * CrossExaminationEngine — движок перекрёстного допроса.
 *
 * Управляет состоянием свидетеля (стресс, уверенность, сопротивление),
 * обрабатывает 8 типов вопросов и мутирует Testimony при оговорке / признании.
 *
 * Архитектура:
 *   CrossExaminationSession — мутабельное состояние сессии
 *   WitnessStressModel      — rасчёт давления через личность + граф
 *   ResponseOutcome         — результат каждого вопроса
 *   Testimony.revisions     — история изменений показания
 */

export class CrossExaminationEngine {

    // ─── Типы вопросов ────────────────────────────────────────────────────────

    static QUESTION_TYPES = {
        direct: {
            label: 'Прямой вопрос',
            icon: '❓',
            pressure: 0.08,
            clarityBonus: 0.10,
            contradictionPower: 0.05
        },
        detail: {
            label: 'Уточнение деталей',
            icon: '🔎',
            pressure: 0.14,
            clarityBonus: 0.18,
            contradictionPower: 0.12
        },
        timeline: {
            label: 'Проверка времени',
            icon: '⏱️',
            pressure: 0.18,
            clarityBonus: 0.15,
            contradictionPower: 0.22
        },
        repetition: {
            label: 'Повторный вопрос',
            icon: '🔄',
            pressure: 0.16,
            clarityBonus: 0.06,
            contradictionPower: 0.14
        },
        confrontation: {
            label: 'Конфронтация',
            icon: '⚔️',
            pressure: 0.28,
            clarityBonus: 0.08,
            contradictionPower: 0.35
        },
        evidence_push: {
            label: 'Предъявление улики',
            icon: '🔬',
            pressure: 0.24,
            clarityBonus: 0.12,
            contradictionPower: 0.40
        },
        alibi_attack: {
            label: 'Атака на алиби',
            icon: '🛡️',
            pressure: 0.26,
            clarityBonus: 0.10,
            contradictionPower: 0.38
        },
        moral_pressure: {
            label: 'Моральное давление',
            icon: '👁️',
            pressure: 0.20,
            clarityBonus: 0.04,
            contradictionPower: 0.18
        }
    };

    // ─── Цвета и тексты исходов ────────────────────────────────────────────────

    static OUTCOME_LABELS = {
        admission:      { label: '⚡ Признание',          color: '#ef4444', severity: 'high'   },
        correction:     { label: '✏️ Уточнение',           color: '#f97316', severity: 'medium' },
        slip:           { label: '💬 Оговорка',            color: '#f59e0b', severity: 'medium' },
        evasion:        { label: '🌫️ Уклонение',           color: '#94a3b8', severity: 'low'    },
        stabilized:     { label: '🔒 Позиция удержана',    color: '#22c55e', severity: 'low'    },
        partial_answer: { label: '◑ Частичный ответ',      color: '#6366f1', severity: 'low'    },
    };

    // ─── Создание сессии ──────────────────────────────────────────────────────

    /** Инициализирует новую сессию допроса для данного свидетеля. */
    static createSession(witness, caseData) {
        return {
            witnessId:   witness.id,
            witnessName: witness.name,
            startedAt:   Date.now(),
            caseId:      caseData?.id ?? null,
            state: {
                stress:     0.0,
                fatigue:    0.0,
                confidence: this._initialConfidence(witness),
                resistance: this._initialResistance(witness),
                truthDrift: 0.0,
                broken:     false
            },
            stats: {
                questionsAsked:       0,
                evasions:             0,
                contradictionsExposed:0,
                admissions:           0,
                corrections:          0,
                slips:                0
            },
            baseline: {
                truthRatio: this._estimateTruthRatio(witness)
            },
            history:    [],
            lastOutcome: null
        };
    }

    // ─── Главный метод ────────────────────────────────────────────────────────

    /**
     * Задаёт вопрос свидетелю. Мутирует session и optionally targetTestimony.
     *
     * @param {Object} params
     * @param {Object} params.session            — активная сессия (из createSession)
     * @param {Object} params.witness            — объект Witness
     * @param {Object} params.caseData           — данные дела
     * @param {string} params.questionType       — ключ из QUESTION_TYPES
     * @param {string} params.questionText       — текст вопроса
     * @param {Object|null} params.targetTestimony  — показание, на которое направлен вопрос
     * @param {Object|null} params.relatedEvidence  — улика, связанная с вопросом
     * @param {Object|null} params.contradictionGraph — граф (ContradictionGraph instance)
     * @returns {{ session, outcome, testimonyUpdate, ui }}
     */
    static askQuestion({
        session,
        witness,
        caseData,
        questionType        = 'direct',
        questionText        = '',
        targetTestimony     = null,
        relatedEvidence     = null,
        contradictionGraph  = null
    }) {
        const qt = this.QUESTION_TYPES[questionType] ?? this.QUESTION_TYPES.direct;

        const contradictionStrength = this._computeContradictionStrength({
            witness, targetTestimony, relatedEvidence, contradictionGraph
        });

        const stateBefore = structuredClone(session.state);

        this._applyPressure(session, witness, qt, contradictionStrength);

        const outcome = this._resolveOutcome({
            session, witness, questionType, targetTestimony, relatedEvidence, contradictionStrength
        });

        const testimonyUpdate = this._applyOutcomeToWitness({
            witness, targetTestimony, outcome, relatedEvidence
        });

        // Обновляем статистику
        session.stats.questionsAsked++;
        if (outcome.kind === 'evasion')   session.stats.evasions++;
        if (outcome.kind === 'admission') session.stats.admissions++;
        if (outcome.kind === 'correction') session.stats.corrections++;
        if (outcome.kind === 'slip')      session.stats.slips++;
        if (outcome.exposedContradiction) session.stats.contradictionsExposed++;

        // Пишем в historiy сессии
        session.history.push({
            at:                    Date.now(),
            questionType,
            questionText,
            contradictionStrength: +contradictionStrength.toFixed(3),
            stateBefore,
            stateAfter:            structuredClone(session.state),
            outcome,
            testimonyUpdate
        });
        session.lastOutcome = outcome;

        return {
            session,
            outcome,
            testimonyUpdate,
            ui: this._buildUiSnapshot(session, witness, outcome, qt)
        };
    }

    // ─── Вспомогательные публичные методы ────────────────────────────────────

    static shouldWitnessBreak(session) {
        const { stress, fatigue, confidence, resistance } = session.state;
        return (stress * 0.45 + fatigue * 0.20 + (1 - confidence) * 0.20 + (1 - resistance) * 0.15) >= 0.82;
    }

    static summarizeSession(session) {
        return {
            witnessId:             session.witnessId,
            witnessName:           session.witnessName,
            questionsAsked:        session.stats.questionsAsked,
            evasions:              session.stats.evasions,
            contradictionsExposed: session.stats.contradictionsExposed,
            admissions:            session.stats.admissions,
            corrections:           session.stats.corrections,
            slips:                 session.stats.slips,
            stress:     +session.state.stress.toFixed(3),
            fatigue:    +session.state.fatigue.toFixed(3),
            confidence: +session.state.confidence.toFixed(3),
            resistance: +session.state.resistance.toFixed(3),
            broken:     session.state.broken,
            duration:   Math.round((Date.now() - session.startedAt) / 1000)
        };
    }

    // ─── Внутренние методы: инициализация ────────────────────────────────────

    static _initialConfidence(witness) {
        const honesty = witness?.personality?.honesty ?? 0.5;
        const courage = witness?.personality?.courage ?? 0.5;
        const memory  = witness?.memory?.accuracy     ?? 0.5;
        return this._clamp(honesty * 0.35 + courage * 0.25 + memory * 0.40, 0.15, 0.95);
    }

    static _initialResistance(witness) {
        const courage    = witness?.personality?.courage     ?? 0.5;
        const anxiety    = witness?.personality?.anxiety     ?? 0.5;
        const impuls     = witness?.personality?.impulsivity ?? 0.5;
        const protect    = witness?.motivation?.protectDefendant ?? 0.0;
        return this._clamp(courage * 0.35 + protect * 0.25 + (1 - anxiety) * 0.25 + (1 - impuls) * 0.15, 0.10, 0.95);
    }

    static _estimateTruthRatio(witness) {
        const ts = witness?.testimonies ?? [];
        if (!ts.length) return 0.5;
        return ts.filter(t => t.type === 'true').length / ts.length;
    }

    // ─── Внутренние методы: стресс-модель ────────────────────────────────────

    static _applyPressure(session, witness, qt, contradictionStrength) {
        const anxiety = witness?.personality?.anxiety ?? 0.5;
        const courage = witness?.personality?.courage ?? 0.5;
        const honesty = witness?.personality?.honesty ?? 0.5;

        const pressureGain =
            qt.pressure * 0.60 +
            contradictionStrength * 0.30 +
            anxiety * 0.20 -
            courage * 0.15;

        const fatigueGain =
            0.04 +
            qt.pressure * 0.25 +
            session.stats.questionsAsked * 0.003;

        const confidenceDrop =
            qt.contradictionPower * 0.18 +
            contradictionStrength * 0.15 -
            honesty * 0.06;

        const resistanceDrop =
            contradictionStrength * 0.12 +
            qt.pressure * 0.08;

        session.state.stress     = this._clamp(session.state.stress     + pressureGain,   0, 1);
        session.state.fatigue    = this._clamp(session.state.fatigue    + fatigueGain,    0, 1);
        session.state.confidence = this._clamp(session.state.confidence - confidenceDrop, 0, 1);
        session.state.resistance = this._clamp(session.state.resistance - resistanceDrop, 0, 1);

        if (this.shouldWitnessBreak(session)) session.state.broken = true;
    }

    static _computeContradictionStrength({ witness, targetTestimony, relatedEvidence, contradictionGraph }) {
        let score = 0.15;

        if (targetTestimony?.type === 'lie')  score += 0.25;
        if (targetTestimony?.type === 'true') score += 0.05;

        if (relatedEvidence) {
            const rel = relatedEvidence.reliability ?? relatedEvidence.confidence ?? 0.5;
            score += rel * 0.35;
            if (relatedEvidence.isFake) score -= 0.20;
        }

        if (contradictionGraph && witness?.id) {
            const pressure = contradictionGraph.getNodePressure?.(witness.id) ?? 0;
            score += Math.min(0.30, Math.max(0, pressure * 0.08));
        }

        return this._clamp(score, 0, 1);
    }

    // ─── Внутренние методы: исход вопроса ────────────────────────────────────

    static _resolveOutcome({ session, witness, questionType, targetTestimony, relatedEvidence, contradictionStrength }) {
        const honesty  = witness?.personality?.honesty  ?? 0.5;
        const memory   = witness?.memory?.accuracy      ?? 0.5;
        const anxiety  = witness?.personality?.anxiety  ?? 0.5;
        const protect  = witness?.motivation?.protectDefendant ?? 0.0;
        const { stress, fatigue, confidence, resistance, broken } = session.state;

        const evasionChance =
            0.08 + anxiety * 0.20 + stress * 0.18 + fatigue * 0.10 - confidence * 0.12;

        const slipChance =
            0.04 + stress * 0.20 + fatigue * 0.16 + contradictionStrength * 0.22 - resistance * 0.12;

        const correctionChance =
            0.03 + honesty * 0.24 + contradictionStrength * 0.28 + (broken ? 0.22 : 0) - protect * 0.15;

        const admissionChance =
            0.01 + contradictionStrength * 0.25 + honesty * 0.14 + stress * 0.10 + (broken ? 0.30 : 0) - protect * 0.18;

        const strengthenChance =
            0.10 + confidence * 0.15 + memory * 0.16 - stress * 0.10;

        const roll = Math.random();
        let threshold = 0;

        threshold += this._clamp(admissionChance, 0, 0.75);
        if (roll < threshold) return { kind: 'admission',      exposedContradiction: true,  severity: 'high',   text: 'Свидетель частично признаёт ложность или неточность прежних показаний.' };

        threshold += this._clamp(correctionChance, 0, 0.65);
        if (roll < threshold) return { kind: 'correction',     exposedContradiction: targetTestimony?.type === 'lie', severity: 'medium', text: 'Свидетель корректирует детали и смягчает прежнюю версию.' };

        threshold += this._clamp(slipChance, 0, 0.55);
        if (roll < threshold) return { kind: 'slip',           exposedContradiction: true,  severity: 'medium', text: 'Свидетель оговаривается и создаёт новую уязвимость в своей версии.' };

        threshold += this._clamp(evasionChance, 0, 0.60);
        if (roll < threshold) return { kind: 'evasion',        exposedContradiction: false, severity: 'low',    text: 'Свидетель уклоняется от прямого ответа.' };

        threshold += this._clamp(strengthenChance, 0, 0.60);
        if (roll < threshold) return { kind: 'stabilized',     exposedContradiction: false, severity: 'low',    text: 'Свидетель удерживает позицию и повторяет версию уверенно.' };

        return { kind: 'partial_answer', exposedContradiction: false, severity: 'low', text: 'Свидетель даёт частичный ответ без полного разрешения противоречия.' };
    }

    // ─── Внутренние методы: мутация показания ────────────────────────────────

    static _applyOutcomeToWitness({ witness, targetTestimony, outcome, relatedEvidence }) {
        if (!targetTestimony) return { changed: false, reason: 'Нет целевого показания.' };

        const before = { text: targetTestimony.text, type: targetTestimony.type };
        const evLabel = relatedEvidence?.label ?? relatedEvidence?.type ?? 'предъявленного материала';

        switch (outcome.kind) {

            case 'admission': {
                const newText = `Ладно, мои прежние слова были неточны. После предъявления «${evLabel}» вынужден признать — говорил(а) не так, как было.`;
                targetTestimony.revisions ??= [];
                targetTestimony.revisions.push({ at: Date.now(), oldText: before.text, newText, oldType: before.type, newType: 'corrected', reason: 'admission' });
                targetTestimony.type = 'corrected';
                targetTestimony.text = newText;
                return { changed: true, mode: 'admission', before, after: { text: newText, type: 'corrected' } };
            }

            case 'correction': {
                const newText = `Уточню показания: ранее изложил(а) события неточно. Если сопоставить с ${evLabel} — правильнее описать ситуацию иначе.`;
                targetTestimony.revisions ??= [];
                targetTestimony.revisions.push({ at: Date.now(), oldText: before.text, newText, oldType: before.type, newType: before.type === 'lie' ? 'corrected' : before.type, reason: 'correction' });
                if (before.type === 'lie') targetTestimony.type = 'corrected';
                targetTestimony.text = newText;
                return { changed: true, mode: 'correction', before, after: { text: newText, type: targetTestimony.type } };
            }

            case 'slip': {
                const newText = `Подождите... нет, я, возможно, ошибся(лась) в деталях. Это могло быть не совсем так — особенно учитывая ${evLabel}.`;
                targetTestimony.revisions ??= [];
                targetTestimony.revisions.push({ at: Date.now(), oldText: before.text, newText, oldType: before.type, newType: before.type, reason: 'slip' });
                targetTestimony.text = newText;
                return { changed: true, mode: 'slip', before, after: { text: newText, type: before.type } };
            }

            default:
                return { changed: false, mode: outcome.kind, before, after: before };
        }
    }

    // ─── UI snapshot ─────────────────────────────────────────────────────────

    static _buildUiSnapshot(session, witness, outcome, qt) {
        const { stress, fatigue, confidence, resistance, broken } = session.state;

        const pressureLevel =
            stress > 0.75 ? 'critical'
          : stress > 0.45 ? 'high'
          : stress > 0.20 ? 'medium'
          : 'low';

        const pressurePalette = {
            critical: '#ef4444',
            high:     '#f97316',
            medium:   '#f59e0b',
            low:      '#22c55e'
        };

        return {
            witnessId:           witness.id,
            witnessName:         witness.name,
            pressureLevel,
            pressureColor:       pressurePalette[pressureLevel],
            stress:              +stress.toFixed(3),
            fatigue:             +fatigue.toFixed(3),
            confidence:          +confidence.toFixed(3),
            resistance:          +resistance.toFixed(3),
            broken,
            questionsAsked:      session.stats.questionsAsked,
            lastOutcomeKind:     outcome.kind,
            lastOutcomeLabel:    CrossExaminationEngine.OUTCOME_LABELS[outcome.kind]?.label ?? outcome.kind,
            lastOutcomeColor:    CrossExaminationEngine.OUTCOME_LABELS[outcome.kind]?.color ?? '#94a3b8',
            recommendation:      this._getRecommendation(session, outcome)
        };
    }

    static _getRecommendation(session, outcome) {
        if (session.state.broken)          return 'Свидетель близок к слому. Нанесите финальный удар — предъявьте ключевую улику или задайте вопрос по времени.';
        if (outcome.kind === 'evasion')    return 'Уклонение: предъявьте конкретное противоречие или повторите вопрос в узкой формулировке.';
        if (outcome.kind === 'stabilized') return 'Позиция держится. Нужна более весомая улика или атака по деталям.';
        if (outcome.kind === 'slip' || outcome.kind === 'correction') return 'Трещина в показаниях! Немедленный добивающий вопрос по уточнённой детали.';
        if (outcome.kind === 'admission')  return 'Признание зафиксировано. Проверьте, какие узлы графа противоречий это изменило.';
        return 'Усиливайте давление постепенно — используйте разные типы вопросов.';
    }

    // ─── Утилиты ─────────────────────────────────────────────────────────────

    static _clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
}
