import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase';
import type { Roadmap } from '@job-logger/shared';

export function useRoadmaps(userId: string | undefined) {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRoadmaps([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from('roadmaps')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
      .then(({ data }) => {
        setRoadmaps(data ?? []);
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('roadmaps-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roadmaps', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRoadmaps((prev) => {
              const inserted = payload.new as Roadmap;
              if (prev.some((r) => r.id === inserted.id)) return prev;
              return [...prev, inserted].sort((a, b) => a.position - b.position);
            });
          } else if (payload.eventType === 'UPDATE') {
            setRoadmaps((prev) =>
              prev
                .map((r) => (r.id === (payload.new as Roadmap).id ? (payload.new as Roadmap) : r))
                .sort((a, b) => a.position - b.position)
            );
          } else if (payload.eventType === 'DELETE') {
            setRoadmaps((prev) => prev.filter((r) => r.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addRoadmap = useCallback(
    async (name: string) => {
      if (!userId || !name.trim()) return { data: null, error: null };

      const maxPos = roadmaps.reduce((max, roadmap) => Math.max(max, roadmap.position), -1);
      const { data, error } = await supabase
        .from('roadmaps')
        .insert({ user_id: userId, name: name.trim(), position: maxPos + 1 })
        .select()
        .single();

      if (!error && data) {
        setRoadmaps((prev) => {
          if (prev.some((r) => r.id === data.id)) return prev;
          return [...prev, data].sort((a, b) => a.position - b.position);
        });
      }

      return { data, error };
    },
    [userId, roadmaps]
  );

  const renameRoadmap = useCallback(async (id: string, name: string) => {
    if (!name.trim()) return { error: null };
    const { error } = await supabase.from('roadmaps').update({ name: name.trim() }).eq('id', id);
    if (!error) {
      setRoadmaps((prev) => prev.map((r) => (r.id === id ? { ...r, name: name.trim() } : r)));
    }
    return { error };
  }, []);

  const deleteRoadmapIfEmpty = useCallback(async (id: string) => {
    const [{ count: columnsCount, error: columnsError }, { count: linksCount, error: linksError }] = await Promise.all([
      supabase.from('task_columns').select('*', { count: 'exact', head: true }).eq('roadmap_id', id),
      supabase.from('roadmap_links').select('*', { count: 'exact', head: true }).eq('roadmap_id', id),
    ]);

    if (columnsError || linksError) {
      return { error: columnsError ?? linksError };
    }

    if ((columnsCount ?? 0) > 0 || (linksCount ?? 0) > 0) {
      return { error: new Error('Roadmap must be empty before deleting.') };
    }

    const { error } = await supabase.from('roadmaps').delete().eq('id', id);
    if (!error) {
      setRoadmaps((prev) => prev.filter((r) => r.id !== id));
    }
    return { error };
  }, []);

  const deleteRoadmapCascade = useCallback(async (id: string) => {
    const { error } = await supabase.from('roadmaps').delete().eq('id', id);
    if (!error) {
      setRoadmaps((prev) => prev.filter((r) => r.id !== id));
    }
    return { error };
  }, []);

  return { roadmaps, loading, addRoadmap, renameRoadmap, deleteRoadmapIfEmpty, deleteRoadmapCascade };
}
