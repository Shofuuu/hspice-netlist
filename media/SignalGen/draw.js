import { config, LAYOUT } from './state.js';
import { parseParamsToNum, formatEng } from './utils.js';

// --- Draw Global X-Axis Ruler ---
export function drawGlobalRuler(cursor) {
    const canvas = document.getElementById('rulerCanvas');
    const container = document.getElementById('cardContainer');
    if (!canvas || !container) return;

    // ALIGNMENT FIX: Match the width of the card container (excluding scrollbar)
    // We leave the canvas element wide, but we restrict drawing to the container's clientWidth
    const alignedWidth = container.clientWidth;
    
    // Resize internal bitmap to match screen pixels for sharpness
    const rect = canvas.parentElement.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    const ctx = canvas.getContext('2d');
    const h = canvas.height;
    const { PAD_LEFT, PAD_RIGHT } = LAYOUT;

    ctx.clearRect(0, 0, canvas.width, h);

    // Use alignedWidth for calculations, not canvas.width
    const drawW = alignedWidth - PAD_LEFT - PAD_RIGHT;
    const maxT = config.maxTimeRaw * config.timeMult;

    // --- Draw Ticks ---
    ctx.fillStyle = '#e0e0e0'; 
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tickColor = '#999';

    const steps = 10;
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * maxT;
        const x = PAD_LEFT + (i / steps) * drawW;

        ctx.beginPath();
        ctx.strokeStyle = tickColor;
        ctx.lineWidth = 1;
        ctx.moveTo(x, 0); 
        ctx.lineTo(x, 6); 
        ctx.stroke();

        const label = formatEng(t);
        // Only draw label if it fits
        if (x < alignedWidth - 10) {
            ctx.fillText(label, x, 8);
        }
    }

    // --- Draw Cursor Indicator on Ruler ---
    if (cursor && cursor.active && cursor.t !== null) {
        const x = PAD_LEFT + (cursor.t / maxT) * drawW;
        if (x < alignedWidth) { // Clip to align area
            ctx.fillStyle = '#f48771'; // Red highlight
            ctx.beginPath();
            ctx.moveTo(x - 4, 0);
            ctx.lineTo(x + 4, 0);
            ctx.lineTo(x, 6);
            ctx.fill();
        }
    }
}

