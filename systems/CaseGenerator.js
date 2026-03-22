import { RussianName } from './RussianName.js';

import { Case } from '../models/Case.js';
import { Witness } from '../models/Witness.js';
import { Testimony } from '../models/Evidence.js';
import { LieStrategyEngine } from './LieStrategyEngine.js';
import { SpecialEventManager } from './SpecialEventManager.js';
import { AdvancedEvidenceSystem } from './AdvancedEvidenceSystem.js';
import { EventGraphEngine } from './EventGraphEngine.js';
import { ContradictionGraph } from '../simulation/ContradictionGraph.js';
import { WitnessSocialGraph, WitnessInfluenceEngine, LiePropagationEngine, HiddenKnowledgeEngine } from './interrogation/WitnessSocialGraph.js';
import { WitnessPerceptionEngine, WitnessTestimonyEngine } from './interrogation/WitnessAgentSystem.js';
import CRIME_TEMPLATES from '../data/crimes.js';
import { PersonProfileGenerator } from './PersonProfileGenerator.js';

// Регистрируем в globalThis, чтобы AdvancedEvidenceSystem мог использовать
// без циклического импорта (они не могут импортировать друг друга напрямую)
globalThis.__EventGraphEngine = EventGraphEngine;


// ─── Базы данных для генерации ───────────────────────────────────────────────

