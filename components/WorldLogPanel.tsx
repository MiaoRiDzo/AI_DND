import React from 'react';
import { Character } from '../types';
import { InfoIcon } from './icons'; // Предполагаем, что InfoIcon подходит или можно создать BookIcon/ScrollIcon

interface WorldLogPanelProps {
  character: Character;
}

const WorldLogPanel: React.FC<WorldLogPanelProps> = ({ character }) => {
  const worldElementsExist = character.worldElements && character.worldElements.length > 0 &&
    !["Нет особых элементов мира из предыстории.",
      "Анализ ИИ не удался.",
      "ИИ не смог интерпретировать предысторию, поэтому мир пока остается загадкой.",
      "Функции ИИ отключены из-за отсутствия API-ключа."].includes(character.worldElements[0]);

  return (
    <div className="bg-slate-800 p-4 rounded-lg shadow-lg h-full flex flex-col">
      <div className="flex items-center mb-4">
        <InfoIcon className="w-6 h-6 text-purple-400 mr-3 flex-shrink-0" />
        <h2 className="text-xl font-bold text-purple-400">Дневник Мира</h2>
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
        {worldElementsExist ? (
          <div>
            <h3 className="text-md font-semibold text-purple-300 mb-2">Ключевые Элементы Мира:</h3>
            <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 bg-slate-700 p-3 rounded">
              {character.worldElements.map((element, index) => (
                <li key={index}>{element}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">Пока нет особых заметок о мире. Они появятся по мере развития предыстории и игры.</p>
        )}

        {/* Placeholder for future Quests log */}
        <div className="mt-6">
            <h3 className="text-md font-semibold text-purple-300 mb-2">Активные Задания:</h3>
            <p className="text-sm text-slate-400 italic">Пока нет активных заданий.</p>
        </div>
      </div>
       <p className="text-xs text-slate-500 mt-4 text-center">Этот дневник будет пополняться.</p>
    </div>
  );
};

export default WorldLogPanel;
