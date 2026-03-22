/**
 * ValueObjects.js — иммутабельные объекты-значения с инвариантами.
 *
 * В DDD Value Object не имеет собственной идентичности — два объекта
 * с одинаковыми значениями равны. Они иммутабельны: изменение создаёт новый объект.
 *
 * Value Objects здесь:
 *  SkillLevel      — навык эксперта (0.10 – 1.00)
 *  BiasLevel       — склонность к обвинению (0.00 – 1.00)
 *  FatigueLevel    — усталость (0.00 – 1.00)
 *  CorruptionLevel — подверженность коррупции (0.00 – 1.00)
 *  Reputation      — репутация в суде (0.01 – 1.00)
 *  Reliability     — научная точность метода (0.10 – 0.9999)
 *  Certainty       — уверенность эксперта в выводе (0.05 – 0.99)
 *  ConfidenceInterval — доверительный интервал [lo, hi]
 *  EvidenceQuality — качество образца (0.05 – 1.05)
 */

const cl = (v, lo, hi) => Math.min(Math.max(+v, lo), hi);

// ─── Базовый класс ────────────────────────────────────────────────────────────
class BoundedValue {
    #v; #lo; #hi; #label;
    constructor(v, lo, hi, label) {
        this.#lo = lo; this.#hi = hi; this.#label = label;
        this.#v = cl(Number(v), lo, hi);
        Object.freeze(this);
    }
    get value()  { return this.#v; }
    get lo()     { return this.#lo; }
    get hi()     { return this.#hi; }

    addDelta(d)  { return new this.constructor(this.#v + d); }
    scale(f)     { return new this.constructor(this.#v * f); }
    exceeds(t)   { return this.#v > t; }
    equals(other){ return other instanceof this.constructor && other.value === this.#v; }
    pct()        { return Math.round(this.#v * 100); }
    toString()   { return `${this.#label}(${this.pct()}%)`; }
    toJSON()     { return this.#v; }
}

// ─── Конкретные типы ─────────────────────────────────────────────────────────

export class SkillLevel extends BoundedValue {
    constructor(v) { super(v, 0.10, 1.00, 'Skill'); }
    label() {
        const v = this.value;
        if (v >= 0.92) return 'Мастер-эксперт';
        if (v >= 0.78) return 'Высококвалифицированный';
        if (v >= 0.60) return 'Опытный';
        return 'Начинающий';
    }
}

export class BiasLevel extends BoundedValue {
    constructor(v) { super(v, 0.00, 1.00, 'Bias'); }
    isSignificant() { return this.value > 0.20; }
    label() {
        const v = this.value;
        if (v < 0.05) return 'Нейтральный';
        if (v < 0.20) return 'Слабый обвинительный уклон';
        if (v < 0.50) return 'Выраженный уклон';
        return 'Высокая предвзятость';
    }
}

export class FatigueLevel extends BoundedValue {
    constructor(v) { super(v, 0.00, 1.00, 'Fatigue'); }
    isBurnout()       { return this.value > 0.80; }
    isSignificant()   { return this.value > 0.50; }
    fatigueMultiplier() { return 1.0 + this.value * 0.15; } // при burnout → ×1.12+
    label() {
        const v = this.value;
        if (v < 0.25) return 'Свежий';
        if (v < 0.55) return 'Умеренно устал';
        if (v < 0.80) return 'Утомлён';
        return '🔴 Burnout';
    }
}

export class CorruptionLevel extends BoundedValue {
    constructor(v) { super(v, 0.00, 1.00, 'Corruption'); }
    bribeThreshold() { return 1.0 - this.value; }
    isHighRisk()     { return this.value > 0.30; }
}

export class Reputation extends BoundedValue {
    constructor(v) { super(v, 0.01, 1.00, 'Reputation'); }
    courtModifier() {
        // Высокая репутация усиливает вес экспертизы
        return (this.value - 0.50) * 0.12;
    }
    courtNote() {
        if (this.value < 0.35)
            return `Суд принимает во внимание оспариваемую репутацию эксперта.`;
        return null;
    }
    label() {
        const v = this.value;
        if (v >= 0.88) return '⭐⭐⭐ Признанный';
        if (v >= 0.70) return '⭐⭐ Опытный';
        if (v >= 0.50) return '⭐ Практик';
        return '⚠️ Спорная репутация';
    }
}

export class Reliability extends BoundedValue {
    constructor(v) { super(v, 0.10, 0.9999, 'Reliability'); }
    isHigh()   { return this.value >= 0.90; }
    isMedium() { return this.value >= 0.70 && this.value < 0.90; }
    label() {
        const v = this.value;
        if (v >= 0.95) return 'Высочайшая';
        if (v >= 0.85) return 'Высокая';
        if (v >= 0.70) return 'Умеренная';
        return 'Низкая';
    }
}

export class Certainty extends BoundedValue {
    constructor(v) { super(v ?? 0.50, 0.05, 0.99, 'Certainty'); }
    level() {
        const v = this.value;
        if (v >= 0.92) return { text: 'Категорическое',      color: '#1a7a3c' };
        if (v >= 0.78) return { text: 'Высокая вероятность', color: '#27ae60' };
        if (v >= 0.62) return { text: 'Вероятное',           color: '#f39c12' };
        if (v >= 0.45) return { text: 'Предположительное',   color: '#e67e22' };
        return              { text: 'Неопределённое',       color: '#c0392b' };
    }
    strengthWord() {
        const v = this.value;
        if (v >= 0.90) return 'категорически';
        if (v >= 0.75) return 'с высокой вероятностью';
        if (v >= 0.55) return 'вероятно';
        return 'предположительно';
    }
}

export class ConfidenceInterval {
    constructor(center, margin) {
        this.lo     = +Math.max(center - margin, 0.01).toFixed(2);
        this.hi     = +Math.min(center + margin, 0.99).toFixed(2);
        this.center = +center.toFixed(2);
        Object.freeze(this);
    }
    contains(v)    { return v >= this.lo && v <= this.hi; }
    width()        { return +(this.hi - this.lo).toFixed(2); }
    /** Ширина отображается в суде: узкий интервал = высокая точность. */
    courtLabel()   { return this.width() < 0.12 ? 'точный' : this.width() < 0.22 ? 'умеренный' : 'широкий'; }
    toString()     { return `[${Math.round(this.lo*100)}–${Math.round(this.hi*100)}%]`; }
    toJSON()       { return [this.lo, this.hi]; }

    /** Фабрика: создаёт ДИ из certainty. Чем ниже certainty, тем шире интервал. */
    static fromCertainty(certainty, rng) {
        const v = certainty instanceof Certainty ? certainty.value : certainty;
        const margin = (1 - v) * 0.35 * (rng ? rng.float(0.6, 1.0) : 0.8);
        return new ConfidenceInterval(v, margin);
    }
}

export class EvidenceQuality {
    constructor({ quality = 0.80, contamination = 0.05, ageDays = 0, chainIntegrity = 1.0 } = {}) {
        this.quality         = cl(quality, 0, 1);
        this.contamination   = cl(contamination, 0, 1);
        this.ageDays         = ageDays;
        this.chainIntegrity  = cl(chainIntegrity, 0, 1);

        this.multiplier      = this._compute();
        this.issues          = this._collectIssues();
        this.chainViolation  = chainIntegrity < 0.70;
        Object.freeze(this);
    }

    _compute() {
        let m = this.quality;
        m -= this.contamination * 0.25;
        if (this.ageDays > 30) m -= Math.min(this.ageDays / 365 * 0.30, 0.30);
        m *= this.chainIntegrity;
        return +cl(m, 0.05, 1.05).toFixed(3);
    }

    _collectIssues() {
        const issues = [];
        if (this.quality < 0.5)            issues.push(`Низкое качество образца (${Math.round(this.quality*100)}%)`);
        if (this.contamination > 0.15)     issues.push(`Контаминация (${Math.round(this.contamination*100)}%)`);
        if (this.ageDays > 30)             issues.push(`Деградация: образцу ${this.ageDays} дней`);
        if (this.chainViolation)           issues.push(`Нарушена цепочка хранения (CoC: ${Math.round(this.chainIntegrity*100)}%)`);
        return issues;
    }

    static fromEvidence(ev) {
        return new EvidenceQuality({
            quality:       ev.quality,
            contamination: ev.contamination,
            ageDays:       ev.ageDays,
            chainIntegrity: ev.chainIntegrity,
        });
    }
}
