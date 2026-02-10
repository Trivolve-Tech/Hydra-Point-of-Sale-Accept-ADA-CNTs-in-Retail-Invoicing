import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import type { Currency } from "~/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const response = await axios.get<{
    market_data: {
      current_price: Record<Currency, number>;
    };
  }>("https://api.coingecko.com/api/v3/coins/cardano", {
    params: {
      localization: false,
      tickers: false,
      market_data: true,
      community_data: false,
      developer_data: false,
      sparkline: false,
    },
  });

  res.status(200).json(response.data.market_data.current_price);
}
