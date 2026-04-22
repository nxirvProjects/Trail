import { useRef, useEffect } from 'react';
import { cn } from '@/shared/lib/utils';

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function BentoCard({ children, className, style }: BentoCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const rotX = ((y - cy) / cy) * -3.5;
      const rotY = ((x - cx) / cx) * 3.5;

      el.style.transition = 'transform 0.15s ease';
      el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;

      el.style.setProperty('--glow-x', `${(x / rect.width) * 100}%`);
      el.style.setProperty('--glow-y', `${(y / rect.height) * 100}%`);
      el.style.setProperty('--glow-opacity', '1');
    };

    const onLeave = () => {
      el.style.transition = 'transform 0.4s ease';
      el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
      el.style.setProperty('--glow-opacity', '0');
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div ref={ref} className={cn('bento-card', className)} style={style}>
      {children}
    </div>
  );
}
