<script>
  import { onMount } from "svelte";
  import { initializeApp } from "firebase/app";
  import { getFirestore, doc, onSnapshot } from "firebase/firestore";

  let map, marker;

  onMount(async () => {
    // Client-only Leaflet import
    const L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');

    // Firebase config
    const firebaseConfig = {
      apiKey: "<YOUR-API-KEY>",
      authDomain: "<YOUR-PROJECT>.firebaseapp.com",
      projectId: "<YOUR-PROJECT-ID>"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // Initialize map
    map = L.map("map").setView([0,0], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    // Marker
    marker = L.marker([0,0]).addTo(map);

    // Firestore reference
    const locRef = doc(db, "locations", "myDevice"); // Flutter writes here

    onSnapshot(locRef, (docSnap) => {
      if (docSnap.exists()) {
        const { lat, lng } = docSnap.data();
        marker.setLatLng([lat, lng]);
        map.setView([lat, lng], map.getZoom());

        // Sparkle at marker
        const mapDiv = document.getElementById("map");
        const sparkle = document.createElement("div");
        sparkle.style.position = "absolute";
        sparkle.style.width = "12px";
        sparkle.style.height = "12px";
        sparkle.style.borderRadius = "50%";
        sparkle.style.background = "#ff4081";
        sparkle.style.boxShadow = "0 0 12px currentColor, 0 0 20px currentColor";
        
        // convert lat/lng to pixel coordinates
        const point = map.latLngToContainerPoint([lat, lng]);
        sparkle.style.left = point.x + "px";
        sparkle.style.top = point.y + "px";
        sparkle.style.animation = "sparkle 1s forwards";

        mapDiv.appendChild(sparkle);
        setTimeout(()=>sparkle.remove(),1000);
      }
    });
  });
</script>

<style>
#map { height:500px; width:100%; position: relative; }

@keyframes sparkle {
  0% { transform: scale(0); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
}
</style>

<div id="map"></div>