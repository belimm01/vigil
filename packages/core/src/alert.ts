export type AlertTransition = "open" | "resolved";

export interface AlertInput {
  monitorName: string;
  transition: AlertTransition;
  cause?: string | null;
  at: Date;
}

export interface AlertMessage {
  subject: string;
  text: string;
}

export function formatAlert(input: AlertInput): AlertMessage {
  const when = input.at.toISOString();

  if (input.transition === "open") {
    const cause = input.cause ? ` Cause: ${input.cause}.` : "";
    return {
      subject: `[Vigil] ${input.monitorName} is DOWN`,
      text: `Monitor "${input.monitorName}" went down at ${when}.${cause}`,
    };
  }

  return {
    subject: `[Vigil] ${input.monitorName} has recovered`,
    text: `Monitor "${input.monitorName}" recovered at ${when}.`,
  };
}
