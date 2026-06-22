import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry

STATIC_EXAM_ANALYSIS_INSTRUCTIONS = """Bạn là chuyên gia phân tích kết quả thi Toán cho học sinh Việt Nam. Nhiệm vụ: phân tích CỤ THỂ, CHI TIẾT dựa trên số liệu thực tế được cung cấp.

QUY TẮC BẮT BUỘC — vi phạm = phân tích vô dụng:
1. KHÔNG BAO GIỜ viết câu chung chung như "Em cần cố gắng hơn", "Kết quả tốt", "Tiếp tục ôn luyện", "Cần chú ý hơn". Mọi nhận xét PHẢI đi kèm số liệu cụ thể (% chính xác, số câu đúng/sai, tên chủ đề thực tế).
2. `insights`: (a) nêu điểm X/10 và tỉ lệ Y% chính xác; (b) so sánh với ngưỡng tỉnh/khu vực; (c) gọi tên 1-2 chủ đề mạnh nhất VÀ yếu nhất theo số liệu từ bảng chủ đề; (d) nếu có lịch sử → nhận xét xu hướng cụ thể (tăng/giảm bao nhiêu điểm).
3. `question_analysis`: phân tích TỪNG chủ đề có câu sai — gọi tên chủ đề, số câu sai/tổng, nhận diện dạng bài hoặc lỗi phổ biến từ nội dung câu hỏi thực tế. Nếu không có câu sai → ghi nhận điều đó.
4. `recommendations`: mỗi mục PHẢI gắn với 1 chủ đề/dạng bài cụ thể và 1 hành động rõ ràng. Không khuyến nghị chung chung.
5. Trả lời bằng tiếng Việt. Trả về JSON hợp lệ, không có text ngoài JSON."""

