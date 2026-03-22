/**
 * MainMenuView — Управление стартовым Главным Меню.
 * Скрывает интерфейс игры до того момента, пока игрок не выберет "Новая игра" или "Продолжить".
 */
export class MainMenuView {
    
    /**
     * @param {import('../main.js').App} app Ссылка на главное приложение
     */
    static init(app) {
        this.app = app;
        
        // Кэшируем элементы DOM
        this.dom = {
            overlay: document.getElementById('main-menu'),
            appContainer: document.getElementById('app'),
            btnNew: document.getElementById('btn-new-game'),
            btnContinue: document.getElementById('btn-continue-game'),
            btnHelp: document.getElementById('btn-help'),
            btnExit: document.getElementById('btn-exit')
        };

        if (!this.dom.overlay) return; // Защита, если меню вырезано из HTML

        this._setupListeners();
        this._updateContinueButton();
        this.show();
    }

    static _setupListeners() {
        this.dom.btnNew.addEventListener('click', () => {
            // Сбрасываем прогресс карьеры, но очищаем историю полностью 
            // (или можно оставить ачивки: keepAchievements: true)
            this.app.career.reset({ keepAchievements: true });
            
            // Сбрасываем и сохраняем прогресс дел CaseManager
            if (this.app.career.data) {
                this.app.career.data.completedCases = {};
                this.app.career.data.usedProfiles = [];
                this.app.career._persist();
            }

            this._playIntroVideo(() => {
                this.hide();
                this.app.startNewGame();
            });
        });

        this.dom.btnContinue.addEventListener('click', () => {
            if (this.dom.btnContinue.disabled) return;
            this.hide();
            this.app.startNewGame(); // Загружает новое дело для существующего ранга/статистики
        });

        this.dom.btnHelp.addEventListener('click', () => {
            this._showHelp();
        });

        this.dom.btnExit.addEventListener('click', () => {
            // В браузере window.close() может не сработать, если вкладка не была открыта скриптом
            // Поэтому показываем экран "Смена завершена"
            this.dom.overlay.innerHTML = `
                <div style="text-align:center; color:#fff; animation: fadeIn 1s forwards">
                    <h1 style="font-size:3rem; margin-bottom:10px">Смена завершена.</h1>
                    <p style="color:#94a3b8">Вы можете закрыть вкладку браузера.</p>
                </div>
            `;
            setTimeout(() => { window.close(); }, 2000);
        });
    }

    static _updateContinueButton() {
        // Проверяем наличие пройденных дел
        const casesCount = this.app.career.getCompletedCasesCount();
        const score = this.app.career.getScore();
        
        if (casesCount > 0 || score > 0) {
            this.dom.btnContinue.disabled = false;
            this.dom.btnContinue.textContent = `Продолжить процесс (Дел: ${casesCount})`;
        } else {
            this.dom.btnContinue.disabled = true;
            this.dom.btnContinue.textContent = `Продолжить процесс (Нет сохранений)`;
        }
    }

