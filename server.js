// Simple FFmpeg API: POST /merge { video1, video2, audio, options? }
// Trả về MP4 nhị phân (Content-Type: video/mp4) -> Apps Script sẽ nhận & lưu về Drive.

const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json({ limit: '2mb' }));

// optional: CORS (không bắt buộc khi GAS gọi server-to-server)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/merge', async (req, res) => {
  try {
    const { video1, video2, audio, options } = req.body || {};
    if (!video1 || !video2 || !audio) {
      return res.status(400).json({ error: 'Missing video1, video2, or audio' });
    }

    // thời lượng mặc định (có thể ghi đè qua options)
    const vSeg = options?.videoSegmentSeconds ?? 15; // mỗi video 15s
    const aTot = options?.audioTotalSeconds ?? 30;   // audio 30s

    // Dùng 1 lệnh FFmpeg duy nhất: cắt 2 video + concat + cắt audio + ghép
    // scale=1080:-2 + setsar=1 để đồng nhất khung hình; bạn có thể bỏ nếu không cần.
    const args = [
      '-y',
      '-i', video1,
      '-i', video2,
      '-i', audio,
      '-filter_complex',
      `[0:v]trim=0:${vSeg},setpts=PTS-STARTPTS,scale=1080:-2,setsar=1[v0];` +
      `[1:v]trim=0:${vSeg},setpts=PTS-STARTPTS,scale=1080:-2,setsar=1[v1];` +
      `[v0][v1]concat=n=2:v=1:a=0[outv];` +
      `[2:a]atrim=0:${aTot},asetpts=PTS-STARTPTS[aout]`,
      '-map', '[outv]',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      '-movflags', 'frag_keyframe+empty_moov', // để stream về client dễ hơn
      'pipe:1' // xuất thẳng ra stdout
    ];

    // Dùng ffmpeg trực tiếp với fluent-ffmpeg + addOptions xuất ra pipe
    const command = ffmpeg()
      .addInput(video1)
      .addInput(video2)
      .addInput(audio)
      .outputOptions(args.slice(args.indexOf('-filter_complex'))) // từ -filter_complex trở đi
      .format('mp4');

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'inline; filename="merged.mp4"');

    const stream = command.pipe();
    stream.on('error', (e) => {
      // nếu lỗi khi pipe, gửi JSON lỗi
      if (!res.headersSent) {
        res.status(500).json({ error: 'FFmpeg stream error', detail: String(e) });
      }
    });

    // Khi client đóng sớm, dừng ffmpeg
    req.on('close', () => {
      try { command.kill('SIGKILL'); } catch (e) {}
    });

  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server error', detail: String(err) });
    }
  }
});

// Render/Railway sẽ cấp PORT qua env
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FFmpeg API running on port ${PORT}`);
});
