import { VerdictSystem } from '../systems/VerdictSystem.js';

/**
 * Экран вынесения вердикта — максимально расширенный.
 */
export class VerdictView {

    static render(activeCase, element) {
        const s = activeCase.trueScenario;

        // Краткое резюме улик игрока
        const evidence = activeCase.evidence || [];
        const forProsec  = evidence.filter(e => e.playerMark === 'confirmed');
        const forDefense = evidence.filter(e => e.playerMark === 'contradictory');
        const neutral    = evidence.filter(e => e.playerMark === 'suspicious');

        const evidenceSummaryHTML = evidence.length > 0 ? `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0;font-size:13px">
                <div style="background:#fdf2f2;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:1.3em;font-weight:700;color:#c0392b">${forProsec.length}</div>
                    <div style="color:#888">Улик — обвинение</div>
                </div>
                <div style="background:#fefaf2;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:1.3em;font-weight:700;color:#e67e22">${neutral.length}</div>
                    <div style="color:#888">Под вопросом</div>
                </div>
                <div style="background:#f2fdf4;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:1.3em;font-weight:700;color:#27ae60">${forDefense.length}</div>
                    <div style="color:#888">Улик — защита</div>
                </div>
            </div>` : '';

        // Тесты: сколько сделано
        const allTests = evidence.flatMap(e => e.tests || []);
        const matchCount   = allTests.filter(t => t.status === 'match').length;
        const expertHTML = allTests.length > 0
            ? `<p style="font-size:13px;color:#555;margin:4px 0">Выполнено экспертиз: <strong>${allTests.length}</strong>, подтверждений: <strong>${matchCount}</strong></p>`
            : `<p style="font-size:13px;color:#888;margin:4px 0">Экспертизы не проводились</p>`;

        // Блок рекомендации JuryAI из engine
        const rec = window.game?.state?.systemRecommendation ?? null;
        const juryHTML = (() => {
            if (!rec) return '';

            const isGuiltyRec = rec.verdict === 'guilty';
            const isInnocent  = rec.verdict === 'innocent';
            const isHung      = rec.verdict === 'hung_jury';
            const isInsuf     = rec.verdict === 'insufficient_evidence';

            const color   = isGuiltyRec ? '#c0392b' : isInnocent ? '#27ae60' : '#e67e22';
            const bgColor = isGuiltyRec ? 'rgba(192,57,43,.08)' : isInnocent ? 'rgba(39,174,96,.08)' : 'rgba(230,126,34,.08)';
            const label   = isGuiltyRec ? '⚖️ Присяжные склоняются к обвинению'
                          : isInnocent  ? '⚖️ Присяжные склоняются к оправданию'
                          : isHung      ? '⚖️ Присяжные не пришли к единому мнению'
                          :               '⚖️ Недостаточно доказательств';
            const conf    = Math.round((rec.confidence ?? 0) * 100);
            const rationale = (rec.rationale || []).map(r => `<li style="font-size:12px;color:#666;margin-bottom:3px">${r}</li>`).join('');

            // Полоска уверенности
            const barColor = isGuiltyRec ? '#e74c3c' : (isInnocent ? '#27ae60' : '#e67e22');

            return `
            <div style="background:${bgColor};border:1px solid ${color};border-radius:10px;padding:14px;margin-bottom:14px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <strong style="color:${color};font-size:14px">${label}</strong>
                    <span style="background:${color};color:#fff;border-radius:100px;padding:2px 10px;font-size:12px;font-weight:700">${conf}%</span>
                </div>
                <div style="background:#e2e8f0;border-radius:100px;height:6px;margin-bottom:10px;overflow:hidden">
                    <div style="height:6px;border-radius:100px;background:${barColor};width:${conf}%;transition:width 1s ease"></div>
                </div>
                ${rationale ? `<ul style="margin:0;padding-left:16px">${rationale}</ul>` : ''}
            </div>`;
        })();

        element.innerHTML = `
            <!-- ШАПКА ВЫНЕСЕНИЯ ВЕРДИКТА -->
            <div class="card" style="border-left:5px solid #2c3e50;background:linear-gradient(135deg,#2c3e50,#34495e);color:#ecf0f1;margin-bottom:16px">
                <div style="font-size:11px;opacity:.5;letter-spacing:2px;text-transform:uppercase">Дело № ${activeCase.id}</div>
                <div style="font-size:1.15em;font-weight:700;margin:6px 0">${activeCase.description}</div>
                <div style="font-size:13px;opacity:.8">Обвиняемый: <strong>${activeCase.defendantName}</strong> &nbsp;·&nbsp; ${activeCase.label || activeCase.type}</div>
            </div>

            <!-- ИТОГИ РАБОТЫ -->
            <div class="card" style="margin-bottom:14px">
                <h3 style="margin:0 0 8px">📊 Ваша работа по делу</h3>
                ${evidenceSummaryHTML}
                ${expertHTML}
            </div>

            <!-- БЛОК ВЫНЕСЕНИЯ -->
            <div class="card verdict-card" style="border-left:5px solid #c0392b">
                <h2 style="margin:0 0 6px">⚖️ Вынесение вердикта</h2>
                <p style="color:#666;font-size:14px;margin:0 0 16px">
                    Изучив все материалы дела, огласите решение Суда:
                </p>

                ${juryHTML}

                <!-- Перенос слушания -->
                <div id="reschedule-area" style="margin-bottom:12px"></div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                    <button class="btn-guilty" style="
                        background:linear-gradient(135deg,#c0392b,#e74c3c);
                        color:white;padding:1.2rem;border:none;border-radius:10px;
                        font-size:1em;font-weight:700;cursor:pointer;
                        box-shadow:0 4px 14px rgba(192,57,43,.35);
                        transition:transform .15s">
                        🔴 ВИНОВЕН
                    </button>
                    <button class="btn-innocent" style="
                        background:linear-gradient(135deg,#27ae60,#2ecc71);
                        color:white;padding:1.2rem;border:none;border-radius:10px;
                        font-size:1em;font-weight:700;cursor:pointer;
                        box-shadow:0 4px 14px rgba(39,174,96,.35);
                        transition:transform .15s">
                        🟢 НЕВИНОВЕН
                    </button>
                </div>

                <p style="font-size:11px;color:#aaa;margin-top:12px;text-align:center">
                    ⚠️ Вердикт окончателен. После вынесения откроется разбор дела.
                </p>
            </div>

            <div id="verdict-result" style="margin-top:20px"></div>
        `;


        // Кнопки ховер-эффект
        ['btn-guilty','btn-innocent'].forEach(cls => {
            const btn = element.querySelector(`.${cls}`);
            btn.onmouseenter = () => { btn.style.transform = 'scale(1.03)'; };
            btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
        });

        element.querySelector('.btn-guilty').onclick = () => {
            const result = VerdictSystem.evaluate('guilty', activeCase);
            VerdictView._processResult(result, activeCase, element);
        };
        element.querySelector('.btn-innocent').onclick = () => {
            const result = VerdictSystem.evaluate('innocent', activeCase);
            VerdictView._processResult(result, activeCase, element);
        };

        // Кнопка переноса слушания (если есть активное слушание в планировщике)
        const rescheduleArea = element.querySelector('#reschedule-area');
        if (rescheduleArea) {
            const game = window.game;
            const hearing = game?._activeHearing;
            if (hearing && hearing.status === 'active') {
                rescheduleArea.innerHTML = `
                    <button id="btn-reschedule" style="
                        width:100%;background:rgba(124,58,237,.12);color:#a78bfa;
                        border:1px solid #7c3aed;border-radius:8px;padding:10px;
                        cursor:pointer;font-size:13px;font-family:inherit;
                        margin-bottom:4px;transition:background .2s
                    ">📅 Перенести слушание на другую дату</button>`;
                element.querySelector('#btn-reschedule').onclick = () => {
                    VerdictView._showRescheduleModal(hearing, game);
                };
            }
        }
    }

