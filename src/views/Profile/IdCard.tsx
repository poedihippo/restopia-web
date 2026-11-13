'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, Printer, X } from 'lucide-react';
import type { IUserMe } from '@/@types/user';

/** Portrait CR80 card (54 × 85.6 mm) at ~300 dpi. */
const W = 638;
const H = 1012;

// Same palette as the Dashboard revenue hero card.
const C = {
  cocoa700: '#4A2E21',
  cocoa900: '#2A1A13',
  gold: '#C68B4E',
  goldSoft: '#E8B98A',
};

/**
 * Parses API dates: "13-11-2026 10:00 UTC" (day-first, used for timestamps),
 * "2026-03-02 10:00:00" or "1990-01-01". Returns null when missing/invalid.
 */
export function parseApiDate(v: unknown): Date | null {
  if (!v) return null;
  const str = String(v).trim();
  const dayFirst = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(str);
  const d = dayFirst
    ? new Date(Date.UTC(+dayFirst[3], +dayFirst[2] - 1, +dayFirst[1], +(dayFirst[4] ?? 0), +(dayFirst[5] ?? 0)))
    : new Date(str.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) || d.getFullYear() < 1900 ? null : d;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Shrinks the font until `text` fits `maxWidth`, then ellipsizes. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: (size: number) => string, size: number, min: number) {
  let s = size;
  ctx.font = font(s);
  while (s > min && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = font(s);
  }
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxWidth) t = t.slice(0, -1);
  return t === text ? text : `${t.trimEnd()}…`;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  return fitText(ctx, text, maxWidth, () => ctx.font, 0, 0);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function drawCard(canvas: HTMLCanvasElement, user: IUserMe) {
  const sans =
    getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 'Inter, sans-serif';
  await Promise.all([
    document.fonts?.load(`600 60px ${sans}`),
    document.fonts?.load(`600 20px ${sans}`),
    document.fonts?.load(`400 20px ${sans}`),
  ]).catch(() => undefined);
  const logo = await loadImage('/icon-dapcok.png');

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  const spacing = (px: number) => {
    if ('letterSpacing' in ctx) (ctx as any).letterSpacing = `${px}px`;
  };

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 40);
  ctx.clip();

  // Cocoa gradient with soft gold glows (the dashboard "orbs")
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, C.cocoa700);
  bg.addColorStop(1, C.cocoa900);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const orb = (x: number, y: number, r: number, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(198, 139, 78, ${alpha})`);
    g.addColorStop(0.7, 'rgba(198, 139, 78, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  orb(W - 40, -40, 420, 0.42);
  orb(-40, H + 40, 360, 0.24);

  const pad = 48;
  const cx = W / 2;
  const innerW = W - pad * 2;
  ctx.textBaseline = 'middle';

  // Header: logo tile + brand on one row, Employee ID pill underneath
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, pad, 48, 72, 72, 18);
  ctx.fill();
  if (logo) ctx.drawImage(logo, pad + 36 - 19, 84 - 21, 38, 42);

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.font = `600 27px ${sans}`;
  ctx.fillText('Dapur Cokelat', pad + 92, 70);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = `400 18px ${sans}`;
  ctx.fillText(ellipsize(ctx, user.branch?.company?.name ?? '', innerW - 92), pad + 92, 102);

  ctx.font = `600 16px ${sans}`;
  spacing(2.5);
  const pillText = 'EMPLOYEE ID';
  const pillW = ctx.measureText(pillText).width + 34;
  ctx.fillStyle = 'rgba(198, 139, 78, 0.20)';
  roundRect(ctx, pad, 146, pillW, 38, 19);
  ctx.fill();
  ctx.fillStyle = C.goldSoft;
  ctx.textAlign = 'center';
  ctx.fillText(pillText, pad + pillW / 2, 166);
  spacing(0);

  // Avatar tile, centred
  const as = 220;
  const ay = 252;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  roundRect(ctx, cx - as / 2, ay, as, as, 44);
  ctx.fill();
  ctx.strokeStyle = 'rgba(198, 139, 78, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = C.goldSoft;
  ctx.textAlign = 'center';
  ctx.font = `600 112px ${sans}`;
  ctx.fillText(user.name?.trim()?.charAt(0)?.toUpperCase() || 'U', cx, ay + as / 2 + 6);

  // Name + role
  ctx.fillStyle = '#FFFFFF';
  spacing(-1.5);
  const name = fitText(ctx, user.name ?? '—', innerW, (s) => `600 ${s}px ${sans}`, 54, 30);
  ctx.fillText(name, cx, 548);
  spacing(0);
  const role =
    user.roles?.map((r: any) => r.name).filter(Boolean).join(' · ') ||
    (user.type === 'superadmin' ? 'Superadmin' : 'Staff');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
  ctx.font = `400 22px ${sans}`;
  ctx.fillText(ellipsize(ctx, role, innerW), cx, 594);

  // Gold bar on a faint track
  const barY = 636;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  roundRect(ctx, pad, barY, innerW, 8, 4);
  ctx.fill();
  const bar = ctx.createLinearGradient(pad, 0, W - pad, 0);
  bar.addColorStop(0, C.gold);
  bar.addColorStop(0.7, C.goldSoft);
  bar.addColorStop(1, 'rgba(232, 185, 138, 0)');
  ctx.fillStyle = bar;
  roundRect(ctx, pad, barY, innerW, 8, 4);
  ctx.fill();

  // Label on the left, bold value on the right (like Collected / Outstanding)
  const row = (label: string, value: string, y: number) => {
    ctx.textAlign = 'left';
    ctx.font = `400 22px ${sans}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.fillText(label, pad, y);
    const lw = ctx.measureText(label).width;
    ctx.textAlign = 'right';
    ctx.font = `600 22px ${sans}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(ellipsize(ctx, value, innerW - lw - 24), W - pad, y);
  };
  const since = parseApiDate(user.created_at);
  const sinceText = since ? since.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—';
  // NIK (Nomor Induk Karyawan) is the employee number.
  row('NIK', user.nik || '—', 716);
  row('Branch', user.branch?.name ?? '—', 776);
  row('Member since', sinceText, 836);

  // Footer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.fillRect(pad, 900, innerW, 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = `400 16px ${sans}`;
  ctx.fillText(ellipsize(ctx, `Property of ${user.branch?.company?.name ?? 'Dapur Cokelat'}`, innerW), cx, 948);

  ctx.restore();
}

export default function IdCard({ user }: { user: IUserMe | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreview(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  useEffect(() => {
    if (!user || !canvasRef.current) return;
    let cancelled = false;
    drawCard(canvasRef.current, user).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const fileBase = `id-card-${(user?.name ?? 'user').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

  const onDownload = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileBase}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  const onPrint = () => {
    const src = canvasRef.current?.toDataURL('image/png');
    if (!src) return;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileBase}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { margin: 0; font-family: Arial, sans-serif; }
  .cut { display: inline-block; padding: 3mm; border: 1px dashed #999; }
  img { display: block; width: 54mm; height: 85.6mm; border-radius: 3mm; }
  p { font-size: 9pt; color: #777; margin: 3mm 0 0; }
</style></head>
<body><div class="cut"><img src="${src}" alt="ID card"></div><p>Cut along the dashed line · actual size 54 × 85.6 mm</p></body></html>`);
    doc.close();
    const win = iframe.contentWindow!;
    win.addEventListener('afterprint', () => setTimeout(() => iframe.remove(), 500));
    setTimeout(() => iframe.isConnected && iframe.remove(), 60_000);
    const img = doc.querySelector('img');
    const go = () => {
      win.focus();
      win.print();
    };
    if (img && !img.complete) img.onload = go;
    else setTimeout(go, 100);
  };

  return (
    <div className="profile-idcard" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Same soft tone as the POS "Hold Order" button. */}
      <style>{`
        .idcard-btn-soft { background: var(--accent-light-bg); color: var(--accent); border: 1px solid transparent; font-weight: 600; transition: background 150ms ease, border-color 150ms ease; }
        .idcard-canvas { transition: transform 150ms ease, box-shadow 150ms ease, opacity 200ms ease !important; }
        .idcard-canvas:hover { transform: translateY(-2px); }
        @keyframes idcard-pop { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }
        .idcard-close { box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3); transition: background 150ms ease, transform 150ms ease, box-shadow 150ms ease; }
        .idcard-close:hover { background: var(--accent-light-bg) !important; transform: scale(1.08) rotate(90deg); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.38); }
        .idcard-close:active { transform: scale(0.96); }
        .idcard-btn-soft:hover:not(:disabled) { background: color-mix(in srgb, var(--accent-light) 30%, var(--accent-light-bg)); border-color: color-mix(in srgb, var(--accent-light) 45%, transparent); }
      `}</style>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        aria-label="Employee ID card — click to enlarge"
        role="button"
        tabIndex={0}
        onClick={() => ready && setPreview(canvasRef.current?.toDataURL('image/png') ?? null)}
        onKeyDown={(e) => {
          if (ready && (e.key === 'Enter' || e.key === ' ')) setPreview(canvasRef.current?.toDataURL('image/png') ?? null);
        }}
        className="idcard-canvas"
        style={{
          display: 'block',
          cursor: ready ? 'zoom-in' : 'default',
          width: '100%',
          aspectRatio: `${W} / ${H}`,
          borderRadius: 18,
          boxShadow: '0 14px 32px rgba(42, 26, 19, 0.22), 0 2px 6px rgba(42, 26, 19, 0.12)',
          opacity: ready ? 1 : 0.4,
          transition: 'opacity 200ms ease',
        }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button
          type="button"
          className="v2-btn idcard-btn-soft"
          onClick={onDownload}
          disabled={!ready}
          title="Download the ID card as a 300 dpi PNG"
          style={{ justifyContent: 'center' }}
        >
          <Download size={14} />
          Download
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-ghost"
          onClick={onPrint}
          disabled={!ready}
          title="Print at real ID size (54 × 85.6 mm) with cut lines"
          style={{ justifyContent: 'center' }}
        >
          <Printer size={14} />
          Print
        </button>
      </div>
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Employee ID card"
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(20, 12, 8, 0.72)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div style={{ position: 'relative', animation: 'idcard-pop 160ms ease-out' }} onClick={(e) => e.stopPropagation()}>
            <img
              src={preview}
              alt="Employee ID card"
              style={{
                display: 'block',
                height: 'min(82vh, 720px)',
                maxWidth: 'calc(100vw - 48px)',
                objectFit: 'contain',
                borderRadius: 24,
                boxShadow: '0 30px 80px rgba(0, 0, 0, 0.45)',
              }}
            />
            <button
              type="button"
              aria-label="Close"
              className="idcard-close"
              onClick={() => setPreview(null)}
              style={{
                position: 'absolute',
                top: -14,
                right: -14,
                width: 36,
                height: 36,
                borderRadius: 99,
                border: 'none',
                background: '#fff',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
