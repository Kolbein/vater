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

  // "Flate" measures the absolute angle from gravity (screen-normal axis) —
  // well-defined regardless of how the phone is rotated in hand. "Kant" has
  // no single well-defined axis (it depends on which edge and which way the
  // phone is held, which we can't know or reliably read back from the raw
  // sensor across browsers), so instead we capture the current orientation
  // as a reference vector the moment edge mode is entered, and measure the
  // angle away from that reference. This is symmetric by construction: a
  // physical tilt of N degrees to the left or right away from the reference
  // always produces the same angle, with no axis to get wrong.
  let mode = "face"; // "face" | "edge"
  let edgeReference = null;

  function captureEdgeReference() {
    const magnitude = Math.hypot(smoothedX, smoothedY, smoothedZ) || 1;
    edgeReference = { x: smoothedX / magnitude, y: smoothedY / magnitude, z: smoothedZ / magnitude };
  }

  levelEl.addEventListener("click", () => {
    if (mode === "face") {
      mode = "edge";
      captureEdgeReference();
      modeEl.textContent = "Vinkel \u00b7 Kant";
    } else {
      mode = "face";
      modeEl.textContent = "Vinkel \u00b7 Flate";
    }
    if (navigator.vibrate) navigator.vibrate(10);
  });

  function updateReadout() {
    const magnitude = Math.hypot(smoothedX, smoothedY, smoothedZ) || 1;
    let tiltDeg;

    if (mode === "face") {
      // Angle between gravity and the screen-normal axis (z), via the
      // absolute value so it stays continuous no matter which way the phone
      // is rotated in hand, unlike the beta/gamma Euler angles from
      // deviceorientation.
      const cos = Math.max(-1, Math.min(1, Math.abs(smoothedZ) / magnitude));
      tiltDeg = Math.acos(cos) * (180 / Math.PI);
    } else {
      // Angle between the current orientation and the captured reference
      // vector (dot product of two unit vectors), which is symmetric for
      // tilting either direction away from that reference.
      const rx = smoothedX / magnitude;
      const ry = smoothedY / magnitude;
      const rz = smoothedZ / magnitude;
      const dot = rx * edgeReference.x + ry * edgeReference.y + rz * edgeReference.z;
      tiltDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
    }

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

