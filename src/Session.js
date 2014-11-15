module.exports = function({ Connection, UplinkSimpleServer }) {
  const _ = require('lodash-next');
  const should = _.should;

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
      return (...args) => Object.keys(this.connections).map((id) => this.connections[id][method](...args));
    }

    attach(connection) {
      _.dev(() => connection.should.be.an.instanceOf(Connection) &&
        this.connections[connection.id].should.not.be.ok
      );
      this.connections[connection.id] = connection;
      // If the session was paused (no connec attached)
      // then resume it
      if(this.paused) {
        this.resumse();
      }
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
        this.connections[connection.id].should.be.exactly(connection)
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

    pause() {
      _.dev(() => this.paused.should.not.be.ok);
      this.timeout = setTimeout(() => this.expire(), EXPIRE_TIMEOUT);
      return this;
    }

    update({ path, diff, hash }) {
      return this.proxy('update')({ path, diff, hash });
    }

    subscribeTo(path) {
      _.dev(() => path.should.be.a.String &&
        this.subscriptions[path].should.not.be.ok
      );
      this.subscriptions[path] = true;
      return this.uplink.subscribeTo(path, this);
    }

    unsubscribeFrom(path) {
      _.dev(() => path.should.be.a.String &&
        this.subscriptions[path].should.be.ok
      );
      delete this.subscriptions[path];
      return this.uplink.unsubscribeFrom(path, this);
    }

    emit({ room, params }) {
      return this.proxy('emit')({ room, params });
    }

    listenTo(room) {
      _.dev(() => room.should.be.a.String &&
        this.listeners[room].should.not.be.ok
      );
      this.listeners[room] = true;
      return this.uplink.listenTo(room, this);
    }

    unlistenFrom(room) {
      _.dev(() => room.should.be.a.String &&
        this.listeners[room].should.be.ok
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
  });

  return Session;
};