const CRIME_CATALOG = [

    // ══ ЛЁГКИЕ (difficulty 0.25–0.45) ══════════════════════════════════════

    {
        type: 'theft', label: 'Кража', law: 'ст. 158 УК РФ',
        description: (v) => `Хищение имущества из ${v.location} в период с ${v.timeFrom} по ${v.timeTo}`,
        motives:  ['Нужда', 'Наркозависимость', 'Обида на работодателя', 'Заказ', 'Клептомания', 'Игровая зависимость', 'Зависть к соседу'],
        methods:  ['Взлом замка', 'Дубликат ключа', 'Через окно', 'С пособником', 'Кража с отвлечением', 'В толпе', 'Пока хозяин спал'],
        sentence: 'Штраф / до 5 лет', difficulty: 0.30
    },
    {
        type: 'shoplifting', label: 'Магазинная кража', law: 'ст. 158 УК РФ',
        description: (v) => `Хищение товаров из торговой точки в ${v.location}`,
        motives:  ['Нужда', 'Клептомания', 'Вызов системе', 'Азарт', 'По принуждению группы'],
        methods:  ['Под одеждой', 'Внутри сумки с фольгой', 'Подмена ценников', 'С отвлечением кассира', 'Группой с прикрытием'],
        sentence: 'Штраф / до 2 лет', difficulty: 0.25
    },
    {
        type: 'hooliganism', label: 'Хулиганство', law: 'ст. 213 УК РФ',
        description: (v) => `Грубое нарушение общественного порядка в ${v.location}`,
        motives:  ['Алкогольное опьянение', 'Психическое расстройство', 'Радикальные взгляды', 'Личная обида', 'Скука'],
        methods:  ['Драка в публичном месте', 'Уничтожение имущества', 'Угрозы прохожим', 'Применение предмета', 'Ночной разгул'],
        sentence: 'До 5 лет', difficulty: 0.30
    },
    {
        type: 'vehicle_theft', label: 'Угон ТС', law: 'ст. 166 УК РФ',
        description: (v) => `Неправомерное завладение транспортным средством без цели хищения в ${v.location}`,
        motives:  ['Доехать', 'Показать другу', 'Хулиганство', 'Под влиянием алкоголя', 'Месть владельцу'],
        methods:  ['Выбитое стекло', 'Перехват сигнала ключа', 'Дубликат ключа', 'Помощь изнутри', 'Оставленная машина с ключами'],
        sentence: 'До 7 лет', difficulty: 0.35
    },
    {
        type: 'vandalism', label: 'Вандализм', law: 'ст. 214 УК РФ',
        description: (v) => `Порча имущества и осквернение зданий в ${v.location}`,
        motives:  ['Радикализм', 'Разочарование', 'Месть', 'Пьяная компания', 'Самовыражение'],
        methods:  ['Граффити на фасаде', 'Разбитые витрины', 'Порча мемориала', 'Поджог мусорных баков', 'Разрушение скамеек'],
        sentence: 'Штраф / до 3 лет', difficulty: 0.25
    },

    // ══ СРЕДНИЕ (difficulty 0.50–0.70) ══════════════════════════════════════

    {
        type: 'assault', label: 'Нападение', law: 'ст. 111–112 УК РФ',
        description: (v) => `Нападение на гражданина ${v.victimName} в районе ${v.location}`,
        motives:  ['Личная неприязнь', 'Ревность', 'Долговой конфликт', 'Хулиганство', 'Ограбление', 'Самооборона с превышением'],
        methods:  ['Удар кулаком', 'Применение ножа', 'Металлическая труба', 'Группой', 'Сзади', 'С применением газового баллончика'],
        sentence: 'До 8 лет', difficulty: 0.45
    },
    {
        type: 'robbery', label: 'Ограбление', law: 'ст. 161 УК РФ',
        description: (v) => `Открытое хищение имущества у ${v.victimName} с применением насилия`,
        motives:  ['Острая нужда', 'Наркотическая зависимость', 'Принуждение ОПГ', 'Азарт', 'Жадность'],
        methods:  ['С угрозой ножом', 'Рывок сумки', 'Группой с перекрытием улицы', 'В подъезде', 'После слежки'],
        sentence: 'До 10 лет', difficulty: 0.50
    },
    {
        type: 'fraud', label: 'Мошенничество', law: 'ст. 159 УК РФ',
        description: (v) => `Хищение средств ${v.orgName} на сумму ${v.amount} тыс. руб.`,
        motives:  ['Долги', 'Азарт', 'Жадность', 'Шантаж', 'Финансирование тайной жизни', 'Покрытие растраты'],
        methods:  ['Поддельные документы', 'Фиктивный договор', 'Схема Понци', 'Кредитное мошенничество', 'Ложное наследство', 'Звонок от «банка»'],
        sentence: '2–10 лет', difficulty: 0.60
    },
    {
        type: 'embezzlement', label: 'Растрата', law: 'ст. 160 УК РФ',
        description: (v) => `Хищение вверенных денежных средств ${v.orgName} в размере ${v.amount} тыс. руб.`,
        motives:  ['Долги', 'Образ жизни выше достатка', 'Семейные трудности', 'Шантаж', 'Игровая зависимость'],
        methods:  ['Фиктивные платёжки', 'Зарплатная схема', 'Завышение смет', 'Двойная бухгалтерия', 'Подставная фирма'],
        sentence: '2–8 лет', difficulty: 0.60
    },
    {
        type: 'extortion', label: 'Вымогательство', law: 'ст. 163 УК РФ',
        description: (v) => `Систематические угрозы и требование денег от ${v.victimName}`,
        motives:  ['Компромат', 'Безнаказанность', 'Власть', 'Конкурентная борьба', 'Деловой конфликт'],
        methods:  ['Анонимные письма', 'Личные угрозы', 'Через посредника', 'Шантаж видео', 'Угрозы семье'],
        sentence: '3–7 лет', difficulty: 0.60
    },
    {
        type: 'narcotics', label: 'Наркотики', law: 'ст. 228–228.1 УК РФ',
        description: (v) => `Незаконный сбыт наркотических веществ в районе ${v.location}`,
        motives:  ['Нажива', 'Участие в ОПГ', 'Давление группировки', 'Погашение долга', 'Финансирование собственного употребления'],
        methods:  ['Закладки', 'Курьерская доставка', 'Продажа через мессенджер', 'Производство в лаборатории', 'Реализация в клубах', 'Аптечные прекурсоры'],
        sentence: '3–15 лет', difficulty: 0.65
    },
    {
        type: 'arson', label: 'Поджог', law: 'ст. 167–168 УК РФ',
        description: (v) => `Умышленное уничтожение имущества путём поджога в ${v.location}`,
        motives:  ['Месть', 'Страховой умысел', 'Сокрытие другого преступления', 'Психическое расстройство', 'Заказ конкурента'],
        methods:  ['Горючая жидкость', 'Фитиль с таймером', 'Поджог газового оборудования', 'Через почтовый ящик', 'Поджог ночью в пустом здании'],
        sentence: '2–10 лет', difficulty: 0.55
    },
    {
        type: 'identity_theft', label: 'Использование чужих документов', law: 'ст. 327 УК РФ',
        description: (v) => `Подделка и использование чужих документов для получения выгоды в ${v.orgName}`,
        motives:  ['Уклонение от уголовной ответственности', 'Получение кредита', 'Незаконный найм', 'Алиментный уклон', 'Скрытие прошлого'],
        methods:  ['Покупка поддельного паспорта', 'Использование потерянного документа', 'Внесение ложных данных', 'Ламинирование с перекленкой фото'],
        sentence: 'Штраф / до 2 лет', difficulty: 0.50
    },

    // ══ СЛОЖНЫЕ (difficulty 0.70–0.85) ══════════════════════════════════════

    {
        type: 'corruption', label: 'Коррупция', law: 'ст. 290–291 УК РФ',
        description: (v) => `Получение взятки должностным лицом при исполнении обязанностей в ${v.orgName}`,
        motives:  ['Жадность', 'Безнаказанность', 'Снижение дохода', 'Давление сверху', 'Жизнь не по средствам'],
        methods:  ['Наличные', 'Ценные подарки', 'Перевод через посредника', 'Откат по контракту', 'Доля в бизнесе', 'Ремонт квартиры за счёт просителя'],
        sentence: '5–12 лет', difficulty: 0.75
    },
    {
        type: 'cybercrime', label: 'Киберпреступление', law: 'ст. 272–274 УК РФ',
        description: (v) => `Несанкционированный доступ в информационные системы ${v.orgName}`,
        motives:  ['Хищение данных', 'Вымогательство', 'Конкурентный шпионаж', 'Продажа уязвимостей', 'Идеологический хактивизм'],
        methods:  ['Фишинг', 'Ransomware', 'SQL-инъекция', 'Атака по цепочке поставок', 'DDoS + проникновение', 'Брутфорс VPN'],
        sentence: 'Штраф / до 7 лет', difficulty: 0.72
    },
    {
        type: 'kidnapping', label: 'Похищение человека', law: 'ст. 126 УК РФ',
        description: (v) => `Незаконное лишение свободы и удержание гражданина ${v.victimName}`,
        motives:  ['Выкуп', 'Принуждение к действию', 'Месть семье', 'Торговля людьми', 'Давление на должника'],
        methods:  ['Ложное предложение о работе', 'Похищение из авто', 'Насиловый захват', 'Усыпляющее вещество', 'Принуждение близким'],
        sentence: '5–15 лет', difficulty: 0.78
    },
    {
        type: 'organized_crime', label: 'ОПГ', law: 'ст. 210 УК РФ',
        description: (v) => `Организация и участие в преступном сообществе, действовавшем в ${v.location}`,
        motives:  ['Нажива', 'Контроль территории', 'Рэкет', 'Власть', 'Прикрытие других схем'],
        methods:  ['Рэкет малого бизнеса', 'Крышевание нелегальной торговли', 'Отмывание через бизнес', 'Запугивание свидетелей', 'Подкуп силовиков'],
        sentence: '10–20 лет', difficulty: 0.82
    },
    {
        type: 'money_laundering', label: 'Отмывание денег', law: 'ст. 174–174.1 УК РФ',
        description: (v) => `Легализация денежных средств, полученных преступным путём через ${v.orgName}`,
        motives:  ['Скрытие доходов от ОПГ', 'Уклонение от налогов', 'Прикрытие коррупции', 'Финансирование нелегальной деятельности'],
        methods:  ['Транзит через подставные фирмы', 'Обналичивание через стройку', 'Криптовалюта', 'Казино-схема', 'Покупка недвижимости за наличные'],
        sentence: '4–10 лет', difficulty: 0.78
    },
    {
        type: 'poaching', label: 'Браконьерство', law: 'ст. 258–260 УК РФ',
        description: (v) => `Незаконная охота и вырубка леса в охраняемом районе ${v.location}`,
        motives:  ['Коммерческая нажива', 'Традиционный уклад', 'Браконьерский туризм', 'Нелегальный зоорынок', 'Нехватка продовольствия'],
        methods:  ['Капканы вне сезона', 'Ночная вырубка', 'Ложные лицензии', 'Использование запрещённых ловушек', 'Браконьерство с катера'],
        sentence: 'Штраф / до 5 лет', difficulty: 0.52
    },
    {
        type: 'medical_fraud', label: 'Медицинское мошенничество', law: 'ст. 159 УК РФ (специальный состав)',
        description: (v) => `Завышение счетов и фиктивные медицинские услуги в ${v.orgName}`,
        motives:  ['Личное обогащение', 'Долги клиники', 'Покрытие убытков', 'Завышение показателей KPI', 'Откаты страховщикам'],
        methods:  ['Фантомные пациенты', 'Завышение стоимости процедур', 'Повторная выписка одного рецепта', 'Продажа льготных медикаментов', 'Фиктивные диагнозы'],
        sentence: '3–8 лет', difficulty: 0.68
    },
    {
        type: 'tax_evasion', label: 'Уклонение от уплаты налогов', law: 'ст. 198–199 УК РФ',
        description: (v) => `Систематическое уклонение от уплаты налогов в ${v.orgName} на сумму ${v.amount} тыс. руб.`,
        motives:  ['Жадность', 'Давление партнёров', 'Офшорные схемы', 'Конкурентный давление', 'Незнание закона'],
        methods:  ['Двойная бухгалтерия', 'Дробление бизнеса', 'Фиктивные расходы', 'Серые зарплаты', 'Офшорные счета', 'Завышение вычетов'],
        sentence: 'Штраф / до 6 лет', difficulty: 0.70
    },

    // ══ ОСОБО СЛОЖНЫЕ (difficulty 0.80–1.0) ══════════════════════════════════

    {
        type: 'homicide', label: 'Убийство', law: 'ст. 105 УК РФ',
        description: (v) => `Смерть гражданина ${v.victimName} при невыясненных обстоятельствах`,
        motives:  ['Ревность', 'Наследство', 'Долг', 'Страх разоблачения', 'Заказ', 'Аффект', 'Семейный конфликт', 'Психическое расстройство'],
        methods:  ['Отравление', 'Удар тупым предметом', 'Огнестрельное ранение', 'Удушение', 'Инсценировка несчастного случая', 'Утопление', 'Нож'],
        sentence: '8–20 лет / пожизненное', difficulty: 0.80
    },
    {
        type: 'serial_fraud', label: 'Серийное мошенничество', law: 'ст. 159 УК РФ (особо крупный)',
        description: (v) => `Серия мошеннических схем, жертвами которых стали более 50 граждан`,
        motives:  ['Систематическая нажива', 'Образ жизни', 'Покрытие долгов перед ОПГ', 'Нарциссический характер'],
        methods:  ['Финансовая пирамида', 'Массовый телефонный обзвон', 'Поддельные сайты инвестиций', 'Религиозные общины', 'Лотерейный фрод'],
        sentence: '5–15 лет', difficulty: 0.82
    },
    {
        type: 'espionage', label: 'Шпионаж', law: 'ст. 276 УК РФ',
        description: (v) => `Передача государственных секретов иностранной разведке из ${v.orgName}`,
        motives:  ['Иностранная вербовка', 'Идеология', 'Финансовый интерес', 'Шантаж спецслужб', 'Личная обида на государство'],
        methods:  ['Передача документов на встрече', 'Шпионское ПО на носителе', 'Тайниковая операция', 'Зашифрованная переписка', 'Микрофильм', 'Передача через дипломата'],
        sentence: '10–20 лет', difficulty: 0.90
    },
    {
        type: 'terrorism', label: 'Терроризм', law: 'ст. 205 УК РФ',
        description: (v) => `Террористический акт, совершённый в ${v.location}`,
        motives:  ['Политические требования', 'Религиозный экстремизм', 'Вербовка ОПГ', 'Месть государству', 'Социальное недовольство'],
        methods:  ['Взрывное устройство', 'Поджог объекта', 'Кибератака на инфраструктуру', 'Захват заложников', 'Отравление водоснабжения', 'Нападение на охраняемый объект'],
        sentence: '10–20 лет / пожизненное', difficulty: 0.98
    },
    {
        type: 'assassination', label: 'Заказное убийство', law: 'ст. 105 ч.2 УК РФ',
        description: (v) => `Убийство ${v.victimName} совершённое по найму с заранее обдуманным умыслом`,
        motives:  ['Устранение конкурента', 'Политический заказ', 'Наследство', 'Месть', 'Отмывание долга', 'Устранение свидетеля'],
        methods:  ['Снайпер издалека', 'Взрывчатка в автомобиле', 'Яд в напитке', 'Наёмный киллер в упор', 'Инсценировка ограбления', 'Отравляющий агент'],
        sentence: 'Пожизненное', difficulty: 1.0
    }
];


