// main.js
import { vscode, canvas, menu, points, config, appState, mouse, setPoints, splicePoints, pushPoint, sortPoints } from './state.js';
import { mapToPx, mapToUnits } from './utils.js';
import { draw } from './draw.js';
import { 
    generateCode, 
    importFromText, 
    autoScale, 
    snapToGlobalLevel, 
    openGenerator, 
    closeGenerator, 
    generateConfirmed,
    openGridSettings,
    closeGridSettings,
    saveGridSettings,
    getSnappedPoint // <--- FIX #1: ADD THIS IMPORT
} from './logic.js';

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
        setPoints([{t: 0, v: 0}, {t: config.maxTimeRaw * config.timeMult, v: 0}]);
        draw(); generateCode();
    });

    const fitBtn = document.getElementById('fitBtn');
    if(fitBtn) {
        fitBtn.addEventListener('click', () => {
            // Guard 1: Safety check for empty data
            if (!points || points.length < 2) return;

            // Guard 2: Check for Flat Line (Prevent infinite zoom on default empty state)
            let minV = points[0].v;
            let maxV = points[0].v;
            
            // Find Min/Max manually (faster than spreading a large array)
            for (let i = 1; i < points.length; i++) {
                if (points[i].v < minV) minV = points[i].v;
                if (points[i].v > maxV) maxV = points[i].v;
            }

            // If the signal is flat (difference is basically zero), DO NOTHING.
            // This prevents the "zoomed into nothing" bug on the default 0V line.
            if (Math.abs(maxV - minV) < 1e-15) {
                return; 
            }

            // If we have a real signal, go ahead and scale
            autoScale();
            draw();
        });
    }

    document.getElementById('copyBtn').addEventListener('click', () => {
        vscode.postMessage({ command: 'copy', text: document.getElementById('codeOutput').innerText });
    });

    // Generator Buttons
    document.getElementById('gen-square').addEventListener('click', () => openGenerator('Square'));
    document.getElementById('gen-tri').addEventListener('click', () => openGenerator('Triangle'));
    document.getElementById('gen-saw').addEventListener('click', () => openGenerator('Sawtooth'));
    
    const confirmBtn = document.getElementById('gen-confirm'); 
    if(confirmBtn) confirmBtn.addEventListener('click', generateConfirmed);
    
    const cancelBtn = document.getElementById('gen-cancel');
    if(cancelBtn) cancelBtn.addEventListener('click', closeGenerator);

    // Context Menu
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('click', (e) => { if(e.button===0) menu.style.display = 'none'; });
    document.getElementById('menu-add').addEventListener('click', addPointAtMouse);
    document.getElementById('menu-delete').addEventListener('click', deletePoint);
    document.getElementById('menu-snap').addEventListener('click', snapToGlobalLevel);
    document.getElementById('menu-grid').addEventListener('click', openGridSettings);
    
    // Grid Modal Buttons
    document.getElementById('grid-confirm').addEventListener('click', saveGridSettings);
    document.getElementById('grid-cancel').addEventListener('click', closeGridSettings);

    // Message Listener
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'import') {
            if (message.points && message.points.length > 0) {
                setPoints(message.points);
                autoScale();
            } else if (message.text) {
                importFromText(message.text);
            }
        }
    });

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

function resize() {
    const container = document.getElementById('container');
    if(container && canvas) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        draw();
    }
}

