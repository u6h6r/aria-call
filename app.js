require('dotenv').config();
require('colors');

const express = require('express');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const ExpressWs = require('express-ws');

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET; // Use an environment variable for the secret key


app.use(express.static('public'));
app.use(express.json());

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Login route to authenticate the user and return a JWT token
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Check if the username matches
  if (username !== ADMIN_USERNAME || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Generate a JWT token for the user
  const token = jwt.sign({ username: ADMIN_USERNAME }, SECRET_KEY, { expiresIn: '1h' });

  // Return the token to the client
  res.json({ token });
});

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(403).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    // Token is valid, store decoded user data
    req.user = decoded;
    next();
  });
}

// Serve login.html at the /login URL
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Root route: Redirect to /login if not authenticated
app.get('/', (req, res) => {
  const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;

  if (!token) {
    return res.redirect('/login');  // Redirect to login if no token is found
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.redirect('/login');  // Redirect to login on invalid token
    }

    // Token is valid, serve the protected page (index.html)
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
});

app.ws('/connection', verifyToken,  (ws) => {
  try {
    ws.on("error", console.error);
    let streamSid = "stream-123"; // static stream ID
    let callSid = "call-123";     // static call ID

    const gptService = new GptService();
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});

    let marks = [];
    let interactionCount = 0;
    let delayTimer;

    const handleDelay = async () => {
      console.log("No transcription received within the expected time. Finalizing transcription.");

      transcriptionService.finalize();
      ttsService.generate(
        {
          partialResponseIndex: null,
          partialResponse: "Czy mogę prosić o powtórzenie?",
        },
        0
      );
      interactionCount += 1;
    };

    ws.on("message", function message(data) {
      const msg = JSON.parse(data);
      if (msg.event === "start") {
        console.log(`Start connection from client: ${msg}`);
        
        streamService.setStreamSid(streamSid);
        gptService.setCallSid(callSid);

        ttsService.generate(
          {
            partialResponseIndex: null,
            partialResponse:
              "Dzień dobry, tu Monika, wirtualna asystentka gabinetu Aria-Dental. Mogę pomóc w umówieniu wizyty lub przełączyć do recepcji. W czym mogę dzisiaj pomóc?",
          },
          0
        );
      } else if (msg.event === "media") {
        transcriptionService.send(msg.media.payload);
        
      } else if (msg.event === "mark") {
        const label = msg.mark.name;
        clearTimeout(delayTimer);
        delayTimer = setTimeout(handleDelay, 9000);
        marks = marks.filter((m) => m !== msg.mark.name);
      } else if (msg.event === "stop") {
        console.log(`Twilio -> Media stream ${streamSid} ended.`.underline.red);

        const endOfCallReport = {
          Bundle: {
            messageCollection: {
              type: "end-of-call-report",
              endedReason: "customer-ended-call",
              transcript: '',
              summary: '',
              messagesArray: gptService.userContext.slice(1),
              analysisCollection: {
                summary: "",
                successEvaluation: false,
              },
              recordingUrl: '',
              stereoRecordingUrl: '',
              durationMs: 0,
              durationSeconds: 0,
              durationMinutes: 0,
              callCollection: {
                id: callSid,
                orgId: streamSid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                type: "inbound",
                status: "",
                assistantId: "",
              },
              timestamp: new Date().toISOString(),
            },
          },
        };

        fetch("https://hook.eu2.make.com/e1t1bgpomz6ahl4o5plp8twwh9ukgjm1", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(endOfCallReport),
        }).catch((error) => {
          console.error("Error sending end-of-call report:", error);
        });
      }
    });

    transcriptionService.on("utterance", async (text) => {
      if (marks.length > 0 && text?.length > 5) {
        ws.send(
          JSON.stringify({
            streamSid,
            event: "clear",
          })
        );
      }
    });

    transcriptionService.on("transcription", async (text) => {
      if (!text) {
        return;
      }
      clearTimeout(delayTimer);
      gptService.completion(text, interactionCount);
      interactionCount += 1;
    });

    gptService.on("gptreply", async (gptReply, icount) => {
      clearTimeout(delayTimer);
      ttsService.generate(gptReply, icount);
    });

    ttsService.on("speech", (responseIndex, audio, label, icount) => {
      streamService.buffer(responseIndex, audio);
    });

    streamService.on("audiosent", (markLabel) => {
      marks.push(markLabel);
    });

  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});