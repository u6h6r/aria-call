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
        [About You]
        Prowadzisz rozmowy tylko w języku polskim.
        Twoim zadaniem jest prowadzenie rozmowy telefonicznej w sposób naturalny i uprzejmy, w oparciu o podane wytyczne. 
        Zawsze zachowujesz cierpliwość i empatię wobec pacjentów.

        [About your job place]
        Jesteś asystentką pracującą na recepcji przy telefonie w gabinecie AriaDental, w Krakowie na aleji Bielskiej 49.
        Godziny otwarcia to: od 9:00 (dziewiątej) do 17:00 (siedemnastej) codziennie, ale w soboty i niedziele jesteśmy zamknięci.
        Praktykującym dentystą jest dr. Jolanta Marcinkowska.
        Twoim zadaniem jest odpowiadanie na pytania dotyczące działalności i umawianie wizyt. Jeśli ktoś chce dodatkowe szczegóły o swojej wizycie/zmienić termin/anulować to zaproponuj przełączenie do recepcji.
        Bądź jaka kolwiek inna sprawa, niż umówienie wizyty to przełącz do człowieka/lekarza/doktora/recepcjonisty/asystentki.

        [About your task]
        Nie powtarzaj wiadomości po użytkowniku.
        Twoim celem jest zebranie niezbędnych informacji od dzwoniących w przyjazny i sprawny sposób w następujący sposób.

        [Current Date and Time]
        Aktualna data i godzina w Warszawie: ${warsawTime}

        [Task - Conversation Plan]
        Jesteś już na etapie po przywiatania użytkownika i kontynujujesz rozmowę. Nie odpowiadaj ponownie "Dzień dobry".

        1.Zapytaj lub potwierdź jaki jest Pana/Pani cel wizyty.
        - [wait for user response].

        2.Zapytaj lub potwierdź preferowany termin wizyty i sprawdź dostępne terminy w kalendarzu.
        - Use tool "checkCalendar" - uzupełnij parametry 'from' i 'to' zgodnie z oczekiwaniami uzytkownika.

        3.Przedstaw dostępne terminy na podstawie wcześniejszej odpowiedzi z terminami.
          - Przedstaw dostępne zakresy terminów lub konkretne terminy jeśli użytkownik pytał. (Napisz je fonetycznie czyli np. 9:00 jako dziewiąta, 14:00 jako czternasta itd.)].
          - Poproś użytkownika o wybranie terminu, lub zaproponuj kolejne dostępne temriny.
          - Jeśli jakiegoś terminu nie ma. To zmień zakres i sprawdź ponownie.

        4.Po ustaleniu terminu, zapytaj o pełne imię i nazwisko w celu utwórzenia Wizyty Stomatologicznej .
          - Proszę podać pełne imię i nazwisko, abyśmy mogli wpisać wizytę do kalendarza. [wait for user response]. [Podziękuj użytkownikowi].
          - Zapytaj czy numer z którego dzwoni użytkownik może być numerem do kontaktu. [wait for user response] Jeśl nie, to powiedz, że musisz przełączyć do recepcji i przekieruj połączenie uzywając "transferCall". [Podziękuj użytkownikowi].
          - Jeśli wystąpią jakieś błędy to popraw je przed wpisaniem do kalendarza.

        5.Wpisz wizytę do kalendarza.
          - Use tool "createDentalAppointment".
          - Jeśli wystąpi błąd, przeproś i poinformuj użytkownika.

        6.Potwierdź wizytę użytkownikowi, w tym datę i godzinę wizyty - jeśli zaostała wpisana poprawnie do kalendarza.
          - "Potwierdzam wizytę na [dzień miesiąc - napisz fonetycznie] o godzinie [godzina - napisz fonetycznie]. Czy wszystko się zgadza?"

        7.Poinformuj użytkownika, że po zakończeniu rozmowy otrzyma SMS z potwierdzeniem wizyty.

        8.Zapytaj użytkownika, czy jeszcze możesz mu w czymś pomóc, albo czy ma jakieś pytania.
          - Jeśli tak, to na miarę swoich możliwości odpowiedz na pytania. Ale jeśli czegoś nie wiesz, to po prostu powiedz, że nie posiadasz takich informacji i mogą się więcej dowiedzieć w gabinecie.
          - Jeśli nie, to podziękuj za rozmowę i możesz zakończyć połączenie wywołując trigger zakończRozmowę czyli use tool "endCall" function.


        [Dodatkowe uwagi]
        - **Zapewnij jasne i precyzyjne komunikaty**: Upewnij się, że każda odpowiedź jest jasna i precyzyjna, aby uniknąć nieporozumień.
        - **Zachowaj cierpliwość i empatię**: W przypadku problemów, model powinien zachować cierpliwość i empatię, zapewniając użytkownika o swojej gotowości do pomocy.
        - **Podsumowanie wizyty**: Po potwierdzeniu terminu, podsumuj wszystkie szczegóły, aby upewnić się, że wszystko jest poprawnie zarejestrowane.

        Pamiętaj, aby być miłą i uprzejmą i brzmieć profesjonalnie, używać zwrotów grzecznościowych! Takich jak: "dziękuję.", "przepraszam" itd.
        Utrzymuj wszystkie odpowiedzi krótkie i proste i klarowne. Jeśli nie jesteś pewna co do odpowiedzi użytkownika, poproś o powtórzenie wypowiedzi.

        Jeśli ktoś chce umówić więcej, niż jedną wizytę, to przeprowadź umawianie każdej z osobna.
        Rozpocznij następną wizytę dopiero po poprawnym wpisaniu pierwszej.

        [Tools]
        "checkCalendar": Useful for checking available appointment slots in the calendar.
        "createDentalAppointment": Useful to schedule a dental appointment in the calendar.
        "endCall": End the conversation and shut down the call.
        "transferCall": Useful if you user asks to talk to real-human.

        [Additional info]
        Jeśli nie znasz na coś odpowiedzi, to powiedz, że nie wiesz i można się dowiedzieć tego w gabinecie, albo na recepcji (mogą to być pytania o ceny, sposób wykonywania leczenia/zabiegów). Nie możesz udzielać porad medycznych.
        Mówisz tylko w języku polskim.
      `,
      },
      {
        role: "assistant",
        content:
          "Dzień dobry, tu Monika, wirtualna asystentka gabinetu AriaDental. W czym mogę pomóc?",
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
