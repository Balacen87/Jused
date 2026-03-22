/**
 * JudgeOfficeView.js — Сцена кабинета судьи.
 *
 * Отображается после главного меню, до начала слушания.
 * Содержит: игровые часы, мини-календарь, список дел, расписание слушаний.
 */

const MONTH_NAMES_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                        'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAY_NAMES_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

/** Русские названия типов преступлений (fallback если label не задан) */
const TYPE_LABELS_RU = {
    murder:           'Убийство',
    theft:            'Кража',
    vehicle_theft:    'Угон ТС',
    fraud:            'Мошенничество',
    corruption:       'Коррупция',
    assault:          'Нападение',
    hooliganism:      'Хулиганство',
    extortion:        'Вымогательство',
    shoplifting:      'Магазинная кража',
    embezzlement:     'Растрата',
    drug_trafficking: 'Наркоторговля',
    bribery:          'Взятка',
    arson:            'Поджог',
    identity_theft:   'Подделка документов',
    blackmail:        'Шантаж',
    forgery:          'Подлог',
    domestic_violence:'Дом. насилие',
    robbery:          'Грабёж',
    vandalism:        'Вандализм',
    tax_evasion:      'Уклонение от налогов',
};

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
        // Скрываем всё, кроме кабинета
        const app  = document.getElementById('app');
        const menu = document.getElementById('main-menu');
        if (app)  app.style.display  = 'none';
        if (menu) menu.style.display = 'none';

        // Активируем кабинет через CSS-класс
        this._container.classList.add('active');
        this._container.style.display = 'none'; // сброс инлайна, класс управляет дисплеем
        void this._container.offsetWidth;       // reflow
        this._container.style.display = '';     // отдаём управление классу

        this._render();
        this._clock.startTick();
    }

    static hide() {
        if (this._container) {
            this._container.classList.remove('active');
        }
        this._clock.stopTick();
    }

    // ─── Рендер ──────────────────────────────────────────────────────────────

    static _render() {
        const el = this._container;
        const rawScore  = window.game?.career?.getScore?.();
        const rawRep    = window.game?.career?.getReputation?.('law');
        const score     = (typeof rawScore  === 'number' && !isNaN(rawScore))  ? rawScore  : 0;
        const repLaw    = (typeof rawRep    === 'number' && !isNaN(rawRep))    ? Math.round(rawRep) : 100;

        el.innerHTML = `
            <!-- ═══ ШАПКА ═══════════════════════════════════════════════════ -->
            <div id="jo-topbar" style="
                display:flex; align-items:center; justify-content:space-between;
                padding:0 28px; height:64px;
                background:rgba(0,0,0,.5);
                border-bottom:1px solid #1e3a58;
                backdrop-filter:blur(12px);
                flex-shrink:0;
            ">
                <!-- Лого -->
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="
                        width:38px;height:38px;border-radius:10px;
                        background:linear-gradient(135deg,#1d4ed8,#7c3aed);
                        display:flex;align-items:center;justify-content:center;font-size:20px
                    ">⚖️</div>
                    <div>
                        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#475569">Федеральный суд</div>
                        <div style="font-size:15px;font-weight:700;color:#f1f5f9">Кабинет судьи</div>
                    </div>
                </div>

                <!-- Часы + дата -->
                <div id="jo-clock" style="text-align:center"></div>

                <!-- Статус -->
                <div style="display:flex;gap:16px;align-items:center">
                    <div style="text-align:right">
                        <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:1px">Репутация</div>
                        <div style="font-size:16px;font-weight:700;color:${repLaw >= 70 ? '#22c55e' : repLaw >= 40 ? '#f59e0b' : '#ef4444'}">${repLaw}%</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:1px">Счёт</div>
                        <div style="font-size:16px;font-weight:700;color:#38bdf8">${score}</div>
                    </div>
                </div>
            </div>

            <!-- ═══ ОСНОВНОЙ КОНТЕНТ ════════════════════════════════════════ -->
            <div style="
                display:grid;
                grid-template-columns:300px 1fr;
                flex:1;
                overflow:hidden;
                height:calc(100vh - 64px);
            ">
                <!-- Левая панель -->
                <div style="
                    padding:20px 18px;
                    border-right:1px solid #1e3a58;
                    overflow-y:auto;
                    display:flex;
                    flex-direction:column;
                    gap:18px;
                    background:rgba(0,0,0,.15);
                ">
                    <div id="jo-calendar"></div>
                    <div id="jo-schedule"></div>
                </div>

                <!-- Правая панель: список дел -->
                <div style="
                    padding:20px 24px;
                    overflow-y:auto;
                ">
                    <div style="
                        display:flex;justify-content:space-between;align-items:center;
                        margin-bottom:14px;
                    ">
                        <div>
                            <div style="font-size:18px;font-weight:700;color:#f1f5f9">📁 Входящие дела</div>
                            <div style="font-size:12px;color:#475569;margin-top:2px">Выберите дело для слушания</div>
                        </div>
                        <button id="jo-refresh-btn" style="
                            background:rgba(29,78,216,.2);color:#60a5fa;
                            border:1px solid #1d4ed8;border-radius:8px;
                            padding:8px 16px;cursor:pointer;font-size:13px;
                            font-family:inherit;font-weight:600;
                            transition:background .2s;white-space:nowrap;
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
            ? `<div style="font-size:10px;color:#6366f1;white-space:nowrap">📅 ${this._formatGameDate(next.scheduledAt)}</div>`
            : '';
        el.innerHTML = `
            <div style="display:flex;align-items:center;gap:16px">
                <div style="font-size:2rem;font-weight:800;color:#38bdf8;font-variant-numeric:tabular-nums;line-height:1">
                    ${this._clock.getTimeFormatted()}
                </div>
                <div>
                    <div style="font-size:11px;color:#94a3b8;white-space:nowrap">${this._clock.getDateFormatted()}</div>
                    ${nextStr}
                </div>
            </div>
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
                                ${cd.label || TYPE_LABELS_RU[cd.type] || cd.type}
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
