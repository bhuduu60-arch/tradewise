export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") {
      return new Response("Tradewise Telegram bot worker is live.", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const update = await request.json();

      if (update.message) {
        const chatId = update.message.chat.id;
        const text = (update.message.text || "").trim();

        if (text === "/start") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "Welcome to Tradewise Bot.\n\nUse this bot for safer market analysis signals.\n\nCommands:\n/start - show bot status\n/analyze - analyze default pair\n/analyze BTCUSDT - analyze custom pair"
          );
        } else if (text.startsWith("/analyze")) {
          const pair = getRequestedPair(text);
          const market = await getBinanceCandles(pair, "1m", 20);

          if (!market.ok) {
            await sendTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chatId,
              `Could not fetch candle data for pair: ${pair}`
            );
          } else {
            const latestClose = market.closes[market.closes.length - 1];
            const highestHigh = Math.max(...market.highs);
            const lowestLow = Math.min(...market.lows);

            const message =
              `PAIR: ${formatPair(pair)}\n` +
              `TIMEFRAME: 1M\n\n` +
              `Latest Close: ${latestClose}\n` +
              `High (20 candles): ${highestHigh}\n` +
              `Low (20 candles): ${lowestLow}\n\n` +
              `Status: Real OHLC candle data fetched successfully.`;

            await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, message);
          }
        } else {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "Bot is live.\n\nUse /start or /analyze"
          );
        }
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
};

function getRequestedPair(text) {
  const parts = text.split(" ").filter(Boolean);

  if (parts.length < 2) {
    return "BTCUSDT";
  }

  return parts[1].toUpperCase();
}

function formatPair(pair) {
  if (pair.endsWith("USDT")) {
    const base = pair.slice(0, -4);
    return `${base}/USDT`;
  }

  return pair;
}

async function getBinanceCandles(pair, interval = "1m", limit = 20) {
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`
    );

    if (!response.ok) {
      return { ok: false };
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false };
    }

    const opens = data.map(candle => Number(candle[1]));
    const highs = data.map(candle => Number(candle[2]));
    const lows = data.map(candle => Number(candle[3]));
    const closes = data.map(candle => Number(candle[4]));
    const volumes = data.map(candle => Number(candle[5]));

    return {
      ok: true,
      opens,
      highs,
      lows,
      closes,
      volumes
    };
  } catch (error) {
    return { ok: false };
  }
}

async function sendTelegramMessage(token, chatId, text) {
  const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(telegramUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });

  return response;
}
