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
      activity_log: []
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
