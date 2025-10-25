<script>
  import { onMount } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  let map, marker;
  const supabaseUrl = "https://nmzhlzkrkacftsbcvyka.supabase.co";
  const supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5temhsemtya2FjZnRzYmN2eWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMzQ2MzAsImV4cCI6MjA3NjkxMDYzMH0.kVmZ500dylxoirex8kXxz7Y-TkJn2bJhGaG6SKru6bA";

  const supabase = createClient(supabaseUrl, supabaseKey);

  onMount(async () => {
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    // Default NYC location
    const start = [40.7128, -74.006];
    map = L.map("map").setView(start, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);
    marker = L.marker(start).addTo(map);

    // Load initial coordinates from Supabase
    const { data } = await supabase.from("locations").select("*").eq("id", 1).single();
    if (data) {
      marker.setLatLng([data.lat, data.lng]);
      map.setView([data.lat, data.lng], 13);
    }

    // Real-time updates via Supabase
    supabase
      .channel("locations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "locations" },
        (payload) => {
          const { lat, lng } = payload.new;
          marker.setLatLng([lat, lng]);
          map.setView([lat, lng], map.getZoom());
        }
      )
      .subscribe();
  });
</script>

<style>
#map {
  height: 500px;
  width: 100%;
  position: relative;
}
</style>

<div id="map"></div>