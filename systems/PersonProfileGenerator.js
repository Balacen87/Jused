/**
 * PersonProfileGenerator — генератор детальных профилей личности.
 * Учитывает тип преступления для контекстно-связанной генерации.
 */

const MALE_NAMES   = ['Александр','Дмитрий','Иван','Сергей','Андрей','Максим','Артём','Николай','Владимир','Павел','Роман','Игорь','Константин','Виктор','Алексей','Евгений','Пётр','Михаил','Денис','Григорий'];
const FEMALE_NAMES = ['Анна','Екатерина','Мария','Ольга','Наталья','Елена','Татьяна','Юлия','Светлана','Ирина','Надежда','Вера','Людмила','Галина','Валентина','Алина','Дарья','Ксения','Полина','Маргарита'];
const LAST_NAMES_M = ['Иванов','Смирнов','Козлов','Попов','Новиков','Морозов','Соколов','Волков','Лебедев','Захаров','Орлов','Громов','Борисов','Тихонов','Сидоров','Фёдоров','Кузнецов','Павлов','Беляев','Крылов'];
const LAST_NAMES_F = ['Иванова','Смирнова','Козлова','Попова','Новикова','Морозова','Соколова','Волкова','Лебедева','Захарова','Орлова','Громова','Борисова','Тихонова','Сидорова','Фёдорова','Кузнецова','Павлова','Беляева','Крылова'];
const PATRONYMIC_M = ['Александрович','Дмитриевич','Иванович','Сергеевич','Андреевич','Максимович','Артёмович','Николаевич','Владимирович','Павлович','Романович','Игоревич','Константинович','Викторович'];
const PATRONYMIC_F = ['Александровна','Дмитриевна','Ивановна','Сергеевна','Андреевна','Максимовна','Артёмовна','Николаевна','Владимировна','Павловна','Романовна','Игоревна','Константиновна','Викторовна'];

const STREETS = ['ул. Ленина','ул. Победы','ул. Садовая','ул. Молодёжная','пр. Советский','ул. Центральная','пр. Мира','ул. Кирова','ул. Зелёная','ул. Первомайская','ул. Советская','пр. Революции','ул. Гагарина'];
const CITIES  = ['г. Москва','г. Санкт-Петербург','г. Краснодар','г. Екатеринбург','г. Новосибирск','г. Казань','г. Ростов-на-Дону','г. Самара','г. Нижний Новгород','г. Уфа'];

// Профессии по типу преступления (реалистично)
const OCCUPATIONS_BY_CRIME = {
    theft:       { suspect: ['Безработный','Разнорабочий','Водитель','Курьер','Грузчик'], victim: ['Пенсионер','Менеджер','Продавец','Учитель','Бухгалтер'] },
    fraud:       { suspect: ['Менеджер','Финансовый консультант','Юрист','Предприниматель','Риелтор'], victim: ['Пенсионер','Домохозяйка','Рабочий','Инженер','Врач'] },
    homicide:    { suspect: ['Безработный','Рабочий','Охранник','Водитель','Предприниматель'], victim: ['Менеджер','Инженер','Студент','Рабочий','Предприниматель'] },
    assault:     { suspect: ['Безработный','Рабочий','Охранник','Водитель','Студент'], victim: ['Студент','Рабочий','Менеджер','Водитель','Продавец'] },
    corruption:  { suspect: ['Государственный служащий','Сотрудник полиции','Прокурор','Чиновник','Инспектор'], victim: ['Предприниматель','Врач','Рядовой гражданин','Студент'] },
    extortion:   { suspect: ['Безработный','Охранник','Мелкий предприниматель'], victim: ['Предприниматель','Торговец','Пенсионер'] },
    narcotics:   { suspect: ['Безработный','Курьер','Студент','Неработающий'], victim: ['Студент','Школьник','Рабочий'] },
    cybercrime:  { suspect: ['IT-специалист','Программист','Системный администратор','Студент IT'], victim: ['Менеджер','Предприниматель','Государственный служащий'] },
    espionage:   { suspect: ['Учёный','Государственный служащий','Военный','Инженер'], victim: ['Государство','Предприятие','Организация'] },
    terrorism:   { suspect: ['Безработный','Активист','Студент'], victim: ['Рядовой гражданин','Сотрудник полиции'] },
    default:     { suspect: ['Безработный','Рабочий','Менеджер'], victim: ['Рядовой гражданин'] }
};

const R = (arr) => arr[Math.floor(Math.random() * arr.length)];

function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Генерирует профиль человека
 * @param {'male'|'female'|'random'} sex
 * @param {number} minAge
 * @param {number} maxAge
 * @param {string[]} occupations  Список подходящих профессий
 * @returns {PersonProfile}
 */
