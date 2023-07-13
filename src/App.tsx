import { Button, Input, message, Modal, Upload } from 'antd';
import ImgCrop from 'antd-img-crop';
import { RcFile, UploadChangeParam, UploadFile, UploadProps } from 'antd/es/upload';
import domtoimage from 'dom-to-image';
import { DownloadIcon, EyeIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import FileResizer from 'react-image-file-resizer';

import { ErrorBoundary, Provider } from '@rollbar/react'; // Provider imports 'rollbar'

import backgroundHorizontial from './assets/bg-hoz.png';
import PrintArea from './components/PrintArea';
import UploadButton from './components/UploadButton';
import { config } from './config';
import saveToSheet, { FormData } from './services/gsheet.service';
import imageService from './services/image.service';
import welcomeBottomImage from './storage/welcome-bottom.png';
import welcomeTopImage from './storage/welcome-top.png';
import { convertDataURIToBinary, delay, saveToDb } from './utils';

const rollbarConfig = {
  accessToken: '0ea66c80fb1541d8a8b9187b4d5e12e1',
  environment: 'testenv',
};

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
  const [previewing, setPreviewing] = useState(false);
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

  const handleChange: UploadProps['onChange'] = async (info: UploadChangeParam<UploadFile>) => {
    if (info.file.status === 'uploading') {
      setLoading(true);
      return;
    }
    if (info.file.status === 'done') {
      setAvatar(info.file.originFileObj);
      getBase64(info.file.originFileObj as RcFile, (url) => {
        setImageUrl(url);
        setLoading(false);
      });
    }
  };

  const resizeFile = (file: File) => {
    const image: Promise<File | null> = new Promise((resolve) => {
      FileResizer.imageFileResizer(
        file,
        500,
        500,
        'JPEG',
        50,
        0,
        (uri) => {
          resolve(uri as File);
        },
        'file'
      );
    });
    return image;
  };

  const getDataUrl = async (avatar: File) => {
    const resizeImage = await resizeFile(avatar);
    if (!resizeImage) {
      console.error('Cannot resize image');
      return null;
    }

    if (previewing) {
      setAvatar(resizeImage as RcFile);
    } else {
      const compressedAvatar = await imageService.compressImage(resizeImage);
      setAvatar(compressedAvatar as RcFile);
    }

    if (!cardRef.current) {
      messageApi.open({
        key: 'handling',
        type: 'error',
        content: config.text.error.cannot_create_message,
      });
      return null;
    }
    await delay(100);
    console.log('🚀 ~ file: App.tsx:108 ~ getDataUrl ~ cardRef:', cardRef);
    await domtoimage.toPng(cardRef.current, {
      width: 1500,
      height: 843,
    });
    const imageUrl = await domtoimage.toPng(cardRef.current, {
      width: 1500,
      height: 843,
    });
    console.log('🚀 ~ file: App.tsx:144 ~ getDataUrl ~ imageUrl:', imageUrl);
    return imageUrl;
  };

  const handlePreview = async () => {
    const _errors: Errors = {
      fullName: null,
      role: null,
      text: null,
      avatar: null,
    };
    if (!text || text.trim() === '') _errors.text = config.text.error.missing_message;
    if (text && text.length > config.limit.message) _errors.text = config.text.error.exceed_message;
    if (text.length < 10) _errors.text = config.text.error.message_too_short;
    if (!fullName || fullName.trim() === '') _errors.fullName = config.text.error.fullName_empty;
    if (fullName && fullName.length > config.limit.fullName)
      _errors.fullName = config.text.error.fullName_too_long;
    if (fullName.length < 2) _errors.fullName = config.text.error.fullName_too_short;
    if (!role || role.trim() === '') _errors.role = config.text.error.role_empty;
    if (role && role.length > 36) _errors.role = config.text.error.role_too_long;
    if (role.length < 3) _errors.role = config.text.error.role_too_short;
    if (!imageUrl || imageUrl.trim() === '') _errors.avatar = config.text.error.avatar_empty;
    if (!text || !fullName || !role || !imageUrl) return setErrors(_errors);
    messageApi.open({
      key: 'optimize',
      content: 'Đang nén ảnh',
      type: 'loading',
    });
    if (!avatar) return messageApi.warning(config.text.warning.choose_avatar);
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
        content: config.text.error.cannot_create_message,
      });
    try {
      const dataUrl = await getDataUrl(avatar);
      setResultImage(dataUrl);
      setPreview(true);
    } catch (error) {
      console.error({ error: error });
      messageApi.open({
        type: 'error',
        key: 'handling',
        content: config.text.error.cannot_create_message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (existedDataUrl?: string) => {
    const _errors: Errors = {
      fullName: null,
      role: null,
      text: null,
      avatar: null,
    };
    if (!text || text.trim() === '') _errors.text = config.text.error.missing_message;
    if (text && text.length > config.limit.message) _errors.text = config.text.error.exceed_message;
    if (text.length < 10) _errors.text = config.text.error.message_too_short;
    if (!fullName || fullName.trim() === '') _errors.fullName = config.text.error.fullName_empty;
    if (fullName && fullName.length > config.limit.fullName)
      _errors.fullName = config.text.error.fullName_too_long;
    if (fullName.length < 2) _errors.fullName = config.text.error.fullName_too_short;
    if (!role || role.trim() === '') _errors.role = config.text.error.role_empty;
    if (role && role.length > 36) _errors.role = config.text.error.role_too_long;
    if (role.length < 3) _errors.role = config.text.error.role_too_short;
    if (!imageUrl || imageUrl.trim() === '') _errors.avatar = config.text.error.avatar_empty;
    if (!text || !fullName || !role || !imageUrl) return setErrors(_errors);
    try {
      if (!avatar) return messageApi.warning(config.text.warning.choose_avatar);
      const dataUrl = existedDataUrl ? existedDataUrl : await getDataUrl(avatar);
      if (!dataUrl) return console.error('Không thể tạo thông điệp.');
      setLoading(true);
      messageApi.open({
        key: 'handling',
        type: 'loading',
        content: config.text.loading.creating_message,
      });
      const blob = convertDataURIToBinary(dataUrl);
      const image_url = await saveToDb(blob);
      message.destroy('handling');
      setResultImage(dataUrl);
      messageApi.open({
        key: 'sending',
        type: 'loading',
        content: config.text.loading.sending_message,
      });
      const formData: FormData = {
        full_name: fullName,
        role: role,
        text: text,
        image_url: image_url || '',
      };
      await saveToSheet(formData);
      messageApi.open({
        key: 'sending',
        type: 'success',
        content: config.text.success.sent_message,
      });
    } catch (error) {
      console.error({ error });
      messageApi.open({
        type: 'error',
        key: 'sending',
        content: config.text.error.cannot_create_message,
      });
    } finally {
      setLoading(false);
    }
    if (!previewing) {
      setPreview(true);
      return;
    }

    resetState();
  };

  const resetState = () => {
    setText('');
    setFullName('');
    setRole('');
    setImageUrl(undefined);
    setResultImage(null);
    setAvatar(undefined);
    setErrors({
      fullName: null,
      role: null,
      text: null,
      avatar: null,
    });
  };

  const handleCancelPreview = () => {
    setResultImage(null);
    setPreview(false);
    if (!previewing) resetState();
    setPreviewing(false);
  };

  // const showMockImage = Boolean(imageUrl);
  const isDevMod = false;

  return (
    <Provider config={rollbarConfig}>
      <ErrorBoundary>
        <div
          className='flex justify-center w-full min-h-screen py-4 bg-white'
          style={{
            background: `url(${backgroundHorizontial})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
            backgroundSize: 'cover',
          }}
        >
          <PrintArea
            avatar={imageUrl}
            ref={cardRef}
            role={role}
            message={text}
            isDevMod={isDevMod}
            fullName={fullName}
          />
          <Modal
            open={preview}
            title={'Ảnh thông điệp của bạn'}
            footer={null}
            width={800}
            onCancel={handleCancelPreview}
          >
            {resultImage && (
              <div>
                <img alt='example' style={{ width: '100%' }} src={resultImage} />
                <div className='flex items-center justify-between pt-8 max-md:pt-3'>
                  <Button type='text' size='small' onClick={handleCancelPreview}>
                    Thay đổi
                  </Button>
                  <div className='flex items-center gap-3'>
                    <Button
                      download
                      target='_blank'
                      data-href={resultImage}
                      title='Download message image'
                      href={resultImage}
                      type='default'
                      size='small'
                      className='flex items-center justify-center'
                      icon={<DownloadIcon />}
                    >
                      Lưu về máy
                    </Button>
                    {previewing && (
                      <Button
                        type='primary'
                        size='small'
                        className='flex items-center justify-center'
                        onClick={() => {
                          handleSubmit(resultImage);
                        }}
                      >
                        Gửi thông điệp
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Modal>
          <div className='flex flex-col items-center w-full max-w-2xl px-2'>
            <div className='max-w-md mb-7 max-md:mb-4 max-md:max-w-full'>
              <img src={welcomeTopImage} alt='welcome image' />
              <img src={welcomeBottomImage} className='mt-4' alt='welcome image' />
            </div>
            <form className='relative w-full overflow-hidden overflow-y-auto shadow-lg rounded-xl'>
              <div className='flex flex-col justify-center p-6 mx-auto bg-white max-md:py-5 max-md:px-3'>
                <div className='flex flex-col items-center justify-center'>
                  <ImgCrop
                    showGrid
                    rotationSlider
                    aspectSlider
                    showReset={true}
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
                      className='avatar-uploader !w-[170px] max-md:!w-[130px] aspect-square !mx-auto md:mb-3'
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
                        <UploadButton loading={loading} />
                      )}
                    </Upload>
                  </ImgCrop>
                  {errors.avatar && (
                    <div className='mt-1 ml-1 font-sans text-xs text-red-600 '>{errors.avatar}</div>
                  )}
                </div>
                <div className='flex flex-col gap-1'>
                  <div>
                    <Input
                      name='full_name'
                      value={fullName}
                      onChange={(e) => {
                        if (e.target.value.length > 25) {
                          messageApi.warning('Vui lòng nhập tối đa 25 kí tự');
                          return setFullName(e.target.value.slice(0, 25));
                        }
                        setFullName(e.target.value);
                      }}
                      placeholder='Họ và tên'
                      className='mt-1 text-base'
                      size='large'
                    />
                    {errors.fullName && (
                      <div className='mt-1 ml-1 font-sans text-xs text-red-600 '>
                        {errors.fullName}
                      </div>
                    )}
                  </div>
                  <div>
                    <Input
                      value={role}
                      onChange={(e) => {
                        if (e.target.value.length > 36) {
                          messageApi.warning('Vui lòng nhập tối đa 36 kí tự');
                          return setRole(e.target.value.slice(0, 36));
                        }
                        setRole(e.target.value);
                      }}
                      name='role'
                      placeholder='Đơn vị - Chức vụ'
                      className='mt-1 text-base'
                      size='large'
                    />
                    {errors.role && (
                      <div className='mt-1 ml-1 font-sans text-xs text-red-600 '>{errors.role}</div>
                    )}
                  </div>
                  <div>
                    <Input.TextArea
                      value={text}
                      onChange={(e) => {
                        if (e.target.value.length > 400) {
                          messageApi.warning('Vui lòng nhập tối đa 400 kí tự');
                          return setText(e.target.value.slice(0, 399));
                        }
                        setText(e.target.value);
                      }}
                      name='text'
                      rows={4}
                      className='!mt-2 text-base'
                      size='large'
                      placeholder='Thông điệp (Tối đa 400 kí tự)'
                    />
                    <div className='flex items-center justify-between'>
                      {errors.text && (
                        <div className='mt-1 ml-1 font-sans text-xs text-red-600 '>
                          {errors.text}
                        </div>
                      )}
                      <span className='ml-auto text-sm text-slate-500'>{text.length} / 400</span>
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-3 mt-8 max-md:gap-2 max-md:flex-col max-md:mt-5'>
                  <Button
                    type='text'
                    size='middle'
                    loading={loading}
                    onClick={async () => {
                      setPreviewing(true);
                      await handlePreview();
                    }}
                    icon={<EyeIcon />}
                    className='!text-sm w-fit max-md:w-full !flex items-center justify-center !h-fit font-sans text-slate-700 !rounded-lg'
                  >
                    Xem trước
                  </Button>
                  <Button
                    size='middle'
                    type='primary'
                    onClick={() => {
                      handleSubmit();
                    }}
                    loading={loading}
                    className='w-full !text-sm bg-[#006ded] !h-fit font-sans !rounded-lg flex items-center justify-center'
                  >
                    Lưu và gửi thông điệp
                  </Button>
                </div>
              </div>
            </form>
          </div>
          {contextHolder}
        </div>
      </ErrorBoundary>
    </Provider>
  );
}

export default App;
