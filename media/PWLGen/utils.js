import { canvas, config, PAD } from './state.js';

export function formatNumber(n) { return (Math.round(n * 100) / 100).toString(); }

export function getTimeSuffix() {
    const m = config.timeMult;
    if(m===1e-12) return 'ps'; if(m===1e-9) return 'ns'; if(m===1e-6) return 'u'; if(m===1e-3) return 'm'; return 's';
}

export function getVoltSuffix() {
    const m = config.voltMult;
    if(m===1e-3) return 'mV'; if(m===1e3) return 'kV'; return 'v';
}

export function mapToPx(t, v) {
    const drawW = canvas.width - PAD.left - PAD.right;
    const drawH = canvas.height - PAD.top - PAD.bottom;
    const maxT = config.maxTimeRaw * config.timeMult;
    const maxV = config.maxVoltsRaw * config.voltMult;
    const x = PAD.left + (t / maxT) * drawW;
    const y = (PAD.top + drawH) - (v / maxV) * drawH;
    return {x, y};
}

export function mapToUnits(x, y) {
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