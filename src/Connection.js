const _ = require('lodash-next');
const instanceOfSocketIO = require('./instanceOfSocketIO');

const ioHandlers = {
  handshake({ guid }) {
    return Promise.try(() => {
      this.handshake.isPending().should.not.be.ok;
      guid.should.be.a.String;
      this.uplink.hasSession(guid).should.be.ok;
      this.uplink.getSession(guid).attach(this);
      this._handshake.resolve(guid);
    });
  },

  subscribeTo({ path }) {
    return this.handshake.then((guid) => this.uplink.getSession(guid).subscribeTo(path));
  },

  unsubscribeFrom({ path }) {
    return this.handshake.then((guid) => this.uplink.getSession(guid).unsubscribeFrom(path));
  },

  listenTo({ room }) {
    return this.handshake.then((guid) => this.uplink.getSession(guid).listenTo(room));
  },

  unlistenFrom({ room }) {
    return this.handshake.then((guid) => this.uplink.getSession(guid).unlistenFrom(room));
  },
}

class Connection {
  constructor({ socket, uplink }) {
    _.dev(() => instanceOfSocketIO(socket).should.be.ok &&
      uplink.should.be.an.instanceOf(Uplink)
    );
    this.socket = socket;
    this.handshake = new Promise((resolve, reject) => this._handshake = resolve).cancellable();
    Object.keys(ioHandlers)
    .forEach((event) =>
      socket.on(event, (...args) =>
        ioHandlers[event].call(this, ...args)
        .catch((err) => this.err({ err: err.toString, event, args }))
      )
    );
  }

  destroy() {
    if(this.handshake.isPending()) {
      this.handshake.cancel();
    }
    this.socket.close();
  }

  handshakeAck(pid) {
    this.socket.emit('handshakeAck', { pid });
  }

  update({ path, diff, hash }) {
    this.socket.emit('update', { path, diff, hash });
  }

  emit({ room, params }) {
    this.socket.emit('emit', { room, params });
  }

  debug(...args) {
    this.socket.emit('debug', ...args);
  }

  log(...args) {
    this.socket.emit('log', ...args);
  }

  warn(...args) {
    this.socket.emit('warn', ...args);
  }

  err(...args) {
    this.socket.emit('err', ...args);
  }
}

_.extend(Connection.prototype, {
  socket: null,
  ioHandlers: null,
});

module.exports = Connection;
