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
        const message = update.message;
        const chatId = message.chat.id;
        const text = (message.text || "").trim();
        const isOwner = String(chatId) === String(env.OWNER_TELEGRAM_ID);

        await trackUser(env, message);

        if (text === "/start") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            `Welcome to Tradewise Bot.\n\nUse this bot for safer market analysis signals.`,
            getKeyboard(isOwner)
          );
        } else if (isOwner && text.startsWith("/signal ")) {
          const parsed = parseManualSignal(text);

          if (!parsed.ok) {
            await sendTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chatId,
              "Invalid manual signal format.\n\nUse:\n/signal BUY BTCUSDT 82 Strong setup near support",
              getKeyboard(isOwner)
            );
          } else {
            const formattedMessage =
              `📈 MANUAL SIGNAL\n\n` +
              `PAIR: ${formatPair(parsed.pair)}\n` +
              `TIMEFRAME: 1M\n\n` +
              `Signal: ${parsed.signal}\n` +
              `Confidence: ${parsed.confidence}%\n` +
              `Reason: ${parsed.reason}\n\n` +
              `Posted by Owner`;

            await sendTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chatId,
              formattedMessage,
              getKeyboard(isOwner)
            );
          }
        } else if (
          text === "/analyze" ||
          text === "📊 Analyze" ||
          text === "₿ BTCUSDT" ||
          text === "Ξ ETHUSDT" ||
          text.startsWith("/analyze ")
        ) {
          const pair = getRequestedPair(text);
          await handleAnalyze(env, chatId, pair, isOwner);
        } else if (text === "📘 Help") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "Help:\n\nUse /analyze or tap the buttons below to analyze a pair.\n\nThis bot is still in testing/building mode.",
            getKeyboard(isOwner)
          );
        } else if (text === "⚠️ Risk Tips") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "Risk Tips:\n\n- Do not trade every signal\n- Avoid emotional entries\n- Respect no-signal conditions\n- Never stake money you cannot afford to lose",
            getKeyboard(isOwner)
          );
        } else if (text === "👤 My Status") {
          const userData = await getUserData(env, chatId);
          const firstSeen = userData?.first_seen || "unknown";
          const lastSeen = userData?.last_seen || "unknown";

          let statusMessage =
            `Your Chat ID: ${chatId}\nFirst Seen: ${firstSeen}\nLast Seen: ${lastSeen}\n\nUser tracking is active.`;

          if (isOwner) {
            const totalUsers = await getUserCount(env);
            statusMessage += `\n\nOwner View:\nTotal Users: ${totalUsers}`;
          }

          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            statusMessage,
            getKeyboard(isOwner)
          );
        } else if (isOwner && text === "👥 User Stats") {
          const stats = await getDetailedUserStats(env);

          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            `Owner Admin Panel\n\nTotal Users: ${stats.totalUsers}\nActive (24h): ${stats.active24h}\nOwner ID: ${env.OWNER_TELEGRAM_ID}\nMode: Testing / Admin Layer Active`,
            getKeyboard(isOwner)
          );
        } else if (isOwner && text === "📢 Broadcast") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "Broadcast mode will be added next.\n\nPlanned format:\n/broadcast your message here",
            getKeyboard(isOwner)
          );
        } else if (isOwner && text === "📈 Drop Signal") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "Manual signal command is now active.\n\nUse:\n/signal BUY BTCUSDT 82 Strong setup near support",
            getKeyboard(isOwner)
          );
        } else {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "Bot is live.\n\nUse the buttons below or /analyze",
            getKeyboard(isOwner)
          );
        }
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
};

