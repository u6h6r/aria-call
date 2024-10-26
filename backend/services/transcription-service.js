require("colors");
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const { Buffer } = require("node:buffer");
const EventEmitter = require("events");

class TranscriptionService extends EventEmitter {
  constructor() {
    super();
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.dgConnection = deepgram.listen.live({
      encoding: "mulaw",
      sample_rate: "8000",
      language: "pl",
      model: "nova-2",
      punctuate: true,
      interim_results: true,
      endpointing: 150,
      utterance_end_ms: 1100,
    });

    this.finalResult = "";
    this.speechFinal = false;
    this.silenceTimeout = null;

    this.dgConnection.on(LiveTranscriptionEvents.Open, () => {
      this.dgConnection.on(
        LiveTranscriptionEvents.Transcript,
        (transcriptionEvent) => {
          const alternatives = transcriptionEvent.channel?.alternatives;
          let text = "";
          if (alternatives) {
            text = alternatives[0]?.transcript;
          }

          if (transcriptionEvent.type === "UtteranceEnd") {
            if (!this.speechFinal) {
              console.log(
                `UtteranceEnd received before speechFinal, emitting collected text: ${this.finalResult}`
                  .yellow
              );
              this.emit("transcription", this.finalResult);
              this.finalResult = "";
              return;
            } else {
              console.log(
                "STT -> Speech was already final when UtteranceEnd received"
                  .yellow
              );
              return;
            }
          }

          if (transcriptionEvent.is_final === true && text.trim().length > 0) {
            this.finalResult += ` ${text}`;

            if (transcriptionEvent.speech_final === true) {
              this.speechFinal = true;
              this.emit("transcription", this.finalResult);
              this.finalResult = "";
              this.clearSilenceTimeout();
            } else {
              this.speechFinal = false;
              this.resetSilenceTimeout();
            }
          } else if (text.trim().length > 0) {
            this.emit("utterance", text);
          }
        }
      );

      this.dgConnection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error("STT -> deepgram error", error);
      });

      this.dgConnection.on(LiveTranscriptionEvents.Warning, (warning) => {
        console.error("STT -> deepgram warning", warning);
      });

      this.dgConnection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
        console.error("STT -> deepgram metadata", metadata);
      });

      this.dgConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log("STT -> Deepgram connection closed".yellow);
      });
    });
  }

  send(payload) {
    if (this.dgConnection.getReadyState() === 1) {
      this.dgConnection.send(Buffer.from(payload, "base64"));
    }
  }

  finalize() {
    if (this.dgConnection.getReadyState() === 1) {
      this.dgConnection.send(
        JSON.stringify({
          type: "Finalize",
        })
      );
      console.log("Finalize message sent to Deepgram.".green);
    } else {
      console.error("WebSocket is not open. Cannot send Finalize message.".red);
    }
  }

  resetSilenceTimeout() {
    this.clearSilenceTimeout();
    this.silenceTimeout = setTimeout(() => {
      console.log(
        "STT -> No speech detected for a while, finalizing transcription."
          .yellow
      );
      if (this.finalResult.trim().length > 0) {
        this.emit("transcription", this.finalResult);
        this.finalResult = "";
      }
      this.finalize();
    }, 5000);
  }

  clearSilenceTimeout() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }
}

module.exports = { TranscriptionService };