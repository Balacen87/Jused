/**
 * ProfileCardView — UI-компонент карточки подозреваемого и жертвы.
 */
export class ProfileCardView {

    /**
     * @param {Object} profile  PersonProfile от PersonProfileGenerator
     * @param {'suspect'|'victim'} role
     * @param {Object} crimeData  { label, law, sentence, type }
     * @param {Object} element    DOM-элемент
     */
    static render(profile, role, crimeData, element) {
        const isSuspect = role === 'suspect';
        const accentColor = isSuspect ? '#c0392b' : '#2980b9';
        const title       = isSuspect ? '👤 Карточка подозреваемого' : '🧑 Карточка потерпевшего';
        const badge       = isSuspect ? '🔴 ПОДОЗРЕВАЕМЫЙ' : '🔵 ПОТЕРПЕВШИЙ';

        const workHTML = profile.workInfo
            ? `<tr><td>${profile.workInfo.label}</td><td><strong>${profile.workInfo.place}</strong></td></tr>`
            : '';

        const photoIcon = isSuspect
            ? `<div style="width:80px;height:100px;border-radius:6px;background:linear-gradient(135deg,#e74c3c,#c0392b);
                display:flex;align-items:center;justify-content:center;font-size:2.8em;flex-shrink:0">👤</div>`
            : `<div style="width:80px;height:100px;border-radius:6px;background:linear-gradient(135deg,#3498db,#2980b9);
                display:flex;align-items:center;justify-content:center;font-size:2.8em;flex-shrink:0">🧑</div>`;

        // Статус (только для подозреваемого)
        const statusHTML = isSuspect ? `
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
                <span style="background:#c0392b;color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">${badge}</span>
                <span style="background:#f8f9fa;padding:3px 10px;border-radius:20px;font-size:11px;color:#555">${crimeData?.law || ''}</span>
                <span style="background:#f8f9fa;padding:3px 10px;border-radius:20px;font-size:11px;color:#555">Наказание: ${crimeData?.sentence || '—'}</span>
            </div>` : `
            <div style="margin-top:12px">
                <span style="background:#2980b9;color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">${badge}</span>
            </div>`;

        element.innerHTML = `
            <div class="card" style="border-left:5px solid ${accentColor};margin-bottom:14px">

                <!-- Шапка карточки -->
                <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:16px">
                    ${photoIcon}
                    <div style="flex:1">
                        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;font-weight:600">${title}</div>
                        <div style="font-size:1.35em;font-weight:700;margin:4px 0;color:#2c3e50">${profile.fullName}</div>
                        <div style="font-size:13px;color:#555">${profile.gender} &nbsp;·&nbsp; ${profile.age} лет</div>
                        ${statusHTML}
                    </div>
                </div>

                <!-- Основные данные -->
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <colgroup><col style="width:160px"><col></colgroup>
                    ${ProfileCardView._row('Фамилия', profile.lastName)}
                    ${ProfileCardView._row('Имя', profile.firstName)}
                    ${ProfileCardView._row('Отчество', profile.patronymic)}
                    ${ProfileCardView._row('Пол', profile.gender)}
                    ${ProfileCardView._row('Год рождения', `${profile.birthYear} г. (${profile.age} лет)`)}
                    ${ProfileCardView._row('Ведущая рука', `${profile.handedness} ${profile.handedness === 'Левша' ? '<span style="color:#e67e22;font-size:11px"> ⚠️ нетипично</span>' : ''}`)}
                    ${ProfileCardView._row('Профессия', profile.occupation)}
                    ${workHTML}
                    ${ProfileCardView._row('Адрес проживания', profile.address)}
                </table>
            </div>

            <!-- Примечания к делу -->
            <div class="card" style="border-left:5px solid #95a5a6;font-size:13px">
                <h3 style="margin:0 0 8px;font-size:14px">📎 Контекст дела</h3>
                ${ProfileCardView._contextNotes(profile, role, crimeData)}
            </div>
        `;
    }

    static _row(label, value) {
        return `
        <tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:7px 0;color:#888">${label}</td>
            <td style="padding:7px 0;font-weight:500">${value}</td>
        </tr>`;
    }

    static _contextNotes(profile, role, crimeData) {
        const notes = [];
        if (role === 'suspect') {
            if (profile.handedness === 'Левша') notes.push('⚠️ Обвиняемый является левшой — при анализе физических улик следует учесть направленность ударов и почерка.');
            if (profile.age < 21) notes.push(`📌 Обвиняемый является несовершеннолетним или недавно достиг совершеннолетия (${profile.age} лет) — применяются особые нормы УК РФ.`);
            if (profile.occupation === 'Безработный' || profile.occupation === 'Неработающий') notes.push('📋 Обвиняемый не имеет официального места работы. Источник дохода не установлен.');
            if (crimeData?.type === 'corruption') notes.push('🏛️ В деле о коррупции особое значение имеет должностное положение обвиняемого.');
        } else {
            if (profile.age > 65) notes.push(`👴 Потерпевший является пожилым человеком (${profile.age} лет) — суд вправе квалифицировать как отягчающее обстоятельство.`);
            if (profile.workInfo?.label === 'Учёба') notes.push('📌 Потерпевший является студентом / школьником — особый правовой статус.');
        }
        if (!notes.length) notes.push('Дополнительных процессуальных примечаний не имеется.');
        return notes.map(n => `<p style="margin:4px 0">${n}</p>`).join('');
    }
}
