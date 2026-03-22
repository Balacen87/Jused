/**
 * ExpertiseOrchestrator.js — главный сервис генерации экспертиз.
 *
 * Паттерн: Service (Application layer) + Pipeline:
 *   validate → load → calculate → simulate → generate → emit → log
 *
 * Получает зависимости через конструктор (Dependency Injection):
 *   - expertRepo  : MemoryExpertRepository (или любой, реализующий интерфейс)
 *   - eventBus    : EventBus
 *   - rng         : SeededRNG
 *
 * Backward-compatible фасад: ExpertiseSystem.js импортирует этот оркестратор
 * и проксирует все старые вызовы.
 */

import { EXPERTISE_CATALOG, EXPERT_ERROR_TYPES } from '../../data/ExpertiseCatalog.js';
import { ExpertModel }       from '../ExpertModel.js';
import { EvidenceQuality, Certainty, ConfidenceInterval } from './ValueObjects.js';
import { DetailStrategyRegistry } from './strategies/DetailStrategies.js';
import { EVENTS }            from './EventBus.js';
import { globalRNG }         from './SeededRNG.js';

const cl = (v, lo, hi) => Math.min(Math.max(+v, lo), hi);

// ─── ExpertiseOrchestrator ────────────────────────────────────────────────────
export class ExpertiseOrchestrator {

    /**
     * @param {object} deps
     * @param {object}   deps.expertRepo  — репозиторий экспертов
     * @param {EventBus} deps.eventBus    — шина событий
     * @param {SeededRNG} deps.rng        — генератор случайных чисел
     */
    constructor({ expertRepo, eventBus, rng } = {}) {
        this.expertRepo = expertRepo || null;
        this.eventBus   = eventBus   || null;
        this.rng        = rng        || globalRNG;
    }

    // ─── Главный метод ────────────────────────────────────────────────────────

