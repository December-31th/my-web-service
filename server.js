import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { exec } from "child_process";

const app = express();
app.use(bodyParser.json());

// ================== GOOGLE DRIVE AUTH ==================
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json", // 👈 file Service Account JSON
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});
const drive = google.drive({ version: "v3", auth });

// ================== MULTER (UPLOAD TẠM) ==================
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: uploadDir });

// ================== HÀM UPLOAD LÊN GOOGLE DRIVE ==================
async function uploadToDrive(localPath, originalName, mimeType) {
  const fileMetadata = { name: originalName };
  const media = {
    mimeType: mimeType,
    body: fs.createReadStream(localPath),
  };

  const file = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: "id",
  });

  const fileId = file.data.id;

  // Public file
  await drive.permissions.create({
    fileId: fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}

// ================== API UPLOAD FILE ==================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const downloadUrl = await uploadToDrive(
      req.file.path,
      req.file.originalname,
      req.file.mimetype
    );

    // Xóa file tạm
    fs.unlinkSync(req.file.path);

    res.json({ success: true, downloadUrl });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================== API MERGE VIDEO + AUDIO ==================
app.post("/merge", upload.fields([{ name: "video" }, { name: "audio" }]), async (req, res) => {
  try {
    const video = req.files["video"][0];
    const audio = req.files["audio"][0];

    const outputPath = path.join(uploadDir, `merged-${Date.now()}.mp4`);

    // Ghép video + audio bằng FFmpeg
    await new Promise((resolve, reject) => {
      const cmd = `ffmpeg -i ${video.path} -i ${audio.path} -c:v copy -c:a aac -shortest ${outputPath}`;
      exec(cmd, (error, stdout, stderr) => {
        if (error) return reject(error);
        resolve();
      });
    });

    // Upload file merged lên Google Drive
    const downloadUrl = await uploadToDrive(outputPath, "merged.mp4", "video/mp4");

    // Xóa file tạm
    fs.unlinkSync(video.path);
    fs.unlinkSync(audio.path);
    fs.unlinkSync(outputPath);

    res.json({ success: true, downloadUrl });
  } catch (err) {
    console.error("Merge error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
