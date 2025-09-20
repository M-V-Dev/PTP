import { createClient } from "graphql-ws";

const BITQUERY_API_KEY = import.meta.env.VITE_BITQUERY_API_KEY;

export const client = createClient({
  url: "wss://streaming.bitquery.io/eap",
  connectionParams: {
    headers: {
      "X-API-KEY": BITQUERY_API_KEY,
    },
  },
});