const MALE_FIRST_NAMES   = ['Иван','Пётр','Алексей','Сергей','Дмитрий','Андрей','Михаил',
                             'Роман','Виктор','Антон','Никита','Илья','Максим','Артём'];
const FEMALE_FIRST_NAMES = ['Мария','Елена','Ольга','Наталья','Анна','Татьяна','Юлия',
                             'Вера','Ирина','Людмила','Светлана','Дарья','Ксения','Полина'];
const PATRONYMIC_M = ['Александрович','Дмитриевич','Иванович','Сергеевич','Андреевич','Михайлович','Алексеевич'];
const PATRONYMIC_F = ['Александровна','Дмитриевна','Ивановна','Сергеевна','Андреевна','Михайловна','Алексеевна'];
const LAST_NAMES_BASE = ['Иванов','Петров','Сидоров','Кузнецов','Смирнов',
                         'Попов','Васильев','Захаров','Новиков','Михайлов',
                         'Лебедев','Семёнов','Козлов','Тарасов','Белов',
                         'Высоцкий','Черниченко','Ильин','Зайцев','Орлов'];
const ORG_NAMES   = ['ООО «Прогресс»', 'АО «СтройГрупп»', 'Банк «Доверие»',
                     'Медцентр «Здоровье»', 'ОАО «Горпромсервис»', 'Мэрия Северного района',
                     'ГКУ «Центральное управление»', 'ПАО «РосТех»', 'НИИ «Горизонт»'];
