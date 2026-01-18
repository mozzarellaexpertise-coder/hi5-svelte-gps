<script>
  import { onMount, onDestroy } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  const supabase = createClient(
    "https://uygdeyofmqhfnpyrqtpf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z2RleW9mbXFoZm5weXJxdHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODI2MzMsImV4cCI6MjA4MjM1ODYzM30.QoxMgJ-roPqhYJhceAxZ4tg1oeMqZiyE7s_-xGNCMik"
  );

  let map;
  let L;
  let markers = {};
  let channel;
  let hasCentered = false;
  let activeUsers = 0;
  let totalUpdates = 0;
  let lastUpdateTime = null;
  let connectionStatus = "Connecting...";
  let userList = [];

  // Custom marker icons based on status
  function getMarkerIcon(status) {
    const colors = {
      STATIONARY: '#6c757d',
      WALKING: '#28a745',
      RUNNING: '#ffc107',
      VEHICLE: '#dc3545'
    };
    
    const color = colors[status] || '#007bff';
    
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          background: ${color};
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        ">
          <div style="
            position: absolute;
            width: 10px;
            height: 10px;
            background: white;
            border-radius: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          "></div>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });
  }

  // Update or create marker
  function updateMarker(user) {
    if (!L || !map) return;
    
    const { user_id, lat, lng, status, speed, updated_at } = user;
    
    if (!lat || !lng) return;

    const popupContent = `
      <div style="font-family: sans-serif; min-width: 200px;">
        <h4 style="margin: 0 0 10px 0; color: #333;">
          📍 Device ${user_id.slice(0, 8)}
        </h4>
        <div style="font-size: 0.85rem; line-height: 1.6;">
          <strong>Status:</strong> ${status || 'UNKNOWN'}<br/>
          <strong>Speed:</strong> ${speed ? speed.toFixed(2) : '0.00'} m/s<br/>
          <strong>Coordinates:</strong><br/>
          ${lat.toFixed(6)}, ${lng.toFixed(6)}<br/>
          <strong>Last Update:</strong><br/>
          ${new Date(updated_at).toLocaleString()}
        </div>
      </div>
    `;

    if (markers[user_id]) {
      // Update existing marker
      markers[user_id].setLatLng([lat, lng]);
      markers[user_id].setIcon(getMarkerIcon(status));
      markers[user_id].getPopup().setContent(popupContent);
    } else {
      // Create new marker
      markers[user_id] = L.marker([lat, lng], {
        icon: getMarkerIcon(status)
      })
        .bindPopup(popupContent)
        .addTo(map);
      
      activeUsers++;
    }

    // Auto-center on first user
    if (!hasCentered) {
      map.setView([lat, lng], 15);
      hasCentered = true;
    }

    // Update user list
    updateUserList(user);
    
    totalUpdates++;
    lastUpdateTime = new Date();
  }

  // Update user list for sidebar
  function updateUserList(user) {
    const index = userList.findIndex(u => u.user_id === user.user_id);
    if (index !== -1) {
      userList[index] = user;
    } else {
      userList.push(user);
    }
    userList = userList; // Trigger reactivity
  }

  // Focus on specific user
  function focusUser(user) {
    if (map && user.lat && user.lng) {
      map.setView([user.lat, user.lng], 17);
      if (markers[user.user_id]) {
        markers[user.user_id].openPopup();
      }
    }
  }

  // Remove inactive users (optional - call periodically)
  function removeInactiveUsers() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    Object.entries(markers).forEach(([user_id, marker]) => {
      const user = userList.find(u => u.user_id === user_id);
      if (user && now - new Date(user.updated_at).getTime() > timeout) {
        map.removeLayer(marker);
        delete markers[user_id];
        userList = userList.filter(u => u.user_id !== user_id);
        activeUsers--;
      }
    });
  }

  onMount(async () => {
    // Import Leaflet
    L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");

    // Initialize map
    map = L.map("map", {
      zoomControl: true,
      attributionControl: true
    }).setView([16.8661, 96.1951], 12);

// Clean fix for line 164
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

    // Load initial data
    connectionStatus = "Loading initial data...";
    const { data, error } = await supabase.from("locations").select("*");
    
    if (error) {
      connectionStatus = "❌ Error loading data";
      console.error(error);
    } else {
      if (data && data.length > 0) {
        data.forEach(user => updateMarker(user));
        connectionStatus = "✅ Connected";
      } else {
        connectionStatus = "⏳ Waiting for devices...";
      }
    }

    // Setup realtime subscription
    channel = supabase
      .channel("live-locations")
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "locations" 
        },
        (payload) => {
          if (payload.new) {
            updateMarker(payload.new);
            connectionStatus = "✅ Live";
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          connectionStatus = "✅ Live";
        } else if (status === 'CHANNEL_ERROR') {
          connectionStatus = "⚠️ Connection error";
        }
      });

    // Periodic cleanup of inactive users
    const cleanupInterval = setInterval(removeInactiveUsers, 60000);

    return () => {
      clearInterval(cleanupInterval);
    };
  });

  onDestroy(() => {
    if (channel) {
      supabase.removeChannel(channel);
    }
    if (map) {
      map.remove();
    }
  });
