require('dotenv').config();
const { App } = require('@slack/bolt');
const http = require('http');

const socket_server = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

function sendDataToClient(data) {
  io.emit('chat', data);
}

socket_server.message('hello', async ({ message, say }) => {
  await say(`Hey there <@${message.user}>!`);
});

const server = http.createServer();
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', async socket => {
  console.log('Client connected');

  // 채널의 메시지 가져오기
  const channelId = process.env.SOCKET_CHANNEL; // 실제 채널 ID로 대체해야 합니다.
  await fetchChannelHistory(channelId);

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

async function fetchChannelHistory(channelId) {
  let data = [];
  try {
    const response = await socket_server.client.conversations.history({
      channel: channelId,
      limit: 100,
    });
    for (let i = response.messages.length - 1; i >= 0; i--) {
      
      let lines = response.messages[i].text.split('\n');
      const element = {
        title: lines[0],
        content: lines.slice(1),
      };
      data.push(element);
    }
    sendDataToClient(data);
  } catch (error) {
    console.error('Error fetching channel history:', error);
  }
}

// Slack 앱에서 `message.channels` 이벤트 구독
socket_server.event('message', async ({ event, client }) => {
  const channelId = event.channel;
  await fetchChannelHistory(channelId);
});

(async () => {
  await socket_server.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
  server.listen(4000, () => {
    console.log('WebSocket server is running!');
  });
})();
