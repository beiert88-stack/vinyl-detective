import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 6, fileSize: 15 * 1024 * 1024 }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-5.6-luna";
const DISCOGS_BASE = "https://api.discogs.com";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    artist: {type:"string"},
    album: {type:"string"},
    catalog_number: {type:"string"},
    barcode: {type:"string"},
    label: {type:"string"},
    format: {type:"string"},
    color_variant: {type:"string"},
    country: {type:"string"},
    year: {type:"string"},
    matrix_runout: {type:"string"},
    edition_notes: {type:"string"},
    observed_text: {type:"array",items:{type:"string"}},
    visual_evidence: {type:"array",items:{type:"string"}},
    uncertainties: {type:"array",items:{type:"string"}}
  },
  required:["artist","album","catalog_number","barcode","label","format","color_variant","country","year","matrix_runout","edition_notes","observed_text","visual_evidence","uncertainties"]
};

const emptyFields = () => ({
  artist:"",album:"",catalog_number:"",barcode:"",label:"",format:"",
  color_variant:"",country:"",year:"",matrix_runout:"",edition_notes:"",
  observed_text:[],visual_evidence:[],uncertainties:[]
});

function clean(s){ return String(s||"").trim(); }
function norm(s){ return clean(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,""); }
function contains(a,b){ return !!a && !!b && (norm(a).includes(norm(b)) || norm(b).includes(norm(a))); }

async function openaiVision(files){
  if(!process.env.OPENAI_API_KEY) return null;
  const content = [{
    type:"input_text",
    text:`You are a forensic vinyl record identifier. Inspect every supplied photo.
Extract ONLY information visibly supported by the photos. Never invent unreadable characters.
Pay special attention to catalog numbers, barcodes, labels, vinyl color/finish, format, country/year,
edition/limited wording, and especially matrix/runout. Return structured JSON only.
If something is not visible, use an empty string.`
  }];
  for(const f of files){
    const mime = f.mimetype || "image/jpeg";
    content.push({type:"input_image", image_url:`data:${mime};base64,${f.buffer.toString("base64")}`, detail:"high"});
  }
  const body = {
    model: VISION_MODEL,
    input:[{role:"user",content}],
    text:{format:{type:"json_schema",name:"vinyl_observation",schema,strict:true}}
  };
  const r = await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  if(!r.ok) throw new Error(`OpenAI vision ${r.status}: ${await r.text()}`);
  const j=await r.json();
  return JSON.parse(j.output_text);
}

function demoObservation(){
  return {
    artist:"NOFX", album:"Clay Pigeon", catalog_number:"",
    barcode:"", label:"TPRM ODs", format:'10"', color_variant:"Clear / transparent",
    country:"USA", year:"2026", matrix_runout:"", edition_notes:"",
    observed_text:["NOFX","Clay Pigeon"], visual_evidence:["Transparent vinyl is visible"],
    uncertainties:["Exact catalog number and matrix/runout are not visible in the demo payload."]
  };
}

async function discogs(pathname, params={}){
  if(!process.env.DISCOGS_TOKEN) return null;
  const url=new URL(DISCOGS_BASE+pathname);
  Object.entries(params).forEach(([k,v])=>{if(v)url.searchParams.set(k,v)});
  const r=await fetch(url,{
    headers:{
      "Authorization":`Discogs token=${process.env.DISCOGS_TOKEN}`,
      "User-Agent":process.env.DISCOGS_USER_AGENT || "VinylDetective/1.0"
    }
  });
  if(!r.ok) throw new Error(`Discogs ${r.status}: ${await r.text()}`);
  return r.json();
}

function candidateScore(obs, rel){
  let score=0, max=0;
  const add=(weight,ok)=>{max+=weight;if(ok)score+=weight};
  add(30, contains(obs.catalog_number, rel.catno));
  add(25, obs.barcode && Array.isArray(rel.barcode) && rel.barcode.some(x=>contains(obs.barcode,x)));
  add(15, contains(obs.artist, rel.artist));
  add(12, contains(obs.album, rel.title));
  add(8, contains(obs.label, rel.label));
  add(5, obs.year && String(rel.year||"")===String(obs.year));
  const fmt=Array.isArray(rel.format)?rel.format.join(" "):rel.format||"";
  add(5, contains(obs.format,fmt));
  return Math.round((score/Math.max(max,1))*100);
}

