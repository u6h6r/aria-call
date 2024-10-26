require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.ws('/connection', (ws) => {
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