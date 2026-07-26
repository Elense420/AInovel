import React, { useState, useEffect } from 'react';
import { Sparkles, Save, Upload, Trash2, RotateCcw, BookOpen, Layers, UserCheck, Compass, Sliders, Wand2, FileText } from 'lucide-react';
import { Book, BookSettings, UiSettings, ApiConfig, HistoryItem } from '../types';
import { dbPut, dbGetAll, dbDelete, STORE_NAMES } from '../services/db';
import { chatCompletion } from '../services/apiClient';

interface SetupViewProps {
  currentBook: Book | null;
  configs: ApiConfig[];
  uiSettings: UiSettings;
  onStartWritingFirstChapter: (newBook: Book) => void;
  onUpdateBookSettings: (updatedSettings: BookSettings, updatedTitle: string) => void;
}

export const SetupView: React.FC<SetupViewProps> = ({
  currentBook,
  configs,
  uiSettings,
  onStartWritingFirstChapter,
  onUpdateBookSettings,
}) => {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [style, setStyle] = useState('');
  const [chapterWords, setChapterWords] = useState<number | string>(2000);
  const [pov, setPov] = useState('第三人称');
  const [tense, setTense] = useState('现在时');
  const [temperature, setTemperature] = useState<number | string>(0.8);
  const [contextMemory, setContextMemory] = useState<number | string>(3);
  const [characters, setCharacters] = useState('');
  const [world, setWorld] = useState('');
  const [styleReference, setStyleReference] = useState('');

  const [aiPersona, setAiPersona] = useState(
    '你是一位专业的职业小说家，擅长根据提供的设定与大纲，创作情节连贯、文笔细腻、生动生动的章节内容。'
  );
  const [outline, setOutline] = useState('');

  // History states
  const [personaHistory, setPersonaHistory] = useState<HistoryItem[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState('');

  const [outlineHistory, setOutlineHistory] = useState<HistoryItem[]>([]);
  const [selectedOutlineId, setSelectedOutlineId] = useState('');

  const [styleHistory, setStyleHistory] = useState<HistoryItem[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState('');

  const [statusMessage, setStatusMessage] = useState('');
  const [isImprovingOutline, setIsImprovingOutline] = useState(false);

  // Sync state when currentBook changes
  useEffect(() => {
    if (currentBook) {
      setTitle(currentBook.title || '');
      const s = currentBook.settings || {};
      setGenre(s.genre || '');
      setStyle(s.style || '');
      setChapterWords(s.chapterWords || 2000);
      setPov(s.pov || '第三人称');
      setTense(s.tense || '现在时');
      setTemperature(s.temperature ?? 0.8);
      setContextMemory(s.contextMemory ?? 3);
      setCharacters(s.characters || '');
      setWorld(s.world || '');
      setAiPersona(s.aiPersona || aiPersona);
      setOutline(s.outline || '');
      setStyleReference(s.styleReference || '');
    }
  }, [currentBook]);

  // Load histories
  useEffect(() => {
    loadHistories();
  }, []);

  const loadHistories = async () => {
    const personas = await dbGetAll<HistoryItem>(STORE_NAMES.PERSONA_HISTORY);
    setPersonaHistory(personas);

    const outlines = await dbGetAll<HistoryItem>(STORE_NAMES.OUTLINE_HISTORY);
    setOutlineHistory(outlines);

    const styles = await dbGetAll<HistoryItem>(STORE_NAMES.STYLE_HISTORY);
    setStyleHistory(styles);
  };

  // Drag and drop style file
  const handleDropStyleFile = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.txt') || file.name.endsWith('.md'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setStyleReference(event.target?.result as string || '');
        setStatusMessage('已成功导入文本文件内容');
      };
      reader.readAsText(file);
    } else {
      alert('只支持导入 .txt 或 .md 文本文件');
    }
  };

  const handleStyleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setStyleReference(event.target?.result as string || '');
        setStatusMessage('已成功导入文本文件内容');
      };
      reader.readAsText(file);
    }
  };

  const handleApplyStyle = async () => {
    if (!styleReference.trim()) {
      setStatusMessage('请先粘贴或拖入参考样式文本');
      return;
    }
    await dbPut(STORE_NAMES.STYLE_HISTORY, { content: styleReference.trim() });
    await loadHistories();
    setStatusMessage(`🎯 风格文本已应用 (已参考 ${styleReference.trim().length} 字符)`);
  };

  const handleClearStyle = () => {
    setStyleReference('');
    setStatusMessage('已清除风格参考');
  };

  const handleLoadStyleFromHistory = () => {
    if (!selectedStyleId) return;
    const item = styleHistory.find((s) => String(s.id) === selectedStyleId);
    if (item && item.content) {
      setStyleReference(item.content);
      setStatusMessage('已加载选中的历史风格参考');
    }
  };

  const handleDeleteStyleHistory = async () => {
    if (!selectedStyleId) return;
    if (confirm('确定删除该条风格历史记录吗？')) {
      await dbDelete(STORE_NAMES.STYLE_HISTORY, Number(selectedStyleId));
      setSelectedStyleId('');
      await loadHistories();
      setStatusMessage('已删除该风格历史');
    }
  };

  // Persona Template Handlers
  const handleSavePersona = async () => {
    if (!aiPersona.trim()) return;
    await dbPut(STORE_NAMES.PERSONA_HISTORY, { content: aiPersona.trim() });
    await loadHistories();
    setStatusMessage('✅ AI 设定模板已保存');
  };

  const handleLoadPersona = () => {
    if (!selectedPersonaId) return;
    const item = personaHistory.find((p) => String(p.id) === selectedPersonaId);
    if (item && item.content) {
      setAiPersona(item.content);
      setStatusMessage('已加载选中的 AI Persona 设定');
    }
  };

  // AI Improve Outline
  const handleImproveOutline = async () => {
    if (!outline.trim()) {
      setStatusMessage('请先在下方文本框中填写故事大致提纲或草稿');
      return;
    }

    // Save history before modifying
    const newHistoryItem = { ts: Date.now(), text: outline.trim() };
    await dbPut(STORE_NAMES.OUTLINE_HISTORY, newHistoryItem);
    await loadHistories();

    setIsImprovingOutline(true);
    setStatusMessage('✨ AI 正在深度梳理与构思大纲中...');

    try {
      let prompt = `请将以下用户草稿大纲，完善成一个结构更清晰、冲突更明确、包含起承转合的详细大纲，并给出前3章的章节要点。只输出大纲文本。\n\n`;
      prompt += `当前小说设定参考：\n`;
      if (title) prompt += `书名: ${title}\n`;
      if (genre) prompt += `题材: ${genre}\n`;
      if (style) prompt += `风格: ${style}\n`;
      if (characters) prompt += `角色表: ${characters}\n`;
      if (world) prompt += `世界观: ${world}\n`;
      prompt += `\n原始草稿提纲：\n${outline}`;

      const activeCfg = configs.find((c) => c.id === uiSettings.writerApiCfgId) || configs[0];
      const modelToUse = uiSettings.writerApiModel || 'gemini-3.6-flash';

      const res = await chatCompletion({
        provider: activeCfg?.provider,
        baseUrl: activeCfg?.baseUrl,
        apiKey: activeCfg?.apiKey,
        model: modelToUse,
        messages: [
          { role: 'system', content: '你是一位顶级小说总编辑与主编，极其擅长梳理故事主线、冲突、伏笔和章节要点。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
      });

      const improvedText = res.content.trim();
      setOutline(improvedText);

      // Save improved version to history as well
      await dbPut(STORE_NAMES.OUTLINE_HISTORY, { ts: Date.now(), text: improvedText });
      await loadHistories();

      setStatusMessage('🎉 大纲完善成功！你可以在下方继续细化修改。');
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`错误: ${err.message || '完善大纲失败'}`);
    } finally {
      setIsImprovingOutline(false);
    }
  };

  const handleRollbackOutline = () => {
    if (!selectedOutlineId) return;
    const item = outlineHistory.find((o) => String(o.id) === selectedOutlineId);
    if (item && item.text) {
      setOutline(item.text);
      setStatusMessage('已回滚到选中的历史大纲版本');
    }
  };

  // Submit First Chapter
  const handleStartWriting = () => {
    if (!title.trim()) {
      setStatusMessage('⚠️ 请填写小说书名');
      return;
    }
    if (!genre.trim()) {
      setStatusMessage('⚠️ 请填写小说类型/题材');
      return;
    }
    if (!outline.trim()) {
      setStatusMessage('⚠️ 请填写小说大纲');
      return;
    }

    const settings: BookSettings = {
      genre: genre.trim(),
      style: style.trim(),
      chapterWords: Number(chapterWords) || 2000,
      pov,
      tense,
      temperature: Number(temperature) || 0.8,
      contextMemory: Number(contextMemory) || 3,
      aiPersona: aiPersona.trim(),
      outline: outline.trim(),
      characters: characters.trim(),
      world: world.trim(),
      styleReference: styleReference.trim() || null,
    };

    const newBook: Book = {
      id: crypto.randomUUID(),
      title: title.trim(),
      createdAt: Date.now(),
      lastModifiedAt: Date.now(),
      chapters: [],
      archivedChapters: [],
      summaries: [],
      settings,
    };

    onStartWritingFirstChapter(newBook);
  };

  // Submit Update Current Book Settings
  const handleUpdateCurrentBook = () => {
    if (!currentBook) {
      setStatusMessage('⚠️ 当前未选择任何已有小说，无法更新');
      return;
    }
    if (!title.trim()) {
      setStatusMessage('⚠️ 请填写小说书名');
      return;
    }

    const updatedSettings: BookSettings = {
      genre: genre.trim(),
      style: style.trim(),
      chapterWords: Number(chapterWords) || 2000,
      pov,
      tense,
      temperature: Number(temperature) || 0.8,
      contextMemory: Number(contextMemory) || 3,
      aiPersona: aiPersona.trim(),
      outline: outline.trim(),
      characters: characters.trim(),
      world: world.trim(),
      styleReference: styleReference.trim() || null,
    };

    onUpdateBookSettings(updatedSettings, title.trim());
    setStatusMessage('💾 小说设定已成功更新！后续扩写将自动应用新设定。');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Title Header Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4 border border-emerald-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
              {currentBook ? `编辑小说设定：《${currentBook.title}》` : '创建新小说设定'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              精准配置核心背景、设定、文风与人物弧光，AI 将严格遵循这些参数连载。
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            小说书名 <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="给你的故事起一个响亮吸引人的书名..."
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-hidden transition-all"
          />
        </div>
      </div>

      {/* Core Settings Grid */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <Sliders className="w-4 h-4 text-emerald-500" />
          <span>小说核心设定与写作参数</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              小说类型 / 题材 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="例如：都市异能、仙侠纯爱、科幻悬疑..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              目标读者与基调风格
            </label>
            <input
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="例如：轻快幽默、严肃史诗、爽文反转..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              每章目标字数
            </label>
            <input
              type="number"
              min={200}
              step={100}
              value={chapterWords}
              onChange={(e) => setChapterWords(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              叙事人称
            </label>
            <select
              value={pov}
              onChange={(e) => setPov(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-hidden"
            >
              <option value="第三人称">第三人称 (全知/有限)</option>
              <option value="第一人称">第一人称 (我)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              叙事时态
            </label>
            <select
              value={tense}
              onChange={(e) => setTense(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-hidden"
            >
              <option value="现在时">现在时</option>
              <option value="过去时">过去时</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              生成温度 (Temperature: {temperature})
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 my-2"
            />
          </div>
        </div>

        {/* Context Memory slider */}
        <div className="pt-2">
          <div className="flex justify-between items-center mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>上下文记忆章节数：</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{contextMemory} 章</span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            value={contextMemory}
            onChange={(e) => setContextMemory(e.target.value)}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            生成新章节时自动附带前 N 章的完整/摘要内容，帮助 AI 保持情节连贯。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              主要角色表 (可选)
            </label>
            <textarea
              rows={4}
              value={characters}
              onChange={(e) => setCharacters(e.target.value)}
              placeholder="- 林昼：男主，冷静理性，深不可测&#10;- 顾星辰：主角，纯善温润，心怀医者仁心..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              世界观及规则设定 (可选)
            </label>
            <textarea
              rows={4}
              value={world}
              onChange={(e) => setWorld(e.target.value)}
              placeholder="例如：修仙等级划分、魔法禁忌规则、科技文明阶层..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Style Learning Section */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-emerald-500" />
          <span>📖 风格学习 (可选)</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          拖入或粘贴一段你喜欢的高质量范文小说文本，AI 写作时将模仿其文笔措辞与用词风范。
        </p>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropStyleFile}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-slate-900/30 hover:border-emerald-500 transition-colors cursor-pointer relative"
        >
          <input
            type="file"
            accept=".txt,.md"
            onChange={handleStyleFileInputChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <Upload className="w-8 h-8 mx-auto text-emerald-500/70 mb-2" />
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            将 .txt 或 .md 参考样本拖放到此处，或点击上传文件
          </p>
        </div>

        <textarea
          rows={5}
          value={styleReference}
          onChange={(e) => setStyleReference(e.target.value)}
          placeholder="或在此处直接粘贴样本参考小说文本..."
          className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-hidden"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <select
              value={selectedStyleId}
              onChange={(e) => setSelectedStyleId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="">选择历史风格样本...</option>
              {styleHistory.map((sh) => (
                <option key={sh.id} value={String(sh.id)}>
                  {(sh.content || '').slice(0, 30)}...
                </option>
              ))}
            </select>
            <button
              onClick={handleLoadStyleFromHistory}
              className="px-3 py-2 rounded-xl bg-slate-200/80 dark:bg-slate-700/80 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
            >
              加载
            </button>
            <button
              onClick={handleDeleteStyleHistory}
              className="px-3 py-2 rounded-xl bg-rose-500/10 text-xs font-medium text-rose-600 hover:bg-rose-500/20 transition-colors"
            >
              删除
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyStyle}
              className="px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>🎯 应用风格</span>
            </button>
            <button
              onClick={handleClearStyle}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-colors"
            >
              清除
            </button>
          </div>
        </div>
      </div>

      {/* AI Persona & Outline Section */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-500" />
          <span>AI 角色指令与故事大纲</span>
        </h3>

        {/* AI Persona Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              AI System Persona (顶层人格与行为定调指令)
            </label>
          </div>

          <textarea
            rows={3}
            value={aiPersona}
            onChange={(e) => setAiPersona(e.target.value)}
            className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-hidden"
          />

          <div className="flex items-center gap-2 pt-1">
            <select
              value={selectedPersonaId}
              onChange={(e) => setSelectedPersonaId(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="">选择历史 AI Persona 模板...</option>
              {personaHistory.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {(p.content || '').slice(0, 35)}...
                </option>
              ))}
            </select>

            <button
              onClick={handleLoadPersona}
              className="px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-300"
            >
              加载
            </button>
            <button
              onClick={handleSavePersona}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs font-medium"
            >
              保存模板
            </button>
          </div>
        </div>

        {/* Outline Textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              故事详细大纲 (包含起承转合与重要情节分支) <span className="text-rose-500">*</span>
            </label>
          </div>

          <textarea
            rows={8}
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            placeholder="在此处写下你的故事主线思路，或输入简要框架后点击【AI 完善大纲】..."
            className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-hidden leading-relaxed"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              onClick={handleImproveOutline}
              disabled={isImprovingOutline}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isImprovingOutline ? 'AI 深度梳理构思中...' : 'AI 完善大纲'}</span>
            </button>

            <div className="flex items-center gap-2">
              <select
                value={selectedOutlineId}
                onChange={(e) => setSelectedOutlineId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300"
              >
                <option value="">选择历史大纲版本...</option>
                {outlineHistory.map((oh) => (
                  <option key={oh.id} value={String(oh.id)}>
                    {new Date(oh.ts || Date.now()).toLocaleString()}
                  </option>
                ))}
              </select>

              <button
                onClick={handleRollbackOutline}
                className="px-3 py-2 rounded-xl bg-slate-200/80 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>回滚</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="glass-panel p-6 rounded-3xl space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleStartWriting}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-bold text-sm sm:text-base shadow-xl shadow-emerald-500/25 transition-all duration-200 active:scale-95 flex items-center gap-2.5"
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span>开始扩写第一章</span>
          </button>

          {currentBook && (
            <button
              onClick={handleUpdateCurrentBook}
              className="px-6 py-3.5 rounded-2xl bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4 text-emerald-500" />
              <span>💾 更新本小说设定</span>
            </button>
          )}
        </div>

        {statusMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-medium animate-fade-in">
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
};
