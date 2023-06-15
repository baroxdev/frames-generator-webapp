import { Input, Upload, message, Button, Modal } from 'antd';
import backgroundHorizontial from './assets/bg-hoz.png';
import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { RcFile, UploadChangeParam, UploadFile, UploadProps } from 'antd/es/upload';
import { useState } from 'react';
import FileResizer from 'react-image-file-resizer';

const getBase64 = (img: RcFile, callback: (url: string) => void) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(reader.result as string));
  reader.readAsDataURL(img);
};

function App() {
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>();
  const [avatar, setAvatar] = useState<File>();
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [text, setText] = useState('');
  const [resultImage, setResultImage] = useState<string | null>(null);

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
    await resizeFile(avatar as File);
    console.log('🚀 ~ file: App.tsx:82 ~ handleSubmit ~ avatar:', avatar);

    const formData = new FormData();
    formData.append('full_name', fullName);
    formData.append('role', role);
    formData.append('text', text);
    formData.append('avatar', avatar as File);
    setLoading(true);
    const response = await fetch(import.meta.env.VITE_API_URL as string, {
      method: 'POST',
      body: formData,
    });

    setLoading(false);

    const result = await response.json();
    console.log({ result });
    setResultImage(result?.url);
  };

  return (
    <div
      className='flex items-center justify-center w-full h-screen bg-white'
      style={{
        background: `url(${backgroundHorizontial})`,
      }}
    >
      <Modal
        open={!!resultImage}
        title={'Ảnh thông điệp của bạn'}
        footer={null}
        width={800}
        onCancel={() => setResultImage(null)}
      >
        {resultImage && <img alt='example' style={{ width: '100%' }} src={resultImage} />}
      </Modal>
      <form className='w-full max-w-2xl overflow-hidden rounded-lg shadow-lg'>
        <div className='flex flex-col justify-center p-6 mx-auto bg-white'>
          <h1 className='pb-10 text-3xl font-bold text-center text-blue-800 uppercase'>
            Thông điệp gửi đại hội
          </h1>
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
            className='mt-8'
          >
            Gửi thông điệp
          </Button>
        </div>
      </form>
    </div>
  );
}

export default App;
