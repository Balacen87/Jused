/**
 * InterrogationDirector — мозг допроса.
 *
 * Оркестрирует все подсистемы:
 *   SubjectPsychologyModel → PressureEngine → ResponseResolver
 *   → ContradictionResolver → StatementEvolutionEngine
 *   → InterrogationSession.advancePhaseIfNeeded
 *
 * Публичный API:
 *   InterrogationDirector.createSession(witness, caseData, side)
 *   InterrogationDirector.ask(session, questionType, context)
 *   InterrogationDirector.recommend(session)
 *   InterrogationDirector.uiSnapshot(session)
 */

import { InterrogationSession, PHASE_META } from './InterrogationSession.js';
import { PressureEngine }                   from './PressureEngine.js';
import { ResponseResolver, RESPONSE_TYPES } from './ResponseResolver.js';
import { ContradictionResolver }            from './ContradictionResolver.js';
import { StatementEvolutionEngine }         from './StatementEvolutionEngine.js';
import { QuestionEngine }                   from './QuestionEngine.js';
import { TACTICS, recommendTactic }         from './InterrogationTactics.js';

export class InterrogationDirector {

    // ─── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────────────────

    /**
     * Создаёт сессию допроса.
     * Это единственный вход для UI — все последующие действия через ask().
     */
    static createSession(witness, caseData, side = 'prosecution') {
        return InterrogationSession.create(witness, caseData, side);
    }

    // ─── ГЛАВНЫЙ МЕТОД: ХОД ДОПРОСА ──────────────────────────────────────────

