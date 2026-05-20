import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Telegraf } from 'telegraf';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// ============================================================
// RATE LIMITING
// ============================================================

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Strict rate limiter for sensitive endpoints (verify, cron)
 * 20 requests per 15 minutes per IP
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded for this endpoint.' },
});

/**
 * Telegram webhook rate limiter
 * 30 requests per minute per chat ID (per user)
 */
const telegramLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Please wait a moment before sending another message.',
});

// ============================================================
// FIREBASE ADMIN SETUP
// ============================================================

// Initialize Firebase Admin
let firebaseConfig: any = {};
try {
  const configFile = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8');
  firebaseConfig = JSON.parse(configFile);
} catch (e) {
  console.error("Warning: firebase-applet-config.json not found");
}

let db: FirebaseFirestore.Firestore | null = null;
const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;

if (projectId || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT) {
  let adminConfig: any = {};
  if (projectId) {
    adminConfig.projectId = projectId;
  }

  // Support for external deployment (e.g., Railway, Vercel)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const serviceAccountParams = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
      adminConfig.credential = cert(serviceAccountParams);
      console.log("Using provided FIREBASE_SERVICE_ACCOUNT_BASE64 credentials.");
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64", e);
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccountParams = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      adminConfig.credential = cert(serviceAccountParams);
      console.log("Using provided FIREBASE_SERVICE_ACCOUNT credentials.");
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON", e);
    }
  }

  const app = initializeApp(adminConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId || process.env.FIREBASE_DATABASE_ID);
}

const PORT = 3000;
const botToken = process.env.TELEGRAM_BOT_TOKEN || '8761494085:AAGRUwiTgYk3Glpa5I2lUOgx5IV2i76jN6c';
let bot: Telegraf | null = null;

