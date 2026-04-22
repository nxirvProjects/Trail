import { Briefcase, CalendarDays, CheckSquare, ClipboardList, ListTodo, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';

interface WidgetType {
  id: string;
  name: string;
  description: string;
  size: 'Small' | 'Medium' | 'Large';
  icon: React.ReactNode;
}

const WIDGETS: WidgetType[] = [
  {
    id: 'applications-sent',
    name: 'Applications Sent',
    description: 'Total count of jobs you have applied to.',
    size: 'Small',
    icon: <Briefcase className="h-5 w-5 text-indigo-500" />,
  },
  {
    id: 'tasks-today',
    name: 'Tasks Today',
    description: 'Number of roadmap tasks due today.',
    size: 'Small',
    icon: <CheckSquare className="h-5 w-5 text-sky-500" />,
  },
  {
    id: 'interviews',
    name: 'Interviews',
    description: 'Upcoming interviews from your pipeline.',
    size: 'Small',
    icon: <CalendarDays className="h-5 w-5 text-violet-500" />,
  },
  {
    id: 'daily-objectives',
    name: 'Daily Objectives',
    description: 'A checklist of your active roadmap tasks.',
    size: 'Medium',
    icon: <ListTodo className="h-5 w-5 text-amber-500" />,
  },
  {
    id: 'recent-applications',
    name: 'Recent Applications',
    description: 'The latest jobs you have logged.',
    size: 'Medium',
    icon: <ClipboardList className="h-5 w-5 text-rose-500" />,
  },
  {
    id: 'weekly-progress',
    name: 'Weekly Progress',
    description: 'A chart of your applications over the past week.',
    size: 'Large',
    icon: <TrendingUp className="h-5 w-5 text-emerald-500" />,
  },
];

const SIZE_STYLES: Record<WidgetType['size'], string> = {
  Small: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  Medium: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
  Large: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

interface WidgetPickerModalProps {
  open: boolean;
  onClose: () => void;
}

export function WidgetPickerModal({ open, onClose }: WidgetPickerModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a widget</DialogTitle>
          <DialogDescription>Choose a widget to pin to your dashboard.</DialogDescription>
        </DialogHeader>

        <div className="p-6 grid grid-cols-3 gap-3">
          {WIDGETS.map((widget) => (
            <button
              key={widget.id}
              type="button"
              onClick={onClose}
              className="group flex flex-col gap-3 rounded-xl border border-[var(--app-border)] p-4 text-left hover:border-indigo-400 hover:bg-[var(--app-hover)] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-[var(--app-hover)] p-2 group-hover:bg-[var(--app-surface-elevated)] transition-colors">
                  {widget.icon}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SIZE_STYLES[widget.size]}`}>
                  {widget.size}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold app-text">{widget.name}</p>
                <p className="text-xs app-subtle mt-0.5 leading-relaxed">{widget.description}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
