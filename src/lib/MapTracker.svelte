<script>
  import { onMount } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  // ⚠️ Use ANON public key ONLY for viewer
  const supabase = createClient(
    "https://uygdeyofmqhfnpyrqtpf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z2RleW9mbXFoZm5weXJxdHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODI2MzMsImV4cCI6MjA4MjM1ODYzM30.QoxMgJ-roPqhYJhceAxZ4tg1oeMqZiyE7s_-xGNCMik"
  );

  let map;
  let markers = {};

  onMount(async () => {
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    // Fix Leaflet icons
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    // Init map
    map = L.map("map").setView([16.8661, 96.1951], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    // 1️⃣ Load existing users
    const { data, error } = await supabase
      .from("locations")
      .select("*");

    if (!error && data) {
      data.forEach(user => {
        markers[user.user_id] =
          L.marker([user.lat, user.lng])
            .bindPopup(`User: ${user.user_id}`)
            .addTo(map);
      });
    }

    // 2️⃣ Realtime subscription
    supabase
      .channel("live-locations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "locations" },
        payload => {
          const { user_id, lat, lng } = payload.new;

          if (markers[user_id]) {
            markers[user_id].setLatLng([lat, lng]);
          } else {
            markers[user_id] =
              L.marker([lat, lng])
                .bindPopup(`User: ${user_id}`)
                .addTo(map);
          }
        }
      )
      .subscribe();
  });
</script>

<div class="viewer">
  <h2>🌍 Live User Map</h2>
  <div id="map"></div>
</div>

<style>
  .viewer {
    padding: 1rem;
    font-family: system-ui, sans-serif;
  }

  h2 {
    margin-bottom: 0.5rem;
    text-align: center;
  }

  #map {
    height: 80vh;
    width: 100%;
    border-radius: 14px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  }
</style>
