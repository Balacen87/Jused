/**
 * DetailStrategies.js — Strategy pattern: 15 стратегий генерации деталей экспертиз.
 *
 * Каждая стратегия реализует интерфейс:
 *   generate({ evidence, match, isGuilty, certainty, rng, expert, factors }) → string
 *
 * Расширяемость:
 *   DetailStrategyRegistry.register('custom_test', new CustomStrategy())
 *
 * Ни одна стратегия не знает о других — только о своём типе улики.
 */

// ─── Базовый класс ────────────────────────────────────────────────────────────
class DetailStrategy {
    /**
     * @param {object} ctx
     * @param {object} ctx.evidence      — улика
     * @param {boolean} ctx.match        — результат совпадения
     * @param {boolean} ctx.isGuilty     — истинная виновность
     * @param {Certainty} ctx.certainty  — Value Object
     * @param {SeededRNG} ctx.rng
     * @param {ExpertEntity} ctx.expert
     * @param {object} ctx.factors       — { labError, sampleDegraded, expertError }
     * @returns {string}
     */
    generate(ctx) { throw new Error('generate() must be implemented'); }

    // Вспомогательные методы для подклассов
    _evLabel(ev)  { return ev.label || ev.description || 'объект исследования'; }
    _pct(c)       { return Math.round((c?.value ?? c ?? 0.5) * 100); }
    _ciStr(ci)    { return ci ? ` [ДИ ${Math.round(ci.lo*100)}–${Math.round(ci.hi*100)}%]` : ''; }
    _expertWarn(factors) {
        const w = [];
        if (factors?.labError)       w.push('⚠️ Лабораторная погрешность');
        if (factors?.sampleDegraded) w.push('⚠️ Деградация образца');
        if (factors?.expertError?.label) w.push(`⚠️ ${factors.expertError.label}`);
        return w.length ? '\n' + w.join('. ') + '.' : '';
    }
}

// ─── Стратегии ────────────────────────────────────────────────────────────────

class DNAStrategy extends DetailStrategy {
    generate({ evidence, match, certainty, rng, factors, expert }) {
        const ev    = this._evLabel(evidence);
        const pct   = this._pct(certainty);
        const loci  = rng.int(15, 23);
        const prob  = rng.float(1e11, 9e11, 0).toFixed(0);
        if (match) {
            return `STR-профиль биоматериала с улики «${ev}» совпадает с геномом обвиняемого по ${loci} локусам. Вероятность случайного совпадения: 1:${prob}. Достоверность: ${pct}%.${this._expertWarn(factors)}`;
        }
        const reason = factors?.expertError ? 'Обнаружена контаминация — требуется повторный анализ.' : 'Следы принадлежат третьему неустановленному лицу.';
        return `ДНК-профиль биоматериала с улики «${ev}» НЕ совпадает с геномом обвиняемого. ${reason}${this._expertWarn(factors)}`;
    }
}

class FingerprintStrategy extends DetailStrategy {
    generate({ evidence, match, certainty, rng, factors }) {
        const ev    = this._evLabel(evidence);
        const pct   = this._pct(certainty);
        const fingers = ['указательного','большого','среднего','безымянного'];
        const points  = rng.int(8, 16);
        if (match) {
            return `Папиллярный след совпадает с отпечатком ${rng.choice(fingers)} пальца обвиняемого по ${points} идентификационным точкам. Достоверность: ${pct}%.${this._expertWarn(factors)}`;
        }
        return `Следы на «${ev}» не принадлежат обвиняемому. Совпадение по базовым признакам не установлено.${factors?.sampleDegraded ? ' Следы частично смыты.' : ''}${this._expertWarn(factors)}`;
    }
}

class BallisticStrategy extends DetailStrategy {
    generate({ evidence, match, certainty, rng, factors }) {
        const pct    = this._pct(certainty);
        const serial = rng.int(100000, 999999);
        const points  = rng.int(7, 14);
        if (match) {
            return `Нарезы канала ствола и следы бойка на гильзе совпадают с тестовым образцом оружия обвиняемого (сер. №${serial}) по ${points} признакам. Достоверность: ${pct}%. ⚠️ Субъективный элемент метода: 22%.${this._expertWarn(factors)}`;
        }
        return `Следы оружия НЕ совпадают с предоставленным образцом. Идентификация невозможна.${this._expertWarn(factors)}`;
    }
}

class ToxicologyStrategy extends DetailStrategy {
    generate({ evidence, match, certainty, rng, factors }) {
        const pct = this._pct(certainty);
        const substances = ['этанол (2.1‰)','морфин 0.8 мкг/мл','метамфетамин','барбитураты','цианид калия (летальная доза)'];
        if (match) {
            return `Обнаружено: ${rng.choice(substances)}. Концентрация исключает случайное попадание. Достоверность: ${pct}%.${this._expertWarn(factors)}`;
        }
        return `Посторонних токсических веществ не обнаружено. Алкоголь: ${rng.float(0, 0.4)}‰ (норма). ${this._expertWarn(factors)}`;
    }
}

