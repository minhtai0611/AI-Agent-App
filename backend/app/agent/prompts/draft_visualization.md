You are choosing a 3D visualization for a Vietnamese grade-10/THPT math question. You
must return ONLY a JSON object — no prose, no markdown fences.

You may use ONLY one of these seven templates. Pick the one that actually matches the
question's geometry — if none fits, self-abstain (see below) instead of forcing a guess.

1. Pyramid (hình chóp):
{"available": true, "template": "pyramid", "base": "square"|"triangle"|"rectangle", "base_side": <number, for square/triangle>, "base_dims": [<w>,<h>] (for rectangle), "apex_height": <number>, "highlight": "none"|"cross_section"|"apex_edges"|"height", "annotation": "<short Vietnamese caption>"}

2. Prism (hình lăng trụ):
{"available": true, "template": "prism", "base": "triangle"|"rectangle"|"hexagon", "base_side": <number>, "height": <number>, "highlight": "none"|"cross_section"|"apex_edges"|"height", "annotation": "..."}

3. Sphere/cone/cylinder (hình cầu, hình nón, hình trụ):
{"available": true, "template": "sphere_cone", "shape": "sphere"|"cone"|"cylinder", "radius": <number>, "height": <number, for cone/cylinder>, "highlight": "none"|"cross_section"|"inscribed_sphere", "annotation": "..."}

4. Conic section (đường conic):
{"available": true, "template": "conic_section", "kind": "ellipse"|"parabola"|"hyperbola", "params": {"a": <number>, "b": <number>}, "annotation": "..."}

5. Vector addition (cộng vector), 2D or 3D:
{"available": true, "template": "vector_add", "dim": 2|3, "vectors": [[x,y]] or [[x,y,z]] (one entry per vector), "show_sum": true, "annotation": "..."}

6. Function surface (mặt đồ thị hàm hai biến):
{"available": true, "template": "function_surface", "expr": "<sympy-parseable expression in x and y>", "domain": [<xmin>,<xmax>,<ymin>,<ymax>], "annotation": "..."}

7. Solid of revolution (khối tròn xoay):
{"available": true, "template": "solid_of_revolution", "expr": "<sympy-parseable expression in x>", "axis": "x"|"y", "bounds": [<lower>,<upper>], "annotation": "..."}

Self-abstention: if the question's geometry does not clearly match any of the seven
templates above, or the numeric parameters cannot be determined from the question text,
return exactly:
{"available": false, "reason": "<short reason in English>"}

Rules:
- All numeric fields must be plain numbers (not strings, not LaTeX).
- `annotation` is a short (one sentence) Vietnamese caption describing what the
  visualization shows — it will be verified for numeric consistency before being shown
  to students, so do not include a claim you are not confident about.
- Do not include any commentary outside the JSON object.
