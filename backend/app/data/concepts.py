"""
Initial concept taxonomy for the Zenith Learning Graph.

20 seed concepts covering grades 9–10 math curriculum (TPHCM entrance + THPT).
Each concept maps to an existing questions.topic value so concept_id can be
assigned to questions without a migration gap.

Prerequisite graph (edges point from required → dependent):
  linear_eq → linear_systems, quad_eq, radicals, linear_func, inequalities
  quad_eq   → quad_func, inequalities, sequences
  basic_geo → triangles, circles, coord_geo, trig_basic
  triangles → circles, trig_basic
  coord_geo → vectors
  sequences → financial_math
  stats_basic → prob_basic
"""

CONCEPTS: list[dict] = [
    # ── Grade 9 foundation ────────────────────────────────────────────────
    {
        "id": "linear_eq",
        "name": "Linear Equations",
        "name_vi": "Phương trình bậc nhất",
        "grade": 9,
        "topic": "algebra",
        "prerequisite_ids": [],
        "exam_weight": 2.0,
    },
    {
        "id": "linear_systems",
        "name": "Systems of Linear Equations",
        "name_vi": "Hệ phương trình bậc nhất",
        "grade": 9,
        "topic": "algebra",
        "prerequisite_ids": ["linear_eq"],
        "exam_weight": 2.5,
    },
    {
        "id": "quad_eq",
        "name": "Quadratic Equations",
        "name_vi": "Phương trình bậc hai",
        "grade": 9,
        "topic": "algebra",
        "prerequisite_ids": ["linear_eq"],
        "exam_weight": 3.0,
    },
    {
        "id": "radicals",
        "name": "Radical Expressions",
        "name_vi": "Căn thức và biến đổi",
        "grade": 9,
        "topic": "algebra",
        "prerequisite_ids": ["linear_eq"],
        "exam_weight": 2.0,
    },
    {
        "id": "inequalities",
        "name": "Inequalities",
        "name_vi": "Bất phương trình",
        "grade": 9,
        "topic": "algebra",
        "prerequisite_ids": ["linear_eq", "quad_eq"],
        "exam_weight": 2.0,
    },
    {
        "id": "basic_geo",
        "name": "Basic Plane Geometry",
        "name_vi": "Hình học phẳng cơ bản",
        "grade": 9,
        "topic": "geometry",
        "prerequisite_ids": [],
        "exam_weight": 2.0,
    },
    {
        "id": "triangles",
        "name": "Triangles",
        "name_vi": "Tam giác và các tính chất",
        "grade": 9,
        "topic": "geometry",
        "prerequisite_ids": ["basic_geo"],
        "exam_weight": 2.5,
    },
    {
        "id": "circles",
        "name": "Circles",
        "name_vi": "Đường tròn",
        "grade": 9,
        "topic": "geometry",
        "prerequisite_ids": ["basic_geo", "triangles"],
        "exam_weight": 2.5,
    },
    {
        "id": "stats_basic",
        "name": "Basic Statistics",
        "name_vi": "Thống kê cơ bản",
        "grade": 9,
        "topic": "statistics",
        "prerequisite_ids": [],
        "exam_weight": 1.5,
    },
    {
        "id": "prob_basic",
        "name": "Basic Probability",
        "name_vi": "Xác suất cơ bản",
        "grade": 9,
        "topic": "probability",
        "prerequisite_ids": ["stats_basic"],
        "exam_weight": 1.5,
    },
    {
        "id": "combinatorics",
        "name": "Combinatorics",
        "name_vi": "Tổ hợp và chỉnh hợp",
        "grade": 9,
        "topic": "combinatorics",
        "prerequisite_ids": [],
        "exam_weight": 2.0,
    },
    {
        "id": "number_theory",
        "name": "Number Theory",
        "name_vi": "Lý thuyết số cơ bản",
        "grade": 9,
        "topic": "number_theory",
        "prerequisite_ids": [],
        "exam_weight": 1.5,
    },
    {
        "id": "sets",
        "name": "Sets",
        "name_vi": "Tập hợp",
        "grade": 9,
        "topic": "sets",
        "prerequisite_ids": [],
        "exam_weight": 1.0,
    },
    # ── Grade 10 ──────────────────────────────────────────────────────────
    {
        "id": "linear_func",
        "name": "Linear Functions",
        "name_vi": "Hàm số bậc nhất",
        "grade": 10,
        "topic": "functions",
        "prerequisite_ids": ["linear_eq"],
        "exam_weight": 2.0,
    },
    {
        "id": "quad_func",
        "name": "Quadratic Functions & Parabola",
        "name_vi": "Hàm số bậc hai và parabol",
        "grade": 10,
        "topic": "functions",
        "prerequisite_ids": ["quad_eq"],
        "exam_weight": 2.5,
    },
    {
        "id": "coord_geo",
        "name": "Coordinate Geometry",
        "name_vi": "Hình học tọa độ Oxy",
        "grade": 10,
        "topic": "coordinate_geometry",
        "prerequisite_ids": ["linear_eq", "basic_geo"],
        "exam_weight": 2.5,
    },
    {
        "id": "trig_basic",
        "name": "Basic Trigonometry",
        "name_vi": "Lượng giác cơ bản",
        "grade": 10,
        "topic": "trigonometry",
        "prerequisite_ids": ["basic_geo", "triangles"],
        "exam_weight": 2.5,
    },
    {
        "id": "vectors",
        "name": "Plane Vectors",
        "name_vi": "Vectơ phẳng",
        "grade": 10,
        "topic": "vectors",
        "prerequisite_ids": ["coord_geo"],
        "exam_weight": 2.0,
    },
    {
        "id": "sequences",
        "name": "Sequences",
        "name_vi": "Dãy số",
        "grade": 10,
        "topic": "sequences",
        "prerequisite_ids": ["quad_eq"],
        "exam_weight": 1.5,
    },
    {
        "id": "financial_math",
        "name": "Financial Mathematics",
        "name_vi": "Toán tài chính",
        "grade": 10,
        "topic": "financial_math",
        "prerequisite_ids": ["sequences"],
        "exam_weight": 1.5,
    },
]
