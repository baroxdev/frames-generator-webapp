import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Upload, message } from 'antd';
import ImgCrop from 'antd-img-crop';
import { RcFile, UploadChangeParam, UploadFile, UploadProps } from 'antd/es/upload';
import clsx from 'clsx';
import html2canvas from 'html2canvas';
import { useEffect, useRef, useState } from 'react';
import FileResizer from 'react-image-file-resizer';
import backgroundHorizontial from './assets/bg-hoz.png';
import backgroundImage from './storage/background.jpg';
import backgroundName from './storage/bg-name.svg';
import welcomeBottomImage from './storage/welcome-bottom.png';
import welcomeTopImage from './storage/welcome-top.png';
import { convertDataURIToBinary, saveToDb } from './utils';
import saveToSheet, { FormData } from './services/google-sheet';
// eslint-disable-next-line react-refresh/only-export-components
export const getBase64 = (img: RcFile | File, callback: (url: string) => void) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(reader.result as string));
  reader.readAsDataURL(img);
};

type Errors = {
  fullName: string | null;
  role: string | null;
  text: string | null;
  avatar: string | null;
};

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>();
  const [avatar, setAvatar] = useState<File>();
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [text, setText] = useState('');
  const [resultImage, setResultImage] = useState<string | null | undefined>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Errors>({
    fullName: null,
    role: null,
    text: null,
    avatar: null,
  });

  useEffect(() => {
    setErrors({
      fullName: null,
      role: null,
      text: null,
      avatar: null,
    });
  }, [fullName, role, text, avatar]);

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

  const generateDataUrl = async () => {
    if (!cardRef.current) {
      messageApi.open({
        key: 'handling',
        type: 'error',
        content: 'Không thể tạo thông điệp. Vui lòng thử lại sau',
      });
      return null;
    }
    await resizeFile(avatar as File);
    const canvas = await html2canvas(cardRef.current, {
      windowWidth: 1928,
    });
    return canvas.toDataURL();
  };

  const handlePreview = async () => {
    const _errors = { ...errors };
    if (!text || text.trim() === '') _errors.text = 'Vui lòng nhập thông điệp';
    if (text && text.length > 400) _errors.text = 'Vui lòng nhập thông điệp dưới 400 kí tự';
    if (!fullName || fullName.trim() === '') _errors.fullName = 'Vui lòng nhập Họ và tên';
    if (fullName || fullName.length > 25) _errors.fullName = 'Họ và tên tối đa 45 kí tự';
    if (!role || role.trim() === '') _errors.role = 'Vui lòng nhập Đơn vị - Chức vụ';
    if (role || role.length > 36) _errors.role = 'Đơn vị - Chức vụ tối đa 60 kí tự';
    if (!imageUrl || imageUrl.trim() === '') _errors.avatar = 'Vui lòng thêm ảnh đại diện';
    if (!text || !fullName || !role || !imageUrl) return setErrors(_errors);

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
      const dataUrl = await generateDataUrl();
      setResultImage(dataUrl);
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

  const handleSubmit = async () => {
    const _errors = { ...errors };
    if (!text || text.trim() === '') _errors.text = 'Vui lòng nhập thông điệp';
    if (text && text.length > 400) _errors.text = 'Vui lòng nhập thông điệp dưới 400 kí tự';
    if (!fullName || fullName.trim() === '') _errors.fullName = 'Vui lòng nhập Họ và tên';
    if (fullName || fullName.length > 25) _errors.fullName = 'Họ và tên tối đa 45 kí tự';
    if (!role || role.trim() === '') _errors.role = 'Vui lòng nhập Đơn vị - Chức vụ';
    if (role || role.length > 36) _errors.role = 'Đơn vị - Chức vụ tối đa 60 kí tự';
    if (!imageUrl || imageUrl.trim() === '') _errors.avatar = 'Vui lòng thêm ảnh đại diện';
    if (!text || !fullName || !role || !imageUrl) return setErrors(_errors);
    try {
      const dataUrl = await generateDataUrl();
      if (!dataUrl) return console.error('Không thể tạo thông điệp.');
      setLoading(true);
      messageApi.open({
        key: 'handling',
        type: 'loading',
        content: 'Đang tạo thông điệp',
      });
      const blob = convertDataURIToBinary(dataUrl);
      const image_url = await saveToDb(blob);
      setResultImage(dataUrl);
      messageApi.open({
        key: 'handling',
        type: 'loading',
        content: 'Đang gửi thông điệp',
      });
      const formData: FormData = {
        full_name: fullName,
        role: role,
        text: text,
        image_url: image_url || '',
      };
      await saveToSheet(formData);
      messageApi.open({
        key: 'handling',
        type: 'success',
        content: 'Gửi thông điệp thành công',
      });
    } catch (error) {
      messageApi.open({
        type: 'error',
        key: 'handling',
        content: 'Không thể tạo thông điệp. Vui lòng thử lại sau',
      });
    } finally {
      setLoading(false);
      setPreview(true);
    }
  };

  const handleDownloadImage = async () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = 'anh-thong-diep-dai-hoi-2023.png';
    link.click();
  };

  return (
    <div
      className='flex justify-center w-full h-screen bg-white'
      style={{
        background: `url(${backgroundHorizontial})`,
      }}
    >
      <div className='overflow-hidden max-md:hidden'>
        <div className='absolute top-0 left-0 z-[-1]' ref={cardRef}>
          <img src={backgroundImage} width={1500} height={843} />
          <div>
            <div className='absolute bottom-[191px] left-[120.5px]'>
              <div className='w-[340px] aspect-square rounded-full overflow-hidden'>
                <img className='object-cover w-full h-full' src={imageUrl} />
              </div>
            </div>
            <div className='absolute bottom-[120px] left-[105.5px]'>
              <img className='object-cover max-w-[400px] h-[110px]' src={backgroundName} />
            </div>
            <div className='absolute bottom-[185px] left-[115px] bg-transparent w-[350px]'>
              <h3
                className={clsx('font-bold text-center text-white whitespace-nowrap', {
                  'text-4xl': role.length <= 15,
                  'text-3xl': role.length > 15,
                  'text-2xl': role.length > 20,
                })}
              >
                {fullName || 'Lê Hoàng Trương Minh Hải'}
              </h3>
            </div>
            <div className='absolute bottom-[80px] left-[105px] bg-transparent w-[400px] h-[100px]  whitespace-nowrap'>
              <p
                className={clsx(' font-bold text-center text-white', {
                  'text-xl': role.length > 25,
                  'text-2xl': role.length <= 25,
                })}
              >
                {role || 'Chức vụ của bạn'}
              </p>
            </div>
          </div>
          <div
            className={clsx(
              'absolute w-[690px] h-[340px] bottom-[220px] right-[140px] bg-transparent',
              {
                'flex items-center justify-center': text.length < 150,
              }
            )}
          >
            <p
              className={clsx('font-medium text-blue-900', {
                'text-3xl ': text.length > 150,
                'text-5xl text-center': text.length < 150,
              })}
            >
              {text || 'Thông điệp của bạn'}
            </p>
          </div>
        </div>
      </div>
      {/* <div
        className='bg-white absolute inset-0 z-[1]'
        style={{
          background: `url(${backgroundHorizontial})`,
        }}
      ></div> */}
      <Modal
        open={preview}
        title={'Ảnh thông điệp của bạn'}
        footer={null}
        width={800}
        onCancel={() => {
          setResultImage(null);
          setPreview(false);
        }}
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
      <div className='flex flex-col items-center justify-center w-full max-w-2xl px-3'>
        <div className='max-w-lg mb-5 max-md:max-w-full'>
          <img src={welcomeTopImage} alt='welcome image' />
          <img src={welcomeBottomImage} className='mt-4' alt='welcome image' />
        </div>
        <form className='relative w-full overflow-hidden overflow-y-auto shadow-lg rounded-xl'>
          <div className='flex flex-col justify-center px-6 py-8 mx-auto bg-white max-md:py-5 max-md:px-4'>
            <div className='flex flex-col items-center justify-center'>
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
              {errors.avatar && (
                <div className='ml-1 font-sans text-sm text-red-600 '>{errors.avatar}</div>
              )}
            </div>
            <div className='flex flex-col gap-2'>
              <div>
                <Input
                  name='full_name'
                  value={fullName}
                  onChange={(e) => {
                    if (e.target.value.length > 25) {
                      return;
                    }
                    setFullName(e.target.value);
                  }}
                  placeholder='Họ và tên'
                  className='mb-2 text-lg'
                  size='large'
                />
                {errors.fullName && (
                  <div className='ml-1 font-sans text-sm text-red-600 '>{errors.fullName}</div>
                )}
              </div>
              <div>
                <Input
                  value={role}
                  onChange={(e) => {
                    if (e.target.value.length > 36) {
                      return;
                    }
                    setRole(e.target.value);
                  }}
                  name='role'
                  placeholder='Đơn vị - Chức vụ'
                  className='mb-2 text-lg'
                  size='large'
                />
                {errors.role && (
                  <div className='ml-1 font-sans text-sm text-red-600 '>{errors.role}</div>
                )}
              </div>
              <div>
                <Input.TextArea
                  value={text}
                  onChange={(e) => {
                    if (e.target.value.length > 400) {
                      return;
                    }
                    setText(e.target.value);
                  }}
                  name='text'
                  rows={4}
                  className='!mb-1 text-lg'
                  size='large'
                  placeholder='Thông điệp (Tối đa 400 kí tự)'
                />
                {errors.text && (
                  <div className='ml-1 font-sans text-sm text-red-600 '>{errors.text}</div>
                )}
              </div>
            </div>
            <div className='flex items-center gap-3'>
              <Button
                type='default'
                loading={loading}
                onClick={async () => {
                  await handlePreview();
                  setPreview(true);
                }}
                style={{
                  padding: '12px 20px',
                }}
                className='mt-8 !text-base w-fit !h-fit font-sans text-slate-700 !rounded-lg'
              >
                Xem trước
              </Button>
              <Button
                type='primary'
                onClick={handleSubmit}
                loading={loading}
                style={{
                  padding: '12px 20px',
                }}
                className='w-full mt-8 !text-base bg-blue-600 !h-fit font-sans !rounded-lg'
              >
                Gửi thông điệp
              </Button>
            </div>
          </div>
        </form>
      </div>
      {contextHolder}
    </div>
  );
}

export default App;
