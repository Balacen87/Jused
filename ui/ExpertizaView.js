import { AdvancedEvidenceSystem } from '../systems/AdvancedEvidenceSystem.js';
import { ForensicTests } from '../data/ForensicData.js';

/**
 * Вкладка «Экспертизы» — лаборатория судьи.
 * Показывает: какие тесты уже проведены, что ещё можно заказать.
 */
export class ExpertizaView {

    static render(activeCase, element) {
        const evidence = activeCase.evidence || [];

        // Собираем все проведённые тесты
        const completedTests = [];
        const availableTests = [];

        evidence.forEach(ev => {
            (ev.tests || []).forEach(t => {
                completedTests.push({ evidence: ev, test: t });
            });
            (ev.validTests || []).forEach(testId => {
                const alreadyDone = (ev.tests || []).some(t => t.type === testId);
                if (!alreadyDone) {
                    availableTests.push({ evidence: ev, testId });
                }
            });
        });

        element.innerHTML = `
            <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:flex-start;">

                <!-- Журнал готовых результатов -->
                <div style="flex:1; min-width:300px;">
                    <h2>📋 Журнал результатов</h2>
                    ${completedTests.length === 0
                        ? '<p style="color:#888;">Экспертизы ещё не проводились. Закажите тесты во вкладке «Улики» или ниже.</p>'
                        : completedTests.map(({ evidence: ev, test: t }) => `
                            <div class="card test-result ${t.status}" style="margin-bottom:10px;">
                                <div style="display:flex;justify-content:space-between;align-items:center;">
                                    <strong>${this._testIcon(t.type)} ${t.name}</strong>
                                    <span class="tag">${ev.description}</span>
                                </div>
                                <p style="margin:6px 0 0;">${t.details}</p>
                                ${!t.isReliable ? '<p style="color:#e74c3c;font-size:12px;">⚠️ Возможна ошибка лаборатории — рекомендуется повторное исследование.</p>' : ''}
                            </div>
                        `).join('')
                    }
                </div>

                <!-- Панель заказа новых тестов -->
                <div style="flex:1; min-width:280px;">
                    <h2>🔬 Доступные тесты</h2>
                    ${availableTests.length === 0
                        ? '<p style="color:#888;">Все возможные тесты уже проведены.</p>'
                        : availableTests.map(({ evidence: ev, testId }) => {
                            const meta = ForensicTests[testId] || {};
                            return `
                                <div class="card" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
                                    <div>
                                        <strong>${this._testIcon(testId)} ${meta.name || testId}</strong>
                                        <br><small>Улика: ${ev.description}</small>
                                        <br><small>⏱ ${meta.time || '?'} ход(а) · 💰 ${meta.cost || '?'} ₽</small>
                                    </div>
                                    <button
                                        class="test-btn expertiza-order-btn"
                                        data-test="${testId}"
                                        data-id="${ev.id}"
                                        style="margin-left:12px; white-space:nowrap;">
                                        Заказать
                                    </button>
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>
        `;

        // Вешаем обработчики на кнопки заказа
        element.querySelectorAll('.expertiza-order-btn').forEach(btn => {
            btn.onclick = async (e) => {
                const testType = e.target.dataset.test;
                const evidenceId = e.target.dataset.id;
                const ev = evidence.find(ev => ev.id === evidenceId);
                if (!ev) return;

                btn.disabled = true;
                btn.textContent = '⏳ Анализ…';

                await new Promise(r => setTimeout(r, 1500));

                AdvancedEvidenceSystem.performTest(ev, testType);
                // перерисовываем вкладку
                ExpertizaView.render(activeCase, element);
            };
        });
    }

    static _testIcon(type) {
        const icons = {
            fingerprint_test:     '🔍',
            dna_test:             '🧬',
            ballistic_test:       '🔫',
            toxicology_test:      '🧪',
            handwriting_analysis: '✍️',
            metadata_analysis:    '💾',
            image_authentication: '📹'
        };
        return icons[type] || '🔬';
    }
}
