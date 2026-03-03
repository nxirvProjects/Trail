import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@job-logger/shared';
import { Trash2 } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  isDragOverlay?: boolean;
  isCompletedColumn?: boolean;
}

export function TaskCard({ task, onClick, onDelete, isDragOverlay, isCompletedColumn = false }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      data-task-card="true"
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      onClick={() => onClick(task)}
      className={`group relative app-surface-elevated rounded-lg border p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow text-sm ${
        isCompletedColumn ? 'opacity-80' : ''
      } ${
        isDragOverlay ? 'shadow-lg ring-2 ring-indigo-400' : ''
      }`}
    >
      {!isDragOverlay && onDelete && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(task.id);
          }}
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 app-subtle hover:text-red-400 transition-opacity"
          aria-label="Delete task"
          title="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      <p className={`font-medium leading-snug ${isCompletedColumn ? 'app-subtle line-through' : 'app-text'}`}>
        {task.title}
      </p>
      {task.notes && <p className="app-subtle text-xs mt-1 truncate">{task.notes}</p>}
    </div>
  );
}
