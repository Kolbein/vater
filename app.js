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
  let axisMode = "face"; // "face" = phone flat against the surface, "edge" = phone standing on its edge

  levelEl.addEventListener("click", () => {
    axisMode = axisMode === "face" ? "edge" : "face";
    modeEl.textContent = axisMode === "face" ? "Vinkel \u00b7 Flate" : "Vinkel \u00b7 Kant";
    if (navigator.vibrate) navigator.vibrate(10);
  });

  function updateReadout() {
    // Face mode: angle between gravity and the screen-normal axis (z),
    // via the absolute value so it stays continuous regardless of how the
    // phone is rotated in hand, unlike the beta/gamma Euler angles from
    // deviceorientation (no more flip on small movement). There's no single
    // "direction" to a face tilt, so the line only ever rotates one way.
    //
    // Edge mode: signed roll around the phone's long axis (y vs x), so
    // tilting left vs right rotates the line the correct way instead of
    // always the same direction, while the displayed number stays the
    // unsigned magnitude.
    let tiltDeg;
    let visualDeg;
    if (axisMode === "face") {
      const magnitude = Math.hypot(smoothedX, smoothedY, smoothedZ) || 1;
      const cos = Math.max(-1, Math.min(1, Math.abs(smoothedZ) / magnitude));
      tiltDeg = Math.acos(cos) * (180 / Math.PI);
      visualDeg = tiltDeg;
    } else {
      const signedDeg = Math.atan2(smoothedX, smoothedY) * (180 / Math.PI);
      tiltDeg = Math.abs(signedDeg);
      visualDeg = signedDeg;
    }

    horizonRollEl.style.transform = `rotate(${-visualDeg}deg)`;
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
  }
})();