const LOCATIONS   = ['Парк Победы', 'Переулок Садовый', 'Торговый центр «Луч»',
                     'Автостоянка ул. Ленина', 'Подъезд дома №14', 'Ресторан «Берег»',
                     'Складской комплекс «Маяк»', 'Жилой дом на ул. Садовой',
                     'Подземный переход ст. Октябрьская', 'Административное здание №7'];
const RANKS = ['Мировой судья', 'Районный судья', 'Судья суда субъекта', 'Федеральный судья'];

// ─── Класс генератора ─────────────────────────────────────────────────────────

export class CaseGenerator {
    constructor() {}

    /**
     * Главный метод — создаёт полное дело
     */
    generate(careerRank = 'Мировой судья') {
        const crime = this._selectCrime(careerRank);
        const vars  = this._fillVariables(crime);
        const scenario = this._buildScenario(crime, vars);
        const event    = SpecialEventManager.generateEvent(scenario, careerRank);
        scenario.currentEvent = event;

        const witnesses = this._buildWitnesses(scenario, crime);
        const rankIndex = Math.max(0, RANKS.indexOf(careerRank));
        const complexity = 0.3 + rankIndex * 0.175;
        const evidence  = AdvancedEvidenceSystem.generate(scenario, complexity, crime.type);

        const activeCase = new Case({
            type:          crime.type,
            label:         crime.label,
            defendantName: this._fullName(),
            description:   crime.description(vars)
        });

        activeCase.trueScenario  = scenario;
        activeCase.currentEvent  = event;
        activeCase.witnesses     = witnesses;
        activeCase.evidence      = evidence;

        activeCase.suspectProfile = PersonProfileGenerator.generateSuspect(crime.type, activeCase.defendantName);
        activeCase.victimProfile  = PersonProfileGenerator.generateVictim(crime.type, vars.victimName);
        activeCase.medicalReport  = PersonProfileGenerator.generateMedicalReport(crime.type, scenario);
        activeCase.crimeData      = { label: crime.label, law: crime.law, sentence: crime.sentence, type: crime.type };

        // Упаковываем обвиняемого
        const suspectWitness = new Witness({
            name: activeCase.defendantName,
            role: 'Обвиняемый',
            observedNodeId:   scenario.graph?.nodes?.[0]?.id ?? null,
            observedNodeType: 'core_event',
            personality: {
                honesty:     scenario.isGuilty ? 0.1 : 0.8,
                courage:     0.5 + Math.random() * 0.5,
                anxiety:     scenario.isGuilty ? 0.8 : 0.4,
                empathy:     0.2 + Math.random() * 0.4,
                impulsivity: 0.4 + Math.random() * 0.5
            },
            motivation: {
                protectDefendant: 1.0,
                justice:          0.0
            },
            memory: { accuracy: 0.8 }
        });

        // Упаковываем жертву (если жива)
        let victimWitness = null;
        if (crime.type !== 'Убийство') {
            victimWitness = new Witness({
                name: vars.victimName,
                role: 'Потерпевший',
                observedNodeId:   scenario.graph?.nodes?.[0]?.id ?? null,
                observedNodeType: 'core_event',
                personality: {
                    honesty:     0.8 + Math.random() * 0.2,
                    courage:     0.3 + Math.random() * 0.6,
                    anxiety:     0.7 + Math.random() * 0.3,
                    empathy:     0.6 + Math.random() * 0.4,
                    impulsivity: 0.5 + Math.random() * 0.5
                },
                motivation: {
                    protectDefendant: 0.0,
                    justice:          1.0
                },
                memory: { accuracy: 0.7 + Math.random() * 0.3 }
            });
        }

        if (victimWitness) activeCase.witnesses.unshift(victimWitness);
        activeCase.witnesses.unshift(suspectWitness);

        // 🔥 Graph-driven: строим ContradictionGraph сразу — он нужен CrossExaminationEngine и UI
        try {
            activeCase.contradictionGraph = ContradictionGraph.build(activeCase);
        } catch (e) {
            console.warn('[CaseGenerator] ContradictionGraph.build failed:', e);
            activeCase.contradictionGraph = null;
        }
        // 🔒 WitnessSocialGraph — иерархия связей между свидетелями
        try {
            const socialGraph = new WitnessSocialGraph();
            const witnesses = activeCase.witnesses ?? [];
            witnesses.forEach(w => {
                // Инициализируем state если нет
                if (!w.state) w.state = { stress: 0, fatigue: 0, trust: 0.5 };
                socialGraph.addWitness(w);
                // Скрытые знания
                HiddenKnowledgeEngine.assign(w, activeCase.eventGraph?.nodes ?? []);
            });
            // Генерируем случайные связи
            const relTypes = ['friend','colleague','stranger','family','accomplice'];
            for (let i = 0; i < witnesses.length; i++) {
                for (let j = i + 1; j < witnesses.length; j++) {
                    if (Math.random() < 0.55) {
                        const rel = relTypes[Math.floor(Math.random() * relTypes.length)];
                        socialGraph.addRelation(witnesses[i].id, witnesses[j].id, rel);
                    }
                }
            }
            // Запускаем влияние и распространение лжи
            WitnessInfluenceEngine.propagate(socialGraph);
            LiePropagationEngine.propagate(socialGraph);
            activeCase.socialGraph = socialGraph;
        } catch (e) {
            console.warn('[CaseGenerator] WitnessSocialGraph failed:', e);
            activeCase.socialGraph = null;
        }

        // 🧠 WitnessAgentSystem — генерируем показания через агентную систему (если eventGraph есть)
        if (activeCase.eventGraph?.nodes?.length > 0) {
            try {
                const witnesses = activeCase.witnesses ?? [];
                witnesses.forEach(w => {
                    if (!w.observedNodes || w.observedNodes.length === 0) {
                        // Назначаем случайные узлы для наблюдения
                        w.observedNodes = activeCase.eventGraph.nodes
                            .filter(() => Math.random() < 0.45)
                            .map(n => n.id);
                    }
                    // Восприятие событий
                    WitnessPerceptionEngine.perceiveAll(w, activeCase.eventGraph);
                    // Генерируем показания через TestimonyEngine только если у свидетеля нет существующих
                    if (!w.testimonies || w.testimonies.length === 0) {
                        WitnessTestimonyEngine.generateAll(w, activeCase.eventGraph);
                    }
                });
            } catch (e) {
                console.warn('[CaseGenerator] WitnessAgentSystem failed:', e);
            }
        }

        return activeCase;
    }

