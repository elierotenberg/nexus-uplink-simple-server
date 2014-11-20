module.exports = function({ UplinkSimpleServer }) {
  const _ = require('lodash-next');
  const instanceOfSocketIO = require('./instanceOfSocketIO');

  const ioHandlers = {
    handshake({ guid }) {
      return Promise.try(() => {
        // shadok assert
        (() => this.handshake.isPending().should.not.be.ok && guid.should.be.a.String)();
        this.uplink.getSession(guid)
        .then((session) => {
          session.attach(this);
          this._handshake.resolve(session);
          return this.handshakeAck(this.uplink.pid);
        });
      });
    },

    // subscriptions and listeners are stateless from the connections' point of view.
    // its the responsibility of the underlying connection to handle and maintain state.

    subscribeTo({ path }) {
      return this.handshake
      .then((session) => session.subscribeTo(path));
    },

    unsubscribeFrom({ path }) {
      return this.handshake
      .then((session) => session.unsubscribeFrom(path));
    },

    listenTo({ room }) {
      return this.handshake
      .then((session) => session.listenTo(room));
    },

    unlistenFrom({ room }) {
      return this.handshake
      .then((session) => session.listenTo(room));
    },
  };

  class Connection {
    constructor({ socket, uplink }) {
      _.dev(() => instanceOfSocketIO(socket).should.be.ok &&
        uplink.should.be.an.instanceOf(UplinkSimpleServer)
      );
      this.socket = socket;
      // handshake should resolve to the session this connection will be attached to
      this.handshake = new Promise((resolve, reject) => this._handshake = { resolve, reject }).cancellable();
      Object.keys(ioHandlers)
      .forEach((event) =>
        socket.on(event, (params) => {
          _.dev(() => console.warn('nexus-uplink-simple-server', '<<', event, params));
          return ioHandlers[event].call(this, params) // only 1 synthetic 'params' object should be enough
                                                      // and it avoid reading from arguments.
          .catch((e) => {
            let stack = null;
            let err = e.toString();
            if(__DEV__) {
              stack = e.stack;
            }
            this.err({ err, event, params, stack });
          });
        })
      );
    }

    get id() {
      return this.socket.id;
    }

    push(event, params) {
      _.dev(() => event.should.be.a.String);
      _.dev(() => console.warn('nexus-uplink-simple-server', '>>', event, params));
      this.socket.emit(event, params);
    }

    destroy() {
      if(this.handshake.isPending()) {
        this.handshake.cancel();
      }
      else {
        this.handshake
        .then((session) => session.detach(this));
      }
      this.socket.close();
    }

    detach() {
      // Improvement opportunity: allow client to re-handshake.
      this.destroy();
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
  });

  return Connection;
};