async function getCandidates(obs){
  if(!process.env.DISCOGS_TOKEN) return [];
  const queries=[];
  if(obs.catalog_number) queries.push({catno:obs.catalog_number,type:"release"});
  if(obs.barcode) queries.push({barcode:obs.barcode,type:"release"});
  if(obs.artist && obs.album) queries.push({artist:obs.artist,release_title:obs.album,type:"release"});
  else if(obs.album) queries.push({release_title:obs.album,type:"release"});
  if(!queries.length) return [];
  const seen=new Set(), out=[];
  for(const q of queries.slice(0,4)){
    const s=await discogs("/database/search",q);
    for(const x of (s?.results||[]).slice(0,12)){
      if(seen.has(x.id)) continue; seen.add(x.id);
      try{
        const r=await discogs(`/releases/${x.id}`);
        const label=(r.labels||[]).map(l=>l.name).join(", ");
        const rel={...r,artist:(r.artists||[]).map(a=>a.name).join(", "),label,format:(r.formats||[]).flatMap(f=>[f.name,f.descriptions?.join(" ")]).filter(Boolean).join(" ")};
        out.push({...rel,score:candidateScore(obs,rel)});
      }catch{}
    }
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,5);
}

function pressingQuantity(release){
  // Conservative: only explicit notes such as "limited to 500 copies" or
  // numbered edition evidence are accepted. This is intentionally not inferred
  // from community collection counts.
  const text=(release.notes||[]).join(" ")+" "+(release.data_quality||"");
  const m=text.match(/(?:limited to|limited edition of|press(?:ed|ing)?)\s*(\d{2,7})\s*(?:copies|units|records)?/i);
  if(m) return {value:Number(m[1]),source:"Discogs release notes"};
  return {value:null,source:null};
}

function buildResult(obs,candidates){
  const top=candidates[0];
  if(!top) return {
    ...obs, pressing:"Nicht eindeutig identifiziert", confidence:0,
    copies:null,copies_source:null,discogs:null,candidates:[],
    evidence:obs.visual_evidence||[],needs:["Weitere Fotos von Label und Matrix/Runout"]
  };
  const qty=pressingQuantity(top);
  const verified={
    artist:top.artist,album:top.title,label:top.label,
    catno:top.catno||obs.catalog_number,year:top.year||obs.year,
    country:top.country||obs.country,format:top.format||obs.format,
    variant:obs.color_variant||"",pressing:`Release #${top.id}`
  };
  return {
    ...verified, confidence:top.score/100, copies:qty.value,copies_source:qty.source,
    discogs:{id:top.id,url:top.uri||`https://www.discogs.com/release/${top.id}`,title:top.title},
    candidates:candidates.map(x=>({id:x.id,title:x.title,artist:x.artist,catno:x.catno,year:x.year,country:x.country,score:x.score,url:x.uri||`https://www.discogs.com/release/${x.id}`})),
    evidence:[...(obs.visual_evidence||[]),`Discogs-Kandidat #${top.id} erreicht ${top.score}% Merkmalsübereinstimmung.`],
    needs:top.score<85?["Label A/B oder Matrix/Runout für höhere Sicherheit"]:[],
    raw_observation:obs
  };
}

app.post("/api/analyze", upload.array("photos",6), async(req,res)=>{
  try{
    if(!req.files?.length) return res.status(400).json({error:"Kein Foto erhalten."});
    let obs;
    if(process.env.OPENAI_API_KEY) obs=await openaiVision(req.files);
    else obs=demoObservation();
    const candidates=await getCandidates(obs);
    res.json({...buildResult(obs,candidates),demo:!process.env.OPENAI_API_KEY,discogs_enabled:!!process.env.DISCOGS_TOKEN});
  }catch(e){
    console.error(e);
    res.status(500).json({error:e.message});
  }
});

app.post("/api/hashtags", async(req,res)=>{
  try{
    const d=req.body||{};
    if(!process.env.OPENAI_API_KEY){
      return res.json({hashtags:["#vinyl","#vinylcollector","#vinylcommunity","#recordcollector","#punkrockvinyl"],source:"fallback"});
    }
    const prompt=`Research current Instagram hashtag/topic signals for a vinyl collector post.
Artist: ${d.artist||""}; Album: ${d.album||""}; Label: ${d.label||""}; Genre/context: ${d.genre||""}.
Return 10-15 relevant hashtags, mixing specific artist/album/label/genre/community tags.
Avoid spammy or unrelated tags. Do not claim exact popularity numbers unless verified.
Return one space-separated line of hashtags.`;
    const body={model:VISION_MODEL,tools:[{type:"web_search"}],input:prompt};
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
    if(!r.ok) throw new Error(`OpenAI hashtag ${r.status}: ${await r.text()}`);
    const j=await r.json();
    const tags=(j.output_text.match(/#[A-Za-z0-9_]+/g)||[]).slice(0,15);
    res.json({hashtags:[...new Set(tags)],source:"web-researched"});
  }catch(e){res.json({hashtags:["#vinyl","#vinylcollector","#vinylcommunity","#recordcollector","#punkrockvinyl"],source:"fallback"});}
});

app.get("/health",(req,res)=>res.json({ok:true,openai:!!process.env.OPENAI_API_KEY,discogs:!!process.env.DISCOGS_TOKEN}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(process.env.PORT||3000,()=>console.log(`Vinyl Detective on :${process.env.PORT||3000}`));
