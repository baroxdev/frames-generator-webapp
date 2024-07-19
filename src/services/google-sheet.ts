export type FormData = {
  // full_name: string;
  // role: string;
  text: string;
  image_url: string;
};

export default async function saveToSheet(formData: FormData) {
  const api_url =
    "https://sheet.best/api/sheets/d3b49fe9-2445-477f-b0c4-f1fae6203ec3";
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
