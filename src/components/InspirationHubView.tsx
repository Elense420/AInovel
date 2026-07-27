import React, { useState, useEffect, useMemo } from 'react';
import { generateUUID } from '../utils/uuid';
import { Lightbulb, Sparkles, Search, Filter, Plus, Download, Upload, Trash2, Edit3, Check, Link as LinkIcon, BookOpen, X, FileText, ArrowRight, Layers, ArrowUp, ArrowDown, Wand2, CheckSquare, Square, GripVertical } from 'lucide-react';
import { InspirationRecord, Book, UiSettings, ApiConfig, IdeaCard } from '../types';
import { dbPut, dbGetAll, dbDelete, dbClear, STORE_NAMES } from '../services/db';
import { chatCompletion } from '../services/apiClient';
import JSZip from 'jszip';

interface InspirationHubViewProps {
  books: Book[];
  configs: ApiConfig[];
  uiSettings: UiSettings;
  xpPreferences: string;
  onSelectInspirationForCreation: (record: InspirationRecord) => void;
  onOpenBookFromInspiration: (bookId: string) => void;
}

const DEFAULT_GENRE_TAGS = [
  '现代', '都市', '校园', '职场', '娱乐圈', '奇幻', '灵异', '古代', '宫廷侯爵',
  '江湖武侠', '古代种田', '修仙', '仙魔', '西方奇幻', '中世纪欧洲', '魔法世界', '神怪传说',
  '星际', 'ABO', '哨兵向导', '末世', '废土', '丧尸', '无限流', '快穿', '穿书',
  '悬疑', '惊悚', '同人', '穿越', '重生', '日常', '人外', '兽人', '人鱼',
  '虫族', '克苏鲁', '强制爱', '美食', '萌娃', '系统', '其他'
];

const CARD_GRADIENTS = [
  'from-cyan-50/90 to-blue-100/80 dark:from-cyan-950/40 dark:to-blue-900/40 border-cyan-200/50 dark:border-cyan-800/40',
  'from-emerald-50/90 to-teal-100/80 dark:from-emerald-950/40 dark:to-teal-900/40 border-emerald-200/50 dark:border-emerald-800/40',
  'from-purple-50/90 to-indigo-100/80 dark:from-purple-950/40 dark:to-indigo-900/40 border-purple-200/50 dark:border-purple-800/40',
  'from-amber-50/90 to-orange-100/80 dark:from-amber-950/40 dark:to-orange-900/40 border-amber-200/50 dark:border-amber-800/40',
  'from-rose-50/90 to-pink-100/80 dark:from-rose-950/40 dark:to-pink-900/40 border-rose-200/50 dark:border-rose-800/40',
];

