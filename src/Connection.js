module.exports = function({ UplinkSimpleServer }) {
  const _ = require('lodash-next');
  const instanceOfEngineIOSocket = require('./instanceOfEngineIOSocket');

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
      _.dev(() => instanceOfEngineIOSocket(socket).should.be.ok &&
        uplink.should.be.an.instanceOf(UplinkSimpleServer)
      );
      this._destroyed = false;
      this.socket = socket;
      this.uplink = uplink;
      // handshake should resolve to the session this connection will be attached to
      this.handshake = new Promise((resolve, reject) => this._handshake = { resolve, reject })
      .timeout(HANDSHAKE_TIMEOUT, 'Handshake timeout expired.')
      .cancellable();
      socket.on('error', (err) => this.handleError(err));
      socket.on('message', (json) => this.handleMessage(json));
    }

    get shouldNotBeDestroyed() {
      return this._destroyed.should.not.be.ok;
    }

    get shouldBeConnected() {
      return this.isConnected.should.be.ok;
    }

    get isConnected() {
      return this.socket.readyState === 'open';
    }

    get id() {
      return this.socket.id;
    }

    handleError(err) {
      _.dev(() => console.error('nexus-uplink-simple-server', this.socket.id, '<<', err.toString()));
    }

    handleMessage(json) {
      _.dev(() => json.should.be.a.String);
      try {
        const message = JSON.parse(json);
        (() => (message['event'] !== void 0).should.be.ok && (message['params'] !== void 0).should.be.ok)();
        const event = message.event;
        const params = message.params;
        (() => event.should.be.a.String && (ioHandlers[event] !== void 0).should.be.ok)();
        (() => params.should.be.an.Object)();
        ioHandlers[event].call(this, params)
        .catch((err) => this.throw(err));
      }
      catch(err) {
        return this.throw(err);
      }
    }

    throw(err) {
      this.push('err', { err: err.toString(), stack: __DEV__ ? err.stack : void 0 });
    }

    push(event, params) {
      _.dev(() => event.should.be.a.String &&
        (params === null || _.isObject(params)).should.be.ok &&
        this.shouldNotBeDestroyed &&
        this.shouldBeConnected
      );
      _.dev(() => console.warn('nexus-uplink-simple-server', this.socket.id, '>>', event, params));
      const message = { event, params };
      const json = this.uplink.stringify(message);
      this.socket.send(json);
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
      if(this.isConnected) {
        this.socket.close();
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
