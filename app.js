require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { WebClient } = require('@slack/web-api');

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// health check
app.get('/ping', (req, res) => {
  res.status(200).json({ message: 'pong' });
});

app.get('/slackapi', (req, res) => {
  const slackToken = process.env.SLACK_TOKEN;
  const client = new WebClient(slackToken);
  // 대화 내역을 가져오기 위해 API 요청을 만듭니다.
  const channel = process.env.CHANNEL;

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
        const userName = await getUserName(message.user);
        // 작성 날짜 표시
        const date = new Date(message.ts * 1000);
        // 줄바꿈 문자를 기준으로 첫 번째 줄과 나머지 줄 분리
        const lines = message.text.split('\n');
        const title = lines[0];
        const contents = lines.slice(1);
        data.push({ userName, date, title, contents });
      }
      return data;
    } catch (error) {
      console.error(error);
    }
  }
  getConversationHistory()
    .then((response) => {
      res.status(200).json(response);
    })
    .catch((error) => {
      console.log(error);
    });
});

const PORT = process.env.PORT;
const start = async () => {
  try {
    app.listen(PORT, () => console.log(`Server is listening on ${PORT}!!`));
  } catch (err) {
    console.error(err);
  }
};

start();
