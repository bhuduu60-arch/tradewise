export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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
        } else {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "Bot is live. For now, use /start"
          );
        }
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
};

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
