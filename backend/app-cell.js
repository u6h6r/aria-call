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

app.ws('/connection', (ws) => {
  try {
    ws.on('error', console.error);
    let streamSid;
    let callSid;

    const gptService = new GptService();
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});

    let marks = [];
    let interactionCount = 0;
    let delayTimer;
    let noResponseCount = 0;

    const handleDelay = async () => {
      console.log(
        'No transcription received within the expected time. Finalizing transcription.'
      );

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
        console.log(msg);
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;

        streamService.setStreamSid(streamSid);
        gptService.setCallSid(callSid);

        ttsService.generate(
          {
            partialResponseIndex: null,
            partialResponse:
              'Hello, this is Eva, the virtual assistant of Aria-Dental clinic. I can help you schedule an appointment or connect you to the reception. How may I assist you today?',
          },
          interactionCount
        );
        interactionCount += 1;
      } else if (msg.event === 'media') {
        transcriptionService.send(msg.media.payload);
      } else if (msg.event === 'mark') {
        const label = msg.mark.name;
        console.log(
          `Audio completed mark (${msg.sequenceNumber}): ${label}`.red
        );
        clearTimeout(delayTimer);
        console.log('Clear timeout');
        delayTimer = setTimeout(handleDelay, 9000);
        console.log('Start timer to wait');
        marks = marks.filter((m) => m !== label);
      } else if (msg.event === 'stop') {
        console.log(`Media stream ${streamSid} ended.`.underline.red);

        const endOfCallReport = {
          Bundle: {
            messageCollection: {
              type: 'end-of-call-report',
              endedReason: 'customer-ended-call',
              transcript: '',
              summary: '',
              messagesArray: gptService.userContext.slice(1),
              analysisCollection: {
                summary: '',
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
                type: 'inbound',
                status: '',
                assistantId: '',
              },
              timestamp: new Date().toISOString(),
            },
          },
        };

        fetch('https://hook.eu2.make.com/e1t1bgpomz6ahl4o5plp8twwh9ukgjm1', {
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
        console.log('Interruption detected, clearing stream'.red);
        ws.send(
          JSON.stringify({
            streamSid,
            event: 'clear',
          })
        );
      }
    });

    transcriptionService.on('transcription', async (text) => {
      if (!text) {
        return;
      }
      console.log(
        `Interaction ${interactionCount} – STT -> GPT: ${text}`.yellow
      );

      clearTimeout(delayTimer);
      console.log('Clear timeout');
      gptService.completion(text, interactionCount);
      interactionCount += 1;
    });

    gptService.on('gptreply', async (gptReply, icount) => {
      console.log(
        `Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`.green
      );
      clearTimeout(delayTimer);
      console.log('Clear timeout');

      if (
        gptReply &&
        gptReply.partialResponse &&
        gptReply.partialResponse.includes('end the call')
      ) {
        console.log('Ending the call as per GPT response.');
        ws.close();
      }

      ttsService.generate(gptReply, icount);
    });

    ttsService.on('speech', (responseIndex, audio, label, icount) => {
      console.log(`Interaction ${icount}: TTS output: ${label}`.blue);
      clearTimeout(delayTimer);
      console.log('Clear timeout');
      streamService.buffer(responseIndex, audio);
    });

    streamService.on('audiosent', (markLabel) => {
      marks.push(markLabel);
    });
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
