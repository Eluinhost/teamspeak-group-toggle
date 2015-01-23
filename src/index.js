var TeamSpeakClient = require('node-teamspeak'),
    async = require('async');

var CHANNEL_ID = 109491;
var GROUP_ID = 222;
var SERVER_PORT = 9987;
var SERVER_ADDRESS = 'uhc.gg';
var USERNAME = 'serveradmin';
var PASSWORD = 'xxxx';

var cl = new TeamSpeakClient(SERVER_ADDRESS);

cl.send('login', {client_login_name: USERNAME, client_login_password: PASSWORD}, function(err) {
    if(err) return console.log('Error logging in: ', err);

    cl.send('use', {port: SERVER_PORT}, function(err) {
        if(err) return console.log('Error using server: ', err);

        cl.send('servernotifyregister', {event: 'channel', id: CHANNEL_ID}, function(err) {
            if(err) return console.log('Error registering for events:', err);

            cl.on('cliententerview', function(response) {
                // TODO kick client without doing anything
                console.log(response);
            });

            cl.on('clientmoved', function(response) {
                console.log(response);


                if(response.ctid !== CHANNEL_ID) {
                    return; // moved out of the channel
                }


                var clientId = response.clid;

                cl.send('clientinfo', {clid: clientId}, ['groups'], function(err, infoResponse) {
                    if(err) return console.log('Error get groups for client:', clientId, err);

                    var groupIds = infoResponse.client_servergroups;

                    // single group is returned as a number
                    if(typeof groupIds === 'number') {
                        groupIds = [groupIds.toString()]
                    } else {
                        // returned a comma seperated list of numbers
                        groupIds = groupIds.split(',');
                    }

                    console.log('Client has groups: ', groupIds);

                    cl.send(groupIds.indexOf(GROUP_ID.toString()) < 0 ? 'servergroupaddclient' : 'servergroupdelclient', {sgid: GROUP_ID, cldbid: infoResponse.client_database_id}, function(err) {
                        if(err) return console.log('Error toggling client group', clientId);

                        console.log('Added client to toggle group', clientId);
                    });
                });
            });
        });
    });
});