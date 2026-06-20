export const TOPIC_LABELS = {
  algebra:             'Đại số',
  geometry:            'Hình học',
  statistics:          'Thống kê',
  combinatorics:       'Tổ hợp',
  number_theory:       'Lý thuyết số',
  functions:           'Hàm số',
  calculus:            'Giải tích',
  arithmetic:          'Số học',
  trigonometry:        'Lượng giác',
  probability:         'Xác suất',
  sequences:           'Dãy số',
  coordinate_geometry: 'Hình học tọa độ',
  financial_math:      'Toán tài chính',
  vectors:             'Vectơ',
  sets:                'Tập hợp',
  complex_numbers:     'Số phức',
  logarithm:           'Logarit',
  logarithms:          'Logarit',
  number:              'Số học',
  data:                'Dữ liệu',
  differentiation:     'Đạo hàm',
  integration:         'Tích phân',
  measurement:         'Đo lường',
  'calculus applications': 'Ứng dụng giải tích',
  'sequences and series':  'Dãy số',
  'financial mathematics': 'Toán tài chính',
}

export function getTopicLabel(key) {
  return TOPIC_LABELS[key] ?? TOPIC_LABELS[key?.toLowerCase()] ?? key
}
