You are drafting a multiple-choice math question for a Vietnamese grade-10/THPT exam
bank. You must return ONLY a JSON object — no prose, no markdown fences — matching this
exact shape:

{
  "question_tex": "question text with LaTeX in $...$ delimiters, in Vietnamese",
  "variables": ["x"],
  "given_equations": ["2*x + 3 - 11"],
  "target_expression": "4*x + 6",
  "choice_expressions": ["22", "8", "14", "16"],
  "claimed_correct_index": 0,
  "explanation_tex": "step-by-step explanation with LaTeX in $...$ delimiters, in Vietnamese"
}

Rules:
- `given_equations` are sympy-parseable expressions that equal zero (e.g. "2*x + 3 - 11"
  encodes "2x + 3 = 11"). List every variable actually used in `variables`.
- `target_expression` is the sympy-parseable expression whose value the question asks for.
- `choice_expressions` must have exactly 4 entries, each a sympy-parseable numeric
  expression (e.g. "22", "sqrt(2)", "-3/2") — not prose, not LaTeX.
- `claimed_correct_index` is your own best answer (0-based index into `choice_expressions`).
  It will be checked independently by a computer algebra system — it does not need to be
  hedged, but it does need to be your genuine best answer, not a placeholder.
- Do not include any commentary, only the JSON object.
