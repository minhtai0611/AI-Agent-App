import { useNavigate } from 'react-router-dom'
import { useHistory } from '../context/HistoryContext.jsx'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function History() {
  const navigate = useNavigate()
  const { results } = useHistory()
  const sorted = [...results].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-10 py-4 bg-[#0D1521] border-b border-[#1E2D45]">
        <button onClick={() => navigate('/')} className="font-jakarta text-sm text-[#64748B] hover:text-[#94A3B8] transition">
          ← Trang chủ
        </button>
        <h1 className="font-fraunces text-[24px] font-bold text-[#F8FAFC]">Lịch sử làm bài</h1>
      </header>
      {/* Content */}
      <div className="flex flex-col gap-4 p-10">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="font-jakarta text-[#94A3B8] text-lg">Chưa có lần thi nào</p>
            <button onClick={() => navigate('/exams')}
              className="px-6 py-2.5 bg-[#F2A20C] text-[#0A0E1A] font-jakarta font-bold text-sm rounded-lg hover:opacity-90 transition">
              Bắt đầu thi thử
            </button>
          </div>
        ) : sorted.map(result => {
          const scoreColor = result.score >= 8 ? '#F2A20C' : result.score >= 6 ? '#F59E0B' : '#FB7185'
          const borderColor = result.score < 5 ? '#FB718540' : '#1E2D45'
          return (
            <div key={result.id} className="flex items-center justify-between bg-[#111827] rounded-xl px-6 py-5"
              style={{ border: `1px solid ${borderColor}` }}>
              <div className="flex flex-col gap-1.5">
                <span className="font-jakarta text-[15px] font-semibold text-[#F8FAFC]">{result.examId}</span>
                <span className="font-jakarta text-[13px] text-[#64748B]">{formatDate(result.finishedAt)}</span>
              </div>
              <div className="flex items-center gap-5">
                <span className="font-fraunces text-[40px] font-bold" style={{ color: scoreColor }}>{result.score}</span>
                <button onClick={() => navigate(`/results/${result.id}`)}
                  className="px-4 py-2 bg-[#1A2440] rounded-md font-jakarta text-[13px] text-[#94A3B8] hover:text-[#F8FAFC] transition">
                  Xem chi tiết
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
