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
      message_queue: []
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
    if (sql.includes('SELECT * FROM members WHERE id = ?')) {
      return {
        get: (id) => self.data.members.find(m => m.id === id)
      };
    }
    
    if (sql.includes('INSERT INTO members')) {
      return {
        run: (id, name, joined_at, violations = 0) => {
          const index = self.data.members.findIndex(m => m.id === id);
          if (index > -1) {
            self.data.members[index] = { ...self.data.members[index], name: name || self.data.members[index].name, violations };
          } else {
            self.data.members.push({ id, name, joined_at, msg_count: 0, violations, is_banned: 0 });
          }
          self.save();
        }
      };
    }

    if (sql.includes('UPDATE members SET msg_count = msg_count + 1')) {
      return {
        run: (id, name, joined_at) => {
          let m = self.data.members.find(m => m.id === id);
          if (!m) {
             m = { id, name, joined_at, msg_count: 0, violations: 0, is_banned: 0 };
             self.data.members.push(m);
          }
          m.msg_count = (m.msg_count || 0) + 1;
          if (name) m.name = name;
          self.save();
        }
      };
    }
    
    if (sql.includes('SELECT rank, msg_count FROM')) {
        return {
            get: (id) => {
                const sorted = [...self.data.members].sort((a, b) => (b.msg_count || 0) - (a.msg_count || 0));
                const index = sorted.findIndex(m => m.id === id);
                if (index === -1) return null;
                return { rank: index + 1, msg_count: sorted[index].msg_count };
            }
        };
    }

    if (sql.includes('SELECT name, msg_count FROM members ORDER BY msg_count DESC LIMIT 10')) {
        return {
            all: () => self.data.members.sort((a,b) => b.msg_count - a.msg_count).slice(0, 10)
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
            get: (key) => self.data.settings.find(s => s.key === key)
        };
    }

    if (sql.includes('INSERT INTO settings')) {
        return {
            run: (text) => {
                const index = self.data.settings.findIndex(s => s.key === 'rules_text');
                if (index > -1) self.data.settings[index].value = text;
                else self.data.settings.push({ key: 'rules_text', value: text });
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
