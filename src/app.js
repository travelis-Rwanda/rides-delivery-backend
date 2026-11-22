const express = require('express');
const { CATEGORIES } = require('./constants');
const routes = require('./routes');
const { errorHandler } = require('./errors');

const app = express();

// Lets the server read JSON sent in request bodies
app.use(express.json());

// Public test route: no login needed
app.get('/health', (req, res) => {
  res.json({ status: 'ok', categories: CATEGORIES });
});

app.use(routes);

// Must come AFTER the routes, so it catches their errors (Req 18)
app.use(errorHandler);

module.exports = app;