/**
 * MedicalExpertiseView — вкладка медицинской экспертизы.
 */
export class MedicalExpertiseView {

    static render(activeCase, element) {
        const med     = activeCase.medicalReport;
        const crimeType = activeCase.type;
        const isLethal  = !!med?.autopsy;

        if (!med) {
            element.innerHTML = `<div class="card"><p style="color:#888">Медицинская экспертиза не проводилась или данные отсутствуют.</p></div>`;
            return;
        }

        const tox     = med.toxicology;
        const inj     = med.victimInjuries || [];
        const suspState = med.suspectState || med.suspectInjuries || 'Данные отсутствуют.';

        // Токсикология
        const alcoholColor = tox.alcohol.value > 1.5 ? '#c0392b' : tox.alcohol.value > 0.3 ? '#e67e22' : '#27ae60';
        const drugsHTML = tox.drugs.found
            ? `<span style="color:#c0392b;font-weight:600">Обнаружены: ${tox.drugs.substances.join(', ')}</span>`
            : `<span style="color:#27ae60">Не обнаружены</span>`;

        // Повреждения жертвы
        const injHTML = inj.map(i => `
            <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:7px;color:#888;font-size:12px;vertical-align:top">${i.region}</td>
                <td style="padding:7px;font-size:13px">${i.description}</td>
            </tr>`).join('');

        // Вскрытие
        const autopsyHTML = isLethal && med.autopsy ? `
            <div class="card" style="border-left:5px solid #8e44ad;margin-bottom:14px">
                <h3 style="margin:0 0 12px;color:#8e44ad">🔬 Заключение патологоанатома</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <tr style="border-bottom:1px solid #f0f0f0">
                        <td style="padding:8px;color:#888;width:200px">Причина смерти</td>
                        <td style="padding:8px;font-weight:600;color:#8e44ad">${med.autopsy.causeOfDeath}</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f0f0f0">
                        <td style="padding:8px;color:#888">Время наступления смерти</td>
                        <td style="padding:8px">${med.autopsy.timeOfDeath}</td>
                    </tr>
                    ${(med.autopsy.postmortemFindings || []).map(f =>`
                    <tr style="border-bottom:1px solid #f0f0f0">
                        <td style="padding:8px;color:#888">Посмертные признаки</td>
                        <td style="padding:8px">${f}</td>
                    </tr>`).join('')}
                </table>
            </div>` : '';

        element.innerHTML = `
            <!-- Шапка -->
            <div class="card" style="border-left:5px solid #16a085;background:linear-gradient(135deg,#16a085,#1abc9c);color:#ecf0f1;margin-bottom:14px">
                <div style="font-size:11px;opacity:.5;letter-spacing:2px;text-transform:uppercase">Медицинская экспертиза</div>
                <div style="font-size:1.1em;font-weight:700;margin:4px 0">Дело: ${activeCase.description}</div>
                <div style="font-size:13px;opacity:.8">Эксперт: ${med.examDoctor} &nbsp;·&nbsp; Дата: ${med.examDate}</div>
            </div>

            <!-- Токсикология -->
            <div class="card" style="border-left:5px solid ${alcoholColor};margin-bottom:14px">
                <h3 style="margin:0 0 12px">🧪 Токсикологическое исследование</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:13px">
                    <div style="background:#f8f9fa;border-radius:8px;padding:12px">
                        <div style="font-size:11px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Алкоголь</div>
                        <div style="font-size:1.6em;font-weight:700;color:${alcoholColor}">${tox.alcohol.value} ‰</div>
                        <div style="font-size:12px;color:${alcoholColor};margin-top:4px">${tox.alcohol.label}</div>
                        <div style="font-size:11px;color:#aaa;margin-top:6px">0–0.3‰ — норма | 0.3–1.5‰ — лёгкое | >1.5‰ — тяжёлое</div>
                    </div>
                    <div style="background:#f8f9fa;border-radius:8px;padding:12px">
                        <div style="font-size:11px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Наркотические вещества</div>
                        <div style="margin-top:8px">${drugsHTML}</div>
                        ${tox.drugs.found ? `<div style="font-size:11px;color:#aaa;margin-top:6px">Обнаружены при анализе крови и мочи</div>` : ''}
                    </div>
                </div>
            </div>

            <!-- Повреждения у потерпевшего -->
            <div class="card" style="border-left:5px solid #e74c3c;margin-bottom:14px">
                <h3 style="margin:0 0 12px">🩸 Телесные повреждения потерпевшего</h3>
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:#f8f9fa;font-size:11px;text-transform:uppercase;color:#888;letter-spacing:1px">
                            <th style="text-align:left;padding:8px;width:200px">Область</th>
                            <th style="text-align:left;padding:8px">Описание</th>
                        </tr>
                    </thead>
                    <tbody>${injHTML}</tbody>
                </table>
            </div>

            <!-- Состояние подозреваемого -->
            <div class="card" style="border-left:5px solid #e67e22;margin-bottom:14px">
                <h3 style="margin:0 0 8px">🧍 Медицинское освидетельствование подозреваемого</h3>
                <p style="font-size:13px;color:#555;margin:0">${typeof suspState === 'string' ? suspState : JSON.stringify(suspState)}</p>
            </div>

            ${autopsyHTML}

            <!-- Подпись -->
            <div style="font-size:11px;color:#aaa;text-align:right;margin-top:8px">
                Документ составлен судебно-медицинским экспертом ${med.examDoctor} &nbsp;|&nbsp; ${med.examDate}
            </div>
        `;
    }
}
