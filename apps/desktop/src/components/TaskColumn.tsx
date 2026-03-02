import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskColumn as TaskColumnType } from '@job-logger/shared';
import { TaskCard } from './TaskCard';
import { Button } from '@/components/ui/button';

interface TaskColumnProps {
  column: TaskColumnType;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (columnId: string, title: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function TaskColumn({ column, tasks, onTaskClick, onAddTask, onRename, onDelete }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
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

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-60 min-w-[240px] bg-gray-50 rounded-xl border border-gray-200 ${isOver ? 'bg-indigo-50 border-indigo-200' : ''}`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
        {editingName ? (
          <input
            ref={nameRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setNameValue(column.name); setEditingName(false); } }}
            className="flex-1 text-sm font-semibold text-gray-800 bg-transparent border-b border-indigo-400 outline-none"
          />
        ) : (
          <h3
            className="flex-1 text-sm font-semibold text-gray-800 cursor-pointer truncate"
            onDoubleClick={() => setEditingName(true)}
            title="Double-click to rename"
          >
            {column.name}
          </h3>
        )}
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2">{tasks.length}</span>
          <button
            onClick={() => onDelete(column.id)}
            className="text-gray-300 hover:text-red-400 text-lg leading-none"
            title="Delete column"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Tasks */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 flex-1 min-h-[200px] overflow-y-auto">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </div>
      </SortableContext>

      {/* Add task */}
      <div className="p-2 border-t border-gray-200">
        {addingTask ? (
          <div className="flex flex-col gap-1.5">
            <input
              ref={inputRef}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); if (e.key === 'Escape') { setAddingTask(false); setNewTaskTitle(''); } }}
              placeholder="Task title..."
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-1">
              <Button size="sm" onClick={handleAddTask} className="flex-1">Add</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingTask(false); setNewTaskTitle(''); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingTask(true)}
            className="w-full text-left text-xs text-gray-400 hover:text-gray-600 px-1 py-1"
          >
            + Add task
          </button>
        )}
      </div>
    </div>
  );
}
