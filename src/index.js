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
          const market = await getBinanceCandles(pair, "1m", 30);

          if (!market.ok) {
            await sendTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chatId,
              `Could not fetch candle data for pair: ${pair}`
            );
          } else {
            const latestClose = market.closes[market.closes.length - 1];
            const rsi = calculateRSI(market.closes, 14);
            const trend = detectTrend(market.closes);
            const marketState = getMarketState(rsi);

            const message =
              `PAIR: ${formatPair(pair)}\n` +
              `TIMEFRAME: 1M\n\n` +
              `Latest Close: ${latestClose}\n` +
              `RSI: ${rsi.toFixed(2)}\n` +
              `Trend: ${trend}\n` +
              `Market State: ${marketState}\n\n` +
              `Status: Testing analysis layer 1 (RSI + trend + market state).`;

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

async function getBinanceCandles(pair, interval = "1m", limit = 30) {
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

function calculateRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];

    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;

  if (averageLoss === 0) {
    return 100;
  }

  const rs = averageGain / averageLoss;
  return 100 - (100 / (1 + rs));
}

function detectTrend(closes) {
  if (!closes || closes.length < 10) {
    return "Sideways";
  }

  const recent = closes.slice(-5);
  const older = closes.slice(-10, -5);

  const recentAverage = average(recent);
  const olderAverage = average(older);

  if (recentAverage > olderAverage * 1.001) {
    return "Up";
  }

  if (recentAverage < olderAverage * 0.999) {
    return "Down";
  }

  return "Sideways";
}

function getMarketState(rsi) {
  if (rsi >= 70) {
    return "Overbought";
  }

  if (rsi <= 30) {
    return "Oversold";
  }

  return "Neutral";
}

function average(values) {
  if (!values || values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
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
