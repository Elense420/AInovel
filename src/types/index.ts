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
