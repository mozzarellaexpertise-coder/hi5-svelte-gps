<script>
  import { onMount } from "svelte";
  let map, marker;

  onMount(async () => {
    const L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');

    // Fix default marker icon in Vite/SvelteKit
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
    });

    // Initialize map at NYC
    const nyc = [40.7128, -74.0060];
    map = L.map("map").setView(nyc, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Add marker
    marker = L.marker(nyc).addTo(map);

    // Add sparkle for test
    const mapDiv = document.getElementById("map");
    const sparkle = document.createElement("div");
    sparkle.style.position = "absolute";
    sparkle.style.width = "12px";
    sparkle.style.height = "12px";
    sparkle.style.borderRadius = "50%";
    sparkle.style.background = "#ff4081";
    sparkle.style.boxShadow = "0 0 12px currentColor, 0 0 20px currentColor";

    const point = map.latLngToContainerPoint(nyc);
    sparkle.style.left = point.x + "px";
    sparkle.style.top = point.y + "px";
    sparkle.style.animation = "sparkle 1s forwards";

    mapDiv.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 1000);
  });
</script>

<style>
#map { height: 500px; width: 100%; position: relative; }

@keyframes sparkle {
  0% { transform: scale(0); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
}
</style>

<div id="map"></div>