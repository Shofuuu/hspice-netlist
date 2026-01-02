export const vscode = acquireVsCodeApi();
export const canvas = document.getElementById('canvas');
export const ctx = canvas.getContext('2d');
export const menu = document.getElementById('context-menu');

export const PAD = { left: 50, right: 20, top: 20, bottom: 30 };

// Mutable State (Exported as let/objects so they can be modified)
export let points = [{t: 0, v: 0}, {t: 100e-6, v: 0}];
export let config = { 
    maxTimeRaw: 100,      
    maxVoltsRaw: 3.3,     
    timeMult: 1e-6,     
    voltMult: 1,
    gridXRaw: 1.25, // 0 = Auto
    gridYRaw: 0.1, // 0 = Auto
    snapEnabled: true
};

export let appState = {
    dragIndex: -1,
    contextTargetIndex: -1,
    activeGenType: "",
    limitHit: false,
    limitHitX: 0,
    clickPos: { t: 0, v: 0 }
};

export let mouse = { x: 0, y: 0, t: 0, v: 0, active: false };

export function setPoints(newPoints) { points = newPoints; }
export function setPointsAtIndex(index, val) { points[index] = val; }
export function splicePoints(index, count) { points.splice(index, count); }
export function pushPoint(p) { points.push(p); }
export function sortPoints() { points.sort((a,b) => a.t - b.t); }