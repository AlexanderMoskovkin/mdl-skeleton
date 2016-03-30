/**
 * Compile and transpile client data
 * @ndaidong
 **/

/* eslint no-console: 0*/

import path from 'path';
import fs from 'fs';

import async from 'async';
import bella from 'bellajs';
import Promise from 'bluebird';

var Handlebars = require('handlebars');
Handlebars.registerHelper({
  eq: (v1, v2) => {
    return v1 === v2;
  },
  ne: (v1, v2) => {
    return v1 !== v2;
  },
  lt: (v1, v2) => {
    return v1 < v2;
  },
  gt: (v1, v2) => {
    return v1 > v2;
  },
  lte: (v1, v2) => {
    return v1 <= v2;
  },
  gte: (v1, v2) => {
    return v1 >= v2;
  },
  and: (v1, v2) => {
    return v1 && v2;
  },
  or: (v1, v2) => {
    return v1 || v2;
  }
});

var traceur = require('traceur/src/node/api.js');

var UglifyJS = require('uglify-js');

var postcss = require('postcss');
var postcssFilter = require('postcss-filter-plugins');
var cssnano = require('cssnano');
var cssnext = require('postcss-cssnext');
var postcssMixin = require('postcss-mixins');
var postcssNested = require('postcss-nested');
var postcssNesting = require('postcss-nesting');

const POSTCSS_PLUGINS = [
  postcssFilter({
    silent: true
  }),
  cssnext,
  cssnano,
  postcssMixin,
  postcssNesting,
  postcssNested
];

var fixPath = (p) => {
  if (!p) {
    return '';
  }
  p = path.normalize(p);
  p += p.endsWith('/') ? '' : '/';
  return p;
};

var removeNewLines = (s) => {
  return s.replace(/(?:\r\n|\r|\n)+/gm, '');
};

var pkg = require('../../package.json');
var config = require('./../../configs/base');

var builder = pkg.builder;
var cssDir = fixPath(builder.cssDir);
var jsDir = fixPath(builder.jsDir);
var distDir = fixPath(builder.distDir);
var vendorDir = fixPath(builder.vendorDir);

var postProcess = (css) => {
  return new Promise((resolve, reject) => {
    return postcss(POSTCSS_PLUGINS)
      .process(css)
      .then((result) => {
        return resolve(result.css);
      }).catch((err) => {
        return reject(err);
      });
  });
};

var compileCSS = (files) => {

  return new Promise((resolve, reject) => {
    let s = '', as = [], vs = [];
    if (bella.isString(files)) {
      files = [ files ];
    }

    files.forEach((file) => {
      if (fs.existsSync(file)) {
        let x = fs.readFileSync(file, 'utf8');
        if (!file.includes('/vendor')) {
          as.push(x);
        } else {
          vs.push(x);
        }
      }
    });

    s = as.join('\n');

    if (s.length > 0) {
      let ps = vs.join('\n');
      return postProcess(s).then((rs) => {
        return resolve(ps + rs);
      }).catch((err) => {
        return reject(err);
      });
    }
    return reject(new Error('No CSS data'));
  });
};

var compileJS = (files) => {

  return new Promise((resolve, reject) => {
    let s = '', as = [];
    if (bella.isString(files)) {
      files = [ files ];
    }

    files.forEach((file) => {
      if (fs.existsSync(file)) {
        let x = fs.readFileSync(file, 'utf8');
        if (!file.includes('/vendor')) {
          x = traceur.compile(x);
        }
        as.push(x);
      }
    });

    s = as.join('\n');

    if (s.length > 0) {
      let ss = '';
      let traceurRuntime = './node_modules/traceur/bin/traceur-runtime.js';
      if (fs.existsSync(traceurRuntime)) {
        ss = fs.readFileSync(traceurRuntime, 'utf8');
      }
      let minified = UglifyJS.minify(s, {
        fromString: true
      });
      return resolve(ss + '\n' + minified.code);
    }
    return reject(new Error('No JavaScript data'));
  });
};

