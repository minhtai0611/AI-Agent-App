#!/usr/bin/env python3
"""Validate consistency between exams.json, questions.json, and public image assets."""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).parent.parent
EXAMS_PATH  = ROOT / "exam-app/src/data/exams.json"
QUESTIONS_PATH = ROOT / "exam-app/src/data/questions.json"
PUBLIC_DIR  = ROOT / "exam-app/public"

def main():
    exams     = json.loads(EXAMS_PATH.read_text())
    questions = json.loads(QUESTIONS_PATH.read_text())
    q_map     = {q["id"]: q for q in questions}
    errors    = []

    for exam in exams:
        eid = exam["id"]
        declared = exam.get("totalQuestions", 0)
        ids = exam.get("questionIds", [])

        if declared != len(ids):
            errors.append(f"{eid}: totalQuestions={declared} but {len(ids)} questionIds")

        for qid in ids:
            if qid not in q_map:
                errors.append(f"{eid}: questionId '{qid}' not found in questions.json")
                continue
            q = q_map[qid]
            choices = q.get("choices", [])
            correct = q.get("correct")
            if len(choices) != 4:
                errors.append(f"{qid}: expected 4 choices, got {len(choices)}")
            if correct is None or not (0 <= correct <= 3):
                errors.append(f"{qid}: correct={correct!r} is not in 0–3")
            image = q.get("image")
            if image is not None:
                img_path = PUBLIC_DIR / image.lstrip("/")
                if not img_path.exists():
                    errors.append(f"{qid}: image '{image}' not found at {img_path}")

    if errors:
        print(f"{len(errors)} error(s) found:")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)
    else:
        print(f"0 errors — {len(exams)} exams, {len(questions)} questions validated.")

if __name__ == "__main__":
    main()
