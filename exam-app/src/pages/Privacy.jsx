import { useNavigate } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { motion } from 'framer-motion'

export default function Privacy() {
  usePageMeta('Chính sách quyền riêng tư · Luminary', {
    description: 'Chính sách bảo mật và quyền riêng tư của Luminary AI — nền tảng học toán thích ứng cho học sinh Việt Nam.',
  })
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="min-h-screen bg-surface px-4 pt-12 pb-16">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <button onClick={() => navigate(-1)}
          className="self-start font-sans text-sm text-dim hover:text-muted transition flex items-center gap-1.5">
          ← Quay lại
        </button>

        <div>
          <h1 className="font-sans text-[28px] font-bold text-foreground leading-tight">Chính sách quyền riêng tư</h1>
          <p className="font-sans text-[13px] text-dim mt-1">Cập nhật lần cuối: tháng 6 năm 2025</p>
        </div>

        <div className="flex flex-col gap-6 font-sans text-[14px] text-muted leading-relaxed">
          <Section title="1. Thông tin chúng tôi thu thập">
            <p>Luminary thu thập các thông tin sau khi bạn sử dụng dịch vụ:</p>
            <ul className="list-disc list-inside flex flex-col gap-1 mt-2 text-[13px]">
              <li>Tên, địa chỉ email, và thông tin đăng nhập Google (qua OAuth 2.0)</li>
              <li>Cấp học, tỉnh/thành, loại trường học (do bạn cung cấp tự nguyện)</li>
              <li>Kết quả bài thi, lịch sử câu trả lời, và mẫu lỗi học tập</li>
              <li>Dữ liệu sử dụng: thời gian làm bài, tần suất đăng nhập, thiết bị sử dụng</li>
            </ul>
          </Section>

          <Section title="2. Mục đích sử dụng dữ liệu">
            <ul className="list-disc list-inside flex flex-col gap-1 text-[13px]">
              <li>Cá nhân hóa lộ trình học tập và đề xuất ôn tập dựa trên điểm yếu của bạn</li>
              <li>Tạo kế hoạch ôn thi và phân tích kết quả theo tỉnh/trường mục tiêu</li>
              <li>Vận hành hệ thống lặp lại ngắt quãng (FSRS) và theo dõi tiến độ</li>
              <li>Cải thiện chất lượng AI và phát hiện lạm dụng hệ thống</li>
              <li>Gửi thông báo quan trọng liên quan đến tài khoản (không gửi spam)</li>
            </ul>
          </Section>

          <Section title="3. Lưu trữ và bảo mật">
            <p>
              Dữ liệu được lưu trữ trên máy chủ đặt tại Hoa Kỳ (Hugging Face Spaces).
              Chúng tôi áp dụng mã hóa HTTPS cho tất cả kết nối và hash mật khẩu bằng
              thuật toán bcrypt. Dữ liệu bài thi và câu hỏi AI được lưu tối đa <strong>24 tháng</strong> kể
              từ lần hoạt động cuối cùng. Tài khoản không hoạt động trong 24 tháng có thể bị xóa
              sau khi thông báo qua email.
            </p>
          </Section>

          <Section title="4. Chia sẻ dữ liệu">
            <p>
              Luminary <strong>không bán</strong> dữ liệu cá nhân cho bên thứ ba. Chúng tôi chỉ chia sẻ
              dữ liệu trong các trường hợp:
            </p>
            <ul className="list-disc list-inside flex flex-col gap-1 mt-2 text-[13px]">
              <li>Nhà cung cấp AI (Anthropic qua proxy) — chỉ nội dung câu hỏi, không có thông tin cá nhân</li>
              <li>Yêu cầu pháp lý hợp lệ theo quy định pháp luật Việt Nam hoặc quốc tế</li>
              <li>Trường học tham gia chương trình Luminary for Schools (chỉ khi học sinh đăng ký qua trường)</li>
            </ul>
          </Section>

          <Section title="5. Quyền của bạn">
            <p>Bạn có quyền:</p>
            <ul className="list-disc list-inside flex flex-col gap-1 mt-2 text-[13px]">
              <li>Xem, sửa, hoặc xóa dữ liệu cá nhân bằng cách truy cập trang <strong>Tài khoản</strong></li>
              <li>Yêu cầu xuất toàn bộ dữ liệu của bạn (email tới địa chỉ bên dưới)</li>
              <li>Xóa tài khoản vĩnh viễn — dữ liệu sẽ bị xóa trong vòng 30 ngày</li>
              <li>Từ chối nhận email thông báo không khẩn cấp</li>
            </ul>
          </Section>

          <Section title="6. Cookie và lưu trữ cục bộ">
            <p>
              Luminary sử dụng <code>localStorage</code> và <code>sessionStorage</code> của trình duyệt để lưu
              bài thi đang làm dở và trạng thái ứng dụng. Không có cookie theo dõi
              quảng cáo. Token đăng nhập được lưu trong <code>localStorage</code> và hết hạn sau 30 ngày.
            </p>
          </Section>

          <Section title="7. Dữ liệu trẻ em">
            <p>
              Luminary phục vụ học sinh từ cấp THCS trở lên. Nếu bạn dưới 13 tuổi, bạn cần sự đồng ý
              của phụ huynh hoặc người giám hộ trước khi đăng ký. Chúng tôi không thu thập thông tin
              nhạy cảm từ người dùng dưới 13 tuổi.
            </p>
          </Section>

          <Section title="8. Thay đổi chính sách">
            <p>
              Chính sách này có thể được cập nhật. Khi có thay đổi đáng kể, chúng tôi sẽ thông báo
              qua email hoặc banner trong ứng dụng ít nhất 14 ngày trước khi áp dụng.
            </p>
          </Section>

          <Section title="9. Liên hệ">
            <p>
              Mọi thắc mắc về quyền riêng tư, yêu cầu xuất hoặc xóa dữ liệu, vui lòng liên hệ:{' '}
              <span className="text-primary font-medium">support@locdo.tech</span>
            </p>
          </Section>
        </div>
      </div>
    </motion.div>
  )
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-sans text-[15px] font-semibold text-foreground">{title}</h2>
      <div className="flex flex-col gap-2 text-[13px] text-muted leading-relaxed">{children}</div>
    </div>
  )
}
