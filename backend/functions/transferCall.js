require('dotenv').config();

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const transferCall = async function (call) {

  console.log('Transferring call', call.callSid);
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = require('twilio')(accountSid, authToken);
  await delay(6000);
  client.calls(call.callSid)
    .update({twiml: `<Response><Dial><Number>${process.env.TRANSFER_NUMBER}</Number></Dial></Response>`})
  return "Połączenie zostało pomyślnie przekazane, pożegnaj się z klientem.";
};

module.exports = transferCall;