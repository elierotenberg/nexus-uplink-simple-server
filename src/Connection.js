module.exports = function({ UplinkSimpleServer }) {
  const _ = require('lodash-next');
  const should = _.should;
  const instanceOfSocketIO = require('./instanceOfSocketIO');

  const ioHandlers = {
    handshake({ guid }) {
      return Promise.try(() => {
        (() => this.handshake.isPending().should.not.be.ok &&
          guid.should.be.a.String &&
          this.uplink.hasSession(guid).should.be.ok
        )();
        this.uplink.getSession(guid).attach(this);
        this._handshake.resolve(guid);
        return this.handshakeAck(this.uplink.pid);
      });
    },

    // subscriptions and listeners are stateless from the connections' point of view.
    // its the responsibility of the underlying connection to handle and maintain state.

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
  };

  class Connection {
    constructor({ socket, uplink }) {
      _.dev(() => instanceOfSocketIO(socket).should.be.ok &&
        uplink.should.be.an.instanceOf(UplinkSimpleServer)
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

    get id() {
      return this.socket.id;
    }

    destroy() {
      if(this.handshake.isPending()) {
        this.handshake.cancel();
      }
      else {
        this.handshake.then((guid) => this.uplink.getSession(guid).detach(this));
      }
      this.socket.close();
    }

    detach() {
      // Improvement opportunity: allow client to re-handshake.
      this.destroy();
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
    handshake: null,
    _handshake: null,
  });

  return Connection;
};
