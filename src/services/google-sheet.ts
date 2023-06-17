export type FormData = {
  full_name: string;
  role: string;
  text: string;
  image_url: string;
};

export default async function saveToSheet(formData: FormData) {
  const api_url = 'https://sheet.best/api/sheets/8928d0f2-6ba9-456b-a877-e2d76417bb95';
  await fetch(api_url, {
    method: 'POST',
    body: JSON.stringify(formData),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
