import React, { useState, useEffect } from 'react';
import { TopNavbar } from './components/TopNavbar';
import { LibraryView } from './components/LibraryView';
import { BookDetailModal } from './components/BookDetailModal';
import { ReadChapterModal } from './components/ReadChapterModal';
import { DownloadModal } from './components/DownloadModal';
import { SummaryViewModal } from './components/SummaryViewModal';
import { SetupView } from './components/SetupView';
import { WriterView } from './components/WriterView';
import { InspirationHubView } from './components/InspirationHubView';
import { ConfigView } from './components/ConfigView';

import { Book, ApiConfig, InspirationRecord, UiSettings, Chapter, ArchivedChapter, Summary, BookSettings } from './types';
import {
  openDB,
  seedInitialDataIfEmpty,
  dbGetAll,
  dbGet,
  dbPut,
  dbDelete,
  STORE_NAMES,
  BUILTIN_CONFIG_ID,
  DEFAULT_BUILTIN_CONFIG,
} from './services/db';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('novels');

  // Core Data
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(-1);

  const [configs, setConfigs] = useState<ApiConfig[]>([DEFAULT_BUILTIN_CONFIG]);
  const [uiSettings, setUiSettings] = useState<UiSettings>({
    theme: 'green',
    mode: 'light',
    chapterFontSize: '1.05rem',
    writerApiCfgId: BUILTIN_CONFIG_ID,
    writerApiModel: 'gemini-3.6-flash',
    rerollApiCfgId: BUILTIN_CONFIG_ID,
    rerollApiModel: 'gemini-3.6-flash',
    inspirationApiCfgId: BUILTIN_CONFIG_ID,
    inspirationApiModel: 'gemini-3.6-flash',
  });

  const [xpPreferences, setXpPreferences] = useState<string>('');

  // Modals
  const [bookDetailTarget, setBookDetailTarget] = useState<Book | null>(null);
  const [isBookDetailOpen, setIsBookDetailOpen] = useState(false);

  const [readChapterTarget, setReadChapterTarget] = useState<Chapter | ArchivedChapter | null>(null);
  const [isReadChapterOpen, setIsReadChapterOpen] = useState(false);

  const [downloadBookTarget, setDownloadBookTarget] = useState<Book | null>(null);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  const [summaryViewTarget, setSummaryViewTarget] = useState<Summary | null>(null);
  const [isSummaryViewOpen, setIsSummaryViewOpen] = useState(false);

  // Initial load
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      await openDB();
      await seedInitialDataIfEmpty();

      const loadedBooks = await dbGetAll<Book>(STORE_NAMES.BOOKS);
      setBooks(loadedBooks);

      const configsWrapper = await dbGet<{ id: string; data: ApiConfig[] }>(STORE_NAMES.CONFIGS, 'all');
      if (configsWrapper && Array.isArray(configsWrapper.data)) {
        setConfigs(configsWrapper.data);
      }

      const loadedUi = await dbGet<UiSettings>(STORE_NAMES.UI_SETTINGS, 'current');
      if (loadedUi) {
        setUiSettings((prev) => ({ ...prev, ...loadedUi }));
      }

      const loadedXp = await dbGet<{ id: string; content: string }>(STORE_NAMES.XP_PREFERENCES, 'current');
      if (loadedXp?.content) {
        setXpPreferences(loadedXp.content);
      }

      // Restore active novel if stored
      const lastActiveId = localStorage.getItem('currentBookId');
      if (lastActiveId) {
        const found = loadedBooks.find((b) => b.id === lastActiveId);
        if (found && found.chapters.length > 0) {
          setCurrentBook(found);
          setCurrentChapterIndex(found.chapters.length - 1);
        }
      } else if (loadedBooks.length > 0 && loadedBooks[0].chapters.length > 0) {
        setCurrentBook(loadedBooks[0]);
        setCurrentChapterIndex(loadedBooks[0].chapters.length - 1);
      }
    } catch (err) {
      console.error('App init error:', err);
    }
  };

  // Sync theme & font settings to DOM
  useEffect(() => {
    const root = document.documentElement;
    if (uiSettings.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-theme', uiSettings.theme || 'indigo');
    root.style.setProperty('--chapter-content-font-size', uiSettings.chapterFontSize || '1.05rem');
  }, [uiSettings]);

  // Handle Save Book Changes
  const handleSaveBook = async (updatedBook: Book) => {
    await dbPut(STORE_NAMES.BOOKS, updatedBook);
    setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
    if (currentBook?.id === updatedBook.id) {
      setCurrentBook(updatedBook);
    }
    localStorage.setItem('currentBookId', updatedBook.id);
  };

  // Open Book Detail
  const handleOpenBookDetail = (book: Book) => {
    setBookDetailTarget(book);
    setIsBookDetailOpen(true);
  };

  // Continue writing a book
  const handleContinueWritingBook = (book: Book) => {
    setCurrentBook(book);
    const index = book.chapters.length > 0 ? book.chapters.length - 1 : 0;
    setCurrentChapterIndex(index);
    localStorage.setItem('currentBookId', book.id);
    setActiveTab('writer');
  };

  // Delete a book
  const handleDeleteBook = async (bookId: string) => {
    const target = books.find((b) => b.id === bookId);
    if (!target) return;

    if (confirm(`确定要彻底删除《${target.title}》吗？此操作不可撤销。`)) {
      await dbDelete(STORE_NAMES.BOOKS, bookId);
      const updatedBooks = books.filter((b) => b.id !== bookId);
      setBooks(updatedBooks);

      if (currentBook?.id === bookId) {
        setCurrentBook(updatedBooks[0] || null);
        setCurrentChapterIndex(updatedBooks[0]?.chapters.length ? updatedBooks[0].chapters.length - 1 : -1);
        if (updatedBooks[0]) {
          localStorage.setItem('currentBookId', updatedBooks[0].id);
        } else {
          localStorage.removeItem('currentBookId');
        }
      }
    }
  };

  // Delete summary inside book
  const handleDeleteSummary = async (summaryId: string) => {
    if (!bookDetailTarget) return;

    const updatedSummaries = (bookDetailTarget.summaries || []).filter((s) => s.id !== summaryId);
    const updatedBook = { ...bookDetailTarget, summaries: updatedSummaries };

    await handleSaveBook(updatedBook);
    setBookDetailTarget(updatedBook);
  };

  // Start Writing First Chapter from Setup View
  const handleStartWritingFirstChapter = async (newBook: Book) => {
    // Check if created from inspiration
    const inspirationToLinkId = localStorage.getItem('inspirationToLink');
    if (inspirationToLinkId) {
      const inspRecord = await dbGet<InspirationRecord>(STORE_NAMES.INSPIRATION_RECORDS, inspirationToLinkId);
      if (inspRecord) {
        const linked = inspRecord.linkedNovels || [];
        if (!linked.some((l) => l.novelId === newBook.id)) {
          linked.push({ novelId: newBook.id, novelTitle: newBook.title });
          await dbPut(STORE_NAMES.INSPIRATION_RECORDS, { ...inspRecord, linkedNovels: linked });
        }
      }
      localStorage.removeItem('inspirationToLink');
    }

    await dbPut(STORE_NAMES.BOOKS, newBook);
    setBooks((prev) => [newBook, ...prev]);
    setCurrentBook(newBook);
    setCurrentChapterIndex(0);
    localStorage.setItem('currentBookId', newBook.id);

    setActiveTab('writer');
  };

  // Update Settings from Setup View
  const handleUpdateBookSettings = async (updatedSettings: BookSettings, updatedTitle: string) => {
    if (!currentBook) return;

    const updatedBook: Book = {
      ...currentBook,
      title: updatedTitle,
      settings: updatedSettings,
      lastModifiedAt: Date.now(),
    };

    await handleSaveBook(updatedBook);
  };

  // Pre-fill setup from Inspiration Record
  const handleSelectInspirationForCreation = (record: InspirationRecord) => {
    const dummyBook: Book = {
      id: crypto.randomUUID(),
      title: record.title,
      createdAt: Date.now(),
      lastModifiedAt: Date.now(),
      chapters: [],
      archivedChapters: [],
      summaries: [],
      settings: {
        genre: record.genre || '',
        style: record.style || '',
        chapterWords: 2000,
        pov: '第三人称',
        tense: '现在时',
        temperature: 0.8,
        contextMemory: 3,
        aiPersona: '你是一位擅长表达冲突与人物情感的职业小说家。',
        outline: record.outline || '',
        characters: record.characters || '',
        world: record.world || '',
        styleReference: null,
      },
    };

    setCurrentBook(dummyBook);
    localStorage.setItem('inspirationToLink', record.id);
    setActiveTab('setup');
  };

  return (
    <div
      className="min-h-screen text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-500"
      style={{
        backgroundImage: uiSettings.mode === 'dark' ? 'var(--bg-gradient-dark)' : 'var(--bg-gradient-light)',
      }}
    >
      {/* Dynamic ambient background glow */}
      <div
        className="fixed top-0 left-1/4 w-[28rem] h-[28rem] rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow transition-colors duration-500"
        style={{ backgroundColor: 'var(--glow-1)' }}
      />
      <div
        className="fixed bottom-0 right-1/4 w-[28rem] h-[28rem] rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow transition-colors duration-500"
        style={{ backgroundColor: 'var(--glow-2)' }}
      />
      <div
        className="fixed top-1/3 right-10 w-80 h-80 rounded-full blur-3xl pointer-events-none -z-10 transition-colors duration-500"
        style={{ backgroundColor: 'var(--glow-1)', opacity: 0.5 }}
      />

      {/* Top Navbar */}
      <TopNavbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        uiSettings={uiSettings}
        setUiSettings={setUiSettings}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-6">
        {activeTab === 'novels' && (
          <LibraryView
            books={books}
            onOpenBookDetail={handleOpenBookDetail}
            onGoToSetup={() => {
              setCurrentBook(null);
              setActiveTab('setup');
            }}
          />
        )}

        {activeTab === 'setup' && (
          <SetupView
            currentBook={currentBook}
            configs={configs}
            uiSettings={uiSettings}
            onStartWritingFirstChapter={handleStartWritingFirstChapter}
            onUpdateBookSettings={handleUpdateBookSettings}
          />
        )}

        {activeTab === 'writer' && (
          <WriterView
            currentBook={currentBook}
            currentChapterIndex={currentChapterIndex}
            setCurrentChapterIndex={setCurrentChapterIndex}
            configs={configs}
            uiSettings={uiSettings}
            xpPreferences={xpPreferences}
            onSaveBook={handleSaveBook}
            onGoToSetup={() => setActiveTab('setup')}
            onOpenSummaryViewModal={(sum) => {
              setSummaryViewTarget(sum);
              setIsSummaryViewOpen(true);
            }}
          />
        )}

        {activeTab === 'inspiration' && (
          <InspirationHubView
            books={books}
            configs={configs}
            uiSettings={uiSettings}
            xpPreferences={xpPreferences}
            onSelectInspirationForCreation={handleSelectInspirationForCreation}
            onOpenBookFromInspiration={(bookId) => {
              const b = books.find((item) => item.id === bookId);
              if (b) handleContinueWritingBook(b);
            }}
          />
        )}

        {activeTab === 'config' && (
          <ConfigView
            configs={configs}
            setConfigs={setConfigs}
            uiSettings={uiSettings}
            setUiSettings={setUiSettings}
            xpPreferences={xpPreferences}
            setXpPreferences={setXpPreferences}
          />
        )}
      </main>

      {/* Modals */}
      <BookDetailModal
        book={bookDetailTarget}
        isOpen={isBookDetailOpen}
        onClose={() => setIsBookDetailOpen(false)}
        onContinueWriting={handleContinueWritingBook}
        onOpenDownloadDialog={(bookId) => {
          const target = books.find((b) => b.id === bookId);
          if (target) {
            setDownloadBookTarget(target);
            setIsDownloadOpen(true);
          }
        }}
        onDeleteBook={handleDeleteBook}
        onReadChapter={(chapter) => {
          setReadChapterTarget(chapter);
          setIsReadChapterOpen(true);
        }}
        onOpenSummaryView={(summary) => {
          setSummaryViewTarget(summary);
          setIsSummaryViewOpen(true);
        }}
        onDeleteSummary={handleDeleteSummary}
      />

      <ReadChapterModal
        chapter={readChapterTarget}
        isOpen={isReadChapterOpen}
        onClose={() => setIsReadChapterOpen(false)}
      />

      <DownloadModal
        book={downloadBookTarget}
        isOpen={isDownloadOpen}
        onClose={() => setIsDownloadOpen(false)}
      />

      <SummaryViewModal
        summary={summaryViewTarget}
        isOpen={isSummaryViewOpen}
        onClose={() => setIsSummaryViewOpen(false)}
      />
    </div>
  );
}
