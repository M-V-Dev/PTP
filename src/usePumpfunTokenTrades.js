// usePumpfunTokenTrades.js
import { useEffect, useState } from "react";

export function usePumpfunTokenTrades(tokenKey) {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const ws = new WebSocket("wss://pumpportal.fun/api/data");

    ws.onopen = () => {
      ws.send(JSON.stringify({
        method: "subscribeTokenTrade",
        keys: [tokenKey]
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.txType) {
        setTrades(prev => [data, ...prev]);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };

    return () => {
      ws.close();
    };
  }, [tokenKey]);

  return trades;
}
