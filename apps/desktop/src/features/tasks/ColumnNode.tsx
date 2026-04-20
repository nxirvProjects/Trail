import { memo } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import type { Task, TaskColumn } from '@job-logger/shared';
import { TaskColumnInner } from './TaskColumn';

export interface ColumnNodeData {
  column: TaskColumn;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (columnId: string, title: string) => void;
  onRename: (id: string, name: string) => void;
  onColumnTypeChange: (id: string, columnType: TaskColumn['column_type']) => void;
  onDeleteTask: (id: string) => void;
  onDelete: (id: string) => void;
  onResizeStop: (id: string, width: number, height: number) => void;
  [key: string]: unknown;
}

export const ColumnNode = memo(function ColumnNode({ data, selected }: NodeProps) {
  const d = data as ColumnNodeData;

  return (
    // A real DOM element as root is required — React Flow's drag and resize
    // hit-testing cannot work against a React fragment.
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        maxWidth={560}
        minHeight={220}
        maxHeight={620}
        onResizeEnd={(_event, params) => {
          d.onResizeStop(d.column.id, params.width, params.height);
        }}
      />

      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 12, height: 12, background: '#818cf8', border: '2px solid #1e293b' }}
      />

      <TaskColumnInner
        column={d.column}
        tasks={d.tasks}
        onTaskClick={d.onTaskClick}
        onAddTask={d.onAddTask}
        onRename={d.onRename}
        onColumnTypeChange={d.onColumnTypeChange}
        onDeleteTask={d.onDeleteTask}
        onDelete={d.onDelete}
      />

      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 12, height: 12, background: '#818cf8', border: '2px solid #1e293b' }}
      />
    </div>
  );
});