    // ─── Частные методы ────────────────────────────────────────────────────

    /** Выбирает тип преступления с учётом сложности ранга (из CRIME_CATALOG + CRIME_TEMPLATES) */
    _selectCrime(rank) {
        const rankIndex = Math.max(0, RANKS.indexOf(rank));
        const maxDiff   = 0.40 + rankIndex * 0.15;

        // Объединяем каталог и 200 шаблонов
        const allCrimes = [
            ...CRIME_CATALOG,
            ...CRIME_TEMPLATES.map(t => ({
                type:        t.type,
                label:       t.label,
                law:         t.law,
                difficulty:  t.difficulty,
                motives:     t.motives,
                methods:     t.methods,
                sentence:    t.sentence,
                _locations:  t.locations,
                description: (v) => t.label + ': ' + (t.locations?.[0] || v.location)
            }))
        ];

        const allowed = allCrimes.filter(c => c.difficulty <= maxDiff);
        return this._pick(allowed.length > 0 ? allowed : allCrimes);
    }

    /** Заполняет переменные (имена, суммы, места) */
    _fillVariables(crime) {
        return {
            victimName: this._fullName(),
            orgName:    this._pick(ORG_NAMES),
            location:   this._pick(LOCATIONS),
            amount:     (50 + Math.floor(Math.random() * 450)).toLocaleString('ru'),
            timeFrom:   `${8 + Math.floor(Math.random() * 6)}:00`,
            timeTo:     `${15 + Math.floor(Math.random() * 6)}:00`
        };
    }

