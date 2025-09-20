import React, { useEffect, useState } from "react";

const FloatingXButton = () => {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const button = document.getElementById("floating-x");
    if (button) {
      button.style.animationPlayState = paused ? "paused" : "running";
    }
  }, [paused]);

  return (
    <a
      id="floating-x"
      href="https://example.com" // <-- change to your link
      target="_blank"
      rel="noopener noreferrer"
      className="absolute top-4 left-0 z-50 text-4xl font-bold text-red-500 hover:text-red-700 transition-colors"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      ✕
    </a>
  );
};

export default FloatingXButton;
