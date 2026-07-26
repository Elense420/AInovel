import React from 'react';
import { X, Sparkles, User, FileText } from 'lucide-react';
import { Chapter, ArchivedChapter } from '../types';

interface ReadChapterModalProps {
  chapter: Chapter | ArchivedChapter | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReadChapterModal: React.FC<ReadChapterModalProps> = ({
  chapter,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !chapter) return null;

  const isArchived = 'archivedAt' in chapter;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-3xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/20 dark:border-slate-700/50">
        {/* Header */}
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between bg-white/40 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {chapter.title}
              </h2>
              {isArchived && (
                <span className="text-xs text-amber-500 font-medium">
                  (历史存档 - 存档于 {new Date((chapter as ArchivedChapter).archivedAt).toLocaleString()})
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm leading-relaxed">
          {/* Main Text */}
          <div className="bg-slate-50/70 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 whitespace-pre-wrap chapter-canvas text-slate-800 dark:text-slate-200">
            {chapter.text}
          </div>

          {/* User's Next Plot Hint if saved */}
          {chapter.userNextPlotInput && chapter.userNextPlotInput.trim() !== '' && (
            <div className="p-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 dark:bg-sky-500/10 space-y-1">
              <div className="text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>用户为此章指定的下一章走向 (已保存)</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {chapter.userNextPlotInput}
              </p>
            </div>
          )}

          {/* AI Suggestions list if available */}
          {((chapter.allSuggestions && chapter.allSuggestions.length > 0) || (chapter.nextOptions && chapter.nextOptions.length > 0)) && (
            <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 space-y-3">
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 建议的后续发展走向</span>
              </div>

              {chapter.allSuggestions && chapter.allSuggestions.length > 0 ? (
                <div className="space-y-3">
                  {chapter.allSuggestions.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        建议组 {chapter.allSuggestions!.length - groupIdx} ({new Date(group.timestamp).toLocaleTimeString()})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.suggestions.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50 text-xs text-slate-700 dark:text-slate-300"
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {chapter.nextOptions?.map((opt, optIdx) => (
                    <div
                      key={optIdx}
                      className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50 text-xs text-slate-700 dark:text-slate-300"
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
