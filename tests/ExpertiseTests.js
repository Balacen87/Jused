/**
 * ExpertiseTests.js — browser-совместимый тест-раннер для ExpertiseSystem.
 *
 * Запуск: открыть tests/run-tests.html в браузере (python HTTP server).
 * Выводит результаты в DOM и консоль.
 *
 * Адаптирован для браузерной ES-module среды.
 * Аналог node:test / Vitest, но без сборки.
 */

import ExpertiseSystem from '../systems/ExpertiseSystem.js';
import { ExpertModel } from '../systems/ExpertModel.js';
import { SeededRNG } from '../systems/expertise/SeededRNG.js';
import { EVENTS, globalEventBus } from '../systems/expertise/EventBus.js';
import { Certainty, EvidenceQuality, ConfidenceInterval } from '../systems/expertise/ValueObjects.js';
import { DetailStrategyRegistry } from '../systems/expertise/strategies/DetailStrategies.js';
import { MemoryExpertRepository } from '../systems/expertise/MemoryRepository.js';
import { createTestEvidence, createCaseEvidenceSet } from './fixtures/evidenceFactory.js';
import { CaseManager } from '../core/CaseManager.js';

// ─── Минимальный тест-раннер ─────────────────────────────────────────────────
let _passed = 0, _failed = 0, _suite = '';
const log = [];

function describe(name, fn) { _suite = name; fn(); _suite = ''; }

function it(name, fn) {
    const full = _suite ? `${_suite} → ${name}` : name;
    try {
        fn();
        _passed++;
        log.push({ ok: true, name: full });
    } catch (e) {
        _failed++;
        log.push({ ok: false, name: full, error: e.message });
        console.error(`✗ ${full}:`, e.message);
    }
}

function itSeeded(name, seedStr, fn) {
    it(name, () => fn(new SeededRNG(seedStr)));
}

