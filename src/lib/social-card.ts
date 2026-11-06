import type { Market } from "./markets";
import { toMultiplier } from "./markets";

/** Payout shown on share cards: what a KES 100 stake returns at the current price. */
export function cardPayout(prob: number) {
  return Math.round(100 * toMultiplier(prob));
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function ensureOswald() {
  if (document.querySelector("link[data-oswald]")) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap";
  l.dataset["oswald"] = "1";
  document.head.appendChild(l);
  try {
    await document.fonts.load('700 64px "Oswald"');
  } catch {
    /* fall back to system font */
  }
}

/** Paints a 1200x630 share card (rendered at 2x) and returns it as a PNG blob. */
export async function renderSocialCard(m: Market): Promise<Blob> {
  await ensureOswald();
  const W = 1200;
  const H = 630;
  const c = document.createElement("canvas");
  c.width = W * 2;
  c.height = H * 2;
  const ctx = c.getContext("2d")!;
  ctx.scale(2, 2);
  ctx.fillStyle = "#0B0E14";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#009A44";
  ctx.fillRect(0, 0, 16, H);

  // Top row
  ctx.fillStyle = "#FFFFFF";
  ctx.font = '700 40px "Oswald", Impact, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText("POLKA", 60, 64);
  const pill = (x: number, text: string, bg: string, fg: string) => {
    ctx.font = '700 20px "Oswald", Impact, sans-serif';
    const w = ctx.measureText(text).width + 32;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, 44, w, 40, 20);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(text, x + 16, 65);
    return w;
  };
  pill(200, "[ WHAT'S YOUR CALL? ]", "#1C2333", "#FFD166");
  ctx.font = '700 20px "Oswald", Impact, sans-serif';
  const mw = ctx.measureText("M-PESA ⚡").width + 32;
  pill(W - 60 - mw, "M-PESA ⚡", "#009A44", "#FFFFFF");

  // Question
  ctx.fillStyle = "#FFFFFF";
  ctx.font = '700 56px "Oswald", Impact, sans-serif';
  ctx.textBaseline = "alphabetic";
  const lines = wrap(ctx, m.question.toUpperCase(), W - 120).slice(0, 3);
  lines.forEach((l, i) => ctx.fillText(l, 60, 170 + i * 66));

  // Outcomes (2-way or 3-way)
  const outs = m.outcomes.slice(0, 3);
  const palette = ["#00C26E", "#FF5A5F", "#4DA3FF"];
  const gap = 24;
  const bw = (W - 120 - gap * (outs.length - 1)) / outs.length;
  const by = 380;
  outs.forEach((o, i) => {
    const x = 60 + i * (bw + gap);
    const col = outs.length === 2 ? palette[i] : palette[[0, 2, 1][i]!]!;
    ctx.fillStyle = "#151B27";
    ctx.beginPath();
    ctx.roundRect(x, by, bw, 150, 16);
    ctx.fill();
    ctx.strokeStyle = col!;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = col!;
    ctx.font = '700 34px "Oswald", Impact, sans-serif';
    ctx.fillText(`${o.label.toUpperCase().slice(0, 14)} ${Math.round(o.prob * 100)}%`, x + 24, by + 60);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = '700 24px "Oswald", Impact, sans-serif';
    ctx.fillText(`KES 100 PAYS KES ${cardPayout(o.prob).toLocaleString("en-KE")}`, x + 24, by + 112);
  });

  // Footer
  ctx.fillStyle = "#FFD166";
  ctx.font = '700 26px "Oswald", Impact, sans-serif';
  ctx.fillText("⚡ TRADE NOW · polka.co.ke", 60, 590);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("render failed"))), "image/png"));
}
