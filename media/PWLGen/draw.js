import { ctx, canvas, points, config, PAD, appState, mouse } from './state.js';
import { mapToPx, formatNumber, getTimeSuffix, getVoltSuffix } from './utils.js';

export function draw() {
    const w = canvas.width; const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    ctx.strokeStyle = '#333'; ctx.fillStyle = '#888'; ctx.font = '13px sans-serif'; ctx.lineWidth = 1;

    // --- 1. Draw Vertical Lines (Time) ---
    if (config.gridXRaw > 0) {
        // Custom Grid
        const step = config.gridXRaw * config.timeMult;
        const maxT = config.maxTimeRaw * config.timeMult;
        
        let lastLabelPx = -100; // Track the last drawn label position

        if (step > 0) {
            for (let t = 0; t <= maxT; t += step) {
                const px = mapToPx(t, 0).x;
                if (px > w) break; 
                
                // Always draw the line
                ctx.beginPath(); ctx.moveTo(px, PAD.top); ctx.lineTo(px, h - PAD.bottom); ctx.stroke();
                
                // Only draw text if far enough from previous label (e.g. 50px gap)
                if (px - lastLabelPx > 50) { 
                    ctx.fillText(formatNumber(t / config.timeMult), px - 10, h - 5);
                    lastLabelPx = px;
                }
            }
        }
    } else {
        // Auto Grid (Old Behavior)
        for(let i=0; i<=5; i++) {
            const val = (config.maxTimeRaw / 5) * i;
            const px = mapToPx(val * config.timeMult, 0).x;
            ctx.beginPath(); ctx.moveTo(px, PAD.top); ctx.lineTo(px, h - PAD.bottom); ctx.stroke();
            ctx.fillText(formatNumber(val) + getTimeSuffix(), px - 10, h - 5);
        }
    }

    // --- 2. Draw Horizontal Lines (Voltage) ---
    if (config.gridYRaw > 0) {
        // Custom Grid
        const step = config.gridYRaw * config.voltMult;
        const maxV = config.maxVoltsRaw * config.voltMult;
        
        let lastLabelPx = 10000; // Track last Y position (start high because Y goes down)

        if (step > 0) {
            for (let v = 0; v <= maxV; v += step) {
                const py = mapToPx(0, v).y;
                if (py < 0) break;

                // Always draw the line
                ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(w - PAD.right, py); ctx.stroke();

                // Only draw text if far enough from previous label (e.g. 25px gap)
                // Note: Y coordinates decrease as we go up, so we check absolute difference
                if (Math.abs(py - lastLabelPx) > 25) {
                    ctx.fillText(formatNumber(v / config.voltMult), 5, py + 3);
                    lastLabelPx = py;
                }
            }
        }
    } else {
        // Auto Grid (Old Behavior)
        for(let i=0; i<=4; i++) {
            const val = (config.maxVoltsRaw / 4) * i;
            const py = mapToPx(0, val * config.voltMult).y;
            ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(w - PAD.right, py); ctx.stroke();
            ctx.fillText(formatNumber(val) + getVoltSuffix(), 5, py + 3);
        }
    }

    // --- The rest of the file stays exactly the same ---
    
    // Axes
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.beginPath();
    const o = mapToPx(0,0); const tr = mapToPx(config.maxTimeRaw*config.timeMult, config.maxVoltsRaw*config.voltMult);
    ctx.moveTo(o.x, o.y); ctx.lineTo(tr.x, o.y); 
    ctx.moveTo(o.x, o.y); ctx.lineTo(o.x, tr.y); ctx.stroke();

    // Signal
    ctx.strokeStyle = '#4ec9b0'; ctx.lineWidth = 3; ctx.beginPath();
    if (points.length > 0) {
        const start = mapToPx(points[0].t, points[0].v);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < points.length; i++) {
            const p = mapToPx(points[i].t, points[i].v);
            ctx.lineTo(p.x, p.y);
        }
    }
    ctx.stroke();

    // Blinking Barrier
    if (appState.limitHit) {
        ctx.save();
        const pulse = (Math.sin(Date.now() / 50) + 1) / 2; 
        ctx.strokeStyle = `rgba(255, 50, 50, ${pulse})`; 
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); 
        
        ctx.beginPath();
        ctx.moveTo(appState.limitHitX, PAD.top);
        ctx.lineTo(appState.limitHitX, h - PAD.bottom);
        ctx.stroke();
        ctx.restore();
    }

    // Points
    for (let i = 0; i < points.length; i++) {
        const p = mapToPx(points[i].t, points[i].v);
        ctx.beginPath(); 
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = (i === appState.dragIndex || i === appState.contextTargetIndex) ? '#fff' : '#ce9178';
        ctx.fill();
    }
    
    // Hover
    if (mouse.active) {
        ctx.fillStyle = '#fff';
        const tDisp = (mouse.t / config.timeMult).toFixed(2) + getTimeSuffix();
        const vDisp = (mouse.v / config.voltMult).toFixed(2) + getVoltSuffix();
        ctx.fillText(`(${tDisp}, ${vDisp})`, mouse.x + 10, mouse.y - 10);
        
        // Snap indicator
        const snapped = mapToPx(mouse.t, mouse.v);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(snapped.x, snapped.y, 8, 0, Math.PI * 2);
        ctx.stroke();
    }
}