require('dotenv').config();
const express = require('express');
const ExpressWs = require('express-ws');
const fetch = require('node-fetch');

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
    ws.on('error', console.error);

    // Generate unique IDs for the session
    let streamSid = `stream-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let callSid = `call-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const gptService = new GptService();
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});

    let marks = [];
    let interactionCount = 0;
    let delayTimer;

    const handleDelay = async () => {
      console.log('No transcription received within the expected time. Finalizing transcription.');

      transcriptionService.finalize();
      ttsService.generate(
        {
          partialResponseIndex: null,
          partialResponse: 'Could you please repeat?',
        },
        interactionCount
      );
      interactionCount += 1;
    };

    ws.on('message', function message(data) {
      const msg = JSON.parse(data);

      if (msg.event === 'start') {
        console.log(`Start connection from client: ${JSON.stringify(msg)}`);

        streamService.setStreamSid(streamSid);
        gptService.setCallSid(callSid);

        ttsService.generate(
          {
            partialResponseIndex: null,
            partialResponse:
              'Hello, this is Eva from AriaDental clinic. I am calling to confirm your upcoming appointment.',
          },
          interactionCount
        );
        interactionCount += 1;
      } else if (msg.event === 'media') {
        transcriptionService.send(msg.media.payload);
      } else if (msg.event === 'mark') {
        const label = msg.mark.name;
        clearTimeout(delayTimer);
        delayTimer = setTimeout(handleDelay, 9000);
        marks = marks.filter((m) => m !== label);
      } else if (msg.event === 'stop') {
        console.log(`Media stream ${streamSid} ended.`);

        // Handle end of call logic here, such as sending an end-of-call report
        const endOfCallReport = {
          Bundle: {
            messageCollection: {
              type: 'end-of-call-report',
              endedReason: 'client-ended-call',
              transcript: '',
              summary: '',
              messagesArray: gptService.userContext.slice(1),
              analysisCollection: {
                summary: '',
                successEvaluation: false,
              },
              recordingUrl: '',
              durationMs: 0,
              callCollection: {
                id: callSid,
                orgId: streamSid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                type: 'outbound', // Changed from 'inbound' to 'outbound'
                status: '',
                assistantId: '',
              },
              timestamp: new Date().toISOString(),
            },
          },
        };

        // Send the report to your desired endpoint
        fetch('https://your-endpoint.com/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(endOfCallReport),
        }).catch((error) => {
          console.error('Error sending end-of-call report:', error);
        });
      }
    });

    transcriptionService.on('utterance', async (text) => {
      if (marks.length > 0 && text?.length > 5) {
        console.log('User interruption detected, clearing stream.');
        ws.send(
          JSON.stringify({
            streamSid,
            event: 'clear',
          })
        );
      }
    });

    transcriptionService.on('transcription', async (text) => {
      if (!text) return;

      console.log(`Interaction ${interactionCount} – STT -> GPT: ${text}`);
      clearTimeout(delayTimer);
      gptService.completion(text, interactionCount);
      interactionCount += 1;
    });

    gptService.on('gptreply', async (gptReply, icount) => {
      console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`);
      clearTimeout(delayTimer);

      // Handle call ending logic if needed
      if (gptReply.partialResponse.includes('end the call')) {
        console.log('Ending the call as per GPT response.');

        // Send an 'endCall' event to the frontend
        ws.send(
          JSON.stringify({
            event: 'endCall',
            message: 'The assistant has ended the call.',
          })
        );

        // Delay closing the WebSocket to ensure the message is sent
        setTimeout(() => {
          ws.close();
        }, 1000);
      }

      ttsService.generate(gptReply, icount);
    });

    ttsService.on('speech', (responseIndex, audio, label, icount) => {
      console.log(`Interaction ${icount}: TTS -> Client: ${label}`);
      streamService.buffer(responseIndex, audio);
    });

    streamService.on('audiosent', (markLabel) => {
      marks.push(markLabel);
    });
  } catch (err) {
    console.error('Error in WebSocket connection:', err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
