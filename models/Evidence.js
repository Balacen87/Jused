/**
 * Модель Улики (Evidence)
 */
export class Evidence {
    constructor(data = {}) {
        this.id = data.id || Math.random().toString(36).substr(2, 9);
        this.type = data.type || "physical"; // physical, video, expert, document, digital
        this.name = data.name || "Неизвестная улика";
        this.description = data.description || "";
        this.reliability = data.reliability || 1.0; // Надежность (0.0 - 1.0)
        
        // Флаги игрока
        this.playerMark = "neutral"; // neutral, confirmed, suspicious, contradictory
    }
}

/**
 * Модель Показания (Testimony)
 */
export class Testimony {
    constructor(data = {}) {
        this.witnessId = data.witnessId;
        this.text = data.text || "";
        this.trueSourceValue = data.value; // Реальное значение факта в "Истине"
        
        // Тип показания: true, incomplete, mistaken, biased, lie
        this.type = data.type || "true";
        
        // Связанные факты/метки
        this.relatedEvidenceIds = data.relatedEvidenceIds || [];
        
        // Флаги игрока
        this.playerMark = "neutral"; // neutral, confirmed, suspicious
    }
}
