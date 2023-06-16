import { ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

export async function saveToDb(image: Uint8Array) {
  if (!image) return console.error('cannot');
  const imageRef = ref(storage, 'images/' + crypto.randomUUID() + '.jpg');
  try {
    await uploadBytes(imageRef, image, {
      contentType: 'image/jpeg',
    });
  } catch (error) {
    console.error(error);
  }
}

const BASE64_MARKER = ';base64,';

export function convertDataURIToBinary(dataURI: string) {
  const base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
  const base64 = dataURI.substring(base64Index);
  const raw = window.atob(base64);
  const rawLength = raw.length;
  const array = new Uint8Array(new ArrayBuffer(rawLength));

  for (let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}