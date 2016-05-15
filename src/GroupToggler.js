const TeamSpeakClient = require('node-teamspeak');
const { isUndefined, difference, intersection, concat } = require('lodash');
const Promise = require('bluebird');

class NoPermissionError extends Error {};

module.exports = class GroupToggler {

    /**
     * @param {Object} [param={}]
     * @param {String} [param.address='localhost'] - address to connect to
     * @param {Number} [param.queryport=10011] - server query port
     * @param {Number} [param.serverport=9987] - port of server to use
     * @param {String} [param.username='serveradmin'] - server query account username
     * @param {String} [param.botname='BOT'] - client name to use
     * @param {String} [param.password=''] - server query account password
     * @param {Number} [param.channelId=1] - the channel to squat in
     * @param {Number} [param.groupIds=[]] - the group IDs to toggle
     * @param {String} [param.kickMessage='Group toggled'] - the kick reason after toggle
     * @param {String} [param.allowedGroupIds=[]] - group ids allowed to use this, leave empty for no restrictions
     * @constructor
     */
    constructor({
        address = 'localhost',
        queryport = 10011,
        serverport = 9987,
        username = 'serveradmin',
        botname = 'BOT',
        password = '',
        channelId,
        groupIds = [],
        kickMesage = 'Group Toggled',
        allowedGroupIds = []
    } = {}) {
        if (isUndefined(channelId)) throw new Error("Must provide a channel id to listen in");

        this._credentials = { username, password, name: botname };
        this._connectionInfo = { address, queryport, serverport };
        this._channelId = channelId;
        this._allowedGroupIds = allowedGroupIds.map(it => it.toString());
        this._groupIds = groupIds.map(it => it.toString());
        this._message = kickMesage;

        this._client = new TeamSpeakClient(address, queryport);
        this._send = Promise.promisify(this._client.send, this._client);
    }

    /**
     * Send a login request to initalize connection
     *
     * @returns {Promise}
     * @private
     */
    _login() {
        return this._send('login', {
            client_login_name: this._credentials.username,
            client_login_password: this._credentials.password
        });
    }

    /**
     * Tell the client to use the server on the supplied port, required after login
     *
     * @returns {Promise}
     * @private
     */
    _useServer() {
        return this._send('use', { port: this._connectionInfo.serverport });
    }

    /**
     * Register for channel events, required for events to trigger
     *
     * @returns {Promise}
     * @private
     */
    _notifyForEvents() {
        return this._send('servernotifyregister', { event: 'channel', id: this._channelId });
    }

    /**
     * Start connection to the server, runs login, selects a server and then notifies for events
     *
     * @returns {Promise}
     * @private
     */
    _connect() {
        return this._login()
            .then(() => this._useServer())
            .then(() => this._changeName())
            .then(() => this._notifyForEvents());
    }

    /**
     * Toggles the groups for the given client
     *
     * @param {Number} clid - the client id of the client to toggle
     * @returns {Promise}
     */
    toggleGroups(clid) {
        return this._send('clientinfo', { clid: clid }, ['groups'])
            .then(response => {
                let groupIds = response.client_servergroups;

                // single group is returned as a number
                if(typeof groupIds === 'number') {
                    groupIds = [groupIds.toString()]
                } else {
                    // returned a comma seperated list of numbers
                    groupIds = groupIds.split(',');
                }

                if (this._allowedGroupIds.length > 0 && intersection(this._allowedGroupIds, groupIds).length == 0) {
                    throw new NoPermissionError();
                }

                return Promise.all(
                    concat(
                        intersection(this._groupIds, groupIds).map(id => this._send('servergroupdelclient', { sgid: id, cldbid: response.client_database_id })),
                        difference  (this._groupIds, groupIds).map(id => this._send('servergroupaddclient', { sgid: id, cldbid: response.client_database_id }))
                    )
                );
            });
    }

    /**
     * Listener. Fired on when clients are moved into/out of the registered channel. If the client was moved into our
     * channel we toggle their group and kick them
     *
     * @param {Object} moveEvent
     * @private
     */
    _onClientMove(moveEvent) {
        if(moveEvent.ctid !== this._channelId) return; // moved out of the channel

        const clientId = moveEvent.clid;

        return this.toggleGroups(clientId)
            .then(() => Promise.all([
                this._kickClient(clientId, this._message),
                this._sendPoke(clientId, this._message)
            ]))
            .catch(NoPermissionError, () => Promise.all([
                this._kickClient(clientId, 'You do not have permission to use this channel'),
                this._sendPoke(clientId, 'You do not have permission to use this channel')
            ]))
            .catch(err => console.error('Failed to toggle group/kick client ID', clientId, err));
    };

    /**
     * Listener. Fired when a client connects to the channel registered. Kicks the client on connection to the channel
     *
     * @param {Object} viewEvent
     * @private
     */
    _onEnterView(viewEvent) {
        if(viewEvent.ctid !== this._channelId) return; // not in this channel

        return this._kickClient(viewEvent.clid, 'Channel not allowed');
    };

    _sendPoke(clid, msg) {
        return this._send('clientpoke', { clid, msg });
    }

    /**
     * Kick the client with the given id from the channel
     *
     * @param {Number} clid - the id of the client to kick
     * @param {String} message - the reason for kicking
     * @returns {Promise}
     * @private
     */
    _kickClient(clid, message) {
        return this._send('clientkick', { clid: clid, reasonid: 4, reasonmsg: message });
    }

    _changeName() {
        return this._send('clientupdate', { client_nickname: this._credentials.name });
    }

    /**
     * Starts the conection up and starts listening/responding to events
     *
     * @returns {Promise} resolves after initial connection
     */
    run() {
        // register events
        this._client.on('clientmoved', this._onClientMove.bind(this));
        this._client.on('cliententerview', this._onEnterView.bind(this));

        return this._connect()
            // Run a keep alive
            .then(() => setInterval(() => this._send('whoami', {}).catch(err => console.error(err)), 60000));
    };
};