    /**
     * Генерация отчёта экспертизы — полный pipeline.
     *
     * @param {string}  testType  — ключ из EXPERTISE_CATALOG
     * @param {object}  evidence  — { quality, contamination, ageDays, chainIntegrity, label, ... }
     * @param {boolean} isGuilty  — истинная виновность
     * @param {object}  [opts]
     * @param {ExpertProfile|ExpertEntity} [opts.expert]   — конкретный эксперт
     * @param {boolean}                   [opts.isFake]
     * @param {boolean}                   [opts.forceLabError]      — для тестов
     * @param {boolean}                   [opts.forceSampleDegraded]— для тестов
     * @returns {ExpertiseReport}
     */
    generateReport(testType, evidence = {}, isGuilty = true, opts = {}) {
        // ── 1. Загрузка метаданных ─────────────────────────────────────────
        const meta = EXPERTISE_CATALOG[testType];
        if (!meta) return this._unknownReport(testType);
        meta.key = testType;

        const rng    = opts.rng || this.rng;
        const expert = opts.expert || ExpertModel.generate(testType);

        // ── 2. Качество улики ──────────────────────────────────────────────
        const evQuality = EvidenceQuality.fromEvidence({
            quality:        evidence.quality        ?? rng.float(0.55, 1.00),
            contamination:  evidence.contamination  ?? rng.float(0.00, 0.20),
            ageDays:        evidence.ageDays        ?? rng.int(0, 60),
            chainIntegrity: evidence.chainIntegrity ?? rng.float(0.60, 1.00),
        });

        // ── 3. Поддельная экспертиза ──────────────────────────────────────
        if (opts.isFake && meta.canFake) {
            return this._fakeReport(testType, meta, expert, isGuilty, evQuality, rng);
        }
        // canFake=false → игнорируем флаг
        const isFake = !!(opts.isFake && meta.canFake);

        // ── 4. Надёжность (научная точность метода × качество улики) ──────
        let reliability = meta.reliability * evQuality.multiplier;
        reliability    *= ExpertModel.labReliabilityMultiplier(expert.labId, testType);

        // ── 5. Навык и ошибка эксперта ────────────────────────────────────
        const skillDelta  = expert.getSkillModifier(testType);
        reliability       = cl(reliability + skillDelta, 0.10, 0.995);

        const expertError = expert.rollExpertError();
        if (expertError.error) reliability = cl(reliability + expertError.impact, 0.05, 1.0);

        // ── 6. Случайные факторы лаборатории / образца ───────────────────
        const labError      = opts.forceLabError      ?? rng.chance(0.08);
        const sampleDegraded = opts.forceSampleDegraded ?? (evQuality.multiplier < 0.75 && rng.chance(0.12));
        if (labError)       reliability = cl(reliability - 0.12, 0.05, 0.995);
        if (sampleDegraded) reliability = cl(reliability - 0.08, 0.05, 0.995);

        const em = meta.errorModel || { falsePositive: 0.03, falseNegative: 0.05, subjective: 0.10 };

        // ── 7. Неопределённый результат ───────────────────────────────────
        const incProb = meta.inconclusiveChance * (1 + (1 - evQuality.multiplier) * 0.5);
        if (rng.chance(incProb)) {
            return this._inconclusiveReport(testType, meta, expert, expertError, reliability, evQuality, rng);
        }

        // ── 8. Основной вывод (error model) ──────────────────────────────
        let actualMatch;
        if (expert.isBribed) {
            actualMatch = !isGuilty; // подкуп → противоположный результат
        } else {
            const subjectiveNoise = rng.float(-em.subjective * 0.5, em.subjective * 0.5);
            actualMatch = isGuilty
                ? rng.chance(1 - em.falseNegative)    // верный guilty-вывод
                : rng.chance(em.falsePositive);        // false positive

            // Применяем bias эксперта
            if (expert.applyBias) {
                actualMatch = expert.applyBias(actualMatch, isGuilty, rng);
            }
            reliability = cl(reliability + subjectiveNoise, 0.05, 0.995);
        }

        // ── 9. Certainty (уверенность эксперта ≠ научная точность) ───────
        const certNoise = rng.float(-0.06, 0.06);
        const certaintyVal = cl(reliability * (actualMatch ? 0.95 : 0.90) + certNoise, 0.05, 0.99);
        const certainty    = new Certainty(certaintyVal);
        const ci           = ConfidenceInterval.fromCertainty(certainty, rng);

        // ── 10. Усталость и запись исхода ─────────────────────────────────
        if (expert.increaseFatigue) expert.increaseFatigue(meta.durationDays || 3, this.eventBus);
        if (expert.caseHistory !== undefined && testType)
            expert.caseHistory[testType] = (expert.caseHistory[testType] || 0) + 1;

        // ── 11. Текст деталей (Strategy) ──────────────────────────────────
        const details = DetailStrategyRegistry.generate(testType, {
            evidence, match: actualMatch, isGuilty, certainty, rng, expert,
            factors: { labError, sampleDegraded, expertError },
        });

        // ── 12. Основания для оспаривания ─────────────────────────────────
        const challengeGrounds = this._buildChallengeGrounds(
            { certainty: certaintyVal, labError, sampleDegraded, expertError,
              chainViolation: evQuality.chainViolation, evidenceIssues: evQuality.issues },
            meta, expert
        );
        const canChallenge = challengeGrounds.length > 0;

        // ── 13. Вес доказательства ────────────────────────────────────────
        const weight = +(reliability * certaintyVal * evQuality.multiplier).toFixed(3);

        // ── 14. Сборка отчёта ─────────────────────────────────────────────
        const report = {
            // Идентификация
            id:        `rpt_${Date.now().toString(36)}_${rng.string(4)}`,
            testType,
            name:      meta.name,
            icon:      meta.icon,
            category:  meta.category,

            // Результат
            match:         actualMatch,
            isGuilty,
            isFake,
            isReliable:    !isFake,
            inconclusive:  false,
            certainty:     +certaintyVal.toFixed(3),
            reliability:   +reliability.toFixed(3),
            confidenceInterval: ci.toJSON(),

            // Текст
            details,
            conclusion:  this._buildConclusion(actualMatch, certainty, labError),
            reasoning:   this._buildReasoning(reliability, certaintyVal, meta, expert, evQuality),

            // Факторы
            labError,
            sampleDegraded,
            expertError:   expertError.error ? expertError : null,
            evidenceIssues: evQuality.issues,
            chainViolation: evQuality.chainViolation,

            // Оспаривание
            canChallenge,
            challengeGrounds,

            // Служебное
            weight,
            meta:          { reliability: meta.reliability, name: meta.name, errorModel: meta.errorModel },
            expert: {
                id:         expert.id,
                name:       expert.name || expert.fullName,
                lab:        expert.labName,
                skill:      expert.skill,
                reputation: expert.reputation,
                isBribed:   expert.isBribed,
                archetype:  expert.archetype,
            },
            generatedAt: Date.now(),
            log:         this._buildLog(testType, meta, expert, evQuality, reliability, certaintyVal, expertError, labError),
        };

        // ── 15. Публикация события ────────────────────────────────────────
        this.eventBus?.publish(EVENTS.EXPERTISE_COMPLETED, {
            reportId:   report.id,
            testType,
            match:      actualMatch,
            certainty:  certaintyVal,
            expertId:   expert.id,
        });

        return report;
    }

