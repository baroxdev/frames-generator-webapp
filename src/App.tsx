import { LoadingOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Input, Modal, Upload, message } from "antd";
import ImgCrop from "antd-img-crop";
import {
  RcFile,
  UploadChangeParam,
  UploadFile,
  UploadProps,
} from "antd/es/upload";
import imageCompression from "browser-image-compression";
import clsx from "clsx";
import html2canvas from "html2canvas";
import { DownloadIcon, EyeIcon } from "lucide-react";
import { useRef, useState } from "react";
import FileResizer from "react-image-file-resizer";
import backgroundHorizontial from "./assets/bg-hoz.jpg";
import saveToSheet, { FormData } from "./services/google-sheet";
import backgroundImage from "./storage/background.png";
import welcomeBottomImage from "./storage/welcome-bottom.png";
import welcomeTopImage from "./storage/welcome-top.png";
import flyImage from "./assets/fly.png";
import { convertDataURIToBinary, saveToDb } from "./utils";
// eslint-disable-next-line react-refresh/only-export-components
export const getBase64 = (
  img: RcFile | File,
  callback: (url: string) => void
) => {
  const reader = new FileReader();
  reader.addEventListener("load", () => callback(reader.result as string));
  reader.readAsDataURL(img);
};

type Errors = {
  text: string | null;
  avatar: string | null;
  fullName: string | null;
  role: string | null;
};

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>();
  const [avatar, setAvatar] = useState<File>();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [text, setText] = useState("");
  const [resultImage, setResultImage] = useState<string | null | undefined>(
    null
  );
  const cardRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Errors>({
    text: null,
    avatar: null,
    fullName: null,
    role: null,
  });

  const compressImage = async (image: File) => {
    const options = {
      maxSizeMB: 0.7,
      maxWidthOrHeight: 1920,
      useWebWorker: false,
      alwaysKeepResolution: true,
    };

    try {
      const compressedFile = await imageCompression(image, options);
      return compressedFile;
    } catch (error) {
      console.log(error);
      return null;
    }
  };

  const handleChange: UploadProps["onChange"] = async (
    info: UploadChangeParam<UploadFile>
  ) => {
    if (info.file.status === "uploading") {
      setLoading(true);
      return;
    }
    if (info.file.status === "done") {
      setAvatar(info.file.originFileObj);
      getBase64(info.file.originFileObj as RcFile, (url) => {
        setImageUrl(url);
        setLoading(false);
      });
    }
  };

  const uploadButton = (
    <div>
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }} className="font-medium">
        Ảnh của bạn
      </div>
    </div>
  );

  const resizeFile = (file: File) => {
    const image: Promise<File | null> = new Promise((resolve) => {
      FileResizer.imageFileResizer(
        file,
        500,
        500,
        "JPEG",
        50,
        0,
        (uri) => {
          resolve(uri as File);
        },
        "file"
      );
    });
    return image;
  };

  const generateDataUrl = async (avatar: File) => {
    if (!cardRef.current) {
      messageApi.open({
        key: "handling",
        type: "error",
        content: "Không thể tạo thông điệp. Vui lòng thử lại sau",
      });
      return null;
    }
    const resizeImage = await resizeFile(avatar);
    if (!resizeImage) {
      console.error("Cannot resize image");
      return null;
    }

    if (previewing) {
      setAvatar(resizeImage as RcFile);
    } else {
      const compressedAvatar = await compressImage(resizeImage);
      console.log(
        "🚀 ~ file: App.tsx:136 ~ generateDataUrl ~ compressedAvatar:",
        compressedAvatar
      );
      setAvatar(compressedAvatar as RcFile);
    }
    const canvas = await html2canvas(cardRef.current, {
      windowWidth: 1928,
    });
    return canvas.toDataURL();
  };

  const handlePreview = async () => {
    const _errors: Errors = {
      text: null,
      avatar: null,
      fullName: null,
      role: null,
    };
    if (!text || text.trim() === "") _errors.text = "Vui lòng nhập thông điệp";
    if (text && text.length > 400)
      _errors.text = "Vui lòng nhập thông điệp dưới 400 kí tự";
    if (text.length < 10) _errors.text = "Thông điệp cần có ít nhất 10 ký tự";
    if (!fullName || fullName.trim() === "")
      _errors.fullName = "Vui lòng nhập Họ và tên";
    if (fullName && fullName.length > 25)
      _errors.fullName = "Họ và tên tối đa 45 kí tự";
    if (fullName.length < 2)
      _errors.fullName = "Họ và tên cần có ít nhất 2 ký tự";
    if (!role || role.trim() === "")
      _errors.role = "Vui lòng nhập Đơn vị - Chức vụ";
    if (role && role.length > 36)
      _errors.role = "Đơn vị - Chức vụ tối đa 60 kí tự";
    if (role.length < 3)
      _errors.fullName = "Đơn vị - Chức vụ cần có ít nhất 3 ký tự";
    if (!imageUrl || imageUrl.trim() === "")
      _errors.avatar = "Vui lòng thêm ảnh đại diện";
    if (!text || !imageUrl) return setErrors(_errors);
    messageApi.open({
      key: "optimize",
      content: "Đang nén ảnh",
      type: "loading",
    });
    if (!avatar) return messageApi.warning("Vui lòng chọn ảnh đại diện.");
    setLoading(true);
    messageApi.open({
      key: "handling",
      type: "loading",
      content: "Đang xử lí",
    });
    if (!cardRef.current)
      return messageApi.open({
        key: "handling",
        type: "error",
        content: "Không thể tạo thông điệp. Vui lòng thử lại sau",
      });
    try {
      const dataUrl = await generateDataUrl(avatar);
      setResultImage(dataUrl);
      setPreview(true);
    } catch (error) {
      console.error({ error: error });
      messageApi.open({
        type: "error",
        key: "handling",
        content: "Không thể tạo thông điệp. Vui lòng thử lại sau",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (existedDataUrl?: string) => {
    const _errors: Errors = {
      text: null,
      avatar: null,
      fullName: null,
      role: null,
    };
    if (!text || text.trim() === "") _errors.text = "Vui lòng nhập thông điệp";
    if (text && text.length > 400)
      _errors.text = "Vui lòng nhập thông điệp dưới 400 kí tự";
    if (text.length < 10)
      _errors.fullName = "Thông điệp cần có ít nhất 10 ký tự";
    if (!fullName || fullName.trim() === "")
      _errors.fullName = "Vui lòng nhập Họ và tên";
    if (fullName && fullName.length > 25)
      _errors.fullName = "Họ và tên tối đa 45 kí tự";
    if (fullName.length < 2)
      _errors.fullName = "Họ và tên cần có ít nhất 2 ký tự";
    if (!role || role.trim() === "")
      _errors.role = "Vui lòng nhập Đơn vị - Chức vụ";
    if (role && role.length > 36)
      _errors.role = "Đơn vị - Chức vụ tối đa 60 kí tự";
    if (role.length < 3)
      _errors.fullName = "Đơn vị - Chức vụ cần có ít nhất 3 ký tự";
    if (!imageUrl || imageUrl.trim() === "")
      _errors.avatar = "Vui lòng thêm ảnh đại diện";
    if (!text || !imageUrl) return setErrors(_errors);
    try {
      if (!avatar) return messageApi.warning("Vui lòng chọn ảnh đại diện.");
      const dataUrl = existedDataUrl
        ? existedDataUrl
        : await generateDataUrl(avatar);
      if (!dataUrl) return console.error("Không thể tạo thông điệp.");
      setLoading(true);
      messageApi.open({
        key: "handling",
        type: "loading",
        content: "Đang tạo thông điệp",
      });
      const blob = convertDataURIToBinary(dataUrl);
      const image_url = await saveToDb(blob);
      message.destroy("handling");
      setResultImage(dataUrl);
      messageApi.open({
        key: "sending",
        type: "loading",
        content: "Đang gửi thông điệp",
      });
      const formData: FormData = {
        full_name: fullName,
        role: role,
        text: text,
        image_url: image_url || "",
      };
      await saveToSheet(formData);
      messageApi.open({
        key: "sending",
        type: "success",
        content: "Gửi thông điệp thành công",
      });
    } catch (error) {
      console.error({ error });
      messageApi.open({
        type: "error",
        key: "sending",
        content: "Không thể tạo thông điệp. Vui lòng thử lại sau",
      });
    } finally {
      setLoading(false);
    }
    if (!previewing) {
      setPreview(true);
      return;
    }

    setPreview(false);
    resetState();
  };

  const resetState = () => {
    setText("");
    // setFullName("");
    // setRole("");
    setImageUrl(undefined);
    setResultImage(null);
    setAvatar(undefined);
  };

  // const handleDownloadImage = async () => {
  //   if (!resultImage) return;
  //   const link = document.createElement('a');
  //   link.href = resultImage;
  //   link.download = 'anh-thong-diep-dai-hoi-2023.png';
  //   link.click();
  // };

  const handleCancelPreview = () => {
    setResultImage(null);
    setPreview(false);
    if (!previewing) resetState();
    setPreviewing(false);
  };

  const showMockImage =
    // fullName.trim() !== "" &&
    // role.trim() !== "" &&
    text.trim() !== "" && imageUrl;

  return (
    <div
      className="flex justify-center w-full min-h-screen py-4 bg-white bg-cover"
      // style={{
      //   background: `url(${backgroundHorizontial}) no-repeat  fixed`,
      // }}
    >
      <div className="absolute inset-0 z-[-0.5]">
        <img
          src={backgroundHorizontial}
          className="w-full h-full object-cover"
          width={1500}
          height={843}
        />
      </div>
      {showMockImage && (
        <div className="overflow-hidden max-md:hidden">
          <div className="absolute top-0 left-0 z-[-1]" ref={cardRef}>
            <img src={backgroundImage} width={1500} height={843} />
            <div>
              <div className="absolute bottom-[150px] left-[134px]">
                <div className="w-[415px] aspect-square rounded-full h-[415px] rotate-[-3.2deg] overflow-hidden">
                  <img className="object-cover w-full h-full" src={imageUrl} />
                  {/* <img
                    className="object-cover w-full h-full bg-black"
                    src={"/background.png"}
                  /> */}
                </div>
              </div>

              <div className="absolute bottom-[80px] left-[67px]">
                <div className="aspect-[1276/360] w-[575px]">
                  <img src={flyImage} className="object-contain" />
                </div>
              </div>
              <div className="absolute bottom-[95px] left-[67px] rotate-[-2.3deg]">
                <div className="aspect-[1276/360] w-[575px] flex items-center justify-center flex-col">
                  <h3
                    className={clsx("font-bold text-[#06572a] text-center", {
                      "!text-3xl": fullName.length >= 29,
                      "text-4xl": fullName.length > 20 && fullName.length < 28,
                      "text-5xl": fullName.length < 20,
                    })}
                  >
                    {fullName || "Họ và tên"}
                  </h3>
                  <p
                    className={clsx(
                      "font-medium text-[#06572a] mt-3 text-center",
                      {
                        "text-base": role.length > 100,
                        "text-xl": role.length > 70 && role.length < 100,
                        "text-2xl": role.length > 50 && role.length < 70,

                        "text-3xl": role.length <= 50,
                      }
                    )}
                  >
                    {role || "Đơn vị - Chức vụ"}
                  </p>
                </div>
              </div>
              {/* <div className='absolute bottom-[120px] left-[105.5px]'>
              <img className='object-cover max-w-[400px] h-[110px]' src={backgroundName} />
            </div> */}
            </div>
            <div
              className={clsx(
                "absolute w-[620px] h-[350px] top-[280px] right-[140px] bg-transparent p-3",
                {
                  "flex items-center justify-center": text.length < 150,
                }
              )}
            >
              <p
                className={clsx("font-medium text-blue-900", {
                  "text-3xl ": text.length > 80,
                  "text-5xl text-center": text.length < 80,
                })}
                style={{
                  color: "#06572a",

                  lineHeight: "1.6",
                }}
              >
                {text || "Thông điệp của bạn"}
              </p>
            </div>
          </div>
        </div>
      )}
      <Modal
        open={preview}
        title={"Ảnh thông điệp của bạn"}
        footer={null}
        width={800}
        onCancel={handleCancelPreview}
      >
        {resultImage && (
          <div>
            <img alt="example" style={{ width: "100%" }} src={resultImage} />
            <div className="flex items-center justify-between pt-8 max-md:pt-3">
              <Button type="text" size="small" onClick={handleCancelPreview}>
                Thay đổi
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  download
                  target="_blank"
                  data-href={resultImage}
                  title="Download message image"
                  href={resultImage}
                  type="default"
                  size="small"
                  className="flex items-center justify-center"
                  icon={<DownloadIcon />}
                >
                  Lưu về máy
                </Button>
                {previewing && (
                  <Button
                    type="primary"
                    size="small"
                    className="flex items-center justify-center"
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
      <div className="flex flex-col items-center z-10 w-full max-w-2xl px-2">
        <div className="max-md:max-w-full mt-6 md:mt-10">
          <img src={welcomeTopImage} alt="welcome image" />
          <div className="max-w-[270px] mx-auto my-6 md:my-8">
            <img
              src={welcomeBottomImage}
              className=" w-full object-contain"
              alt="welcome image"
            />
          </div>
        </div>
        <form className="relative w-full overflow-hidden overflow-y-auto shadow-lg rounded-xl">
          <div className="flex flex-col justify-center px-6 py-8 mx-auto bg-white max-md:py-5 max-md:px-3">
            <div className="flex flex-col items-center justify-center">
              <ImgCrop
                showGrid
                rotationSlider
                aspectSlider
                showReset={true}
                aspect={1}
                cropShape="rect"
                resetText="Đặt lại"
                modalCancel="Hủy"
                modalOk="Xác nhận"
                modalTitle="Chỉnh sửa ảnh đại diện"
              >
                <Upload
                  name="avatar"
                  multiple={false}
                  listType="picture-circle"
                  className="avatar-uploader !w-[250px] max-md:!w-[200px] aspect-square !mx-auto md:mb-3"
                  showUploadList={false}
                  accept=".png,.jpg,.jpeg"
                  progress={{
                    size: "small",
                    style: { top: 10 },
                  }}
                  customRequest={(options) => {
                    const { file, onProgress } = options;

                    const isImage = (file as File).type?.startsWith("image");

                    if (isImage && onProgress) {
                      let progress = 0;
                      const timer = setInterval(() => {
                        progress += 10;
                        onProgress({ percent: progress });

                        if (progress >= 100 && options.onSuccess) {
                          clearInterval(timer);
                          options.onSuccess("ok");
                        }
                      }, 100);
                    } else if (isImage && options.onError) {
                      options.onError(new Error("Invalid file format"));
                    }
                  }}
                  beforeUpload={(file) => {
                    const isImage = file.type.startsWith("image");
                    const acceptedFormats = isImage;
                    if (!message)
                      return console.error("Message API not supported");
                    if (!acceptedFormats) {
                      message.error("Sai định dạng file, hãy kiểm tra lại!");
                    } else {
                      message.success("Tải file thành công.");
                    }
                    return acceptedFormats ? file : Upload.LIST_IGNORE;
                  }}
                  onChange={handleChange}
                >
                  {imageUrl ? (
                    <div className="overflow-hidden rounded-full">
                      <img
                        src={imageUrl}
                        alt="avatar"
                        className="object-cover w-full h-full aspect-square"
                      />
                    </div>
                  ) : (
                    uploadButton
                  )}
                </Upload>
              </ImgCrop>
              {errors.avatar && (
                <div className="mt-1 ml-1 font-sans text-xs text-red-600 ">
                  {errors.avatar}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <Input
                  name="full_name"
                  value={fullName}
                  onChange={(e) => {
                    if (e.target.value.length > 25) {
                      messageApi.warning("Vui lòng nhập tối đa 25 kí tự");
                      return setFullName(e.target.value.slice(0, 25));
                    }
                    setFullName(e.target.value);
                  }}
                  placeholder="Họ và tên"
                  className="mt-2 text-base"
                  size="large"
                />
                {errors.fullName && (
                  <div className="mt-1 ml-1 font-sans text-xs text-red-600 ">
                    {errors.fullName}
                  </div>
                )}
              </div>
              <div>
                <Input
                  value={role}
                  onChange={(e) => {
                    if (e.target.value.length > 36) {
                      messageApi.warning("Vui lòng nhập tối đa 36 kí tự");
                      return setRole(e.target.value.slice(0, 36));
                    }
                    setRole(e.target.value);
                  }}
                  name="role"
                  placeholder="Đơn vị - Chức vụ"
                  className="mt-2 text-base"
                  size="large"
                />
                {errors.role && (
                  <div className="mt-1 ml-1 font-sans text-xs text-red-600 ">
                    {errors.role}
                  </div>
                )}
              </div>
              <div>
                <Input.TextArea
                  value={text}
                  onChange={(e) => {
                    if (e.target.value.length > 400) {
                      messageApi.warning("Vui lòng nhập tối đa 400 kí tự");
                      return setText(e.target.value.slice(0, 399));
                    }
                    setText(e.target.value);
                  }}
                  name="text"
                  rows={4}
                  className="!mt-2 text-base"
                  size="large"
                  placeholder="Thông điệp (Tối đa 400 kí tự)"
                />
                <div className="flex items-center justify-between">
                  {errors.text && (
                    <div className="mt-1 ml-1 font-sans text-xs text-red-600 ">
                      {errors.text}
                    </div>
                  )}
                  <span className="ml-auto text-sm text-slate-500">
                    {text.length} / 400
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-8 max-md:gap-2 max-md:flex-col max-md:mt-5">
              <Button
                type="text"
                size="middle"
                loading={loading}
                onClick={async () => {
                  setPreviewing(true);
                  await handlePreview();
                }}
                icon={<EyeIcon />}
                className="!text-sm w-fit max-md:w-full !flex items-center justify-center !h-fit font-sans text-slate-700 !rounded-lg"
              >
                Xem trước
              </Button>
              <Button
                size="middle"
                type="primary"
                onClick={() => {
                  handleSubmit();
                }}
                loading={loading}
                className="w-full !text-sm bg-[#006ded] !h-fit font-sans !rounded-lg flex items-center justify-center"
              >
                Lưu và gửi thông điệp
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
