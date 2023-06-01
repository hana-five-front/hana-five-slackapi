
require('dotenv').config();
const {createClient} = require('redis')
const redis = require('redis')
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { WebClient } = require('@slack/web-api');

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

async function getUserName(userId) {
  const slackToken = process.env.SLACK_TOKEN;
  const client = new WebClient(slackToken);
  try {
    const userInfo = await client.users.info({ user: userId });
    return userInfo.user.real_name;
  } catch (error) {
    console.error(error);
  }
}
async function getConversationHistory() {
  const slackToken = process.env.SLACK_TOKEN;
  const client = new WebClient(slackToken);
  const channel = process.env.CHANNEL;
  try {
    const limit = 1; // 가져올 메시지의 수 제한
    let data = [];

    let hasMore = true;
    let cursor = undefined;

    while (hasMore) {
      const response = await client.conversations.history({
        channel,
        limit,
        cursor,
      });

      const messages = response.messages;

      for (const message of messages) {
        let name = await getUserName(message.user);
        name = name == 'Demo App' ? '' : name;

        const date = new Date(message.ts * 1000);
        const lines = message.text.split('\n');
        const title = lines[0];
        const content = lines.slice(1);

        data.push({ name, date, title, content });
      }

      hasMore = response.has_more;
      cursor = response.response_metadata.next_cursor;
    }

    return data;
  } catch (error) {
    console.error(error);
  }
}
app.get('/slackapi', async (req, res) => {
  await connectToRedis()
    .then( async () => {
      const client = createClient({
        password: process.env.REDIS_PASSWORD,
        socket: {
            host: process.env.REDIS_HOST,
            port: 16537
        }
    });
      let response = await client.connect().then(async()=>{
        return await client.get('slackApi') 
      })
   
       res.status(200).json(response)
      }
    )
    .catch(error => {
      console.log(error);
    });
});
async function connectToRedis() {

  const client = createClient({
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: 16537
    }
});
let connected = false; // 연결 여부를 확인하는 플래그 변수

setInterval(async () => {
  if (!connected) {
    try {
      await client.connect();
      connected = true;
      const slackApiNoticeData = await getConversationHistory();
      console.log(slackApiNoticeData);
      await addArrayOfObjectsToRedis("slackApi", slackApiNoticeData);
      console.log(await client.get("slackApi"));
    } catch (error) {
      console.error("Error connecting to Redis:", error);
    } finally {
      client.quit();
      connected = false;
    }
  }
}, 3600000);
  
  async function addArrayOfObjectsToRedis(key, arrayOfObjects) {
    const serializedArray = JSON.stringify(arrayOfObjects);
    await client.set(key, serializedArray, (error, result) => {
      if (error) {
        console.error('Redis에 객체로 된 배열 추가 중 에러가 발생했습니다.', error);
      } else {
        console.log('객체로 된 배열이 Redis에 추가되었습니다.');
      }
    });
  }


}

// async 함수 호출
connectToRedis()
  .then(async() => {
    console.log('Redis 서버에 연결되었습니다.');

  })
  .catch((error) => {
    console.error('Redis 연결 중 에러가 발생했습니다.', error);
  });

// WebClient 인스턴스 생성
const slackClient = new WebClient(process.env.SLACK_TOKEN);
// Slack에 메시지 보내는 함수
async function sendMessageToSlack(text) {
  try {
    const result = await slackClient.chat.postMessage({
      channel: process.env.CHANNEL,
      text: text,
    });

    console.log('Message sent:', result);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// SlackQNA에 메시지 보내는 함수
async function sendQnaMessageToSlack(text) {
  try {
    const result = await slackClient.chat.postMessage({
      channel: process.env.QNA_CHANNEL,
      text: text,
    });

    console.log('Message sent:', result);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

app.post('/slackapi', (req, res) => {
  const text = req.body.text;
  sendMessageToSlack(text);
});

app.post('/qna', (req, res) => {
  const text = req.body.text;
  sendQnaMessageToSlack(text);
});
app.get('/qna', (req,res) => {
  const slackToken = process.env.SLACK_TOKEN;
  const client = new WebClient(slackToken);
  // 대화 내역을 가져오기 위해 API 요청을 만듭니다.
  const channel = process.env.QNA_CHANNEL;

  async function getUserName(userId) {
    try {
      const userInfo = await client.users.info({ user: userId });
      return userInfo.user.real_name;
    } catch (error) {
      console.error(error);
    }
  }
  async function getConversationHistory() {
    try {
      const response = await client.conversations.history({ channel });
      const messages = response.messages;
      // 각 메시지의 사용자 이름과 메시지 텍스트를 가져와 출력
      let data = [];
      for (const message of messages) {
        let name = await getUserName(message.user);
        name = name == 'Demo App' ? '' : name;
        // 작성 날짜 표시
        const date = new Date(message.ts * 1000);
        // 줄바꿈 문자를 기준으로 첫 번째 줄과 나머지 줄 분리
        const lines = message.text.split('\n');
        const title = lines[0];
        const content = lines.slice(1);
        data.push({ name, date, title, content });
      }
      return data;
    } catch (error) {
      console.error(error);
    }
  }
  getConversationHistory()
    .then(response => {
      console.log(response)
      res.status(200).json(response);
    })
    .catch(error => {
      console.log(error);
    });
})
app.get('/header',(req,res)=> res.status(200).json({"header":process.env.HEADER}))
const PORT = process.env.PORT;
const start = async () => {
  try {
    app.listen(PORT, () => console.log(`Server is listening on ${PORT}!!`));
  } catch (err) {
    console.error(err);
  }
};

start();