import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useViewport,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type OnEdgesDelete,
  type NodeTypes,
} from '@xyflow/react';

function ZoomDisplay() {
  const { zoom } = useViewport();
  return (
    <Panel position="bottom-center">
      <div className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-1 text-xs font-medium app-text shadow-sm">
        {Math.round(zoom * 100)}%
      </div>
    </Panel>
  );
}
import '@xyflow/react/dist/style.css';
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
import { Map as MapIcon, Plus } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { useTaskColumns } from './useTaskColumns';
import { useTasks } from './useTasks';
import { useRoadmaps } from './useRoadmaps';
import { useRoadmapLinks } from './useRoadmapLinks';
import { ColumnNode, type ColumnNodeData } from './ColumnNode';
import { TaskCard } from './TaskCard';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { ShineBorder } from '@/shared/ui/shine-border';

const nodeTypes: NodeTypes = { columnNode: ColumnNode };

interface TaskBoardProps {
  onRoadmapTitleChange?: (title: string) => void;
}

function TaskBoardSkeleton() {
  return (
    <div className="relative mb-1 flex-1 overflow-hidden rounded-xl border canvas-board">
      <ShineBorder
        borderWidth={2}
        duration={0}
        shineColor={['var(--canvas-shine-color-1)', 'var(--canvas-shine-color-2)', 'var(--canvas-shine-color-3)']}
      />
      <div className="h-full w-full p-4">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    </div>
  );
}

