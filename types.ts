
import {ReactElement} from 'react'; // Added import for ReactElement

export enum StatName {
  Strength = "Strength",
  Dexterity = "Dexterity",
  Constitution = "Constitution",
  Intelligence = "Intelligence",
  Wisdom = "Wisdom",
  Charisma = "Charisma"
}

export type Stats = {
  [key in StatName]?: number;
};

export interface Race {
  id: string;
  name: string;
  description: string;
  baseStatModifiers: Stats;
  icon?: ReactElement; // Changed from React.ReactNode
}

export interface Class {
  id: string;
  name: string;
  description: string;
  baseStatModifiers: Stats;
  icon?: ReactElement; // Changed from React.ReactNode
  abilities: string[];
}

export interface Skill {
  name:string;
  description: string;
}

export enum AiModelId {
  GeminiPreview = 'gemini-2.5-flash-preview-05-20', // New Preview Model
  GeminiActual = 'gemini-2.5-flash-preview-04-17',  // New Actual Model (Guideline Recommended)
  GeminiLegacy = 'gemini-2.0-flash',              // Old model, formerly GeminiFlash
  // Add other model IDs here in the future
}

export enum ItemType {
  Weapon = "weapon",
  Armor = "armor",
  Potion = "potion",
  Quest = "quest", // Important item for a quest
  Misc = "misc",   // Miscellaneous, can be crafting, junk, etc.
  Food = "food",
  Key = "key",
  Book = "book",
  Currency = "currency", // Gold, gems, etc.
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  quantity: number;
  icon?: ReactElement; // Optional icon for item
}


export interface Character {
  name: string;
  race: Race;
  class: Class;
  backstory: string;
  stats: Stats;
  worldElements: string[];
  skills: Skill[]; 
  statuses: string[];
  hp: number;
  maxHp: number;
  isNsfwEnabled: boolean;
  selectedAiModelId: AiModelId; 
  customWorldSetting?: string;
  inventory: Item[]; // Added inventory
  
  // New fields for leveling system
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  newlyAcquiredAbility?: Skill; // Optional: for immediate post-level-up display or logic
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  timestamp: Date;
  finishReason?: string; // Reason why the AI stopped generating this message
  isRegenerating?: boolean; // True if this message is currently being regenerated
}

export enum GamePhase {
  CharacterCreation = "characterCreation",
  Gameplay = "gameplay",
  Error = "error",
  Loading = "loading", // Added for initial load check
  LoadPrompt = "loadPrompt" // Added for showing load prompt
}

export interface AiStatSuggestion {
  stat_modifiers: Stats;
  world_elements: string[];
  skills: Skill[]; 
}

export interface AiGeneratedWorldContent {
  races: Race[];
  classes: Class[];
}

export interface FocusTargetInfo {
  name: string;
  hp?: number; 
  maxHp?: number;
  type: string; 
  role?: string; 
  status?: string; 
  description?: string; 
}

// --- Типы для системы бросков кубиков ---

/**
 * Запрос от ИИ на совершение броска кубика.
 */
export interface DiceRollRequest {
  id: string; // Уникальный идентификатор для этого запроса на бросок
  statsToRoll: StatName[]; // Массив характеристик, по которым нужно сделать бросок
  description: string; // Описание действия, для которого совершается бросок
}

/**
 * Результат броска по одной характеристике.
 */
export interface SingleStatRollResult {
  statName: StatName;
  diceValue: number; // Значение, выпавшее на кубике (1-20)
  modifier: number; // Модификатор от характеристики
  totalValue: number; // Итоговое значение (diceValue + modifier)
}

/**
 * Полный отчет о результатах всех бросков по одному запросу.
 */
export interface DiceRollReport {
  rollId: string; // ID оригинального запроса DiceRollRequest
  rollDescription: string; // Описание из оригинального запроса
  results: SingleStatRollResult[]; // Массив результатов по каждой характеристике
}

// --- Типы для системы уровней ---
export interface LevelUpPayload { // Data sent from LevelUpModal to ChatInterface
    chosenStatIncrease: StatName | null;
    chosenAbility: Skill | null; // Added chosen ability
}

// --- Типы для сохранения игры ---
export interface SavedGame {
  character: Character;
  chatHistory: ChatMessage[];
  focusTargetInfo: FocusTargetInfo | null;
  lastSaved: string; // ISO date string
}