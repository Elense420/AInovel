import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Edit3, Eye, Save, Sparkles, RefreshCw, Trash2, ArrowLeft, ArrowRight, Play, AlertCircle, FileText, Check } from 'lucide-react';
import { Book, Chapter, UiSettings, ApiConfig } from '../types';
import { streamChatCompletion, chatCompletion } from '../services/apiClient';

interface WriterViewProps {
  currentBook: Book | null;
  currentChapterIndex: number;
  setCurrentChapterIndex: React.Dispatch<React.SetStateAction<number>>;
  configs: ApiConfig[];
  uiSettings: UiSettings;
  xpPreferences: string;
  onSaveBook: (updatedBook: Book) => Promise<void>;
  onGoToSetup: () => void;
  onOpenSummaryViewModal: (summary: any) => void;
}

export const WriterView: React.FC<WriterViewProps> = ({
  currentBook,
  currentChapterIndex,
  setCurrentChapterIndex,
  configs,
  uiSettings,
  xpPreferences,
  onSaveBook,
  onGoToSetup,
}) => {
  const [isReviewOpen, setIsOutlineReviewOpen] = useState(false);
  const [isRewriteOpen, setIsRewriteOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(true);

  // Editable chapter fields
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterText, setChapterText] = useState('');

  // Plot inputs
  const [rewritePlotInput, setRewritePlotInput] = useState('');
  const [nextPlotInput, setNextPlotInput] = useState('');

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false);
  const [genMeta, setGenMeta] = useState('');
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const activeChapter: Chapter | undefined = currentBook?.chapters[currentChapterIndex];
  const isLastChapter = Boolean(currentBook && currentChapterIndex === currentBook.chapters.length - 1);

  // Sync state when active chapter changes
  useEffect(() => {
    if (activeChapter) {
      setChapterTitle(activeChapter.title || '');
      setChapterText(activeChapter.text || '');
      setGenMeta(activeChapter.meta || '');
      setNextPlotInput(activeChapter.userNextPlotInput || '');
    } else {
      setChapterTitle('');
      setChapterText('');
      setGenMeta('');
      setNextPlotInput('');
    }
  }, [activeChapter, currentChapterIndex]);

  if (!currentBook || currentBook.chapters.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-3xl text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          尚未打开或创建小说章节
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          请先去「我的书库」选择一本现有作品，或在「写作设定」中创建新作品并扩写第一章。
        </p>
        <button
          onClick={onGoToSetup}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm transition-all shadow-md shadow-emerald-500/20"
        >
          去设定新小说
        </button>
      </div>
    );
  }

  // Calculate total word count across all chapters
  const totalWordCount = (currentBook.chapters || []).reduce(
    (acc, ch) => acc + (ch.text?.length || 0),
    0
  );

  // Get active API line and model info
  const writerCfg = configs.find((c) => c.id === uiSettings.writerApiCfgId) || configs[0];
  const activeModelName = uiSettings.writerApiModel || 'gemini-3.6-flash';

  // Save edits on title/content
  const handleSaveChapterEdits = async () => {
    if (!currentBook || currentChapterIndex < 0) return;

    const updatedChapters = [...currentBook.chapters];
    const target = updatedChapters[currentChapterIndex];

    if (target) {
      target.title = chapterTitle.trim();
      target.text = chapterText.trim();
      target.meta = `手动编辑于 ${new Date().toLocaleTimeString()}`;
      target.userNextPlotInput = nextPlotInput.trim();

      const updatedBook: Book = {
        ...currentBook,
        chapters: updatedChapters,
        lastModifiedAt: Date.now(),
      };

      await onSaveBook(updatedBook);
      setSaveSuccessToast(true);
      setTimeout(() => setSaveSuccessToast(false), 2000);
    }
  };

  // Save user's nextPlotInput
  const handleSaveNextPlotInput = async (value: string) => {
    setNextPlotInput(value);
    if (!currentBook || !isLastChapter) return;

    const updatedChapters = [...currentBook.chapters];
    const target = updatedChapters[currentChapterIndex];
    if (target) {
      target.userNextPlotInput = value.trim();
      await onSaveBook({
        ...currentBook,
        chapters: updatedChapters,
      });
    }
  };

  // Build Context memory text
  const buildMemoryContext = () => {
    const memoryCount = Number(currentBook.settings?.contextMemory || 3);
    if (memoryCount <= 0 || currentBook.chapters.length === 0) return '';

    const recentChapters = currentBook.chapters.slice(-memoryCount);
    const parts: string[] = [];

    recentChapters.forEach((ch, idx) => {
      if (idx === recentChapters.length - 1) {
        parts.push(`【第${ch.index}章回顾 (完整)】\n${ch.text}`);
      } else {
        parts.push(`【第${ch.index}章回顾 (前500字摘要)】\n${ch.text.substring(0, 500)}...`);
      }
    });

    return parts.join('\n\n');
  };

  // Generate Next Chapter / Rewrite Chapter core flow
  const handleGenerateNextChapter = async (plotHint: string = '', isRewrite: boolean = false) => {
    if (isGenerating) return;

    setIsGenerating(true);
    setGenMeta('🚀 正在请求 AI 创作中...');

    let chapterIndexToGen = currentBook.chapters.length + 1;
    if (isRewrite) {
      chapterIndexToGen = currentChapterIndex + 1;
    }

    const words = Number(currentBook.settings?.chapterWords || 2000);
    const memory = buildMemoryContext();

    // Prepare system prompt
    let systemPrompt = `你是一名顶级资深职业小说家。你的任务是严格遵循以下核心设定创作小说。
# 小说核心设定
- 书名：${currentBook.title}
- 题材：${currentBook.settings?.genre || ''}
- 风格基调：${currentBook.settings?.style || ''}
- 人称/时态：${currentBook.settings?.pov || '第三人称'} / ${currentBook.settings?.tense || '现在时'}
- 核心大纲：\n${currentBook.settings?.outline || ''}`;

    if (currentBook.settings?.characters) {
      systemPrompt += `\n\n# 主要角色表\n${currentBook.settings.characters}`;
    }
    if (currentBook.settings?.world) {
      systemPrompt += `\n\n# 世界观设定\n${currentBook.settings.world}`;
    }
    if (currentBook.settings?.styleReference) {
      systemPrompt += `\n\n# 模仿风格范文参考\n${currentBook.settings.styleReference.slice(0, 4000)}`;
    }
    if (xpPreferences) {
      systemPrompt += `\n\n# 用户 XP 偏好与避雷要求\n${xpPreferences}`;
    }

    let userPrompt = `请根据以上设定，创作第 ${chapterIndexToGen} 章，目标字数约 ${words} 字。`;
    if (memory) {
      userPrompt += `\n\n为保证章节承接连贯，以下是最近章节回顾：\n${memory}\n`;
    }
    if (plotHint) {
      userPrompt += `\n本章核心剧情重点提示 (请优先围绕此展开)：${plotHint}\n`;
    }

    userPrompt += `\n输出格式要求 (严格遵守)：
### [此处填写章节标题]
[此处开始章节正文。请注意：在正文中绝对不要使用"---"（三个破折号）符号]
---
#### 后续发展建议
- [建议1]
- [建议2]
- [建议3]
- [建议4]`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    let accumulatedRaw = '';
    const startTime = Date.now();

    try {
      const result = await streamChatCompletion({
        provider: writerCfg?.provider,
        baseUrl: writerCfg?.baseUrl,
        apiKey: writerCfg?.apiKey,
        model: activeModelName,
        messages,
        temperature: Number(currentBook.settings?.temperature || 0.8),
        onChunk: (chunk) => {
          accumulatedRaw += chunk;

          // Parse intermediate title & content for real-time visual streaming
          const parts = accumulatedRaw.split('---');
          const mainPart = parts[0] || '';

          const titleMatch = mainPart.match(/###\s*(.*)/);
          if (titleMatch) {
            setChapterTitle(titleMatch[1].trim());
          }
          const bodyText = mainPart.replace(/###.*/, '').trim();
          setChapterText(bodyText);

          if (contentContainerRef.current) {
            contentContainerRef.current.scrollTop = contentContainerRef.current.scrollHeight;
          }
        },
      });

      const latency = Date.now() - startTime;
      const finalRaw = result.content || accumulatedRaw;

      // Parse final structured contents
      const parts = finalRaw.split('---');
      const mainContent = parts[0] || '';
      const suggestionsPart = parts[1] || '';

      const nextOptions = (suggestionsPart.match(/[-*]\s*(.+)/g) || []).map((s) =>
        s.replace(/[-*]\s*/, '').trim()
      );

      const titleMatch = mainContent.match(/###\s*(.*)/);
      const finalTitle = titleMatch ? titleMatch[1].trim() : `第 ${chapterIndexToGen} 章`;
      const finalText = mainContent.replace(/###.*/, '').trim();
      const metaText = `模型: ${activeModelName} | 耗时: ${latency}ms | 字数: ${finalText.length}`;

      // Construct new chapter object
      const newChapter: Chapter = {
        id: crypto.randomUUID(),
        index: chapterIndexToGen,
        title: finalTitle,
        text: finalText,
        meta: metaText,
        userNextPlotInput: '',
        allSuggestions: [{ suggestions: nextOptions, timestamp: Date.now() }],
      };

      let updatedChapters = [...currentBook.chapters];
      let archivedChapters = [...(currentBook.archivedChapters || [])];

      if (isRewrite) {
        // Archive current chapter and subsequent
        const chaptersToArchive = updatedChapters.slice(currentChapterIndex);
        chaptersToArchive.forEach((ch) => {
          archivedChapters.push({
            ...ch,
            archivedAt: Date.now(),
          });
        });

        // Replace chapters
        updatedChapters = updatedChapters.slice(0, currentChapterIndex);
        updatedChapters.push(newChapter);
      } else {
        updatedChapters.push(newChapter);
      }

      const updatedBook: Book = {
        ...currentBook,
        chapters: updatedChapters,
        archivedChapters,
        lastModifiedAt: Date.now(),
      };

      await onSaveBook(updatedBook);
      setCurrentChapterIndex(updatedChapters.length - 1);
      setRewritePlotInput('');
      setNextPlotInput('');
      setGenMeta(metaText);

    } catch (err: any) {
      console.error(err);
      setGenMeta(`生成失败: ${err.message || '未知错误'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Reroll Plot Suggestions
  const handleRerollSuggestions = async () => {
    if (isGenerating || !activeChapter || !isLastChapter) return;

    const rerollCfg = configs.find((c) => c.id === uiSettings.rerollApiCfgId) || writerCfg;
    const rerollModel = uiSettings.rerollApiModel || activeModelName;

    setIsGenerating(true);
    setGenMeta('🔄 AI 正在生成全新的后续建议...');

    try {
      let existingSuggestionsStr = '';
      if (activeChapter.allSuggestions) {
        existingSuggestionsStr = activeChapter.allSuggestions
          .flatMap((g) => g.suggestions)
          .join('\n- ');
      }

      const systemPrompt = `你是一位专业小说创意总监，擅长为小说提供多样化、悬念十足且吸引人的情节发展方向。
# 小说核心设定
- 书名：${currentBook.title}
- 题材：${currentBook.settings?.genre}
- 当前章节内容摘要：
${activeChapter.text.slice(-800)}
${xpPreferences ? `\n# 用户偏好：\n${xpPreferences}` : ''}

请为下一章节提供4个全新的、不同于已有建议的情节走向 (每条20-50字)。
已有建议（请避免重复）：
- ${existingSuggestionsStr || '无'}

输出格式要求：
#### 后续发展建议
- [建议1]
- [建议2]
- [建议3]
- [建议4]`;

      const res = await chatCompletion({
        provider: rerollCfg?.provider,
        baseUrl: rerollCfg?.baseUrl,
        apiKey: rerollCfg?.apiKey,
        model: rerollModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '请重掷下一章节的4个全新剧情建议。' },
        ],
        temperature: 0.9,
      });

      const suggestionsPart = res.content.split('#### 后续发展建议')[1] || res.content;
      const newOptions = (suggestionsPart.match(/[-*]\s*(.+)/g) || []).map((s) =>
        s.replace(/[-*]\s*/, '').trim()
      );

      const newSuggestionsGroup = {
        suggestions: newOptions,
        timestamp: Date.now(),
      };

      const updatedChapters = [...currentBook.chapters];
      const targetCh = updatedChapters[currentChapterIndex];

      if (targetCh) {
        if (!targetCh.allSuggestions) targetCh.allSuggestions = [];
        targetCh.allSuggestions.unshift(newSuggestionsGroup); // Newest group first
      }

      await onSaveBook({
        ...currentBook,
        chapters: updatedChapters,
      });

      setGenMeta(`建议重掷成功！| 模型: ${rerollModel}`);
    } catch (err: any) {
      console.error(err);
      setGenMeta(`重掷建议失败: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Clear Suggestions
  const handleClearSuggestions = async () => {
    if (!activeChapter || !isLastChapter) return;
    if (confirm('确定要清空本章的所有后续剧情建议吗？')) {
      const updatedChapters = [...currentBook.chapters];
      const targetCh = updatedChapters[currentChapterIndex];
      if (targetCh) {
        targetCh.allSuggestions = [];
        delete targetCh.nextOptions;
      }
      await onSaveBook({
        ...currentBook,
        chapters: updatedChapters,
      });
    }
  };

  // Generate Stage Summary
  const handleGenerateSummary = async () => {
    if (!currentBook || currentBook.chapters.length === 0) return;

    setIsGenerating(true);
    setGenMeta('📝 正在生成阶段性全局总结...');

    try {
      const chaptersText = currentBook.chapters
        .map((ch) => `第${ch.index}章 《${ch.title}》\n${ch.text.slice(0, 4000)}`)
        .join('\n\n---\n\n');

      const prompt = `请对以下小说进行截至目前位置的综合总结：
一、工作与情节进展确认
二、故事核心设定与隐线整理
三、完成章节要点归纳
四、主角感情与关系进展

小说名称：《${currentBook.title}》
全部章节内容：
${chaptersText}`;

      const res = await chatCompletion({
        provider: writerCfg?.provider,
        baseUrl: writerCfg?.baseUrl,
        apiKey: writerCfg?.apiKey,
        model: activeModelName,
        messages: [
          { role: 'system', content: '你是一位资深小说主编，擅长归纳故事脉络与伏笔。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });

      const newSummary = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        startChapter: 1,
        endChapter: currentBook.chapters.length,
        chapterRange: `1 - ${currentBook.chapters.length}`,
        title: `第1-${currentBook.chapters.length}章总结`,
        content: res.content,
      };

      const updatedSummaries = [...(currentBook.summaries || []), newSummary];
      await onSaveBook({
        ...currentBook,
        summaries: updatedSummaries,
      });

      alert(`✅ 阶段性总结已成功生成！可在「我的书库」或弹窗中随时查阅。`);
      setGenMeta('阶段总结生成完成！');
    } catch (err: any) {
      console.error(err);
      setGenMeta(`生成总结失败: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Novel Settings Review Bar (Collapsible) */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-emerald-500/20">
        <button
          onClick={() => setIsOutlineReviewOpen(!isReviewOpen)}
          className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent hover:bg-emerald-500/15 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5 font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
            <FileText className="w-4 h-4 text-emerald-500" />
            <span>📖 本书设定回顾：《{currentBook.title}》</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <span>{isReviewOpen ? '折叠' : '展开'}</span>
            {isReviewOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isReviewOpen && (
          <div className="p-6 border-t border-slate-200/60 dark:border-slate-800 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 bg-white/40 dark:bg-slate-900/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <p><strong>题材：</strong> {currentBook.settings?.genre}</p>
              <p><strong>风格基调：</strong> {currentBook.settings?.style}</p>
              <p><strong>叙事/时态：</strong> {currentBook.settings?.pov} / {currentBook.settings?.tense}</p>
              <p><strong>字数与记忆：</strong> {currentBook.settings?.chapterWords}字/章 • 记忆 {currentBook.settings?.contextMemory}章</p>
            </div>
            {currentBook.settings?.characters && (
              <div>
                <strong>主要角色：</strong>
                <p className="whitespace-pre-wrap mt-0.5">{currentBook.settings.characters}</p>
              </div>
            )}
            {currentBook.settings?.outline && (
              <div>
                <strong>故事大纲：</strong>
                <p className="whitespace-pre-wrap mt-0.5 max-h-40 overflow-y-auto p-3 rounded-xl bg-slate-100/50 dark:bg-slate-800/50">
                  {currentBook.settings.outline}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Writer Header and Controls */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
        {/* Title and Active Route info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800 pb-4">
          <div className="flex-1 space-y-1">
            <input
              type="text"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              disabled={!isEditMode}
              placeholder="章节标题..."
              className={`w-full text-xl sm:text-2xl font-bold bg-transparent text-slate-800 dark:text-slate-100 focus:outline-hidden ${
                isEditMode ? 'border-b-2 border-emerald-500/50 focus:border-emerald-500' : ''
              }`}
            />
          </div>

          <div className="text-xs px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 self-start md:self-auto">
            线路: <span className="font-semibold text-slate-700 dark:text-slate-200">{writerCfg?.name}</span> | 模型: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{activeModelName}</span>
          </div>
        </div>

        {/* Word count & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <span>📊 全书总字数:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{totalWordCount.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors flex items-center gap-1.5"
            >
              {isEditMode ? <Eye className="w-4 h-4 text-emerald-500" /> : <Edit3 className="w-4 h-4 text-slate-500" />}
              <span>{isEditMode ? '切换到阅读模式' : '切换到编辑模式'}</span>
            </button>

            {isEditMode && (
              <button
                onClick={handleSaveChapterEdits}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow-md shadow-emerald-500/20 transition-colors flex items-center gap-1.5"
              >
                {saveSuccessToast ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{saveSuccessToast ? '保存成功！' : '💾 保存当前章节'}</span>
              </button>
            )}

            <button
              onClick={handleGenerateSummary}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>📝 生成阶段总结</span>
            </button>
          </div>
        </div>

        {/* Chapter Navigation bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800">
          <button
            disabled={currentChapterIndex <= 0 || isGenerating}
            onClick={() => setCurrentChapterIndex((prev) => Math.max(0, prev - 1))}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>上一章</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
              第 {currentChapterIndex + 1} / {currentBook.chapters.length} 章
            </span>

            <select
              value={currentChapterIndex}
              onChange={(e) => setCurrentChapterIndex(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs cursor-pointer"
            >
              {currentBook.chapters.map((ch, idx) => (
                <option key={ch.id} value={idx}>
                  第 {ch.index} 章: {ch.title}
                </option>
              ))}
            </select>
          </div>

          <button
            disabled={currentChapterIndex >= currentBook.chapters.length - 1 || isGenerating}
            onClick={() => setCurrentChapterIndex((prev) => Math.min(currentBook.chapters.length - 1, prev + 1))}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1 hover:bg-slate-100 transition-colors"
          >
            <span>下一章</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Gen Meta bar */}
        {genMeta && (
          <div className="text-xs px-3.5 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-mono">
            {genMeta}
          </div>
        )}

        {/* Chapter Main Writing/Reading Canvas */}
        <div
          ref={contentContainerRef}
          className="relative min-h-[300px] max-h-[60vh] overflow-y-auto p-6 sm:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shadow-inner"
        >
          {isEditMode ? (
            <textarea
              value={chapterText}
              onChange={(e) => setChapterText(e.target.value)}
              placeholder="在此处编辑章节正文内容..."
              className="w-full h-full min-h-[300px] bg-transparent resize-y focus:outline-hidden text-slate-800 dark:text-slate-200 chapter-canvas"
            />
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed chapter-canvas text-slate-800 dark:text-slate-200">
              {chapterText}
            </div>
          )}
        </div>

        {/* Chapter Rewrite Section */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10 overflow-hidden">
          <button
            onClick={() => setIsRewriteOpen(!isRewriteOpen)}
            className="w-full px-5 py-3 flex items-center justify-between text-left font-bold text-rose-700 dark:text-rose-300 text-xs sm:text-sm hover:bg-rose-500/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              <span>✒️ 重写当前第 {currentChapterIndex + 1} 章</span>
            </div>
            <span>{isRewriteOpen ? '折叠' : '展开'}</span>
          </button>

          {isRewriteOpen && (
            <div className="p-5 border-t border-rose-500/20 space-y-3">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                请输入本章重写的新剧情走向与要求 (重写后旧版本自动归入历史存档)：
              </label>
              <textarea
                rows={3}
                value={rewritePlotInput}
                onChange={(e) => setRewritePlotInput(e.target.value)}
                placeholder="填写重写要点，例如：改变对峙结局，让主角机智脱身而非受伤..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500/50"
              />
              <button
                disabled={isGenerating}
                onClick={() => {
                  if (confirm(`确认要重写第 ${currentChapterIndex + 1} 章吗？当前版本将被放入历史存档。`)) {
                    handleGenerateNextChapter(rewritePlotInput, true);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-medium text-xs shadow-md shadow-rose-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>确认重写本章</span>
              </button>
            </div>
          )}
        </div>

        {/* Continuation Container (only visible on last chapter) */}
        {isLastChapter && (
          <div className="space-y-6 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span>后续章节创作与方向选择</span>
            </h3>

            {/* Next Chapter Plot Input */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                下一章剧情走向 (可选，支持选择下方 AI 建议或手动填写)：
              </label>
              <textarea
                rows={3}
                value={nextPlotInput}
                onChange={(e) => handleSaveNextPlotInput(e.target.value)}
                placeholder="填写后点击“继续扩写下一章”。此内容将作为关键线索引表达..."
                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/50 focus:outline-hidden"
              />
            </div>

            {/* AI Plot Directions/Suggestions */}
            {activeChapter?.allSuggestions && activeChapter.allSuggestions.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>AI 给出的后续灵感方向 (点击填充)</span>
                  </h4>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRerollSuggestions}
                      disabled={isGenerating}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>🔄 重掷建议</span>
                    </button>
                    <button
                      onClick={handleClearSuggestions}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                    >
                      清空建议
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {activeChapter.allSuggestions.map((group, groupIdx) => (
                    <div
                      key={groupIdx}
                      className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-2"
                    >
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        建议组 {activeChapter.allSuggestions!.length - groupIdx} ({new Date(group.timestamp).toLocaleTimeString()})
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.suggestions.map((opt, optIdx) => (
                          <button
                            key={optIdx}
                            onClick={() => handleSaveNextPlotInput(opt)}
                            className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-800/80 hover:bg-emerald-500/10 hover:border-emerald-500/40 text-left transition-all text-xs text-slate-700 dark:text-slate-200 leading-relaxed group"
                          >
                            <span className="group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                              {opt}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Continuation Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                disabled={isGenerating}
                onClick={() => handleGenerateNextChapter(nextPlotInput, false)}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-bold text-sm sm:text-base shadow-xl shadow-emerald-500/25 transition-all duration-200 active:scale-95 flex items-center gap-2.5 disabled:opacity-50"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{isGenerating ? 'AI 生成中...' : '继续扩写下一章'}</span>
              </button>

              <button
                onClick={onGoToSetup}
                className="px-5 py-3.5 rounded-2xl bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-colors"
              >
                返回修改设定
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
