const vscode = acquireVsCodeApi();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('context-menu');

// --- State ---
let points = [{t: 0, v: 0}, {t: 100e-9, v: 0}]; 
let config = { 
    maxTimeRaw: 100,      
    maxVoltsRaw: 3.3,     
    timeMult: 1e-9,       
    voltMult: 1           
};

let dragIndex = -1;
let mouse = { x: 0, y: 0, t: 0, v: 0, active: false };
let contextTargetIndex = -1; 
let activeGenType = ""; 

// Warning State
let limitHit = false; 
let limitHitX = 0; 

const PAD = { left: 50, right: 20, top: 20, bottom: 30 };

// --- Initialization ---
function init() {
    resize();
    window.addEventListener('resize', resize);
    
    // Bind Inputs
    ['maxTime', 'maxVolts', 'timeUnit', 'voltUnit'].forEach(id => 
        document.getElementById(id).addEventListener('change', updateConfig));
    document.getElementById('sigName').addEventListener('input', generateCode);
    
    // Buttons
    document.getElementById('resetBtn').addEventListener('click', () => {
        points = [{t: 0, v: 0}, {t: config.maxTimeRaw * config.timeMult, v: 0}];
        draw(); generateCode();
    });

    document.getElementById('copyBtn').addEventListener('click', () => {
        vscode.postMessage({ command: 'copy', text: document.getElementById('codeOutput').innerText });
    });

    // Context Menu
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('click', (e) => { if(e.button===0) menu.style.display = 'none'; });

    // Menu Actions
    document.getElementById('menu-add').addEventListener('click', addPointAtMouse);
    document.getElementById('menu-delete').addEventListener('click', deletePoint);
    
    // 🔴 UPDATED: Snap now scans the whole design
    document.getElementById('menu-snap').addEventListener('click', snapToGlobalLevel);
    
    // Generators
    document.getElementById('gen-square').addEventListener('click', () => openGenerator('Square'));
    document.getElementById('gen-tri').addEventListener('click', () => openGenerator('Triangle'));
    document.getElementById('gen-saw').addEventListener('click', () => openGenerator('Sawtooth'));

    updateConfig();
    requestAnimationFrame(animLoop);
}

function animLoop() { draw(); requestAnimationFrame(animLoop); }

function updateConfig() {
    config.maxTimeRaw = parseFloat(document.getElementById('maxTime').value) || 100;
    config.maxVoltsRaw = parseFloat(document.getElementById('maxVolts').value) || 3.3;
    config.timeMult = parseFloat(document.getElementById('timeUnit').value) || 1e-9;
    config.voltMult = parseFloat(document.getElementById('voltUnit').value) || 1;
    draw(); generateCode();
}

// --- Import / Converter Logic ---
window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'import') {
        if (message.points && message.points.length > 0) {
            points = message.points;
            autoScale();
        } else if (message.text) {
            importFromText(message.text);
        }
    }
});

function importFromText(text) {
    // 🔴 IMPROVED REGEX: Handles spaces OR commas (common in SPICE)
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
        points = newPoints;
        autoScale();
    }
}

