var GroupToggler = require('./GroupToggler');

var cl = new GroupToggler({
    address: 'uhc.gg',
    password: 'xxxxx',
    channelId: 109491,
    groupId: 222
});

cl.run().then(
    function success() {
        console.log('Connected successfully, now running.');
    },
    function error(err) {
        console.log('Error connecting:', err);
    }
);
