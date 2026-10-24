import { onMount, onCleanup, createSignal } from "solid-js";

interface SignaturePadProps {
  onSave: (vectorJson: string) => void;
  width?: number;
  height?: number;
}

interface Point {
  x: number;
  y: number;
}

export function SignaturePad(props: SignaturePadProps) {
  let canvasRef!: HTMLCanvasElement;
  let isDrawing = false;
  const [points, setPoints] = createSignal<Point[][]>([]);
  const [currentStroke, setCurrentStroke] = createSignal<Point[]>([]);

  const startDrawing = (e: MouseEvent | TouchEvent) => {
    isDrawing = true;
    const rect = canvasRef.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setCurrentStroke([{ x, y }]);
    const ctx = canvasRef.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    const rect = canvasRef.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setCurrentStroke((prev) => [...prev, { x, y }]);
    const ctx = canvasRef.getContext("2d");
    if (ctx) {
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#3b82f6";
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    isDrawing = false;
    if (currentStroke().length > 0) {
      setPoints((prev) => [...prev, currentStroke()]);
      setCurrentStroke([]);
    }
  };

  const clearCanvas = () => {
    const ctx = canvasRef.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
    }
    setPoints([]);
    setCurrentStroke([]);
  };

  const handleSave = () => {
    if (points().length === 0) return;
    // Export normalized vector points as compact JSON (~2KB instead of 150KB PNG)
    const json = JSON.stringify(points());
    props.onSave(json);
  };

  onMount(() => {
    canvasRef.width = props.width || 400;
    canvasRef.height = props.height || 180;
  });

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "0.75rem", width: "100%" }}>
      <div
        style={{
          border: "2px dashed var(--border-subtle)",
          "border-radius": "var(--radius-md)",
          background: "var(--bg-surface)",
          overflow: "hidden",
          display: "flex",
          "justify-content": "center",
          "touch-action": "none",
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ cursor: "crosshair", width: "100%", height: "180px" }}
        />
      </div>
      <div style={{ display: "flex", "justify-content": "space-between", gap: "0.5rem" }}>
        <button type="button" onClick={clearCanvas} class="btn btn-secondary">
          Clear Signature
        </button>
        <button
          type="button"
          onClick={handleSave}
          class="btn btn-primary"
          disabled={points().length === 0}
        >
          Confirm Signature
        </button>
      </div>
    </div>
  );
}