// --- Draw Card Waveform ---
export function drawPreview(signal, cursor) {
    const canvas = document.getElementById(`cvs_${signal.id}`);
    if (!canvas) return;

    // Auto-resize
    const rect = canvas.parentElement.getBoundingClientRect();
    if(canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const { PAD_LEFT, PAD_RIGHT, PAD_TOP, PAD_BOTTOM } = LAYOUT;

    ctx.clearRect(0,0,w,h);

    const drawW = w - PAD_LEFT - PAD_RIGHT;
    const drawH = h - PAD_TOP - PAD_BOTTOM;

    // --- 1. Grid ---
    ctx.beginPath();
    ctx.strokeStyle = '#444'; 
    ctx.lineWidth = 0.5;
    for(let i=0; i<=10; i++) {
        const x = PAD_LEFT + (i/10) * drawW;
        ctx.moveTo(x, PAD_TOP); 
        ctx.lineTo(x, h - PAD_BOTTOM);
    }
    ctx.stroke();

    const p = parseParamsToNum(signal.params);

    // --- 2. Calculate Scale ---
    let vMin = 0, vMax = 1;
    if (signal.type === 'pulse') {
        vMin = Math.min(p.v1, p.v2);
        vMax = Math.max(p.v1, p.v2);
    } else {
        vMin = p.vo - p.va;
        vMax = p.vo + p.va;
    }
    
    let vRange = (vMax - vMin);
    if(vRange === 0) vRange = 1;
    const paddingVal = vRange * 0.1;
    const scaleMin = vMin - paddingVal;
    const scaleMax = vMax + paddingVal;
    const scaleRange = scaleMax - scaleMin;

    const maxT = config.maxTimeRaw * config.timeMult;
    const mapX = (t) => PAD_LEFT + (t / maxT) * drawW;
    const mapY = (v) => (PAD_TOP + drawH) - ((v - scaleMin) / scaleRange) * drawH;

    // --- 3. Y-Axis Labels ---
    ctx.fillStyle = '#e0e0e0';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#666';

    const yLabels = [vMin, (vMin+vMax)/2, vMax];
    yLabels.forEach(val => {
        const yPos = mapY(val);
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT, yPos);
        ctx.lineTo(w - PAD_RIGHT, yPos);
        ctx.stroke();
        ctx.fillText(formatEng(val) + "V", PAD_LEFT - 6, yPos);
    });

    if (0 > scaleMin && 0 < scaleMax) {
        const y0 = mapY(0);
        ctx.beginPath();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        ctx.moveTo(PAD_LEFT, y0);
        ctx.lineTo(w - PAD_RIGHT, y0);
        ctx.stroke();
    }

    // --- 4. Draw Waveform ---
    ctx.beginPath();
    ctx.strokeStyle = '#4caf50'; 
    ctx.lineWidth = 2;

    if (signal.type === 'pulse') {
        const { v1, v2, td, tr, tf, pw, per } = p;
        ctx.moveTo(mapX(0), mapY(v1));
        
        if (per <= 0 || per < maxT / 5000) {
            ctx.lineTo(mapX(maxT), mapY(v1)); 
        } else {
            ctx.lineTo(mapX(td), mapY(v1));
            let currentPeriodStart = td;
            let safety = 0;
            while (currentPeriodStart < maxT && safety < 3000) {
                const tRiseEnd = currentPeriodStart + tr;
                const tFallStart = tRiseEnd + pw;
                const tFallEnd = tFallStart + tf;
                const tNext = currentPeriodStart + per;
                ctx.lineTo(mapX(tRiseEnd), mapY(v2));
                ctx.lineTo(mapX(tFallStart), mapY(v2));
                ctx.lineTo(mapX(tFallEnd), mapY(v1));
                ctx.lineTo(mapX(tNext), mapY(v1));
                currentPeriodStart = tNext;
                safety++;
            }
        }
    } else if (signal.type === 'sin') {
        const { vo, va, freq, td, damp, phase } = p;
        const phaseRad = phase * (Math.PI / 180);
        const step = maxT / 200;
        for (let t = 0; t <= maxT; t += step) {
            let val = vo; 
            if (t >= td) {
                const dt = t - td;
                const damping = Math.exp(-damp * dt);
                val = vo + va * damping * Math.sin(2 * Math.PI * freq * dt + phaseRad);
            }
            const x = mapX(t);
            const y = mapY(val);
            if (t===0) ctx.moveTo(x,y);
            else ctx.lineTo(x,y);
        }
    }
    ctx.stroke();

    // --- 5. CROSSHAIR & TOOLTIP ---
    if (cursor && cursor.active) {
        const cursorColor = '#f48771'; // Reddish
        
        // A. Global Time Line (Vertical)
        // We calculate X based on the cursor Time to ensure perfect sync
        const xPos = mapX(cursor.t);
        
        // Only draw if within bounds
        if (xPos >= PAD_LEFT && xPos <= w - PAD_RIGHT) {
            ctx.beginPath();
            ctx.strokeStyle = cursorColor;
            ctx.setLineDash([4, 2]); // Dashed line
            ctx.lineWidth = 1;
            ctx.moveTo(xPos, PAD_TOP);
            ctx.lineTo(xPos, h - PAD_BOTTOM);
            ctx.stroke();
            ctx.setLineDash([]); // Reset
        }

        // B. Local Voltage Line (Horizontal) - Only on active card
        if (signal.id === cursor.activeId) {
            const yPos = cursor.y; // Mouse Y is already local pixel coord
            
            // Convert pixel Y back to Voltage for display
            // Inverse of mapY: v = scaleMin + ((PAD_TOP + drawH - y) / drawH) * scaleRange
            const valAtCursor = scaleMin + ((PAD_TOP + drawH - yPos) / drawH) * scaleRange;

            // Draw Horizontal Line
            if (yPos >= PAD_TOP && yPos <= h - PAD_BOTTOM) {
                ctx.beginPath();
                ctx.strokeStyle = cursorColor;
                ctx.lineWidth = 1;
                ctx.moveTo(PAD_LEFT, yPos);
                ctx.lineTo(w - PAD_RIGHT, yPos);
                ctx.stroke();

                // Draw Tooltip (Floating Box)
                const text = `T: ${formatEng(cursor.t)}s  V: ${formatEng(valAtCursor)}V`;
                const textWidth = ctx.measureText(text).width;
                
                // Smart positioning (don't go off screen)
                let tx = xPos + 10;
                let ty = yPos - 10;
                if (tx + textWidth > w) tx = xPos - textWidth - 10;
                if (ty < 20) ty = yPos + 20;

                // Box
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(tx - 4, ty - 12, textWidth + 8, 16);
                
                // Text
                ctx.fillStyle = '#fff';
                ctx.font = '11px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(text, tx, ty);
            }
        }
    }
    
    // Border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD_LEFT, PAD_TOP, drawW, drawH);
}