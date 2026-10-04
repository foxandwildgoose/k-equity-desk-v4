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

/**
 * Keep every pixel of the native multi-pane screenshot and append the export
 * provenance/legend. Wrapping preserves complete metadata on mobile canvases;
 * unlike DOM overlays this footer is part of the downloaded PNG itself.
 */
export function composeChartPng(canvas: HTMLCanvasElement, lines: string[]): HTMLCanvasElement {
  const metadata = lines.flatMap((line) => line.split(/\r?\n/)).map((line) => line.trim()).filter(Boolean);
  if (!metadata.length || !canvas.width || !canvas.height) return canvas;
  const output = document.createElement("canvas");
  output.width = canvas.width;
  const ctx = output.getContext("2d");
  if (!ctx) return canvas;
  const cssWidth = canvas.getBoundingClientRect().width;
  const scale = cssWidth > 0 ? canvas.width / cssWidth : Math.max(1, window.devicePixelRatio || 1);
  const padding = Math.min(12 * scale, canvas.width / 8);
  const lineHeight = 18 * scale;
  const font = `${12 * scale}px ui-sans-serif, system-ui, sans-serif`;
  ctx.font = font;
  const availableWidth = canvas.width - padding * 2;
  const wrapped: string[] = [];
  for (const text of metadata) {
    let current = "";
    // Character boundaries also wrap long source URLs and Korean text without
    // spaces. No data is removed to fit the original viewport width.
    for (const character of text) {
      if (current && ctx.measureText(current + character).width > availableWidth) {
        wrapped.push(current.trimEnd());
        current = character.trimStart();
      } else current += character;
    }
    if (current) wrapped.push(current);
  }
  output.height = canvas.height + Math.ceil(padding * 2 + wrapped.length * lineHeight);
  let paper = "rgb(15, 23, 42)";
  let isLight = false;
  try {
    const pixel = canvas.getContext("2d")?.getImageData(0, 0, 1, 1).data;
    if (pixel && pixel[3]! > 0) {
      paper = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
      isLight = (pixel[0]! * 0.2126 + pixel[1]! * 0.7152 + pixel[2]! * 0.0722) > 150;
    }
  } catch {
    // A custom externally sourced layer can prevent pixel reads. Preserve the
    // screenshot and use a known contrasting footer instead of losing export.
  }
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, output.width, output.height);
  ctx.drawImage(canvas, 0, 0);
  ctx.fillStyle = isLight ? "rgba(15,23,42,0.18)" : "rgba(226,232,240,0.18)";
  ctx.fillRect(0, canvas.height, output.width, scale);
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillStyle = isLight ? "#334155" : "#cbd5e1";
  for (const [index, text] of wrapped.entries()) {
    ctx.fillText(text, padding, canvas.height + padding + lineHeight * (index + 0.5));
  }
  return output;
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
