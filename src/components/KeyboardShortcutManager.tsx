import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface ShortcutItem {
  id: string;
  name: string;
  description: string;
  key: string; // Lowercase key e.g. 'a', 'd', 'm', 'h', '/'
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  defaultLabel: string;
}

export const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  {
    id: 'about',
    name: 'About Us',
    description: 'Open About Funzy Tech founder and vision modal',
    key: 'a',
    altKey: true,
    ctrlKey: false,
    shiftKey: false,
    defaultLabel: 'Alt + A',
  },
  {
    id: 'donate',
    name: 'Donate Now',
    description: 'Open Support Us / Donation payment modal',
    key: 'd',
    altKey: true,
    ctrlKey: false,
    shiftKey: false,
    defaultLabel: 'Alt + D',
  },
  {
    id: 'contact',
    name: 'Send Message',
    description: 'Open Business Inquiry & Contact modal',
    key: 'm',
    altKey: true,
    ctrlKey: false,
    shiftKey: false,
    defaultLabel: 'Alt + M',
  },
  {
    id: 'menu',
    name: 'Toggle Menu',
    description: 'Open or close the Liquid Glass main menu',
    key: 'h',
    altKey: true,
    ctrlKey: false,
    shiftKey: false,
    defaultLabel: 'Alt + H',
  },
  {
    id: 'qr',
    name: 'Referral QR Code',
    description: 'Open your personal 10% referral discount QR card',
    key: 'q',
    altKey: true,
    ctrlKey: false,
    shiftKey: false,
    defaultLabel: 'Alt + Q',
  },
  {
    id: 'shortcuts',
    name: 'Shortcut Manager',
    description: 'Open this custom shortcut settings manager',
    key: '/',
    altKey: true,
    ctrlKey: false,
    shiftKey: false,
    defaultLabel: 'Alt + /',
  },
];

const STORAGE_KEY = 'funzy_tech_custom_shortcuts_v1';

export function getStoredShortcuts(): ShortcutItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SHORTCUTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return DEFAULT_SHORTCUTS.map((def) => {
        const found = parsed.find((p: any) => p.id === def.id);
        return found ? { ...def, ...found } : def;
      });
    }
  } catch {
    // fallback
  }
  return DEFAULT_SHORTCUTS;
}

export function saveStoredShortcuts(shortcuts: ShortcutItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
  } catch {
    // fallback
  }
}

export function formatShortcutLabel(item: ShortcutItem): string {
  const parts: string[] = [];
  if (item.ctrlKey) parts.push('Ctrl');
  if (item.altKey) parts.push('Alt');
  if (item.shiftKey) parts.push('Shift');
  parts.push(item.key.toUpperCase());
  return parts.join(' + ');
}

interface KeyboardShortcutManagerModalProps {
  isOpen: boolean;
  isClosing: boolean;
  onClose: () => void;
  onTriggerAction: (actionId: string) => void;
  shortcuts: ShortcutItem[];
  onUpdateShortcuts: (updated: ShortcutItem[]) => void;
  onResetDefaults: () => void;
}

export const KeyboardShortcutManagerModal: React.FC<KeyboardShortcutManagerModalProps> = ({
  isOpen,
  isClosing,
  onClose,
  onTriggerAction,
  shortcuts,
  onUpdateShortcuts,
  onResetDefaults,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [captureStatus, setCaptureStatus] = useState<string>('');

  useEffect(() => {
    if (!editingId) return;

    const handleCaptureKeyDown = (e: KeyboardEvent) => {
      // Ignore solitary modifier presses
      if (['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      const key = e.key.toLowerCase();
      const updated = shortcuts.map((s) => {
        if (s.id === editingId) {
          return {
            ...s,
            key,
            altKey: e.altKey,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
          };
        }
        return s;
      });

      onUpdateShortcuts(updated);
      setEditingId(null);
      setCaptureStatus('Shortcut updated successfully!');
      setTimeout(() => setCaptureStatus(''), 2000);
    };

    window.addEventListener('keydown', handleCaptureKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleCaptureKeyDown, { capture: true });
  }, [editingId, shortcuts, onUpdateShortcuts]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md ${
        isClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`liquid-glass-menu relative w-full max-w-[480px] rounded-[28px] p-5 sm:p-6 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] overflow-hidden flex flex-col gap-3.5 max-h-[90vh] ${
          isClosing ? 'animate-contact-modal-close' : 'animate-contact-modal'
        }`}
      >
        <div className="glass-glow-rim" aria-hidden="true" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#a68d6a]/25 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100/90 border border-white/90 shadow-xs text-[#4a321f]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
              </svg>
            </div>
            <div>
              <h3 id="shortcuts-modal-title" className="font-['Outfit',sans-serif] font-black text-lg text-[#261508] leading-tight">
                Keyboard Shortcuts
              </h3>
              <p className="text-[11px] text-[#7d644d] font-medium">
                Customize hotkeys to instantly trigger features
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] h-11 w-11 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-90 active:ring-2 active:ring-amber-400/40"
            aria-label="Close shortcuts dialog"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Status notice */}
        {captureStatus && (
          <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 rounded-xl px-3 py-1.5 text-center shadow-2xs">
            {captureStatus}
          </div>
        )}

        {editingId && (
          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-center animate-pulse flex flex-col gap-1">
            <span className="text-xs font-black text-[#3d2714]">
              Press your desired key combination now...
            </span>
            <span className="text-[10.5px] text-[#705235]">
              (e.g., Hold Alt / Shift / Ctrl and press a letter, or press a single key)
            </span>
          </div>
        )}

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto pr-1 py-1 flex flex-col gap-2 scrollbar-none">
          {shortcuts.map((item) => {
            const isEditingThis = editingId === item.id;
            const currentLabel = formatShortcutLabel(item);

            return (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/85 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-['Outfit',sans-serif] font-bold text-xs sm:text-[13px] text-[#261508]">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#7d644d] truncate">
                    {item.description}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingThis) {
                        setEditingId(null);
                      } else {
                        setEditingId(item.id);
                      }
                    }}
                    className={`min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold tracking-wider transition-all cursor-pointer shadow-2xs flex items-center gap-1 active:scale-95 ${
                      isEditingThis
                        ? 'bg-amber-400 text-black ring-2 ring-amber-600/50'
                        : 'bg-white/90 hover:bg-white text-[#2c1708] border border-[#a68d6a]/30'
                    }`}
                    title="Click to customize this key combination"
                  >
                    <span>{isEditingThis ? 'Press keys...' : currentLabel}</span>
                    <span className="text-[9px] text-[#7d644d] font-sans font-medium uppercase ml-0.5">
                      {isEditingThis ? '✕' : 'Edit'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onTriggerAction(item.id);
                    }}
                    className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl bg-[#2c1708] hover:bg-black text-white text-[11px] font-bold transition-all cursor-pointer shadow-2xs active:scale-90 flex items-center justify-center"
                    title={`Trigger ${item.name}`}
                  >
                    Run
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-[#a68d6a]/20 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onResetDefaults}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-white/70 hover:bg-white text-[#5c3e21] text-xs font-bold border border-white/90 shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#2c1708] hover:bg-black text-white text-xs font-bold shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