// --- Mouse Interactions ---
canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const hit = findPoint(e.clientX, e.clientY);
    if (hit !== -1) appState.dragIndex = hit;
});

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top; mouse.active = true;
    
    // 1. Get Raw Units
    let u = mapToUnits(mouse.x, mouse.y);
    
    // 2. Apply Snap (New Feature)
    let snapped = getSnappedPoint(u.t, u.v);
    mouse.t = snapped.t;
    mouse.v = snapped.v;

    // 3. Apply Constraints (Blinking Barrier Logic)
    if (appState.dragIndex !== -1) {
        let newT = mouse.t;
        appState.limitHit = false; 

        if (appState.dragIndex > 0) {
            const prev = points[appState.dragIndex - 1];
            
            if (newT <= prev.t) {
                newT = prev.t; // Hit the wall
                appState.limitHit = true;
                appState.limitHitX = mapToPx(newT, 0).x;

                // Smart Y Snapping:
                // Check if the previous point is part of a vertical edge (same time as point before it)
                if (appState.dragIndex > 1) {
                    const prevPrev = points[appState.dragIndex - 2];
                    
                    // If vertical edge exists (time difference is negligible)
                    if (Math.abs(prev.t - prevPrev.t) < 1e-15) {
                        // We are hitting a wall defined by 'prev' and 'prevPrev'
                        // Check which Y value is closer to the mouse
                        const distToPrev = Math.abs(mouse.v - prev.v);
                        const distToPrevPrev = Math.abs(mouse.v - prevPrev.v);
                        
                        // Snap Voltage to the closer corner
                        if (distToPrevPrev < distToPrev) {
                            mouse.v = prevPrev.v;
                        } else {
                            mouse.v = prev.v;
                        }
                    }
                }
            }
        }

        // 2. Check Forward Collision (same logic if dragging right)
        if (appState.dragIndex < points.length - 1) {
            const next = points[appState.dragIndex + 1];
            
            if (newT >= next.t) {
                newT = next.t;
                appState.limitHit = true;
                appState.limitHitX = mapToPx(newT, 0).x;

                if (appState.dragIndex < points.length - 2) {
                    const nextNext = points[appState.dragIndex + 2];
                    if (Math.abs(next.t - nextNext.t) < 1e-15) {
                        const distToNext = Math.abs(mouse.v - next.v);
                        const distToNextNext = Math.abs(mouse.v - nextNext.v);
                        
                        if (distToNextNext < distToNext) {
                            mouse.v = nextNext.v;
                        } else {
                            mouse.v = next.v;
                        }
                    }
                }
            }
        }
        
        points[appState.dragIndex].t = newT;
        points[appState.dragIndex].v = mouse.v;
        generateCode();
    }
});

canvas.addEventListener('mouseup', () => { appState.dragIndex = -1; appState.limitHit = false; });
canvas.addEventListener('mouseleave', () => { mouse.active = false; appState.dragIndex = -1; appState.limitHit = false; });

function findPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left; const y = clientY - rect.top;
    for(let i=0; i<points.length; i++) {
        const p = mapToPx(points[i].t, points[i].v);
        if(Math.abs(x - p.x) < 10 && Math.abs(y - p.y) < 10) return i;
    }
    return -1;
}

// --- Context Menu Actions ---
function onContextMenu(e) {
    e.preventDefault();
    const hit = findPoint(e.clientX, e.clientY);
    appState.contextTargetIndex = hit;
    
    // Capture Snap Position for the menu action
    const rect = canvas.getBoundingClientRect();
    const u = mapToUnits(e.clientX - rect.left, e.clientY - rect.top);
    const snapped = getSnappedPoint(u.t, u.v);
    appState.clickPos = snapped; // Save for addPointAtMouse

    if (hit !== -1) {
        document.getElementById('menu-add').style.display = 'none';
        document.getElementById('menu-delete').style.display = 'block';
        document.getElementById('menu-snap').style.display = 'block';
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
    // <--- FIX #2: USE clickPos, NOT mouse ---
    pushPoint({ t: appState.clickPos.t, v: appState.clickPos.v });
    
    sortPoints();
    generateCode(); draw();
    menu.style.display = 'none';
}

function deletePoint() {
    if(appState.contextTargetIndex !== -1 && points.length > 2) {
        splicePoints(appState.contextTargetIndex, 1);
        generateCode(); draw();
    }
    menu.style.display = 'none';
}

// Start the app
init();