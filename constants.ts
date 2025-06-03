
import { Race, Class, StatName, Stats, AiModelId } from './types';
import { ShieldIcon, SingleSparkIcon, BowIcon, PersonIcon, ElfIcon, DwarfIcon, OrcIcon, SparklesIcon } from './components/icons'; // Added ShieldIcon, SingleSparkIcon
import React from 'react'; // Added React import for React.ReactElement

export const STAT_NAMES_ORDERED: StatName[] = [
  StatName.Strength,
  StatName.Dexterity,
  StatName.Constitution,
  StatName.Intelligence,
  StatName.Wisdom,
  StatName.Charisma
];

export const STAT_NAME_TRANSLATIONS: { [key in StatName]: string } = {
  [StatName.Strength]: "Сила",
  [StatName.Dexterity]: "Ловкость",
  [StatName.Constitution]: "Телосложение",
  [StatName.Intelligence]: "Интеллект",
  [StatName.Wisdom]: "Мудрость",
  [StatName.Charisma]: "Харизма"
};

export const BASE_STAT_VALUE = 10;
export const MANUAL_POINTS_POOL = 6; // Points user can add or subtract
export const MIN_STAT_VALUE = 3; // Minimum value a stat can be reduced to

export const AVAILABLE_RACES: Race[] = [
  {
    id: 'human',
    name: 'Человек',
    description: 'Адаптивные и амбициозные, люди — самая распространенная раса, известная своим разнообразием и упорством.',
    baseStatModifiers: { [StatName.Strength]: 1, [StatName.Dexterity]: 1, [StatName.Constitution]: 1, [StatName.Intelligence]: 1, [StatName.Wisdom]: 1, [StatName.Charisma]: 1 },
    icon: PersonIcon({className: "w-12 h-12 mx-auto mb-2 text-purple-400"})
  },
  {
    id: 'elf',
    name: 'Эльф',
    description: 'Изящные и проницательные, эльфы обладают врожденной склонностью к магии и дикой природе, а также долгой продолжительностью жизни.',
    baseStatModifiers: { [StatName.Dexterity]: 2, [StatName.Intelligence]: 1 },
    icon: ElfIcon({className: "w-12 h-12 mx-auto mb-2 text-green-400"})
  },
  {
    id: 'dwarf',
    name: 'Дворф',
    description: 'Крепкие и выносливые, дворфы — мастера-ремесленники и воины, чувствующие себя как дома в горных твердынях.',
    baseStatModifiers: { [StatName.Constitution]: 2, [StatName.Strength]: 1 },
    icon: DwarfIcon({className: "w-12 h-12 mx-auto mb-2 text-amber-400"})
  },
  {
    id: 'orc',
    name: 'Орк',
    description: 'Могучие и свирепые, орки известны своей огромной силой и неукротимым духом в бою.',
    baseStatModifiers: { [StatName.Strength]: 2, [StatName.Constitution]: 1, [StatName.Charisma]: -1 },
    icon: OrcIcon({className: "w-12 h-12 mx-auto mb-2 text-red-400"})
  },
];

