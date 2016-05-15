const GroupToggler = require('./GroupToggler');
const config = require('./../config.json');

const cl = new GroupToggler(config);

cl.run()
    .then(() => console.log('Connected successfully, now running.'))
    .catch(err => console.error(err));
