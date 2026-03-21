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
          const result = await getBinancePrice(pair);

          if (result.ok) {
            const message =
              `PAIR: ${formatPair(pair)}\n` +
              `Latest Price: ${result.price}\n\n` +
              `Status: Live market data fetched successfully.`;

            await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, message);
          } else {
            await sendTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chatId,
              `Could not fetch data for pair: ${pair}`
            );
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

async function getBinancePrice(pair) {
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`
    );

    if (!response.ok) {
      return { ok: false };
    }

    const data = await response.json();

    if (!data.price) {
      return { ok: false };
    }

    return {
      ok: true,
      price: data.price
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
