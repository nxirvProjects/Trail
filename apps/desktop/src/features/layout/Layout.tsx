import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import {
  BarChart3,
  Briefcase,
  ListTodo,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
}

export type AppSection = 'applications' | 'todos' | 'stats';

type ThemeMode = 'light' | 'dark' | 'auto';
type BackgroundThemeKey =
  | 'default'
  | 'linen-light'
  | 'mint-grid'
  | 'sky-dots'
  | 'midnight-mesh'
  | 'forest-noise'
  | 'ember-haze';

const BACKGROUND_MODE_STORAGE_KEY = 'trail.themeMode';
const BACKGROUND_THEME_STORAGE_KEY = 'trail.backgroundTheme';

const sections: { id: AppSection; label: string; icon: ReactNode }[] = [
  { id: 'applications', label: 'Applications', icon: <Briefcase className="h-4 w-4" /> },
  { id: 'todos', label: 'To/Dos', icon: <ListTodo className="h-4 w-4" /> },
  { id: 'stats', label: 'Overall Stats', icon: <BarChart3 className="h-4 w-4" /> },
];

const backgroundOptions: Array<{
  key: BackgroundThemeKey;
  label: string;
  mode: Exclude<ThemeMode, 'auto'>;
  className: string;
}> = [
  { key: 'default', label: 'Default', mode: 'light', className: 'shell-theme-default' },
  { key: 'linen-light', label: 'Linen Light', mode: 'light', className: 'shell-theme-linen-light' },
  { key: 'mint-grid', label: 'Mint Grid', mode: 'light', className: 'shell-theme-mint-grid' },
  { key: 'sky-dots', label: 'Sky Dots', mode: 'light', className: 'shell-theme-sky-dots' },
  { key: 'midnight-mesh', label: 'Midnight Mesh', mode: 'dark', className: 'shell-theme-midnight-mesh' },
  { key: 'forest-noise', label: 'Forest Noise', mode: 'dark', className: 'shell-theme-forest-noise' },
  { key: 'ember-haze', label: 'Ember Haze', mode: 'dark', className: 'shell-theme-ember-haze' },
];

export function Layout({ children, activeSection, onSectionChange }: LayoutProps) {
  const { user, signOut } = useAuth();
  const email = user?.email ?? '';
  const initials = email ? email[0]?.toUpperCase() ?? 'U' : 'U';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(BACKGROUND_MODE_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'light';
  });
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundThemeKey>(() => {
    const stored = localStorage.getItem(BACKGROUND_THEME_STORAGE_KEY);
    return backgroundOptions.some((option) => option.key === stored)
      ? (stored as BackgroundThemeKey)
      : 'default';
  });
  const [systemIsDark, setSystemIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  const resolvedMode: Exclude<ThemeMode, 'auto'> =
    themeMode === 'auto' ? (systemIsDark ? 'dark' : 'light') : themeMode;

  const availableBackgrounds = useMemo(
    () => backgroundOptions.filter((option) => option.mode === resolvedMode),
    [resolvedMode]
  );

  const activeThemeOption =
    backgroundOptions.find((option) => option.key === backgroundTheme) ?? backgroundOptions[0];

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => {
      setSystemIsDark(event.matches);
    };

    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem(BACKGROUND_MODE_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(BACKGROUND_THEME_STORAGE_KEY, backgroundTheme);
  }, [backgroundTheme]);

  useEffect(() => {
    const current = backgroundOptions.find((option) => option.key === backgroundTheme);
    if (!current || current.mode === resolvedMode) return;

    const fallback = backgroundOptions.find((option) => option.mode === resolvedMode);
    if (fallback) setBackgroundTheme(fallback.key);
  }, [backgroundTheme, resolvedMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-shell-mode', resolvedMode);
  }, [resolvedMode]);

  return (
    <div className={`flex h-screen app-shell ${activeThemeOption.className}`}>
      <aside
        className={`app-surface border-r transition-all duration-200 ${sidebarCollapsed ? 'w-16' : 'w-60'}`}
      >
        <div className="h-14 px-4 flex items-center border-b border-[var(--app-border)]">
          {sidebarCollapsed ? (
            <span className="text-base font-bold text-indigo-600">T</span>
          ) : (
            <h1 className="text-lg font-bold text-indigo-600">Trail</h1>
          )}
        </div>
        <nav className="p-2 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                activeSection === section.id
                  ? 'bg-[var(--app-hover)] text-[var(--app-text)]'
                  : 'text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-text)]'
              } ${sidebarCollapsed ? 'justify-center' : ''}`}
              title={sidebarCollapsed ? section.label : undefined}
            >
              {section.icon}
              {!sidebarCollapsed && <span>{section.label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 app-surface flex items-center justify-between px-6 border-b shrink-0">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--app-subtle)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover)]"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Account menu"
              >
                <Avatar>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{email || 'Signed in'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={signOut}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-6 overflow-hidden flex flex-col">{children}</main>
      </div>

      {settingsOpen && (
        <div
          className="app-overlay fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="app-surface-elevated rounded-xl border shadow-2xl w-full max-w-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--app-border)]">
              <h2 className="text-lg font-semibold app-text">Settings</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-xl leading-none app-subtle hover:text-[var(--app-text)]"
                aria-label="Close settings"
              >
                &times;
              </button>
            </div>
            <div className="p-4 min-h-[240px] space-y-5">
              <div>
                <p className="text-sm font-medium app-text mb-2">Mode</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      themeMode === 'light'
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[var(--app-hover)]'
                    }`}
                  >
                    <Sun className="h-4 w-4" /> Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      themeMode === 'dark'
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[var(--app-hover)]'
                    }`}
                  >
                    <Moon className="h-4 w-4" /> Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => setThemeMode('auto')}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      themeMode === 'auto'
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[var(--app-hover)]'
                    }`}
                  >
                    <Monitor className="h-4 w-4" /> Auto
                  </button>
                </div>
                <p className="mt-2 text-xs app-subtle">
                  {themeMode === 'auto'
                    ? `Using ${resolvedMode} mode based on your system.`
                    : `Using ${resolvedMode} mode.`}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium app-text mb-2">Background</p>
                <div className="grid grid-cols-2 gap-2">
                  {availableBackgrounds.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setBackgroundTheme(option.key)}
                      className={`rounded-lg border p-2 text-left transition-colors ${
                        backgroundTheme === option.key
                          ? 'border-indigo-300 ring-1 ring-indigo-200'
                          : 'border-[var(--app-border)] hover:bg-[var(--app-hover)]'
                      }`}
                    >
                      <div className={`h-14 w-full rounded-md border border-black/10 ${option.className}`} />
                      <p className="mt-2 text-xs font-medium app-muted">{option.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
