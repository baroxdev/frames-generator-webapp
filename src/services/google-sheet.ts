import { config } from "../config";

export type FormData = {
  full_name: string;
  role: string;
  text: string;
  image_url: string;
};

export default async function saveToSheet(formData: FormData) {
  const api_url = config.api.sheet;
  await fetch(api_url, {
    method: "POST",
    body: JSON.stringify({
      ...formData,
      created_at: new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
}
