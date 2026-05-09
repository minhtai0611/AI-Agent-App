AOPS_QUERIES: dict[str, list[str]] = {
    "algebra":        ["linear equations", "quadratic formula", "polynomial functions", "systems of equations"],
    "radical_expressions": [
        "simplifying radicals",
        "rationalizing denominators",
        "radical equations",
        "nested radicals",
        "square root properties",
    ],
    "functions_and_graphs": [
        "linear function slope intercept",
        "parabola vertex form",
        "graphing quadratic functions",
        "domain range functions",
        "function transformations",
    ],
    "inequalities_optimization": [
        "AM-GM inequality",
        "Cauchy-Schwarz inequality",
        "arithmetic geometric mean proof",
        "inequality olympiad techniques",
        "optimization constrained",
    ],
    "absolute_value": [
        "absolute value equations",
        "absolute value inequalities",
        "solving absolute value expressions",
    ],
    "nonlinear_systems": [
        "nonlinear systems of equations",
        "symmetric systems algebra",
        "substitution nonlinear",
        "quadratic linear system",
    ],
    "polynomial_techniques": [
        "polynomial remainder theorem",
        "factor theorem",
        "polynomial long division",
        "evaluating polynomials at roots",
        "factoring higher degree polynomials",
    ],
    "geometry":       [
        "triangle congruence",
        "circle theorems",
        "coordinate geometry",
        "area volume",
        "similar triangles",
        "angle bisector",
        "Pythagorean theorem",
        "polygon properties",
        "inscribed angles",
        "power of a point",
        "Menelaus Ceva theorem",
        "Stewart theorem",
        "cyclic quadrilateral",
        "geometric transformations",
        "triangle inequality",
        "Euler line",
        "orthocenter circumcenter",
        "solid geometry volume",
        "law of cosines",
        "law of sines",
        "Ptolemy theorem",
        "radical axis",
        "homothety",
        "inversion geometry",
        "nine-point circle",
        "triangle area formula",
        "spiral similarity",
        "Brahmagupta formula",
        "Heron formula",
        "isogonal conjugate",
        "symmedian",
        "triangle centers",
        "cross ratio",
        "Desargues theorem",
        "projective geometry",
        "affine geometry",
    ],
    "calculus":       ["derivative rules", "definite integral", "limits", "chain rule"],
    "trigonometry":   ["trigonometric identities", "law of sines cosines", "unit circle"],
    "combinatorics":  [
        "permutation combination",
        "pigeonhole principle",
        "binomial theorem",
        "inclusion exclusion",
        "counting techniques",
        "generating functions",
        "graph theory basics",
        "Catalan numbers",
        "stars and bars",
        "derangements",
        "Burnside lemma",
        "recursion combinatorics",
        "double counting",
        "bijection proof",
        "Pascal triangle properties",
        "Stirling numbers",
        "partition function",
        "Ramsey theory",
        "Latin squares",
        "block designs",
        "chromatic polynomial",
        "planar graphs",
        "Euler formula graphs",
        "coloring problems",
        "combinatorial proof",
        "lattice paths counting",
        "ballot problem",
        "Polya enumeration",
        "graph matching",
        "Hall theorem",
        "Dilworth theorem",
        "extremal graph theory",
        "Turan theorem",
        "Ramsey number",
        "probabilistic method combinatorics",
    ],
    "number_theory":  [
        "prime factorization",
        "modular arithmetic",
        "gcd lcm",
        "divisibility rules",
        "Fermat little theorem",
        "Euler totient function",
        "Chinese remainder theorem",
        "quadratic residues",
        "Legendre symbol",
        "Diophantine equations",
        "floor function properties",
        "arithmetic functions",
        "Bezout identity",
        "Wilson theorem",
        "prime counting",
        "perfect numbers",
        "Mersenne primes",
        "Gaussian integers",
        "p-adic numbers",
        "continued fractions",
        "Pell equation",
        "sum of squares",
        "primitive roots",
        "Mobius function",
        "Lifting the Exponent",
    ],
    "statistics":     [
        "mean median mode",
        "standard deviation variance",
        "normal distribution",
        "probability distribution",
        "hypothesis testing",
        "confidence interval",
        "regression analysis",
        "correlation coefficient",
        "central limit theorem",
        "binomial distribution",
        "Poisson distribution",
        "chi-squared test",
        "t-test",
        "ANOVA",
        "sampling methods",
        "z-score",
    ],
    "probability":    ["conditional probability", "Bayes theorem", "expected value", "counting principle"],
}

# AoPS category names per topic — used as a supplementary source alongside keyword search.
AOPS_CATEGORIES: dict[str, str] = {
    "combinatorics": "Combinatorics",
    "number_theory":  "Number theory",
    "geometry":       "Geometry",
}