    /**
     * Один ход допроса.
     *
     * @param {InterrogationSession} session
     * @param {string} questionType — ключ из QuestionEngine.QUESTION_TYPES
     * @param {Object} context — { targetTestimony, evidence, lockStatement, customText }
     * @returns {Object} AnswerEvent + uiSnapshot
     */
    static ask(session, questionType, context = {}) {

        // ── Шаг 1: Получаем профили ───────────────────────────────────────────
        const qt         = QuestionEngine.QUESTION_TYPES[questionType] ?? QuestionEngine.QUESTION_TYPES.open_question;
        const psychModel = session.psychModel;
        const tactic     = session.tactic;

        const testimony   = context.targetTestimony ?? null;
        const evidence    = context.evidence        ?? null;

        // ── Шаг 1.5: Интеграция Раппорта и Привыкания ─────────────────────────
        session.rapport = Math.max(0, Math.min(1, session.rapport - (qt.rapportRisk ?? 0)));
        
        const cat = qt.category || 'basic';
        const usageCount = session.categoryUsage[cat] || 0;
        session.categoryUsage[cat] = usageCount + 1;
        
        if (tactic) {
            session.tacticUsage[tactic.key] = (session.tacticUsage[tactic.key] || 0) + 1;
        }

        let penalty = 1.0;
        // Если спамим давлением или тактикой, падает эффективность (до 0.3)
        if (cat === 'pressure' || cat === 'strategic') {
            if (usageCount >= 3) {
                penalty = Math.max(0.3, 1.0 - (usageCount - 2) * 0.25);
            }
        }
        const effectiveTactic = tactic ? { ...tactic, pressureMultiplier: (tactic.pressureMultiplier ?? 1.0) * penalty } : null;

        // ── Шаг 2: Сила противоречия ─────────────────────────────────────────
        const contradictionStrength = ContradictionResolver.contradictionStrength(
            testimony, evidence, psychModel, session
        );

        const evidenceReliability = evidence
            ? (evidence.confidence ?? evidence.reliability ?? 0.5)
            : 0.0;

        // ── Шаг 3: Давление ──────────────────────────────────────────────────
        PressureEngine.apply(
            session.pressureState,
            psychModel,
            qt,
            effectiveTactic,
            contradictionStrength,
            evidenceReliability,
            session.questionsAsked
        );

        // ── Шаг 4: Разрешение ответа ─────────────────────────────────────────
        const response = ResponseResolver.resolve(
            psychModel,
            session.pressureState,
            session.cognitiveLoad,
            session.breakStage,
            qt,
            testimony
        );

        // ── Шаг 5: Противоречия ───────────────────────────────────────────────
        const newContradictions = ContradictionResolver.detect(
            testimony, evidence, session.witness, psychModel, session
        );
        newContradictions.forEach(c => session.exposeContradiction(c));

        // ── Шаг 6: Эволюция показания ─────────────────────────────────────────
        let testimonyUpdate = { changed: false };
        if (testimony && response.changesTestimony) {
            testimonyUpdate = StatementEvolutionEngine.evolve(
                testimony, response.kind, psychModel, session, evidence
            );
        }

        // ── Шаг 7: Lock statement ─────────────────────────────────────────────
        if (questionType === 'lock_statement' && context.lockStatement) {
            session.lockClaim(context.lockStatement, context.topic ?? 'general');
        }

        // ── Шаг 8: Обновляем флаги состояния ─────────────────────────────────
        InterrogationDirector._updateStateFlags(session, response);

        // ── Шаг 9: Обновляем когнитивную нагрузку ────────────────────────────
        session.cognitiveLoad = psychModel.computeLieLoad(
            session.exposedContradictions.length,
            session.lockedClaims.length,
            session.pressureState.fatigue
        );

        // ── Шаг 10: История ───────────────────────────────────────────────────
        const questionText = context.customText ?? QuestionEngine.buildText(questionType, context);
        const questionEvent = {
            id:             `q_${Date.now()}`,
            type:           questionType,
            label:          qt.label,
            tactic:         tactic?.key,
            text:           questionText,
            targetId:       testimony?.id ?? null,
            evidenceId:     evidence?.id  ?? null,
            step:           session.questionsAsked,
        };
        const answerEvent = {
            id:                  `a_${Date.now()}`,
            questionId:          questionEvent.id,
            responseType:        response.kind,
            responseLabel:       response.label,
            responseIcon:        response.icon,
            responseColor:       response.color,
            responseText:        StatementEvolutionEngine.generateResponseText(response.kind, evidence?.label ?? evidence?.type ?? 'материалы', psychModel, session.witness),
            contradictionStren:  +contradictionStrength.toFixed(3),
            newContradictions:   newContradictions.map(c => c.id),
            testimonyChanged:    testimonyUpdate.changed,
            changeType:          testimonyUpdate.changeType ?? null,
            pressureSnapshot:    { ...session.pressureState },
            breakStage:          session.breakStage,
        };

        session.questionHistory.push(questionEvent);
        session.answerHistory.push(answerEvent);
        session.timelineLog.push({ q: questionEvent, a: answerEvent });

        // ── Шаг 11: Переход фазы ──────────────────────────────────────────────
        const phaseChanged = session.advancePhaseIfNeeded();

        // ── Итог ──────────────────────────────────────────────────────────────
        return {
            session,
            questionEvent,
            answerEvent,
            response,
            testimonyUpdate,
            newContradictions,
            phaseChanged,
            ui: InterrogationDirector.uiSnapshot(session, answerEvent)
        };
    }

    // ─── РЕКОМЕНДАЦИЯ СЛЕДУЮЩЕГО ХОДА ─────────────────────────────────────────

