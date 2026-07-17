import { LoadingOutlined, PlusOutlined } from "@ant-design/icons";
import { Input, Modal, Upload, message } from "antd";
import ImgCrop from "antd-img-crop";
import {
  RcFile,
  UploadChangeParam,
  UploadFile,
  UploadProps,
} from "antd/es/upload";
import imageCompression from "browser-image-compression";
import html2canvas from "html2canvas-pro";
import { DownloadIcon, EyeIcon } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import FileResizer from "react-image-file-resizer";
import useSound from "use-sound";
import backgroundHorizontial from "./assets/bg-hoz.png";
import saveToSheet, { FormData } from "./services/google-sheet";
import welcomeTopImage from "./storage/welcome-top.png";
import { convertDataURIToBinary, saveToDb } from "./utils";
import { Button } from "./components/ui/button";
import PrintArea from "./components/PrintArea";
import TemplateGallery from "./components/TemplateGallery";
import TopBanner from "./components/TopBanner";
import { getExportWindowWidth } from "./services/frameExport.service";
import { DEFAULT_TEMPLATE_ID, getTemplateById, getTemplateGallery } from "./templates";

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

// Component to ensure fonts are loaded before rendering
const FontLoader = ({ children }: { children: React.ReactNode }) => {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    // Check if the fonts API is supported
    if ("fonts" in document) {
      document.fonts.ready.then(() => {
        setFontsLoaded(true);
      });
    } else {
      // Fallback for browsers that don't support the fonts API
      setFontsLoaded(true);
    }
  }, []);

  if (!fontsLoaded) {
    return <div className="loading-fonts">Loading fonts...</div>;
  }

  return <>{children}</>;
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
  const templateGallery = getTemplateGallery();
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const selectedTemplate = getTemplateById(selectedTemplateId) ?? templateGallery[0];
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [play] = useSound("/assets/sounds/sound.mp", {
    loop: true,
    interupt: true,
    volume: 0.5,
    soundEnabled: true,
  });

  const [errors, setErrors] = useState<Errors>({
    text: null,
    avatar: null,
    fullName: null,
    role: null,
  });

  // useEffect(() => {
  //   console.log("Play sound");
  //   play();
  //   return () => {
  //     stopSrollingSound();
  //   };
  // }, [play, stopSrollingSound]);

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
        800, // max width
        800, // max height
        "JPEG", // format
        85, // quality (0-100)
        0, // rotation
        (uri) => {
          resolve(uri as File);
        },
        "file",
        600, // min width
        600 // min height
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

    try {
      // Ensure fonts are loaded before proceeding
      if ("fonts" in document) {
        await document.fonts.ready;
        console.log("Fonts loaded before generating image");
      }

      // First step: Resize the image to reasonable dimensions
      const resizedImage = await resizeFile(avatar);
      if (!resizedImage) {
        console.error("Cannot resize image");
        return null;
      }

      // Second step: Compress the resized image with optimized settings
      const compressionOptions = {
        maxSizeMB: 0.9, // Target size just under 1MB
        maxWidthOrHeight: 800, // Reasonable size for profile photos
        initialQuality: 0.8, // Start with good quality
        useWebWorker: true, // Better performance
        alwaysKeepResolution: false, // Allow resize if needed
        preserveExif: false, // Remove EXIF data to reduce size
      };

      const compressedImage = await imageCompression(
        resizedImage,
        compressionOptions
      );

      // If still too large, try one more time with stricter settings
      if (compressedImage.size > 1024 * 1024) {
        const stricterOptions = {
          ...compressionOptions,
          maxSizeMB: 0.8,
          initialQuality: 0.8,
        };
        const finalImage = await imageCompression(
          compressedImage,
          stricterOptions
        );
        setAvatar(finalImage as RcFile);
      } else {
        setAvatar(compressedImage as RcFile);
      }

      const canvas = await html2canvas(cardRef.current, {
        windowWidth: getExportWindowWidth(selectedTemplate.canvas.width),
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 2, // Higher scale for better quality on mobile
        onclone: (document) => {
          // Force load fonts before rendering
          document.fonts.ready.then(() => {
            console.log("Fonts have loaded and are ready to use");
          });
        },
      });

      return canvas.toDataURL("image/jpeg", 0.9);
    } catch (error) {
      console.error("Compression error:", error);
      messageApi.open({
        type: "error",
        key: "handling",
        content: "Không thể xử lý ảnh. Vui lòng thử lại sau",
      });
      return null;
    }
  };

  const handlePreview = async () => {
    // format fullName to capitalize
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
    if (!role || role.trim() === "") _errors.role = "Vui lòng nhập Đơn vị";
    if (role && role.length > 36) _errors.role = "Đơn vị tối đa 60 kí tự";
    if (role.length < 3) _errors.fullName = "Đơn vị cần có ít nhất 3 ký tự";
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
    if (!role || role.trim() === "") _errors.role = "Vui lòng nhập Đơn vị";
    if (role && role.length > 36) _errors.role = "Đơn vị tối đa 60 kí tự";
    if (role.length < 3) _errors.fullName = "Đơn vị cần có ít nhất 3 ký tự";
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
        "Họ và tên": fullName,
        "Đơn vị": role,
        "Thông điệp": text,
        "Hình ảnh": image_url || "",
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

  const handleSound = () => {
    if (soundEnabled) {
      return;
    }
    setSoundEnabled(true);
    play();
  };

  const showMockImage =
    // fullName.trim() !== "" &&
    // role.trim() !== "" &&
    text.trim() !== "" && imageUrl;

  return (
    // Wrap the app in the FontLoader component
    <FontLoader>
      <div
        className="flex justify-center w-full min-h-screen py-4 bg-white bg-cover"
        style={{
          backgroundImage: "url('./pattern-2.png')",
        }}
        onMouseMove={handleSound}
        onClick={handleSound}
      >
        <div
          className="absolute inset-0  z-[-0.5]"
          style={{
            backgroundImage: `url(${backgroundHorizontial})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        ></div>
        {showMockImage && (
          <div className="max-md:hidden">
            <PrintArea
              ref={cardRef}
              template={selectedTemplate}
              content={{
                avatar: imageUrl,
                fullName,
                role,
                message: text,
              }}
            />
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
                <Button type="button" size="sm" onClick={handleCancelPreview}>
                  Thay đổi
                </Button>
                <div className="flex items-center gap-3">
                  <a href={resultImage} target="_blank" download={true}>
                    <Button
                      data-href={resultImage}
                      title="Download message image"
                      type="button"
                      size="sm"
                      className="flex items-center justify-center"
                    >
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Lưu về máy
                    </Button>
                  </a>
                  {previewing && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={loading}
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
            <TopBanner src={welcomeTopImage} />
          </div>
          <div className="w-full mb-4 max-w-2xl">
            <TemplateGallery
              templates={templateGallery}
              selectedId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
            />
          </div>
          <form className="relative w-full overflow-hidden overflow-y-auto shadow-lg rounded-xl">
            <div className="flex flex-col justify-center px-6 py-8 mx-auto bg-white max-md:py-5 max-md:px-3">
              <div
                className="flex flex-col items-center justify-center"
                onFocus={handleSound}
              >
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
                    className="avatar-uploader !w-[250px] max-md:!w-[130px] aspect-square !mx-auto md:mb-3"
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
                  <div className="mt-1 ml-1  text-xs text-red-600 ">
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
                    <div className="mt-1 ml-1  text-xs text-red-600 ">
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
                    placeholder="Đơn vị"
                    className="mt-2 text-base"
                    size="large"
                  />
                  {errors.role && (
                    <div className="mt-1 ml-1  text-xs text-red-600 ">
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
                      <div className="mt-1 ml-1  text-xs text-red-600 ">
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
                  type="button"
                  size="lg"
                  className="w-full"
                  variant={"outline"}
                  disabled={loading}
                  onClick={async () => {
                    setPreviewing(true);
                    await handlePreview();
                  }}
                >
                  <EyeIcon className="w-4 h-4 mr-2" />
                  Xem trước
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                  onClick={() => {
                    handleSubmit();
                  }}
                >
                  Lưu và gửi thông điệp
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
      {contextHolder}
    </FontLoader>
  );
}

export default App;
