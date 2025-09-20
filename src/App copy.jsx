import React, { useState } from "react";
import { usePumpfunTokenTrades } from "./usePumpfunTokenTrades";

export default function App() {
  const [tokenKey, setTokenKey] = useState("2nvMtPVaj8DSgka8UFJNiipREEdbzJAg9WfnTvEjpump");
  const trades = usePumpfunTokenTrades([tokenKey]);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Pumpfun Token Trades</h1>

      <input
        type="text"
        placeholder="Enter token key"
        value={tokenKey}
        onChange={(e) => setTokenKey(e.target.value)}
        style={{ width: "400px", padding: "8px", marginBottom: "20px" }}
      />

      {trades.length === 0 ? (
        <p>No trades yet.</p>
      ) : (
        <ul>
          {trades.map((trade, idx) => (
            <li key={idx} style={{ marginBottom: "15px" }}>
              <pre>{JSON.stringify(trade, null, 2)}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
