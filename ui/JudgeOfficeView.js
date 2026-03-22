/**
 * JudgeOfficeView.js — Сцена кабинета судьи.
 *
 * Отображается после главного меню, до начала слушания.
 * Содержит: игровые часы, мини-календарь, список дел, расписание слушаний.
 */

const MONTH_NAMES_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                        'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAY_NAMES_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export class JudgeOfficeView {

    /**
     * @param {Object} opts
     * @param {import('../systems/GameClock.js').GameClock}         opts.clock
     * @param {import('../systems/HearingScheduler.js').HearingScheduler} opts.scheduler
     * @param {Function} opts.onStartHearing  — fn(hearingEntry) — запустить слушание
     * @param {Function} opts.onGenerateCases — fn() → Promise<caseData[]> — получить 10 случайных дел
     */
    static init({ clock, scheduler, onStartHearing, onGenerateCases }) {
        this._clock        = clock;
        this._scheduler    = scheduler;
        this._onStart      = onStartHearing;
        this._onGenerate   = onGenerateCases;
        this._pendingCases = []; // текущий пул ещё-не-выбранных дел

        // Получаем/создаём контейнер
        this._container = document.getElementById('judge-office');
        if (!this._container) {
            this._container = document.createElement('div');
            this._container.id = 'judge-office';
            document.body.appendChild(this._container);
        }

        // Подписка на изменение времени
        this._clockHandler = () => this._refreshClock();
        this._clock.on(this._clockHandler);

        // Подписка на изменения расписания
        this._schedHandler = () => this._refreshSchedule();
        this._scheduler.on(this._schedHandler);
    }

    static show() {
        const el = this._container;
        el.style.display = 'flex';
        el.style.cssText = `
            display:flex; flex-direction:column; min-height:100vh;
            background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);
            font-family:'Inter',sans-serif; color:#e2e8f0;
        `;
        this._render();
        this._clock.startTick();
    }

    static hide() {
        if (this._container) this._container.style.display = 'none';
        this._clock.stopTick();
    }

    // ─── Рендер ──────────────────────────────────────────────────────────────

    static _render() {
        const el = this._container;
        el.innerHTML = `
            <!-- Шапка → часы + дата -->
            <div id="jo-header" style="
                display:flex; align-items:center; justify-content:space-between;
                padding:20px 32px; background:rgba(0,0,0,.35); border-bottom:1px solid #334155;
            ">
                <div>
                    <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#64748b;margin-bottom:4px">Федеральный суд</div>
                    <div style="font-size:1.4rem;font-weight:700;color:#f8fafc">⚖️ Кабинет судьи</div>
                </div>
                <div id="jo-clock" style="text-align:right"></div>
            </div>

            <!-- Основной контент -->
            <div style="display:grid;grid-template-columns:280px 1fr;flex:1;gap:0">

                <!-- Левая колонка: календарь + расписание -->
                <div style="padding:24px 20px;border-right:1px solid #334155;display:flex;flex-direction:column;gap:20px">
                    <div id="jo-calendar"></div>
                    <div id="jo-schedule"></div>
                </div>

                <!-- Правая колонка: список дел -->
                <div style="padding:24px 28px;overflow-y:auto">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                        <h3 style="margin:0;font-size:1.1rem">📁 Входящие дела</h3>
                        <button id="jo-refresh-btn" style="
                            background:#1d4ed8;color:#fff;border:none;border-radius:8px;
                            padding:8px 18px;cursor:pointer;font-size:13px;font-family:inherit;
                            transition:background .2s
                        ">🔄 Обновить очередь</button>
                    </div>
                    <div id="jo-cases-list"></div>
                </div>
            </div>
        `;

        this._refreshClock();
        this._refreshCalendar();
        this._refreshSchedule();

        document.getElementById('jo-refresh-btn').onclick = () => this._loadCases();

        // При первом показе сразу загружаем дела
        if (this._pendingCases.length === 0) this._loadCases();
        else this._renderCases();
    }

    // ─── Часы ────────────────────────────────────────────────────────────────

    static _refreshClock() {
        const el = document.getElementById('jo-clock');
        if (!el) return;
        const next = this._scheduler.getNext();
        const nextStr = next
            ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">Ближайшее: ${this._formatGameDate(next.scheduledAt)}</div>`
            : '';
        el.innerHTML = `
            <div style="font-size:2.8rem;font-weight:800;color:#38bdf8;line-height:1;font-variant-numeric:tabular-nums">
                ${this._clock.getTimeFormatted()}
            </div>
            <div style="font-size:13px;color:#94a3b8;margin-top:4px;text-align:right">
                ${this._clock.getDateFormatted()}
            </div>
            ${nextStr}
        `;
    }

    // ─── Мини-Календарь ──────────────────────────────────────────────────────

    static _refreshCalendar() {
        const el = document.getElementById('jo-calendar');
        if (!el) return;
        const { year, month, days } = this._clock.getCalendarMonth();

        // Собираем даты со слушаниями
        const hearingDays = new Set();
        for (const h of this._scheduler.getPending()) {
            const d = new Date(h.scheduledAt);
            if (d.getFullYear() === year && d.getMonth() === month) {
                hearingDays.add(d.getDate());
            }
        }

        el.innerHTML = `
            <div style="font-size:13px;font-weight:700;color:#cbd5e1;margin-bottom:12px">
                ${MONTH_NAMES_RU[month]} ${year}
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;font-size:11px">
                ${DAY_NAMES_SHORT.map(d => `<div style="color:#475569;font-weight:700;padding:2px 0">${d}</div>`).join('')}
                ${days.map(({ day, isToday, isFuture }) => {
                    if (!day) return `<div></div>`;
                    const hasHearing = hearingDays.has(day);
                    const bg = isToday
                        ? '#1d4ed8'
                        : hasHearing
                            ? '#7c3aed'
                            : 'transparent';
                    const color = (isToday || hasHearing) ? '#fff' : isFuture ? '#94a3b8' : '#64748b';
                    return `<div style="
                        padding:4px 2px;border-radius:6px;background:${bg};color:${color};
                        font-weight:${isToday ? '700' : '400'};
                        box-shadow:${hasHearing ? '0 0 0 2px #7c3aed44' : 'none'}
                    " title="${hasHearing ? '📅 Слушание назначено' : ''}">${day}</div>`;
                }).join('')}
            </div>
            <div style="display:flex;gap:10px;margin-top:10px;font-size:11px;color:#64748b">
                <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#1d4ed8;margin-right:4px"></span>Сегодня</span>
                <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#7c3aed;margin-right:4px"></span>Слушание</span>
            </div>
        `;
    }

    // ─── Расписание ───────────────────────────────────────────────────────────

    static _refreshSchedule() {
        const el = document.getElementById('jo-schedule');
        if (!el) return;
        const pending = this._scheduler.getPending().sort((a, b) => a.scheduledAt - b.scheduledAt);

        if (pending.length === 0) {
            el.innerHTML = `<div style="font-size:12px;color:#64748b;text-align:center;padding:12px">Нет запланированных слушаний</div>`;
            return;
        }

        el.innerHTML = `
            <div style="font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">📅 Расписание</div>
            ${pending.slice(0, 5).map(h => {
                const timeStr = this._formatGameDate(h.scheduledAt);
                const now = this._clock.now.getTime();
                const diff = h.scheduledAt - now;
                const diffH = Math.floor(Math.abs(diff) / 3_600_000);
                const late = diff < 0;
                return `
                <div style="
                    background:${late ? 'rgba(239,68,68,.1)' : 'rgba(255,255,255,.04)'};
                    border:1px solid ${late ? '#ef4444' : '#334155'};
                    border-radius:8px;padding:10px 12px;margin-bottom:8px;cursor:pointer;
                " onclick="window.game?.scheduler?.getById('${h.id}') && window.game?._startHearingFromScheduler?.('${h.id}')">
                    <div style="font-size:12px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                        ${h.caseMeta.defendantName}
                    </div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px">${timeStr}</div>
                    <div style="font-size:11px;color:${late ? '#ef4444' : '#22c55e'};margin-top:2px">
                        ${late ? `⚠️ Опоздание ${diffH}ч` : `⏳ через ${diffH}ч`}
                    </div>
                </div>`;
            }).join('')}
        `;
        this._refreshCalendar();
    }

    // ─── Список дел ──────────────────────────────────────────────────────────

    static async _loadCases() {
        const listEl = document.getElementById('jo-cases-list');
        if (!listEl) return;
        listEl.innerHTML = `<div style="color:#64748b;text-align:center;padding:40px">⏳ Формируем очередь дел...</div>`;

        try {
            this._pendingCases = await this._onGenerate();
            this._renderCases();
        } catch (e) {
            listEl.innerHTML = `<div style="color:#ef4444;padding:20px">❌ Ошибка загрузки дел: ${e.message}</div>`;
        }
    }

    static _renderCases() {
        const listEl = document.getElementById('jo-cases-list');
        if (!listEl || this._pendingCases.length === 0) return;

        listEl.innerHTML = this._pendingCases.map((cd, i) => {
            const typeColors = {
                murder: '#ef4444', theft: '#f59e0b', fraud: '#8b5cf6',
                corruption: '#f97316', assault: '#ec4899'
            };
            const color = typeColors[cd.type] ?? '#38bdf8';

            return `
            <div class="jo-case-card" data-case-idx="${i}" style="
                background:rgba(255,255,255,.04);border:1px solid #334155;border-radius:12px;
                padding:18px 20px;margin-bottom:12px;transition:border-color .2s;
            ">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
                    <div style="flex:1;min-width:0">
                        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
                            <span style="background:${color}22;color:${color};border:1px solid ${color};border-radius:100px;padding:2px 10px;font-size:11px;font-weight:700;white-space:nowrap">
                                ${cd.label || cd.type}
                            </span>
                            <span style="font-size:12px;color:#64748b">Дело № ${cd.id?.slice(-8) ?? '—'}</span>
                        </div>
                        <div style="font-size:15px;font-weight:700;color:#f8fafc;margin-bottom:4px">
                            ${cd.description}
                        </div>
                        <div style="font-size:13px;color:#94a3b8;margin-bottom:8px">
                            Обвиняемый: <strong style="color:#cbd5e1">${cd.defendantName}</strong>
                        </div>
                        <div style="font-size:12px;color:#64748b;line-height:1.5">
                            ${cd.trueScenario?.motive ? `Мотив: ${cd.trueScenario.motive}` : ''}
                            ${cd.evidence?.length ? `&nbsp;·&nbsp; Улик: ${cd.evidence.length}` : ''}
                            ${cd.witnesses?.length ? `&nbsp;·&nbsp; Свидетелей: ${cd.witnesses.length}` : ''}
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:8px;min-width:150px">
                        <button class="jo-start-now" data-idx="${i}" style="
                            background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff;border:none;
                            border-radius:8px;padding:10px 16px;cursor:pointer;font-size:13px;
                            font-family:inherit;font-weight:600;transition:transform .15s;
                            white-space:nowrap
                        ">▶️ Слушать сейчас</button>
                        <button class="jo-schedule" data-idx="${i}" style="
                            background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid #7c3aed;
                            border-radius:8px;padding:10px 16px;cursor:pointer;font-size:13px;
                            font-family:inherit;font-weight:600;transition:background .2s;
                            white-space:nowrap
                        ">📅 Назначить дату</button>
                    </div>
                </div>
            </div>`;
        }).join('');

        // Подвешиваем обработчики
        listEl.querySelectorAll('.jo-start-now').forEach(btn => {
            btn.onmouseenter = () => { btn.style.transform = 'scale(1.02)'; };
            btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
            btn.onclick = () => {
                const cd = this._pendingCases[parseInt(btn.dataset.idx)];
                // Назначаем "сейчас" (текущее игровое время)
                const entry = this._scheduler.schedule(cd, this._clock.now.getTime());
                this._scheduler.markActive(entry.id);
                this._pendingCases.splice(parseInt(btn.dataset.idx), 1);
                this.hide();
                this._onStart(entry);
            };
        });

        listEl.querySelectorAll('.jo-schedule').forEach(btn => {
            btn.onclick = () => {
                const cd = this._pendingCases[parseInt(btn.dataset.idx)];
                this._showScheduleModal(cd, parseInt(btn.dataset.idx));
            };
        });
    }

    // ─── Модал: Назначить дату ────────────────────────────────────────────────

    static _showScheduleModal(caseData, caseIdx) {
        document.getElementById('jo-schedule-modal')?.remove();

        const maxDays = 7;
        const now = this._clock.now;

        // Генерируем варианты ближайших слотов (следующие 7 дней, 09:00 / 14:00)
        const slots = [];
        for (let d = 0; d < maxDays; d++) {
            const date = new Date(now);
            date.setDate(date.getDate() + (d === 0 ? 1 : d)); // завтра+
            date.setSeconds(0, 0);
            for (const hour of [9, 14]) {
                date.setHours(hour, 0);
                if (date.getTime() > now.getTime()) {
                    slots.push(new Date(date));
                }
            }
        }

        const modal = document.createElement('div');
        modal.id = 'jo-schedule-modal';
        modal.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:50000;
            display:flex;align-items:center;justify-content:center;
        `;
        modal.innerHTML = `
            <div style="
                background:#1e293b;border:1px solid #334155;border-radius:16px;
                padding:28px;max-width:440px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,.5)
            ">
                <h3 style="margin:0 0 4px;color:#f8fafc">📅 Назначить слушание</h3>
                <div style="font-size:13px;color:#64748b;margin-bottom:20px">${caseData.description}</div>
                <div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;margin-bottom:20px">
                    ${slots.map((slot, si) => `
                        <label style="
                            display:flex;align-items:center;gap:12px;padding:12px 14px;
                            border:2px solid transparent;border-radius:10px;cursor:pointer;
                            background:rgba(255,255,255,.04);transition:border-color .15s
                        " class="slot-label">
                            <input type="radio" name="hearing-slot" value="${slot.getTime()}" style="accent-color:#7c3aed">
                            <div>
                                <div style="font-weight:600;color:#e2e8f0;font-size:14px">
                                    ${slot.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'})}
                                </div>
                                <div style="font-size:12px;color:#64748b">${slot.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</div>
                            </div>
                        </label>
                    `).join('')}
                </div>
                <div style="display:flex;gap:10px">
                    <button id="jo-modal-cancel" style="flex:1;padding:12px;background:transparent;border:1px solid #334155;color:#94a3b8;border-radius:8px;cursor:pointer;font-family:inherit">Отмена</button>
                    <button id="jo-modal-confirm" style="flex:2;padding:12px;background:#7c3aed;border:none;color:#fff;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700">Назначить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Подсветка выбранного слота
        modal.querySelectorAll('.slot-label').forEach(label => {
            label.querySelector('input').onchange = () => {
                modal.querySelectorAll('.slot-label').forEach(l => l.style.borderColor = 'transparent');
                label.style.borderColor = '#7c3aed';
            };
        });

        document.getElementById('jo-modal-cancel').onclick = () => modal.remove();
        document.getElementById('jo-modal-confirm').onclick = () => {
            const selected = modal.querySelector('input[name="hearing-slot"]:checked');
            if (!selected) return;
            const ts = parseInt(selected.value, 10);
            this._scheduler.schedule(caseData, ts);
            this._pendingCases.splice(caseIdx, 1);
            modal.remove();
            this._renderCases();
            this._refreshSchedule();
            // Показываем тост
            this._showToast(`📅 Слушание назначено на ${new Date(ts).toLocaleDateString('ru-RU', {day:'numeric',month:'long'})} – ${new Date(ts).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`);
        };

        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    // ─── Хелперы ─────────────────────────────────────────────────────────────

    static _formatGameDate(ts) {
        const d = new Date(ts);
        return d.toLocaleDateString('ru-RU', {day:'numeric', month:'short'}) + ' ' +
               d.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    }

    static _showToast(msg) {
        const t = document.createElement('div');
        t.style.cssText = `
            position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
            background:#1e3a5f;border:1px solid #38bdf8;color:#e2e8f0;
            padding:12px 24px;border-radius:100px;font-size:14px;z-index:99999;
            box-shadow:0 4px 20px rgba(0,0,0,.4);animation:fadeIn .3s ease;
        `;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 4000);
    }
}