    /** Строит «истинный» сценарий — граф событий + метаданные */
    _buildScenario(crime, vars) {
        const isGuilty = Math.random() > 0.35;  // 65% виновен
        const motive   = this._pick(crime.motives);
        const method   = this._pick(crime.methods);

        // Алиби: у виновного оно ложное, у невиновного — настоящее
        const alibi = isGuilty
            ? this._generateFalseAlibi(vars)
            : this._generateTrueAlibi(vars);

        // 🔥 ГРАФ СОБЫТИЙ — единый источник истины для всей системы
        const graph = EventGraphEngine.build(crime, vars, isGuilty, method, motive);

        // Обратная совместимость: facts из nodes для старого CaseView
        const facts = graph.nodes.map(n => ({
            when:   n.time || vars.timeFrom,
            nodeId: n.id,
            text:   n.description
        }));

        return {
            isGuilty,
            motive,
            method,
            alibi,
            facts,
            graph,       // 🔥 вся цепочка событий
            location:    vars.location,
            time:        vars.timeFrom,
            victimName:  vars.victimName,
            orgName:     vars.orgName,
            amount:      vars.amount,
            law:         crime.law      || null,
            sentence:    crime.sentence || null
        };
    }

    /** Генерирует цепочку событий (устаревший метод, оставлен для совместимости) */
    _generateFactChain(crime, isGuilty, vars, method) {
        const facts = [];
        if (isGuilty) {
            facts.push({ when: 'до', text: `Подозреваемый был замечен вблизи ${vars.location} за несколько часов.` });
            facts.push({ when: 'во время', text: `Применён метод: «${method}». Следы обнаружены.` });
            facts.push({ when: 'после', text: `Подозреваемый срочно покинул место. GPS-лог зафиксирован.` });
        } else {
            facts.push({ when: 'до', text: `Подозреваемый находился в ${this._pick(LOCATIONS)} — есть свидетели.` });
            facts.push({ when: 'совпадение', text: `Внешность описывается похоже, но ДНК не совпадает.` });
            facts.push({ when: 'виновный', text: `Реальный преступник — третье лицо, следы которого размыты.` });
        }
        return facts;
    }


