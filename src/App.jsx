import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [mcap, setMcap] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState(null);
  const lastMcapRef = useRef(0);
  const lastFetchRef = useRef(0);
  const videoRef = useRef(null);
  const maxMcap = 1_000_000;

  const fetchMcap = async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < 500) return;
    try {
      const res = await fetch('/api/mcap');
      const data = await res.json();
      console.log('Server MCAP response:', data, 'Raw MCAP:', data.mcap);
      const newMcap = data.mcap || 0;
      if (newMcap !== lastMcapRef.current) {
        setDirection(newMcap > lastMcapRef.current ? 'up' : newMcap < lastMcapRef.current ? 'down' : null);
        if (videoRef.current && videoRef.current.duration) {
          const videoTime = (newMcap / maxMcap) * videoRef.current.duration;
          videoRef.current.currentTime = Math.max(0, Math.min(videoTime, videoRef.current.duration));
          console.log('Video time set:', videoTime, 'seconds');
        }
        lastMcapRef.current = newMcap;
      }
      setMcap(newMcap);
      setError(data.error || '');
      lastFetchRef.current = now;
    } catch (err) {
      console.error('Fetch MCAP error:', err);
      setError('Failed to fetch MCAP from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMcap();
    const interval = setInterval(fetchMcap, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleVideoError = () => {
    setError('Failed to load video. Please ensure video.mp4 exists in the public folder.');
  };

  return (
    <div className="App">
      <a href="https://x.com" className="x-link" target="_blank" rel="noopener noreferrer">
        <img src="https://abs.twimg.com/favicons/twitter.2.ico" alt="X Logo" />
      </a>
      <h1>PUMP THE TITS!</h1>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <div className="spinner">Loading...</div>
      ) : (
        <p className={`mcap ${direction}`}>
          <span className="arrow">{direction === 'up' ? '↑' : direction === 'down' ? '↓' : ''}</span>
          ${mcap.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
      )}
      <video
        ref={videoRef}
        src="/video.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="mcap-video"
        onError={handleVideoError}
      />
    </div>
  );
}

export default App;