async function handleAnalyze(env, chatId, pair, isOwner) {
  const market = await getBinanceCandles(pair, "1m", 30);

  if (!market.ok) {
    await sendTelegramMessage(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      `Could not fetch candle data for pair: ${pair}`,
      getKeyboard(isOwner)
    );
    return;
  }

  const latestClose = market.closes[market.closes.length - 1];
  const rsi = calculateRSI(market.closes, 14);
  const trend = detectTrend(market.closes);
  const marketState = getMarketState(rsi);
  const movingAverage = calculateSMA(market.closes, 20);
  const bands = calculateBollingerBands(market.closes, 20, 2);
  const support = Math.min(...market.lows.slice(-20));
  const resistance = Math.max(...market.highs.slice(-20));

  const signalResult = generateSignal({
    latestClose,
    rsi,
    trend,
    movingAverage,
    bands,
    support,
    resistance
  });

  const message =
    `PAIR: ${formatPair(pair)}\n` +
    `TIMEFRAME: 1M\n\n` +
    `Trend: ${trend}\n` +
    `RSI: ${rsi.toFixed(2)}\n` +
    `Market State: ${marketState}\n` +
    `MA(20): ${movingAverage.toFixed(2)}\n` +
    `BB Upper: ${bands.upper.toFixed(2)}\n` +
    `BB Lower: ${bands.lower.toFixed(2)}\n` +
    `Support: ${support.toFixed(2)}\n` +
    `Resistance: ${resistance.toFixed(2)}\n\n` +
    `Signal: ${signalResult.signal}\n` +
    `Confidence: ${signalResult.confidence}%\n` +
    `Reason: ${signalResult.reason}\n\n` +
    `Status: Testing signal layer 2 with UI buttons, user tracking, and admin layer.`;

  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, message, getKeyboard(isOwner));
}

function parseManualSignal(text) {
  const parts = text.split(" ").filter(Boolean);

  if (parts.length < 5) {
    return { ok: false };
  }

  const signal = parts[1].toUpperCase();
  const pair = parts[2].toUpperCase();
  const confidence = Number(parts[3]);
  const reason = parts.slice(4).join(" ");

  const validSignals = ["BUY", "SELL", "NO_SIGNAL", "NO-SIGNAL", "NO"];

  if (!validSignals.includes(signal)) {
    return { ok: false };
  }

  if (!pair || Number.isNaN(confidence) || confidence < 0 || confidence > 100 || !reason) {
    return { ok: false };
  }

  return {
    ok: true,
    signal: signal === "NO" ? "NO SIGNAL" : signal.replace("_", " "),
    pair,
    confidence,
    reason
  };
}

async function trackUser(env, message) {
  if (!env.USERS_KV || !message || !message.chat) {
    return;
  }

  const chatId = String(message.chat.id);
  const key = `user:${chatId}`;
  const existing = await env.USERS_KV.get(key);
  const now = new Date().toISOString();

  let userData = null;

  if (existing) {
    userData = JSON.parse(existing);
    userData.last_seen = now;
  } else {
    userData = {
      chat_id: chatId,
      username: message.from?.username || "",
      first_name: message.from?.first_name || "",
      first_seen: now,
      last_seen: now
    };

    const countRaw = await env.USERS_KV.get("stats:total_users");
    const currentCount = Number(countRaw || "0");
    await env.USERS_KV.put("stats:total_users", String(currentCount + 1));
  }

  await env.USERS_KV.put(key, JSON.stringify(userData));
}

async function getUserCount(env) {
  if (!env.USERS_KV) {
    return 0;
  }

  const countRaw = await env.USERS_KV.get("stats:total_users");
  return Number(countRaw || "0");
}

async function getUserData(env, chatId) {
  if (!env.USERS_KV) {
    return null;
  }

  const raw = await env.USERS_KV.get(`user:${chatId}`);

  if (!raw) {
    return null;
  }

  return JSON.parse(raw);
}

async function getDetailedUserStats(env) {
  if (!env.USERS_KV) {
    return {
      totalUsers: 0,
      active24h: 0
    };
  }

  const list = await env.USERS_KV.list({ prefix: "user:" });
  const now = Date.now();
  let active24h = 0;

  for (const key of list.keys) {
    const raw = await env.USERS_KV.get(key.name);

    if (!raw) {
      continue;
    }

    const user = JSON.parse(raw);
    const lastSeenTime = new Date(user.last_seen).getTime();

    if (!Number.isNaN(lastSeenTime)) {
      const hoursSinceSeen = (now - lastSeenTime) / (1000 * 60 * 60);
      if (hoursSinceSeen <= 24) {
        active24h += 1;
      }
    }
  }

  return {
    totalUsers: list.keys.length,
    active24h
  };
}

