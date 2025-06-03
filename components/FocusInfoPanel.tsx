
import React from 'react';
import { FocusTargetInfo } from '../types';
import { TargetIcon } from './icons'; // Assuming you have a TargetIcon

interface FocusInfoPanelProps {
  focusTargetInfo: FocusTargetInfo | null;
}

const FocusInfoPanel: React.FC<FocusInfoPanelProps> = ({ focusTargetInfo }) => {
  return (
    <div className="bg-slate-800 p-4 rounded-lg shadow-lg flex-1 min-h-0 flex flex-col"> {/* Changed: flex-1, min-h-0, flex flex-col */}
      <div className="flex items-center mb-3 flex-shrink-0"> {/* Added flex-shrink-0 */}
        <TargetIcon className="w-6 h-6 text-purple-400 mr-3 flex-shrink-0" />
        <h2 className="text-xl font-bold text-purple-400">В Фокусе</h2>
      </div>

      {/* Scrollable content area */}
      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2"> {/* Changed: Added wrapper for scroll */}
        {focusTargetInfo ? (
          <div className="space-y-2 text-sm">
            <div className="bg-slate-700 p-2 rounded">
              <p className="text-lg font-semibold text-slate-100">{focusTargetInfo.name}</p>
              <p className="text-xs text-purple-300">{focusTargetInfo.type}{focusTargetInfo.role ? ` - ${focusTargetInfo.role}` : ''}</p>
            </div>

            {(focusTargetInfo.hp !== undefined || focusTargetInfo.maxHp !== undefined) && (
              <div className="bg-slate-700 p-2 rounded">
                <span className="text-slate-300 font-medium">Здоровье: </span>
                <span className="text-white">
                  {focusTargetInfo.hp !== undefined ? focusTargetInfo.hp : '??'}
                  {focusTargetInfo.maxHp !== undefined ? ` / ${focusTargetInfo.maxHp}` : ''}
                </span>
              </div>
            )}

            {focusTargetInfo.status && (
              <div className="bg-slate-700 p-2 rounded">
                  <span className="text-slate-300 font-medium">Статус: </span>
                  <span className="text-white">{focusTargetInfo.status}</span>
              </div>
            )}
            
            {focusTargetInfo.description && (
              <div className="bg-slate-700 p-2 rounded">
                  <p className="text-slate-300 font-medium mb-1">Описание:</p>
                  <p className="text-xs text-slate-200 italic">{focusTargetInfo.description}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">Сейчас никто конкретно не в фокусе.</p>
        )}
      </div>
    </div>
  );
};

export default FocusInfoPanel;