    /**
     * Рекомендует игроку следующий тип вопроса и текст.
     * Это «помощник следователя».
     * @param {InterrogationSession} session
     * @returns {{ questionType, questionLabel, text, reason, tacticLabel }}
     */
    static recommend(session) {
        const phase      = session.phase;
        const tactic     = session.tactic;
        const psychModel = session.psychModel;
        const bi         = session.breakIndex;
        const bs         = session.breakStage;
        const weaknesses = psychModel.weaknesses || [];

        // 1. Если свидетель близко к слому — предлагаем атаку
        if (bs === 'fractured' || bs === 'cracking') {
            const hasEvidence = (session.caseData?.evidence?.length ?? 0) > 0;
            const qtype = hasEvidence ? 'evidence_push' : 'impossibility_exposure';
            const qt = QuestionEngine.QUESTION_TYPES[qtype];
            return {
                questionType:  qtype,
                questionLabel: qt.label,
                text: QuestionEngine.buildText(qtype, {}),
                reason: `Свидетель на стадии "${PressureEngine.STAGE_LABELS[bs]?.label}". Нанесите решающий удар.`,
                tacticLabel: tactic?.label,
            };
        }

        // 2. Если контакт (раппорт) потерян, надо восстанавливать
        if (session.rapport < 0.35 && phase !== 'break' && phase !== 'closure') {
            const qt = QuestionEngine.QUESTION_TYPES['sensory_check'];
            return {
                questionType: 'sensory_check',
                questionLabel: qt.label,
                text: QuestionEngine.buildText('sensory_check', {}),
                reason: 'Свидетель закрывается (низкий контакт). Задайте нейтральный вопрос для снижения защиты.',
                tacticLabel: tactic?.label,
            };
        }

        const lastAnswer = session.answerHistory.at(-1);

        // 3. Если только что поймали на противоречии — давим
        if (lastAnswer && lastAnswer.newContradictions?.length > 0) {
            const qtype = 'micro_contradiction_probe';
            const qt = QuestionEngine.QUESTION_TYPES[qtype];
            return {
                questionType:  qtype,
                questionLabel: qt.label,
                text: QuestionEngine.buildText(qtype, {}),
                reason: 'Вы только что вскрыли новую ложь. Ударьте по этому противоречию прямо сейчас.',
                tacticLabel: tactic?.label,
            };
        }

        // 4. Если недавно было уклонение — используем сужение
        const lastKind = lastAnswer?.responseType;
        if (lastKind === 'evasion' || lastKind === 'deflection') {
            const qtype = 'narrowing_question';
            const qt = QuestionEngine.QUESTION_TYPES[qtype];
            return {
                questionType:  qtype,
                questionLabel: qt.label,
                text: QuestionEngine.buildText(qtype, {}),
                reason: 'Свидетель уклоняется от ответа. Сузьте вопрос до конкретной детали.',
                tacticLabel: tactic?.label,
            };
        }

        // 5. Поиск вопросов по слабостям свидетеля
        const validWeaknesses = weaknesses.filter(w => QuestionEngine.QUESTION_TYPES[w]?.phases.includes(phase));
        if (validWeaknesses.length > 0 && Math.random() > 0.4) {
            const qtype = validWeaknesses[0];
            const qt = QuestionEngine.QUESTION_TYPES[qtype];
            return {
                questionType:  qtype,
                questionLabel: qt.label,
                text: QuestionEngine.buildText(qtype, {}),
                reason: 'Анализ профиля показывает, что этот тип вопроса ударит по уязвимости свидетеля.',
                tacticLabel: tactic?.label,
            };
        }

        // 6. Стандартная рекомендация по фазе + тактике
        const recs = QuestionEngine.recommend(phase, tactic);
        const qtype = recs[0] ?? 'open_question';
        const qt = QuestionEngine.QUESTION_TYPES[qtype];
        const phaseMeta = PHASE_META[phase];

        return {
            questionType:  qtype,
            questionLabel: qt?.label ?? qtype,
            text:          QuestionEngine.buildText(qtype, {}),
            reason:        `Фаза «${phaseMeta?.label}»: ${phaseMeta?.description}`,
            tacticLabel:   tactic?.label,
        };
    }

    // ─── UI SNAPSHOT ──────────────────────────────────────────────────────────

