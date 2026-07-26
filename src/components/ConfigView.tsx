import React, { useState, useEffect } from 'react';
import { Settings, Cpu, Heart, Palette, Database, Save, Trash2, CheckCircle, RefreshCw, Layers } from 'lucide-react';
import { ApiConfig, UiSettings, HistoryItem } from '../types';
import { dbPut, dbGetAll, dbGet, dbDelete, dbClear, STORE_NAMES } from '../services/db';
import { testAndFetchModels } from '../services/apiClient';

interface ConfigViewProps {
  configs: ApiConfig[];
  setConfigs: React.Dispatch<React.SetStateAction<ApiConfig[]>>;
  uiSettings: UiSettings;
  setUiSettings: React.Dispatch<React.SetStateAction<UiSettings>>;
  xpPreferences: string;
  setXpPreferences: React.Dispatch<React.SetStateAction<string>>;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  configs,
  setConfigs,
  uiSettings,
  setUiSettings,
  xpPreferences,
  setXpPreferences,
}) => {
  // API Editing form state
  const [cfgName, setCfgName] = useState('');
  const [cfgProvider, setCfgProvider] = useState<'openai-compatible' | 'built-in-gemini'>('openai-compatible');
  const [cfgBaseUrl, setCfgBaseUrl] = useState('');
  const [cfgApiKey, setCfgApiKey] = useState('');
  const [selectedManagedCfgId, setSelectedManagedCfgId] = useState('');

  const [cfgStatus, setCfgStatus] = useState('');

  // Task specific model cache states
  const [writerModels, setWriterModels] = useState<Array<{ id: string; name?: string }>>([]);
  const [rerollModels, setRerollModels] = useState<Array<{ id: string; name?: string }>>([]);
  const [inspirationModels, setInspirationModels] = useState<Array<{ id: string; name?: string }>>([]);

  const [writerStatus, setWriterStatus] = useState('');
  const [rerollStatus, setRerollStatus] = useState('');
  const [inspirationStatus, setInspirationStatus] = useState('');

  // XP preferences history
  const [xpHistory, setXpHistory] = useState<HistoryItem[]>([]);
  const [selectedXpHistoryId, setSelectedXpHistoryId] = useState('');
  const [xpStatus, setXpStatus] = useState('');

  const [backupStatus, setBackupStatus] = useState('');

  useEffect(() => {
    loadXpHistory();
    // Pre-populate models lists for active configurations
    handleLoadModelsForTask('writer', uiSettings.writerApiCfgId);
    handleLoadModelsForTask('reroll', uiSettings.rerollApiCfgId);
    handleLoadModelsForTask('inspiration', uiSettings.inspirationApiCfgId);
  }, []);

  const loadXpHistory = async () => {
    const list = await dbGetAll<HistoryItem>(STORE_NAMES.XP_PREFERENCES_HISTORY);
    setXpHistory(list);
  };

  // Save new custom API configuration
  const handleSaveConfig = async () => {
    if (!cfgName.trim() || !cfgBaseUrl.trim() || !cfgApiKey.trim()) {
      setCfgStatus('请完整填写 配置名称 / Base URL / API Key');
      return;
    }

    const newCfg: ApiConfig = {
      id: crypto.randomUUID(),
      name: cfgName.trim(),
      baseUrl: cfgBaseUrl.trim(),
      apiKey: cfgApiKey.trim(),
      provider: cfgProvider,
      modelsCache: [],
    };

    const updatedConfigs = [...configs, newCfg];
    setConfigs(updatedConfigs);
    await dbPut(STORE_NAMES.CONFIGS, { id: 'all', data: updatedConfigs });

    setCfgStatus(`✅ 已保存配置: ${newCfg.name}`);
    setCfgName('');
    setCfgBaseUrl('');
    setCfgApiKey('');
  };

  const handleTestConnection = async () => {
    if (!cfgBaseUrl.trim() || !cfgApiKey.trim()) {
      setCfgStatus('请填写 Base URL 和 API Key 以便进行连通测试');
      return;
    }

    setCfgStatus('正在测试 API 连接并获取模型列表...');
    try {
      const models = await testAndFetchModels(cfgBaseUrl.trim(), cfgApiKey.trim(), cfgProvider);
      setCfgStatus(`✅ 连接成功！检测到 ${models.length} 个可用模型。`);
    } catch (err: any) {
      setCfgStatus(`❌ 测试连接失败: ${err.message}`);
    }
  };

  const handleLoadCfgToEdit = () => {
    const target = configs.find((c) => c.id === selectedManagedCfgId);
    if (target) {
      setCfgName(target.name);
      setCfgProvider(target.provider);
      setCfgBaseUrl(target.baseUrl);
      setCfgApiKey(target.apiKey);
      setCfgStatus(`已将线路 "${target.name}" 加载到编辑区。`);
    }
  };

  const handleDeleteCfg = async () => {
    if (!selectedManagedCfgId) return;
    const target = configs.find((c) => c.id === selectedManagedCfgId);
    if (target?.provider === 'built-in-gemini') {
      alert('官方内置 Gemini 线路不可删除');
      return;
    }

    if (confirm(`确定要删除配置 "${target?.name}" 吗？`)) {
      const updated = configs.filter((c) => c.id !== selectedManagedCfgId);
      setConfigs(updated);
      await dbPut(STORE_NAMES.CONFIGS, { id: 'all', data: updated });
      setSelectedManagedCfgId('');
      setCfgStatus('配置已成功删除');
    }
  };

  // Specific load models for Task Assignments
  const handleLoadModelsForTask = async (
    taskType: 'writer' | 'reroll' | 'inspiration',
    cfgId: string | null
  ) => {
    const targetCfg = configs.find((c) => c.id === cfgId) || configs[0];
    if (!targetCfg) return;

    const setModels =
      taskType === 'writer'
        ? setWriterModels
        : taskType === 'reroll'
        ? setRerollModels
        : setInspirationModels;

    const setStatus =
      taskType === 'writer'
        ? setWriterStatus
        : taskType === 'reroll'
        ? setRerollStatus
        : setInspirationStatus;

    if (targetCfg.modelsCache && targetCfg.modelsCache.length > 0) {
      setModels(targetCfg.modelsCache);
      setStatus(`已加载 ${targetCfg.modelsCache.length} 个缓存模型`);
      return;
    }

    setStatus('正在获取模型列表...');
    try {
      const models = await testAndFetchModels(
        targetCfg.baseUrl,
        targetCfg.apiKey,
        targetCfg.provider
      );
      setModels(models);

      // Cache models
      targetCfg.modelsCache = models;
      await dbPut(STORE_NAMES.CONFIGS, { id: 'all', data: configs });

      setStatus(`成功获取 ${models.length} 个模型`);
    } catch (err: any) {
      setStatus(`获取失败: ${err.message}`);
    }
  };

  // Update UI setting helper
  const updateUiSettingsKey = async (key: keyof UiSettings, value: any) => {
    const updated = { ...uiSettings, [key]: value };
    setUiSettings(updated);
    await dbPut(STORE_NAMES.UI_SETTINGS, { id: 'current', ...updated });
  };

  // XP preferences handlers
  const handleSaveXpPreferences = async () => {
    if (!xpPreferences.trim()) return;
    await dbPut(STORE_NAMES.XP_PREFERENCES, { id: 'current', content: xpPreferences.trim() });
    await dbPut(STORE_NAMES.XP_PREFERENCES_HISTORY, {
      createdAt: Date.now(),
      content: xpPreferences.trim(),
    });
    await loadXpHistory();
    setXpStatus('💾 XP 写作偏好已保存！');
    setTimeout(() => setXpStatus(''), 2000);
  };

  const handleLoadXpHistory = () => {
    if (!selectedXpHistoryId) return;
    const item = xpHistory.find((h) => String(h.id) === selectedXpHistoryId);
    if (item && item.content) {
      setXpPreferences(item.content);
      setXpStatus('已加载选中的历史 XP 偏好');
    }
  };

  const handleDeleteXpHistory = async () => {
    if (!selectedXpHistoryId) return;
    if (confirm('确定删除该条历史 XP 记录吗？')) {
      await dbDelete(STORE_NAMES.XP_PREFERENCES_HISTORY, Number(selectedXpHistoryId));
      setSelectedXpHistoryId('');
      await loadXpHistory();
      setXpStatus('已删除选中的 XP 历史记录');
    }
  };

  // Full backup & restore
  const handleBackupAllData = async () => {
    const allData: Record<string, any> = {};
    for (const storeName of Object.values(STORE_NAMES)) {
      allData[storeName] = await dbGetAll(storeName);
    }
    allData.uiSettings = await dbGet(STORE_NAMES.UI_SETTINGS, 'current');

    const jsonStr = JSON.stringify(allData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const filename = `AI小说家_全量数据备份_${new Date().toISOString().slice(0, 10)}.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    setBackupStatus('✅ 全量备份 JSON 已顺利下载');
  };

  const handleRestoreAllData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('⚠️ 确定要恢复全量数据吗？这将覆盖当前所有本地小说、历史大纲及配置！')) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        for (const storeName of Object.values(STORE_NAMES)) {
          await dbClear(storeName);
          if (imported[storeName] && Array.isArray(imported[storeName])) {
            for (const item of imported[storeName]) {
              await dbPut(storeName, item);
            }
          }
        }
        if (imported.uiSettings) {
          await dbPut(STORE_NAMES.UI_SETTINGS, imported.uiSettings);
        }

        setBackupStatus('数据恢复成功！页面即刻刷新...');
        setTimeout(() => location.reload(), 1200);
      } catch (err: any) {
        setBackupStatus(`恢复失败: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* 1. API Configuration Form */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              API 线路配置管理
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              支持配置标准的 OpenAI 兼容接口，或直接使用系统默认的免费 Gemini 官方线路。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              线路名称
            </label>
            <input
              type="text"
              value={cfgName}
              onChange={(e) => setCfgName(e.target.value)}
              placeholder="例如：自建中转 API / 主线路"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Provider 类型
            </label>
            <select
              value={cfgProvider}
              onChange={(e: any) => setCfgProvider(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm focus:outline-hidden"
            >
              <option value="openai-compatible">OpenAI 兼容接口 (Standard API)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Base URL
            </label>
            <input
              type="text"
              value={cfgBaseUrl}
              onChange={(e) => setCfgBaseUrl(e.target.value)}
              placeholder="例如: https://api.openai.com/v1"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={cfgApiKey}
              onChange={(e) => setCfgApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSaveConfig}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs sm:text-sm shadow-md transition-all"
          >
            保存新配置
          </button>
          <button
            onClick={handleTestConnection}
            className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm transition-colors"
          >
            测试连接
          </button>
        </div>

        {cfgStatus && (
          <div className="text-xs p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-mono">
            {cfgStatus}
          </div>
        )}
      </div>

      {/* 2. Saved Configs Management */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
          已保存的 API 线路列表
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedManagedCfgId}
            onChange={(e) => setSelectedManagedCfgId(e.target.value)}
            className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm"
          >
            <option value="">选择线路以进行编辑或删除...</option>
            {configs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.provider})
              </option>
            ))}
          </select>

          <button
            onClick={handleLoadCfgToEdit}
            className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium hover:bg-slate-300"
          >
            加载到编辑区
          </button>

          <button
            onClick={handleDeleteCfg}
            className="px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-xs font-medium"
          >
            删除此配置
          </button>
        </div>
      </div>

      {/* 3. Independent Task API Assignments */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <Layers className="w-4 h-4 text-emerald-500" />
          <span>分任务独立 API 线路与模型分配</span>
        </h3>

        {/* Writer API */}
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            📖 小说正文扩写 API 设置
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={uiSettings.writerApiCfgId || ''}
              onChange={(e) => {
                updateUiSettingsKey('writerApiCfgId', e.target.value);
                handleLoadModelsForTask('writer', e.target.value);
              }}
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
            >
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => handleLoadModelsForTask('writer', uiSettings.writerApiCfgId)}
              className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-300"
            >
              加载模型
            </button>

            <select
              value={uiSettings.writerApiModel || ''}
              onChange={(e) => updateUiSettingsKey('writerApiModel', e.target.value)}
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
            >
              {writerModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </div>
          {writerStatus && <p className="text-[11px] text-slate-400">{writerStatus}</p>}
        </div>

        {/* Reroll Suggestions API */}
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            🔄 重掷后续建议 API 设置
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={uiSettings.rerollApiCfgId || ''}
              onChange={(e) => {
                updateUiSettingsKey('rerollApiCfgId', e.target.value);
                handleLoadModelsForTask('reroll', e.target.value);
              }}
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
            >
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => handleLoadModelsForTask('reroll', uiSettings.rerollApiCfgId)}
              className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-300"
            >
              加载模型
            </button>

            <select
              value={uiSettings.rerollApiModel || ''}
              onChange={(e) => updateUiSettingsKey('rerollApiModel', e.target.value)}
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
            >
              {rerollModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </div>
          {rerollStatus && <p className="text-[11px] text-slate-400">{rerollStatus}</p>}
        </div>

        {/* Inspiration Hub API */}
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            ✨ 创作灵感大纲 API 设置
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={uiSettings.inspirationApiCfgId || ''}
              onChange={(e) => {
                updateUiSettingsKey('inspirationApiCfgId', e.target.value);
                handleLoadModelsForTask('inspiration', e.target.value);
              }}
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
            >
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => handleLoadModelsForTask('inspiration', uiSettings.inspirationApiCfgId)}
              className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-300"
            >
              加载模型
            </button>

            <select
              value={uiSettings.inspirationApiModel || ''}
              onChange={(e) => updateUiSettingsKey('inspirationApiModel', e.target.value)}
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
            >
              {inspirationModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </div>
          {inspirationStatus && <p className="text-[11px] text-slate-400">{inspirationStatus}</p>}
        </div>
      </div>

      {/* 4. My XP Preferences */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <Heart className="w-5 h-5 text-rose-500" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            我的 XP 爱好与个人写作偏好
          </h3>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          填写的偏好与禁忌会自动注入系统 Prompt 中，影响灵感大纲生成和后续章节扩写。
        </p>

        <textarea
          rows={5}
          value={xpPreferences}
          onChange={(e) => setXpPreferences(e.target.value)}
          placeholder="- 角色必须是独立强大的角色，不接受傻白甜。&#10;- 剧情必须有反转，避免一眼看穿的老套路。&#10;- 禁忌：无理出轨等破防桥段。&#10;- 偏爱：强强对话、反乌托邦、悬念与感情拉扯。"
          className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm leading-relaxed focus:outline-hidden"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <select
              value={selectedXpHistoryId}
              onChange={(e) => setSelectedXpHistoryId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
            >
              <option value="">选择历史 XP 偏好...</option>
              {xpHistory.map((h) => (
                <option key={h.id} value={String(h.id)}>
                  {new Date(h.createdAt || Date.now()).toLocaleDateString()} - {(h.content || '').slice(0, 30)}...
                </option>
              ))}
            </select>
            <button
              onClick={handleLoadXpHistory}
              className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-300"
            >
              加载
            </button>
            <button
              onClick={handleDeleteXpHistory}
              className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-600 text-xs hover:bg-rose-500/20"
            >
              删除
            </button>
          </div>

          <button
            onClick={handleSaveXpPreferences}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs sm:text-sm shadow-md"
          >
            💾 保存当前 XP 偏好
          </button>
        </div>

        {xpStatus && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{xpStatus}</p>}
      </div>

      {/* 5. UI Appearance Settings */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <Palette className="w-5 h-5 text-teal-500" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            界面外观与主题偏好
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Theme switcher */}
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">
              主题调色盘 (点击即刻实时切换应用外观)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {[
                { id: 'indigo', color: '#6366f1', gradient: 'from-indigo-500 via-purple-500 to-pink-500', label: '极光靛紫' },
                { id: 'green', color: '#10b981', gradient: 'from-emerald-500 to-teal-600', label: '翡翠竹青' },
                { id: 'pink', color: '#f43f5e', gradient: 'from-rose-500 to-pink-500', label: '浪漫樱粉' },
                { id: 'blue', color: '#0284c7', gradient: 'from-sky-500 to-indigo-600', label: '琥珀蔚蓝' },
                { id: 'yellow', color: '#d97706', gradient: 'from-amber-500 to-red-500', label: '暖阳金辉' },
                { id: 'purple', color: '#8b5cf6', gradient: 'from-purple-500 to-fuchsia-500', label: '幻彩魅紫' },
                { id: 'white', color: '#64748b', gradient: 'from-slate-500 to-slate-700', label: '极简素雅' },
              ].map((t) => {
                const isSelected = uiSettings.theme === t.id || (!uiSettings.theme && t.id === 'indigo');
                return (
                  <button
                    key={t.id}
                    onClick={() => updateUiSettingsKey('theme', t.id)}
                    title={t.label}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-medium transition-all duration-200 border cursor-pointer select-none ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 shadow-md ring-2 ring-indigo-500/50 scale-105'
                        : 'bg-white/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:scale-102'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-gradient-to-r ${t.gradient} shadow-xs shrink-0`}
                    />
                    <span>{t.label}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 ml-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chapter Font Size */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              章节阅读正文字号
            </label>
            <select
              value={uiSettings.chapterFontSize}
              onChange={(e) => updateUiSettingsKey('chapterFontSize', e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm"
            >
              <option value="0.9rem">小号 (0.9rem)</option>
              <option value="1.05rem">标准 (1.05rem)</option>
              <option value="1.2rem">大号 (1.2rem)</option>
              <option value="1.35rem">特大 (1.35rem)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 6. Data Backup and Restore */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <Database className="w-5 h-5 text-indigo-500" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            全量数据备份与恢复
          </h3>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          一键导出本地 IndexedDB 中保存的全部小说、章节、灵感及配置，或从备份 JSON 文件恢复。
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleBackupAllData}
            className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium transition-colors"
          >
            ⬇️ 备份所有数据 (JSON)
          </button>

          <label className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium transition-colors cursor-pointer">
            ⬆️ 恢复所有数据
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreAllData}
              className="hidden"
            />
          </label>
        </div>

        {backupStatus && (
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {backupStatus}
          </p>
        )}
      </div>
    </div>
  );
};
