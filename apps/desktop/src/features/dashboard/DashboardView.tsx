import { useMemo } from 'react';
import { Briefcase, Star, TrendingUp, CalendarDays, BarChart2, Target } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { FireShader } from '@/shared/ui/FireShader';
import { BentoCard } from '@/shared/ui/BentoCard';
import type { Job } from '@job-logger/shared';

// ── Stat helpers ──────────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function uniqueAppliedDates(jobs: Job[]): string[] {
  const dates = jobs.map((j) => j.date_applied).filter(Boolean) as string[];
  return [...new Set(dates)].sort();
}

function calcStreak(jobs: Job[]): number {
  const dates = uniqueAppliedDates(jobs);
  if (dates.length === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // allow starting from today or yesterday
  let started = false;
  for (let i = 0; i < 2; i++) {
    const key = cursor.toISOString().split('T')[0];
    if (dates.includes(key)) { started = true; break; }
    cursor.setDate(cursor.getDate() - 1);
  }
  if (!started) return 0;

  while (true) {
    const key = cursor.toISOString().split('T')[0];
    if (dates.includes(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function appsThisWeek(jobs: Job[]): number {
  const start = new Date();
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return jobs.filter((j) => j.date_applied && new Date(j.date_applied) >= start).length;
}

function appsThisMonth(jobs: Job[]): number {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return jobs.filter((j) => j.date_applied && new Date(j.date_applied) >= start).length;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function appsPerWeek(jobs: Job[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const job of jobs) {
    if (!job.date_applied) continue;
    const key = getWeekStart(new Date(job.date_applied)).toISOString().split('T')[0];
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

const MIN_WEEKLY_GOAL = 25;

function calcWeeklyGoal(jobs: Job[]): { goal: number; progress: number; lastWeekCount: number } {
  const thisWeekStart = getWeekStart(new Date());
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const weekMap = appsPerWeek(jobs);
  const progress = weekMap.get(thisWeekStart.toISOString().split('T')[0]) ?? 0;
  const lastWeekCount = weekMap.get(lastWeekStart.toISOString().split('T')[0]) ?? 0;

  return { goal: Math.max(MIN_WEEKLY_GOAL, lastWeekCount + 1), progress, lastWeekCount };
}

function calcWeeklyPenalty(jobs: Job[]): number {
  const weekMap = appsPerWeek(jobs);
  const thisWeekStart = getWeekStart(new Date());
  const weeks = [...weekMap.keys()].sort();

  let penalty = 0;
  for (let i = 1; i < weeks.length; i++) {
    const weekStart = new Date(weeks[i]);
    if (weekStart >= thisWeekStart) continue;
    const prevStart = new Date(weeks[i - 1]);
    const daysDiff = Math.round((weekStart.getTime() - prevStart.getTime()) / 86400000);
    if (daysDiff !== 7) continue; // non-consecutive weeks get no penalty
    const prevCount = weekMap.get(weeks[i - 1]) ?? 0;
    const thisCount = weekMap.get(weeks[i]) ?? 0;
    if (thisCount < Math.max(MIN_WEEKLY_GOAL, prevCount + 1)) penalty += 10;
  }
  return penalty;
}

// ── Gamification ─────────────────────────────────────────────────────────────

// XP thresholds within a single prestige cycle (0–300 XP per cycle)
const PRESTIGE_CYCLE_XP = 300;

const LEVELS = [
  { min: 0,   label: 'Newcomer',      color: 'text-slate-400',  barColor: 'bg-slate-400' },
  { min: 10,  label: 'Job Seeker',    color: 'text-sky-500',    barColor: 'bg-sky-500' },
  { min: 25,  label: 'Active Hunter', color: 'text-indigo-500', barColor: 'bg-indigo-500' },
  { min: 50,  label: 'Pro Applicant', color: 'text-violet-500', barColor: 'bg-violet-500' },
  { min: 100, label: 'Grind Mode',    color: 'text-amber-500',  barColor: 'bg-amber-500' },
  { min: 200, label: 'Elite',         color: 'text-rose-500',   barColor: 'bg-rose-500' },
];

// Prestige badge symbols — each prestige unlocks the next
const PRESTIGE_BADGES = ['✦', '✦✦', '✦✦✦', '✦✦✦✦', '✦✦✦✦✦'];
const PRESTIGE_BADGE_COLORS = [
  'text-sky-400',
  'text-violet-400',
  'text-amber-400',
  'text-rose-400',
  'text-emerald-400',
];

function calcLevel(total: number, streak: number, weeklyPenalty: number) {
  const xp = Math.max(0, total + streak * 2 - weeklyPenalty);

  // prestige = how many full cycles completed
  const prestige = Math.floor(xp / PRESTIGE_CYCLE_XP);
  const xpInCycle = xp % PRESTIGE_CYCLE_XP;

  // find current and next level within this cycle
  let currentIdx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xpInCycle >= LEVELS[i].min) { currentIdx = i; break; }
  }

  const current = LEVELS[currentIdx];
  const next = LEVELS[currentIdx + 1] ?? null;

  const xpIntoLevel = xpInCycle - current.min;
  const xpNeeded = next ? next.min - current.min : PRESTIGE_CYCLE_XP - current.min;
  const pct = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100));

  const prestigeBadge = prestige > 0 ? PRESTIGE_BADGES[Math.min(prestige - 1, PRESTIGE_BADGES.length - 1)] : null;
  const prestigeColor = prestige > 0 ? PRESTIGE_BADGE_COLORS[Math.min(prestige - 1, PRESTIGE_BADGE_COLORS.length - 1)] : null;

  return {
    label: current.label,
    color: current.color,
    barColor: current.barColor,
    xp,
    xpInCycle,
    pct,
    xpIntoLevel,
    xpNeeded,
    next: next?.label ?? null,
    prestige,
    prestigeBadge,
    prestigeColor,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent: string;
}) {
  return (
    <BentoCard className="app-surface-elevated rounded-2xl border border-[var(--app-border)] p-5 flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest app-subtle">{label}</p>
        <span className={`rounded-lg p-2 ${accent}`}>{icon}</span>
      </div>
      <div>
        <div className="text-3xl font-bold app-text leading-tight">{value}</div>
        {sub && <p className="text-xs app-subtle mt-1">{sub}</p>}
      </div>
    </BentoCard>
  );
}

function StreakCard({ streak, fireIntensity, fireColorShift, fireSpeed }: {
  streak: number;
  fireIntensity: number;
  fireColorShift: number;
  fireSpeed: number;
}) {
  const sub = streak > 1 ? `${streak} days in a row` : streak === 1 ? 'Keep it up!' : 'No streak yet';
  return (
    <BentoCard className="app-surface-elevated rounded-2xl border border-[var(--app-border)] p-5 overflow-hidden flex flex-col justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-widest app-subtle">Daily Streak</p>
      <div>
        <div className="text-3xl font-bold app-text leading-tight">{streak}</div>
        <p className="text-xs app-subtle mt-1">{sub}</p>
      </div>
      <div className="absolute right-0 bottom-1 pointer-events-none" style={{ width: 110, top: '-20px' }}>
        <FireShader
          intensity={fireIntensity}
          colorShift={fireColorShift}
          speed={fireSpeed}
          height={1.0}
          turbulence={1.0}
        />
      </div>
    </BentoCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardView({ jobs }: { jobs: Job[] }) {
  const { user } = useAuth();
  const username = user?.email?.split('@')[0] ?? '';

  const streak = useMemo(() => calcStreak(jobs), [jobs]);
  const total = jobs.length;
  const week = useMemo(() => appsThisWeek(jobs), [jobs]);
  const month = useMemo(() => appsThisMonth(jobs), [jobs]);
  const weeklyGoal = useMemo(() => calcWeeklyGoal(jobs), [jobs]);
  const weeklyPenalty = useMemo(() => calcWeeklyPenalty(jobs), [jobs]);
  const level = useMemo(() => calcLevel(total, streak, weeklyPenalty), [total, streak, weeklyPenalty]);

  const fireIntensity = streak === 0 ? 0.5 : Math.min(1.8, 0.9 + streak * 0.06);
  const fireColorShift = streak === 0 ? 0.7 : Math.min(2.0, 1.0 + streak * 0.06);
  const fireSpeed = streak === 0 ? 0.6 : Math.min(1.5, 0.9 + streak * 0.04);

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold app-text">
          {getGreeting()}{username ? `, ${username}` : ''}
        </h2>
        <p className="text-sm app-subtle mt-0.5">Here's your job search overview</p>
      </div>

      {/* Top row — 3 stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StreakCard
          streak={streak}
          fireIntensity={fireIntensity}
          fireColorShift={fireColorShift}
          fireSpeed={fireSpeed}
        />
        <StatCard
          label="Apps Sent"
          value={total}
          sub="total applications logged"
          icon={<Briefcase className="h-4 w-4 text-sky-500" />}
          accent="bg-sky-100 dark:bg-sky-900/30"
        />
        <StatCard
          label="Level"
          value={
            <span className="flex items-center gap-2">
              <span className={level.color}>{level.label}</span>
              {level.prestigeBadge && (
                <span className={`text-sm font-bold ${level.prestigeColor}`} title={`Prestige ${level.prestige}`}>
                  {level.prestigeBadge}
                </span>
              )}
            </span>
          }
          sub={`${level.xp} XP total${level.prestige > 0 ? ` · Prestige ${level.prestige}` : ''}`}
          icon={<Star className="h-4 w-4 text-amber-500" />}
          accent="bg-amber-100 dark:bg-amber-900/30"
        />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-2 gap-3">

        {/* XP / Level progress */}
        <BentoCard className="app-surface-elevated rounded-2xl border border-[var(--app-border)] p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-widest app-subtle">XP Progress</p>
            <TrendingUp className="h-3.5 w-3.5 app-subtle" />
          </div>

          <div className="flex items-baseline gap-2 mt-3">
            <p className={`text-lg font-bold ${level.color}`}>{level.label}</p>
            {level.prestigeBadge && (
              <span className={`text-sm font-bold ${level.prestigeColor}`}>
                {level.prestigeBadge} Prestige {level.prestige}
              </span>
            )}
          </div>

          <div className={`mt-3 h-2.5 rounded-full bg-[var(--app-hover)]`}>
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${level.barColor}`}
              style={{ width: `${level.pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <p className="text-xs app-subtle">{level.xpIntoLevel} / {level.xpNeeded} XP</p>
            <p className="text-xs app-subtle">
              {level.next
                ? `→ ${level.next}`
                : level.prestige > 0
                  ? `→ Prestige ${level.prestige + 1}`
                  : '→ Prestige'}
            </p>
          </div>

          <p className="text-xs app-subtle mt-3 leading-relaxed border-t border-[var(--app-border)] pt-3">
            XP = apps sent + (streak × 2) − missed weekly goals (−10 each). Reach 300 XP to prestige.
            {weeklyPenalty > 0 && <span className="text-rose-500 font-medium"> −{weeklyPenalty} XP applied.</span>}
          </p>
        </BentoCard>

        {/* Consistency */}
        <BentoCard className="app-surface-elevated rounded-2xl border border-[var(--app-border)] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest app-subtle">Consistency</p>
            <CalendarDays className="h-3.5 w-3.5 app-subtle" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs app-subtle">This week</p>
                <p className="text-3xl font-bold app-text">{week}</p>
              </div>
              <div className="text-right">
                <p className="text-xs app-subtle">This month</p>
                <p className="text-3xl font-bold app-text">{month}</p>
              </div>
            </div>
            <div className="border-t border-[var(--app-border)] pt-3 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 app-subtle shrink-0" />
              <p className="text-xs app-subtle">
                {streak > 0
                  ? `You're on a ${streak}-day streak. Don't break the chain!`
                  : 'Log an application today to start a streak.'}
              </p>
            </div>
          </div>
        </BentoCard>

      </div>

      {/* Weekly Goal */}
      <BentoCard className="app-surface-elevated rounded-2xl border border-[var(--app-border)] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest app-subtle">Weekly Goal</p>
          <Target className="h-3.5 w-3.5 app-subtle" />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm app-text">
              {weeklyGoal.lastWeekCount > 0
                ? <>Beat last week's <span className="font-semibold">{weeklyGoal.lastWeekCount}</span> — goal: <span className="font-semibold">{weeklyGoal.goal}</span> apps this week</>
                : <>Minimum goal: <span className="font-semibold">{weeklyGoal.goal}</span> apps this week</>
              }
            </p>
            {weeklyGoal.progress >= weeklyGoal.goal ? (
              <span className="text-xs font-semibold text-emerald-500">Goal met!</span>
            ) : (
              <span className="text-xs font-semibold text-rose-500">
                {weeklyGoal.goal - weeklyGoal.progress} to go · miss it = −10 XP
              </span>
            )}
          </div>
          <div className="h-2 rounded-full bg-[var(--app-hover)]">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${weeklyGoal.progress >= weeklyGoal.goal ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(100, Math.round((weeklyGoal.progress / weeklyGoal.goal) * 100))}%` }}
            />
          </div>
          <p className="text-xs app-subtle">{weeklyGoal.progress} / {weeklyGoal.goal} apps logged this week</p>
        </div>
      </BentoCard>

    </div>
  );
}
