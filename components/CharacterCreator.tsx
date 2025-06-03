
import React, { useState, useEffect, useCallback } from 'react';
import { Character, Race, Class, Stats, StatName, AiStatSuggestion, Skill, AiModelId, AiGeneratedWorldContent, ItemType } from '../types';
import { 
    AVAILABLE_RACES, AVAILABLE_CLASSES, BASE_STAT_VALUE, STAT_NAMES_ORDERED, 
    STAT_NAME_TRANSLATIONS, MANUAL_POINTS_POOL, MIN_STAT_VALUE, AVAILABLE_AI_MODELS, DEFAULT_AI_MODEL_ID,
    XP_THRESHOLDS // Import XP_THRESHOLDS
} from '../constants';
import { analyzeBackstoryWithGemini, generateCustomRacesAndClassesWithGemini, trySetManualApiKey } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import { ChevronLeftIcon, ChevronRightIcon, SparklesIcon, PlayerCharacterIcon } from './icons';

interface CharacterCreatorProps {
  onCharacterCreated: (character: Character) => void;
  apiKeyAvailable: boolean;
  onManualKeyProvided: (success: boolean) => void;
}

type WorldSettingOption = 'standard' | 'custom';
type RaceClassSourceOption = 'standard_races_classes' | 'ai_generated_races_classes';

