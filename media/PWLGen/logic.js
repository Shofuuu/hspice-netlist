import { points, config, appState, setPoints, sortPoints, menu } from './state.js';
import { getTimeSuffix, getVoltSuffix } from './utils.js';
import { draw } from './draw.js';

// --- Code Generation ---
export function generateCode() {
    const sig = document.getElementById('sigName').value || 'v1';
    let str = `${sig} ${sig} 0 PWL(\n`;

    const trVal = (typeof config.defTrRaw === 'number' ? config.defTrRaw : 25);
    const tfVal = (typeof config.defTfRaw === 'number' ? config.defTfRaw : 25);
    const slopeUnit = (typeof config.slopeMult === 'number' ? config.slopeMult : 1e-9);

    const safeTr = trVal * slopeUnit;
    const safeTf = tfVal * slopeUnit;

    let lastWriteT = -1;
    let lastWriteV = 0;

    points.forEach((p, i) => {
        let writeT = p.t;
        const writeV = p.v;

        if (i > 0) {
            if (writeT <= lastWriteT + 1e-15) {
                const isRising = writeV > lastWriteV;
                const shift = isRising ? safeTr : safeTf;

                writeT = lastWriteT + shift;
            }
        }

        const tStr = (writeT / config.timeMult).toFixed(3) + getTimeSuffix();
        const vStr = (writeV / config.voltMult).toFixed(3) + getVoltSuffix();
        str += `+ ${tStr} ${vStr}\n`;

        lastWriteT = writeT;
        lastWriteV = writeV;
    });

    str += "+ )";
    document.getElementById('codeOutput').innerText = str;
}

// --- Import Logic ---
export function importFromText(text) {
    const regex = /([0-9\.]+)([pnumsk]?)(?:[\s,]+)([0-9\.]+)([pnumsk]?)/gi;
    let match;
    const newPoints = [];
    const multipliers = { 'p': 1e-12, 'n': 1e-9, 'u': 1e-6, 'm': 1e-3, 'k': 1e3, 's': 1 };

    while ((match = regex.exec(text)) !== null) {
        let tVal = parseFloat(match[1]);
        let tSuff = match[2].toLowerCase();
        let vVal = parseFloat(match[3]);
        let vSuff = match[4].toLowerCase();
        let tMult = multipliers[tSuff] || 1; 
        let vMult = multipliers[vSuff] || 1;
        newPoints.push({ t: tVal * tMult, v: vVal * vMult });
    }

    if (newPoints.length > 0) {
        newPoints.sort((a, b) => a.t - b.t);
        setPoints(newPoints);
        autoScale();
    }
}

export function autoScale() {
    let maxT = 0; let maxV = 0;
    points.forEach(p => {
        if (p.t > maxT) maxT = p.t;
        if (Math.abs(p.v) > maxV) maxV = Math.abs(p.v);
    });

    let best = 1e-9;
    if(maxT > 1) best = 1; else if(maxT > 1e-3) best = 1e-3; else if(maxT > 1e-6) best = 1e-6;
    
    config.timeMult = best;
    config.voltMult = 1; 
    config.maxTimeRaw = Math.ceil((maxT * 1.1) / config.timeMult);
    config.maxVoltsRaw = parseFloat(((maxV * 1.2) / config.voltMult).toFixed(2));

    document.getElementById('maxTime').value = config.maxTimeRaw;
    document.getElementById('maxVolts').value = config.maxVoltsRaw;
    
    const sel = document.getElementById('timeUnit');
    for(let i=0; i<sel.options.length; i++) {
        if(parseFloat(sel.options[i].value) === config.timeMult) sel.selectedIndex = i;
    }
    draw(); generateCode();
}

// --- Snap Logic ---
export function snapToGlobalLevel() {
    if (appState.contextTargetIndex === -1) return;

    const currV = points[appState.contextTargetIndex].v;
    const maxV = config.maxVoltsRaw * config.voltMult;
    const threshold = maxV * 0.45; 

    let uniqueLevels = new Set();
    uniqueLevels.add(0);
    points.forEach((p, idx) => { if(idx !== appState.contextTargetIndex) uniqueLevels.add(p.v); });

    let bestLevel = currV;
    let minDiff = Infinity;

    uniqueLevels.forEach(val => {
        const diff = Math.abs(currV - val);
        if (diff < minDiff) { minDiff = diff; bestLevel = val; }
    });

    if (minDiff < threshold) {
        points[appState.contextTargetIndex].v = bestLevel;
        generateCode(); draw();
    }
    menu.style.display = 'none';
}

// --- Generators ---
export function openGenerator(type) {
    menu.style.display = 'none';
    appState.activeGenType = type;
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('modal-title').innerText = "Generate " + type;

    const suffix = getTimeSuffix();
    const ids = ['gen-unit-period', 'gen-unit-tr', 'gen-unit-tf', 'gen-unit-delay']; 
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerText = suffix;
    });

    document.getElementById('gen-delay').value = 0;

    const dutyRow = document.getElementById('gen-duty').parentElement;
    if(type === 'Square') dutyRow.style.display = 'flex';
    else dutyRow.style.display = 'none';
}

export function closeGenerator() {
    document.getElementById('modal-overlay').style.display = 'none';
}