    /**
     * Модальное окно переноса слушания (из экрана вердикта).
     */
    static _showRescheduleModal(hearing, game) {
        document.getElementById('reschedule-modal')?.remove();
        const clock = game.clock;
        const now   = clock.now;

        // 7 ближайших слотов
        const slots = [];
        for (let d = 1; d <= 7; d++) {
            for (const hour of [9, 14]) {
                const slot = new Date(now);
                slot.setDate(slot.getDate() + d);
                slot.setHours(hour, 0, 0, 0);
                slots.push(slot);
            }
        }

        const modal = document.createElement('div');
        modal.id = 'reschedule-modal';
        modal.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:50000;
            display:flex;align-items:center;justify-content:center;
        `;
        modal.innerHTML = `
            <div style="background:#1e293b;border:1px solid #7c3aed;border-radius:16px;padding:28px;max-width:420px;width:92%">
                <h3 style="margin:0 0 8px;color:#f8fafc">📅 Перенести слушание</h3>
                <div style="font-size:13px;color:#64748b;margin-bottom:16px">${hearing.caseMeta?.description ?? ''}</div>
                <div style="max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:20px">
                    ${slots.map(slot => `
                        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;background:rgba(255,255,255,.04);border:2px solid transparent" class="rs-slot">
                            <input type="radio" name="rs-slot" value="${slot.getTime()}" style="accent-color:#7c3aed">
                            <div>
                                <div style="color:#e2e8f0;font-weight:600;font-size:13px">${slot.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</div>
                                <div style="font-size:12px;color:#64748b">${slot.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</div>
                            </div>
                        </label>
                    `).join('')}
                </div>
                <div style="display:flex;gap:10px">
                    <button id="rs-cancel" style="flex:1;padding:12px;background:transparent;border:1px solid #334155;color:#94a3b8;border-radius:8px;cursor:pointer;font-family:inherit">Отмена</button>
                    <button id="rs-confirm" style="flex:2;padding:12px;background:#7c3aed;border:none;color:#fff;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700">Перенести</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.rs-slot').forEach(lbl => {
            lbl.querySelector('input').onchange = () => {
                modal.querySelectorAll('.rs-slot').forEach(l => l.style.borderColor = 'transparent');
                lbl.style.borderColor = '#7c3aed';
            };
        });

        modal.querySelector('#rs-cancel').onclick = () => modal.remove();
        modal.querySelector('#rs-confirm').onclick = () => {
            const sel = modal.querySelector('input[name="rs-slot"]:checked');
            if (!sel) return;
            const ts = parseInt(sel.value, 10);
            game.scheduler.reschedule(hearing.id, ts);
            game._activeHearing = null;
            modal.remove();
            // Возвращаемся в кабинет
            game.showOffice();
        };
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }


    static _processResult(result, activeCase, containerElement) {
        const game = window.game;
        game.career.addScore(result.score);

        if (result.reputation) {
            game.career.updateReputation('law',    result.reputation.law);
            game.career.updateReputation('shadow', result.reputation.shadow);
        }

        game.storage.saveResult(activeCase.id, result, game.career.getScore());

        // Генерируем заголовок через инстанс (с вариативностью и взвешенным выбором)
        const cm = game.consequences;
        const headline = cm.generateHeadline(activeCase, result);
        result.headline = headline;

        // Планируем Эхо-событие если была ошибка
        if (!result.isCorrect) {
            const echoType = activeCase.trueScenario.isGuilty ? 'repeat_offense' : 'wrongful_conviction';
            cm.scheduleEcho({
                type:          echoType,
                originalCaseId: activeCase.id,
                data: {
                    caseDesc:    activeCase.description,
                    severity:    activeCase.trueScenario.isGuilty ? 'high' : 'critical',
                },
            });
        } else if (result.isCorrect && result.score >= 150) {
            // Серия правильных вердиктов с высоким счётом — возможный бонус
            const correctCount = cm._countCorrectVerdicts?.() ?? 0;
            if (correctCount > 0 && correctCount % 5 === 0) {
                cm.scheduleEcho({ type: 'career_boost', originalCaseId: activeCase.id });
            }
        }

        // Обрабатываем триггеры накопленных Эхо после завершения дела
        cm.onCaseCompleted(result);

        // Завершаем активное слушание в планировщике
        const activeHearing = game._activeHearing;
        if (activeHearing) {
            game.scheduler.markCompleted(activeHearing.id);
            game._activeHearing = null;
        }

        const resultEl = containerElement.querySelector('#verdict-result');
        VerdictView.showResult(result, activeCase, resultEl);
        game._updateHeader();
    }

    static showResult(result, activeCase, element) {
        const s         = activeCase.trueScenario;
        const isCorrect = result.isCorrect;
        const repLaw    = result.reputation?.law    || 0;
        const repShadow = result.reputation?.shadow  || 0;

        // Газетная вырезка
        const headlineHTML = result.headline ? `
            <div style="
                border-left:4px solid ${result.headline.sentiment === 'positive' ? '#22c55e' : '#ef4444'};
                padding:10px 14px;
                background:${result.headline.sentiment === 'positive' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)'};
                border-radius:6px;margin-bottom:14px;
            ">
                <div style="font-weight:700;font-size:14px;color:#f1f5f9">${result.headline.title}</div>
                <div style="font-size:13px;margin-top:4px;color:#94a3b8">${result.headline.text}</div>
            </div>` : '';

        // Истинный сценарий
        const scenarioHTML = `
            <div style="
                background:rgba(255,255,255,.06);border:1px solid #334155;
                border-radius:8px;padding:14px;font-size:13px;line-height:1.8;color:#cbd5e1;
                margin-bottom:16px;
            ">
                <div style="font-weight:700;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;font-size:11px;letter-spacing:1px">Истинный сценарий</div>
                Обвиняемый был <strong style="color:${s.isGuilty ? '#f87171' : '#4ade80'}">${s.isGuilty ? 'ВИНОВЕН' : 'НЕВИНОВЕН'}</strong>.<br>
                Мотив: <span style="color:#e2e8f0">${s.motive}</span> &nbsp;·&nbsp; Метод: <span style="color:#e2e8f0">${s.method}</span><br>
                ${s.alibi ? `Алиби: «${s.alibi.claim}» — <span style="color:${s.alibi.verified ? '#4ade80' : '#f87171'}">${s.alibi.verified ? 'подтверждено' : 'не подтверждено'}</span>` : ''}
            </div>`;

        element.innerHTML = `
            <div style="
                border-left:6px solid ${isCorrect ? '#22c55e' : '#ef4444'};
                background:${isCorrect ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)'};
                border:1px solid ${isCorrect ? '#166534' : '#7f1d1d'};
                border-left-width:6px;
                padding:20px 22px;border-radius:12px;margin-top:10px;
            ">
                ${headlineHTML}

                <h2 style="margin:0 0 6px;color:${isCorrect ? '#4ade80' : '#f87171'};font-size:1.2rem">
                    ${isCorrect ? '✅ ПРАВИЛЬНОЕ РЕШЕНИЕ' : '❌ СУДЕБНАЯ ОШИБКА'}
                </h2>
                <p style="font-size:14px;color:#cbd5e1;margin:0 0 16px;line-height:1.6">${result.feedback || result.message || ''}</p>

                <!-- Метрики -->
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
                    <div style="background:rgba(255,255,255,.07);border:1px solid #334155;border-radius:8px;padding:12px;text-align:center">
                        <div style="font-size:1.4em;font-weight:800;color:#38bdf8">+${result.score}</div>
                        <div style="font-size:11px;color:#64748b;margin-top:2px">Очков</div>
                    </div>
                    <div style="background:rgba(255,255,255,.07);border:1px solid #334155;border-radius:8px;padding:12px;text-align:center">
                        <div style="font-size:1.4em;font-weight:800;color:${repLaw >= 0 ? '#4ade80' : '#f87171'}">${repLaw > 0 ? '+' : ''}${repLaw}%</div>
                        <div style="font-size:11px;color:#64748b;margin-top:2px">⚖️ Закон</div>
                    </div>
                    <div style="background:rgba(255,255,255,.07);border:1px solid #334155;border-radius:8px;padding:12px;text-align:center">
                        <div style="font-size:1.4em;font-weight:800;color:${repShadow >= 0 ? '#c084fc' : '#f87171'}">${repShadow > 0 ? '+' : ''}${repShadow}%</div>
                        <div style="font-size:11px;color:#64748b;margin-top:2px">💰 Тени</div>
                    </div>
                </div>

                ${scenarioHTML}

                <div style="display:flex;gap:10px;margin-top:8px">
                    <button id="next-case-btn" style="
                        flex:2;padding:13px;
                        background:linear-gradient(135deg,#1d4ed8,#2563eb);
                        color:#fff;border:none;border-radius:8px;cursor:pointer;
                        font-family:inherit;font-weight:700;font-size:14px;
                        transition:transform .15s
                    ">▶️ Следующее дело</button>
                    <button id="cabinet-after-verdict-btn" style="
                        flex:1;padding:13px;
                        background:rgba(255,255,255,.07);color:#94a3b8;
                        border:1px solid #334155;border-radius:8px;cursor:pointer;
                        font-family:inherit;font-weight:600;font-size:14px;
                        transition:background .2s
                    ">👤 В кабинет</button>
                </div>
            </div>
        `;

        element.querySelector('#cabinet-after-verdict-btn')?.addEventListener('click', () => {
            window.game?.showOffice();
        });
        element.querySelector('#next-case-btn')?.addEventListener('click', () => {
            window.game?.showOffice();
        });
        // Ховер-эффекты
        const nextBtn = element.querySelector('#next-case-btn');
        if (nextBtn) {
            nextBtn.onmouseenter = () => { nextBtn.style.transform = 'scale(1.02)'; };
            nextBtn.onmouseleave = () => { nextBtn.style.transform = 'scale(1)'; };
        }
    }
}
