async function handle(client, message, command) {
  const HELP_TEXT = `🤖 *Bot Commands*

📊 *Predictions*
/predictions — Show the 10 most recent prediction links
/find <keyword> — Search saved predictions by keyword
/stats — Show prediction stats for this group

🏆 *Leaderboards & Invites*
/intro @user — Register who invited you
/invites — Show recent invite/join log
/leaderboard — Top inviters leaderboard
/active — Same as /leaderboard (Top active members)
/myrank — View your personal rank

👥 *General*
/rules — Show group rules

🔧 *Admin*
/clear — Delete all predictions for a fresh start (admin only)
/everyone — Tag all group members (admin only)
/kick @user — Kick a member (admin only)
/ban @user — Ban a member (admin only)
/setrules <text> — Set custom rules for the group (admin only)

/help — Show this help message

_ℹ️ The bot automatically detects and saves FanClubz prediction links posted in the group._`;

  return await message.reply(HELP_TEXT);
}

module.exports = {
  handle
};
