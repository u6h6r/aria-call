import React, { useEffect, useState, useRef, useCallback } from 'react';
import './LeftPanel.css';
import { FaPhoneAlt, FaPhoneSlash } from 'react-icons/fa';

function LeftPanel({ onCallEnded, onRefreshCalendar }) {
  const [conversationStarted, setConversationStarted] = useState(false);
  const [output, setOutput] = useState([]);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const microphoneAudioContextRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const microphoneProcessorRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationIdRef = useRef(null);
  const ballRef = useRef(null);

  const visualizeFrequency = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    animationIdRef.current = requestAnimationFrame(visualizeFrequency);

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);

    const avgFrequency =
      dataArrayRef.current.reduce((sum, value) => sum + value, 0) /
      dataArrayRef.current.length;

    const minScale = 1;
    const maxScale = 1.5;
    const scaleFactor = minScale + (avgFrequency / 255) * (maxScale - minScale);

    if (ballRef.current) {
      ballRef.current.style.transform = `scale(${scaleFactor})`;
    }
  }, []);

  const animateBall = useCallback((start) => {
    if (!start && ballRef.current) {
      ballRef.current.style.transform = 'scale(1)';
      cancelAnimationFrame(animationIdRef.current);
    }
  }, []);

  const playNextAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      animateBall(false);
      return;
    }

    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift();
    const audio = new Audio(`data:audio/wav;base64,${audioData}`);
    currentAudioRef.current = audio;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const source = audioContextRef.current.createMediaElementSource(audio);

    if (!analyserRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
    }

    source.connect(analyserRef.current);
    analyserRef.current.connect(audioContextRef.current.destination);

    audio.onended = () => {
      source.disconnect();
      playNextAudio();
    };

    audio
      .play()
      .then(() => {
        visualizeFrequency();
      })
      .catch((error) => {
        console.error('Error playing audio:', error);
        playNextAudio();
      });
  }, [animateBall, visualizeFrequency]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000/connection');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to server');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received message from server:', data);

      if (data.event === 'media' && data.media && data.media.payload) {
        audioQueueRef.current.push(data.media.payload);
        if (!isPlayingRef.current) {
          playNextAudio();
        }
      }

      if (data.partialResponse) {
        setOutput((prev) => [...prev, data.partialResponse]);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      ws.close();
    };
  }, [playNextAudio]);

  const startMicrophone = () => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        microphoneAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        microphoneStreamRef.current = microphoneAudioContextRef.current.createMediaStreamSource(stream);

        microphoneProcessorRef.current = microphoneAudioContextRef.current.createScriptProcessor(2048, 1, 1);
        microphoneStreamRef.current.connect(microphoneProcessorRef.current);
        microphoneProcessorRef.current.connect(microphoneAudioContextRef.current.destination);

        microphoneProcessorRef.current.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const downsampledBuffer = downsampleBuffer(inputData, microphoneAudioContextRef.current.sampleRate, 8000);
          const encodedData = encodeMuLaw(downsampledBuffer);
          const base64data = btoa(String.fromCharCode.apply(null, encodedData));

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                event: 'media',
                media: { payload: base64data },
              })
            );
          }
        };
      })
      .catch((err) => {
        console.error('Error accessing microphone:', err);
      });
  };

  const stopMicrophone = () => {
    if (microphoneProcessorRef.current) {
      microphoneProcessorRef.current.disconnect();
      microphoneProcessorRef.current.onaudioprocess = null;
    }
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.disconnect();
    }
    if (microphoneAudioContextRef.current) {
      microphoneAudioContextRef.current.close();
    }
    microphoneProcessorRef.current = null;
    microphoneStreamRef.current = null;
    microphoneAudioContextRef.current = null;
  };

  const stopAudioPlayback = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    isPlayingRef.current = false;
    audioQueueRef.current = [];
    animateBall(false);
  };

  const downsampleBuffer = (buffer, sampleRate, outSampleRate) => {
    if (outSampleRate >= sampleRate) {
      throw new Error('Downsampling rate should be lower than original sample rate');
    }
    const sampleRateRatio = sampleRate / outSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const offset = Math.round(i * sampleRateRatio);
      result[i] = buffer[offset];
    }

    return result;
  };

  const encodeMuLaw = (samples) => {
    const MULAW_MAX = 0x1FFF;
    const MULAW_BIAS = 33;
    const encoded = new Uint8Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      let sample = samples[i];
      sample = Math.max(-1, Math.min(1, sample));
      sample *= MULAW_MAX;

      const sign = sample < 0 ? 0x80 : 0;
      sample = Math.abs(sample);
      sample += MULAW_BIAS;

      if (sample > MULAW_MAX) sample = MULAW_MAX;

      const exponent = Math.floor(Math.log(sample) / Math.log(2));
      const mantissa = (sample >> (exponent - 3)) & 0x0F;
      const muLawByte = ~(sign | ((exponent - 5) << 4) | mantissa);
      encoded[i] = muLawByte;
    }

    return encoded;
  };

  const handleStart = () => {
    if (conversationStarted) return;

    setConversationStarted(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: 'start',
          message: 'Starting conversation',
        })
      );
    }

    startMicrophone();
  };

  const handleStop = () => {
    if (!conversationStarted) return;

    stopMicrophone();
    stopAudioPlayback();
    setConversationStarted(false);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: 'stop',
          message: 'Ending conversation',
        })
      );
    }

    if (onCallEnded) onCallEnded();
  };

  const handleRefresh = () => {
    if (onRefreshCalendar) {
      onRefreshCalendar();
    }
  };

  return (
    <div className="left-panel">
      <button className="refresh-button" onClick={handleRefresh}>
        &#x21bb;
      </button>

      <h1>Przetestuj AriaCall!</h1>

      <div id="visual">
        <div id="ball" ref={ballRef}></div>
      </div>

      <div className="button-container">
        <button
          className="call-button"
          onClick={handleStart}
          disabled={conversationStarted}
        >
          <FaPhoneAlt className="icon" />
        </button>
        <button
          className="hangup-button"
          onClick={handleStop}
          disabled={!conversationStarted}
        >
          <FaPhoneSlash className="icon" />
        </button>
      </div>

      <div id="output">
        {output.map((text, index) => (
          <p key={index}>{text}</p>
        ))}
      </div>
    </div>
  );
}

export default LeftPanel;