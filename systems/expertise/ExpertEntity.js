/**
 * ExpertEntity.js — Expert как DDD-сущность с инвариантами и доменными событиями.
 *
 * Отличие от ExpertProfile в ExpertModel.js:
 *  - Параметры обёрнуты в иммутабельные Value Objects (SkillLevel и др.)
 *  - Все изменения состояния эмитируют Domain Events
 *  - Метод canPerform() проверяет способность эксперта провести экспертизу
 *  - Строгая валидация через _assertValid()
 *  - toSnapshot()/fromSnapshot() для сохранения состояния
 */

import {
    SkillLevel, BiasLevel, FatigueLevel,
    CorruptionLevel, Reputation,
} from './ValueObjects.js';
import { EVENTS } from './EventBus.js';
import { EXPERT_ARCHETYPES } from '../ExpertModel.js';

const UNIVERSAL_TYPES = new Set(['metadata_analysis', 'gps_tracking', 'document_forgery']);

export class ExpertEntity {

    /**
     * @param {object} props
     * @param {string} props.id
     * @param {string} props.fullName
     * @param {string} props.title
     * @param {string} props.labId
     * @param {string} props.labName
     * @param {string} props.archetype
     * @param {number} props.skill
     * @param {number} props.bias
     * @param {number} props.fatigue
     * @param {number} props.corruption
     * @param {number} props.reputation
     * @param {number} props.experience
     * @param {string[]} props.specialties
     * @param {number}  [props.fee]
     * @param {boolean} [props.conflictOfInterest]
     */
    constructor(props) {
        ExpertEntity._assertValid(props);

        this.id      = props.id;
        this.fullName = props.fullName;
        this.title   = props.title;
        this.labId   = props.labId;
        this.labName = props.labName;
        this.archetype = props.archetype || 'pragmatic';

        // Value Objects (иммутабельные)
        this._skill      = new SkillLevel(props.skill);
        this._bias       = new BiasLevel(props.bias);
        this._fatigue    = new FatigueLevel(props.fatigue ?? 0);
        this._corruption = new CorruptionLevel(props.corruption ?? 0);
        this._reputation = new Reputation(props.reputation ?? 0.70);

        this.experience  = Math.max(0, props.experience ?? 5);
        this.specialties = new Set(props.specialties || []);
        this.fee         = props.fee ?? 1000;
        this.conflictOfInterest = props.conflictOfInterest ?? false;
        this.caseHistory = props.caseHistory || {};

        // Состояние подкупа
        this._isBribed    = false;
        this._bribeAmount = 0;

        // Накопленные события
        this._events = [];
    }

    // ─── Геттеры (иммутабельный доступ к Value Objects) ──────────────────────
    get skill()      { return this._skill.value; }
    get bias()       { return this._bias.value; }
    get fatigue()    { return this._fatigue.value; }
    get corruption() { return this._corruption.value; }
    get reputation() { return this._reputation.value; }
    get isBribed()   { return this._isBribed; }
    get bribeAmount(){ return this._bribeAmount; }
    get isBurnout()  { return this._fatigue.isBurnout(); }

    get skillVO()      { return this._skill; }
    get biasVO()       { return this._bias; }
    get fatigueVO()    { return this._fatigue; }
    get reputationVO() { return this._reputation; }

    // ─── Бизнес-логика ───────────────────────────────────────────────────────

    /**
     * Может ли эксперт провести данный тип экспертизы.
     */
    canPerform(testType) {
        if (this.specialties.has(testType)) return true;
        if (UNIVERSAL_TYPES.has(testType) && this._skill.exceeds(0.70)) return true;
        return false;
    }

    /**
     * Модификатор навыка для типа теста.
     * @param {string} testType
     * @param {number} [practiceCount] — из caseHistory
     * @returns {number}  −0.30 … +0.22
     */
    getSkillModifier(testType) {
        const isSpec      = this.specialties.has(testType);
        const base        = (this._skill.value - 0.50) * 0.40;
        const specBonus   = isSpec ? 0.06 : 0;
        const practice    = this.caseHistory[testType] || 0;
        const pracBonus   = Math.min(Math.log1p(practice) / Math.log1p(50) * 0.05, 0.05);
        const expBonus    = Math.min(this.experience / 30, 1) * 0.02;
        const repBonus    = (this._reputation.value - 0.50) * 0.04;
        const fatigHit    = this._fatigue.value * 0.10;
        const burnoutHit  = this.isBurnout ? 0.08 : 0;
        const biasHit     = this._bias.value * 0.02;

        return +Math.min(Math.max(
            base + specBonus + pracBonus + expBonus + repBonus - fatigHit - burnoutHit - biasHit,
            -0.30
        ), 0.22).toFixed(3);
    }

    /**
     * Применяет смещение эксперта к результату (bias).
     * @param {boolean} tentativeMatch
     * @param {boolean} isGuilty
     * @param {SeededRNG} rng
     * @returns {boolean}
     */
    applyBias(tentativeMatch, isGuilty, rng) {
        if (!this._bias.isSignificant()) return tentativeMatch;
        const flipChance = this._bias.value * 0.20;
        if (!tentativeMatch && isGuilty   && rng.chance(flipChance))       return true;
        if ( tentativeMatch && !isGuilty  && rng.chance(flipChance * 0.5)) return true;
        return tentativeMatch;
    }

