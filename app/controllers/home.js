/**
 * HomeController
 **/

var start = (req, res) => {

  let data = {
    meta: {
      title: 'MDL skeleton'
    },
    title: 'Name & Title'
  };

  let context = {
    css: [
      'vendor/mdl',
      'styles'
    ],
    js: [
      'vendor/material',
      'vendor/bella',
      'vendor/doc',
      'modules/es6.test',
      'modules/sample',
      'app'
    ],
    sdata: {
      user: {
        name: 'tester',
        id: 1000
      }
    }
  };

  return res.render('landing', data, context);
};

module.exports = {
  start: start
};
