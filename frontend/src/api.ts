async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface Habit {
  id: string;
  name: string;
  createdAt: string;
  completions: string[];
  streak: number;
  completedToday: boolean;
}

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  topic: string;
  createdAt: string;
}

export interface NoteItem {
  id: string;
  title: string;
  body: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
}

export type ReadingStatus = "todo" | "in-progress" | "done";

export interface ReadingItem {
  id: string;
  title: string;
  url?: string;
  status: ReadingStatus;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start?: string;
  end?: string;
  link?: string;
  calendar?: string;
}

export interface CalendarStatus {
  configured: boolean;
  connected: boolean;
}

export interface DayUsage {
  date: string;
  tokens: number;
  messages: number;
}

export interface UsageSummary {
  available: boolean;
  days: DayUsage[];
  todayTokens: number;
  todayMessages: number;
  weekTokens: number;
  updatedAt: string;
}

export interface AccountLoginStatus {
  loggedIn: boolean;
}

export interface AccountUsage {
  loggedIn: true;
  planName: string | null;
  session: { percent: number; resetsAt: string } | null;
  weekly: { percent: number; resetsAt: string } | null;
  credits: { enabled: boolean; percent: number; used: number; limit: number; currency: string } | null;
}

export const api = {
  habits: {
    list: () => request<Habit[]>("/habits"),
    create: (name: string) => request<Habit>("/habits", { method: "POST", body: JSON.stringify({ name }) }),
    remove: (id: string) => request<void>(`/habits/${id}`, { method: "DELETE" }),
    checkin: (id: string) => request<Habit>(`/habits/${id}/checkin`, { method: "POST" }),
  },
  learning: {
    links: {
      list: () => request<LinkItem[]>("/learning/links"),
      create: (data: { title: string; url: string; topic?: string }) =>
        request<LinkItem>("/learning/links", { method: "POST", body: JSON.stringify(data) }),
      remove: (id: string) => request<void>(`/learning/links/${id}`, { method: "DELETE" }),
    },
    notes: {
      list: () => request<NoteItem[]>("/learning/notes"),
      create: (data: { title: string; body?: string; topic?: string }) =>
        request<NoteItem>("/learning/notes", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: { title?: string; body?: string; topic?: string }) =>
        request<NoteItem>(`/learning/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      remove: (id: string) => request<void>(`/learning/notes/${id}`, { method: "DELETE" }),
    },
    readingList: {
      list: () => request<ReadingItem[]>("/learning/reading-list"),
      create: (data: { title: string; url?: string }) =>
        request<ReadingItem>("/learning/reading-list", { method: "POST", body: JSON.stringify(data) }),
      setStatus: (id: string, status: ReadingStatus) =>
        request<ReadingItem>(`/learning/reading-list/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
      remove: (id: string) => request<void>(`/learning/reading-list/${id}`, { method: "DELETE" }),
    },
  },
  calendar: {
    status: () => request<CalendarStatus>("/calendar/status"),
    authUrl: () => request<{ url: string }>("/calendar/auth-url"),
    events: () => request<{ events: CalendarEvent[] }>("/calendar/events"),
  },
  usage: {
    summary: () => request<UsageSummary>("/usage"),
  },
  account: {
    status: () => request<AccountLoginStatus>("/account/status"),
    login: () => request<AccountLoginStatus>("/account/login", { method: "POST" }),
    usage: () => request<AccountUsage>("/account/usage"),
  },
};
