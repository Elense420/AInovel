import { Book, ApiConfig, InspirationRecord, UiSettings, HistoryItem } from '../types';

const DB_NAME = 'aiNovelistDB';
const DB_VERSION = 1;

export const STORE_NAMES = {
  BOOKS: 'books',
  CONFIGS: 'configs',
  PERSONA_HISTORY: 'personaHistory',
  OUTLINE_HISTORY: 'outlineHistory',
  UI_SETTINGS: 'uiSettings',
  STYLE_HISTORY: 'styleHistory',
  XP_PREFERENCES: 'xpPreferences',
  XP_PREFERENCES_HISTORY: 'xpPreferencesHistory',
  INSPIRATION_RECORDS: 'inspirationRecords',
} as const;

let dbInstance: IDBDatabase | null = null;

export async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      Object.values(STORE_NAMES).forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          if (
            ([
              STORE_NAMES.PERSONA_HISTORY,
              STORE_NAMES.OUTLINE_HISTORY,
              STORE_NAMES.STYLE_HISTORY,
              STORE_NAMES.XP_PREFERENCES_HISTORY,
            ] as string[]).includes(storeName)
          ) {
            db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
          } else {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      });
    };

    request.onsuccess = (event: any) => {
      dbInstance = event.target.result;
      resolve(dbInstance!);
    };

    request.onerror = (event: any) => {
      console.error('IndexedDB Error:', event.target.errorCode);
      reject('Error opening IndexedDB');
    };
  });
}

async function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore, resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    callback(store, resolve, reject);
  });
}

