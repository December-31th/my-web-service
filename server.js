import express from "express";
import fs from "fs";
import { google } from "googleapis";
import multer from "multer";

const app = express();
const port = process.env.PORT || 10000;

// ===== Multer lưu file tạm để upload =====
const upload = multer({ dest: "uploads/" });

// ===== Config Google Drive API =====
const KEYFILEPATH = "service-account.json"; // file JSON tải từ Google Cloud
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

// Auth client
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
const driveService = google.drive({ version: "v3", auth });

// ===== ID thư mục Drive (copy từ link thư mục của bạn) =====
const DRIVE_FOLDER_ID = "YOUR_FOLDER_ID_HERE";

// ===== Upload file lên Google Drive =====
async function uploadFileToDrive(filePath, fileName) {
  const fileMetadata = {
    name: fileName,
    parents: [DRIVE_FOLDER_ID],
  };

  const media = {
    mimeType: "video/mp4",
    body: fs.createReadStream(filePath),
  };

  const file = await driveService.files.create({
    resource: fileMetadata,
    media: media,
    fields: "id, webContentLink, webViewLink",
  });

  // Set quyền công khai cho file
  await driveService.permissions.create({
    fileId: file.data.id,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  // Trả link download trực tiếp
  return `https://drive.google.com/uc?export=download&id=${file.data.id}`;
}

// ===== API Upload =====
app.post("/upload", upload.single("video"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const fileName = req.file.originalname;

    const downloadLink = await uploadFileToDrive(filePath, fileName);

    // Xoá file local sau khi upload xong
    fs.unlinkSync(filePath);

    res.json({ success: true, downloadLink });
  } catch (err) {
    console.error("Upload lỗi:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== Test API =====
app.get("/", (req, res) => {
  res.send("🚀 FFmpeg API + Google Drive Upload đang chạy!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
