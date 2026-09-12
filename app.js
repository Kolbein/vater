(() => {
  "use strict";

  const levelEl = document.getElementById("level");
  const horizonRollEl = document.getElementById("horizonRoll");
  const angleEl = document.getElementById("tiltAngle");
  const modeEl = document.getElementById("axisMode");
  const enableBtn = document.getElementById("enableBtn");
  const statusEl = document.getElementById("status");

  const LEVEL_THRESHOLD = 1; // degrees within which we consider it "level"
  const SMOOTHING = 0.15; // lower = smoother but slower to react
  const TARGET_ANGLES = [0, 45, 90];

  function setStatus(text) {
    statusEl.textContent = text;
  }

  let smoothedX = 0;
  let smoothedY = 0;
  let smoothedZ = 9.81;
  let hasReading = false;
  let wasLevel = false;

  // Which axis is "up" depends on which physical edge/face rests against the
  // surface, which we can't know in advance — so instead of guessing, tapping
  // cycles through all three so one of them always matches the actual grip.
  const AXIS_MODES = [
    { key: "z", label: "Vinkel \u00b7 Flate" },
    { key: "y", label: "Vinkel \u00b7 Kant (lang side)" },
    { key: "x", label: "Vinkel \u00b7 Kant (kort side)" }
  ];
  let axisModeIndex = 0;

  levelEl.addEventListener("click", () => {
    axisModeIndex = (axisModeIndex + 1) % AXIS_MODES.length;
    modeEl.textContent = AXIS_MODES[axisModeIndex].label;
    if (navigator.vibrate) navigator.vibrate(10);
  });

  function updateReadout() {
    // Angle between gravity and the reference axis, via the absolute value
    // so it stays continuous no matter which way the phone is tilted or
    // rotated in hand, unlike the beta/gamma Euler angles from
    // deviceorientation (no more flip on small movement, and no more
    // direction-dependent sign flip in the line's rotation).
    const axisKey = AXIS_MODES[axisModeIndex].key;
    const referenceAxis = axisKey === "z" ? smoothedZ : axisKey === "y" ? smoothedY : smoothedX;
    const magnitude = Math.hypot(smoothedX, smoothedY, smoothedZ) || 1;
    const cos = Math.max(-1, Math.min(1, Math.abs(referenceAxis) / magnitude));
    const tiltDeg = Math.acos(cos) * (180 / Math.PI);

    horizonRollEl.style.transform = `rotate(${-tiltDeg}deg)`;
    angleEl.textContent = `${Math.round(tiltDeg)}°`;

    const isLevel = TARGET_ANGLES.some((target) => Math.abs(tiltDeg - target) < LEVEL_THRESHOLD);
    levelEl.classList.toggle("is-level", isLevel);
    angleEl.classList.toggle("is-level", isLevel);

    if (navigator.vibrate && isLevel && !wasLevel) {
      navigator.vibrate(20);
    }
    wasLevel = isLevel;
  }

  function handleMotion(event) {
    const g = event.accelerationIncludingGravity;
    if (!g || g.x === null || g.y === null || g.z === null) return;

    smoothedX += (g.x - smoothedX) * SMOOTHING;
    smoothedY += (g.y - smoothedY) * SMOOTHING;
    smoothedZ += (g.z - smoothedZ) * SMOOTHING;
    hasReading = true;
  }

  function renderLoop() {
    if (hasReading) {
      updateReadout();
    }
    requestAnimationFrame(renderLoop);
  }

  function startListening() {
    window.addEventListener("devicemotion", handleMotion);
    requestAnimationFrame(renderLoop);
    setStatus("Legg telefonen mot flaten du vil sjekke.");
  }

  function needsIOSPermission() {
    return (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function"
    );
  }

  function init() {
    if (!window.DeviceMotionEvent) {
      setStatus("Denne enheten støtter ikke bevegelsessensorer.");
      return;
    }

    if (needsIOSPermission()) {
      enableBtn.hidden = false;
      enableBtn.addEventListener("click", async () => {
        try {
          const result = await DeviceMotionEvent.requestPermission();
          if (result === "granted") {
            enableBtn.hidden = true;
            startListening();
          } else {
            setStatus("Tilgang til bevegelsessensorer ble avslått.");
          }
        } catch (err) {
          setStatus("Kunne ikke be om tilgang til bevegelsessensorer.");
        }
      });
    } else {
      startListening();
    }
  }

  init();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* offline support is best-effort */
      });
    });
    // Auto-reload once when a new service worker takes over, so updates
    // apply immediately instead of needing a manual double-reload.
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    });
  }
})();