const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onCharacterCreated, apiKeyAvailable, onManualKeyProvided }) => {
  const [step, setStep] = useState(1);
  const [characterName, setCharacterName] = useState('');
  const [isNsfwEnabled, setIsNsfwEnabled] = useState(false); 
  const [selectedAiModelId, setSelectedAiModelId] = useState<AiModelId>(DEFAULT_AI_MODEL_ID);
  
  const [worldSettingOption, setWorldSettingOption] = useState<WorldSettingOption>('standard');
  const [customWorldSettingText, setCustomWorldSettingText] = useState('');
  const [raceClassSource, setRaceClassSource] = useState<RaceClassSourceOption>('standard_races_classes');
  const [generatedRaces, setGeneratedRaces] = useState<Race[] | null>(null);
  const [generatedClasses, setGeneratedClasses] = useState<Class[] | null>(null);
  const [isGeneratingWorldContent, setIsGeneratingWorldContent] = useState(false);


  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [backstory, setBackstory] = useState('');
  
  const [currentStats, setCurrentStats] = useState<Stats>(
    STAT_NAMES_ORDERED.reduce((acc, stat) => ({ ...acc, [stat]: BASE_STAT_VALUE }), {})
  );
  const [statsAfterAi, setStatsAfterAi] = useState<Stats | null>(null); 

  const [aiSuggestions, setAiSuggestions] = useState<AiStatSuggestion | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalPointsDelta, setTotalPointsDelta] = useState(0); 
  const [statsInitializedForManualStep, setStatsInitializedForManualStep] = useState(false);
  const [isGodModeEnabled, setIsGodModeEnabled] = useState(false);

  // Manual API Key State
  const [manualApiKeyInput, setManualApiKeyInput] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [manualKeyError, setManualKeyError] = useState<string | null>(null);


  const racesToDisplay = raceClassSource === 'ai_generated_races_classes' && generatedRaces ? generatedRaces : AVAILABLE_RACES;
  const classesToDisplay = raceClassSource === 'ai_generated_races_classes' && generatedClasses ? generatedClasses : AVAILABLE_CLASSES;

  const calculateCurrentStats = useCallback(() => {
    let baseCalcStats: Stats = STAT_NAMES_ORDERED.reduce((acc, statName) => {
        acc[statName] = BASE_STAT_VALUE;
        return acc;
    }, {} as Stats);

    const race = racesToDisplay.find(r => r.id === selectedRaceId);
    const charClass = classesToDisplay.find(c => c.id === selectedClassId);

    if (race) {
        for (const stat in race.baseStatModifiers) {
            baseCalcStats[stat as StatName] = (baseCalcStats[stat as StatName] || BASE_STAT_VALUE) + (race.baseStatModifiers[stat as StatName] || 0);
        }
    }

    if (charClass) {
        for (const stat in charClass.baseStatModifiers) {
            baseCalcStats[stat as StatName] = (baseCalcStats[stat as StatName] || BASE_STAT_VALUE) + (charClass.baseStatModifiers[stat as StatName] || 0);
        }
    }
    
    if (aiSuggestions?.stat_modifiers) {
        const combinedWithAi = {...baseCalcStats};
        for (const statKey in aiSuggestions.stat_modifiers) {
            const statName = statKey as StatName;
            if (combinedWithAi[statName] !== undefined) {
                 combinedWithAi[statName] = (combinedWithAi[statName] || BASE_STAT_VALUE) + (aiSuggestions.stat_modifiers[statName] || 0);
            }
        }
        setStatsAfterAi(combinedWithAi); 

        if (step < 7) { 
            setCurrentStats(combinedWithAi);
        } else if (step === 7 && !statsInitializedForManualStep) { 
            setCurrentStats(combinedWithAi); 
            setTotalPointsDelta(0); 
            setStatsInitializedForManualStep(true);
        }
    } else { 
        setStatsAfterAi(baseCalcStats); 
        if (step < 7) { 
             setCurrentStats(baseCalcStats);
        }  else if (step === 7 && !statsInitializedForManualStep) {
            setCurrentStats(baseCalcStats);
            setTotalPointsDelta(0);
            setStatsInitializedForManualStep(true);
        }
    }
  }, [selectedRaceId, selectedClassId, aiSuggestions, step, statsInitializedForManualStep, racesToDisplay, classesToDisplay]);


  useEffect(() => {
    calculateCurrentStats();
  }, [calculateCurrentStats]);

  const handleTestAndSetManualKey = async () => {
    if (!manualApiKeyInput.trim()) return;
    setIsTestingKey(true);
    setManualKeyError(null);
    const success = trySetManualApiKey(manualApiKeyInput.trim());
    if (success) {
        onManualKeyProvided(true);
        setManualApiKeyInput(""); 
        setError(null); // Clear general error if key is now OK
    } else {
        setManualKeyError("Не удалось проверить ключ. Убедитесь, что он правильный и активен.");
        onManualKeyProvided(false);
    }
    setIsTestingKey(false);
  };


  const handleNextStep = () => {
    setError(null); // Clear previous general errors
    setManualKeyError(null); // Clear manual key errors

    if (step === 1) {
        if (!characterName.trim()) {
            setError("Пожалуйста, введите имя вашего персонажа."); return;
        }
        if (!apiKeyAvailable && !manualApiKeyInput.trim()) { // If env key not available and manual key not even attempted
             // Message for manual key input is already visible if !apiKeyAvailable
        }
        if (!selectedAiModelId && apiKeyAvailable) { // Only enforce model selection if a key is present
            setError("Пожалуйста, выберите модель ИИ."); return;
        }
    }
    if (step === 2) { 
        if (worldSettingOption === 'custom' && !customWorldSettingText.trim()) {
            setError("Пожалуйста, опишите ваш собственный мир или выберите стандартный."); return;
        }
        if (worldSettingOption === 'custom' && raceClassSource === 'ai_generated_races_classes' && (!generatedRaces || !generatedClasses) && !isGeneratingWorldContent) {
            setError("Пожалуйста, сгенерируйте расы и классы для вашего мира или выберите стандартные."); return;
        }
         if (isGeneratingWorldContent) {
            setError("Подождите, пока ИИ закончит генерацию рас и классов."); return;
        }
    }
    if (step === 3 && !selectedRaceId) { 
      setError("Пожалуйста, выберите расу для вашего персонажа."); return;
    }
    if (step === 4 && !selectedClassId) { 
      setError("Пожалуйста, выберите класс для вашего персонажа."); return;
    }
    if (step === 5 && !backstory.trim()) { 
      setError("Пожалуйста, напишите предысторию. Даже короткая подойдет!"); return;
    }
    if (step === 6 && !aiSuggestions && apiKeyAvailable && !isLoadingAi) { 
        setError("Пожалуйста, сначала проанализируйте предысторию с ИИ или пропустите, если анализ недоступен/не удался."); return;
    }
    if (step === 7 && !isGodModeEnabled) { 
        if (totalPointsDelta > MANUAL_POINTS_POOL) {
            setError(`Вы превысили лимит очков на увеличение (${totalPointsDelta} > ${MANUAL_POINTS_POOL}).`); return;
        }
        if (totalPointsDelta < -MANUAL_POINTS_POOL) {
             setError(`Вы превысили лимит очков на уменьшение (${totalPointsDelta} < -${MANUAL_POINTS_POOL}).`); return;
        }
    }
    setStatsInitializedForManualStep(false); 
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStatsInitializedForManualStep(false); 
    if (step === 3 && raceClassSource === 'ai_generated_races_classes') {
        setSelectedRaceId(null);
    }
    if (step === 4 && raceClassSource === 'ai_generated_races_classes') {
        setSelectedClassId(null);
    }
    setStep(prev => prev - 1);
  }

  const handleGenerateWorldRacesClasses = async () => {
    if (!customWorldSettingText.trim()) {
        setError("Пожалуйста, сначала опишите ваш мир, чтобы ИИ мог создать для него расы и классы.");
        return;
    }
    if (!apiKeyAvailable) {
        setError("API-ключ не активен. Генерация рас и классов ИИ отключена. Введите ключ на Шаге 1.");
        return;
    }
    setIsGeneratingWorldContent(true);
    setError(null);
    try {
        const result = await generateCustomRacesAndClassesWithGemini(customWorldSettingText, selectedAiModelId || DEFAULT_AI_MODEL_ID);
        if (result.races.length > 0 && result.classes.length > 0) {
            setGeneratedRaces(result.races);
            setGeneratedClasses(result.classes);
        } else {
            setError("ИИ не смог сгенерировать расы или классы. Попробуйте изменить описание мира или использовать стандартные.");
            setGeneratedRaces(null);
            setGeneratedClasses(null);
        }
    } catch (e) {
        console.error(e);
        setError("Ошибка при генерации рас и классов ИИ. Пожалуйста, попробуйте еще раз или используйте стандартные.");
        setGeneratedRaces(null);
        setGeneratedClasses(null);
    } finally {
        setIsGeneratingWorldContent(false);
    }
  };


  const handleAnalyzeBackstory = async () => {
    const currentRace = racesToDisplay.find(r => r.id === selectedRaceId);
    const currentClass = classesToDisplay.find(c => c.id === selectedClassId);

    if (!backstory.trim() || !selectedRaceId || !selectedClassId || !selectedAiModelId || !currentRace || !currentClass) {
      setError("Пожалуйста, укажите имя, модель ИИ, расу, класс и предысторию перед анализом ИИ.");
      return;
    }
    if (!apiKeyAvailable) {
        setError("API-ключ не активен. Функции ИИ отключены. Введите ключ на Шаге 1.");
        setAiSuggestions({ 
            stat_modifiers: STAT_NAMES_ORDERED.reduce((acc, stat) => ({...acc, [stat]: 0}), {}), 
            world_elements: ["Функции ИИ отключены из-за отсутствия активного API-ключа."],
            skills: [{ name: "Навыки не сгенерированы", description: "ИИ отключен." }]
        });
        return;
    }

    setIsLoadingAi(true);
    setError(null);
    
    try {
      const suggestions = await analyzeBackstoryWithGemini(currentRace.name, currentClass.name, backstory, selectedAiModelId);
      setAiSuggestions(suggestions);
    } catch (e) {
      console.error(e);
      setError("Не удалось получить предложения от ИИ. Пожалуйста, попробуйте еще раз или продолжите без них.");
      setAiSuggestions({ 
          stat_modifiers: STAT_NAMES_ORDERED.reduce((acc, stat) => ({...acc, [stat]: 0}), {}), 
          world_elements: ["Анализ ИИ не удался."],
          skills: [{ name: "Навыки не сгенерированы", description: "Ошибка ИИ." }]
      });
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleManualStatChange = (statName: StatName, operation: 'increment' | 'decrement') => {
    if (!statsAfterAi) return;

    const currentValue = currentStats[statName] || BASE_STAT_VALUE;
    let newValue = currentValue;

    if (operation === 'increment') {
        newValue = currentValue + 1;
    } else { 
        newValue = currentValue - 1;
    }

    if (newValue < MIN_STAT_VALUE) {
        setError(`Характеристика не может быть ниже ${MIN_STAT_VALUE}.`);
        return;
    }

    let prospectiveDelta = 0;
    STAT_NAMES_ORDERED.forEach(sName => {
        const baseVal = statsAfterAi[sName] || BASE_STAT_VALUE;
        const currentValInLoop = (sName === statName) ? newValue : (currentStats[sName] || BASE_STAT_VALUE);
        prospectiveDelta += (currentValInLoop - baseVal);
    });

    if (!isGodModeEnabled) { 
        if (prospectiveDelta > MANUAL_POINTS_POOL) {
            setError(`Вы не можете увеличить сумму характеристик более чем на ${MANUAL_POINTS_POOL} очков от предложенных ИИ. Текущее изменение: ${prospectiveDelta}`);
            return;
        }
        if (prospectiveDelta < -MANUAL_POINTS_POOL) {
             setError(`Вы не можете уменьшить сумму характеристик более чем на ${MANUAL_POINTS_POOL} очков от предложенных ИИ. Текущее изменение: ${prospectiveDelta}`);
            return;
        }
    }
    
    setError(null);
    setCurrentStats(prev => ({ ...prev, [statName]: newValue }));
    setTotalPointsDelta(prospectiveDelta);
};


  const handleFinalizeCharacter = () => {
    const finalRace = racesToDisplay.find(r => r.id === selectedRaceId);
    const finalClass = classesToDisplay.find(c => c.id === selectedClassId);

    if (!characterName || !selectedRaceId || !selectedClassId || !backstory || !currentStats || !selectedAiModelId || !finalRace || !finalClass ) {
        setError("Убедитесь, что все поля заполнены и все шаги пройдены.");
        return;
    }
        
    const constitution = currentStats[StatName.Constitution] || BASE_STAT_VALUE;
    const conMod = Math.floor((constitution - 10) / 2);
    const calculatedMaxHp = Math.max(10, 20 + conMod * 2); 

    const finalCharacter: Character = {
      name: characterName,
      race: finalRace,
      class: finalClass,
      backstory,
      stats: currentStats, 
      worldElements: aiSuggestions?.world_elements || ["Нет особых элементов мира из предыстории."],
      skills: aiSuggestions?.skills || [{ name: "Нет сгенерированных навыков", description: "Предыстория не анализировалась или ИИ не предложил навыки." }],
      statuses: [], 
      hp: calculatedMaxHp,
      maxHp: calculatedMaxHp,
      isNsfwEnabled: isNsfwEnabled, 
      selectedAiModelId: selectedAiModelId,
      customWorldSetting: worldSettingOption === 'custom' ? customWorldSettingText.trim() : undefined,
      inventory: [], 
      level: 1,
      currentXP: 0,
      xpToNextLevel: XP_THRESHOLDS[1] || 100, 
    };
    onCharacterCreated(finalCharacter);
  };

  const renderStepContent = () => {
    switch (step) {
      case 1: // Name, NSFW, and AI Model
        return ( 
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-purple-300">Шаг 1: Основы Персонажа</h2>
            
            <div className="mb-6">
              <label htmlFor="characterName" className="block text-sm font-medium text-slate-300 mb-1">Как зовут вашего персонажа?</label>
              <input
                id="characterName"
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="например, Элара Светлая Поляна"
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm sm:text-base"
                aria-label="Имя персонажа"
              />
            </div>

            <div className="mb-6 p-3 sm:p-4 border border-slate-600 rounded-lg bg-slate-700/50">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isNsfwEnabled}
                  onChange={(e) => setIsNsfwEnabled(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-purple-500 bg-slate-600 border-slate-500 rounded focus:ring-purple-500 focus:ring-offset-slate-800"
                  aria-describedby="nsfwDescription"
                />
                <span className="ml-3 text-slate-200 font-medium text-sm sm:text-base">Включить режим 18+ (NSFW)</span>
              </label>
              <p id="nsfwDescription" className="text-xs text-slate-400 mt-2">
                Внимание: Включение этого режима разрешает откровенный контент. Только для совершеннолетних.
              </p>
            </div>

            {/* AI Model Selection & Key Input */}
            <div className="mt-6">
              <h3 className="text-lg sm:text-xl font-semibold text-purple-300 mb-3">Выберите Модель ИИ</h3>
              {!apiKeyAvailable && (
                <div className="mb-4 p-3 border border-yellow-500 bg-slate-700/50 rounded-lg">
                  <label htmlFor="manualApiKey" className="block text-sm font-medium text-yellow-300 mb-2">
                    API-ключ Gemini не найден. Введите ключ для активации ИИ:
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      id="manualApiKey"
                      type="password"
                      value={manualApiKeyInput}
                      onChange={(e) => setManualApiKeyInput(e.target.value)}
                      placeholder="Ваш API-ключ Gemini"
                      className="flex-grow p-2 bg-slate-600 border border-slate-500 rounded-lg focus:ring-1 focus:ring-yellow-400 outline-none text-sm"
                      aria-label="Ручной ввод API ключа Gemini"
                    />
                    <button
                      onClick={handleTestAndSetManualKey}
                      disabled={isTestingKey || !manualApiKeyInput.trim()}
                      className={`px-3 py-2 font-semibold rounded-lg text-sm transition-colors ${
                        isTestingKey || !manualApiKeyInput.trim()
                          ? 'bg-slate-500 text-slate-400 cursor-not-allowed'
                          : 'bg-yellow-500 hover:bg-yellow-600 text-slate-900'
                      }`}
                      aria-live="polite"
                    >
                      {isTestingKey ? <LoadingSpinner size="w-5 h-5" color="text-slate-900" /> : "Применить Ключ"}
                    </button>
                  </div>
                  {manualKeyError && <p className="text-xs text-red-400 mt-2" role="alert">{manualKeyError}</p>}
                  <p className="text-xs text-slate-400 mt-2">
                      Ключ будет использован для текущей сессии. Для постоянной настройки используйте переменную окружения API_KEY.
                  </p>
                </div>
              )}

              <div className={`space-y-3 ${!apiKeyAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {AVAILABLE_AI_MODELS.map(model => (
                  <button
                    key={model.id}
                    onClick={() => {
                      if (apiKeyAvailable) { 
                          setSelectedAiModelId(model.id)
                      }
                    }}
                    disabled={!apiKeyAvailable} 
                    className={`w-full text-left p-3 sm:p-4 bg-slate-800 rounded-lg shadow-md hover:bg-slate-700 transition-all duration-200 border-2 ${
                      selectedAiModelId === model.id ? 'border-purple-500 ring-2 ring-purple-500' : 'border-slate-700'
                    } ${!apiKeyAvailable ? 'pointer-events-none' : ''}`}
                    aria-pressed={selectedAiModelId === model.id}
                  >
                    <div className="flex items-center">
                        {model.icon && React.cloneElement<React.SVGProps<SVGSVGElement>>(model.icon, { className: "w-8 h-8 sm:w-10 sm:h-10 mr-3 flex-shrink-0"})}
                        <div>
                          <h4 className="text-sm sm:text-md font-semibold text-slate-100">{model.name}</h4>
                          <p className="text-xs text-slate-400 mt-1">{model.description}</p>
                        </div>
                    </div>
                  </button>
                ))}
              </div>
              {AVAILABLE_AI_MODELS.length === 0 && <p className="text-slate-400">Модели ИИ не сконфигурированы.</p>}
              {!apiKeyAvailable && <p className="text-xs text-yellow-400 mt-2 text-center">Выбор модели будет доступен после ввода и проверки API-ключа.</p>}
            </div>
          </div>
        );
      case 2: // World Setting Step
        return (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-purple-300">Шаг 2: Настройка Мира Приключения</h2>
            <div className="space-y-3 mb-6">
              <button
                onClick={() => {
                    setWorldSettingOption('standard');
                    setRaceClassSource('standard_races_classes'); 
                    setGeneratedRaces(null);
                    setGeneratedClasses(null);
                }}
                className={`w-full text-left p-3 sm:p-4 bg-slate-800 rounded-lg shadow-md hover:bg-slate-700 transition-all duration-200 border-2 ${worldSettingOption === 'standard' ? 'border-purple-500 ring-2 ring-purple-500' : 'border-slate-700'}`}
              >
                <h3 className="text-md sm:text-lg font-semibold text-slate-100">Стандартный Фэнтези-Мир</h3>
                <p className="text-xs text-slate-400 mt-1">Классическое фэнтези. ИИ сам создаст детали. Используются стандартные расы и классы.</p>
              </button>
              <button
                onClick={() => setWorldSettingOption('custom')}
                className={`w-full text-left p-3 sm:p-4 bg-slate-800 rounded-lg shadow-md hover:bg-slate-700 transition-all duration-200 border-2 ${worldSettingOption === 'custom' ? 'border-purple-500 ring-2 ring-purple-500' : 'border-slate-700'}`}
              >
                <h3 className="text-md sm:text-lg font-semibold text-slate-100">Создать Собственный Мир</h3>
                <p className="text-xs text-slate-400 mt-1">Опишите уникальные черты вашего мира.</p>
              </button>
            </div>

            {worldSettingOption === 'custom' && (
              <div className="mt-6">
                <h3 className="text-lg sm:text-xl font-semibold text-purple-300 mb-3">Опишите ваш мир:</h3>
                <textarea
                  value={customWorldSettingText}
                  onChange={(e) => setCustomWorldSettingText(e.target.value)}
                  placeholder="Например: Мир постапокалиптической магии..."
                  rows={5}
                  className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none custom-scrollbar text-sm sm:text-base"
                  aria-label="Описание собственного мира"
                />
                <p className="text-xs text-slate-400 mt-2 mb-4">Чем подробнее описание, тем лучше ИИ сможет его интерпретировать.</p>

                <h3 className="text-md sm:text-lg font-semibold text-purple-300 mb-3">Расы и Классы для вашего Мира:</h3>
                <div className="space-y-2 mb-4">
                    <label className={`flex items-center p-3 rounded-lg cursor-pointer bg-slate-700 hover:bg-slate-600 border-2 ${raceClassSource === 'standard_races_classes' ? 'border-purple-500' : 'border-transparent'}`}>
                        <input type="radio" name="raceClassSource" value="standard_races_classes" checked={raceClassSource === 'standard_races_classes'} onChange={() => {setRaceClassSource('standard_races_classes'); setGeneratedRaces(null); setGeneratedClasses(null); setSelectedRaceId(null); setSelectedClassId(null);}} className="form-radio h-4 w-4 text-purple-600 bg-slate-600 border-slate-500 focus:ring-purple-500" />
                        <span className="ml-2 text-slate-200 text-sm">Использовать стандартные расы и классы</span>
                    </label>
                    <label className={`flex items-center p-3 rounded-lg cursor-pointer bg-slate-700 hover:bg-slate-600 border-2 ${raceClassSource === 'ai_generated_races_classes' ? 'border-purple-500' : 'border-transparent'}`}>
                        <input type="radio" name="raceClassSource" value="ai_generated_races_classes" checked={raceClassSource === 'ai_generated_races_classes'} onChange={() => {setRaceClassSource('ai_generated_races_classes'); setSelectedRaceId(null); setSelectedClassId(null);}} className="form-radio h-4 w-4 text-purple-600 bg-slate-600 border-slate-500 focus:ring-purple-500" />
                        <span className="ml-2 text-slate-200 text-sm">Сгенерировать расы и классы с помощью ИИ</span>
                    </label>
                </div>

                {raceClassSource === 'ai_generated_races_classes' && (
                    <>
                        {(!generatedRaces || !generatedClasses) && !isGeneratingWorldContent && (
                             <button
                                onClick={handleGenerateWorldRacesClasses}
                                disabled={isGeneratingWorldContent || !apiKeyAvailable || !customWorldSettingText.trim()}
                                className="w-full flex items-center justify-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 text-sm sm:text-base"
                            >
                                <SparklesIcon className="w-5 h-5 mr-2" />
                                {apiKeyAvailable ? "Сгенерировать Расы и Классы для Мира" : "Генерация ИИ отключена (Нет API-ключа)"}
                            </button>
                        )}
                        {isGeneratingWorldContent && (
                            <div className="flex justify-center items-center py-4">
                                <LoadingSpinner size="w-8 h-8" color="text-teal-400"/> 
                                <p className="ml-3 text-sm text-teal-300">ИИ создает расы и классы...</p>
                            </div>
                        )}
                        {generatedRaces && generatedClasses && !isGeneratingWorldContent && (
                            <div className="mt-3 p-3 bg-slate-600/50 rounded-lg">
                                <p className="text-sm text-green-400">Расы и классы сгенерированы! Вы сможете выбрать их на следующих шагах.</p>
                                <p className="text-xs text-slate-400">Сгенерировано рас: {generatedRaces.length}, классов: {generatedClasses.length}.</p>
                            </div>
                        )}
                    </>
                )}
              </div>
            )}
          </div>
        );
      case 3: // Race Selection
        return ( 
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-purple-300">Шаг 3: Выберите вашу расу</h2>
             {racesToDisplay.length === 0 && raceClassSource === 'ai_generated_races_classes' && <p className="text-yellow-400 text-center mb-4">Расы еще не сгенерированы. Вернитесь на шаг "Настройка Мира".</p>}
            <div className={`grid grid-cols-2 ${racesToDisplay.length > 2 ? 'sm:grid-cols-3 md:grid-cols-4' : 'sm:grid-cols-2'} gap-3 sm:gap-4`}>
              {racesToDisplay.map(race => (
                <button
                  key={race.id}
                  onClick={() => setSelectedRaceId(race.id)}
                  className={`p-3 sm:p-4 bg-slate-800 rounded-lg shadow-md hover:bg-slate-700 transition-all duration-200 border-2 ${selectedRaceId === race.id ? 'border-purple-500 ring-2 ring-purple-500' : 'border-slate-700'} flex flex-col items-center text-center`}
                >
                  {race.icon ? React.cloneElement<React.SVGProps<SVGSVGElement>>(race.icon, {className: "w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2"}) : <PlayerCharacterIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 text-slate-400"/>}
                  <h3 className="text-md sm:text-lg font-semibold mt-1 sm:mt-2 text-slate-100">{race.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 h-12 sm:h-16 overflow-y-auto custom-scrollbar">{race.description}</p>
                </button>
              ))}
            </div>
          </div>
        );
      case 4: // Class Selection
        return ( 
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-purple-300">Шаг 4: Выберите ваш класс</h2>
             {classesToDisplay.length === 0 && raceClassSource === 'ai_generated_races_classes' && <p className="text-yellow-400 text-center mb-4">Классы еще не сгенерированы. Вернитесь на шаг "Настройка Мира".</p>}
            <div className={`grid grid-cols-2 ${classesToDisplay.length > 2 ? 'sm:grid-cols-3 md:grid-cols-4' : 'sm:grid-cols-2'} gap-3 sm:gap-4`}>
              {classesToDisplay.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`p-3 sm:p-4 bg-slate-800 rounded-lg shadow-md hover:bg-slate-700 transition-all duration-200 border-2 ${selectedClassId === cls.id ? 'border-purple-500 ring-2 ring-purple-500' : 'border-slate-700'} flex flex-col items-center text-center`}
                >
                  {cls.icon ? React.cloneElement<React.SVGProps<SVGSVGElement>>(cls.icon, {className: "w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2"}) : <SparklesIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 text-slate-400"/>}
                  <h3 className="text-md sm:text-lg font-semibold mt-1 sm:mt-2 text-slate-100">{cls.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 h-12 sm:h-16 overflow-y-auto custom-scrollbar">{cls.description}</p>
                </button>
              ))}
            </div>
          </div>
        );
      case 5: // Backstory
        return ( 
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-purple-300">Шаг 5: Создайте свою предысторию</h2>
            <p className="text-sm text-slate-400 mb-4">Ваша история формирует вас. Это повлияет на ваши начальные характеристики, навыки и элементы мира с помощью ИИ!</p>
            <textarea
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              placeholder="Родившись в тихой деревне, я всегда мечтал(а) о приключениях..."
              rows={8}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none custom-scrollbar text-sm sm:text-base"
              aria-label="Предыстория персонажа"
            />
          </div>
        );
      case 6: // AI Analysis
        return (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-purple-300">Шаг 6: Улучшение предыстории с ИИ</h2>
            {!aiSuggestions && !isLoadingAi && (
                 <button
                    onClick={handleAnalyzeBackstory}
                    disabled={isLoadingAi || !apiKeyAvailable}
                    className="w-full flex items-center justify-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 text-sm sm:text-base"
                >
                    <SparklesIcon className="w-5 h-5 mr-2" />
                    {apiKeyAvailable ? "Анализировать предысторию с ИИ" : "Анализ ИИ отключен (Нет активного API-ключа)"}
                </button>
            )}
            {isLoadingAi && <div className="flex justify-center items-center py-8"><LoadingSpinner size="w-10 h-10 sm:w-12 sm:h-12" /> <p className="ml-3 text-md sm:text-lg">ИИ обдумывает вашу судьбу...</p></div>}
            {aiSuggestions && !isLoadingAi && (
              <div className="mt-6 p-3 sm:p-4 bg-slate-800 rounded-lg">
                <h3 className="text-lg sm:text-xl font-semibold text-purple-400 mb-3">Предложения ИИ:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h4 className="font-medium text-slate-300 mb-1 text-sm sm:text-base">Изменения характеристик:</h4>
                         <ul className="list-disc list-inside text-sm text-slate-400">
                            {STAT_NAMES_ORDERED.map(statName => {
                                const modifier = aiSuggestions.stat_modifiers[statName];
                                if (modifier && modifier !== 0) {
                                return <li key={statName}>{STAT_NAME_TRANSLATIONS[statName]}: {modifier > 0 ? `+${modifier}` : modifier}</li>;
                                }
                                return null;
                            })}
                             {(Object.values(aiSuggestions.stat_modifiers).every(val => val === 0)) && <li>Нет изменений характеристик от ИИ.</li>}
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-medium text-slate-300 mb-1 text-sm sm:text-base">Предложенные навыки:</h4>
                        <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
                            {aiSuggestions.skills && aiSuggestions.skills.length > 0 && !(aiSuggestions.skills[0].name === "Навыки не сгенерированы" || aiSuggestions.skills[0].name === "Ошибка генерации") ? 
                                aiSuggestions.skills.map((skill: Skill, index: number) => (
                                  <li key={index} title={skill.description}>
                                    <strong className="cursor-help">{skill.name}</strong>
                                  </li>
                                )) :
                                <li>Нет предложенных навыков.</li>
                            }
                        </ul>
                    </div>
                </div>
                <div className="mt-3">
                  <h4 className="font-medium text-slate-300 mb-1 text-sm sm:text-base">Уникальные элементы мира:</h4>
                  <ul className="list-disc list-inside text-sm text-slate-400">
                    {aiSuggestions.world_elements.map((el, index) => <li key={index}>{el}</li>)}
                  </ul>
                </div>
                <p className="text-xs text-slate-500 mt-4">Эти предложения были применены. На следующем шаге вы сможете их скорректировать.</p>
              </div>
            )}
          </div>
        );
      case 7: // Manual Stats
        if (!statsAfterAi || !currentStats) { 
            return <div className="text-center py-8">Загрузка данных для корректировки...</div>;
        }
        const pointsAvailableToAdd = MANUAL_POINTS_POOL - totalPointsDelta;
        const pointsAvailableToReduce = MANUAL_POINTS_POOL + totalPointsDelta;

        return (
            <div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2 text-purple-300">Шаг 7: Ручная корректировка характеристик</h2>
                
                <div className="my-4 p-3 bg-slate-700/80 rounded-lg border border-slate-600">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isGodModeEnabled}
                      onChange={(e) => setIsGodModeEnabled(e.target.checked)}
                      className="form-checkbox h-5 w-5 text-yellow-400 bg-slate-600 border-slate-500 rounded focus:ring-yellow-400 focus:ring-offset-slate-800"
                      aria-describedby="godModeDescriptionManualStats"
                    />
                    <span className="ml-3 text-yellow-300 font-medium text-sm sm:text-base">Режим Бога (безлимитные очки)</span>
                  </label>
                  {isGodModeEnabled && <p id="godModeDescriptionManualStats" className="text-xs text-yellow-500 mt-1">Лимиты на распределение очков отключены.</p>}
                </div>

                <p className="text-sm text-slate-400 mb-1">
                    Баланс изменений от ИИ: <strong className={totalPointsDelta > 0 ? 'text-green-400' : totalPointsDelta < 0 ? 'text-red-400' : 'text-slate-300'}>{totalPointsDelta >= 0 ? '+' : ''}{totalPointsDelta}</strong>
                </p>
                {!isGodModeEnabled ? (
                    <>
                        <p className="text-sm text-slate-400 mb-1">
                            Бюджет на изменение: <strong className="text-purple-300">±{MANUAL_POINTS_POOL}</strong> очков.
                        </p>
                        <p className="text-sm text-slate-400 mb-4">
                            (Можно <strong className="text-green-400">добавить {Math.max(0, pointsAvailableToAdd)}</strong> / <strong className="text-red-400">уменьшить на {Math.max(0, pointsAvailableToReduce)}</strong>)
                        </p>
                    </>
                ) : (
                    <p className="text-sm text-yellow-400 mb-4 font-semibold">
                        РЕЖИМ БОГА: Лимиты отключены. Мин. значение: {MIN_STAT_VALUE}.
                    </p>
                )}

                <div className="space-y-2 sm:space-y-3">
                    {STAT_NAMES_ORDERED.map(statName => (
                        <div key={statName} className="flex items-center justify-between p-2 sm:p-3 bg-slate-700 rounded-lg">
                            <label htmlFor={statName} className="text-sm sm:text-md font-medium text-slate-200 w-1/3">{STAT_NAME_TRANSLATIONS[statName]}</label>
                            <div className="flex items-center space-x-1 sm:space-x-2">
                                <button 
                                    onClick={() => handleManualStatChange(statName, 'decrement')}
                                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded-md text-white text-md sm:text-lg font-semibold disabled:opacity-50 transition-colors"
                                    disabled={(currentStats[statName] || BASE_STAT_VALUE) <= MIN_STAT_VALUE || (!isGodModeEnabled && totalPointsDelta <= -MANUAL_POINTS_POOL)}
                                    aria-label={`Уменьшить ${STAT_NAME_TRANSLATIONS[statName]}`}
                                >-</button>
                                <span id={statName} className="w-10 sm:w-12 p-1 text-center text-lg sm:text-xl font-bold text-white tabular-nums">
                                  {currentStats[statName] || BASE_STAT_VALUE}
                                </span>
                                 <button 
                                    onClick={() => handleManualStatChange(statName, 'increment')}
                                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-green-600 hover:bg-green-700 rounded-md text-white text-md sm:text-lg font-semibold disabled:opacity-50 transition-colors"
                                    disabled={!isGodModeEnabled && totalPointsDelta >= MANUAL_POINTS_POOL}
                                    aria-label={`Увеличить ${STAT_NAME_TRANSLATIONS[statName]}`}
                                >+</button>
                            </div>
                             <div className="w-16 sm:w-20 text-right">
                                <span className="text-xs text-slate-500">База ИИ: {statsAfterAi[statName] || BASE_STAT_VALUE}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 8: // Review
        const raceRev = racesToDisplay.find(r => r.id === selectedRaceId);
        const classRev = classesToDisplay.find(c => c.id === selectedClassId);
        const modelRev = AVAILABLE_AI_MODELS.find(m => m.id === selectedAiModelId);
        const defaultErrorSkillNames = ["Навыки не сгенерированы", "Ошибка генерации", "Нет сгенерированных навыков"];
        const displaySkills = aiSuggestions?.skills && aiSuggestions.skills.length > 0 && 
                              !(aiSuggestions.skills.length === 1 && defaultErrorSkillNames.includes(aiSuggestions.skills[0].name));

        let raceIconDisplay;
        if (raceRev?.icon) {
            const IconType = raceRev.icon.type as React.FC<{ className?: string }>;
            raceIconDisplay = <IconType className="w-20 h-20 sm:w-28 sm:h-28 text-purple-300" />;
        } else {
            raceIconDisplay = <PlayerCharacterIcon className="w-20 h-20 sm:w-28 sm:h-28 text-purple-300" />;
        }

        return (
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-purple-300">Шаг 8: Ваш персонаж готов!</h2>
                <div className="bg-slate-800 p-4 sm:p-6 rounded-xl shadow-2xl max-w-2xl mx-auto">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-6">
                        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-purple-500 flex items-center justify-center bg-slate-700 shrink-0">
                           {raceIconDisplay}
                        </div>
                        <div className="text-center sm:text-left">
                            <h3 className="text-2xl sm:text-3xl font-bold text-white">{characterName}</h3>
                            <p className="text-md sm:text-lg text-purple-400">{raceRev?.name} {classRev?.name}</p>
                            <p className="text-sm text-slate-300">Уровень 1</p>
                            {isNsfwEnabled && <p className="text-xs sm:text-sm text-red-400 mt-1">(Режим 18+ Активен)</p>}
                            {modelRev && <p className="text-xs text-slate-400 mt-1">Модель ИИ: {apiKeyAvailable ? modelRev.name : "Не выбрана (Нет API-ключа)"}</p>}
                        </div>
                    </div>
                    
                    <div className="mb-4">
                        <h4 className="text-md sm:text-lg font-semibold text-purple-400 mb-2">Сеттинг Мира:</h4>
                        <div className="bg-slate-700 p-3 rounded">
                          {worldSettingOption === 'custom' && customWorldSettingText.trim() ? (
                            <>
                              <p className="text-sm font-medium text-slate-300 mb-1">
                                {raceClassSource === 'ai_generated_races_classes' ? "Пользовательский мир (расы/классы от ИИ):" : "Пользовательский мир (стандартные расы/классы):"}
                              </p>
                              <p className="text-xs text-slate-200 max-h-20 overflow-y-auto custom-scrollbar">{customWorldSettingText}</p>
                            </>
                          ) : (
                            <p className="text-sm text-slate-300">Стандартный Фэнтези-Мир</p>
                          )}
                        </div>
                    </div>

                    <div className="mb-4">
                        <h4 className="text-md sm:text-lg font-semibold text-purple-400 mb-2">Итоговые характеристики:</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 sm:gap-x-4 gap-y-1 sm:gap-y-2">
                            {STAT_NAMES_ORDERED.map(statName => (
                                <div key={statName} className="flex justify-between items-center bg-slate-700 p-2 rounded">
                                    <span className="text-xs sm:text-sm font-medium text-slate-300">{STAT_NAME_TRANSLATIONS[statName]}:</span>
                                    <span className="text-md sm:text-lg font-bold text-white">{currentStats[statName] ?? BASE_STAT_VALUE}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {displaySkills && aiSuggestions?.skills && (
                        <div className="mb-4">
                            <h4 className="text-md sm:text-lg font-semibold text-purple-400 mb-2">Навыки:</h4>
                             <ul className="list-disc list-inside text-sm text-slate-300 bg-slate-700 p-3 rounded space-y-1">
                                {aiSuggestions.skills.map((skill: Skill, index: number) => (
                                  <li key={index} title={skill.description}>
                                    <strong className="cursor-help">{skill.name}</strong>
                                  </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    <div className="mb-4">
                        <h4 className="text-md sm:text-lg font-semibold text-purple-400 mb-2">Краткая предыстория:</h4>
                        <p className="text-sm text-slate-300 bg-slate-700 p-3 rounded max-h-28 overflow-y-auto custom-scrollbar">{backstory}</p>
                    </div>

                    {aiSuggestions?.world_elements && aiSuggestions.world_elements.length > 0 && 
                     !["Нет особых элементов мира из предыстории.", "Анализ ИИ не удался.", "ИИ не смог интерпретировать предысторию, поэтому мир пока остается загадкой.", "Функции ИИ отключены из-за отсутствия API-ключа.", "Функции ИИ отключены из-за отсутствия активного API-ключа."].includes(aiSuggestions.world_elements[0]) &&
                     (
                        <div>
                            <h4 className="text-md sm:text-lg font-semibold text-purple-400 mb-2">Элементы мира из предыстории:</h4>
                            <ul className="list-disc list-inside text-sm text-slate-300 bg-slate-700 p-3 rounded">
                                {aiSuggestions.world_elements.map((el, index) => <li key={index}>{el}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        );
      default:
        return <div>Неизвестный шаг</div>;
    }
  };

  const progressPercentage = ((step -1) / 7) * 100; 

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 sm:p-4 bg-slate-900 text-slate-100">
      <div className="w-full max-w-2xl bg-slate-800 shadow-2xl rounded-xl p-4 sm:p-8 md:p-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-2 text-purple-400">Создайте своего героя</h1>
        <p className="text-center text-slate-400 text-sm sm:text-base mb-6 sm:mb-8">Следуйте шагам, чтобы воплотить вашего персонажа в жизнь.</p>
        
        <div className="w-full bg-slate-700 rounded-full h-2 sm:h-2.5 mb-6 sm:mb-8">
            <div className="bg-purple-600 h-2 sm:h-2.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercentage}%` }}></div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500 text-white rounded-lg text-sm" role="alert">{error}</div>}
        
        <div className="min-h-[300px] sm:min-h-[350px] mb-6 sm:mb-8"> 
            {renderStepContent()}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 sm:mt-8 space-y-3 sm:space-y-0">
          <button
            onClick={handlePrevStep}
            disabled={step === 1}
            className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-3 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text-base"
          >
            <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2"/> Назад
          </button>
          {step < 8 ? ( 
             <button
                onClick={handleNextStep}
                disabled={
                    (step === 1 && !apiKeyAvailable && !manualApiKeyInput) || // Waiting for manual key input at step 1
                    (step === 2 && worldSettingOption === 'custom' && raceClassSource === 'ai_generated_races_classes' && (!generatedRaces || !generatedClasses) && !isGeneratingWorldContent && apiKeyAvailable) || 
                    (step === 2 && isGeneratingWorldContent) || 
                    (step === 6 && !aiSuggestions && apiKeyAvailable && !isLoadingAi) || 
                    (step === 6 && isLoadingAi) 
                }
                className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text-base"
             >
                {step === 7 ? 'Обзор персонажа' : step === 6 ? 'К ручной настройке' : 'Далее'} <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5 ml-2"/>
            </button>
          ) : (
            <button
              onClick={handleFinalizeCharacter}
              className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center text-sm sm:text-base"
            >
              Начать приключение! <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5 ml-2"/>
            </button>
          )}
        </div>
      </div>
       <footer className="text-center text-xs text-slate-500 mt-6 sm:mt-8">
            Создано с помощью Gemini AI и вашего воображения
        </footer>
    </div>
  );
};

export default CharacterCreator;
