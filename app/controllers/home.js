/**
 * HomeController
 **/

var start = async (ctx) => {

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


  let {compiler} = ctx;
  await compiler.render('landing', data, context, ctx);
};

module.exports = start;
