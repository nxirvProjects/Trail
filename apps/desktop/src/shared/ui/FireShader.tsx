import { useEffect, useRef } from 'react';
import { cn } from '@/shared/lib/utils';

export interface FireShaderProps extends React.HTMLAttributes<HTMLCanvasElement> {
  speed?: number;
  intensity?: number;
  height?: number;
  turbulence?: number;
  colorShift?: number;
}

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Adapted from shadcn fire-3d (volumetric raymarching)
const FRAG = `
precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform float u_speed;
uniform float u_intensity;
uniform float u_height;
uniform float u_turbulence;
uniform float u_colorShift;

vec4 tnh(vec4 x) {
  vec4 x2 = x * x;
  return x * (3.0 + x2) / (3.0 + 3.0 * x2);
}

void main() {
  vec2 I = gl_FragCoord.xy;
  float t = iTime * u_speed;
  float z = 0.0;
  float d = 1.0;
  vec4 O = vec4(0.0);

  for (float s = 0.0; s < 50.0; s++) {
    vec3 p = z * normalize(vec3(I + I, 0.0) - iResolution.xyy);
    p.z += 5.0 + cos(t) * u_height;
    mat2 r = mat2(cos(p.y * 0.5 + vec4(0.0, 33.0, 11.0, 0.0)));
    p.xz *= r / max(p.y * 0.1 + 1.0, 0.1);
    float freq = 2.0;
    for (int j = 0; j < 8; j++) {
      p += cos((p.yzx - vec3(t * 10.0, t, freq)) * freq * u_turbulence) / freq;
      freq /= 0.6;
    }
    d = 0.01 + abs(length(p.xz) + p.y * 0.3 - 0.5) / 7.0;
    z += d;
    O += (sin(z / 3.0 + vec4(7.0, 2.0, 3.0, 0.0) * u_colorShift) + 1.1) / d * u_intensity;
  }

  vec4 color = tnh(O / 1000.0);
  float alpha = max(color.r, max(color.g, color.b));
  gl_FragColor = vec4(color.rgb, alpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export function FireShader({
  className,
  speed = 1.0,
  intensity = 1.0,
  height = 1.0,
  turbulence = 1.0,
  colorShift = 1.0,
  ...props
}: FireShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uniforms = useRef({ speed, intensity, height, turbulence, colorShift });

  useEffect(() => {
    uniforms.current = { speed, intensity, height, turbulence, colorShift };
  }, [speed, intensity, height, turbulence, colorShift]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'iTime');
    const uRes = gl.getUniformLocation(prog, 'iResolution');
    const uSpeed = gl.getUniformLocation(prog, 'u_speed');
    const uIntensity = gl.getUniformLocation(prog, 'u_intensity');
    const uHeight = gl.getUniformLocation(prog, 'u_height');
    const uTurb = gl.getUniformLocation(prog, 'u_turbulence');
    const uColor = gl.getUniformLocation(prog, 'u_colorShift');

    let raf = 0;
    let start = performance.now();

    function draw() {
      if (!gl || !canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth * dpr;
      const h = canvas.clientHeight * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }

      const t = (performance.now() - start) / 1000;
      const u = uniforms.current;
      gl.uniform1f(uTime, t);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uSpeed, u.speed);
      gl.uniform1f(uIntensity, u.intensity);
      gl.uniform1f(uHeight, u.height);
      gl.uniform1f(uTurb, u.turbulence);
      gl.uniform1f(uColor, u.colorShift);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn('block w-full h-full', className)}
      style={{ background: 'transparent' }}
      {...props}
    />
  );
}