export const InspirationHubView: React.FC<InspirationHubViewProps> = ({
  books,
  configs,
  uiSettings,
  xpPreferences,
  onSelectInspirationForCreation,
  onOpenBookFromInspiration,
}) => {
  const [subTab, setSubTab] = useState<'cards' | 'create' | 'records'>('cards');

  // Idea Cards Stacking State
  const [ideaCards, setIdeaCards] = useState<IdeaCard[]>([]);
  const [newCardContent, setNewCardContent] = useState('');
  const [newCardCategory, setNewCardCategory] = useState<string>('收集箱');
  const [newCardTag, setNewCardTag] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [isConvertingCards, setIsConvertingCards] = useState(false);
  const [draggedCardIndex, setDraggedCardIndex] = useState<number | null>(null);

  // Generator inputs
  const [genreTags, setGenreTags] = useState<string[]>(DEFAULT_GENRE_TAGS);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [numOutlines, setNumOutlines] = useState<number>(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Records state
  const [records, setRecords] = useState<InspirationRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('');

  // Detail Modal State
  const [selectedRecord, setSelectedRecord] = useState<InspirationRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields inside modal
  const [editTitle, setEditTitle] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editStyle, setEditStyle] = useState('');
  const [editWorld, setEditWorld] = useState('');
  const [editCharacters, setEditCharacters] = useState('');
  const [editOutline, setEditOutline] = useState('');

  // Manual Link Dialog
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedNovelIdsToLink, setSelectedNovelIdsToLink] = useState<string[]>([]);

  // Download Inspirations Dialog
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [selectedDownloadIds, setSelectedDownloadIds] = useState<string[]>([]);

  useEffect(() => {
    loadRecords();
    loadIdeaCards();
  }, []);

  const loadIdeaCards = () => {
    const saved = localStorage.getItem('ai_novelist_idea_cards');
    if (saved) {
      try {
        setIdeaCards(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse idea cards', e);
      }
    } else {
      const demoCards: IdeaCard[] = [
        { id: '1', content: '高冷仙尊误喝真言水，在全宗门面前对废柴徒弟真情告白', tag: '名场面梗', category: '核心爆点', order: 0, createdAt: Date.now() },
        { id: '2', content: '表面上是人畜无害的小助理，暗地里是操控幕后资本的顶级黑客', tag: '人设反差', category: '角色设定', order: 1, createdAt: Date.now() - 1000 },
        { id: '3', content: '必须靠吸收别人的负面情绪当灵气修炼，满世界嘴炮吐槽', tag: '金手指 Hook', category: '金手指/机制', order: 2, createdAt: Date.now() - 2000 },
      ];
      setIdeaCards(demoCards);
      localStorage.setItem('ai_novelist_idea_cards', JSON.stringify(demoCards));
    }
  };

  const saveIdeaCards = (updated: IdeaCard[]) => {
    setIdeaCards(updated);
    localStorage.setItem('ai_novelist_idea_cards', JSON.stringify(updated));
  };

  const handleAddCard = () => {
    if (!newCardContent.trim()) return;
    const newCard: IdeaCard = {
      id: generateUUID(),
      content: newCardContent.trim(),
      tag: newCardTag.trim() || '灵感随笔',
      category: newCardCategory || '收集箱',
      order: ideaCards.length,
      createdAt: Date.now(),
    };
    const updated = [newCard, ...ideaCards];
    saveIdeaCards(updated);
    setNewCardContent('');
    setNewCardTag('');
  };

  const handleDeleteCard = (cardId: string) => {
    const updated = ideaCards.filter((c) => c.id !== cardId);
    saveIdeaCards(updated);
    setSelectedCardIds((prev) => prev.filter((id) => id !== cardId));
  };

  const handleMoveCard = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ideaCards.length) return;

    const updated = [...ideaCards];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    saveIdeaCards(updated);
  };

  const toggleSelectCard = (cardId: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const handleSelectAllCards = () => {
    if (selectedCardIds.length === ideaCards.length) {

      setSelectedCardIds([]);
    } else {
      setSelectedCardIds(ideaCards.map((c) => c.id));
    }
  };

  // Convert Selected Cards or Single Card into Full Book Outline
  const handleConvertCardsToOutline = async (targetCardIds?: string[]) => {
    const idsToUse = targetCardIds || selectedCardIds;
    if (idsToUse.length === 0) {
      alert('请先勾选需要融合的灵感卡片！');
      return;
    }

    const cardsToConvert = ideaCards.filter((c) => idsToUse.includes(c.id));
    const cardTexts = cardsToConvert.map((c, i) => `${i + 1}. [${c.category || '灵感'}] ${c.content} (标签: ${c.tag || '无'})`).join('\n');

    const inspCfg = configs.find((c) => c.id === uiSettings.inspirationApiCfgId) || configs[0];
    const modelToUse = uiSettings.inspirationApiModel || 'gemini-3.6-flash';

    setIsConvertingCards(true);
    setStatusMessage('🪄 AI 正在将选中的卡片点子融合成完整小说大纲...');

    try {
      const systemPrompt = `你是一位顶级创意小说主编。请根据用户提供的零散写作点子卡片，融合成一篇完整、逻辑通顺、富有爆点与戏剧冲突的小说大纲。
${xpPreferences ? `# 用户 XP 偏好与避雷要求：\n${xpPreferences}\n` : ''}
请严格输出以下 Markdown 结构：
---
### 大纲标题：[小说标题]
**书名：** [小说名称]
**题材：** [题材分类]
**风格：** [风格基调]
**核心设定：** [整合世界观与核心Hook机制]
**主要角色原型：** [角色设定与反差]
**剧情梗概：** [承接卡片点子的完整剧情走线]
**结局走向：** [HE / BE / 爽快结局]
---`;

      const res = await chatCompletion({
        provider: inspCfg?.provider,
        baseUrl: inspCfg?.baseUrl,
        apiKey: inspCfg?.apiKey,
        model: modelToUse,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请将以下灵感卡片融合成一篇长篇小说大纲：\n\n${cardTexts}` },
        ],
        temperature: 0.9,
      });

      const parsed = parseGeneratedOutline(res.content);
      const newRecord: InspirationRecord = {
        id: generateUUID(),
        createdAt: Date.now(),
        title: parsed.title,
        genre: parsed.genre,
        style: parsed.style,
        world: parsed.world,
        characters: parsed.characters,
        outline: parsed.outline,
        rawContent: res.content,
        linkedNovels: [],
      };

      await dbPut(STORE_NAMES.INSPIRATION_RECORDS, newRecord);
      await loadRecords();

      setStatusMessage(`🎉 卡片已成功融合成大纲《${parsed.title}》！并已保存至灵感库。`);
      setSelectedRecord(newRecord);
      setSubTab('records');
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`融合大纲失败: ${err.message}`);
    } finally {
      setIsConvertingCards(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    const list = await dbGetAll<InspirationRecord>(STORE_NAMES.INSPIRATION_RECORDS);
    setRecords(list);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = () => {
    const tag = customTag.trim();
    if (tag && !genreTags.includes(tag)) {
      setGenreTags((prev) => [...prev, tag]);
      setSelectedTags((prev) => [...prev, tag]);
      setCustomTag('');
    }
  };

  // Helper parser for AI output blocks
  const parseGeneratedOutline = (text: string) => {
    const result = {
      title: '未命名灵感大纲',
      genre: '通用',
      style: '爽快反转',
      world: '',
      characters: '',
      outline: '',
    };

    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    let currentField = '';

    for (const line of lines) {
      let match = line.match(/^###\s*(.+)/);
      if (match) {
        result.title = match[1].replace(/大纲标题[：:]*/, '').replace(/[*#]/g, '').trim();
        currentField = '';
        continue;
      }

      match = line.match(/^\*\*书名[：:]*?\*\*\s*(.+)/);
      if (match) {
        result.title = match[1].trim();
        continue;
      }

      match = line.match(/^\*\*题材[：:]*?\*\*\s*(.+)/);
      if (match) {
        result.genre = match[1].trim();
        continue;
      }

      match = line.match(/^\*\*风格[：:]*?\*\*\s*(.+)/);
      if (match) {
        result.style = match[1].trim();
        continue;
      }

      match = line.match(/^\*\*核心设定[：:]*?\*\*\s*(.*)/);
      if (match) {
        currentField = 'world';
        if (match[1]) result.world += match[1].trim() + '\n';
        continue;
      }

      match = line.match(/^\*\*主要角色原型[：:]*?\*\*\s*(.*)/);
      if (match) {
        currentField = 'characters';
        if (match[1]) result.characters += match[1].trim() + '\n';
        continue;
      }

      match = line.match(/^\*\*剧情梗概[：:]*?\*\*\s*(.*)/);
      if (match) {
        currentField = 'outline';
        if (match[1]) result.outline += match[1].trim() + '\n';
        continue;
      }

      match = line.match(/^\*\*结局走向[：:]*?\*\*\s*(.*)/);
      if (match) {
        currentField = '';
        continue;
      }

      if (currentField === 'world') result.world += line + '\n';
      else if (currentField === 'characters') result.characters += line + '\n';
      else if (currentField === 'outline') result.outline += line + '\n';
    }

    result.world = result.world.trim();
    result.characters = result.characters.trim();
    result.outline = result.outline.trim();

    return result;
  };

  // Generate Inspiration Outlines
  const handleGenerateInspirations = async () => {
    if (isGenerating) return;

    const inspCfg = configs.find((c) => c.id === uiSettings.inspirationApiCfgId) || configs[0];
    const modelToUse = uiSettings.inspirationApiModel || 'gemini-3.6-flash';

    setIsGenerating(true);
    setStatusMessage('✨ AI 正在大脑风暴构思灵感中...');

    try {
      const selectedGenreStr = selectedTags.join(', ');
      const keywordsStr = keywordsInput.trim();

      const systemPrompt = `你是一位顶尖创意小说策划师与构思专家，极其擅长根据指定的题材与标签，批量生成令人耳目一新的小说大纲。

${xpPreferences ? `# 用户 XP 偏好与避雷要求：\n${xpPreferences}\n` : ''}
# 任务要求：
一次性构思 ${numOutlines} 篇互相独立、创意新颖的小说大纲。
期望题材类型：${selectedGenreStr || '不限'}
核心关键词/梗：${keywordsStr || '不限'}

每篇大纲必须包含以下结构和内容，并以清晰的 Markdown 格式输出，用 "---" 分隔每篇大纲。
---
### 大纲标题：[小说标题]
**书名：** [小说名称]
**题材：：** [题材提炼]
**风格：：** [风格基调]
**核心设定：：** [简要的世界观与核心Hook机制]
**主要角色原型：：** [主要角色人设]
**剧情梗概：：** [主要情节推演与冲突爆点]
**结局走向：：** [HE / BE / 爽快结局]
---`;

      const res = await chatCompletion({
        provider: inspCfg?.provider,
        baseUrl: inspCfg?.baseUrl,
        apiKey: inspCfg?.apiKey,
        model: modelToUse,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '请开始构思并生成小说大纲。' },
        ],
        temperature: 0.95,
      });

      const rawContent = res.content;
      const blocks = rawContent
        .split('---')
        .filter((b) => b.trim().includes('###'))
        .map((b) => b.trim());

      if (blocks.length === 0) {
        setStatusMessage('未能解析出有效大纲，请尝试调整关键词后重试。');
        return;
      }

      for (const blockText of blocks) {
        const parsed = parseGeneratedOutline(blockText);
        const record: InspirationRecord = {
          id: generateUUID(),
          createdAt: Date.now(),
          title: parsed.title,
          genre: parsed.genre,
          style: parsed.style,
          world: parsed.world,
          characters: parsed.characters,
          outline: parsed.outline,
          rawContent: blockText,
          linkedNovels: [],
        };
        await dbPut(STORE_NAMES.INSPIRATION_RECORDS, record);
      }

      await loadRecords();
      setStatusMessage(`🎉 成功构思并保存 ${blocks.length} 篇灵感大纲！`);
      setSubTab('records');
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`生成失败: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records
      .filter((rec) => {
        const matchesTitle = rec.title.toLowerCase().includes(searchQuery.toLowerCase().trim());
        const matchesGenre = (rec.genre || '').toLowerCase().includes(genreFilter.toLowerCase().trim());
        return matchesTitle && matchesGenre;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [records, searchQuery, genreFilter]);

  // Open detail modal
  const openDetailModal = (record: InspirationRecord) => {
    setSelectedRecord(record);
    setEditTitle(record.title);
    setEditGenre(record.genre);
    setEditStyle(record.style);
    setEditWorld(record.world);
    setEditCharacters(record.characters);
    setEditOutline(record.outline);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedRecord) return;

    const updated: InspirationRecord = {
      ...selectedRecord,
      title: editTitle.trim(),
      genre: editGenre.trim(),
      style: editStyle.trim(),
      world: editWorld.trim(),
      characters: editCharacters.trim(),
      outline: editOutline.trim(),
    };

    await dbPut(STORE_NAMES.INSPIRATION_RECORDS, updated);
    setSelectedRecord(updated);
    setIsEditing(false);
    await loadRecords();
  };

  const handleDeleteRecord = async () => {
    if (!selectedRecord) return;
    if (confirm(`确定要删除灵感《${selectedRecord.title}》吗？`)) {
      await dbDelete(STORE_NAMES.INSPIRATION_RECORDS, selectedRecord.id);
      setSelectedRecord(null);
      await loadRecords();
    }
  };

  // Link novels logic
  const handleOpenLinkDialog = () => {
    if (!selectedRecord) return;
    const currentLinkedIds = (selectedRecord.linkedNovels || []).map((ln) => ln.novelId);
    setSelectedNovelIdsToLink(currentLinkedIds);
    setIsLinkDialogOpen(true);
  };

  const handleConfirmLinkNovels = async () => {
    if (!selectedRecord) return;

    const newLinkedNovels = books
      .filter((b) => selectedNovelIdsToLink.includes(b.id))
      .map((b) => ({ novelId: b.id, novelTitle: b.title }));

    const updatedRecord: InspirationRecord = {
      ...selectedRecord,
      linkedNovels: newLinkedNovels,
    };

    await dbPut(STORE_NAMES.INSPIRATION_RECORDS, updatedRecord);
    setSelectedRecord(updatedRecord);
    setIsLinkDialogOpen(false);
    await loadRecords();
  };

  const handleUnlinkNovel = async (novelId: string) => {
    if (!selectedRecord) return;
    const updatedLinked = (selectedRecord.linkedNovels || []).filter((ln) => ln.novelId !== novelId);
    const updatedRecord = { ...selectedRecord, linkedNovels: updatedLinked };

    await dbPut(STORE_NAMES.INSPIRATION_RECORDS, updatedRecord);
    setSelectedRecord(updatedRecord);
    await loadRecords();
  };

  // Backup & Restore
  const handleBackupRecords = () => {
    const jsonStr = JSON.stringify(records, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const filename = `AI小说家_灵感记录_${new Date().toISOString().slice(0, 10)}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('确定导入灵感数据吗？这将覆盖现有数据！')) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        if (Array.isArray(imported)) {
          await dbClear(STORE_NAMES.INSPIRATION_RECORDS);
          for (const item of imported) {
            await dbPut(STORE_NAMES.INSPIRATION_RECORDS, item);
          }
          await loadRecords();
          alert('✅ 灵感数据恢复成功！');
        }
      } catch (err: any) {
        alert(`数据格式无效: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Download Inspirations
  const handleConfirmDownloadInspirations = async () => {
    if (selectedDownloadIds.length === 0) {
      alert('请选择要下载的灵感');
      return;
    }

    const itemsToDownload = records.filter((r) => selectedDownloadIds.includes(r.id));

    if (itemsToDownload.length === 1) {
      const r = itemsToDownload[0];
      const content = `# ${r.title}\n\n## 题材\n${r.genre}\n\n## 风格\n${r.style}\n\n## 核心设定\n${r.world}\n\n## 主要角色原型\n${r.characters}\n\n## 剧情梗概\n${r.outline}`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${r.title.replace(/[\\/:*?"<>|]/g, '_')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const zip = new JSZip();
      itemsToDownload.forEach((r) => {
        const content = `# ${r.title}\n\n## 题材\n${r.genre}\n\n## 风格\n${r.style}\n\n## 核心设定\n${r.world}\n\n## 主要角色原型\n${r.characters}\n\n## 剧情梗概\n${r.outline}`;
        zip.file(`${r.title.replace(/[\\/:*?"<>|]/g, '_')}.txt`, content);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AI小说家_灵感大纲_${itemsToDownload.length}篇.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }

    setIsDownloadDialogOpen(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Top Sub Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 w-fit backdrop-blur-md">
        <button
          onClick={() => setSubTab('cards')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
            subTab === 'cards'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-500" />
          <span>灵感卡片堆叠 ({ideaCards.length})</span>
        </button>

        <button
          onClick={() => setSubTab('create')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
            subTab === 'create'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI脑思大纲</span>
        </button>

        <button
          onClick={() => setSubTab('records')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
            subTab === 'records'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          <span>灵感记录库 ({records.length})</span>
        </button>
      </div>

      {/* Status toast message */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-medium flex items-center justify-between animate-fade-in">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage('')} className="text-xs opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SubTab 0: Idea Card Stacking Board */}
      {subTab === 'cards' && (
        <div className="space-y-6">
          {/* Card Add Input Box */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  灵感卡片堆叠整理
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  记录零散的点子、反差人设、名场面梗或金手指。拖拽或调整排序后，勾选卡片可一键融入生成完整书籍大纲！
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={newCardContent}
                  onChange={(e) => setNewCardContent(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCard()}
                  placeholder="写下灵感点子（例：高冷反派隐藏身份是主角亲哥哥...）"
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <select
                  value={newCardCategory}
                  onChange={(e) => setNewCardCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-xs sm:text-sm text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="收集箱">📦 收集箱</option>
                  <option value="角色设定">👤 角色设定</option>
                  <option value="核心爆点">🔥 核心爆点</option>
                  <option value="金手指/机制">⚡ 金手指/机制</option>
                  <option value="世界观法则">🌍 世界观法则</option>
                </select>
              </div>

              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCardTag}
                    onChange={(e) => setNewCardTag(e.target.value)}
                    placeholder="标签 (例: 名场面)"
                    className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-xs text-slate-800 dark:text-slate-100"
                  />
                  <button
                    onClick={handleAddCard}
                    className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-500/20 shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>添加</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Header bar for Cards */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAllCards}
                className="px-3 py-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
              >
                {selectedCardIds.length === ideaCards.length && ideaCards.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>全选 ({selectedCardIds.length}/{ideaCards.length})</span>
              </button>
            </div>

            <button
              disabled={selectedCardIds.length === 0 || isConvertingCards}
              onClick={() => handleConvertCardsToOutline()}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2"
            >
              <Wand2 className="w-4 h-4" />
              <span>{isConvertingCards ? '融合大纲中...' : `一键将选中的卡片 (${selectedCardIds.length}) 融合成大纲`}</span>
            </button>
          </div>

          {/* Card Deck Display */}
          {ideaCards.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl text-center space-y-3">
              <Layers className="w-12 h-12 mx-auto text-slate-400 opacity-50" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                目前还没有灵感卡片，请在上方输入框写下你的第一个写作点子吧！
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ideaCards.map((card, index) => {
                const isSelected = selectedCardIds.includes(card.id);
                const gradientClass = CARD_GRADIENTS[index % CARD_GRADIENTS.length];

                return (
                  <div
                    key={card.id}
                    className={`relative p-5 rounded-3xl bg-gradient-to-br ${gradientClass} border shadow-sm transition-all duration-200 hover:shadow-md flex flex-col justify-between space-y-4 group ${
                      isSelected ? 'ring-2 ring-emerald-500 scale-[1.02]' : ''
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-black/5 dark:border-white/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSelectCard(card.id)}
                          className="text-slate-700 dark:text-slate-200 hover:scale-110 transition-transform"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <span className="px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          {card.category || '收集箱'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {card.tag && (
                          <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
                            #{card.tag}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                          title="删除卡片"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Content Body */}
                    <div className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed min-h-[60px] whitespace-pre-wrap">
                      {card.content}
                    </div>

                    {/* Card Footer controls */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/10 text-xs">
                      {/* Reorder Up / Down */}
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          disabled={index === 0}
                          onClick={() => handleMoveCard(index, 'up')}
                          className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-20"
                          title="上移堆叠"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={index === ideaCards.length - 1}
                          onClick={() => handleMoveCard(index, 'down')}
                          className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-20"
                          title="下移堆叠"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleConvertCardsToOutline([card.id])}
                        className="px-2.5 py-1 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold transition-all flex items-center gap-1 shadow-2xs"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>单卡转大纲</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Panel 1: Create Inspiration Panel */}
      {subTab === 'create' && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-800 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                生成新的灵感大纲
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                勾选或自定义题材关键字，AI 将一次性批量脑思多个极具爆点的大纲方案。
              </p>
            </div>
          </div>

          {/* Tags selection */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              选择题材 / 元素标签 (多选)：
            </label>

            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40">
              {genreTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-emerald-500 text-white shadow-xs scale-105'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-emerald-500/20'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Custom Tag Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
                placeholder="输入自定义标签，按回车添加..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm focus:outline-hidden"
              />
              <button
                onClick={handleAddCustomTag}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium hover:bg-slate-300"
              >
                添加标签
              </button>
            </div>
          </div>

          {/* Keywords & Count */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                关键梗 / 核心机制Hook (逗号分隔)
              </label>
              <input
                type="text"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder="例如：赛博朋克, 双向暗恋, 死对头, 机械义体..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                大纲数量
              </label>
              <select
                value={numOutlines}
                onChange={(e) => setNumOutlines(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm focus:outline-hidden"
              >
                <option value={1}>1 篇</option>
                <option value={2}>2 篇</option>
                <option value={3}>3 篇</option>
                <option value={4}>4 篇</option>
              </select>
            </div>
          </div>

          {/* Button & Status */}
          <div className="pt-2">
            <button
              disabled={isGenerating}
              onClick={handleGenerateInspirations}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5 animate-spin-slow" />
              <span>{isGenerating ? '正在构思灵感...' : '✨ 随机生成灵感大纲'}</span>
            </button>

            {statusMessage && (
              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-medium">
                {statusMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panel 2: Inspiration Records Panel */}
      {subTab === 'records' && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                我的灵感记录库
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                管理已构思的脑洞灵感，可随时转为正式连载作品。
              </p>
            </div>

            {/* Backup & Restore actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleBackupRecords}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-xs text-slate-700 dark:text-slate-300 transition-colors"
              >
                ⬇️ 备份灵感数据
              </button>

              <label className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-xs text-slate-700 dark:text-slate-300 transition-colors cursor-pointer">
                ⬆️ 恢复灵感数据
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFileInput}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => {
                  setSelectedDownloadIds(records.map((r) => r.id));
                  setIsDownloadDialogOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium transition-colors"
              >
                📥 批量下载灵感
              </button>
            </div>
          </div>

          {/* Filter Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="按灵感标题搜索..."
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm focus:outline-hidden"
            />
            <input
              type="text"
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              placeholder="按题材筛选..."
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm focus:outline-hidden"
            />
          </div>

          {/* Grid of Inspiration Cards */}
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              暂无符合条件的灵感大纲。去“创作灵感”页面构思一个吧！
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecords.map((record, idx) => {
                const gradientClass = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
                return (
                  <div
                    key={record.id}
                    onClick={() => openDetailModal(record)}
                    className={`p-5 rounded-2xl bg-gradient-to-br border ${gradientClass} cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col justify-between`}
                  >
                    <div className="space-y-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base line-clamp-1">
                        {record.title}
                      </h3>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        题材: {record.genre} • 风格: {record.style}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 bg-white/40 dark:bg-slate-900/30 p-2.5 rounded-xl">
                        {record.outline || '暂无梗概描述'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-900/5 dark:border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{new Date(record.createdAt).toLocaleDateString()}</span>
                      {record.linkedNovels && record.linkedNovels.length > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" />
                          已关联 {record.linkedNovels.length} 本小说
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inspiration Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-3xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/20 dark:border-slate-700/50">
            {/* Header */}
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {isEditing ? '编辑灵感大纲' : selectedRecord.title}
              </h2>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="font-semibold block mb-1">灵感标题</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">题材类型</label>
                    <input
                      type="text"
                      value={editGenre}
                      onChange={(e) => setEditGenre(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">风格基调</label>
                    <input
                      type="text"
                      value={editStyle}
                      onChange={(e) => setEditStyle(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">核心设定 / 世界观</label>
                    <textarea
                      rows={3}
                      value={editWorld}
                      onChange={(e) => setEditWorld(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">主要角色原型</label>
                    <textarea
                      rows={3}
                      value={editCharacters}
                      onChange={(e) => setEditCharacters(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">剧情梗概</label>
                    <textarea
                      rows={5}
                      value={editOutline}
                      onChange={(e) => setEditOutline(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 leading-relaxed">
                  <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                    <p><strong>题材：</strong> {selectedRecord.genre}</p>
                    <p><strong>风格：</strong> {selectedRecord.style}</p>
                  </div>

                  {selectedRecord.world && (
                    <div className="p-3.5 rounded-xl bg-slate-100/60 dark:bg-slate-800/60 space-y-1">
                      <strong className="text-slate-800 dark:text-slate-200">核心设定：</strong>
                      <p className="whitespace-pre-wrap">{selectedRecord.world}</p>
                    </div>
                  )}

                  {selectedRecord.characters && (
                    <div className="p-3.5 rounded-xl bg-slate-100/60 dark:bg-slate-800/60 space-y-1">
                      <strong className="text-slate-800 dark:text-slate-200">主要角色原型：</strong>
                      <p className="whitespace-pre-wrap">{selectedRecord.characters}</p>
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl bg-slate-100/60 dark:bg-slate-800/60 space-y-1">
                    <strong className="text-slate-800 dark:text-slate-200">剧情梗概：</strong>
                    <p className="whitespace-pre-wrap">{selectedRecord.outline}</p>
                  </div>

                  {/* Linked Novels */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <strong className="text-slate-800 dark:text-slate-200 block mb-2">关联作品：</strong>
                    {(!selectedRecord.linkedNovels || selectedRecord.linkedNovels.length === 0) ? (
                      <p className="text-xs text-slate-400">暂无关联小说。</p>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedRecord.linkedNovels.map((ln) => (
                          <div
                            key={ln.novelId}
                            className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs"
                          >
                            <button
                              onClick={() => {
                                setSelectedRecord(null);
                                onOpenBookFromInspiration(ln.novelId);
                              }}
                              className="font-medium hover:underline flex items-center gap-1"
                            >
                              <span>《{ln.novelTitle}》</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleUnlinkNovel(ln.novelId)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              title="解除关联"
                            >
                              解除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={handleDeleteRecord}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-xs font-medium"
              >
                删除灵感
              </button>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-2 rounded-xl bg-slate-200 text-xs text-slate-700"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold"
                    >
                      保存
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleOpenLinkDialog}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                    >
                      关联现有小说
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-2 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-300"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => {
                        const rec = selectedRecord;
                        setSelectedRecord(null);
                        onSelectInspirationForCreation(rec);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20"
                    >
                      开始创作
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Novel Dialog */}
      {isLinkDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-3xl overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
              关联已有小说作品
            </h3>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {books.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">暂无可选小说</p>
              ) : (
                books.map((b) => {
                  const isChecked = selectedNovelIdsToLink.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 hover:bg-slate-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedNovelIdsToLink((prev) =>
                            prev.includes(b.id) ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                          );
                        }}
                        className="w-4 h-4 text-emerald-600 rounded-sm"
                      />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        《{b.title}》
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsLinkDialogOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={handleConfirmLinkNovels}
                className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold"
              >
                确认关联
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Inspirations Dialog */}
      {isDownloadDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-3xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                批量下载灵感大纲
              </h3>
              <button
                onClick={() => setSelectedDownloadIds(selectedDownloadIds.length === records.length ? [] : records.map((r) => r.id))}
                className="text-xs text-emerald-600 font-semibold"
              >
                {selectedDownloadIds.length === records.length ? '取消全选' : '全选'}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {records.map((r) => {
                const isChecked = selectedDownloadIds.includes(r.id);
                return (
                  <label
                    key={r.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 hover:bg-slate-100 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedDownloadIds((prev) =>
                          prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                        );
                      }}
                      className="w-4 h-4 text-emerald-600 rounded-sm"
                    />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {r.title} ({r.genre})
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsDownloadDialogOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDownloadInspirations}
                className="px-4 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold"
              >
                确认下载 ({selectedDownloadIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