class HandwritingStrategy extends DetailStrategy {
    generate({ evidence, match, certainty, rng, factors }) {
        const ev  = this._evLabel(evidence);
        const pct = this._pct(certainty);
        const pts = rng.int(12, 20);
        if (match) {
            return `Текст и подпись документа «${ev}» выполнены рукой обвиняемого — совпадение по ${pts} признакам (нажим, наклон, связность). Достоверность: ${pct}%. ⚠️ Ограниченная научная признанность метода (55%).${this._expertWarn(factors)}`;
        }
        return `Документ «${ev}» не является подлинным: признаки имитации (замедление темпа, срисовывание). Исполнитель не установлен. Достоверность: ${pct}%.${this._expertWarn(factors)}`;
    }
}

class MetadataStrategy extends DetailStrategy {
    generate({ evidence, match, certainty, rng, factors }) {
        const pct = this._pct(certainty);
        const mac = Array.from({length:6}, () => rng.int(0,255).toString(16).padStart(2,'0')).join(':');
        const ts  = new Date(Date.now() - rng.int(0, 30) * 864e5).toLocaleString('ru-RU');
        if (match) {
            return `Метаданные файла: создан с устройства обвиняемого (MAC: ${mac}), IP совпадает с адресом регистрации. Временная метка: ${ts}. Достоверность: ${pct}%.${this._expertWarn(factors)}`;
        }
        return `Файл создан с анонимного VPN-провайдера. Прямой связи с устройствами обвиняемого не установлено.${this._expertWarn(factors)}`;
    }
}

class ImageAuthStrategy extends DetailStrategy {
    generate({ evidence, match, certainty, rng, factors }) {
        const pct = this._pct(certainty);
        const ts  = `${rng.int(1,23).toString().padStart(2,'0')}:${rng.int(0,59).toString().padStart(2,'0')}`;
        if (match) {
            return `Видеозапись оригинальная (ELA: PASS). На кадре ${ts} — силуэт с совпадением ростом и телосложением подсудимого. Вероятность идентификации FaceNet: ${pct}%. ⚠️ Технология deepfake создаёт риски false positive.${this._expertWarn(factors)}`;
        }
        return `Выявлены артефакты монтажа: разрыв шумового профиля, несоответствие EXIF-метаданных. Запись признана сомнительной.${this._expertWarn(factors)}`;
    }
}

class DocumentStrategy extends DetailStrategy {
    generate({ evidence, match, certainty, rng, factors }) {
        const ev  = this._evLabel(evidence);
        const pct = this._pct(certainty);
        const yr  = new Date().getFullYear();
        if (match) {
            return `Документ «${ev}» поддельный. Бумага изготовлена ≤${yr-2} г. (анализ целлюлозы), дата документа — ${yr-8} г. Печать — цифровой суррогат. Достоверность: ${pct}%.${this._expertWarn(factors)}`;
        }
        return `Документ «${ev}» подлинный. Бумага, чернила и защита соответствуют заявленному периоду оформления.${this._expertWarn(factors)}`;
    }
}

class VoiceStrategy extends DetailStrategy {
    generate({ match, certainty, rng, factors }) {
        const pct    = this._pct(certainty);
        const params = rng.int(18, 35);
        if (match) {
            return `Голос совпадает по ${params} параметрам (F0, форманты F1–F3, ритм). Достоверность: ${pct}%. ⚠️ Метод признан спорным рядом судебных инстанций.${this._expertWarn(factors)}`;
        }
        return `Голос на записи не принадлежит обвиняемому: расхождение по тональности и формантам. ${this._expertWarn(factors)}`;
    }
}

class OdorStrategy extends DetailStrategy {
    generate({ match, certainty, rng, factors }) {
        const pct      = this._pct(certainty);
        const chems    = ['бензина Аи-95','ацетона','пороховых газов','растворителя нитроэмали'];
        if (match) {
            return `Идентифицированы следы ${rng.choice(chems)} — аналогичные следы зафиксированы на руках и одежде обвиняемого. Достоверность: ${pct}%.${this._expertWarn(factors)}`;
        }
        return `Химический профиль следов не совпадает с образцами, полученными от обвиняемого.${this._expertWarn(factors)}`;
    }
}

class ExplosivesStrategy extends DetailStrategy {
    generate({ match, certainty, rng, factors }) {
        const pct   = this._pct(certainty);
        const types = ['RDX','PETN','TATP','TNT','Семтекс'];
        const ng    = rng.float(0.5, 8.0, 1);
        if (match) {
            return `Обнаружены следы ${rng.choice(types)} — ${ng} нг/мл методом масс-спектрометрии. Совпадение с образцами с места взрыва. Достоверность: ${pct}%.${this._expertWarn(factors)}`;
        }
        return `Следов взрывчатых веществ на обвиняемом и его вещах не обнаружено.${this._expertWarn(factors)}`;
    }
}

