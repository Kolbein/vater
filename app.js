(() => {
  "use strict";

  const levelEl = document.getElementById("level");
  const bubbleEl = document.getElementById("bubble");
  const tiltXEl = document.getElementById("tiltX");
  const tiltYEl = document.getElementById("tiltY");
  const enableBtn = document.getElementById("enableBtn");
  const calibrateBtn = document.getElementById("calibrateBtn");
  const statusEl = document.getElementById("status");

  const MAX_ANGLE = 45; // degrees mapped to the full radius of the ring
  const LEVEL_THRESHOLD = 0.7; // degrees within which we consider it "level"
  const MAX_TRAVEL_PERCENT = 39; // keep the bubble inside the outer ring

  let calibration = { x: 0, y: 0 };

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function updateBubble(tiltX, tiltY) {
    const x = tiltX - calibration.x;
    const y = tiltY - calibration.y;

    const clampedX = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, x));
    const clampedY = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, y));

    const offsetX = (clampedX / MAX_ANGLE) * MAX_TRAVEL_PERCENT;
    const offsetY = (clampedY / MAX_ANGLE) * MAX_TRAVEL_PERCENT;

    bubbleEl.style.transform = `translate(calc(-50% + ${offsetX}%), calc(-50% + ${offsetY}%))`;

    tiltXEl.textContent = `${x.toFixed(1)}°`;
    tiltYEl.textContent = `${y.toFixed(1)}°`;

    const isLevel = Math.abs(x) < LEVEL_THRESHOLD && Math.abs(y) < LEVEL_THRESHOLD;
    levelEl.classList.toggle("is-level", isLevel);

    if (navigator.vibrate && isLevel && !updateBubble._wasLevel) {
      navigator.vibrate(20);
    }
    updateBubble._wasLevel = isLevel;
  }

  function getOrientationAngle() {
    if (screen.orientation && typeof screen.orientation.angle === "number") {
      return screen.orientation.angle;
    }
    if (typeof window.orientation === "number") {
      return window.orientation;
    }
    return 0;
  }

  let rawX = 0;
  let rawY = 0;

  function handleOrientation(event) {
    const { beta, gamma } = event;
    if (beta === null || gamma === null) return;

    const angle = getOrientationAngle();
    let x;
    let y;

    switch (angle) {
      case 90:
        x = -beta;
        y = gamma;
        break;
      case -90:
      case 270:
        x = beta;
        y = -gamma;
        break;
      case 180:
        x = -gamma;
        y = -beta;
        break;
      default:
        x = gamma;
        y = beta;
    }

    rawX = x;
    rawY = y;
    updateBubble(rawX, rawY);
  }

  function startListening() {
    window.addEventListener("deviceorientation", handleOrientation, true);
    setStatus("Tilt your phone flat on a surface.");
  }

  function needsIOSPermission() {
    return (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    );
  }

  function init() {
    if (!window.DeviceOrientationEvent) {
      setStatus("This device does not support motion sensors.");
      return;
    }

    if (needsIOSPermission()) {
      enableBtn.hidden = false;
      setStatus("Tap the button below to allow motion access.");
      enableBtn.addEventListener("click", async () => {
        try {
          const result = await DeviceOrientationEvent.requestPermission();
          if (result === "granted") {
            enableBtn.hidden = true;
            startListening();
          } else {
            setStatus("Motion access was denied.");
          }
        } catch (err) {
          setStatus("Could not request motion access.");
        }
      });
    } else {
      startListening();
    }
  }

  calibrateBtn.addEventListener("click", () => {
    calibration = { x: rawX, y: rawY };
    if (navigator.vibrate) navigator.vibrate(15);
    setStatus("Calibrated to current position.");
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
