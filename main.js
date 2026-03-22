/**
 * main.js — Composition Root (Production Architecture v2)
 *
 * Улучшения v2 (архитектурный аудит):
 *  1. DOM cache — this.dom, без повторных querySelector
 *  2. State full-reset — startNewGame() полностью сбрасывает state
 *  3. Performance instrumentation — timing для simulation pipeline
 *  4. EventModalView — стилизованный модал вместо alert()
 *  5. WitnessView lifecycle — mount(container) вместо new WitnessView(content)
 *  6. window.debug — отдельный dev namespace для отладки
 */

import { CabinetSystem }           from './systems/CabinetSystem.js?v=9';
import { CaseGenerator }          from './systems/CaseGenerator.js?v=9';
import { GameClock }              from './systems/GameClock.js';
import { HearingScheduler }       from './systems/HearingScheduler.js';
import { MainMenuView }           from './ui/MainMenuView.js?v=9';
import { JudgeOfficeView }        from './ui/JudgeOfficeView.js';
import { CaseView }                from './ui/CaseView.js?v=6';
import { WitnessView }             from './ui/WitnessView.js?v=6';
import { VerdictView }             from './ui/VerdictView.js?v=6';
import { ExpertizaView }           from './ui/ExpertizaView.js?v=6';
import { JudgeCabinet }            from './ui/JudgeCabinet.js?v=6';
import { ProfileCardView }         from './ui/ProfileCardView.js?v=6';
import { MedicalExpertiseView }    from './ui/MedicalExpertiseView.js?v=6';
import { EvidenceCompareView }     from './ui/EvidenceCompareView.js';
import { CaseManager }             from './core/CaseManager.js?v=6';
import { CareerManager }           from './core/CareerManager.js?v=6';
import { ConsequenceManager }      from './systems/ConsequenceManager.js?v=6';
import { PersonProfileGenerator }  from './systems/PersonProfileGenerator.js?v=6';
import { SimulationEngine }        from './simulation/SimulationEngine.js?v=6';
import { AlibiVerificationSystem } from './systems/AlibiVerificationSystem.js';



class App {

    constructor() {

        // ─── Инфраструктура ───────────────────────────────────────────────
        this.storage = new CaseManager();
        const storageAdapter = {
            loadProgress: ()     => this.storage.loadProgress(),
            saveProgress: (data) => this.storage.saveProgress(data),
        };
        this.career = new CareerManager(storageAdapter).init();

        this.consequences = new ConsequenceManager({
            storage: storageAdapter,
            career:  this.career,
        });
        if (typeof this.consequences.loadEchoes === 'function') {
            this.consequences.loadEchoes();
        }

        // ─── Системы прогрессии ───────────────────────────────────────────
        this.cabinet = new CabinetSystem(this.career);

        // ─── Игровое время и расписание ───────────────────────────────────
        this.clock     = new GameClock();
        this.scheduler = new HearingScheduler({ career: this.career });

        // Проверяем пропущенные слушания каждые 30с реального времени
        setInterval(() => {
            const missed = this.scheduler.checkMissed(this.clock);
            for (const h of missed) {
                this._showPenaltyToast(h);
            }
        }, 30_000);

        // ─── SimulationEngine ─────────────────────────────────────────────
        this.engine = new SimulationEngine({
            caseGenerator:      new CaseGenerator(),
            consequenceManager: this.consequences,
            career:             this.career,
            config:             { runJury: true, buildGraph: true, verbose: false },
        });
        this.engine.addEventListener('trial:completed', (e) => {
            const rec = e.detail.trialReport?.systemRecommendation;
            if (rec) console.log(`[Engine] Рекомендация: ${rec.verdict} (${(rec.confidence * 100).toFixed(0)}%)`);
        });

        // ─── AppState — единый источник истины ────────────────────────────
        this.state = this._emptyState();

        // ─── WitnessView — один экземпляр на сессию ───────────────────────
        this._witnessViewInstance = null;

        // ─── Активное слушание (hearingEntry) из планировщика ─────────────
        this._activeHearing = null;

        this.init();
    }

