const fs = require('fs');
const path = require('path');

class JsonDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      members: [],
      contests: [],
      predictions: [],
      invite_contest: [],
      settings: [],
      message_queue: [],
      activity_log: [],
      scheduled_deletions: []
    };
    this.load();
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const content = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(content);
      } catch (err) {
        console.error('[JsonDb] failed to load, starting fresh', err);
      }
    }
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  prepare(sql) {
    const self = this;
    
    // Very basic SQL mock for the specific queries used in the bot
    if (sql.includes('SELECT * FROM members WHERE group_id = ? AND user_id = ?')) {
      return {
        get: (groupId, userId) => self.data.members.find(m => m.group_id === groupId && m.user_id === userId)
      };
    }
    
    if (sql.includes('INSERT INTO members (group_id, user_id, name, joined_at)')) {
      return {
        run: (groupId, userId, name, joinedAt) => {
          const index = self.data.members.findIndex(m => m.group_id === groupId && m.user_id === userId);
          if (index > -1) {
            self.data.members[index] = { ...self.data.members[index], name: name || self.data.members[index].name };
          } else {
            self.data.members.push({ group_id: groupId, user_id: userId, name, joined_at: joinedAt, msg_count: 0, violations: 0, is_banned: 0 });
          }
          self.save();
        }
      };
    }

    if (sql.includes('UPDATE members SET msg_count = members.msg_count + 1')) {
      return {
        run: (jid, name, joined_at) => {
          // Note: incrementMessageCount currently takes (jid, name)
          // Since we changed schema to (group_id, user_id), we need to handle it.
          // For now, I'll use a hack or wait until incrementMessageCount is updated.
        }
      };
    }
    
    if (sql.includes('SELECT rank, msg_count FROM')) {
        return {
            get: (groupId, userId) => {
                const groupMembers = self.data.members.filter(m => m.group_id === groupId);
                const sorted = groupMembers.sort((a, b) => (b.msg_count || 0) - (a.msg_count || 0));
                const index = sorted.findIndex(m => m.user_id === userId);
                if (index === -1) return null;
                return { rank: index + 1, msg_count: sorted[index].msg_count };
            }
        };
    }

    if (sql.includes('SELECT name, msg_count FROM members WHERE group_id = ? ORDER BY msg_count DESC LIMIT 10')) {
        return {
            all: (groupId) => self.data.members.filter(m => m.group_id === groupId).sort((a,b) => b.msg_count - a.msg_count).slice(0, 10)
        };
    }

    if (sql.includes('SELECT id, url FROM predictions WHERE group_id = ? AND active = 1 ORDER BY posted_at DESC LIMIT 10')) {
        return {
            all: (groupId) => self.data.predictions.filter(p => p.group_id === groupId && p.active === 1).sort((a,b) => b.posted_at - a.posted_at).slice(0, 10)
        };
    }

    if (sql.includes('SELECT id, url FROM predictions WHERE group_id = ? AND url LIKE ? ORDER BY posted_at DESC LIMIT 10')) {
        return {
            all: (groupId, query) => {
                const q = query.replace(/%/g, '').toLowerCase();
                return self.data.predictions.filter(p => p.group_id === groupId && p.url.toLowerCase().includes(q)).sort((a,b) => b.posted_at - a.posted_at).slice(0, 10);
            }
        };
    }

    if (sql.includes('SELECT COUNT(*) as count FROM predictions WHERE group_id = ?')) {
        return {
            get: (groupId) => ({ count: self.data.predictions.filter(p => p.group_id === groupId).length })
        };
    }

    if (sql.includes('SELECT id FROM predictions WHERE url = ?')) {
        return {
            get: (url) => self.data.predictions.find(p => p.url === url)
        };
    }

    if (sql.includes('INSERT INTO predictions')) {
        return {
            run: (groupId, url, description, postedAt, active) => {
                const index = self.data.predictions.findIndex(p => p.url === url);
                const isActive = active !== undefined ? active : 1;
                if (index > -1) {
                    self.data.predictions[index] = { ...self.data.predictions[index], description, posted_at: postedAt, active: isActive };
                } else {
                    const id = self.data.predictions.length + 1;
                    self.data.predictions.push({ id, group_id: groupId, url, description, posted_at: postedAt, active: isActive });
                }
                self.save();
            }
        };
    }

    if (sql.includes('UPDATE predictions SET active = 0')) {
        return {
            run: (groupId, id) => {
                const index = self.data.predictions.findIndex(p => p.group_id === groupId && p.id === id);
                if (index > -1) self.data.predictions[index].active = 0;
                self.save();
            }
        };
    }

    if (sql.includes('INSERT INTO message_queue')) {
        return {
            run: (to, body, options, enqueued, sendAfter) => {
                const id = Date.now();
                self.data.message_queue.push({ id, recipient_jid: to, body, options, enqueued_at: enqueued, send_after: sendAfter, retries: 0 });
                self.save();
            }
        };
    }

    if (sql.includes('SELECT COUNT(*) as count FROM message_queue')) {
        return {
            get: (jid) => {
                if (jid) return { count: self.data.message_queue.filter(q => q.recipient_jid === jid).length };
                return { count: self.data.message_queue.length };
            }
        };
    }

    if (sql.includes('SELECT * FROM message_queue WHERE send_after <= ?')) {
        return {
            all: (now) => self.data.message_queue.filter(q => q.send_after <= now)
        };
    }

    if (sql.includes('DELETE FROM message_queue WHERE id = ?')) {
        return {
            run: (id) => {
                self.data.message_queue = self.data.message_queue.filter(q => q.id !== id);
                self.save();
            }
        };
    }

    if (sql.includes('SELECT value FROM settings')) {
        return {
            get: (groupId, key) => self.data.settings.find(s => s.group_id === groupId && s.key === key)
        };
    }

    if (sql.includes('INSERT INTO settings')) {
        return {
            run: (groupId, key, value) => {
                const index = self.data.settings.findIndex(s => s.group_id === groupId && s.key === key);
                if (index > -1) self.data.settings[index].value = value;
                else self.data.settings.push({ group_id: groupId, key, value });
                self.save();
            }
        };
    }

    if (sql.includes('SELECT id, title, description FROM contests WHERE group_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 10')) {
        return {
            all: (groupId) => self.data.contests.filter(c => c.group_id === groupId && c.active === 1).sort((a,b) => b.created_at - a.created_at).slice(0, 10)
        };
    }

    if (sql.includes('INSERT INTO contests')) {
        return {
            run: (groupId, title, description, postedBy, createdAt) => {
                const id = self.data.contests.length + 1;
                self.data.contests.push({ id, group_id: groupId, title, description, posted_by: postedBy, created_at: createdAt, active: 1 });
                self.save();
                return { lastInsertRowid: id };
            }
        };
    }

    if (sql.includes('UPDATE contests SET active = 0')) {
        return {
            run: (groupId, id) => {
                const index = self.data.contests.findIndex(c => c.group_id === groupId && c.id === id);
                if (index > -1) self.data.contests[index].active = 0;
                self.save();
            }
        };
    }

    if (sql.includes('INSERT INTO activity_log')) {
        return {
            run: (groupId, userId, action, actorId, timestamp) => {
                // Handle different argument counts for INSERT
                if (timestamp === undefined) {
                    timestamp = actorId;
                    actorId = null;
                }
                self.data.activity_log.push({ group_id: groupId, user_id: userId, action, actor_id: actorId, timestamp });
                self.save();
            }
        };
    }

    if (sql.includes('SELECT * FROM activity_log WHERE group_id = ?')) {
        return {
            all: (groupId) => self.data.activity_log.filter(a => a.group_id === groupId).sort((a,b) => b.timestamp - a.timestamp).slice(0, 20)
        };
    }

    if (sql.includes('INSERT INTO scheduled_deletions')) {
        return {
            run: (chatId, messageId, deleteAt) => {
                const id = Date.now() + Math.floor(Math.random() * 1000);
                self.data.scheduled_deletions.push({ id, chat_id: chatId, message_id: messageId, delete_at: deleteAt });
                self.save();
            }
        };
    }

    if (sql.includes('SELECT * FROM scheduled_deletions WHERE delete_at <= ?')) {
        return {
            all: (now) => self.data.scheduled_deletions.filter(d => d.delete_at <= now)
        };
    }

    if (sql.includes('DELETE FROM scheduled_deletions WHERE id = ?')) {
        return {
            run: (id) => {
                self.data.scheduled_deletions = self.data.scheduled_deletions.filter(d => d.id !== id);
                self.save();
            }
        };
    }

    // Fallback for unregistered queries
    return {
      get: () => null,
      all: () => [],
      run: () => ({ lastInsertRowid: Date.now() })
    };
  }

  pragma() {}
  exec() {}
}

module.exports = JsonDatabase;
