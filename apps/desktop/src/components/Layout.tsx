import { useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BarChart3, Briefcase, ListTodo, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
}

export type AppSection = 'applications' | 'todos' | 'stats';

const sections: { id: AppSection; label: string; icon: ReactNode }[] = [
  { id: 'applications', label: 'Applications', icon: <Briefcase className="h-4 w-4" /> },
  { id: 'todos', label: 'To/Dos', icon: <ListTodo className="h-4 w-4" /> },
  { id: 'stats', label: 'Overall Stats', icon: <BarChart3 className="h-4 w-4" /> },
];

export function Layout({ children, activeSection, onSectionChange }: LayoutProps) {
  const { user, signOut } = useAuth();
  const email = user?.email ?? '';
  const initials = email ? email[0]?.toUpperCase() ?? 'U' : 'U';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100">
      <aside
        className={`bg-white border-r border-gray-200 transition-all duration-200 ${sidebarCollapsed ? 'w-16' : 'w-60'}`}
      >
        <div className="h-14 px-4 flex items-center border-b border-gray-200">
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
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
        <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-gray-200 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close settings"
              >
                &times;
              </button>
            </div>
            <div className="p-4 min-h-[240px] text-sm text-gray-400">
              Settings content coming soon.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
