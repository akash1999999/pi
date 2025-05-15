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

// Continuously broadcast the current crash position to all clients
setInterval(() => {
  io.emit('updatehistory', crashPosition);
}, 100);

io.on('connection', (socket) => {
  console.log('New client connected');
  socket.emit('updatehistory', crashPosition);

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
