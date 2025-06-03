
import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Character, ChatMessage, FocusTargetInfo, DiceRollRequest, DiceRollReport, StatName, Skill, Stats, AiModelId, LevelUpPayload, Item, ItemType, SavedGame, GamePhase } from '../types'; 
import { startChatSession, getSystemInstructionForCharacter, getAi } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import { SendIcon, PlayerCharacterIcon, BookOpenIcon, UserCircleIcon, XMarkIcon, CogIcon } from './icons'; // Added CogIcon
import { Chat, Content, GenerateContentResponse, Part, HarmCategory, HarmBlockThreshold } from '@google/genai'; // Added HarmCategory, HarmBlockThreshold
import PlayerInfoPanel from './PlayerInfoPanel';
import FocusInfoPanel from './FocusInfoPanel';
import WorldLogPanel from './WorldLogPanel';
import DiceRoller from './DiceRoller';
import LevelUpModal from './LevelUpModal'; 
import DebugMenu from './DebugMenu'; // Import DebugMenu
import { STAT_NAME_TRANSLATIONS, FALLBACK_GEMINI_TEXT_MODEL, AVAILABLE_AI_MODELS, XP_THRESHOLDS, MAX_LEVEL, BASE_HP_GAIN_PER_LEVEL, BASE_STAT_VALUE, SAVE_GAME_KEY, DEFAULT_AI_MODEL_ID } from '../constants';

const AiAvatar: React.FC = () => (
    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-xl shadow-md flex-shrink-0">
        ИИ
    </div>
);

const UserPlayerAvatar: React.FC = () => {
    return <PlayerCharacterIcon className="w-10 h-10 rounded-full bg-slate-600 p-1 text-purple-300 shadow-md flex-shrink-0" />;
};

const FOCUS_PANEL_UPDATE_REGEX = /FOCUS_PANEL_UPDATE::({.*?}|null)/s;
const PLAYER_STATUS_UPDATE_REGEX = /PLAYER_STATUS_UPDATE::({.*?})/s;
const DICE_ROLL_REQUEST_REGEX = /DICE_ROLL_REQUEST::({.*?})/s;
const PLAYER_HP_UPDATE_REGEX = /PLAYER_HP_UPDATE::({.*?})/s;
const AWARD_XP_REGEX = /AWARD_XP::({.*?})/s; 
const LEVEL_UP_INITIATE_REGEX = /LEVEL_UP_INITIATE::({.*?})/s; 
const AWARD_ITEM_REGEX = /AWARD_ITEM::({.*?})/s;
const CONSUME_ITEM_REGEX = /CONSUME_ITEM::({.*?})/s; 

const INITIAL_SCENE_PROMPT = "DM, пожалуйста, опиши для меня начальную сцену. Это самое начало моего приключения. Если сцена включает важного NPC, требует броска кубика, изменяет мои статусы или HP, или я нахожу предметы, используй соответствующие команды FOCUS_PANEL_UPDATE::, DICE_ROLL_REQUEST::, PLAYER_STATUS_UPDATE::, PLAYER_HP_UPDATE::, AWARD_ITEM::.";
const MAX_AUTO_REGEN_RETRIES = 2;


interface ProcessedAiCommandsResult {
  cleanedText: string;
  newHp?: number;
  newMaxHp?: number;
  newStatuses?: string[];
  newFocusTargetInfo?: FocusTargetInfo | null;
  newDiceRollRequest?: DiceRollRequest | null;
  xpAward?: { amount: number; reason: string };
  levelUpInitiateReason?: string;
  itemAward?: { name: string; description: string; type: ItemType; quantity: number };
  itemConsumed?: { name: string; quantity: number };
  newInventory?: Item[]; // Return new inventory state
  newCurrentXP?: number; // Return new XP
}

type AddMessagePayload = {
  sender: ChatMessage['sender'];
  text: string;
  id?: string;
  timestamp?: Date;
  finishReason?: string;
  isRegenerating?: boolean;
};

const cleanPotentialUndefined = (text: string): string => {
  const undefinedSuffix = "undefined";
  if (text.endsWith(undefinedSuffix)) {
    return text.substring(0, text.length - undefinedSuffix.length).trim();
  }
  return text.trim(); 
};

const CHAT_INTERFACE_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

interface ChatInterfaceProps {
    character: Character;
    apiKeyAvailable: boolean;
    forceLevelUpTrigger?: number; 
    onForceLevelUpTrigger: () => void; // Callback to trigger level up from App
    onAiResponseTokenCount: (count: number) => void; 
    lastAiResponseTokenCount: number | null; // Value from App
    initialHistory?: ChatMessage[];
    initialFocusTarget?: FocusTargetInfo | null;
    gamePhase: GamePhase; 
    onAutosaveComplete: (timestamp: string | null, success: boolean) => void; 
    lastAutosaveStatus: { timestamp: string; success: boolean } | null; // Value from App
    onStartNewGame: () => void; // Callback to start new game from App
}

export interface ChatInterfaceHandle {
  saveGame: () => void;
}

type HandleStreamAndProcessFn = (
  streamPromise: Promise<AsyncIterable<GenerateContentResponse>>,
  aiMessageId: string,
  isAutoRegen: boolean,
  retryCountIfAuto: number,
  isPostDiceRollResponse?: boolean 
) => Promise<void>;