    /**
     * Повторная экспертиза с новым экспертом (retest).
     */
    retest(original, evidence, isGuilty, opts = {}) {
        const newExpert = ExpertModel.generate(original.testType);
        const report    = this.generateReport(original.testType, evidence, isGuilty, { ...opts, expert: newExpert });
        report.isRetest = true;
        report.originalReportId = original.id;
        this.eventBus?.publish(EVENTS.RETEST_REQUESTED, { originalId: original.id, newId: report.id });
        return report;
    }

    /**
     * Байесовская агрегация нескольких отчётов → P(guilty | E₁..Eₙ).
     */
    summarize(reports, prior = 0.50) {
        const valid  = reports.filter(r => !r.inconclusive && r.match !== null);
        if (!valid.length) return { posterior: prior, prosecutionScore: prior, defenseScore: 1 - prior, dominant: 'neutral' };

        let logOdds = Math.log(prior / (1 - prior));
        valid.forEach(r => {
            const fp = r.meta?.errorModel?.falsePositive ?? 0.02;
            const fn = r.meta?.errorModel?.falseNegative ?? 0.05;
            const w  = r.weight ?? 1.0;
            const lr = r.match
                ? (1 - fn) / Math.max(fp, 1e-4)
                : fn / Math.max(1 - fp, 1e-4);
            logOdds += Math.log(lr) * w;
        });

        const posterior = cl(1 / (1 + Math.exp(-logOdds)), 0.01, 0.99);
        const dominant  = posterior > 0.55 ? 'prosecution' : posterior < 0.45 ? 'defense' : 'neutral';
        return {
            posterior,
            prosecutionScore: +posterior.toFixed(3),
            defenseScore:     +(1 - posterior).toFixed(3),
            dominant,
            sampleSize: valid.length,
        };
    }

    // ─── Приватные методы ─────────────────────────────────────────────────────

    _buildChallengeGrounds({
        certainty, labError, sampleDegraded, expertError,
        chainViolation, evidenceIssues
    }, meta, expert) {
        const grounds = [];
        if (certainty < 0.65)         grounds.push(`Недостаточная достоверность — ${Math.round(certainty*100)}%`);
        if (labError)                  grounds.push('Нарушение процедуры лаборатории');
        if (sampleDegraded)            grounds.push('Деградация образца');
        if (chainViolation)            grounds.push('Нарушена цепочка хранения (Chain of Custody)');
        if (expertError?.error)        grounds.push(`Ошибка эксперта: ${expertError.label}`);
        if ((meta.errorModel?.subjective ?? 0) > 0.20) grounds.push(`Высокий субъективный элемент (${Math.round((meta.errorModel.subjective)*100)}%)`);
        if (meta.scientificAcceptance < 0.70) grounds.push(`Ограниченная научная признанность (${Math.round(meta.scientificAcceptance*100)}%)`);
        if (evidenceIssues?.length)   grounds.push(...evidenceIssues);
        // Из ExpertEntity
        if (expert.getChallengeGrounds) grounds.push(...expert.getChallengeGrounds());
        else {
            if (expert.conflictOfInterest) grounds.push('Конфликт интересов');
            if (expert.fatigue > 0.80)     grounds.push(`Эксперт перегружен (fatigue=${Math.round(expert.fatigue*100)}%)`);
        }
        return [...new Set(grounds)];
    }

    _buildConclusion(match, certainty, labError) {
        const sw   = certainty.strengthWord ? certainty.strengthWord() : (match ? 'подтверждает' : 'опровергает');
        const action = match ? 'подтверждает причастность' : 'опровергает причастность';
        const warn   = labError ? ' ⚠️ Возможна лабораторная погрешность.' : '';
        return `Результат экспертизы ${sw} ${action} обвиняемого.${warn}`;
    }

    _buildReasoning(reliability, certainty, meta, expert, evQuality) {
        return [
            `Метод: ${meta.name} — научная признанность ${Math.round(meta.scientificAcceptance*100)}%.`,
            `Надёжность: ${Math.round(reliability*100)}% (базовая ${Math.round(meta.reliability*100)}%, качество улики ×${evQuality.multiplier}).`,
            `Эксперт: ${expert.name || expert.fullName}, навык ${Math.round(expert.skill*100)}%, усталость ${Math.round(expert.fatigue*100)}%.`,
            `Уверенность эксперта: ${Math.round(certainty*100)}%.`,
        ].join(' ');
    }

