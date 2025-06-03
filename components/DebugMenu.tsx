
import React from 'react';
import { XMarkIcon } from './icons'; 

interface DebugMenuProps {
  onClose: () => void;
  onForceLevelUp: () => void;
  lastAiResponseTokenCount: number | null; 
  onSaveGame: () => void;
  lastAutosaveStatus: { timestamp: string; success: boolean } | null; 
  onStartNewGame: () => void; // New prop
}

const DebugMenu: React.FC<DebugMenuProps> = ({ 
    onClose, 
    onForceLevelUp, 
    lastAiResponseTokenCount, 
    onSaveGame, 
    lastAutosaveStatus,
    onStartNewGame // New prop
}) => {
  return (
    <div className="fixed top-16 right-4 z-40 bg-slate-800 border border-purple-500 p-3 sm:p-4 rounded-lg shadow-xl w-5/6 max-w-xs sm:w-64">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-md sm:text-lg font-semibold text-purple-400">Меню Игры</h3> {/* Changed title */}
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 -mr-1" aria-label="Закрыть меню игры">
          <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>
      <div className="space-y-2">
        <button
          onClick={onStartNewGame} // Added handler
          className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm rounded-md transition-colors"
        >
          Начать Новую Игру
        </button>
        <button
          onClick={onSaveGame}
          className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm rounded-md transition-colors"
        >
          Сохранить Игру (Ручное)
        </button>
         <button
          onClick={onForceLevelUp}
          className="w-full px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm rounded-md transition-colors"
        >
          Симулировать Level Up
        </button>
        <div className="mt-2 pt-2 border-t border-slate-700">
          <p className="text-xs text-slate-400">Токены ответа ИИ: 
            <span className="font-semibold text-sky-300 ml-1">
              {lastAiResponseTokenCount !== null ? lastAiResponseTokenCount : 'Н/Д'}
            </span>
          </p>
           {lastAutosaveStatus && lastAutosaveStatus.success && (
            <p className="text-xs text-slate-400 mt-1">
              Автосохранение: <span className="font-semibold text-green-400 ml-1">{new Date(lastAutosaveStatus.timestamp).toLocaleTimeString('ru-RU')}</span>
            </p>
          )}
          {lastAutosaveStatus && !lastAutosaveStatus.success && (
            <p className="text-xs text-red-400 mt-1">
              Ошибка автосохранения! ({new Date(lastAutosaveStatus.timestamp).toLocaleTimeString('ru-RU')})
            </p>
          )}
          {!lastAutosaveStatus && (
               <p className="text-xs text-slate-500 mt-1">Автосохранение еще не было.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebugMenu;
