export const vscode = acquireVsCodeApi();

export const config = { 
    maxTimeRaw: 10, 
    timeMult: 1e-6 
};

export let signals = [];
export let globalParams = []; 

export const LAYOUT = {
    PAD_LEFT: 45,  
    PAD_RIGHT: 10,
    PAD_TOP: 8,    
    PAD_BOTTOM: 8  
};

export function addSignalToState(signal) { signals.push(signal); }
export function removeSignalFromState(id) { signals = signals.filter(s => s.id !== id); }
export function findSignal(id) { return signals.find(s => s.id === id); }
export function setGlobalParams(params) { globalParams = params; }
export function clearSignals() { signals = []; globalParams = []; }