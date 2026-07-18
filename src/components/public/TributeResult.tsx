import { DownloadOutlined } from '@ant-design/icons';
import { Button } from 'antd';

type TributeResultProps = {
  imageDataUrl: string;
};

/** Shown after a successful submission: the visitor's composited frame, downloadable as a JPEG. */
export function TributeResult({ imageDataUrl }: TributeResultProps) {
  return (
    <div className="text-center">
      <img src={imageDataUrl} alt="Khung ảnh tri ân của bạn" className="mx-auto w-full max-w-md rounded-lg shadow" />
      <a href={imageDataUrl} download="khung-anh-tri-an.jpg">
        <Button type="primary" icon={<DownloadOutlined />} className="mt-6">
          Tải ảnh về máy
        </Button>
      </a>
    </div>
  );
}
