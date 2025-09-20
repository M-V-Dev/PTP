export const SUBSCRIBE_PUMPFUN_TRADES = `
subscription ($token: String!) {
  Solana {
    DEXTradeByTokens(
      where: { Trade: { Currency: { MintAddress: { is: $token } } } }
      limit: { count: 10 }
      orderBy: { descending: Block_Time }
    ) {
      Block { Time }
      Trade { Side Price Amount BuyAmount SellAmount }
      Transaction { Signature }
    }
  }
}`;
