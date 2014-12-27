const _ = require('lodash-next');

const TYPES = {
  HANDSHAKE_ACK: 'h',
  UPDATE: 'u',
  EMIT: 'e',
  DISPATCH: 'd',
};

class Message {
  constructor({ type, payload }) {
    _.extend(this, {
      _type: type,
      _payload: payload,
      _json: JSON.stringify({ t: type, p: payload }),
    });
  }

  get json() {
    return this._json;
  }

  static unserialize(str) {
    const m = JSON.parse(str);
    _.dev(() => m.should.be.an.Object &&
      m.t.should.be.a.String &&
      m.p.should.be.an.Object
    );
    return new Message({ type: m.t, payload: m.p });
  }
}

_.extend(Message.prototype, {
  _type: null,
  _payload: null,
  _json: null,
});

_.extend(Message, { TYPES });

module.exports = Message;
