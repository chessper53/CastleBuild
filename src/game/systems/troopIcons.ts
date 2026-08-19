// Hand-drawn vector glyphs, one per troop id, shared by the battlefield
// renderer (combatSystem.ts) and the codex UI (hud.ts) so a unit reads
// identically in both places. Deliberately simple bold silhouettes
// rather than detailed art - legible at 16-24px.
export function drawTroopIcon(ctx: CanvasRenderingContext2D, id: string, size: number) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;

  ctx.strokeStyle = '#f3e8c8';
  ctx.fillStyle = '#f3e8c8';
  ctx.lineWidth = Math.max(1.5, s * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (id) {
    case 'levy': {
      // pitchfork
      ctx.beginPath();
      ctx.moveTo(cx, cy + s * 0.35);
      ctx.lineTo(cx, cy - s * 0.1);
      ctx.moveTo(cx - s * 0.18, cy - s * 0.35);
      ctx.lineTo(cx - s * 0.18, cy - s * 0.08);
      ctx.lineTo(cx, cy - s * 0.1);
      ctx.moveTo(cx + s * 0.18, cy - s * 0.35);
      ctx.lineTo(cx + s * 0.18, cy - s * 0.08);
      ctx.lineTo(cx, cy - s * 0.1);
      ctx.moveTo(cx, cy - s * 0.35);
      ctx.lineTo(cx, cy - s * 0.08);
      ctx.stroke();
      break;
    }
    case 'spearman': {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.3, cy + s * 0.3);
      ctx.lineTo(cx + s * 0.28, cy - s * 0.28);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.3, cy - s * 0.32);
      ctx.lineTo(cx + s * 0.1, cy - s * 0.22);
      ctx.lineTo(cx + s * 0.2, cy - s * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'archer': {
      ctx.beginPath();
      ctx.arc(cx - s * 0.05, cy, s * 0.32, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.3, cy - s * 0.26);
      ctx.lineTo(cx + s * 0.26, cy + s * 0.04);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.26, cy + s * 0.04);
      ctx.lineTo(cx + s * 0.1, cy - s * 0.02);
      ctx.lineTo(cx + s * 0.18, cy + s * 0.14);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'crossbowman': {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.32, cy - s * 0.14);
      ctx.lineTo(cx + s * 0.32, cy - s * 0.14);
      ctx.moveTo(cx, cy - s * 0.14);
      ctx.lineTo(cx, cy + s * 0.32);
      ctx.moveTo(cx - s * 0.12, cy + s * 0.2);
      ctx.lineTo(cx + s * 0.12, cy + s * 0.2);
      ctx.stroke();
      break;
    }
    case 'man_at_arms': {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.24, cy - s * 0.28);
      ctx.lineTo(cx + s * 0.24, cy - s * 0.28);
      ctx.lineTo(cx + s * 0.24, cy + s * 0.03);
      ctx.quadraticCurveTo(cx + s * 0.2, cy + s * 0.3, cx, cy + s * 0.35);
      ctx.quadraticCurveTo(cx - s * 0.2, cy + s * 0.3, cx - s * 0.24, cy + s * 0.03);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'knight': {
      ctx.beginPath();
      ctx.arc(cx, cy - s * 0.04, s * 0.26, Math.PI * 0.12, Math.PI * 0.88, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.26, cy - s * 0.04);
      ctx.lineTo(cx - s * 0.3, cy + s * 0.3);
      ctx.moveTo(cx + s * 0.26, cy - s * 0.04);
      ctx.lineTo(cx + s * 0.3, cy + s * 0.3);
      ctx.stroke();
      break;
    }
    case 'sapper': {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.22, cy + s * 0.32);
      ctx.lineTo(cx + s * 0.18, cy - s * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.02, cy - s * 0.36);
      ctx.lineTo(cx + s * 0.34, cy - s * 0.14);
      ctx.stroke();
      break;
    }
    case 'battering_ram': {
      const prevWidth = ctx.lineWidth;
      ctx.lineWidth = s * 0.17;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.32, cy);
      ctx.lineTo(cx + s * 0.16, cy);
      ctx.stroke();
      ctx.lineWidth = prevWidth;
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.16, cy - s * 0.14);
      ctx.lineTo(cx + s * 0.36, cy);
      ctx.lineTo(cx + s * 0.16, cy + s * 0.14);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'siege_tower': {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.2, cy - s * 0.32);
      ctx.lineTo(cx - s * 0.24, cy + s * 0.32);
      ctx.moveTo(cx + s * 0.2, cy - s * 0.32);
      ctx.lineTo(cx + s * 0.24, cy + s * 0.32);
      for (const t of [-0.14, 0.05, 0.24]) {
        ctx.moveTo(cx - s * (0.21 + t * 0.05), cy + s * t);
        ctx.lineTo(cx + s * (0.21 + t * 0.05), cy + s * t);
      }
      ctx.stroke();
      break;
    }
    case 'mangonel': {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.28, cy + s * 0.3);
      ctx.lineTo(cx + s * 0.3, cy + s * 0.3);
      ctx.moveTo(cx - s * 0.15, cy + s * 0.3);
      ctx.lineTo(cx + s * 0.1, cy - s * 0.32);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + s * 0.14, cy - s * 0.34, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'trebuchet': {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.28, cy + s * 0.32);
      ctx.lineTo(cx + s * 0.05, cy - s * 0.32);
      ctx.moveTo(cx - s * 0.06, cy + s * 0.02);
      ctx.lineTo(cx + s * 0.3, cy + s * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - s * 0.06, cy + s * 0.02, s * 0.075, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'ballista': {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.32, cy - s * 0.16);
      ctx.lineTo(cx + s * 0.32, cy - s * 0.16);
      ctx.moveTo(cx - s * 0.22, cy - s * 0.32);
      ctx.lineTo(cx + s * 0.06, cy + s * 0.06);
      ctx.moveTo(cx + s * 0.22, cy - s * 0.32);
      ctx.lineTo(cx - s * 0.06, cy + s * 0.06);
      ctx.moveTo(cx, cy + s * 0.06);
      ctx.lineTo(cx, cy + s * 0.34);
      ctx.stroke();
      break;
    }
    case 'marine_raider': {
      ctx.beginPath();
      ctx.arc(cx, cy - s * 0.24, s * 0.09, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.15);
      ctx.lineTo(cx, cy + s * 0.32);
      ctx.moveTo(cx - s * 0.2, cy - s * 0.02);
      ctx.lineTo(cx + s * 0.2, cy - s * 0.02);
      ctx.moveTo(cx - s * 0.22, cy + s * 0.1);
      ctx.quadraticCurveTo(cx - s * 0.22, cy + s * 0.32, cx, cy + s * 0.32);
      ctx.quadraticCurveTo(cx + s * 0.22, cy + s * 0.32, cx + s * 0.22, cy + s * 0.1);
      ctx.stroke();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export function troopIconDataUrl(id: string, size = 32): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) drawTroopIcon(ctx, id, size);
  return canvas.toDataURL();
}