# Per-province difficulty data (mirrors provincialData.js)
# topic_weights: approximate % share of each topic in recent provincial grade-9 math exams.
# Derived from analysis of 2021–2024 provincial exam papers. Topics with higher % are
# higher priority in Recovery Path focus area selection.
_PROVINCE_DATA = {
    'Hà Nội': {
        'difficulty': 4, 'typical_cutoff': 8.0, 'top_schools_cutoff': 9.2,
        'topic_weights': {'calculus': 18, 'functions': 15, 'logarithm': 12, 'algebra': 14, 'geometry': 12, 'combinatorics': 10, 'hệ phương trình': 8, 'statistics': 6, 'sequences': 5},
    },
    'TP.HCM': {
        'difficulty': 4, 'typical_cutoff': 7.8, 'top_schools_cutoff': 9.0,
        'topic_weights': {'calculus': 16, 'functions': 15, 'algebra': 15, 'geometry': 13, 'logarithm': 10, 'combinatorics': 10, 'hệ phương trình': 8, 'statistics': 7, 'trigonometry': 6},
    },
    'Đà Nẵng': {
        'difficulty': 3, 'typical_cutoff': 7.2, 'top_schools_cutoff': 8.5,
        'topic_weights': {'algebra': 20, 'geometry': 18, 'functions': 13, 'calculus': 10, 'hệ phương trình': 10, 'statistics': 9, 'number_theory': 8, 'logarithm': 7, 'combinatorics': 5},
    },
    'Hải Phòng': {
        'difficulty': 3, 'typical_cutoff': 7.0, 'top_schools_cutoff': 8.2,
        'topic_weights': {'algebra': 20, 'geometry': 18, 'hệ phương trình': 12, 'functions': 12, 'statistics': 9, 'number_theory': 9, 'calculus': 8, 'logarithm': 7, 'combinatorics': 5},
    },
    'Cần Thơ': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 8.0,
        'topic_weights': {'algebra': 22, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 10, 'statistics': 9, 'number_theory': 8, 'calculus': 6, 'căn thức': 5},
    },
    'Bình Dương': {
        'difficulty': 3, 'typical_cutoff': 7.0, 'top_schools_cutoff': 8.2,
        'topic_weights': {'algebra': 20, 'geometry': 18, 'hệ phương trình': 12, 'functions': 12, 'statistics': 9, 'number_theory': 9, 'calculus': 8, 'logarithm': 7, 'combinatorics': 5},
    },
    'Đồng Nai': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 8.0,
        'topic_weights': {'algebra': 22, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 10, 'statistics': 9, 'number_theory': 8, 'calculus': 6, 'căn thức': 5},
    },
    'Khánh Hòa': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 7.8,
        'topic_weights': {'algebra': 22, 'geometry': 18, 'hệ phương trình': 11, 'arithmetic': 10, 'functions': 10, 'statistics': 9, 'number_theory': 8, 'calculus': 7, 'căn thức': 5},
    },
    'Nghệ An': {
        'difficulty': 3, 'typical_cutoff': 6.6, 'top_schools_cutoff': 7.8,
        'topic_weights': {'algebra': 22, 'geometry': 19, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 10, 'statistics': 8, 'number_theory': 8, 'calculus': 6, 'căn thức': 5},
    },
    'Thanh Hóa': {
        'difficulty': 2, 'typical_cutoff': 6.4, 'top_schools_cutoff': 7.5,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Hà Tĩnh': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 7.8,
        'topic_weights': {'algebra': 22, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 10, 'statistics': 9, 'number_theory': 8, 'calculus': 6, 'căn thức': 5},
    },
    'Bắc Ninh': {
        'difficulty': 3, 'typical_cutoff': 7.0, 'top_schools_cutoff': 8.2,
        'topic_weights': {'algebra': 20, 'geometry': 18, 'hệ phương trình': 12, 'functions': 12, 'statistics': 9, 'number_theory': 9, 'calculus': 8, 'logarithm': 7, 'combinatorics': 5},
    },
    'Vĩnh Phúc': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 7.8,
        'topic_weights': {'algebra': 21, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 10, 'statistics': 9, 'number_theory': 8, 'calculus': 7, 'căn thức': 5},
    },
    'Hà Giang': {
        'difficulty': 1, 'typical_cutoff': 5.8, 'top_schools_cutoff': 6.8,
        'topic_weights': {'algebra': 30, 'geometry': 25, 'arithmetic': 15, 'hệ phương trình': 10, 'statistics': 8, 'functions': 7, 'number_theory': 5},
    },
    'Điện Biên': {
        'difficulty': 1, 'typical_cutoff': 5.6, 'top_schools_cutoff': 6.6,
        'topic_weights': {'algebra': 32, 'geometry': 26, 'arithmetic': 16, 'hệ phương trình': 10, 'statistics': 8, 'functions': 5, 'number_theory': 3},
    },
    'Lai Châu': {
        'difficulty': 1, 'typical_cutoff': 5.6, 'top_schools_cutoff': 6.6,
        'topic_weights': {'algebra': 32, 'geometry': 26, 'arithmetic': 16, 'hệ phương trình': 10, 'statistics': 8, 'functions': 5, 'number_theory': 3},
    },
    'Sơn La': {
        'difficulty': 1, 'typical_cutoff': 5.8, 'top_schools_cutoff': 6.8,
        'topic_weights': {'algebra': 30, 'geometry': 25, 'arithmetic': 15, 'hệ phương trình': 10, 'statistics': 8, 'functions': 7, 'number_theory': 5},
    },
    'Cà Mau': {
        'difficulty': 1, 'typical_cutoff': 5.8, 'top_schools_cutoff': 6.8,
        'topic_weights': {'algebra': 30, 'geometry': 25, 'arithmetic': 15, 'hệ phương trình': 10, 'statistics': 8, 'functions': 7, 'number_theory': 5},
    },
    'Kiên Giang': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Bà Rịa - Vũng Tàu': {
        'difficulty': 3, 'typical_cutoff': 7.0, 'top_schools_cutoff': 8.0,
        'topic_weights': {'algebra': 20, 'geometry': 18, 'hệ phương trình': 12, 'functions': 12, 'statistics': 9, 'number_theory': 9, 'calculus': 8, 'logarithm': 7, 'combinatorics': 5},
    },
    # ── Difficulty-3 provinces (Khá) ──────────────────────────────────────────
    'Thừa Thiên - Huế': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 8.0,
        'topic_weights': {'algebra': 20, 'geometry': 18, 'functions': 13, 'calculus': 10, 'hệ phương trình': 10, 'statistics': 9, 'number_theory': 9, 'logarithm': 7, 'combinatorics': 4},
    },
    'Quảng Ninh': {
        'difficulty': 3, 'typical_cutoff': 7.0, 'top_schools_cutoff': 8.2,
        'topic_weights': {'algebra': 20, 'geometry': 18, 'functions': 12, 'hệ phương trình': 12, 'statistics': 9, 'number_theory': 9, 'calculus': 8, 'logarithm': 7, 'combinatorics': 5},
    },
    'Nam Định': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 7.8,
        'topic_weights': {'algebra': 21, 'geometry': 18, 'hệ phương trình': 12, 'functions': 12, 'statistics': 9, 'number_theory': 9, 'calculus': 8, 'logarithm': 6, 'combinatorics': 5},
    },
    'Ninh Bình': {
        'difficulty': 3, 'typical_cutoff': 6.6, 'top_schools_cutoff': 7.8,
        'topic_weights': {'algebra': 21, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 11, 'statistics': 9, 'number_theory': 8, 'calculus': 7, 'căn thức': 4},
    },
    'Hải Dương': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 7.8,
        'topic_weights': {'algebra': 20, 'geometry': 18, 'hệ phương trình': 12, 'functions': 12, 'statistics': 9, 'number_theory': 9, 'calculus': 8, 'logarithm': 7, 'combinatorics': 5},
    },
    'Hưng Yên': {
        'difficulty': 3, 'typical_cutoff': 7.0, 'top_schools_cutoff': 8.0,
        'topic_weights': {'algebra': 20, 'geometry': 18, 'hệ phương trình': 12, 'functions': 12, 'statistics': 9, 'number_theory': 9, 'calculus': 8, 'logarithm': 7, 'combinatorics': 5},
    },
    'Hà Nam': {
        'difficulty': 3, 'typical_cutoff': 6.6, 'top_schools_cutoff': 7.6,
        'topic_weights': {'algebra': 21, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 11, 'statistics': 9, 'number_theory': 8, 'calculus': 7, 'căn thức': 4},
    },
    'Thái Bình': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 7.8,
        'topic_weights': {'algebra': 21, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 11, 'statistics': 9, 'number_theory': 8, 'calculus': 7, 'căn thức': 4},
    },
    'Lâm Đồng': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 7.8,
        'topic_weights': {'algebra': 20, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 11, 'statistics': 9, 'number_theory': 8, 'calculus': 7, 'căn thức': 5},
    },
    'Thái Nguyên': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 7.8,
        'topic_weights': {'algebra': 20, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 11, 'statistics': 9, 'number_theory': 8, 'calculus': 7, 'căn thức': 5},
    },
    'Bình Định': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 7.8,
        'topic_weights': {'algebra': 21, 'geometry': 18, 'hệ phương trình': 11, 'arithmetic': 10, 'functions': 11, 'statistics': 9, 'number_theory': 8, 'calculus': 7, 'căn thức': 5},
    },
    'Quảng Nam': {
        'difficulty': 3, 'typical_cutoff': 6.6, 'top_schools_cutoff': 7.6,
        'topic_weights': {'algebra': 22, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 10, 'statistics': 9, 'number_theory': 8, 'calculus': 6, 'căn thức': 5},
    },
    'Phú Thọ': {
        'difficulty': 3, 'typical_cutoff': 6.8, 'top_schools_cutoff': 7.8,
        'topic_weights': {'algebra': 20, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 11, 'statistics': 9, 'number_theory': 8, 'calculus': 7, 'căn thức': 5},
    },
    'Bắc Giang': {
        'difficulty': 3, 'typical_cutoff': 6.6, 'top_schools_cutoff': 7.6,
        'topic_weights': {'algebra': 21, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 11, 'statistics': 9, 'number_theory': 8, 'calculus': 7, 'căn thức': 4},
    },
    'Quảng Bình': {
        'difficulty': 3, 'typical_cutoff': 6.6, 'top_schools_cutoff': 7.6,
        'topic_weights': {'algebra': 22, 'geometry': 18, 'hệ phương trình': 12, 'arithmetic': 10, 'functions': 10, 'statistics': 9, 'number_theory': 8, 'calculus': 6, 'căn thức': 5},
    },
    # ── Difficulty-2 provinces (Trung bình) ───────────────────────────────────
    'An Giang': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Bạc Liêu': {
        'difficulty': 2, 'typical_cutoff': 6.0, 'top_schools_cutoff': 7.0,
        'topic_weights': {'algebra': 26, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 9, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Bến Tre': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Bình Phước': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Bình Thuận': {
        'difficulty': 2, 'typical_cutoff': 6.4, 'top_schools_cutoff': 7.4,
        'topic_weights': {'algebra': 25, 'geometry': 21, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 8, 'căn thức': 5},
    },
    'Đắk Lắk': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Đắk Nông': {
        'difficulty': 2, 'typical_cutoff': 6.0, 'top_schools_cutoff': 7.0,
        'topic_weights': {'algebra': 26, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 9, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Đồng Tháp': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Gia Lai': {
        'difficulty': 2, 'typical_cutoff': 6.0, 'top_schools_cutoff': 7.0,
        'topic_weights': {'algebra': 26, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 9, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Hậu Giang': {
        'difficulty': 2, 'typical_cutoff': 6.0, 'top_schools_cutoff': 7.0,
        'topic_weights': {'algebra': 26, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 9, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Hòa Bình': {
        'difficulty': 2, 'typical_cutoff': 6.0, 'top_schools_cutoff': 7.0,
        'topic_weights': {'algebra': 26, 'geometry': 23, 'hệ phương trình': 11, 'arithmetic': 12, 'functions': 9, 'statistics': 8, 'number_theory': 6, 'căn thức': 5},
    },
    'Kon Tum': {
        'difficulty': 2, 'typical_cutoff': 5.8, 'top_schools_cutoff': 6.8,
        'topic_weights': {'algebra': 27, 'geometry': 23, 'arithmetic': 13, 'hệ phương trình': 11, 'statistics': 8, 'functions': 8, 'number_theory': 6, 'căn thức': 4},
    },
    'Lạng Sơn': {
        'difficulty': 2, 'typical_cutoff': 6.0, 'top_schools_cutoff': 7.0,
        'topic_weights': {'algebra': 26, 'geometry': 23, 'hệ phương trình': 11, 'arithmetic': 12, 'functions': 9, 'statistics': 8, 'number_theory': 6, 'căn thức': 5},
    },
    'Lào Cai': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 23, 'hệ phương trình': 11, 'arithmetic': 12, 'functions': 9, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Long An': {
        'difficulty': 2, 'typical_cutoff': 6.4, 'top_schools_cutoff': 7.4,
        'topic_weights': {'algebra': 25, 'geometry': 21, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 8, 'căn thức': 5},
    },
    'Ninh Thuận': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Phú Yên': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Quảng Ngãi': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Quảng Trị': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Sóc Trăng': {
        'difficulty': 2, 'typical_cutoff': 6.0, 'top_schools_cutoff': 7.0,
        'topic_weights': {'algebra': 26, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 9, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Tây Ninh': {
        'difficulty': 2, 'typical_cutoff': 6.4, 'top_schools_cutoff': 7.4,
        'topic_weights': {'algebra': 25, 'geometry': 21, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 8, 'căn thức': 5},
    },
    'Tiền Giang': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Tuyên Quang': {
        'difficulty': 2, 'typical_cutoff': 5.8, 'top_schools_cutoff': 6.8,
        'topic_weights': {'algebra': 27, 'geometry': 23, 'arithmetic': 13, 'hệ phương trình': 11, 'statistics': 8, 'functions': 8, 'number_theory': 5, 'căn thức': 5},
    },
    'Vĩnh Long': {
        'difficulty': 2, 'typical_cutoff': 6.2, 'top_schools_cutoff': 7.2,
        'topic_weights': {'algebra': 25, 'geometry': 22, 'hệ phương trình': 12, 'arithmetic': 11, 'functions': 10, 'statistics': 8, 'number_theory': 7, 'căn thức': 5},
    },
    'Yên Bái': {
        'difficulty': 2, 'typical_cutoff': 5.8, 'top_schools_cutoff': 6.8,
        'topic_weights': {'algebra': 27, 'geometry': 23, 'arithmetic': 14, 'hệ phương trình': 11, 'statistics': 8, 'functions': 7, 'number_theory': 5, 'căn thức': 5},
    },
    # ── Difficulty-1 provinces (Dễ / vùng cao) ───────────────────────────────
    'Bắc Kạn': {
        'difficulty': 1, 'typical_cutoff': 5.8, 'top_schools_cutoff': 6.8,
        'topic_weights': {'algebra': 30, 'geometry': 25, 'arithmetic': 15, 'hệ phương trình': 10, 'statistics': 8, 'functions': 7, 'number_theory': 5},
    },
    'Cao Bằng': {
        'difficulty': 1, 'typical_cutoff': 5.6, 'top_schools_cutoff': 6.6,
        'topic_weights': {'algebra': 32, 'geometry': 25, 'arithmetic': 15, 'hệ phương trình': 10, 'statistics': 8, 'functions': 5, 'number_theory': 5},
    },
}
_DIFFICULTY_LABELS = {1: 'Dễ', 2: 'Trung bình', 3: 'Khá', 4: 'Khó', 5: 'Rất khó'}


def _get_province_context(province: str | None) -> str:
    if not province or province not in _PROVINCE_DATA:
        return "National average THPT Math 2024: 6.51. Calibrate recommendations to general Vietnamese exam standards."
    d = _PROVINCE_DATA[province]
    label = _DIFFICULTY_LABELS.get(d['difficulty'], 'Trung bình')
    return (
        f"Province: {province} | Difficulty: {label} ({d['difficulty']}/5) | "
        f"Typical Math cutoff: {d['typical_cutoff']} | Top schools require: {d['top_schools_cutoff']}+ | "
        f"National avg: 6.51. Calibrate school recommendations to {province} standards specifically."
    )


def _strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


def build_analyze_prompt(
    result: dict,
    history: list[dict],
    student_name: str = "",
    wrong_questions: list[dict] = None,
    school_recommendations: list[dict] = None,
    exam_category: str = "",
    user_profile: dict = None,
    learner_archetype: str | None = None,
    device_province: str | None = None,
) -> str:
    topic_breakdown = result.get("topicBreakdown", {})
    weak_topics = [t for t, tb in topic_breakdown.items() if tb.get("accuracy", 1) < 0.6]

    dynamic_parts = []
    if student_name:
        dynamic_parts.append(f"Học sinh: {student_name}")
    dynamic_parts.append(f"Điểm: {result.get('score', 0)}/10 | Độ chính xác tổng: {round(result.get('accuracy', 0) * 100)}%")

    # Pre-format topic breakdown as readable table (sorted weakest → strongest)
    if topic_breakdown:
        topic_lines = []
        for t, tb in sorted(topic_breakdown.items(), key=lambda x: x[1].get("accuracy", 1)):
            correct = tb.get("correct", round(tb.get("accuracy", 0) * tb.get("total", 1)))
            total = tb.get("total", 1)
            pct = round(tb.get("accuracy", 0) * 100)
            flag = " ❌ RẤT YẾU" if pct < 40 else " ⚠️ YẾU" if pct < 60 else " ✅ TỐT" if pct >= 80 else ""
            topic_lines.append(f"  {t}: {correct}/{total} câu đúng ({pct}%){flag}")
        dynamic_parts.append("Kết quả theo chủ đề (yếu → mạnh):\n" + "\n".join(topic_lines))
    else:
        dynamic_parts.append(f"Chủ đề yếu (< 60%): {', '.join(weak_topics) or 'Không có'}")

    # Score trend from history
    if len(history) >= 2:
        recent = [r.get("score", 0) for r in history[-5:]]
        prev_score = history[-2].get("score", 0) if len(history) >= 2 else None
        current_score = result.get("score", 0)
        delta = round(current_score - prev_score, 1) if prev_score is not None else None
        trend = ""
        if delta is not None:
            direction = f"tăng +{delta}" if delta > 0 else f"giảm {delta}" if delta < 0 else "giữ nguyên"
            trend = f" → so với lần trước: {direction} điểm"
        dynamic_parts.append(f"Lịch sử điểm (5 lần gần nhất): {recent}{trend}")

    if wrong_questions:
        wrong_lines = [
            f"  {i+1}. [{q.get('topic','?')} / {q.get('difficulty','?')}] {q.get('question','')[:150]}"
            + (f" → Đáp án đúng: {q.get('correct_answer','')}" if q.get('correct_answer') else "")
            for i, q in enumerate(wrong_questions[:10])
        ]
        dynamic_parts.append(
            f"CÂU SAI ({len(wrong_questions)} câu):\n" + "\n".join(wrong_lines)
        )

    grade = str((user_profile or {}).get("grade", ""))
    province = (user_profile or {}).get("province", "") or (user_profile or {}).get("location", "")

    if school_recommendations:
        school_list = [
            f"- {s.get('name', s.get('school', {}).get('name', '?'))} "
            f"(loại: {s.get('type', 'công lập')}, {s.get('district', '')} · {s.get('province', '')}) "
            f"— điểm chuẩn Toán: {s['cutoff']}, phù hợp: {s['matchStrength']}"
            for s in school_recommendations[:6]
        ]
        # Derive school type from grade: ≤9 → high school (lớp 10), 10-12 → university
        if grade and grade.isdigit() and int(grade) <= 9:
            exam_type = "lớp 10"
            school_type_note = "trường THPT"
        else:
            exam_type = "đại học/THPT"
            school_type_note = "trường đại học/cao đẳng"
        loc_note = f" tại {province}" if province else ""
        dynamic_parts.append(
            f"Trường gợi ý{loc_note} ({school_type_note}, kỳ thi {exam_type}):\n" + "\n".join(school_list)
        )

    # Add grade + province context for personalized school recommendation prompt
    if grade:
        dynamic_parts.append(f"Lớp học sinh: {grade}")
    if province:
        dynamic_parts.append(f"Tỉnh/thành phố: {province}")
    if learner_archetype:
        dynamic_parts.append(f"Learner type: {learner_archetype}")

    # Append per-province difficulty context (dynamic, not in static system prompt)
    province_ctx = _get_province_context(province or None)
    dynamic_parts.append(f"Provincial context: {province_ctx}")

    # Device-detected location context — supplements (does not replace) user-selected province
    if device_province:
        note = f"Vị trí thiết bị phát hiện: {device_province}"
        if device_province != province:
            note += f" (khác với tỉnh trong hồ sơ: {province or 'chưa đặt'})"
        dynamic_parts.append(
            f"{note}. Dùng thông tin này để bổ sung nhận xét về đặc thù đề thi địa phương "
            f"(trọng số chủ đề, mức độ cạnh tranh) trong phần insights và recommendations. "
            f"Không thêm tên trường vào insights/recommendations — danh sách trường được hiển thị riêng."
        )
        if not province:
            dynamic_parts.append(f"Device provincial context: {_get_province_context(device_province)}")

    school_json_field = ""
    if school_recommendations:
        if grade and grade.isdigit() and int(grade) <= 9:
            school_insight_hint = "Nhận xét ngắn 1-2 câu tổng quan về trường THPT phù hợp để thi vào lớp 10"
            school_type_example = "THPT"
        else:
            school_insight_hint = "Nhận xét ngắn 1-2 câu tổng quan về trường đại học/cao đẳng phù hợp"
            school_type_example = "Đại học"
        school_json_field = (
            f',\n  "school_insight": "{school_insight_hint}",'
            f'\n  "schools": ['
            f'\n    {{'
            f'\n      "name": "Tên trường đầy đủ",'
            f'\n      "score_range": "Ngưỡng điểm chuẩn Toán (vd: 7.5–8.5 điểm)",'
            f'\n      "type": "{school_type_example}",'
            f'\n      "region_note": "Tỉnh/thành của trường — quan hệ với tỉnh học sinh (cùng tỉnh/tỉnh lân cận/...)",'
            f'\n      "note": "1 câu nhận xét tại sao phù hợp với điểm số này"'
            f'\n    }}'
            f'\n  ]  // BẮT BUỘC: Điền đủ 3-5 trường từ danh sách trường gợi ý đã cung cấp; không được để mảng rỗng'
        )

    prompt = "\n".join(dynamic_parts) + f"""

Trả về JSON (không có text ngoài JSON):
{{
  "insights": "3-4 câu CỤ THỂ: (1) Điểm X/10 — Y% chính xác, [cao hơn/thấp hơn/bằng] ngưỡng tỉnh Z. (2) Chủ đề mạnh nhất: [tên thực tế] A/B câu đúng (C%); yếu nhất: [tên thực tế] D/E câu đúng (F%). (3) Xu hướng: [tăng/giảm/ổn định X điểm so lần trước nếu có]. Không dùng câu chung chung.",
  "question_analysis": "Phân tích CHI TIẾT từng chủ đề có câu sai: 'Chủ đề [tên]: sai X/Y câu — dạng bài [mô tả cụ thể từ nội dung câu hỏi]. Lỗi phổ biến: [tính toán/khái niệm/áp dụng công thức/đọc hiểu]. ' Lặp lại cho mỗi chủ đề có câu sai. Nếu không sai câu nào thì ghi nhận điều đó.",
  "weak_topics": ["topic_key1", "topic_key2"],
  "recommendations": [
    "Chủ đề [tên cụ thể]: [hành động cụ thể, ví dụ: ôn lại dạng bài X, luyện Y bài tập dạng Z]",
    "Chủ đề [tên cụ thể]: ...",
    "Kỹ năng [cụ thể]: ..."
  ]{school_json_field}
}}"""
    return prompt


async def analyze_exam_result(
    client: AsyncOpenAI,
    result: dict,
    history: list[dict],
    student_name: str = "",
    wrong_questions: list[dict] = None,
    school_recommendations: list[dict] = None,
    exam_category: str = "",
    user_profile: dict = None,
    learner_archetype: str | None = None,
    device_province: str | None = None,
) -> dict:
    settings = get_settings()

    prompt = build_analyze_prompt(
        result, history, student_name,
        wrong_questions=wrong_questions,
        school_recommendations=school_recommendations,
        exam_category=exam_category,
        user_profile=user_profile,
        learner_archetype=learner_archetype,
        device_province=device_province,
    )

    response = await call_with_retry(
        client,
        model=settings.default_model,
        max_tokens=2000,
        messages=[
            {"role": "system", "content": STATIC_EXAM_ANALYSIS_INSTRUCTIONS},
            {"role": "user", "content": prompt},
        ],
    )

    content = _strip_code_fence(response.choices[0].message.content or "{}")
    return json.loads(content)
