# Eternal Chest Watch

## What is this?
This will run and idle in configured streams and auto accept any drops that appear on the stream

## How to setup
You will need to find a valid JWT token for your account.  

Easiest way to do this is to find the websocket connection in chrome when you're on a twitch stream with the Eternal Card Game extension enabled. There should be an authentication handshake in the `Frames` tab. Inside that payload there will be a `jwt` key. Simply replace the empty string with this key in the included `config.example.json`.  

You may also add as many Eternal streams as you want to the list. By default its configured to idle in `https://www.twitch.tv/jonahveil` and `https://www.twitch.tv/arengeeeternal`  

## Running
`node index.js <path to config.json>`