#!/usr/bin/env node
// Computational math verifier — advisory, exits 0 always.
// Solves targeted question types programmatically and flags answer mismatches for human review.
// Usage: node src/data/verifyMath.js

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const questions = JSON.parse(readFileSync(join(__dirname, 'questions.json'), 'utf8'));

const mismatches = [];
const checked = [];

function flag(q, computedIndex, note) {
  checked.push(q.id);
  if (computedIndex !== q.correct) {
    mismatches.push({ id: q.id, stored: q.correct, computed: computedIndex, note });
  }
}

function parsePiCoeff(str) {
  str = str.trim();
  const m = str.match(/^(-?[\d.]+)π/);
  if (m) return parseFloat(m[1]);
  if (/^π/.test(str)) return 1;
  return null;
}

function parsePiRSquaredFraction(str) {
  str = str.trim();
  const m = str.match(/^πR²\/(\d+)$/);
  if (m) return 1 / parseFloat(m[1]);
  if (/^πR²$/.test(str)) return 1;
  return null;
}

for (const q of questions) {
  const text = q.question || '';
  const choices = q.choices || [];

  // Sector area: S = l·r/2
  if (/diện tích hình quạt/i.test(text) && /bán kính/i.test(text) && /độ dài cung/i.test(text)) {
    const rMatch = text.match(/bán kính\s*([\d.]+)\s*cm/);
    const lMatch = text.match(/cung\s*([\d.]+)π\s*cm/);
    if (rMatch && lMatch) {
      const r = parseFloat(rMatch[1]);
      const l = parseFloat(lMatch[1]);
      const coeff = l * r / 2;
      const coeffs = choices.map(parsePiCoeff);
      const idx = coeffs.findIndex(c => c !== null && Math.abs(c - coeff) < 0.01);
      if (idx !== -1) flag(q, idx, `S=l·r/2=${coeff}π cm²`);
    }
  }

  // Arc length: l = α·π·r/180
  if (/độ dài cung/i.test(text) && /°/.test(text) && !/diện tích/.test(text)) {
    const alphaMatch = text.match(/cung\s*([\d.]+)°/);
    const rMatch = text.match(/bán kính\s*([\d.]+)\s*cm/);
    if (alphaMatch && rMatch) {
      const coeff = parseFloat(alphaMatch[1]) * parseFloat(rMatch[1]) / 180;
      const coeffs = choices.map(parsePiCoeff);
      const idx = coeffs.findIndex(c => c !== null && Math.abs(c - coeff) < 0.001);
      if (idx !== -1) flag(q, idx, `l=α·π·r/180=${coeff}π cm`);
    }
  }

  // Tangent length: t = √(OA² − R²)
  if (/tiếp tuyến/i.test(text) && /độ dài AB/i.test(text) && /cách O/i.test(text)) {
    const rMatch = text.match(/\(O;\s*([\d.]+)\s*cm\)/);
    const oaMatch = text.match(/cách O\s+là\s+([\d.]+)\s*cm/);
    if (rMatch && oaMatch) {
      const R = parseFloat(rMatch[1]);
      const OA = parseFloat(oaMatch[1]);
      const t = Math.sqrt(OA * OA - R * R);
      const idx = choices.findIndex(c => Math.abs(parseFloat(c) - t) < 0.01);
      if (idx !== -1) flag(q, idx, `t=√(OA²−R²)=${t} cm`);
    }
  }

  // Cylinder lateral area: S = 2πrh
  if (/diện tích xung quanh/i.test(text) && /hình trụ/i.test(text)) {
    const rMatch = text.match(/bán kính\s*(?:đáy\s*)?([\d.]+)\s*cm/);
    const hMatch = text.match(/chiều cao\s*([\d.]+)\s*cm/);
    if (rMatch && hMatch) {
      const coeff = 2 * parseFloat(rMatch[1]) * parseFloat(hMatch[1]);
      const coeffs = choices.map(parsePiCoeff);
      const idx = coeffs.findIndex(c => c !== null && Math.abs(c - coeff) < 0.01);
      if (idx !== -1) flag(q, idx, `S_xq=2πrh=${coeff}π cm²`);
    }
  }

  // Cone total area: S = πr(r + l)
  if (/diện tích toàn phần/i.test(text) && /hình nón/i.test(text)) {
    const rMatch = text.match(/bán kính\s*(?:đáy\s*)?([\d.]+)\s*cm/);
    const lMatch = text.match(/đường sinh\s*([\d.]+)\s*cm/);
    if (rMatch && lMatch) {
      const r = parseFloat(rMatch[1]);
      const coeff = r * (r + parseFloat(lMatch[1]));
      const coeffs = choices.map(parsePiCoeff);
      const idx = coeffs.findIndex(c => c !== null && Math.abs(c - coeff) < 0.01);
      if (idx !== -1) flag(q, idx, `S_tp=πr(r+l)=${coeff}π cm²`);
    }
  }

  // Cylinder total area: S = 2πr(r + h)
  if (/diện tích toàn phần/i.test(text) && /hình trụ/i.test(text)) {
    const rMatch = text.match(/bán kính\s*(?:đáy\s*)?([\d.]+)\s*cm/);
    const hMatch = text.match(/chiều cao\s*([\d.]+)\s*cm/);
    if (rMatch && hMatch) {
      const r = parseFloat(rMatch[1]);
      const coeff = 2 * r * (r + parseFloat(hMatch[1]));
      const coeffs = choices.map(parsePiCoeff);
      const idx = coeffs.findIndex(c => c !== null && Math.abs(c - coeff) < 0.01);
      if (idx !== -1) flag(q, idx, `S_tp=2πr(r+h)=${coeff}π cm²`);
    }
  }

  // Sector area (degree/symbolic form): S = (α/360)·πR²
  if (/diện tích hình quạt/i.test(text) && /số đo\s*\d+°/.test(text) && /πR²/.test(choices.join(''))) {
    const alphaMatch = text.match(/số đo\s*([\d.]+)°/);
    if (alphaMatch) {
      const fraction = parseFloat(alphaMatch[1]) / 360;
      const fractions = choices.map(parsePiRSquaredFraction);
      const idx = fractions.findIndex(f => f !== null && Math.abs(f - fraction) < 0.0001);
      if (idx !== -1) flag(q, idx, `S=(α/360)πR²`);
    }
  }

  // Vieta: sum of roots = −b/a
  if (/tổng\s+(?:hai\s+)?nghiệm/i.test(text)) {
    const qMatch = text.match(/(-?\d*)x²\s*([+-]\s*\d+)x\s*([+-]\s*\d+)\s*=\s*0/);
    if (qMatch) {
      const a = parseFloat(qMatch[1] || '1');
      const b = parseFloat(qMatch[2].replace(/\s/g, ''));
      const sum = -b / a;
      const idx = choices.findIndex(c => Math.abs(parseFloat(c) - sum) < 0.001);
      if (idx !== -1) flag(q, idx, `x₁+x₂=−b/a=${sum}`);
    }
  }
}

if (mismatches.length === 0) {
  console.log(`✅ Math verify passed — ${checked.length} question(s) checked, 0 mismatches.`);
} else {
  console.warn(`\n⚠️  Math verify found ${mismatches.length} mismatch(es) in ${checked.length} checked — review before shipping:\n`);
  for (const m of mismatches) {
    console.warn(`  ${m.id}: stored correct=${m.stored}, computed=${m.computed}  (${m.note})`);
  }
  console.warn('\nApply fixes to questions.json, then re-run.');
}
// Always exit 0 — advisory only
