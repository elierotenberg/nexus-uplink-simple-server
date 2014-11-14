const _ = require('lodash-next');

class Session {
  constructor(guid) {
    _.dev(() => guid.should.be.a.String);
  }
}
