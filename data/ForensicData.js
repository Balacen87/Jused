/**
 * ForensicData.js — максимально расширенный каталог улик и экспертиз
 * Группировка: по типу преступления, с контекстными descFn
 */

// ─── Справочник экспертиз ────────────────────────────────────────────────────
export const ForensicTests = {
    fingerprint_test:     { name: 'Дактилоскопия',               time: 1, cost: 50,   reliability: 0.87 },
    dna_test:             { name: 'ДНК-анализ',                   time: 3, cost: 250,  reliability: 0.99 },
    ballistic_test:       { name: 'Баллистическая экспертиза',    time: 2, cost: 130,  reliability: 0.91 },
    toxicology_test:      { name: 'Токсикология / яды',           time: 3, cost: 180,  reliability: 0.93 },
    handwriting_analysis: { name: 'Почерковедческая экспертиза',  time: 2, cost: 85,   reliability: 0.78 },
    metadata_analysis:    { name: 'Анализ цифровых метаданных',   time: 1, cost: 45,   reliability: 0.96 },
    image_authentication: { name: 'Видеотехническая экспертиза',  time: 3, cost: 320,  reliability: 0.82 },
    document_forgery:     { name: 'Экспертиза подлинности документа', time: 2, cost: 110, reliability: 0.89 },
    voiceprint_analysis:  { name: 'Фоноскопическая экспертиза',   time: 2, cost: 200,  reliability: 0.76 },
    odor_analysis:        { name: 'Химическая идентификация следов', time: 2, cost: 150, reliability: 0.80 },
    explosives_trace:     { name: 'Трасология взрывчатых веществ', time: 3, cost: 400,  reliability: 0.88 },
    network_forensics:    { name: 'Компьютерно-сетевая экспертиза', time: 3, cost: 350,  reliability: 0.92 },
    drug_test:            { name: 'Химический анализ (наркотики)', time: 1, cost: 60,   reliability: 0.97 },
    fiber_analysis:       { name: 'Трасологическая экспертиза волокон', time: 2, cost: 90, reliability: 0.72 },
    gps_tracking:         { name: 'Анализ GPS / геолокации',      time: 1, cost: 30,   reliability: 0.94 },
};

