import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Task } from '@job-logger/shared';
import { useAuth } from '../hooks/useAuth';
import { useTaskColumns } from '../hooks/useTaskColumns';
import { useTasks } from '../hooks/useTasks';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { Button } from '@/components/ui/button';

export function TaskBoard() {
  const { user } = useAuth();
  const { columns, loading: colLoading, addColumn, renameColumn, deleteColumn } = useTaskColumns(user?.id);
  const { tasks, loading: taskLoading, addTask, moveTask } = useTasks(user?.id);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const tasksByColumn = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of columns) map[col.id] = [];
    for (const task of tasks) {
      if (map[task.column_id]) map[task.column_id].push(task);
    }
    for (const id of Object.keys(map)) {
      map[id].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [columns, tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    const overTask = tasks.find((t) => t.id === over.id);
    const targetColumnId = overTask ? overTask.column_id : (over.id as string);

    const colTasks = (tasksByColumn[targetColumnId] ?? []).filter((t) => t.id !== draggedTask.id);
    const newPosition = overTask
      ? colTasks.findIndex((t) => t.id === overTask.id)
      : colTasks.length;

    moveTask(draggedTask.id, targetColumnId, newPosition >= 0 ? newPosition : colTasks.length);
  };

  const handleAddColumn = () => {
    if (newColumnName.trim()) {
      addColumn(newColumnName.trim());
      setNewColumnName('');
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
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
        {columns.map((col) => (
          <TaskColumn
            key={col.id}
            column={col}
            tasks={tasksByColumn[col.id] ?? []}
            onTaskClick={() => {}}
            onAddTask={addTask}
            onRename={renameColumn}
            onDelete={deleteColumn}
          />
        ))}

        {/* Add column */}
        <div className="w-60 min-w-[240px] shrink-0">
          {addingColumn ? (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
              <input
                autoFocus
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') { setAddingColumn(false); setNewColumnName(''); } }}
                placeholder="Column name..."
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-1">
                <Button size="sm" onClick={handleAddColumn} className="flex-1">Add Column</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingColumn(false); setNewColumnName(''); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="w-full text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl border border-dashed border-gray-300 px-4 py-3"
            >
              + Add column
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} onClick={() => {}} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
