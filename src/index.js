var GroupToggler = require('./GroupToggler');
var config = require('./../config.json');

var cl = new GroupToggler(config);

cl.run().then(
    function success() {
        console.log('Connected successfully, now running.');
    },
    function error(err) {
        console.log('Error connecting:', err);
    }
);
