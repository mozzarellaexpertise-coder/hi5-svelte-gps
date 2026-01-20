<script>
  import { onMount, onDestroy } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  const supabase = createClient(
    "https://uygdeyofmqhfnpyrqtpf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z2RleW9mbXFoZm5weXJxdHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODI2MzMsImV4cCI6MjA4MjM1ODYzM30.QoxMgJ-roPqhYJhceAxZ4tg1oeMqZiyE7s_-xGNCMik"
  );

  let status = "Initializing...";
  let user_id = "";
  let watchId = null;
  let isTracking = false;

  let lastUpdate = null;
  let updateCount = 0;
  let errorCount = 0;

  let currentCoords = { lat: null, lng: null, speed: null };

  // === SYSTEM CONTROLS ===
  let lastUploadTime = 0;
  let lastCoords = null;

  const BASE_INTERVAL = 5000; // default 5s

  function initializeUserId() {
    user_id = localStorage.getItem("user_id") || crypto.randomUUID();
    localStorage.setItem("user_id", user_id);
  }

  function getMovementStatus(speed = 0) {
    if (speed < 0.5) return { label: "STATIONARY", interval: 15000 };
    if (speed < 2) return { label: "WALKING", interval: 7000 };
    if (speed < 10) return { label: "RUNNING", interval: 4000 };
    return { label: "VEHICLE", interval: 2000 };
  }

  async function uploadLocation(pos) {
    const { latitude, longitude, speed = 0, accuracy = 0 } = pos.coords;
    const now = Date.now();

    const movement = getMovementStatus(speed);

    // ⏱️ Adaptive throttle
    if (now - lastUploadTime < movement.interval) return;
    lastUploadTime = now;

    // 📍 Jitter filter
    if (lastCoords) {
      const dLat = Math.abs(latitude - lastCoords.lat);
      const dLng = Math.abs(longitude - lastCoords.lng);
      if (dLat < 0.00001 && dLng < 0.00001) return;
    }

    lastCoords = { lat: latitude, lng: longitude };

    currentCoords = {
      lat: latitude.toFixed(6),
      lng: longitude.toFixed(6),
      speed: speed.toFixed(2)
    };

    try {
      const { error } = await supabase.from("locations").upsert(
        {
          user_id,
          lat: latitude,
          lng: longitude,
          speed,
          accuracy,
          status: movement.label,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;

      updateCount++;
      lastUpdate = new Date();
      status = `✅ Active (${movement.label}) • ${updateCount}`;
    } catch (err) {
      errorCount++;
      status = `⚠️ Network issue (${errorCount})`;
      console.error(err);
    }
  }

  function startTracking() {
    if (!navigator.geolocation || watchId) return;

    isTracking = true;
    status = "📍 Tracking active";

    watchId = navigator.geolocation.watchPosition(
      uploadLocation,
      (err) => {
        errorCount++;
        status = `❌ GPS Error`;
        console.error(err);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 3000,
        timeout: 15000
      }
    );
  }

  function stopTracking() {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    isTracking = false;
    status = "⏸️ Tracking paused";
  }

  async function sendManualUpdate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(uploadLocation);
  }

  onMount(() => {
    initializeUserId();
    startTracking();
  });

  onDestroy(() => {
    stopTracking();
  });
</script>

<div class="sender-container">
  <div class="header">
    <h1>📱 Live Tracker</h1>
    <p class="subtitle">Real-time location broadcasting</p>
  </div>

  <div class="main-card">
    <!-- Status Indicator -->
    <div class="status-badge" class:active={isTracking} class:error={status.includes('❌')}>
      <span class="pulse" class:active={isTracking}></span>
      {status}
    </div>

    <!-- User Info -->
    <div class="info-section">
      <label>Device ID</label>
      <code class="user-id">{user_id.slice(0, 8)}...{user_id.slice(-4)}</code>
    </div>

    <!-- Coordinates Display -->
    {#if currentCoords.lat}
      <div class="coords-grid">
        <div class="coord-item">
          <span class="label">Latitude</span>
          <span class="value">{currentCoords.lat}°</span>
        </div>
        <div class="coord-item">
          <span class="label">Longitude</span>
          <span class="value">{currentCoords.lng}°</span>
        </div>
        <div class="coord-item">
          <span class="label">Speed</span>
          <span class="value">{currentCoords.speed} m/s</span>
        </div>
      </div>
    {/if}

    <!-- Stats -->
    <div class="stats">
      <div class="stat-box">
        <div class="stat-value">{updateCount}</div>
        <div class="stat-label">Updates Sent</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">{errorCount}</div>
        <div class="stat-label">Errors</div>
      </div>
      {#if lastUpdate}
        <div class="stat-box">
          <div class="stat-value">{lastUpdate.toLocaleTimeString()}</div>
          <div class="stat-label">Last Update</div>
        </div>
      {/if}
    </div>

    <!-- Controls -->
    <div class="controls">
      {#if isTracking}
        <button class="btn btn-stop" on:click={stopTracking}>
          ⏸️ Pause Tracking
        </button>
      {:else}
        <button class="btn btn-start" on:click={startTracking}>
          ▶️ Start Tracking
        </button>
      {/if}
      <button class="btn btn-manual" on:click={sendManualUpdate}>
        🔄 Force Update
      </button>
    </div>
  </div>

  <div class="footer-note">
    💡 Keep this page active for continuous tracking. GPS works best outdoors.
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
  }

  .sender-container {
    max-width: 500px;
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    text-align: center;
    color: white;
    margin-bottom: 20px;
  }

  .header h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
  }

  .subtitle {
    margin: 5px 0 0;
    opacity: 0.9;
    font-size: 0.9rem;
  }

  .main-card {
    background: white;
    border-radius: 20px;
    padding: 25px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    flex-grow: 1;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 15px 20px;
    border-radius: 12px;
    background: #f8f9fa;
    font-weight: 600;
    margin-bottom: 20px;
    border: 2px solid #e9ecef;
    transition: all 0.3s ease;
  }

  .status-badge.active {
    background: #d4edda;
    border-color: #28a745;
    color: #155724;
  }

  .status-badge.error {
    background: #f8d7da;
    border-color: #dc3545;
    color: #721c24;
  }

  .pulse {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #6c757d;
  }

  .pulse.active {
    background: #28a745;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .info-section {
    margin: 20px 0;
  }

  .info-section label {
    display: block;
    font-size: 0.75rem;
    text-transform: uppercase;
    color: #6c757d;
    margin-bottom: 5px;
    font-weight: 600;
  }

  .user-id {
    display: block;
    background: #f8f9fa;
    padding: 10px;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    color: #495057;
    word-break: break-all;
  }

  .coords-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin: 20px 0;
  }

  .coord-item {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 10px;
    text-align: center;
  }

  .coord-item:last-child {
    grid-column: 1 / -1;
  }

  .coord-item .label {
    display: block;
    font-size: 0.7rem;
    text-transform: uppercase;
    color: #6c757d;
    margin-bottom: 5px;
    font-weight: 600;
  }

  .coord-item .value {
    display: block;
    font-size: 1.1rem;
    font-weight: 700;
    color: #212529;
    font-family: 'Courier New', monospace;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 10px;
    margin: 20px 0;
  }

  .stat-box {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px;
    border-radius: 10px;
    text-align: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 5px;
  }

  .stat-label {
    font-size: 0.7rem;
    opacity: 0.9;
    text-transform: uppercase;
  }

  .controls {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }

  .btn {
    flex: 1;
    padding: 14px;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-start {
    background: #28a745;
    color: white;
  }

  .btn-start:hover {
    background: #218838;
    transform: translateY(-2px);
  }

  .btn-stop {
    background: #ffc107;
    color: #212529;
  }

  .btn-stop:hover {
    background: #e0a800;
    transform: translateY(-2px);
  }

  .btn-manual {
    background: #007bff;
    color: white;
  }

  .btn-manual:hover {
    background: #0056b3;
    transform: translateY(-2px);
  }

  .footer-note {
    text-align: center;
    color: white;
    margin-top: 20px;
    font-size: 0.85rem;
    opacity: 0.9;
    padding: 15px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    backdrop-filter: blur(10px);
  }

  @media (max-width: 480px) {
    .sender-container {
      padding: 15px;
    }

    .coords-grid {
      grid-template-columns: 1fr;
    }

    .coord-item:last-child {
      grid-column: 1;
    }
  }
</style>
