import React, { useState } from 'react';
import { X, Download, FileText, Archive, Globe } from 'lucide-react';
import { Book } from '../types';
import JSZip from 'jszip';

interface DownloadModalProps {
  book: Book | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  book,
  isOpen,
  onClose,
}) => {
  const [format, setFormat] = useState<'txt-single' | 'zip-txt' | 'html-single' | 'zip-html'>('txt-single');

  if (!isOpen || !book) return null;

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

  const handleDownload = async () => {
    const filename = book.title.replace(/[\\/:*?"<>|]/g, '_');

    if (format === 'txt-single') {
      const content = book.chapters
        .map((c) => `【${c.title}】\n\n${c.text}`)
        .join('\n\n---\n\n');
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      triggerDownload(blob, `${filename}.txt`);
    } else if (format === 'html-single') {
      const chapterHtml = book.chapters
        .map((c) => `<h2 style="color: #059669; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">${c.title}</h2>\n<pre style="white-space: pre-wrap; font-family: sans-serif; line-height: 1.8;">${c.text}</pre>`)
        .join('\n<hr style="margin: 30px 0; border: none; border-top: 1px dashed #cbd5e1;">\n');

      const content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${book.title}</title>
  <style>
    body { line-height: 1.8; max-width: 800px; margin: 30px auto; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; background-color: #f8fafc; }
    h1 { text-align: center; color: #047857; margin-bottom: 40px; }
  </style>
</head>
<body>
  <h1>${book.title}</h1>
  ${chapterHtml}
</body>
</html>`;
      const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
      triggerDownload(blob, `${filename}.html`);
    } else if (format === 'zip-txt') {
      const zip = new JSZip();
      book.chapters.forEach((c) => {
        const safeTitle = c.title.replace(/[\\/:*?"<>|]/g, '_');
        zip.file(`第${c.index}章 - ${safeTitle}.txt`, c.text);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerDownload(blob, `${filename}.zip`);
    } else if (format === 'zip-html') {
      const zip = new JSZip();
      book.chapters.forEach((c) => {
        const safeTitle = c.title.replace(/[\\/:*?"<>|]/g, '_');
        const chapterContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${c.title}</title>
  <style>
    body { line-height: 1.8; max-width: 800px; margin: 30px auto; padding: 24px; font-family: sans-serif; color: #1e293b; }
  </style>
</head>
<body>
  <h1>${c.title}</h1>
  <pre style="white-space: pre-wrap; font-family: inherit;">${c.text}</pre>
</body>
</html>`;
        zip.file(`第${c.index}章 - ${safeTitle}.html`, chapterContent);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerDownload(blob, `${filename}.zip`);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-md rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/20 dark:border-slate-700/50">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">
              下载小说 《{book.title}》
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <label className="block font-medium text-slate-700 dark:text-slate-300">
            选择导出格式：
          </label>

          <div className="grid grid-cols-1 gap-2.5">
            {[
              { id: 'txt-single', title: '合并单文件 TXT', desc: '全书合并为一个 TXT 纯文本', icon: FileText },
              { id: 'zip-txt', title: '分章 ZIP 压缩包 (TXT)', desc: '按章节单独拆分为 txt 压缩包', icon: Archive },
              { id: 'html-single', title: '合并 HTML 网页', desc: '美观排版的可阅读网页', icon: Globe },
              { id: 'zip-html', title: '分章 ZIP 压缩包 (HTML)', desc: '按章节独立的 HTML 网页', icon: Archive },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = format === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setFormat(item.id as any)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-medium shadow-xs'
                      : 'border-slate-200/70 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100/50'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
          >
            取消
          </button>
          <button
            onClick={handleDownload}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>确认下载</span>
          </button>
        </div>
      </div>
    </div>
  );
};
