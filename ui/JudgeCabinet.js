/**
 * JudgeCabinet (Чистый UI)
 * 
 * Отрисовывает личный кабинет судьи: Досье, Историю и Апгрейды.
 * Вся бизнес-логика (покупка, кулдауны, флаговые эффекты) перенесена в CabinetSystem.
 */

export class JudgeCabinet {

    static render(career, element) {
        // CabinetSystem привязан к window.game
        const cabinet = window.game?.cabinet;
        if (!cabinet) {
            element.innerHTML = '<p>Ошибка: Не найдена подсистема CabinetSystem. Убедитесь, что она инициализирована.</p>';
            return;
        }

        const score = career.getScore();
        const rep = career.getReputation();
        const rank = career.getCurrentRank();
        const history = career.storage?.loadProgress()?.completedCases || {};

        element.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 340px;gap:20px;max-width:1150px">
                <!-- ЛЕВАЯ КОЛОНКА: Досье + Апгрейды -->
                <div>
                    <!-- Досье судьи -->
                    <div class="card" style="border-left:5px solid #2c3e50;margin-bottom:20px;background:linear-gradient(to right, #ffffff, #f8fafc)">
                        <div style="display:flex;justify-content:space-between;align-items:center">
                            <div>
                                <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;font-weight:700">Личное досье</div>
                                <div style="font-size:1.3em;font-weight:800;margin:4px 0;color:#0f172a">${rank.icon} ${rank.name}</div>
                            </div>
                            <span style="font-size:2.8em;opacity:0.9">⚖️</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px;text-align:center">
                            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
                                <div style="font-size:1.6em;font-weight:800;color:#334155">${score}</div>
                                <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Очков</div>
                            </div>
                            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
                                <div style="font-size:1.6em;font-weight:800;color:#059669">${rep.law}%</div>
                                <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Закон</div>
                            </div>
                            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
                                <div style="font-size:1.6em;font-weight:800;color:#7c3aed">${rep.shadow}%</div>
                                <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">Тени</div>
                            </div>
                        </div>
                    </div>

                    ${cabinet.isReserveAvailable() ? JudgeCabinet._renderSafeDeposit(cabinet) : ''}

                    <!-- Секции апгрейдов -->
                    ${JudgeCabinet._renderSection(cabinet, 'skill', '🎯 Профессиональные навыки')}
                    ${JudgeCabinet._renderSection(cabinet, 'defense', '🛡️ Защита и влияние')}
                    ${JudgeCabinet._renderSection(cabinet, 'perk', '💼 Оперативные ресурсы')}
                </div>

                <!-- ПРАВАЯ КОЛОНКА: История дел -->
                <div>
                    <div class="card" style="border-left:5px solid #27ae60;position:sticky;top:20px">
                        <h3 style="margin:0 0 16px;color:#0f172a">📋 Архив решений</h3>
                        ${JudgeCabinet._renderHistory(history)}
                    </div>
                </div>
            </div>
        `;

        // Обработчики кнопок покупки улучшений
        element.querySelectorAll('.upgrade-buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const cost = parseInt(btn.dataset.cost);
                if (career.getScore() < cost) {
                    const original = btn.innerHTML;
                    btn.innerHTML = '❌ Мало очков';
                    btn.style.background = '#ef4444';
                    setTimeout(() => {
                        if (element.contains(btn)) {
                            btn.innerHTML = original;
                            btn.style.background = '';
                        }
                    }, 1000);
                    return;
                }
                
                if (cabinet.buyUpgrade(id)) {
                    // Перерисовка кабинета после успешной покупки
                    JudgeCabinet.render(career, element);
                }
            });
        });

        // Обработчики банковских операций
        if (cabinet.isReserveAvailable()) {
            const depInput = element.querySelector('#reserve-input');
            element.querySelector('#btn-deposit')?.addEventListener('click', () => {
                const val = parseInt(depInput.value) || 0;
                if (cabinet.depositToReserve(val)) JudgeCabinet.render(career, element);
                else { depInput.style.border = '1px solid red'; setTimeout(()=>depInput.style.border='', 800); }
            });
            element.querySelector('#btn-withdraw')?.addEventListener('click', () => {
                const val = parseInt(depInput.value) || 0;
                if (cabinet.withdrawFromReserve(val)) JudgeCabinet.render(career, element);
                else { depInput.style.border = '1px solid red'; setTimeout(()=>depInput.style.border='', 800); }
            });
        }
    }

    // ─── Секция Зарубежного счёта ────────────────────────────────────────────
    static _renderSafeDeposit(cabinet) {
        const balance = cabinet.getReserveBalance();
        const max = cabinet.MAX_RESERVE;
        const available = cabinet.career.getScore();

        return `
        <div class="card" style="border-left:5px solid #f59e0b;margin-bottom:20px;background:#fffbeb">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h3 style="margin:0;color:#b45309;display:flex;align-items:center;gap:8px">
                    🏦 Зарубежный счёт
                </h3>
                <div style="font-weight:800;font-size:1.2em;color:#d97706">${balance} / ${max}</div>
            </div>
            <p style="font-size:13px;color:#92400e;margin:0 0 14px 0">
                Защищённый резерв. Очки здесь не могут быть списаны в качестве штрафов за ошибки.
            </p>
            <div style="display:flex;gap:10px;align-items:center">
                <input type="number" id="reserve-input" min="1" max="${Math.max(available, balance)}" value="50" 
                       style="width:80px;padding:8px;border:1px solid #fcd34d;border-radius:6px;outline:none;background:#fff">
                <button id="btn-deposit" style="flex:1;padding:8px;background:#f59e0b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600">
                    Положить (из счёта)
                </button>
                <button id="btn-withdraw" style="flex:1;padding:8px;background:#fff;color:#d97706;border:1px solid #fcd34d;border-radius:6px;cursor:pointer;font-weight:600">
                    Снять (в счёт)
                </button>
            </div>
        </div>`;
    }

    // ─── Секция улучшений (UI карточки) ──────────────────────────────────────
    static _renderSection(cabinet, category, title) {
        const items = cabinet.catalog.filter(u => u.category === category);
        const score = cabinet.career.getScore();

        const rows = items.map(u => {
            const cur = cabinet.career.getUpgradeLevel(u.id);
            const maxed = cur >= u.maxLevel;
            const canBuy = score >= u.cost && !maxed;

            // Для перков показываем остаток зарядов / кулдаун
            let extraInfo = '';
            if (u.consumable) {
                const cd = cabinet.getPerkCooldownRemaining(u.id);
                if (cd > 0) {
                    extraInfo = `<div style="color:#ef4444;font-size:11px;font-weight:bold;margin-top:4px">♨️ Восстановление: ${cd} дел.</div>`;
                } else if (cur > 0) {
                    extraInfo = `<div style="color:#10b981;font-size:11px;font-weight:bold;margin-top:4px">⚡ Готово к исп. (Зарядов: ${cur})</div>`;
                }
            }

            // Шкала прокачки (визуализация "кубиками")
            let levelBar = '';
            if (u.maxLevel > 1) {
                let blocks = '';
                for(let i=0; i<u.maxLevel; i++){
                    const color = i < cur ? '#3b82f6' : '#e2e8f0';
                    blocks += `<div style="width:12px;height:4px;background:${color};border-radius:2px"></div>`;
                }
                levelBar = `<div style="display:flex;gap:2px;margin-top:6px">${blocks}</div>`;
            } else if (maxed) {
                levelBar = `<div style="font-size:11px;color:#10b981;font-weight:600;margin-top:4px">✓ АКТИВНО</div>`;
            }

            return `
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px;
                        box-shadow:0 2px 4px rgba(0,0,0,0.02);display:flex;justify-content:space-between;align-items:center;
                        transition:transform 0.1s, box-shadow 0.1s"
                 onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)';this.style.transform='translateY(-1px)'"
                 onmouseout="this.style.boxShadow='0 2px 4px rgba(0,0,0,0.02)';this.style.transform='translateY(0)'">
                