export var processCSS = (css) => {

  return new Promise((resolve, reject) => {

    let fstats = [];
    let cssfiles = [];
    if (bella.isString(css)) {
      css = [ css ];
    }

    css.forEach((file) => {
      let full = cssDir + file;
      let part = path.parse(full);
      let ext = part.ext;
      if (!ext) {
        full += '.css';
      }
      if (fs.existsSync(full)) {
        let stat = fs.statSync(full);
        fstats.push(stat.mtime);
        cssfiles.push(full);
      }
    });

    let fname = bella.md5(fstats.join(';'));

    let pname = '/css/' + fname + '.css';
    let saveAs = distDir + pname;

    if (fs.existsSync(saveAs)) {
      return resolve(pname);
    }

    return compileCSS(cssfiles).then((code) => {
      fs.writeFileSync(saveAs, code, 'utf8');
      return resolve(pname);
    }).catch((er) => {
      console.trace(er);
      return reject(er);
    });
  });
};


export var processJS = (js) => {

  return new Promise((resolve, reject) => {

    let fstats = [], jsfiles = [];
    if (bella.isString(js)) {
      js = [ js ];
    }

    js.forEach((file) => {
      let full = jsDir + file;
      let ext = path.extname(full);
      if (!ext || ext !== '.js') {
        let _full = '';
        if (fs.existsSync(full + '.js')) {
          _full = full + '.js';
        }
        if ((config.ENV !== 'local' || full.includes(vendorDir)) && fs.existsSync(full + '.min.js')) {
          _full = full + '.min.js';
        }
        full = _full;
      }
      if (fs.existsSync(full)) {
        let stat = fs.statSync(full);
        fstats.push(stat.mtime);
        jsfiles.push(full);
      }
    });

    let fname = bella.md5(fstats.join(';'));

    let pname = '/js/' + fname + '.js';
    let saveAs = distDir + pname;

    if (fs.existsSync(saveAs)) {
      return resolve(pname);
    }

    return compileJS(jsfiles).then((code) => {
      try {
        if (config.ENV !== 'local') {
          let minified = UglifyJS.minify(code, {
            fromString: true
          });
          fs.writeFileSync(saveAs, minified.code, 'utf8');
        } else {
          fs.writeFileSync(saveAs, code, 'utf8');
        }
        return resolve(pname);
      } catch (e) {
        return reject(e);
      }
    }).catch((er) => {
      console.trace(er);
      return reject(er);
    });
  });
};

