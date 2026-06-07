#!/usr/bin/env node
// Source integrity validator — must exit 0 before any commit touching questions.json or exams.json.
// Strict source/year/duplicate checks run only on NEW grade-10 questions (q_vj*_ and q_tdh_*).
// Referential integrity and duplicate-ID checks run across all questions.
// Usage: node src/data/validateQuestions.js

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUESTIONS_PATH = join(__dirname, 'questions.json');
const EXAMS_PATH = join(__dirname, 'exams.json');

// Match as whole word only (\bAI\b) to avoid substring false positives in source names.
// Other markers are unlikely to appear as substrings in legitimate sources.
const AI_MARKER_PATTERNS = [
  /\bAI\b/,
  /\bClaude\b/i,
  /\bGPT\b/i,
  /\bgenerated\b/i,
  /\bsynthetic\b/i,
  /tự tạo/i,
];

// New questions: 3-digit suffix IDs added in this batch (q_vj0N_009/010, q_tdh_001–014)
const NEW_ID_RE = /^q_(vj0[1-4]_\d{3}|tdh_\d{3})$/;
const isNew = q => NEW_ID_RE.test(q.id);

function normalizeText(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function validate() {
  const questions = JSON.parse(readFileSync(QUESTIONS_PATH, 'utf8'));
  const exams = JSON.parse(readFileSync(EXAMS_PATH, 'utf8'));

  const errors = [];
  const questionIds = new Set();
  const normalizedTexts = new Map(); // only tracks new questions for near-dupe detection

  for (const q of questions) {
    const loc = `question ${q.id ?? '(no id)'}`;
    const strict = isNew(q);

    // 1. ID must always be present and unique
    if (!q.id || typeof q.id !== 'string') {
      errors.push(`${loc}: missing or invalid 'id'`);
    } else {
      if (questionIds.has(q.id)) errors.push(`Duplicate question id: ${q.id}`);
      questionIds.add(q.id);
    }

    if (!strict) continue; // remaining checks are for new questions only

    // 2. Required fields on new questions
    if (!q.source || typeof q.source !== 'string') errors.push(`${loc}: missing or empty 'source'`);
    if (typeof q.year !== 'number') errors.push(`${loc}: 'year' must be a number`);
    if (!q.question || typeof q.question !== 'string') errors.push(`${loc}: missing or empty 'question'`);
    if (!Array.isArray(q.choices) || q.choices.length !== 4) errors.push(`${loc}: 'choices' must be array of exactly 4`);
    if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3) errors.push(`${loc}: 'correct' must be integer 0–3`);

    // 3. No AI-generation markers in source of new questions
    for (const pattern of AI_MARKER_PATTERNS) {
      if (q.source && pattern.test(q.source)) {
        errors.push(`${loc}: 'source' matches forbidden AI-generation marker /${pattern.source}/`);
      }
    }

    // 4. Near-duplicate detection among new questions
    if (q.question) {
      const norm = normalizeText(q.question);
      if (normalizedTexts.has(norm)) {
        errors.push(`Near-duplicate question text: "${q.id}" matches "${normalizedTexts.get(norm)}"`);
      } else {
        normalizedTexts.set(norm, q.id);
      }
    }
  }

  // 5. Referential integrity — every questionId in exams must exist in questions
  for (const exam of exams) {
    for (const qid of (exam.questionIds || [])) {
      if (!questionIds.has(qid)) {
        errors.push(`Exam "${exam.id}": questionId "${qid}" not found in questions.json`);
      }
    }
    if (exam.totalQuestions !== (exam.questionIds || []).length) {
      errors.push(`Exam "${exam.id}": totalQuestions (${exam.totalQuestions}) ≠ questionIds length (${(exam.questionIds || []).length})`);
    }
  }

  if (errors.length) {
    console.error(`\n❌ Validation FAILED — ${errors.length} error(s):\n`);
    errors.forEach(e => console.error(`  • ${e}`));
    process.exit(1);
  } else {
    const newCount = questions.filter(isNew).length;
    console.log(`✅ Validation passed — ${questions.length} questions (${newCount} new, strictly checked), ${exams.length} exams, no issues.`);
  }
}

validate();
