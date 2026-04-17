type AuthEmailPayload = {
  to: string;
  subject: string;
  text: string;
};

const formatEmail = ({ to, subject, text }: AuthEmailPayload) =>
  [
    "BioGT auth email",
    `to=${to}`,
    `subject=${subject}`,
    "",
    text
  ].join("\n");

export const sendAuthEmail = async (payload: AuthEmailPayload) => {
  // Local development uses console delivery until a real SMTP provider is wired.
  console.info(formatEmail(payload));
};
