import { Client } from "@microsoft/microsoft-graph-client";

export function createGraphClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// --- EMAIL ---
export async function getEmails(accessToken: string, top = 25, folder = "inbox") {
  const client = createGraphClient(accessToken);
  const response = await client
    .api(`/me/mailFolders/${folder}/messages`)
    .top(top)
    .select("id,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead,importance")
    .orderby("receivedDateTime desc")
    .get();
  return response.value;
}

export async function sendEmail(
  accessToken: string,
  to: string[],
  subject: string,
  body: string,
  contentType: "HTML" | "Text" = "HTML"
) {
  const client = createGraphClient(accessToken);
  await client.api("/me/sendMail").post({
    message: {
      subject,
      body: { contentType, content: body },
      toRecipients: to.map((email) => ({
        emailAddress: { address: email },
      })),
    },
  });
}

export async function replyToEmail(
  accessToken: string,
  messageId: string,
  body: string,
  contentType: "HTML" | "Text" = "HTML"
) {
  const client = createGraphClient(accessToken);
  await client.api(`/me/messages/${messageId}/reply`).post({
    comment: body,
    contentType,
  });
}

// --- CALENDAR ---
export async function getCalendarEvents(accessToken: string, top = 25) {
  const client = createGraphClient(accessToken);
  const response = await client
    .api("/me/calendarView")
    .query({
      startDateTime: new Date().toISOString(),
      endDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .top(top)
    .select("id,subject,start,end,location,isAllDay,importance,organizer,bodyPreview")
    .orderby("start/dateTime")
    .get();
  return response.value;
}

export async function createCalendarEvent(
  accessToken: string,
  event: {
    subject: string;
    start: string;
    end: string;
    body?: string;
    location?: string;
    attendees?: string[];
  }
) {
  const client = createGraphClient(accessToken);
  const payload: Record<string, unknown> = {
    subject: event.subject,
    start: { dateTime: event.start, timeZone: "UTC" },
    end: { dateTime: event.end, timeZone: "UTC" },
  };

  if (event.body) {
    payload.body = { contentType: "HTML", content: event.body };
  }
  if (event.location) {
    payload.location = { displayName: event.location };
  }
  if (event.attendees?.length) {
    payload.attendees = event.attendees.map((email) => ({
      emailAddress: { address: email },
      type: "required",
    }));
  }

  return await client.api("/me/events").post(payload);
}

// --- TEAMS ---
export async function getTeamsChats(accessToken: string, top = 25) {
  const client = createGraphClient(accessToken);
  const response = await client
    .api("/me/chats")
    .top(top)
    .select("id,topic,chatType,lastMessagePreview,updatedDateTime")
    .orderby("updatedDateTime desc")
    .get();
  return response.value;
}

export async function getChatMessages(accessToken: string, chatId: string, top = 50) {
  const client = createGraphClient(accessToken);
  const response = await client
    .api(`/me/chats/${chatId}/messages`)
    .top(top)
    .select("id,body,from,createdDateTime,importance")
    .orderby("createdDateTime desc")
    .get();
  return response.value;
}

export async function sendTeamsMessage(
  accessToken: string,
  chatId: string,
  message: string
) {
  const client = createGraphClient(accessToken);
  return await client.api(`/me/chats/${chatId}/messages`).post({
    body: { contentType: "html", content: message },
  });
}

export async function getTeams(accessToken: string) {
  const client = createGraphClient(accessToken);
  const response = await client
    .api("/me/joinedTeams")
    .select("id,displayName,description")
    .get();
  return response.value;
}

export async function getTeamChannels(accessToken: string, teamId: string) {
  const client = createGraphClient(accessToken);
  const response = await client
    .api(`/teams/${teamId}/channels`)
    .select("id,displayName,description")
    .get();
  return response.value;
}

export async function getChannelMessages(
  accessToken: string,
  teamId: string,
  channelId: string,
  top = 50
) {
  const client = createGraphClient(accessToken);
  const response = await client
    .api(`/teams/${teamId}/channels/${channelId}/messages`)
    .top(top)
    .select("id,body,from,createdDateTime,importance")
    .get();
  return response.value;
}

// --- USER ---
export async function getUserProfile(accessToken: string) {
  const client = createGraphClient(accessToken);
  return await client
    .api("/me")
    .select("id,displayName,mail,userPrincipalName")
    .get();
}
