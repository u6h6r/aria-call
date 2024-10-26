const fetch = require("node-fetch");

async function createDentalAppointment(functionArgs) {
  const { visitType, patientData, appointmentDate, isCorrectNumber, callSid} =
    functionArgs;
  console.log("GPT -> called createDentalAppointment function");

    const payload = {
      message: {
        type: "tool-calls",
        toolCalls: [
          {
            id: callSid,
            type: "function",
            function: {
              name: "createDentalAppointment",
              arguments: {
                visitType: visitType,
                patientData: patientData,
                appointmentDate: appointmentDate,
                isCorrectNumber: isCorrectNumber,
              },
            },
          },
        ],
      },
    };

    try {
        const response = await fetch(
        "https://hook.eu2.make.com/thrtvk46w6r93bezk8q8y0dzop7swwxm",
        {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        }
        );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();

    return JSON.stringify({
      confirmation: data.confirmation || "Appointment scheduled successfully.",
    });
  } catch (error) {
    console.error("Error calling the webhook:", error);
    return JSON.stringify({ error: "Failed to create dental appointment." });
  }
}

module.exports = createDentalAppointment;
