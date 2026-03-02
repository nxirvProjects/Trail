import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { TaskColumn } from '@job-logger/shared';

export function useTaskColumns(userId: string | undefined) {
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('task_columns')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
      .then(({ data }) => {
        setColumns(data ?? []);
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('task-columns-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_columns', filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setColumns((prev) => {
            const inserted = payload.new as TaskColumn;
            if (prev.some((c) => c.id === inserted.id)) return prev;
            return [...prev, inserted].sort((a, b) => a.position - b.position);
          });
        } else if (payload.eventType === 'UPDATE') {
          setColumns((prev) => prev.map((c) => c.id === (payload.new as TaskColumn).id ? payload.new as TaskColumn : c));
        } else if (payload.eventType === 'DELETE') {
          setColumns((prev) => prev.filter((c) => c.id !== (payload.old as { id: string }).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const addColumn = useCallback(async (name: string) => {
    if (!userId) return;
    const maxPos = columns.reduce((max, c) => Math.max(max, c.position), -1);
    const { data } = await supabase
      .from('task_columns')
      .insert({ user_id: userId, name, position: maxPos + 1 })
      .select()
      .single();
    if (data) {
      setColumns((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev;
        return [...prev, data].sort((a, b) => a.position - b.position);
      });
    }
  }, [userId, columns]);

  const renameColumn = useCallback(async (id: string, name: string) => {
    await supabase.from('task_columns').update({ name }).eq('id', id);
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, name } : c));
  }, []);

  const deleteColumn = useCallback(async (id: string) => {
    await supabase.from('task_columns').delete().eq('id', id);
    setColumns((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { columns, loading, addColumn, renameColumn, deleteColumn };
}
