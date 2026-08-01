import { DownloadOutlined } from "@ant-design/icons";
import { Button } from "antd";

type TributeResultProps = {
  imageUrl: string;
  canvasWidth: number;
  canvasHeight: number;
};

/** Shown after a successful submission: the visitor's composited frame, downloadable as a JPEG. */
export function TributeResult({
  imageUrl,
  canvasWidth,
  canvasHeight,
}: TributeResultProps) {
  return (
    <div className="text-center">
      <div className="mx-auto w-full max-w-4xl">
        <div
          className="overflow-hidden rounded-lg shadow"
          style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
        >
          <img
            src={imageUrl}
            alt="Khung ảnh tri ân của bạn"
            className="h-full w-full object-contain"
          />
        </div>
      </div>
      <a href={imageUrl} download="khung-anh-tri-an.jpg">
        <Button type="primary" icon={<DownloadOutlined />} className="mt-6">
          Tải ảnh về máy
        </Button>
      </a>
    </div>
  );
}