class NetworkStrategy extends DetailStrategy {
    generate({ match, certainty, rng, factors }) {
        const pct = this._pct(certainty);
        const ip  = `${rng.int(10,200)}.${rng.int(0,255)}.${rng.int(0,255)}.${rng.int(1,254)}`;
        if (match) {
            return `IP-адрес ${ip} совпадает с домашним соединением обвиняемого. Логи охватывают период совершения преступления. Достоверность: ${pct}%.${this._expertWarn(factors)}`;
        }
        return `Атака инициирована с анонимного TOR-выхода. Прямой связи с оборудованием обвиняемого не установлено.${this._expertWarn(factors)}`;
    }
}

class DrugStrategy extends DetailStrategy {
    generate({ match, certainty, rng, factors }) {
        const pct      = this._pct(certainty);
        const narcotic = ['героин (92%)','метамфетамин (87%)','кокаин (78%)','каннабис (21% ТГК)','MDMA (94%)'];
        const mass     = rng.float(1, 200, 1);
        if (match) {
            return `Вещество: ${rng.choice(narcotic)}, масса нетто ${mass} г. Соответствует признакам ст. 228 УК РФ. Достоверность: ${pct}%.${this._expertWarn(factors)}`;
        }
        const legal = ['сахарная пудра','крахмал','парацетамол','кофеин'];
        return `Вещество не является наркотическим: ${rng.choice(legal)}. Оснований для ст. 228 УК РФ нет.${this._expertWarn(factors)}`;
    }
}

class FiberStrategy extends DetailStrategy {
    generate({ evidence, match, certainty, rng, factors }) {
        const ev  = this._evLabel(evidence);
        const pct = this._pct(certainty);
        const pts = rng.int(5, 9);
        if (match) {
            return `Волокна с улики «${ev}» соответствуют по составу и цвету одежде обвиняемого — совпадение по ${pts} признакам. ⚠️ Индивидуализация невозможна: только класс материала. Достоверность: ${pct}%.${this._expertWarn(factors)}`;
        }
        return `Волокна не совпадают с одеждой обвиняемого ни по составу, ни по красителю.${this._expertWarn(factors)}`;
    }
}

class GPSStrategy extends DetailStrategy {
    generate({ match, certainty, rng, factors }) {
        const pct   = this._pct(certainty);
        const dist  = rng.int(30, 200);
        const times = ['18:42–19:15','21:30–22:05','14:10–14:55','08:20–09:05'];
        const away  = ['Санкт-Петербурге','Казани','другом районе города','пригороде'];
        if (match) {
            return `Геолокация помещает обвиняемого в радиусе ${dist} м от места преступления в период ${rng.choice(times)}. Достоверность: ${pct}%.${this._expertWarn(factors)}`;
        }
        return `Геолокация помещает обвиняемого в ${rng.choice(away)} в указанное время. Алиби подтверждено геоданными.${this._expertWarn(factors)}`;
    }
}

// ─── Реестр стратегий ─────────────────────────────────────────────────────────

export class DetailStrategyRegistry {
    static #map = new Map([
        ['dna_test',             new DNAStrategy()],
        ['fingerprint_test',     new FingerprintStrategy()],
        ['ballistic_test',       new BallisticStrategy()],
        ['toxicology_test',      new ToxicologyStrategy()],
        ['handwriting_analysis', new HandwritingStrategy()],
        ['metadata_analysis',    new MetadataStrategy()],
        ['image_authentication', new ImageAuthStrategy()],
        ['document_forgery',     new DocumentStrategy()],
        ['voiceprint_analysis',  new VoiceStrategy()],
        ['odor_analysis',        new OdorStrategy()],
        ['explosives_trace',     new ExplosivesStrategy()],
        ['network_forensics',    new NetworkStrategy()],
        ['drug_test',            new DrugStrategy()],
        ['fiber_analysis',       new FiberStrategy()],
        ['gps_tracking',         new GPSStrategy()],
    ]);

    /** Получить стратегию по типу. */
    static get(type) {
        return this.#map.get(type) || null;
    }

    /** Генерация деталей — точка входа. Если стратегия не найдена, возвращает заглушку. */
    static generate(type, ctx) {
        const strategy = this.#map.get(type);
        if (!strategy) return `[${type}] Стратегия деталей не найдена.`;
        try { return strategy.generate(ctx); }
        catch (e) { return `[${type}] Ошибка генерации деталей: ${e.message}`; }
    }

    /**
     * Регистрация кастомной стратегии (для модов/расширений).
     * @param {string} type
     * @param {DetailStrategy} strategy
     */
    static register(type, strategy) {
        if (!(strategy instanceof DetailStrategy))
            throw new Error('Стратегия должна наследовать DetailStrategy');
        this.#map.set(type, strategy);
    }

    static get registeredTypes() { return [...this.#map.keys()]; }
}
