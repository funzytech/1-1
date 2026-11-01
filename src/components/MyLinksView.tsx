import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';

export interface UserLinkItem {
  id: string;
  title: string;
  url: string;
  description: string;
  category: 'Dev & Code' | 'AI & ML' | 'Design' | 'Articles' | 'Tools';
  createdAt: string;
}

interface MyLinksViewProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSignIn?: () => void;
}

const DEFAULT_SAMPLE_LINKS: UserLinkItem[] = [
  {
    id: 'link-1',
    title: 'Google AI Studio Developer Docs',
    url: 'https://ai.google.dev',
    description: 'Official API documentation, Gemini 2.5 Flash reference guides, prompt engineering guides and quickstarts.',
    category: 'AI & ML',
    createdAt: '2026-03-01',
  },
  {
    id: 'link-2',
    title: 'React 19 Official Documentation',
    url: 'https://react.dev',
    description: 'Actions, useActionState, Server Components, and the modern React compiler reference.',
    category: 'Dev & Code',
    createdAt: '2026-03-02',
  },
  {
    id: 'link-3',
    title: 'Tailwind CSS v4 Documentation',
    url: 'https://tailwindcss.com',
    description: 'Next-gen CSS framework with dynamic theme tokens, CSS-first configuration, and instant builds.',
    category: 'Design',
    createdAt: '2026-03-05',
  },
  {
    id: 'link-4',
    title: 'MDN Web Docs (JavaScript & Web APIs)',
    url: 'https://developer.mozilla.org',
    description: 'Comprehensive web standards reference for DOM, Web Speech API, Streams, and modern browser standards.',
    category: 'Dev & Code',
    createdAt: '2026-03-08',
  },
  {
    id: 'link-5',
    title: 'Figma Web Design & Prototyping',
    url: 'https://figma.com',
    description: 'Collaborative interface design tool for UX wireframing, component design systems, and vector UI assets.',
    category: 'Design',
    createdAt: '2026-03-10',
  },
  {
    id: 'link-6',
    title: 'Hugging Face Open Source Models',
    url: 'https://huggingface.co',
    description: 'The platform where the machine learning community collaborates on models, datasets, and applications.',
    category: 'AI & ML',
    createdAt: '2026-03-12',
  },
];

