import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';

export interface TechProduct {
  id: string;
  title: string;
  description: string;
  category: 'Hardware' | 'Audio & Desk' | 'Mobile & Power' | 'Creator Gear';
  price: string;
  imageUrl: string;
  redirectUrl: string;
  rating?: number;
  featured?: boolean;
}

interface TechStoreViewProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SAMPLE_PRODUCTS: TechProduct[] = [
  {
    id: 'prod-1',
    title: 'Custom Pro Mechanical Keyboard (Gasket Mount)',
    description: 'Precision CNC aluminum chassis, pre-lubed switches, hot-swappable PCB, and PBT keycaps with custom sound dampening.',
    category: 'Hardware',
    price: '$149.00',
    imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80',
    redirectUrl: 'https://amazon.com',
    rating: 4.9,
    featured: true,
  },
  {
    id: 'prod-2',
    title: 'Studio Hi-Fi Wireless ANC Headphones',
    description: 'Planar magnetic drivers, 48-hour battery endurance, lossless low-latency audio transmission, and memory-foam ear cushions.',
    category: 'Audio & Desk',
    price: '$219.00',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    redirectUrl: 'https://amazon.com',
    rating: 4.8,
    featured: true,
  },
  {
    id: 'prod-3',
    title: '34" Curved UltraWide 4K Studio Display',
    description: '144Hz refresh rate, 99% DCI-P3 color gamut, integrated 90W USB-C power delivery hub, and anti-glare nano-texture coating.',
    category: 'Hardware',
    price: '$589.00',
    imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80',
    redirectUrl: 'https://amazon.com',
    rating: 4.9,
  },
  {
    id: 'prod-4',
    title: 'Anodized Ergonomic Aluminum Laptop Stand',
    description: 'Dual-axis stepless tilt adjustment, heat-dissipating aerospace grade alloy, and silicone protective grips.',
    category: 'Audio & Desk',
    price: '$45.00',
    imageUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80',
    redirectUrl: 'https://amazon.com',
    rating: 4.7,
  },
  {
    id: 'prod-5',
    title: '140W Multi-Port GaN V Fast Charger',
    description: 'Triple USB-C + USB-A intelligent power allocation. Charges laptops, tablets, and phones simultaneously with temperature monitoring.',
    category: 'Mobile & Power',
    price: '$65.00',
    imageUrl: 'https://images.unsplash.com/photo-1622445262464-84b14e0745b1?auto=format&fit=crop&w=800&q=80',
    redirectUrl: 'https://amazon.com',
    rating: 4.9,
  },
  {
    id: 'prod-6',
    title: 'Solid Walnut & Aluminum 3-in-1 Charging Dock',
    description: 'Dedicated MagSafe magnetic floating phone charger, Qi watch dock, and AirPods wireless induction pad in handcrafted solid walnut.',
    category: 'Mobile & Power',
    price: '$89.00',
    imageUrl: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&w=800&q=80',
    redirectUrl: 'https://amazon.com',
    rating: 4.8,
  },
  {
    id: 'prod-7',
    title: 'Precision Ergonomic Wireless Mouse 8K DPI',
    description: 'Ergonomic sculptured thumb rest, dual wireless modes, magnetic infinite scroll wheel, and whisper-quiet tactile switches.',
    category: 'Hardware',
    price: '$89.00',
    imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
    redirectUrl: 'https://amazon.com',
    rating: 4.8,
  },
  {
    id: 'prod-8',
    title: 'Studio Broadcast USB-C Condenser Mic & Arm',
    description: '24-bit/192kHz sampling rate, integrated pop filter, zero-latency headphone monitoring jack, and heavy-duty desktop boom arm.',
    category: 'Creator Gear',
    price: '$129.00',
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
    redirectUrl: 'https://amazon.com',
    rating: 4.9,
  },
];