function buildProfile(sex, minAge, maxAge, occupations) {
    const isMale = sex === 'random' ? Math.random() > 0.4 : sex === 'male';
    const gender = isMale ? 'Мужской' : 'Женский';
    const firstName  = isMale ? R(MALE_NAMES)    : R(FEMALE_NAMES);
    const lastName   = isMale ? R(LAST_NAMES_M)  : R(LAST_NAMES_F);
    const patronymic = isMale ? R(PATRONYMIC_M)  : R(PATRONYMIC_F);
    const fullName   = `${lastName} ${firstName} ${patronymic}`;
    const birthYear  = new Date().getFullYear() - randInt(minAge, maxAge);
    const age        = new Date().getFullYear() - birthYear;
    const handedness = Math.random() > 0.12 ? 'Правша' : 'Левша';
    const street     = R(STREETS);
    const city       = R(CITIES);
    const houseNum   = randInt(1, 120);
    const aptNum     = randInt(1, 200);
    const address    = `${city}, ${street}, д. ${houseNum}, кв. ${aptNum}`;
    const occupation = R(occupations);

    // Образование / место
    let workInfo;
    if (age < 18) {
        workInfo = { label: 'Учёба', place: `МБОУ Школа №${randInt(1, 150)}` };
    } else if (age < 24 && Math.random() > 0.5) {
        workInfo = { label: 'Учёба', place: `${R(['МГТУ', 'РГУ', 'ТГУ', 'РУДН', 'СПбГУ'])}, ${randInt(1,5)} курс` };
    } else {
        workInfo = { label: 'Работа', place: occupation };
    }

    return { fullName, firstName, lastName, patronymic, gender, birthYear, age, handedness, address, occupation, workInfo };
}

export class PersonProfileGenerator {

    /**
     * Генерирует профиль подозреваемого с учётом типа преступления
     */
    static generateSuspect(crimeType, defendantName) {
        const occ = (OCCUPATIONS_BY_CRIME[crimeType] || OCCUPATIONS_BY_CRIME.default).suspect;

        // Определяем пол из переданного имени
        let sex = Math.random() > 0.25 ? 'male' : 'female';
        if (defendantName) {
            const first = defendantName.split(' ')[1] || '';
            if (MALE_NAMES.includes(first))    sex = 'male';
            else if (FEMALE_NAMES.includes(first)) sex = 'female';
        }
        const profile = buildProfile(sex, 18, 55, occ);

        if (defendantName) {
            const parts = defendantName.split(' ');
            profile.fullName   = defendantName;
            profile.lastName   = parts[0] || profile.lastName;
            profile.firstName  = parts[1] || profile.firstName;
            profile.patronymic = parts[2] || profile.patronymic;
        }
        profile.role = 'suspect';
        return profile;
    }

    /**
     * Генерирует профиль жертвы с учётом типа преступления
     */
    static generateVictim(crimeType, victimName) {
        const occ = (OCCUPATIONS_BY_CRIME[crimeType] || OCCUPATIONS_BY_CRIME.default).victim;

        let sex = 'random';
        if (victimName) {
            const first = victimName.split(' ')[1] || '';
            if (MALE_NAMES.includes(first))    sex = 'male';
            else if (FEMALE_NAMES.includes(first)) sex = 'female';
        }
        const profile = buildProfile(sex, 18, 75, occ);

        if (victimName) {
            const parts = victimName.split(' ');
            profile.fullName   = victimName;
            profile.lastName   = parts[0] || profile.lastName;
            profile.firstName  = parts[1] || profile.firstName;
            profile.patronymic = parts[2] || profile.patronymic;
        }
        profile.role = 'victim';
        return profile;
    }

    /**
     * Генерирует медицинское заключение с учётом типа преступления
     */
    static generateMedicalReport(crimeType, scenario) {
        const isLethal = crimeType === 'homicide';
        const isViolent = ['homicide','assault'].includes(crimeType);
        const isNarcotics = crimeType === 'narcotics';
        const method = scenario?.method || '';
        const report = {};

        // Алкоголь и наркотики
        const alcoholLevel = isNarcotics || crimeType === 'assault'
            ? +(0.1 + Math.random() * 3.2).toFixed(2)
            : +(Math.random() * 0.8).toFixed(2);
        const drugsFound = isNarcotics || (Math.random() > 0.75);
        report.toxicology = {
            alcohol: { value: alcoholLevel, unit: '‰', label: alcoholLevel > 1.5 ? 'Тяжёлое опьянение' : alcoholLevel > 0.3 ? 'Лёгкое опьянение' : 'В норме' },
            drugs:   drugsFound ? { found: true,  substances: PersonProfileGenerator._randomDrugs(crimeType) } : { found: false, substances: [] },
        };

        // Описание повреждений у потерпевшего
        report.victimInjuries = PersonProfileGenerator._generateInjuries(method, isLethal, isViolent);

        // Описание состояния подозреваемого
        report.suspectInjuries = PersonProfileGenerator._generateSuspectState(isViolent, method);

        // Патологоанатомическое вскрытие (только при убийстве)
        if (isLethal) {
            report.autopsy = PersonProfileGenerator._generateAutopsy(method, scenario);
        }

        // Дата проведения экспертизы
        const examDate = new Date();
        examDate.setDate(examDate.getDate() - randInt(1, 5));
        report.examDate = examDate.toLocaleDateString('ru-RU');
        report.examDoctor = `${R(['Соколов','Морозов','Белов','Крылов','Носов'])} ${R(['В.А.','П.Д.','К.Н.','А.Е.','Г.С.'])}`;

        return report;
    }