export const AVAILABLE_CLASSES: Class[] = [
  {
    id: 'warrior',
    name: 'Воин',
    description: 'Мастера боя, воины полагаются на силу, умение и тяжелую броню для победы над врагами.',
    baseStatModifiers: { [StatName.Strength]: 2, [StatName.Constitution]: 1 },
    icon: ShieldIcon({className: "w-12 h-12 mx-auto mb-2 text-sky-400"}),
    abilities: ["Второе дыхание", "Всплеск действий (на высоких уровнях)"]
  },
  {
    id: 'mage',
    name: 'Маг',
    description: 'Исследователи тайных искусств, маги владеют мощными заклинаниями, изменяя реальность своим интеллектом и знаниями.',
    baseStatModifiers: { [StatName.Intelligence]: 2, [StatName.Wisdom]: 1 },
    icon: SingleSparkIcon({className: "w-12 h-12 mx-auto mb-2 text-purple-400"}),
    abilities: ["Колдовство", "Магическое восстановление"]
  },
  {
    id: 'rogue',
    name: 'Плут',
    description: 'Хитрые и ловкие, плуты преуспевают в скрытности, обмане и нанесении ударов, когда их меньше всего ожидают.',
    baseStatModifiers: { [StatName.Dexterity]: 2, [StatName.Charisma]: 1 },
    icon: BowIcon({className: "w-12 h-12 mx-auto mb-2 text-lime-400"}), 
    abilities: ["Скрытая атака", "Воровской жаргон"]
  },
  {
    id: 'ranger',
    name: 'Следопыт',
    description: 'Хозяева дикой природы, следопыты — умелые охотники и следопыты, часто устанавливающие связь с животными.',
    baseStatModifiers: { [StatName.Dexterity]: 1, [StatName.Wisdom]: 2 },
    icon: BowIcon({className: "w-12 h-12 mx-auto mb-2 text-emerald-400"}),
    abilities: ["Избранный враг", "Знаток природы"]
  },
];

export const API_KEY_ERROR_MESSAGE = "API-ключ для Gemini не настроен. Убедитесь, что переменная окружения API_KEY установлена, или введите ключ в разделе создания персонажа для активации ИИ.";
export const GENERIC_ERROR_MESSAGE = "Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже.";

export const FALLBACK_GEMINI_TEXT_MODEL = AiModelId.GeminiPreview; // Changed to Preview

export const AVAILABLE_AI_MODELS: { id: AiModelId; name: string; description: string; icon?: React.ReactElement }[] = [
  {
    id: AiModelId.GeminiPreview,
    name: 'Gemini 2.5 Preview (Рекомендуемая)', 
    description: "Модель gemini-2.5-flash-preview-05-20. Отключен режим 'мышления' для максимальной скорости и отзывчивости. Примечание: официальная поддержка отключения 'мышления' заявлена для '04-17', но здесь также применяется.",
    icon: SparklesIcon({ className: "w-10 h-10 mx-auto mb-1 text-yellow-400" }) 
  },
  {
    id: AiModelId.GeminiActual,
    name: 'Gemini 2.5 Actual', 
    description: "Модель gemini-2.5-flash-preview-04-17. Стандартный режим 'мышления' для более высокого качества генерации (альтернатива).",
    icon: SparklesIcon({ className: "w-10 h-10 mx-auto mb-1 text-teal-400" }) 
  },
  {
    id: AiModelId.GeminiLegacy, 
    name: 'Gemini Legacy', 
    description: 'Старая модель gemini-2.0-flash для сравнения или при проблемах с новыми моделями.',
    icon: SparklesIcon({ className: "w-10 h-10 mx-auto mb-1 text-slate-400" })
  },
];

export const DEFAULT_AI_MODEL_ID = AiModelId.GeminiPreview; // Changed to Preview

// XP Progression: Total XP needed to reach a certain level.
// Index is (level - 1). So XP_THRESHOLDS[0] is XP for level 1 (0), XP_THRESHOLDS[1] is for level 2, etc.
// Level 1: 0 (start)
// Level 2: 100 total XP
// Level 3: 300 total XP
// Level 4: 600 total XP
// Level 5: 1000 total XP
// Level 6: 1500 total XP
// Level 7: 2100 total XP
// Level 8: 2800 total XP
// Level 9: 3600 total XP
// Level 10: 4500 total XP
// (This can be extended or modified)
export const XP_THRESHOLDS: number[] = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];
export const MAX_LEVEL = XP_THRESHOLDS.length;

// Base HP gain per level, excluding constitution modifier.
export const BASE_HP_GAIN_PER_LEVEL = 8;

export const SAVE_GAME_KEY = 'rpgAdventureSave';
