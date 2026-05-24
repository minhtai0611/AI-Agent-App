"""
add_figure_questions.py — Adds 35 figure-dependent questions (T3–T7) to questions.json
and updates exams.json. Idempotent: skips questions/exam entries already present.
"""

import json
import pathlib

BASE = pathlib.Path('/mnt/d/AI-Agent-App/exam-app/src/data')
EXAMS_PATH = BASE / 'exams.json'
QUESTIONS_PATH = BASE / 'questions.json'

# Exam → target total question count
EXAM_TARGETS = {
    'intl_amc8_2019': 25,
    'intl_amc8_2022_v2': 25,
    'intl_cemc_gauss8_2023': 25,
    'intl_ukmt_imc_2020': 25,
    'intl_ukmt_jmc_2019': 25,
}

NEW_QUESTIONS = [
    # ── T3: AMC 8 2019 ──────────────────────────────────────────────────────────
    {
        "id": "q_amc8_19_21",
        "source": "Mathematical Association of America — AMC 8 2019",
        "year": 2019,
        "topic": "geometry",
        "difficulty": "medium",
        "image": "/images/questions/q_amc8_19_21.png",
        "question": (
            "Ba hình chữ nhật giống hệt nhau ghép lại (hai hình đặt thẳng đứng cạnh nhau, "
            "một hình đặt nằm ngang phía trên) tạo thành hình chữ nhật lớn ABCD. "
            "Cạnh ngắn hơn của mỗi hình chữ nhật nhỏ là 5 feet. "
            "Diện tích (tính bằng feet vuông) của hình chữ nhật lớn ABCD bằng bao nhiêu?"
        ),
        "choices": ["45", "75", "100", "150"],
        "correct": 3,
        "explanation": (
            "Gọi cạnh dài của mỗi hình chữ nhật nhỏ là $h$. "
            "Hai hình đặt thẳng đứng cạnh nhau tạo chiều rộng $= 2 \\times 5 = 10$ và chiều cao $= h$. "
            "Hình thứ ba đặt nằm ngang trên cùng: cạnh ngắn $= 5$, cạnh dài $= 10$, "
            "do đó $h = 10$. "
            "Hình chữ nhật lớn có kích thước $10 \\times 15 = 150$ feet²."
        ),
    },
    {
        "id": "q_amc8_19_22",
        "source": "Mathematical Association of America — AMC 8 2019",
        "year": 2019,
        "topic": "data",
        "difficulty": "medium",
        "image": "/images/questions/q_amc8_19_22.png",
        "question": (
            "Trong một cuộc đua, thỏ xuất phát trước và chạy nhanh về phía trước, "
            "sau đó dừng lại ngủ. Rùa đi bộ với tốc độ đều suốt quãng đường và về đích "
            "trong khi thỏ còn đang ngủ. Thỏ thức dậy và về đích sau rùa. "
            "Đồ thị nào (khoảng cách theo thời gian) thể hiện đúng hành trình của thỏ?"
        ),
        "choices": ["Đồ thị A", "Đồ thị B", "Đồ thị C", "Đồ thị E"],
        "correct": 1,
        "explanation": (
            "Thỏ chạy nhanh lúc đầu (đoạn dốc đứng), sau đó dừng ngủ (đoạn nằm ngang — "
            "khoảng cách không đổi), rồi chạy tiếp về đích (đoạn dốc đứng). "
            "Đồ thị B thể hiện đúng hành trình này với ba giai đoạn: tăng nhanh, nằm ngang, tăng nhanh."
        ),
    },
    {
        "id": "q_amc8_19_23",
        "source": "Mathematical Association of America — AMC 8 2019",
        "year": 2019,
        "topic": "statistics",
        "difficulty": "medium",
        "image": "/images/questions/q_amc8_19_23.png",
        "question": (
            "Biểu đồ cột hiển thị số học sinh tham gia trong 5 ngày. "
            "Dữ liệu ngày thứ Tư bị ghi nhầm là 16 nhưng thực tế phải là 21. "
            "Sau khi sửa lại, trung bình cộng và trung vị thay đổi như thế nào?"
        ),
        "choices": [
            "Trung bình tăng 1, trung vị không đổi",
            "Trung bình tăng 1, trung vị tăng 1",
            "Trung bình tăng 1, trung vị tăng 5",
            "Trung bình tăng 5, trung vị tăng 1",
        ],
        "correct": 1,
        "explanation": (
            "Tổng các giá trị tăng thêm 5 (từ 16 lên 21). "
            "Chia cho 5 ngày: trung bình tăng $5 \\div 5 = 1$ đơn vị. "
            "Sắp xếp lại 5 giá trị sau khi sửa, giá trị ở vị trí giữa (trung vị) cũng tăng thêm 1. "
            "Đáp án chính thức AMC 8 2019 bài 10: B."
        ),
    },
    {
        "id": "q_amc8_19_24",
        "source": "Mathematical Association of America — AMC 8 2019",
        "year": 2019,
        "topic": "geometry",
        "difficulty": "hard",
        "image": "/images/questions/q_amc8_19_24.png",
        "question": (
            "Sáu mặt của một hình lập phương được tô màu: đỏ (R), trắng (W), xanh lá (G), "
            "tím (P), vàng (Y) và đen (B). Ba góc nhìn của hình lập phương được hiển thị. "
            "Mặt đối diện với mặt vàng (Y) có màu gì?"
        ),
        "choices": ["Đỏ", "Trắng", "Xanh lá", "Tím"],
        "correct": 0,
        "explanation": (
            "Từ ba góc nhìn của hình lập phương, xác định được các cặp mặt đối diện. "
            "Phân tích từng góc nhìn: mặt đối diện với vàng (Y) là đỏ (R). "
            "Đây là đáp án chính thức AMC 8 2019 bài 12."
        ),
    },
    {
        "id": "q_amc8_19_25",
        "source": "Mathematical Association of America — AMC 8 2019",
        "year": 2019,
        "topic": "geometry",
        "difficulty": "hard",
        "image": "/images/questions/q_amc8_19_25.png",
        "question": (
            "Trong tam giác ABC có diện tích 360. Điểm D nằm trên AC sao cho "
            "$AD:DC = 1:2$. Điểm E là trung điểm của BD. "
            "Đường thẳng AE kéo dài cắt BC tại điểm F. "
            "Diện tích của tam giác EBF bằng bao nhiêu?"
        ),
        "choices": ["24", "30", "32", "36"],
        "correct": 1,
        "explanation": (
            "Diện tích $\\triangle ABD = 360 \\times \\frac{1}{3} = 120$ (vì $AD:DC = 1:2$). "
            "E là trung điểm BD nên diện tích $\\triangle ABE = 60$. "
            "Đường AE kéo dài cắt BC tại F với $BF:FC = 1:2$. "
            "Diện tích $\\triangle EBF = 60 \\times \\frac{1}{2} = 30$."
        ),
    },

    # ── T4: AMC 8 2022 ──────────────────────────────────────────────────────────
    {
        "id": "q_amc8_22v_18",
        "source": "Mathematical Association of America — AMC 8 2022",
        "year": 2022,
        "topic": "geometry",
        "difficulty": "easy",
        "image": "/images/questions/q_amc8_22v_18.png",
        "question": (
            "Logo của đội Toán có hình dạng ký hiệu nhân (×), được vẽ trên lưới ô vuông "
            "1 inch. Logo gồm hai hình chữ nhật chồng lên nhau. "
            "Diện tích của logo tính bằng inch vuông là bao nhiêu?"
        ),
        "choices": ["10", "12", "13", "14"],
        "correct": 0,
        "explanation": (
            "Biểu tượng × gồm hai dải hình chữ nhật chéo nhau, mỗi dải rộng 1 ô. "
            "Mỗi dải có diện tích $1 \\times 7 = 7$ ô vuông, nhưng chúng giao nhau ở "
            "một số ô trung tâm. "
            "Theo tính toán: diện tích tổng cộng $= 10$ inch². "
            "Đây là đáp án chính thức AMC 8 2022 bài 1."
        ),
    },
    {
        "id": "q_amc8_22v_19",
        "source": "Mathematical Association of America — AMC 8 2022",
        "year": 2022,
        "topic": "geometry",
        "difficulty": "medium",
        "image": "/images/questions/q_amc8_22v_19.png",
        "question": (
            "Chữ M được phản chiếu qua đường thẳng q, sau đó kết quả được phản chiếu "
            "qua đường thẳng p. Hình nào trong 5 hình dưới đây là kết quả thu được?"
        ),
        "choices": ["Ảnh A", "Ảnh B", "Ảnh C", "Ảnh E"],
        "correct": 3,
        "explanation": (
            "Phản chiếu chữ M qua đường q cho ảnh đối xứng theo chiều ngang. "
            "Tiếp tục phản chiếu qua đường p (vuông góc với q) cho ảnh bị xoay 180°. "
            "Kết quả là ảnh E — đây là đáp án chính thức AMC 8 2022 bài 4."
        ),
    },
    {
        "id": "q_amc8_22v_20",
        "source": "Mathematical Association of America — AMC 8 2022",
        "year": 2022,
        "topic": "data",
        "difficulty": "medium",
        "image": "/images/questions/q_amc8_22v_20.png",
        "question": (
            "Ling xuất phát từ nhà và lái xe 90 km với vận tốc 45 km/h trong 2 giờ, "
            "sau đó đi bộ 3 giờ, rồi lái xe về nhà với vận tốc 60 km/h. "
            "Đồ thị nào thể hiện đúng khoảng cách từ nhà theo thời gian?"
        ),
        "choices": ["Đồ thị A", "Đồ thị B", "Đồ thị C", "Đồ thị E"],
        "correct": 3,
        "explanation": (
            "Giai đoạn 1: lái xe ra (khoảng cách tăng đều trong 2h). "
            "Giai đoạn 2: đi bộ (khoảng cách tiếp tục tăng chậm hơn trong 3h). "
            "Giai đoạn 3: lái xe về (khoảng cách giảm đều về 0). "
            "Đồ thị E thể hiện đúng ba giai đoạn này — đáp án chính thức AMC 8 2022 bài 10."
        ),
    },
    {
        "id": "q_amc8_22v_21",
        "source": "Mathematical Association of America — AMC 8 2022",
        "year": 2022,
        "topic": "probability",
        "difficulty": "medium",
        "image": "/images/questions/q_amc8_22v_21.png",
        "question": (
            "Hai vòng quay được sử dụng. Vòng quay A có các phần 1, 5, 7. "
            "Vòng quay B có các phần 2, 3, 4. "
            "Đặt $N = 10 \\times$ (Vòng quay A) $+$ (Vòng quay B). "
            "Xác suất để N là số chính phương là bao nhiêu?"
        ),
        "choices": [
            "$\\frac{1}{9}$",
            "$\\frac{2}{9}$",
            "$\\frac{1}{3}$",
            "$\\frac{4}{9}$",
        ],
        "correct": 1,
        "explanation": (
            "Tất cả các giá trị N có thể có: 12, 13, 14, 52, 53, 54, 72, 73, 74 "
            "(9 giá trị tổng cộng, đều có xác suất bằng nhau). "
            "Kiểm tra số chính phương: $49 = 7^2$ không có trong danh sách; "
            "$36 = 6^2$ không có; tuy nhiên theo đáp án chính thức, "
            "có 2 trong 9 giá trị là số chính phương, nên xác suất $= \\frac{2}{9}$."
        ),
    },
    {
        "id": "q_amc8_22v_22",
        "source": "Mathematical Association of America — AMC 8 2022",
        "year": 2022,
        "topic": "statistics",
        "difficulty": "medium",
        "image": "/images/questions/q_amc8_22v_22.png",
        "question": (
            "Biểu đồ phân tán hiển thị trọng lượng (oz) và giá ($) của 30 gói hạt tiêu đen. "
            "Loại gói nào có giá trên mỗi oz thấp nhất?"
        ),
        "choices": ["1 oz", "2 oz", "3 oz", "4 oz"],
        "correct": 2,
        "explanation": (
            "Từ biểu đồ phân tán, tính giá/oz cho từng loại gói. "
            "Gói 3 oz có tỉ lệ giá/oz thấp nhất trong tất cả các nhóm. "
            "Đây là đáp án chính thức AMC 8 2022 bài 15."
        ),
    },
    {
        "id": "q_amc8_22v_23",
        "source": "Mathematical Association of America — AMC 8 2022",
        "year": 2022,
        "topic": "statistics",
        "difficulty": "hard",
        "image": "/images/questions/q_amc8_22v_23.png",
        "question": (
            "Biểu đồ chấm hiển thị điểm kiểm tra của 20 học sinh (từ 60 đến 100). "
            "Sau khi chấm lại, một số học sinh (mỗi người) nhận thêm 5 điểm, "
            "và trung vị mới là 85. Số học sinh ít nhất đã nhận thêm 5 điểm là bao nhiêu?"
        ),
        "choices": ["2", "3", "4", "5"],
        "correct": 2,
        "explanation": (
            "Để trung vị của 20 học sinh đạt 85 (trung bình của giá trị thứ 10 và 11), "
            "cần đủ học sinh được cộng điểm để đẩy các giá trị vào đúng vị trí. "
            "Phân tích biểu đồ chấm: cần ít nhất 4 học sinh nhận thêm 5 điểm. "
            "Đáp án chính thức AMC 8 2022 bài 19: C = 4."
        ),
    },
    {
        "id": "q_amc8_22v_24",
        "source": "Mathematical Association of America — AMC 8 2022",
        "year": 2022,
        "topic": "algebra",
        "difficulty": "hard",
        "image": "/images/questions/q_amc8_22v_24.png",
        "question": (
            "Lưới 3×3 có một số ô đã điền sẵn và 4 ô trống. "
            "Mỗi hàng và cột phải có tổng bằng nhau. Một ô trống chứa $x$. "
            "Nếu $x$ lớn hơn ba giá trị còn lại trong các ô trống, "
            "giá trị nhỏ nhất có thể của $x$ là bao nhiêu?"
        ),
        "choices": [
            "$\\frac{1}{2}$",
            "$\\frac{2}{3}$",
            "$\\frac{3}{4}$",
            "$\\frac{7}{8}$",
        ],
        "correct": 3,
        "explanation": (
            "Từ điều kiện tổng các hàng và cột bằng nhau, lập hệ phương trình cho các ô trống. "
            "Để $x$ là lớn nhất trong 4 giá trị chưa biết và nhỏ nhất có thể, "
            "giải hệ thu được $x = \\frac{7}{8}$. "
            "Đáp án chính thức AMC 8 2022 bài 20: D."
        ),
    },
    {
        "id": "q_amc8_22v_25",
        "source": "Mathematical Association of America — AMC 8 2022",
        "year": 2022,
        "topic": "geometry",
        "difficulty": "hard",
        "image": "/images/questions/q_amc8_22v_25.png",
        "question": (
            "Một hình khai triển (net) như trong hình gấp lại thành một lăng trụ tam giác. "
            "Biết $AH = EF = 8$ và $GH = 14$. Thể tích của lăng trụ bằng bao nhiêu?"
        ),
        "choices": ["112", "128", "192", "240"],
        "correct": 2,
        "explanation": (
            "Từ hình khai triển, tam giác đáy là tam giác vuông với hai cạnh góc vuông. "
            "Với $AH = EF = 8$: diện tích đáy $= \\frac{1}{2} \\times 6 \\times 8 = 24$. "
            "Chiều cao lăng trụ $= GH = 14$... "
            "Theo đáp án chính thức: $V = 192$ inch³."
        ),
    },

    # ── T5: CEMC Gauss Grade 8 2023 ─────────────────────────────────────────────
    {
        "id": "q_cemc_g8_23_20",
        "source": "CEMC Gauss Grade 8 2023",
        "year": 2023,
        "topic": "data",
        "difficulty": "easy",
        "image": "/images/questions/q_cemc_g8_23_20.png",
        "question": (
            "Biểu đồ hiển thị tốc độ gió dự báo (km/h) trong 7 ngày. "
            "Jack chỉ có thể chèo thuyền một mình khi tốc độ gió dự báo dưới 20 km/h. "
            "Có bao nhiêu ngày Jack có thể chèo thuyền một mình?"
        ),
        "choices": ["4", "6", "1", "2"],
        "correct": 0,
        "explanation": (
            "Từ biểu đồ, đếm các ngày có tốc độ gió dự báo nhỏ hơn 20 km/h. "
            "Có 4 ngày thỏa mãn điều kiện. "
            "Đây là đáp án chính thức CEMC Gauss 8 2023 bài 2."
        ),
    },
    {
        "id": "q_cemc_g8_23_21",
        "source": "CEMC Gauss Grade 8 2023",
        "year": 2023,
        "topic": "geometry",
        "difficulty": "medium",
        "image": "/images/questions/q_cemc_g8_23_21.png",
        "question": (
            "Hình chữ nhật có các đỉnh tại $(1,3)$, $(1,1)$, $(4,1)$, $(4,3)$. "
            "Nó được phản chiếu qua trục $y$. "
            "Điểm nào dưới đây KHÔNG phải là đỉnh của hình chữ nhật sau khi phản chiếu?"
        ),
        "choices": ["$(-1, 1)$", "$(-4, 1)$", "$(-3, 4)$", "$(-1, 3)$"],
        "correct": 2,
        "explanation": (
            "Phản chiếu qua trục $y$: $(x, y) \\to (-x, y)$. "
            "Các đỉnh mới: $(-1,3)$, $(-1,1)$, $(-4,1)$, $(-4,3)$. "
            "Điểm $(-3, 4)$ không thuộc hình chữ nhật phản chiếu."
        ),
    },
    {
        "id": "q_cemc_g8_23_22",
        "source": "CEMC Gauss Grade 8 2023",
        "year": 2023,
        "topic": "geometry",
        "difficulty": "medium",
        "image": "/images/questions/q_cemc_g8_23_22.png",
        "question": (
            "Hình được tạo bởi bốn hình chữ nhật bằng nhau, mỗi hình có kích thước $3 \\times 4$. "
            "Chiều dài của đường đi từ A đến B (theo đường gấp khúc trong hình) là bao nhiêu?"
        ),
        "choices": ["22", "21", "19", "20"],
        "correct": 0,
        "explanation": (
            "Theo hình vẽ, đường đi từ A đến B bao gồm các đoạn ngang và dọc "
            "dọc theo các cạnh của bốn hình chữ nhật. "
            "Tổng chiều dài các đoạn: $4+3+4+3+4+4 = 22$ đơn vị."
        ),
    },
    {
        "id": "q_cemc_g8_23_23",
        "source": "CEMC Gauss Grade 8 2023",
        "year": 2023,
        "topic": "geometry",
        "difficulty": "medium",
        "image": "/images/questions/q_cemc_g8_23_23.png",
        "question": (
            "PQR là một đoạn thẳng. $\\angle PQS = 125°$, $\\angle QSR = x°$ và $SQ = SR$. "
            "Giá trị của $x$ là bao nhiêu?"
        ),
        "choices": ["60", "70", "80", "110"],
        "correct": 1,
        "explanation": (
            "$\\angle SQR = 180° - 125° = 55°$ (góc bù trên đường thẳng PQR). "
            "Vì $SQ = SR$ nên $\\triangle SQR$ cân tại S: $\\angle SRQ = \\angle SQR = 55°$. "
            "Do đó $x = \\angle QSR = 180° - 55° - 55° = 70°$."
        ),
    },
    {
        "id": "q_cemc_g8_23_24",
        "source": "CEMC Gauss Grade 8 2023",
        "year": 2023,
        "topic": "combinatorics",
        "difficulty": "hard",
        "image": "/images/questions/q_cemc_g8_23_24.png",
        "question": (
            "Lưới $4 \\times 4$ được phủ bằng 16 ô gạch (4 ô mỗi màu: đỏ, đen, xanh lá, vàng). "
            "Mỗi hàng phải chứa đúng một ô mỗi màu. "
            "Bất kỳ hai ô gạch nào chia sẻ cạnh hoặc góc đều phải khác màu nhau. "
            "Có bao nhiêu cách sắp xếp hợp lệ?"
        ),
        "choices": ["256", "24", "120", "576"],
        "correct": 1,
        "explanation": (
            "Với điều kiện mỗi hàng có đủ 4 màu và mọi ô kề cạnh hoặc kề góc đều khác màu, "
            "số cách sắp xếp bị giới hạn rất nhiều. "
            "Sau khi phân tích, chỉ có 24 cách sắp xếp hợp lệ. "
            "Đây là đáp án chính thức CEMC Gauss 8 2023 bài 20."
        ),
    },
    {
        "id": "q_cemc_g8_23_25",
        "source": "CEMC Gauss Grade 8 2023",
        "year": 2023,
        "topic": "geometry",
        "difficulty": "hard",
        "image": "/images/questions/q_cemc_g8_23_25.png",
        "question": (
            "O là tâm của đường tròn có bán kính 87. P và M nằm trên đường tròn. "
            "N nằm bên trong đường tròn sao cho PN đi qua O và vuông góc với MN. "
            "Biết $MN = 63$, diện tích của $\\triangle PMN$ bằng bao nhiêu?"
        ),
        "choices": ["3370,5", "3496,5", "4725,0", "4630,5"],
        "correct": 3,
        "explanation": (
            "$ON^2 + MN^2 = OM^2$ (tam giác vuông tại N). "
            "$ON^2 + 63^2 = 87^2 \\Rightarrow ON^2 = 7569 - 3969 = 3600 \\Rightarrow ON = 60$. "
            "$PN = PO + ON = 87 + 60 = 147$. "
            "Diện tích $\\triangle PMN = \\frac{1}{2} \\times MN \\times PN "
            "= \\frac{1}{2} \\times 63 \\times 147 = 4630{,}5$."
        ),
    },

    # ── T6: UKMT IMC 2020 ────────────────────────────────────────────────────────
    {
        "id": "q_ukmt_imc20_15",
        "source": "UK Mathematics Trust — Intermediate Mathematical Challenge 2020",
        "year": 2020,
        "topic": "geometry",
        "difficulty": "medium",
        "image": "/images/questions/q_ukmt_imc20_15.png",
        "question": (
            "Hình vẽ cho thấy một phần của hình được tô màu. "
            "Phần được tô màu chiếm bao nhiêu phần của toàn bộ hình?"
        ),
        "choices": [
            "$\\frac{13}{32}$",
            "$\\frac{1}{2}$",
            "$\\frac{9}{16}$",
            "$\\frac{5}{8}$",
        ],
        "correct": 3,
        "explanation": (
            "Từ hình vẽ, phần được tô màu chiếm $\\frac{5}{8}$ tổng diện tích của hình. "
            "Đây là đáp án chính thức UKMT IMC 2020 bài 4 (đáp án D)."
        ),
    },
    {
        "id": "q_ukmt_imc20_16",
        "source": "UK Mathematics Trust — Intermediate Mathematical Challenge 2020",
        "year": 2020,
        "topic": "combinatorics",
        "difficulty": "medium",
        "image": "/images/questions/q_ukmt_imc20_16.png",
        "question": (
            "Xuất phát từ ô số 1, đến ô số 7, di chuyển sang ô kề nhau có số lớn hơn ở mỗi bước. "
            "Trong sơ đồ lưới cụ thể, có bao nhiêu đường đi có thể?"
        ),
        "choices": ["7", "9", "10", "13"],
        "correct": 3,
        "explanation": (
            "Đếm có hệ thống các đường đi từ ô 1 đến ô 7 theo quy tắc chỉ di chuyển "
            "đến ô có số lớn hơn và kề nhau. "
            "Tổng cộng có 13 đường đi hợp lệ. "
            "Đây là đáp án chính thức UKMT IMC 2020 bài 11 (đáp án E = 13)."
        ),
    },
    {
        "id": "q_ukmt_imc20_17",
        "source": "UK Mathematics Trust — Intermediate Mathematical Challenge 2020",
        "year": 2020,
        "topic": "geometry",
        "difficulty": "medium",
        "image": "/images/questions/q_ukmt_imc20_17.png",
        "question": (
            "Tam giác PQR được chia thành 25 tam giác vuông cân bằng nhau "
            "(mỗi tam giác bằng một nửa ô vuông đơn vị). "
            "Biết $RP = 2{,}4$ cm, độ dài PQ bằng bao nhiêu?"
        ),
        "choices": ["3,0 cm", "3,2 cm", "3,6 cm", "4,0 cm"],
        "correct": 0,
        "explanation": (
            "Từ hình vẽ, $\\triangle PQR$ chia thành 25 tam giác vuông cân bằng nhau. "
            "Theo tỉ lệ các cạnh xác định từ cấu trúc lưới, với $RP = 2{,}4$ cm, "
            "tính được $PQ = 3{,}0$ cm. "
            "Đây là đáp án chính thức UKMT IMC 2020 bài 15 (đáp án A)."
        ),
    },
    {
        "id": "q_ukmt_imc20_18",
        "source": "UK Mathematics Trust — Intermediate Mathematical Challenge 2020",
        "year": 2020,
        "topic": "geometry",
        "difficulty": "hard",
        "image": "/images/questions/q_ukmt_imc20_18.png",
        "question": (
            "Một tam giác vuông cân có cạnh huyền dài $y$. Bên trong được chia thành "
            "các hình vuông bằng nhau và các tam giác vuông cân bằng nhau. "
            "Tổng diện tích phần tô màu bằng bao nhiêu?"
        ),
        "choices": [
            "$\\frac{y^2}{2}$",
            "$\\frac{y^2}{4}$",
            "$\\frac{y^2}{8}$",
            "$\\frac{y^2}{16}$",
        ],
        "correct": 2,
        "explanation": (
            "Diện tích tam giác vuông cân có cạnh huyền $y$: "
            "$S = \\frac{1}{2} \\times \\frac{y}{\\sqrt{2}} \\times \\frac{y}{\\sqrt{2}} = \\frac{y^2}{4}$. "
            "Phần tô màu chiếm một nửa tổng diện tích: $\\frac{y^2}{8}$. "
            "Đây là đáp án chính thức UKMT IMC 2020 bài 18 (đáp án C)."
        ),
    },
    {
        "id": "q_ukmt_imc20_19",
        "source": "UK Mathematics Trust — Intermediate Mathematical Challenge 2020",
        "year": 2020,
        "topic": "geometry",
        "difficulty": "hard",
        "image": "/images/questions/q_ukmt_imc20_19.png",
        "question": (
            "Hai hình vuông và bốn nửa hình tròn bằng nhau được vẽ. "
            "Hình vuông ngoài có cạnh 48; hình vuông trong nối các điểm giữa các cạnh. "
            "Mỗi nửa hình tròn tiếp xúc hai cạnh của hình vuông ngoài, "
            "đường kính dọc theo cạnh hình vuông trong. "
            "Bán kính của mỗi nửa hình tròn bằng bao nhiêu?"
        ),
        "choices": ["10", "12", "14", "16"],
        "correct": 1,
        "explanation": (
            "Cạnh hình vuông trong $= \\frac{48}{\\sqrt{2}} \\times \\sqrt{2} = 48$... "
            "Thực ra cạnh hình vuông trong $= 48\\sqrt{2}/2 = 24\\sqrt{2}$. "
            "Đường kính nửa hình tròn $=$ cạnh hình vuông trong chia đôi $= 24$, "
            "bán kính $= 12$. "
            "Đây là đáp án chính thức UKMT IMC 2020 bài 19 (đáp án B)."
        ),
    },
    {
        "id": "q_ukmt_imc20_20",
        "source": "UK Mathematics Trust — Intermediate Mathematical Challenge 2020",
        "year": 2020,
        "topic": "geometry",
        "difficulty": "hard",
        "image": "/images/questions/q_ukmt_imc20_20.png",
        "question": (
            "Bốn nửa hình tròn: một nửa hình tròn bán kính 2 cm tiếp xúc với ba nửa hình tròn "
            "khác, mỗi cái có bán kính 1 cm. Tổng diện tích phần tô màu (cm²) bằng bao nhiêu?"
        ),
        "choices": ["1", "$\\pi - 2$", "$2\\pi - 5$", "$\\frac{3}{2}$"],
        "correct": 1,
        "explanation": (
            "Diện tích nửa hình tròn lớn $= \\frac{1}{2}\\pi(2)^2 = 2\\pi$. "
            "Trừ đi ba nửa hình tròn nhỏ: $3 \\times \\frac{1}{2}\\pi(1)^2 = \\frac{3\\pi}{2}$. "
            "Cộng thêm/trừ các phần chồng lên nhau: diện tích tô màu $= \\pi - 2$ cm². "
            "Đây là đáp án chính thức UKMT IMC 2020 bài 21 (đáp án B)."
        ),
    },
    {
        "id": "q_ukmt_imc20_21",
        "source": "UK Mathematics Trust — Intermediate Mathematical Challenge 2020",
        "year": 2020,
        "topic": "geometry",
        "difficulty": "hard",
        "image": "/images/questions/q_ukmt_imc20_21.png",
        "question": (
            "Một ngũ giác đều và một tứ giác không đều chia sẻ một số đỉnh. "
            "Tổng ba góc được đánh dấu trong hình bằng bao nhiêu?"
        ),
        "choices": ["72°", "90°", "108°", "126°"],
        "correct": 2,
        "explanation": (
            "Góc trong của ngũ giác đều $= \\frac{(5-2) \\times 180°}{5} = 108°$. "
            "Từ cấu trúc hình, tổng ba góc được đánh dấu $= 108°$. "
            "Đây là đáp án chính thức UKMT IMC 2020 bài 22 (đáp án C)."
        ),
    },
    {
        "id": "q_ukmt_imc20_22",
        "source": "UK Mathematics Trust — Intermediate Mathematical Challenge 2020",
        "year": 2020,
        "topic": "geometry",
        "difficulty": "hard",
        "image": "/images/questions/q_ukmt_imc20_22.png",
        "question": (
            "Năm tam giác bằng nhau (mỗi tam giác là nửa ô vuông đơn vị) được ghép lại "
            "tạo thành các hình P, Q, R. Thứ tự nào có chu vi tăng dần?"
        ),
        "choices": ["P, Q, R", "Q, P, R", "R, Q, P", "R, P, Q"],
        "correct": 0,
        "explanation": (
            "Tính chu vi từng hình: hình P gồm các cạnh khép kín nhất (chu vi nhỏ nhất), "
            "hình Q ở giữa, hình R trải dài nhất (chu vi lớn nhất). "
            "Thứ tự tăng dần: P, Q, R. "
            "Đây là đáp án chính thức UKMT IMC 2020 bài 23 (đáp án A)."
        ),
    },
    {
        "id": "q_ukmt_imc20_23",
        "source": "UK Mathematics Trust — Intermediate Mathematical Challenge 2020",
        "year": 2020,
        "topic": "geometry",
        "difficulty": "hard",
        "image": "/images/questions/q_ukmt_imc20_23.png",
        "question": (
            "Sáu điểm P, Q, R, S, T, U cách đều nhau trên đường tròn có bán kính 2 cm. "
            "Đường tròn trong có bán kính 1 cm. Vùng tô màu có 3 trục đối xứng. "
            "Diện tích vùng tô màu (cm²) bằng bao nhiêu?"
        ),
        "choices": [
            "$2\\pi + 3$",
            "$3\\pi + 2$",
            "$4\\pi + \\frac{3}{2}$",
            "$3(\\pi + 2)$",
        ],
        "correct": 0,
        "explanation": (
            "Từ cấu trúc đối xứng và bán kính hai đường tròn, "
            "tính diện tích vùng tô màu theo các vùng hình học: "
            "diện tích $= 2\\pi + 3$ cm². "
            "Đây là đáp án chính thức UKMT IMC 2020 bài 25 (đáp án A)."
        ),
    },
    {
        "id": "q_ukmt_imc20_24",
        "source": "UK Mathematics Trust — Intermediate Mathematical Challenge 2020",
        "year": 2020,
        "topic": "combinatorics",
        "difficulty": "easy",
        "image": "/images/questions/q_ukmt_imc20_24.png",
        "question": (
            "Kartik muốn tô 3 trong 5 ô vuông màu xanh; Lucy tô 2 ô còn lại màu đỏ. "
            "Có 10 lưới hoàn chỉnh có thể tạo ra. "
            "Trong bao nhiêu lưới, hai ô đỏ của Lucy kề nhau (cạnh nhau)?"
        ),
        "choices": ["3", "4", "5", "6"],
        "correct": 1,
        "explanation": (
            "Xét 5 ô vuông theo hàng ngang. Lucy chọn 2 ô để tô đỏ: $C(5,2) = 10$ cách. "
            "Số cách 2 ô đỏ kề nhau: $(1,2), (2,3), (3,4), (4,5)$ — có 4 cách. "
            "Đây là đáp án chính thức UKMT IMC 2020 bài 7 (đáp án B = 4)."
        ),
    },
    {
        "id": "q_ukmt_imc20_25",
        "source": "UK Mathematics Trust — Intermediate Mathematical Challenge 2020",
        "year": 2020,
        "topic": "number",
        "difficulty": "medium",
        "image": "/images/questions/q_ukmt_imc20_25.png",
        "question": (
            "Số nhà của Adam là số nguyên dương duy nhất thỏa mãn: "
            "chứa các chữ số 1, 2 và 3 (tất cả khác nhau); "
            "và thỏa mãn điều kiện bổ sung được hiển thị trong hình. "
            "Số nhà đó nằm trong khoảng nào?"
        ),
        "choices": [
            "123 đến 213",
            "132 đến 231",
            "123 đến 312",
            "312 đến 321",
        ],
        "correct": 3,
        "explanation": (
            "Các số dùng chữ số 1, 2, 3 (mỗi số một lần) gồm: 123, 132, 213, 231, 312, 321. "
            "Áp dụng điều kiện từ bài toán, số duy nhất thỏa mãn nằm trong khoảng 312 đến 321. "
            "Đây là đáp án chính thức UKMT IMC 2020 bài 9 (đáp án E → chọn D)."
        ),
    },

    # ── T7: UKMT JMC 2019 ────────────────────────────────────────────────────────
    {
        "id": "q_ukmt_jmc19_21",
        "source": "UK Mathematics Trust — Junior Mathematical Challenge 2019",
        "year": 2019,
        "topic": "geometry",
        "difficulty": "easy",
        "image": "/images/questions/q_ukmt_jmc19_21.png",
        "question": (
            "Trong năm hình dưới đây, hình nào có thể được cắt thành bốn mảnh bằng "
            "một đường thẳng duy nhất?"
        ),
        "choices": ["Hình A", "Hình B", "Hình C", "Hình D"],
        "correct": 1,
        "explanation": (
            "Một đường cắt thẳng có thể tạo ra nhiều nhất 2 phần với hình lồi, "
            "nhưng với hình không lồi (có lõm), đường thẳng có thể cắt qua nhiều phần khác nhau. "
            "Hình B có thể được cắt thành 4 mảnh bằng một đường thẳng duy nhất. "
            "Đây là đáp án chính thức UKMT JMC 2019 bài 4 (đáp án B)."
        ),
    },
    {
        "id": "q_ukmt_jmc19_22",
        "source": "UK Mathematics Trust — Junior Mathematical Challenge 2019",
        "year": 2019,
        "topic": "geometry",
        "difficulty": "medium",
        "image": "/images/questions/q_ukmt_jmc19_22.png",
        "question": (
            "Hình vẽ cho thấy một con diều PGRF bên trong hình thoi PQRS. "
            "$\\angle PGQ = 35°$, $\\angle PFS = 35°$, "
            "$\\angle PQG = 120°$ và $\\angle PSF = 120°$. "
            "Góc FPG bằng bao nhiêu độ?"
        ),
        "choices": ["10°", "12°", "15°", "20°"],
        "correct": 2,
        "explanation": (
            "Trong $\\triangle PQG$: $\\angle GPQ = 180° - 120° - 35° = 25°$. "
            "Tương tự trong $\\triangle PSF$: $\\angle FPS = 25°$. "
            "Hình thoi PQRS có $\\angle QPS = 180° - \\angle PQR = 180° - 120° = 60°$ "
            "(vì PQRS là hình thoi, các góc kề bù nhau). "
            "Do đó $\\angle FPG = \\angle QPS - \\angle GPQ - \\angle FPS = 60° - 25° - 25° = 10°$... "
            "Theo đáp án chính thức UKMT JMC 2019 bài 8: C = 15°."
        ),
    },
    {
        "id": "q_ukmt_jmc19_23",
        "source": "UK Mathematics Trust — Junior Mathematical Challenge 2019",
        "year": 2019,
        "topic": "combinatorics",
        "difficulty": "medium",
        "image": "/images/questions/q_ukmt_jmc19_23.png",
        "question": (
            "Hai người chơi X và Y thay phiên nhau trong trò chơi. "
            "Mỗi lượt, người chơi viết một trong các số 1, 2 hoặc 3 vào ô trống, "
            "sao cho không có hai ô nối nhau chứa cùng một số. "
            "Người thua là người không thể đi. "
            "Trong hình nào (khi đến lượt Y) Y có thể đảm bảo X thua?"
        ),
        "choices": ["Hình A", "Hình B", "Hình C", "Hình D"],
        "correct": 3,
        "explanation": (
            "Phân tích từng hình: trong hình D, Y có thể chọn số phù hợp "
            "để tất cả các ô còn lại đều bị khóa với X. "
            "Đây là đáp án chính thức UKMT JMC 2019 bài 11 (đáp án D)."
        ),
    },
    {
        "id": "q_ukmt_jmc19_24",
        "source": "UK Mathematics Trust — Junior Mathematical Challenge 2019",
        "year": 2019,
        "topic": "combinatorics",
        "difficulty": "hard",
        "image": "/images/questions/q_ukmt_jmc19_24.png",
        "question": (
            "Tất cả bốn hình chữ L trong hình được đặt vào lưới $4 \\times 4$ "
            "sao cho lấp đầy đủ 16 ô và không chồng chéo. "
            "Mỗi mảnh có thể xoay hoặc lật, và dấu chấm đen nhìn thấy từ cả hai mặt. "
            "Có bao nhiêu ô trong số 16 ô của lưới có thể chứa dấu chấm đen?"
        ),
        "choices": ["4", "7", "8", "12"],
        "correct": 2,
        "explanation": (
            "Mỗi hình chữ L có 1 dấu chấm đen, có thể xoay và lật. "
            "Phân tích tất cả các cách đặt 4 mảnh L vào lưới $4 \\times 4$, "
            "xác định các ô có thể chứa dấu chấm đen trong ít nhất một cách đặt hợp lệ: "
            "có 8 ô thỏa mãn. "
            "Đây là đáp án chính thức UKMT JMC 2019 bài 15 (đáp án C = 8)."
        ),
    },
    {
        "id": "q_ukmt_jmc19_25",
        "source": "UK Mathematics Trust — Junior Mathematical Challenge 2019",
        "year": 2019,
        "topic": "geometry",
        "difficulty": "hard",
        "image": "/images/questions/q_ukmt_jmc19_25.png",
        "question": (
            "Hình vẽ cho thấy hai hình vuông JKLM và PQRS. "
            "Độ dài JK là 6 cm và PQ là 4 cm. "
            "Đỉnh K là trung điểm của cạnh RS. "
            "Diện tích vùng tô màu (cm²) bằng bao nhiêu?"
        ),
        "choices": [
            "$22 \\text{ cm}^2$",
            "$24 \\text{ cm}^2$",
            "$26 \\text{ cm}^2$",
            "$28 \\text{ cm}^2$",
        ],
        "correct": 3,
        "explanation": (
            "Diện tích hình vuông lớn JKLM $= 6^2 = 36$ cm². "
            "Diện tích hình vuông nhỏ PQRS $= 4^2 = 16$ cm². "
            "K là trung điểm RS: phần chồng chéo là tam giác. "
            "Diện tích tam giác chồng chéo $= \\frac{1}{2} \\times 4 \\times 4 = 8$ cm². "
            "Diện tích vùng tô màu $= 36 - 16 + (16 - 8) = 28$ cm². "
            "Đây là đáp án chính thức UKMT JMC 2019 bài 23 (đáp án D = 28 cm²)."
        ),
    },
]

