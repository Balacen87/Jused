# AAA SimulationEngine — Walkthrough

## Что реализовано

### Новые файлы (`simulation/`)

| Файл | Строк | Описание |
|------|-------|----------|
| [BayesianEngine.js](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/simulation/BayesianEngine.js) | ~180 | P(вина\|улики) — байесовское обновление prior по каждой улике/противоречию/свидетелю |
| [ContradictionGraph.js](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/simulation/ContradictionGraph.js) | ~265 | Граф связей нода↔нода + renderSVG() |
| [JuryAI.js](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/simulation/JuryAI.js) | ~160 | 7 присяжных (Аналитик, Скептик, Эмпат, Законник…) |
| [TrialSimulation.js](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/simulation/TrialSimulation.js) | ~185 | 5-шаговый пайплайн судебного заседания |
| [SimulationEngine.js](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/simulation/SimulationEngine.js) | ~190 | Главный оркестратор, EventTarget API |

### Расширения существующих

- **VerdictSystem v2** — добавлен [evaluateProbabilistic()](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/systems/VerdictSystem.js#55-117) с байесовской поддержкой и [buildFeedbackHTML()](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/systems/VerdictSystem.js#139-165)
- **LieStrategyEngine v2** — 5→8 стратегий (+CORROBORATE, DEFLECT, EMOTIONAL), [getSeverityScore()](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/systems/LieStrategyEngine.js#57-64), [getStrategyDescription()](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/systems/LieStrategyEngine.js#65-81)

### Интеграция в [main.js](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/main.js)

- [SimulationEngine](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/simulation/SimulationEngine.js#21-220) инициализируется с DI всех подсистем
- [startNewGame()](file:///c:/Users/balac/Desktop/GAMEALLREADY/jused/main.js#96-123) теперь вызывает `engine.runCase({ rankName })`
- `this.trialData` сохраняет полный TrialReport для UI-вкладок
- `window.engine` доступен для отладки в консоли

## Верификация в браузере

```
[Engine] Рекомендация системы: innocent (100%)

window.engine.lastResult.metrics:
  bayesScore: 49
  probability: 0.493
  consistencyScore: 0.5
  contradictions: 6
  credibilityAvg: 0.43
  juryVerdict: "innocent"
  juryGuilty: 0 / juryInnocent: 7
```

✅ Игра загружается без ошибок  
✅ SimulationEngine запускается при каждом новом деле  
✅ TrialReport содержит полные данные для UI

## Пайплайн симуляции

```
engine.runCase(rankName)
  │
  ├─ CaseGenerator.generate()           ← существующий
  │
  ├─ TrialSimulation.simulate(caseData)
  │    ├─ CredibilitySystem.evaluate()  ← существующий
  │    ├─ ContradictionSystem.analyze() ← существующий
  │    ├─ BayesianEngine.evaluateCase() ← НОВЫЙ
  │    ├─ ContradictionGraph.build()    ← НОВЫЙ
  │    └─ JuryAI.evaluateTrial()        ← НОВЫЙ
  │
  └─ FullCaseResult { case, trial, metrics, systemRecommendation }
```