    _generateFalseAlibi(vars) {
        return {
            claim: `Был дома, смотрел телевизор весь вечер.`,
            verified: false,
            witness: 'Сосед (показания противоречивы)'
        };
    }

    _generateTrueAlibi(vars) {
        const place = this._pick(LOCATIONS);
        return {
            claim: `Находился в ${place}, есть чек и запись камеры.`,
            verified: true,
            witness: 'Кассир супермаркета (показания подтверждены)'
        };
    }

    /** Генерирует свидетелей, каждый ссылается на конкретный узел графа */
    _buildWitnesses(scenario, crime) {
        const nodes = scenario.graph?.nodes ?? [];
        const count = 2 + Math.floor(Math.random() * 3); // 2–4 свидетеля
        const roles = this._assignWitnessRoles(count, scenario);

        return roles.map((role) => {
            // Каждый свидетель наблюдал случайный узел (с учётом его видимости)
            const observedNode = this._pickByVisibility(nodes);

            const w = new Witness({
                name: this._fullName(),
                role: role.name,
                observedNodeId:   observedNode?.id   ?? null,
                observedNodeType: observedNode?.type ?? null,   // 🔥 для InterrogationEngine
                personality: {
                    honesty:     role.baseHonesty + (Math.random() - 0.5) * 0.3,
                    courage:     0.3 + Math.random() * 0.7,
                    anxiety:     0.1 + Math.random() * 0.8,
                    empathy:     0.2 + Math.random() * 0.8,
                    impulsivity: 0.1 + Math.random() * 0.9
                },
                motivation: {
                    protectDefendant: role.isAllied ? 0.5 + Math.random() * 0.5 : Math.random() * 0.2,
                    justice:          role.isAllied ? Math.random() * 0.4 : 0.5 + Math.random() * 0.5
                },
                memory: { accuracy: 0.4 + Math.random() * 0.6 }
            });


            const isTellingTruth = w.decideTruth();

            let text;
            if (isTellingTruth && observedNode) {
                // 🔥 Показание из графа événements — описывает конкретный node
                text = EventGraphEngine.describeNodeForWitness(observedNode, w);
            } else if (isTellingTruth) {
                text = this._trueLine(scenario, w, role);
            } else {
                text = LieStrategyEngine.generateLieText(
                    LieStrategyEngine.chooseStrategy(w), scenario
                );
            }

            w.testimonies.push(new Testimony({
                witnessId: w.id,
                nodeId:    observedNode?.id ?? null,
                text,
                type: isTellingTruth ? 'true' : 'lie'
            }));

            return w;
        });
    }

