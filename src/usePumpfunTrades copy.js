
import { useEffect, useState } from "react";
import axios from "axios";

const API_KEY = "ory_at_-YdPSuBOogHykunnA7VE68qhYXw4_aKMdYHuYajISuo.80XZKv0rY2aXTB2yy911pXjlQrMfnQFelkzdZiYh0oY	";


export function usePumpfunTrades(tokenMint, interval = 5000) {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    if (!tokenMint) return;

    let timer;

    const fetchTradesForSide = async (side) => {
      const query = `
        subscription MyQuery {
          Solana {
            DEXTrades(
              where: {
                Trade: {
                  Dex: { ProtocolName: { is: "pump" } },
                  ${side}: { Currency: { MintAddress: { is: "${tokenMint}" } } }
                },
                Transaction: { Result: { Success: true } }
              },
              limit: { count: 20 },
              orderBy: { descending: Block_Time }
            ) {
              Instruction { Program { Method } }
              Trade {
                Dex { ProtocolFamily ProtocolName }
                Buy { Amount Account { Address } Currency { Name Symbol MintAddress Decimals } }
                Sell { Amount Account { Address } Currency { Name Symbol MintAddress Decimals } }
              }
              Transaction { Signature }
            }
          }
        }
      `;

      try {
        const response = await axios.post(
          "https://streaming.bitquery.io/eap",
          { query, variables: "{}" },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${API_KEY}`,
            },
          }
        );

        return response.data?.data?.Solana?.DEXTrades || [];
      } catch (err) {
        console.error(`Bitquery error (${side}):`, err);
        return [];
      }
    };

    const fetchTrades = async () => {
      const [buyTrades, sellTrades] = await Promise.all([
        fetchTradesForSide("Buy"),
        fetchTradesForSide("Sell"),
      ]);

      // Merge and sort by Block_Time descending
      const allTrades = [...buyTrades, ...sellTrades]
        .sort((a, b) => new Date(b.Transaction.Block_Time) - new Date(a.Transaction.Block_Time))
        .slice(0, 50);

      setTrades(allTrades);
    };

    // fetch immediately and then every interval
    fetchTrades();
    timer = setInterval(fetchTrades, interval);

    return () => clearInterval(timer);
  }, [tokenMint, interval]);

  return trades;
}

