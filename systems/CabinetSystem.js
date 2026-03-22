/**
 * CabinetSystem.js
 * 
 * Система, управляющая улучшениями, навыками, перками и механикой 
 * резервного счёта ("Зарубежный счёт") для судьи. Изолирует бизнес-логику
 * от UI (JudgeCabinet).
 */

export const UPGRADES = [
    // ── Навыки (пассивные) ──────────────────────────────────────────────────
    {
        id: 'sharp_eye', category: 'skill',
        icon: '🔍', name: 'Зоркий взгляд',
        desc: 'Ложные улики светятся предупреждением ⚠️ в списке Улик.',
        cost: 120, maxLevel: 1,
        effect: (sys) => { sys.setFlag('sharpEye', true); }
    },
    {
        id: 'memory', category: 'skill',
        icon: '🧠', name: 'Безупречная память',
        desc: 'Показывает краткий конспект подозрительных противоречий в материалах дела.',
        cost: 150, maxLevel: 1,
        effect: (sys) => { sys.setFlag('memory', true); }
    },
    {
        id: 'legal_insight', category: 'skill',
        icon: '📚', name: 'Правовая интуиция',
        desc: 'В таблице «Общие сведения» появляется подсказка: высокая/низкая вероятность виновности.',
        cost: 200, maxLevel: 1,
        effect: (sys) => { sys.setFlag('legalInsight', true); }
    },
    {
        id: 'evidence_sense', category: 'skill',
        icon: '🔎', name: 'Криминалистический нюх',
        desc: 'Показывает базовую надёжность улики без тестов (серым цветом).',
        cost: 180, maxLevel: 1,
        effect: (sys) => { sys.setFlag('evidenceSense', true); }
    },

    // ── Защита (от давления и коррупции) ────────────────────────────────────
    {
        id: 'armor_media', category: 'defense',
        icon: '📰', name: 'Медиаконсультант',
        desc: 'Снижает штраф к репутации «Закон» от негативных разоблачений в прессе на 50%.',
        cost: 100, maxLevel: 2,
        effect: (sys, level) => { sys.setFlag('armorMediaLevel', level); }
    },
    {
        id: 'armor_shadow', category: 'defense',
        icon: '🕶️', name: 'Анонимный щит',
        desc: 'Снижает штраф к репутации «Тени» при отказе от взятки на 50%.',
        cost: 130, maxLevel: 2,
        effect: (sys, level) => { sys.setFlag('armorShadowLevel', level); }
    },
    {
        id: 'safe_deposit', category: 'defense',
        icon: '🏦', name: 'Зарубежный счёт',
        desc: 'Открывает доступ к резервному счёту (до 300 очков) — защищённому от штрафов.',
        cost: 250, maxLevel: 1,
        effect: (sys) => { sys.setFlag('safeDepositUnlocked', true); }
    },

    // ── Перки (разовые) ─────────────────────────────────────────────────────
    {
        id: 'perk_hint', category: 'perk',
        icon: '💡', name: 'Подсказка аналитика',
        desc: 'Подсвечивает один ключевой факт в деле зелёным. Восстанавливается через 2 дела.',
        cost: 50, maxLevel: 3, consumable: true, cooldownCases: 2
    },
    {
        id: 'perk_retest', category: 'perk',
        icon: '🔬', name: 'Срочный повтор теста',
        desc: 'Заказывает повторный анализ улики бесплатно. Восстанавливается через 3 дела.',
        cost: 80, maxLevel: 5, consumable: true, cooldownCases: 3
    },
    {
        id: 'perk_delay', category: 'perk',
        icon: '⏳', name: 'Отсрочка вердикта',
        desc: 'Генерирует дополнительную свидетельскую реплику. Восстанавливается через 2 дела.',
        cost: 70, maxLevel: 3, consumable: true, cooldownCases: 2
    },
];

export class CabinetSystem {

    /**
     * @param {import('../core/CareerManager').CareerManager} career
     */
    constructor(career) {
        this.career = career;
        this.catalog = UPGRADES;
        this.flags = {};

        // Восстановление эффектов из сохранённых уровней апгрейдов
        this._restoreEffects();
    }

