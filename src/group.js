/** Group helpers: who sent a message, whether Hive was addressed, and recent context. */

const digits = (s) => (s || '').split('@')[0].split(':')[0].replace(/\D/g, '');

/** The sender's phone number if WhatsApp exposes it. Newer groups may only give a LID. */
function senderPhone(key) {
  for (const k of [key.participantPn, key.participantAlt, key.participant]) {
    if (k && k.endsWith('@s.whatsapp.net')) return digits(k);
  }
  return '';
}

function isFounder(key, founderPhones) {
  const p = senderPhone(key);
  return !!p && founderPhones.some(f => p === f || p.endsWith(f) || f.endsWith(p));
}

/** Hive is addressed by the trigger word, an @mention of its number, or a reply to its message. */
function isTagged(msg, me, prefix) {
  const m = msg.message || {};
  const text = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || '';
  if (new RegExp(`(^|\\s)${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) return true;
  const ctx = m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo;
  if (!ctx || !me) return false;
  const mine = [digits(me.id), digits(me.lid)].filter(Boolean);
  if ((ctx.mentionedJid || []).some(j => mine.includes(digits(j)))) return true;
  return !!ctx.participant && mine.includes(digits(ctx.participant));
}

class Recent {
  constructor(max) { this.max = max; this.items = []; }
  add(sender, text) {
    const t = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    this.items.push(`[${t}] ${sender}: ${text.slice(0, 500)}`);
    if (this.items.length > this.max) this.items.shift();
  }
  lines() { return [...this.items]; }
}

module.exports = { senderPhone, isFounder, isTagged, Recent };
