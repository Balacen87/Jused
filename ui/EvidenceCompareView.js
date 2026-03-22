// ─── EvidenceCompareView.js ──────────────────────────────────────────────────
// Компонент сопоставления двух улик.
// Анализирует: совпадение nodeId (одно событие?), направление (обвинение/защита),
// и выдаёт вердикт: ПОДТВЕРЖДАЮТ / ПРОТИВОРЕЧАТ / НЕЗАВИСИМЫ.

export class EvidenceCompareView {

    /**
     * Рендерит панель сопоставления улик.
     * @param {Evidence[]} evidenceList
     * @param {Object} scenario — trueScenario (для контекста)
     * @param {HTMLElement} container
     */
    static render(evidenceList, scenario, container) {
        container.innerHTML = '';

        if (evidenceList.length < 2) {
            container.innerHTML = `<div class="card" style="text-align:center;padding:2rem;color:var(--text-muted)">
                <div style="font-size:2rem">⚖️</div>
                <p>Для сопоставления необходимо минимум 2 улики.</p>
            </div>`;
            return;
        }

        // ── Интерфейс выбора ──────────────────────────────────────────────
        const header = document.createElement('div');
        header.innerHTML = `
            <h2 style="margin-bottom:0.5rem">⚖️ Сопоставление улик</h2>
            <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:0">
                Выберите две улики для анализа противоречий и взаимоподтверждения.
            </p>`;
        container.appendChild(header);

        const selectorRow = document.createElement('div');
        selectorRow.className = 'compare-selector';
        selectorRow.innerHTML = `
            <div class="compare-slot" id="slot-a">
                <div class="slot-label">Улика А</div>
                <select id="select-a" class="compare-select">
                    <option value="">— Выбрать улику —</option>
                    ${evidenceList.map((e, i) => `<option value="${i}">${e.name || e.description?.slice(0,50) || e.type}</option>`).join('')}
                </select>
            </div>
            <div class="compare-vs">VS</div>
            <div class="compare-slot" id="slot-b">
                <div class="slot-label">Улика Б</div>
                <select id="select-b" class="compare-select">
                    <option value="">— Выбрать улику —</option>
                    ${evidenceList.map((e, i) => `<option value="${i}">${e.name || e.description?.slice(0,50) || e.type}</option>`).join('')}
                </select>
            </div>
        `;
        container.appendChild(selectorRow);

        const analyzeBtn = document.createElement('button');
        analyzeBtn.className = 'action-btn';
        analyzeBtn.style.cssText = 'margin:1rem 0;padding:0.7rem 2rem;font-size:0.95rem';
        analyzeBtn.innerHTML = '🔍 Сопоставить';
        container.appendChild(analyzeBtn);

        // Зона результата
        const resultZone = document.createElement('div');
        resultZone.id = 'compare-result';
        container.appendChild(resultZone);

        // ── История сопоставлений ─────────────────────────────────────────
        const historyTitle = document.createElement('h3');
        historyTitle.textContent = '📋 История сопоставлений';
        historyTitle.style.marginTop = '2rem';
        container.appendChild(historyTitle);

        const historyList = document.createElement('div');
        historyList.id = 'compare-history';
        historyList.style.display = 'flex';
        historyList.style.flexDirection = 'column';
        historyList.style.gap = '8px';
        container.appendChild(historyList);

        const history = [];

        // ── Обработчик ──────────────────────────────────────────────────
        analyzeBtn.onclick = () => {
            const idxA = parseInt(document.getElementById('select-a').value);
            const idxB = parseInt(document.getElementById('select-b').value);

            if (isNaN(idxA) || isNaN(idxB)) {
                resultZone.innerHTML = `<div class="card" style="color:var(--warning-color)">⚠️ Выберите обе улики для анализа.</div>`;
                return;
            }
            if (idxA === idxB) {
                resultZone.innerHTML = `<div class="card" style="color:var(--warning-color)">⚠️ Выберите две разные улики.</div>`;
                return;
            }

            const evA = evidenceList[idxA];
            const evB = evidenceList[idxB];
            const result = this.compare(evA, evB, scenario);

            // Рендерим результат
            resultZone.innerHTML = this._renderResult(evA, evB, result);

            // Добавляем в историю
            history.unshift({ evA, evB, result, time: new Date().toLocaleTimeString('ru') });
            historyList.innerHTML = history.slice(0, 8).map(h =>
                this._renderHistoryEntry(h)
            ).join('');
        };
    }

