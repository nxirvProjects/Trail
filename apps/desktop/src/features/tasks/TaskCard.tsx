import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@job-logger/shared';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  isDragOverlay?: boolean;
  isCompletedColumn?: boolean;
}

export function TaskCard({ task, onClick, isDragOverlay, isCompletedColumn = false }: TaskCardProps) {
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
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      onClick={() => onClick(task)}
      className={`app-surface-elevated rounded-lg border p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow text-sm ${
        isCompletedColumn ? 'opacity-80' : ''
      } ${
        isDragOverlay ? 'shadow-lg ring-2 ring-indigo-400' : ''
      }`}
    >
      <p className={`font-medium leading-snug ${isCompletedColumn ? 'app-subtle line-through' : 'app-text'}`}>
        {task.title}
      </p>
      {task.notes && <p className="app-subtle text-xs mt-1 truncate">{task.notes}</p>}
    </div>
  );
}
