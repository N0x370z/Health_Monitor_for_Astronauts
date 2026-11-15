// Cardiograma (ECG) simulado en modo barrido, como un monitor de cabecera.
// La forma de onda PQRST es sintética; la frecuencia sigue el pulso simulado en vivo.
import { useEffect, useRef } from "react";

const SECONDS_VISIBLE = 4;
const SAMPLE = 1 / 250; // 250 Hz
const GAP = 18; // px borrados delante del trazo

// Ondas en segundos desde el inicio del latido: [centro, amplitud, ancho]
const WAVES = [
  [0.1, 0.12, 0.022], // P
  [0.2, -0.12, 0.008], // Q
  [0.226, 1.0, 0.01], // R
  [0.252, -0.26, 0.01], // S
  [0.44, 0.3, 0.042], // T
];
const wave = (tb) => WAVES.reduce((sum, [c, a, w]) => sum + a * Math.exp(-((tb - c) ** 2) / (2 * w * w)), 0);

export default function Ecg({ hr, height = 150, color = "#4ade80" }) {
  const canvas = useRef(null);
  const hrRef = useRef(hr);
  useEffect(() => { hrRef.current = hr; }, [hr]);

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let w = 0, h = 0, raf = 0, last = performance.now(), simT = 0, beatT = 0, prev = null;

    const resize = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      prev = null;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const pxPerSec = w / SECONDS_VISIBLE;
      const mid = h * 0.6, amp = h * 0.42;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      for (let s = 0; s < dt; s += SAMPLE) {
        simT += SAMPLE;
        const rate = hrRef.current;
        let v = 0;
        if (rate) {
          beatT += SAMPLE;
          const period = 60 / rate;
          if (beatT >= period) beatT -= period;
          v = wave(beatT) + 0.02 * Math.sin(simT * 2 * Math.PI * 0.25) + (Math.random() - 0.5) * 0.02;
        }
        const x = (simT * pxPerSec) % w;
        const y = mid - v * amp;
        ctx.clearRect(x, 0, GAP, h);
        if (x < GAP) ctx.clearRect(0, 0, GAP, h);
        if (prev && x > prev[0]) {
          ctx.beginPath();
          ctx.moveTo(prev[0], prev[1]);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        prev = [x, y];
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [color]);

  return (
    <div className="ecg" style={{ height }}>
      <canvas ref={canvas} aria-label={hr ? `Simulated ECG at ${Math.round(hr)} beats per minute` : "No ECG signal"} role="img" />
      {!hr && <span className="ecg-nosig">NO SIGNAL · no heart-rate data</span>}
    </div>
  );
}
