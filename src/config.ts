export const config = {
  // Drives the Input's maxLength/showCount in TributeForm.tsx — must match
  // src/schemas/submission.schema.ts's z.string().max(...) bounds (which in
  // turn mirror the DB check constraints in
  // supabase/migrations/0003_submissions.sql and the constants in
  // supabase/functions/submit-tribute/index.ts). A higher limit here than in
  // the schema lets a visitor type past what validation/the DB will accept.
  limit: {
    fullName: 25,
    role: 50,
    message: 600,
  },
  text: {
    your_picture: "Ảnh của bạn",
    error: {
      cannot_create_message: "Không thể tạo thông điệp. Vui lòng thử lại sau",
      missing_message: "Vui lòng nhập thông điệp",
      message_too_short: "Lời tri ân cần có ít nhất 3 từ",
      exceed_message: "Vui lòng nhập thông điệp dưới 400 kí tự",
      fullName_too_short: "Họ và tên cần có ít nhất 2 ký tự",
      fullName_too_long: "Họ và tênS tối đa 45 kí tự",
      fullName_empty: "Vui lòng nhập Họ và tên",
      role_too_short: "Đơn vị - Chức vụ cần có ít nhất 3 ký tự",
      role_too_long: "Đơn vị - Chức vụ tối đa 60 kí tự",
      role_empty: "Vui lòng nhập Đơn vị - Chức vụ",
      avatar_empty: "Vui lòng thêm ảnh đại diện",
    },
    success: {
      sent_message: "Gửi thông điệp thành công",
    },
    loading: {
      sending_message: "Đang gửi thông điệp",
      creating_message: "Đang tạo thông điệp",
    },
    warning: {
      choose_avatar: "Vui lòng chọn ảnh đại diện.",
    },
  },
  api: {
    sheet:
      "https://workflow.seconds.id.vn/webhook/ba38b420-1348-4c0c-a075-bd02257ce1a5",
  },
};