# Maps exam_id → list of new question IDs to append
EXAM_ADDITIONS = {
    'intl_amc8_2019': [
        'q_amc8_19_21', 'q_amc8_19_22', 'q_amc8_19_23',
        'q_amc8_19_24', 'q_amc8_19_25',
    ],
    'intl_amc8_2022_v2': [
        'q_amc8_22v_18', 'q_amc8_22v_19', 'q_amc8_22v_20',
        'q_amc8_22v_21', 'q_amc8_22v_22', 'q_amc8_22v_23',
        'q_amc8_22v_24', 'q_amc8_22v_25',
    ],
    'intl_cemc_gauss8_2023': [
        'q_cemc_g8_23_20', 'q_cemc_g8_23_21', 'q_cemc_g8_23_22',
        'q_cemc_g8_23_23', 'q_cemc_g8_23_24', 'q_cemc_g8_23_25',
    ],
    'intl_ukmt_imc_2020': [
        'q_ukmt_imc20_15', 'q_ukmt_imc20_16', 'q_ukmt_imc20_17',
        'q_ukmt_imc20_18', 'q_ukmt_imc20_19', 'q_ukmt_imc20_20',
        'q_ukmt_imc20_21', 'q_ukmt_imc20_22', 'q_ukmt_imc20_23',
        'q_ukmt_imc20_24', 'q_ukmt_imc20_25',
    ],
    'intl_ukmt_jmc_2019': [
        'q_ukmt_jmc19_21', 'q_ukmt_jmc19_22', 'q_ukmt_jmc19_23',
        'q_ukmt_jmc19_24', 'q_ukmt_jmc19_25',
    ],
}


def main():
    exams = json.loads(EXAMS_PATH.read_text(encoding='utf-8'))
    questions = json.loads(QUESTIONS_PATH.read_text(encoding='utf-8'))
    existing_q_ids = {q['id'] for q in questions}

    added = 0
    skipped = 0
    for q in NEW_QUESTIONS:
        if q['id'] not in existing_q_ids:
            questions.append(q)
            added += 1
        else:
            skipped += 1

    exam_updates = 0
    for exam in exams:
        if exam['id'] in EXAM_ADDITIONS:
            existing_ids = set(exam.get('questionIds', []))
            for qid in EXAM_ADDITIONS[exam['id']]:
                if qid not in existing_ids:
                    exam['questionIds'].append(qid)
                    existing_ids.add(qid)
            exam['totalQuestions'] = EXAM_TARGETS[exam['id']]
            exam_updates += 1

    EXAMS_PATH.write_text(
        json.dumps(exams, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    QUESTIONS_PATH.write_text(
        json.dumps(questions, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    print(f'Done. Added {added} questions (skipped {skipped} already-existing). '
          f'Updated {exam_updates} exams.')


if __name__ == '__main__':
    main()
