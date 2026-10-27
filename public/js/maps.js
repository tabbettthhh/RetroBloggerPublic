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

function pinIcon(style, color) {
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
  const { places = [], style = 'mac', interactive = true, zoom = 15, focus = -1 } = opts;
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
      worldCopyJump: true
    });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    map.attributionControl.setPrefix(false);
    const markers = pts.map((p) => {
      const m = L.marker([p.lat, p.lon], { icon: pinIcon(style, catColor(p.category)), title: p.title || '' }).addTo(map);
      if (p.href) m.bindPopup(`<a class="map-pop" href="${esc(p.href)}">${esc(p.title || 'Open')}</a>${p.sub ? `<br><span>${esc(p.sub)}</span>` : ''}`);
      return m;
    });
    const at = pts.indexOf(places[focus]);
    if (at >= 0) {
      map.setView([pts[at].lat, pts[at].lon], Math.min(zoom, 13));
      markers[at].openPopup();
    } else if (pts.length === 1) map.setView([pts[0].lat, pts[0].lon], zoom);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lon])), { padding: [30, 30], maxZoom: 14 });
    else map.setView([52.48, -1.9], 5);
    el._map = map;
    el._markers = markers;
    if ('ResizeObserver' in window) new ResizeObserver(() => map.invalidateSize()).observe(el);
  });
}
