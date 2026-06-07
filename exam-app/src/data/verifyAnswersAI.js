#!/usr/bin/env node
// LLM oracle verifier — one-shot, run manually before merge.
// Writes exam-app/src/data/ai-verify-report.json as a permanent audit trail.
// Usage: ANTHROPIC_BASE_URL=... ANTHROPIC_AUTH_TOKEN=... node src/data/verifyAnswersAI.js

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUESTIONS_PATH = join(__dirname, 'questions.json');
const REPORT_PATH = join(__dirname, 'ai-verify-report.json');

const baseURL = process.env.ANTHROPIC_BASE_URL;
const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
const model = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL || 'claude-haiku-4.5';

if (!baseURL || !apiKey) {
  console.error('Missing ANTHROPIC_BASE_URL or ANTHROPIC_AUTH_TOKEN env vars.');
  process.exit(1);
}

const ENDPOINT = `${baseURL}/v2/chat/completions`;
const LETTER = ['A', 'B', 'C', 'D'];

async function verifyQuestion(q) {
  const choicesText = q.choices.map((c, i) => `${LETTER[i]}) ${c}`).join('\n');
  const prompt = `Câu hỏi toán (lớp 9-12, Việt Nam):\n${q.question}\n\nCác đáp án:\n${choicesText}\n\nHãy trả lời CHỈ một chữ cái duy nhất (A, B, C hoặc D) là đáp án đúng. Không giải thích.`;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4,
      temperature: 0,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const letter = (data.choices?.[0]?.message?.content || '').trim().toUpperCase().charAt(0);
  const aiIndex = LETTER.indexOf(letter);
  return { id: q.id, stored: q.correct, ai_answer: aiIndex, ai_letter: letter, match: aiIndex === q.correct };
}

const questions = JSON.parse(readFileSync(QUESTIONS_PATH, 'utf8'));
const GRADE10_PREFIXES = ['q_vj01_', 'q_vj02_', 'q_vj03_', 'q_vj04_', 'q_tdh_'];
const toVerify = questions.filter(q => GRADE10_PREFIXES.some(p => q.id.startsWith(p)));

console.log(`Verifying ${toVerify.length} questions with model ${model}...`);

const results = [];
let matched = 0;

for (let i = 0; i < toVerify.length; i++) {
  const q = toVerify[i];
  process.stdout.write(`  [${i + 1}/${toVerify.length}] ${q.id} ... `);
  try {
    const r = await verifyQuestion(q);
    results.push(r);
    if (r.match) { matched++; process.stdout.write('✓\n'); }
    else process.stdout.write(`✗  stored=${LETTER[r.stored]} ai=${r.ai_letter}\n`);
    await new Promise(res => setTimeout(res, 3500));
  } catch (err) {
    console.error(`\n  ERROR on ${q.id}:`, err.message);
    results.push({ id: q.id, stored: q.correct, ai_answer: -1, ai_letter: '?', match: false, error: err.message });
  }
}

writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));

const mismatches = results.filter(r => !r.match);
console.log(`\nSummary: ${matched}/${toVerify.length} matched, ${mismatches.length} mismatch(es).`);
if (mismatches.length) {
  console.log('\nMismatches (review before shipping):');
  mismatches.forEach(r => console.log(`  ${r.id}: stored=${LETTER[r.stored] ?? r.stored}, AI answered=${r.ai_letter}`));
}
console.log(`\nReport written to: ${REPORT_PATH}`);
