/**
 * Модель Дела (Case)
 * Содержит всю информацию о судебном процессе.
 */
export class Case {
    constructor(data = {}) {
        this.id = data.id || `CASE-${Date.now()}`;
        this.type = data.type || "theft"; // Тип преступления
        this.defendantName = data.defendantName || "Неизвестный";
        this.description = data.description || "";
        
        this.witnesses = data.witnesses || []; // Array of Witness
        this.evidence = data.evidence || [];   // Array of Evidence
        
        // "Истинный сценарий" - скрытая от игрока правда
        this.trueScenario = data.trueScenario || {
            culpritId: null,
            events: [],
            motive: ""
        };

        this.status = "open"; // open, closed
        this.playerVerdict = null;
    }
}
