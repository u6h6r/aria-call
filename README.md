# AriaCall: ai-powered receptionist for dental clinics

AriaCall is an advanced AI-powered receptionist designed specifically for dental clinics. It answers every call, schedules appointments, provides information, and is fully integrated with your clinic’s calendar and management system. Powered by the latest generative AI and voice technologies, AriaCall ensures seamless, professional, and personalized patient communication around the clock.

## Features:
- 🏁 **Real-time interaction:** responds to patients with low latency, typically within 1 second, using streaming technology.
- 🗣️ **Appointment scheduling:** automatically schedules, reschedules, or cancels appointments in your clinic's calendar.
- 🗓️ **Calendar checking:** provides real-time updates on available appointment slots based on your calendar.
- 💬 **Dynamic conversations:** AriaCall can switch topics if patients have additional queries, maintaining a natural flow of conversation.
- 📔 **Conversation history:** tracks chat history for smooth interaction and better patient communication.
- 🛠️ **Tool integration:** AriaCall can call external tools and APIs to provide real-time data or actions.

## Setting up for Development

### Prerequisites
Before you start, ensure you have accounts and API keys for the following services:
- [Deepgram](https://deepgram.com) for speech-to-text and text-to-speech.
- [OpenAI](https://platform.openai.com) for GPT responses.

### 1. Configure Environment Variables
Create`.env` and configure the following environment variables:

```bash
SERVER="yourserverdomain.com"
OPENAI_API_KEY="sk-XXXXXX"
DEEPGRAM_API_KEY="YOUR-DEEPGRAM-API-KEY"
FROM_NUMBER='+12223334444'
TO_NUMBER='+13334445555'
```

### 2. Install Dependencies with NPM
Install the necessary packages:

```bash
npm install
```

### 3. Start Your Server in Development Mode
Run the following command:

```bash
npm run dev
```

### 4. Run app locally

Simply by double click on `index.html` to launch app frontend in your local browser.

## How AriaCall Works
AriaCall orchestrates interactions between multiple services (Deepgram, OpenAI) to handle voice calls in real time. 

1. **Deepgram** transcribes the audio and returns text in real time.
2. **OpenAI GPT** processes the text and generates responses.
3. **Deepgram** converts GPT’s text into speech, which is sent back and played to the caller.

___
Aria