function getRequestedPair(text) {
  if (text === "₿ BTCUSDT") {
    return "BTCUSDT";
  }

  if (text === "Ξ ETHUSDT") {
    return "ETHUSDT";
  }

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

function getKeyboard(isOwner = false) {
  const keyboard = [
    [{ text: "📊 Analyze" }, { text: "₿ BTCUSDT" }, { text: "Ξ ETHUSDT" }],
    [{ text: "📘 Help" }, { text: "⚠️ Risk Tips" }],
    [{ text: "👤 My Status" }]
  ];

  if (isOwner) {
    keyboard.push([{ text: "👥 User Stats" }, { text: "📢 Broadcast" }]);
    keyboard.push([{ text: "📈 Drop Signal" }]);
  }

  return {
    keyboard,
    resize_keyboard: true,
    is_persistent: true
  };
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

function calculateSMA(values, period = 20) {
  if (!values || values.length < period) {
    return values[values.length - 1] || 0;
  }

  const recent = values.slice(-period);
  return average(recent);
}

function calculateBollingerBands(values, period = 20, multiplier = 2) {
  if (!values || values.length < period) {
    const fallback = values[values.length - 1] || 0;
    return {
      upper: fallback,
      middle: fallback,
      lower: fallback
    };
  }

  const recent = values.slice(-period);
  const middle = average(recent);
  const variance =
    recent.reduce((sum, value) => sum + Math.pow(value - middle, 2), 0) / period;
  const standardDeviation = Math.sqrt(variance);

  return {
    upper: middle + multiplier * standardDeviation,
    middle,
    lower: middle - multiplier * standardDeviation
  };
}

function generateSignal(data) {
  const { latestClose, rsi, trend, bands, support, resistance } = data;

  const bandRange = bands.upper - bands.lower || 1;
  const distanceToLowerBand = Math.abs(latestClose - bands.lower) / bandRange;
  const distanceToUpperBand = Math.abs(latestClose - bands.upper) / bandRange;

  const nearLowerBand = distanceToLowerBand <= 0.15;
  const nearUpperBand = distanceToUpperBand <= 0.15;
  const nearSupport = Math.abs(latestClose - support) / latestClose <= 0.003;
  const nearResistance = Math.abs(latestClose - resistance) / latestClose <= 0.003;

  let signal = "NO SIGNAL";
  let confidence = 55;
  let reason = "Conditions are mixed. Safer to wait.";

  if ((nearLowerBand || nearSupport) && rsi <= 35 && trend !== "Down") {
    signal = "BUY";
    confidence = 78;
    reason = "Price is near lower band/support with RSI weakness and no strong downtrend.";

    if (trend === "Up") {
      confidence += 7;
      reason = "Price is near lower band/support, RSI is weak, and trend is turning upward.";
    }

    if (nearLowerBand && nearSupport) {
      confidence += 5;
    }
  } else if ((nearUpperBand || nearResistance) && rsi >= 65 && trend !== "Up") {
    signal = "SELL";
    confidence = 78;
    reason = "Price is near upper band/resistance with RSI strength and no strong uptrend.";

    if (trend === "Down") {
      confidence += 7;
      reason = "Price is near upper band/resistance, RSI is elevated, and trend is turning downward.";
    }

    if (nearUpperBand && nearResistance) {
      confidence += 5;
    }
  }

  if (confidence > 95) {
    confidence = 95;
  }

  return {
    signal,
    confidence,
    reason
  };
}

function average(values) {
  if (!values || values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

async function sendTelegramMessage(token, chatId, text, replyMarkup = null) {
  const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: text
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  const response = await fetch(telegramUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return response;
}
