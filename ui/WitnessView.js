import { CredibilitySystem } from '../systems/CredibilitySystem.js';
import { InterrogationEngine, FactJournal } from '../systems/InterrogationEngine.js';
import { InterrogationDirector } from '../systems/interrogation/InterrogationDirector.js';
import { QuestionEngine } from '../systems/interrogation/QuestionEngine.js';
import { PressureEngine } from '../systems/interrogation/PressureEngine.js';
import { PHASE_META } from '../systems/interrogation/InterrogationSession.js';
import { JUDGE_PHRASES, WITNESS_BRAVE, WITNESS_NERVOUS, WITNESS_NEUTRAL, WITNESS_BREAKDOWN } from '../data/ConfrontationPhrases.js';



/**
 * Компонент для отображения диалогов со свидетелями.
 */
export class WitnessView {
    constructor(container) {
        this.container = container;
    }

    /** Переключает контейнер при повторном монтировании вкладки */
    mount(el) {
        this.container = el;
    }

    renderList(witnesses, onSelect, onConfrontation) {
        this.container.innerHTML = '<h2>Допрос свидетелей</h2>';
        const listDiv = document.createElement('div');
        listDiv.style.display = 'flex';
        listDiv.style.direction = 'column';
        listDiv.style.gap = '10px';
        
        witnesses.forEach(w => {
            const el = document.createElement('div');
            el.className = 'card witness-item';
            el.style.flex = '1';
            el.innerHTML = `
                <div class="witness-info">
                    <strong>${w.name}</strong>
                    <div class="psych-profile">
                        <small>Честность: ${Math.round(w.personality.honesty * 100)}% | Смелость: ${Math.round(w.personality.courage * 100)}%</small>
                    </div>
                </div>
            `;
            el.onclick = () => onSelect(w);
            listDiv.appendChild(el);
        });
        this.container.appendChild(listDiv);

        const confrontBtn = document.createElement('button');
        confrontBtn.className = 'tab-btn';
        confrontBtn.innerText = '⚔️ Назначить очную ставку';
        confrontBtn.style.marginTop = '20px';
        confrontBtn.onclick = onConfrontation;
        this.container.appendChild(confrontBtn);
    }

