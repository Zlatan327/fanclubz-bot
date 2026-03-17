const { db } = require('../../db');

async function handle(client, message, command, args) {
  if (command === '!faq' || command === '!help' || command === '!info') {
    const faqText = `
*💡 FAQ & Things to Know (Whitepaper Intro)*

*1. What is Fanclubz?*
Fanclubz is a platform for creators and communities to engage through predictions, contests, and leaderboards.

*2. How do I participate in contests?*
Type \`!contests\` to see active contests. Use the links or instructions provided to enter.

*3. How do leaderboards work?*
You earn points/rankings for activity or successful invites. Type \`!myrank\` to view your status.

*4. Why was my link deleted?*
Only approved *Fanclubz* links are allowed from members to prevent spam and maintain quality discussion.

*5. Useful Commands:*
• \`!rules\` - View group guidelines
• \`!contests\` - View active contests
• \`!predictions\` - View current predictions
• \`!invitelink\` - Get group invite link

_For more help, contact an Admin._
`;
    await message.reply(faqText.trim());
  }
}

module.exports = {
  handle
};