# Generic static-HTML sources per topic.
# Each entry is a list of dicts: {index_url, link_pattern, source_tag, max_pages (optional)}.
# generic_html.py fetches the index, discovers links matching link_pattern, and ingests each page.
GENERIC_HTML_SOURCES: dict[str, list[dict]] = {
    "radical_expressions": [
        {
            "index_url": "https://tutorial.math.lamar.edu/Classes/Alg/Alg.aspx",
            "link_pattern": r"tutorial\.math\.lamar\.edu/Classes/Alg/(?:Radical|Simplif|Rationali|SolveRadical)",
            "source_tag": "pauls",
        },
    ],
    "functions_and_graphs": [
        {
            "index_url": "https://tutorial.math.lamar.edu/Classes/Alg/Alg.aspx",
            "link_pattern": r"tutorial\.math\.lamar\.edu/Classes/Alg/(?:Graph|Lines|Function|Parabola|Circle|Ellipse)",
            "source_tag": "pauls",
        },
    ],
    "inequalities_optimization": [
        {
            "index_url": "https://tutorial.math.lamar.edu/Classes/Alg/Alg.aspx",
            "link_pattern": r"tutorial\.math\.lamar\.edu/Classes/Alg/.*Inequalities",
            "source_tag": "pauls",
        },
        {
            # cut-the-knot algebra index — confirmed 200 on 2026-05-09
            "index_url": "https://www.cut-the-knot.org/arithmetic/algebra/index.shtml",
            "link_pattern": r"cut-the-knot\.org/arithmetic/algebra/",
            "source_tag": "ctk",
            "crawl_delay_seconds": 120,
            "max_pages": 20,
        },
    ],
    "absolute_value": [
        {
            "index_url": "https://tutorial.math.lamar.edu/Classes/Alg/Alg.aspx",
            "link_pattern": r"tutorial\.math\.lamar\.edu/Classes/Alg/.*AbsValue",
            "source_tag": "pauls",
        },
    ],
    "nonlinear_systems": [
        {
            "index_url": "https://tutorial.math.lamar.edu/Classes/Alg/Alg.aspx",
            "link_pattern": r"tutorial\.math\.lamar\.edu/Classes/Alg/(?:NonlinearSystems|Systems)",
            "source_tag": "pauls",
        },
    ],
    "polynomial_techniques": [
        {
            "index_url": "https://tutorial.math.lamar.edu/Classes/Alg/Alg.aspx",
            "link_pattern": r"tutorial\.math\.lamar\.edu/Classes/Alg/(?:Polynomial|DivisionAlg|ZeroFact|FindingZero|FactorThm|RemainderThm)",
            "source_tag": "pauls",
        },
    ],
    "statistics": [
        {
            # NIST e-Handbook EDA section 3 — distributions, descriptive techniques
            # Public domain (U.S. government work). Robots.txt: allowed.
            "index_url": "https://itl.nist.gov/div898/handbook/eda/section3/eda3.htm",
            "link_pattern": r"itl\.nist\.gov/div898/handbook/eda/section3/eda3\d",
            "source_tag": "nist",
        },
        {
            # NIST e-Handbook PRC section 2 — hypothesis testing, confidence intervals
            "index_url": "https://itl.nist.gov/div898/handbook/prc/section2/prc2.htm",
            "link_pattern": r"itl\.nist\.gov/div898/handbook/prc/section2/prc2\d",
            "source_tag": "nist",
        },
        {
            # Penn State STAT 414 — probability and distributions. CC BY-NC 4.0.
            # No robots.txt: allowed.
            "index_url": "https://online.stat.psu.edu/stat414/",
            "link_pattern": r"online\.stat\.psu\.edu/stat414/lesson/",
            "source_tag": "pennstate",
        },
        {
            # Penn State STAT 415 — inference, regression, ANOVA. CC BY-NC 4.0.
            "index_url": "https://online.stat.psu.edu/stat415/",
            "link_pattern": r"online\.stat\.psu\.edu/stat415/lesson/",
            "source_tag": "pennstate",
        },
    ],
}

# One index URL per topic — pauls.py scrapes these to discover individual section pages
PAULS_INDEX_URLS: dict[str, str | None] = {
    "algebra":       "https://tutorial.math.lamar.edu/Classes/Alg/Alg.aspx",
    "calculus":      "https://tutorial.math.lamar.edu/Classes/CalcI/CalcI.aspx",
    "trigonometry":  "https://tutorial.math.lamar.edu/Classes/Trig/Trig.aspx",
    "statistics":    None,  # Paul's Notes has no statistics section
    "probability":   "https://tutorial.math.lamar.edu/Classes/CalcI/CalcI.aspx",
    "geometry":      None,  # AoPS-only
    "combinatorics": None,  # AoPS-only
    "number_theory": None,  # AoPS-only
    # gap-fill topics — Paul's Notes content sourced via GENERIC_HTML_SOURCES
    "radical_expressions":       None,
    "functions_and_graphs":      None,
    "inequalities_optimization": None,
    "absolute_value":            None,
    "nonlinear_systems":         None,
    "polynomial_techniques":     None,
}