    /** Создаёт чистый начальный state. Вызывается при старте и сбросе. */
    _emptyState() {
        return {
            currentRun:           null,
            currentCase:          null,
            trialData:            null,
            metrics:              null,
            systemRecommendation: null,
            currentEvent:         null,
            activeTab:            'materialy',
        };
    }

    // ─── Инициализация ────────────────────────────────────────────────────

    init() {
        console.log('Инициализация игры...');

        // DOM cache — один раз, не лазим в getElementById при каждом render
        this.dom = {
            content: document.getElementById('content-area'),
            header:  document.getElementById('case-header-info'),
            status:  document.getElementById('game-status'),
        };

        // ─── JudgeOfficeView ───────────────────────────────────────────────
        JudgeOfficeView.init({
            clock:     this.clock,
            scheduler: this.scheduler,
            onStartHearing: (hearingEntry) => this._startHearingFromScheduler(hearingEntry),
            onGenerateCases: () => this._generateCaseBatch(10),
        });

        this._setupEventListeners();

        try {
            window.requestAnimationFrame(() => {
                MainMenuView.init(this);
            });
        } catch (e) {
            console.error('[App.init] Ошибка запуска:', e);
            this.setStatus('❌ ' + e.message);
            this.dom.content.innerHTML =
                `<div style="padding:20px;color:#ef4444;font-family:monospace;">
                    <h2>❌ Ошибка запуска</h2><pre>${e.stack}</pre>
                </div>`;
        }
    }

    /** Показывает кабинет судьи (скрывает игру) */
    showOffice() {
        document.getElementById('app').style.display = 'none';
        JudgeOfficeView.show();
    }

    /**
     * Генерирует N случайных дел через CaseGenerator (без запуска симуляции).
     * @param {number} count
     * @returns {Object[]}
     */
    _generateCaseBatch(count) {
        const rankName = this.career.getCurrentRank?.()?.name ?? 'Мировой судья';
        const results  = [];
        for (let i = 0; i < count; i++) {
            try {
                const r = this.engine.runCase({ rankName });
                results.push(r.caseData);
            } catch (e) {
                console.warn('[App] Ошибка генерации дела:', e);
            }
        }
        return Promise.resolve(results);
    }

    /**
     * Запускает слушание по записи из HearingScheduler.
     * @param {import('./systems/HearingScheduler.js').HearingEntry} entry
     */
    _startHearingFromScheduler(entry) {
        this._activeHearing = entry;

        // Если у записи уже есть полные caseData — используем их
        const caseData = entry.caseData;
        if (!caseData) {
            console.error('[App] HearingEntry не содержит caseData:', entry);
            return;
        }

        // Показываем игровой экран
        JudgeOfficeView.hide();
        document.getElementById('app').style.display = 'block';

        // State reset
        this.state = this._emptyState();
        this._witnessViewInstance = null;

        // Запускаем симуляцию для этого дела
        const rankName = this.career.getCurrentRank?.()?.name ?? 'Мировой судья';
        const t0 = performance.now();
        let result;
        try {
            result = this.engine.runCase({ rankName, caseData });
        } catch {
            // Если engine не поддерживает инъекцию, генерируем новое
            result = this.engine.runCase({ rankName });
        }
        console.log(`[Perf] Hearing pipeline: ${(performance.now() - t0).toFixed(1)}ms`);

        this.state.currentRun           = result;
        this.state.currentCase          = this._hydrateCase(result.caseData ?? caseData);
        this.state.trialData            = result.trial;
        this.state.metrics              = result.metrics;
        this.state.systemRecommendation = result.systemRecommendation;
        this.state.currentEvent         = result.caseData?.currentEvent ?? null;

        this._updateHeader();
        this.setStatus(`Слушание: ${this.state.currentCase.id}`);
        this.switchTab('materialy');

        if (this.state.currentEvent) {
            setTimeout(() => this._showEventModal(this.state.currentEvent), 400);
        }
    }

