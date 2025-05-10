
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

function clearFlyInterval() {
  if (fly) {
    clearInterval(fly);
    fly = null;
  }
}

function startFlyInterval() {
  clearFlyInterval();
  fly = setInterval(updateCrashInfo, 50);
}

function deleteAndAddId() {
  connection.query('DELETE FROM bet', () => {
    connection.query('INSERT INTO bet (id) VALUES (1)', () => {});
  });
}
setInterval(deleteAndAddId, 5000);

io.on("connection", (socket) => {
  clients.push(socket.id);
  socket.emit('working', 'ACTIVE...!');

  socket.on("request-sync", () => {
    socket.emit("sync-crash", crashPosition);
  });

  socket.on("visibility-change", () => {
    socket.emit("sync-crash", crashPosition);
  });

  socket.on('disconnect', () => {
    clients = clients.filter(client => client !== socket.id);
  });
});

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
              finalcrash = betamount == 0 ? Math.floor(Math.random() * 6) + 2 : (Math.random() * 0.5 + 1).toFixed(2);
              io.emit('round_start', finalcrash);
              startFlyInterval();
            }
          }
        );
      } else {
        finalcrash = parseFloat(nxtcrash);
        io.emit('round_start', finalcrash);
        startFlyInterval();
        connection.query(`DELETE FROM aviset LIMIT 1`, () => {});
      }
    }
  });
}

function restartplane() {
  clearFlyInterval();
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
  startFlyInterval();
}

setcrash();

server.listen(port, () => {
  console.log(`Server running at :${port}/`);
});