export const MyLinksView: React.FC<MyLinksViewProps> = ({ isOpen, onClose, onOpenSignIn }) => {
  const { user, isAuthenticated } = useAuth();

  const [links, setLinks] = useState<UserLinkItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingLink, setEditingLink] = useState<UserLinkItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('https://');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<UserLinkItem['category']>('Dev & Code');

  // Load links from storage
  useEffect(() => {
    try {
      const storageKey = isAuthenticated && user ? `funzy_links_${user.uid}` : 'funzy_links_guest';
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLinks(parsed);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load links:', e);
    }
    setLinks(DEFAULT_SAMPLE_LINKS);
  }, [isAuthenticated, user?.uid]);

  const saveLinks = (updated: UserLinkItem[]) => {
    setLinks(updated);
    try {
      const storageKey = isAuthenticated && user ? `funzy_links_${user.uid}` : 'funzy_links_guest';
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save links:', e);
    }
  };

  const handleOpenAdd = () => {
    setEditingLink(null);
    setFormTitle('');
    setFormUrl('https://');
    setFormDesc('');
    setFormCategory('Dev & Code');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (link: UserLinkItem) => {
    setEditingLink(link);
    setFormTitle(link.title);
    setFormUrl(link.url);
    setFormDesc(link.description);
    setFormCategory(link.category);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this bookmark?')) {
      const updated = links.filter((l) => l.id !== id);
      saveLinks(updated);
    }
  };

  const handleCopyUrl = (link: UserLinkItem) => {
    navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formUrl.trim()) return;

    let validatedUrl = formUrl.trim();
    if (!/^https?:\/\//i.test(validatedUrl)) {
      validatedUrl = `https://${validatedUrl}`;
    }

    if (editingLink) {
      const updated = links.map((l) =>
        l.id === editingLink.id
          ? {
              ...l,
              title: formTitle.trim(),
              url: validatedUrl,
              description: formDesc.trim(),
              category: formCategory,
            }
          : l
      );
      saveLinks(updated);
    } else {
      const newLink: UserLinkItem = {
        id: `link_${Date.now()}`,
        title: formTitle.trim(),
        url: validatedUrl,
        description: formDesc.trim(),
        category: formCategory,
        createdAt: new Date().toISOString().split('T')[0],
      };
      saveLinks([newLink, ...links]);
    }

    setIsModalOpen(false);
  };

  const filteredLinks = links.filter((l) => {
    const matchesCategory = selectedCategory === 'All' || l.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['All', 'Dev & Code', 'AI & ML', 'Design', 'Articles', 'Tools'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#eadecf] text-[#261508] font-['Outfit',sans-serif] animate-fade-in overflow-hidden select-none">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#f8f3ec] via-[#f2e6d6] to-[#e6d4bd] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-white/70 backdrop-blur-xl border-b border-[#8c7054]/25 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-800 text-white shadow-sm font-bold text-base">
            🔗
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-[#261508]">
                My Links
              </h1>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
                Funzy Tech
              </span>
            </div>
            <p className="text-[10.5px] text-[#7d644d] font-medium leading-tight">
              Personal bookmark & developer resource manager with quick search & sync
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Link Button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
            title="Bookmark a new link"
          >
            <span>+</span>
            <span>Add Link</span>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-black/10 hover:bg-black/15 text-[#3b2716] border border-black/10 transition-all active:scale-95 cursor-pointer ml-1"
            title="Close My Links"
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
            placeholder="Search saved bookmarks..."
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

      {/* Main Links Feed */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-5xl mx-auto">
          {filteredLinks.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🔖</div>
              <h3 className="text-lg font-bold text-[#261508]">No links saved in this view</h3>
              <p className="text-xs text-[#73593f] mt-1">Add your favorite links or adjust your search query.</p>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 shadow-2xs cursor-pointer"
              >
                + Add First Bookmark
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLinks.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex flex-col rounded-2xl bg-white/80 backdrop-blur-md border border-white/90 shadow-sm hover:shadow-md transition-all duration-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 border border-amber-300 text-amber-900 font-black text-xs shrink-0">
                        🔗
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-sm text-[#261508] tracking-tight truncate group-hover:text-amber-800 transition-colors">
                          {item.title}
                        </h3>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-amber-800 hover:underline truncate block max-w-xs font-mono font-medium"
                        >
                          {item.url.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 text-[#543b27] shrink-0">
                      {item.category}
                    </span>
                  </div>

                  {item.description && (
                    <p className="text-xs text-[#6e553f] line-clamp-2 leading-relaxed mb-3 flex-1">
                      {item.description}
                    </p>
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-[#8c7054]/15 mt-auto text-xs">
                    <span className="text-[10px] text-[#8c7054]">
                      Saved {item.createdAt}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* Copy Link */}
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item)}
                        className="p-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-[#543b27] transition-colors cursor-pointer"
                        title="Copy URL"
                      >
                        {copiedId === item.id ? (
                          <span className="text-emerald-700 font-bold text-[10px] px-1">✓ Copied</span>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                          </svg>
                        )}
                      </button>

                      {/* Edit Link */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-[#543b27] transition-colors cursor-pointer"
                        title="Edit bookmark"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>

                      {/* Delete Link */}
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg bg-black/5 hover:bg-red-50 text-[#543b27] hover:text-red-700 transition-colors cursor-pointer"
                        title="Delete bookmark"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>

                      {/* Open Link */}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#261508] hover:bg-[#3d2512] text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer ml-1"
                      >
                        <span>Open</span>
                        <span>↗</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Bookmark Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-[#f7f0e5] border-2 border-white/90 shadow-2xl p-5 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#8c7054]/20 mb-4">
              <h2 className="font-black text-base sm:text-lg text-[#261508]">
                {editingLink ? 'Edit Saved Bookmark' : 'Add New Bookmark'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-black/10 text-[#573e2a] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-[#4a321f] block mb-1">Bookmark Title</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Next.js Documentation"
                  className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-[#4a321f] block mb-1">Destination URL</label>
                <input
                  type="text"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-[#4a321f] block mb-1">Category</label>
                <select
                  value={formCategory}
                  onChange={(e: any) => setFormCategory(e.target.value)}
                  className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none"
                >
                  <option value="Dev & Code">Dev & Code</option>
                  <option value="AI & ML">AI & ML</option>
                  <option value="Design">Design</option>
                  <option value="Articles">Articles</option>
                  <option value="Tools">Tools</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#4a321f] block mb-1">Notes / Description (Optional)</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Quick summary or reminder about this link..."
                  className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#8c7054]/20 mt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#8c7054]/30 font-bold text-[#4a321f] hover:bg-amber-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                >
                  Save Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
