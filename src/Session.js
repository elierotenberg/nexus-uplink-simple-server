module.exports = function({ Connection }) {
  const _ = require('lodash-next');
  const EventEmitter = require('events').EventEmitter;

  const DEFAULT_ACTIVITY_TIMEOUT = 10000;

  const actions = ['subscribeTo', 'unsubscribeFrom', 'listenTo', 'unlistenFrom'];

  class Session {
    constructor({ guid, activityTimeout }) {
      activityTimeout = activityTimeout || DEFAULT_ACTIVITY_TIMEOUT;
      _.dev(() => guid.should.be.a.String &&
        activityTimeout.should.be.a.Number.and.not.be.below(0)
      );
      _.extend(this, {
        events: new EventEmitter(),
        _guid: guid,
        _activityTimeout: activityTimeout,
        _connections: {},
        _subscriptions: {},
        _listeners: {},
        _expireTimeout: null,
      });
      this._isDestroyed = false;
      this.pause();
      actions.forEach((action) => this[`_${action}`] = _.scope(this[`_${action}`], this));
    }

    destroy() {
      if(this._expireTimeout !== null) {
        clearTimeout(this._expireTimeout);
        this._expireTimeout = null;
      }
      Object.keys(this._connections).forEach((id) => this.detachConnection(this._connections[id]));
      this._connections = null;
      Object.keys(this._subscriptions).forEach((path) => this._unsubscribeFrom({ path }));
      this._subscriptions = null;
      Object.keys(this._listeners).forEach((room) => this._unlistenFrom({ room }));
      this.events.emit('destroy');
    }

    get guid() {
      return this._guid;
    }

    get isPaused() {
      return (this._expireTimeout !== null);
    }

    // Just proxy the invocation to all attached connections, which implement the same APIs.
    proxy(method) {
      return _.scope(function(...args) {
        return Object.keys(this._connections).map((id) => this._connections[id][method](...args));
      }, this);
    }

    attachConnection(connection) {
      _.dev(() => connection.should.be.an.instanceOf(Connection) &&
        (this._connections[connection.id] === void 0).should.be.ok
      );
      this._connections[connection.id] = connection;
      actions.forEach((action) => connection.events.addListener(action, this[`_${action}`]));
      if(this.isPaused) {
        this.resume();
      }
      return this;
    }

    detachConnection(connection) {
      _.dev(() => connection.should.be.an.instanceOf(Connection) &&
        (this._connections[connection.id] !== void 0).should.be.ok &&
        this._connections[connection.id].should.be.exactly(connection)
      );
      actions.forEach((action) => connection.events.removeListener(action, this[`_${action}`]));
      delete this._connections[connection.id];
      if(Object.keys(this._connections).length === 0) {
        this.pause();
      }
      return this;
    }

    pause() {
      this.isPaused.should.not.be.ok;
      _.dev(() => Object.keys(this._connections).length.should.be.exactly(0));
      this._expireTimeout = setTimeout(() => this._handleExpire(), this._activityTimeout);
      this.events.emit('pause');
      return this;
    }

    resume() {
      this.isPaused.should.be.ok;
      _.dev(() => Object.keys(this._connections).length.should.be.above(0));
      clearTimeout(this._expireTimeout);
      this._expireTimeout = null;
      this.events.emit('resume');
      return this;
    }

    update({ path, diff, hash, nextHash }) {
      _.dev(() => path.should.be.a.String);
      if(this._subscriptions[path] !== void 0) {
        this.proxy('update')({ path, diff, hash, nextHash });
      }
      return this;
    }

    emit({ room, params }) {
      _.dev(() => room.should.be.a.String &&
        (params === null || _.isObject(params)).should.be.ok
      );
      if(this._listeners[room] !== void 0) {
        this.proxy('emit')({ room, params });
      }
      return this;
    }

    debug(...args) {
      return this.proxy('debug')(...args);
    }

    log(...args) {
      return this.proxy('log')(...args);
    }

    warn(...args) {
      return this.proxy('warn')(...args);
    }

    err(...args) {
      return this.proxy('err')(...args);
    }

    _handleExpire() {
      this.events.emit('expire');
    }

    _subscribeTo({ path }) {
      _.dev(() => path.should.be.a.String);
      if(this._subscriptions[path] !== void 0) {
        return this;
      }
      this._subscriptions[path] = true;
      this.events.emit('subscribeTo', { path });
      return this;
    }

    _unsubscribeFrom({ path }) {
      _.dev(() => path.should.be.a.String &&
        (this._subscriptions[path] !== void 0).should.be.ok
      );
      delete this._subscriptions[path];
      this.events.emit('unsubscribeFrom', { path });
      return this;
    }

    _listenTo({ room }) {
      _.dev(() => room.should.be.a.String);
      if(this._listeners[room] !== void 0) {
        return this;
      }
      this._listeners[room] = true;
      this.events.emit('listenTo', { room });
      return this;
    }

    _unlistenFrom({ room }) {
      _.dev(() => room.should.be.a.String &&
        (this._listeners[room] !== void 0).should.be.ok
      );
      delete this._listeners[room];
      this.events.emit('unlistenFrom', { room });
      return this;
    }
  }

  _.extend(Session.prototype, {
    events: null,
    _guid: null,
    _activityTimeout: null,
    _connections: null,
    _subscriptions: null,
    _listeners: null,
    _expireTimeout: null,
  });

  return Session;
};
