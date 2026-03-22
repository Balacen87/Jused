/**
 * ConsequenceManager.js v2 — менеджер последствий решений судьи.
 *
 * Улучшения (code review):
 *  - Инстанцируемый класс с DI: storage, career, rng
 *  - EventTarget: headline:generated, echo:scheduled, echo:triggered, feature:unlocked, case:generated
 *  - HEADLINE_TEMPLATES — 3+ варианта для каждого из 4 исходов с весами
 *  - ECHO_EFFECTS — реестр зарегистрированных эффектов (5 типов)
 *  - scheduleEcho() + _persistEchoes() — персистентность через storage
 *  - onCaseCompleted() — автоматическая обработка триггеров
 *  - generateHeadline() — взвешенный выбор + _interpolate()
 *  - getActiveEchoes(), getEchoHistory(), getConsequenceSummary() — для UI
 *  - Backward-compat: статические prокси generateHeadline/createEcho сохранены
 */

import { SeededRNG } from './expertise/SeededRNG.js';

// ─── HEADLINE_TEMPLATES ───────────────────────────────────────────────────────

/** @type {Record<string, Array<{title:string,text:string,sentiment:string,weight:number,echo?:object}>>} */
export const HEADLINE_TEMPLATES = {
    correct_guilty: [
        {
            title: 'СПРАВЕДЛИВОСТЬ ВОСТОРЖЕСТВОВАЛА!',
            text: 'Опасный преступник, обвиняемый в «{caseDesc}», отправлен за решётку благодаря твёрдой руке судьи.',
            sentiment: 'positive', weight: 1.0,
        },
        {
            title: 'ПРЕСТУПНИК ПОЛУЧИЛ ПО ЗАСЛУГАМ',
            text: 'Суд вынес обвинительный приговор по делу о «{caseDesc}». Общество одобряет решение.',
            sentiment: 'positive', weight: 0.8,
        },
        {
            title: 'ЗАКОН ПОБЕДИЛ',
            text: 'Виновный в «{caseDesc}» осуждён. Правосудие восстановлено. {defendant} получил заслуженный приговор.',
            sentiment: 'positive', weight: 0.6,
        },
        {
            title: 'ПРАВОСУДИЕ ВОСТОРЖЕСТВОВАЛО',
            text: 'По итогам судебного процесса {defendant} признан виновным. Адвокаты заявили о намерении подать апелляцию.',
            sentiment: 'positive', weight: 0.5,
        },
    ],
    correct_innocent: [
        {
            title: 'ЧЕСТНОЕ ИМЯ ВОССТАНОВЛЕНО',
            text: 'Суд оправдал невиновного в деле о «{caseDesc}». Общественность приветствует мудрое решение.',
            sentiment: 'positive', weight: 1.0,
        },
        {
            title: 'ТРАГИЧЕСКОЙ ОШИБКИ УДАЛОСЬ ИЗБЕЖАТЬ',
            text: '{defendant} выходит на свободу! Судья взвесил все доказательства и оправдал обвиняемого.',
            sentiment: 'positive', weight: 0.8,
        },
        {
            title: 'СПРАВЕДЛИВОСТЬ ДЛЯ НЕВИНОВНОГО',
            text: 'Суд признал {defendant} невиновным по делу о «{caseDesc}». Правозащитники приветствуют решение.',
            sentiment: 'positive', weight: 0.6,
        },
    ],
    error_guilty: [
        {
            title: 'ХИЩНИК НА СВОБОДЕ',
            text: 'Шок в зале суда! Несмотря на улики, обвиняемый в «{caseDesc}» признан невиновным. Кто следующий?',
            sentiment: 'negative', weight: 1.0,
            echo: { type: 'repeat_offense', severity: 'high' },
        },
        {
            title: 'ПРОВАЛ СИСТЕМЫ',
            text: 'Подозреваемый в «{caseDesc}» избежал наказания. Эксперты критикуют судебное решение.',
            sentiment: 'negative', weight: 0.8,
            echo: { type: 'public_distrust', severity: 'medium' },
        },
        {
            title: 'ПРЕСТУПНИКА ОТПУСТИЛИ',
            text: 'Суд освободил {defendant}, хотя улики указывали на вину. Прокуратура намерена обжаловать приговор.',
            sentiment: 'negative', weight: 0.6,
            echo: { type: 'repeat_offense', severity: 'medium' },
        },
    ],
    error_innocent: [
        {
            title: 'СУДЕБНАЯ ОШИБКА: ТРАГЕДИЯ НЕВИНОВНОГО',
            text: 'Человек осуждён за преступление, которого не совершал. Доверие к системе подорвано.',
            sentiment: 'negative', weight: 1.0,
            echo: { type: 'wrongful_conviction', severity: 'critical' },
        },
        {
            title: 'ПРАВОСУДИЕ ДАЛО СБОЙ',
            text: '{defendant} осуждён, несмотря на сомнения в виновности. Адвокаты требуют пересмотра.',
            sentiment: 'negative', weight: 0.8,
            echo: { type: 'public_distrust', severity: 'high' },
        },
        {
            title: 'ТРАГЕДИЯ В ЗАЛЕ СУДА',
            text: 'Невиновный осуждён! Дело о «{caseDesc}» вызвало волну возмущения в обществе.',
            sentiment: 'negative', weight: 0.7,
            echo: { type: 'wrongful_conviction', severity: 'high' },
        },
    ],
};

