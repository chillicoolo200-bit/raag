'use strict';
// Thin entry point so Vercel exposes the handler at POST /api/assist.
// All the logic lives in ../assist-handler.js (kept at the top level on purpose: easy to upload from a phone).
const { createHandler } = require('../assist-handler.js');

module.exports = createHandler();
