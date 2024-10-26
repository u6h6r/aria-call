const fetch = require("node-fetch");

async function checkCalendar(functionArgs) {
  const { slotDuration, from, to } = functionArgs;
  console.log("GPT -> called checkCalendar function");

  if (!slotDuration || !from || !to) {
    return JSON.stringify({ error: "Missing required parameters" });
  }

  try {
    const bodyPayload = {
      slotDuration: slotDuration,
      from: from,
      to: to,
    };

    console.log(bodyPayload);

    const response = await fetch(
      "https://hook.eu2.make.com/n5v8cgvqp1safjsrsw6djorb561un5yg",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      }
    );

    const contentType = response.headers.get("content-type");
    let data;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    console.log(data);
    return JSON.stringify(data);
  } catch (error) {
    console.error("Error calling the webhook:", error);
    return JSON.stringify({ error: "Failed to check calendar slots." });
  }
}

module.exports = checkCalendar;

