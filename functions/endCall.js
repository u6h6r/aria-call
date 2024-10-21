// const twilio = require("twilio");

// const client = twilio(
//   process.env.TWILIO_ACCOUNT_SID,
//   process.env.TWILIO_AUTH_TOKEN
// );

// function delay(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

// async function endCall(callSidObj) {
//   const callSid = callSidObj.callSid;
//   console.log(`Received callSid: ${callSid}`);

//   try {
//     if (typeof callSid !== "string") {
//       throw new Error("Invalid callSid provided");
//     }

//     await delay(5000);
//     const call = await client.calls(callSid).update({ status: "completed" });
//     console.log(`Call ${callSid} ended successfully.`);

//     return JSON.stringify({
//       status: "success",
//       message: `Call ${callSid} ended successfully.`,
//     });
//   } catch (err) {
//     console.error(`Failed to end call ${callSid}:`, err);

//     return JSON.stringify({
//       status: "error - try again to end the call.",
//       message: `Failed to end call ${callSid}: ${err.message}`,
//     });
//   }
// }

// module.exports = endCall;
