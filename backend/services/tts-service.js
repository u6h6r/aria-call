require('dotenv').config();
const { Buffer } = require('node:buffer');
const EventEmitter = require('events');
const fetch = require('node-fetch');

class TextToSpeechService extends EventEmitter {
  constructor() {
    super();
    this.nextExpectedIndex = 0;
    this.speechBuffer = {};
  }

  async generate(gptReply, interactionCount) {
    const { partialResponseIndex, partialResponse } = gptReply;

    if (!partialResponse) { return; }

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/OYTbf65OHHFELVut7v2H?output_format=mp3_22050_32`,
        {
          method: "POST",
          headers: {
            "xi-api-key": process.env.XI_API_KEY,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: partialResponse,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.5,
            },
          }),
        }
      );

      if (response.status === 200) {
        const audioArrayBuffer = await response.arrayBuffer();
        this.emit(
          "speech",
          partialResponseIndex,
          Buffer.from(audioArrayBuffer).toString("base64"),
          partialResponse,
          interactionCount
        );
      } else {
        console.log("Eleven Labs Error:");
        console.log(response);
      }
    } catch (err) {
      console.error("Error occurred in XI LabsTextToSpeech service");
      console.error(err);
    }
  }
}

module.exports = { TextToSpeechService };