function autoScale() {
    let maxT = 0; let maxV = 0;
    points.forEach(p => {
        if (p.t > maxT) maxT = p.t;
        if (Math.abs(p.v) > maxV) maxV = Math.abs(p.v);
    });

    // Heuristic for time units
    let best = 1e-9;
    if(maxT > 1) best = 1; 
    else if(maxT > 1e-3) best = 1e-3;
    else if(maxT > 1e-6) best = 1e-6;
    
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

// --- Coordinate Mapping ---
function mapToPx(t, v) {
    const drawW = canvas.width - PAD.left - PAD.right;
    const drawH = canvas.height - PAD.top - PAD.bottom;
    const maxT = config.maxTimeRaw * config.timeMult;
    const maxV = config.maxVoltsRaw * config.voltMult;
    const x = PAD.left + (t / maxT) * drawW;
    const y = (PAD.top + drawH) - (v / maxV) * drawH;
    return {x, y};
}

function mapToUnits(x, y) {
    const drawW = canvas.width - PAD.left - PAD.right;
    const drawH = canvas.height - PAD.top - PAD.bottom;
    const maxT = config.maxTimeRaw * config.timeMult;
    const maxV = config.maxVoltsRaw * config.voltMult;
    let t = ((x - PAD.left) / drawW) * maxT;
    let v = ((PAD.top + drawH - y) / drawH) * maxV;
    t = Math.max(0, Math.min(t, maxT));
    v = Math.max(0, Math.min(v, maxV));
    return {t, v};
}

// --- Drawing ---
function draw() {
    const w = canvas.width; const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    // Grid
    ctx.strokeStyle = '#333'; ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.lineWidth = 1;
    for(let i=0; i<=5; i++) {
        const val = (config.maxTimeRaw / 5) * i;
        const px = mapToPx(val * config.timeMult, 0).x;
        ctx.beginPath(); ctx.moveTo(px, PAD.top); ctx.lineTo(px, h - PAD.bottom); ctx.stroke();
        ctx.fillText(formatNumber(val) + getTimeSuffix(), px - 10, h - 5);
    }
    for(let i=0; i<=4; i++) {
        const val = (config.maxVoltsRaw / 4) * i;
        const py = mapToPx(0, val * config.voltMult).y;
        ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(w - PAD.right, py); ctx.stroke();
        ctx.fillText(formatNumber(val) + getVoltSuffix(), 5, py + 3);
    }

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

    // 🔴 BLINKING BARRIER (Vertical Line)
    if (limitHit) {
        ctx.save();
        const pulse = (Math.sin(Date.now() / 50) + 1) / 2; 
        ctx.strokeStyle = `rgba(255, 50, 50, ${pulse})`; // Red Pulsing
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Dashed
        
        ctx.beginPath();
        ctx.moveTo(limitHitX, PAD.top);
        ctx.lineTo(limitHitX, h - PAD.bottom);
        ctx.stroke();
        ctx.restore();
    }

    // Points
    for (let i = 0; i < points.length; i++) {
        const p = mapToPx(points[i].t, points[i].v);
        ctx.beginPath(); 
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = (i === dragIndex || i === contextTargetIndex) ? '#fff' : '#ce9178';
        ctx.fill();
    }
    
    // Hover
    if (mouse.active) {
        ctx.fillStyle = '#fff';
        const tDisp = (mouse.t / config.timeMult).toFixed(2) + getTimeSuffix();
        const vDisp = (mouse.v / config.voltMult).toFixed(2) + getVoltSuffix();
        ctx.fillText(`(${tDisp}, ${vDisp})`, mouse.x + 10, mouse.y - 10);
    }
}

// --- Helpers ---
function formatNumber(n) { return (Math.round(n * 100) / 100).toString(); }
function getTimeSuffix() {
    const m = config.timeMult;
    if(m===1e-12) return 'ps'; if(m===1e-9) return 'ns'; if(m===1e-6) return 'u'; if(m===1e-3) return 'm'; return 's';
}
function getVoltSuffix() {
    const m = config.voltMult;
    if(m===1e-3) return 'mV'; if(m===1e3) return 'kV'; return 'v';
}

function generateCode() {
    const sig = document.getElementById('sigName').value || 'v1';
    let str = `${sig} ${sig} 0 PWL(\n`;
    points.forEach(p => {
        const t = (p.t / config.timeMult).toFixed(3) + getTimeSuffix();
        const v = (p.v / config.voltMult).toFixed(3) + getVoltSuffix();
        str += `+ ${t} ${v}\n`;
    });
    str += "+ )";
    document.getElementById('codeOutput').innerText = str;
}

// --- Interactions ---
canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const hit = findPoint(e.clientX, e.clientY);
    if (hit !== -1) dragIndex = hit;
});

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top; mouse.active = true;
    const u = mapToUnits(mouse.x, mouse.y); mouse.t = u.t; mouse.v = u.v;

    if (dragIndex !== -1) {
        let newT = mouse.t;
        limitHit = false; 

        // 🔴 CHECK LIMITS (Neighbor Time)
        if (dragIndex > 0) {
            if (newT <= points[dragIndex - 1].t) {
                newT = points[dragIndex - 1].t;
                limitHit = true;
                limitHitX = mapToPx(newT, 0).x; // Save X for drawing barrier
            }
        }
        if (dragIndex < points.length - 1) {
            if (newT >= points[dragIndex + 1].t) {
                newT = points[dragIndex + 1].t;
                limitHit = true;
                limitHitX = mapToPx(newT, 0).x; // Save X for drawing barrier
            }
        }
        
        points[dragIndex].t = newT;
        points[dragIndex].v = mouse.v;
        generateCode();
    }
});
canvas.addEventListener('mouseup', () => { dragIndex = -1; limitHit = false; });
canvas.addEventListener('mouseleave', () => { mouse.active = false; dragIndex = -1; limitHit = false; });

function findPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left; const y = clientY - rect.top;
    for(let i=0; i<points.length; i++) {
        const p = mapToPx(points[i].t, points[i].v);
        if(Math.abs(x - p.x) < 10 && Math.abs(y - p.y) < 10) return i;
    }
    return -1;
}

