import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Task } from '@job-logger/shared';
import { useAuth } from '@/features/auth/useAuth';
import { useTaskColumns } from './useTaskColumns';
import { useTasks } from './useTasks';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { Button } from '@/shared/ui/button';

export function TaskBoard() {
  const { user } = useAuth();
  const { columns, loading: colLoading, addColumn, renameColumn, updateColumnType, deleteColumn } = useTaskColumns(user?.id);
  const { tasks, loading: taskLoading, addTask, replaceTasks, persistTaskOrder } = useTasks(user?.id);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dragTasks, setDragTasks] = useState<Task[] | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState<'active' | 'completed'>('active');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const visibleTasks = dragTasks ?? tasks;

  const tasksByColumn = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of columns) map[col.id] = [];
    for (const task of visibleTasks) {
      if (map[task.column_id]) map[task.column_id].push(task);
    }
    for (const id of Object.keys(map)) {
      map[id].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [columns, visibleTasks]);

  const reorderTasksForDrag = (sourceTasks: Task[], activeId: string, overId: string): Task[] => {
    if (activeId === overId) return sourceTasks;

    const active = sourceTasks.find((t) => t.id === activeId);
    if (!active) return sourceTasks;

    const overTask = sourceTasks.find((t) => t.id === overId);
    const targetColumnId = overTask ? overTask.column_id : overId;
    const columnExists = columns.some((c) => c.id === targetColumnId);
    if (!columnExists) return sourceTasks;

    const withoutActive = sourceTasks.filter((t) => t.id !== activeId);
    const targetTasks = withoutActive
      .filter((t) => t.column_id === targetColumnId)
      .sort((a, b) => a.position - b.position);

    const insertionIndex = overTask
      ? targetTasks.findIndex((t) => t.id === overTask.id)
      : targetTasks.length;

    const movedTask: Task = { ...active, column_id: targetColumnId };
    const nextTargetTasks = [...targetTasks];
    nextTargetTasks.splice(insertionIndex >= 0 ? insertionIndex : nextTargetTasks.length, 0, movedTask);

    const updates = new Map<string, Pick<Task, 'column_id' | 'position'>>();

    nextTargetTasks.forEach((task, index) => {
      updates.set(task.id, { column_id: targetColumnId, position: index });
    });

    if (active.column_id !== targetColumnId) {
      const sourceColumnTasks = withoutActive
        .filter((t) => t.column_id === active.column_id)
        .sort((a, b) => a.position - b.position);

      sourceColumnTasks.forEach((task, index) => {
        updates.set(task.id, { column_id: active.column_id, position: index });
      });
    }

    const base = [...withoutActive, movedTask];
    return base.map((task) => {
      const next = updates.get(task.id);
      return next ? { ...task, ...next } : task;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
    setDragTasks(tasks);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    setDragTasks((prev) => {
      const base = prev ?? tasks;
      return reorderTasksForDrag(base, String(active.id), String(over.id));
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    const base = dragTasks ?? tasks;
    const finalTasks = over
      ? reorderTasksForDrag(base, String(active.id), String(over.id))
      : base;

    setDragTasks(null);
    replaceTasks(finalTasks);

    const previousById = new Map(tasks.map((task) => [task.id, task]));
    const changed = finalTasks
      .filter((task) => {
        const previous = previousById.get(task.id);
        return !!previous && (previous.column_id !== task.column_id || previous.position !== task.position);
      })
      .map((task) => ({ id: task.id, column_id: task.column_id, position: task.position }));

    await persistTaskOrder(changed);
  };

  const handleAddColumn = () => {
    if (newColumnName.trim()) {
      addColumn(newColumnName.trim(), newColumnType);
      setNewColumnName('');
      setNewColumnType('active');
    }
    setAddingColumn(false);
  };

  if (colLoading || taskLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveTask(null);
        setDragTasks(null);
      }}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
        {columns.map((col) => (
          <TaskColumn
            key={col.id}
            column={col}
            tasks={tasksByColumn[col.id] ?? []}
            onTaskClick={() => {}}
            onAddTask={addTask}
            onRename={renameColumn}
            onColumnTypeChange={updateColumnType}
            onDelete={deleteColumn}
          />
        ))}

        {/* Add column */}
        <div className="w-60 min-w-[240px] shrink-0">
          {addingColumn ? (
            <div className="app-surface-muted rounded-xl border p-3 flex flex-col gap-2">
              <input
                autoFocus
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') { setAddingColumn(false); setNewColumnName(''); } }}
                placeholder="Column name..."
                className="app-input w-full px-2 py-1.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={newColumnType}
                onChange={(e) => setNewColumnType(e.target.value as 'active' | 'completed')}
                className="app-input w-full px-2 py-1.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="active">Active column</option>
                <option value="completed">Slash Out column</option>
              </select>
              <div className="flex gap-1">
                <Button size="sm" onClick={handleAddColumn} className="flex-1">Add Column</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingColumn(false);
                    setNewColumnName('');
                    setNewColumnType('active');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="w-full text-sm app-subtle hover:text-[var(--app-text)] hover:bg-[var(--app-hover)] rounded-xl border border-dashed border-[var(--app-border)] px-4 py-3"
            >
              + Add column
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            onClick={() => {}}
            isDragOverlay
            isCompletedColumn={columns.find((col) => col.id === activeTask.column_id)?.column_type === 'completed'}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