    static _randomDrugs(crimeType) {
        const all = ['Каннабис','Амфетамин','Кокаин','Героин','Метамфетамин','Барбитураты','Бензодиазепины'];
        if (crimeType === 'narcotics') return [R(all), R(all)].filter((v,i,a)=>a.indexOf(v)===i);
        return [R(all)];
    }

    static _generateInjuries(method, isLethal, isViolent) {
        if (!isViolent) {
            return [{ region: 'Общее', description: 'Видимых телесных повреждений не обнаружено. Следов физического насилия нет.' }];
        }
        const m = method.toLowerCase();
        const result = [];

        if (m.includes('нож') || m.includes('колющ')) {
            result.push({ region: 'Грудная клетка / брюшная полость', description: `${randInt(1,3)} колото-резаных ранения, глубина ${randInt(4,12)} см. Повреждены ${R(['межрёберные мышцы','лёгкое','печень','кишечник'])}.` });
        } else if (m.includes('огнестрел') || m.includes('пистолет') || m.includes('выстрел')) {
            result.push({ region: 'Огнестрельные ранения', description: `${randInt(1,2)} сквозных огнестрельных ранения. Входное отверстие ⌀ ${randInt(6,12)} мм. Выходное — ${randInt(14,30)} мм. Направление — ${R(['сзади','спереди','сбоку'])}.` });
        } else if (m.includes('тупой') || m.includes('бутылк') || m.includes('труб') || m.includes('предмет')) {
            result.push({ region: 'Голова / череп', description: `Тупая черепно-мозговая травма. Ссадины и гематомы теменной области. ${isLethal ? 'Перелом лобной кости, субдуральная гематома.' : 'Сотрясение мозга I–II ст.'}` });
        } else if (m.includes('удуш') || m.includes('удавлен')) {
            result.push({ region: 'Шея', description: 'Странгуляционная борозда шириной 2–3 см. Кровоизлияния в конъюнктиву. Переломы хрящей гортани.' });
        } else if (m.includes('кислот')) {
            result.push({ region: 'Лицо / верхние конечности', description: 'Химические ожоги II–III степени площадью ~15% поверхности тела. Необратимые рубцовые изменения.' });
        } else {
            result.push({ region: 'Различные области', description: `Множественные кровоподтёки конечностей, ссадины лица. ${isLethal ? 'Разрыв внутренних органов.' : 'Поверхностные повреждения.'}` });
        }

        if (!isLethal) {
            result.push({ region: 'Степень вреда здоровью', description: `${R(['Тяжкий вред здоровью (ст.111)','Средней тяжести (ст.112)','Лёгкий вред (ст.115)'])}` });
        }
        return result;
    }

    static _generateSuspectState(isViolent, method) {
        if (!isViolent || Math.random() > 0.5) {
            return 'Телесных повреждений не обнаружено. Следов борьбы на теле подозреваемого нет. Одежда не повреждена.';
        }
        return `При медицинском освидетельствовании подозреваемого обнаружены: ${R(['царапины на руках','ссадины на костяшках пальцев','гематома на лице','порезы на предплечьях'])}. Характер повреждений соответствует следам борьбы.`;
    }

    static _generateAutopsy(method, scenario) {
        const m = (method || '').toLowerCase();
        const time = scenario?.time || '18:00';
        const causeMap = {
            нож: 'Острая кровопотеря вследствие колото-резаного ранения с повреждением жизненно важных органов.',
            огнестрел: 'Геморрагический шок вследствие огнестрельного ранения.',
            удуш: 'Механическая асфиксия. Странгуляция.',
            яд: 'Острое отравление веществом неустановленной природы. Полиорганная недостаточность.',
            тупой: 'Тяжёлая закрытая черепно-мозговая травма. Субдуральная гематома.',
            взрыв: 'Множественная взрывная травма. Несовместимые с жизнью повреждения.',
        };
        let cause = 'Насильственная смерть. Точная причина уточняется.';
        for (const [key, val] of Object.entries(causeMap)) {
            if (m.includes(key)) { cause = val; break; }
        }
        return {
            causeOfDeath: cause,
            timeOfDeath: `Предположительно ${time} — ${time.replace(':',':')}. Давность наступления смерти: ${randInt(1,8)} ч. Точность ±${randInt(1,2)} ч.`,
            postmortemFindings: [
                `Температура тела при обнаружении: ${+(36.6 - randInt(5,20) * 0.3).toFixed(1)}°C`,
                `Трупное окоченение: ${R(['развито в полной мере','начальная стадия','отсутствует (менее 2 ч.)'])}`,
                `Трупные пятна: ${R(['ярко выражены, фиолетово-синие','бледные','отсутствуют (тело перемещено?)'])}`,
                `Признаки борьбы: ${R(['имеются (следы кожи под ногтями, порванная одежда)','не обнаружены'])}`,
            ],
        };
    }
}
