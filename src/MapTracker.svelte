<script>
  import { onMount } from "svelte";
  import { initializeApp } from "firebase/app";
  import { getFirestore, doc, onSnapshot } from "firebase/firestore";
  import L from "leaflet";

  // Firebase config
  const firebaseConfig = {
    apiKey: "<YOUR-API-KEY>",
    authDomain: "<YOUR-PROJECT>.firebaseapp.com",
    projectId: "<YOUR-PROJECT-ID>"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  let map;
  let marker;

  onMount(() => {
    // Initialize map
    map = L.map("map").setView([0,0], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    // Add marker
    marker = L.marker([0,0]).addTo(map);

    const locRef = doc(db, "locations", "myDevice");

    // Listen to Firestore updates
    onSnapshot(locRef, (docSnap) => {
      if(docSnap.exists()) {
        const { lat, lng } = docSnap.data();
        marker.setLatLng([lat, lng]);
        map.setView([lat, lng], map.getZoom());

        // Hi5 sparkle effect
        const sparkle = document.createElement("div");
        sparkle.style.position = "absolute";
        sparkle.style.width = "12px";
        sparkle.style.height = "12px";
        sparkle.style.borderRadius = "50%";
        sparkle.style.background = ["#ff4081","#3f51b5","#ffeb3b","#4caf50","#ff9800"][Math.floor(Math.random()*5)];
        sparkle.style.top = Math.random() * 480 + "px";
        sparkle.style.left = Math.random() * 800 + "px";
        sparkle.style.boxShadow = "0 0 12px currentColor,0 0 20px currentColor";
        sparkle.style.animation = "sparkle 1s forwards";
        document.getElementById("map").appendChild(sparkle);
        setTimeout(()=>sparkle.remove(),1000);
      }
    });
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