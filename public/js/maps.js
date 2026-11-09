// Live OpenStreetMap maps, recoloured per era with CSS (sepia ink for the journal, glossy for the Mac atlas).
import { catColor, esc } from './util.js';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

// The map library is only fetched the first time a map is shown, so pages without a map
// (most of them) don't download it at all.
let leaflet = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  leaflet ||= new Promise((resolve, reject) => {
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/vendor/leaflet/leaflet.css' });
    const js = Object.assign(document.createElement('script'), { src: '/vendor/leaflet/leaflet.js', async: true });
    // Its styles arrive before the first map is drawn, so the map never shows half-built.
    const styled = new Promise((done) => (css.onload = css.onerror = done));
    js.onload = () => styled.then(() => (window.L ? resolve(window.L) : reject(new Error('no map library'))));
    js.onerror = () => {
      leaflet = null;
      css.remove();
      reject(new Error('the map library did not load'));
    };
    document.head.append(css, js);
  });
  return leaflet;
}

function whenAttached(el, fn) {
  let tries = 0;
  const tick = () => {
    if (el.isConnected && el.clientWidth > 0) return fn();
    if (++tries < 300) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function pinIcon(style, color, label = '') {
  // The travel board: a glossy pushpin in the place's colour, with a little handwritten tag.
  if (style === 'board') {
    return L.divIcon({
      className: 'pin-board',
      html: `<span class="bpin" style="--c:${color}"><i></i></span>${label ? `<span class="btag">${esc(label)}</span>` : ''}`,
      iconSize: [24, 34],
      iconAnchor: [9, 31],
      popupAnchor: [2, -28]
    });
  }
  if (style === 'journal') {
    return L.divIcon({
      className: 'pin-journal',
      html: '<svg width="26" height="34" viewBox="0 0 26 34"><ellipse cx="13" cy="32" rx="7" ry="2" fill="rgba(0,0,0,.25)"/><path d="M13 31s11-10.5 11-17.5a11 11 0 0 0-22 0C2 20.5 13 31 13 31z" fill="#c8361f" stroke="#7a1b0d" stroke-width="1.2"/><circle cx="13" cy="13.5" r="4" fill="#fffaf0"/></svg>',
      iconSize: [26, 34],
      iconAnchor: [13, 32],
      popupAnchor: [0, -28]
    });
  }
  return L.divIcon({
    className: 'pin-mac',
    html: `<span class="pushpin" style="--c:${color}"></span>`,
    iconSize: [22, 30],
    iconAnchor: [11, 29],
    popupAnchor: [0, -26]
  });
}

// places: [{lat, lon, title, category, href}]; focus: which of them to open the map on, with
// its label showing (-1 for none).
export function mountMap(el, opts = {}) {
  // strings: lists of [lat, lon] joined by a thread (a trip); card: the popup's HTML for a place.
  // heat: instead of pins, a warm circle where you've been, bigger and hotter the more often
  // (each place counts once, or `count` times).
  const { places = [], style = 'mac', interactive = true, zoom = 15, focus = -1, strings = [], card = null, tags = false, heat = false } = opts;
  el.classList.add('map', 'map-' + style);
  if (!window.L) {
    const wait = Object.assign(document.createElement('div'), { className: 'map-fallback', textContent: 'Unfolding the map…' });
    el.append(wait);
    loadLeaflet().then(
      () => {
        wait.remove();
        mountMap(el, opts);
      },
      () => (wait.textContent = 'The map could not load.')
    );
    return;
  }
  whenAttached(el, () => {
    const pts = places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    const map = L.map(el, {
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: false,
      keyboard: interactive,
      attributionControl: true,
      worldCopyJump: true,
      // (Pieces kept from before show at once, without fading in.)
      fadeAnimation: false
    });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION, crossOrigin: true }).addTo(map);
    map.attributionControl.setPrefix(false);
    // Red thread from pin to pin, in the order you went (under the pins, with its shadow).
    for (const line of heat ? [] : strings) {
      if (line.length < 2) continue;
      L.polyline(line, { color: 'rgba(0,0,0,.28)', weight: 3, interactive: false, className: 'thread-shadow', smoothFactor: 1.5 }).addTo(map);
      L.polyline(line, { color: '#c0392b', weight: 2, interactive: false, className: 'thread', smoothFactor: 1.5 }).addTo(map);
    }
    if (heat) {
      heatSpots(pts).forEach((s) => {
        const c = L.circleMarker([s.lat, s.lon], { radius: 7 + 17 * Math.sqrt(s.n / s.max), stroke: true, weight: 1.5, color: heatColour(s.n / s.max, 0.95), fillColor: heatColour(s.n / s.max, 0.9), fillOpacity: 0.55, className: 'heat-spot' }).addTo(map);
        c.bindTooltip(`${esc(s.name)} · ${s.n} ${s.unit || (s.n === 1 ? 'visit' : 'visits')}`, { direction: 'top', className: 'heat-tip' });
      });
    }
    const markers = (heat ? [] : pts).map((p) => {
      const m = L.marker([p.lat, p.lon], { icon: pinIcon(style, catColor(p.category), tags ? p.title : ''), title: p.title || '', riseOnHover: true }).addTo(map);
      if (card) m.bindPopup(card(p), { className: 'memory-pop', maxWidth: 240, minWidth: 200 });
      else if (p.href) m.bindPopup(`<a class="map-pop" href="${esc(p.href)}">${esc(p.title || 'Open')}</a>${p.sub ? `<br><span>${esc(p.sub)}</span>` : ''}`);
      return m;
    });
    const at = heat ? -1 : pts.indexOf(places[focus]);
    if (at >= 0) {
      map.setView([pts[at].lat, pts[at].lon], Math.min(zoom, 13));
      markers[at].openPopup();
    } else if (pts.length === 1) map.setView([pts[0].lat, pts[0].lon], zoom);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lon])), { padding: [30, 30], maxZoom: 14 });
    else map.setView([54, -2.5], 5);
    el._map = map;
    el._markers = markers;
    const resized = 'ResizeObserver' in window ? new ResizeObserver(() => map.invalidateSize()) : null;
    resized?.observe(el);
    keepTrack({ el, map, resized });
  });
}

