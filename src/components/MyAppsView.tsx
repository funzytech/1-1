import React, { useState, useEffect } from 'react';

export interface AppItem {
  id: string;
  name: string;
  description: string;
  category: 'Productivity' | 'Developer Tools' | 'AI Utilities' | 'Design';
  icon: string;
  badge?: string;
  launchUrl: string;
  isExternal: boolean;
  version?: string;
}

interface MyAppsViewProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAskAI?: () => void;
}

const DEFAULT_SAMPLE_APPS: AppItem[] = [
  {
    id: 'app-1',
    name: 'Funzy Code Sandbox',
    description: 'Instant browser-based TypeScript & React live editor with instant bundle execution and error linting.',
    category: 'Developer Tools',
    icon: '💻',
    badge: 'Popular',
    launchUrl: 'https://codesandbox.io',
    isExternal: true,
    version: 'v2.4',
  },
  {
    id: 'app-2',
    name: 'PromptCraft AI Studio',
    description: 'Advanced prompt generator, system instruction builder, and token efficiency analyzer for LLMs.',
    category: 'AI Utilities',
    badge: 'AI Core',
    icon: '🔮',
    launchUrl: '#ask-ai',
    isExternal: false,
    version: 'v3.1',
  },
  {
    id: 'app-3',
    name: 'DevPalette & Contrast Engine',
    description: 'Precision HSL/Oklch palette creator, WCAG AA/AAA accessibility score validator, and CSS token generator.',
    category: 'Design',
    icon: '🎨',
    launchUrl: 'https://coolors.co',
    isExternal: true,
    version: 'v1.9',
  },
  {
    id: 'app-4',
    name: 'JSON & Schema Architect',
    description: 'Visual tree inspector, bidirectional JSON-to-TypeScript interface generator, and syntax sanitizer.',
    category: 'Developer Tools',
    icon: '📄',
    launchUrl: 'https://jsonformatter.org',
    isExternal: true,
    version: 'v2.0',
  },
  {
    id: 'app-5',
    name: 'FlowState Pomodoro Timer',
    description: 'Minimalist deep-work timer with customizable intervals, ambient lo-fi soundscapes, and session logs.',
    category: 'Productivity',
    badge: 'Focus',
    icon: '⏱️',
    launchUrl: 'https://pomofocus.io',
    isExternal: true,
    version: 'v1.5',
  },
  {
    id: 'app-6',
    name: 'Vector & SVG Canvas Pro',
    description: 'Web-based vector illustration and path editor for rapid UI iconography and responsive SVG exports.',
    category: 'Design',
    icon: '⚡',
    launchUrl: 'https://boxy-svg.com',
    isExternal: true,
    version: 'v4.2',
  },
];