export var build = (layout, data = {}, context = {}) => {

  let conf = config.settings;

  let dir = conf.viewDir + '/';
  let ext = conf.tplFileExtension;

  let file = path.normalize(dir + layout + ext);

  let getPartial = (ss, dd) => {

    let getPlaceHolders = (_s) => {
      let reg = /\{@includes\s+(\'?([A-Za-z0-9-.\/]+)\'?|\"?([A-Za-z0-9-.\/]+)\"?)\}/;
      return _s.match(reg);
    };

    let a = ss.split('\n');
    let matches = [];
    if (a.length > 0) {
      a.forEach((line) => {
        if (line.includes('@includes')) {
          let m = getPlaceHolders(line);
          if (m && m.length > 2) {
            matches.push({
              place: m[0],
              name: m[2]
            });
          }
        }
      });
    }

    if (matches.length > 0) {
      matches.forEach((m) => {
        let place = m.place;
        let f = path.normalize(dd + '/' + m.name + ext);
        if (fs.existsSync(f)) {
          let cs = fs.readFileSync(f, 'utf8');
          if (cs) {
            let ps = path.dirname(f);
            cs = getPartial(cs, ps);
            ss = ss.replace(place, cs);
          }
        }
      });
    }
    return ss;
  };

  let getContainer = (ss, dd) => {
    let reg = /\{@extends\s+(\'?([A-Za-z0-9-.\/]+)\'?|\"?([A-Za-z0-9-.\/]+)\"?)\}/i;
    let matches = ss.match(reg);
    if (matches && matches.length > 2) {
      let place = matches[0];
      ss = ss.replace(place, '');
      let f = path.normalize(dd + '/' + matches[2] + ext);
      if (fs.existsSync(f)) {
        let cs = fs.readFileSync(f, 'utf8');
        if (cs) {
          ss = cs.replace('{@content}', ss);
        }
      }
    }
    return ss;
  };

  let continuable = true;
  let sHtml = '';

  if (!data || !bella.isObject(data)) {
    data = {
      meta: {}
    };
  }

  return new Promise((resolve, reject) => {
    return async.series([
      (next) => {
        if (!fs.existsSync(file)) {
          console.log('Layout missing: %s', file);
          continuable = false;
        }
        next();
      },
      (next) => {
        if (!continuable) {
          return next();
        }
        return fs.readFile(file, 'utf8', (err, s) => {
          if (err) {
            console.trace(err);
          }
          sHtml = s;
          return next();
        });
      },
      (next) => {
        if (!continuable || !sHtml) {
          return next();
        }
        sHtml = getContainer(sHtml, dir);
        return next();
      },
      (next) => {
        if (!continuable || !sHtml) {
          return next();
        }
        sHtml = getPartial(sHtml, dir);
        return next();
      },
      (next) => {
        if (!continuable || !sHtml) {
          return next();
        }

        try {
          let tmp = !data.meta || !bella.isObject(data.meta) ? {} : data.meta;
          let meta = config.meta;
          for (let k in meta) {
            if (!tmp[k]) {
              tmp[k] = meta[k];
            }
          }
          data.meta = tmp;
          data.revision = config.revision;
          let template = Handlebars.compile(sHtml);
          sHtml = template(data);
        } catch (e) {
          sHtml = 'Something went wrong. Please try again later.';
          console.trace(e);
        }
        return next();
      },
      (next) => {
        if (!continuable || !sHtml) {
          return next();
        }
        let css = context.css || false;
        if (!css) {
          return next();
        }
        return processCSS(css).then((href) => {
          let s = `<link rel="stylesheet" type="text/css" href="${href}?rev=${config.revision}"`;
          sHtml = sHtml.replace('{@style}', s);
          return sHtml;
        }).catch((e) => {
          console.trace(e);
          return e;
        }).finally(next);
      },
      (next) => {
        if (!continuable || !sHtml) {
          return next();
        }
        let js = context.js || false;
        if (!js) {
          return next();
        }
        return processJS(js).then((src) => {
          let s = `<script type="text/javascript" src="${src}?rev=${config.revision}"></script>`;
          sHtml = sHtml.replace('{@script}', s);
          return null;
        }).catch((e) => {
          console.trace(e);
          return e;
        }).finally(next);
      },
      (next) => {
        if (!continuable || !sHtml) {
          return next();
        }
        let sdata = bella.hasProperty(context, 'sdata') ? context.sdata : {};
        let s = '<script type="text/javascript">window.SDATA=' + JSON.stringify(sdata) + '</script>';
        sHtml = sHtml.replace('{@sdata}', s);
        return next();
      },
      (next) => {
        if (!continuable || !sHtml) {
          return next();
        }
        sHtml = sHtml.replace('{@style}', '');
        sHtml = sHtml.replace('{@script}', '');
        sHtml = sHtml.replace('{@sdata}', '');
        sHtml = removeNewLines(sHtml);
        sHtml = sHtml.replace(/\s+/gm, ' ');
        sHtml = sHtml.replace(/>\s+</gm, '><');
        return next();
      }
    ], (err) => {
      if (err) {
        console.trace(err);
        return reject(err);
      }
      return resolve(sHtml);
    });
  });
};

var render = (template, data, context, res) => {
  build(template, data, context)
    .then((s) => {
      if (res && !res.headersSent) {
        return res.status(200)
          .send(s);
      }
      return res.end();
    })
    .catch((e) => {
      console.trace(e);
      res.render500();
    });
};

export var io = (req, res, next) => {
  res.render = (template, data, context) => {
    return render(template, data, context, res);
  };
  return next();
};
