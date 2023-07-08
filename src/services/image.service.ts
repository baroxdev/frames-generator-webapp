import imageCompression from 'browser-image-compression';

class ImageServices {
  public async compressImage(image: File) {
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
  }
}

export default new ImageServices();
