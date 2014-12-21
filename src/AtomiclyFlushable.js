const _ = require('lodash-next');

function isDifferent(prev, next) {
  if(_.isObject(prev) && _.isObject(next)) {
    return !_.isEqual(prev, next);
  }
  return prev !== next;
}

class AtomiclyFlushable {
  constructor() {
    _.extend(this, {
      _store: {},
      _dirty: {},
    });
  }

  get(key) {
    return _.clone(this._store[key]);
  }

  set(key, value) {
    _.dev(() => (value === null || _.isObject(value)).should.be.ok);
    if(isDifferent(this._store[key], value)) {
      this._dirty[key] = true;
    }
    this._store[key] = value;
    return this;
  }

  mutations() {
    const mutations = {};
    Object.keys(this._dirty).forEach((key) => mutations[key] = this._store[key]);
    return mutations;
  }

  flush() {
    const mutations = this.mutations();
    this._dirty = {};
    return mutations;
  }
}

_.extend(AtomiclyFlushable.prototype, {
  _currentStore: null,
  _previousStore: null,
});

module.exports = AtomiclyFlushable;
