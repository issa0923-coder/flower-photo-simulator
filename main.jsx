import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion } from "framer-motion";
import { Upload, Scissors, RotateCcw, Flower2, Wand2, Sparkles } from "lucide-react";
import "./styles.css";

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function colorDistance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function createSoftMask(data, size, targetColor, tolerance) {
  const mask = new Uint8ClampedArray(size * size);
  const centerX = Math.floor(size / 2);
  const centerY = Math.floor(size / 2);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const m = y * size + x;
      const currentColor = [data[i], data[i + 1], data[i + 2]];
      const dist = colorDistance(currentColor, targetColor);

      const dx = x - centerX;
      const dy = y - centerY;
      const radial = Math.sqrt(dx * dx + dy * dy);
      const edgeFadeStart = size * 0.4;
      const edgeFadeEnd = size * 0.5;

      let alpha = dist > tolerance ? 0 : 255;

      if (dist > tolerance * 0.72 && dist <= tolerance) {
        alpha = 255 * (1 - (dist - tolerance * 0.72) / (tolerance * 0.28));
      }

      if (radial > edgeFadeStart) {
        const fade = 1 - Math.min((radial - edgeFadeStart) / (edgeFadeEnd - edgeFadeStart), 1);
        alpha *= fade;
      }

      mask[m] = Math.max(0, Math.min(255, alpha));
    }
  }

  return mask;
}

function completeMissingParts(data, mask, size, completionStrength) {
  const output = new Uint8ClampedArray(data);
  const center = Math.floor(size / 2);
  const minAlpha = 18;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const m = y * size + x;
      if (mask[m] > minAlpha) continue;

      const mirrorX = center - (x - center);
      const mirrorY = center - (y - center);
      const candidates = [[mirrorX, y], [x, mirrorY], [mirrorX, mirrorY]];
      let best = null;
      let bestAlpha = 0;

      for (const [cx, cy] of candidates) {
        const sx = Math.round(cx);
        const sy = Math.round(cy);
        if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue;
        const sm = sy * size + sx;
        if (mask[sm] > bestAlpha) {
          bestAlpha = mask[sm];
          best = [sx, sy];
        }
      }

      if (!best || bestAlpha < 60) continue;
      const [sx, sy] = best;
      const si = (sy * size + sx) * 4;
      const blend = Math.min((bestAlpha / 255) * completionStrength, 1);

      output[i] = data[si];
      output[i + 1] = data[si + 1];
      output[i + 2] = data[si + 2];
      output[i + 3] = Math.round(210 * blend);
    }
  }

  return output;
}

function makeSmartCutout(img, clickX, clickY, size, tolerance, completionEnabled, completionStrength) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const displayW = img.clientWidth;
  const displayH = img.clientHeight;
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  if (!displayW || !displayH || !naturalW || !naturalH) return null;

  const scaleX = naturalW / displayW;
  const scaleY = naturalH / displayH;
  const sourceSizeX = size * scaleX;
  const sourceSizeY = size * scaleY;
  const sourceX = clickX * scaleX - sourceSizeX / 2;
  const sourceY = clickY * scaleY - sourceSizeY / 2;

  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(img, sourceX, sourceY, sourceSizeX, sourceSizeY, 0, 0, size, size);

  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, size, size);
  } catch (err) {
    console.error("Could not read image data", err);
    return null;
  }

  const data = imageData.data;
  const centerX = Math.floor(size / 2);
  const centerY = Math.floor(size / 2);
  const centerIndex = (centerY * size + centerX) * 4;
  const targetColor = [data[centerIndex], data[centerIndex + 1], data[centerIndex + 2]];

  const mask = createSoftMask(data, size, targetColor, tolerance);
  const completed = completionEnabled ? completeMissingParts(data, mask, size, completionStrength) : new Uint8ClampedArray(data);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const m = y * size + x;
      data[i] = completed[i];
      data[i + 1] = completed[i + 1];
      data[i + 2] = completed[i + 2];
      data[i + 3] = Math.max(mask[m], completionEnabled ? completed[i + 3] : 0);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const finalCanvas = document.createElement("canvas");
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) return canvas.toDataURL("image/png");
  finalCanvas.width = size;
  finalCanvas.height = size;
  finalCtx.filter = "blur(0.35px)";
  finalCtx.drawImage(canvas, 0, 0);
  return finalCanvas.toDataURL("image/png");
}

