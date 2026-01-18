<script>
  import { onMount } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  const supabase = createClient("https://nmzhlzkrkacftsbcvyka.supabase.co", "YOUR_ANON_KEY");
  
  let map, markers = {}; // Store markers by user ID
  const channel = supabase.channel('online-users');

  onMount(async () => {
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    map = L.map("map").setView([16.8, 96.1], 12); // Default to Yangon center
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    // 1. WATCH MY POSITION AND BROADCAST
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        
        // Track the user's own movements in the "Presence" state
        channel.track({
          user: 'User_' + Math.floor(Math.random() * 1000),
          lat: latitude,
          lng: longitude,
          online_at: new Date().toISOString(),
        });
      });
    }

    // 2. LISTEN FOR ALL USERS
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        updateMapMarkers(newState);
      })
      .subscribe();

    function updateMapMarkers(state) {
      // Loop through all users synced in Supabase Presence
      Object.keys(state).forEach((id) => {
        const userDetails = state[id][0];
        const { lat, lng, user } = userDetails;

        if (markers[id]) {
          // Move existing marker
          markers[id].setLatLng([lat, lng]);
        } else {
          // Add new marker for new user
          markers[id] = L.marker([lat, lng])
            .addTo(map)
            .bindPopup(`Active: ${user}`)
            .openPopup();
            
          // Trigger your Sparkle effect here for new arrivals!
        }
      });
    }
  });
</script>

<style>
  #map {
    height: 500px;
    width: 100%;
    position: relative;
  }

  @keyframes sparkle {
    0% {
      transform: scale(0);
      opacity: 1;
    }
    100% {
      transform: scale(2);
      opacity: 0;
    }
  }
</style>

<div id="map"></div>