// ─── Пул улик по типу преступления ──────────────────────────────────────────
export const EvidenceBycrimeType = {

    // ════════════════════════════════════════════════════════════════════════
    homicide: [
        {
            id: 'murder_weapon', type: 'physical', label: 'Орудие убийства',
            descFn: (v, s) => `${s.method?.includes('Огнестрел') ? 'Пистолет кал. 9 мм' : 'Тупой металлический предмет'}, найденный в 2 м от места гибели ${v.victimName} в ${v.location}. Следы крови совпадают с группой жертвы.`,
            validTests: ['fingerprint_test', 'dna_test', 'ballistic_test', 'fiber_analysis'],
            reliabilityBase: 0.87
        },
        {
            id: 'blood_stain', type: 'biological', label: 'Следы крови',
            descFn: (v, s) => `Пятна биологической жидкости группы II (B) Rh+, установленной в ${v.location}. Зона рассеивания указывает на место основного события.`,
            validTests: ['dna_test', 'toxicology_test'],
            reliabilityBase: 0.94
        },
        {
            id: 'cctv_murder', type: 'digital', label: 'Запись с камеры наблюдения',
            descFn: (v, s) => `Видеозапись входа в ${v.location} от ${v.timeFrom}. Лицо фигуранта ${s.isGuilty ? 'частично совпадает с внешностью подсудимого: рост, телосложение, куртка' : 'не соответствует подсудимому — иная комплекция и походка'}.`,
            validTests: ['image_authentication', 'metadata_analysis'],
            reliabilityBase: 0.76
        },
        {
            id: 'autopsy_report', type: 'expertise', label: 'Акт судебно-медицинского вскрытия',
            descFn: (v, s) => `Смерть ${v.victimName} наступила в период ${v.timeFrom}–${v.timeTo}. Причина: ${s.method}. В крови ${Math.random() > 0.5 ? 'обнаружен этанол (1.8 промилле)' : 'посторонних веществ не выявлено'}.`,
            validTests: ['toxicology_test'],
            reliabilityBase: 0.98
        },
        {
            id: 'shoe_print', type: 'physical', label: 'Отпечаток обуви',
            descFn: (v, s) => `Чёткий след подошвы размера 42, зафиксированный в ${v.location}. Рисунок протектора характерен для марки «Speeder Urban». ${s.isGuilty ? 'Аналогичная обувь обнаружена у подсудимого.' : 'Обувь подсудимого не совпадает.'}`,
            validTests: ['fiber_analysis', 'dna_test'],
            reliabilityBase: 0.81
        },
        {
            id: 'witness_call_murder', type: 'digital', label: 'Запись звонка в 112',
            descFn: (v, s) => `Аудиозапись вызова скорой помощи. ${s.isGuilty ? 'Голос звонящего совпадает с образцом речи подсудимого.' : 'Голос принадлежит неустановленному лицу.'}`,
            validTests: ['voiceprint_analysis'],
            reliabilityBase: 0.78
        }
    ],

    // ════════════════════════════════════════════════════════════════════════
    fraud: [
        {
            id: 'fake_contract', type: 'document', label: 'Подозрительный договор',
            descFn: (v, s) => `Договор займа между физлицом и ${v.orgName} на сумму ${v.amount} тыс. руб. Дата подписания предшествует регистрации фирмы — юридически невозможно.`,
            validTests: ['handwriting_analysis', 'document_forgery'],
            reliabilityBase: 0.84
        },
        {
            id: 'bank_transfer', type: 'digital', label: 'Электронная выписка банка',
            descFn: (v, s) => `Подтверждённый перевод ${v.amount} тыс. руб. со счёта ${v.orgName} на анонимный расчётный счёт. ${s.isGuilty ? 'IP транзакции совпадает с рабочим местом подсудимого.' : 'Транзакция инициирована с зарубежного IP.'}`,
            validTests: ['metadata_analysis', 'network_forensics'],
            reliabilityBase: 0.93
        },
        {
            id: 'email_log', type: 'digital', label: 'Корпоративная переписка',
            descFn: (v, s) => `Письма с ящика ${v.orgName} за 3 месяца. ${s.isGuilty ? 'В переписке — прямые инструкции по фиктивным платежам, отправитель — подсудимый.' : 'Переписка указывает на другого сотрудника. Подсудимый в копии лишь формально.'}`,
            validTests: ['metadata_analysis', 'image_authentication'],
            reliabilityBase: 0.82
        },
        {
            id: 'accounting_doc', type: 'document', label: 'Бухгалтерские регистры',
            descFn: (v, s) => `Книги ${v.orgName} за отчётный период: задокументированное расхождение ${v.amount} тыс. руб. Подпись главного бухгалтера присутствует во всех спорных проводках.`,
            validTests: ['handwriting_analysis', 'document_forgery'],
            reliabilityBase: 0.89
        },
        {
            id: 'fake_seal', type: 'physical', label: 'Поддельная печать организации',
            descFn: (v, s) => `Резиновый штамп с реквизитами ${v.orgName}, обнаруженный при обыске. Оттиск совпадает с печатью на спорных документах.`,
            validTests: ['fingerprint_test', 'document_forgery'],
            reliabilityBase: 0.88
        },
        {
            id: 'crypto_wallet', type: 'digital', label: 'Криптовалютный кошелёк',
            descFn: (v, s) => `Данные кошелька, зафиксированного следствием: ${v.amount} тыс. руб. в эквиваленте. ${s.isGuilty ? 'Адрес привязан к устройству подсудимого.' : 'Владелец кошелька — третье лицо.'}`,
            validTests: ['network_forensics', 'metadata_analysis'],
            reliabilityBase: 0.85
        }
    ],

    // ════════════════════════════════════════════════════════════════════════
    theft: [
        {
            id: 'fingerprints', type: 'physical', label: 'Отпечатки пальцев',
            descFn: (v, s) => `Дактилограмма с поверхностей в ${v.location}: 4 полных отпечатка, 3 частичных. Качество достаточно для сравнительного анализа.`,
            validTests: ['fingerprint_test'],
            reliabilityBase: 0.89
        },
        {
            id: 'entry_marks', type: 'physical', label: 'Следы взлома',
            descFn: (v, s) => `Повреждения замка и дверного косяка в ${v.location}: характерные царапины от фомки. Угол воздействия указывает на правшу.`,
            validTests: ['fingerprint_test', 'dna_test', 'fiber_analysis'],
            reliabilityBase: 0.83
        },
        {
            id: 'cctv_theft', type: 'digital', label: 'Запись уличной камеры',
            descFn: (v, s) => `Запись у ${v.location}: ${v.timeFrom}–${v.timeTo}. ${s.isGuilty ? 'Фигурант в куртке подсудимого, лицо видно на 3 кадрах.' : 'Человек в маске; по росту и комплекции не совпадает с подсудимым.'}`,
            validTests: ['image_authentication', 'metadata_analysis'],
            reliabilityBase: 0.71
        },
        {
            id: 'pawn_receipt', type: 'document', label: 'Квитанция из ломбарда',
            descFn: (v, s) => `Квитанция ломбарда «Золотой ключ» на похожие ценности (сдано на следующие сутки после кражи). ${s.isGuilty ? 'Паспортные данные клиента совпадают с подсудимым.' : 'Сдало посторонее лицо — данные проверяются.'}`,
            validTests: ['handwriting_analysis', 'image_authentication'],
            reliabilityBase: 0.80
        },
        {
            id: 'trace_soil', type: 'physical', label: 'Следы почвы / грунта',
            descFn: (v, s) => `Образцы грунта, изъятые с места кражи. Уникальный состав — смесь строительной пыли и чернозёма. ${s.isGuilty ? 'Аналогичный состав найден на обуви подсудимого.' : 'Грунт не совпадает с почвой по месту жительства подсудимого.'}`,
            validTests: ['fiber_analysis', 'dna_test'],
            reliabilityBase: 0.74
        },
        {
            id: 'cell_tower', type: 'digital', label: 'Данные от оператора связи',
            descFn: (v, s) => `Детализация местоположения телефона: ${s.isGuilty ? `устройство подсудимого фиксировалось в ${v.location} в ${v.timeFrom}.` : `телефон подсудимого находился в другом районе в указанное время.`}`,
            validTests: ['metadata_analysis', 'gps_tracking'],
            reliabilityBase: 0.91
        }
    ],

    // ════════════════════════════════════════════════════════════════════════
    extortion: [
        {
            id: 'threat_letter', type: 'document', label: 'Угрожающее письмо',
            descFn: (v, s) => `Анонимное письмо, поступившее ${v.victimName}: «Выплати ${v.amount} тыс. или узнаешь». Напечатано на стандартной бумаге А4.`,
            validTests: ['document_forgery', 'fingerprint_test', 'fiber_analysis'],
            reliabilityBase: 0.76
        },
        {
            id: 'phone_records', type: 'digital', label: 'Детализация звонков',
            descFn: (v, s) => `Входящие на номер ${v.victimName} за 2 месяца. ${s.isGuilty ? '11 звонков с SIM на чужое имя — куплена вблизи места жительства подсудимого.' : 'Звонки с 4 разных номеров — возможна группа соучастников.'}`,
            validTests: ['metadata_analysis', 'gps_tracking'],
            reliabilityBase: 0.86
        },
        {
            id: 'victim_statement_ev', type: 'document', label: 'Письменные показания потерпевшего',
            descFn: (v, s) => `Нотариально заверенные показания ${v.victimName} с хронологией угроз. Дни совпадают с пересечениями с подсудимым по камерам.`,
            validTests: ['handwriting_analysis', 'document_forgery'],
            reliabilityBase: 0.71
        },
        {
            id: 'audio_threat', type: 'digital', label: 'Аудиозапись угрозы',
            descFn: (v, s) => `Запись голосового сообщения, переданного ${v.victimName}. ${s.isGuilty ? 'Фоноскопическая экспертиза совпала с образцом речи подсудимого на 81%.' : 'Голос принадлежит неопознанному лицу.'}`,
            validTests: ['voiceprint_analysis', 'metadata_analysis'],
            reliabilityBase: 0.79
        },
        {
            id: 'compromat_usb', type: 'digital', label: 'USB-накопитель с компроматом',
            descFn: (v, s) => `Флеш-носитель с конфиденциальными данными ${v.victimName}. ${s.isGuilty ? 'Метаданные файлов указывают на компьютер подсудимого.' : 'Данные скомпилированы внешним лицом.'}`,
            validTests: ['network_forensics', 'fingerprint_test', 'metadata_analysis'],
            reliabilityBase: 0.82
        }
    ],

    // ════════════════════════════════════════════════════════════════════════
    assault: [
        {
            id: 'victim_injuries', type: 'expertise', label: 'Медицинское заключение',
            descFn: (v, s) => `Акт судебно-медицинского освидетельствования ${v.victimName}: ${s.method}. Зафиксированы гематомы, ссадины, ${Math.random() > 0.5 ? 'перелом лучевой кости' : 'сотрясение мозга'}.`,
            validTests: ['toxicology_test', 'dna_test'],
            reliabilityBase: 0.97
        },
        {
            id: 'dna_assault', type: 'biological', label: 'Биоматериал с коже жертвы',
            descFn: (v, s) => `Образцы под ногтями и сколы кожи с рук ${v.victimName}. ${s.isGuilty ? 'ДНК-профиль с вероятностью 99.9% принадлежит подсудимому.' : 'Профиль ДНК — неустановленное лицо.'}`,
            validTests: ['dna_test'],
            reliabilityBase: 0.93
        },
        {
            id: 'witness_photo', type: 'digital', label: 'Фото с телефона очевидца',
            descFn: (v, s) => `Снимки с разрешением 12 Мп, сделанные свидетелем в ${v.location}. Геотег совпадает с местом преступления. Лицо нападавшего ${s.isGuilty ? 'видно на 2 кадрах чётко' : 'не просматривается — капюшон закрыт'}.`,
            validTests: ['image_authentication', 'metadata_analysis'],
            reliabilityBase: 0.78
        },
        {
            id: 'weapon_assault', type: 'physical', label: 'Орудие нападения',
            descFn: (v, s) => `Металлическая труба / нож, изъятый в ${v.location}. Следы крови на предмете.`,
            validTests: ['dna_test', 'fingerprint_test', 'fiber_analysis'],
            reliabilityBase: 0.85
        },
        {
            id: 'cctv_assault', type: 'digital', label: 'Запись с уличной камеры',
            descFn: (v, s) => `Видео с камеры у ${v.location}: нападение фиксируется целиком. ${s.isGuilty ? 'Лицо, внешность и одежда совпадают с подсудимым.' : 'Нападавший — другой человек, комплекция иная.'}`,
            validTests: ['image_authentication'],
            reliabilityBase: 0.80
        }
    ],

    // ════════════════════════════════════════════════════════════════════════
    corruption: [
        {
            id: 'bribe_money', type: 'physical', label: 'Меченые купюры',
            descFn: (v, s) => `Банкноты на ${v.amount} тыс. руб., обработанные ОПП в ходе ОРМ. ${s.isGuilty ? 'Флуоресцентный состав обнаружен на ладонях и одежде подсудимого.' : 'Купюры обнаружены в кабинете другого должностного лица.'}`,
            validTests: ['fingerprint_test', 'dna_test', 'odor_analysis'],
            reliabilityBase: 0.92
        },
        {
            id: 'service_record', type: 'document', label: 'Журнал служебных решений',
            descFn: (v, s) => `Официальные приказы ${v.orgName}: подписи на ускоренных разрешениях совпадают с датами предполагаемых взяток. 7 решений вынесено вне очереди.`,
            validTests: ['handwriting_analysis', 'document_forgery'],
            reliabilityBase: 0.85
        },
        {
            id: 'surveillance_audio', type: 'digital', label: 'Оперативная аудиозапись',
            descFn: (v, s) => `Запись переговоров в кабинете ${v.orgName}. ${s.isGuilty ? 'Слышна фраза: «Вот касса — не светись». Голос идентифицирован.' : 'Запись повреждена: помехи 40%, смысл неразличим.'}`,
            validTests: ['voiceprint_analysis', 'metadata_analysis'],
            reliabilityBase: 0.83
        },
        {
            id: 'bank_wire_corruption', type: 'digital', label: 'Банковская транзакция (посредник)',
            descFn: (v, s) => `Перевод ${v.amount} тыс. руб. через счёт подставной фирмы. ${s.isGuilty ? 'Конечный бенефициар — родственник подсудимого.' : 'Бенефициар — юридически не связан с подсудимым.'}`,
            validTests: ['metadata_analysis', 'network_forensics'],
            reliabilityBase: 0.88
        },
        {
            id: 'secret_phone', type: 'physical', label: 'Второй телефон (нелегальный)',
            descFn: (v, s) => `Устройство, обнаруженное при обыске. SIM не зарегистрирована. История звонков содержит контакты с коммерческими структурами в период оказания «услуг».`,
            validTests: ['metadata_analysis', 'gps_tracking', 'network_forensics'],
            reliabilityBase: 0.87
        }
    ],

    // ════════════════════════════════════════════════════════════════════════
    narcotics: [
        {
            id: 'drug_package', type: 'physical', label: 'Изъятое наркотическое вещество',
            descFn: (v, s) => `Полиэтиленовый свёрток с веществом белого цвета (${v.amount} г), обнаруженный в ${v.location}. Предварительно: синтетический наркотик группы катинонов.`,
            validTests: ['drug_test', 'fingerprint_test', 'dna_test'],
            reliabilityBase: 0.95
        },
        {
            id: 'scales_drug', type: 'physical', label: 'Ювелирные весы и расфасовка',
            descFn: (v, s) => `Электронные весы, полиэтиленовые пакеты, скотч — атрибуты сбытчика. ${s.isGuilty ? 'Следы наркотика зафиксированы на руках подсудимого.' : 'Весы принадлежат другому лицу.'}`,
            validTests: ['drug_test', 'fingerprint_test', 'odor_analysis'],
            reliabilityBase: 0.89
        },
        {
            id: 'chat_drug', type: 'digital', label: 'Переписка в мессенджере',
            descFn: (v, s) => `Зашифрованные чаты, расшифрованные технической экспертурой. ${s.isGuilty ? 'Прямые договорённости о передаче закладки с адресом.' : 'Переписка носит двойственный характер, сленговые слова разъяснению не поддаются.'}`,
            validTests: ['network_forensics', 'metadata_analysis'],
            reliabilityBase: 0.83
        },
        {
            id: 'cache_location', type: 'digital', label: 'GPS-трек закладки',
            descFn: (v, s) => `Геолокация телефона подсудимого фиксирует остановку точно у места закладки в ${v.timeFrom}. Отклонение: 4 метра.`,
            validTests: ['gps_tracking', 'metadata_analysis'],
            reliabilityBase: 0.91
        }
    ],

    // ════════════════════════════════════════════════════════════════════════
    cybercrime: [
        {
            id: 'malware_file', type: 'digital', label: 'Вредоносный файл (образец)',
            descFn: (v, s) => `Исполняемый файл, изъятый с сервера жертвы: шифровальщик «LockByte v3». ${s.isGuilty ? 'Сигнатура компилятора совпадает с инструментарием с ноутбука подсудимого.' : 'Исходники разосланы по даркнету — автор не установлен.'}`,
            validTests: ['network_forensics', 'metadata_analysis'],
            reliabilityBase: 0.88
        },
        {
            id: 'access_log', type: 'digital', label: 'Логи несанкционированного доступа',
            descFn: (v, s) => `Серверные журналы ${v.orgName}: проникновение с IP ${s.isGuilty ? 'зарегистрированного на подсудимого через VPN-цепочку' : 'из-за рубежа — Нидерланды, цепочка анонимного VPN'}.`,
            validTests: ['network_forensics', 'metadata_analysis'],
            reliabilityBase: 0.90
        },
        {
            id: 'hacker_laptop', type: 'physical', label: 'Ноутбук с инструментарием',
            descFn: (v, s) => `Устройство, изъятое при обыске. Установлены: Metasploit, Cobalt Strike, инструменты снятия паролей. ${s.isGuilty ? 'История браузера ведёт на форумы продавцов дампов.' : 'Ноутбук принадлежит третьему лицу.'}`,
            validTests: ['network_forensics', 'fingerprint_test', 'metadata_analysis'],
            reliabilityBase: 0.86
        },
        {
            id: 'ransom_payment', type: 'digital', label: 'Криптотранзакция выкупа',
            descFn: (v, s) => `Перевод ${v.amount} тыс. руб. в BTC-эквиваленте на кошелёк вымогателя. ${s.isGuilty ? 'Кошелёк выводил средства на биржу с верифицированным аккаунтом подсудимого.' : 'Кошелёк — миксер, конечный бенефициар не идентифицирован.'}`,
            validTests: ['network_forensics', 'metadata_analysis'],
            reliabilityBase: 0.83
        }
    ],

    // ════════════════════════════════════════════════════════════════════════
    espionage: [
        {
            id: 'classified_docs', type: 'document', label: 'Секретные документы',
            descFn: (v, s) => `Пакет материалов гриф «СС», найденный вне защищённого периметра. ${s.isGuilty ? 'Последний, кто запрашивал файлы — подсудимый (авторизация 14:32).' : 'Документы скопированы неустановленным сотрудником.'}`,
            validTests: ['fingerprint_test', 'document_forgery', 'metadata_analysis'],
            reliabilityBase: 0.86
        },
        {
            id: 'dead_drop', type: 'physical', label: 'Контейнер тайника',
            descFn: (v, s) => `Капсула из нержавеющей стали, обнаруженная в условленном месте. Внутри — микрокарта с данными. ${s.isGuilty ? 'Отпечатки подсудимого на внешней поверхности.' : 'Отпечатки принадлежат другому лицу.'}`,
            validTests: ['fingerprint_test', 'dna_test', 'metadata_analysis'],
            reliabilityBase: 0.84
        },
        {
            id: 'encrypted_comms', type: 'digital', label: 'Зашифрованная переписка',
            descFn: (v, s) => `Данные с зашифрованного канала связи. После взлома: обмен картами объектов и списками сотрудников. ${s.isGuilty ? 'Ключ шифрования совпадает с устройством подсудимого.' : 'Ключ принадлежит неидентифицированному лицу.'}`,
            validTests: ['network_forensics', 'metadata_analysis'],
            reliabilityBase: 0.81
        }
    ],

    // ════════════════════════════════════════════════════════════════════════
    terrorism: [
        {
            id: 'explosive_device', type: 'physical', label: 'Компоненты взрывного устройства',
            descFn: (v, s) => `Фрагменты самодельного ВУ, изъятые в ${v.location}. Тротиловый эквивалент — 400 г. Сборка кустарная.`,
            validTests: ['explosives_trace', 'fingerprint_test', 'dna_test'],
            reliabilityBase: 0.91
        },
        {
            id: 'manifesto', type: 'document', label: 'Манифест / призывы',
            descFn: (v, s) => `Текст, опубликованный в мессенджере за 20 минут до инцидента. ${s.isGuilty ? 'Стилометрический анализ совпадает с текстами подсудимого.' : 'Авторство установить не удалось.'}`,
            validTests: ['handwriting_analysis', 'metadata_analysis', 'network_forensics'],
            reliabilityBase: 0.79
        },
        {
            id: 'surveillance_terror', type: 'digital', label: 'Запись оперативного видеонаблюдения',
            descFn: (v, s) => `Видео с объекта за 3 дня до теракта: рекогносцировка местности. ${s.isGuilty ? 'Лицо идентифицировано как подсудимый (80% совпадение).' : 'Лицо принадлежит неустановленному лицу.'}`,
            validTests: ['image_authentication', 'metadata_analysis'],
            reliabilityBase: 0.80
        },
        {
            id: 'purchase_receipt', type: 'document', label: 'Чек на компоненты ВУ',
            descFn: (v, s) => `Кассовые чеки на химические реагенты, проволоку и аккумуляторы в объёмах, не типичных для бытового использования. ${s.isGuilty ? 'Покупки совершены в районе проживания подсудимого.' : 'Покупки оплачены чужой картой.'}`,
            validTests: ['fingerprint_test', 'image_authentication'],
            reliabilityBase: 0.83
        }
    ]
};
