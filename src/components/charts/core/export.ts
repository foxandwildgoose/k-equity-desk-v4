/** Client-side downloads for chart exports (PNG via `takeScreenshot`, CSV text). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, "image/png");
}

export function downloadCsv(text: string, filename: string) {
  // BOM so spreadsheet apps read UTF-8 Korean headers correctly.
  downloadBlob(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }), filename);
}

/** Rasterize an inline SVG chart (e.g. Recharts) to PNG (Tier C). */
export function downloadSvgAsPng(svg: SVGSVGElement, filename: string, background = "#0d1524") {
  const { width, height } = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  const scale = window.devicePixelRatio || 1;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    downloadCanvasPng(canvas, filename);
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}
