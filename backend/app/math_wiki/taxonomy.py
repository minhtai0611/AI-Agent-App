"""Canonical topic and type definitions for the math wiki."""

CANONICAL_TOPICS: frozenset[str] = frozenset({
    "algebra",
    "geometry",
    "calculus",
    "trigonometry",
    "combinatorics",
    "number_theory",
    "statistics",
    "probability",
    "differential_equations",
    "linear_algebra",
    "multivariable_calculus",
    # gap-fill additions
    "radical_expressions",
    "functions_and_graphs",
    "inequalities_optimization",
    "absolute_value",
    "nonlinear_systems",
    "polynomial_techniques",
})

# Maps every known non-canonical slug → canonical topic.
# Unmapped slugs that aren't already canonical get soft-deleted by fix_topic_slugs.py.
TOPIC_MAP: dict[str, str] = {
    # algebra family
    "precalculus": "algebra",
    "sequences": "algebra",
    "sequences-and-series": "algebra",
    "series": "algebra",
    "complex-numbers": "algebra",
    "complex_numbers": "algebra",
    "complex_analysis": "algebra",
    "analysis": "algebra",
    "set theory": "algebra",
    "optimization": "algebra",
    "functions": "algebra",
    "vectors": "algebra",
    # calculus family
    "calculus-2": "calculus",
    "calculus-3": "calculus",
    "calculus-iii": "calculus",
    "integration": "calculus",
    "fourier analysis": "calculus",
    "fourier-analysis": "calculus",
    "fourier_analysis": "calculus",
    "fourier_series": "calculus",
    "Fourier Analysis": "calculus",
    "parametric equations": "calculus",
    "parametric-equations": "calculus",
    "numerical-methods": "calculus",
    # differential equations
    "differential equations": "differential_equations",
    "differential-equations": "differential_equations",
    "ordinary-differential-equations": "differential_equations",
    "ordinary_differential_equations": "differential_equations",
    "partial differential equations": "differential_equations",
    "partial-differential-equations": "differential_equations",
    "partial_differential_equations": "differential_equations",
    "laplace-transforms": "differential_equations",
    "laplace_transforms": "differential_equations",
    # number theory
    "number theory": "number_theory",
    "number-theory": "number_theory",
    # linear algebra
    "linear algebra": "linear_algebra",
    "linear-algebra": "linear_algebra",
    # multivariable calculus
    "multivariable-calculus": "multivariable_calculus",
    "3-dimensional space": "multivariable_calculus",
    "coordinate-systems": "multivariable_calculus",
    "vector-calculus": "multivariable_calculus",
    "vector_calculus": "multivariable_calculus",
    "vector-functions": "multivariable_calculus",
    # statistics family
    "nonparametric statistics": "statistics",
    "nonparametric_statistics": "statistics",
    "hypothesis_testing": "statistics",
    "hypothesis testing": "statistics",
    "descriptive statistics": "statistics",
    "descriptive_statistics": "statistics",
    "inferential statistics": "statistics",
    "inferential_statistics": "statistics",
    "bayesian statistics": "statistics",
    "bayesian_statistics": "statistics",
    # gap-fill topic aliases
    "radicals": "radical_expressions",
    "radical": "radical_expressions",
    "inequalities": "inequalities_optimization",
    "optimization": "inequalities_optimization",
    "functions": "functions_and_graphs",
    "graphing": "functions_and_graphs",
    "absolute-value": "absolute_value",
    "nonlinear": "nonlinear_systems",
    "polynomials": "polynomial_techniques",
    # probability family
    "stochastic processes": "probability",
    "stochastic_processes": "probability",
    "random variables": "probability",
    "random_variables": "probability",
    # geometry family
    "analytic geometry": "geometry",
    "analytic-geometry": "geometry",
    "analytic_geometry": "geometry",
    "projective geometry": "geometry",
    "projective-geometry": "geometry",
    "projective_geometry": "geometry",
    "euclidean geometry": "geometry",
    "euclidean-geometry": "geometry",
    "euclidean_geometry": "geometry",
    "triangle-geometry": "geometry",
    "triangle_geometry": "geometry",
    "solid geometry": "geometry",
    "solid-geometry": "geometry",
    "solid_geometry": "geometry",
}

BLOOM_LEVELS: dict[int, str] = {
    0: "untagged",
    1: "remember",    # recall facts, formulas, definitions
    2: "understand",  # explain, interpret, restate
    3: "apply",       # execute known procedure on new instance
    4: "analyze",     # decompose, derive, find structure
    5: "evaluate",    # assess correctness, judge against criteria
    6: "create",      # synthesize new objects from constraints
}

# Maps Vietnamese question verb → Bloom's level (used in ingest + classifier)
BLOOM_VERBS: dict[str, int] = {
    # L1 Remember
    "nhớ": 1, "kể": 1, "liệt kê": 1, "nêu": 1, "định nghĩa": 1,
    "công thức": 1, "phát biểu": 1,
    # L2 Understand
    "giải thích": 2, "tại sao": 2, "ý nghĩa": 2, "mô tả": 2,
    "phân biệt": 2, "so sánh": 2,
    # L3 Apply
    "tính": 3, "giải": 3, "tìm": 3, "xác định": 3, "áp dụng": 3,
    "sử dụng": 3, "vẽ": 3,
    # L4 Analyze
    "phân tích": 4, "tìm tất cả": 4, "cực trị": 4, "biến thiên": 4,
    "phân tích nhân tử": 4, "bảng biến thiên": 4,
    # L5 Evaluate
    "kiểm tra": 5, "đánh giá": 5, "chứng tỏ": 5, "khẳng định": 5,
    "xét xem": 5, "đúng hay sai": 5,
    # L6 Create
    "xây dựng": 6, "dựng": 6, "thiết kế": 6, "tạo": 6,
    "viết phương trình": 6, "lập": 6,
}

CANONICAL_TYPES: frozenset[str] = frozenset({
    "procedure",
    "concept",
    "theorem",
    "definition",
    "fact",
})

TYPE_MAP: dict[str, str] = {
    "application": "concept",
    "overview": "concept",
    "strategy": "concept",
    "principle": "concept",
    "property": "concept",
    "constraint": "concept",
    "convention": "concept",
    "warning": "concept",
    "reference": "concept",
    "problem": "concept",
    "worked_example": "procedure",
    "example": "procedure",
    "identity": "fact",
    "formula": "fact",
    "rule": "fact",
    "proof": "theorem",
    "derivation": "theorem",
    "result": "theorem",
}