                <div style="flex:1;padding-right:16px">
                    <div style="font-size:15px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px">
                        <span style="font-size:1.2em">${u.icon}</span> ${u.name}
                    </div>
                    <div style="font-size:13px;color:#64748b;margin-top:4px;line-height:1.4">${u.desc}</div>
                    ${extraInfo}
                    ${levelBar}
                </div>
                
                <div style="display:flex;flex-direction:column;align-items:flex-end;min-width:100px">
                    <div style="font-size:14px;font-weight:700;color:#475569;margin-bottom:8px">
                        ${u.cost} <span style="font-size:12px;font-weight:normal;color:#94a3b8">Очков</span>
                    </div>
                    ${maxed
                        ? `<div style="padding:6px 14px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;
                                      border-radius:6px;font-size:12px;font-weight:700;text-align:center;width:100px;
                                      box-sizing:border-box">ИСУЧЕНО</div>`
                        : `<button class="upgrade-buy-btn" data-id="${u.id}" data-cost="${u.cost}"
                                style="padding:8px 16px;border:none;border-radius:6px;cursor:${canBuy ? 'pointer' : 'not-allowed'};
                                       font-size:13px;font-weight:600;width:100px;box-sizing:border-box;
                                       background:${canBuy ? '#3b82f6' : '#f1f5f9'};
                                       color:${canBuy ? '#fff' : '#94a3b8'};
                                       box-shadow:${canBuy ? '0 2px 4px rgba(59,130,246,0.3)' : 'none'};
                                       transition:background 0.1s">
                                Купить
                               </button>`
                    }
                </div>
            </div>`;
        }).join('');

        return `
        <div style="margin-bottom:24px">
            <h3 style="margin:0 0 12px;color:#334155;font-size:16px;padding-bottom:8px;border-bottom:2px solid #f1f5f9">
                ${title}
            </h3>
            ${rows}
        </div>`;
    }

    // ─── История дел (Архив) ─────────────────────────────────────────────────
    static _renderHistory(cases) {
        const ids = Object.keys(cases);
        if (ids.length === 0) return `
            <div style="padding:20px;text-align:center;background:#f8fafc;border-radius:8px;border:1px dashed #cbd5e1">
                <p style="color:#94a3b8;font-size:13px;margin:0">Архив пуст.<br>Завершите своё первое дело.</p>
            </div>`;

        const rows = ids.slice(-12).reverse().map(id => {
            const c = cases[id];
            const isOk = c.isCorrect;
            const bg = isOk ? '#f0fdf4' : '#fef2f2';
            const border = isOk ? '#bbf7d0' : '#fecaca';
            const color = isOk ? '#15803d' : '#b91c1c';
            const date = new Date(c.date).toLocaleString('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

            return `
            <div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:10px 12px;
                        margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;
                        font-size:13px">
                <div>
                    <div style="font-weight:600;color:${color};margin-bottom:2px">${id.replace('CASE-', 'Дело #')}</div>
                    <div style="font-size:11px;color:#64748b">${date}</div>
                </div>
                <div style="font-weight:800;font-size:15px;color:${color}">
                    ${isOk ? '+' : ''}${c.score}
                </div>
            </div>`;
        }).join('');

        return `<div style="max-height:600px;overflow-y:auto;padding-right:4px">${rows}</div>`;
    }
}