    /**
     * Полный снимок состояния для рендеринга UI.
     */
    static uiSnapshot(session, lastAnswer = null) {
        const bi  = session.breakIndex;
        const bs  = session.breakStage;
        const pm  = session.pressureState;
        const pst = PressureEngine.STAGE_LABELS[bs];
        const phaseMeta = PHASE_META[session.phase];

        // Определение psychologicalStatus
        let status = 'Оценивает вас';
        if (session.rapport < 0.3) status = 'Избегает контакта';
        if (pm.emotional > 0.7) status = 'На грани истерики';
        if (pm.fatigue > 0.8) status = 'Сильно истощён';
        if (session.stateFlags.defensive) status = 'Агрессивна защита';
        if (bs === 'fractured' || bs === 'collapsed') status = 'Готов расколоться';
        if (session.rapport > 0.7 && pm.total < 0.4) status = 'Идёт на контакт';

        return {
            // Фаза
            phase:            session.phase,
            phaseLabel:       phaseMeta?.label,
            phaseIcon:        phaseMeta?.icon,
            phaseColor:       phaseMeta?.color,
            phaseDescription: phaseMeta?.description,

            // Архетип + тактика
            archetype:    session.psychModel.archetypeLabel,
            archetypeKey: session.psychModel.archetypeKey,
            tactic:       session.tactic?.label ?? '—',
            tacticIcon:   session.tactic?.icon  ?? '',

            // Стресс-метрики
            emotional:   +pm.emotional.toFixed(3),
            logical:     +pm.logical.toFixed(3),
            evidence:    +pm.evidence.toFixed(3),
            fatigue:     +pm.fatigue.toFixed(3),
            social:      +pm.social.toFixed(3),
            total:       +pm.total.toFixed(3),

            // Новые метрики
            cognitiveLoad: +session.cognitiveLoad.toFixed(3),
            rapport:       +session.rapport.toFixed(3),
            psychologicalStatus: status,

            // Слом
            breakIndex:    +bi.toFixed(3),
            breakStage:    bs,
            breakLabel:    pst?.label ?? bs,
            breakColor:    pst?.color ?? '#94a3b8',
            breakIcon:     pst?.icon  ?? '',

            // Статистика
            questionsAsked:       session.questionsAsked,
            exposedContradictions:session.exposedContradictions.length,
            lockedClaims:         session.lockedClaims.length,

            // Флаги
            ...session.stateFlags,

            // Последний ответ
            lastResponseType:  lastAnswer?.responseType  ?? null,
            lastResponseLabel: lastAnswer?.responseLabel ?? null,
            lastResponseIcon:  lastAnswer?.responseIcon  ?? null,
            lastResponseColor: lastAnswer?.responseColor ?? null,

            // Рекомендация
            recommendation: InterrogationDirector.recommend(session),
        };
    }

    // ─── ПРИВАТНЫЕ ────────────────────────────────────────────────────────────

    static _updateStateFlags(session, response) {
        const f = session.stateFlags;
        if (response.kind === 'full_admission')    { f.admittedFull    = true; f.admittedPartial = true; }
        if (response.kind === 'partial_admission') { f.admittedPartial = true; }
        if (response.kind === 'shutdown')          { f.shutdown        = true; }
        if (response.kind === 'anger_response')    { f.defensive       = true; }
        if (session.breakStage === 'cracking' || session.breakStage === 'fractured') { f.unstable = true; }
        if (session.breakStage === 'fractured' || session.breakStage === 'collapsed') { f.breaking = true; }
    }

    // ─── ИЗВЛЕЧЕНИЕ УЛИК ──────────────────────────────────────────────────────

    /**
     * Превращает ответ свидетеля на допросе в официальную улику (протокол).
     * @param {InterrogationSession} session
     * @param {string} answerId
     * @param {string} markStatus - 'confirmed' (За обвинение), 'contradictory' (За защиту)
     */
    static extractEvidence(session, answerId, markStatus) {
        const ae = session.answerHistory.find(a => a.id === answerId);
        if (!ae || ae.extractedStatus) return null;

        ae.extractedStatus = markStatus;

        const evId = `ev_testimony_${Date.now()}`;
        const ev = {
            id: evId,
            type: 'document',
            name: `Показание: ${session.witness.name}`,
            label: `Протокол допроса (${session.witness.name})`,
            description: `Извлечено из допроса:\n«${ae.responseText}»`,
            baseReliability: 0.85,
            confidence: 0.85,
            isFake: false,
            tests: [],
            validTests: [],
            relations: [],
            playerMark: markStatus,
            custody: {
                foundBy: 'Следователь',
                foundAt: 'Допросная комната',
                condition: 'Зафиксировано в протоколе'
            }
        };

        if (session.caseData) {
            if (!session.caseData.evidence) session.caseData.evidence = [];
            session.caseData.evidence.push(ev);
        }

        return ev;
    }
}