const ChatInterface = forwardRef<ChatInterfaceHandle, ChatInterfaceProps>(({ 
    character: initialCharacter, 
    apiKeyAvailable, 
    forceLevelUpTrigger, 
    onForceLevelUpTrigger,
    onAiResponseTokenCount,
    lastAiResponseTokenCount,
    initialHistory,
    initialFocusTarget,
    gamePhase,
    onAutosaveComplete,
    lastAutosaveStatus,
    onStartNewGame
}, ref) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(initialHistory || []);
  const [userInput, setUserInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [focusTargetInfo, setFocusTargetInfo] = useState<FocusTargetInfo | null>(initialFocusTarget || null);
  const [currentPlayerStatuses, setCurrentPlayerStatuses] = useState<string[]>(initialCharacter.statuses || []);
  const [currentHp, setCurrentHp] = useState<number>(initialCharacter.hp);
  const [currentMaxHp, setCurrentMaxHp] = useState<number>(initialCharacter.maxHp);
  const [currentStats, setCurrentStats] = useState<Stats>({...initialCharacter.stats});
  const [currentSkills, setCurrentSkills] = useState<Skill[]>([...initialCharacter.skills]);
  const [currentLevel, setCurrentLevel] = useState<number>(initialCharacter.level);
  const [currentXP, setCurrentXP] = useState<number>(initialCharacter.currentXP);
  const [currentXpToNextLevel, setCurrentXpToNextLevel] = useState<number>(initialCharacter.xpToNextLevel);
  const [currentInventory, setCurrentInventory] = useState<Item[]>(initialCharacter.inventory || []);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [activeDiceRollRequest, setActiveDiceRollRequest] = useState<DiceRollRequest | null>(null);
  const [isDiceInterfaceActive, setIsDiceInterfaceActive] = useState(false);
  const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);

  const [isMobileWorldLogOpen, setIsMobileWorldLogOpen] = useState(false);
  const [isMobilePlayerPanelOpen, setIsMobilePlayerPanelOpen] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false); // Menu state moved here
  
  const characterModelId = useMemo(() => initialCharacter.selectedAiModelId || FALLBACK_GEMINI_TEXT_MODEL, [initialCharacter.selectedAiModelId]);

  const characterBasicInfoForPanel = useMemo(() => {
    const {
        statuses, hp, maxHp, stats, skills, isNsfwEnabled,
        level, currentXP, xpToNextLevel, newlyAcquiredAbility, inventory, 
        ...restOfCharacter 
    } = initialCharacter;
    return restOfCharacter;
  }, [initialCharacter]);

  const lastResolvedRollIdRef = useRef<string | null>(null);
  console.log('[INIT] ChatInterface initialized. lastResolvedRollIdRef.current:', lastResolvedRollIdRef.current);


  useEffect(() => {
    console.log('[EFFECT_INIT_CHAR] Initializing character state from props:', initialCharacter);
    setCurrentPlayerStatuses(initialCharacter.statuses || []);
    setCurrentHp(initialCharacter.hp);
    setCurrentMaxHp(initialCharacter.maxHp);
    setCurrentStats({...initialCharacter.stats});
    setCurrentSkills([...initialCharacter.skills]);
    setCurrentLevel(initialCharacter.level);
    setCurrentXP(initialCharacter.currentXP);
    setCurrentXpToNextLevel(initialCharacter.xpToNextLevel);
    setCurrentInventory(initialCharacter.inventory || []);

    if (initialHistory !== undefined) {
        console.log('[EFFECT_INIT_CHAR] Setting initial history:', initialHistory);
        setChatHistory(initialHistory);
    }
    if (initialFocusTarget !== undefined) {
        console.log('[EFFECT_INIT_CHAR] Setting initial focus target:', initialFocusTarget);
        setFocusTargetInfo(initialFocusTarget || null);
    }
  }, [initialCharacter, initialHistory, initialFocusTarget]);


 const addMessageToHistory = useCallback((message: AddMessagePayload) => {
    setChatHistory(prev => {
        const newHistory = [...prev, {
            id: message.id || Date.now().toString() + Math.random(),
            sender: message.sender,
            text: message.text,
            timestamp: message.timestamp || new Date(),
            finishReason: message.finishReason,
            isRegenerating: message.isRegenerating,
        }];
        return newHistory;
    });
  }, []);

  const _getDisplayableTextFromPartialAiResponse = useCallback((aiText: string): string => {
    let displayableText = cleanPotentialUndefined(aiText);
    displayableText = displayableText.replace(FOCUS_PANEL_UPDATE_REGEX, '');
    displayableText = displayableText.replace(PLAYER_STATUS_UPDATE_REGEX, '');
    displayableText = displayableText.replace(DICE_ROLL_REQUEST_REGEX, '');
    displayableText = displayableText.replace(PLAYER_HP_UPDATE_REGEX, '');
    displayableText = displayableText.replace(AWARD_XP_REGEX, '');
    displayableText = displayableText.replace(LEVEL_UP_INITIATE_REGEX, '');
    displayableText = displayableText.replace(AWARD_ITEM_REGEX, '');
    displayableText = displayableText.replace(CONSUME_ITEM_REGEX, '');
    return displayableText.trim();
  }, []);


  const _updateStateAndParseCommands = useCallback((
    aiText: string,
    currentSnapshotHp: number,
    currentSnapshotMaxHp: number,
    currentSnapshotStatuses: string[],
    currentSnapshotFocusTarget: FocusTargetInfo | null,
    currentSnapshotDiceRollRequest: DiceRollRequest | null,
    currentSnapshotInventory: Item[],
    currentSnapshotXP: number
  ): ProcessedAiCommandsResult => {
    console.log('[CMD_PARSE] Starting command parsing. Raw AI text:', aiText);
    let processedText = cleanPotentialUndefined(aiText);
    
    let result: ProcessedAiCommandsResult = {
        cleanedText: processedText,
        newHp: currentSnapshotHp,
        newMaxHp: currentSnapshotMaxHp,
        newStatuses: [...currentSnapshotStatuses],
        newFocusTargetInfo: currentSnapshotFocusTarget ? {...currentSnapshotFocusTarget} : null,
        newDiceRollRequest: null, 
        newInventory: [...currentSnapshotInventory],
        newCurrentXP: currentSnapshotXP,
    };

    const playerHpMatch = processedText.match(PLAYER_HP_UPDATE_REGEX);
    if (playerHpMatch && playerHpMatch[1]) {
        try {
            const hpUpdate = JSON.parse(playerHpMatch[1]) as { hp: number, maxHp: number };
            console.log('[CMD_PARSE] Parsed PLAYER_HP_UPDATE:', hpUpdate);
            if (typeof hpUpdate.hp === 'number') result.newHp = hpUpdate.hp;
            if (typeof hpUpdate.maxHp === 'number') result.newMaxHp = hpUpdate.maxHp;
        } catch (e) { console.error("Error parsing PlayerHpUpdate JSON:", e, playerHpMatch[1]); }
        processedText = processedText.replace(PLAYER_HP_UPDATE_REGEX, '').trim();
    }

    const playerStatusMatch = processedText.match(PLAYER_STATUS_UPDATE_REGEX);
    if (playerStatusMatch && playerStatusMatch[1]) {
        try {
            const statusUpdate = JSON.parse(playerStatusMatch[1]) as { statuses: string[] };
            console.log('[CMD_PARSE] Parsed PLAYER_STATUS_UPDATE:', statusUpdate);
            if (statusUpdate && Array.isArray(statusUpdate.statuses)) {
                result.newStatuses = statusUpdate.statuses;
            }
        } catch (e) { console.error("Error parsing PlayerStatusUpdate JSON:", e, playerStatusMatch[1]); }
        processedText = processedText.replace(PLAYER_STATUS_UPDATE_REGEX, '').trim();
    }

    const diceRollMatch = processedText.match(DICE_ROLL_REQUEST_REGEX);
    if (diceRollMatch && diceRollMatch[1]) {
      try {
        const newDiceRollRequest = JSON.parse(diceRollMatch[1]) as DiceRollRequest;
        console.log('[CMD_PARSE] Parsed DICE_ROLL_REQUEST:', newDiceRollRequest);
        if (Array.isArray(newDiceRollRequest.statsToRoll) &&
            newDiceRollRequest.statsToRoll.length > 0 &&
            newDiceRollRequest.statsToRoll.every(stat => Object.values(StatName).includes(stat as StatName)) &&
            typeof newDiceRollRequest.description === 'string' &&
            typeof newDiceRollRequest.id === 'string') {
          result.newDiceRollRequest = newDiceRollRequest;
        } else { console.error("Invalid DiceRollRequest structure:", newDiceRollRequest); }
      } catch (e) { console.error("Error parsing DiceRollRequest JSON:", e, diceRollMatch[1]); }
      processedText = processedText.replace(DICE_ROLL_REQUEST_REGEX, '').trim();
    }

    const focusMatch = processedText.match(FOCUS_PANEL_UPDATE_REGEX);
    if (focusMatch && focusMatch[1]) {
      try {
        if (focusMatch[1].toLowerCase() === 'null' || (JSON.parse(focusMatch[1]) && Object.keys(JSON.parse(focusMatch[1])).length === 0) ) {
            result.newFocusTargetInfo = null;
        } else {
            const newFocusInfo = JSON.parse(focusMatch[1]);
            if (newFocusInfo.hp !== undefined && typeof newFocusInfo.hp !== 'number') newFocusInfo.hp = parseInt(String(newFocusInfo.hp), 10) || undefined;
            if (newFocusInfo.maxHp !== undefined && typeof newFocusInfo.maxHp !== 'number') newFocusInfo.maxHp = parseInt(String(newFocusInfo.maxHp), 10) || undefined;
            result.newFocusTargetInfo = newFocusInfo as FocusTargetInfo;
        }
        console.log('[CMD_PARSE] Parsed FOCUS_PANEL_UPDATE. New Focus:', result.newFocusTargetInfo);
      } catch (e) { console.error("Error parsing focus panel JSON:", e, focusMatch[1]); }
      processedText = processedText.replace(FOCUS_PANEL_UPDATE_REGEX, '').trim();
    }

    const awardXpMatch = processedText.match(AWARD_XP_REGEX);
    if (awardXpMatch && awardXpMatch[1]) {
        try {
            const xpData = JSON.parse(awardXpMatch[1]) as { amount: number; reason: string };
            console.log('[CMD_PARSE] Parsed AWARD_XP:', xpData);
            if (typeof xpData.amount === 'number' && typeof xpData.reason === 'string') {
                result.xpAward = xpData;
                result.newCurrentXP = (result.newCurrentXP ?? 0) + xpData.amount;
            }
        } catch (e) { console.error("Error parsing AWARD_XP JSON:", e, awardXpMatch[1]); }
        processedText = processedText.replace(AWARD_XP_REGEX, '').trim();
    }
    
    const awardItemMatch = processedText.match(AWARD_ITEM_REGEX);
    if (awardItemMatch && awardItemMatch[1]) {
        try {
            const itemData = JSON.parse(awardItemMatch[1]) as { name: string; description: string; type: ItemType; quantity: number };
            console.log('[CMD_PARSE] Parsed AWARD_ITEM:', itemData);
            if (typeof itemData.name === 'string' && typeof itemData.description === 'string' && 
                Object.values(ItemType).includes(itemData.type) && typeof itemData.quantity === 'number' && itemData.quantity > 0) {
                result.itemAward = itemData;
                const tempInventory = result.newInventory ? [...result.newInventory] : [];
                const stackableTypes: ItemType[] = [ItemType.Potion, ItemType.Misc, ItemType.Food, ItemType.Key, ItemType.Currency];
                const existingItemIndex = stackableTypes.includes(itemData.type) 
                    ? tempInventory.findIndex(item => item.name === itemData.name && item.type === itemData.type) 
                    : -1;

                if (existingItemIndex !== -1) {
                    tempInventory[existingItemIndex] = {
                        ...tempInventory[existingItemIndex],
                        quantity: tempInventory[existingItemIndex].quantity + itemData.quantity,
                    };
                } else {
                    tempInventory.push({ id: `${itemData.name}-${Date.now()}`, name: itemData.name, description: itemData.description, type: itemData.type, quantity: itemData.quantity });
                }
                result.newInventory = tempInventory;
            } else {
                console.error("Invalid item data structure for AWARD_ITEM:", itemData);
            }
        } catch (e) { console.error("Error parsing AWARD_ITEM JSON:", e, awardItemMatch[1]); }
        processedText = processedText.replace(AWARD_ITEM_REGEX, '').trim();
    }

    const consumeItemMatch = processedText.match(CONSUME_ITEM_REGEX);
    if (consumeItemMatch && consumeItemMatch[1]) {
        try {
            const itemData = JSON.parse(consumeItemMatch[1]) as { name: string; quantity: number };
            console.log('[CMD_PARSE] Parsed CONSUME_ITEM:', itemData);
            if (typeof itemData.name === 'string' && typeof itemData.quantity === 'number' && itemData.quantity > 0) {
                result.itemConsumed = itemData;
                const tempInventory = result.newInventory ? [...result.newInventory] : [];
                const itemIndex = tempInventory.findIndex(item => item.name === itemData.name);
                if (itemIndex !== -1) {
                    if (tempInventory[itemIndex].quantity > itemData.quantity) {
                        tempInventory[itemIndex].quantity -= itemData.quantity;
                    } else if (tempInventory[itemIndex].quantity === itemData.quantity) {
                        tempInventory.splice(itemIndex, 1);
                    } else {
                         console.warn(`Attempted to consume ${itemData.quantity} of ${itemData.name}, but only ${tempInventory[itemIndex].quantity} available.`);
                    }
                    result.newInventory = tempInventory;
                }
            } else {
                console.error("Invalid item data structure for CONSUME_ITEM:", itemData);
            }
        } catch (e) { console.error("Error parsing CONSUME_ITEM JSON:", e, consumeItemMatch[1]); }
        processedText = processedText.replace(CONSUME_ITEM_REGEX, '').trim();
    }


    const levelUpInitiateMatch = processedText.match(LEVEL_UP_INITIATE_REGEX);
    if (levelUpInitiateMatch && levelUpInitiateMatch[1]) {
         try {
            const levelUpData = JSON.parse(levelUpInitiateMatch[1]) as { reason: string };
            console.log('[CMD_PARSE] Parsed LEVEL_UP_INITIATE:', levelUpData);
            if (typeof levelUpData.reason === 'string') {
                result.levelUpInitiateReason = levelUpData.reason;
            }
        } catch (e) { console.error("Error parsing LEVEL_UP_INITIATE JSON:", e, levelUpInitiateMatch[1]); }
        processedText = processedText.replace(LEVEL_UP_INITIATE_REGEX, '').trim();
    }

    result.cleanedText = processedText;
    console.log('[CMD_PARSE] Command parsing finished. Result:', result, 'Cleaned Text:', result.cleanedText);
    return result;
  }, []); 

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    if (forceLevelUpTrigger && forceLevelUpTrigger > 0) { 
        console.log('[DEBUG_MENU] Force level up triggered.');
        if (currentLevel < MAX_LEVEL) {
            addMessageToHistory({ sender: 'system', text: "Отладка: Принудительное повышение уровня инициировано." });
            setIsLevelUpModalOpen(true);
        } else {
            addMessageToHistory({ sender: 'system', text: "Отладка: Персонаж уже на максимальном уровне. Повышение уровня невозможно." });
        }
    }
  }, [forceLevelUpTrigger, addMessageToHistory, currentLevel]);


  const getCurrentCharacterState = useCallback((): Character => {
    const charState = {
        name: initialCharacter.name, 
        race: initialCharacter.race,
        class: initialCharacter.class,
        backstory: initialCharacter.backstory,
        worldElements: initialCharacter.worldElements,
        isNsfwEnabled: initialCharacter.isNsfwEnabled,
        customWorldSetting: initialCharacter.customWorldSetting,
        selectedAiModelId: characterModelId,
        hp: currentHp,
        maxHp: currentMaxHp,
        stats: currentStats,
        skills: currentSkills,
        statuses: currentPlayerStatuses,
        inventory: currentInventory, 
        level: currentLevel,
        currentXP: currentXP,
        xpToNextLevel: currentXpToNextLevel,
    };
    return charState;
  }, [initialCharacter, characterModelId, currentHp, currentMaxHp, currentStats, currentSkills, currentPlayerStatuses, currentInventory, currentLevel, currentXP, currentXpToNextLevel]);

  const saveGameInternalLogic = useCallback((
    characterToSave: Character, 
    historyToSave: ChatMessage[], 
    focusTargetToSave: FocusTargetInfo | null
  ) => {
    console.log('[SAVE_GAME_INTERNAL] Attempting to save game. Character:', characterToSave, 'History Count:', historyToSave.length, 'Focus:', focusTargetToSave);
    const gameToSave: SavedGame = {
      character: characterToSave,
      chatHistory: historyToSave,
      focusTargetInfo: focusTargetToSave,
      lastSaved: new Date().toISOString(),
    };
    try {
      localStorage.setItem(SAVE_GAME_KEY, JSON.stringify(gameToSave));
      console.log(`[SAVE_GAME_INTERNAL] Game successfully saved at ${gameToSave.lastSaved}.`, gameToSave);
      onAutosaveComplete(gameToSave.lastSaved, true);
    } catch (e) {
      console.error("[SAVE_GAME_INTERNAL] Error saving game to localStorage:", e);
      onAutosaveComplete(null, false);
    }
  }, [onAutosaveComplete]);

  const handleManualSaveGame = useCallback(() => {
    console.log('[MANUAL_SAVE] Manual save triggered from menu.');
    const currentCharacterForManualSave = getCurrentCharacterState();
    saveGameInternalLogic(currentCharacterForManualSave, chatHistory, focusTargetInfo);
    setShowGameMenu(false); // Close menu after saving
  }, [getCurrentCharacterState, chatHistory, focusTargetInfo, saveGameInternalLogic]);

  useImperativeHandle(ref, () => ({
    saveGame: handleManualSaveGame,
  }));

  const handleForceLevelUpFromMenu = () => {
    onForceLevelUpTrigger(); // Call the prop from App to update the trigger
    setShowGameMenu(false); // Close menu
  };

  const handleStartNewGameFromMenu = () => {
    onStartNewGame(); // Call the prop from App
    setShowGameMenu(false); // This component will unmount, but good practice
  };


  const handleStreamAndProcessRef = useRef<HandleStreamAndProcessFn | null>(null);

  const handleRegenerateMessage = useCallback(async (messageIdToRegenerate: string, retryCount = 0) => {
    console.log(`[REGEN] Regenerating message ID: ${messageIdToRegenerate}, Retry: ${retryCount}`);
    setIsAiTyping(true);
    setError(null);
    lastResolvedRollIdRef.current = null; 
    console.log(`[REGEN] Cleared lastResolvedRollIdRef.current for regeneration.`);
    
    let historyToUseForRegen: ChatMessage[] = [];
    setChatHistory(prevChatHistory => {
        historyToUseForRegen = prevChatHistory;
        
        const aiMessageIndex = historyToUseForRegen.findIndex(m => m.id === messageIdToRegenerate);
        if (aiMessageIndex === -1) {
            console.error("[REGEN] Message to regenerate not found in current history:", messageIdToRegenerate);
            setIsAiTyping(false);
            return prevChatHistory;
        }
        
        const newAiMessageId = messageIdToRegenerate + `-regen-${Date.now()}`;
        const historyUpToRegenTarget = prevChatHistory.slice(0, aiMessageIndex);
        const newRegeneratingMessage: ChatMessage = {
            ...(prevChatHistory[aiMessageIndex]), 
            id: newAiMessageId, 
            text: "...",
            isRegenerating: true,
            timestamp: new Date(), 
        };
        console.log('[REGEN] Updated chat history with regenerating placeholder. New ID:', newAiMessageId);
        return [...historyUpToRegenTarget, newRegeneratingMessage];
    });


    const aiMessageIndex = historyToUseForRegen.findIndex(m => m.id === messageIdToRegenerate);
    if (aiMessageIndex === -1) { 
        console.warn("[REGEN] Message to regenerate not found after setChatHistory. This should not happen.");
        setIsAiTyping(false); return;
    }

    let historyForRegenApi: Content[];
    let promptTextForRegen: string;
    let userMessageIdxForPrompt = -1;

    for (let i = aiMessageIndex - 1; i >= 0; i--) {
        if (historyToUseForRegen[i].sender === 'user') {
            userMessageIdxForPrompt = i;
            break;
        }
    }
    
    if (userMessageIdxForPrompt !== -1) {
        promptTextForRegen = historyToUseForRegen[userMessageIdxForPrompt].text;
        historyForRegenApi = historyToUseForRegen.slice(0, userMessageIdxForPrompt)
            .filter(msg => msg.sender !== 'system')
            .map(msg => ({ role: msg.sender === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] }));
    } else { 
        promptTextForRegen = INITIAL_SCENE_PROMPT;
        historyForRegenApi = [];
    }
    console.log('[REGEN] Prompt for regen:', promptTextForRegen, 'History for API (count):', historyForRegenApi.length);


    const currentCharacterForSession = getCurrentCharacterState();
    const currentSystemInstruction = getSystemInstructionForCharacter(currentCharacterForSession);
    const modelIdForRegen = currentCharacterForSession.selectedAiModelId || DEFAULT_AI_MODEL_ID;

    const regenChatConfig: any = {
        safetySettings: CHAT_INTERFACE_SAFETY_SETTINGS,
        systemInstruction: currentSystemInstruction,
    };
    console.log('[REGEN] Chat config for regen:', regenChatConfig);

    try {
        const tempRegenChat = getAi().chats.create({
            model: modelIdForRegen,
            config: regenChatConfig,
            history: historyForRegenApi
        });
        console.log('[REGEN] Temporary regen chat session created.');
        
        let idOfRegeneratingMessage = "";
        setChatHistory(prev => { 
            const regenMsg = prev.find(m => m.isRegenerating && m.id.startsWith(messageIdToRegenerate + "-regen-"));
            if (regenMsg) idOfRegeneratingMessage = regenMsg.id;
            return prev;
        });

        if (!idOfRegeneratingMessage) { 
            idOfRegeneratingMessage = messageIdToRegenerate + "-regen-" + Date.now(); 
            console.warn('[REGEN] Regenerating message ID not found in state, creating new one:', idOfRegeneratingMessage);
            setChatHistory(prev => {
                const msgIdx = prev.findIndex(m => m.id === messageIdToRegenerate);
                if(msgIdx !== -1) {
                    const newHist = [...prev];
                    newHist[msgIdx] = {...newHist[msgIdx], id: idOfRegeneratingMessage, text: "...", isRegenerating: true, timestamp: new Date()};
                    return newHist;
                }
                return prev;
            });
        }
        console.log('[REGEN] Target AI message ID for stream:', idOfRegeneratingMessage);

        if (handleStreamAndProcessRef.current) {
          await handleStreamAndProcessRef.current(
              tempRegenChat.sendMessageStream({ message: promptTextForRegen }),
              idOfRegeneratingMessage, 
              retryCount > 0, 
              retryCount,
              false 
          );
        } else {
          console.error("[REGEN] handleStreamAndProcessRef.current is not set during regeneration.");
          setError("Ошибка: Не удалось выполнить регенерацию из-за внутренней ошибки.");
          setIsAiTyping(false);
        }
    } catch (e: any) {
        console.error("Ошибка при регенерации сообщения:", e);
        setError(`Ошибка ИИ при регенерации: ${e.message}`);
        setIsAiTyping(false);
        setChatHistory(prev => prev.map(msg => msg.id.startsWith(messageIdToRegenerate + "-regen-") ? {...msg, text: `Ошибка регенерации: ${e.message}`, sender:'system', isRegenerating: false} : msg ));
    }

  }, [getCurrentCharacterState, addMessageToHistory]); 


  const handleStreamAndProcessInternal = useCallback(async (
    streamPromise: Promise<AsyncIterable<GenerateContentResponse>>,
    aiMessageId: string,
    isAutoRegen: boolean,
    retryCountIfAuto: number,
    isPostDiceRollResponse: boolean = false 
  ) => {
    console.log(`[STREAM_PROC] Starting stream processing for AI Message ID: ${aiMessageId}. Is Auto Regen: ${isAutoRegen}, Retry Count: ${retryCountIfAuto}, Is Post Dice Roll: ${isPostDiceRollResponse}`);
    let completeAiResponseText = "";
    let currentFinishReason: string | undefined = undefined;
    let finalTokenCount: number | undefined;

    try {
        const stream = await streamPromise;
        for await (const chunk of stream) {
            completeAiResponseText += (chunk.text ?? "");
            currentFinishReason = chunk.candidates?.[0]?.finishReason ?? currentFinishReason;
            
            if (chunk.usageMetadata) {
                if (chunk.usageMetadata.totalTokenCount) {
                    finalTokenCount = chunk.usageMetadata.totalTokenCount;
                } else if (chunk.usageMetadata.promptTokenCount && chunk.usageMetadata.candidatesTokenCount) {
                    finalTokenCount = chunk.usageMetadata.promptTokenCount + chunk.usageMetadata.candidatesTokenCount;
                }
            }

            const cleanedChunkText = cleanPotentialUndefined(completeAiResponseText);
            const displayableText = _getDisplayableTextFromPartialAiResponse(cleanedChunkText);
            setChatHistory(prev => prev.map(msg =>
                msg.id === aiMessageId ? { ...msg, text: displayableText || "...", isRegenerating: true } : msg
            ));
        }

        console.log(`[STREAM_PROC] Stream finished. Complete AI response text: "${completeAiResponseText}". Finish Reason: ${currentFinishReason}`);
        if (finalTokenCount !== undefined) {
            console.log(`[STREAM_PROC] Final token count: ${finalTokenCount}`);
            onAiResponseTokenCount(finalTokenCount);
        }

        const finalCleanedAiText = cleanPotentialUndefined(completeAiResponseText);
        
        const snapshotHp = currentHp;
        const snapshotMaxHp = currentMaxHp;
        const snapshotStatuses = currentPlayerStatuses;
        const snapshotFocusTarget = focusTargetInfo;
        const snapshotDiceRollRequest = activeDiceRollRequest;
        const snapshotInventory = currentInventory;
        const snapshotXP = currentXP;
        console.log('[STREAM_PROC] State snapshot before command processing:', { snapshotHp, snapshotMaxHp, snapshotStatuses, snapshotFocusTarget, snapshotInventory, snapshotXP });


        const processingResults = _updateStateAndParseCommands(
            finalCleanedAiText,
            snapshotHp, snapshotMaxHp, snapshotStatuses, snapshotFocusTarget, snapshotDiceRollRequest, snapshotInventory, snapshotXP
        );
        
        console.log('[STREAM_PROC] Command processing results:', processingResults);

        if (processingResults.newHp !== undefined) { setCurrentHp(processingResults.newHp); console.log('[STREAM_PROC_STATE_UPDATE] setCurrentHp:', processingResults.newHp); }
        if (processingResults.newMaxHp !== undefined) { setCurrentMaxHp(processingResults.newMaxHp); console.log('[STREAM_PROC_STATE_UPDATE] setCurrentMaxHp:', processingResults.newMaxHp); }
        if (processingResults.newStatuses !== undefined) { setCurrentPlayerStatuses(processingResults.newStatuses); console.log('[STREAM_PROC_STATE_UPDATE] setCurrentPlayerStatuses:', processingResults.newStatuses); }
        if (processingResults.newFocusTargetInfo !== undefined) { setFocusTargetInfo(processingResults.newFocusTargetInfo); console.log('[STREAM_PROC_STATE_UPDATE] setFocusTargetInfo:', processingResults.newFocusTargetInfo); }
        if (processingResults.newInventory !== undefined) { setCurrentInventory(processingResults.newInventory); console.log('[STREAM_PROC_STATE_UPDATE] setCurrentInventory:', processingResults.newInventory); }
        if (processingResults.newCurrentXP !== undefined) { setCurrentXP(processingResults.newCurrentXP); console.log('[STREAM_PROC_STATE_UPDATE] setCurrentXP:', processingResults.newCurrentXP); }


        const finalTextForDisplay = processingResults.cleanedText;
        const systemMessagesToAdd: AddMessagePayload[] = [];
        
        if (processingResults.xpAward) {
            systemMessagesToAdd.push({ sender: 'system', text: `Получено ${processingResults.xpAward.amount} XP: ${processingResults.xpAward.reason}`});
        }
        if (processingResults.itemAward) {
            systemMessagesToAdd.push({ sender: 'system', text: `Получен предмет: ${processingResults.itemAward.name} (x${processingResults.itemAward.quantity})` });
        }
        if (processingResults.itemConsumed) {
            const originalItem = snapshotInventory.find(item => item.name === processingResults.itemConsumed?.name);
            if (originalItem && originalItem.quantity >= (processingResults.itemConsumed?.quantity || 0) ) {
                 systemMessagesToAdd.push({ sender: 'system', text: `Использован предмет: ${processingResults.itemConsumed.name} (x${processingResults.itemConsumed.quantity})` });
            }
        }
        
        let shouldTriggerLevelUpModal = !!processingResults.levelUpInitiateReason;
        if (processingResults.levelUpInitiateReason) {
             systemMessagesToAdd.push({ sender: 'system', text: `Инициация повышения уровня: ${processingResults.levelUpInitiateReason}`});
        }
        
        const finalXPForLevelCheck = processingResults.newCurrentXP ?? currentXP;
        if (finalXPForLevelCheck >= currentXpToNextLevel && currentLevel < MAX_LEVEL) {
            console.log(`[STREAM_PROC] Level up condition met: XP ${finalXPForLevelCheck} >= ${currentXpToNextLevel}`);
            shouldTriggerLevelUpModal = true;
        }
        
        if (shouldTriggerLevelUpModal) {
             if (currentLevel < MAX_LEVEL) {
                console.log('[STREAM_PROC] Opening level up modal.');
                setIsLevelUpModalOpen(true);
             } else if (processingResults.levelUpInitiateReason){ 
                systemMessagesToAdd.push({ sender: 'system', text: `Персонаж уже на максимальном уровне. ${processingResults.levelUpInitiateReason}`});
             }
        }
        console.log('[STREAM_PROC] System messages to add:', systemMessagesToAdd);

        setChatHistory(prevChatHistory => {
            console.log('[STREAM_PROC_CHAT_UPDATE] Updating chat history. Previous count:', prevChatHistory.length);
            let updatedHistory = prevChatHistory.map(msg =>
                msg.id === aiMessageId ? { ...msg, text: finalTextForDisplay, finishReason: currentFinishReason, isRegenerating: false } : msg
            );
            systemMessagesToAdd.forEach(sysMsg => {
                updatedHistory.push({
                    id: sysMsg.id || Date.now().toString() + Math.random(),
                    sender: sysMsg.sender,
                    text: sysMsg.text,
                    timestamp: sysMsg.timestamp || new Date(),
                });
            });
            console.log('[STREAM_PROC_CHAT_UPDATE] Chat history updated. New count:', updatedHistory.length);

            const characterStateForSaveAndSession: Character = {
                name: initialCharacter.name,
                race: initialCharacter.race,
                class: initialCharacter.class,
                backstory: initialCharacter.backstory,
                worldElements: initialCharacter.worldElements,
                isNsfwEnabled: initialCharacter.isNsfwEnabled,
                customWorldSetting: initialCharacter.customWorldSetting,
                selectedAiModelId: characterModelId,
                hp: processingResults.newHp ?? currentHp,
                maxHp: processingResults.newMaxHp ?? currentMaxHp,
                stats: currentStats, 
                skills: currentSkills, 
                statuses: processingResults.newStatuses ?? currentPlayerStatuses,
                inventory: processingResults.newInventory ?? currentInventory,
                level: currentLevel, 
                currentXP: processingResults.newCurrentXP ?? currentXP,
                xpToNextLevel: currentXpToNextLevel, 
            };
            console.log('[STREAM_PROC_CHAT_UPDATE] Character state for save/session:', characterStateForSaveAndSession);
            
            const currentSystemInstruction = getSystemInstructionForCharacter(characterStateForSaveAndSession);
            const modelIdForNewSession = characterStateForSaveAndSession.selectedAiModelId || DEFAULT_AI_MODEL_ID;
            const chatCreationConfig: any = {
                safetySettings: CHAT_INTERFACE_SAFETY_SETTINGS,
                systemInstruction: currentSystemInstruction,
            };
            const historyForNewGeminiSession: Content[] = updatedHistory
                .filter(msg => msg.sender !== 'system')
                .map(msg => ({ role: msg.sender === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] as Part[] }));

            try {
                const newMainChatSession = getAi().chats.create({
                    model: modelIdForNewSession,
                    config: chatCreationConfig,
                    history: historyForNewGeminiSession
                });
                setChatSession(newMainChatSession);
                console.log('[STREAM_PROC_CHAT_UPDATE] New chat session created and set.');
            } catch (e: any) {
                 console.error("Ошибка при создании новой сессии чата в handleStreamAndProcess:", e);
                 setError(`Ошибка ИИ при обновлении сессии: ${e.message}`);
            }
            
            const newRollReq = processingResults.newDiceRollRequest;
            if (newRollReq) {
                console.log(`[STREAM_PROC_DICE_ROLL] New dice roll request: ID ${newRollReq.id}. lastResolvedRollIdRef.current: ${lastResolvedRollIdRef.current}`);
                if (newRollReq.id === lastResolvedRollIdRef.current) {
                    console.warn(`[STREAM_PROC_DICE_ROLL] AI re-requested dice roll ID ${newRollReq.id} immediately. Ignoring.`);
                } else {
                    console.log(`[STREAM_PROC_DICE_ROLL] Activating dice roller for ID ${newRollReq.id}.`);
                    setActiveDiceRollRequest(newRollReq);
                    setIsDiceInterfaceActive(true);
                    lastResolvedRollIdRef.current = null; 
                    console.log(`[STREAM_PROC_DICE_ROLL] Cleared lastResolvedRollIdRef.current after activating new roll.`);
                }
            }
            
            const conditionsForAutosave = 
                gamePhase === GamePhase.Gameplay && 
                apiKeyAvailable && 
                (!isDiceInterfaceActive || isPostDiceRollResponse) && 
                !isLevelUpModalOpen;   

            console.log('[STREAM_PROC_AUTOSAVE] Autosave conditions check:', { gamePhase, apiKeyAvailable, isDiceInterfaceActive, isLevelUpModalOpen, isPostDiceRollResponse, conditionsForAutosave });

            if (conditionsForAutosave) {
                 console.log('[STREAM_PROC_AUTOSAVE] Conditions met. Calling saveGameInternalLogic.');
                 saveGameInternalLogic(
                    characterStateForSaveAndSession, 
                    updatedHistory, 
                    processingResults.newFocusTargetInfo !== undefined ? processingResults.newFocusTargetInfo : focusTargetInfo
                );
            }
            
            if (currentFinishReason && ['MAX_TOKENS', 'SAFETY', 'RECITATION'].includes(currentFinishReason)) {
                console.warn(`[STREAM_PROC] AI response finished due to: ${currentFinishReason}`);
                if (isAutoRegen && retryCountIfAuto < MAX_AUTO_REGEN_RETRIES) {
                    const regenMsgId = Date.now().toString() + '-sys-regen';
                    console.log(`[STREAM_PROC] Triggering auto-regeneration (retry ${retryCountIfAuto + 1}). Message ID to regen: ${aiMessageId}`);
                    updatedHistory = [
                        ...updatedHistory, 
                        { sender: 'system', text: `Ответ ИИ может быть неполным (Причина: ${currentFinishReason}). Повторная попытка генерации (${retryCountIfAuto + 1}/${MAX_AUTO_REGEN_RETRIES})...`, id: regenMsgId, timestamp: new Date() }
                    ];
                    setTimeout(() => handleRegenerateMessage(aiMessageId, retryCountIfAuto + 1), 500);
                } else if (isAutoRegen && retryCountIfAuto >= MAX_AUTO_REGEN_RETRIES) {
                     const regenFailMsgId = Date.now().toString() + '-sys-regen-fail';
                     console.error(`[STREAM_PROC] Auto-regeneration failed after ${MAX_AUTO_REGEN_RETRIES} retries.`);
                     updatedHistory = [
                        ...updatedHistory,
                        { sender: 'system', text: `Не удалось получить полный ответ от ИИ после ${MAX_AUTO_REGEN_RETRIES} попыток (Причина: ${currentFinishReason}). Попробуйте переформулировать свой запрос или нажмите кнопку "сгенерировать заново".`, id: regenFailMsgId, timestamp: new Date() }
                     ];
                }
            }
            return updatedHistory;
        });

    } catch (e: any) {
        console.error("Ошибка во время стриминга или обработки ответа ИИ:", e);
        const errorMessageText = `Рассказчик ИИ, кажется, задумался... (Ошибка: ${e.message || 'Неизвестная ошибка Gemini'})`;
        setChatHistory(prev => prev.map(msg =>
            msg.id === aiMessageId ? { ...msg, text: errorMessageText, sender: 'system', isRegenerating: false } : msg
        ));
        setError(errorMessageText);
    } finally {
        console.log(`[STREAM_PROC] Finished stream processing for AI Message ID: ${aiMessageId}. Setting isAiTyping to false.`);
        setIsAiTyping(false);
    }
  }, [
    _getDisplayableTextFromPartialAiResponse, 
    _updateStateAndParseCommands, 
    addMessageToHistory, 
    onAiResponseTokenCount, 
    handleRegenerateMessage,
    saveGameInternalLogic, 
    gamePhase, apiKeyAvailable, 
    currentHp, currentMaxHp, currentPlayerStatuses, focusTargetInfo, activeDiceRollRequest, 
    currentInventory, currentXP, currentXpToNextLevel, currentLevel, currentStats, currentSkills,
    characterModelId, initialCharacter, isDiceInterfaceActive, isLevelUpModalOpen, onAutosaveComplete
  ]);

  useEffect(() => {
    handleStreamAndProcessRef.current = handleStreamAndProcessInternal;
  }, [handleStreamAndProcessInternal]);

  useEffect(() => {
    if (initialCharacter && !chatSession && apiKeyAvailable) {
      console.log('[EFFECT_INIT_SESSION] Attempting to initialize chat session. API Key Available:', apiKeyAvailable);
      try {
        const currentCharacterForSession = getCurrentCharacterState();
        const historyToInitWith = (initialHistory && initialHistory.length > 0) ? initialHistory : chatHistory;
        console.log('[EFFECT_INIT_SESSION] History to initialize with (count):', historyToInitWith.length);
        
        const initialChat = startChatSession(currentCharacterForSession, historyToInitWith.filter(msg => msg.sender !== 'system'));
        setChatSession(initialChat);
        console.log('[EFFECT_INIT_SESSION] Chat session initialized.');

        const nonSystemMessages = historyToInitWith.filter(msg => msg.sender !== 'system');
        if (nonSystemMessages.length === 0 && handleStreamAndProcessRef.current) {
            console.log('[EFFECT_INIT_SESSION] No existing messages, sending initial scene prompt.');
            setIsAiTyping(true);
            setError(null);
            const aiMessageId = Date.now().toString() + '-ai-initial';
            addMessageToHistory({ id: aiMessageId, sender: 'ai', text: "...", timestamp: new Date(), isRegenerating: true });
            
            handleStreamAndProcessRef.current(
                initialChat.sendMessageStream({ message: INITIAL_SCENE_PROMPT }),
                aiMessageId,
                true, 
                0,
                false 
            );
        }
      } catch (e: any) {
        console.error("Не удалось инициализировать сеанс чата:", e);
        const initError = `Не удалось начать приключение с ИИ. (Ошибка: ${e.message || 'Ошибка настройки'}) Убедитесь, что ваш API-ключ правильный, и попробуйте снова.`;
        setError(initError);
        addMessageToHistory({ sender: 'system', text: initError });
        setIsAiTyping(false);
      }
    } else if (!apiKeyAvailable && !error ) {
        const noKeyError = "API-ключ недоступен. Приключение не может начаться.";
        console.warn('[EFFECT_INIT_SESSION] API Key not available. Setting error.');
        setError(noKeyError);
        addMessageToHistory({sender: 'system', text: noKeyError});
    }
  }, [
      initialCharacter, chatSession, apiKeyAvailable, addMessageToHistory, error, 
      getCurrentCharacterState, initialHistory, chatHistory 
  ]);

  const handleSendMessage = async () => {
    console.log('[SEND_MSG] handleSendMessage called. User input:', userInput);
    if (!userInput.trim() || isAiTyping || !chatSession || isDiceInterfaceActive || !handleStreamAndProcessRef.current) {
        console.warn('[SEND_MSG] Send message conditions not met. Aborting.');
        return;
    }
    console.log('[SEND_MSG] Clearing lastResolvedRollIdRef.current for new user message.');
    lastResolvedRollIdRef.current = null; 

    const userMessageText = userInput;
    addMessageToHistory({ sender: 'user', text: userMessageText });
    setUserInput('');
    setIsAiTyping(true);
    setError(null);
    
    const aiMessageId = Date.now().toString() + '-ai-stream';
    addMessageToHistory({ id: aiMessageId, sender: 'ai', text: "...", timestamp: new Date(), isRegenerating: true });
    console.log('[SEND_MSG] Added user message and AI placeholder. AI Message ID:', aiMessageId);

    await handleStreamAndProcessRef.current(
        chatSession.sendMessageStream({ message: userMessageText }),
        aiMessageId,
        true, 
        0,
        false 
    );
  };

  const handleDiceRollComplete = async (report: DiceRollReport) => {
    console.log('[DICE_ROLL_COMPLETE] Dice roll complete. Report:', report);
    setIsDiceInterfaceActive(false); 
    setActiveDiceRollRequest(null);
    lastResolvedRollIdRef.current = report.rollId; 
    console.log(`[DICE_ROLL_COMPLETE] Set lastResolvedRollIdRef.current to: ${report.rollId}`);


    const resultsString = report.results.map(r =>
        `${STAT_NAME_TRANSLATIONS[r.statName]} - Итог ${r.totalValue} (бросок ${r.diceValue}, мод. ${r.modifier > 0 ? '+' : ''}${r.modifier})`
    ).join('; ');

    const rollMessageForAI = `[Результат броска для "${report.rollDescription}" (ID: ${report.rollId}): ${resultsString}]`;
    console.log('[DICE_ROLL_COMPLETE] Message for AI:', rollMessageForAI);

    addMessageToHistory({ sender: 'system', text: `Вы совершили бросок для "${report.rollDescription}": ${resultsString}`});

    if (!chatSession || !handleStreamAndProcessRef.current) { 
        console.error("[DICE_ROLL_COMPLETE] Chat session not active. Cannot send roll results.");
        setError("Сессия чата не активна, не удалось отправить результаты броска.");
        return;
    }
    setIsAiTyping(true);
    setError(null);

    const aiMessageId = Date.now().toString() + '-ai-response-after-roll';
    addMessageToHistory({ id: aiMessageId, sender: 'ai', text: "...", timestamp: new Date(), isRegenerating: true });
    console.log('[DICE_ROLL_COMPLETE] Added AI placeholder for response after roll. AI Message ID:', aiMessageId);
    
    await handleStreamAndProcessRef.current(
        chatSession.sendMessageStream({ message: rollMessageForAI }),
        aiMessageId,
        true, 
        0,
        true 
    );
  };

  const handleLevelUpComplete = (payload: LevelUpPayload) => {
    console.log('[LEVEL_UP] Level up complete. Payload:', payload);
    if (currentLevel >= MAX_LEVEL) {
        addMessageToHistory({ sender: 'system', text: "Вы уже достигли максимального уровня!" });
        setIsLevelUpModalOpen(false);
        return;
    }
    console.log('[LEVEL_UP] Clearing lastResolvedRollIdRef.current due to level up.');
    lastResolvedRollIdRef.current = null; 

    const newLevel = currentLevel + 1;
    const newStats = { ...currentStats };
    let newSkills = [...currentSkills];
    let abilityMessagePart = "";

    if (payload.chosenStatIncrease && newStats[payload.chosenStatIncrease] !== undefined) {
        newStats[payload.chosenStatIncrease] = (newStats[payload.chosenStatIncrease] || BASE_STAT_VALUE) + 1;
    }
    setCurrentStats(newStats); 

    if (payload.chosenAbility) {
        newSkills.push(payload.chosenAbility);
        abilityMessagePart = ` Вы изучили новую способность: ${payload.chosenAbility.name}!`;
    }
    setCurrentSkills(newSkills);


    const newCon = newStats[StatName.Constitution] || BASE_STAT_VALUE;
    const newConModifier = Math.floor((newCon - 10) / 2);
    const newMaxHpVal = currentMaxHp + BASE_HP_GAIN_PER_LEVEL + newConModifier;
    
    setCurrentMaxHp(newMaxHpVal); 
    setCurrentHp(newMaxHpVal);    
    
    const newCurrentXPVal = currentXP - currentXpToNextLevel; 
    setCurrentXP(newCurrentXPVal < 0 ? 0 : newCurrentXPVal); 
    
    const newXpToNextLevelThreshold = (newLevel < MAX_LEVEL) ? XP_THRESHOLDS[newLevel] : Infinity; 
    setCurrentXpToNextLevel(newXpToNextLevelThreshold); 
    setCurrentLevel(newLevel); 
    console.log('[LEVEL_UP] Character state updated:', {newLevel, newStats, newSkills, newMaxHpVal, newCurrentXPVal, newXpToNextLevelThreshold});

    addMessageToHistory({ sender: 'system', text: `Поздравляем! Вы достигли ${newLevel} уровня! Ваши характеристики улучшены, здоровье восстановлено.${abilityMessagePart}`});
    setIsLevelUpModalOpen(false);

    const updatedCharacterForAI: Character = {
        ...initialCharacter, 
        hp: newMaxHpVal,
        maxHp: newMaxHpVal,
        stats: newStats,
        skills: newSkills,
        statuses: currentPlayerStatuses, 
        inventory: currentInventory,   
        level: newLevel,
        currentXP: newCurrentXPVal,
        xpToNextLevel: newXpToNextLevelThreshold,
        selectedAiModelId: characterModelId,
    };
    console.log('[LEVEL_UP] Updated character object for AI session and save:', updatedCharacterForAI);

    setChatHistory(prevChatHistory => {
        const newSystemInstruction = getSystemInstructionForCharacter(updatedCharacterForAI);
        
        const historyForNewSessionContent: Content[] = prevChatHistory
            .filter(msg => msg.sender !== 'system')
            .map((msg): Content => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));

        const modelIdForNewSession = updatedCharacterForAI.selectedAiModelId || DEFAULT_AI_MODEL_ID;
        const chatCreationConfig: any = {
            safetySettings: CHAT_INTERFACE_SAFETY_SETTINGS,
            systemInstruction: newSystemInstruction,
        };

        try {
            const newChatSessionInstance = getAi().chats.create({
                model: modelIdForNewSession,
                config: chatCreationConfig,
                history: historyForNewSessionContent
            });
            setChatSession(newChatSessionInstance);
            console.log('[LEVEL_UP] New chat session created after level up.');
        } catch (e: any) {
            console.error("Ошибка при создании новой сессии чата после повышения уровня:", e);
            setError(`Ошибка ИИ при обновлении сессии после уровня: ${e.message}`);
        }
        
        const autosaveConditions = 
            gamePhase === GamePhase.Gameplay && 
            apiKeyAvailable && 
            !isDiceInterfaceActive && 
            !isLevelUpModalOpen; 

        console.log('[LEVEL_UP] Autosave conditions after level up:', { gamePhase, apiKeyAvailable, isDiceInterfaceActive, isLevelUpModalOpen, autosaveConditions });
        if (autosaveConditions) {
            console.log('[LEVEL_UP] Triggering autosave after level up.');
            saveGameInternalLogic(updatedCharacterForAI, prevChatHistory, focusTargetInfo);
        }
        return prevChatHistory; 
    });
    
    setCurrentXP(prevXP => { 
        if (prevXP >= newXpToNextLevelThreshold && newLevel < MAX_LEVEL) {
            console.log(`[LEVEL_UP] XP (${prevXP}) still sufficient for next level (${newXpToNextLevelThreshold}). Re-opening level up modal.`);
            addMessageToHistory({ sender: 'system', text: "Благодаря накопленному опыту, вы готовы к следующему повышению уровня!" });
            setIsLevelUpModalOpen(true); 
        }
        return prevXP;
    });
  };
  
  const selectedModelInfo = AVAILABLE_AI_MODELS.find(m => m.id === characterModelId);

  const MobilePanelOverlay: React.FC<{ title: string; children: React.ReactNode; onClose: () => void }> = ({ title, children, onClose }) => (
    <div className="fixed inset-0 z-50 bg-slate-900 bg-opacity-95 p-4 flex flex-col" role="dialog" aria-modal="true">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h2 className="text-xl font-bold text-purple-400">{title}</h2>
            <button onClick={onClose} className="p-2 text-slate-300 hover:text-white" aria-label="Закрыть панель">
                <XMarkIcon className="w-7 h-7" />
            </button>
        </div>
        <div className="flex-grow overflow-y-auto custom-scrollbar">
            {children}
        </div>
    </div>
  );

  return (
    <>
    <div className="flex h-screen bg-slate-900 text-slate-100 p-1 sm:p-4 gap-1 sm:gap-4">
      <div className="flex-shrink-0 w-64 hidden md:block">
        <WorldLogPanel character={initialCharacter} /> 
      </div>

      <div className="flex flex-col flex-grow min-w-0">
        <header className="mb-2 sm:mb-4 p-3 sm:p-4 bg-slate-800 rounded-lg shadow-lg flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4">
                <button 
                    onClick={() => setIsMobileWorldLogOpen(true)} 
                    className="md:hidden p-2 text-purple-300 hover:text-purple-100"
                    aria-label="Открыть Дневник Мира"
                >
                    <BookOpenIcon className="w-6 h-6" />
                </button>
                <PlayerCharacterIcon className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 border-purple-500 text-purple-300 flex-shrink-0" />
                <div>
                    <h1 className="text-lg sm:text-2xl font-bold text-purple-400">{initialCharacter.name}</h1>
                    <p className="text-xs sm:text-sm text-slate-300">{initialCharacter.race.name} {initialCharacter.class.name} - Ур. {currentLevel}</p> 
                    {initialCharacter.isNsfwEnabled && <p className="text-xs text-red-400 font-semibold">(Режим 18+ Активен)</p>}
                </div>
            </div>
            <div className="flex items-center space-x-2">
              {selectedModelInfo && <p className="text-xs text-slate-400 hidden sm:block">ИИ: {selectedModelInfo.name}</p>}
              <button 
                  onClick={() => setIsMobilePlayerPanelOpen(true)} 
                  className="lg:hidden p-2 text-purple-300 hover:text-purple-100 mr-1"
                  aria-label="Открыть Информацию о Герое"
              >
                  <UserCircleIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => setShowGameMenu(prev => !prev)}
                className="p-2 text-purple-300 hover:text-purple-100"
                aria-label="Открыть меню игры"
              >
                <CogIcon className="w-6 h-6" />
              </button>
            </div>
        </header>
        {showGameMenu && (
            <DebugMenu 
                onClose={() => setShowGameMenu(false)}
                onForceLevelUp={handleForceLevelUpFromMenu}
                lastAiResponseTokenCount={lastAiResponseTokenCount}
                onSaveGame={handleManualSaveGame}
                lastAutosaveStatus={lastAutosaveStatus} 
                onStartNewGame={handleStartNewGameFromMenu}
            />
        )}

        {error && <div className="my-2 p-3 bg-red-700 text-white rounded-md text-sm mx-1 sm:mx-0">{error}</div>}

        {!apiKeyAvailable && !error && (
            <div className="my-2 p-3 bg-yellow-600 text-white rounded-md text-sm mx-1 sm:mx-0">
                Внимание: API-ключ не обнаружен. Взаимодействие с ИИ будет отключено.
            </div>
        )}

        <div className="flex-grow overflow-y-auto mb-2 sm:mb-4 p-2 sm:p-4 bg-slate-800 rounded-lg shadow-inner space-y-4 custom-scrollbar">
            {chatHistory.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-end max-w-[85%] sm:max-w-xs md:max-w-md lg:max-w-lg ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.sender === 'ai' && <div className="mr-2 self-start flex-shrink-0"><AiAvatar /></div>}
                {msg.sender === 'user' && <div className="ml-2 self-start flex-shrink-0"><UserPlayerAvatar /></div>}
                <div
                    className={`px-3 py-2 sm:px-4 sm:py-3 rounded-xl shadow relative group ${
                    msg.sender === 'user' ? 'bg-purple-600 text-white rounded-br-none' :
                    msg.sender === 'ai' ? 'bg-slate-700 text-slate-200 rounded-bl-none' :
                    'bg-yellow-600 text-black rounded-lg text-center w-full' 
                    }`}
                >
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-purple-200' : 'text-slate-400'} ${msg.sender === 'system' ? 'hidden' : ''} text-opacity-75`}>
                    {new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {msg.sender === 'ai' && (
                        <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                            {!msg.isRegenerating && msg.text.trim() !== "..." && apiKeyAvailable && (
                            <button
                                onClick={() => handleRegenerateMessage(msg.id, 0)} 
                                className="p-1 text-slate-400 hover:text-purple-300 bg-slate-600 hover:bg-slate-500 rounded-full"
                                aria-label="Сгенерировать ответ заново"
                                title="Сгенерировать ответ заново"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>
                            )}
                            {msg.isRegenerating && (
                            <LoadingSpinner size="w-5 h-5" color="text-purple-400" />
                            )}
                        </div>
                    )}
                </div>
                </div>
            </div>
            ))}
            {isAiTyping && !isDiceInterfaceActive && !chatHistory.some(m => m.isRegenerating) && ( 
             <div className="flex justify-start" aria-live="polite" aria-atomic="true">
                <div className="flex items-end">
                    <div className="mr-2 self-start flex-shrink-0"><AiAvatar /></div>
                    <div className="px-4 py-3 rounded-xl shadow bg-slate-700 text-slate-200 rounded-bl-none flex items-center">
                        <LoadingSpinner size="w-5 h-5" color="text-purple-400" />
                        <span className="ml-2 text-sm italic text-slate-400">ИИ пишет...</span>
                    </div>
                </div>
            </div>
            )}
            <div ref={chatEndRef} />
        </div>

        <div className="mb-1 sm:mb-2 p-1 h-48 sm:h-64 flex items-center justify-center">
            {isDiceInterfaceActive && activeDiceRollRequest ? (
                <DiceRoller
                    request={activeDiceRollRequest}
                    characterStats={currentStats}
                    onRollComplete={handleDiceRollComplete}
                />
            ) : (
                 <div className="text-sm text-slate-500 italic h-full flex items-center justify-center">
                 </div>
            )}
        </div>

        <footer className="p-1 sm:p-2 bg-slate-800 rounded-lg shadow-lg">
            <div className="flex items-center space-x-1 sm:space-x-2">
            <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isAiTyping && !isDiceInterfaceActive && handleSendMessage()} 
                placeholder={!apiKeyAvailable ? "Чат отключен (Нет API-ключа)" : isDiceInterfaceActive ? "Совершите бросок..." : chatHistory.some(m=>m.isRegenerating) ? "ИИ генерирует ответ..." : "Что вы делаете?" } 
                disabled={isAiTyping || !apiKeyAvailable || isDiceInterfaceActive || chatHistory.some(m=>m.isRegenerating) || isLevelUpModalOpen } 
                className="flex-grow p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-slate-100 disabled:opacity-50"
            />
            <button
                onClick={handleSendMessage}
                disabled={isAiTyping || !userInput.trim() || !apiKeyAvailable || isDiceInterfaceActive || chatHistory.some(m=>m.isRegenerating) || isLevelUpModalOpen } 
                className="p-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Отправить сообщение"
            >
                <SendIcon className="w-5 h-5 sm:w-6 sm:h-6"/>
            </button>
            </div>
        </footer>
      </div>

      <div className="flex-shrink-0 w-72 hidden lg:flex flex-col gap-4">
            <PlayerInfoPanel
                characterBasicInfo={characterBasicInfoForPanel}
                currentStatuses={currentPlayerStatuses}
                hp={currentHp}
                maxHp={currentMaxHp}
                stats={currentStats}
                skills={currentSkills}
                isNsfwEnabled={initialCharacter.isNsfwEnabled}
                inventory={currentInventory} 
                level={currentLevel}
                currentXP={currentXP}
                xpToNextLevel={currentXpToNextLevel}
            />
            <FocusInfoPanel focusTargetInfo={focusTargetInfo} />
      </div>
    </div>

    {isMobileWorldLogOpen && (
        <MobilePanelOverlay title="Дневник Мира" onClose={() => setIsMobileWorldLogOpen(false)}>
            <WorldLogPanel character={initialCharacter} />
        </MobilePanelOverlay>
    )}
    {isMobilePlayerPanelOpen && (
        <MobilePanelOverlay title="Информация о Герое" onClose={() => setIsMobilePlayerPanelOpen(false)}>
            <PlayerInfoPanel
                characterBasicInfo={characterBasicInfoForPanel}
                currentStatuses={currentPlayerStatuses}
                hp={currentHp}
                maxHp={currentMaxHp}
                stats={currentStats}
                skills={currentSkills}
                isNsfwEnabled={initialCharacter.isNsfwEnabled}
                inventory={currentInventory}
                level={currentLevel}
                currentXP={currentXP}
                xpToNextLevel={currentXpToNextLevel}
            />
            <div className="mt-4">
              <FocusInfoPanel focusTargetInfo={focusTargetInfo} />
            </div>
        </MobilePanelOverlay>
    )}

    {isLevelUpModalOpen && (
        <LevelUpModal 
            isOpen={isLevelUpModalOpen}
            onClose={() => setIsLevelUpModalOpen(false)}
            character={getCurrentCharacterState()} 
            onLevelUpComplete={handleLevelUpComplete}
            apiKeyAvailable={apiKeyAvailable} 
        />
    )}
    </>
  );
});

export default ChatInterface;
