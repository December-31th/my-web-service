import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import fs from "fs";
import { google } from "googleapis";

const app = express();
app.use(bodyParser.json());

// ================== GOOGLE DRIVE AUTH ==================
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json", // 👈 file JSON tài khoản dịch vụ tải từ Google Cloud
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth });

// ================== MULTER (UPLOAD TẠM) ==================
const upload = multer({ dest: "uploads/" });

// ================== API UPLOAD ==================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const fileMetadata = {
      name: req.file.originalname,
    };

    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path),
    };

    // Upload file lên Google Drive
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });

    // Xóa file tạm trên server
    fs.unlinkSync(req.file.path);

    const fileId = file.data.id;

    // Làm file public để lấy link download
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    const link = `https://drive.google.com/uc?id=${fileId}&export=download`;

    res.json({
      success: true,
      fileId: fileId,
      downloadUrl: link,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