const NEWS_SOURCES = [
    'Правовой вестник', 'Городские новости', 'Судебный обозреватель',
    'Независимая пресса', 'Юридический курьер', 'Вечерний Петербург',
];

// ─── ECHO_EFFECTS ─────────────────────────────────────────────────────────────

/** Реестр обработчиков всех типов эхо. */
export const ECHO_EFFECTS = {
    repeat_offense: {
        id: 'repeat_offense',
        description: 'Освобождённый преступник совершает новое преступление',
        defaultDelay: [2, 4],  // [min, max] дел до срабатывания
        onTrigger(ctx) {
            return {
                reputationDelta: { law: -10, shadow: +3 },
                news: {
                    title: 'РЕЦИДИВ: ПРЕСТУПНИК СНОВА В ДЕЛЕ',
                    text: `Ранее освобождённый обвиняемый вновь замешан в преступлении. Прокуратура требует пересмотра прежнего приговора.`,
                    sentiment: 'negative',
                },
            };
        },
    },
    public_distrust: {
        id: 'public_distrust',
        description: 'Падение доверия к судебной системе',
        defaultDelay: [1, 3],
        onTrigger(ctx) {
            const isRepeat = ctx.consecutiveErrors >= 2;
            return {
                reputationDelta: { law: isRepeat ? -20 : -10, shadow: 0 },
                news: {
                    title: isRepeat ? 'НОВЫЙ СКАНДАЛ: ДОВЕРИЕ К СУДУ РУХНУЛО' : 'ДОВЕРИЕ К СУДУ ПАДАЕТ',
                    text: 'Опросы показывают снижение доверия граждан к судебной системе. Депутаты потребовали парламентского расследования.',
                    sentiment: 'negative',
                },
            };
        },
    },
    wrongful_conviction: {
        id: 'wrongful_conviction',
        description: 'Скандал из-за осуждения невиновного',
        defaultDelay: [3, 5],
        onTrigger(ctx) {
            return {
                reputationDelta: { law: -20, shadow: +5 },
                news: {
                    title: 'ДЕЛО ПЕРЕСМАТРИВАЕТСЯ!',
                    text: 'Новые улики доказывают: осуждённый невиновен. Адвокаты настаивают на немедленном освобождении.',
                    sentiment: 'negative',
                },
            };
        },
    },
    career_boost: {
        id: 'career_boost',
        description: 'Признание профессионализма судьи',
        defaultDelay: [2, 4],
        onTrigger(ctx) {
            return {
                reputationDelta: { law: +10, shadow: 0 },
                news: {
                    title: 'ПРОФЕССИОНАЛИЗМ ОТМЕЧЕН КОЛЛЕГАМИ',
                    text: 'Юридическое сообщество высоко оценивает серию беспристрастных решений. Судья назван примером для подражания.',
                    sentiment: 'positive',
                },
                bonus: { scoreMultiplier: +0.1 },
            };
        },
    },
    media_attention: {
        id: 'media_attention',
        description: 'Громкое дело привлекло внимание прессы',
        defaultDelay: [1, 2],
        onTrigger(ctx) {
            const positive = ctx.caseResult?.isCorrect;
            return {
                reputationDelta: positive ? { law: +5, shadow: 0 } : { law: -5, shadow: +5 },
                news: {
                    title: positive ? 'ПРЕССА ОБ УСПЕХАХ ПРАВОСУДИЯ' : 'СМИ КРИТИКУЮТ СУДЕБНУЮ СИСТЕМУ',
                    text: positive
                        ? 'Видео из зала суда набирает просмотры в сети. Пользователи поддерживают справедливое решение.'
                        : 'Журналисты-расследователи берутся за дело. Общественный резонанс нарастает.',
                    sentiment: positive ? 'positive' : 'negative',
                },
            };
        },
    },
};

