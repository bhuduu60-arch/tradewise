export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") {
      return new Response("Tradewise bot is live.", {
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
        const lowerText = text.toLowerCase();
        const isOwner = String(chatId) === String(env.OWNER_TELEGRAM_ID);

        await trackUser(env, message);

        if (text === "/start") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            `👋 Welcome to Tradewise\n\nUse this bot for safer short-term market analysis signals.`,
            getKeyboard(isOwner)
          );
        } else if (isOwner && text.startsWith("/broadcast ")) {
          const broadcastText = text.replace("/broadcast", "").trim();

          if (!broadcastText) {
            await sendTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chatId,
              "📢 Broadcast message cannot be empty.\n\nUse:\n/broadcast Your message here",
              getKeyboard(isOwner)
            );
          } else {
            const result = await broadcastToUsers(env, broadcastText);

            await sendTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chatId,
              `📢 Broadcast Complete\n\n✅ Sent: ${result.sent}\n❌ Failed: ${result.failed}`,
              getKeyboard(isOwner)
            );
          }
        } else if (isOwner && text.startsWith("/signal ")) {
          const parsed = parseManualSignal(text);

          if (!parsed.ok) {
            await sendTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chatId,
              "⚠️ Invalid manual signal format.\n\nUse:\n/signal BUY BTCUSDT 82 Strong setup near support",
              getKeyboard(isOwner)
            );
          } else {
            const formattedMessage =
              `📈 MANUAL SIGNAL\n\n` +
              `💱 Pair: ${formatPair(parsed.pair)}\n` +
              `⏱ Timeframe: 1M\n\n` +
              `📌 Signal: ${parsed.signal}\n` +
              `🎯 Confidence: ${parsed.confidence}%\n` +
              `📝 Reason: ${parsed.reason}\n\n` +
              `👑 Posted by Owner`;

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
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "🔎 Predicting safe market signal...",
            getKeyboard(isOwner)
          );
          await sleep(2200);
          await handleAnalyze(env, chatId, pair, isOwner, false);
        } else if (text === "⚡ Test Signal") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "⚡ Predicting forced directional signal...",
            getKeyboard(isOwner)
          );
          await sleep(2200);
          await handleAnalyze(env, chatId, "BTCUSDT", isOwner, true);
        } else if (text === "🧠 Ask AI") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "🧠 Tradewise Help Assistant\n\nChoose a question below or type your own trading help question.",
            getAIKeyboard()
          );
        } else if (text === "⬅️ Back to Main") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "⬅️ Returned to main menu.",
            getKeyboard(isOwner)
          );
        } else if (text === "📘 Help") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "📘 Help\n\nUse /analyze or tap the buttons below to analyze a pair.",
            getKeyboard(isOwner)
          );
        } else if (text === "⚠️ Risk Tips") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "⚠️ Risk Tips\n\n- Do not trade every signal\n- Avoid emotional entries\n- Respect no-signal conditions\n- Never stake money you cannot afford to lose",
            getKeyboard(isOwner)
          );
        } else if (text === "👤 My Status") {
          const userData = await getUserData(env, chatId);
          const firstSeen = userData?.first_seen || "unknown";
          const lastSeen = userData?.last_seen || "unknown";

          let statusMessage =
            `👤 Your Status\n\n🆔 Chat ID: ${chatId}\n🕒 First Seen: ${firstSeen}\n🕘 Last Seen: ${lastSeen}\n\n✅ User tracking is active.`;

          if (isOwner) {
            const totalUsers = await getUserCount(env);
            statusMessage += `\n\n👑 Owner View\n👥 Total Users: ${totalUsers}`;
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
            `👥 Owner Admin Panel\n\n👤 Total Users: ${stats.totalUsers}\n🕒 Active (24h): ${stats.active24h}\n🆔 Owner ID: ${env.OWNER_TELEGRAM_ID}`,
            getKeyboard(isOwner)
          );
        } else if (isOwner && text === "📢 Broadcast") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "📢 Broadcast command is active.\n\nUse:\n/broadcast Your message here",
            getKeyboard(isOwner)
          );
        } else if (isOwner && text === "📈 Drop Signal") {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "📈 Manual signal command is active.\n\nUse:\n/signal BUY BTCUSDT 82 Strong setup near support",
            getKeyboard(isOwner)
          );
        } else {
          const helpReply = getHelpAnswer(lowerText);

          if (helpReply) {
            const useAIKeyboard = isAIQuestion(text);
            await sendTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chatId,
              helpReply,
              useAIKeyboard ? getAIKeyboard() : getKeyboard(isOwner)
            );
          } else {
            await sendTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chatId,
              "🤖 Bot is live.\n\nUse the buttons below or /analyze.\n\nIf you want help, tap 🧠 Ask AI.",
              getKeyboard(isOwner)
            );
          }
        }
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleAnalyze(env, chatId, pair, isOwner, forceSignal = false) {
  const market1m = await getBinanceCandles(pair, "1m", 30);
  const market5m = await getBinanceCandles(pair, "5m", 30);

  if (!market1m.ok || !market5m.ok) {
    await sendTelegramMessage(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      `⚠️ Could not fetch candle data for pair: ${pair}`,
      getKeyboard(isOwner)
    );
    return;
  }

  const latestClose = market1m.closes[market1m.closes.length - 1];
  const rsi = calculateRSI(market1m.closes, 14);
  const trend = detectTrend(market1m.closes);
  const higherTrend = detectTrend(market5m.closes);
  const marketState = getMarketState(rsi);
  const movingAverage = calculateSMA(market1m.closes, 20);
  const bands = calculateBollingerBands(market1m.closes, 20, 2);
  const support = Math.min(...market1m.lows.slice(-20));
  const resistance = Math.max(...market1m.highs.slice(-20));
  const volatility = calculateVolatilityState(market1m.highs, market1m.lows, market1m.closes);
  const compression = detectCompression(market1m.highs, market1m.lows, market1m.closes);
  const momentum = detectMomentumBurst(market1m.closes);

  const signalResult = forceSignal
    ? generateForcedSignal({
        latestClose,
        rsi,
        trend,
        higherTrend,
        movingAverage,
        bands,
        support,
        resistance,
        volatility,
        compression,
        momentum
      })
    : generateSignal({
        latestClose,
        rsi,
        trend,
        higherTrend,
        movingAverage,
        bands,
        support,
        resistance,
        volatility,
        compression,
        momentum
      });

  const header = forceSignal ? "⚡ TRADEWISE TEST SIGNAL" : "📊 TRADEWISE ANALYSIS";
  const modeLabel = forceSignal ? "Test Mode" : "Safe Mode";

  const message =
    `${header}\n\n` +
    `💱 Pair: ${formatPair(pair)}\n` +
    `⏱ Timeframe: 1M\n` +
    `🧭 5M Trend: ${higherTrend}\n` +
    `🛠 Mode: ${modeLabel}\n\n` +
    `📈 Trend: ${trend}\n` +
    `📍 Market State: ${marketState}\n` +
    `📉 RSI: ${rsi.toFixed(2)}\n` +
    `🌪 Volatility: ${volatility.state}\n` +
    `🗜 Compression: ${compression.isCompressed ? "Yes" : "No"}\n` +
    `🚀 Momentum: ${momentum.state}\n\n` +
    `📌 Signal: ${signalResult.signal}\n` +
    `🏷 Quality: ${signalResult.quality}\n` +
    `🎯 Confidence: ${signalResult.confidence}%\n` +
    `🎲 Entry Type: ${signalResult.entryType}\n` +
    `⏳ Suggested Expiry: ${signalResult.expiry}\n` +
    `💰 Stake Style: ${signalResult.stakeStyle}\n` +
    `📝 Reason: ${signalResult.reason}\n\n` +
    `🛡 Support: ${support.toFixed(2)}\n` +
    `🚧 Resistance: ${resistance.toFixed(2)}\n` +
    `📊 MA(20): ${movingAverage.toFixed(2)}\n` +
    `🔼 BB Upper: ${bands.upper.toFixed(2)}\n` +
    `➖ BB Middle: ${bands.middle.toFixed(2)}\n` +
    `🔽 BB Lower: ${bands.lower.toFixed(2)}\n\n` +
    (forceSignal
      ? `⚠️ Test Signal mode always returns BUY or SELL for live observation.`
      : `⚠️ Safer setups are preferred. If the bot says NO SIGNAL, avoid forcing entry.`);

  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, message, getKeyboard(isOwner));
}