export function generateConfirmed() {
    const vHigh = parseFloat(document.getElementById('gen-vhigh').value);
    const vLow = parseFloat(document.getElementById('gen-vlow').value);
    const period = parseFloat(document.getElementById('gen-period').value) * config.timeMult;
    const cycles = parseInt(document.getElementById('gen-cycles').value);
    const duty = parseFloat(document.getElementById('gen-duty').value) / 100;
    const tr = parseFloat(document.getElementById('gen-tr').value) * config.timeMult;
    const tf = parseFloat(document.getElementById('gen-tf').value) * config.timeMult;
    const delay = parseFloat(document.getElementById('gen-delay').value || 0) * config.timeMult;

    let newPoints = [];

    if (delay > 0) {
        newPoints.push({ t: 0, v: vLow });
    }

    if (appState.activeGenType === 'Square') {
        for (let i = 0; i < cycles; i++) {
            // Add 'delay' to the start time
            const start = (i * period) + delay;
            const fall = start + (period * duty);

            newPoints.push(
                { t: start, v: vLow }, 
                { t: start + tr, v: vHigh }, 
                { t: fall, v: vHigh }, 
                { t: fall + tf, v: vLow }
            );
        }
    } else if (appState.activeGenType === 'Triangle') {
        for (let i = 0; i < cycles; i++) {
            const start = (i * period) + delay;
            newPoints.push(
                { t: start, v: vLow }, 
                { t: start + period/2, v: vHigh }
            );
        }
    } else if (appState.activeGenType === 'Sawtooth') {
        for (let i = 0; i < cycles; i++) {
            const start = (i * period) + delay;
            newPoints.push(
                { t: start, v: vLow }, 
                { t: start + period - tf, v: vHigh }, 
                { t: start + period, v: vLow }
            );
        }
    }

    newPoints.push({ t: (cycles * period) + delay, v: vLow });
    setPoints(newPoints);
    
    const totalTime = (cycles * period) + delay;
    if (totalTime > config.maxTimeRaw * config.timeMult) {
        config.maxTimeRaw = Math.ceil((totalTime * 1.1) / config.timeMult);
        document.getElementById('maxTime').value = config.maxTimeRaw;
    }
    
    generateCode(); draw(); autoScale(); closeGenerator();
}

export function getSnappedPoint(t, v) {
    let newT = t;
    let newV = v;

    // Snap Time (X)
    if (config.gridXRaw > 0 && config.snapEnabled) {
        const stepT = config.gridXRaw * config.timeMult;
        newT = Math.round(t / stepT) * stepT;
    }

    // Snap Voltage (Y)
    if (config.gridYRaw > 0 && config.snapEnabled) {
        const stepV = config.gridYRaw * config.voltMult;
        newV = Math.round(v / stepV) * stepV;
    }

    return { t: newT, v: newV };
}

export function openGridSettings() {
    menu.style.display = 'none'; // Close context menu
    
    // Update label text to match current units (ns, V, etc.)
    const xUnit = document.getElementById('lbl-grid-x-unit');
    const yUnit = document.getElementById('lbl-grid-y-unit');
    if(xUnit) xUnit.innerText = getTimeSuffix();
    if(yUnit) yUnit.innerText = getVoltSuffix();

    // Fill inputs (show empty if 0/Auto)
    document.getElementById('grid-x').value = config.gridXRaw === 0 ? '' : config.gridXRaw;
    document.getElementById('grid-y').value = config.gridYRaw === 0 ? '' : config.gridYRaw;

    document.getElementById('modal-grid-overlay').style.display = 'flex';
}

export function closeGridSettings() {
    document.getElementById('modal-grid-overlay').style.display = 'none';
}

export function saveGridSettings() {
    const gx = parseFloat(document.getElementById('grid-x').value);
    const gy = parseFloat(document.getElementById('grid-y').value);

    // If NaN or empty, set to 0 (Auto)
    config.gridXRaw = isNaN(gx) ? 0 : gx;
    config.gridYRaw = isNaN(gy) ? 0 : gy;

    closeGridSettings();
    
    // We need to redraw to see the new grid lines. 
    // Since we can't easily import 'draw' here without circular dependency issues 
    // in some setups, we usually trigger it from main or assume it's imported.
    // In your logic.js you ALREADY import { draw } from './draw.js', so call it:
    if (typeof draw === 'function') {
        draw(); 
    } else {
        // Fallback if draw isn't imported correctly
        console.warn("Draw function missing in logic.js");
    }
}

export function openSlopeSettings() {
    menu.style.display = 'none';
    
    // Load current values
    document.getElementById('slope-tr').value = config.defTrRaw;
    document.getElementById('slope-tf').value = config.defTfRaw;
    
    // Set unit selector
    const sel = document.getElementById('slope-unit');
    for(let i=0; i<sel.options.length; i++) {
        if(parseFloat(sel.options[i].value) === config.slopeMult) sel.selectedIndex = i;
    }

    document.getElementById('modal-slope-overlay').style.display = 'flex';
}

export function closeSlopeSettings() {
    document.getElementById('modal-slope-overlay').style.display = 'none';
}

export function saveSlopeSettings() {
    config.defTrRaw = parseFloat(document.getElementById('slope-tr').value) || 0;
    config.defTfRaw = parseFloat(document.getElementById('slope-tf').value) || 0;
    config.slopeMult = parseFloat(document.getElementById('slope-unit').value) || 1e-9;
    
    closeSlopeSettings();
}