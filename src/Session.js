module.exports = function({ Connection, UplinkSimpleServer }) {
  const _ = require('lodash-next');

  const EXPIRE_TIMEOUT = 30000;

  class Session {
    constructor({ guid, uplink }) {
      _.dev(() => guid.should.be.a.String &&
        uplink.should.be.an.instanceOf(UplinkSimpleServer)
      );
      _.extend(this, { guid, uplink });
      this.connections = {};

      this.subscriptions = {};
      this.listeners = {};

      this.timeout = null;
      this.expired = false;
      this.pause();
    }

    destroy() {
      if(this.timeout !== null) {
        clearTimeout(this.timeout);
      }
      Object.keys(this.connections).forEach((id) => this.detach(this.connections[id]));
      Object.keys(this.subscriptions).forEach((path) => this.unsubscribeFrom(path));
      Object.keys(this.listeners).forEach((room) => this.unlistenFrom(room));
    }

    get paused() {
      return (this.timeout !== null);
    }

    // Just proxy the invocation to all attached connections, which implement the same APIs.
    proxy(method) {
      return _.scope(function(...args) {
        return Object.keys(this.connections).map((id) => this.connections[id][method](...args));
      }, this);
    }

    attach(connection) {
      _.dev(() => connection.should.be.an.instanceOf(Connection) &&
        this.connections.should.not.have.property(connection.id)
      );
      this.connections[connection.id] = connection;
      // If the session was paused (no connec attached)
      // then resume it
      if(this.paused) {
        this.resume();
      }
      return this;
    }

    expire() {
      this.expired = true;
      return this.uplink.deleteSession(this);
    }

    pause() {
      _.dev(() => this.paused.should.not.be.ok);
      this.timeout = setTimeout(() => this.expire(), EXPIRE_TIMEOUT);
      return this;
    }


    resume() {
      _.dev(() => this.paused.should.be.ok);
      // Prevent the expiration timeout
      clearTimeout(this.timeout);
      this.timeout = null;
      return this;
    }

    detach(connection) {
      _.dev(() => connection.should.be.an.instanceOf(Connection) &&
        this.connections.should.have.property(connection.id, connection)
      );
      this.connections[connection.id].detach();
      delete this.connections[connection.id];
      // If this was the last connection, pause the session
      // and start the expire countdown
      if(Object.keys(this.connections).length === 0) {
        this.pause();
      }
      return this;
    }
    update({ path, diff, hash }) {
      return this.proxy('update')({ path, diff, hash });
    }

    subscribeTo(path) {
      _.dev(() => path.should.be.a.String &&
        this.subscriptions.should.not.have.property(path)
      );
      this.subscriptions[path] = true;
      return this.uplink.subscribeTo(path, this);
    }

    unsubscribeFrom(path) {
      _.dev(() => path.should.be.a.String &&
        this.subscriptions.should.have.property(path)
      );
      delete this.subscriptions[path];
      return this.uplink.unsubscribeFrom(path, this);
    }

    emit({ room, params }) {
      return this.proxy('emit')({ room, params });
    }

    listenTo(room) {
      _.dev(() => room.should.be.a.String &&
        this.listeners.should.not.have.property(room)
      );
      this.listeners[room] = true;
      return this.uplink.listenTo(room, this);
    }

    unlistenFrom(room) {
      _.dev(() => room.should.be.a.String &&
        this.listeners.should.have.property(room)
      );
      delete this.listeners[room];
      return this.uplink.unlistenFrom(room, this);
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
  }

  _.extend(Session.prototype, {
    guid: null,
    uplink: null,
    connections: null,
    timeout: null,
    expired: null,
    subscriptions: null,
    listeners: null,
  });

  return Session;
};
