import { useEffect, useState } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io("http://localhost:8000");

function App() {
  const [url, setUrl] = useState("");
  const [formats, setFormats] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [speed, setSpeed] = useState("");
  const [downloaded, setDownloaded] = useState("");
  const [totalSize, setTotalSize] = useState("");
  const [loadingFormats, setLoadingFormats] = useState(false);
  const [statusText, setStatusText] = useState("");

  const BASE_URL = "http://localhost:8000";

  const convertToRealUnits = (str) => {
    const match = str?.match(/([\d.]+)\s*(KiB|MiB|GiB|B)/);
    if (!match) return str;
    let [_, val, unit] = match;
    val = parseFloat(val);
    switch (unit) {
      case "KiB":
        return (val / 1024).toFixed(2) + " MB";
      case "MiB":
        return (val * 1.048576).toFixed(2) + " MB";
      case "GiB":
        return (val * 1024 * 1.048576).toFixed(2) + " MB";
      case "B":
        return (val / (1024 * 1024)).toFixed(2) + " MB";
      default:
        return val + " MB";
    }
  };

  useEffect(() => {
    socket.on("progress", (data) => {
      setProgress(data.percent);
      setSpeed(convertToRealUnits(data.speed));
      setDownloaded(convertToRealUnits(data.downloaded));
      setTotalSize(convertToRealUnits(data.size));
      setStatusText("⬇️ Downloading...");
    });

    socket.on("complete", ({ filename }) => {
      setFileUrl(`${BASE_URL}/download/${filename}`);
      setDownloading(false);
      setStatusText("✅ Download complete!");
    });

    socket.on("formats", (formatList) => {
      const videos = {};
      let bestAudio = null;

      formatList.forEach((f) => {
        const isAudio = f.vcodec === "none";
        const isVideoMp4 = f.ext === "mp4" && f.vcodec !== "none";

        if (isAudio) {
          if (!bestAudio || parseInt(f.abr || 0) > parseInt(bestAudio.abr || 0)) {
            bestAudio = f;
          }
        }

        if (isVideoMp4 && f.height) {
          const key = `${f.height}p`;
          if (!videos[key]) videos[key] = f;
        }
      });

      const filtered = [...Object.values(videos), ...(bestAudio ? [bestAudio] : [])];

      setFormats(filtered);
      setSelectedFormat(filtered[0]?.format_id || "");
      setLoadingFormats(false);
      setStatusText("🎬 Select format and start download");
    });

    socket.on("status", (text) => {
      setStatusText(text);
    });

    return () => {
      socket.off("progress");
      socket.off("complete");
      socket.off("formats");
      socket.off("status");
    };
  }, []);

  const fetchFormats = () => {
    if (!url) return alert("Please enter a YouTube URL");
    setLoadingFormats(true);
    setFormats([]);
    setStatusText("🔍 Fetching formats...");
    socket.emit("get-formats", url);
  };

  const startDownload = () => {
    if (!url || !selectedFormat) return alert("Missing input");
    setDownloading(true);
    setProgress(0);
    setSpeed("");
    setDownloaded("");
    setFileUrl("");
    setStatusText("⚙️ Initializing download...");
    socket.emit("start-download", {
      url,
      format_id: selectedFormat,
      type: selectedFormat.includes("audio") ? "audio" : "video",
    });
  };

  return (
    <div className="App">
      <h1>YouTube Downloader</h1>

      <input
        type="text"
        placeholder="Paste YouTube URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="input"
      />
      <button onClick={fetchFormats} className="btn primary">
        {loadingFormats ? "⏳ Loading..." : "🎥 Get Formats"}
      </button>

      {formats.length > 0 && (
        <div className="dropdown">
          <label>Select Format:</label>
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="input"
          >
            {formats.map((f, i) => (
              <option key={i} value={f.format_id}>
                {f.vcodec === "none"
                  ? `Audio (${f.acodec}, ${f.abr || "?"} kbps)`
                  : `${f.height}p - ${f.ext}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <button onClick={startDownload} className="btn secondary">
        ⬇️ Download Selected
      </button>

      {downloading && (
        <div className="progress-section">
          <progress value={progress} max="100" />
          <p className="status-text">
            {progress.toFixed(2)}% — {downloaded} / {totalSize} @ {speed}
          </p>
        </div>
      )}

      {statusText && <p className="status-text">{statusText}</p>}

      {fileUrl && (
        <div style={{ marginTop: "20px" }}>
          <a href={fileUrl} download className="btn success">
            ✅ Click here to download your file
          </a>
        </div>
      )}
    </div>
  );
}

export default App;
