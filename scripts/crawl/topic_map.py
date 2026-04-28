AOPS_QUERIES: dict[str, list[str]] = {
    "algebra":        ["linear equations", "quadratic formula", "polynomial functions", "systems of equations"],
    "geometry":       ["triangle congruence", "circle theorems", "coordinate geometry", "area volume"],
    "calculus":       ["derivative rules", "definite integral", "limits", "chain rule"],
    "trigonometry":   ["trigonometric identities", "law of sines cosines", "unit circle"],
    "combinatorics":  ["permutation combination", "pigeonhole principle", "binomial theorem", "inclusion exclusion"],
    "number_theory":  ["prime factorization", "modular arithmetic", "gcd lcm", "divisibility rules"],
    "statistics":     ["mean median mode", "standard deviation", "normal distribution"],
    "probability":    ["conditional probability", "Bayes theorem", "expected value", "counting principle"],
}

# One index URL per topic — pauls.py scrapes these to discover individual section pages
PAULS_INDEX_URLS: dict[str, str | None] = {
    "algebra":       "https://tutorial.math.lamar.edu/Classes/Alg/Alg.aspx",
    "calculus":      "https://tutorial.math.lamar.edu/Classes/CalcI/CalcI.aspx",
    "trigonometry":  "https://tutorial.math.lamar.edu/Classes/Trig/Trig.aspx",
    "statistics":    "https://tutorial.math.lamar.edu/Classes/CalcI/CalcI.aspx",
    "probability":   "https://tutorial.math.lamar.edu/Classes/CalcI/CalcI.aspx",
    "geometry":      None,  # AoPS-only
    "combinatorics": None,  # AoPS-only
    "number_theory": None,  # AoPS-only
}
