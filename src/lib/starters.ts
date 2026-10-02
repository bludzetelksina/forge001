import type { LanguageId, TemplateFile } from "./languages";

export type Starter = {
  id: string;
  label: string;
  blurb: string;
  language: LanguageId;
  entry: string;
  files: TemplateFile[];
};

const BOT_NOTE = `Forge's Run button can't keep a bot online: the run sandbox has no network
and stops after a few seconds. Run here to test your replies with the built-in
simulator. To go live, push the project to GitHub (Git tab) and deploy it on a
host that runs long-lived processes, with the token set as an environment variable.`;

export const STARTERS: Starter[] = [
  {
    id: "discord-bot-python",
    label: "Discord Bot (Python)",
    blurb: "discord.py bot with a local message simulator",
    language: "python",
    entry: "main.py",
    files: [
      {
        path: "main.py",
        content: `import os

from commands import reply_to

TOKEN = os.environ.get("DISCORD_TOKEN")


def simulate():
    print("No DISCORD_TOKEN set - running the simulator.")
    for text in ["!ping", "!hello Ada", "!roll", "just chatting"]:
        print(f"> {text}")
        print(f"< {reply_to(text) or '(no reply)'}")


def run_live():
    import discord  # pip install discord.py

    intents = discord.Intents.default()
    intents.message_content = True
    client = discord.Client(intents=intents)

    @client.event
    async def on_message(message):
        if message.author == client.user:
            return
        answer = reply_to(message.content)
        if answer:
            await message.channel.send(answer)

    client.run(TOKEN)


if __name__ == "__main__":
    run_live() if TOKEN else simulate()
`,
      },
      {
        path: "commands.py",
        content: `import random


def reply_to(text: str):
    if text == "!ping":
        return "pong"
    if text.startswith("!hello"):
        name = text.removeprefix("!hello").strip() or "there"
        return f"Hello, {name}!"
    if text == "!roll":
        return f"You rolled {random.randint(1, 6)}"
    return None
`,
      },
      { path: "README.md", content: `# Discord bot\n\n${BOT_NOTE}\n\nDependencies: \`pip install discord.py\`\n` },
    ],
  },
  {
    id: "discord-bot-js",
    label: "Discord Bot (JavaScript)",
    blurb: "discord.js bot with a local message simulator",
    language: "javascript",
    entry: "main.js",
    files: [
      {
        path: "main.js",
        content: `const { replyTo } = require("./commands.js");

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.log("No DISCORD_TOKEN set - running the simulator.");
  for (const text of ["!ping", "!hello Ada", "!roll", "just chatting"]) {
    console.log("> " + text);
    console.log("< " + (replyTo(text) ?? "(no reply)"));
  }
} else {
  const { Client, GatewayIntentBits } = require("discord.js"); // npm i discord.js
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });
  client.on("messageCreate", (message) => {
    if (message.author.bot) return;
    const answer = replyTo(message.content);
    if (answer) message.channel.send(answer);
  });
  client.login(TOKEN);
}
`,
      },
      {
        path: "commands.js",
        content: `function replyTo(text) {
  if (text === "!ping") return "pong";
  if (text.startsWith("!hello")) return \`Hello, \${text.slice(6).trim() || "there"}!\`;
  if (text === "!roll") return \`You rolled \${1 + Math.floor(Math.random() * 6)}\`;
  return null;
}

module.exports = { replyTo };
`,
      },
      { path: "README.md", content: `# Discord bot\n\n${BOT_NOTE}\n\nDependencies: \`npm i discord.js\`\n` },
    ],
  },
  {
    id: "telegram-bot-python",
    label: "Telegram Bot (Python)",
    blurb: "python-telegram-bot with a local simulator",
    language: "python",
    entry: "main.py",
    files: [
      {
        path: "main.py",
        content: `import os

from handlers import reply_to

TOKEN = os.environ.get("TELEGRAM_TOKEN")


def simulate():
    print("No TELEGRAM_TOKEN set - running the simulator.")
    for text in ["/start", "/echo hi there", "/time", "random text"]:
        print(f"> {text}")
        print(f"< {reply_to(text)}")


def run_live():
    from telegram.ext import Application, MessageHandler, filters  # pip install python-telegram-bot

    async def on_text(update, context):
        await update.message.reply_text(reply_to(update.message.text))

    app = Application.builder().token(TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT, on_text))
    app.run_polling()


if __name__ == "__main__":
    run_live() if TOKEN else simulate()
`,
      },
      {
        path: "handlers.py",
        content: `from datetime import datetime, timezone


def reply_to(text: str) -> str:
    if text == "/start":
        return "Hi! Try /echo or /time."
    if text.startswith("/echo"):
        return text.removeprefix("/echo").strip() or "(nothing to echo)"
    if text == "/time":
        return datetime.now(timezone.utc).strftime("%H:%M UTC")
    return "I only know /start, /echo and /time."
`,
      },
      {
        path: "README.md",
        content: `# Telegram bot\n\n${BOT_NOTE}\n\nGet a token from @BotFather. Dependencies: \`pip install python-telegram-bot\`\n`,
      },
    ],
  },
  {
    id: "telegram-bot-js",
    label: "Telegram Bot (JavaScript)",
    blurb: "Plain Bot API long polling, no dependencies",
    language: "javascript",
    entry: "main.js",
    files: [
      {
        path: "main.js",
        content: `const { replyTo } = require("./handlers.js");

const TOKEN = process.env.TELEGRAM_TOKEN;

async function live() {
  const api = (method, body) =>
    fetch(\`https://api.telegram.org/bot\${TOKEN}/\${method}\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  let offset = 0;
  for (;;) {
    const { result = [] } = await api("getUpdates", { offset, timeout: 30 });
    for (const update of result) {
      offset = update.update_id + 1;
      const msg = update.message;
      if (msg?.text) await api("sendMessage", { chat_id: msg.chat.id, text: replyTo(msg.text) });
    }
  }
}

if (TOKEN) live();
else {
  console.log("No TELEGRAM_TOKEN set - running the simulator.");
  for (const text of ["/start", "/echo hi there", "/time", "random text"]) {
    console.log("> " + text);
    console.log("< " + replyTo(text));
  }
}
`,
      },
      {
        path: "handlers.js",
        content: `function replyTo(text) {
  if (text === "/start") return "Hi! Try /echo or /time.";
  if (text.startsWith("/echo")) return text.slice(5).trim() || "(nothing to echo)";
  if (text === "/time") return new Date().toISOString().slice(11, 16) + " UTC";
  return "I only know /start, /echo and /time.";
}

module.exports = { replyTo };
`,
      },
      { path: "README.md", content: `# Telegram bot\n\n${BOT_NOTE}\n\nGet a token from @BotFather.\n` },
    ],
  },
];
