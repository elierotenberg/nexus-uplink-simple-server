
const _ = require('lodash-next');
const instanceOfEngineIOSocket = require('./instanceOfEngineIOSocket');
const EventEmitter = require('events').EventEmitter;

const HANDSHAKE_TIMEOUT = 5000;

class Connection {
  constructor({ pid, socket, stringify, handshakeTimeout }) {
    handshakeTimeout = handshakeTimeout || HANDSHAKE_TIMEOUT;
    _.dev(() => pid.should.be.a.String &&
      instanceOfEngineIOSocket(socket).should.be.ok &&
      stringify.should.be.a.Function &&
      handshakeTimeout.should.be.a.Number.and.not.be.below(0)
    );
    _.extend(this, {
      events: new EventEmitter(),
      _isDestroyed: false,
      _pid: pid,
      _guid: null,
      _session: null,
      _socket: socket,
      _stringify: stringify,
    });
    this._handshakeTimeout = setTimeout(() => this._handshakeTimeoutExpire(), handshakeTimeout);
    ['_handleClose', '_handleError', '_handleMessage'].forEach((method) => this[method] = _.scope(this[method], this));
    this._socket.addListener('close', this._handleClose);
    this._socket.addListener('error', this._handleError);
    this._socket.addListener('message', this._handleMessage);
  }

  get isDestroyed()  {
    return !!this._isDestroyed;
  }

  get isConnected() {
    return (this._handshakeTimeout === null);
  }

  get id() {
    return this._socket.id;
  }

  get guid() {
    _.dev(() => this.isConnected.should.be.ok);
    return this._guid;
  }

  push(event, params) {
    this.isDestroyed.should.not.be.ok;
    _.dev(() => event.should.be.a.String &&
      (params === null || _.isObject(params)).should.be.ok
    );
    _.dev(() => console.warn('nexus-uplink-simple-server', this._socket.id, '>>', event, params));
    this._socket.send(this._stringify({ event, params }));
  }

  destroy() {
    this.isDestroyed.should.not.be.ok;
    _.dev(() => console.warn('nexus-uplink-simple-server', this._socket.id, '!!', 'destroy'));
    if(this.isConnected) {
      clearTimeout(this._handshakeTimeout);
      this._handshakeTimeout = null;
    }
    this._socket.removeListener('close', this._handleClose);
    this._socket.removeListener('error', this._handleError);
    this._socket.removeListener('message', this._handleMessage);
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

  _handshakeTimeoutExpire() {
    _.dev(() => console.warn('nexus-uplink-simple-server', this._socket.id, 'handshakeTimeout'));
    this._socket.close();
  }

  _handleClose() {
    this.events.emit('close');
  }

  _handleError(err) {
    _.dev(() => console.error('nexus-uplink-simple-server', this._socket.id, '<<', err.toString()));
  }

  _handleMessage(json) {
    _.dev(() => console.warn('nexus-uplink-simple-server', this._socket.id, '<<', json));
    _.dev(() => json.should.be.a.String);
    return Promise.try(() => {
      const { event, params } = JSON.parse(json);
      event.should.be.a.String;
      (params === null || _.isObject(params)).should.be.ok;
      if(event === 'handshake') {
        return this._handleMessageHanshake(params);
      }
      if(event === 'subscribeTo') {
        return this._handleMessageSubscribeTo(params);
      }
      if(event === 'unsubscribeFrom') {
        return this._handleMessageUnsubscribeFrom(params);
      }
      if(event === 'listenTo') {
        return this._handleMessageListenTo(params);
      }
      if(event === 'unlistenFrom') {
        return this._handleMessageUnlistenFrom(params);
      }
      throw new Error(`Unknown event type: ${event}`);
    }).catch((err) => this._throw(err));
  }

  _handleMessageHanshake({ guid }) {
    this.isConnected.should.not.be.ok;
    guid.should.be.a.String;
    clearTimeout(this._handshakeTimeout);
    this._handshakeTimeout = null;
    this._guid = guid;
    _.dev(() => this.isConnected.should.be.ok);
    this.events.emit('handshake', { guid });
    this._handshakeAck({ pid: this._pid });
  }

  _handleMessageSubscribeTo({ path }) {
    path.should.be.a.String;
    this.isConnected.should.be.ok;
    this.events.emit('subscribeTo', { path });
  }

  _handleMessageUnsubscribeFrom({ path }) {
    path.should.be.a.String;
    this.isConnected.should.be.ok;
    this.events.emit('unsubscribeFrom', { path });
  }

  _handleMessageListenTo({ room }) {
    room.should.be.a.String;
    this.isConnected.should.be.ok;
    this.events.emit('listenTo', { room });
  }

  _handleMessageUnlistenFrom({ room }) {
    room.should.be.a.String;
    this.isConnected.should.be.ok;
    this.events.emit('unlistenFrom', { room });
  }

  _throw(err) {
    this.push('err', { err: err.toString(), stack: __DEV__ ? err.stack : void 0 });
  }

  _handshakeAck({ pid }) {
    _.dev(() => pid.should.be.a.String);
    this.push('handshakeAck', { pid });
  }
}

_.extend(Connection.prototype, {
  events: null,
  _isDestroyed: null,
  _handshakeTimeout: null,
  _socket: null,
  _stringify: null,
});

module.exports = Connection;