function Button({ children, active, onClick }) {
  return (
    <button className={active ? "button active" : "button"} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function FlowerPhotoEditor() {
  const [imageUrl, setImageUrl] = useState(null);
  const [cutouts, setCutouts] = useState([]);
  const [cutMode, setCutMode] = useState(true);
  const [smartCut, setSmartCut] = useState(true);
  const [completionEnabled, setCompletionEnabled] = useState(true);
  const [cutSize, setCutSize] = useState(140);
  const [tolerance, setTolerance] = useState(72);
  const [completionStrength, setCompletionStrength] = useState(0.75);
  const [status, setStatus] = useState("Upload a bouquet photo to start.");
  const imageRef = useRef(null);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Loading image...");
    setCutouts([]);
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(String(reader.result));
      setStatus("Image loaded. Click the center of a flower to create a cutout.");
    };
    reader.onerror = () => setStatus("Could not load the image. Please try another photo.");
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleImageClick = (e) => {
    if (!cutMode || !imageUrl || !imageRef.current) return;
    const img = imageRef.current;
    if (!img.complete || img.naturalWidth === 0) {
      setStatus("The image is still loading. Please try again in a moment.");
      return;
    }

    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cutoutUrl = smartCut ? makeSmartCutout(img, x, y, cutSize, tolerance, completionEnabled, completionStrength) : null;
    const newCutout = {
      id: makeId(),
      imageUrl,
      cutoutUrl,
      sourceX: x,
      sourceY: y,
      displayWidth: img.clientWidth,
      displayHeight: img.clientHeight,
      size: cutSize,
      x: x - cutSize / 2,
      y: y - cutSize / 2,
      rotation: Math.random() * 8 - 4,
    };

    setCutouts((prev) => [...prev, newCutout]);
    setStatus(completionEnabled ? "Smart cutout created with approximate fill. Drag it to rearrange." : "Smart cutout created. Drag it to rearrange.");
  };

  const removeLast = () => {
    setCutouts((prev) => prev.slice(0, -1));
    setStatus("Removed the last cutout.");
  };

  const resetAll = () => {
    setCutouts([]);
    setStatus(imageUrl ? "All cutouts have been reset." : "Upload a bouquet photo to start.");
  };

  return (
    <div className="app">
      <main className="layout">
        <section className="panel">
          <div className="title-row"><Flower2 size={22} /><h1>Flower Photo Simulator</h1></div>
          <p className="description">Upload a bouquet photo, click a flower, create a movable cutout, and test new arrangements before touching the real flowers.</p>

          <label className="upload-box">
            <input type="file" accept="image/*" onChange={handleUpload} />
            <Upload size={28} />
            <strong>Upload bouquet photo</strong>
            <span>JPG / PNG recommended. HEIC may not work in some browsers.</span>
          </label>

          <div className="status">{status}</div>

          <div className="button-grid three">
            <Button active={cutMode} onClick={() => setCutMode((v) => !v)}><Scissors size={16} /> {cutMode ? "Cut" : "Move"}</Button>
            <Button active={smartCut} onClick={() => setSmartCut((v) => !v)}><Wand2 size={16} /> Smart</Button>
            <Button active={completionEnabled} onClick={() => setCompletionEnabled((v) => !v)}><Sparkles size={16} /> Fill</Button>
          </div>

          <div className="control"><div><strong>Cutout size</strong><span>{cutSize}px</span></div><input type="range" min="60" max="260" value={cutSize} onChange={(e) => setCutSize(Number(e.target.value))} /></div>
          <div className="control"><div><strong>Color tolerance</strong><span>{tolerance}</span></div><input type="range" min="25" max="170" value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} /><small>Lower = stricter cutout. Higher = includes more surrounding pixels.</small></div>
          <div className="control"><div><strong>Fill strength</strong><span>{Math.round(completionStrength * 100)}%</span></div><input type="range" min="0" max="1" step="0.05" value={completionStrength} onChange={(e) => setCompletionStrength(Number(e.target.value))} /><small>This approximates missing petals by mirroring nearby flower texture.</small></div>

          <div className="button-grid two">
            <Button onClick={removeLast}>Undo</Button>
            <Button onClick={resetAll}><RotateCcw size={16} /> Reset</Button>
          </div>
        </section>

        <section className="canvas-panel">
          <div className="hint">{cutMode ? "Click a flower center" : "Drag cutouts"}</div>
          {!imageUrl && <div className="empty"><Flower2 size={44} /><p>Upload a bouquet photo to start</p></div>}
          {imageUrl && (
            <div className="image-wrap">
              <img ref={imageRef} src={imageUrl} alt="Uploaded bouquet" onLoad={() => setStatus("Image displayed. Click the center of a flower.")} onError={() => setStatus("Could not display the image. Please try JPG or PNG.")} onClick={handleImageClick} className={cutMode ? "source-image crosshair" : "source-image"} draggable={false} />
              {cutouts.map((item) => (
                <motion.div key={item.id} drag dragMomentum={false} initial={{ x: item.x, y: item.y, rotate: item.rotation, scale: 1 }} whileTap={{ scale: 1.06 }} className="cutout" style={{ width: item.size, height: item.size }}>
                  {item.cutoutUrl ? <img src={item.cutoutUrl} alt="Smart flower cutout" draggable={false} /> : <div className="round-cutout" style={{ backgroundImage: `url(${item.imageUrl})`, backgroundSize: `${item.displayWidth}px ${item.displayHeight}px`, backgroundPosition: `-${item.sourceX - item.size / 2}px -${item.sourceY - item.size / 2}px` }} />}
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<FlowerPhotoEditor />);
