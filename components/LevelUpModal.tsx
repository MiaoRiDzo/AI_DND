
import React, { useState, useEffect } from 'react';
import { Character, StatName, Stats, LevelUpPayload, Skill } from '../types';
import { STAT_NAMES_ORDERED, STAT_NAME_TRANSLATIONS, BASE_STAT_VALUE } from '../constants';
import { generateLevelUpAbilityChoices } from '../services/geminiService'; // Import AI service
import LoadingSpinner from './LoadingSpinner'; // Import LoadingSpinner
import { XMarkIcon } from './icons'; // Import XMarkIcon

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character; 
  onLevelUpComplete: (payload: LevelUpPayload) => void;
  apiKeyAvailable: boolean; // To check if AI features can be used
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ isOpen, onClose, character, onLevelUpComplete, apiKeyAvailable }) => {
  const [selectedStat, setSelectedStat] = useState<StatName | null>(null);
  const [selectedAbility, setSelectedAbility] = useState<Skill | null>(null);
  const [generatedAbilities, setGeneratedAbilities] = useState<Skill[] | null>(null);
  const [isLoadingAbilities, setIsLoadingAbilities] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [canConfirm, setCanConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedStat(null); 
      setSelectedAbility(null);
      setGeneratedAbilities(null);
      setAiError(null);
      setCanConfirm(false);

      if (apiKeyAvailable) {
        setIsLoadingAbilities(true);
        generateLevelUpAbilityChoices(character)
          .then(abilities => {
            if (abilities && abilities.length > 0) {
              setGeneratedAbilities(abilities);
            } else {
              setAiError("ИИ не смог предложить способности. Вы можете продолжить без выбора новой способности.");
              setGeneratedAbilities([]); // Ensure it's an empty array for logic
            }
          })
          .catch(err => {
            console.error("Error fetching abilities:", err);
            setAiError("Ошибка при генерации способностей ИИ. Вы можете продолжить без выбора новой способности.");
            setGeneratedAbilities([]); // Ensure it's an empty array for logic
          })
          .finally(() => {
            setIsLoadingAbilities(false);
          });
      } else {
        setGeneratedAbilities([]); // No API key, so no abilities to generate
        setIsLoadingAbilities(false);
      }
    }
  }, [isOpen, character, apiKeyAvailable]);

  useEffect(() => {
    // Confirmation requires a stat AND (an ability OR (loading is done AND no abilities are available/needed))
    const abilitiesAvailableOrNotNeeded = !isLoadingAbilities && (generatedAbilities === null || generatedAbilities.length === 0 || selectedAbility !== null);
    setCanConfirm(selectedStat !== null && abilitiesAvailableOrNotNeeded);
  }, [selectedStat, selectedAbility, generatedAbilities, isLoadingAbilities]);

  if (!isOpen) {
    return null;
  }

  const handleStatSelection = (statName: StatName) => {
    setSelectedStat(statName);
  };

  const handleAbilitySelection = (ability: Skill) => {
    setSelectedAbility(ability);
  };

  const handleSubmitLevelUp = () => {
    if (selectedStat) { // selectedAbility can be null if AI fails or not used
      onLevelUpComplete({
        chosenStatIncrease: selectedStat,
        chosenAbility: selectedAbility,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="levelUpModalTitle">
      <div className="bg-slate-800 p-4 sm:p-6 rounded-lg shadow-xl max-w-md sm:max-w-lg w-full border-2 border-purple-500 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 id="levelUpModalTitle" className="text-xl sm:text-2xl font-bold text-purple-400">Повышение уровня!</h2>
          <button 
            onClick={onClose} 
            className="p-1 text-slate-400 hover:text-slate-200"
            aria-label="Закрыть модальное окно повышения уровня"
          >
            <XMarkIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        </div>
        
        <div className="text-slate-300 overflow-y-auto custom-scrollbar pr-1 sm:pr-2 flex-grow">
          <p className="mb-4 text-sm sm:text-base">Поздравляем, <strong className="text-white">{character.name}</strong>! Вы достигли <strong className="text-yellow-300">Уровня {character.level + 1}</strong>.</p>
          
          <div className="mb-4 sm:mb-6 p-3 bg-slate-700 rounded-md">
            <h3 className="text-md sm:text-lg font-semibold text-purple-300 mb-2">Улучшение Здоровья:</h3>
            <p className="text-xs sm:text-sm">Ваше максимальное здоровье увеличится. Текущее здоровье будет полностью восстановлено.</p>
          </div>

          <div className="mb-4 sm:mb-6 p-3 bg-slate-700 rounded-md">
            <h3 className="text-md sm:text-lg font-semibold text-purple-300 mb-2">Улучшение Характеристики:</h3>
            <p className="text-xs sm:text-sm mb-3">Выберите одну характеристику, чтобы увеличить её на <strong className="text-green-400">+1</strong>.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STAT_NAMES_ORDERED.map(statName => (
                <button
                  key={statName}
                  onClick={() => handleStatSelection(statName)}
                  className={`p-2 sm:p-3 rounded-md text-xs sm:text-sm font-medium transition-all duration-150
                              ${selectedStat === statName 
                                ? 'bg-purple-600 text-white ring-2 ring-purple-300' 
                                : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}
                >
                  {STAT_NAME_TRANSLATIONS[statName]} ({character.stats[statName] || BASE_STAT_VALUE})
                </button>
              ))}
            </div>
          </div>
          
          {apiKeyAvailable && (generatedAbilities || isLoadingAbilities || aiError) && (
            <div className="mb-4 sm:mb-6 p-3 bg-slate-700 rounded-md">
              <h3 className="text-md sm:text-lg font-semibold text-purple-300 mb-2">Выберите Новую Способность:</h3>
              {isLoadingAbilities && (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner size="w-7 h-7 sm:w-8 sm:h-8" color="text-purple-400" />
                  <p className="ml-3 text-xs sm:text-sm text-purple-300">ИИ подбирает способности...</p>
                </div>
              )}
              {aiError && !isLoadingAbilities && (
                <p className="text-xs sm:text-sm text-yellow-400 italic">{aiError}</p>
              )}
              {!isLoadingAbilities && generatedAbilities && generatedAbilities.length > 0 && (
                <div className="space-y-2">
                  {generatedAbilities.map((ability, index) => (
                    <button
                      key={index}
                      onClick={() => handleAbilitySelection(ability)}
                      className={`w-full text-left p-2 sm:p-3 rounded-md transition-all duration-150 group
                                  ${selectedAbility?.name === ability.name 
                                    ? 'bg-purple-600 text-white ring-2 ring-purple-300' 
                                    : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}
                    >
                      <p className="font-semibold text-xs sm:text-sm">{ability.name}</p>
                      <p className="text-xs mt-1 text-slate-300 group-hover:text-slate-100 transition-colors">{ability.description}</p>
                    </button>
                  ))}
                </div>
              )}
               {!isLoadingAbilities && generatedAbilities && generatedAbilities.length === 0 && !aiError && (
                 <p className="text-xs sm:text-sm text-slate-400 italic">ИИ не предложил новых способностей на этом уровне, или они не требуются.</p>
               )}
            </div>
          )}
           {!apiKeyAvailable && 
             <div className="mb-4 sm:mb-6 p-3 bg-slate-700 rounded-md">
                <p className="text-xs sm:text-sm text-yellow-500 italic">Генерация способностей ИИ недоступна (API-ключ не настроен).</p>
             </div>
           }
        </div>

        <button 
            onClick={handleSubmitLevelUp}
            disabled={!canConfirm || isLoadingAbilities}
            className="w-full mt-4 px-4 py-2 sm:py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 text-sm sm:text-base"
        >
            {isLoadingAbilities ? 'Загрузка способностей...' : 'Завершить Повышение Уровня'}
        </button>
      </div>
    </div>
  );
};

export default LevelUpModal;