    /**
     * Накопление усталости после экспертизы.
     * @param {number} workloadDays
     * @param {EventBus} [bus]
     */
    increaseFatigue(workloadDays, bus) {
        const arch   = EXPERT_ARCHETYPES[this.archetype] || {};
        const rate   = arch.fatigueRate || 0.012;
        this._fatigue = this._fatigue.addDelta(workloadDays * rate);

        if (this.isBurnout && bus) {
            bus.publish(EVENTS.EXPERT_FATIGUED, { expertId: this.id, fatigue: this._fatigue.value });
        }
    }

    /** Восстановление отдыхом. */
    rest() { this._fatigue = this._fatigue.addDelta(-0.20); }

    /**
     * Попытка подкупа.
     * @param {number} amountK — сумма (тыс. руб.)
     * @param {EventBus} bus
     * @param {SeededRNG} rng
     * @returns {{ success: boolean, message: string }}
     */
    attemptBribe(amountK, bus, rng) {
        const bribeStrength = Math.min(amountK / 500, 1.0);
        const chance = Math.min(
            this._corruption.value + bribeStrength * 0.40
            - this._reputation.value * 0.35
            - (this.experience / 30) * 0.10,
            1.0
        );

        if (rng.chance(chance)) {
            this._isBribed    = true;
            this._bribeAmount = amountK;
            this._reputation  = this._reputation.addDelta(-0.06);
            bus?.publish(EVENTS.BRIBE_ACCEPTED, { expertId: this.id, amount: amountK });
            this._events.push({ type: EVENTS.BRIBE_ACCEPTED, amount: amountK });
            return {
                success: true,
                message: `Эксперт ${this.fullName} принял вознаграждение ${amountK} тыс. руб.`,
            };
        }

        bus?.publish(EVENTS.BRIBE_REJECTED, { expertId: this.id, amount: amountK });
        return {
            success: false,
            message: `Эксперт ${this.fullName} отказался. ${this._reputation.value > 0.80 ? 'Намерен уведомить прокуратуру.' : 'Инцидент зафиксирован.'}`,
        };
    }

    /**
     * Обновляет репутацию + кейс-историю после исхода дела.
     * @param {'accurate'|'error'|'bribed'} outcome
     * @param {string} testType
     * @param {EventBus} [bus]
     */
    recordOutcome(outcome, testType, bus) {
        const deltas = { accurate: +0.012, error: -0.040, bribed: -0.180 };
        const delta  = deltas[outcome] ?? 0;
        const prev   = this._reputation.value;
        this._reputation = this._reputation.addDelta(delta);

        if (testType) this.caseHistory[testType] = (this.caseHistory[testType] || 0) + 1;

        bus?.publish(EVENTS.REPUTATION_CHANGED, {
            expertId: this.id,
            prev, next: this._reputation.value, reason: outcome,
        });
    }

    /**
     * Основания для оспаривания экспертизы, связанные с этим экспертом.
     * @returns {string[]}
     */
    getChallengeGrounds() {
        const grounds = [];
        if (this.conflictOfInterest)
            grounds.push('Конфликт интересов: эксперт аффилирован с одной из сторон');
        const courtNote = this._reputation.courtNote();
        if (courtNote) grounds.push(courtNote);
        if (this.isBurnout)
            grounds.push(`Эксперт ${this.fullName} перегружен (fatigue=${Math.round(this._fatigue.value*100)}%) — повышен риск ошибок`);
        if (this._bias.isSignificant())
            grounds.push(`Выраженный обвинительный уклон: ${this._bias.label()}`);
        return grounds;
    }

    /** Карточка для UI. */
    toCard() {
        return {
            name:       `${this.fullName}, ${this.title}`,
            lab:        this.labName,
            rep:        this._reputation.label(),
            repScore:   this._reputation.value,
            archetype:  (EXPERT_ARCHETYPES[this.archetype] || {}).label || this.archetype,
            skill:      this._skill.label(),
            skillPct:   this._skill.pct(),
            fatigue:    this._fatigue.label(),
            burnout:    this.isBurnout,
            fee:        `${this.fee.toLocaleString('ru-RU')} руб.`,
            courtNote:  this._reputation.courtNote(),
        };
    }

    /** Снимок состояния для save/load. */
    toSnapshot() {
        return {
            id: this.id, fullName: this.fullName, title: this.title,
            labId: this.labId, labName: this.labName, archetype: this.archetype,
            skill: this.skill, bias: this.bias, fatigue: this.fatigue,
            corruption: this.corruption, reputation: this.reputation,
            experience: this.experience, fee: this.fee,
            specialties: [...this.specialties],
            conflictOfInterest: this.conflictOfInterest,
            caseHistory: { ...this.caseHistory },
            isBribed: this._isBribed, bribeAmount: this._bribeAmount,
        };
    }

    static fromSnapshot(snap) { return new ExpertEntity(snap); }

    /** Извлечение и сброс накопленных событий. */
    drainEvents() {
        const ev    = [...this._events];
        this._events = [];
        return ev;
    }

    // ─── Валидация ────────────────────────────────────────────────────────────
    static _assertValid(props) {
        if (!props.id)       throw new Error('ExpertEntity: id обязателен');
        if (!props.fullName) throw new Error('ExpertEntity: fullName обязателен');
        if (!props.labId)    throw new Error('ExpertEntity: labId обязателен');
    }
}
