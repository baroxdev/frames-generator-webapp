export type FormData = {
  full_name: string;
  role: string;
  text: string;
  image_url: string;
};

export default async function saveToSheet(formData: FormData) {
  const api_url = 'https://sheet.best/api/sheets/3b5a2389-5830-43ea-b5cb-78be50640b93';
  await fetch(api_url, {
    method: 'POST',
    body: JSON.stringify(formData),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
