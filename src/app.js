const express = require('express');
const { CATEGORIES } = require('./constants');
const routes = require('./routes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', categories: CATEGORIES });
});

app.use(routes);

module.exports = app;