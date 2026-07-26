import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowUpDown, Plus, BookOpen, Clock, FileText, Tag, Sparkles } from 'lucide-react';
import { Book } from '../types';

interface LibraryViewProps {
  books: Book[];
  onOpenBookDetail: (book: Book) => void;
  onGoToSetup: () => void;
}

const CARD_GRADIENTS = [
  'from-indigo-50/90 to-purple-100/80 dark:from-indigo-950/40 dark:to-purple-900/40 border-indigo-200/60 dark:border-indigo-800/40',
  'from-cyan-50/90 to-blue-100/80 dark:from-cyan-950/40 dark:to-blue-900/40 border-cyan-200/60 dark:border-cyan-800/40',
  'from-purple-50/90 to-pink-100/80 dark:from-purple-950/40 dark:to-pink-900/40 border-purple-200/60 dark:border-purple-800/40',
  'from-amber-50/90 to-rose-100/80 dark:from-amber-950/40 dark:to-rose-900/40 border-amber-200/60 dark:border-amber-800/40',
  'from-emerald-50/90 to-teal-100/80 dark:from-emerald-950/40 dark:to-teal-900/40 border-emerald-200/60 dark:border-emerald-800/40',
  'from-fuchsia-50/90 to-indigo-100/80 dark:from-fuchsia-950/40 dark:to-indigo-900/40 border-fuchsia-200/60 dark:border-fuchsia-800/40',
];

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  onOpenBookDetail,
  onGoToSetup,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'createdAt_desc' | 'createdAt_asc' | 'lastModifiedAt_desc' | 'lastModifiedAt_asc'>('createdAt_desc');

  const filteredBooks = useMemo(() => {
    return books
      .filter((book) => {
        const matchesTitle = book.title.toLowerCase().includes(searchQuery.toLowerCase().trim());
        const matchesGenre = (book.settings?.genre || '').toLowerCase().includes(genreFilter.toLowerCase().trim());
        return matchesTitle && matchesGenre;
      })
      .sort((a, b) => {
        if (sortOrder === 'createdAt_desc') return b.createdAt - a.createdAt;
        if (sortOrder === 'createdAt_asc') return a.createdAt - b.createdAt;
        if (sortOrder === 'lastModifiedAt_desc') return (b.lastModifiedAt || 0) - (a.lastModifiedAt || 0);
        if (sortOrder === 'lastModifiedAt_asc') return (a.lastModifiedAt || 0) - (b.lastModifiedAt || 0);
        return 0;
      });
  }, [books, searchQuery, genreFilter, sortOrder]);

  const getBookWordCount = (book: Book) => {
    return (book.chapters || []).reduce((acc, ch) => acc + (ch.text?.length || 0), 0);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Panel */}
      <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-emerald-500" />
              <span>我的书库</span>
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                ({books.length} 本小说)
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              管理你的作品集，随时继续连载或进行离线备份。
            </p>
          </div>

          <button
            onClick={onGoToSetup}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg shadow-indigo-300/40 dark:shadow-none transition-all duration-200 active:scale-95 shrink-0"
          >
            <Plus className="w-5 h-5" />
            <span>创作新小说</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2">
          {/* Title Search */}
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="按书名搜索..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all"
            />
          </div>

          {/* Genre Filter */}
          <div className="lg:col-span-4 relative">
            <Filter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              placeholder="按题材筛选..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all"
            />
          </div>

          {/* Sort Select */}
          <div className="lg:col-span-3 relative">
            <ArrowUpDown className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={sortOrder}
              onChange={(e: any) => setSortOrder(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer transition-all"
            >
              <option value="createdAt_desc">按创建时间 (新到旧)</option>
              <option value="createdAt_asc">按创建时间 (旧到新)</option>
              <option value="lastModifiedAt_desc">按最后修改 (新到旧)</option>
              <option value="lastModifiedAt_asc">按最后修改 (旧到新)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Book Grid */}
      {filteredBooks.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">
            未找到匹配的小说
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            你可以尝试清空搜索条件，或者点击上方“创作新小说”开始第一部作品！
          </p>
          <button
            onClick={onGoToSetup}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 font-medium text-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>创建新小说</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBooks.map((book, idx) => {
            const gradientClass = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
            const wordCount = getBookWordCount(book);
            const chapterCount = (book.chapters || []).length;

            return (
              <div
                key={book.id}
                onClick={() => onOpenBookDetail(book)}
                className={`group relative p-6 rounded-3xl bg-gradient-to-br border ${gradientClass} backdrop-blur-md cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                      《{book.title}》
                    </h3>
                    <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 backdrop-blur-xs border border-white/50 dark:border-slate-800">
                      {book.settings?.genre || '未知题材'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed bg-white/30 dark:bg-slate-900/20 p-2.5 rounded-xl backdrop-blur-2xs">
                    {book.settings?.outline || '暂无大纲介绍'}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-900/5 dark:border-white/10 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-medium">
                      <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {chapterCount} 章
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Tag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      {wordCount.toLocaleString()} 字
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(book.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2">
        💡 所有小说数据均安全地保存在你的浏览器本地 IndexedDB 中。
      </div>
    </div>
  );
};
