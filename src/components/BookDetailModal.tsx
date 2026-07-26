import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, Play, Download, Trash2, FileText, History, Bookmark, Sparkles } from 'lucide-react';
import { Book, Chapter, ArchivedChapter, Summary } from '../types';
import JSZip from 'jszip';

interface BookDetailModalProps {
  book: Book | null;
  isOpen: boolean;
  onClose: () => void;
  onContinueWriting: (book: Book) => void;
  onOpenDownloadDialog: (bookId: string) => void;
  onDeleteBook: (bookId: string) => void;
  onReadChapter: (chapter: Chapter | ArchivedChapter) => void;
  onOpenSummaryView: (summary: Summary) => void;
  onDeleteSummary: (summaryId: string) => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  isOpen,
  onClose,
  onContinueWriting,
  onOpenDownloadDialog,
  onDeleteBook,
  onReadChapter,
  onOpenSummaryView,
  onDeleteSummary,
}) => {
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [selectedArchivedIds, setSelectedArchivedIds] = useState<string[]>([]);

  if (!isOpen || !book) return null;

  const toggleArchivedSelection = (id: string) => {
    setSelectedArchivedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDownloadArchived = async () => {
    if (selectedArchivedIds.length === 0) {
      alert('请至少选择一个要下载的存档章节。');
      return;
    }

    const chaptersToDownload = (book.archivedChapters || []).filter((ch) =>
      selectedArchivedIds.includes(ch.id)
    );

    if (chaptersToDownload.length === 1) {
      const chapter = chaptersToDownload[0];
      const content = `【${chapter.title} (存档于 ${new Date(chapter.archivedAt).toLocaleString()})】\n\n${chapter.text}`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      triggerDownload(blob, `[存档] ${book.title} - ${chapter.title}.txt`);
    } else {
      const zip = new JSZip();
      chaptersToDownload.forEach((chapter) => {
        const safeTitle = chapter.title.replace(/[\\/:*?"<>|]/g, '_');
        zip.file(`第${chapter.index}章 - ${safeTitle}.txt`, chapter.text);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerDownload(blob, `[存档] ${book.title} (${chaptersToDownload.length}章).zip`);
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/20 dark:border-slate-700/50">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between bg-white/40 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xl">
              《
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {book.title}
              </h2>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-0.5">
                <span>类型: {book.settings?.genre || '通用'}</span>
                <span>•</span>
                <span>创建时间: {new Date(book.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Outline Accordion */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 overflow-hidden">
            <button
              onClick={() => setIsOutlineOpen(!isOutlineOpen)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-emerald-500" />
                <span>小说大纲与主要设定</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                <span>{isOutlineOpen ? '折叠' : '展开'}</span>
                {isOutlineOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isOutlineOpen && (
              <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 whitespace-pre-wrap leading-relaxed text-slate-600 dark:text-slate-300 text-xs sm:text-sm max-h-60 overflow-y-auto">
                {book.settings?.outline || '未设定大纲'}
              </div>
            )}
          </div>

          {/* Active Chapters */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-emerald-500" />
              <span>章节目录 ({book.chapters.length})</span>
            </h3>

            {book.chapters.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center bg-slate-100/50 dark:bg-slate-800/50 rounded-xl">
                尚未生成任何章节
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {book.chapters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => onReadChapter(ch)}
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-800/40 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-left transition-all group flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate pr-2">
                      第 {ch.index} 章: {ch.title}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {ch.text.length}字
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Archived Chapters */}
          <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-base">
                <History className="w-4 h-4 text-amber-500" />
                <span>历史存档 ({(book.archivedChapters || []).length})</span>
              </h3>
              {selectedArchivedIds.length > 0 && (
                <button
                  onClick={handleDownloadArchived}
                  className="px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载选中存档 ({selectedArchivedIds.length})</span>
                </button>
              )}
            </div>

            <p className="text-xs text-slate-400">
              当重写某个章节时，该章节及后续旧版本会保存在这里。
            </p>

            {(!book.archivedChapters || book.archivedChapters.length === 0) ? (
              <p className="text-xs text-slate-400 py-2">暂无重写存档</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {book.archivedChapters.map((arch) => {
                  const isChecked = selectedArchivedIds.includes(arch.id);
                  return (
                    <div
                      key={arch.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleArchivedSelection(arch.id)}
                        className="w-4 h-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <button
                        onClick={() => onReadChapter(arch)}
                        className="flex-1 text-left truncate text-xs text-slate-700 dark:text-slate-300 hover:text-emerald-600"
                      >
                        (存档于 {new Date(arch.archivedAt).toLocaleDateString()}) {arch.title}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Milestone Summaries */}
          <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>📚 阶段性总结回顾 ({(book.summaries || []).length})</span>
            </h3>

            {(!book.summaries || book.summaries.length === 0) ? (
              <p className="text-xs text-slate-400">
                暂无阶段性总结，可在小说扩写页手动生成。
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {book.summaries.map((sum) => (
                  <div
                    key={sum.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-500/10 hover:bg-purple-500/15 transition-colors"
                  >
                    <div
                      onClick={() => onOpenSummaryView(sum)}
                      className="flex-1 cursor-pointer pr-2"
                    >
                      <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                        📌 {sum.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        范围: 章节 {sum.chapterRange} • {new Date(sum.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`确定要删除“${sum.title}”吗？`)) {
                          onDeleteSummary(sum.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="删除此总结"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => {
              onClose();
              onDeleteBook(book.id);
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-medium text-xs sm:text-sm transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>删除本书</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenDownloadDialog(book.id)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>下载有效章节</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onContinueWriting(book);
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>继续写作</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
