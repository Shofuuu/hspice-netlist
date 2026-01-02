import { config, signals, addSignalToState, removeSignalFromState, findSignal, LAYOUT } from './state.js';
import { getDefaults } from './utils.js';
import { drawPreview, drawGlobalRuler } from './draw.js';
import { generateCode, copyCode, parseImportedCode } from './generator.js';

// --- DOM Cache ---
const elements = {
    container: document.getElementById('cardContainer'),
    emptyState: document.getElementById('empty-state'),
    addModal: document.getElementById('addModal'),
    editModal: document.getElementById('editModal'),
    editParamsContainer: document.getElementById('editParamsContainer'),
    globalMaxTime: document.getElementById('globalMaxTime'),
    globalTimeUnit: document.getElementById('globalTimeUnit')
};

let currentEditingId = null; 
let cursorState = { active: false, t: 0, y: 0, activeId: null };

// --- TOOLTIP DEFINITIONS ---
const paramTooltips = {
    // Pulse
    'v1': 'Initial Voltage level (Volts)',
    'v2': 'Pulse Voltage level (Volts)',
    'td': 'Time Delay before start (Seconds)',
    'tr': 'Rise Time (Seconds)',
    'tf': 'Fall Time (Seconds)',
    'pw': 'Pulse Width (active duration)',
    'per': 'Period (Total cycle time)',
    
    // Sin
    'vo': 'Voltage Offset (DC Bias)',
    'va': 'Voltage Amplitude (Peak)',
    'freq': 'Frequency (Hz)',
    'damp': 'Damping Factor (decay rate)',
    'phase': 'Phase Shift (Degrees)'
};

// --- Initialization ---
init();

function init() {
    document.getElementById('addSignalBtn').onclick = () => openModal('add');
    document.getElementById('copyBtn').onclick = copyCode;

    elements.globalMaxTime.oninput = (e) => { 
        config.maxTimeRaw = parseFloat(e.target.value); 
        refreshAllCanvases(); 
    };
    elements.globalTimeUnit.onchange = (e) => { 
        config.timeMult = parseFloat(e.target.value); 
        refreshAllCanvases(); 
    };

    window.addEventListener('resize', () => refreshAllCanvases());
    setTimeout(() => refreshAllCanvases(), 100);

    document.getElementById('cancelAdd').onclick = () => closeModal('add');
    document.getElementById('confirmAdd').onclick = () => {
        const type = document.getElementById('newSignalType').value;
        addSignal(type);
        closeModal('add');
    };
    document.getElementById('cancelEdit').onclick = () => closeModal('edit');
    document.getElementById('confirmEdit').onclick = saveEditModal;

    elements.container.addEventListener('input', (e) => {
        if (e.target.dataset.type === 'name') {
            updateName(e.target.dataset.id, e.target.value);
        }
    });

    window.addEventListener('message', event => {
        if (event.data.text) {
            const imported = parseImportedCode(event.data.text);
            imported.forEach(s => addSignal(s.type, s));
        }
    });

    setupCrosshairInteraction();
}

function setupCrosshairInteraction() {
    const container = elements.container;
    container.addEventListener('mousemove', (e) => {
        const target = e.target;
        if (target.tagName !== 'CANVAS') {
            cursorState.active = false;
            requestAnimationFrame(refreshAllCanvases);
            return;
        }

        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const { PAD_LEFT, PAD_RIGHT } = LAYOUT;
        const w = rect.width;
        const drawW = w - PAD_LEFT - PAD_RIGHT;
        const maxT = config.maxTimeRaw * config.timeMult;

        let t = ((x - PAD_LEFT) / drawW) * maxT;
        if (t < 0) t = 0;
        if (t > maxT) t = maxT;

        const signalId = target.id.replace('cvs_', '');
        cursorState = { active: true, t: t, y: y, activeId: signalId };
        requestAnimationFrame(refreshAllCanvases);
    });

    container.addEventListener('mouseleave', () => {
        cursorState.active = false;
        requestAnimationFrame(refreshAllCanvases);
    });
}

// --- Modals ---
function openModal(type) {
    if (type === 'add') elements.addModal.style.display = 'flex';
    if (type === 'edit') elements.editModal.style.display = 'flex';
}

function closeModal(type) {
    if (type === 'add') elements.addModal.style.display = 'none';
    if (type === 'edit') elements.editModal.style.display = 'none';
}

