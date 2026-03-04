import * as React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/shared/lib/utils';

interface ShineBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  borderWidth?: number;
  duration?: number;
  shineColor?: [string, string, string];
}

export function ShineBorder({
  className,
  borderWidth = 2,
  duration = 14,
  shineColor = ['#38bdf8', '#6366f1', '#8b5cf6'],
  style,
  ...props
}: ShineBorderProps) {
  const [color1, color2, color3] = shineColor;
  const isStatic = duration <= 0;

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden', className)}
      style={{
        padding: borderWidth,
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        ...style,
      }}
      {...props}
    >
      {isStatic ? (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `linear-gradient(135deg, ${color1}, ${color2}, ${color3})` }}
        />
      ) : (
        <motion.div
          className="absolute inset-[-150%]"
          style={{
            backgroundImage: `conic-gradient(from 0deg, transparent 0deg, transparent 215deg, ${color1} 255deg, ${color2} 292deg, ${color3} 330deg, transparent 360deg)`,
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration,
            ease: 'linear',
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
      )}
    </div>
  );
}