// ─── ConsequenceManager ───────────────────────────────────────────────────────

/**
 * @typedef {'positive'|'negative'|'neutral'} Sentiment
 * @typedef {Object} Headline
 * @typedef {Object} EchoData
 * @typedef {Object} EchoResult
 */

export class ConsequenceManager extends EventTarget {

    /**
     * @param {object} [deps]
     * @param {object} [deps.storage]    — объект с loadProgress/saveProgress
     * @param {object} [deps.career]     — CareerManager
     * @param {object} [deps.rng]        — SeededRNG или совместимый объект
     * @param {object} [deps.config]
     */
    constructor({ storage, career, rng, config = {} } = {}) {
        super();
        this.storage = storage ?? null;
        this.career  = career  ?? null;
        this.rng     = rng     ?? new SeededRNG(`consequence_${Date.now()}`);
        this.config  = {
            maxActiveEchoes: 10,
            headlineVariants: 4,
            ...config,
        };
        this._activeEchoes    = [];
        this._processedEchoes = [];
        this._pendingNews     = [];
    }

    // ─── Инициализация ────────────────────────────────────────────────────────

    loadEchoes() {
        if (!this.storage) return;
        const data = this.storage.loadProgress?.() ?? {};
        if (data.consequences) {
            this._activeEchoes    = data.consequences.active    ?? [];
            this._processedEchoes = data.consequences.processed ?? [];
        }
    }

    // ─── Генерация заголовков ─────────────────────────────────────────────────

    /**
     * Генерирует газетный заголовок по итогам вердикта.
     * @param {object} activeCase
     * @param {object} verdictResult  — { isCorrect, score, reputation }
     * @returns {Headline}
     */
    generateHeadline(activeCase, verdictResult) {
        const { isCorrect } = verdictResult;
        const isGuilty = activeCase.trueScenario?.isGuilty ?? false;
        const key = `${isCorrect ? 'correct' : 'error'}_${isGuilty ? 'guilty' : 'innocent'}`;
        const templates = HEADLINE_TEMPLATES[key] ?? [];

        const template = templates.length
            ? this._weightedChoice(templates)
            : { title: key.toUpperCase(), text: '', sentiment: isCorrect ? 'positive' : 'negative', weight: 1 };

        const vars = {
            caseDesc:  activeCase.description || activeCase.type || 'неизвестное преступление',
            defendant: activeCase.defendantName || 'обвиняемый',
            date:      new Date().toLocaleDateString('ru-RU'),
        };

        const headline = {
            id:        `hl_${Date.now().toString(36)}`,
            title:     this._interpolate(template.title, vars),
            text:      this._interpolate(template.text,  vars),
            sentiment: template.sentiment,
            source:    this.rng.choice(NEWS_SOURCES),
            echo:      template.echo ?? null,
            metadata:  { caseId: activeCase.id, generatedAt: Date.now(), key },
        };

        this.dispatchEvent(new CustomEvent('headline:generated', { detail: headline }));
        this._pendingNews.push(headline);

        return headline;
    }

