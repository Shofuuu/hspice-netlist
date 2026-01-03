import { config, signals, globalParams, setGlobalParams, addSignalToState, removeSignalFromState, findSignal, LAYOUT } from './state.js';
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
    globalTimeUnit: document.getElementById('globalTimeUnit'),
    globalParamBtn: document.getElementById('globalParamBtn'),
    globalParamModal: document.getElementById('globalParamModal'),
    globalParamsList: document.getElementById('globalParamsList'),
    addGlobalParamBtn: document.getElementById('addGlobalParamBtn'),
    globalParamType: document.getElementById('globalParamType'),
    confirmGlobal: document.getElementById('saveGlobal'),
    cancelGlobal: document.getElementById('cancelGlobal')
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

// Master list of available parameters
const PARAM_OPTIONS = [
    { value: 'tr', label: 'Rise Time (tr)' },
    { value: 'tf', label: 'Fall Time (tf)' },
    { value: 'pw', label: 'Pulse Width (pw)' },
    { value: 'per', label: 'Period (per)' },
    { value: 'v1', label: 'Voltage 1 (v1)' },
    { value: 'v2', label: 'Voltage 2 (v2)' },
    { value: 'freq', label: 'Frequency (freq)' },
    { value: 'td', label: 'Time Delay (td)' }
];

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

    elements.globalParamBtn.onclick = openGlobalModal;
    elements.addGlobalParamBtn.onclick = addGlobalParamItemUI;
    elements.cancelGlobal.onclick = () => elements.globalParamModal.style.display = 'none';
    elements.confirmGlobal.onclick = saveGlobalParams;

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
let tempGlobalParams = [];

function openGlobalModal() {
    // Clone existing globals to temp state
    tempGlobalParams = globalParams.map(p => ({...p}));
    renderGlobalParamsList();
    updateParamDropdown();
    elements.globalParamModal.style.display = 'flex';
}

function renderGlobalParamsList() {
    elements.globalParamsList.innerHTML = '';
    tempGlobalParams.forEach((gp, index) => {
        const div = document.createElement('div');
        div.className = 'global-param-item';
        div.innerHTML = `
            <span class="gp-label">${gp.type}</span>
            <input type="text" class="gp-input" placeholder="Param Name" value="${gp.name}" onchange="updateTempGlobal(${index}, 'name', this.value)">
            <input type="text" class="gp-input" placeholder="Value (e.g. 1n)" value="${gp.value}" onchange="updateTempGlobal(${index}, 'value', this.value)">
            <button class="btn-icon danger" onclick="removeTempGlobal(${index})">&times;</button>
        `;
        elements.globalParamsList.appendChild(div);
    });
}

function updateParamDropdown() {
    const select = elements.globalParamType;
    if (!select) return;

    // Get types that are already used
    const usedTypes = tempGlobalParams.map(p => p.type);

    // Clear existing options
    select.innerHTML = '';

    // Add only unused options
    PARAM_OPTIONS.forEach(opt => {
        if (!usedTypes.includes(opt.value)) {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        }
    });

    // Disable the Add button if no options are left
    elements.addGlobalParamBtn.disabled = (select.options.length === 0);
}

// Expose these to window so HTML strings can call them
window.updateTempGlobal = (index, field, val) => {
    tempGlobalParams[index][field] = val;
};
window.removeTempGlobal = (index) => {
    tempGlobalParams.splice(index, 1);
    renderGlobalParamsList();
    updateParamDropdown();
};

function addGlobalParamItemUI() {
    const type = elements.globalParamType.value;
    // Default naming convention
    const count = tempGlobalParams.filter(p => p.type === type).length + 1;
    const name = `g_${type}${count > 1 ? count : ''}`;
    
    tempGlobalParams.push({
        type: type,
        name: name,
        value: '1n' // default value
    });
    renderGlobalParamsList();
    updateParamDropdown();
}

function saveGlobalParams() {
    setGlobalParams(tempGlobalParams);
    
    signals.forEach(s => {
        tempGlobalParams.forEach(gp => {
            if (s.params.hasOwnProperty(gp.type)) {
                s.params[gp.type] = gp.name;
            }
        });
    });

    elements.globalParamModal.style.display = 'none';
    refreshAllCanvases(); 
    generateCode();       
}

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
            let absVal = Math.abs(num);
            if (absVal === 0) absVal = 0.1; 

            // Calculate magnitude (power of 10)
            // e.g., for 50 -> 10, for 1 -> 1, for 0.9 -> 0.1
            let power = Math.floor(Math.log10(absVal));
            let step = Math.pow(10, power);

            const isPowerOf10 = Math.abs(absVal - step) < Number.EPSILON * 100;
            
            if (direction < 0 && isPowerOf10) {
                step /= 10;
            }

            num += (direction * step);

            // Rounding to fix floating point errors (e.g. 0.300000004)
            const decimals = Math.max(0, -Math.floor(Math.log10(step)));
            num = parseFloat(num.toFixed(decimals));

            // Prevent going to 0 or negative if that's not desired (optional safety)
            // For now, we allow it, but the new logic makes hitting 0 much harder.
            // If you strictly want to avoid 0/negative for time params:
            // if (num <= 0 && ['tr','tf','pw','per'].includes(inputElement.dataset.key)) num = step;
            inputElement.value = num + suffix;
            
            inputElement.dispatchEvent(new Event('input'));
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

// --- Signals Logic ---

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

// --- NEW: DUPLICATE FUNCTION ---
function duplicateSignal(id) {
    const original = findSignal(id);
    if (!original) return;

    // Create a deep copy of properties
    const newId = 'sig_' + Date.now() + Math.floor(Math.random() * 1000);
    const newName = original.name + '_cp'; // Append _cp to avoid name collision
    const newParams = { ...original.params }; // Clone the parameters object

    const newSignal = {
        id: newId,
        type: original.type,
        name: newName,
        params: newParams
    };

    addSignalToState(newSignal);
    renderCard(newSignal);
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

// Expose functions to window so HTML onClick works
window.deleteSignal = deleteSignal; 
window.duplicateSignal = duplicateSignal; // <--- EXPOSED HERE
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

    // Added Copy Button (middle)
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
                <button class="btn-icon" onclick="duplicateSignal('${signal.id}')" title="Duplicate">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
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