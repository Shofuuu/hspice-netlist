export function parseParamsToNum(params, lookup = []) {
    const res = {};
    const multipliers = { 'p': 1e-12, 'n': 1e-9, 'u': 1e-6, 'm': 1e-3, 'k': 1e3, 'meg': 1e6 };
    
    // Create a map for quick access: { 'my_tr_var': 1e-9 }
    const varMap = {};
    lookup.forEach(p => {
        varMap[p.name] = parseValue(p.value, multipliers);
    });

    for (const [k, v] of Object.entries(params)) {
        const str = String(v).trim();
        
        // 1. Check if it's a variable reference
        if (varMap[str] !== undefined) {
            res[k] = varMap[str];
        } 
        // 2. Otherwise parse as number
        else {
            res[k] = parseValue(str, multipliers);
        }
    }
    return res;
}

function parseValue(str, multipliers) {
    let val = parseFloat(str);
    const match = str.toLowerCase().match(/[a-z]+$/);
    if (match) {
        const suff = match[0];
        if (multipliers[suff]) val *= multipliers[suff];
    }
    return isNaN(val) ? 0 : val;
}

export function getDefaults(type) {
    if (type === 'pulse') {
        return { v1: '0', v2: '1.8', td: '0', tr: '1n', tf: '1n', pw: '5u', per: '10u' };
    } else {
        return { vo: '0', va: '1.0', freq: '100k', td: '0', damp: '0', phase: '0' };
    }
}

// --- NEW: Smart Number Formatter for Rulers ---
export function formatEng(num) {
    if (num === 0) return "0";
    const abs = Math.abs(num);

    if (abs >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + "G";
    if (abs >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + "M";
    if (abs >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + "k";
    if (abs >= 1) return parseFloat(num.toFixed(2)); 
    if (abs >= 1e-3) return (num * 1e3).toFixed(1).replace(/\.0$/, '') + "m";
    if (abs >= 1e-6) return (num * 1e6).toFixed(1).replace(/\.0$/, '') + "u";
    if (abs >= 1e-9) return (num * 1e9).toFixed(1).replace(/\.0$/, '') + "n";
    if (abs >= 1e-12) return (num * 1e12).toFixed(1).replace(/\.0$/, '') + "p";
    
    return num.toExponential(1);
}