/**
 * Вспомогательный класс для отображения данных дела.
 */
import { AdvancedEvidenceSystem } from '../systems/AdvancedEvidenceSystem.js';
import { ContradictionSystem } from '../systems/ContradictionSystem.js';

export class CaseView {

    /**
     * ВКЛАДКА: Материалы дела — исчерпывающая сводка
     */
    static renderCaseSummary(activeCase, element) {
        const s = activeCase.trueScenario;
        const evidence  = activeCase.evidence  || [];
        const witnesses = activeCase.witnesses  || [];

        const typeIcons  = { physical:'📦', biological:'🧬', digital:'💻', document:'📄', expertise:'📑' };
        const evidenceHTML = evidence.map(ev =>
            `<li style="margin-bottom:4px">${typeIcons[ev.type] || '🔍'} <strong>${ev.label || ev.type}</strong> — ${ev.description}</li>`
        ).join('');

        const witnessHTML = witnesses.map(w => {
            const t = w.testimonies?.[0];
            return `<li style="margin-bottom:6px">
                <strong>${w.name}</strong>${w.role ? `&nbsp;<span style="color:#888;font-size:12px">(${w.role})</span>` : ''}
                ${t ? `<br><em style="color:#555;font-size:13px">"${t.text.slice(0, 110)}${t.text.length > 110 ? '…' : ''}"</em>` : ''}
            </li>`;
        }).join('');

        const factsHTML = (s.facts || []).map(f =>
            `<li><strong>${f.when}:</strong> ${f.text}</li>`
        ).join('');

        element.innerHTML = `
            <div class="card" style="border-left:5px solid #2c3e50;background:linear-gradient(135deg,#2c3e50,#34495e);color:#ecf0f1;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <div>
                        <div style="font-size:11px;opacity:.6;letter-spacing:2px;text-transform:uppercase">Уголовное дело</div>
                        <div style="font-size:1.3em;font-weight:700;margin:4px 0">${activeCase.id || '—'}</div>
                        <div style="opacity:.85">${activeCase.description}</div>
                    </div>
                    <span style="font-size:2.5em;opacity:.5">${s.isGuilty ? '🔴' : '🟢'}</span>
                </div>
            </div>

            <div class="card" style="border-left:5px solid #3498db;margin-top:14px">
                <h3>📌 Общие сведения</h3>
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                    <tr><td style="padding:4px 8px;color:#888;width:42%">Тип преступления</td><td><strong>${activeCase.crimeData?.label || activeCase.label || activeCase.type}</strong>${activeCase.crimeData?.law || activeCase.trueScenario?.law ? `&nbsp;<span style="color:#888;font-size:12px">(${activeCase.crimeData?.law || activeCase.trueScenario?.law})</span>` : ''}</td></tr>
                    <tr><td style="padding:4px 8px;color:#888">Подсудимый</td><td><strong>${activeCase.defendantName}</strong></td></tr>
                    ${s.victimName ? `<tr><td style="padding:4px 8px;color:#888">Потерпевший / пострадавший</td><td>${s.victimName}</td></tr>` : ''}
                    ${s.orgName    ? `<tr><td style="padding:4px 8px;color:#888">Организация</td><td>${s.orgName}</td></tr>` : ''}
                    ${s.amount     ? `<tr><td style="padding:4px 8px;color:#888">Сумма ущерба</td><td>${s.amount} тыс. руб.</td></tr>` : ''}
                    ${activeCase.trueScenario?.sentence ? `<tr><td style="padding:4px 8px;color:#888">Возможное наказание</td><td style="color:#c0392b">${activeCase.trueScenario.sentence}</td></tr>` : ''}
                </table>
            </div>

            <div class="card" style="border-left:5px solid #e67e22;margin-top:14px">
                <h3>📍 Место, время и обстоятельства</h3>
                <p><strong>Место:</strong> ${s.location}</p>
                <p><strong>Время:</strong> ${s.time}</p>
                <p><strong>Мотив (предполагаемый):</strong> ${s.motive}</p>
                <p><strong>Метод совершения:</strong> ${s.method}</p>
            </div>

            <div class="card" style="border-left:5px solid #8e44ad;margin-top:14px">
                <h3>📋 Хронология событий</h3>
                <ul style="padding-left:20px;line-height:1.9;margin:0">${factsHTML || '<li>Не восстановлена.</li>'}</ul>
            </div>

            <div class="card" style="border-left:5px solid #e74c3c;margin-top:14px">
                <h3>🔬 Вещественные доказательства (${evidence.length})</h3>
                <ul style="padding-left:20px;line-height:1.9;margin:0">${evidenceHTML || '<li>Улики не обнаружены.</li>'}</ul>
            </div>

            <div class="card" style="border-left:5px solid #27ae60;margin-top:14px">
                <h3>🧑‍⚖️ Свидетели по делу (${witnesses.length})</h3>
                <ul style="padding-left:20px;line-height:2;margin:0">${witnessHTML || '<li>Свидетели не установлены.</li>'}</ul>
            </div>

            <div class="card" style="border-left:5px solid #16a085;margin-top:14px">
                <h3>🔑 Алиби подсудимого</h3>
                <p>${s.alibi?.claim || 'Не предоставлено.'}</p>
                <p style="color:#888;font-size:13px">
                    Свидетель: ${s.alibi?.witness || 'Не указан'} &nbsp;·&nbsp;
                    Проверено: ${s.alibi?.verified ? '✅ Да' : '❌ Нет (противоречиво)'}
                </p>
            </div>
        `;
    }

