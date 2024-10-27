const tools = [
  {
    type: "function",
    function: {
      name: "createDentalAppointment",
      say: "One moment, please; I'm just adding your appointment to our schedule.",
      description:
        "Useful for scheduling dental appointments, capturing patient details, visit type, appointment date",
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
        },
        required: [
          "visitType",
          "patientData",
          "appointmentDate",
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
      say: "Just a moment, please—I'm checking our calendar for available appointments.",
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
  {
    type: "function",
    function: {
      name: "endCall",
      say: "Thank you for calling AriaDental. Have a great day",
      description: "Terminates the current call.",
      parameters: {
        type: "object",
        properties: {
          callSid: {
            description:
              "The unique identifier for the call that needs to be terminated.",
            type: "string",
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
              'The status of the call termination attempt, e.g., "success" or "error".',
          },
          message: {
            type: "string",
            description:
              "A message detailing the result of the termination attempt.",
          },
        },
      },
    },
  },
];

module.exports = tools;