    /**
     * Выбирает узел с вероятностью пропорциональной его visibility.
     * Узлы с visibility=0.95 почти всегда попадают к свидетелям.
     */
    _pickByVisibility(nodes) {
        if (!nodes.length) return null;
        const totalWeight = nodes.reduce((s, n) => s + (n.visibility ?? 0.5), 0);
        let r = Math.random() * totalWeight;
        for (const node of nodes) {
            r -= (node.visibility ?? 0.5);
            if (r <= 0) return node;
        }
        return nodes[nodes.length - 1];
    }


    /** Распределяет роли свидетелей */
    _assignWitnessRoles(count, scenario) {
        const pool = [
            { name: 'Очевидец',       baseHonesty: 0.8, isAllied: false },
            { name: 'Знакомый обвиняемого', baseHonesty: 0.4, isAllied: true  },
            { name: 'Эксперт',        baseHonesty: 0.9, isAllied: false },
            { name: 'Сотрудник',      baseHonesty: 0.6, isAllied: false },
            { name: 'Родственник',    baseHonesty: 0.3, isAllied: true  }
        ];
        // Перетасовать и взять нужное количество
        const shuffled = pool.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    /** Показание правдивого свидетеля */
    _trueLine(scenario, witness, role) {
        const acc = witness.memory.accuracy;
        const loc = scenario.location;
        const time = scenario.time;

        if (acc < 0.5) {
            return `Кажется, я что-то видел около ${loc}... Точно не помню время.`;
        }
        if (role.isAllied) {
            return `Он был у меня в тот вечер, мы разговаривали. Не мог он этого сделать.`;
        }
        if (scenario.isGuilty) {
            return `Я видел подсудимого именно там в ${time}. Поведение показалось подозрительным.`;
        } else {
            return `Подозреваемого в то время там не было. Я хорошо помню — это был другой человек.`;
        }
    }

    // ─── Вспомогательные ───────────────────────────────────────────────────

    _fullName() {
        // С вероятностью 30% — женский персонаж
        const isFemale = Math.random() < 0.30;
        const firstName  = this._pick(isFemale ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES);
        const patronymic = this._pick(isFemale ? PATRONYMIC_F : PATRONYMIC_M);
        const lastBase   = this._pick(LAST_NAMES_BASE);
        const lastName   = isFemale ? RussianName.feminize(lastBase) : lastBase;
        return `${lastName} ${firstName} ${patronymic}`;
    }

    _pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}
