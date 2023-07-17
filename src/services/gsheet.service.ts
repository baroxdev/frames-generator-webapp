export type FormData = {
  full_name: string;
  role: string;
  text: string;
  image_url: string;
};

export default async function saveToSheet(formData: FormData) {
  const api_url = 'https://sheet.best/api/sheets/a0c1370c-b074-469e-a2de-056fd5783cbc';
  await fetch(api_url, {
    method: 'POST',
    body: JSON.stringify(formData),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