    _buildLog(testType, meta, expert, evQuality, reliability, certainty, expertError, labError) {
        const log = [
            `[EXPERTISE ${testType.toUpperCase()}]`,
            `  Эксперт: ${expert.name || expert.fullName} (${expert.labName})`,
            `  Надёжность метода: ${Math.round(meta.reliability*100)}%`,
            `  Качество улики: multiplier=${evQuality.multiplier}, issues=${evQuality.issues.length}`,
            `  Итоговая надёжность: ${Math.round(reliability*100)}%`,
            `  Уверенность: ${Math.round(certainty*100)}%`,
        ];
        if (labError)          log.push('  ⚠️ Лабораторная ошибка применена');
        if (expertError?.error) log.push(`  ⚠️ Ошибка эксперта: ${expertError.label}`);
        if (evQuality.chainViolation) log.push('  ⚠️ Нарушена цепочка хранения');
        return log.join('\n');
    }

    _fakeReport(testType, meta, expert, isGuilty, evQuality, rng) {
        const details = DetailStrategyRegistry.generate(testType, {
            evidence: {}, match: !isGuilty, isGuilty,
            certainty: new Certainty(0.99), rng, expert, factors: {},
        });
        return {
            id: `rpt_fake_${Date.now().toString(36)}_${rng.string(4)}`,
            testType, name: meta.name, icon: meta.icon, category: meta.category,
            match: !isGuilty, isGuilty, isFake: true, isReliable: false,
            inconclusive: false,
            certainty: 1.0,
            reliability: 0.99,
            confidenceInterval: [0.98, 1.00],
            details: `[ФАЛЬСИФИКАЦИЯ] ⚠️ ${details}\n⚠️ Статистически аномальный результат (certainty=100%).`,
            conclusion: 'Результат категорически опровергает причастность. ⚠️ Признаки фальсификации.',
            reasoning: 'Результат статистически невозможен — вероятно, фальсификация.',
            labError: false, sampleDegraded: false, expertError: null,
            evidenceIssues: [], chainViolation: false,
            canChallenge: true,
            challengeGrounds: ['Статистически аномальная достоверность (100%)', 'Признаки фальсификации'],
            weight: 0.1,
            meta: { reliability: meta.reliability, name: meta.name, errorModel: meta.errorModel },
            expert: { id: expert.id, name: expert.name || expert.fullName, isBribed: expert.isBribed },
            generatedAt: Date.now(),
            log: `[FAKE REPORT] ${testType}`,
        };
    }

    _inconclusiveReport(testType, meta, expert, expertError, reliability, evQuality, rng) {
        this.eventBus?.publish(EVENTS.EXPERTISE_INCONCLUSIVE, { testType, expertId: expert.id });
        return {
            id: `rpt_inc_${Date.now().toString(36)}_${rng.string(4)}`,
            testType, name: meta.name, icon: meta.icon, category: meta.category,
            match: null, isGuilty: null, isFake: false, isReliable: true,
            inconclusive: true,
            certainty: 0,
            reliability: +reliability.toFixed(3),
            confidenceInterval: null,
            details: `Результат неопределённый. Качество образца недостаточно для категорического заключения. ${evQuality.issues.length ? 'Выявлено: ' + evQuality.issues.join('; ') + '.' : ''}`,
            conclusion: 'Экспертиза не даёт однозначного ответа. Рекомендуется повторная экспертиза.',
            reasoning: `Вероятность inconclusive: ${Math.round(meta.inconclusiveChance*100)}%. Множитель качества: ${evQuality.multiplier}.`,
            labError: false, sampleDegraded: false, expertError: expertError.error ? expertError : null,
            evidenceIssues: evQuality.issues, chainViolation: evQuality.chainViolation,
            canChallenge: true,
            challengeGrounds: ['Неопределённый результат — рекомендуется повторная экспертиза'],
            weight: 0,
            meta: { reliability: meta.reliability, name: meta.name, errorModel: meta.errorModel },
            expert: { id: expert.id, name: expert.name || expert.fullName },
            generatedAt: Date.now(),
            log: `[INCONCLUSIVE] ${testType}`,
        };
    }

    _unknownReport(testType) {
        return {
            id: `rpt_err_${Date.now().toString(36)}`, testType,
            name: testType, icon: '❓', category: 'unknown',
            match: null, isGuilty: null, isFake: false, isReliable: false,
            inconclusive: true, certainty: 0, reliability: 0, confidenceInterval: null,
            details: `Тип экспертизы "${testType}" не найден в каталоге.`,
            conclusion: 'Ошибка: тип экспертизы не поддерживается.', reasoning: '',
            labError: false, sampleDegraded: false, expertError: null,
            evidenceIssues: [], chainViolation: false,
            canChallenge: false, challengeGrounds: [],
            weight: 0, meta: null, expert: null, generatedAt: Date.now(), log: `[ERROR] Unknown testType: ${testType}`,
        };
    }
}