    /**
     * Основной алгоритм сопоставления двух улик.
     * @param {Evidence} evA
     * @param {Evidence} evB
     * @param {Object} scenario
     * @returns {CompareResult}
     */
    static compare(evA, evB, scenario) {
        const reasons  = [];
        let score = 0; // > 0 = подтверждают, < 0 = противоречат, ≈ 0 = независимы

        // ── 1. Проверка через nodeId ──────────────────────────────────────
        const nodeA = evA.nodeId ?? null;
        const nodeB = evB.nodeId ?? null;

        if (nodeA && nodeB) {
            if (nodeA === nodeB) {
                score += 2;
                reasons.push({ icon:'🔗', text: 'Обе улики относятся к одному и тому же событию в хронологии дела.', type:'positive' });
            } else {
                const nodeTypeA = evA.nodeType ?? '';
                const nodeTypeB = evB.nodeType ?? '';
                if (['crime_action','presence'].includes(nodeTypeA) && ['alibi_event'].includes(nodeTypeB)) {
                    score -= 2;
                    reasons.push({ icon:'⚡', text: 'Одна улика подтверждает присутствие на месте, другая — нахождение в другом месте. Прямое противоречие.', type:'negative' });
                } else {
                    score -= 0.5;
                    reasons.push({ icon:'📍', text: 'Улики относятся к разным событиям в хронологии.', type:'neutral' });
                }
            }
        }

        // ── 2. Проверка типов улик ────────────────────────────────────────
        const INCRIMINATING = ['biological','camera','digital','physical','surveillance','transport'];
        const ALIBI_TYPES   = ['receipt','alibi_camera','document','police_report'];

        const aInc  = INCRIMINATING.includes(evA.type);
        const bInc  = INCRIMINATING.includes(evB.type);
        const aAlibi = ALIBI_TYPES.includes(evA.type) || evA.nodeType === 'alibi_event';
        const bAlibi = ALIBI_TYPES.includes(evB.type) || evB.nodeType === 'alibi_event';

        if (aInc && bInc) {
            score += 1.5;
            reasons.push({ icon:'🔴', text: 'Обе улики поддерживают версию обвинения — взаимоукрепляют позицию.', type:'positive' });
        } else if (aAlibi && bAlibi) {
            score += 1;
            reasons.push({ icon:'🟢', text: 'Обе улики поддерживают версию защиты — укрепляют алиби.', type:'positive' });
        } else if ((aInc && bAlibi) || (bInc && aAlibi)) {
            score -= 2.5;
            reasons.push({ icon:'⚔️', text: 'Одна улика указывает на виновность, другая — на алиби. Прямое противоречие.', type:'negative' });
        }

        // ── 3. Надёжность ─────────────────────────────────────────────────
        const confA = evA.confidence ?? evA.baseReliability ?? 0.5;
        const confB = evB.confidence ?? evB.baseReliability ?? 0.5;
        const avgConf = (confA + confB) / 2;

        if (avgConf > 0.75) {
            reasons.push({ icon:'✅', text: `Средняя надёжность улик высокая (${Math.round(avgConf*100)}%) — вывод заслуживает доверия.`, type:'neutral' });
        } else if (avgConf < 0.4) {
            reasons.push({ icon:'⚠️', text: `Средняя надёжность улик низкая (${Math.round(avgConf*100)}%) — выводы предварительные.`, type:'neutral' });
        }

        // ── 4. Поддельность ───────────────────────────────────────────────
        if (evA.isFake || evB.isFake) {
            score -= 1;
            reasons.push({ icon:'🚩', text: 'Одна или обе улики помечены как «подозрительное происхождение» — возможная фальсификация.', type:'negative' });
        }

        // ── Итог ─────────────────────────────────────────────────────────
        let verdict, verdictClass, explanation;
        if (score >= 2) {
            verdict       = 'ПОДТВЕРЖДАЮТ';
            verdictClass  = 'compare-confirmed';
            explanation   = 'Улики взаимоподтверждают одну и ту же версию событий.';
        } else if (score <= -1.5) {
            verdict       = 'ПРОТИВОРЕЧАТ';
            verdictClass  = 'compare-conflict';
            explanation   = 'Улики указывают на несовместимые версии событий. Одна из них может быть ложной.';
        } else {
            verdict       = 'НЕЗАВИСИМЫ';
            verdictClass  = 'compare-neutral';
            explanation   = 'Улики относятся к разным аспектам дела и не влияют друг на друга.';
        }

        return { verdict, verdictClass, explanation, reasons, score, avgConf };
    }

    // ── Рендерер результата ──────────────────────────────────────────────────

    static _renderResult(evA, evB, r) {
        const reasonsHtml = r.reasons.map(reason => `
            <div class="compare-reason compare-reason-${reason.type}">
                <span class="reason-icon">${reason.icon}</span>
                <span>${reason.text}</span>
            </div>`).join('');

        return `
        <div class="card compare-result-card ${r.verdictClass}">
            <div class="compare-names">
                <span class="compare-ev-name">📦 ${evA.name || evA.type}</span>
                <span class="compare-verdict-badge">${r.verdict}</span>
                <span class="compare-ev-name">📦 ${evB.name || evB.type}</span>
            </div>
            <p class="compare-explanation">${r.explanation}</p>
            <div class="compare-reasons">${reasonsHtml}</div>
            <div class="compare-meta">
                Уверенность анализа: <strong style="color:var(--accent-color)">${Math.round(r.avgConf * 100)}%</strong>
            </div>
        </div>`;
    }

    static _renderHistoryEntry(h) {
        const icons = { 'ПОДТВЕРЖДАЮТ': '✅', 'ПРОТИВОРЕЧАТ': '❌', 'НЕЗАВИСИМЫ': '🔵' };
        return `
        <div class="compare-history-entry">
            <span style="color:var(--text-muted);font-size:0.75rem">${h.time}</span>
            <span>${h.evA.name || h.evA.type}</span>
            <span class="history-verdict">${icons[h.result.verdict] || ''} ${h.result.verdict}</span>
            <span>${h.evB.name || h.evB.type}</span>
        </div>`;
    }
}
