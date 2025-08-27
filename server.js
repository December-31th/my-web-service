const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const https = require("https");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

// 📌 Hàm tải file từ URL về local
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error("Download failed: " + response.statusCode));
        return;
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve(dest)));
    }).on("error", (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

// API check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "FFmpeg API running 🚀" });
});

// API merge
app.post("/merge", async (req, res) => {
  try {
    const { video1, video2, audio } = req.body;
    if (!video1 || !video2 || !audio) {
      return res.status(400).json({ error: "Thiếu video1, video2 hoặc audio" });
    }

    // 📂 Tạo folder /tmp
    const outDir = "/tmp";
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    // 📥 Download file
    const v1Path = path.join(outDir, "video1.mp4");
    const v2Path = path.join(outDir, "video2.mp4");
    const aPath = path.join(outDir, "audio.mp3");
    const outputPath = path.join(outDir, `output_${Date.now()}.mp4`);

    await downloadFile(video1, v1Path);
    await downloadFile(video2, v2Path);
    await downloadFile(audio, aPath);

    // 🛠 Merge video1 + video2 + audio
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(v1Path)
        .input(v2Path)
        .input(aPath)
        .complexFilter([
          "[0:v][1:v]concat=n=2:v=1:a=0[v]", // nối 2 video
          "[2:a]anull[a]" // lấy audio
        ])
        .map("[v]")
        .map("[a]")
        .outputOptions(["-c:v libx264", "-crf 23", "-preset veryfast"])
        .save(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", (err) => reject(err));
    });

    // 📤 Trả về link công khai
    const fileName = path.basename(outputPath);
    const publicUrl = `https://my-web-service-c380.onrender.com/output/${fileName}`;

    res.json({
      success: true,
      result_url: publicUrl
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi merge video", detail: err.message });
  }
});

// 📂 Tạo route để serve file output
app.use("/output", express.static("/tmp"));

app.listen(PORT, () => {
  console.log(`FFmpeg API running on port ${PORT}`);
});