// --- Context Menu ---
function onContextMenu(e) {
    e.preventDefault();
    const hit = findPoint(e.clientX, e.clientY);
    contextTargetIndex = hit;

    if (hit !== -1) {
        document.getElementById('menu-add').style.display = 'none';
        document.getElementById('menu-delete').style.display = 'block';
        
        const snapBtn = document.getElementById('menu-snap');
        snapBtn.style.display = 'block';
        snapBtn.innerText = "Snap to Nearest Y"; 
    } else {
        document.getElementById('menu-add').style.display = 'block';
        document.getElementById('menu-delete').style.display = 'none';
        document.getElementById('menu-snap').style.display = 'none';
    }

    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.style.display = 'block';
}

function addPointAtMouse() {
    points.push({ t: mouse.t, v: mouse.v });
    points.sort((a,b) => a.t - b.t);
    generateCode(); draw();
    menu.style.display = 'none';
}

function deletePoint() {
    if(contextTargetIndex !== -1 && points.length > 2) {
        points.splice(contextTargetIndex, 1);
        generateCode(); draw();
    }
    menu.style.display = 'none';
}

// 🔴 FIXED SNAP LOGIC: Scans ALL points for unique levels
function snapToGlobalLevel() {
    if (contextTargetIndex === -1) return;

    const currV = points[contextTargetIndex].v;
    const maxV = config.maxVoltsRaw * config.voltMult;
    
    // 10% of Full Scale is the "magnet" radius
    const threshold = maxV * 0.10; 

    // 1. Collect all unique voltage levels from OTHER points + Ground
    let uniqueLevels = new Set();
    uniqueLevels.add(0); // Always snap to ground
    points.forEach((p, idx) => {
        if(idx !== contextTargetIndex) uniqueLevels.add(p.v);
    });

    // 2. Find the closest one
    let bestLevel = currV;
    let minDiff = Infinity;
    let foundSnap = false;

    uniqueLevels.forEach(val => {
        const diff = Math.abs(currV - val);
        if (diff < minDiff) {
            minDiff = diff;
            bestLevel = val;
        }
    });

    // 3. Apply if within threshold
    if (minDiff < threshold) {
        points[contextTargetIndex].v = bestLevel;
        generateCode(); 
        draw();
    }
    menu.style.display = 'none';
}

// --- Generators ---
window.openGenerator = function(type) {
    menu.style.display = 'none';
    activeGenType = type;
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('modal-title').innerText = "Generate " + type;
};
window.closeGenerator = function() {
    document.getElementById('modal-overlay').style.display = 'none';
};
window.generateConfirmed = function() {
    const vHigh = parseFloat(document.getElementById('gen-vhigh').value);
    const vLow = parseFloat(document.getElementById('gen-vlow').value);
    const period = parseFloat(document.getElementById('gen-period').value) * 1e-9;
    const cycles = parseInt(document.getElementById('gen-cycles').value);
    const duty = parseFloat(document.getElementById('gen-duty').value) / 100;
    const tr = parseFloat(document.getElementById('gen-tr').value) * 1e-9;
    const tf = parseFloat(document.getElementById('gen-tf').value) * 1e-9;

    let newPoints = [];
    if (activeGenType === 'Square') {
        for (let i = 0; i < cycles; i++) {
            const start = i * period;
            const fall = start + (period * duty);
            newPoints.push({ t: start, v: vLow });
            newPoints.push({ t: start + tr, v: vHigh });
            newPoints.push({ t: fall, v: vHigh });
            newPoints.push({ t: fall + tf, v: vLow });
        }
    } else if (activeGenType === 'Triangle') {
        for (let i = 0; i < cycles; i++) {
            const start = i * period;
            newPoints.push({ t: start, v: vLow });
            newPoints.push({ t: start + period/2, v: vHigh });
        }
    } else if (activeGenType === 'Sawtooth') {
        for (let i = 0; i < cycles; i++) {
            const start = i * period;
            newPoints.push({ t: start, v: vLow });
            newPoints.push({ t: start + period - tf, v: vHigh });
            newPoints.push({ t: start + period, v: vLow });
        }
    }
    newPoints.push({ t: cycles * period, v: vLow });
    points = newPoints;
    
    // Auto Scale
    const totalTime = cycles * period;
    if (totalTime > config.maxTimeRaw * config.timeMult) {
        config.maxTimeRaw = Math.ceil((totalTime * 1.1) / config.timeMult);
        document.getElementById('maxTime').value = config.maxTimeRaw;
        updateConfig();
    }
    
    generateCode(); draw(); closeGenerator();
};

function resize() {
    const container = document.getElementById('container');
    if(container && canvas) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        draw();
    }
}

init();