    /**
     * Рендерит вкладку Обвинение — позиция прокуратуры
     */
    static renderProsecution(activeCase, element) {
        const s = activeCase.trueScenario;
        const heading = s.isGuilty
            ? 'Подсудимый находился на месте преступления в указанное время. Это подтверждается объективными данными.'
            : 'Косвенные данные указывают на причастность подсудимого. Прокуратура считает алиби сфабрикованным.';

        const factsHTML = (s.facts || []).map(f =>
            `<li><strong>${f.when}:</strong> ${f.text}</li>`
        ).join('');

        element.innerHTML = `
            <div class="card" style="border-left:5px solid #c0392b">
                <h3>🏛️ Позиция обвинения</h3>
                <p>${heading}</p>
                <hr>
                <p><strong>Вменяемое деяние:</strong> ${activeCase.description}</p>
                <p><strong>Предполагаемый мотив:</strong> ${s.motive}</p>
                <p><strong>Метод совершения:</strong> ${s.method}</p>
                ${s.victimName ? `<p><strong>Потерпевший:</strong> ${s.victimName}</p>` : ''}
                ${s.orgName && s.amount ? `<p><strong>Ущерб:</strong> ${s.amount} тыс. руб. (орг.: ${s.orgName})</p>` : ''}
            </div>
            <div class="card" style="border-left:5px solid #8e44ad; margin-top:15px">
                <h3>📋 Хронология обвинения</h3>
                <ul style="padding-left:20px;line-height:1.9">${factsHTML}</ul>
            </div>
        `;
    }

