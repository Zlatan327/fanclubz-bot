## Fanclubz WhatsApp Bot

Node.js WhatsApp bot for managing a Fanclubz product community: leaderboards, contests, prediction links, and strict link moderation.

### Key Features

- **Leaderboards (admin-only)**: `!top`, `!myrank`, `!inviteleader`, `!resetleader`.
- **Invites**: `!invited @user` (credits inviter), `!invitelink` (DMs the group invite link).
- **Moderation (admin-only)**: `!kick`, `!ban` with automatic re-kick of banned users on rejoin.
- **Contests**: `!newcontest <title> | <desc>`, `!endcontest <id>`, `!contests`.
- **Predictions**: watches `FANCLUBZ_DOMAIN` URLs, records them, `!predictions`, `!endprediction <id>`.
- **Rules**: `!rules` and `!setrules <text>`.
- **Link enforcement**: non-admins can only post Fanclubz links; other links are auto-deleted, with a warning then a ban.

### Using WhatsApp’s “tag everyone” feature (`@all`)

WhatsApp recently added a native **“tag everyone”** feature in groups:

- In the **WhatsApp group chat** on your phone or desktop:
  - Type `@` and wait for the mention list to appear.
  - Choose the special **“Everyone” / “All”** option (often shown as `@all`).
  - WhatsApp will insert the `@all` mention, and when you send the message it will notify all members that can be tagged.

How this bot uses it:

- For now, the bot simply includes the text `@all` in certain announcements (e.g. the `!newcontest` response) so it clearly indicates a group-wide message.
- As WhatsApp and `whatsapp-web.js` evolve, you can extend this to use the official `@all` mention object programmatically.

You as an admin can always manually type `@all` in the WhatsApp client when posting your own messages to tag everyone.

### Local Setup

1. **Clone / open the project**

```bash
cd c:\Users\Admin\setup
cd fanclubz-bot
```

2. **Install dependencies**

> On Windows, `better-sqlite3` requires Visual Studio Build Tools with the **“Desktop development with C++”** workload.

```bash
npm install
```

3. **Configure environment**

```bash
cp .env.example .env
```

Edit `.env` and set:

- `GROUP_ID` – your target WhatsApp group JID.
- `ADMIN_IDS` – comma-separated list of admin JIDs.
- `FANCLUBZ_DOMAIN` – e.g. `fanclubz.app`.
- `INVITE_LINK` – your group invite link.

4. **Run the bot locally**

```bash
npm start
```

Watch the terminal for an ASCII QR code, scan it with the WhatsApp account you’ll dedicate to the bot, then add that account to the group and promote it to admin.

### How to Push This Repo to GitHub

From `fanclubz-bot`:

```bash
cd c:\Users\Admin\setup\fanclubz-bot
git init
git add .
git commit -m "Initial Fanclubz WhatsApp bot"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

- When `git push` runs, Git will open a browser or prompt for GitHub login.
- Sign in with your GitHub account, authorize access, and the code will appear in your repository.

After pushing, you can come back here to adjust or test the bot further (including any additional `@all`-style use cases) before you deploy to Railway.

