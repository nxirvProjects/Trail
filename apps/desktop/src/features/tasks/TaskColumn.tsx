import { useState, useRef, useEffect, useCallback, type PointerEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskColumn as TaskColumnType } from '@job-logger/shared';
import { Link2 } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { Button } from '@/shared/ui/button';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '@/shared/ui/context-menu';

interface TaskColumnProps {
  column: TaskColumnType;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (columnId: string, title: string) => void;
  onRename: (id: string, name: string) => void;
  onColumnTypeChange: (id: string, columnType: TaskColumnType['column_type']) => void;
  onDeleteTask: (id: string) => void;
  onStartLinkDrag: (event: PointerEvent<HTMLButtonElement>, columnId: string) => void;
  linkingSourceColumnId: string | null;
  onRegisterColumnElement: (columnId: string, element: HTMLDivElement | null) => void;
  onStartColumnDrag: (event: PointerEvent<HTMLElement>, columnId: string) => void;
  onDelete: (id: string) => void;
}

export function TaskColumn({
  column,
  tasks,
  onTaskClick,
  onAddTask,
  onRename,
  onColumnTypeChange,
  onDeleteTask,
  onStartLinkDrag,
  linkingSourceColumnId,
  onRegisterColumnElement,
  onStartColumnDrag,
  onDelete,
}: TaskColumnProps) {
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({ id: column.id });
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(column.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingTask) inputRef.current?.focus();
  }, [addingTask]);

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

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

  const isLinkingSource = linkingSourceColumnId === column.id;
  const containerClass = `flex flex-col w-60 min-w-[240px] rounded-xl border border-[var(--app-border)] ${
    column.column_type === 'completed' ? 'opacity-95' : ''
  } ${isOver ? 'bg-indigo-500/10 border-indigo-400/40' : ''} ${isLinkingSource ? 'ring-2 ring-indigo-400' : ''}`;

  const setMergedRef = useCallback(
    (element: HTMLDivElement | null) => {
      onRegisterColumnElement(column.id, element);
      setDroppableNodeRef(element);
    },
    [column.id, onRegisterColumnElement, setDroppableNodeRef]
  );

  const handleColumnPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, textarea, select, a, [data-task-card="true"], [data-no-column-drag="true"]')) {
      return;
    }

    onStartColumnDrag(event as unknown as PointerEvent<HTMLElement>, column.id);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div ref={setMergedRef} className={`${containerClass} cursor-grab active:cursor-grabbing`} style={{ backgroundColor: 'var(--app-column-surface)' }} onPointerDown={handleColumnPointerDown}>
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--app-border)]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {editingName ? (
            <input
              ref={nameRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setNameValue(column.name);
                  setEditingName(false);
                }
              }}
              className="flex-1 text-sm font-semibold app-text bg-transparent border-b border-indigo-400 outline-none"
              data-no-column-drag="true"
            />
          ) : (
            <h3
              className="flex-1 text-sm font-semibold app-text cursor-pointer truncate"
              onDoubleClick={() => setEditingName(true)}
              title="Double-click to rename"
            >
              {column.name}
            </h3>
          )}
        </div>

        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button
            type="button"
            onPointerDown={(event) => onStartLinkDrag(event, column.id)}
            className={`p-1 rounded ${isLinkingSource ? 'text-indigo-500 bg-indigo-500/10' : 'app-subtle hover:text-indigo-500 hover:bg-[var(--app-hover)]'}`}
            title="Drag to link"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs app-subtle bg-[var(--app-hover)] rounded-full px-2">{tasks.length}</span>
        </div>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 flex-1 min-h-[200px] overflow-y-auto">
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

      <div className="p-2 border-t border-[var(--app-border)]">
        {addingTask ? (
          <div className="flex flex-col gap-1.5">
            <input
              ref={inputRef}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask();
                if (e.key === 'Escape') {
                  setAddingTask(false);
                  setNewTaskTitle('');
                }
              }}
              placeholder="Task title..."
              className="app-input w-full px-2 py-1.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
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
      </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => onColumnTypeChange(column.id, column.column_type === 'active' ? 'completed' : 'active')}
        >
          {column.column_type === 'active' ? 'Set as Slash Out' : 'Set as Active'}
        </ContextMenuItem>
        <ContextMenuItem className="text-red-400 focus:text-red-400" onClick={() => onDelete(column.id)}>
          Delete column
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