    /**
     * Рендерит вкладку Защита — позиция адвоката
     */
    static renderDefense(activeCase, element) {
        const s = activeCase.trueScenario;
        const a = s.alibi || {};

        const mainArg = s.isGuilty
            ? `Подзащитный отрицает вину и заявляет о наличии алиби. Защита настаивает: улики посажены другими лицами.`
            : `Подзащитный невиновен. Реальный преступник — третье лицо. Алиби подтверждено документально.`;

        // Слабые места позиции обвинения
        const weakPoints = s.isGuilty
            ? [
                'Только косвенные улики — прямых вещественных доказательств вины недостаточно.',
                'Свидетельские показания противоречивы и ненадёжны.',
                'Свидетель защиты подтверждает нахождение подсудимого в другом месте.'
              ]
            : [
                'Улики не содержат ДНК подсудимого — версия обвинения рассыпается.',
                'Свидетели описывают иного человека, не подсудимого.',
                'Алиби подтверждено независимыми источниками.'
              ];

        element.innerHTML = `
            <div class="card" style="border-left:5px solid #27ae60">
                <h3>⚖️ Позиция защиты</h3>
                <p>${mainArg}</p>
            </div>

            <div class="card" style="border-left:5px solid #2980b9; margin-top:15px">
                <h3>🔑 Алиби</h3>
                <p><strong>Заявление:</strong> ${a.claim || 'Не предоставлено.'}</p>
                <p><strong>Свидетель:</strong> ${a.witness || 'Данные уточняются.'}</p>
                <p><strong>Проверено:</strong> ${a.verified ? 'Да (документально)' : 'Нет (противоречиво)'}</p>
            </div>

            <div class="card" style="border-left:5px solid #e67e22; margin-top:15px">
                <h3>📌 Слабые места обвинения</h3>
                <ul style="padding-left:20px;line-height:1.9">
                    ${weakPoints.map(p => `<li>${p}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Рендерит список улик
     */
    static renderEvidence(evidenceList, element) {
        const TYPE_ICONS = { physical:'📦', biological:'🧬', digital:'💻', document:'📄', expertise:'📑' };
        const TEST_LABELS = {
            fingerprint_test:     '🔍 Дактилоскопия',
            dna_test:             '🧬 ДНК-анализ',
            ballistic_test:       '🔫 Баллистика',
            toxicology_test:      '🧪 Токсикология',
            handwriting_analysis: '✍️ Почерк',
            metadata_analysis:    '💾 Метаданные',
            image_authentication: '📹 Видеоэкспертиза',
            document_forgery:     '📃 Подлинность документа'
        };
        const STATUS_CONFIG = {
            match:        { color:'#27ae60', icon:'✅', label:'Совпадение' },
            no_match:     { color:'#e74c3c', icon:'❌', label:'Не совпадает' },
            inconclusive: { color:'#e67e22', icon:'⚠️', label:'Неоднозначно' },
            degraded:     { color:'#95a5a6', icon:'🔬', label:'Деградация' },
            duplicate:    { color:'#95a5a6', icon:'ℹ️',  label:'Повтор' },
        };

        element.innerHTML = '<h2>Список улик</h2>';

        if (evidenceList.length === 0) {
            element.innerHTML += '<p style="color:#888">Улики не обнаружены.</p>';
            return;
        }

        evidenceList.forEach(ev => {
            const div = document.createElement('div');
            div.className = 'card';

            // Уверенность (шкала)
            const conf = Math.round((ev.confidence ?? 0.5) * 100);
            const confColor = conf > 70 ? '#27ae60' : conf > 40 ? '#e67e22' : '#e74c3c';

            // Результаты тестов
            const resultsHTML = (ev.tests || []).map(t => {
                const cfg = STATUS_CONFIG[t.status] || { color:'#888', icon:'🔬', label: t.status };
                return `
                    <div style="margin:6px 0; padding:8px 10px; border-radius:6px;
                                background:${cfg.color}18; border-left:3px solid ${cfg.color};">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <strong style="font-size:13px">${cfg.icon} ${t.name}</strong>
                            <span style="font-size:11px;color:${cfg.color};font-weight:600">${cfg.label}</span>
                        </div>
                        <p style="margin:4px 0 0;font-size:13px;color:#444">${t.details}</p>
                        ${t.recommendation ? `<p style="margin:4px 0 0;font-size:12px;color:#2980b9">💡 ${t.recommendation}</p>` : ''}
                        ${!t.isReliable ? '<p style="margin:3px 0 0;font-size:11px;color:#c0392b">⚠️ Ошибка лаборатории — рекомендуется повторный анализ</p>' : ''}
                    </div>`;
            }).join('');

            // Кнопки доступных тестов (скрыть уже выполненные)
            const doneTests = new Set((ev.tests || []).map(t => t.type));
            const pendingTests = (ev.validTests || []).filter(t => !doneTests.has(t));

            const testsHTML = pendingTests.length > 0
                ? `<div class="evidence-actions" style="margin:8px 0 4px; display:flex; flex-wrap:wrap; gap:6px;">
                    ${pendingTests.map(t => `
                        <button class="test-btn" data-test="${t}" data-id="${ev.id}"
                            style="font-size:12px; padding:5px 10px;">
                            ${TEST_LABELS[t] || t}
                        </button>`).join('')}
                   </div>`
                : pendingTests.length === 0 && (ev.validTests || []).length > 0
                    ? '<p style="font-size:12px;color:#27ae60;margin:4px 0">✅ Все тесты выполнены</p>'
                    : '';

            // Цепочка хранения
            const custody = ev.custody;
            const custodyHTML = custody ? `
                <details style="margin-top:6px; font-size:12px; color:#666">
                    <summary style="cursor:pointer;color:#888">📋 Цепочка хранения</summary>
                    <div style="padding:6px 0 0 10px; line-height:1.7">
                        <div><strong>Обнаружено:</strong> ${custody.foundAt}</div>
                        <div><strong>Кем:</strong> ${custody.foundBy}</div>
                        <div><strong>Состояние:</strong> ${custody.condition}</div>
                    </div>
                </details>` : '';

            div.innerHTML = `
                <!-- ШАПКА -->
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <div style="flex:1">
                        <strong style="font-size:14px">${TYPE_ICONS[ev.type] || '🔍'} ${ev.label || ev.type}</strong>
                        ${ev.degraded ? ' <span style="color:#e74c3c;font-size:11px">⚠️ деградировало</span>' : ''}
                        ${ev.isFake ? ' <span style="color:#e67e22;font-size:11px">⚠️ неустановленный источник</span>' : ''}
                        <p style="margin:4px 0 0;font-size:13px;color:#555">${ev.description}</p>
                    </div>
                    <div style="text-align:right;min-width:80px">
                        <div style="font-size:11px;color:#888;margin-bottom:3px">Уверенность</div>
                        <div style="background:#eee;border-radius:4px;height:8px;width:80px;">
                            <div style="background:${confColor};height:8px;border-radius:4px;width:${conf}%"></div>
                        </div>
                        <div style="font-size:11px;color:${confColor};font-weight:600;margin-top:2px">${conf}%</div>
                    </div>
                </div>

                ${resultsHTML}
                ${testsHTML}
                ${custodyHTML}

                <!-- МЕТКИ ИГРОКА -->
                <div class="marking-tools" style="margin-top:10px;">
                    <button class="mark-btn ${ev.playerMark === 'confirmed'    ? 'active' : ''}" data-id="${ev.id}" data-status="confirmed">✅ За обвинение</button>
                    <button class="mark-btn ${ev.playerMark === 'suspicious'   ? 'active' : ''}" data-id="${ev.id}" data-status="suspicious">❓ Под вопросом</button>
                    <button class="mark-btn ${ev.playerMark === 'contradictory'? 'active' : ''}" data-id="${ev.id}" data-status="contradictory">❌ За защиту</button>
                </div>
            `;

            // Обработчики меток
            div.querySelectorAll('.mark-btn').forEach(btn => {
                btn.onclick = e => {
                    const item = evidenceList.find(i => i.id === e.target.dataset.id);
                    if (item) { item.playerMark = e.target.dataset.status; CaseView.renderEvidence(evidenceList, element); }
                };
            });

            // Обработчики кнопок тестов
            div.querySelectorAll('.test-btn').forEach(btn => {
                btn.onclick = async e => {
                    const testType   = e.target.dataset.test;
                    const evidenceId = e.target.dataset.id;
                    const item = evidenceList.find(ev => ev.id === evidenceId);
                    if (!item) return;
                    btn.disabled = true;
                    btn.textContent = '⏳ Анализ…';
                    await new Promise(r => setTimeout(r, 1500));
                    const { AdvancedEvidenceSystem } = await import('../systems/AdvancedEvidenceSystem.js');
                    AdvancedEvidenceSystem.performTest(item, testType);
                    CaseView.renderEvidence(evidenceList, element);
                };
            });

            element.appendChild(div);
        });
    }
}
