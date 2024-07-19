export const config = {
  limit: {
    fullName: 25,
    role: 36,
    message: 400,
  },
  text: {
    your_picture: 'Ảnh của bạn',
    error: {
      cannot_create_message: 'Không thể tạo thông điệp. Vui lòng thử lại sau',
      missing_message: 'Vui lòng nhập thông điệp',
      message_too_short: 'Lời tri ân cần có ít nhất 3 từ',
      exceed_message: 'Vui lòng nhập thông điệp dưới 400 kí tự',
      fullName_too_short: 'Họ và tên cần có ít nhất 2 ký tự',
      fullName_too_long: 'Họ và tên tối đa 45 kí tự',
      fullName_empty: 'Vui lòng nhập Họ và tên',
      role_too_short: 'Đơn vị - Chức vụ cần có ít nhất 3 ký tự',
      role_too_long: 'Đơn vị - Chức vụ tối đa 60 kí tự',
      role_empty: 'Vui lòng nhập Đơn vị - Chức vụ',
      avatar_empty: 'Vui lòng thêm ảnh đại diện',
    },
    success: {
      sent_message: 'Gửi thông điệp thành công',
    },
    loading: {
      sending_message: 'Đang gửi thông điệp',
      creating_message: 'Đang tạo thông điệp',
    },
    warning: {
      choose_avatar: 'Vui lòng chọn ảnh đại diện.',
    },
  },
};
