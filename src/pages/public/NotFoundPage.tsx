import { Button, Result } from 'antd';
import { Link } from 'react-router-dom';

/**
 * Shown for any unreachable public URL, most importantly a campaign slug
 * that's pending/rejected/suspended or was never registered — per #5's
 * acceptance criteria, this must expose no campaign content, background,
 * or branding of any kind, so it renders no data-dependent props at all.
 */
export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="404"
      subTitle="Không tìm thấy trang bạn yêu cầu."
      extra={
        <Link to="/">
          <Button type="primary">Về trang chủ</Button>
        </Link>
      }
    />
  );
}