export async function dbPut(storeName: string, data: any): Promise<any> {
  return transact(storeName, 'readwrite', (store, resolve) => {
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function dbGet<T = any>(storeName: string, key: string | number): Promise<T | null> {
  return transact<T | null>(storeName, 'readonly', (store, resolve) => {
    const request = store.get(key);
    request.onsuccess = (event: any) => resolve(event.target.result || null);
    request.onerror = () => resolve(null);
  });
}

export async function dbGetAll<T = any>(storeName: string): Promise<T[]> {
  return transact<T[]>(storeName, 'readonly', (store, resolve) => {
    const request = store.getAll();
    request.onsuccess = (event: any) => resolve(event.target.result || []);
    request.onerror = () => resolve([]);
  });
}

export async function dbDelete(storeName: string, key: string | number): Promise<void> {
  return transact<void>(storeName, 'readwrite', (store, resolve) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
  });
}

export async function dbClear(storeName: string): Promise<void> {
  return transact<void>(storeName, 'readwrite', (store, resolve) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
  });
}

export const BUILTIN_CONFIG_ID = 'builtin-gemini-line';

export const DEFAULT_BUILTIN_CONFIG: ApiConfig = {
  id: BUILTIN_CONFIG_ID,
  name: 'Gemini 官方内置线路',
  baseUrl: '/api/ai',
  apiKey: 'BUILTIN_KEY',
  provider: 'built-in-gemini',
  modelsCache: [
    { id: 'gemini-3.6-flash', name: '[⚡默认] Gemini 3.6 Flash' },
    { id: 'gemini-3.1-pro-preview', name: '[🧠强推] Gemini 3.1 Pro' },
    { id: 'gemini-3.1-flash-lite', name: '[🚀极速] Gemini 3.1 Flash Lite' },
  ],
};

export async function seedInitialDataIfEmpty() {
  const existingBooks = await dbGetAll<Book>(STORE_NAMES.BOOKS);
  const existingConfigsWrapper = await dbGet<{ id: string; data: ApiConfig[] }>(STORE_NAMES.CONFIGS, 'all');

  let configs = existingConfigsWrapper?.data || [];

  if (!configs.some((c) => c.id === BUILTIN_CONFIG_ID)) {
    configs.unshift(DEFAULT_BUILTIN_CONFIG);
    await dbPut(STORE_NAMES.CONFIGS, { id: 'all', data: configs });
  }

  const existingUiSettings = await dbGet<UiSettings>(STORE_NAMES.UI_SETTINGS, 'current');
  if (!existingUiSettings) {
    const defaultUi: UiSettings = {
      theme: 'green',
      mode: 'light',
      chapterFontSize: '1.05rem',
      writerApiCfgId: BUILTIN_CONFIG_ID,
      writerApiModel: 'gemini-3.6-flash',
      rerollApiCfgId: BUILTIN_CONFIG_ID,
      rerollApiModel: 'gemini-3.6-flash',
      inspirationApiCfgId: BUILTIN_CONFIG_ID,
      inspirationApiModel: 'gemini-3.6-flash',
    };
    await dbPut(STORE_NAMES.UI_SETTINGS, { id: 'current', ...defaultUi });
  }

  if (existingBooks.length === 0) {
    const now = Date.now();
    const demoBook1: Book = {
      id: 'demo-book-1',
      title: '魔尊的见习药仙',
      createdAt: now - 86400000 * 3,
      lastModifiedAt: now - 3600000,
      archivedChapters: [],
      summaries: [
        {
          id: 'sum-1',
          createdAt: now - 86400000,
          startChapter: 1,
          endChapter: 2,
          chapterRange: '1 - 2',
          title: '第1-2章总结',
          content: '一、故事进展：小药仙顾星辰在暴风雪深山发现重伤坠落的魔尊辰渊（幼年受创态），将其悉心照料。二、感情线：辰渊体会到世间唯一的纯粹善意，萌生极强保护欲。',
        },
      ],
      settings: {
        genre: '仙侠 / 耽美纯爱',
        style: '爱情甜宠 霸道强势 治愈救赎',
        chapterWords: 2500,
        pov: '第三人称',
        tense: '现在时',
        temperature: 0.8,
        contextMemory: 3,
        aiPersona: '你是一位精通仙侠纯爱与奇幻动作的小说家，文字画面感强，注重细腻的情感互动与场景氛围打造。',
        characters: '- 顾星辰：仙族见习药仙，性格温柔坚韧，身怀纯净灵力与古药天赋。\n- 辰渊：魔界至高魔尊，实力毁天灭地，行事霸道冷酷，唯独对顾星辰展现深情脆弱。',
        world: '架空古代，仙魔妖三界并立。仙界秩序严苛，魔界弱肉强食，人界灵气稀薄乃交汇避风港。',
        outline: '第一幕：山中独居小药仙在白雪深处拾到重伤的小男孩（魔尊变小体）。\n第二幕：悉心包扎疗伤，魔尊体会异样平静与占有欲。\n第三幕：仙界察觉异象围捕，魔尊强行破封恢复本尊，惊天营救！',
        styleReference: null,
      },
      chapters: [
        {
          id: 'ch-1',
          index: 1,
          title: '第一章：山中独居小药仙，白雪深处拾“稚童”',
          text: `人界采药山深处，常年笼罩着终年不散的薄雾。

顾星辰系紧了腰间的药囊，踏着未融的积雪走在陡峭的山径上。他不过是仙界最普通不过的一名见习药仙，体质孱弱，灵力低微，被派驻到这偏远的山林中照料灵草药圃。

“今日的露水倒是采够了……”顾星辰擦了擦额前细密的汗珠，轻声自语。

突然，前方幽深的林谷间传来一声惊天动地的轰鸣！漆黑如墨的狂暴魔气将半边天空染成惨烈深黑，狂风刮得漫山松柏猎猎作响。顾星辰被这股恐怖的威压震得气血翻涌，连退数步。

片刻后，风暴渐渐平息。

顾星辰忍着心中的惊恐，顺着断裂的树木寻去，竟在黑石乱堆中发现了一个浑身是血的缩影——那竟是个看起来不过七八岁的孩童，衣袍破烂，伤口狰狞得令人心惊肉跳，周身还残存着令人窒息的血腥杀意。

“天哪……竟伤得如此重……”

顾星辰心地纯善，看着孩子惨白如纸的小脸，终究没能忍住怜悯之心。他脱下温热的外袍裹住孩子，将这“非同寻常”的伤者背回了自己的草庐。`,
          meta: '模型: gemini-3.6-flash | 耗时: 1280ms | 字数: 432',
          allSuggestions: [
            {
              timestamp: now - 86400000 * 2,
              suggestions: [
                '【方向1】小屋初遇：孩童醒来冷漠不语，顾星辰温柔包扎换药，魔尊被其纯粹吸引。',
                '【方向2】仙界探子：仙界追寻魔气异动来到山脚，顾星辰隐藏小男孩躲过搜查。',
                '【方向3】异能初显：小男孩无意间展现出瞬间御动魔植的异能，让顾星辰心生疑虑。',
                '【方向4】旧伤复发：深夜孩子体热高烧，顾星辰不惜以自身灵力配药相救。',
              ],
            },
          ],
        },
        {
          id: 'ch-2',
          index: 2,
          title: '第二章：小屋初遇，魔尊的沉默与药仙的柔情',
          text: `草庐内幽香袅袅，药炉里正咕嘟咕嘟冒着热气。

顾星辰端着刚熬好的汤药来到榻前，小心翼翼地为小男孩擦拭脸上的血污。榻上的孩子不知何时已睁开了双眼，那双漆黑的眼眸如同没有尽头的深渊，冷冽、警惕而冰凉，与稚嫩的面庞形成极致反差。

“你醒了？”顾星辰柔声笑道，眼神清澈，“别怕，这里很安全，我是山上的药仙。你身上的伤口我已经用凝血草敷过了。”

小男孩没有说话，只是死死盯着顾星辰搭在他肩上的手，周身紧绷得宛如拉满的弓弦。他便是令三界闻风丧胆的魔尊辰渊，因战神偷袭重伤导致功体倒退回幼体，本以为坠入人界必死无疑，却没想到会被一个仙族蝼蚁救下。

顾星辰吹了擦汤药，舀起一勺送到他唇边：“有些苦，但对伤口大有好处，喝一口好不好？”

辰渊冷眼看着面爽温润的草药汤，本能想挥手打翻，可触及顾星辰眼中毫无杂质的关切与期待时，指尖微微一颤，鬼使神差地低头将汤药咽了下去。

草药的苦涩在舌尖蔓延，可草庐中的暖意，却沿着经脉缓缓渗入了魔尊万年冰封的心深处。`,
          meta: '模型: gemini-3.6-flash | 耗时: 1420ms | 字数: 485',
          userNextPlotInput: '下一章仙界追兵逼近山谷，顾星辰冒死守护小男孩，魔尊首次展露护短本能。',
          allSuggestions: [
            {
              timestamp: now - 3600000,
              suggestions: [
                '【建议1】山谷危机：仙界巡逻队发现魔气残痕，搜查草庐，顾星辰急中生智掩护。',
                '【建议2】占有欲萌芽：邻山药童拜访顾星辰，辰渊冷眼相待，对靠近顾星辰的人产生排斥。',
                '【建议3】功力恢复：深夜辰渊盘膝调息，引得周围植被疯长，被顾星辰意外撞见。',
                '【建议4】山中采药：顾星辰带辰渊入山辨识灵草，两人度过一段温馨美好的午后时光。',
              ],
            },
          ],
        },
      ],
    };

    const demoBook2: Book = {
      id: 'demo-book-2',
      title: '深渊之光',
      createdAt: now - 86400000 * 5,
      lastModifiedAt: now - 86400000 * 4,
      archivedChapters: [],
      summaries: [],
      settings: {
        genre: '赛博朋克 / 科幻悬疑',
        style: '反乌托邦 黑暗强强 爽快反转',
        chapterWords: 2000,
        pov: '第三人称',
        tense: '过去时',
        temperature: 0.8,
        contextMemory: 3,
        aiPersona: '你是一位精通赛博朋克与科幻悬疑的酷炫小说家。',
        characters: '- 陆宵：霓虹城顶级黑客与机械义体医生。\n- 零号：从底穹实验室逃脱的终极AI人形兵器。',
        world: '2099年霓虹城，高天财阀掌控记忆芯片，底穹贫民窟永不见天日。',
        outline: '陆宵捡到了失忆的零号，发现其脑内芯片藏着倾覆财阀统治的终极密钥。',
        styleReference: null,
      },
      chapters: [
        {
          id: 'ch-2-1',
          index: 1,
          title: '第一章：雨夜里的机械惊魂',
          text: `霓虹城的酸雨砸在铁皮屋顶上，发出刺耳的噪音。

陆宵戴着单眼护目镜，正用激光镊子焊接一枚旧型记忆芯片。工坊后门突然传来一声沉重的撞击，随后是金属重物倒地的不刺响声。

陆宵拔出腰间的电磁手枪，推门走入巷道。积水中躺着一名身穿高阶骨骼战甲的年轻人，后颈处暴露的接口正喷践出湛蓝色的电火花……`,
          meta: '模型: gemini-3.6-flash | 耗时: 1100ms | 字数: 165',
        },
      ],
    };

    await dbPut(STORE_NAMES.BOOKS, demoBook1);
    await dbPut(STORE_NAMES.BOOKS, demoBook2);

    // Seed sample inspiration records
    const sampleInspiration: InspirationRecord = {
      id: 'insp-demo-1',
      createdAt: now - 86400000 * 2,
      title: '赛博破晓：终极械心',
      genre: '赛博朋克 / 悬疑',
      style: '黑暗、反乌托邦、快节奏',
      world: '高天财阀垄断意识上传，贫民窟居民靠二手义体苟活。',
      characters: '- 顾离：黑客义体医生；- 零号：被财阀追杀的禁忌机械体。',
      outline: '讲述黑客顾离意外解开零号核心防线，两人携手颠覆财阀垄断的故事。',
      rawContent: '### 大纲标题：赛博破晓\n**书名：** 赛博破晓\n**题材：：** 赛博朋克+悬疑',
      linkedNovels: [{ novelId: demoBook2.id, novelTitle: demoBook2.title }],
    };
    await dbPut(STORE_NAMES.INSPIRATION_RECORDS, sampleInspiration);
  }
}
