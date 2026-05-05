"""Task 3: Split the 2 oversized differential_equations units (>1000 chars) into smaller units."""
import argparse
import sqlite3

DB_PATH = "math_wiki.db"

# Replacements: (original_id, [new_units])
# Each new_unit is (id, type, topic, subtopic, content)
REPLACEMENTS = [
    (
        "two-tank-mixing-problem-setup",
        [
            (
                "two-tank-mixing-assumptions",
                "concept",
                "differential_equations",
                "modeling_systems",
                "Để thiết lập hệ phương trình vi phân cho bài toán hai bình khuấy, cần bốn giả thiết: "
                "(1) Thể tích mỗi bình không đổi (lưu lượng vào = lưu lượng ra). "
                "(2) Nồng độ chất ô nhiễm đồng đều trong mỗi bình tại mọi thời điểm (giả thiết khuấy đều). "
                "(3) Nồng độ dòng chảy ra bằng nồng độ trong bình tương ứng. "
                "(4) Dòng chảy ra từ bình 1 có thể chia — một phần vào bình 2, phần còn lại thoát ra ngoài.",
            ),
            (
                "two-tank-mixing-ode-system",
                "procedure",
                "differential_equations",
                "modeling_systems",
                "Gọi Q1(t) và Q2(t) là lượng chất ô nhiễm trong bình 1 và bình 2. "
                "Hệ phương trình vi phân: dQ1/dt = (lưu lượng vào bình 1) - (lưu lượng ra bình 1); "
                "dQ2/dt = (lưu lượng vào bình 2) - (lưu lượng ra bình 2). "
                "Mỗi số hạng tốc độ tính bằng (lưu lượng) × (nồng độ), với nồng độ = Q_i / V_i. "
                "Kết quả là hệ tuyến tính thuần nhất (không có nguồn ô nhiễm bên ngoài) "
                "hoặc không thuần nhất (khi dòng vào mang chất ô nhiễm).",
            ),
        ],
    ),
    (
        "variation-of-parameters-nth-order-system-derivation",
        [
            (
                "variation-of-parameters-nth-order-setup",
                "concept",
                "differential_equations",
                "variation_of_parameters",
                "Cho ODE tuyến tính bậc n: Y^(n) + p_{n-1}(t)Y^(n-1) + ... + p_0(t)Y = g(t) "
                "với tập nghiệm cơ bản {y_1, ..., y_n}. "
                "Phương pháp biến thiên hằng số tìm nghiệm riêng dạng Y = u_1*y_1 + u_2*y_2 + ... + u_n*y_n, "
                "trong đó u_i(t) là các hàm cần xác định.",
            ),
            (
                "variation-of-parameters-nth-order-wronskian",
                "procedure",
                "differential_equations",
                "variation_of_parameters",
                "Để tìm u'_1, ..., u'_n, vi phân Y nhiều lần và đặt điều kiện bổ sung "
                "cho các đạo hàm đến bậc n-2. Vì mỗi y_i là nghiệm của phương trình thuần nhất, "
                "ta thu được hệ đại số tuyến tính với ma trận hệ số là ma trận Wronskian của {y_1, ..., y_n}: "
                "hàng k là [u'_1*y_1^(k-1) + ... + u'_n*y_n^(k-1) = 0] với k=1..n-1, "
                "và hàng cuối [u'_1*y_1^(n-1) + ... + u'_n*y_n^(n-1) = g(t)]. "
                "Ma trận Wronskian khả nghịch vì {y_1,...,y_n} là tập cơ bản. "
                "Giải hệ để có u'_i, rồi tích phân để được u_i.",
            ),
        ],
    ),
]


def main(dry_run: bool) -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    oversized = conn.execute(
        "SELECT id, length(content) FROM wiki_units WHERE length(content) > 1000 AND deleted=0"
    ).fetchall()
    print(f"Oversized units (>1000 chars): {len(oversized)}")
    for r in oversized:
        print(f"  {r[0]}: {r[1]} chars")

    for original_id, new_units in REPLACEMENTS:
        print(f"\nSplitting: {original_id}")
        for uid, utype, topic, subtopic, content in new_units:
            print(f"  → {uid} ({len(content)} chars): {content[:60]!r}")

    if dry_run:
        print("\nDRY RUN — no changes made.")
        conn.close()
        return

    for original_id, new_units in REPLACEMENTS:
        conn.execute("UPDATE wiki_units SET deleted=1 WHERE id=?", (original_id,))
        for uid, utype, topic, subtopic, content in new_units:
            conn.execute(
                "INSERT OR REPLACE INTO wiki_units "
                "(id, type, topic, subtopic, content, problem_ids, source, version, deleted, last_edited_by) "
                "VALUES (?, ?, ?, ?, ?, '[]', 'manual', 1, 0, 'fix_oversize')",
                (uid, utype, topic, subtopic, content),
            )

    conn.commit()

    remaining = conn.execute(
        "SELECT COUNT(*) FROM wiki_units WHERE length(content) > 1000 AND deleted=0"
    ).fetchone()[0]
    print(f"\nDone. Oversized active units remaining: {remaining} (target 0)")
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(args.dry_run)
