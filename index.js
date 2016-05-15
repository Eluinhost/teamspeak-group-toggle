const BotFactory = require('teamspeak-channel-squatter');
const { concat, intersection, difference } = require('lodash');

const config = require('./../config.json');

const toggleGroupIds = config.groupIds.map(id => id.toString());

const toggleGroups = (bot, clid) => bot._send('clientinfo', { clid: clid }, ['groups'])
    .then(response => {
        let groupIds = response.client_servergroups;

        // single group is returned as a number
        if(typeof groupIds === 'number') {
            groupIds = [groupIds.toString()]
        } else {
            // returned a comma seperated list of numbers
            groupIds = groupIds.split(',');
        }

        Promise.all(
            concat(
                intersection(toggleGroupIds, groupIds).map(id => bot._send('servergroupdelclient', { sgid: id, cldbid: response.client_database_id })),
                difference  (toggleGroupIds, groupIds).map(id => bot._send('servergroupaddclient', { sgid: id, cldbid: response.client_database_id }))
            )
        )
        .then(() => Promise.all([
            bot.kickClient(clid, config.kickMessage),
            bot.sendPoke(clid, config.kickMessage)
        ]))
        .catch(err => console.error('Failed to toggle group/kick client ID', clid, err));
    });

(new BotFactory())
    .withCredentials(config.username, config.password, config.botname)
    .withAllowedGroups(config.allowedGroupIds)
    .withConnectionInfo(config.address, config.queryport, config.serverport)
    .inChannel(config.channelId)
    .withActions(toggleGroups, (bot, clid) => Promise.all([
        bot.kickClient(clid, config.noPermMessage),
        bot.sendPoke(clid, config.noPermMessage)
    ]))
    .build() // Build the bot
    .start() // Start the bot
    .then(() => console.log('Connected!'))
    .catch(err => console.error(err));