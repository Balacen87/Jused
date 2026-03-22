import { WitnessDialogueDictionary } from './WitnessDialogueDictionary.js';

/**
 * StatementEvolutionEngine — отслеживает эволюцию показаний в процессе допроса.
 *
 * Каждое показание хранит versions[] — историю изменений со стадией допроса,
 * типом изменения и шагом.
 *
 * Пример финальной версии:
 *   { currentText, currentType, versions: [ {step, text, type, trigger} ] }
 */

export class StatementEvolutionEngine {

    // Типы изменений показания
    static CHANGE_TYPES = {
        initial:          { label: 'Исходное',         color: '#94a3b8' },
        minor_correction: { label: 'Уточнение',        color: '#6366f1' },
        evasion_shift:    { label: 'Уход в туман',     color: '#f59e0b' },
        slip_change:      { label: 'Оговорка',         color: '#f97316' },
        partial_admission:{ label: 'Частичное признание', color: '#ef4444' },
        full_admission:   { label: 'Признание',        color: '#dc2626' },
        memory_blur:      { label: 'Провал в памяти',  color: '#64748b' },
        aggressive_lock:  { label: 'Жёсткая позиция', color: '#7c3aed' },
    };

    /**
     * Инициализирует историю для объекта Testimony.
     * Мутирует testimony, добавляя testimony.versions если нет.
     * @param {Object} testimony
     */
    static init(testimony) {
        if (!testimony.versions) {
            testimony.versions = [
                {
                    step:    0,
                    text:    testimony.text,
                    type:    testimony.type,
                    trigger: 'initial',
                    changeType: 'initial'
                }
            ];
        }
    }

    /**
     * Применяет изменение к показанию в результате ответа допроса.
     * Мутирует testimony.
     *
     * @param {Object} testimony — Testimony object
     * @param {string} responseKind — тип ответа из ResponseResolver
     * @param {Object} psychModel — SubjectPsychologyModel
     * @param {Object} session — InterrogationSession
     * @param {Object|null} evidence — используемая улика
     * @returns {{ changed: boolean, changeType: string, before: Object, after: Object }}
     */
    static evolve(testimony, responseKind, psychModel, session, evidence) {
        StatementEvolutionEngine.init(testimony);

        const step     = session.questionHistory.length;
        const evLabel  = evidence?.label ?? evidence?.type ?? 'предъявленного материала';
        const before   = { text: testimony.text, type: testimony.type };

        let changeType = null;
        let newText    = null;
        let newType    = testimony.type;

        switch (responseKind) {
            case 'full_admission': {
                changeType = 'full_admission';
                newType    = 'corrected';
                newText    = `После давления я признаю — мои прежние слова были неточны. Предъявленный материал (${evLabel}) не оставляет сомнений.`;
                break;
            }
            case 'partial_admission': {
                changeType = 'partial_admission';
                newType    = testimony.type === 'lie' ? 'corrected' : testimony.type;
                newText    = `Вынужден уточнить: часть того, что я говорил, возможно, была сформулирована не вполне точно, особенно в части ${evLabel}.`;
                break;
            }
            case 'correction': {
                changeType = 'minor_correction';
                newType    = testimony.type === 'lie' ? 'corrected' : testimony.type;
                newText    = `Позвольте скорректировать: ранее я описал ситуацию несколько иначе, но теперь, обдумав, могу уточнить детали.`;
                break;
            }
            case 'slip': {
                changeType = 'slip_change';
                newText    = `Подождите... то есть — нет, я имел(а) в виду другое. Возможно, в деталях я ошибаюсь. Учитывая ${evLabel}, может, я и перепутал(а) время.`;
                break;
            }
            case 'memory_gap': {
                changeType = 'memory_blur';
                newText    = `Сейчас я не могу точно вспомнить — прошло время. Возможно, я что-то не так понял(а) тогда.`;
                break;
            }
            case 'overexplaining': {
                changeType = 'slip_change';
                newText    = testimony.text + ` — я хочу добавить: это точно было именно так, всё чётко, я уверен(а), совершенно точно именно в этом порядке.`;
                break;
            }
            case 'anger_response': {
                changeType = 'aggressive_lock';
                newText    = `Я уже всё сказал(а). Вопрос уже задавался. Я не собираюсь повторять одно и то же по кругу.`;
                break;
            }
            case 'evasion':
            case 'deflection': {
                changeType = 'evasion_shift';
                newText    = `Я не совсем уверен(а), что правильно понимаю вопрос. Мне трудно сказать точнее.`;
                break;
            }
            default:
                break; // Уходим дальше к возврату changed: false
        }

        if (changeType) {
            testimony.text = newText;
            testimony.type = newType;
            testimony.revisions ??= [];
            testimony.revisions.push({
                at:      Date.now(),
                oldText: before.text,
                newText: newText,
                oldType: before.type,
                newType: newType,
                reason:  responseKind
            });
            testimony.versions.push({
                step,
                text:       newText,
                type:       newType,
                trigger:    responseKind,
                changeType,
            });

            return {
                changed:    true,
                changeType,
                before,
                after: { text: newText, type: newType }
            };
        }

        return { changed: false, changeType: null, before, after: before };
    }

    /**
     * Генерирует текстовую реплику свидетеля для лога допроса (UI).
     * @param {string} responseKind 
     * @param {string} evLabel 
     * @param {Object} psychModel 
     * @param {Object} witness
     * @returns {string}
     */
    static generateResponseText(responseKind, evLabel, psychModel, witness) {
        const arch = psychModel?.archetypeKey || 'default';
        const role = witness?.role || 'Свидетель';
        return WitnessDialogueDictionary.getDialogue(arch, responseKind, evLabel, role);
    }

    /**
     * Рендерит «хронологию слома» показания для UI.
     * @param {Object} testimony
     * @returns {string} HTML
     */
    static renderTimeline(testimony) {
        const versions = testimony?.versions ?? [];
        if (versions.length <= 1) return '<span style="color:var(--text-muted);font-size:0.78rem">Показание не изменялось</span>';

        return versions.map((v, i) => {
            const ct = StatementEvolutionEngine.CHANGE_TYPES[v.changeType ?? 'initial'];
            return `
                <div style="display:flex;gap:8px;align-items:flex-start;font-size:0.78rem;margin-bottom:4px">
                    <span style="minWidth:18px;color:${ct.color};font-weight:700">[${i}]</span>
                    <span style="color:${ct.color}">${ct.label}</span>
                    <span style="color:var(--text-muted)">${v.text?.slice(0, 60) ?? ''}…</span>
                </div>`;
        }).join('');
    }
}
