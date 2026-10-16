'use strict';

// The parser lives in public/core/parser.js so the browser can load it as a plain
// script. This file keeps `require('./parser')` working for Node tools and tests.
module.exports = require('./public/core/parser.js');
