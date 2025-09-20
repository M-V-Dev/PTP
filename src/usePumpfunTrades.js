import { useEffect, useState } from "react";
import WebSocket from "ws"; // use 'ws' in Node or native WebSocket in browser

export function usePumpfunTokenTrades(tokenKeys = []) {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    if (!tokenKeys.length) return;

    // For browser, use: const ws = new WebSocket('wss://pumpportal.fun/api/data');
    const ws = new WebSocket("wss://pumpportal.fun/api/data");

    ws.onopen = () => {
      // Subscribe to trades for token(s)
      const payload = {
        method: "subscribeTokenTrade",
        keys: tokenKeys,
      };
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Append new trade at the top
        setTrades((prev) => [data, ...prev].slice(0, 50)); // keep last 50 trades
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);

    ws.onclose = () => console.log("WebSocket closed");

    return () => ws.close();
  }, [tokenKeys]);

  return trades;
}