    static _playIntroVideo(onComplete) {
        const videoContainer = document.createElement('div');
        videoContainer.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #000; z-index: 20000; display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.5s ease;
        `;
        
        const video = document.createElement('video');
        video.src = 'data/video/Video.mp4';
        video.autoplay = true;
        video.controls = false;
        video.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        
        const skipBtn = document.createElement('button');
        skipBtn.textContent = 'Пропустить (Enter)';
        skipBtn.style.cssText = `
            position: absolute; bottom: 30px; right: 30px;
            padding: 10px 20px; background: rgba(0,0,0,0.5); color: #fff;
            border: 1px solid #fff; border-radius: 4px; cursor: pointer;
            font-family: inherit; font-size: 14px; opacity: 0.7; transition: opacity 0.2s;
            backdrop-filter: blur(4px);
        `;
        skipBtn.onmouseover = () => skipBtn.style.opacity = '1';
        skipBtn.onmouseout = () => skipBtn.style.opacity = '0.7';

        videoContainer.appendChild(video);
        videoContainer.appendChild(skipBtn);
        document.body.appendChild(videoContainer);

        // Плавное появление
        requestAnimationFrame(() => {
            videoContainer.style.opacity = '1';
        });

        const finish = () => {
            if (finish.done) return;
            finish.done = true;
            document.removeEventListener('keydown', keydownHandler);
            videoContainer.style.opacity = '0';
            setTimeout(() => {
                videoContainer.remove();
                onComplete();
            }, 500);
        };

        const keydownHandler = (e) => {
            if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') finish();
        };

        video.addEventListener('ended', finish);
        skipBtn.addEventListener('click', finish);
        document.addEventListener('keydown', keydownHandler);
        
        video.play().catch(e => {
            console.warn("[MainMenuView] Автовоспроизведение заблокировано браузером.", e);
            finish();
        });
    }

    static _showHelp() {
        const helpOverlay = document.createElement('div');
        helpOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center;
            z-index: 10000; opacity: 0; transition: opacity 0.3s ease;
        `;
        
        helpOverlay.innerHTML = `
            <div style="background: #1e293b; color: #f8fafc; padding: 2rem; border-radius: 8px; max-width: 900px; width: 95%; max-height: 85vh; overflow-y: auto; overflow-x: hidden; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); transform: translateY(20px); transition: transform 0.3s ease;">
                <h2 style="margin-top: 0; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 1rem; position: sticky; top: -2rem; background: #1e293b; z-index: 10;">
                    <span style="font-size:1.5rem">📜</span> Настольная книга Федерального Судьи
                </h2>
                
                <div style="text-align:left; font-size:14px; line-height:1.6; margin: 1.5rem 0;">
                    
                    <div style="background: rgba(56, 189, 248, 0.1); border-left: 4px solid #38bdf8; padding: 15px; margin-bottom: 25px; border-radius: 0 4px 4px 0;">
                        <b>Главная задача:</b> Вы — независимый арбитр. Следствие (обвинение) и защита предоставляют вам факты. Ваша цель — отфильтровать ложь от истины, найти противоречия и вынести приговор (Осудить или Оправдать). Ошибка стоит вам репутации.
                    </div>

                    <h3 style="color:#e2e8f0; border-bottom: 1px solid #475569; padding-bottom:8px; margin-top:25px; font-size:18px;">1. Работа с Уликами и Экспертизой</h3>
                    <ul style="padding-left:20px; margin-bottom: 20px;">
                        <li style="margin-bottom:10px"><b>Типы улик:</b> Физические (орудия), Биологические (ДНК, кровь), Цифровые (телефоны, ПК) и Документальные (договоры, протоколы).</li>
                        <li style="margin-bottom:10px"><b>Тесты лаборатории:</b> Не верьте улике сразу! Нажимайте кнопки тестов под ней. Лаборатория выдаст отчет. Но помните, тесты могут дать сбой или быть сфабрикованы следователем.</li>
                        <li style="margin-bottom:10px"><b>Независимые эксперты:</b> Если сомневаетесь в штатной лаборатории МВД — воспользуйтесь ноутбуком в разделе "Кабинет" и наймите частного эксперта (психиатра, баллистика, хакера). Эксперт может полностью опровергнуть исходные данные следствия!</li>
                    </ul>

                    <h3 style="color:#e2e8f0; border-bottom: 1px solid #475569; padding-bottom:8px; margin-top:25px; font-size:18px;">2. Допросы свидетелей и подозреваемых</h3>
                    <ul style="padding-left:20px; margin-bottom: 20px;">
                        <li style="margin-bottom:10px"><b>Психология (Раппорт и Стресс):</b> Люди разные. Хладнокровный лжец не сломается от базовых вопросов, а истерик замкнется при агрессивном давлении. Чередуйте вопросы, чтобы усыпить бдительность (повысить Раппорт) или наоборот — вогнать в страх.</li>
                        <li style="margin-bottom:10px"><b>Состояние "Сломлен" (Fractured):</b> Если индикатор психологического состояния довести до красной зоны (психологический срыв), свидетель может совершить роковую ошибку в показаниях или дать чистосердечное признание.</li>
                        <li style="margin-bottom:10px"><b>Извлечение Протоколов:</b> Под каждым ответом на допросе есть кнопки <b>✅ За обвинение</b> и <b>❌ За защиту</b>. Нажмите их, чтобы превратить сказанную фразу свидетеля в официальную Улику! Извлеченная фраза появится во всех вкладках, включая "Сравнение".</li>
                    </ul>

                    <h3 style="color:#e2e8f0; border-bottom: 1px solid #475569; padding-bottom:8px; margin-top:25px; font-size:18px;">3. Поиск Лжи: Сравнение и Алиби</h3>
                    <ul style="padding-left:20px; margin-bottom: 20px;">
                        <li style="margin-bottom:10px"><b>⚖️ Механика Сравнения:</b> В суде часто лгут! Зайдите во вкладку "Сравнение", выберите две разные улики (например, "Извлеченный протокол допроса" и "Тест геолокации"). Если база данных найдет, что они противоречат друг другу — нажмите кнопку. Ложная улика тут же потеряет свой вес, что спасет от тюрьмы невиновного!</li>
                        <li style="margin-bottom:10px"><b>🕒 Механика Алиби:</b> Подозреваемый может заявить, что его не было на месте преступления. Во вкладке "Алиби" вы можете поручить пробить его телефон по сотовым вышкам, проверить камеры наблюдения или опросить поручителей пошагово. Алиби можно как официально Подтвердить (почти 100% невиновность), так и Разрушить.</li>
                    </ul>

                    <h3 style="color:#e2e8f0; border-bottom: 1px solid #475569; padding-bottom:8px; margin-top:25px; font-size:18px;">4. Искусственный интеллект присяжных (Jury AI)</h3>
                    <p style="margin-bottom: 20px;">Коллегия присяжных заседателей следит за ходом процесса (верхняя панель). Они автоматически реагируют на найденные вами противоречия, надежность улик (тесты ДНК), подтвержденные алиби и психологический слом свидетелей. Чем прозрачнее ваши доказательства, тем сильнее присяжные будут склоняться к Оправданию или Обвинению. Вы можете пойти против присяжных, но это вызовет колоссальный скандал в СМИ в конце дня.</p>

                    <h3 style="color:#e2e8f0; border-bottom: 1px solid #475569; padding-bottom:8px; margin-top:25px; font-size:18px;">5. Кабинет, Деньги и Репутация</h3>
                    <ul style="padding-left:20px; margin-bottom: 25px;">
                        <li style="margin-bottom:10px"><b>Очки Уважения:</b> За справедливые суды вы получаете уважение. Тратьте его на открытие Пассивных Навыков (перков) в своем ноутбуке: ускорение экспертиз, снижение стресса и т.д.</li>
                        <li style="margin-bottom:10px"><b>Репутация у МВД и Публики:</b> Посадили невиновного? Ждите гневных статей в утренних газетах. Оправдали слишком многих? Полиция начнет присылать вам сфабрикованные дела или саботировать работу. Падение рейтингов до нуля = Квалификационная коллегия лишит вас мантии, и это приведет к Game Over.</li>
                        <li style="margin-bottom:10px"><b>Темная сторона:</b> Вы можете брать взятки на оффшорные зарубежные счета (через отдельную вкладку). Это огромные суммы, но риск быть пойманным ФСБ очень велик!</li>
                    </ul>

                    <p style="margin-top:30px; margin-bottom:15px; text-align:center; color:#94a3b8; font-style: italic; font-size: 16px;">Закон суров, но он закон. Удачи на посту, Ваша Честь.</p>
                </div>
                <button id="btn-close-help" class="menu-btn" style="position: sticky; bottom: -2.1rem; width: 100%; border-color: #38bdf8; color: #38bdf8; background: #0f172a; font-weight: bold; font-size: 16px; padding: 15px; box-shadow: 0 -10px 15px rgba(15, 23, 42, 0.9);">ПРИСТУПИТЬ К ИСПОЛНЕНИЮ ОБЯЗАННОСТЕЙ</button>
            </div>
        `;

        document.body.appendChild(helpOverlay);
        
        // Появление
        requestAnimationFrame(() => {
            helpOverlay.style.opacity = '1';
            helpOverlay.querySelector('div').style.transform = 'translateY(0)';
        });

        // Закрытие
        const closeBtn = helpOverlay.querySelector('#btn-close-help');
        closeBtn.onclick = () => {
            helpOverlay.style.opacity = '0';
            helpOverlay.querySelector('div').style.transform = 'translateY(20px)';
            setTimeout(() => helpOverlay.remove(), 300);
        };
    }

    static show() {
        this._updateContinueButton();
        this.dom.overlay.classList.add('active');
        this.dom.appContainer.style.display = 'none';
    }

    static hide() {
        this.dom.overlay.classList.remove('active');
        // Даем анимации проиграться, затем показываем app
        setTimeout(() => {
            this.dom.overlay.style.display = 'none';
            this.dom.appContainer.style.display = '';
            // Форсируем обновление UI чтобы сбросить артефакты дисплея
            window.dispatchEvent(new Event('resize')); 
        }, 800);
    }
}
