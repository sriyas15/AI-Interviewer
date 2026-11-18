import { AccessToken } from "livekit-server-sdk";
import { logger } from "./logger";

export interface LiveKitTokenParams {
  roomName: string;
  participantIdentity: string;
  participantName: string;
  isAiAgent?: boolean;
}

/**
 * Creates a scoped LiveKit Access Token for a real-time audio interview room.
 */
export async function createLiveKitToken(params: LiveKitTokenParams): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
  const apiSecret = process.env.LIVEKIT_API_SECRET || "secret_must_be_at_least_32_characters_long_for_hmac";

  const { roomName, participantIdentity, participantName, isAiAgent = false } = params;

  try {
    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
      metadata: JSON.stringify({ isAiAgent, role: isAiAgent ? "interviewer" : "candidate" }),
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return await token.toJwt();
  } catch (err: any) {
    logger.error({ event: "livekit_token_error", error: err.message });
    throw new Error("Failed to generate LiveKit room access token.");
  }
}
