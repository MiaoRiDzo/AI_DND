
import React, { useState, useEffect } from 'react';
import { DiceRollRequest, Stats, SingleStatRollResult, DiceRollReport, StatName } from '../types';
import { STAT_NAME_TRANSLATIONS, BASE_STAT_VALUE } from '../constants';
import LoadingSpinner from './LoadingSpinner';

interface DiceRollerProps {
  request: DiceRollRequest;
  characterStats: Stats;
  onRollComplete: (report: DiceRollReport) => void;
}

const DiceRoller: React.FC<DiceRollerProps> = ({ request, characterStats, onRollComplete }) => {
  const [isRolling, setIsRolling] = useState(false);
  const [results, setResults] = useState<SingleStatRollResult[] | null>(null);
  const [animatedValues, setAnimatedValues] = useState<{[key in StatName]?: number}>({});

  const performRoll = () => {
    setIsRolling(true);
    setResults(null);

    const rollResults: SingleStatRollResult[] = request.statsToRoll.map(statName => {
      const statValue = characterStats[statName] ?? BASE_STAT_VALUE;
      const modifier = Math.floor((statValue - 10) / 2);
      const diceValue = 1 + Math.floor(Math.random() * 20);
      const totalValue = diceValue + modifier;
      return { statName, diceValue, modifier, totalValue };
    });

    // Простая анимация
    let animationInterval: number; 
    let animationCycles = 0;
    const maxAnimationCycles = 10; // Количество быстрых смен чисел

    animationInterval = window.setInterval(() => {
      const currentAnimated: {[key in StatName]?: number} = {};
      request.statsToRoll.forEach(stat => {
        currentAnimated[stat] = 1 + Math.floor(Math.random() * 20);
      });
      setAnimatedValues(currentAnimated);
      animationCycles++;
      if (animationCycles >= maxAnimationCycles) {
        window.clearInterval(animationInterval);
        setResults(rollResults);
        setIsRolling(false);
        // Автоматическая отправка результатов после отображения
        setTimeout(() => {
            onRollComplete({
                rollId: request.id,
                rollDescription: request.description,
                results: rollResults
            });
        }, 1500); // Задержка перед отправкой, чтобы игрок увидел результат
      }
    }, 100); // Интервал смены чисел
  };

  useEffect(() => {
    if (!isRolling && !results) {
      performRoll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id, isRolling, results]);


  if (results) {
    return (
      <div className="w-full max-w-xs sm:max-w-md p-3 sm:p-4 bg-slate-700 rounded-lg shadow-xl border border-purple-600">
        <h3 className="text-md sm:text-lg font-semibold text-purple-300 mb-2 text-center sm:text-left">Результаты броска:</h3>
        <p className="text-xs sm:text-sm text-slate-300 mb-2 text-center sm:text-left">"{request.description}"</p>
        <div className="space-y-2">
          {results.map(res => (
            <div key={res.statName} className="p-2 bg-slate-600 rounded">
              <p className="text-sm sm:text-md font-medium text-slate-100">
                {STAT_NAME_TRANSLATIONS[res.statName]}: 
                <span className="text-lg sm:text-xl font-bold text-white ml-2">{res.totalValue}</span>
              </p>
              <p className="text-xs text-slate-400">
                (D20: {res.diceValue}, Мод: {res.modifier >= 0 ? `+${res.modifier}` : res.modifier})
              </p>
            </div>
          ))}
        </div>
         <p className="text-xs text-slate-500 mt-3 text-center italic">Отправка результатов Мастеру...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs sm:max-w-md p-4 sm:p-6 bg-slate-700 rounded-lg shadow-xl border-2 border-purple-500 text-center">
      <h3 className="text-lg sm:text-xl font-bold text-purple-300 mb-2">Требуется бросок!</h3>
      <p className="text-sm text-slate-300 mb-1">Действие: <span className="font-semibold">{request.description}</span></p>
      <p className="text-sm text-slate-300 mb-4">
        Характеристики: {request.statsToRoll.map(s => STAT_NAME_TRANSLATIONS[s]).join(', ')}
      </p>
      
      <div className="my-4">
          <div className="flex justify-center items-center space-x-2 sm:space-x-4 mb-2">
               {request.statsToRoll.map(stat => (
                  <div key={stat} className="p-2 sm:p-3 bg-slate-800 rounded-lg w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center">
                      <span className="text-2xl sm:text-3xl font-bold text-purple-400 animate-pulse">
                          {animatedValues[stat] || '?'}
                      </span>
                  </div>
              ))}
          </div>
        <LoadingSpinner size="w-6 h-6" color="text-purple-400" className="mx-auto" />
        <p className="text-purple-400 mt-2 text-sm">Бросаем кубики...</p>
      </div>
    </div>
  );
};

export default DiceRoller;
