(() => {
  "use strict";

  const levelEl = document.getElementById("level");
  const horizonRollEl = document.getElementById("horizonRoll");
  const angleEl = document.getElementById("tiltAngle");
  const modeEl = document.getElementById("axisMode");
  const enableBtn = document.getElementById("enableBtn");
  const statusEl = document.getElementById("status");

  const LEVEL_THRESHOLD = 0.7; // degrees within which we consider it "level"
  const SMOOTHING = 0.15; // lower = smoother but slower to react

  function setStatus(text) {
    statusEl.textContent = text;
  }

  let smoothedX = 0;
  let smoothedY = 0;
  let smoothedZ = 9.81;
  let hasReading = false;
  let wasLevel = false;
  let axisMode = "face"; // "face" = phone flat against the surface, "edge" = phone standing on its edge

  levelEl.addEventListener("click", () => {
    axisMode = axisMode === "face" ? "edge" : "face";
    modeEl.textContent = axisMode === "face" ? "Vinkel \u00b7 Flate" : "Vinkel \u00b7 Kant";
    if (navigator.vibrate) navigator.vibrate(10);
  });

  function updateReadout() {
    // Angle between gravity and the reference axis. Unlike the beta/gamma
    // Euler angles from deviceorientation, this stays continuous and doesn't
    // depend on which way the phone is rotated in hand, so small movement
    // no longer causes the display to flip. "Edge" mode swaps in the axis
    // that runs along the phone's length, for measuring while it stands on
    // its edge instead of lying flat against the surface.
    const referenceAxis = axisMode === "face" ? smoothedZ : smoothedY;
    const magnitude = Math.hypot(smoothedX, smoothedY, smoothedZ) || 1;
    const cos = Math.max(-1, Math.min(1, referenceAxis / magnitude));
    const tiltDeg = Math.acos(cos) * (180 / Math.PI);

    // Edge mode targets 45°, so the ground should read flat/level right at
    // that target instead of at 0°, matching the natural feel of face mode.
    const visualTarget = axisMode === "face" ? 0 : 45;
    horizonRollEl.style.transform = `rotate(${-(tiltDeg - visualTarget)}deg)`;
    angleEl.textContent = `${tiltDeg.toFixed(1)}°`;

    const isFlat = tiltDeg < LEVEL_THRESHOLD;
    const is45 = Math.abs(tiltDeg - 45) < LEVEL_THRESHOLD;
    const isLevel = isFlat || is45;
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
  }
})();

