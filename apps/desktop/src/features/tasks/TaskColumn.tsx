import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskColumn as TaskColumnType } from '@job-logger/shared';
import { GripVertical } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { Button } from '@/shared/ui/button';

interface TaskColumnInnerProps {
  column: TaskColumnType;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (columnId: string, title: string) => void;
  onRename: (id: string, name: string) => void;
  onColumnTypeChange: (id: string, columnType: TaskColumnType['column_type']) => void;
  onDeleteTask: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TaskColumnInner({
  column,
  tasks,
  onTaskClick,
  onAddTask,
  onRename,
  onColumnTypeChange,
  onDeleteTask,
  onDelete,
}: TaskColumnInnerProps) {
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({ id: column.id });
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(column.name);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingTask) inputRef.current?.focus();
  }, [addingTask]);

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [contextMenu]);

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      onAddTask(column.id, newTaskTitle.trim());
      setNewTaskTitle('');
    }
    setAddingTask(false);
  };

  const handleRename = () => {
    if (nameValue.trim() && nameValue.trim() !== column.name) {
      onRename(column.id, nameValue.trim());
    } else {
      setNameValue(column.name);
    }
    setEditingName(false);
  };

  const containerClass = [
    'relative flex flex-col w-full h-full rounded-xl border border-[var(--app-border)] overflow-hidden',
    column.column_type === 'completed' ? 'opacity-95' : '',
    isOver ? 'bg-indigo-500/10 border-indigo-400/40' : '',
  ].join(' ');

  return (
    // Single root div — portal renders to document.body so it doesn't need
    // to be a sibling at this level. A real element here (not a fragment)
    // lets React Flow and dnd-kit find a stable drag/drop target.
    <div
      ref={setDroppableNodeRef}
      className={containerClass}
      style={{ backgroundColor: 'var(--app-column-surface)' }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
    >
      {/* Header — no nodrag, so React Flow drags the node from here */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--app-border)] cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span title="Drag to move" className="shrink-0 app-subtle">
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          {editingName ? (
            <input
              ref={nameRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') { setNameValue(column.name); setEditingName(false); }
              }}
              className="flex-1 text-sm font-semibold app-text bg-transparent border-b border-indigo-400 outline-none nodrag"
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <h3
              className="flex-1 text-sm font-semibold app-text truncate"
              onDoubleClick={() => setEditingName(true)}
              title="Double-click to rename"
            >
              {column.name}
            </h3>
          )}
        </div>
        <span className="text-xs app-subtle bg-[var(--app-hover)] rounded-full px-2 ml-2 shrink-0">
          {tasks.length}
        </span>
      </div>

      {/* Task list — nodrag so @dnd-kit handles pointer events here */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="nodrag flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              onDelete={onDeleteTask}
              isCompletedColumn={column.column_type === 'completed'}
            />
          ))}
        </div>
      </SortableContext>

      {/* Add task footer — hidden for Slash Out columns */}
      {column.column_type !== 'completed' && <div className="nodrag p-2 border-t border-[var(--app-border)]">
        {addingTask ? (
          <div className="flex flex-col gap-1.5">
            <input
              ref={inputRef}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask();
                if (e.key === 'Escape') { setAddingTask(false); setNewTaskTitle(''); }
              }}
              placeholder="Task title..."
              className="app-input w-full px-2 py-1.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              onPointerDown={(e) => e.stopPropagation()}
            />
            <div className="flex gap-1">
              <Button size="sm" onClick={handleAddTask} className="flex-1">Add</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingTask(false); setNewTaskTitle(''); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingTask(true)}
            className="w-full text-left text-xs app-subtle hover:text-[var(--app-text)] px-1 py-1"
          >
            + Add task
          </button>
        )}
      </div>}

      {/* Context menu portal — renders to document.body, position is irrelevant here */}
      {contextMenu && createPortal(
        <div
          className="fixed z-[70] min-w-[160px] rounded-md border border-[var(--app-border)] bg-[var(--app-popover)] p-1 shadow-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-[var(--app-hover)]"
            onClick={() => { onColumnTypeChange(column.id, column.column_type === 'active' ? 'completed' : 'active'); setContextMenu(null); }}
          >
            {column.column_type === 'active' ? 'Set as Slash Out' : 'Set as Active'}
          </button>
          <button
            type="button"
            className="w-full text-left px-2 py-1.5 text-sm text-red-400 rounded-sm hover:bg-[var(--app-hover)]"
            onClick={() => { onDelete(column.id); setContextMenu(null); }}
          >
            Delete column
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
