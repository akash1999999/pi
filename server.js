
const http = require('http');
const socketIO = require('socket.io');
const mysql = require('mysql');

const hostname = 'localhost';
const port = process.env.PORT || 3003;

const server = http.createServer();
const io = socketIO(server);

let crashPosition = 1;
let finalcrash = 0;
let fly;
let betamount = 0;
let clients = [];

const db_config = {
  host: '184.168.115.30',
  user: 'jvmm7625_sourceco_9in1_new',
  password: 'jvmm7625_sourceco_9in1_new',
  database: 'jvmm7625_sourceco_9in1_new',
  keepAlive: true,
};

let connection;

function handleDisconnect() {
  connection = mysql.createConnection(db_config);
  connection.connect(err => {
    if (err) {
      console.log('DB connection error:', err);
      setTimeout(handleDisconnect, 2000);
    }
  });

  connection.on('error', err => {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      handleDisconnect();
    } else {
      throw err;
    }
  });
}
handleDisconnect();

function deleteAndAddId() {
  connection.query('DELETE FROM bet', () => {
    connection.query('INSERT INTO bet (id) VALUES (1)', () => {});
  });
}
setInterval(deleteAndAddId, 5000);

function setcrash() {
  connection.query('SELECT nxt FROM aviset LIMIT 1', (err, result) => {
    if (!err) {
      let nxtcrash = result[0]?.nxt || 0;
      if (nxtcrash == 0) {
        connection.query(
          `SELECT SUM(amount) AS total FROM crashbetrecord WHERE status = 'pending'`,
          (err, result) => {
            if (!err) {
              betamount = result[0].total || 0;

              if (betamount == 0) {
                finalcrash = Math.floor(Math.random() * 6) + 2;
              } else {
                finalcrash = (Math.random() * 0.5 + 1).toFixed(2);
              }

              io.emit('round_start', finalcrash);
              repeatupdate();
            }
          }
        );
      } else {
        finalcrash = parseFloat(nxtcrash);
        io.emit('round_start', finalcrash);
        repeatupdate();
        connection.query(`DELETE FROM aviset LIMIT 1`, () => {});
      }
    }
  });
}

function restartplane() {
  clearInterval(fly);
  connection.query(`INSERT INTO crashgamerecord (crashpoint) VALUES (?)`, [crashPosition], () => {});
  io.emit('updatehistory', crashPosition);

  setTimeout(() => {
    connection.query(`UPDATE crashbetrecord SET status = 'fail', winpoint=? WHERE status = 'pending'`, [crashPosition], () => {});
    io.volatile.emit('reset', 'resetting plane.....');
    io.emit('round_end');
  }, 200);

  setTimeout(() => {
    io.emit('removecrash');
    setTimeout(() => {
      io.emit('prepareplane');
      crashPosition = 0.99;
      io.emit('flyplane');
      setTimeout(setcrash, 1000);
    }, 4000);
  }, 3000);
}

function updateCrashInfo() {
  const fc = parseFloat(finalcrash);
  const cp = parseFloat(crashPosition);

  if (fc > cp) {
    let increment = 0.01 * Math.pow(cp, 0.8);
    increment = Math.min(increment, 1);
    crashPosition = (cp + increment).toFixed(2);
    io.emit('crash-update', crashPosition);
  } else {
    restartplane();
  }
}

function repeatupdate() {
  fly = setInterval(updateCrashInfo, 50);
}

io.on('connection', socket => {
  clients.push(socket.id);
  socket.emit('working', 'ACTIVE...!');

  socket.on('disconnect', () => {});

  socket.on('newBet', (username, amount) => {
    connection.query(`SELECT balance FROM users WHERE username = ?`, [username], (err, result) => {
      if (!err && result.length > 0 && result[0].balance >= amount) {
        const betamount2 = result[0].balance - amount;
        connection.query(`UPDATE users SET balance = balance - ? WHERE username = ?`, [amount, username], () => {});

        const formattedTime = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(',', '');
        connection.query(
          `INSERT INTO crashbetrecord (username, amount, balance, time) VALUES (?, ?, ?, ?)`,
          [username, amount, betamount2, formattedTime],
          () => {}
        );
      }
    });
  });

  socket.on('addWin', (username, amount, winpoint) => {
    connection.query(
      `SELECT SUM(amount) AS bets FROM crashbetrecord WHERE status ='pending' AND username = ?`,
      [username],
      (err, result) => {
        if (!err && result[0].bets > 0) {
          const winamount = ((amount * 98 / 100) * winpoint).toFixed(2);

          connection.query(`SELECT balance FROM users WHERE username = ?`, [username], (err, result) => {
            if (!err && result.length > 0) {
              const currentBalance = parseFloat(result[0].balance);
              const totalBalance = (currentBalance + parseFloat(winamount)).toFixed(2);

              connection.query(
                `UPDATE users SET balance = ? WHERE username = ?`,
                [totalBalance, username],
                () => {
                  socket.emit('winUpdate', {
                    winamount: parseFloat(winamount).toFixed(2),
                    balance: parseFloat(totalBalance).toFixed(2),
                    winpoint: parseFloat(winpoint).toFixed(2),
                  });

                  connection.query(
                    `UPDATE crashbetrecord SET status = 'success', balance = ?, winpoint = ? WHERE username = ? AND status = 'pending'`,
                    [totalBalance, winpoint, username],
                    () => {}
                  );
                }
              );
            }
          });
        }
      }
    );
  });
});

setcrash();

server.listen(port, () => {
  console.log(`Server running at :${port}/`);
});
