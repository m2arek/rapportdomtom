const clamp = (v,min,max)=>Math.min(Math.max(v,min),max);
const fmt = (n,digits=0)=> new Intl.NumberFormat('fr-FR',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(n);

async function getProductible(lat, lon, orientationDeg){
  const angle = 28; // Inclinaison
  const url =
    `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?outputformat=basic` +
    `&lat=${lat}&lon=${lon}` +
    `&raddatabase=PVGIS-SARAH2&peakpower=1&loss=10&pvtechchoice=crystSi` +
    `&angle=${angle}&aspect=${orientationDeg}&usehorizon=1`;

  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent('url')}=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, { headers: { 'Accept': 'text/plain' } });
  if (!res.ok) throw new Error("Erreur API PVGIS");

  const text = await res.text();
  let productible = null;

  const lines = text.split(/\r?\n/);
  for (const raw of lines){
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^Year\b/i.test(line)){
      const m = line.match(/^Year\b[^0-9\-+]*([\-+]?\d+(\.\d+)?)/i);
      if (m) productible = parseFloat(m[1]);
      break;
    }
  }
  if (!isFinite(productible)) throw new Error("Productible non trouvé");
  return { productible, angle, aspect: orientationDeg };
}

// --- UI ---
const $ = sel => document.querySelector(sel);
const form = $('#form');
const btn = $('#btn');
const statusEl = $('#status');
const result = $('#result');
const kpi = $('#kpi');
const meta = $('#meta');
const coords = $('#coords');
const tilt = $('#tilt');
const az = $('#az');

// Préremplissage (ex. Fort-de-France)
$('#lat').value = 14.6108;
$('#lon').value = -61.0689;

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  result.hidden = true;

  const lat = clamp(parseFloat($('#lat').value), -90, 90);
  const lon = clamp(parseFloat($('#lon').value), -180, 180);
  const orientation = parseFloat($('#orientation').value);

  if (!isFinite(lat) || !isFinite(lon)) {
    statusEl.textContent = "Latitude/longitude invalides.";
    statusEl.className = "muted small err";
    return;
  }

  btn.disabled = true;
  statusEl.textContent = "Calcul en cours…";
  statusEl.className = "muted small";

  try{
    const t0 = performance.now();
    const { productible, angle, aspect } = await getProductible(lat, lon, orientation);
    const dt = performance.now() - t0;

    kpi.textContent = `${fmt(productible, 1)} kWh/kWp/an`;
    meta.innerHTML = `<span class="ok">Succès</span> • ${fmt(dt,0)} ms`;
    coords.textContent = `Lat/Lon: ${fmt(lat,4)} / ${fmt(lon,4)}`;
    tilt.textContent = `Inclinaison: ${angle}°`;
    az.textContent = `Orientation: ${aspect}°`;
    result.hidden = false;

    statusEl.textContent = "Terminé.";
    statusEl.className = "muted small";
  }catch(err){
    console.error(err);
    statusEl.textContent = `Erreur: ${err.message}`;
    statusEl.className = "muted small err";
  }finally{
    btn.disabled = false;
  }
});
