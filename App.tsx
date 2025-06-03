
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CharacterCreator from './components/CharacterCreator';
import ChatInterface, { ChatInterfaceHandle } from './components/ChatInterface';
import { Character, GamePhase, ChatMessage, FocusTargetInfo, SavedGame } from './types';
import { API_KEY_ERROR_MESSAGE, SAVE_GAME_KEY } from './constants';
import LoadingSpinner from './components/LoadingSpinner';
// Removed DebugMenu import from here
import { clearManualApiKey } from './services/geminiService'; 

const App: React.FC = () => {
  const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.Loading);
  const [character, setCharacter] = useState<Character | null>(null);
  const [apiKeyAvailable, setApiKeyAvailable] = useState<boolean | null>(null); 
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // showGameMenu state removed from App.tsx
  const [forceLevelUpTrigger, setForceLevelUpTrigger] = useState<number>(0);
  const [lastAiResponseTokenCount, setLastAiResponseTokenCount] = useState<number | null>(null);

  const [savedGameData, setSavedGameData] = useState<SavedGame | null>(null);
  const [initialChatHistory, setInitialChatHistory] = useState<ChatMessage[] | undefined>(undefined);
  const [initialFocusTargetInfo, setInitialFocusTargetInfo] = useState<FocusTargetInfo | null | undefined>(undefined);
  
  const chatInterfaceRef = useRef<ChatInterfaceHandle | null>(null); // This ref might still be used for App-level actions on ChatInterface
  const [lastAutosaveStatus, setLastAutosaveStatus] = useState<{ timestamp: string; success: boolean } | null>(null);


  const performInitialSetup = useCallback(() => {
    let keyFromEnv: string | undefined = undefined;
    if (typeof process !== 'undefined' && process.env) {
      keyFromEnv = process.env.API_KEY;
    }

    if (keyFromEnv && keyFromEnv !== "YOUR_API_KEY_HERE_PLACEHOLDER" && keyFromEnv.length > 10) { 
      setApiKeyAvailable(true);
      setErrorMessage(null);
    } else {
      setApiKeyAvailable(false);
    }
    clearManualApiKey(); 

    const savedGameJson = localStorage.getItem(SAVE_GAME_KEY);
    if (savedGameJson) {
      try {
        const game = JSON.parse(savedGameJson) as SavedGame;
        if (game.character && game.chatHistory && game.lastSaved) {
          setSavedGameData(game);
          setGamePhase(GamePhase.LoadPrompt);
        } else {
          localStorage.removeItem(SAVE_GAME_KEY);
          setGamePhase(GamePhase.CharacterCreation);
        }
      } catch (e) {
        console.error("Error parsing saved game:", e);
        localStorage.removeItem(SAVE_GAME_KEY);
        setGamePhase(GamePhase.CharacterCreation);
      }
    } else {
      setGamePhase(GamePhase.CharacterCreation);
    }
  }, []);

  useEffect(() => {
    performInitialSetup();
  }, [performInitialSetup]);

  const handleCharacterCreated = (newCharacter: Character) => {
    setCharacter(newCharacter);
    setInitialChatHistory(undefined); 
    setInitialFocusTargetInfo(undefined);
    setLastAutosaveStatus(null); 
    setGamePhase(GamePhase.Gameplay);
    if (!apiKeyAvailable) { 
        setErrorMessage(API_KEY_ERROR_MESSAGE); 
    } else {
        setErrorMessage(null);
    }
  };

  const handleManualKeyProvided = (success: boolean) => {
    setApiKeyAvailable(success);
    if (success) {
        setErrorMessage(null); 
    }
  };

  const handleAiResponseTokenCount = (count: number) => {
    setLastAiResponseTokenCount(count);
  };

  const handleContinueSavedGame = () => {
    if (savedGameData) {
      setCharacter(savedGameData.character);
      setInitialChatHistory(savedGameData.chatHistory);
      setInitialFocusTargetInfo(savedGameData.focusTargetInfo);
      setLastAutosaveStatus({ timestamp: savedGameData.lastSaved, success: true }); 
      setErrorMessage(null); 
      setGamePhase(GamePhase.Gameplay);
      setSavedGameData(null); 
      
        let keyFromEnv: string | undefined = undefined;
        if (typeof process !== 'undefined' && process.env) {
            keyFromEnv = process.env.API_KEY;
        }
        clearManualApiKey(); 
        if (keyFromEnv && keyFromEnv !== "YOUR_API_KEY_HERE_PLACEHOLDER" && keyFromEnv.length > 10) {
            setApiKeyAvailable(true);
        } else {
            setApiKeyAvailable(false); 
        }
    }
  };

  const resetToNewGame = useCallback(() => { // Wrapped in useCallback as it's passed down
    localStorage.removeItem(SAVE_GAME_KEY);
    setCharacter(null);
    setInitialChatHistory(undefined);
    setInitialFocusTargetInfo(undefined);
    setLastAutosaveStatus(null);
    setGamePhase(GamePhase.CharacterCreation);
    setSavedGameData(null);
    setForceLevelUpTrigger(0); // Reset trigger
    setLastAiResponseTokenCount(null);
    
    let keyFromEnv: string | undefined = undefined;
    if (typeof process !== 'undefined' && process.env) {
      keyFromEnv = process.env.API_KEY;
    }
    clearManualApiKey(); 

    if (keyFromEnv && keyFromEnv !== "YOUR_API_KEY_HERE_PLACEHOLDER" && keyFromEnv.length > 10) {
      setApiKeyAvailable(true);
      setErrorMessage(null);
    } else {
      setApiKeyAvailable(false);
    }
  }, []);


  const handleStartNewGameFromLoadPrompt = () => {
    resetToNewGame();
  };

  const handleAutosaveComplete = (timestamp: string | null, success: boolean) => {
    if (success && timestamp) {
        setLastAutosaveStatus({ timestamp, success });
    } else {
        setLastAutosaveStatus({ timestamp: new Date().toISOString(), success: false });
    }
  };

  if (gamePhase === GamePhase.Loading || apiKeyAvailable === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-4">
        <LoadingSpinner size="w-16 h-16" />
        <p className="mt-4 text-xl">Инициализация приключения...</p>
      </div>
    );
  }
  
  if (gamePhase === GamePhase.LoadPrompt && savedGameData) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900 bg-opacity-90 z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="loadGamePromptTitle">
        <div className="bg-slate-800 p-6 sm:p-8 rounded-lg shadow-2xl text-center max-w-md border-2 border-purple-500">
          <h2 id="loadGamePromptTitle" className="text-xl sm:text-2xl font-bold text-purple-400 mb-4">Найдена сохраненная игра</h2>
          <p className="text-slate-300 mb-2 text-sm">
            Герой: {savedGameData.character.name}, Ур. {savedGameData.character.level}
          </p>
          <p className="text-slate-300 mb-2 text-sm">
            Последнее сохранение: {new Date(savedGameData.lastSaved).toLocaleString('ru-RU')}
          </p>
          <p className="text-slate-300 mb-6 text-sm">Хотите продолжить?</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <button
              onClick={handleContinueSavedGame}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 text-sm sm:text-base"
            >
              Продолжить
            </button>
            <button
              onClick={handleStartNewGameFromLoadPrompt}
              className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 text-sm sm:text-base"
            >
              Начать новую игру
            </button>
          </div>
        </div>
      </div>
    );
  }

   if (gamePhase === GamePhase.Error && errorMessage && errorMessage !== API_KEY_ERROR_MESSAGE) {
      return (
           <div className="fixed inset-0 flex items-center justify-center bg-slate-900 bg-opacity-90 z-50 p-4">
              <div className="bg-red-800 p-6 sm:p-8 rounded-lg shadow-2xl text-center max-w-md">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Произошла ошибка</h2>
                  <p className="text-red-200 text-sm sm:text-base">{errorMessage}</p>
              </div>
          </div>
      );
  }


  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* DebugMenu button and rendering removed from here */}

      {gamePhase === GamePhase.CharacterCreation && (
        <CharacterCreator 
            onCharacterCreated={handleCharacterCreated} 
            apiKeyAvailable={!!apiKeyAvailable} 
            onManualKeyProvided={handleManualKeyProvided}
        />
      )}
      {gamePhase === GamePhase.Gameplay && character && (
        <ChatInterface 
            ref={chatInterfaceRef}
            character={character} 
            apiKeyAvailable={!!apiKeyAvailable}
            forceLevelUpTrigger={forceLevelUpTrigger} // Pass trigger
            onForceLevelUpTrigger={() => setForceLevelUpTrigger(prev => prev + 1)} // Pass setter-like function
            onAiResponseTokenCount={handleAiResponseTokenCount}
            lastAiResponseTokenCount={lastAiResponseTokenCount} // Pass value
            initialHistory={initialChatHistory}
            initialFocusTarget={initialFocusTargetInfo}
            gamePhase={gamePhase} 
            onAutosaveComplete={handleAutosaveComplete}
            lastAutosaveStatus={lastAutosaveStatus} // Pass value
            onStartNewGame={resetToNewGame} // Pass reset function
        />
      )}
      {!apiKeyAvailable && gamePhase === GamePhase.Gameplay && ( 
         <div className="fixed bottom-0 left-0 right-0 p-2 bg-red-800 text-white text-center text-xs sm:text-sm z-[100]">
            {API_KEY_ERROR_MESSAGE} Функции ИИ будут ограничены.
        </div>
      )}
    </div>
  );
};

export default App;
