/**
 * Расширенная модель свидетеля с психологическими параметрами (WitnessAI)
 */
export class Witness {
    constructor(data = {}) {
        this.id = data.id || `w_${Math.random().toString(36).substr(2, 9)}`;
        this.name = data.name || "Неизвестный свидетель";
        this.role = data.role || null;

        // Связь с EventGraph
        this.observedNodeId   = data.observedNodeId   ?? null;
        this.observedNodeType = data.observedNodeType ?? null;

        // Психологический профиль (Big Five / Personality)
        this.personality = {
            honesty: data.personality?.honesty ?? 0.5,      // Вероятность говорить правду
            courage: data.personality?.courage ?? 0.5,      // Сопротивление давлению
            anxiety: data.personality?.anxiety ?? 0.5,      // Вероятность путаницы
            empathy: data.personality?.empathy ?? 0.5,      // Защита жертвы
            impulsivity: data.personality?.impulsivity ?? 0.5 // Спонтанные ответы
        };

        // Мотивация (Motivation)
        this.motivation = {
            protectDefendant: data.motivation?.protectDefendant ?? 0,
            protectVictim: data.motivation?.protectVictim ?? 0,
            selfProtection: data.motivation?.selfProtection ?? 0.1,
            revenge: data.motivation?.revenge ?? 0,
            greed: data.motivation?.greed ?? 0,
            justice: data.motivation?.justice ?? 0.2
        };

        // Эмоциональное состояние (Emotional State)
        this.emotionalState = {
            stress: data.emotionalState?.stress ?? 0.2,
            fear: data.emotionalState?.fear ?? 0,
            anger: data.emotionalState?.anger ?? 0,
            fatigue: data.emotionalState?.fatigue ?? 0,
            confidence: data.emotionalState?.confidence ?? 0.8
        };

        // Модель памяти (Memory Model)
        this.memory = {
            accuracy: data.memory?.accuracy ?? 0.8,
            timeDistortion: data.memory?.timeDistortion ?? 0.1,
            detailLoss: data.memory?.detailLoss ?? 0.2,
            faceRecognition: data.memory?.faceRecognition ?? 0.7
        };

        this.testimonies = []; // Список показаний Testimony[]
        this.credibility = 1.0;
    }

    /**
     * Алгоритм принятия решения говорить правду
     */
    decideTruth() {
        const score = 
            this.personality.honesty + 
            this.motivation.justice - 
            this.emotionalState.fear - 
            this.motivation.protectDefendant;
        
        return score > 0.5;
    }

    /**
     * Реакция на давление (при допросе)
     * @param {number} intensity Базовая сила давления
     * @param {number} stressMultiplier Множитель уязвимости психотипа (из CredibilitySystem)
     */
    applyPressure(intensity = 0.1, stressMultiplier = 1.0) {
        const actualIntensity = intensity * stressMultiplier;
        
        this.emotionalState.stress = Math.min(1, this.emotionalState.stress + actualIntensity);
        this.emotionalState.fear = Math.min(1, this.emotionalState.fear + actualIntensity * 0.5);
        this.emotionalState.confidence = Math.max(0, this.emotionalState.confidence - actualIntensity);
        
        // Если стресс слишком высок (зависит от courage), свидетель "ломается"
        const breakingPoint = 0.5 + (this.personality.courage * 0.5); // 0.5 - 1.0
        
        if (this.emotionalState.stress > breakingPoint) {
            return "breakdown"; 
        }
        return "pressured";
    }

    /**
     * Изменяет показания после слома
     */
    changeTestimony(index, newText, newType = 'recanted') {
        if (this.testimonies[index]) {
            this.testimonies[index].text = newText;
            this.testimonies[index].type = newType;
            // Сбрасываем стресс после чистосердечного признания
            this.emotionalState.stress *= 0.3; 
            this.emotionalState.fear *= 0.5;
            this.credibility = Math.max(0.1, this.credibility - 0.5); // Репутация падает
        }
    }
}
