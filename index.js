const fs = require('fs');
const ws = require('websocket');
const notifier = require('node-notifier');

const notify = (title, message) => {
    notifier.notify({ title: 'Eternal Drop Watch: ' + title, message })
}

const log = (message) => {
    console.log(`${Date.now()} :: ${message}`);
}

const loadConfig = (path) => {
    const file = fs.readFileSync(path);

    return JSON.parse(file);
}

const connect = async (channelId) => new Promise((resolve, reject) => {
    const baseUrl = 'wss://twitch-int.aws.direwolfdigital.com:8081'
    const address = `${baseUrl}/${channelId}/`;
    const origin = 'https://0qr7fa6llzn4txgnfgb8ipeksd5v24.ext-twitch.tv';

    const client = new ws.client();

    client.on('connectFailed', (error) => reject(error));
    client.on('connect', (connection) => resolve(connection))

    client.connect(address, [], origin, {
        Host: 'twitch-int.aws.direwolfdigital.com:8081',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
    });
});

const sendMessage = async (connection, payload, json = true) => {
    const message = json ? JSON.stringify(payload) : payload;

    connection.send(message);
};

const authenticate = async (connection, token) => {
    const payload = {
        messageType: 'ViewerLogin',
        jwt: token,
    };

    log('> ViewerLogin');

    return sendMessage(connection, payload);
};

const ping = async (connection) => {
    const payload = {
        messageType: 'Ping'
    };

    log('> PING');

    sendMessage(connection, payload);
};

const handleMessage = async (connection, message) => {
    if (!message.messageType) return;

    log(`< ${message.messageType}`);

    switch (message.messageType) {
        case 'DropNotification': {
            const { nonce, twitchId, accountId, currencyGranted } = message;

            const reply = {
                nonce,
                twitchId,
                accountId,
                messageType: 'DropAccepted',
            }

            console.log(`New Drop (${currencyGranted})`);

            const timeout = Math.random() * (50000 - 5000) + 5000;

            notify(
                'New Eternal Chest Drop',
                `You just got ${currencyGranted} currency! Accepting in ${Math.floor(timeout / 1000)} seconds.`
            );

            setTimeout(async () => {
                await sendMessage(connection, reply);
                console.log('Drop Accepted:', nonce);
                notify('', 'Drop Accepted.')
            }, timeout);

            return;
        }
        default: {
            return;
        }
    }
}

const setupWatcher = async (channelId, config, retries = 0) => {
    log(`connection to channel ${channelId}`);

    if (retries > 3) {
        console.log('aborting reconnections after too many failures');
        return;
    }

    // Reset retries every 20 minutes if we're still connected
    const retryTimer = setTimeout(() => retries = 0, 200000);

    let connection = null;

    try {
        connection = await connect(channelId);
    } catch (e) {
        log('connection failed, retrying in 30 seconds')

        clearTimeout(retryTimer);

        setTimeout(() => {
            setupWatcher(channelId, config, retries + 1)
        }, 30 * 1000);

        return;
    }

    await authenticate(connection, config.jwt);

    // Ping dwd api every 10 seconds (stolen from extension code)
    const interval = setInterval(() => ping(connection), 10000);

    connection.on('message', (payload) => {
        const message = JSON.parse(payload.utf8Data);

        handleMessage(connection, message);
    });

    connection.on('error', (error) => console.log('connection error:', error));

    connection.on('close', () => {
        console.log('connection closed for', channelId)
        console.log('reconnecting', channelId);

        clearTimeout(retryTimer);
        clearInterval(interval);

        setupWatcher(channelId, config, retries + 1);
    });
}

const run = async () => {
    if (process.argv.length < 3) {
        console.log('missing configuration path argument');
        process.exit();
    }

    const config = loadConfig(process.argv[2]);

    if (!config.jwt || !config.channels || config.channels.length === 0) {
        console.log('invalid config. exiting.');
        process.exit();
    }

    config.channels.map(async channelId => setupWatcher(channelId, config));
};

run();
