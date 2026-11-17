import { loadScenes, type Shape } from "./foodScenes";

const num = (n: number | undefined) => (n === undefined ? "" : String(n));

function shapeToSvg(s: Shape): string {
  const fill = s.f ?? "none";
  const stroke = s.s ? ` stroke="${s.s}" stroke-width="${s.sw ?? 1}" stroke-linejoin="round" stroke-linecap="round"` : "";
  const opacity = s.o !== undefined && s.o !== 1 ? ` opacity="${s.o}"` : "";
  if (s.t === "r") {
    const cx = (s.x ?? 0) + (s.w ?? 0) / 2;
    const cy = (s.y ?? 0) + (s.h ?? 0) / 2;
    const rot = s.rot ? ` transform="rotate(${s.rot} ${cx} ${cy})"` : "";
    return `<rect x="${num(s.x)}" y="${num(s.y)}" width="${num(s.w)}" height="${num(s.h)}" rx="${s.rx ?? 0}" fill="${fill}"${stroke}${opacity}${rot}/>`;
  }
  if (s.t === "e") {
    const rot = s.rot ? ` transform="rotate(${s.rot} ${s.cx} ${s.cy})"` : "";
    return `<ellipse cx="${num(s.cx)}" cy="${num(s.cy)}" rx="${num(s.rx)}" ry="${num(s.ry)}" fill="${fill}"${stroke}${opacity}${rot}/>`;
  }
  if (s.t === "l") {
    return `<line x1="${num(s.x1)}" y1="${num(s.y1)}" x2="${num(s.x2)}" y2="${num(s.y2)}" stroke="${s.s}" stroke-width="${s.sw ?? 1}" stroke-linecap="round"${opacity}/>`;
  }
  return `<path d="${s.d ?? ""}" fill="${fill}"${stroke}${opacity}/>`;
}

/** Turns an illustration into a JPEG, so it can stand in for a photo in a demonstration. */
export async function sceneToJpeg(key: string, width = 960): Promise<Blob> {
  const all = await loadScenes();
  const shapes = all[key];
  if (!shapes) throw new Error("scene-missing");
  const height = Math.round((width * 3) / 4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" width="${width}" height="${height}">${shapes.map(shapeToSvg).join("")}</svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.88));
}
