require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');

const auth = require("http-auth");
const path = require("path");

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 3000;

// Middleware to perform Basic Authentication using environment variables
const basicAuth = (req, res, next) => {
  // Get the Authorization header
  const authHeader = req.headers.authorization || "";

  console.log("Authorization Header:", authHeader); // Log the Authorization header

  // Check if the Authorization header is in the expected "Basic" format
  const [type, credentials] = authHeader.split(" ");

  if (type === "Basic") {
    console.log("Auth Type:", type); // Log the type to verify it's "Basic"

    // Decode the base64 encoded credentials (format: username:password)
    const decodedCredentials = Buffer.from(credentials, "base64").toString();
    console.log("Decoded Credentials:", decodedCredentials); // Log the decoded credentials

    const [username, password] = decodedCredentials.split(":");

    console.log("Username:", username); // Log the username
    console.log("Password:", password); // Log the password

    // Validate the username and password against the environment variables
    if (
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    ) {
      console.log("Authentication successful"); // Log successful authentication
      return next(); // If valid, proceed to the next middleware or route
    } else {
      console.log("Authentication failed: Invalid credentials"); // Log failed authentication
    }
  } else {
    console.log("Authentication failed: Unsupported auth type"); // Log if auth type is not Basic
  }

  // If authentication fails, send a 401 response and ask for the Basic Auth credentials
  res.setHeader("WWW-Authenticate", 'Basic realm="Protected Area"');
  res.sendStatus(401); // Unauthorized
};


app.use(express.static('public'));
app.use(express.json());

console.log("ADMIN_USERNAME:", process.env.ADMIN_USERNAME);
console.log("ADMIN_PASSWORD:", process.env.ADMIN_PASSWORD);

let isAuthenticated = false;

app.ws("/connection", (ws, req) => {
  try {
    ws.on("error", console.error);
    let streamSid = "stream-123"; // static stream ID
    let callSid = "call-123"; // static call ID

    const gptService = new GptService();
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});

    let marks = [];
    let interactionCount = 0;
    let delayTimer;

    const handleDelay = async () => {
      console.log(
        "No transcription received within the expected time. Finalizing transcription."
      );

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

      // Handle the authentication message
      if (msg.type === "auth") {
        // Validate credentials
        const { username, password } = msg;

        if (
          username === process.env.ADMIN_USERNAME &&
          password === process.env.ADMIN_PASSWORD
        ) {
          console.log("Authentication successful");
          isAuthenticated = true; // Mark the connection as authenticated
          ws.send(JSON.stringify({ type: "auth", success: true }));
        } else {
          console.log("Authentication failed");
          ws.send(JSON.stringify({ type: "auth", success: false }));
          ws.close(); // Close the connection on failed authentication
        }
        return; // Exit early since this was an authentication message
      }

      // Proceed only if the connection is authenticated
      if (!isAuthenticated) {
        console.log("Unauthenticated request, ignoring message");
        return; // Ignore all other messages until authenticated
      }

      // Process the remaining WebSocket events if authenticated
      if (msg.event === "start") {
        console.log(`Start connection from client: ${JSON.stringify(msg)}`);

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
        marks = marks.filter((m) => m !== label);
      } else if (msg.event === "stop") {
        console.log(`Twilio -> Media stream ${streamSid} ended.`.underline.red);

        const endOfCallReport = {
          Bundle: {
            messageCollection: {
              type: "end-of-call-report",
              endedReason: "customer-ended-call",
              transcript: "",
              summary: "",
              messagesArray: gptService.userContext.slice(1),
              analysisCollection: {
                summary: "",
                successEvaluation: false,
              },
              recordingUrl: "",
              stereoRecordingUrl: "",
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