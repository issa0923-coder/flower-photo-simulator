
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion } from "framer-motion";
import { Flower2, Plus, RotateCcw, Trash2, Upload, Image as ImageIcon, Layers } from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "virtual-flower-arranger-assets-v1";

const STARTER_ASSETS = [
  { id:"starter-red-rose", name:"Red Rose", category:"flower", emoji:"🌹", width:110, height:330 },
  { id:"starter-delphinium", name:"Delphinium", category:"flower", emoji:"💜", width:120, height:390 },
  { id:"starter-viburnum", name:"Green Viburnum", category:"flower", emoji:"🌼", width:150, height:280 },
  { id:"starter-leaf", name:"Green Leaf", category:"leaf", emoji:"🌿", width:150, height:240 },
  { id:"starter-clear-vase", name:"Clear Tall Vase", category:"vase", emoji:"", vaseKind:"tall" },
  { id:"starter-round-vase", name:"Round Glass Vase", category:"vase", emoji:"", vaseKind:"round" },
  { id:"starter-ceramic-vase", name:"White Ceramic Vase", category:"vase", emoji:"", vaseKind:"ceramic" }
];

function makeId(){
  if(typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadSavedAssets(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }catch{
    return [];
  }
}

function readFileAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function scoreArrangement(items){
  if(items.length===0) return {score:0,text:"Add a flower or leaf to start arranging."};
  const flowerCount = items.filter(i=>i.category==="flower").length;
  const leafCount = items.filter(i=>i.category==="leaf").length;
  const xs = items.map(i=>i.x);
  const spread = Math.max(...xs)-Math.min(...xs);
  let score = 35 + Math.min(spread/5,25) + Math.min(items.length*5,25);
  if(flowerCount>0) score += 8;
  if(leafCount>0) score += 7;
  score = Math.round(Math.min(score,100));
  let text = "Nice start. Try adjusting angle, size, and front/back layers.";
  if(score>=80) text = "Great balance. The design has variety, spread, and supporting greenery.";
  else if(score>=60) text = "Good structure. Add greenery or change front/back layers for more depth.";
  return {score,text};
}

function BuiltInVase({kind}){
  if(kind==="round") return <svg className="svg-vase" width="240" height="230" viewBox="0 0 250 230"><ellipse cx="125" cy="38" rx="70" ry="18" fill="#fff" stroke="#bfdbfe" strokeWidth="5" opacity=".9"/><path d="M58 42 C52 88 35 160 82 197 C105 215 145 215 168 197 C215 160 198 88 192 42 Z" fill="#e0f2fe" opacity=".45" stroke="#bfdbfe" strokeWidth="5"/><path d="M88 62 C75 105 75 160 98 192" stroke="#fff" strokeWidth="7" opacity=".8"/></svg>;
  if(kind==="ceramic") return <svg className="svg-vase" width="220" height="280" viewBox="0 0 220 280"><ellipse cx="110" cy="44" rx="54" ry="15" fill="#f8fafc" stroke="#d6d3d1" strokeWidth="5"/><path d="M65 48 C70 92 48 125 48 188 C48 238 75 265 110 265 C145 265 172 238 172 188 C172 125 150 92 155 48 Z" fill="#f8fafc" stroke="#d6d3d1" strokeWidth="5"/><path d="M78 80 C64 150 67 218 100 248" stroke="#fff" strokeWidth="9" opacity=".9"/></svg>;
  return <svg className="svg-vase" width="210" height="300" viewBox="0 0 210 300"><ellipse cx="105" cy="42" rx="50" ry="15" fill="#fff" stroke="#bfdbfe" strokeWidth="5" opacity=".9"/><path d="M58 45 L75 260 C77 280 91 290 105 290 C119 290 133 280 135 260 L152 45 Z" fill="#e0f2fe" opacity=".45" stroke="#bfdbfe" strokeWidth="5"/><path d="M79 70 L91 255" stroke="#fff" strokeWidth="7" opacity=".72"/></svg>;
}

function AssetThumb({asset}){
  if(asset.image) return <img src={asset.image} alt={asset.name}/>;
  if(asset.category==="vase") return <div className="fallback"><BuiltInVase kind={asset.vaseKind}/></div>;
  return <div className="fallback">{asset.emoji || "🌿"}</div>;
}

function App(){
  const [customAssets,setCustomAssets] = useState(()=>loadSavedAssets());
  const assets = useMemo(()=>[...STARTER_ASSETS,...customAssets],[customAssets]);
  const [tab,setTab] = useState("flower");
  const shownAssets = assets.filter(a=>a.category===tab);
  const [selectedAssetId,setSelectedAssetId] = useState("starter-red-rose");
  const selectedAsset = assets.find(a=>a.id===selectedAssetId) || shownAssets[0] || assets[0];
  const [placed,setPlaced] = useState([]);
  const [selectedPlacedId,setSelectedPlacedId] = useState(null);
  const selectedPlaced = placed.find(p=>p.uid===selectedPlacedId);
  const [activeVase,setActiveVase] = useState(STARTER_ASSETS.find(a=>a.category==="vase"));
  const feedback = useMemo(()=>scoreArrangement(placed),[placed]);

  const [newName,setNewName] = useState("");
  const [newCategory,setNewCategory] = useState("flower");
  const [newImage,setNewImage] = useState(null);
  const [newPreview,setNewPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(()=>{
    localStorage.setItem(STORAGE_KEY,JSON.stringify(customAssets));
  },[customAssets]);

  useEffect(()=>{
    if(!shownAssets.some(a=>a.id===selectedAssetId) && shownAssets[0]) setSelectedAssetId(shownAssets[0].id);
  },[tab]);

  const handlePickImage = async(e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setNewImage(dataUrl);
    setNewPreview(dataUrl);
    if(!newName) setNewName(file.name.replace(/\.[^/.]+$/," ").replace(/[-_]/g," ").trim());
    e.target.value="";
  };

  const addCustomAsset = ()=>{
    if(!newName.trim()) return alert("Please enter a name.");
    if(!newImage && newCategory!=="vase") return alert("Please upload a PNG/JPG image.");
    const asset={
      id: makeId(),
      name: newName.trim(),
      category: newCategory,
      image: newImage,
      width: newCategory==="leaf"?150:newCategory==="vase"?220:130,
      height: newCategory==="leaf"?230:newCategory==="vase"?240:330,
      custom:true
    };
    setCustomAssets(prev=>[...prev,asset]);
    setNewName(""); setNewImage(null); setNewPreview(null); setTab(newCategory); setSelectedAssetId(asset.id);
    if(newCategory==="vase") setActiveVase(asset);
  };

  const deleteCustomAsset = (id)=>{
    setCustomAssets(prev=>prev.filter(a=>a.id!==id));
    setPlaced(prev=>prev.filter(p=>p.assetId!==id));
    if(selectedAssetId===id) setSelectedAssetId(STARTER_ASSETS[0].id);
  };

  const addToCanvas = ()=>{
    if(!selectedAsset) return;
    if(selectedAsset.category==="vase") { setActiveVase(selectedAsset); return; }
    const item={...selectedAsset, assetId:selectedAsset.id, uid:makeId(), x:310+Math.random()*80-40, y:220+Math.random()*60-30, rotate:Math.random()*20-10, layer:placed.length+10, scale:1};
    setPlaced(prev=>[...prev,item]);
    setSelectedPlacedId(item.uid);
  };

  const updateSelected = (fn)=> selectedPlacedId && setPlaced(prev=>prev.map(p=>p.uid===selectedPlacedId?fn(p):p));
  const rotate=(n)=>updateSelected(p=>({...p,rotate:p.rotate+n}));
  const resize=(n)=>updateSelected(p=>({...p,scale:Math.max(.35,Math.min(2.2,(p.scale||1)+n))}));
  const forward=()=>{const max=Math.max(0,...placed.map(p=>p.layer||0));updateSelected(p=>({...p,layer:max+1}));};
  const backward=()=>{const min=Math.min(0,...placed.map(p=>p.layer||0));updateSelected(p=>({...p,layer:min-1}));};
  const deleteSelected=()=>{setPlaced(prev=>prev.filter(p=>p.uid!==selectedPlacedId));setSelectedPlacedId(null);};

  return <div className="app"><main className="layout">
    <section className="panel">
      <div><div className="title"><Flower2 size={22}/><h1>Virtual Flower Arranger</h1></div><p className="desc">Upload your own flower, leaf, or vase PNGs. They will appear in the left menu and stay saved in this browser.</p></div>

      <div><p className="section-title">Library</p><div className="tabs">
        {["flower","leaf","vase"].map(t=><button key={t} className={tab===t?"tab active":"tab"} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}
      </div></div>

      <div className="grid">
        {shownAssets.map(asset=><button key={asset.id} className={selectedAssetId===asset.id?"asset-card active":"asset-card"} onClick={()=>setSelectedAssetId(asset.id)}>
          {asset.custom && <span className="tiny-delete" onClick={(e)=>{e.stopPropagation();deleteCustomAsset(asset.id);}}>×</span>}
          <AssetThumb asset={asset}/><strong>{asset.name}</strong><span>{asset.custom?"Custom":"Starter"}</span>
        </button>)}
      </div>

      <button className="btn primary" onClick={addToCanvas}><Plus size={16}/>{selectedAsset?.category==="vase"?"Use selected vase":"Add selected material"}</button>

      <div className="uploader"><p className="section-title">Add new material</p>
        <div className="row"><div className="field"><label>Name</label><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. White Rose"/></div><div className="field"><label>Type</label><select value={newCategory} onChange={e=>setNewCategory(e.target.value)}><option value="flower">Flower</option><option value="leaf">Leaf</option><option value="vase">Vase</option></select></div></div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePickImage} style={{display:"none"}}/>
        <button className="btn" onClick={()=>fileInputRef.current?.click()}><Upload size={16}/>Upload PNG/JPG</button>
        <div className="preview">{newPreview?<img src={newPreview} alt="preview"/>:<span className="small"><ImageIcon size={16}/> Transparent PNG is best</span>}</div>
        <button className="btn primary" onClick={addCustomAsset}>Save to library</button>
        <p className="small">Note: saved images use your browser's localStorage. If you open this on another device, upload them again.</p>
      </div>

      <div><p className="section-title">Selected item controls</p><div className="controls">
        <button className="btn" disabled={!selectedPlaced} onClick={()=>rotate(-10)}>Rotate left</button><button className="btn" disabled={!selectedPlaced} onClick={()=>rotate(10)}>Rotate right</button>
        <button className="btn" disabled={!selectedPlaced} onClick={()=>resize(-.1)}>Smaller</button><button className="btn" disabled={!selectedPlaced} onClick={()=>resize(.1)}>Larger</button>
        <button className="btn" disabled={!selectedPlaced} onClick={forward}><Layers size={16}/>Forward</button><button className="btn" disabled={!selectedPlaced} onClick={backward}>Backward</button>
        <button className="btn" disabled={!selectedPlaced} onClick={deleteSelected}><Trash2 size={16}/>Delete</button><button className="btn" onClick={()=>{setPlaced([]);setSelectedPlacedId(null)}}><RotateCcw size={16}/>Clear</button>
      </div></div>

      <div className="score"><div><Sparkles size={16}/> Arrangement feedback</div><strong>{feedback.score}/100</strong><p>{feedback.text}</p></div>
    </section>

    <section className="canvas">
      <div className="hint">Drag materials. Click an item to edit it.</div><div className="table"/>
      {placed.map(item=>{
        const selected=item.uid===selectedPlacedId;
        const w=(item.width||130)*(item.scale||1), h=(item.height||330)*(item.scale||1);
        return <motion.div key={item.uid} drag dragMomentum={false} initial={{x:item.x,y:item.y,rotate:item.rotate}} animate={{rotate:item.rotate}} onMouseDown={()=>setSelectedPlacedId(item.uid)} onTouchStart={()=>setSelectedPlacedId(item.uid)} className={selected?"placed selected":"placed"} style={{width:w,height:h,zIndex:item.layer||1}}>
          {item.image?<img src={item.image} alt={item.name}/>:<div className="placeholder">{item.emoji||"🌿"}</div>}
        </motion.div>
      })}
      <div className="vase-area">{activeVase?.image?<img src={activeVase.image} alt={activeVase.name}/>:<BuiltInVase kind={activeVase?.vaseKind||"tall"}/>}</div>
    </section>
  </main></div>;
}

createRoot(document.getElementById("root")).render(<App/>);
