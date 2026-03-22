/**
 * SimulationEngineTests.js — тесты для нового AAA Simulation Engine.
 * Проверяем детерминированность (seed) и обратную совместимость VerdictSystem.
 */

import { SimulationEngine } from '../simulation/SimulationEngine.js';
import { VerdictSystem }    from '../systems/VerdictSystem.js';

// Простейший mock CaseGenerator для предсказуемых тестов
class MockCaseGenerator {
    generate(rankName, seed) {
        // Всегда возвращает одно и то же дело, чтобы изолированно тестировать TrialSimulation
        return {
            id: 'mock-case-' + seed,
            type: 'murder',
            defendantName: 'Джон Доу',
            trueScenario: { isGuilty: true, victimName: 'Джейн Доу' },
            witnesses: [
                { id: 'w1', name: 'Алиса', traits: ['honest'], statement: 'Я видела его там.' },
                { id: 'w2', name: 'Боб', traits: ['nervous', 'liar'], statement: 'Он был со мной.', confirmsAlibi: true }
            ],
            evidence: [
                { id: 'e1', label: 'Орудие', type: 'physical', tests: [{ type: 'fingerprint_test', status: 'match' }], confidence: 0.9 },
                { id: 'e2', label: 'Волосы', type: 'biological', tests: [{ type: 'dna_test', status: 'no_match' }], confidence: 0.8 }
            ]
        };
    }
}

let _passed = 0, _failed = 0, _suite = '';
const log = [];

function describe(name, fn) { _suite = name; fn(); _suite = ''; }

function it(name, fn) {
    const full = _suite ? `${_suite} → ${name}` : name;
    try {
        fn();
        _passed++;
        log.push({ ok: true, name: full });
        console.log(`✅ ${full}`);
    } catch (e) {
        _failed++;
        log.push({ ok: false, name: full, error: e.stack });
        console.error(`❌ ${full}:`, e.message);
    }
}

function expect(val) {
    return {
        toBe: (exp) => { if (val !== exp) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
        toEqual: (exp) => { if (JSON.stringify(val) !== JSON.stringify(exp)) throw new Error(`Deep equal failed: Expected ${JSON.stringify(exp)} \nGot: ${JSON.stringify(val)}`); },
        toBeTrue: () => { if (val !== true) throw new Error(`Expected true, got ${val}`); },
        toBeDefined: () => { if (val === undefined || val === null) throw new Error(`Expected defined, got ${val}`); },
    };
}

// ─── Тесты VerdictSystem ───────────────────────────────────────────────────

describe('VerdictSystem Contract', () => {
    it('evaluate() сохраняет старый контракт', () => {
        const activeCase = { trueScenario: { isGuilty: true } };
        // Игрок угадал
        const resCorrect = VerdictSystem.evaluate('guilty', activeCase);
        expect(resCorrect.isCorrect).toBeTrue();
        expect(resCorrect.score).toBe(100);

        // Игрок ошибся
        const resWrong = VerdictSystem.evaluate('innocent', activeCase);
        expect(resWrong.isCorrect).toBe(false);
        expect(resWrong.score).toBe(-50);
    });
});

// ─── Тесты SimulationEngine ────────────────────────────────────────────────

describe('SimulationEngine Determinism', () => {
    it('runCase() с одинаковым seed возвращает идентичный FullCaseResult', () => {
        const engine = new SimulationEngine({ caseGenerator: new MockCaseGenerator() });
        
        // Первый запуск
        const result1 = engine.runCase({ seed: 'test-seed-123' });
        
        // Второй запуск
        const result2 = engine.runCase({ seed: 'test-seed-123' });

        // Ожидаем побитовое совпадение TrialReport (исключаем simulatedAt)
        const normalize = (res) => {
            const copy = JSON.parse(JSON.stringify(res));
            delete copy.simulatedAt;
            delete copy.trial.simulatedAt;
            if (copy.trial?.contradictions?.list) {
                copy.trial.contradictions.list.forEach(c => {
                    delete c.id;
                    delete c.discoveredAt;
                });
            }
            return copy;
        };

        const norm1 = normalize(result1);
        const norm2 = normalize(result2);

        expect(norm1).toEqual(norm2);
    });

    it('runCase() с разными seed возвращает разные результаты', () => {
        const engine = new SimulationEngine({ caseGenerator: new MockCaseGenerator() });
        
        const result1 = engine.runCase({ seed: 'seed-A' });
        const result2 = engine.runCase({ seed: 'seed-B' });

        // Так как JuryAI использует seed для генерации смещения присяжных (guiltBias) и джиттера при голосовании,
        // голоса присяжных (их score/confidence) должны отличаться.
        
        const norm1 = JSON.stringify(result1.trial.jury.jurorVotes);
        const norm2 = JSON.stringify(result2.trial.jury.jurorVotes);

        if (norm1 === norm2) {
            throw new Error('Ожидались разные результаты присяжных из-за разных seed, но они совпали.');
        }
        expect(true).toBeTrue(); // Pass
    });
});

export function runSimulationTests() {
    console.log('--- STARTING SIMULATION TESTS ---');
    // Запускаем тесты
    return { passed: _passed, failed: _failed, details: log };
}

// Сразу запускаем
runSimulationTests();