// The places grouped where they're close together (about a kilometre), with how many each.
function heatSpots(pts) {
  const spots = new Map();
  for (const p of pts) {
    const k = `${Math.round(p.lat * 80)}:${Math.round(p.lon * 80)}`;
    const s = spots.get(k) || spots.set(k, { lat: 0, lon: 0, n: 0, w: 0, names: new Map(), unit: p.unit }).get(k);
    const n = Number(p.count) > 0 ? Number(p.count) : 1;
    s.lat = (s.lat * s.w + p.lat * n) / (s.w + n);
    s.lon = (s.lon * s.w + p.lon * n) / (s.w + n);
    s.w += n;
    s.n += n;
    const name = p.city || p.title || '';
    s.names.set(name, (s.names.get(name) || 0) + n);
  }
  const list = [...spots.values()];
  const max = Math.max(1, ...list.map((s) => s.n));
  return list.map((s) => ({ ...s, max, name: [...s.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '' })).sort((a, b) => a.n - b.n);
}
// From a soft gold (once) to a deep red (most often).
function heatColour(t, a = 1) {
  const mix = (x, y) => Math.round(x + (y - x) * Math.max(0, Math.min(1, t)));
  return `rgba(${mix(245, 200)}, ${mix(190, 40)}, ${mix(70, 30)}, ${a})`;
}

// A map whose page has gone (you went somewhere else) is taken down, a couple of seconds later:
// the map library would otherwise keep every map you've looked at, tiles and all, for as long as
// the site stays open.
const maps = new Set();
let sweep = 0;
let watcher = null;
const tidy = () => {
  sweep ||= setTimeout(() => {
    sweep = 0;
    for (const m of maps) {
      if (m.el.isConnected) continue;
      maps.delete(m);
      m.resized?.disconnect();
      try {
        m.map.remove();
      } catch {}
      delete m.el._map;
      delete m.el._markers;
    }
    if (!maps.size) watcher?.disconnect();
  }, 2000);
};
function keepTrack(m) {
  watcher ||= new MutationObserver(tidy);
  if (!maps.size) watcher.observe(document.body, { childList: true, subtree: true });
  maps.add(m);
}