</script>

<div class="viewer-container">
  <!-- Header -->
  <header class="header">
    <div class="header-content">
      <div class="title-section">
        <h1>🌍 Live Traffic Monitor</h1>
        <p class="subtitle">Real-time location tracking system</p>
      </div>
      <div class="status-indicator" class:connected={connectionStatus.includes('✅')}>
        <span class="status-dot"></span>
        {connectionStatus}
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <div class="main-content">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h3>📊 Active Devices</h3>
        <span class="badge">{activeUsers}</span>
      </div>
      
      <div class="user-list">
        {#if userList.length === 0}
          <div class="empty-state">
            <p>No active devices</p>
            <small>Waiting for trackers...</small>
          </div>
        {:else}
          {#each userList as user (user.user_id)}
            <div class="user-card" on:click={() => focusUser(user)}>
              <div class="user-header">
                <span class="user-icon" class:stationary={user.status === 'STATIONARY'} 
                      class:walking={user.status === 'WALKING'}
                      class:running={user.status === 'RUNNING'}
                      class:vehicle={user.status === 'VEHICLE'}>
                  {#if user.status === 'STATIONARY'}⏸️
                  {:else if user.status === 'WALKING'}🚶
                  {:else if user.status === 'RUNNING'}🏃
                  {:else if user.status === 'VEHICLE'}🚗
                  {:else}📍{/if}
                </span>
<div class="info-section">
  <span class="label-text" style="display: block; font-weight: bold;">Device ID</span>
  <code class="user-id">{user_id.slice(0, 8)}...{user_id.slice(-4)}</code>
</div>
              <div class="user-details">
                <small>Speed: {user.speed ? user.speed.toFixed(2) : '0.00'} m/s</small>
                <small>Updated: {new Date(user.updated_at).toLocaleTimeString()}</small>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </aside>

    <!-- Map -->
    <div id="map"></div>
  </div>

  <!-- Footer Stats -->
  <footer class="footer">
    <div class="stat-card">
      <div class="stat-icon">👥</div>
      <div class="stat-content">
        <div class="stat-value">{activeUsers}</div>
        <div class="stat-label">Active Users</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">📡</div>
      <div class="stat-content">
        <div class="stat-value">{totalUpdates}</div>
        <div class="stat-label">Total Updates</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🕐</div>
      <div class="stat-content">
        <div class="stat-value">
          {lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : '--:--:--'}
        </div>
        <div class="stat-label">Last Update</div>
      </div>
    </div>
  </footer>
</div>

<style>
  :global(body, html) {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  }

  .viewer-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background: #f5f5f5;
  }

  /* Header */
  .header {
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    color: white;
    padding: 15px 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 1000;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1400px;
    margin: 0 auto;
  }

  .title-section h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .subtitle {
    margin: 5px 0 0;
    font-size: 0.85rem;
    opacity: 0.9;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ffc107;
  }

  .status-indicator.connected .status-dot {
    background: #28a745;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Main Content */
  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* Sidebar */
  .sidebar {
    width: 300px;
    background: white;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    padding: 15px 20px;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .sidebar-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #333;
  }

  .badge {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .user-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #6c757d;
  }

.user-card {
    background: white;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .user-card:hover {
    border-color: #2a5298;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    transform: translateY(-2px);
  }

  .user-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .user-icon {
    font-size: 1.2rem;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f2f5;
    border-radius: 8px;
  }

  .user-info .user-id {
    font-weight: 700;
    font-size: 0.9rem;
    color: #333;
  }

  .user-info .user-status {
    font-size: 0.75rem;
    color: #667eea;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .user-details {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #f0f0f0;
    padding-top: 8px;
    color: #6c757d;
  }

  /* Map Container */
  #map {
    flex: 1;
    z-index: 1;
  }

  /* Footer Stats */
  .footer {
    display: flex;
    background: white;
    padding: 15px 20px;
    gap: 20px;
    border-top: 1px solid #e0e0e0;
    justify-content: center;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .stat-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: #1e3c72;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6c757d;
  }

  /* Prediction Box Styling */
  .prediction-panel {
    background: #fff9c4;
    border: 1px solid #fbc02d;
    padding: 12px;
    margin: 10px;
    border-radius: 8px;
  }
</style>
