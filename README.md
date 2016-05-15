teamspeak-group-toggle
======================

This is a script that runs a bot on a specified teamspeak server. When a client enters the specified channel the bot
will toggle the specified group on the client and then kick them.

# Configuration

Example configuration can be found in /config.example.json Configuration is expected to be at /config.json

The values given are the default values, any non-provided key in config.json will default to them.

    {
      "address": "localhost",         // where is the server?
      "queryport": 10011,             // serverquery port for connections
      "serverport": 9987,             // port of the virtual server to use
      "username": "serveradmin",      // serverquery account details
      "password": "",
      "channelId": 1,                 // the ID of the channel to watch
      "groupIds": [1],                // the IDs of the groups to toggle
      "kickMessage": "Group toggled"  // the kick message when toggling the group
    }