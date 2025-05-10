
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
  connection.connect((err) => {
    if (err) {
      console.log('DB connection error:', err);
      setTimeout(handleDisconnect, 2000);
    }
  });

  connection.on('error', (err) => {
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
              finalcrash = (betamount == 0) ? Math.floor(Math.random() * 6) + 2 : (Math.random() * 0.5 + 1).toFixed(2);
              io.emit('round_start', finalcrash);
              repeatupdate();
            }
          }
        );
      } else {
        finalcrash = parseFloat(nxtcrash);
        io.emit('round_start', finalcrash);
        repeatupdate();
      }
    }
  });
}

function broadcastGameState() {
  io.emit('game_state', { crashPosition, finalcrash });
}
setInterval(broadcastGameState, 1000);  // Broadcast every second

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current game state when a client reconnects
  socket.emit('game_state', { crashPosition, finalcrash });

  socket.on('request_game_state', () => {
    socket.emit('game_state', { crashPosition, finalcrash });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
