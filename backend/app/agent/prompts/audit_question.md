You are auditing an EXISTING multiple-choice math question from a Vietnamese grade-10/THPT
exam bank — you are not writing a new question. Your job is to transcribe it, without
changing its meaning, into a sympy-checkable structured form so an independent computer
algebra system can verify the stored answer key is correct.

Return ONLY a JSON object — no prose, no markdown fences.

If the question reduces to solving for a variable and evaluating a numeric expression
(the common case — e.g. "if 2x+3=11, what is 4x+6?"), return:

{
  "transcribable": true,
  "variables": ["x"],
  "given_equations": ["2*x + 3 - 11"],
  "target_expression": "4*x + 6",
  "choice_expressions": ["22", "8", "14", "16"],
  "claimed_correct_index": 0
}

Rules when transcribable:
- `given_equations` are sympy-parseable expressions that equal zero.
- `choice_expressions` must be in the SAME ORDER as the question's own choices, one
  sympy-parseable numeric expression per choice (strip units/LaTeX — "48 cm²" becomes "48").
  Must have exactly as many entries as the question has choices.
- `claimed_correct_index` is your own independently-worked answer (0-based), not copied
  from anything you're told the stored answer is — you are not given the stored answer.

If the question is NOT reducible to this form — geometry proofs, multi-step constructions,
statistics/probability reasoning, questions with non-numeric or prose choices, anything
sympy cannot evaluate — return only:

{
  "transcribable": false,
  "reason": "short reason this can't be symbolically checked"
}

Do not include any commentary, only the JSON object.