function detectMomentumBurst(closes) {
  if (!closes || closes.length < 6) {
    return { state: "Flat", score: 0 };
  }

  const recent = closes.slice(-4);
  let upMoves = 0;
  let downMoves = 0;

  for (let i = 1; i < recent.length; i++) {
    if (recent[i] > recent[i - 1]) upMoves += 1;
    if (recent[i] < recent[i - 1]) downMoves += 1;
  }

  if (upMoves >= 3) {
    return { state: "Bullish Burst", score: 3 };
  }

  if (downMoves >= 3) {
    return { state: "Bearish Burst", score: -3 };
  }

  if (upMoves === 2 && downMoves <= 1) {
    return { state: "Mild Bullish", score: 1 };
  }

  if (downMoves === 2 && upMoves <= 1) {
    return { state: "Mild Bearish", score: -1 };
  }

  return { state: "Flat", score: 0 };
}

function getHelpAnswer(text) {
  if (text.includes("what is rsi") || text === "rsi" || text.includes("meaning of rsi")) {
    return "📉 RSI means Relative Strength Index.\n\nIt helps show whether price is relatively overstretched.\n- Below 30 can suggest oversold pressure\n- Above 70 can suggest overbought pressure\n\n⚠️ RSI alone is not enough. It should be combined with trend and price location.";
  }

  if (text.includes("no signal") || text.includes("what does no signal mean")) {
    return "🚫 NO SIGNAL means the bot does not see a safer edge right now.\n\nThat is a good thing, not a bad thing.\nIt helps reduce random entries and overtrading.";
  }

  if (text.includes("avoid trading") || text.includes("when should i avoid trading")) {
    return "⚠️ Avoid trading when:\n- the bot says NO SIGNAL\n- RSI is neutral and trend is sideways\n- volatility is too low\n- compression is tight without clear breakout\n- you feel emotional or rushed";
  }

  if (text.includes("volatility")) {
    return "🌪 Volatility shows how much price is moving.\n\n- Low volatility can mean the market is too flat\n- High volatility can mean the market is noisy or risky\n\nThe bot uses volatility to reduce weak or messy setups.";
  }

  if (text.includes("compression")) {
    return "🗜 Compression means price is squeezing into a tighter range.\n\nThis often means the market is storing energy, but direction may still be unclear.\nThe bot usually becomes more careful during compression.";
  }

  if (text.includes("confidence")) {
    return "🎯 Confidence is the bot's strength estimate for a setup.\n\nHigher confidence means more conditions aligned.\nBut confidence is not a guarantee. It is only a decision aid.";
  }

  if (text.includes("support") || text.includes("resistance")) {
    return "🛡 Support is an area where price may react upward.\n🚧 Resistance is an area where price may react downward.\n\nThe bot checks these zones to avoid entering blindly into barriers.";
  }

  if (text.includes("bollinger") || text.includes("band")) {
    return "📊 Bollinger Bands help show whether price is stretched away from its recent average.\n\n- Near lower band may support BUY setups\n- Near upper band may support SELL setups\n\nThe bot combines this with RSI and trend.";
  }

  if (text.includes("trend")) {
    return "📈 Trend tells whether price is generally pushing up, down, or sideways.\n\nThe bot avoids taking reversal signals directly against a strong trend when possible.";
  }

  return null;
}