    // ─── Управление Эхо ───────────────────────────────────────────────────────

    /**
     * Планирует эхо-событие (сохраняет в хранилище).
     * @param {{ type:string, originalCaseId:string, data?:object, caseComplexity?:string }} echoData
     * @returns {EchoData}
     */
    scheduleEcho(echoData) {
        const effect = ECHO_EFFECTS[echoData.type];
        const [dMin, dMax] = effect?.defaultDelay ?? [2, 4];
        const delay = dMin + this.rng.int(0, dMax - dMin);

        // Ограничение: не более maxActiveEchoes
        if (this._activeEchoes.length >= this.config.maxActiveEchoes) {
            const removable = this._activeEchoes.find(e => !e.data?.isCritical);
            if (removable) {
                this._activeEchoes = this._activeEchoes.filter(e => e.id !== removable.id);
                this._processedEchoes.push({ ...removable, discarded: true });
            }
        }

        const echo = {
            id:               `echo_${Date.now().toString(36)}_${this.rng.int(100, 999)}`,
            type:             echoData.type,
            originalCaseId:   echoData.originalCaseId,
            triggerAfterCases: delay,
            createdAt:        Date.now(),
            triggered:        false,
            data:             echoData.data   ?? {},
            description:      effect?.description ?? `Последствие вашего решения по делу ${echoData.originalCaseId}`,
            meta: {
                playerRankId: this.career?.getCurrentRank?.()?.id,
                reputation:   this.career?.getReputation?.(),
                severity:     echoData.data?.severity ?? 'medium',
            },
        };

        this._activeEchoes.push(echo);
        this._persistEchoes();

        this.dispatchEvent(new CustomEvent('echo:scheduled', { detail: { echo } }));
        return echo;
    }

    /**
     * Вызывается после завершения каждого дела — проверяет и срабатывает Эхо.
     * @param {object} caseResult
     * @returns {Array<{echo:EchoData, result:EchoResult}>}
     */
    onCaseCompleted(caseResult) {
        // Уменьшаем счётчик у всех активных
        this._activeEchoes.forEach(e => { e.triggerAfterCases -= 1; });

        const ready    = this._activeEchoes.filter(e => !e.triggered && e.triggerAfterCases <= 0);
        const results  = [];

        for (const echo of ready) {
            const effect = ECHO_EFFECTS[echo.type];
            if (!effect) {
                console.warn(`[ConsequenceManager] Неизвестный тип эхо: ${echo.type}`);
                continue;
            }

            const ctx = this._buildEchoContext(echo, caseResult);
            let result;
            try { result = effect.onTrigger(ctx); } catch (e) {
                console.error('[ConsequenceManager] onTrigger error:', e);
                continue;
            }

            echo.triggered   = true;
            echo.triggeredAt = Date.now();
            echo.result      = result;

            this._applyEchoResult(result, ctx);
            results.push({ echo, result });

            this.dispatchEvent(new CustomEvent('echo:triggered', { detail: { echo, result } }));
        }

        // Переносим сработавшие в историю
        this._processedEchoes.push(...ready);
        this._activeEchoes = this._activeEchoes.filter(e => !e.triggered);
        this._persistEchoes();

        return results;
    }

    // ─── Доступ к данным (для UI) ─────────────────────────────────────────────

    /** Список активных (ещё не сработавших) Эхо. */
    getActiveEchoes() { return [...this._activeEchoes]; }

