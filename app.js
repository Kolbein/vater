(() => {
  "use strict";

  const levelEl = document.getElementById("level");
  const horizonRollEl = document.getElementById("horizonRoll");
  const horizonPitchEl = document.getElementById("horizonPitch");
  const tiltXEl = document.getElementById("tiltX");
  const tiltYEl = document.getElementById("tiltY");
  const enableBtn = document.getElementById("enableBtn");
  const calibrateBtn = document.getElementById("calibrateBtn");
  const statusEl = document.getElementById("status");

  const MAX_ANGLE = 45; // degrees mapped to the full pitch travel of the horizon
  const LEVEL_THRESHOLD = 0.7; // degrees within which we consider it "level"
  const MAX_TRAVEL_FRACTION = 0.35; // keep the horizon line inside the circle

  let calibration = { x: 0, y: 0 };

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function updateBubble(tiltX, tiltY) {
    const x = tiltX - calibration.x;
    const y = tiltY - calibration.y;

    const clampedY = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, y));
    const maxTravelPx = levelEl.clientHeight * MAX_TRAVEL_FRACTION;
    const pitchPx = (clampedY / MAX_ANGLE) * maxTravelPx;

    horizonRollEl.style.transform = `rotate(${-x}deg)`;
    horizonPitchEl.style.transform = `translateY(${pitchPx}px)`;

    tiltXEl.textContent = `${x.toFixed(1)}°`;
    tiltYEl.textContent = `${y.toFixed(1)}°`;

    const isFlat = Math.abs(x) < LEVEL_THRESHOLD && Math.abs(y) < LEVEL_THRESHOLD;
    const is45 = Math.abs(Math.abs(x) - 45) < LEVEL_THRESHOLD && Math.abs(y) < LEVEL_THRESHOLD;
    const isLevel = isFlat || is45;
    levelEl.classList.toggle("is-level", isLevel);
    tiltXEl.classList.toggle("is-level", isLevel);
    tiltYEl.classList.toggle("is-level", isLevel);

    if (navigator.vibrate && isLevel && !updateBubble._wasLevel) {
      navigator.vibrate(20);
    }
    updateBubble._wasLevel = isLevel;
  }

  let rawX = 0;
  let rawY = 0;
  let smoothedX = 0;
  let smoothedY = 0;
  let hasNewReading = false;
  const SMOOTHING = 0.15; // lower = smoother but slower to react

  function handleOrientation(event) {
    const { beta, gamma } = event;
    if (beta === null || gamma === null) return;

    // Portrait-only mapping: avoids flips caused by screen-orientation edge cases.
    rawX = gamma;
    rawY = beta;
    hasNewReading = true;
  }

  function renderLoop() {
    if (hasNewReading) {
      smoothedX += (rawX - smoothedX) * SMOOTHING;
      smoothedY += (rawY - smoothedY) * SMOOTHING;
      updateBubble(smoothedX, smoothedY);
    }
    requestAnimationFrame(renderLoop);
  }

  function startListening() {
    window.addEventListener("deviceorientation", handleOrientation);
    requestAnimationFrame(renderLoop);
    setStatus("Legg telefonen flatt på et underlag.");
  }

  function needsIOSPermission() {
    return (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    );
  }

  function init() {
    if (!window.DeviceOrientationEvent) {
      setStatus("Denne enheten støtter ikke bevegelsessensorer.");
      return;
    }

    if (needsIOSPermission()) {
      enableBtn.hidden = false;
      setStatus("Trykk på knappen under for å gi tilgang til bevegelsessensorer.");
      enableBtn.addEventListener("click", async () => {
        try {
          const result = await DeviceOrientationEvent.requestPermission();
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

  calibrateBtn.addEventListener("click", () => {
    calibration = { x: smoothedX, y: smoothedY };
    if (navigator.vibrate) navigator.vibrate(15);
    setStatus("Kalibrert til gjeldende posisjon.");
  });

  init();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* offline support is best-effort */
      });
    });
  }
})();
