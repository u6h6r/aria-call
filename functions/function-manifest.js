const tools = [
  {
    type: "function",
    function: {
      name: "createDentalAppointment",
      say: "Proszę chwilkę poczekać, już wpisuję wizytę do kalendarza.",
      description:
        "Useful for scheduling dental appointments, capturing patient details, visit type, appointment date, and verifying contact information.",
      parameters: {
        type: "object",
        properties: {
          visitType: {
            description:
              "Specifies the type of dental visit, such as cleaning, filling, extraction, or consultation etc.",
            type: "string",
          },
          patientData: {
            description: "Full name of the patient",
            type: "string",
          },
          appointmentDate: {
            description:
              "The scheduled date and time for the patient's appointment.",
            type: "string",
          },
          isCorrectNumber: {
            description:
              "Indicates whether the current contact number patient is calling is accurate and can be used to reach the patient.",
            type: "boolean",
          },
        },
        required: [
          "visitType",
          "patientData",
          "appointmentDate",
          "isCorrectNumber",
        ],
      },
      returns: {
        type: "object",
        properties: {
          confirmation: {
            type: "string",
            description:
              "Confirmation message indicating the appointment was scheduled successfully.",
          },
          error: {
            type: "string",
            description:
              "Error message in case the appointment could not be scheduled.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "checkCalendar",
      say: "Proszę o chwilkę cierpliwości. Sprawdzam dostępne terminy w kalendarzu.",
      description:
        "Retrieve available time slots from a specified calendar based on the user's preferred time ranges and days. If no preferred slots are available, the function returns the earliest possible time slot.",
      parameters: {
        type: "object",
        properties: {
          slotDuration: {
            type: "integer",
            description: "The duration of each time slot in minutes.",
          },
          from: {
            type: "string",
            format: "date-time",
            description:
              "The start date and time for the search range in ISO 8601 format.",
          },
          to: {
            type: "string",
            format: "date-time",
            description:
              "The end date and time for the search range in ISO 8601 format.",
          },
        },
        required: ["slotDuration", "from", "to"],
      },
      returns: {
        type: "object",
        properties: {
          availableSlots: {
            type: "array",
            items: {
              type: "string",
              format: "date-time",
            },
            description:
              "An array of available date-time slots in ISO 8601 format.",
          },
          error: {
            type: "string",
            description: "An error message if the operation fails.",
          },
        },
      },
    },
  },
  // {
  //   type: "function",
  //   function: {
  //     name: "endCall",
  //     say: "Dziękujemy za rozmowę. Gabinet Aria Dental.",
  //     description: "Terminates the current call.",
  //     parameters: {
  //       type: "object",
  //       properties: {
  //         callSid: {
  //           description:
  //             "The unique identifier for the call that needs to be terminated.",
  //           type: "string",
  //         },
  //       },
  //       required: ["callSid"],
  //     },
  //     returns: {
  //       type: "object",
  //       properties: {
  //         status: {
  //           type: "string",
  //           description:
  //             'The status of the call termination attempt, e.g., "success" or "error".',
  //         },
  //         message: {
  //           type: "string",
  //           description:
  //             "A message detailing the result of the termination attempt.",
  //         },
  //       },
  //     },
  //   },
  // },
  {
    type: "function",
    function: {
      name: "transferCall",
      say: "Chwileczkę, przełączam do recepcji. Proszę o cierpliwość.",
      description:
        "Transfers the customer to a live agent in case they request help from a real person.",
      parameters: {
        type: "object",
        properties: {
          callSid: {
            type: "string",
            description: "The unique identifier for the active phone call.",
          },
        },
        required: ["callSid"],
      },
      returns: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description:
              "Whether or not the customer call was successfully transfered",
          },
        },
      },
    },
  },
];

module.exports = tools;