    renderConfrontation(caseData, w1, w2, onBack) {
        let evOptions = '<option value="">(Выберите улику для давления)</option>';
        if (caseData && caseData.evidence && caseData.evidence.length > 0) {
            evOptions += caseData.evidence.map(e => `<option value="${e.id}" data-name="${e.name}">${e.name} (${e.type})</option>`).join('');
        }

        this.container.innerHTML = `
            <button id="back-to-list" class="tab-btn">← К списку</button>
            <div class="card" style="background: linear-gradient(to bottom, #2b2b2b, #1a1a1a); border: 2px solid crimson;">
                <h3 style="text-align: center; color: #ff6b6b; text-transform: uppercase;">Очная ставка: ${w1.name} VS ${w2.name}</h3>
                
                <div id="confrontation-area" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 15px;">
                    <!-- Свидетель 1 -->
                    <div class="witness-col" style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                        <h4 style="margin-top: 0; color: #4facfe;">${w1.name}</h4>
                        <div style="font-size: 12px; margin-bottom: 10px;">
                            <div>Стресс: <span id="w1-stress-val">${Math.round(w1.emotionalState.stress * 100)}</span>%
                                <div style="height: 6px; background: #333; border-radius: 3px; margin-top: 2px;">
                                    <div id="w1-stress-bar" style="height: 100%; width: ${w1.emotionalState.stress * 100}%; background: ${w1.emotionalState.stress > 0.7 ? '#e74c3c' : '#f39c12'}; border-radius: 3px; transition: width 0.3s;"></div>
                                </div>
                            </div>
                            <div style="margin-top: 5px;">Уверенность: <span id="w1-conf-val">${Math.round(w1.emotionalState.confidence * 100)}</span>%
                                <div style="height: 6px; background: #333; border-radius: 3px; margin-top: 2px;">
                                    <div id="w1-conf-bar" style="height: 100%; width: ${w1.emotionalState.confidence * 100}%; background: #2ecc71; border-radius: 3px; transition: width 0.3s;"></div>
                                </div>
                            </div>
                        </div>
                        <div id="w1-history" style="height: 250px; overflow-y: auto; font-size: 14px; border-top: 1px solid #4facfe; padding-top: 10px;"></div>
                        <div id="w1-pressure-controls" style="display: none; margin-top: 10px; border-top: 1px dotted #555; padding-top: 10px;">
                            <select id="w1-evidence-select" style="width: 100%; padding: 5px; margin-bottom: 5px; background: #333; color: white; border: 1px solid #555;">
                                ${evOptions}
                            </select>
                            <button id="btn-pressure-w1" class="tab-btn" style="width: 100%; background: #e74c3c; color: white;">⚖️ Предъявить улику ${w1.name}</button>
                        </div>
                    </div>

                    <!-- Свидетель 2 -->
                    <div class="witness-col" style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                        <h4 style="margin-top: 0; color: #f6d365;">${w2.name}</h4>
                        <div style="font-size: 12px; margin-bottom: 10px;">
                            <div>Стресс: <span id="w2-stress-val">${Math.round(w2.emotionalState.stress * 100)}</span>%
                                <div style="height: 6px; background: #333; border-radius: 3px; margin-top: 2px;">
                                    <div id="w2-stress-bar" style="height: 100%; width: ${w2.emotionalState.stress * 100}%; background: ${w2.emotionalState.stress > 0.7 ? '#e74c3c' : '#f39c12'}; border-radius: 3px; transition: width 0.3s;"></div>
                                </div>
                            </div>
                            <div style="margin-top: 5px;">Уверенность: <span id="w2-conf-val">${Math.round(w2.emotionalState.confidence * 100)}</span>%
                                <div style="height: 6px; background: #333; border-radius: 3px; margin-top: 2px;">
                                    <div id="w2-conf-bar" style="height: 100%; width: ${w2.emotionalState.confidence * 100}%; background: #2ecc71; border-radius: 3px; transition: width 0.3s;"></div>
                                </div>
                            </div>
                        </div>
                        <div id="w2-history" style="height: 250px; overflow-y: auto; font-size: 14px; border-top: 1px solid #f6d365; padding-top: 10px;"></div>
                        <div id="w2-pressure-controls" style="display: none; margin-top: 10px; border-top: 1px dotted #555; padding-top: 10px;">
                            <select id="w2-evidence-select" style="width: 100%; padding: 5px; margin-bottom: 5px; background: #333; color: white; border: 1px solid #555;">
                                ${evOptions}
                            </select>
                            <button id="btn-pressure-w2" class="tab-btn" style="width: 100%; background: #e74c3c; color: white;">⚖️ Предъявить улику ${w2.name}</button>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 15px; text-align: center; border-top: 1px dashed #555; padding-top: 15px;">
                    <p style="color: #ccc; font-size: 14px; margin-bottom: 10px;"><em>Выберите показания для сопоставления (поиск противоречий)</em></p>
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button class="action-btn-confront" data-topic="событие" style="border-color: #7f8c8d;">Событие преступления</button>
                        <button class="action-btn-confront" data-topic="алиби" style="border-color: #7f8c8d;">Алиби / Время</button>
                        <button class="action-btn-confront" data-topic="описание" style="border-color: #7f8c8d;">Характерные приметы</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('back-to-list').onclick = onBack;
        
        document.querySelectorAll('.action-btn-confront').forEach(btn => {
            btn.onclick = () => {
                const topic = btn.dataset.topic;
                this.addConfrontationMessage(w1, w2, topic, onBack);
            };
        });

        // Обработчики давления
        this._setupPressureButton('w1', w1, w2, onBack);
        this._setupPressureButton('w2', w2, w1, onBack);
    }

    _setupPressureButton(targetId, targetObject, otherObject, onBack) {
        const btn = document.getElementById(`btn-pressure-${targetId}`);
        const select = document.getElementById(`${targetId}-evidence-select`);
        if (!btn || !select) return;
        
        btn.onclick = () => {
            if (!select.value) {
                this.setStatusMessage("Сначала выберите улику из списка!", "error");
                return;
            }
            
            const selectedOption = select.options[select.selectedIndex];
            const evidenceName = selectedOption.getAttribute('data-name') || "материалы дела";

            // Судья давит
            const intensity = 0.25; 
            const state = targetObject.applyPressure(intensity, 1.2); 
            
            const judgePhrase = this._generateJudgePressurePhrase(targetObject, evidenceName);
            this.addMessageToArena(targetId, "СУДЬЯ", judgePhrase, "#ff4757");
            
            this._updateArenaStats('w1', targetId === 'w1' ? targetObject : otherObject);
            this._updateArenaStats('w2', targetId === 'w2' ? targetObject : otherObject);

            if (state === "breakdown") {
                const breakdownPhrase = this._generateBreakdownPhrase(targetObject);
                this.addMessageToArena(targetId, targetObject.name, breakdownPhrase, "#eccc68");
                targetObject.changeTestimony(0, "Я отказываюсь от своих прошлых показаний в свете предъявленных улик.", "recanted");
                
                this.setStatusMessage(`Свидетель ${targetObject.name} сломлен и изменил показания!`, "success");
                
                document.getElementById('w1-pressure-controls').style.display = 'none';
                document.getElementById('w2-pressure-controls').style.display = 'none';
                
                setTimeout(() => this._updateArenaStats(targetId, targetObject), 500);
            } else {
                const reactionPhrase = this._generateWitnessReaction(targetObject, state);
                this.addMessageToArena(targetId, targetObject.name, reactionPhrase, "#a4b0be");
                
                otherObject.emotionalState.confidence = Math.min(1, otherObject.emotionalState.confidence + 0.1);
                this._updateArenaStats(targetId === 'w1' ? 'w2' : 'w1', otherObject);
            }
        };
    }

    _generateJudgePressurePhrase(witness, evidenceName) {
        const phrase = JUDGE_PHRASES[Math.floor(Math.random() * JUDGE_PHRASES.length)];
        return phrase.replace(/{evidence}/g, evidenceName);
    }

    _generateWitnessReaction(witness, state) {
        // Упорные, уверенные или нервные реакции в зависимости от смелости
        if (witness.personality.courage > 0.7) {
            return WITNESS_BRAVE[Math.floor(Math.random() * WITNESS_BRAVE.length)];
        } else if (witness.emotionalState.stress > 0.6) {
            return WITNESS_NERVOUS[Math.floor(Math.random() * WITNESS_NERVOUS.length)];
        } else {
            return WITNESS_NEUTRAL[Math.floor(Math.random() * WITNESS_NEUTRAL.length)];
        }
    }

    _generateBreakdownPhrase(witness) {
        return WITNESS_BREAKDOWN[Math.floor(Math.random() * WITNESS_BREAKDOWN.length)];
    }

    _updateArenaStats(prefix, w) {
        const stressVal = document.getElementById(`${prefix}-stress-val`);
        const stressBar = document.getElementById(`${prefix}-stress-bar`);
        const confVal = document.getElementById(`${prefix}-conf-val`);
        const confBar = document.getElementById(`${prefix}-conf-bar`);
        
        if (stressVal && stressBar) {
            stressVal.innerText = Math.round(w.emotionalState.stress * 100);
            stressBar.style.width = `${w.emotionalState.stress * 100}%`;
            stressBar.style.background = w.emotionalState.stress > 0.7 ? '#e74c3c' : '#f39c12';
        }
        if (confVal && confBar) {
            confVal.innerText = Math.round(w.emotionalState.confidence * 100);
            confBar.style.width = `${w.emotionalState.confidence * 100}%`;
        }
    }

    addMessageToArena(targetId, author, text, color = "#fff") {
        const history = document.getElementById(`${targetId}-history`);
        if (!history) return;
        
        history.innerHTML += `<p style="margin: 5px 0;"><strong style="color: ${color};">${author}:</strong> ${text}</p>`;
        history.scrollTop = history.scrollHeight;
    }

    addConfrontationMessage(w1, w2, topic, onBack) {
        // Симулируем выбор показаний по "теме" - берем первые попавшиеся показания (упрощенно)
        // В боевой версии здесь будет поиск Testimony, соответствующих Topic
        const t1 = w1.testimonies[0]; 
        const t2 = w2.testimonies[0];
        
        if (!t1 || !t2) {
            this.setStatusMessage("Недостаточно показаний для сравнения", "info");
            return;
        }

        this.addMessageToArena('w1', w1.name, t1.text, "#4facfe");
        this.addMessageToArena('w2', w2.name, t2.text, "#f6d365");
        
        // Используем CredibilitySystem для определения типа противоречия между текстами
        const contradictionType = CredibilitySystem.detectContradictionType(t1.text, t2.text);
        
        if (contradictionType) {
            // Если есть реальное противоречие (семантика / ключевые слова) или типы разные
            const penaltyInfo = CredibilitySystem.CONTRADICTION_PENALTIES[contradictionType];
            this.setStatusMessage(`Обнаружено противоречие (${contradictionType})! Выберите, на кого оказать давление.`, "error");
            
            w1.applyPressure(0.05);
            w2.applyPressure(0.05);
            this._updateArenaStats('w1', w1);
            this._updateArenaStats('w2', w2);

            // Показываем контролы давления (селект + кнопка)
            document.getElementById('w1-pressure-controls').style.display = 'block';
            document.getElementById('w2-pressure-controls').style.display = 'block';
            
            if (w1.emotionalState.fear > w2.personality.courage) {
                this.addMessageToArena('w1', 'Система', `<em>${w1.name} начинает нервничать под взглядом ${w2.name}.</em>`, '#ff9f43');
            } else if (w2.emotionalState.fear > w1.personality.courage) {
                this.addMessageToArena('w2', 'Система', `<em>${w2.name} сжимается от уверенности ${w1.name}.</em>`, '#ff9f43');
            }
        } else {
            this.setStatusMessage("Прямых противоречий в этих показаниях не найдено.", "info");
            document.getElementById('w1-pressure-controls').style.display = 'none';
            document.getElementById('w2-pressure-controls').style.display = 'none';
        }
    }

    setStatusMessage(text, type) {
        const msg = document.createElement('div');
        msg.className = `badge ${type}`;
        msg.innerText = text;
        msg.style.padding = '10px';
        msg.style.marginTop = '10px';
        this.container.appendChild(msg);
    }

    renderDialogue(witness, onBack) {
        this.container.innerHTML = `
            <button id="back-to-list" class="tab-btn">← К списку</button>
            <div class="card">
                <h3>Допрос: ${witness.name}</h3>
                <div id="dialogue-history" style="height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; margin-bottom: 10px;">
                    <p><em>Состояние: стресс ${Math.round(witness.emotionalState.stress * 100)}%, уверенность ${Math.round(witness.emotionalState.confidence * 100)}%</em></p>
                </div>
                <div id="witness-actions">
                    <div class="pressure-tools" style="margin-bottom: 15px;">
                        <button id="btn-pressure" class="tab-btn" style="background: var(--error-color); color: white;">⚖️ Надавить (Stress ↑)</button>
                    </div>
                    ${witness.testimonies.map((t, i) => `
                        <div class="testimony-marker-container">
                            <button class="action-btn" data-index="${i}">${t.text.substring(0, 50)}...</button>
                            <div class="marking-tools" style="margin-bottom: 10px;">
                                <button class="mark-btn-testimony ${t.playerMark === 'confirmed' ? 'active' : ''}" data-idx="${i}" data-status="confirmed">✅</button>
                                <button class="mark-btn-testimony ${t.playerMark === 'suspicious' ? 'active' : ''}" data-idx="${i}" data-status="suspicious">❓</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.getElementById('back-to-list').onclick = onBack;
        
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idx = e.target.dataset.index;
                this.addMessage(witness.name, witness.testimonies[idx].text);
            };
        });

        document.querySelectorAll('.mark-btn-testimony').forEach(btn => {
            btn.onclick = (e) => {
                const idx = e.target.dataset.idx;
                const status = e.target.dataset.status;
                witness.testimonies[idx].playerMark = status;
                this.renderDialogue(witness, onBack); // Ре-рендер
            };
        });

        document.getElementById('btn-pressure').onclick = () => {
            const reaction = witness.applyPressure(0.15);
            this.addMessage("СУДЬЯ", "(строго) Свидетель, вы уверены в своих словах?");
            
            if (reaction === "breakdown") {
                this.addMessage(witness.name, "Простите... я... я солгал. Всё было не так!");
                // Меняем тип первого показания на признание (упрощенно)
                witness.testimonies[0].type = 'confessed';
                witness.testimonies[0].text = "На самом деле, я не уверен, что это был он. Было слишком темно.";
            } else {
                this.addMessage(witness.name, this._generateReactions(witness));
            }
            this.renderDialogue(witness, onBack); // Ре-рендер для обновления статус-бара
        };
    }

    _generateReactions(witness) {
        if (witness.emotionalState.stress > 0.7) return "Я... я не знаю... кажется... всё верно...";
        if (witness.personality.courage > 0.7) return "Я абсолютно уверен в своих показаниях!";
        return "Да, я подтверждаю свои слова.";
    }

    addMessage(author, text) {
        const history = document.getElementById('dialogue-history');
        const p = document.createElement('p');
        p.innerHTML = `<strong>${author}:</strong> ${text}`;
        history.appendChild(p);
        history.scrollTop = history.scrollHeight;
    }

    renderInterrogation(witness, side, caseData, onBack) {
        const sideName  = side === 'prosecution' ? '⚖️ Обвинение' : '🛡️ Защита';
        const sideColor = side === 'prosecution' ? '#ef4444' : '#22c55e';

        // Создаём сессию через InterrogationDirector
        const session      = InterrogationDirector.createSession(witness, caseData, side);
        const testimonies  = witness.testimonies ?? [];
        const evidenceList = caseData?.evidence  ?? [];

        // Группируем вопросы по категориям
        const qCats = QuestionEngine.CATEGORIES;
        const qTypes = QuestionEngine.QUESTION_TYPES;

        this.container.innerHTML = `
            <button id="back-interrogation" class="tab-btn" style="margin-bottom:1rem">← Назад</button>

            <div class="interrogation-header" style="border-left:4px solid ${sideColor}">
                <div class="interrogation-side-badge" style="color:${sideColor}">${sideName}</div>
                <h3 style="margin:0 0 4px">Допрос: <strong>${witness.name}</strong></h3>
                <small style="color:var(--text-secondary)">${witness.role || 'Свидетель'}
                  &nbsp;·&nbsp; Архетип: <b id="archetype-label">${session.psychModel.archetypeLabel}</b>
                </small>
            </div>

            <!-- Фаза допроса -->
            <div id="phase-panel" class="card" style="margin-bottom:1rem;padding:0.75rem;display:flex;align-items:center;gap:12px">
                <span id="phase-icon" style="font-size:1.4rem">📋</span>
                <div style="flex:1">
                    <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Фаза</div>
                    <div id="phase-label" style="font-weight:700;font-size:0.88rem">Исходная версия</div>
                    <div id="phase-desc" style="font-size:0.75rem;color:var(--text-muted)"></div>
                </div>
                <div style="text-align:right">
                    <div id="break-stage-badge" style="font-size:0.78rem;font-weight:700">🔒 Стабилен</div>
                    <div id="tactic-badge" style="font-size:0.72rem;color:var(--text-muted)"></div>
                </div>
            </div>

            <!-- 5 шкал давления -->
            <div class="card" style="margin-bottom:1rem;padding:1rem">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.82rem">
                    ${this._renderStatBar('Эмоц. давление', 'p-emotional', 0, '#ef4444')}
                    ${this._renderStatBar('Лог. давление',  'p-logical',   0, '#6366f1')}
                    ${this._renderStatBar('Доказат.',       'p-evidence',  0, '#f97316')}
                    ${this._renderStatBar('Усталость',      'p-fatigue',   0, '#f59e0b')}
                    ${this._renderStatBar('Соц. давление',  'p-social',    0, '#22c55e')}
                    ${this._renderStatBar('ИТОГО',          'p-total',     0, '#94a3b8')}
                </div>
                <div id="cognitive-load-row" style="margin-top:8px;font-size:0.78rem;color:var(--text-muted)">
                    Cognitive load: <b id="cog-val">0%</b> &nbsp;|&nbsp; Вопросов: <b id="q-count">0</b>
                </div>
            </div>

            <!-- Целевое показание -->
            ${testimonies.length > 0 ? `
            <div class="card" style="margin-bottom:1rem;padding:1rem">
                <div style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Целевое показание</div>
                <select id="target-testimony-select" style="width:100%;background:var(--surface-3);color:var(--text-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:6px 10px;font-family:inherit;font-size:0.85rem">
                    <option value="">— Без конкретного показания —</option>
                    ${testimonies.map((t,i) => `<option value="${i}">[${t.type==='true'?'✅':t.type==='lie'?'❌':'✏️'}] ${(t.text??'').slice(0,65)}…</option>`).join('')}
                </select>
            </div>` : ''}

            <!-- Улика -->
            ${evidenceList.length > 0 ? `
            <div class="card" style="margin-bottom:1rem;padding:1rem">
                <div style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Предъявляемая улика</div>
                <select id="evidence-select" style="width:100%;background:var(--surface-3);color:var(--text-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:6px 10px;font-family:inherit;font-size:0.85rem">
                    <option value="">— Без улики —</option>
                    ${evidenceList.map((e,i)=>`<option value="${i}">${e.label??e.type??'Улика'}</option>`).join('')}
                </select>
            </div>` : ''}

            <!-- AI-рекомендация -->
            <div class="card" id="rec-panel" style="margin-bottom:1rem;padding:0.75rem;display:none">
                <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">💡 Рекомендация следователя</div>
                <div id="rec-text" style="font-size:0.82rem;color:var(--primary-color);font-style:italic"></div>
                <div id="rec-reason" style="font-size:0.75rem;color:var(--text-muted);margin-top:3px"></div>
            </div>

            <!-- Вопросы по категориям -->
            <div class="card" style="margin-bottom:1rem;padding:1rem">
                ${Object.entries(qCats).map(([catKey, cat]) => `
                <div style="margin-bottom:10px">
                    <div style="font-size:0.72rem;font-weight:700;color:${cat.color};text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">${cat.label}</div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:5px">
                    ${Object.entries(qTypes).filter(([,qt])=>qt.category===catKey).map(([key,qt])=>`
                        <button class="interrogation-q-btn dir-q-btn" data-qtype="${key}"
                            title="${qt.template}">
                            <span>${qt.icon}</span>
                            <span class="q-text" style="font-size:0.78rem">${qt.label}</span>
                        </button>`).join('')}
                    </div>
                </div>`).join('')}
            </div>

            <!-- Лог ответов -->
            <div id="interrogation-answers" class="interrogation-log" style="margin-bottom:1.5rem"></div>

            <!-- Вскрытые противоречия -->
            <div id="contradictions-section">
                <h4 class="fact-journal-title">⚡ Вскрытые противоречия</h4>
                <div id="contradictions-list" class="fact-journal-list"></div>
            </div>

            <!-- Журнал фактов -->
            <div id="fact-journal-section">
                <h4 class="fact-journal-title">📌 Журнал значимых показаний</h4>
                <div id="fact-journal-list" class="fact-journal-list"></div>
            </div>
        `;

        document.getElementById('back-interrogation').onclick = onBack;
        if (!this._factJournal) this._factJournal = new FactJournal();

        const answersDiv  = document.getElementById('interrogation-answers');
        const factListEl  = document.getElementById('fact-journal-list');
        const contradEl   = document.getElementById('contradictions-list');

        // Рендерим начальную рекомендацию
        this._updateDirectorUI(session, null);

        document.querySelectorAll('.dir-q-btn').forEach(btn => {
            btn.onclick = () => {
                const questionType = btn.dataset.qtype;
                const qt = QuestionEngine.QUESTION_TYPES[questionType];

                const tsSelect = document.getElementById('target-testimony-select');
                const tsIdx    = tsSelect ? parseInt(tsSelect.value) : NaN;
                const targetTestimony = !isNaN(tsIdx) ? testimonies[tsIdx] : null;

                const evSelect = document.getElementById('evidence-select');
                const evIdx    = evSelect ? parseInt(evSelect.value) : NaN;
                const evidence = !isNaN(evIdx) ? evidenceList[evIdx] : null;

                const result = InterrogationDirector.ask(session, questionType, {
                    targetTestimony,
                    evidence,
                    evidence_label: evidence?.label ?? evidence?.type ?? '',
                });

                const { answerEvent: ae, response, testimonyUpdate, newContradictions, phaseChanged, ui } = result;

                // Обновляем 5 шкал
                this._updateStatBar('p-emotional', ui.emotional);
                this._updateStatBar('p-logical',   ui.logical);
                this._updateStatBar('p-evidence',  ui.evidence);
                this._updateStatBar('p-fatigue',   ui.fatigue);
                this._updateStatBar('p-social',    ui.social);
                this._updateStatBar('p-total',     ui.total);
                document.getElementById('cog-val').textContent   = Math.round(ui.cognitiveLoad*100)+'%';
                document.getElementById('q-count').textContent   = ui.questionsAsked;

                // Фаза + стадия
                this._updateDirectorUI(session, ae);

                // Рендерим ответ
                const kindCls = ['full_admission','partial_admission','correction','contradictory_answer'].includes(response.kind)
                    ? 'answer-contradiction'
                    : response.kind === 'anger_response' || response.kind === 'overexplaining'
                    ? 'answer-misleading' : 'answer-normal';

                const answerEl = document.createElement('div');
                answerEl.className = `interrogation-answer ${kindCls}`;
                answerEl.innerHTML = `
                    <div class="answer-question">
                        <span style="color:${sideColor}">${sideName}</span> &nbsp;·&nbsp;
                        <span style="color:var(--text-muted)">${qt.icon} ${qt.label}</span> &nbsp;·&nbsp;
                        <span style="font-size:0.82rem">${(qt.templates?.[0] ?? qt.template ?? '').slice(0,70)}…</span>
                    </div>
                    <div class="answer-text">
                        <strong>${witness.name}:</strong>
                        <div style="font-size:0.85rem;margin:4px 0;color:var(--text-primary);font-style:italic">«${ae.responseText}»</div>
                        <span style="color:${response.color};font-size:0.75rem">${response.icon} ${response.label}</span>
                        ${testimonyUpdate?.changed ? `
                        <div style="margin-top:5px;padding:5px 8px;background:rgba(248,81,73,0.08);border-radius:4px;font-size:0.8rem">
                            <span style="color:var(--text-muted)">Было:</span> ${(testimonyUpdate.before?.text??'').slice(0,70)}…<br>
                            <span style="color:var(--primary-color)">Стало:</span> ${(testimonyUpdate.after?.text??'').slice(0,90)}
                        </div>` : ''}
                    </div>
                    <div class="answer-tags" style="margin-top:5px; display:flex; flex-wrap:wrap; gap:5px; align-items:center;">
                        <span class="tag" style="background:${response.color}22;color:${response.color}">${response.icon} ${response.label}</span>
                        ${ae.newContradictions?.length ? `<span class="tag tag-contradict">⚡ ${ae.newContradictions.length} противоречий</span>` : ''}
                        ${testimonyUpdate?.changed ? `<span class="tag tag-key">✏️ ${testimonyUpdate.changeType}</span>` : ''}
                        ${ui.breaking ? `<span class="tag" style="background:#ef444422;color:#ef4444">💥 Ломается</span>` : ''}
                        
                        <div class="evidence-extract-actions" style="display:inline-flex; gap:5px; margin-left:auto;">
                            <button class="extract-btn" data-mark="confirmed" style="background:rgba(39, 174, 96, 0.1); color:#27ae60; border:1px solid #27ae60; border-radius:4px; padding:2px 8px; font-size:0.75rem; cursor:pointer; font-family:inherit; transition:all 0.2s;">✅ За обвинение</button>
                            <button class="extract-btn" data-mark="contradictory" style="background:rgba(231, 76, 60, 0.1); color:#e74c3c; border:1px solid #e74c3c; border-radius:4px; padding:2px 8px; font-size:0.75rem; cursor:pointer; font-family:inherit; transition:all 0.2s;">❌ За защиту</button>
                        </div>
                    </div>
                `;
                answersDiv.prepend(answerEl);

                // Обработчики кнопок извлечения
                const extractContainer = answerEl.querySelector('.evidence-extract-actions');
                answerEl.querySelectorAll('.extract-btn').forEach(btn => {
                    btn.onclick = () => {
                        const mark = btn.dataset.mark;
                        const ev = InterrogationDirector.extractEvidence(session, ae.id, mark);
                        if (ev) {
                            extractContainer.innerHTML = `<span class="tag" style="background:rgba(52, 152, 219, 0.1);color:#3498db;border:1px solid #3498db">🔖 Приобщено к делу</span>`;
                        }
                    };
                });

                // Вскрытые противоречия
                if (newContradictions.length > 0) {
                    newContradictions.forEach(c => {
                        const el = document.createElement('div');
                        el.className = 'fact-item fact-key';
                        el.innerHTML = `<span>${c.icon} <b>${c.label}</b>:</span> <span style="color:var(--text-muted)">${c.description}</span>`;
                        contradEl.prepend(el);
                    });
                }

                // Журнал фактов
                if (response.changesTestimony || ae.newContradictions?.length) {
                    this._factJournal.addFact(witness, {
                        questionText:    qt.label,
                        answerText:      `«${ae.responseText}» (${response.label})`,
                        isKeyFact:       ['full_admission','partial_admission'].includes(response.kind),
                        isMisleading:    response.kind === 'overexplaining',
                        hasContradiction:ae.newContradictions?.length > 0,
                    }, side);
                    this._renderFactJournal(factListEl);
                }
            };
        });
    }

    /** Обновляет панель фазы и рекомендации */
    _updateDirectorUI(session, lastAE) {
        const ui  = InterrogationDirector.uiSnapshot(session, lastAE);
        const bsl = PressureEngine.STAGE_LABELS[ui.breakStage] ?? {};
        const rec = ui.recommendation;

        const phaseIcon  = document.getElementById('phase-icon');
        const phaseLabel = document.getElementById('phase-label');
        const phaseDesc  = document.getElementById('phase-desc');
        const breakBadge = document.getElementById('break-stage-badge');
        const tacticBadge= document.getElementById('tactic-badge');
        const recPanel   = document.getElementById('rec-panel');
        const recText    = document.getElementById('rec-text');
        const recReason  = document.getElementById('rec-reason');

        if (phaseIcon)  phaseIcon.textContent  = ui.phaseIcon;
        if (phaseLabel) { phaseLabel.textContent = ui.phaseLabel; phaseLabel.style.color = ui.phaseColor; }
        if (phaseDesc)  phaseDesc.textContent   = ui.phaseDescription;
        if (breakBadge) { breakBadge.innerHTML = `${bsl.icon??''} ${bsl.label??ui.breakStage}`; breakBadge.style.color = bsl.color??'#94a3b8'; }
        if (tacticBadge) tacticBadge.textContent = `${ui.tacticIcon} Тактика: ${ui.tactic}`;

        if (recPanel && rec) {
            recPanel.style.display = '';
            if (recText)   recText.textContent   = '→ ' + rec.text;
            if (recReason) recReason.textContent = rec.reason;
        }
    }


    /** Рендерит строку стат-бара */
    _renderStatBar(label, id, value, color) {
        const pct = Math.round(value * 100);
        return `
            <div>
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:0.75rem">
                    <span style="color:var(--text-secondary)">${label}</span>
                    <span id="${id}-val" style="color:${color};font-weight:700">${pct}%</span>
                </div>
                <div class="bar-wrap" style="height:5px">
                    <div id="${id}-bar" class="bar-fill" style="width:${pct}%;background:${color};transition:width 0.4s ease"></div>
                </div>
            </div>`;
    }

    /** Обновляет бар по id */
    _updateStatBar(id, value) {
        const pct = Math.round(value * 100);
        const bar = document.getElementById(`${id}-bar`);
        const val = document.getElementById(`${id}-val`);
        if (bar) bar.style.width = pct + '%';
        if (val) val.textContent = pct + '%';
    }

    /** Выделяет ключевые фразы в тексте ответа */
    _highlightKeyPhrases(text, result) {
        if (result.isKeyFact)      return `<mark class="highlight-key">${text}</mark>`;
        if (result.isMisleading)   return `<mark class="highlight-mislead">${text}</mark>`;
        if (result.hasContradiction) return `<mark class="highlight-contradict">${text}</mark>`;
        return text;
    }

    /** Рендерит список журнала ключевых фактов */
    _renderFactJournal(container) {
        if (!this._factJournal) return;
        const entries = this._factJournal.getSorted();
        if (entries.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem">Ключевых фактов пока нет.</div>';
            return;
        }
        container.innerHTML = entries.map(e => `
            <div class="fact-entry fact-entry-${e.isKeyFact ? 'key' : e.isMisleading ? 'mislead' : 'contradict'}">
                <div class="fact-meta">
                    <span class="fact-witness">${e.witnessName}</span>
                    <span class="fact-side-badge" style="color:${e.side === 'prosecution' ? '#ef4444' : '#22c55e'}">${e.side === 'prosecution' ? 'Обвинение' : 'Защита'}</span>
                    <span class="fact-time">${e.timestamp}</span>
                </div>
                <div class="fact-answer">${e.answerText}</div>
                <div class="fact-tags">
                    ${e.isKeyFact ? '<span class="tag tag-key">🔑 Ключевой</span>' : ''}
                    ${e.isMisleading ? '<span class="tag tag-mislead">⚠️ Ложный след</span>' : ''}
                    ${e.hasContradiction ? '<span class="tag tag-contradict">⚡ Противоречие</span>' : ''}
                </div>
            </div>
        `).join('');
    }

    /** Получить журнал фактов (для сохранения на вкладке) */
    getFactJournal() {
        return this._factJournal ?? (this._factJournal = new FactJournal());
    }
}
