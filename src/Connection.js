module.exports = function({ UplinkSimpleServer }) {
  const _ = require('lodash-next');
  const instanceOfEngineIOSocket = require('./instanceOfEngineIOSocket');

  const HANDSHAKE_TIMEOUT = 5000;

  class Connection {
    constructor({ socket, uplink }) {
      _.dev(() => instanceOfEngineIOSocket(socket).should.be.ok &&
        uplink.should.be.an.instanceOf(UplinkSimpleServer)
      );
      this._handshake = new Promise((resolve, reject) => {
        this._handshakeResolve = resolve;
        this._handshakeReject = reject;
      })
      .timeout(HANDSHAKE_TIMEOUT)
      .cancellable();
      _.extend(this, {
        _isDestroyed: false,
        _isConnected: false,
        _guid: null,
        _session: null,
        socket,
        uplink,
      });
      socket.on('error', (err) => this.handleError(err));
      socket.on('message', (json) => this.handleMessage(json));

      [
        'handleMessageHanshake',
        'handleMessageSubscribeTo',
        'handleMessageUnsubscribeFrom',
        'handleMessageListenTo',
        'handleMessageUnlistenFrom',
      ].forEach((method) => this[method] = Promise.coroutine(this[method]));

    }

    get isDestroyed()  {
      return !!this._isDestroyed;
    }

    get isConnected() {
      return !!this._isConnected;
    }

    get id() {
      return this.socket.id;
    }

    handleError(err) {
      _.dev(() => console.error('nexus-uplink-simple-server', this.socket.id, '<<', err.toString()));
    }

    handleMessage(json) {
      _.dev(() => json.should.be.a.String);
      return Promise.try(() => {
        const { event, params } = JSON.parse(json);
        event.should.be.a.String;
        (params === null || _.isObject(params)).should.be.ok;
        if(event === 'handshake') {
          return this.handleMessageHanshake(params);
        }
        if(event === 'subscribeTo') {
          return this.handleMessageSubscribeTo(params);
        }
        if(event === 'unsubscribeFrom') {
          return this.handleMessageUnsubscribeFrom(params);
        }
        if(event === 'listenTo') {
          return this.handleMessageListenTo(params);
        }
        if(event === 'unlistenFrom') {
          return this.handleMessageUnlistenFrom(params);
        }
        throw new Error(`Unknown event type: ${event}`);
      }).catch((err) => this.throw(err));
    }

    *handleMessageHanshake({ guid }) { // jshint ignore:line
      this.isConnected.should.not.be.ok;
      guid.should.be.a.String;
      const session = yield this.uplink.getSession(guid); // jshint ignore:line
      // Check that we are still not connected (since yield is async)
      this.isConnected.should.not.be.ok;
      session.attach(this);
      this._isConnected = true;
      this._guid = guid;
      this._session = session;
      this._handshakeResolve(session);
      this.handshakeAck({ pid: this.uplink.pid });
    }

    *handleMessageSubscribeTo({ path }) { // jshint ignore:line
      path.should.be.a.String;
      const session = yield this._handshake; // jshint ignore:line
      session.subscribeTo(path);
    }

    *handleMessageUnsubscribeFrom({ path }) { // jshint ignore:line
      path.should.be.a.String;
      const session = yield this._handshake; // jshint ignore:line
      session.unsubscribeFrom(path);
    }

    *handleMessageListenTo({ room }) { // jshint ignore:line
      room.should.be.a.String;
      const session = yield this._handshake; // jshint ignore:line
      session.listenTo(room);
    }

    *handleMessageUnlistenFrom({ room }) { // jshint ignore:line
      room.should.be.a.String;
      const session = yield this._handshake; // jshint ignore:line
      session.unlistenFrom(room);
    }

    throw(err) {
      this.push('err', { err: err.toString(), stack: __DEV__ ? err.stack : void 0 });
    }

    push(event, params) {
      _.dev(() => event.should.be.a.String &&
        (params === null || _.isObject(params)).should.be.ok &&
        this.isDestroyed.should.not.be.ok
      );
      _.dev(() => console.warn('nexus-uplink-simple-server', this.socket.id, '>>', event, params));
      const message = { event, params };
      const json = this.uplink.stringify(message);
      this.socket.send(json);
    }

    destroy() {
      _.dev(() => this.isDestroyed.should.not.be.ok);
      if(this._session) {
        this._session.detach(this);
      }
      this._handshake.cancel(new Error('Connection destroyed'));
      _.dev(() => console.warn('nexus-uplink-simple-server', this.socket.id, '!!', 'destroy'));
    }

    handshakeAck({ pid }) {
      _.dev(() => pid.should.be.a.String);
      this.push('handshakeAck', { pid });
    }

    update({ path, diff, hash }) {
      _.dev(() => path.should.be.a.String &&
        diff.should.be.an.Object &&
        (hash === null || _.isString(hash)).should.be.ok
      );
      this.push('update', { path, diff, hash });
    }

    emit({ room, params }) {
      _.dev(() => room.should.be.a.String &&
        (params === null || _.isObject(params)).should.be.ok
      );
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
    _isDestroyed: null,
    _isConnected: null,
    _guid: null,
    _session: null,
    socket: null,
    uplink: null,
    _handshake: null,
    _handshakeResolve: null,
    _handshakeReject: null,
  });

  return Connection;
};
