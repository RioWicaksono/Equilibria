import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 1. Security Whitelist
// Ganti dengan ID Telegram kamu
const ALLOWED_USER_ID = parseInt(process.env.ALLOWED_USER_ID || '0', 10); // e.g. 123456789

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// Middleware: Whitelist User
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId || userId !== ALLOWED_USER_ID) {
    console.log(`Blocked unauthorized access from User ID: ${userId}`);
    return;
  }
  return next();
});

// 2 & 3. Smart Parser Logic & Interactive UX
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();

  if (text.startsWith('/')) return;

  let type: 'income' | 'expense' = 'expense';
  let currency = 'IDR';
  let amount = 0;
  let description = '';
  
  let parseText = text;

  // Prefix checks
  if (parseText.startsWith('+')) {
    type = 'income';
    parseText = parseText.substring(1).trim();
  } else if (parseText.startsWith('$')) {
    currency = 'AUD';
    parseText = parseText.substring(1).trim();
  }

  // Regex to extract amount and description
  const match = parseText.match(/^([\d\.,]+)\s+(.*)$/);
  
  if (!match) {
    return ctx.reply(
      '❌ Format not recognized.\n\n*Examples:*\n`50000 Nasi Goreng`\n`+2000000 Bonus`\n`$5 Coffee`',
      { parse_mode: 'Markdown' }
    );
  }

  amount = parseFloat(match[1].replace(/,/g, ''));
  description = match[2].trim();

  // Encode data for the callback_data (Limit: 64 bytes)
  // Format: "tx|type_id|currency|amount|desc_truncated"
  // type_id: 0 = expense, 1 = income
  const typeId = type === 'income' ? '1' : '0';
  const shortDesc = description.substring(0, 20); // truncate to ensure it fits 64 bytes with category
  const basePayload = `tx|${typeId}|${currency}|${amount}|${shortDesc}`;

  const categories = ['Food', 'Transport', 'Bills', 'Health', 'Entertainment', 'Others'];
  
  // Attach category index to keep it short: basePayload|cat_idx
  const buttons = categories.map((cat, idx) => 
    Markup.button.callback(cat, `${basePayload}|${idx}`)
  );

  const keyboard = [];
  for (let i = 0; i < buttons.length; i += 2) {
    keyboard.push(buttons.slice(i, i + 2));
  }

  await ctx.reply(
    `💰 *${type === 'income' ? 'Income' : 'Expense'} Detected*\n\n` +
    `Amount: ${amount.toLocaleString()} ${currency}\n` +
    `Desc: ${description}\n\n` +
    `*Select a category to save:*`,
    { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(keyboard)
    }
  );
});

// Category Button Callback (Actual Save to Supabase happens here)
bot.action(/^tx\|([01])\|([a-zA-Z]+)\|([\d\.]+)\|([^|]+)\|(\d+)$/, async (ctx) => {
  const type = ctx.match[1] === '1' ? 'income' : 'expense';
  const currency = ctx.match[2];
  const amount = parseFloat(ctx.match[3]);
  const description = ctx.match[4];
  const categoryIdx = parseInt(ctx.match[5], 10);
  
  const categories = ['Food', 'Transport', 'Bills', 'Health', 'Entertainment', 'Others'];
  const category = categories[categoryIdx] || 'Others';

  // Strict: Save to DB ONLY after I click a category button
  const { error } = await supabase.from('transactions').insert({
    user_id: ctx.from.id,
    amount: amount,
    description: description,
    type: type,
    currency: currency,
    category: category
  });

  if (error) {
    console.error('Insert Error:', error);
    return ctx.answerCbQuery('Failed to save. Please try again.', { show_alert: true });
  }

  await ctx.editMessageText(`✅ Transaction saved successfully under *${category}*!\n\n_(${amount.toLocaleString()} ${currency} - ${description})_`, { parse_mode: 'Markdown' });
  return ctx.answerCbQuery();
});

// 4. Commands: /undo
bot.command('undo', async (ctx) => {
  // Calculate time 5 minutes ago
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Find the latest finalized transaction for this user in the last 5 minutes
  const { data, error } = await supabase
    .from('transactions')
    .select('id, amount, currency, description')
    .eq('user_id', ctx.from.id)
    .gte('created_at', fiveMinsAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return ctx.reply('⚠️ No recent transactions found to undo within the last 5 minutes.');
  }

  // Delete the recent transaction
  const { error: delError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', data.id);

  if (delError) {
    console.error('Undo Delete Error:', delError);
    return ctx.reply('⚠️ Failed to undo transaction.');
  }

  return ctx.reply(`🗑️ *Undo successful:*\nDeleted ${data.amount} ${data.currency} for "${data.description}"`, { parse_mode: 'Markdown' });
});

// 4. Commands: /status
bot.command('status', async (ctx) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, type, currency')
    .eq('user_id', ctx.from.id)
    .neq('category', 'PENDING') // Exclude pending drafts
    .gte('created_at', startOfMonth);

  if (error) {
    console.error('Status Fetch Error:', error);
    return ctx.reply('⚠️ Failed to fetch status.');
  }

  let spentIDR = 0;
  let spentAUD = 0;

  data.forEach(tx => {
    if (tx.type === 'expense') {
      if (tx.currency === 'IDR') spentIDR += Number(tx.amount);
      if (tx.currency === 'AUD') spentAUD += Number(tx.amount);
    }
  });

  const budgetIDR = 5000000; // 5,000,000 IDR Budget
  const remainingIDR = budgetIDR - spentIDR;

  let msg = `📊 *Monthly Status*\n\n`;
  msg += `💸 *Total Spent:*\n`;
  msg += `- ${spentIDR.toLocaleString('id-ID')} IDR\n`;
  if (spentAUD > 0) {
    msg += `- ${spentAUD.toLocaleString('en-AU')} AUD\n`;
  }
  
  msg += `\n🎯 *Budget limit (IDR):* ${budgetIDR.toLocaleString('id-ID')}\n`;
  
  if (remainingIDR < 0) {
    msg += `📉 *Remaining:* 0 IDR\n`;
    msg += `\n⚠️ *Warning:* You are over budget by ${Math.abs(remainingIDR).toLocaleString('id-ID')} IDR!`;
  } else {
    msg += `📈 *Remaining:* ${remainingIDR.toLocaleString('id-ID')} IDR`;
  }

  return ctx.replyWithMarkdown(msg);
});

// For Next.js App Router API Route (Webhook endpoint)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Pass the webhook payload to Telegraf
    await bot.handleUpdate(body);
    
    return new Response(JSON.stringify({ ok: true }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Webhook Error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
