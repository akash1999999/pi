const http = require('http');
const socketIO = require('socket.io');
const mysql = require('mysql');

const hostname = 'localhost';
const port = process.env.PORT || 3003;

const server = http.createServer();
const io = socketIO(server);
var crashPosition = 1;
var finalcrash = 0;
var fly;
var betamount = 0;
var clients = [];

var db_config = {
  host: '184.168.115.30',
  user: 'jvmm7625_sourceco_9in1_new',
  password: 'jvmm7625_sourceco_9in1_new',
  database: 'jvmm7625_sourceco_9in1_new',
  keepAlive: true,
};

let connection;

function handleDisconnect() {
  connection = mysql.createConnection(db_config);

  connection.connect(function (err) {
    if (err) {
      console.log('Error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000);
    }
  });

  connection.on('error', function (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      handleDisconnect();
    } else {
      throw err;
    }
  });
}

function deleteAndAddId() {
  const deleteQuery = `DELETE FROM bet`;
  connection.query(deleteQuery, (err, result) => {
    if (!err) {
      const insertQuery = `INSERT INTO bet (id) VALUES (1)`;
      connection.query(insertQuery, () => {});
    }
  });
}

setInterval(deleteAndAddId, 5000);
handleDisconnect();

function setcrash() {
  const query23 = `SELECT nxt FROM aviset LIMIT 1`;
  connection.query(query23, (err, result) => {
    if (!err) {
      let nxtcrash = result[0]?.nxt || 0;
      if (nxtcrash == 0) {
        const query9 = `SELECT SUM(amount) AS total FROM crashbetrecord WHERE status ='pending'`;
        connection.query(query9, (err, result) => {
          if (!err) {
            betamount = result[0].total || 0;

            if (betamount == 0) {
              finalcrash = Math.floor(Math.random() * 6) + 2;
              repeatupdate(200);
            } else if (betamount <= 100) {
              finalcrash = (Math.random() * 0.5 + 1).toFixed(2);
              repeatupdate(200);
            } else {
              finalcrash = (Math.random() * 0.5 + 1).toFixed(2);
              repeatupdate(200);
            }
          }
        });
      } else {
        finalcrash = parseFloat(nxtcrash);
        repeatupdate(200);
        const query36 = `DELETE FROM aviset LIMIT 1`;
        connection.query(query36, () => {});
      }
    }
  });
}

function restartplane() {
  clearInterval(fly);
  const query5 = `INSERT INTO crashgamerecord (crashpoint) VALUES ('${crashPosition}')`;
  connection.query(query5, () => {});
  io.emit('updatehistory', crashPosition);

  setTimeout(() => {
    const query4 = `UPDATE crashbetrecord SET status = 'fail', winpoint='${crashPosition}' WHERE status = 'pending'`;
    connection.query(query4, () => {});
    io.volatile.emit('reset', 'resetting plane.....');
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

// MODIFIED: Function to update crash multiplier dynamically
function updateCrashInfo() {
  const fc = parseFloat(finalcrash);
  const cp = parseFloat(crashPosition);
  if (fc > cp) {
    let increment = 0.01;
    if (cp >= 10) {
      increment = 0.15;
    } else if (cp >= 5) {
      increment = 0.1;
    } else if (cp >= 3) {
      increment = 0.05;
    }

    crashPosition = (cp + increment).toFixed(2);
    io.emit('crash-update', crashPosition);
  } else {
    restartplane();
  }
}

function repeatupdate(duration) {
  fly = setInterval(updateCrashInfo, duration);
}

io.on('connection', (socket) => {
  clients.push(socket.id);
  socket.emit('working', 'ACTIVE...!');

  socket.on('disconnect', () => {});

  socket.on('newBet', function (username, amount) {
    const bal = `SELECT balance From users WHERE username = '${username}'`;
    connection.query(bal, (err, result) => {
      if (!err && result.length > 0) {
        if (result[0].balance > amount) {
          const betamount2 = result[0].balance - amount;
          const query1 = `UPDATE users SET balance = balance - ${amount} WHERE username = '${username}'`;
          connection.query(query1, () => {});

          const query = `INSERT INTO crashbetrecord (username, amount, balance) VALUES ('${username}', ${amount}, ${betamount2})`;
          connection.query(query, () => {});
        }
      }
    });
  });

  socket.on('addWin', function (username, amount, winpoint) {
    const bets = `SELECT SUM(amount) AS bets FROM crashbetrecord WHERE status ='pending' AND username = '${username}'`;
    connection.query(bets, (err, result) => {
      if (!err && result[0].bets > 0) {
        var winamount = parseFloat((amount * 98 / 100) * winpoint).toFixed(2);
        const query2 = `UPDATE users SET balance = balance + ${winamount} WHERE username = '${username}'`;
        connection.query(query2, () => {});

        const query3 = `UPDATE crashbetrecord SET status = 'success', balance='${winamount}', winpoint='${winpoint}' WHERE username = '${username}' AND status = 'pending'`;
        connection.query(query3, () => {});
      }
    });
  });
});

setcrash();

server.listen(port, () => {
  console.log(`Server running at :${port}/`);
});