export const TechStoreView: React.FC<TechStoreViewProps> = ({ isOpen, onClose }) => {
  const { isAuthenticated, userProfile } = useAuth();

  const [products, setProducts] = useState<TechProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<TechProduct | null>(null);

  // Form states for Admin drawer
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<TechProduct['category']>('Hardware');
  const [formPrice, setFormPrice] = useState('$99.00');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formRedirectUrl, setFormRedirectUrl] = useState('https://');

  // Load products from localStorage or seed with defaults
  useEffect(() => {
    try {
      const saved = localStorage.getItem('funzy_tech_store_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load store products:', e);
    }
    setProducts(DEFAULT_SAMPLE_PRODUCTS);
    localStorage.setItem('funzy_tech_store_products', JSON.stringify(DEFAULT_SAMPLE_PRODUCTS));
  }, []);

  const saveProducts = (updated: TechProduct[]) => {
    setProducts(updated);
    try {
      localStorage.setItem('funzy_tech_store_products', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save store products:', e);
    }
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormTitle('');
    setFormDesc('');
    setFormCategory('Hardware');
    setFormPrice('$99.00');
    setFormImageUrl('https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80');
    setFormRedirectUrl('https://');
    setIsAdminOpen(true);
  };

  const handleOpenEdit = (p: TechProduct) => {
    setEditingProduct(p);
    setFormTitle(p.title);
    setFormDesc(p.description);
    setFormCategory(p.category);
    setFormPrice(p.price);
    setFormImageUrl(p.imageUrl);
    setFormRedirectUrl(p.redirectUrl);
    setIsAdminOpen(true);
  };

  const handleDeleteProduct = (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      const updated = products.filter((p) => p.id !== id);
      saveProducts(updated);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingProduct) {
      const updated = products.map((p) =>
        p.id === editingProduct.id
          ? {
              ...p,
              title: formTitle.trim(),
              description: formDesc.trim(),
              category: formCategory,
              price: formPrice.trim(),
              imageUrl: formImageUrl.trim(),
              redirectUrl: formRedirectUrl.trim(),
            }
          : p
      );
      saveProducts(updated);
    } else {
      const newProduct: TechProduct = {
        id: `prod_${Date.now()}`,
        title: formTitle.trim(),
        description: formDesc.trim(),
        category: formCategory,
        price: formPrice.trim(),
        imageUrl: formImageUrl.trim() || 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80',
        redirectUrl: formRedirectUrl.trim() || 'https://',
        rating: 5.0,
      };
      saveProducts([newProduct, ...products]);
    }

    setIsAdminOpen(false);
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset all products back to curated sample tech items?')) {
      saveProducts(DEFAULT_SAMPLE_PRODUCTS);
      setIsAdminOpen(false);
    }
  };

  // Filter & Search Logic
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Sorting
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-asc') {
      const pA = parseFloat(a.price.replace(/[^0-9.]/g, '')) || 0;
      const pB = parseFloat(b.price.replace(/[^0-9.]/g, '')) || 0;
      return pA - pB;
    }
    if (sortBy === 'price-desc') {
      const pA = parseFloat(a.price.replace(/[^0-9.]/g, '')) || 0;
      const pB = parseFloat(b.price.replace(/[^0-9.]/g, '')) || 0;
      return pB - pA;
    }
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  });

  const categories = ['All', 'Hardware', 'Audio & Desk', 'Mobile & Power', 'Creator Gear'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#eadecf] text-[#261508] font-['Outfit',sans-serif] animate-fade-in overflow-hidden select-none">
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#f8f3ec] via-[#f2e6d6] to-[#e6d4bd] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-white/70 backdrop-blur-xl border-b border-[#8c7054]/25 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm font-bold text-base">
            🛍️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-[#261508]">
                Tech Store
              </h1>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
                Funzy Tech
              </span>
            </div>
            <p className="text-[10.5px] text-[#7d644d] font-medium leading-tight">
              Curated hardware, setup accessories & verified affiliate gear
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Admin Management Button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100/90 hover:bg-amber-200 text-[#4a321f] text-xs font-bold border border-amber-300 shadow-2xs transition-all cursor-pointer active:scale-95"
            title="Manage store items"
          >
            <span>⚙️</span>
            <span>Manage Products</span>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-black/10 hover:bg-black/15 text-[#3b2716] border border-black/10 transition-all active:scale-95 cursor-pointer ml-1"
            title="Close Tech Store"
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

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search gadgets, gear..."
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

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="text-xs font-semibold text-[#4a321f] bg-white/80 border border-[#8c7054]/30 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="featured">Featured First</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Products Grid Content Area */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {sortedProducts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-lg font-bold text-[#261508]">No tech gear found</h3>
              <p className="text-xs text-[#73593f] mt-1">Try adjusting your search terms or category filter.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-1.5 rounded-xl bg-white border border-[#8c7054]/30 text-xs font-bold text-[#4a321f] hover:bg-amber-50 cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {sortedProducts.map((product) => (
                <div
                  key={product.id}
                  className="group relative flex flex-col rounded-2xl bg-white/75 backdrop-blur-md border border-white/90 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                >
                  {/* Product Image Banner */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-amber-50/50">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-[#3d2714] backdrop-blur-xs shadow-2xs border border-white">
                        {product.category}
                      </span>
                      {product.featured && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-2xs">
                          Featured
                        </span>
                      )}
                    </div>

                    {/* Admin quick edit button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(product)}
                      className="opacity-0 group-hover:opacity-100 absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-opacity shadow-xs cursor-pointer"
                      title="Edit product"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                  </div>

                  {/* Product Information */}
                  <div className="flex flex-col flex-1 p-4">
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <h3 className="font-extrabold text-sm sm:text-[14.5px] text-[#261508] tracking-tight line-clamp-1 group-hover:text-amber-800 transition-colors">
                        {product.title}
                      </h3>
                    </div>

                    <p className="text-xs text-[#6e553f] line-clamp-2 leading-relaxed mb-3 flex-1">
                      {product.description}
                    </p>

                    {/* Pricing & Outbound Affiliate Link */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-[#8c7054]/15 mt-auto">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-[#8c7054] tracking-wider leading-none">
                          Price
                        </span>
                        <span className="font-extrabold text-base text-[#261508] mt-0.5">
                          {product.price}
                        </span>
                      </div>

                      <a
                        href={product.redirectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <span>Buy Now</span>
                        <span className="font-bold">→</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Admin Management Modal / Drawer */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-[#f7f0e5] border-2 border-white/90 shadow-2xl p-5 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#8c7054]/20 mb-4">
              <h2 className="font-black text-base sm:text-lg text-[#261508]">
                {editingProduct ? 'Edit Tech Product' : 'Add New Tech Product'}
              </h2>
              <button
                type="button"
                onClick={() => setIsAdminOpen(false)}
                className="p-1.5 rounded-xl hover:bg-black/10 text-[#573e2a] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-[#4a321f] block mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Mechanical Keyboard Pro"
                  className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-[#4a321f] block mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e: any) => setFormCategory(e.target.value)}
                    className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none"
                  >
                    <option value="Hardware">Hardware</option>
                    <option value="Audio & Desk">Audio & Desk</option>
                    <option value="Mobile & Power">Mobile & Power</option>
                    <option value="Creator Gear">Creator Gear</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#4a321f] block mb-1">Display Price</label>
                  <input
                    type="text"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="$149.00"
                    className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#4a321f] block mb-1">Short Description</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Specifications, features, design..."
                  className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="font-bold text-[#4a321f] block mb-1">Image URL</label>
                <input
                  type="url"
                  required
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-[#4a321f] block mb-1">Destination / Affiliate URL</label>
                <input
                  type="url"
                  required
                  value={formRedirectUrl}
                  onChange={(e) => setFormRedirectUrl(e.target.value)}
                  placeholder="https://amazon.com/..."
                  className="w-full bg-white border border-[#8c7054]/40 rounded-xl p-2.5 text-xs text-[#261508] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#8c7054]/20 mt-1">
                {editingProduct ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(editingProduct.id)}
                    className="px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 font-bold transition-colors cursor-pointer"
                  >
                    Delete Product
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
                    Save Product
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
