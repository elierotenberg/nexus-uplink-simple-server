const _ = require('lodash-next');
const LRUCache = require('lru-cache');
const sigmund = require('sigmund');

class JSONCache {
  constructor({ maxSize, maxAge }) {
    _.dev(() => maxSize.shoul.be.a.Number.not.below(0));
    maxAge = maxAge || void 0;
    this.cache = new LRUCache({ max: maxSize, maxAge });
  }

  stringify(object) {
    _.dev(() => object.should.be.an.Object);
    const sig = sigmund(object);
    if(!this.cache.has(sig)) {
      this.cache.set(sig, JSON.stringify(object));
    }
    return this.cache.get(sig);
  }

  clear() {
    this.cache.reset();
    return this;
  }
}

_.extend(JSONCache.prototype, {
  cache: null,
});

module.exports = JSONCache;