export function TaskBoard({ onRoadmapTitleChange }: TaskBoardProps) {
  const { user } = useAuth();
  const { roadmaps, loading: roadmapLoading, addRoadmap, deleteRoadmapIfEmpty, deleteRoadmapCascade } = useRoadmaps(user?.id);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null);
  const { links, loading: linksLoading, addLink, deleteLink } = useRoadmapLinks(selectedRoadmapId);
  const {
    columns,
    loading: colLoading,
    addColumn,
    renameColumn,
    updateColumnType,
    deleteColumn,
    moveColumnTo,
    resizeColumnTo,
  } = useTaskColumns(user?.id, selectedRoadmapId);
  const { tasks, loading: taskLoading, addTask, deleteTask, replaceTasks, persistTaskOrder } = useTasks(user?.id);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // DnD state
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dragTasks, setDragTasks] = useState<Task[] | null>(null);

  // UI state
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState<'active' | 'completed'>('active');
  const [addingRoadmap, setAddingRoadmap] = useState(false);
  const [newRoadmapName, setNewRoadmapName] = useState('');
  const [roadmapError, setRoadmapError] = useState<string | null>(null);
  const [roadmapsDrawerOpen, setRoadmapsDrawerOpen] = useState(false);
  const [cascadeDeleteRoadmapId, setCascadeDeleteRoadmapId] = useState<string | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);

  const creatingDefaultRoadmapRef = { current: false };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Auto-select first roadmap
  useEffect(() => {
    if (selectedRoadmapId && roadmaps.some((r) => r.id === selectedRoadmapId)) return;
    setSelectedRoadmapId(roadmaps.length > 0 ? roadmaps[0].id : null);
  }, [roadmaps, selectedRoadmapId]);

  // Auto-create default roadmap
  useEffect(() => {
    if (roadmapLoading || !user?.id) return;
    if (roadmaps.length > 0 || creatingDefaultRoadmapRef.current) return;
    creatingDefaultRoadmapRef.current = true;
    addRoadmap('Main').finally(() => { creatingDefaultRoadmapRef.current = false; });
  }, [roadmapLoading, roadmaps, addRoadmap, user?.id]);

  // Notify parent of roadmap title
  const selectedRoadmap = roadmaps.find((r) => r.id === selectedRoadmapId) ?? null;
  useEffect(() => {
    onRoadmapTitleChange?.(selectedRoadmap?.name ?? 'Roadmap');
  }, [onRoadmapTitleChange, selectedRoadmap?.name]);

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

  // Callbacks passed into node data
  const handleResizeStop = useCallback(async (id: string, width: number, height: number) => {
    await resizeColumnTo(id, width, height);
  }, [resizeColumnTo]);

  // Sync columns → React Flow nodes
  useEffect(() => {
    setNodes((prev) => {
      const existingById = new Map(prev.map((n) => [n.id, n]));
      return columns.map((col) => {
        const existing = existingById.get(col.id);
        return {
          id: col.id,
          type: 'columnNode' as const,
          // Preserve React Flow's in-memory position so drags aren't reset mid-flight.
          // Only fall back to the DB value for brand-new nodes.
          position: existing ? existing.position : { x: col.x, y: col.y },
          // After a resize, React Flow stores new dims in node.measured.
          // Prefer measured → existing style → DB value so resize never snaps back.
          style: {
            width: existing?.measured?.width ?? (existing?.style as { width?: number } | undefined)?.width ?? col.width ?? 240,
            height: existing?.measured?.height ?? (existing?.style as { height?: number } | undefined)?.height ?? col.height ?? 260,
          },
          data: {
            column: col,
            tasks: tasksByColumn[col.id] ?? [],
            onTaskClick: () => {},
            onAddTask: addTask,
            onRename: renameColumn,
            onColumnTypeChange: updateColumnType,
            onDeleteTask: deleteTask,
            onDelete: deleteColumn,
            onResizeStop: handleResizeStop,
          } satisfies ColumnNodeData,
        };
      });
    });
  }, [columns, tasksByColumn, addTask, renameColumn, updateColumnType, deleteTask, deleteColumn, handleResizeStop, setNodes]);

  // Sync links → React Flow edges
  useEffect(() => {
    setEdges(
      links.map((link) => ({
        id: link.id,
        source: link.from_column_id,
        target: link.to_column_id,
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--app-subtle)' },
        style: { stroke: 'var(--app-subtle)', strokeWidth: 1.5 },
      }))
    );
  }, [links, setEdges]);

  // Persist column position after drag
  const handleNodeDragStop = useCallback(async (_event: unknown, node: Node) => {
    await moveColumnTo(node.id, node.position.x, node.position.y);
  }, [moveColumnTo]);

  // Create a link by connecting two handles
  const handleConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const { data, error } = await addLink(connection.source, connection.target);
    if (!error && data) {
      setEdges((prev) => addEdge({
        id: data.id,
        source: connection.source!,
        target: connection.target!,
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--app-subtle)' },
        style: { stroke: 'var(--app-subtle)', strokeWidth: 1.5 },
      }, prev));
    }
  }, [addLink, setEdges]);

  // Delete links when edges are removed (Backspace key)
  const handleEdgesDelete: OnEdgesDelete = useCallback(async (deletedEdges) => {
    await Promise.all(deletedEdges.map((edge) => deleteLink(edge.id)));
  }, [deleteLink]);

  // Edge right-click context menu
  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setEdgeContextMenu({ edgeId: edge.id, x: event.clientX, y: event.clientY });
  }, []);

  const handleEdgeContextMenuDelete = useCallback(async () => {
    if (!edgeContextMenu) return;
    await deleteLink(edgeContextMenu.edgeId);
    setEdges((prev) => prev.filter((e) => e.id !== edgeContextMenu.edgeId));
    setEdgeContextMenu(null);
  }, [edgeContextMenu, deleteLink, setEdges]);

  useEffect(() => {
    if (!edgeContextMenu) return;
    const close = () => setEdgeContextMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [edgeContextMenu]);

  // ── DnD task sorting ──────────────────────────────────────────────────────

  const reorderTasksForDrag = (sourceTasks: Task[], activeId: string, overId: string): Task[] => {
    if (activeId === overId) return sourceTasks;
    const active = sourceTasks.find((t) => t.id === activeId);
    if (!active) return sourceTasks;
    const overTask = sourceTasks.find((t) => t.id === overId);
    const targetColumnId = overTask ? overTask.column_id : overId;
    const columnExists = columns.some((c) => c.id === targetColumnId);
    if (!columnExists) return sourceTasks;
    const withoutActive = sourceTasks.filter((t) => t.id !== activeId);
    const targetTasks = withoutActive.filter((t) => t.column_id === targetColumnId).sort((a, b) => a.position - b.position);
    const insertionIndex = overTask ? targetTasks.findIndex((t) => t.id === overTask.id) : targetTasks.length;
    const movedTask: Task = { ...active, column_id: targetColumnId };
    const nextTargetTasks = [...targetTasks];
    nextTargetTasks.splice(insertionIndex >= 0 ? insertionIndex : nextTargetTasks.length, 0, movedTask);
    const updates = new Map<string, Pick<Task, 'column_id' | 'position'>>();
    nextTargetTasks.forEach((task, index) => { updates.set(task.id, { column_id: targetColumnId, position: index }); });
    if (active.column_id !== targetColumnId) {
      withoutActive.filter((t) => t.column_id === active.column_id).sort((a, b) => a.position - b.position)
        .forEach((task, index) => { updates.set(task.id, { column_id: active.column_id, position: index }); });
    }
    return [...withoutActive, movedTask].map((task) => {
      const next = updates.get(task.id);
      return next ? { ...task, ...next } : task;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null);
    setDragTasks(tasks);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    setDragTasks((prev) => reorderTasksForDrag(prev ?? tasks, String(active.id), String(over.id)));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    const base = dragTasks ?? tasks;
    const finalTasks = over ? reorderTasksForDrag(base, String(active.id), String(over.id)) : base;
    setDragTasks(null);
    replaceTasks(finalTasks);
    const previousById = new Map(tasks.map((t) => [t.id, t]));
    const changed = finalTasks
      .filter((t) => { const p = previousById.get(t.id); return !!p && (p.column_id !== t.column_id || p.position !== t.position); })
      .map((t) => ({ id: t.id, column_id: t.column_id, position: t.position }));
    await persistTaskOrder(changed);
  };

  // ── Roadmap management ────────────────────────────────────────────────────

  const handleAddColumn = () => {
    if (newColumnName.trim()) {
      addColumn(newColumnName.trim(), newColumnType);
      setNewColumnName('');
      setNewColumnType('active');
      setAddingColumn(false);
    }
  };

  const handleAddRoadmap = async () => {
    const name = newRoadmapName.trim();
    if (!name) return;
    const { data, error } = await addRoadmap(name);
    if (!error && data) {
      setSelectedRoadmapId(data.id);
      setNewRoadmapName('');
      setAddingRoadmap(false);
      setRoadmapError(null);
    }
  };

  const handleDeleteRoadmap = async (roadmapId: string | null = selectedRoadmapId) => {
    if (!roadmapId) return;
    const { error } = await deleteRoadmapIfEmpty(roadmapId);
    if (error) { setRoadmapError(error.message || 'Roadmap must be empty before deleting.'); return; }
    setRoadmapError(null);
    if (selectedRoadmapId === roadmapId) setSelectedRoadmapId(null);
  };

  const handleDeleteRoadmapCascade = async (roadmapId: string | null) => {
    if (!roadmapId) return;
    const { error } = await deleteRoadmapCascade(roadmapId);
    if (error) { setRoadmapError(error.message || 'Failed to delete roadmap.'); return; }
    setRoadmapError(null);
    setCascadeDeleteRoadmapId(null);
    if (selectedRoadmapId === roadmapId) setSelectedRoadmapId(null);
  };

  if (roadmapLoading || colLoading || taskLoading || linksLoading) {
    return <TaskBoardSkeleton />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveTask(null); setDragTasks(null); }}
    >
      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRoadmapsDrawerOpen(true)}
          title="Roadmaps"
          aria-label="Open roadmaps"
          className="ml-auto px-2"
        >
          <MapIcon className="h-4 w-4" />
        </Button>
      </div>

      {addingColumn && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <input
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddColumn(); }}
            placeholder="Column name"
            className="app-input h-9 rounded-lg px-3 text-sm"
          />
          <select
            value={newColumnType}
            onChange={(e) => setNewColumnType(e.target.value as 'active' | 'completed')}
            className="app-input h-9 rounded-lg px-3 text-sm"
          >
            <option value="active">Active column</option>
            <option value="completed">Slash Out column</option>
          </select>
          <Button size="sm" onClick={handleAddColumn}>Add column</Button>
          <Button size="sm" variant="ghost" onClick={() => setAddingColumn(false)}>Cancel</Button>
        </div>
      )}

      <div className="mb-2 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setAddingColumn((v) => !v)}>+ Add column</Button>
      </div>

      {roadmapError && (
        <div className="mb-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {roadmapError}
        </div>
      )}

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden rounded-xl border canvas-board mb-1">
        <ShineBorder
          borderWidth={2}
          duration={12}
          shineColor={['var(--canvas-shine-color-1)', 'var(--canvas-shine-color-2)', 'var(--canvas-shine-color-3)']}
        />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          onEdgesDelete={handleEdgesDelete}
          onEdgeContextMenu={handleEdgeContextMenu}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode="Backspace"
          minZoom={0.2}
          maxZoom={2.2}
          className="bg-transparent"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--app-border)" gap={24} size={1} />
          <Controls className="!bottom-4 !left-4" showInteractive={false} />
          <ZoomDisplay />
        </ReactFlow>
      </div>

      {/* Roadmaps drawer */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-200 ${
          roadmapsDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="absolute inset-0 bg-black/45" onClick={() => setRoadmapsDrawerOpen(false)} />
        <aside
          className={`absolute right-0 top-0 h-full w-[360px] app-surface-elevated border-l border-[var(--app-border)] shadow-2xl p-4 overflow-y-auto transition-transform duration-200 ease-out ${
            roadmapsDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold app-text">Roadmaps</h3>
            <button
              type="button"
              title="Add roadmap"
              onClick={() => setAddingRoadmap((v) => !v)}
              className="h-9 w-9 rounded-lg border border-[var(--app-border)] app-muted hover:bg-[var(--app-hover)] flex items-center justify-center"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {addingRoadmap && (
            <div className="mb-3 flex items-center gap-2">
              <input
                autoFocus
                value={newRoadmapName}
                onChange={(e) => setNewRoadmapName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddRoadmap();
                  if (e.key === 'Escape') { setAddingRoadmap(false); setNewRoadmapName(''); }
                }}
                placeholder="Roadmap name"
                className="app-input h-9 rounded-lg px-3 text-sm flex-1"
              />
              <Button size="sm" onClick={handleAddRoadmap}>Save</Button>
            </div>
          )}

          <div className="space-y-2">
            {roadmaps.map((roadmap) => (
              <div
                key={roadmap.id}
                className={`rounded-lg border p-2 ${
                  roadmap.id === selectedRoadmapId ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-[var(--app-border)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => { setSelectedRoadmapId(roadmap.id); setRoadmapsDrawerOpen(false); }}
                  className="w-full text-left"
                >
                  <p className="text-sm app-text truncate">{roadmap.name}</p>
                  <p className="text-xs app-subtle mt-0.5">
                    {roadmap.id === selectedRoadmapId ? 'Active roadmap' : 'Click to switch'}
                  </p>
                </button>
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteRoadmap(roadmap.id)}>
                    Delete (empty)
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setCascadeDeleteRoadmapId(roadmap.id)}>
                    Delete + items
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Cascade delete confirmation */}
      {cascadeDeleteRoadmapId && (
        <div className="app-overlay fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setCascadeDeleteRoadmapId(null)}>
          <div className="app-surface-elevated rounded-xl border shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--app-border)]">
              <h2 className="text-lg font-semibold app-text">Delete roadmap with all items?</h2>
              <p className="text-sm app-muted mt-1">This permanently deletes this roadmap, its columns, tasks, and links.</p>
            </div>
            <div className="p-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCascadeDeleteRoadmapId(null)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={() => handleDeleteRoadmapCascade(cascadeDeleteRoadmapId)}>
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edge right-click context menu */}
      {edgeContextMenu && (
        <div
          className="fixed z-[70] min-w-[160px] rounded-md border border-[var(--app-border)] bg-[var(--app-popover)] p-1 shadow-md"
          style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left px-2 py-1.5 text-sm text-red-400 rounded-sm hover:bg-[var(--app-hover)]"
            onClick={handleEdgeContextMenuDelete}
          >
            Delete link
          </button>
        </div>
      )}

      {/* DnD drag overlay */}
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