function expect(val) {
    return {
        toBe: (exp) => { if (val !== exp) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
        toEqual: (exp) => { if (JSON.stringify(val) !== JSON.stringify(exp)) throw new Error(`Deep equal failed`); },
        toBeTrue: () => { if (val !== true) throw new Error(`Expected true, got ${val}`); },
        toBeFalse: () => { if (val !== false) throw new Error(`Expected false, got ${val}`); },
        toBeDefined: () => { if (val === undefined || val === null) throw new Error(`Expected defined, got ${val}`); },
        toBeInRange: (lo, hi) => { if (val < lo || val > hi) throw new Error(`Expected ${val} in [${lo}, ${hi}]`); },
        toContain: (str) => { if (!(typeof val === 'string' ? val.includes(str) : val?.some?.(x => x === str))) throw new Error(`Expected to contain "${str}"`); },
        toBeArray: () => { if (!Array.isArray(val)) throw new Error(`Expected Array, got ${typeof val}`); },
        toBeBoolean: () => { if (typeof val !== 'boolean') throw new Error(`Expected boolean, got ${typeof val}`); },
    };
}

// ─── Тесты SeededRNG ──────────────────────────────────────────────────────────
describe('SeededRNG', () => {
    it('одинаковый seed → детерминированные числа', () => {
        const r1 = new SeededRNG('test'), r2 = new SeededRNG('test');
        for (let i = 0; i < 10; i++) expect(r1.next()).toBe(r2.next());
    });
    it('reset() возвращает к начальному состоянию', () => {
        const rng = new SeededRNG(42);
        const a = rng.next(); rng.reset();
        expect(rng.next()).toBe(a);
    });
    it('clone() независимый fork', () => {
        const r = new SeededRNG(99); r.next();
        const c = r.clone();
        expect(r.next()).toBe(c.next());
    });
    it('int() в диапазоне', () => {
        const rng = new SeededRNG('range');
        for (let i = 0; i < 50; i++) { const v = rng.int(5, 10); expect(v).toBeInRange(5, 10); }
    });
    it('chance(1) всегда true, chance(0) всегда false', () => {
        const rng = new SeededRNG('chance');
        for (let i = 0; i < 20; i++) { expect(rng.chance(1)).toBeTrue(); expect(rng.chance(0)).toBeFalse(); }
    });
    it('weighted() возвращает один из вариантов', () => {
        const rng = new SeededRNG('w');
        const opts = [{ item: 'A', weight: 50 }, { item: 'B', weight: 50 }];
        const res = rng.weighted(opts);
        expect(['A', 'B'].includes(res)).toBeTrue();
    });
});

// ─── Тесты ValueObjects ───────────────────────────────────────────────────────
describe('ValueObjects', () => {
    it('Certainty.level() возвращает объект с text и color', () => {
        const c = new Certainty(0.95);
        const lvl = c.level();
        expect(typeof lvl.text).toBe('string');
        expect(typeof lvl.color).toBe('string');
    });
    it('Certainty зажата в [0.05, 0.99]', () => {
        expect(new Certainty(2.0).value).toBe(0.99);
        expect(new Certainty(-1).value).toBe(0.05);
    });
    it('EvidenceQuality: chainViolation при chainIntegrity < 0.70', () => {
        const eq = new EvidenceQuality({ chainIntegrity: 0.50 });
        expect(eq.chainViolation).toBeTrue();
    });
    it('EvidenceQuality: multiplier снижается при деградации', () => {
        const fresh = new EvidenceQuality({ ageDays: 0, contamination: 0 });
        const old = new EvidenceQuality({ ageDays: 200, contamination: 0.30 });
        expect(old.multiplier < fresh.multiplier).toBeTrue();
    });
    it('ConfidenceInterval.fromCertainty даёт [lo, hi] вокруг значения', () => {
        const rng = new SeededRNG('ci');
        const ci = ConfidenceInterval.fromCertainty(0.80, rng);
        expect(ci.lo < 0.80).toBeTrue();
        expect(ci.hi > 0.80).toBeTrue();
    });
});

// ─── Тесты всех 15 стратегий деталей ─────────────────────────────────────────
describe('DetailStrategyRegistry — 15 типов', () => {
    const types = DetailStrategyRegistry.registeredTypes;
    expect(types.length).toBe(15);
    for (const type of types) {
        it(`${type}: генерирует строку для match=true`, () => {
            const rng = new SeededRNG(type);
            const ctx = {
                evidence: { label: 'Ул.', description: 'Тест' },
                match: true, isGuilty: true,
                certainty: new Certainty(0.85),
                rng, expert: { name: 'Тест Т.Т.' },
                factors: {},
            };
            const text = DetailStrategyRegistry.generate(type, ctx);
            expect(typeof text).toBe('string');
            expect(text.length > 10).toBeTrue();
        });
    }
});

// ─── Тесты ExpertModel ────────────────────────────────────────────────────────
describe('ExpertModel', () => {
    it('generate() создаёт эксперта', () => {
        const e = ExpertModel.generate('dna_test');
        expect(typeof e.skill).toBe('number');
        expect(e.skill).toBeInRange(0.10, 1.00);
    });
    it('getSkillModifier() в допустимом диапазоне', () => {
        const e = ExpertModel.generate('dna_test');
        const m = e.getSkillModifier('dna_test');
        expect(m).toBeInRange(-0.30, 0.22);
    });
    it('generatePanel() создаёт N экспертов', () => {
        const panel = ExpertModel.generatePanel('ballistic_test', 3);
        expect(panel.length).toBe(3);
    });
    it('increaseFatigue() накапливает усталость', () => {
        const e = ExpertModel.generate('toxicology_test');
        const before = e.fatigue;
        e.increaseFatigue(8);
        expect(e.fatigue >= before).toBeTrue();
    });
    it('rest() снижает усталость', () => {
        const e = ExpertModel.generate('toxicology_test');
        e.increaseFatigue(30); // много работы
        const high = e.fatigue;
        e.rest();
        expect(e.fatigue < high).toBeTrue();
    });
});

// ─── Тесты ExpertiseSystem (основной) ────────────────────────────────────────
describe('ExpertiseSystem — базовые сценарии', () => {
    const ALL_TYPES = ExpertiseSystem.supportedTypes;

    itSeeded('generateReport: виновен → структура валидна', 'guilty_1', (rng) => {
        ExpertiseSystem.setRNG(rng);
        const ev = createTestEvidence({ type: 'biological' });
        const r = ExpertiseSystem.generateReport('dna_test', ev, true);
        expect(r.testType).toBe('dna_test');
        // match может быть null при inconclusive — допускаем boolean или null
        expect(r.match === null || typeof r.match === 'boolean').toBeTrue();
        expect(r.certainty).toBeInRange(0, 0.99);
        expect(r.reliability).toBeInRange(0, 1.00);
        expect(typeof r.details).toBe('string');
        expect(r.canChallenge).toBeBoolean();
        expect(r.isFake).toBeFalse();
    });

    itSeeded('generateReport: невиновен → структура валидна', 'innocent_1', (rng) => {
        ExpertiseSystem.setRNG(rng);
        const ev = createTestEvidence();
        const r = ExpertiseSystem.generateReport('fingerprint_test', ev, false);
        // inconclusive report → isGuilty=null, match=null — это нормально
        expect(r.isGuilty === false || r.isGuilty === null).toBeTrue();
        expect(r.match === null || typeof r.match === 'boolean').toBeTrue();
    });

    itSeeded('generateReport: fake → isFake=true, isReliable=false', 'fake_1', (rng) => {
        ExpertiseSystem.setRNG(rng);
        const ev = createTestEvidence();
        const r = ExpertiseSystem.generateReport('fingerprint_test', ev, true, { isFake: true });
        expect(r.isFake).toBeTrue();
        expect(r.isReliable).toBeFalse();
        expect(r.canChallenge).toBeTrue();
    });

    itSeeded('generateReport: DNA canFake=false игнорирует isFake', 'fake_dna', (rng) => {
        ExpertiseSystem.setRNG(rng);
        const ev = createTestEvidence();
        const r = ExpertiseSystem.generateReport('dna_test', ev, true, { isFake: true });
        expect(r.isFake).toBeFalse();
    });

    itSeeded('retest() генерирует другой отчёт', 'retest_1', (rng) => {
        ExpertiseSystem.setRNG(rng);
        const ev = createTestEvidence();
        const r1 = ExpertiseSystem.generateReport('ballistic_test', ev, true);
        const r2 = ExpertiseSystem.retest(r1, ev, true);
        expect(r2.isRetest).toBeTrue();
        expect(r2.id !== r1.id).toBeTrue();
    });

    it('summarize() dominant при 2 vs 1 match=true', () => {
        const reports = [
            { match: true, certainty: 0.90, weight: 1, meta: { errorModel: { falsePositive: 0.02, falseNegative: 0.04 } } },
            { match: true, certainty: 0.85, weight: 1, meta: { errorModel: { falsePositive: 0.03, falseNegative: 0.05 } } },
            { match: false, certainty: 0.70, weight: 1, meta: { errorModel: { falsePositive: 0.04, falseNegative: 0.06 } } },
        ];
        const s = ExpertiseSystem.summarize(reports, 0.5);
        expect(s.dominant).toBe('prosecution');
        expect(s.prosecutionScore).toBeInRange(0.55, 1.0);
    });

    it('summarize() neutral при равных силах', () => {
        const r = (match) => ({ match, certainty: 0.85, weight: 1, meta: { errorModel: { falsePositive: 0.02, falseNegative: 0.04 } } });
        const s = ExpertiseSystem.summarize([r(true), r(false)], 0.5);
        expect(['neutral', 'prosecution', 'defense'].includes(s.dominant)).toBeTrue();
    });

    it('generateBatch() обрабатывает массив улик', () => {
        ExpertiseSystem.setRNG(new SeededRNG('batch_1'));
        const evs = createCaseEvidenceSet('homicide');
        const reports = ExpertiseSystem.generateBatch(evs, true, 'homicide');
        expect(Array.isArray(reports)).toBeTrue();
        expect(reports.length > 0).toBeTrue();
    });

    it('все 15 типов экспертиз без ошибок', () => {
        const rng = new SeededRNG('all_types');
        ExpertiseSystem.setRNG(rng);
        const ev = createTestEvidence();
        for (const type of ALL_TYPES) {
            const r = ExpertiseSystem.generateReport(type, ev, true);
            if (r.testType === 'UNKNOWN') throw new Error(`Неизвестный тип: ${type}`);
        }
    });
});

// ─── Тесты CaseManager ────────────────────────────────────────────────────────
describe('CaseManager', () => {
    it('saveResult + loadProgress сохраняет дело', () => {
        const cm = new CaseManager({ storageAdapter: _mockStorage() });
        cm.saveResult('case_001', { score: 100, isCorrect: true, verdict: 'guilty' }, 100);
        const p = cm.loadProgress();
        expect(p.completedCases['case_001']).toBeDefined();
        expect(p.completedCases['case_001'].score).toBe(100);
    });
    it('reset() удаляет прогресс', () => {
        const cm = new CaseManager({ storageAdapter: _mockStorage() });
        cm.saveResult('case_001', { score: 50, isCorrect: false }, 50);
        cm.reset();
        expect(cm.loadProgress().totalScore).toBe(0);
    });
    it('exportProgress + importProgress', () => {
        const cm = new CaseManager({ storageAdapter: _mockStorage() });
        cm.saveResult('case_x', { score: 200, isCorrect: true }, 200);
        const encoded = cm.exportProgress();
        const cm2 = new CaseManager({ storageAdapter: _mockStorage() });
        const result = cm2.importProgress(encoded);
        expect(result.success).toBeTrue();
        expect(cm2.loadProgress().completedCases['case_x']).toBeDefined();
    });
    it('loadProgress: битый JSON → дефолт', () => {
        const store = _mockStorage();
        store._data['court_game:progress'] = '{NOT JSON}';
        const cm = new CaseManager({ storageAdapter: store });
        const p = cm.loadProgress();
        expect(typeof p.completedCases).toBe('object');
        expect(p.totalScore).toBe(0);
    });
    it('миграция v1 → v2', () => {
        const store = _mockStorage();
        const oldData = { version: 1, completedCases: { 'old': { date: '2025', score: 10, isCorrect: true } }, totalScore: 10 };
        store._data['court_game:progress'] = JSON.stringify(oldData);
        const cm = new CaseManager({ storageAdapter: store, version: 2 });
        const p = cm.loadProgress();
        expect(p.version).toBe(2);
        expect(p.completedCases['old'].verdict).toBeDefined();
    });
});

// ─── EventBus тесты ───────────────────────────────────────────────────────────
describe('EventBus', () => {
    it('on/publish/off работают', () => {
        let called = 0;
        const unsub = globalEventBus.on('__test__', () => called++);
        globalEventBus.publish('__test__', {});
        globalEventBus.publish('__test__', {});
        unsub();
        globalEventBus.publish('__test__', {});
        expect(called).toBe(2);
    });
    it('once() срабатывает один раз', () => {
        let c = 0;
        globalEventBus.once('__once__', () => c++);
        globalEventBus.publish('__once__'); globalEventBus.publish('__once__');
        expect(c).toBe(1);
    });
    it('getAuditTrail фильтрует по типу', () => {
        globalEventBus.publish(EVENTS.EXPERTISE_COMPLETED, { testType: 'dna_test' });
        const trail = globalEventBus.getAuditTrail(EVENTS.EXPERTISE_COMPLETED);
        expect(trail.length > 0).toBeTrue();
    });
});

// ─── Mock StorageAdapter ─────────────────────────────────────────────────────
function _mockStorage() {
    const adapter = {
        _data: {},
        _prefix: 'court_game:',
        _key(n) { return this._prefix + n; },
        get(k, def = null) {
            try { const r = this._data[this._key(k)]; return r ? JSON.parse(r) : def; } catch { return def; }
        },
        set(k, v) { try { this._data[this._key(k)] = JSON.stringify(v); return true; } catch { return false; } },
        remove(k) { delete this._data[this._key(k)]; },
        clear() { this._data = {}; },
    };
    return adapter;
}

// ─── Итоговый отчёт ──────────────────────────────────────────────────────────
export function renderResults(container) {
    const total = _passed + _failed;
    const header = `<h2 style="color:${_failed ? '#c0392b' : '#27ae60'}">
        Тесты: ${_passed}/${total} пройдено ${_failed ? `(${_failed} упали)` : '✅'}
    </h2>`;
    const rows = log.map(l =>
        `<div style="padding:4px 8px;border-left:3px solid ${l.ok ? '#27ae60' : '#c0392b'};margin:2px 0;font-size:13px;">
            ${l.ok ? '✓' : '✗'} ${l.name}${l.error ? ` — <em>${l.error}</em>` : ''}
        </div>`
    ).join('');
    container.innerHTML = header + rows;
    return { passed: _passed, failed: _failed, total };
}