function isAIQuestion(text) {
  const aiQuestions = [
    "What is RSI?",
    "What does NO SIGNAL mean?",
    "When should I avoid trading?",
    "What is volatility?",
    "What is compression?",
    "What is confidence?",
    "What is support and resistance?"
  ];

  return aiQuestions.includes(text);
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

async function broadcastToUsers(env, messageText) {
  if (!env.USERS_KV) {
    return { sent: 0, failed: 0 };
  }

  const list = await env.USERS_KV.list({ prefix: "user:" });
  let sent = 0;
  let failed = 0;

  for (const key of list.keys) {
    const raw = await env.USERS_KV.get(key.name);

    if (!raw) {
      failed += 1;
      continue;
    }

    const user = JSON.parse(raw);
    const targetChatId = user.chat_id;

    try {
      const response = await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        targetChatId,
        `📢 OWNER BROADCAST\n\n${messageText}`
      );

      if (response.ok) {
        sent += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      failed += 1;
    }
  }

  return { sent, failed };
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
  if (text === "📊 Analyze" || text === "/analyze") {
    return "BTCUSDT";
  }

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
    [{ text: "⚡ Test Signal" }, { text: "🧠 Ask AI" }],
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

function getAIKeyboard() {
  return {
    keyboard: [
      [{ text: "What is RSI?" }, { text: "What does NO SIGNAL mean?" }],
      [{ text: "When should I avoid trading?" }, { text: "What is volatility?" }],
      [{ text: "What is compression?" }, { text: "What is confidence?" }],
      [{ text: "What is support and resistance?" }],
      [{ text: "⬅️ Back to Main" }]
    ],
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

    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;

  if (averageLoss === 0) return 100;

  const rs = averageGain / averageLoss;
  return 100 - (100 / (1 + rs));
}

function detectTrend(closes) {
  if (!closes || closes.length < 10) return "Sideways";

  const recent = closes.slice(-5);
  const older = closes.slice(-10, -5);

  const recentAverage = average(recent);
  const olderAverage = average(older);

  if (recentAverage > olderAverage * 1.001) return "Up";
  if (recentAverage < olderAverage * 0.999) return "Down";

  return "Sideways";
}

function getMarketState(rsi) {
  if (rsi >= 70) return "Overbought";
  if (rsi <= 30) return "Oversold";
  return "Neutral";
}

function calculateSMA(values, period = 20) {
  if (!values || values.length < period) return values[values.length - 1] || 0;
  return average(values.slice(-period));
}

function calculateBollingerBands(values, period = 20, multiplier = 2) {
  if (!values || values.length < period) {
    const fallback = values[values.length - 1] || 0;
    return { upper: fallback, middle: fallback, lower: fallback };
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

function calculateVolatilityState(highs, lows, closes) {
  if (!highs || !lows || !closes || closes.length < 10) {
    return { state: "Normal", ratio: 0 };
  }

  const recentHighs = highs.slice(-10);
  const recentLows = lows.slice(-10);
  const recentRanges = recentHighs.map((high, index) => high - recentLows[index]);
  const averageRange = average(recentRanges);
  const latestClose = closes[closes.length - 1];
  const rangeRatio = latestClose > 0 ? averageRange / latestClose : 0;

  if (rangeRatio < 0.0008) return { state: "Low", ratio: rangeRatio };
  if (rangeRatio > 0.0035) return { state: "High", ratio: rangeRatio };
  return { state: "Normal", ratio: rangeRatio };
}

function detectCompression(highs, lows, closes) {
  if (!highs || !lows || !closes || closes.length < 20) {
    return { isCompressed: false, ratio: 0 };
  }

  const recentHighs = highs.slice(-8);
  const recentLows = lows.slice(-8);
  const recentMax = Math.max(...recentHighs);
  const recentMin = Math.min(...recentLows);
  const latestClose = closes[closes.length - 1];
  const compressionRatio = latestClose > 0 ? (recentMax - recentMin) / latestClose : 0;

  return {
    isCompressed: compressionRatio < 0.0018,
    ratio: compressionRatio
  };
}
