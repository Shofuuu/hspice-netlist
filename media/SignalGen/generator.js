// media/SignalGen/generator.js
import { signals, vscode } from './state.js';

export function generateCode() {
    const output = document.getElementById('outputCode');
    if(!output) return;

    let code = `* HSPICE Signal Generation\n`;
    signals.forEach(s => {
        const p = s.params;
        code += `${s.name} ${s.name} 0 `; 
        if (s.type === 'pulse') {
            code += `PULSE(${p.v1} ${p.v2} ${p.td} ${p.tr} ${p.tf} ${p.pw} ${p.per})`;
        } else {
            code += `SIN(${p.vo} ${p.va} ${p.freq} ${p.td} ${p.damp} ${p.phase})`;
        }
        code += '\n';
    });
    output.value = code;
}

export function copyCode() {
    const output = document.getElementById('outputCode');
    output.select();
    document.execCommand('copy'); 
    vscode.postMessage({ command: 'copy', text: output.value });
}

export function parseImportedCode(text) {
    const lines = text.split('\n');
    const newSignals = [];
    
    const pulseReg = /^(\w+)\s+\w+\s+\w+\s+PULSE\s*\(([^)]+)\)/i;
    const sinReg = /^(\w+)\s+\w+\s+\w+\s+SIN\s*\(([^)]+)\)/i;

    lines.forEach(line => {
        line = line.trim();
        if(!line || line.startsWith('*')) return;

        let match = pulseReg.exec(line);
        if (match) {
            const name = match[1];
            const p = match[2].trim().split(/[\s,]+/);
            if (p.length >= 7) {
                newSignals.push({
                    type: 'pulse',
                    name: name,
                    params: { v1: p[0], v2: p[1], td: p[2], tr: p[3], tf: p[4], pw: p[5], per: p[6] }
                });
            }
        }

        match = sinReg.exec(line);
        if (match) {
            const name = match[1];
            const p = match[2].trim().split(/[\s,]+/);
            newSignals.push({
                type: 'sin',
                name: name,
                params: { 
                    vo: p[0]||'0', va: p[1]||'1', freq: p[2]||'1k', 
                    td: p[3]||'0', damp: p[4]||'0', phase: p[5]||'0' 
                }
            });
        }
    });

    return newSignals;
}