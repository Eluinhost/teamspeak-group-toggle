var TeamSpeakClient = require('node-teamspeak'),
    _ = require('lodash'),
    Promise = require('bluebird');

/**
 * @param {Object} [options={}]
 * @param {String} [options.address='localhost'] - address to connect to
 * @param {Number} [options.queryport=10011] - server query port
 * @param {Number} [options.serverport=9987] - port of server to use
 * @param {String} [options.username='serveradmin'] - server query account username
 * @param {String} [options.password=''] - server query account password
 * @param {Number} [options.channelId=1] - the channel to squat in
 * @param {Number} [options.groupId=1] - the group ID to toggle
 * @param {String} [options.kickMessage='Group toggled'] - the kick reason after toggle
 * @constructor
 */
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

/**
 * Send a login request to initalize connection
 *
 * @returns {Promise}
 * @private
 */
GroupToggler.prototype._login = function() {
    return this._send('login', {client_login_name: this._options.username, client_login_password: this._options.password});
};

/**
 * Tell the client to use the server on the supplied port, required after login
 *
 * @returns {Promise}
 * @private
 */
GroupToggler.prototype._useServer = function() {
    return this._send('use', {port: this._options.serverport});
};

/**
 * Register for channel events, required for events to trigger
 *
 * @returns {Promise}
 * @private
 */
GroupToggler.prototype._notifyForEvents = function() {
    return this._send('servernotifyregister', {event: 'channel', id: this._options.channelId});
};

/**
 * Start connection to the server, runs login, selects a server and then notifies for events
 *
 * @returns {Promise}
 * @private
 */
GroupToggler.prototype._connect = function() {
    var self = this;
    return this._login()
        .then(function() {
            return self._useServer();
        }).then(function() {
            return self._notifyForEvents();
        });
};

/**
 * Listener. Fired on when clients are moved into/out of the registered channel. If the client was moved into our
 * channel we toggle their group and kick them
 *
 * @param {Object} moveEvent
 * @private
 */
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

/**
 * Listener. Fired when a client connects to the channel registered. Kicks the client on connection to the channel
 *
 * @param {Object} viewEvent
 * @private
 */
GroupToggler.prototype._onEnterView = function(viewEvent) {
    if(viewEvent.ctid !== this._options.channelId) {
        return; // not in this channel
    }

    return this._kickClient(viewEvent.clid, 'Channel not allowed');
};

/**
 * Kick the client with the given id from the channel
 *
 * @param {Number} clid - the id of the client to kick
 * @param {String} message - the reason for kicking
 * @returns {Promise}
 * @private
 */
GroupToggler.prototype._kickClient = function(clid, message) {
    return this._send('clientkick', {clid: clid, reasonid: 4, reasonmsg: message});
};

/**
 * Toggles the group for the given client
 *
 * @param {Number} clid - the client id of the client to toggle
 * @returns {Promise}
 */
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

/**
 * Starts the conection up and starts listening/responding to events
 *
 * @returns {Promise} resolves after initial connection
 */
GroupToggler.prototype.run = function() {
    // register events
    this._client.on('clientmoved', this._onClientMove.bind(this));
    this._client.on('cliententerview', this._onEnterView.bind(this));

    var self = this;
    return this._connect().then(function() {

        // run a keep alive
        setInterval(function() {
            self._send('whoami', {} , function(err) {
                if(err) console.log(err);
            });
        }, 60000)
    });
};

module.exports = GroupToggler;