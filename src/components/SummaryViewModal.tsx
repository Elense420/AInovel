import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { Summary } from '../types';

interface SummaryViewModalProps {
  summary: Summary | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SummaryViewModal: React.FC<SummaryViewModalProps> = ({
  summary,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/20 dark:border-slate-700/50">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between bg-white/40 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">
                📄 {summary.title}
              </h3>
              <p className="text-xs text-slate-400">
                范围: 章节 {summary.chapterRange} • 生成时间: {new Date(summary.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-slate-50/50 dark:bg-slate-900/50 font-sans">
          {summary.content}
        </div>

        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
