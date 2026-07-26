import React from 'react';
import { BookOpen, Sparkles, Sliders, Moon, Sun, Feather, Lightbulb } from 'lucide-react';
import { UiSettings } from '../types';

interface TopNavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  uiSettings: UiSettings;
  setUiSettings: React.Dispatch<React.SetStateAction<UiSettings>>;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeTab,
  setActiveTab,
  uiSettings,
  setUiSettings,
}) => {
  const toggleDarkMode = () => {
    setUiSettings((prev) => ({
      ...prev,
      mode: prev.mode === 'dark' ? 'light' : 'dark',
    }));
  };

  const navItems = [
    { id: 'novels', label: '我的书库', icon: BookOpen },
    { id: 'setup', label: '写作设定', icon: Sliders },
    { id: 'writer', label: '小说扩写', icon: Feather },
    { id: 'inspiration', label: '灵感供给站', icon: Lightbulb },
    { id: 'config', label: 'API配置与基础设置', icon: Sparkles },
  ];

  return (
    <header className="sticky top-0 z-50 transition-all duration-300 backdrop-blur-2xl bg-white/40 dark:bg-slate-900/50 border-b border-white/40 dark:border-slate-800/80 shadow-lg shadow-purple-200/20 dark:shadow-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div
          onClick={() => setActiveTab('novels')}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none group-hover:scale-105 transition-transform duration-200">
            <Sparkles className="w-5 h-5 animate-pulse-glow" />
          </div>
          <div>
            <span className="text-xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-300 dark:to-pink-400 bg-clip-text text-transparent">
              AI 小说家
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
              v5.3 Pro
            </span>
          </div>
        </div>

        {/* Tab Buttons */}
        <nav className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all duration-200 shrink-0 select-none ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleDarkMode}
            title={uiSettings.mode === 'dark' ? '切换浅色模式' : '切换深色模式'}
            className="p-2.5 rounded-2xl bg-white/50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all border border-white/60 dark:border-slate-700/60 shadow-xs"
          >
            {uiSettings.mode === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
          </button>
        </div>
      </div>
    </header>
  );
};
