const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000; // Render sẽ tự set PORT

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Route mặc định (test nhanh)
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "FFmpeg API running 🚀" });
});

// API demo merge video + audio
app.post("/merge", async (req, res) => {
  try {
    const { video1, video2, audio } = req.body;

    if (!video1 || !video2 || !audio) {
      return res.status(400).json({ error: "Thiếu video1, video2 hoặc audio" });
    }

    // ⚡ Ở đây bạn sẽ chạy FFmpeg thật sự để merge (hiện demo thôi)
    const resultUrl = `https://fake-storage.com/output/${Date.now()}.mp4`;

    res.json({
      success: true,
      video1,
      video2,
      audio,
      result_url: resultUrl
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`FFmpeg API running on port ${PORT}`);
});
