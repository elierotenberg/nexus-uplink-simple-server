const _ = require('lodash-next');

class DirtyMarker {
  constructor() {
    _.extend(this, {
      _dirty: {},
    });
  }

  mark(key) {
    this._dirty[key] = true;
  }

  unmarkAll() {
    this._dirty = {};
  }

  get marked() {
    return Object.keys(this._dirty);
  }

  flush() {
    const marked = this.marked;
    this.unmarkAll();
    return marked;
  }
}

_.extend(DirtyMarker.prototype, {
  _dirty: null,
});

module.exports = DirtyMarker;