    _restoreEffects() {
        this.catalog.forEach(upg => {
            const level = this.career.getUpgradeLevel(upg.id);
            if (level > 0 && upg.effect) {
                upg.effect(this, level);
            }
        });
    }

    /**
     * @param {string} flagId
     * @param {any} value
     */
    setFlag(flagId, value) {
        this.flags[flagId] = value;
    }

    /**
     * Проверка наличия пассивного свойства (skills/defense)
     * @param {string} flagId
     * @returns {any} значение флага
     */
    hasFlag(flagId) {
        return this.flags[flagId];
    }

    /**
     * Покупка апгрейда (уровня).
     * @param {string} id
     * @returns {boolean} Успех операции
     */
    buyUpgrade(id) {
        const upg = this.catalog.find(u => u.id === id);
        if (!upg) return false;

        const currentLevel = this.career.getUpgradeLevel(id);
        if (currentLevel >= upg.maxLevel) return false;

        if (this.career.getScore() < upg.cost) return false;

        // Снятие очков
        this.career.addScore(-upg.cost, { reason: 'upgrade_purchase', caseId: id });
        
        // Повышение уровня
        const newLevel = currentLevel + 1;
        this.career.setUpgradeLevel(id, newLevel);

        // Применение эффекта
        if (upg.effect) {
            upg.effect(this, newLevel);
        }

        return true;
    }

    /**
     * Использование расходуемого перка.
     * @param {string} id
     * @returns {boolean}
     */
    usePerk(id) {
        const upg = this.catalog.find(u => u.id === id);
        if (!upg || !upg.consumable) return false;

        const count = this.career.getUpgradeLevel(id);
        if (count <= 0) return false;

        // Проверка cooldown
        if (upg.cooldownCases) {
            const lastUsed = this.career.getPerkCooldown(id); // номер дела когда юзали
            const completedCases = this.career.getCompletedCasesCount();
            if (lastUsed !== null && (completedCases - lastUsed) < upg.cooldownCases) {
                return false; // Кулдаун ещё не прошёл
            }
            // Фиксация использования
            this.career.setPerkCooldown(id, completedCases);
        }

        // Тратим заряд
        this.career.setUpgradeLevel(id, count - 1);
        return true;
    }

    /**
     * Возвращает оставшийся кулдаун для перка (в количестве дел).
     * @param {string} id 
     * @returns {number} 0 если готов
     */
    getPerkCooldownRemaining(id) {
        const upg = this.catalog.find(u => u.id === id);
        if (!upg || !upg.cooldownCases) return 0;

        const lastUsed = this.career.getPerkCooldown(id);
        if (lastUsed === null) return 0;

        const completedCases = this.career.getCompletedCasesCount();
        const passed = completedCases - lastUsed;
        return Math.max(0, upg.cooldownCases - passed);
    }

    // ─── Механика резервного счёта ("Зарубежный счёт") ────────────────────────

    /** Максимальная вместимость сейфа */
    get MAX_RESERVE() { return 300; }

    /** Доступен ли резервный счёт */
    isReserveAvailable() {
        return !!this.hasFlag('safeDepositUnlocked');
    }

    getReserveBalance() {
        return this.career.getReserveScore() || 0;
    }

    /**
     * Переводит очки с основного баланса на резервный.
     * @param {number} amount
     * @returns {boolean}
     */
    depositToReserve(amount) {
        if (!this.isReserveAvailable()) return false;
        if (amount <= 0 || this.career.getScore() < amount) return false;

        const currentReserve = this.getReserveBalance();
        const spaceLeft = this.MAX_RESERVE - currentReserve;
        const depositAmount = Math.min(amount, spaceLeft);

        if (depositAmount <= 0) return false;

        this.career.addScore(-depositAmount, { reason: 'reserve_deposit' });
        this.career.setReserveScore(currentReserve + depositAmount);
        return true;
    }

    /**
     * Снимает очки с резервного счёта на основной.
     * @param {number} amount
     * @returns {boolean}
     */
    withdrawFromReserve(amount) {
        if (!this.isReserveAvailable()) return false;
        const currentReserve = this.getReserveBalance();
        if (amount <= 0 || currentReserve < amount) return false;

        this.career.setReserveScore(currentReserve - amount);
        this.career.addScore(amount, { reason: 'reserve_withdraw' });
        return true;
    }
}