    /**
     * Показывает тост-уведомление о штрафе за пропущенное слушание.
     * @param {Object} hearingEntry
     */
    _showPenaltyToast(hearingEntry) {
        const t = document.createElement('div');
        t.style.cssText = `
            position:fixed;top:24px;left:50%;transform:translateX(-50%);
            background:#7f1d1d;border:1px solid #ef4444;color:#fca5a5;
            padding:14px 24px;border-radius:12px;font-size:14px;z-index:99999;
            box-shadow:0 4px 20px rgba(239,68,68,.3);max-width:400px;text-align:center;
        `;
        t.innerHTML = `<strong>⚠️ Пропущено слушание!</strong><br><span style="font-size:12px;opacity:.8">${hearingEntry.caseMeta?.description ?? 'Дело'}</span><br><span style="color:#fbbf24;font-size:13px">Штраф: -15% репутации, -50 очков</span>`;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 6000);
    }

    // ─── Игровой цикл ─────────────────────────────────────────────────────

    startNewGame() {
        // После главного меню → открываем кабинет судьи
        document.getElementById('app').style.display = 'none';
        JudgeOfficeView.show();
    }

    /**
     * Hydration Layer — достраивает доменные данные дела.
     * Вызывается только если SimulationEngine не заполнил данные.
     */
    _hydrateCase(caseData) {
        const c = caseData;
        if (!c.suspectProfile) {
            c.suspectProfile = PersonProfileGenerator.generateSuspect(c.type, c.defendantName);
        }
        if (!c.victimProfile) {
            c.victimProfile = PersonProfileGenerator.generateVictim(c.type, c.trueScenario?.victimName);
        }
        if (!c.medicalReport) {
            c.medicalReport = PersonProfileGenerator.generateMedicalReport(c.type, c.trueScenario);
        }
        if (!c.crimeData) {
            c.crimeData = {
                label:    c.label    || c.type,
                law:      c.trueScenario?.law      || '',
                sentence: c.trueScenario?.sentence || '',
                type:     c.type,
            };
        }
        return c;
    }

    // ─── Router — тонкий, без логики ──────────────────────────────────────

    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`[data-tab="${tabId}"]`);
        if (btn) btn.classList.add('active');
        else console.warn('[switchTab] Вкладка не найдена:', tabId);

        this.state.activeTab = tabId;
        this.dom.content.innerHTML = '';
        this._renderTab(tabId, this.dom.content);
    }

    /**
     * Renderer Map — добавление вкладки = 1 строка.
     * VerdictView получает currentCase (activeCase) — его публичный API.
     * trialData/systemRecommendation доступны через window.game.state для будущего расширения.
     */
    _renderTab(tabId, el) {
        const { currentCase: c } = this.state;

        const handlers = {
            materialy:  () => CaseView.renderCaseSummary(c, el),
            obvinenie:  () => CaseView.renderProsecution(c, el),
            zaschita:   () => CaseView.renderDefense(c, el),
            svideteli:  () => this._renderWitnessesTab(c, el),
            doprosy:    () => this._renderInterrogationTab(c, el),
            uliki:      () => CaseView.renderEvidence(c.evidence, el),
            compare:    () => EvidenceCompareView.render(c.evidence, c.trueScenario, el),
            expertiza:  () => ExpertizaView.render(c, el),
            suspect:    () => ProfileCardView.render(c.suspectProfile, 'suspect', c.crimeData, el),
            victim:     () => ProfileCardView.render(c.victimProfile,  'victim',  c.crimeData, el),
            medexpert:  () => MedicalExpertiseView.render(c, el),
            cabinet:    () => JudgeCabinet.render(this.career, el),
            verdict:    () => VerdictView.render(c, el),
            alibi:      () => this._renderAlibiTab(c, el),
            tests:      () => this._renderTestPanel(el),
        };


        const render = handlers[tabId];
        if (render) return render();
        el.innerHTML = `<h2>Вкладка: ${tabId}</h2><p>Содержимое в разработке...</p>`;
    }

    /**
     * WitnessView lifecycle — один экземпляр между переходами вкладок,
     * но всегда монтируется в актуальный DOM-контейнер через mount().
     */
    _renderWitnessesTab(c, el) {
        if (!this._witnessViewInstance) {
            this._witnessViewInstance = new WitnessView(el);
        } else if (typeof this._witnessViewInstance.mount === 'function') {
            this._witnessViewInstance.mount(el);
        }
        const wv = this._witnessViewInstance;
        wv.renderList(
            c.witnesses,
            (w) => { wv.renderDialogue(w, () => this.switchTab('svideteli')); },
            ()  => {
                if (c.witnesses.length >= 2) {
                    wv.renderConfrontation(
                        c, c.witnesses[0], c.witnesses[1],
                        () => this.switchTab('svideteli')
                    );
                } else {
                    this._showEventModal({ title: 'Очная ставка невозможна', description: 'Недостаточно свидетелей.', effect: '' });
                }
            }
        );
    }

    /** Вкладка «Допросы» — выбор свидетеля и стороны */
    _renderInterrogationTab(c, el) {
        if (!this._witnessViewInstance) {
            this._witnessViewInstance = new WitnessView(el);
        } else {
            this._witnessViewInstance.mount(el); // ← обновляем контейнер при переходе
        }
        const wv = this._witnessViewInstance;


        el.innerHTML = `
            <h2 style="margin-bottom:0.5rem">🎙️ Допросы свидетелей</h2>
            <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:0">
                Выберите свидетеля и сторону допроса. Ответы зависят от психологического профиля свидетеля.
            </p>
            <div id="witness-pick-list" style="display:flex;flex-direction:column;gap:10px;"></div>
        `;
        const list = el.querySelector('#witness-pick-list');

        c.witnesses.forEach(w => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                    <div>
                        <strong>${w.name}</strong>
                        <span style="color:var(--text-muted);font-size:0.8rem;margin-left:8px">${w.role || 'Свидетель'}</span>
                    </div>
                    <div style="display:flex;gap:8px">
                        <button class="action-btn btn-prosecution" data-wid="${w.id}" style="background:#ef444422;border:1px solid #ef4444;color:#ef4444">
                            ⚖️ Допрос обвинения
                        </button>
                        <button class="action-btn btn-defense" data-wid="${w.id}" style="background:#22c55e22;border:1px solid #22c55e;color:#22c55e">
                            🛡️ Допрос защиты
                        </button>
                    </div>
                </div>
            `;
            card.querySelector('.btn-prosecution').onclick = () => {
                wv.container = el;
                wv.renderInterrogation(w, 'prosecution', c, () => this.switchTab('doprosy'));
            };
            card.querySelector('.btn-defense').onclick = () => {
                wv.container = el;
                wv.renderInterrogation(w, 'defense', c, () => this.switchTab('doprosy'));
            };
            list.appendChild(card);
        });
    }

    /** Вкладка «Проверка алиби» */
    _renderAlibiTab(c, el) {
        const scenario  = c.trueScenario;
        const graph     = scenario?.graph ?? null;
        const checklist = AlibiVerificationSystem.buildChecklist(scenario, graph);

        const renderPage = () => {
            el.innerHTML = `
                <h2 style="margin-bottom:0.5rem">🔎 Проверка алиби</h2>
                <div class="card alibi-claim-card">
                    <div class="alibi-claim-label">Заявление подсудимого:</div>
                    <div class="alibi-claim-text">"${checklist.alibiClaim}"</div>
                    <div class="alibi-claim-meta">
                        Свидетель алиби: <strong>${checklist.alibiWitness}</strong> ·
                        По данным защиты: <strong>${checklist.isVerifiedByDefense ? '✅ Проверено' : '❌ Не проверено'}</strong>
                    </div>
                </div>

                <h3 style="margin:1.5rem 0 0.5rem">Каналы проверки</h3>
                <div id="alibi-steps" style="display:flex;flex-direction:column;gap:12px">
                    ${checklist.steps.map((step, i) => `
                        <div class="card alibi-step" id="astep-${step.id}">
                            <div class="alibi-step-header">
                                <span class="alibi-step-icon">${step.icon}</span>
                                <div>
                                    <strong>${step.title}</strong>
                                    <div style="font-size:0.82rem;color:var(--text-secondary)">${step.description}</div>
                                </div>
                                <button class="action-btn alibi-run-btn" data-step="${i}"
                                    ${step.done ? 'disabled style="opacity:0.4"' : ''}>
                                    ${step.done ? '✅ Выполнено' : '▶ Проверить'}
                                </button>
                            </div>
                            ${step.done ? `<div class="alibi-step-result alibi-result-${step.outcome}">
                                ${step.outcome === 'confirmed' ? '✅' : step.outcome === 'refuted' ? '❌' : '⚠️'}
                                ${step.detail}
                            </div>` : ''}
                        </div>
                    `).join('')}
                </div>

                ${checklist.result ? `
                    <div class="card alibi-final-result alibi-final-${checklist.result}" style="margin-top:1.5rem">
                        <h3 style="margin:0 0 0.5rem">${checklist.resultText}</h3>
                        <div style="font-size:0.85rem;color:var(--text-secondary)">
                            Уверенность: <strong>${checklist.resultConfidence ?? '?'}%</strong>
                        </div>
                    </div>` : ''}
            `;

            el.querySelectorAll('.alibi-run-btn').forEach(btn => {
                btn.onclick = () => {
                    const idx = parseInt(btn.dataset.step);
                    AlibiVerificationSystem.runStep(checklist.steps[idx], scenario.isGuilty);
                    // Пересчитываем итог после каждого шага
                    const final = AlibiVerificationSystem.computeResult(checklist.steps);
                    checklist.result = final.result;
                    checklist.resultText = final.text;
                    checklist.resultConfidence = final.confidence;
                    renderPage(); // Ре-рендер
                };
            });
        };
        renderPage();
    }

    // ─── UI helpers ───────────────────────────────────────────────────────

    _updateHeader() {
        const rep  = this.career.getReputation();
        const rank = this.career.getCurrentRank();
        const evt  = this.state.currentEvent;
        const rec  = this.state.systemRecommendation;

        // Бейджик мнения присяжных
        const juryBadge = (() => {
            if (!rec) return '';
            const isGuilty = rec.verdict === 'guilty';
            const isInn    = rec.verdict === 'innocent';
            const conf     = Math.round((rec.confidence ?? 0) * 100);
            const color  = isGuilty ? '#e74c3c' : isInn ? '#27ae60' : '#e67e22';
            const icon   = isGuilty ? '🔴' : isInn ? '🟢' : '⚠️';
            const label  = isGuilty ? 'Присяжные: Виновен' : isInn ? 'Присяжные: Невиновен' : 'Присяжные: Нет консенсуса';
            return `<span style="background:${color}22;border:1px solid ${color};color:${color};border-radius:100px;padding:2px 10px;font-size:12px;white-space:nowrap" title="${(rec.rationale||[]).join(' ')}">${icon} ${label} ${conf}%</span>`;
        })();

        this.dom.header.innerHTML = `
            <div class="stats">
                <span>Обвиняемый: <strong>${this.state.currentCase.defendantName}</strong></span>
                <span>Ранг: <strong>${rank.icon} ${rank.name}</strong></span>
                <span>Счет: <strong>${this.career.getScore()}</strong></span>
                ${juryBadge}
                <div class="reputation-bars">
                    <div class="rep-bar" title="Закон">
                        ⚖️ <div class="bar-wrap"><div class="bar-fill law-fill" style="width:${rep.law}%"></div></div>
                    </div>
                    <div class="rep-bar" title="Тени">
                        💰 <div class="bar-wrap"><div class="bar-fill shadow-fill" style="width:${rep.shadow}%"></div></div>
                    </div>
                </div>
            </div>
            <div class="event-warning">${evt ? `⚠️ ${evt.title}` : ''}</div>`;
    }

    /**
     * EventModalView — стилизованное модальное окно вместо alert().
     * Не блокирует поток, позволяет стилизацию и выбор игрока.
     *
     * @param {{ title: string, description: string, effect: string }} event
     */
    _showEventModal(event) {
        // Удаляем предыдущий модал если есть
        document.getElementById('event-modal-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'event-modal-overlay';
        overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;
            display:flex;align-items:center;justify-content:center;
            animation:fadeIn .2s ease;`;

        overlay.innerHTML = `
            <div style="
                background:linear-gradient(135deg,#1e293b,#0f172a);
                border:1px solid #334155;border-radius:16px;
                padding:32px 36px;max-width:480px;width:90%;
                box-shadow:0 24px 64px rgba(0,0,0,.6);
                animation:slideUp .25s ease;
            ">
                <div style="font-size:1.25em;font-weight:700;color:#f1f5f9;margin-bottom:12px">
                    ⚠️ ${event.title}
                </div>
                <div style="color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:16px">
                    ${event.description}
                </div>
                ${event.effect ? `
                <div style="
                    background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);
                    border-radius:8px;padding:10px 14px;font-size:13px;color:#fbbf24;
                    margin-bottom:20px">
                    📋 ${event.effect}
                </div>` : ''}
                <button id="event-modal-close" style="
                    width:100%;padding:10px;border:none;border-radius:8px;
                    background:linear-gradient(135deg,#3b82f6,#6366f1);
                    color:#fff;font-size:14px;font-weight:600;cursor:pointer;
                    transition:opacity .15s">
                    Понятно, продолжаем
                </button>
            </div>`;

        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.querySelector('#event-modal-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }

    setStatus(text) {
        this.dom.status.innerText = text;
    }

    // ─── Слушатели событий ────────────────────────────────────────────────

    _setupEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        document.addEventListener('click', (e) => {
            if (e.target?.id === 'next-case-btn') this.startNewGame();
        });
    }

    // ─── Dev: панель тестов ───────────────────────────────────────────────

    async _renderTestPanel(container) {
        container.innerHTML = `
            <div style="padding:20px;font-family:monospace;">
                <h2 style="color:#a3e635;">🧪 Панель тестирования систем</h2>
                <p style="color:#94a3b8;font-size:13px;">Запускает все unit-тесты прямо в игровом окне. Только для разработчика.</p>
                <button id="run-tests-btn" style="background:#22c55e;color:#000;border:none;padding:8px 20px;
                    border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold;">▶ Запустить тесты</button>
                <div id="test-results" style="margin-top:16px;"></div>
            </div>`;

        container.querySelector('#run-tests-btn').addEventListener('click', async () => {
            const btn = container.querySelector('#run-tests-btn');
            const out = container.querySelector('#test-results');
            btn.disabled = true;
            btn.textContent = '⏳ Загрузка...';
            out.innerHTML = '';
            try {
                const { renderResults } = await import('./tests/ExpertiseTests.js');
                btn.textContent = '⏳ Тестирование...';
                await new Promise(r => setTimeout(r, 50));
                const stats = renderResults(out);
                btn.textContent = stats.failed === 0
                    ? `✅ Все ${stats.total} тестов пройдено — Перезапустить`
                    : `❌ ${stats.failed} упало из ${stats.total} — Перезапустить`;
                btn.disabled = false;
            } catch (e) {
                out.innerHTML = `<div style="color:#ef4444;padding:12px;background:#1c1c1c;border-radius:4px;">
                    ❌ Ошибка загрузки тестов:<br><code>${e.message}</code></div>`;
                btn.textContent = '▶ Запустить тесты';
                btn.disabled = false;
            }
        });
    }
}

// ─── Стили для анимаций модала ────────────────────────────────────────────────

const modalStyles = document.createElement('style');
modalStyles.textContent = `
    @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
    @keyframes slideUp { from { transform:translateY(20px);opacity:0 } to { transform:translateY(0);opacity:1 } }
`;
document.head.appendChild(modalStyles);

// ─── Startup ──────────────────────────────────────────────────────────────────

try {
    window.game = new App();

    // Debug namespace — все подсистемы под одним объектом
    window.debug = {
        get state()   { return window.game.state; },
        get engine()  { return window.game.engine; },
        get career()  { return window.game.career; },
        get cabinet() { return window.game.cabinet; },
        get run()     { return window.game.state?.currentRun; },
        newGame()     { return window.game.startNewGame(); },
    };

} catch (e) {
    console.error('[main.js] Критическая ошибка старта:', e);
    document.getElementById('game-status').textContent = '❌ ' + e.message;
    const ca = document.getElementById('content-area');
    if (ca) ca.innerHTML = `<div style="padding:20px;color:#ef4444;font-family:monospace;">
        <h2>❌ Crash при запуске</h2><pre>${e.stack}</pre></div>`;
}
