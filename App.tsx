
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CharacterCreator from './components/CharacterCreator';
import ChatInterface, { ChatInterfaceHandle } from './components/ChatInterface';
import { Character, GamePhase, ChatMessage, FocusTargetInfo, SavedGame } from './types';
import { SAVE_GAME_KEY } from './constants'; // API_KEY_ERROR_MESSAGE removed
import LoadingSpinner from './components/LoadingSpinner';
// clearManualApiKey import is no longer needed from geminiService as key is hardcoded

const App: React.FC = () => {
  const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.Loading);
  const [character, setCharacter] = useState<Character | null>(null);
  const [apiKeyAvailable, setApiKeyAvailable] = useState<boolean>(true); // Key is hardcoded, so always available
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [forceLevelUpTrigger, setForceLevelUpTrigger] = useState<number>(0);
  const [lastAiResponseTokenCount, setLastAiResponseTokenCount] = useState<number | null>(null);

  const [savedGameData, setSavedGameData] = useState<SavedGame | null>(null);
  const [initialChatHistory, setInitialChatHistory] = useState<ChatMessage[] | undefined>(undefined);
  const [initialFocusTargetInfo, setInitialFocusTargetInfo] = useState<FocusTargetInfo | null | undefined>(undefined);
  
  const chatInterfaceRef = useRef<ChatInterfaceHandle | null>(null); 
  const [lastAutosaveStatus, setLastAutosaveStatus] = useState<{ timestamp: string; success: boolean } | null>(null);


  const performInitialSetup = useCallback(() => {
    // API key is hardcoded, so no need to check environment or manual input
    setApiKeyAvailable(true);
    setErrorMessage(null);
    // clearManualApiKey(); // No longer needed

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
    // API key is hardcoded, so no specific error message for it needed here
    setErrorMessage(null); 
  };

  // const handleManualKeyProvided = (success: boolean) => {
    // This function is now a no-op as apiKeyAvailable is always true
    // setApiKeyAvailable(success); 
    // if (success) {
    //     setErrorMessage(null); 
    // }
  // };

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
      
      // API key is hardcoded, no need to re-check
      setApiKeyAvailable(true);
      // clearManualApiKey(); // No longer needed
    }
  };

  const resetToNewGame = useCallback(() => { 
    localStorage.removeItem(SAVE_GAME_KEY);
    setCharacter(null);
    setInitialChatHistory(undefined);
    setInitialFocusTargetInfo(undefined);
    setLastAutosaveStatus(null);
    setGamePhase(GamePhase.CharacterCreation);
    setSavedGameData(null);
    setForceLevelUpTrigger(0); 
    setLastAiResponseTokenCount(null);
    
    // API key is hardcoded, no need to re-check
    setApiKeyAvailable(true);
    setErrorMessage(null);
    // clearManualApiKey(); // No longer needed
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

  if (gamePhase === GamePhase.Loading) { // apiKeyAvailable === null check removed
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

   if (gamePhase === GamePhase.Error && errorMessage) { // API_KEY_ERROR_MESSAGE check removed
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
      {gamePhase === GamePhase.CharacterCreation && (
        <CharacterCreator 
            onCharacterCreated={handleCharacterCreated} 
            // apiKeyAvailable={!!apiKeyAvailable} // This prop is not strictly needed by CharacterCreator anymore
            // onManualKeyProvided={handleManualKeyProvided} // This prop is not strictly needed by CharacterCreator anymore
        />
      )}
      {gamePhase === GamePhase.Gameplay && character && (
        <ChatInterface 
            ref={chatInterfaceRef}
            character={character} 
            apiKeyAvailable={!!apiKeyAvailable} // Will always be true
            forceLevelUpTrigger={forceLevelUpTrigger} 
            onForceLevelUpTrigger={() => setForceLevelUpTrigger(prev => prev + 1)} 
            onAiResponseTokenCount={handleAiResponseTokenCount}
            lastAiResponseTokenCount={lastAiResponseTokenCount} 
            initialHistory={initialChatHistory}
            initialFocusTarget={initialFocusTargetInfo}
            gamePhase={gamePhase} 
            onAutosaveComplete={handleAutosaveComplete}
            lastAutosaveStatus={lastAutosaveStatus} 
            onStartNewGame={resetToNewGame} 
        />
      )}
      {/* Bottom warning about API_KEY not available is removed, as key is hardcoded */}
    </div>
  );
};

export default App;
