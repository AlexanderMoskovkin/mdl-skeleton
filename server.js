/**
 * Starting app
 * @ndaidong
 **/

const fs = require('fs');
const path = require('path');
const pjoin = path.join;

const bella = require('bellajs');

var builder = require('./scripts/workers/builder');
var compiler = require('./scripts/workers/compiler');

var config = require('./configs');

config.revision = bella.id;

const debug = require('debug');
const error = debug('app:error');

const Koa = require('koa');
const router = require('koa-router')();
const favicon = require('koa-favicon');
const assets = require('koa-static');
const bodyParser = require('koa-bodyparser');

const app = new Koa();

app.use(async (ctx, next) => {
  await next(); // eslint-disable-line callback-return
  ctx.set(config.headers);
});

app.use(favicon(pjoin(__dirname, '/assets/images') + '/brand/favicon.ico'));

var staticData = config.staticData;
app.use(assets(pjoin(__dirname, 'assets'), staticData));
app.use(assets(pjoin(__dirname, 'dist'), staticData));

app.use(bodyParser({
  encode: 'utf-8',
  formLimit: '128kb',
  jsonLimit: '1mb',
  onerror: (err, ctx) => {
    ctx.throw('body parse error', 422);
    error(err);
  }
}));

app.context.config = config;
app.context.render = compiler.render;

fs.readdirSync('./app/routers').forEach((file) => {
  if (path.extname(file) === '.js') {
    require('./app/routers/' + file)(router);
  }
});

app.use(router.routes()).use(router.allowedMethods({throw: true}));

app.use(async (ctx) => {
  await ctx.render(404);
});

app.on('error', async (err, ctx) => {
  error(err);
  await ctx.render(500);
});

var onServerReady = () => {
  builder.setup();
  console.log(`Server started at the port ${config.port} in ${config.ENV} mode`);
  console.log('Access website via', `http://127.0.0.1:${config.port}`);
  console.log('Public URL:', config.meta.url || 'None');
};

app.listen(config.port, onServerReady);

module.exports = app;