    /** История сработавших Эхо. */
    getEchoHistory({ type, limit = 20 } = {}) {
        let list = [...this._processedEchoes];
        if (type) list = list.filter(e => e.type === type);
        return list.slice(-limit).reverse();
    }

    /** Непоказанные новости. */
    getPendingNews() {
        const news = [...this._pendingNews];
        this._pendingNews = [];
        return news;
    }

    /** Сводка для UI. */
    getConsequenceSummary() {
        return {
            activeEchoes:    this._activeEchoes.length,
            processedEchoes: this._processedEchoes.length,
            criticalPending: this._activeEchoes.filter(e => e.meta?.severity === 'critical' || e.meta?.severity === 'high').length,
            nearest:         this._activeEchoes.length
                ? this._activeEchoes.reduce((min, e) => e.triggerAfterCases < min.triggerAfterCases ? e : min)
                : null,
        };
    }

    // ─── Статические proxy для backward-compat ────────────────────────────────

    static generateHeadline(activeCase, verdictResult) {
        return _defaultInstance.generateHeadline(activeCase, verdictResult);
    }
    static createEcho(type, caseData) {
        return _defaultInstance.scheduleEcho({ type, originalCaseId: caseData.id, data: { caseDesc: caseData.description } });
    }

    // ─── Приватные ────────────────────────────────────────────────────────────

    _persistEchoes() {
        if (!this.storage) return false;
        const data = this.storage.loadProgress?.() ?? {};
        data.consequences = {
            active:      this._activeEchoes,
            processed:   this._processedEchoes.slice(-50),
            lastUpdated: Date.now(),
        };
        return this.storage.saveProgress?.(data) ?? false;
    }

    _buildEchoContext(echo, caseResult) {
        return {
            echo,
            caseResult,
            career:           this.career,
            reputation:       this.career?.getReputation?.(),
            consecutiveErrors: this._countConsecutiveErrors(),
            correctVerdicts:   this._countCorrectVerdicts(),
            originalCaseId:   echo.originalCaseId,
        };
    }

    _applyEchoResult(result, ctx) {
        if (!result) return;

        // Репутация
        if (result.reputationDelta) {
            for (const [type, delta] of Object.entries(result.reputationDelta)) {
                if (delta !== 0) {
                    this.career?.updateReputation?.(type, delta, {
                        reason: `echo:${ctx.echo.type}`,
                        caseId: ctx.echo.originalCaseId,
                    });
                }
            }
        }

        // Бонус
        if (result.bonus?.unlockFeature) {
            this.dispatchEvent(new CustomEvent('feature:unlocked', { detail: {
                feature: result.bonus.unlockFeature, source: 'echo',
            }}));
        }

        // Новое дело-последствие
        if (result.newCase) {
            this.dispatchEvent(new CustomEvent('case:generated', { detail: {
                caseData: result.newCase, source: 'echo', priority: 'high',
            }}));
        }
    }

    _weightedChoice(items) {
        const total = items.reduce((s, i) => s + (i.weight ?? 1), 0);
        let roll = this.rng.next() * total;  // next() возвращает [0,1) — безопасно
        for (const item of items) {
            const w = item.weight ?? 1;
            if (roll < w) return item;
            roll -= w;
        }
        return items[items.length - 1];
    }

    _interpolate(template, vars) {
        return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
    }

    _countConsecutiveErrors() {
        const prog = this.storage?.loadProgress?.();
        if (!prog?.completedCases) return 0;
        const list = Object.values(prog.completedCases)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        let count = 0;
        for (const c of list) { if (!c.isCorrect) count++; else break; }
        return count;
    }

    _countCorrectVerdicts() {
        const prog = this.storage?.loadProgress?.();
        if (!prog?.completedCases) return 0;
        return Object.values(prog.completedCases).filter(c => c.isCorrect).length;
    }
}

// ─── Синглтон для static backward-compat ────────────────────────────────────
const _defaultInstance = new ConsequenceManager();
