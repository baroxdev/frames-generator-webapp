import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

import { storage } from './firebase';

export async function saveToDb(image: Uint8Array) {
  if (!image) return null;
  const imageRef = ref(storage, 'images/' + uuidv4() + '.jpg');
  await uploadBytes(imageRef, image, {
    contentType: 'image/jpeg',
  });

  return await getDownloadURL(imageRef);
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

export const delay = (milliseconds: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};