export const MyAppsView: React.FC<MyAppsViewProps> = ({ isOpen, onClose, onOpenAskAI }) => {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [editingApp, setEditingApp] = useState<AppItem | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<AppItem['category']>('Developer Tools');
  const [formIcon, setFormIcon] = useState('🛠️');
  const [formLaunchUrl, setFormLaunchUrl] = useState('https://');
  const [formBadge, setFormBadge] = useState('');

  // Load apps
  useEffect(() => {
    try {
      const saved = localStorage.getItem('funzy_my_apps');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setApps(parsed);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load apps:', e);
    }
    setApps(DEFAULT_SAMPLE_APPS);
    localStorage.setItem('funzy_my_apps', JSON.stringify(DEFAULT_SAMPLE_APPS));
  }, []);

  const saveApps = (updated: AppItem[]) => {
    setApps(updated);
    try {
      localStorage.setItem('funzy_my_apps', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save apps:', e);
    }
  };

  const handleOpenAdd = () => {
    setEditingApp(null);
    setFormName('');
    setFormDesc('');
    setFormCategory('Developer Tools');
    setFormIcon('🚀');
    setFormLaunchUrl('https://');
    setFormBadge('New');
    setIsAdminOpen(true);
  };

  const handleOpenEdit = (app: AppItem) => {
    setEditingApp(app);
    setFormName(app.name);
    setFormDesc(app.description);
    setFormCategory(app.category);
    setFormIcon(app.icon);
    setFormLaunchUrl(app.launchUrl);
    setFormBadge(app.badge || '');
    setIsAdminOpen(true);
  };

  const handleDeleteApp = (id: string) => {
    if (window.confirm('Delete this app from directory?')) {
      const updated = apps.filter((a) => a.id !== id);
      saveApps(updated);
    }
  };

  const handleSaveApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingApp) {
      const updated = apps.map((a) =>
        a.id === editingApp.id
          ? {
              ...a,
              name: formName.trim(),
              description: formDesc.trim(),
              category: formCategory,
              icon: formIcon.trim() || '🛠️',
              launchUrl: formLaunchUrl.trim(),
              badge: formBadge.trim() || undefined,
            }
          : a
      );
      saveApps(updated);
    } else {
      const newApp: AppItem = {
        id: `app_${Date.now()}`,
        name: formName.trim(),
        description: formDesc.trim(),
        category: formCategory,
        icon: formIcon.trim() || '🚀',
        launchUrl: formLaunchUrl.trim() || 'https://',
        badge: formBadge.trim() || undefined,
        isExternal: !formLaunchUrl.startsWith('#'),
        version: 'v1.0',
      };
      saveApps([newApp, ...apps]);
    }

    setIsAdminOpen(false);
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset all apps back to default sample directory?')) {
      saveApps(DEFAULT_SAMPLE_APPS);
      setIsAdminOpen(false);
    }
  };

  const handleLaunch = (app: AppItem) => {
    if (app.launchUrl === '#ask-ai' && onOpenAskAI) {
      onClose();
      onOpenAskAI();
    } else {
      window.open(app.launchUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Filter & Search
  const filteredApps = apps.filter((a) => {
    const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['All', 'Productivity', 'Developer Tools', 'AI Utilities', 'Design'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#eadecf] text-[#261508] font-['Outfit',sans-serif] animate-fade-in overflow-hidden select-none">
      {/* Background styling */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#f8f3ec] via-[#f2e6d6] to-[#e6d4bd] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-white/70 backdrop-blur-xl border-b border-[#8c7054]/25 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-700 text-white shadow-sm font-bold text-base">
            🚀
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-[#261508]">
                My Apps
              </h1>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
                Funzy Tech
              </span>
            </div>
            <p className="text-[10.5px] text-[#7d644d] font-medium leading-tight">
              Essential productivity tools, developer playgrounds & AI applications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Admin Management Button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100/90 hover:bg-amber-200 text-[#4a321f] text-xs font-bold border border-amber-300 shadow-2xs transition-all cursor-pointer active:scale-95"
            title="Manage applications"
          >
            <span>⚙️</span>
            <span>Manage Apps</span>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-black/10 hover:bg-black/15 text-[#3b2716] border border-black/10 transition-all active:scale-95 cursor-pointer ml-1"
            title="Close My Apps"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="relative z-10 px-4 sm:px-8 py-3.5 bg-white/40 backdrop-blur-md border-b border-[#8c7054]/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#2b1a0e] text-white shadow-xs'
                  : 'bg-white/70 hover:bg-white text-[#5c442f] border border-[#a68d6a]/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search apps, utilities..."
            className="w-full text-xs font-medium text-[#261508] placeholder-[#9c8269] bg-white/80 border border-[#8c7054]/30 rounded-xl px-3 py-1.5 pl-8 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
          <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-[#8c7054]">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-2 flex items-center text-[#8c7054] hover:text-[#261508]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Apps Grid Content */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {filteredApps.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📱</div>
              <h3 className="text-lg font-bold text-[#261508]">No apps found</h3>
              <p className="text-xs text-[#73593f] mt-1">Try searching for other tools or reset your category.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-1.5 rounded-xl bg-white border border-[#8c7054]/30 text-xs font-bold text-[#4a321f] hover:bg-amber-50 cursor-pointer"
              >
                Show All Apps
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  className="group relative flex flex-col rounded-2xl bg-white/75 backdrop-blur-md border border-white/90 shadow-sm hover:shadow-md transition-all duration-300 p-5 overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    {/* App Icon */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100/90 border border-amber-300/80 text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                      {app.icon}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {app.badge && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-2xs">
                          {app.badge}
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 text-[#543b27]">
                        {app.category}
                      </span>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(app)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-black/5 text-[#73593f] hover:text-[#261508] transition-opacity cursor-pointer ml-1"
                        title="Edit app"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* App Details */}
                  <h3 className="font-extrabold text-base text-[#261508] tracking-tight group-hover:text-amber-800 transition-colors">
                    {app.name}
                  </h3>

                  <p className="text-xs text-[#6e553f] line-clamp-3 leading-relaxed mt-1.5 mb-4 flex-1">
                    {app.description}
                  </p>

                  {/* Launch Row */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#8c7054]/15 mt-auto">
                    <span className="text-[11px] font-semibold text-[#8c7054]">
                      {app.version || 'Web App'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleLaunch(app)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#261508] hover:bg-[#3d2512] text-white font-bold text-xs shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <span>Launch App</span>
                      <span className="font-bold">→</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Admin Management Modal */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-[#f7f0e5] border-2 border-white/90 shadow-2xl p-5 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#8c7054]/20 mb-4">
              <h2 className="font-black text-base sm:text-lg text-[#261508]">
                {editingApp ? 'Edit Application' : 'Add New Application'}
              </h2>
              <button
                type="button"
                onClick={() => setIsAdminOpen(false)}
                className="p-1.5 rounded-xl hover:bg-black/10 text-[#573e2a] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveApp} className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="font-bold text-[#4a321f] block mb-1">App Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Markdown Studio"
                    className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#4a321f] block mb-1">Emoji Icon</label>
                  <input
                    type="text"
                    required
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    placeholder="⚡"
                    className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none text-center text-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-[#4a321f] block mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e: any) => setFormCategory(e.target.value)}
                    className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none"
                  >
                    <option value="Developer Tools">Developer Tools</option>
                    <option value="Productivity">Productivity</option>
                    <option value="AI Utilities">AI Utilities</option>
                    <option value="Design">Design</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#4a321f] block mb-1">Badge (Optional)</label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder="e.g. Pro, Core, Beta"
                    className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#4a321f] block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="What does this tool or app do?"
                  className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="font-bold text-[#4a321f] block mb-1">Launch URL</label>
                <input
                  type="text"
                  required
                  value={formLaunchUrl}
                  onChange={(e) => setFormLaunchUrl(e.target.value)}
                  placeholder="https://... or #ask-ai"
                  className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#8c7054]/20 mt-1">
                {editingApp ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteApp(editingApp.id)}
                    className="px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 font-bold transition-colors cursor-pointer"
                  >
                    Delete App
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleResetToDefaults}
                    className="px-3 py-1.5 rounded-xl bg-amber-200/50 hover:bg-amber-200 text-amber-900 font-bold transition-colors cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsAdminOpen(false)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#8c7054]/30 font-bold text-[#4a321f] hover:bg-amber-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                  >
                    Save App
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
