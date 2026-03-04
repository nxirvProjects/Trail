import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabase';
import type { TaskColumn } from '@job-logger/shared';

export function useTaskColumns(userId: string | undefined, roadmapId: string | null) {
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !roadmapId) {
      setColumns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from('task_columns')
      .select('*')
      .eq('user_id', userId)
      .eq('roadmap_id', roadmapId)
      .order('position', { ascending: true })
      .then(({ data }) => {
        setColumns(data ?? []);
        setLoading(false);
      });
  }, [userId, roadmapId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('task-columns-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_columns', filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setColumns((prev) => {
            const inserted = payload.new as TaskColumn;
            if (inserted.roadmap_id !== roadmapId) return prev;
            if (prev.some((c) => c.id === inserted.id)) return prev;
            return [...prev, inserted].sort((a, b) => a.position - b.position);
          });
        } else if (payload.eventType === 'UPDATE') {
          setColumns((prev) => {
            const updated = payload.new as TaskColumn;
            const exists = prev.some((c) => c.id === updated.id);

            if (updated.roadmap_id !== roadmapId) {
              return exists ? prev.filter((c) => c.id !== updated.id) : prev;
            }

            if (!exists) return [...prev, updated].sort((a, b) => a.position - b.position);
            return prev.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.position - b.position);
          });
        } else if (payload.eventType === 'DELETE') {
          setColumns((prev) => prev.filter((c) => c.id !== (payload.old as { id: string }).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, roadmapId]);

  const addColumn = useCallback(async (name: string, columnType: TaskColumn['column_type'] = 'active') => {
    if (!userId || !roadmapId) return;
    const maxPos = columns.reduce((max, c) => Math.max(max, c.position), -1);
    const maxX = columns.reduce((max, c) => Math.max(max, c.x), -320);
    const yBase = columns.length === 0 ? 0 : columns[0].y;
    const { data } = await supabase
      .from('task_columns')
      .insert({
        user_id: userId,
        roadmap_id: roadmapId,
        name,
        column_type: columnType,
        position: maxPos + 1,
        x: maxX + 320,
        y: yBase,
        width: 240,
        height: 260,
      })
      .select()
      .single();
    if (data) {
      setColumns((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev;
        return [...prev, data].sort((a, b) => a.position - b.position);
      });
    }
  }, [userId, roadmapId, columns]);

  const renameColumn = useCallback(async (id: string, name: string) => {
    await supabase.from('task_columns').update({ name }).eq('id', id);
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, name } : c));
  }, []);

  const updateColumnType = useCallback(async (id: string, columnType: TaskColumn['column_type']) => {
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, column_type: columnType } : c));
    const { error } = await supabase.from('task_columns').update({ column_type: columnType }).eq('id', id);
    if (error) {
      setColumns((prev) => prev.map((c) => c.id === id ? { ...c, column_type: columnType === 'active' ? 'completed' : 'active' } : c));
    }
  }, []);

  const deleteColumn = useCallback(async (id: string) => {
    await supabase.from('task_columns').delete().eq('id', id);
    setColumns((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const replaceColumns = useCallback((nextColumns: TaskColumn[]) => {
    setColumns(nextColumns);
  }, []);

  const persistColumnOrder = useCallback(async (updates: Array<Pick<TaskColumn, 'id' | 'position'>>) => {
    if (updates.length === 0) return;

    await Promise.all(
      updates.map((column) =>
        supabase
          .from('task_columns')
          .update({ position: column.position })
          .eq('id', column.id)
      )
    );
  }, []);

  const moveColumnTo = useCallback(async (id: string, x: number, y: number) => {
    const { error } = await supabase.from('task_columns').update({ x, y }).eq('id', id);
    if (!error) {
      setColumns((prev) => prev.map((column) => (column.id === id ? { ...column, x, y } : column)));
    }
    return { error };
  }, []);

  const resizeColumnTo = useCallback(async (id: string, width: number, height: number) => {
    const { error } = await supabase.from('task_columns').update({ width, height }).eq('id', id);
    if (!error) {
      setColumns((prev) => prev.map((column) => (column.id === id ? { ...column, width, height } : column)));
    }
    return { error };
  }, []);

  return {
    columns,
    loading,
    addColumn,
    renameColumn,
    updateColumnType,
    deleteColumn,
    replaceColumns,
    persistColumnOrder,
    moveColumnTo,
    resizeColumnTo,
  };
}