function openEditModal(id) {
    const s = findSignal(id);
    if (!s) return;
    currentEditingId = id;
    elements.editParamsContainer.innerHTML = ''; 

    for (const [key, val] of Object.entries(s.params)) {
        const row = document.createElement('div');
        row.className = 'form-row';
        
        // Tooltip logic
        const tipText = paramTooltips[key] || '';
        const tooltipHtml = tipText 
            ? `<div class="tooltip-icon">i<span class="tooltip-text">${tipText}</span></div>` 
            : '';

        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:5px; flex:1;">
                <label>${key.toUpperCase()}</label>
                ${tooltipHtml}
            </div>
            <input type="text" value="${val}" class="edit-param-input" data-key="${key}">
        `;
        elements.editParamsContainer.appendChild(row);
    }

    const inputs = elements.editParamsContainer.querySelectorAll('.edit-param-input');
    inputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveEditModal(); 
            else if (e.key === 'ArrowUp') { e.preventDefault(); adjustInputValue(input, 1); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); adjustInputValue(input, -1); }
        });
        input.addEventListener('wheel', (e) => {
            e.preventDefault(); 
            const dir = e.deltaY < 0 ? 1 : -1;
            adjustInputValue(input, dir);
        });
    });

    openModal('edit');
    if(inputs.length > 0) inputs[0].focus();
}

function adjustInputValue(inputElement, direction) {
    let valStr = inputElement.value.trim();
    const match = valStr.match(/^([\d\.-]+)([a-z]*)$/i);
    if (match) {
        let num = parseFloat(match[1]);
        const suffix = match[2];
        if (!isNaN(num)) {
            let step = 1;
            if (match[1].includes('.')) step = 0.1;
            num += (direction * step);
            if (step < 1) {
                const parts = match[1].split('.');
                const decimals = parts[1] ? parts[1].length : 1;
                num = parseFloat(num.toFixed(decimals));
            }
            inputElement.value = num + suffix;
        }
    }
}

function saveEditModal() {
    if (!currentEditingId) return;
    const s = findSignal(currentEditingId);
    if (s) {
        const inputs = elements.editParamsContainer.querySelectorAll('.edit-param-input');
        inputs.forEach(input => {
            s.params[input.dataset.key] = input.value;
        });
        refreshAllCanvases(); 
        generateCode();
    }
    closeModal('edit');
}

// --- Signals (No Changes Needed Here) ---
function addSignal(type, defaults = {}) {
    const id = 'sig_' + Date.now() + Math.floor(Math.random() * 1000);
    const name = defaults.name || (type === 'pulse' ? `vpulse${signals.length+1}` : `vsin${signals.length+1}`);
    const params = defaults.params || getDefaults(type);
    const signal = { id, type, name, params };
    addSignalToState(signal);
    renderCard(signal);
    checkEmptyState();
    generateCode(); 
}

function deleteSignal(id) {
    removeSignalFromState(id);
    const card = document.getElementById(id);
    if(card) card.remove();
    checkEmptyState();
    generateCode();
}

window.deleteSignal = deleteSignal; 
window.openEditModal = openEditModal; 

function checkEmptyState() {
    elements.emptyState.style.display = signals.length === 0 ? 'block' : 'none';
}

function updateName(id, val) {
    const s = findSignal(id);
    if(s) { s.name = val; generateCode(); }
}

function refreshAllCanvases() {
    drawGlobalRuler(cursorState);
    signals.forEach(s => drawPreview(s, cursorState));
}

function renderCard(signal) {
    const card = document.createElement('div');
    card.className = 'signal-card';
    card.id = signal.id;

    const headerHtml = `
        <div class="card-header">
            <div class="card-title">
                <span class="card-type">${signal.type}</span>
                <input type="text" class="card-name-input" value="${signal.name}" data-type="name" data-id="${signal.id}" title="Rename">
            </div>
            <div class="card-controls">
                <button class="btn-icon" onclick="openEditModal('${signal.id}')" title="Settings">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                </button>
                <button class="btn-icon danger" onclick="deleteSignal('${signal.id}')" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>`;
    const canvasHtml = `
        <div class="card-canvas-container">
            <canvas id="cvs_${signal.id}"></canvas>
        </div>`;
    card.innerHTML = headerHtml + canvasHtml;
    elements.container.appendChild(card);
    setTimeout(() => refreshAllCanvases(), 10);
}