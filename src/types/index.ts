export interface IdeaCard {
  id: string;
  content: string;
  tag?: string;
  category?: string;
  order: number;
  createdAt: number;
}

export interface LorebookEntry {
  id: string;
  name: string;
  appearance?: string;
  personality?: string;
  behaviorQuirks?: string;
  mustIncludeTaboos?: string;
  enabled: boolean;
}

export interface NovelSkill {
  id: string;
  name: string;
  description: string;
  promptInstruction: string;
  category?: 'style' | 'rule' | 'preference' | 'custom';
  enabled: boolean;
  isPreset?: boolean;
}

export const DEFAULT_PRESET_SKILLS: NovelSkill[] = [
  {
    id: 'skill-no-ai-style',
    name: '🚫 去 AI 味与禁用套话',
    description: '禁止“然而”、“不得不承认”、“仿佛在诉说着”、“无形中”、“眼神中闪过一丝”等典型 AI 机械套话。',
    promptInstruction: '【去 AI 味约束】严格禁止在任何段落使用 AI 写作常见高频套话（如：然而、不得不承认、仿佛在诉说着、无形中、眼神中闪过一丝、不可否认等）。请使用接地气的大众文学与影视化叙事，行文自然干练。',
    category: 'style',
    enabled: true,
    isPreset: true,
  },
  {
    id: 'skill-no-negative-progressive',
    name: '🛑 禁用高频否定递进句',
    description: '禁止连续使用“不仅没有...反而...”、“非但没有...甚至...”等生硬转折对比句。',
    promptInstruction: '【句式结构约束】严格限制“不仅没有...反而...”、“非但没有...反而...”、“看似...实则...”等生硬否定递进与强行对比句式的使用，单章不得超过1次，语言逻辑需平实自然。',
    category: 'rule',
    enabled: true,
    isPreset: true,
  },
  {
    id: 'skill-sensory-imagery',
    name: '🎨 视觉五感细节加持',
    description: '强化光影、声音、温度、触感与微动作，杜绝直接给抽象定性结论。',
    promptInstruction: '【五感画面感加持】增强叙事的画面感与沉浸感，强制融合视觉光影、声音震颤、温度触感与微物理动作，用具体的场景画面表现情感与心理，严禁直接给抽象结论。',
    category: 'preference',
    enabled: true,
    isPreset: true,
  },
  {
    id: 'skill-natural-dialogue',
    name: '💬 自然口语化台词',
    description: '杜绝长篇宣讲式台词，对话短促生动，符合身份与现实心理。',
    promptInstruction: '【台词去剧场腔】人物对话必须符合当下身份与心理，短小精炼、带有人情味与现实口语节奏，严禁长篇大论的宣讲式台词与不合时宜的剧场腔表达。',
    category: 'style',
    enabled: true,
    isPreset: true,
  },
  {
    id: 'skill-fast-conflict-hook',
    name: '⚡ 冲突推进与结尾悬念',
    description: '保证暗流涌动的情节对抗，章末埋下引人入胜的悬念钩子。',
    promptInstruction: '【情绪爆点与钩子】在章节中保证剧情推演的戏剧冲突与潜台词对抗，结尾处留有悬念或情绪爆点，极大拉动读者的连载阅读期待。',
    category: 'preference',
    enabled: false,
    isPreset: true,
  },
];

export interface BookSettings {
  genre: string;
  style: string;
  chapterWords: number | string;
  pov: string;
  tense: string;
  temperature: number | string;
  contextMemory: number | string;
  aiPersona: string;
  outline: string;
  characters: string;
  world: string;
  styleReference: string | null;
  lorebook?: LorebookEntry[];
  skills?: NovelSkill[];
}

export interface Chapter {
  id: string;
  index: number;
  title: string;
  text: string;
  meta: string;
  userNextPlotInput?: string;
  allSuggestions?: Array<{ suggestions: string[]; timestamp: number }>;
  nextOptions?: string[];
}

export interface ArchivedChapter extends Chapter {
  archivedAt: number;
}

export interface Summary {
  id: string;
  createdAt: number;
  startChapter: number;
  endChapter: number;
  chapterRange: string;
  content: string;
  title: string;
}

export interface Book {
  id: string;
  title: string;
  createdAt: number;
  lastModifiedAt: number;
  chapters: Chapter[];
  archivedChapters: ArchivedChapter[];
  summaries: Summary[];
  settings: BookSettings;
}

export interface ApiConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  provider: 'openai-compatible' | 'built-in-gemini';
  modelsCache?: Array<{ id: string; name?: string }>;
}

export interface InspirationRecord {
  id: string;
  createdAt: number;
  title: string;
  genre: string;
  style: string;
  outline: string;
  characters: string;
  world: string;
  rawContent: string;
  linkedNovels?: Array<{ novelId: string; novelTitle: string }>;
}

export interface UiSettings {
  theme: 'green' | 'pink' | 'blue' | 'yellow' | 'purple' | 'white';
  mode: 'light' | 'dark';
  chapterFontSize: string;
  writerApiCfgId: string | null;
  writerApiModel: string | null;
  rerollApiCfgId: string | null;
  rerollApiModel: string | null;
  inspirationApiCfgId: string | null;
  inspirationApiModel: string | null;
}

export interface HistoryItem {
  id?: number | string;
  createdAt?: number;
  ts?: number;
  content?: string;
  text?: string;
}
