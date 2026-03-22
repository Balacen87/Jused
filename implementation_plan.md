# AAA Simulation Engine — Implementation Plan

Превращаем набор модульных систем в **полноценный simulation pipeline** уровня Crusader Kings / RimWorld.

## Контекст

Уже есть (не трогаем, только расширяем):
- [AdvancedEvidenceSystem](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/systems/AdvancedEvidenceSystem.js#37-355) — генерация улик, тесты, цепи хранения
- [ContradictionSystem](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/systems/ContradictionSystem.js#15-411) — 6 категорий анализа, 12 типов противоречий
- [CredibilitySystem](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/systems/CredibilitySystem.js#14-331) — 8 типов показаний, психотипы, trust-score
- [LieStrategyEngine](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/systems/LieStrategyEngine.js#4-53) — 5 стратегий лжи для свидетелей
- [VerdictSystem](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/systems/VerdictSystem.js#4-50) — базовый evaluate

## Proposed Changes

### simulation/ — новые файлы

#### [NEW] BayesianEngine.js
Байесовское обновление вероятности вины по мере накопления улик.
```
P(G|E) = P(E|G) * P(G) / P(E)
```
- [update(prior, likelihood)](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/main.js#223-245) → posterior [0..1]
- `evaluateCase(caseData)` → `{ score, breakdown, confidence }`
- Каждая улика с `confidence > 0.7` сдвигает prior на +0.12
- Каждое фальшивое доказательство: −0.15
- Каждое противоречие свидетеля: −0.08

#### [NEW] ContradictionGraph.js
Граф связей между сущностями дела.
```
nodes: [Witness, Evidence, Suspect]
edges: [confirms | contradicts | alibi_supports | alibi_breaks]
```
- [build(caseData)](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/systems/expertise/ExpertiseOrchestrator.js#293-307) → граф
- `getConsistencyScore()` → 0..1 (общая связность)
- `getHighRiskNodes()` → ноды с наибольшим числом противоречий
- `renderSVG(container)` → простая SVG-визуализация в игре

#### [NEW] JuryAI.js
Модель присяжных — 7 условных «голосов» с разными весами.
- `evaluateTrial(trialData)` → `{ votes, verdict, reasoning }`
- Каждый присяжный весит: credibility × 0.3, bayes × 0.4, contradictions × 0.3
- Возможные вердикты: `guilty`, `innocent`, `hung_jury`

#### [NEW] TrialSimulation.js
Пайплайн судебного заседания — связывает все системы.
```
witnesses → CredibilitySystem
     ↓
evidence  → BayesianEngine
     ↓
all data  → ContradictionGraph
     ↓
           → JuryAI
     ↓
trialReport{ credibility[], bayesScore, contradictions, juryVotes, recommendedVerdict }
```

#### [NEW] SimulationEngine.js
Главный оркестратор — единая точка входа.
```
runCase(seed) →
  1. caseSystem.generate(seed)      // CaseGenerator
  2. evidenceSystem.generate(case)  // AdvancedEvidenceSystem
  3. trialSystem.simulate(case)     // TrialSimulation (все подсистемы)
  4. verdictSystem.evaluate(trial)  // VerdictSystem (Bayesian)
  5. consequenceSystem.process()    // ConsequenceManager
  → FullCaseResult
```

---

### systems/ — расширения существующих

#### [MODIFY] VerdictSystem.js
Добавить `evaluateProbabilistic(trialData)`:
- Использует `BayesianEngine.evaluateCase()`
- Возвращает `probability`, `confidence`, `breakdown`
- Старый [evaluate()](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/systems/VerdictSystem.js#5-49) остаётся для backward-compat

#### [MODIFY] LieStrategyEngine.js
Добавить 3 новые стратегии: `CORROBORATE`, `DEFLECT`, `EMOTIONAL`
+ метод `getSeverityScore(strategy)` → 0..1

---

### Integration

#### [MODIFY] main.js
- Инициализировать `SimulationEngine` с DI всех подсистем
- [startNewGame()](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/main.js#78-105) вызывает `engine.runCase(Date.now())`
- Хранить `this.trialData` для доступа из UI-вкладок
- Экспортировать `window.game.engine` для отладки

## Verification Plan

### Automated Tests
- BayesianEngine: `prior=0.5 + 3 positive evidence → P > 0.7`
- ContradictionGraph: граф строится без ошибок для любого кейса
- JuryAI: при P=0.1 → innocent, при P=0.9 → guilty
- SimulationEngine: `runCase()` возвращает полный FullCaseResult

### Manual Verification
- Игра запускается, дело отображается корректно
- Во вкладке "Вердикт" виден bayesScore и рекомендация системы
