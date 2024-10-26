require('colors');
const EventEmitter = require('events');
const OpenAI = require('openai');
const endCall = require('../functions/endCall');
const tools = require('../functions/function-manifest');

const availableFunctions = {};
tools.forEach((tool) => {
  let functionName = tool.function.name;
  availableFunctions[functionName] = require(`../functions/${functionName}`);
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class GptService extends EventEmitter {
  constructor() {
    super();
    this.openai = new OpenAI({
      organization: "org-o4W0bqFEOwWMidKLQ3hKsvhF",
      project: "proj_9r9D5HcWDBW8YiTdr8IUoKJk",
    });
    let callSid;
    const options = {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "long",
    };
    const warsawTime = new Date().toLocaleString("pl-PL", options);
    (this.userContext = [
      {
        role: "system",
        content: `
        **[About You]**

        Your task is to carry out telephone conversations in a natural and polite manner, based on the provided guidelines.
        You always maintain patience and empathy towards patients.

        ---

        **[About Your Job Place]**

        You are an assistant working at the reception desk on the phone at AriaDental clinic, located in Kraków at 49 Bielska Avenue.
        Opening hours are from 9:00 AM (nine o'clock) to 5:00 PM (seventeen o'clock) every day, but we are closed on Saturdays and Sundays.
        The practicing dentist is Dr. Jolanta Marcinkowska.
        Your task is to answer questions regarding the clinic's operations and schedule appointments. If someone wants additional details about their visit, change the date, or cancel, offer to transfer them to reception.
        For any other matters beyond scheduling an appointment, transfer the call to a human/doctor/receptionist/assistant.

        ---

        **[About Your Task]**

        Do not repeat the user's messages.
        Your goal is to collect the necessary information from callers in a friendly and efficient manner as follows.

        ---

        **[Current Date and Time]**
        Current date and time in Warsaw: ${warsawTime}

        ---

        **[Task - Conversation Plan]**

        You are already past the stage of greeting the user and are continuing the conversation. Do not say "Good morning" again.

        1. **Ask or confirm the purpose of the visit.**
          - *[Wait for user response].*

        2. **Ask or confirm the preferred appointment date and check available slots in the calendar.**
          - Use tool "checkCalendar" – fill in the 'from' and 'to' parameters according to the user's preferences.

        3. **Present available times based on the previous response with dates.**
          - Present available date ranges or specific times if the user requested them. *(Write them phonetically, e.g., 9:00 as nine o'clock, 14:00 as two o'clock in the afternoon, etc.).*
          - Ask the user to choose a time or suggest additional available slots.
          - If a certain time is not available, adjust the range and check again.

        4. **After setting the time, ask for the full name to create a Dental Appointment.**
          - "Please provide your full name so we can enter the appointment into the calendar." *[Wait for user response].* *[Thank the user].*
          - Ask if the number they are calling from can be used as a contact number. *[Wait for user response].* If not, inform them that you need to transfer them to reception and transfer the call using "transferCall". *[Thank the user].*
          - If any errors occur, correct them before entering into the calendar.

        5. **Enter the appointment into the calendar.**
          - Use tool "createDentalAppointment".
          - If an error occurs, apologize and inform the user.

        6. **Confirm the appointment with the user, including the date and time—if it was correctly entered into the calendar.**
          - "I confirm your appointment on [day and month – write phonetically] at [time – write phonetically]. Is everything correct?"

        7. **Inform the user that they will receive an SMS confirmation after the call.**

        8. **Ask the user if there's anything else you can assist with or if they have any questions.**
          - If yes, answer their questions to the best of your ability. If you don't know something, simply say that you don't have that information and they can learn more at the clinic.
          - If not, thank them for the call and you may end the conversation by invoking the "endCall" function.

        ---

        **[Additional Notes]**

        - **Ensure Clear and Precise Communication**: Make sure every response is clear and precise to avoid misunderstandings.
        - **Maintain Patience and Empathy**: In case of any issues, remain patient and empathetic, assuring the user of your readiness to help.
        - **Appointment Summary**: After confirming the time, summarize all details to ensure everything is correctly registered.

        Remember to be kind and polite, sound professional, and use courteous phrases like "thank you," "sorry," etc.
        Keep all responses short, simple, and clear. If you're unsure about the user's response, ask them to repeat it.
        If someone wants to schedule more than one appointment, handle each scheduling separately.
        Begin the next appointment only after the first one has been correctly entered.

        ---

        **[Tools]**

        - **"checkCalendar"**: Useful for checking available appointment slots in the calendar.
        - **"createDentalAppointment"**: Useful for scheduling a dental appointment in the calendar.
        - **"endCall"**: Ends the conversation and shuts down the call.
        - **"transferCall"**: Useful if the user asks to speak with a real human.

        ---

        **[Additional Info]**

        If you don't know the answer to something, say that you don't know and that they can find out more at the clinic or reception (this could be questions about prices, how treatments/procedures are performed). You cannot provide medical advice.
      `,
      },
      {
        role: "assistant",
        content:
          "Hello, it's Eva, the virtual assistant of AriaDental clinic. How can I help you?",
      },
    ]),
      (this.partialResponseIndex = 0);
  }

  setCallSid (callSid) {
    console.log(callSid);
    this.callSid = callSid;
    this.userContext.push({ 'role': 'system', 'content': `callSid: ${callSid}` });
  }

  validateFunctionArgs (args) {
    try {
      return JSON.parse(args);
    } catch (error) {
      console.log('Warning: Double function arguments returned by OpenAI:', args);
      if (args.indexOf('{') != args.lastIndexOf('{')) {
        return JSON.parse(args.substring(args.indexOf(''), args.indexOf('}') + 1));
      }
    }
  }

  updateUserContext(name, role, text) {
    if (name !== 'user') {
      this.userContext.push({ 'role': role, 'name': name, 'content': text });
    } else {
      this.userContext.push({ 'role': role, 'content': text });
    }
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    this.updateUserContext(name, role, text);

    const stream = await this.openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      temperature: 0.35,
      messages: this.userContext,
      tools: tools,
      stream: true,
    });

    let completeResponse = "";
    let partialResponse = "";
    let functionName = "";
    let functionArgs = "";
    let finishReason = "";
    let functionCalled = false;

    function collectToolInformation(deltas) {
      let name = deltas.tool_calls[0]?.function?.name || "";
      if (name != "") {
        functionName = name;
      }
      let args = deltas.tool_calls[0]?.function?.arguments || "";
      if (args != "") {
        functionArgs += args;
      }
    }

    for await (const chunk of stream) {
      let content = chunk.choices[0]?.delta?.content || "";
      let deltas = chunk.choices[0].delta;
      finishReason = chunk.choices[0].finish_reason;

      if (deltas.tool_calls && !functionCalled) {
        collectToolInformation(deltas);
      }

      if (finishReason === "tool_calls" && !functionCalled) {
        functionCalled = true;
        const functionToCall = availableFunctions[functionName];
        let validatedArgs = this.validateFunctionArgs(functionArgs);

        const toolData = tools.find(
          (tool) => tool.function.name === functionName
        );
        const say = toolData.function.say;

        this.emit(
          "gptreply",
          {
            partialResponseIndex: null,
            partialResponse: say,
          },
          interactionCount
        );

        let functionResponse;

        if (functionName === "createDentalAppointment") {
          validatedArgs.callSid = this.callSid;
          console.log(validatedArgs);
          functionResponse = await functionToCall(validatedArgs);
        }

        else if (functionName === "transferCall") {
          functionResponse = await functionToCall(validatedArgs);
          console.log(functionResponse);
          break;
        }
        
        else {
          functionResponse = await functionToCall(validatedArgs);
        }

        this.updateUserContext(functionName, "function", functionResponse);

        await this.completion(
          functionResponse,
          interactionCount,
          "function",
          functionName
        );
        break;
      } else {
        completeResponse += content;
        partialResponse += content;
        if (content.trim().slice(-1) === "•" || finishReason === "stop") {
          const gptReply = {
            partialResponseIndex: this.partialResponseIndex,
            partialResponse,
          };

          this.emit("gptreply", gptReply, interactionCount);
          this.partialResponseIndex++;
          partialResponse = "";
        }
      }
    }
    this.userContext.push({ role: "assistant", content: completeResponse });
    console.log(`GPT -> user context length: ${this.userContext.length}`.green);
  }
}

module.exports = { GptService };
