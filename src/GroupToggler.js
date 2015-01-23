var TeamSpeakClient = require('node-teamspeak'),
    _ = require('lodash'),
    Promise = require('bluebird');

function GroupToggler(options) {
    options = options || {};
    _.defaults(options, {
        address: 'localhost',
        queryport: 10011,
        serverport: 9987,
        username: 'serveradmin',
        password: '',
        channelId: 1,
        groupId: 1,
        kickMessage: 'Group toggled'
    });
    this._options = options;
    this._client = new TeamSpeakClient(options.address, options.queryport);

    this._send = Promise.promisify(this._client.send, this._client);
}

GroupToggler.prototype._login = function() {
    return this._send('login', {client_login_name: this._options.username, client_login_password: this._options.password});
};

GroupToggler.prototype._useServer = function() {
    return this._send('use', {port: this._options.serverport});
};

GroupToggler.prototype._notifyForEvents = function() {
    return this._send('servernotifyregister', {event: 'channel', id: this._options.channelId});
};

GroupToggler.prototype._connect = function() {
    var self = this;
    return this._login()
        .then(function() {
            return self._useServer();
        }).then(function() {
            return self._notifyForEvents();
        });
};

GroupToggler.prototype._onClientMove = function(moveEvent) {
    console.log(moveEvent);

    if(moveEvent.ctid !== this._options.channelId) {
        return; // moved out of the channel
    }

    var clientId = moveEvent.clid;

    var self = this;
    this._kickClient(clientId, this._options.kickMessage).then(function() {
        return self.toggleGroup(clientId);
    }).then(
        function success() {
            console.log('Toggled group for client ID', clientId);
        },
        function error(err) {
            console.log('Failed to toggle group/kick client ID', clientId, err);
        }
    );
};

GroupToggler.prototype._onEnterView = function(viewEvent) {
    console.log(viewEvent);
    // TODO kick client without doing anything
};

GroupToggler.prototype._kickClient = function(clid, message) {
    return this._send('clientkick', {clid: clid, reasonid: 4, reasonmsg: message});
};

GroupToggler.prototype.toggleGroup = function(clid) {
    var self = this;
    return this._send('clientinfo', {clid: clid}, ['groups']).spread(function(response) {
        var groupIds = response.client_servergroups;

        // single group is returned as a number
        if(typeof groupIds === 'number') {
            groupIds = [groupIds.toString()]
        } else {
            // returned a comma seperated list of numbers
            groupIds = groupIds.split(',');
        }

        console.log('Client has groups: ', groupIds);

        return self._send(groupIds.indexOf(self._options.groupId.toString()) < 0 ? 'servergroupaddclient' : 'servergroupdelclient', {sgid: self._options.groupId, cldbid: response.client_database_id});
    });
};

GroupToggler.prototype.run = function() {
    // register events
    this._client.on('clientmoved', this._onClientMove.bind(this));
    this._client.on('cliententerview', this._onEnterView.bind(this));

    return this._connect();
};

module.exports = GroupToggler;