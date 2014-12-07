module.exports = function({ UplinkSimpleServer }) {
  const _ = require('lodash-next');
  const instanceOfSocketIO = require('./instanceOfSocketIO');

  const HANDSHAKE_TIMEOUT = 5000;

  const ioHandlers = _.mapValues({
    *handshake({ guid }) {
      _.dev(() => guid.should.be.a.String);
      const session = yield this.uplink.getSession(guid);
      session.attach(this);
      this._handshake.resolve(session);
      this._handshake = null;
      this.handshakeAck(this.uplink.pid);
    },

    // subscriptions and listeners are stateless from the connections' point of view.
    // its the responsibility of the underlying connection to handle and maintain state.

    *subscribeTo({ path }) {
      (() => path.should.be.a.String)();
      return (yield this.handshake).subscribeTo(path);
    },

    *unsubscribeFrom({ path }) {
      (() => path.should.be.a.String)();
      return (yield this.handshake).unsubscribeFrom(path);
    },

    *listenTo({ room }) {
      (() => room.should.be.a.String)();
      return (yield this.handshake).listenTo(room);
    },

    *unlistenFrom({ room }) {
      (() => room.should.be.a.String)();
      return (yield this.handshake).unlistenFrom(room);
    },
  }, _.co.wrap);

  class Connection {
    constructor({ socket, uplink }) {
      _.dev(() => instanceOfSocketIO(socket).should.be.ok &&
        uplink.should.be.an.instanceOf(UplinkSimpleServer)
      );
      this._destroyed = false;
      this.socket = socket;
      this.uplink = uplink;
      // handshake should resolve to the session this connection will be attached to
      this.handshake = new Promise((resolve, reject) => this._handshake = { resolve, reject })
      .timeout(HANDSHAKE_TIMEOUT, 'Handshake timeout expired.')
      .cancellable();
      Object.keys(ioHandlers)
      .forEach((event) =>
        socket.on(event, (params) => {
          _.dev(() => console.warn('nexus-uplink-simple-server', this.socket.id, '<<', event, params));
          ioHandlers[event].call(this, params)
          .catch((e) => this.err({ err: e.toString(), event, params, stack: __DEV__ ? e.stack : null }));
        })
      );
    }

    get shouldNotBeDestroyed() {
      return this._destroyed.should.not.be.ok;
    }

    get id() {
      return this.socket.id;
    }

    push(event, params) {
      _.dev(() => event.should.be.a.String);
      _.dev(() => console.warn('nexus-uplink-simple-server', this.socket.id, '>>', event, params));
      this.socket.emit(event, params);
    }

    destroy() {
      _.dev(() => this.shouldNotBeDestroyed);
      if(this._handshake) {
        this.handshake.cancel(new Error('Connection destroyed.'));
      }
      else {
        this.handshake
        .then((session) => session.detach(this));
      }
      try { // Attempt to close the socket if possible.
        this.socket.disconnect();
      }
      catch (err) {
        _.dev(() => { throw err; });
      }
      _.dev(() => console.warn('nexus-uplink-simple-server', this.socket.id, '!!', 'destroy'));
    }

    handshakeAck(pid) {
      this.push('handshakeAck', { pid });
    }

    update({ path, diff, hash }) {
      this.push('update', { path, diff, hash });
    }

    emit({ room, params }) {
      this.push('emit', { room, params });
    }

    debug(...args) {
      this.push('debug', ...args);
    }

    log(...args) {
      this.push('log', ...args);
    }

    warn(...args) {
      this.push('warn', ...args);
    }

    err(...args) {
      this.push('err', ...args);
    }
  }

  _.extend(Connection.prototype, {
    socket: null,
    handshake: null,
    _handshake: null,
    _destroyed: null,
  });

  return Connection;
};
