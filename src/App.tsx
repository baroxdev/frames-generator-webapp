import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Upload, message } from 'antd';
import ImgCrop from 'antd-img-crop';
import { RcFile, UploadChangeParam, UploadFile, UploadProps } from 'antd/es/upload';
import html2canvas from 'html2canvas';
import { useRef, useState } from 'react';
import FileResizer from 'react-image-file-resizer';
import backgroundHorizontial from './assets/bg-hoz.png';
import backgroundImage from './storage/background.png';
import { convertDataURIToBinary, saveToDb } from './utils';
// eslint-disable-next-line react-refresh/only-export-components
export const getBase64 = (img: RcFile | File, callback: (url: string) => void) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(reader.result as string));
  reader.readAsDataURL(img);
};

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>();
  const [avatar, setAvatar] = useState<File>();
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [text, setText] = useState('');
  const [resultImage, setResultImage] = useState<string | null | undefined>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const handleChange: UploadProps['onChange'] = (info: UploadChangeParam<UploadFile>) => {
    if (info.file.status === 'uploading') {
      setLoading(true);
      return;
    }
    if (info.file.status === 'done') {
      setAvatar(info.file.originFileObj);
      // Get this url from response in real world.
      getBase64(info.file.originFileObj as RcFile, (url) => {
        console.log('🚀 ~ file: App.tsx:37 ~ getBase64 ~ url:', url);
        setLoading(false);
        setImageUrl(url);
      });
    }
  };

  const uploadButton = (
    <div>
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }} className='font-medium'>
        Ảnh của bạn
      </div>
    </div>
  );

  const resizeFile = (file: File) =>
    new Promise((resolve) => {
      FileResizer.imageFileResizer(
        file,
        500,
        500,
        'JPEG',
        50,
        0,
        (uri) => {
          setAvatar(uri as RcFile);
          resolve(uri);
        },
        'file'
      );
    });

  const handleSubmit = async () => {
    messageApi.open({
      key: 'optimize',
      content: 'Đang nén ảnh',
      type: 'loading',
    });
    await resizeFile(avatar as File);
    messageApi.destroy('optimize');
    if (!avatar) return messageApi.warning('Vui lòng chọn ảnh đại diện.');
    setLoading(true);
    messageApi.open({
      key: 'handling',
      type: 'loading',
      content: 'Đang xử lí',
    });
    if (!cardRef.current)
      return messageApi.open({
        key: 'handling',
        type: 'error',
        content: 'Không thể tạo thông điệp. Vui lòng thử lại sau',
      });
    try {
      const vp = document.querySelectorAll('meta[name="viewport"]')?.[0]?.getAttribute('content');
      document
        .querySelectorAll('meta[name="viewport"]')?.[0]
        ?.setAttribute('content', 'width=1600');
      const canvas = await html2canvas(cardRef.current, {
        windowWidth: 1550,
      });
      setResultImage(canvas.toDataURL());
      document
        .querySelectorAll('meta[name="viewport"]')?.[0]
        ?.setAttribute('content', vp || 'width=device-width, initial-scale=1.0');
      messageApi.open({
        type: 'success',
        key: 'handling',
        content: 'Tạo thông điệp thành công',
      });
    } catch (error) {
      messageApi.open({
        type: 'error',
        key: 'handling',
        content: 'Không thể tạo thông điệp. Vui lòng thử lại sau',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = 'anh-thong-diep-dai-hoi-2023.png';
    link.click();
    const blob = convertDataURIToBinary(resultImage);
    await saveToDb(blob);
  };

  return (
    <div
      className='flex items-center justify-center w-full h-screen bg-white'
      style={{
        background: `url(${backgroundHorizontial})`,
      }}
    >
      <div className='overflow-hidden'>
        <div className='absolute top-0 left-0 z-[-1]' ref={cardRef}>
          <img src={backgroundImage} width={1500} height={843} />
          <div>
            <div className='absolute bottom-[190px] left-[146px] overflow-hidden max-h-[313px]'>
              <div className='w-[343px] aspect-square rounded-full overflow-hidden'>
                <img className='object-cover w-full h-full' src={imageUrl} />
              </div>
            </div>
            <div className='absolute bottom-[138px] left-[146px] bg-transparent w-[350px]'>
              <h3 className='text-4xl font-bold text-center text-white'>{fullName}</h3>
            </div>
            <div className='absolute bottom-[60px] left-[146px] bg-transparent w-[350px]'>
              <p className='text-3xl font-bold text-center text-blue-900'>{role}</p>
            </div>
          </div>
          <div className='absolute w-[690px] h-[380px] bottom-[130px] right-[140px] bg-transparent'>
            <p className='text-3xl font-medium text-blue-900'>{text}</p>
          </div>
        </div>
      </div>
      <Modal
        open={!!resultImage}
        title={'Ảnh thông điệp của bạn'}
        footer={null}
        width={800}
        onCancel={() => setResultImage(null)}
      >
        {resultImage && (
          <div>
            <img alt='example' style={{ width: '100%' }} src={resultImage} />
            <div className='flex items-center justify-end pt-8 max-md:pt-3'>
              <Button type='primary' size='large' className='w-full' onClick={handleDownloadImage}>
                Lưu về máy
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <form className='w-full max-w-2xl overflow-hidden rounded-lg shadow-lg'>
        <div className='flex flex-col justify-center p-6 mx-auto bg-white'>
          <h1 className='pb-10 text-3xl font-bold text-center text-blue-800 uppercase'>
            Thông điệp gửi đại hội
          </h1>
          <ImgCrop
            showGrid
            rotationSlider
            aspectSlider
            showReset
            aspect={1}
            cropShape='rect'
            resetText='Đặt lại'
            modalCancel='Hủy'
            modalOk='Xác nhận'
            modalTitle='Chỉnh sửa ảnh đại diện'
          >
            <Upload
              name='avatar'
              multiple={false}
              listType='picture-circle'
              className='avatar-uploader !w-[250px] aspect-square !mx-auto mb-8'
              showUploadList={false}
              accept='.png,.jpg,.jpeg'
              progress={{
                size: 'small',
                style: { top: 10 },
              }}
              customRequest={(options) => {
                const { file, onProgress } = options;

                const isImage = (file as File).type?.startsWith('image');

                if (isImage && onProgress) {
                  let progress = 0;
                  const timer = setInterval(() => {
                    progress += 10;
                    onProgress({ percent: progress });

                    if (progress >= 100 && options.onSuccess) {
                      clearInterval(timer);
                      options.onSuccess('ok');
                    }
                  }, 100);
                } else if (isImage && options.onError) {
                  options.onError(new Error('Invalid file format'));
                }
              }}
              beforeUpload={(file) => {
                const isImage = file.type.startsWith('image');
                const acceptedFormats = isImage;
                if (!message) return console.error('Message API not supported');
                if (!acceptedFormats) {
                  message.error('Sai định dạng file, hãy kiểm tra lại!');
                } else {
                  message.success('Tải file thành công.');
                }
                return acceptedFormats ? file : Upload.LIST_IGNORE;
              }}
              onChange={handleChange}
            >
              {imageUrl ? (
                <div className='overflow-hidden rounded-full'>
                  <img
                    src={imageUrl}
                    alt='avatar'
                    className='object-cover w-full h-full aspect-square'
                  />
                </div>
              ) : (
                uploadButton
              )}
            </Upload>
          </ImgCrop>
          <Input
            name='full_name'
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder='Họ và tên...'
            className='mb-2 text-lg'
            size='large'
          />
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            name='role'
            placeholder='Chức vụ...'
            className='mb-2 text-lg'
            size='large'
          />
          <Input.TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            name='text'
            rows={4}
            className='text-lg'
            size='large'
            placeholder='Thông điệp của bạn...'
          />
          <Button
            type='primary'
            onClick={handleSubmit}
            loading={loading}
            size='large'
            className='w-full mt-8'
          >
            Gửi thông điệp
          </Button>
        </div>
      </form>
      {contextHolder}
    </div>
  );
}

export default App;
