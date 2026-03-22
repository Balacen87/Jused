// ─── AlibiVerificationSystem.js ─────────────────────────────────────────────
// Система пошаговой проверки алиби подсудимого.
// Работает с данными сценария + узлом alibi_event из EventGraph.
//
// Результат проверки:
//   'confirmed'  — алиби доказательно подтверждено
//   'refuted'    — алиби опровергнуто
//   'partial'    — частичное подтверждение, требует суждения
//   'pending'    — ещё не проверено

export class AlibiVerificationSystem {

    /**
     * Генерирует пошаговый план проверки алиби для данного сценария.
     * @param {Object} scenario — trueScenario из дела
     * @param {Object} graph    — EventGraph (необязательно)
     * @returns {AlibiChecklist}
     */
    static buildChecklist(scenario, graph = null) {
        const alibi = scenario.alibi || {};
        const isGuilty = scenario.isGuilty;

        // Ищем alibi_event в графе, если есть
        const alibiNode = graph?.nodes?.find(n => n.type === 'alibi_event') ?? null;

        // Три канала верификации
        const steps = [
            this._buildCameraStep(scenario, alibi, isGuilty, alibiNode),
            this._buildWitnessStep(scenario, alibi, isGuilty),
            this._buildDocumentStep(scenario, alibi, isGuilty),
        ];

        return {
            alibiClaim: alibi.claim || 'Алиби не предоставлено.',
            alibiWitness: alibi.witness || 'Не указан',
            isVerifiedByDefense: alibi.verified ?? false,
            steps,
            // Итог вычисляется после завершения шагов
            result: null,
            resultText: null,
        };
    }

    /**
     * Запускает один шаг проверки (вызывается кликом игрока).
     * Возвращает обновлённый шаг с результатом.
     * @param {Object} step
     * @param {boolean} isGuilty — скрытая истина (недоступна игроку)
     */
    static runStep(step, isGuilty) {
        if (step.done) return step;

        const roll = Math.random();

        if (isGuilty) {
            // Виновный: большинство каналов НЕ подтверждают алиби
            // Но с вероятностью 15% — запутанный результат (улики можно сфабриковать)
            if (roll < 0.15) {
                step.outcome = 'inconclusive';
                step.detail  = step.inconclusiveText;
            } else if (roll < 0.25) {
                step.outcome = 'confirmed'; // Ложно подтверждает
                step.detail  = step.falseConfirmText;
                step.suspicious = true;     // Помечаем как подозрительный
            } else {
                step.outcome = 'refuted';
                step.detail  = step.refutedText;
            }
        } else {
            // Невиновный: большинство каналов подтверждают алиби
            if (roll < 0.75) {
                step.outcome = 'confirmed';
                step.detail  = step.confirmText;
            } else if (roll < 0.9) {
                step.outcome = 'inconclusive';
                step.detail  = step.inconclusiveText;
            } else {
                // Редко — даже невиновный не может подтвердить
                step.outcome = 'refuted';
                step.detail  = step.refutedText;
            }
        }

        step.done = true;
        return step;
    }

    /**
     * Вычисляет итог по всем завершённым шагам.
     * @param {Object[]} steps
     * @returns {{ result: string, text: string, confidence: number }}
     */
    static computeResult(steps) {
        const done = steps.filter(s => s.done);
        if (done.length === 0) return { result: 'pending', text: 'Проверка не проводилась.', confidence: 0 };

        const confirmed    = done.filter(s => s.outcome === 'confirmed' && !s.suspicious).length;
        const refuted      = done.filter(s => s.outcome === 'refuted').length;
        const inconclusive = done.filter(s => s.outcome === 'inconclusive').length;
        const suspicious   = done.filter(s => s.suspicious).length;

        const total = done.length;
        const confidence = Math.round(((confirmed - refuted * 0.7) / total) * 100);

        if (refuted >= 2 || (refuted === 1 && suspicious === 0 && confirmed === 0)) {
            return {
                result: 'refuted',
                text: '❌ Алиби опровергнуто. Показания противоречат проверенным данным.',
                confidence: Math.max(0, confidence)
            };
        }
        if (confirmed >= 2 && suspicious === 0) {
            return {
                result: 'confirmed',
                text: '✅ Алиби подтверждено по двум независимым каналам.',
                confidence: Math.min(100, Math.max(0, confidence))
            };
        }
        if (suspicious >= 1) {
            return {
                result: 'partial',
                text: '⚠️ Имеются странности. Одно из подтверждений вызывает сомнения — возможна фальсификация.',
                confidence: 40
            };
        }
        return {
            result: 'partial',
            text: '🔍 Данных недостаточно для окончательного вывода. Необходимо дополнительное расследование.',
            confidence: 50
        };
    }

    // ── Генераторы шагов ──────────────────────────────────────────────────────

    static _buildCameraStep(scenario, alibi, isGuilty, alibiNode) {
        const location = alibi.claim?.match(/в (.+?),/)?.[1] ?? scenario.location;
        return {
            id: 'camera',
            icon: '📹',
            title: 'Видеозапись с камер наблюдения',
            description: `Запрос архива камер наблюдения в районе ${location} в указанное время`,
            done: false,
            outcome: null,
            detail: null,
            suspicious: false,
            confirmText:       `Камера зафиксировала подсудимого в ${location}. Временная метка совпадает с заявлением.`,
            refutedText:       `Камера в ${location} подсудимого в указанное время не зафиксировала. Запись проверена.`,
            inconclusiveText:  `Камера в нужном месте не работала / запись повреждена. Результат неопределён.`,
            falseConfirmText:  `Камера зафиксировала схожую фигуру. Однако качество записи низкое — идентификация сомнительная.`,
        };
    }

    static _buildWitnessStep(scenario, alibi, isGuilty) {
        const witnessName = alibi.witness?.split('(')?.[0]?.trim() ?? 'Предполагаемый свидетель';
        return {
            id: 'witness',
            icon: '🧑',
            title: 'Опрос свидетеля алиби',
            description: `Повторный опрос: ${witnessName}`,
            done: false,
            outcome: null,
            detail: null,
            suspicious: false,
            confirmText:       `${witnessName} подтвердил(а) присутствие подсудимого. Показания детальные и последовательные.`,
            refutedText:       `${witnessName} не смог(ла) подтвердить. Показания противоречат первоначальным.`,
            inconclusiveText:  `${witnessName} неубедителен(на). Нервничает, путается в деталях — возможное давление.`,
            falseConfirmText:  `${witnessName} подтвердил(а), однако показания слово-в-слово совпадают с заявлением — выглядит заученно.`,
        };
    }

    static _buildDocumentStep(scenario, alibi, isGuilty) {
        const docTypes = ['Чек оплаты', 'Транзакция банковской карты', 'Билет / посадочный талон', 'Медицинская запись'];
        const doc = docTypes[Math.floor(Math.random() * docTypes.length)];
        return {
            id: 'document',
            icon: '📄',
            title: `Проверка документов (${doc})`,
            description: `Запрос подтверждающих документов: ${doc} за нужный период`,
            done: false,
            outcome: null,
            detail: null,
            suspicious: false,
            confirmText:       `${doc} подлинный, метаданные совпадают с заявлением подсудимого.`,
            refutedText:       `${doc} не обнаружен в нужный период. Данные не совпадают.`,
            inconclusiveText:  `${doc} предоставлен, но подлинность требует дополнительной экспертизы.`,
            falseConfirmText:  `${doc} найден, однако дата/время вызывает вопросы — возможна подделка.`,
        };
    }
}