if (botToken) {
  try {
    bot = new Telegraf(botToken);

    bot.start((ctx) => {
      const chatId = ctx.message.chat.id;
      ctx.reply(`Welcome to Equilibria! Your Chat ID is: ${chatId}\n\nEnter this ID in your Equilibria Settings page to verify your Telegram account.`);
    });

    bot.command('status', (ctx) => {
      ctx.reply('Bot is active and running.');
    });

    bot.command('help', (ctx) => {
      ctx.reply(`Available Commands:
/start - Setup and get Chat ID
/help - Show this help message
/status - Check bot status
/history - View recent transactions

To record a transaction simply type the amount and description.
Example:
50000 Nasi Goreng
income 2000000 Salary
`);
    });

    bot.command('history', async (ctx) => {
      if (!db) {
         return ctx.reply('Database is not connected yet.');
      }
      try {
        const chatId = ctx.message.chat.id.toString();
        const usersSnapshot = await db.collection('users').where('telegramChatId', '==', chatId).limit(1).get();
        if (usersSnapshot.empty) {
          return ctx.reply('Your Telegram account is not linked to any Equilibria account. Please enter your Chat ID in the app settings.');
        }
        const userDoc = usersSnapshot.docs[0];

        const txSnapshot = await db.collection('transactions')
            .where('userId', '==', userDoc.id)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        if (txSnapshot.empty) {
            return ctx.reply('You have no recent transactions recorded.');
        }

        let historyMsg = `Recent Transactions:\n`;
        txSnapshot.docs.forEach((doc, idx) => {
            const data = doc.data();
            const sign = data.type === 'income' ? '+' : '-';
            historyMsg += `${idx + 1}. ${sign}Rp ${data.amount.toLocaleString()} (${data.desc})\n`;
        });

        ctx.reply(historyMsg);
      } catch (error) {
        console.error('Error fetching history:', error);
        ctx.reply('An error occurred while fetching your transaction history.');
      }
    });

    bot.on('text', async (ctx) => {
      try {
        const text = ctx.message.text.toLowerCase();
        if (text.startsWith('/start') || text.startsWith('/status') || text.startsWith('/help') || text.startsWith('/history')) return;

        if (!db) {
          return ctx.reply('Database is not connected yet.');
        }

        const chatId = ctx.message.chat.id.toString();
        const usersSnapshot = await db.collection('users').where('telegramChatId', '==', chatId).limit(1).get();

        if (usersSnapshot.empty) {
          return ctx.reply(`Your Telegram account is not yet linked.\n\nYour Chat ID is: ${chatId}\n\nPlease enter this in your Equilibria app settings.`);
        }
        const userDoc = usersSnapshot.docs[0];

        // Parse format: `[income] <amount> <desc>`
        const parts = ctx.message.text.split(' ');
        if (parts.length < 2) {
            return ctx.reply('Invalid format. Example: "50000 Nasi Goreng" or "income 2000000 Salary"');
        }

        let type = 'expense';
        let amountStr = parts[0];
        let descParts = parts.slice(1);

        if (parts[0].toLowerCase() === 'income') {
             if (parts.length < 3) {
                 return ctx.reply('Invalid format for income. Example: "income 2000000 Salary"');
             }
             type = 'income';
             amountStr = parts[1];
             descParts = parts.slice(2);
        } else if (parts[0].toLowerCase() === 'expense') {
             if (parts.length < 3) {
                 return ctx.reply('Invalid format for expense. Example: "expense 50000 Nasi Goreng"');
             }
             type = 'expense';
             amountStr = parts[1];
             descParts = parts.slice(2);
        }

        const amount = Number(amountStr.replace(/[^0-9]/g, ''));
        if (isNaN(amount) || amount <= 0) {
            return ctx.reply('Invalid amount. Please provide a valid positive number.');
        }

        const desc = descParts.join(' ');

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const txData = {
          userId: userDoc.id,
          desc: desc,
          category: type === 'income' ? 'Income' : 'General',
          amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
          date: dateStr,
          type: type,
          createdAt: Date.now()
        };

        const docRef = db.collection('transactions').doc();
        await docRef.set(txData);

        await ctx.reply(`Transaction Recorded!\n\nType: ${type.toUpperCase()}\nAmount: Rp ${amount.toLocaleString()}\nDesc: ${desc}\n\nThis is now synced with your Equilibria app.`);
      } catch (error) {
        console.error('Error processing text message:', error);
        await ctx.reply('An unexpected error occurred. Please try again later.');
      }
    });

    bot.on(['photo', 'voice'], async (ctx) => {
      try {
        if (!db) return ctx.reply('Database is not connected yet.');
        if (!process.env.GEMINI_API_KEY) return ctx.reply('AI capabilities are not configured.');

        const chatId = ctx.message.chat.id.toString();
        const usersSnapshot = await db.collection('users').where('telegramChatId', '==', chatId).limit(1).get();
        if (usersSnapshot.empty) {
          return ctx.reply('Your Telegram account is not linked.');
        }
        const userDoc = usersSnapshot.docs[0];

        await ctx.reply('Analyzing your input with AI...');

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        let fileId = '';
        let mimeType = '';
        let promptText = '';

        if ('photo' in ctx.message) {
          fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
          mimeType = 'image/jpeg';
          promptText = 'Analyze this receipt and extract transaction details. If there is no clear total, try to sum the items. Reply ONLY with JSON: {"type": "expense", "amount": 100000, "desc": "Restaurant Name / Items", "category": "Food"}';
        } else if ('voice' in ctx.message) {
          fileId = ctx.message.voice.file_id;
          mimeType = ctx.message.voice.mime_type || 'audio/ogg';
          promptText = 'Dengarkan pesan audio ini. Ekstrak sebagai transaksi finansial (bisa dalam bahasa indonesia). Abaikan obrolan tidak relevan. Reply HANYA JSON: {"type": "expense"|"income", "amount": angka(number), "desc": "deskripsi singkat transaksi", "category": "kategori singkat"}';
        }

        const fileLink = await ctx.telegram.getFileLink(fileId);
        const response = await fetch(fileLink.href);
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        const result = await ai.models.generateContent({
           model: 'gemini-2.5-flash',
           contents: [
             {
                role: 'user',
                parts: [
                   { inlineData: { mimeType, data: base64 } },
                   { text: promptText }
                ]
             }
           ]
        });

        const textResponse = (result.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
        let parsed;
        try {
          parsed = JSON.parse(textResponse);
        } catch(e) {
          console.error("AI JSON Parse Error: ", textResponse);
          return ctx.reply('Sorry, the AI could not understand the transaction details properly.');
        }

        if (!parsed.amount || !parsed.type || !parsed.desc || !parsed.category) {
            return ctx.reply('AI missed some fields. Please try again.');
        }

        const type = parsed.type.toLowerCase() === 'income' ? 'income' : 'expense';
        const amount = Number(parsed.amount);
        const desc = parsed.desc;
        const category = parsed.category;

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const txData = {
          userId: userDoc.id,
          desc: desc,
          category: category,
          amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
          date: dateStr,
          type: type,
          createdAt: Date.now()
        };

        const docRef = db.collection('transactions').doc();
        await docRef.set(txData);

        await ctx.reply(`AI Transaction Recorded!\n\nType: ${type.toUpperCase()}\nAmount: Rp ${amount.toLocaleString()}\nDesc: ${desc}\nCategory: ${category}\n\nThis is now synced with your Equilibria app.`);

      } catch (error) {
        console.error('Error in multi-modal bot handler:', error);
        ctx.reply('An unexpected error occurred while processing the image/audio.');
      }
    });

    bot.catch((err, ctx) => {
      console.error(`Unhandled error while processing update ${ctx.update.update_id}:`, err);
      ctx.reply('An unexpected error occurred while processing your request. Please try again.').catch(e => console.error('Failed to send error message:', e));
    });

    // Launch the bot with retry logic for dev environment (409 Conflict)
    const launchBot = (retries = 5) => {
      bot!.launch({ dropPendingUpdates: true }).then(() => {
        console.log('Telegraf bot initialized successfully.');
      }).catch((err) => {
        if (err.response && err.response.error_code === 409) {
          console.log(`[Telegraf info] Bot is currently running on another instance (e.g. Railway). Skipping bot initialization here to avoid conflict.`);
        } else {
          console.error('Failed to launch Telegraf bot:', err);
        }
      });
    };
    launchBot();

    // Enable graceful stop
    const stopBot = (signal: string) => {
      console.log(`Received ${signal}, stopping bot...`);
      bot?.stop(signal);
      process.exit(0);
    };
    process.once('SIGINT', () => stopBot('SIGINT'));
    process.once('SIGTERM', () => stopBot('SIGTERM'));
  } catch (error) {
    console.error('Error initializing Telegraf:', error);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' })); // Limit JSON body size

  // Apply rate limiters
  app.use('/api/', apiLimiter);
  app.use('/api/telegram/verify', strictLimiter);
  app.use('/api/cron/reminders', strictLimiter);

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', botActive: !!bot });
  });

  app.post('/api/telegram/verify', async (req, res) => {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({ success: false, error: 'Chat ID is required' });
    }

    if (!bot) {
      return res.status(500).json({ success: false, error: 'Bot is not configured' });
    }

    try {
      // Send a test message to verify the chat ID
      await bot.telegram.sendMessage(chatId, 'Success! Your Telegram account has been linked to your Equilibria app.');
      res.json({ success: true, message: 'Verification successful' });
    } catch (error: any) {
      console.error('Verification failed:', error);
      res.status(400).json({ success: false, error: 'Could not send message. Please ensure you have sent /start to the bot first.' });
    }
  });

  // Cron Job endpoint for Reminders
  app.get('/api/cron/reminders', async (req, res) => {
    if (!db || !bot) {
      return res.status(500).json({ error: 'Database or Bot not configured' });
    }

    try {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      console.log(`[CRON] Checking for reminders on or before ${todayStr}...`);

      const remindersSnapshot = await db.collection('reminders')
        .where('isActive', '==', true)
        .where('nextDate', '<=', todayStr)
        .get();

      if (remindersSnapshot.empty) {
        return res.json({ message: 'No reminders to process today.', processedCount: 0 });
      }

      let processedCount = 0;

      for (const doc of remindersSnapshot.docs) {
        const reminder = doc.data();

        // Lookup user to get telegramChatId
        const userDoc = await db.collection('users').doc(reminder.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData && userData.telegramChatId) {
            try {
              let msg = `Finance Reminder\n\n`;
              msg += `${reminder.title}\n`;
              msg += `Amount: Rp ${reminder.amount.toLocaleString()}\n`;
              if (reminder.frequency !== 'once') {
                 msg += `Frequency: ${reminder.frequency}\n`;
              }

              await bot.telegram.sendMessage(userData.telegramChatId, msg, { parse_mode: 'Markdown' });
            } catch (err) {
              console.error(`Failed to send reminder to ${userData.telegramChatId}:`, err);
            }
          }
        }

        // Calculate next date or mark inactive
        let nextIsActive = reminder.isActive;
        let nextDateStr = reminder.nextDate;

        if (reminder.frequency === 'once') {
           nextIsActive = false;
        } else {
           const nextObj = new Date(reminder.nextDate);
           if (reminder.frequency === 'daily') nextObj.setDate(nextObj.getDate() + 1);
           else if (reminder.frequency === 'weekly') nextObj.setDate(nextObj.getDate() + 7);
           else if (reminder.frequency === 'monthly') nextObj.setMonth(nextObj.getMonth() + 1);
           else if (reminder.frequency === 'yearly') nextObj.setFullYear(nextObj.getFullYear() + 1);

           nextDateStr = `${nextObj.getFullYear()}-${String(nextObj.getMonth()+1).padStart(2, '0')}-${String(nextObj.getDate()).padStart(2, '0')}`;
        }

        await doc.ref.update({
           isActive: nextIsActive,
           nextDate: nextDateStr,
           updatedAt: Date.now()
        });

        processedCount++;
      }

      res.json({ message: 'Ran successfully', processedCount });
    } catch (error) {
      console.error('[CRON] Error:', error);
      res.status(500).json({ error: 'Internal server error while processing reminders' });
    }
  });

  // Vite middleware for development (always use dev mode since we can't easily set NODE_ENV on Windows)
  if (true) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    // Fallback: serve index.html for root path
    app.use('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'index.html'));
    });
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
