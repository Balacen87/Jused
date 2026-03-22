/**
 * RussianName.js — утилита для корректного склонения русских фамилий
 * и определения рода по имени/фамилии.
 *
 * Поддерживает:
 *  - Определение пола по имени (мужское/женское)
 *  - Feminization фамилии (мужская → женская форма)
 *  - Определение рода по фамилии (без словаря имен)
 */

// ─── Базы имён для определения пола ──────────────────────────────────────────

const MALE_FIRST_NAMES = new Set([
    'Александр','Дмитрий','Иван','Сергей','Андрей','Максим','Артём','Николай',
    'Владимир','Павел','Роман','Игорь','Константин','Виктор','Алексей','Евгений',
    'Пётр','Михаил','Денис','Григорий','Антон','Никита','Илья','Роман','Виталий',
    'Анатолий','Борис','Вячеслав','Геннадий','Глеб','Даниил','Егор','Кирилл',
    'Леонид','Лев','Олег','Тимур','Фёдор','Юрий','Яков','Арсений','Степан','Марк'
]);

const FEMALE_FIRST_NAMES = new Set([
    'Анна','Екатерина','Мария','Ольга','Наталья','Елена','Татьяна','Юлия',
    'Светлана','Ирина','Надежда','Вера','Людмила','Галина','Валентина','Алина',
    'Дарья','Ксения','Полина','Маргарита','Виктория','Валерия','Кристина','Диана',
    'Елизавета','Жанна','Зинаида','Инна','Лариса','Лидия','Нина','Оксана',
    'Регина','Римма','Тамара','Эльвира','Яна','Карина','Милана','Александра'
]);

// ─── Правила феминизации фамилий ─────────────────────────────────────────────
// Мужская фамилия → Женская фамилия
//
// Правила применяются по порядку (первое совпадение побеждает)

const FEMINIZE_RULES = [
    // -ский / -цкий → -ская / -цкая
    { suffix: 'ский', replace: 'ская' },
    { suffix: 'цкий', replace: 'цкая' },
    { suffix: 'жский', replace: 'жская' },
    { suffix: 'дский', replace: 'дская' },
    // -зной / -дной / -ной → -зная / -дная / -ная
    { suffix: 'зной', replace: 'зная' },
    { suffix: 'дной', replace: 'дная' },
    { suffix: 'ной', replace: 'ная' },
    // -ов → -ова, -ев → -ева, -ёв → -ёва
    { suffix: 'ёв', replace: 'ёва' },
    { suffix: 'ев', replace: 'ева' },
    { suffix: 'ов', replace: 'ова' },
    // -ин → -ина, -ын → -ына
    { suffix: 'ын', replace: 'ына' },
    { suffix: 'ин', replace: 'ина' },
    // -ой → -ая (Толстой → Толстая)
    { suffix: 'ой', replace: 'ая' },
];

// ─── Правила мускулинизации (женская → мужская) ───────────────────────────

const MASCULINIZE_RULES = [
    { suffix: 'ская', replace: 'ский' },
    { suffix: 'цкая', replace: 'цкий' },
    { suffix: 'жская', replace: 'жский' },
    { suffix: 'дская', replace: 'дский' },
    { suffix: 'зная', replace: 'зной' },
    { suffix: 'дная', replace: 'дной' },
    { suffix: 'ная', replace: 'ной' },
    { suffix: 'ёва', replace: 'ёв' },
    { suffix: 'ева', replace: 'ев' },
    { suffix: 'ова', replace: 'ов' },
    { suffix: 'ына', replace: 'ын' },
    { suffix: 'ина', replace: 'ин' },
    { suffix: 'ая', replace: 'ой' },
];

// ─── Основной класс ───────────────────────────────────────────────────────────

export class RussianName {

    /**
     * Определяет пол персонажа по имени.
     * @param {string} firstName — имя (напр. "Мария")
     * @returns {'male'|'female'|'unknown'}
     */
    static genderByFirstName(firstName) {
        if (!firstName) return 'unknown';
        const name = firstName.trim();
        if (MALE_FIRST_NAMES.has(name))   return 'male';
        if (FEMALE_FIRST_NAMES.has(name)) return 'female';

        // Если имя не найдено — угадываем по окончанию
        if (name.endsWith('а') || name.endsWith('я') || name.endsWith('ья')) return 'female';
        return 'male'; // по умолчанию
    }

