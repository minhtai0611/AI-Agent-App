"""
Ingest 34 manually-authored proof wiki units (20 geometry + 14 algebra).
Run with --dry-run to preview without writing to the DB.

Usage:
    PYTHONPATH=backend python3 scripts/ingest_proofs.py [--dry-run]
"""

import argparse
import os
import sys

from app.math_wiki.schemas import WikiUnit
from app.math_wiki.storage.db import upsert_wiki_unit

# ---------------------------------------------------------------------------
# 20 Geometry proof units
# ---------------------------------------------------------------------------

GEO_UNITS: list[WikiUnit] = [
    WikiUnit(
        id="geo-proof-congruence-sss",
        type="theorem",
        topic="geometry",
        subtopic="triangle congruence",
        content=(
            "SSS (Side-Side-Side) congruence: if three sides of one triangle are equal in length to the three sides of another triangle, the triangles are congruent. "
            "The proof proceeds by superimposing one triangle onto the other so that the longest sides coincide; the remaining vertex must then coincide because circles of the given radii have a unique intersection point above the base. "
            "Any correspondence between congruent triangles preserves all angles as well. "
            "SSS is one of the five standard triangle-congruence criteria used in Euclidean geometry."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-congruence-sas",
        type="theorem",
        topic="geometry",
        subtopic="triangle congruence",
        content=(
            "SAS (Side-Angle-Side) congruence: if two sides and the included angle of one triangle equal the corresponding parts of another, the triangles are congruent. "
            "Place the two triangles so the equal angles coincide and the equal sides along those angles overlap; the third vertices must then coincide, making the triangles identical. "
            "The included angle is the angle formed between the two specified sides. "
            "SAS is treated as an axiom in many modern developments of Euclidean geometry."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-congruence-asa",
        type="theorem",
        topic="geometry",
        subtopic="triangle congruence",
        content=(
            "ASA (Angle-Side-Angle) congruence: if two angles and the included side of one triangle equal the corresponding parts of another, the triangles are congruent. "
            "Because the two base angles fix the directions of the two remaining sides, the third vertex is uniquely determined once the base side is fixed. "
            "ASA follows from the AAS criterion or can be derived from SAS using the angle-sum property. "
            "The included side lies between the two specified angles."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-congruence-aas",
        type="theorem",
        topic="geometry",
        subtopic="triangle congruence",
        content=(
            "AAS (Angle-Angle-Side) congruence: if two angles and a non-included side of one triangle equal the corresponding parts of another, the triangles are congruent. "
            "Since the third angle is determined by the angle-sum property (angles sum to 180 degrees), AAS reduces to ASA once the third angle is known. "
            "The non-included side must correspond between the two triangles. "
            "AAS is sometimes called SAA and is a direct consequence of ASA."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-congruence-hl",
        type="theorem",
        topic="geometry",
        subtopic="triangle congruence",
        content=(
            "HL (Hypotenuse-Leg) congruence applies only to right triangles: if the hypotenuse and one leg of a right triangle equal the hypotenuse and one leg of another right triangle, the triangles are congruent. "
            "The proof uses the Pythagorean theorem to recover the missing leg: if the hypotenuses are equal and one leg is equal, the third sides must be equal too, reducing to SSS. "
            "HL is a special case that does not generalise to non-right triangles (SSA is not a valid criterion in general)."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-congruence-strategy",
        type="procedure",
        topic="geometry",
        subtopic="triangle congruence",
        content=(
            "To prove two triangles congruent: (1) identify which sides and angles are given as equal or can be shown equal from the diagram. "
            "(2) Check whether the known equal parts match one of the five criteria: SSS, SAS, ASA, AAS, or HL (right triangles only). "
            "(3) State the criterion explicitly and conclude congruence. "
            "(4) Once congruence is established, corresponding parts are congruent (CPCTC), which can be used to prove further equalities."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-triangle-angle-sum",
        type="theorem",
        topic="geometry",
        subtopic="triangle theorems",
        content=(
            "The interior angles of any triangle sum to 180 degrees. "
            "Proof: draw a line through one vertex parallel to the opposite side. "
            "The two base angles of the triangle equal the alternate interior angles formed with the parallel line, and the angle at the vertex together with these two alternate interior angles forms a straight line (180 degrees). "
            "This result depends on the parallel postulate and is specific to Euclidean geometry."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-triangle-exterior-angle",
        type="theorem",
        topic="geometry",
        subtopic="triangle theorems",
        content=(
            "Exterior Angle Theorem: an exterior angle of a triangle equals the sum of the two non-adjacent interior angles. "
            "Proof: the exterior angle and the adjacent interior angle are supplementary (sum to 180 degrees). "
            "The three interior angles also sum to 180 degrees, so the exterior angle equals the sum of the other two interior angles. "
            "This theorem is useful for inequality arguments since an exterior angle is always greater than either non-adjacent interior angle."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-triangle-isosceles",
        type="theorem",
        topic="geometry",
        subtopic="triangle theorems",
        content=(
            "Isosceles Triangle Theorem (Pons Asinorum): if two sides of a triangle are equal, the base angles opposite those sides are equal. "
            "Proof: draw the angle bisector from the apex to the base; the two resulting triangles are congruent by SAS (equal sides, equal bisected angle, equal side). "
            "By CPCTC the base angles are equal. "
            "An equivalent proof uses the reflection of the triangle across the altitude from the apex."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-triangle-isosceles-converse",
        type="theorem",
        topic="geometry",
        subtopic="triangle theorems",
        content=(
            "Converse of the Isosceles Triangle Theorem: if two angles of a triangle are equal, the sides opposite those angles are equal, making the triangle isosceles. "
            "Proof: assume angles B and C are equal. "
            "Draw the angle bisector from A to side BC at point D; triangles ABD and ACD share AD, have equal angles at B and C, and have equal angles at D (AAS), so AB = AC by CPCTC. "
            "This converse is used to identify isosceles triangles when only angle information is available."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-parallel-alternate-interior",
        type="theorem",
        topic="geometry",
        subtopic="parallel lines",
        content=(
            "Alternate Interior Angles Theorem: when a transversal crosses two parallel lines, alternate interior angles are equal. "
            "Proof: by the definition of parallel lines and the parallel postulate, co-interior (same-side interior) angles are supplementary. "
            "Since alternate interior angles and co-interior angles on the same side are supplementary to the same angle, the alternate interior angles must be equal. "
            "The converse also holds: if alternate interior angles are equal, the lines are parallel."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-parallel-corresponding",
        type="theorem",
        topic="geometry",
        subtopic="parallel lines",
        content=(
            "Corresponding Angles Theorem: when a transversal crosses two parallel lines, corresponding angles are equal. "
            "Two angles are corresponding if they are on the same side of the transversal and one is interior while the other is exterior. "
            "Proof: corresponding angles and alternate interior angles are vertically related; since alternate interior angles are equal (by the alternate interior angles theorem), corresponding angles are too. "
            "The converse states that equal corresponding angles imply parallel lines."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-parallel-co-interior",
        type="theorem",
        topic="geometry",
        subtopic="parallel lines",
        content=(
            "Co-interior Angles Theorem (also called consecutive interior or same-side interior angles): when a transversal crosses two parallel lines, co-interior angles sum to 180 degrees. "
            "Proof: a co-interior angle and its corresponding angle are supplementary (they form a straight line). "
            "Since corresponding angles are equal when lines are parallel, the co-interior angle equals 180 degrees minus the corresponding angle, confirming the sum is 180 degrees. "
            "If co-interior angles sum to 180 degrees, the lines are parallel (converse)."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-similarity-aa",
        type="theorem",
        topic="geometry",
        subtopic="triangle similarity",
        content=(
            "AA (Angle-Angle) Similarity: if two angles of one triangle equal two angles of another, the triangles are similar. "
            "Because the angle sum of a triangle is 180 degrees, the third angles are automatically equal, so all three pairs of angles match. "
            "Similar triangles have proportional corresponding sides: if the ratio of similarity is k, each side of one triangle is k times the corresponding side of the other. "
            "AA is the most commonly used similarity criterion in geometry proofs."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-similarity-sas",
        type="theorem",
        topic="geometry",
        subtopic="triangle similarity",
        content=(
            "SAS Similarity: if two sides of one triangle are proportional to two sides of another and the included angles are equal, the triangles are similar. "
            "Proof: scale one triangle by the ratio of the given sides so the two sides match, then use SAS congruence to show the scaled triangles are congruent, hence the originals are similar. "
            "The included angle must lie between the two sides whose ratio is compared. "
            "SAS similarity is one of three standard similarity criteria alongside AA and SSS similarity."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-similarity-sss",
        type="theorem",
        topic="geometry",
        subtopic="triangle similarity",
        content=(
            "SSS Similarity: if the three sides of one triangle are proportional to the three sides of another (all ratios equal), the triangles are similar. "
            "Proof: scale one triangle by the common ratio to make it congruent to the other; congruent triangles have equal angles, confirming similarity. "
            "The common ratio is called the scale factor. "
            "SSS similarity differs from SSS congruence in that proportionality (not equality) of sides is required."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-circle-inscribed-angle",
        type="theorem",
        topic="geometry",
        subtopic="circle theorems",
        content=(
            "Inscribed Angle Theorem: an inscribed angle is half the central angle that subtends the same arc. "
            "Proof (case where the centre lies inside the inscribed angle): draw a diameter through the vertex; each half creates an isosceles triangle, and the exterior angle of each isosceles triangle equals twice the base angle. "
            "Summing gives the inscribed angle equals half the full central angle. "
            "Consequently, all inscribed angles subtending the same arc are equal."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-circle-tangent-radius",
        type="theorem",
        topic="geometry",
        subtopic="circle theorems",
        content=(
            "Tangent-Radius Perpendicularity: a tangent to a circle is perpendicular to the radius drawn to the point of tangency. "
            "Proof by contradiction: suppose the radius OP is not perpendicular to the tangent at P. "
            "Then there is a point Q on the tangent closer to the centre O than P, meaning Q lies inside the circle. "
            "But a tangent touches the circle at exactly one point, so no interior point can lie on it — contradiction. "
            "Therefore OP must be perpendicular to the tangent."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-circle-angles-same-arc",
        type="theorem",
        topic="geometry",
        subtopic="circle theorems",
        content=(
            "Angles in the Same Segment Theorem: all inscribed angles subtending the same chord from the same side are equal. "
            "Proof: each such inscribed angle subtends the same arc and therefore equals half the central angle subtending that arc (by the Inscribed Angle Theorem). "
            "Since they are all equal to the same half-central-angle, they are equal to each other. "
            "This theorem is widely used to identify equal angles in circle geometry problems."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="geo-proof-parallelogram-properties",
        type="theorem",
        topic="geometry",
        subtopic="quadrilaterals",
        content=(
            "In a parallelogram: opposite sides are equal, opposite angles are equal, and diagonals bisect each other. "
            "Proof of equal opposite sides: the diagonal creates two triangles; by alternate interior angles (parallel sides) and ASA, the triangles are congruent, so opposite sides are equal by CPCTC. "
            "Equal opposite angles follow because consecutive angles are co-interior (supplementary), so opposite angles must be equal. "
            "Diagonals bisect each other because the two triangles formed at the intersection point are congruent by ASA."
        ),
        problem_ids=[],
    ),
]

# ---------------------------------------------------------------------------
# 14 Algebra proof units
# ---------------------------------------------------------------------------

ALG_UNITS: list[WikiUnit] = [
    WikiUnit(
        id="alg-proof-technique-direct",
        type="procedure",
        topic="algebra",
        subtopic="proof techniques",
        content=(
            "A direct proof establishes a statement P implies Q by assuming P is true and deriving Q through a chain of logical steps. "
            "Each step should follow from definitions, axioms, or previously proved results. "
            "Direct proofs are the default approach: try direct proof first, and switch to another technique only when direct proof is blocked. "
            "Example structure: assume n is even (n = 2k), then n^2 = 4k^2 = 2(2k^2), which is even — proved directly."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-technique-contradiction",
        type="procedure",
        topic="algebra",
        subtopic="proof techniques",
        content=(
            "Proof by contradiction (reductio ad absurdum): to prove P, assume not-P and derive a logical contradiction. "
            "The contradiction shows the assumption not-P is untenable, so P must be true. "
            "Classic example: the proof that sqrt(2) is irrational assumes sqrt(2) = p/q in lowest terms, derives that both p and q are even, contradicting lowest terms. "
            "Use contradiction when a direct chain from P to Q is hard to find but the negation of Q leads quickly to absurdity."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-technique-contrapositive",
        type="procedure",
        topic="algebra",
        subtopic="proof techniques",
        content=(
            "Proof by contrapositive: to prove P implies Q, instead prove not-Q implies not-P, which is logically equivalent. "
            "The contrapositive of 'if P then Q' is 'if not Q then not P'; both statements have identical truth values. "
            "Use contrapositive when proving the negation of the conclusion is easier to work with than assuming the hypothesis. "
            "Example: to prove 'if n^2 is odd then n is odd', prove the contrapositive 'if n is even then n^2 is even', which is a direct calculation."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-technique-induction-weak",
        type="procedure",
        topic="algebra",
        subtopic="mathematical induction",
        content=(
            "Weak (standard) mathematical induction proves P(n) for all integers n >= n_0 in two steps: a base case verifying P(n_0), and an inductive step assuming P(k) and proving P(k+1). "
            "Because the base case starts the chain and the inductive step extends it one step at a time, P(n) holds for all n >= n_0 by the well-ordering principle. "
            "Example: to prove the triangular number formula S(n) = n(n+1)/2, verify S(1)=1 for the base case, then assume S(k) = k(k+1)/2 and show S(k+1) = S(k)+(k+1) = (k+1)(k+2)/2, completing the inductive step. "
            "The inductive hypothesis is the assumption that P(k) is true; it may only be used within the inductive step, not assumed globally. "
            "Induction is valid for any well-ordered set, not just the natural numbers."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-technique-induction-strong",
        type="procedure",
        topic="algebra",
        subtopic="mathematical induction",
        content=(
            "Strong (complete) induction: in the inductive step, assume P(j) is true for every j from n_0 through k (not just P(k)) and prove P(k+1). "
            "Strong induction is equivalent to weak induction but is more convenient when proving P(k+1) requires hypotheses about multiple earlier values. "
            "Example: proving every integer greater than 1 has a prime factorisation uses strong induction because a composite number k+1 factors into smaller numbers, each of which (by the stronger hypothesis) already has a prime factorisation. "
            "The base case and conclusion structure are identical to weak induction."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-inequality-am-gm-2var",
        type="theorem",
        topic="algebra",
        subtopic="inequalities",
        content=(
            "AM-GM Inequality (two variables): for non-negative real numbers a and b, (a + b)/2 >= sqrt(a*b), with equality iff a = b. "
            "Proof: (sqrt(a) - sqrt(b))^2 >= 0 since any real square is non-negative. "
            "Expanding gives a - 2*sqrt(a*b) + b >= 0, so a + b >= 2*sqrt(a*b), meaning (a+b)/2 >= sqrt(a*b). "
            "Equality holds exactly when sqrt(a) = sqrt(b), that is, when a = b."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-inequality-am-gm-nvar",
        type="theorem",
        topic="algebra",
        subtopic="inequalities",
        content=(
            "AM-GM Inequality (n variables): for non-negative reals a_1 through a_n, their arithmetic mean is at least their geometric mean: (a_1+a_2+...+a_n)/n >= (a_1*a_2*...*a_n)^(1/n). "
            "Cauchy's forward-backward proof first proves it for powers of 2 by repeatedly applying the two-variable case, then proves it for n-1 by substituting the geometric mean for the missing term and simplifying. "
            "Equality holds iff all a_i are equal. "
            "AM-GM is one of the most versatile inequality tools in competition mathematics."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-inequality-cauchy-schwarz",
        type="theorem",
        topic="algebra",
        subtopic="inequalities",
        content=(
            "Cauchy-Schwarz Inequality: for real sequences (a_i) and (b_i) of length n, the square of their dot product is at most the product of the sum of their squares: (sum a_i*b_i)^2 <= (sum a_i^2)(sum b_i^2). "
            "Discriminant proof: consider the quadratic in t: f(t) = sum((a_i*t + b_i)^2) >= 0 for all t. "
            "Expanding, f(t) = (sum a_i^2) t^2 + 2(sum a_i*b_i) t + (sum b_i^2); since f(t) >= 0 for all real t, its discriminant must be non-positive: 4(sum a_i*b_i)^2 - 4(sum a_i^2)(sum b_i^2) <= 0. "
            "Equality holds iff the sequences are proportional."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-inequality-triangle-abs",
        type="theorem",
        topic="algebra",
        subtopic="inequalities",
        content=(
            "Triangle Inequality for real numbers: |a + b| <= |a| + |b| for all real a, b. "
            "Proof: since -|x| <= x <= |x| for any real x, adding the inequalities for a and b gives -(|a|+|b|) <= a+b <= |a|+|b|. "
            "This is equivalent to |a+b| <= |a|+|b|. "
            "Equality holds iff a and b have the same sign (or one is zero). "
            "The triangle inequality extends to complex numbers and general normed vector spaces."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-polynomial-factor-theorem",
        type="theorem",
        topic="algebra",
        subtopic="polynomial theorems",
        content=(
            "Factor Theorem: a polynomial P(x) has (x - c) as a factor if and only if P(c) = 0. "
            "Proof: by polynomial (Euclidean) division, P(x) = (x - c) * Q(x) + R where R is a constant remainder. "
            "Substituting x = c gives P(c) = 0 + R, so R = P(c). "
            "If P(c) = 0 then R = 0 and (x - c) divides P(x); conversely if (x - c) divides P(x) then R = 0 so P(c) = 0."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-polynomial-remainder-theorem",
        type="theorem",
        topic="algebra",
        subtopic="polynomial theorems",
        content=(
            "Remainder Theorem: when a polynomial P(x) is divided by (x - c), the remainder is P(c). "
            "Proof: write P(x) = (x - c) * Q(x) + R by the division algorithm; substituting x = c gives P(c) = 0 + R = R. "
            "The factor theorem is the special case R = 0. "
            "The remainder theorem allows evaluation of polynomials at a point without full long division."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-polynomial-factor-strategy",
        type="procedure",
        topic="algebra",
        subtopic="polynomial theorems",
        content=(
            "To factor a polynomial P(x) completely: (1) use the Rational Root Theorem to list candidate rational roots p/q where p divides the constant term and q divides the leading coefficient. "
            "(2) Test candidates by evaluating P(p/q); if P(p/q) = 0 then (x - p/q) is a factor by the Factor Theorem. "
            "(3) Perform polynomial long division to find Q(x) = P(x) / (x - p/q). "
            "(4) Repeat on Q(x) until fully factored. "
            "For irreducible quadratic factors, complete the square or use the quadratic formula."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-parity-even-odd",
        type="procedure",
        topic="algebra",
        subtopic="parity and divisibility",
        content=(
            "Parity proof technique: classify integers as even (n = 2k) or odd (n = 2k+1) and use algebra to establish properties. "
            "Key facts: even + even = even, odd + odd = even, even + odd = odd; even * anything = even, odd * odd = odd. "
            "Example proof that the product of two consecutive integers is even: n(n+1); if n is even the product is even; if n is odd then n+1 is even so the product is even. "
            "Parity arguments are the simplest form of modular arithmetic (working modulo 2)."
        ),
        problem_ids=[],
    ),
    WikiUnit(
        id="alg-proof-divisibility-structure",
        type="procedure",
        topic="algebra",
        subtopic="parity and divisibility",
        content=(
            "Divisibility proof structure: to prove m divides expression E, rewrite E as m * (integer expression). "
            "Common technique: factor or expand E so that m appears explicitly as a factor. "
            "For divisibility of a^n - b^n: the algebraic factorisation a^n - b^n = (a-b)(a^(n-1) + a^(n-2)*b + ... + b^(n-1)) shows (a-b) always divides a^n - b^n regardless of n. "
            "For more complex cases, strong induction is often effective: assume d divides P(k) for all values up to k and prove d divides P(k+1)."
        ),
        problem_ids=[],
    ),
]

ALL_UNITS = GEO_UNITS + ALG_UNITS


def _validate(units: list[WikiUnit]) -> None:
    for u in units:
        assert "\\" not in u.content, f"Backslash in unit {u.id}"
        # Split on ". " to avoid false splits inside math notation like "a.b" or "..."
        sentences = [s.strip() for s in u.content.split(". ") if s.strip()]
        assert len(sentences) <= 5, f"Unit {u.id} exceeds 5 sentences ({len(sentences)})"


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest geometry and algebra proof units")
    parser.add_argument("--dry-run", action="store_true", help="Print units without writing to DB")
    args = parser.parse_args()

    _validate(ALL_UNITS)

    geo = [u for u in ALL_UNITS if u.topic == "geometry"]
    alg = [u for u in ALL_UNITS if u.topic == "algebra"]
    print(f"Total units: {len(ALL_UNITS)}  (geometry: {len(geo)}, algebra: {len(alg)})")

    for u in ALL_UNITS:
        print(f"  [{u.topic:8s}] {u.id}  ({u.type}, subtopic={u.subtopic!r})")

    if args.dry_run:
        print("\n--dry-run: no DB writes.")
        return

    inserted = 0
    for u in ALL_UNITS:
        upsert_wiki_unit(u, source="manual")
        inserted += 1

    print(f"\nInserted {inserted} units.")

    # Invalidate stale retrieval indexes so next server start rebuilds clean
    from app.config import get_settings
    import os as _os
    db_base = _os.path.splitext(get_settings().math_wiki_db_path)[0]
    for ext in (".bm25.pkl", ".faiss", ".meta.pkl"):
        cache_file = db_base + ext
        if _os.path.exists(cache_file):
            _os.remove(cache_file)
            print(f"Removed stale cache: {cache_file}")


if __name__ == "__main__":
    main()
