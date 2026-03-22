/**
 * InterrogationSession — мутабельное состояние одного допроса.
 *
 * Создаётся через InterrogationSession.create(witness, caseData).
 * Все поля мутируются InterrogationDirector в процессе допроса.
 */

import { SubjectPsychologyModel } from './SubjectPsychologyModel.js';
import { PressureEngine }         from './PressureEngine.js';
import { recommendTactic }        from './InterrogationTactics.js';

// Фазы допроса
export const PHASES = ['baseline', 'probing', 'containment', 'pressure', 'break', 'closure'];

export const PHASE_META = {
    baseline:    { label: 'Исходная версия',   icon: '📋', color: '#6366f1', description: 'Получить свободный рассказ, зафиксировать базовую версию.' },
    probing:     { label: 'Зондирование',      icon: '🔍', color: '#f59e0b', description: 'Мягкое вскрытие трещин через уточнения и детали.' },
    containment: { label: 'Фиксация',          icon: '🔒', color: '#84cc16', description: 'Запереть свидетеля в конкретной версии перед атакой.' },
    pressure:    { label: 'Давление',          icon: '⚡', color: '#f97316', description: 'Предъявление улик, атака на алиби, повышение цены лжи.' },
    break:       { label: 'Слом',              icon: '💥', color: '#ef4444', description: 'Добивающие вопросы — получить признание или исправление.' },
    closure:     { label: 'Закрытие',          icon: '✅', color: '#22c55e', description: 'Зафиксировать новую версию, не дать откатить назад.' },
};

export class InterrogationSession {

    /**
     * Создаёт новую сессию.
     * @param {Object} witness — Witness из CaseGenerator
     * @param {Object} caseData — активное дело
     * @param {'prosecution'|'defense'} side — сторона допроса
     * @returns {InterrogationSession}
     */
    static create(witness, caseData, side = 'prosecution') {
        const session = new InterrogationSession();
        session.id      = `int_${Date.now()}`;
        session.witness = witness;
        session.caseData = caseData;
        session.side    = side;

        // Психологическая модель
        session.psychModel = SubjectPsychologyModel.fromWitness(witness);

        // Начальная тактика на основе архетипа и фазы
        session.tactic = recommendTactic(session.psychModel.archetypeKey, 'baseline');

        // Давление
        session.pressureState = PressureEngine.INITIAL_STATE();

        // Когнитивная загрузка ложи
        session.cognitiveLoad = session.psychModel.cognitiveLoad;

        // Фаза
        session.phase = 'baseline';

        // Раппорт (Контакт) - инициализируется на основе податливости / эмпатии
        session.rapport = session.psychModel.compliance;
        
        // Отслеживание привыкания (diminishing returns)
        session.tacticUsage = {};
        session.categoryUsage = {};

        // Флаги результата
        session.stateFlags = {
            defensive:      false,
            unstable:       false,
            breaking:       false,
            admittedPartial:false,
            admittedFull:   false,
            shutdown:       false,
        };

        // Открытые / вскрытые противоречия
        session.exposedContradictions = [];
        session.lockedClaims          = [];

        // История допроса — вопросы и ответы
        session.questionHistory = [];
        session.answerHistory   = [];

        // AnswerEvent list
        session.timelineLog = [];

        return session;
    }

    constructor() { /* инициализируется статическим create */ }

    // ── Вычисляемые поля ──────────────────────────────────────────────────────

    get breakIndex() {
        return PressureEngine.breakIndex(
            this.pressureState,
            this.cognitiveLoad,
            this.exposedContradictions.length,
            this.psychModel
        );
    }

    get breakStage() {
        return PressureEngine.breakStage(this.breakIndex);
    }

    get questionsAsked() {
        return this.questionHistory.length;
    }

    get isOver() {
        return this.stateFlags.admittedFull || this.stateFlags.shutdown;
    }

    // ── Логика перехода фаз ───────────────────────────────────────────────────

    /**
     * Проверяет, нужно ли переходить на следующую фазу.
     * Вызывается InterrogationDirector после каждого хода.
     * Учитывает давление, количество вопросов, раппорт и особенности свидетеля.
     * @returns {boolean} true = фаза изменилась
     */
    advancePhaseIfNeeded() {
        const q   = this.questionsAsked;
        const bi  = this.breakIndex;
        const bs  = this.breakStage;
        const exp = this.exposedContradictions.length;
        const pTotal = this.pressureState.total;
        const resistance = this.psychModel.stressTolerance;
        const ego = this.psychModel.ego;

        // Чем выше эго и сопротивление, тем дольше базовая фаза
        const baselineThreshold = 2 + Math.floor(ego * 2);
        const probingLimit = 4 + Math.floor(resistance * 3);

        const phaseTransitions = {
            baseline:    () => q >= baselineThreshold,
            // Переход из зондирования, если нашли 1 противоречие, либо задали много вопросов, либо давление начало расти
            probing:     () => exp >= 1 || pTotal > 0.35 || q >= (baselineThreshold + probingLimit),
            // Фиксация работает до тех пор, пока мы не заперли свидетеля, либо если раппорт упал, а давление выросло
            containment: () => this.lockedClaims.length >= 1 || (pTotal > 0.5 && this.rapport < 0.4) || q >= 10,
            // Давление нужно усиливать до тех пор, пока индекс слома не станет угрожающим
            pressure:    () => bi >= 0.45 || exp >= 2 || q >= 15,
            // Слом происходит, если мы достигли высоких стадий
            break:       () => bs === 'collapsed' || bs === 'fractured',
            closure:     () => false,
        };

        const transition = phaseTransitions[this.phase];
        if (transition && transition()) {
            const idx = PHASES.indexOf(this.phase);
            if (idx < PHASES.length - 1) {
                this.phase = PHASES[idx + 1];
                // Обновляем тактику для новой фазы
                this.tactic = recommendTactic(this.psychModel.archetypeKey, this.phase);
                return true;
            }
        }
        return false;
    }

    /** Добавляет вскрытое противоречие в список */
    exposeContradiction(contradiction) {
        const dup = this.exposedContradictions.find(c => c.id === contradiction.id);
        if (!dup) {
            this.exposedContradictions.push({ ...contradiction, step: this.questionsAsked });
            // Когнитивная нагрузка растёт
            this.cognitiveLoad = this.psychModel.computeLieLoad(
                this.exposedContradictions.length,
                this.lockedClaims.length,
                this.pressureState.fatigue
            );
        }
    }

    /** Фиксирует утверждение (lock_statement) */
    lockClaim(claimText, topic = 'general') {
        this.lockedClaims.push({ text: claimText, topic, step: this.questionsAsked, at: Date.now() });
    }

    /** Сводка сессии */
    summary() {
        return {
            id:                     this.id,
            witnessName:            this.witness?.name,
            archetype:              this.psychModel.archetypeLabel,
            tactic:                 this.tactic?.label,
            phase:                  this.phase,
            questionsAsked:         this.questionsAsked,
            exposedContradictions:  this.exposedContradictions.length,
            lockedClaims:           this.lockedClaims.length,
            breakIndex:             +this.breakIndex.toFixed(3),
            breakStage:             this.breakStage,
            pressureState:          { ...this.pressureState },
            cognitiveLoad:          +this.cognitiveLoad.toFixed(3),
            rapport:                +this.rapport.toFixed(3),
            tacticUsage:            { ...this.tacticUsage },
            stateFlags:             { ...this.stateFlags },
        };
    }
}