    /**
     * Определяет пол по фамилии (как резервный вариант).
     * @param {string} lastName
     * @returns {'male'|'female'|'unknown'}
     */
    static genderByLastName(lastName) {
        if (!lastName) return 'unknown';
        const ln = lastName.trim().toLowerCase();

        // Женские окончания фамилий
        const femSuffixes = ['ова','ева','ёва','ина','ына','ская','цкая','жская','ная'];
        if (femSuffixes.some(s => ln.endsWith(s))) return 'female';

        // Мужские окончания фамилий
        const maleSuffixes = ['ов','ев','ёв','ин','ын','ский','цкий','жский','ной'];
        if (maleSuffixes.some(s => ln.endsWith(s))) return 'male';

        // Неизменяемые фамилии (на -о, -е, -и, -ко, -ук, -юк и пр.) — не склоняются
        if (ln.endsWith('ко') || ln.endsWith('ук') || ln.endsWith('юк') ||
            ln.endsWith('их') || ln.endsWith('ых') || ln.endsWith('аго') ||
            ln.endsWith('его') || ln.endsWith('ово') || ln.endsWith('ёво')) {
            return 'unknown'; // неизменяемые
        }

        return 'unknown';
    }

    /**
     * Определяет пол по полному имени (Фамилия Имя Отчество).
     * @param {string} fullName
     * @returns {'male'|'female'|'unknown'}
     */
    static genderByFullName(fullName) {
        if (!fullName) return 'unknown';
        const parts = fullName.trim().split(/\s+/);
        // Пробуем по имени (второй элемент)
        if (parts[1]) {
            const byFirst = RussianName.genderByFirstName(parts[1]);
            if (byFirst !== 'unknown') return byFirst;
        }
        // Запасной вариант — по отчеству (третий элемент)
        if (parts[2]) {
            if (parts[2].endsWith('вна') || parts[2].endsWith('чна') ||
                parts[2].endsWith('ична') || parts[2].endsWith('ьна')) return 'female';
            if (parts[2].endsWith('вич') || parts[2].endsWith('ич') ||
                parts[2].endsWith('ович')) return 'male';
        }
        // И по фамилии (первый элемент)
        if (parts[0]) {
            return RussianName.genderByLastName(parts[0]);
        }
        return 'unknown';
    }

    /**
     * Переводит мужскую фамилию в женскую.
     * Козлов → Козлова, Высоцкий → Высоцкая и пр.
     * Неизменяемые фамилии (Шевченко, Лотяну) возвращаются как есть.
     *
     * @param {string} lastName — мужская фамилия
     * @returns {string} — женская форма
     */
    static feminize(lastName) {
        if (!lastName) return lastName;
        for (const rule of FEMINIZE_RULES) {
            if (lastName.toLowerCase().endsWith(rule.suffix)) {
                return lastName.slice(0, -rule.suffix.length) + rule.replace;
            }
        }
        // Неизменяемая — оставляем как есть
        return lastName;
    }

    /**
     * Переводит женскую фамилию в мужскую.
     * Козлова → Козлов, Высоцкая → Высоцкий.
     *
     * @param {string} lastName — женская фамилия
     * @returns {string} — мужская форма
     */
    static masculinize(lastName) {
        if (!lastName) return lastName;
        for (const rule of MASCULINIZE_RULES) {
            if (lastName.toLowerCase().endsWith(rule.suffix)) {
                return lastName.slice(0, -rule.suffix.length) + rule.replace;
            }
        }
        return lastName;
    }

    /**
     * Нормализует фамилию к нужному роду.
     * @param {string} lastName
     * @param {'male'|'female'} gender
     * @returns {string}
     */
    static toGender(lastName, gender) {
        if (gender === 'female') {
            // Если уже женская — оставляем
            const currentGender = RussianName.genderByLastName(lastName);
            if (currentGender === 'female') return lastName;
            return RussianName.feminize(lastName);
        }
        if (gender === 'male') {
            const currentGender = RussianName.genderByLastName(lastName);
            if (currentGender === 'male') return lastName;
            return RussianName.masculinize(lastName);
        }
        return lastName;
    }

    /**
     * Формирует полное имя с правильной фамилией для рода.
     *
     * @param {string} firstName — имя
     * @param {string} patronymic — отчество
     * @param {string} lastNameBase — фамилия (любого рода)
     * @param {'male'|'female'} gender
     * @returns {string} — "Фамилия Имя Отчество"
     */
    static buildFullName(firstName, patronymic, lastNameBase, gender) {
        const lastName = RussianName.toGender(lastNameBase, gender);
        return `${lastName} ${firstName} ${patronymic}`;
    }

    /**
     * Проверяет, является ли имя женским.
     * @param {string} firstName
     * @returns {boolean}
     */
    static isFemale(firstName) {
        return RussianName.genderByFirstName(firstName) === 'female';
    }

    /**
     * Проверяет, является ли имя мужским.
     * @param {string} firstName
     * @returns {boolean}
     */
    static isMale(firstName) {
        return RussianName.genderByFirstName(firstName) === 'male';
    }
}
