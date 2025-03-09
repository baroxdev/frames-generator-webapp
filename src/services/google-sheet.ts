import { config } from "../config";
import axios from "axios";

export type FormData = {
  ["Họ và tên"]: string;
  ["Đơn vị"]: string;
  ["Thông điệp"]: string;
  ["Hình ảnh"]: string;
};

export default async function saveToSheet(formData: FormData) {
  const api_url = config.api.sheet;
  await axios.post(
    api_url,
    {
      ...formData,
      ["Tạo lúc"]: new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
